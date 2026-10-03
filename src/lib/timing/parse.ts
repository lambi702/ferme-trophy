/**
 * Parseur TOLÉRANT des données de chronométrage. O'Top chronomètre avec
 * RACE RESULT sur son propre serveur ; on ne sait pas encore quel format
 * ils configureront, donc on reconnaît tout ce que RaceResult sait produire
 * (doc officielle consultée le 2026-10-01) :
 *
 *  - Exporters "Raw Data Record JSON" : {"ID":1,"Bib":50001,"TimingPoint":
 *    "STARTFINISH","Time":32795.944,"Invalid":false,"Passing":{...,
 *    "UTCTime":"2024-01-12T09:06:35.944Z"}} (objets imbriqués aplatis)
 *  - Exporters "Raw Data Record V1/V2" : "7750;ZCMBG52;;10:50:00.477;0;72;..."
 *    (n° de passage ; dossard/transpondeur ; date ; heure ; ...)
 *  - Exporter "RunScore RSBCI" : "RSBCI,12,10:50:00.477,START+FINISH"
 *  - Expressions perso, ex. [Event.ID];[RD_TimingPoint];[Bib];[RD_Time]
 *    (le dossard = colonne entière la plus proche AVANT la colonne heure)
 *  - Simple API / data/list en JSON (tableaux de tableaux), CSV, TXT, XML
 *    non géré ; webhooks RaceResult (JSON en POST)
 *  - formulaire / query string (GET), texte brut une ligne par passage
 *
 * Chaque enregistrement devient soit un PASSAGE (bib [+ heure/id]), soit un
 * COMPTEUR (bib + nombre de tours absolu) si une colonne "tours" existe.
 * Noms de colonnes auto-détectés (alias FR/EN/NL/DE + champs RD_*), ou forcés
 * depuis /admin/chrono — par nom, ou par NUMÉRO de colonne (1, 2, 3...) pour
 * les données sans en-tête.
 */

export type ParsedRecord = {
  /** Dossard, si le chrono l'envoie. Sinon `chip` (résolu en dossard via Dossard.transponder). */
  bib?: number
  chip?: string
  laps?: number
  time?: string
  externalId?: string
  timingPoint?: string
  /** Tapis/décodeur/boucle qui a lu le passage (sert à fusionner et surveiller 2 tapis côte à côte). */
  mat?: string
}

export type FieldMapping = {
  bibField?: string
  lapsField?: string
  timeField?: string
  idField?: string
  /** Si renseigné, ignore les autres points de chrono. Plusieurs possibles : "TAPIS1, TAPIS2". */
  timingPoint?: string
}

const norm = (k: string) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

// Ordre = priorité. "utctime" (absolu) passe avant "time" (secondes depuis minuit chez RaceResult).
const ALIASES = {
  bib: ['bib', 'rdidbib', 'idbib', 'rdbib', 'bibnumber', 'bibno', 'bibnr', 'startnumber', 'startnr', 'startno', 'startnummer', 'dossard', 'dossardnumber', 'numero', 'number', 'nr', 'no', 'num', 'dorsal', 'rugnummer'],
  laps: ['laps', 'lap', 'lapcount', 'numberoflaps', 'nboflaps', 'nblaps', 'nbtours', 'tours', 'tour', 'nombredetours', 'rounds', 'roundcount', 'rondes', 'ronden', 'runden', 'lapsdone', 'completedlaps', 'totallaps', 'count'],
  time: ['utctime', 'rdtime', 'time', 'passingtime', 'timeofday', 'tod', 'rtc', 'chiptime', 'datetime', 'heure', 'readtime', 'hittime', 'detectiontime', 'zeit', 'tijd', 'timestamp'],
  // PAS "eventid"/"webhookid" : constants pour tout un événement, ils feraient tout passer pour des doublons.
  id: ['id', 'rdid', 'passingid', 'rawdataid', 'pid', 'recordid', 'readid', 'detectionid', 'uid'],
  timingPoint: ['timingpoint', 'rdtimingpoint', 'tp', 'location', 'splitname'],
  invalid: ['invalid', 'isinvalid'],
  chip: ['transponder', 'rdtransponder', 'transpondeur', 'transpondeur1', 'transponder1', 'chip', 'chipcode', 'chipid', 'transpcode', 'tag', 'tagid'],
  device: ['devicename', 'rddecodername', 'decodername', 'boxname', 'deviceid', 'rddecoderid', 'decoderid', 'boxid', 'decoder', 'mat', 'tapis'],
  loop: ['loopid', 'rdloopid', 'loop', 'boucle'],
}
const HEADER_WORDS = new Set([...ALIASES.bib, ...ALIASES.laps, ...ALIASES.time, ...ALIASES.id, ...ALIASES.timingPoint, ...ALIASES.chip])

type Row = Record<string, unknown>

export function parseTimingPayload(body: string, contentType = '', mapping: FieldMapping = {}): ParsedRecord[] {
  const text = body.replace(/^﻿/, '').trim()
  if (!text) return []

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return finalize(rowsToRecords(jsonToRows(JSON.parse(text), mapping), mapping), mapping)
    } catch {
      /* pas du JSON valide → on tente le texte */
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded') || (/^[^\n;,\t]+=/.test(text) && !text.includes('\n'))) {
    return parseParams(new URLSearchParams(text), mapping)
  }

  return finalize(rowsToRecords(textToRows(text, mapping), mapping), mapping)
}

/** GET (Exporter RaceResult en "HTTP Get") : ?bib=12&time=... ou ?data=<lignes>. */
export function parseParams(params: URLSearchParams, mapping: FieldMapping = {}): ParsedRecord[] {
  const obj: Row = {}
  params.forEach((value, key) => {
    if (key !== 'token') obj[key] = value
  })
  const nested = obj.data ?? obj.payload ?? obj.body
  if (typeof nested === 'string' && nested.trim()) return parseTimingPayload(nested, '', mapping)
  if (Object.keys(obj).length === 0) return []
  return finalize(rowsToRecords([obj], mapping), mapping)
}

// --- JSON --------------------------------------------------------------------

function jsonToRows(value: unknown, mapping: FieldMapping): Row[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (value.every((v) => Array.isArray(v))) return tableToRows((value as unknown[][]).map((r) => r.map(cell)), mapping)
    if (value.every((v) => v !== null && typeof v === 'object')) return value.flatMap((v) => jsonToRows(v, mapping))
    // Tableau de valeurs simples → une ligne par valeur (bib seul, ou "bib;heure").
    return tableToRows(value.map((v) => splitLine(String(v))), mapping)
  }
  if (value && typeof value === 'object') {
    const obj = value as Row
    for (const key of ['data', 'list', 'rows', 'results', 'passings', 'records', 'participants', 'items', 'Data', 'List', 'Passings', 'Records']) {
      if (Array.isArray(obj[key])) return jsonToRows(obj[key], mapping)
    }
    const flat = flatten(obj)
    if (findKey(flat, ALIASES.bib, mapping.bibField) !== undefined || findKey(flat, ALIASES.chip) !== undefined) return [flat]
    // Enveloppe { "groupe A": [[...]], "groupe B": [[...]] } (listes groupées) → on concatène.
    const arrays = Object.values(obj).filter(Array.isArray) as unknown[][]
    if (arrays.length > 0) return arrays.flatMap((a) => jsonToRows(a, mapping))
    const objects = Object.values(obj).filter((v) => v && typeof v === 'object')
    if (objects.length > 0) return objects.flatMap((o) => jsonToRows(o, mapping))
    return []
  }
  return []
}

/** {"Bib":1,"Passing":{"UTCTime":...}} → {"Bib":1,"Passing.UTCTime":...} (les clés de surface restent prioritaires). */
function flatten(obj: Row, prefix = '', out: Row = {}): Row {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Row, key, out)
    else out[key] = v
  }
  return out
}

const cell = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

// --- Texte / tableaux --------------------------------------------------------

function textToRows(text: string, mapping: FieldMapping): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return tableToRows(lines.map(splitLine), mapping)
}

function splitLine(line: string): string[] {
  const delimiters = ['\t', ';', '|', ',']
  const delim = delimiters.find((d) => line.includes(d))
  if (!delim) return [line.trim()]
  return line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
}

const TIME_LIKE = /^(\d{4}-\d{2}-\d{2}[T ])?\d{1,2}:\d{2}:\d{2}([.,]\d+)?(Z|[+-]\d{2}:?\d{2})?$/
const DECIMAL = /^\d+[.,]\d+$/
const PURE_INT = /^#?\d+$/
const isTimeLike = (s: string) => TIME_LIKE.test(s) || DECIMAL.test(s)
const colIndex = (s: string | undefined) => (s && /^\d+$/.test(s.trim()) ? Number(s.trim()) - 1 : null)

/** Tableau brut → objets. En-tête utilisée si reconnue, sinon heuristiques RaceResult. */
function tableToRows(table: string[][], mapping: FieldMapping): Row[] {
  if (table.length === 0) return []
  const first = table[0]
  const looksLikeHeader = first.some((c) => /[a-z]/i.test(c) && (HEADER_WORDS.has(norm(c)) || (mapping.bibField && norm(c) === norm(mapping.bibField))))
  if (looksLikeHeader) {
    return table.slice(1).map((cells) => Object.fromEntries(first.map((h, i) => [h, cells[i]])))
  }

  // Colonnes imposées par numéro dans l'admin (données sans en-tête).
  const forcedBib = colIndex(mapping.bibField)
  if (forcedBib !== null) {
    const idx = { laps: colIndex(mapping.lapsField), time: colIndex(mapping.timeField), id: colIndex(mapping.idField) }
    return table.map((c) => ({
      bib: c[forcedBib],
      ...(idx.laps !== null ? { laps: c[idx.laps] } : {}),
      ...(idx.time !== null ? { time: c[idx.time] } : {}),
      ...(idx.id !== null ? { id: c[idx.id] } : {}),
    }))
  }

  return table.map(guessRow)
}

function guessRow(c: string[]): Row {
  // RunScore RSBCI : RSBCI,<dossard>,<hh:mm:ss.kkk>,<point de chrono>
  if (c[0]?.toUpperCase() === 'RSBCI') return { bib: c[1], time: c[2], timingpoint: c[3] }

  // Raw Data Record V1/V2 : <PassingNo>;<Bib/TranspCode>;<Date>;<Time>;...;<LoopID>(10);...;<BoxName>
  // BoxName = 17e champ en V2 (20 champs), 16e en V1 (19 champs). Le n° de passage est propre à
  // chaque décodeur → l'ID inclut le boîtier (sinon 2 tapis pourraient avoir le même n°).
  if (c.length >= 15 && /^\d+$/.test(c[0]) && TIME_LIKE.test(c[3] ?? '')) {
    const box = (c.length >= 20 ? c[16] : c[15]) || ''
    const loop = c[10] || ''
    return { bib: c[1], time: c[3], id: `${box}#${c[0]}@${[c[2], c[3]].filter(Boolean).join(' ')}`, boxname: box, loopid: loop }
  }

  if (c.length === 1) return { bib: c[0] }

  // Expression perso : la colonne heure la plus à gauche (hors 1re), dossard = entier juste avant.
  const t = c.findIndex((v, i) => i > 0 && isTimeLike(v))
  if (t > 0) {
    for (let i = t - 1; i >= 0; i--) {
      if (PURE_INT.test(c[i]) || (i === t - 1 && toChip(c[i]))) {
        // Une colonne texte avant le dossard = le point de chrono ([RD_TimingPoint]).
        const tp = c.slice(0, i).find((v) => /[a-z]/i.test(v))
        return { bib: c[i], time: c[t], ...(tp ? { timingpoint: tp } : {}) }
      }
    }
  }
  // Sinon : dossard en 1re colonne, tours = dernière petite colonne entière (ex : [12,"Nom",5]).
  const row: Row = { bib: c[0] }
  for (let i = c.length - 1; i > 0; i--) {
    if (/^\d{1,4}$/.test(c[i])) { row.laps = c[i]; break }
  }
  return row
}

// --- Objets → enregistrements -------------------------------------------------

function findKey(obj: Row, aliases: string[], forced?: string): string | undefined {
  const keys = Object.keys(obj)
  const last = (k: string) => norm(k.split('.').pop() ?? k)
  const depth = (k: string) => k.split('.').length
  if (forced && !/^\d+$/.test(forced.trim())) {
    const f = norm(forced)
    const hit = keys.filter((k) => norm(k) === f || last(k) === f).sort((a, b) => depth(a) - depth(b))[0]
    if (hit) return hit
  }
  for (const alias of aliases) {
    const hit = keys.filter((k) => last(k) === alias).sort((a, b) => depth(a) - depth(b))[0]
    if (hit) return hit
  }
  return undefined
}

function rowsToRecords(rows: Row[], mapping: FieldMapping): ParsedRecord[] {
  const out: ParsedRecord[] = []
  for (const row of rows) {
    const bibKey = findKey(row, ALIASES.bib, mapping.bibField)
    const bib = bibKey ? toBib(row[bibKey]) : null
    // Pas de dossard numérique : code puce dans la colonne dossard ("Bib/TranspCode") ou colonne dédiée.
    let chip: string | undefined
    if (bib === null) {
      const rawBib = bibKey ? cell(row[bibKey]) : ''
      const chipKey = findKey(row, ALIASES.chip)
      chip = toChip(chipKey ? row[chipKey] : undefined) ?? toChip(rawBib)
      if (!chip) continue
    }

    const invalidKey = findKey(row, ALIASES.invalid)
    if (invalidKey && (row[invalidKey] === true || String(row[invalidKey]).toLowerCase() === 'true' || row[invalidKey] === 1)) continue

    const rec: ParsedRecord = bib !== null ? { bib } : { chip }
    const lapsKey = findKey(row, ALIASES.laps, mapping.lapsField)
    if (lapsKey) {
      const laps = toInt(row[lapsKey])
      if (laps !== null && laps >= 0) rec.laps = laps
    }
    const timeKey = findKey(row, ALIASES.time, mapping.timeField)
    if (timeKey && cell(row[timeKey]) !== '') rec.time = cell(row[timeKey])
    const idKey = findKey(row, ALIASES.id, mapping.idField)
    if (idKey && cell(row[idKey]) !== '') rec.externalId = cell(row[idKey])
    const tpKey = findKey(row, ALIASES.timingPoint)
    if (tpKey && cell(row[tpKey]) !== '') rec.timingPoint = cell(row[tpKey])
    const devKey = findKey(row, ALIASES.device)
    const loopKey = findKey(row, ALIASES.loop)
    const device = devKey ? cell(row[devKey]) : ''
    const loop = loopKey ? cell(row[loopKey]) : ''
    const mat = [device, loop && `boucle ${loop}`].filter(Boolean).join(' · ') || rec.timingPoint
    if (mat) rec.mat = mat
    out.push(rec)
  }
  return out
}

function finalize(records: ParsedRecord[], mapping: FieldMapping): ParsedRecord[] {
  const wanted = (mapping.timingPoint ?? '').split(',').map(norm).filter(Boolean)
  if (wanted.length === 0) return records
  return records.filter((r) => !r.timingPoint || wanted.includes(norm(r.timingPoint)))
}

/** Code puce plausible (ABEA-1111, ZCMBG52) : lettres ET chiffres, tirets permis. */
function toChip(v: unknown): string | undefined {
  const s = cell(v).toUpperCase()
  return /^[A-Z0-9][A-Z0-9-]{2,23}$/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) ? s : undefined
}

export const normalizeChip = (v: string) => v.trim().toUpperCase()

/** Dossard = entier PUR (éventuellement "#12"). "ZCMBG52" est un transpondeur, pas le dossard 52. */
function toBib(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^#?\s*(\d{1,6})$/)
  const n = m ? parseInt(m[1], 10) : NaN
  return n > 0 ? n : null
}

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

/**
 * Heure de passage → Date. Accepte ISO complet, "[YYYY-MM-DD ]HH:MM:SS(.mmm)"
 * (heure locale Europe/Brussels), secondes depuis minuit (format RaceResult),
 * epoch s/ms. Retourne null si illisible (→ l'appelant prend "maintenant").
 */
export function parsePassingTime(raw: string | undefined, now = new Date()): Date | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}[T ]\d/.test(s)) {
    if (s.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d
    }
    // Date + heure locales sans fuseau → Europe/Brussels.
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/)
    if (!m) return null
    const [, y, mo, d, h, mi, sec, ms] = m
    const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec, Number((ms ?? '0').padEnd(3, '0')))
    return new Date(guess - tzOffsetMs(new Date(guess)))
  }
  const hms = s.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/)
  if (hms) {
    const [, h, m, sec, ms] = hms
    return brusselsToday(now, Number(h) * 3600 + Number(m) * 60 + Number(sec) + Number((ms ?? '0').padEnd(3, '0')) / 1000)
  }
  const num = Number(s.replace(',', '.'))
  if (Number.isFinite(num)) {
    if (num > 1e12) return new Date(num)
    if (num > 1e9) return new Date(num * 1000)
    if (num >= 0 && num < 2 * 86400) return brusselsToday(now, num)
  }
  return null
}

function brusselsToday(now: Date, secondsSinceMidnight: number): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const guessUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) + secondsSinceMidnight * 1000
  return new Date(guessUtc - tzOffsetMs(new Date(guessUtc)))
}

function tzOffsetMs(date: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((x) => [x.type, x.value]),
  )
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}
