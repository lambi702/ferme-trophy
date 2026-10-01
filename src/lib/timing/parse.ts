/**
 * Parseur TOLÉRANT des données de chronométrage — on ne connaît pas encore
 * le format exact qu'O'Top configurera dans RaceResult, donc on accepte à
 * peu près tout ce qu'un Exporter / la Simple API RaceResult peut produire :
 *
 *  - JSON : objet seul, tableau d'objets, tableau de tableaux (avec ou sans
 *    ligne d'en-tête), ou enveloppe { data: [...] } / { list: [...] } ...
 *  - CSV / TSV / point-virgule / pipe, avec ou sans en-tête
 *  - formulaire (application/x-www-form-urlencoded) ou query string (GET)
 *  - texte brut, une ligne par passage ("12" ou "12;14:03:22.418")
 *
 * Chaque enregistrement devient soit un PASSAGE (bib [+ heure/id]), soit un
 * COMPTEUR (bib + nombre de tours absolu) si une colonne "tours" existe.
 * Les noms de colonnes sont auto-détectés (alias FR/EN/NL/DE), ou forcés
 * via la config (bibField, lapsField...) depuis /admin/chrono.
 */

export type ParsedRecord = {
  bib: number
  laps?: number
  time?: string
  externalId?: string
}

export type FieldMapping = {
  bibField?: string
  lapsField?: string
  timeField?: string
  idField?: string
}

const norm = (k: string) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

const ALIASES = {
  bib: ['bib', 'bibnumber', 'bibno', 'bibnr', 'startnumber', 'startnr', 'startno', 'startnummer', 'dossard', 'dossardnumber', 'numero', 'number', 'nr', 'no', 'num', 'dorsal', 'rugnummer', 'participant', 'bibid'],
  laps: ['laps', 'lap', 'lapcount', 'numberoflaps', 'nboflaps', 'nblaps', 'nbtours', 'tours', 'tour', 'nombredetours', 'rounds', 'roundcount', 'rondes', 'ronden', 'runden', 'lapsdone', 'completedlaps', 'totallaps', 'count'],
  time: ['time', 'timestamp', 'passingtime', 'passing', 'timeofday', 'tod', 'rtc', 'chiptime', 'datetime', 'date', 'heure', 'readtime', 'hittime', 'detectiontime', 'utctime', 'zeit', 'tijd'],
  id: ['id', 'passingid', 'pid', 'recordid', 'rawdataid', 'uid', 'eventid', 'readid', 'detectionid'],
}

type Row = Record<string, unknown>

export function parseTimingPayload(body: string, contentType = '', mapping: FieldMapping = {}): ParsedRecord[] {
  const text = body.replace(/^﻿/, '').trim()
  if (!text) return []

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return rowsToRecords(jsonToRows(JSON.parse(text)), mapping)
    } catch {
      /* pas du JSON valide → on tente le texte */
    }
  }

  if (contentType.includes('application/x-www-form-urlencoded') || (/^[^\n;,\t]+=/.test(text) && !text.includes('\n'))) {
    return parseParams(new URLSearchParams(text), mapping)
  }

  return rowsToRecords(textToRows(text), mapping)
}

/** Pour un GET (Exporter RaceResult en "HTTP Get") : ?bib=12&time=... ou ?data=<lignes>. */
export function parseParams(params: URLSearchParams, mapping: FieldMapping = {}): ParsedRecord[] {
  const obj: Row = {}
  params.forEach((value, key) => {
    if (key !== 'token') obj[key] = value
  })
  const nested = obj.data ?? obj.payload ?? obj.body
  if (typeof nested === 'string' && nested.trim()) return parseTimingPayload(nested, '', mapping)
  if (Object.keys(obj).length === 0) return []
  return rowsToRecords([obj], mapping)
}

function jsonToRows(value: unknown): Row[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return []
    if (value.every((v) => Array.isArray(v))) return tableToRows(value as unknown[][])
    if (value.every((v) => v !== null && typeof v === 'object')) return value.flatMap((v) => jsonToRows(v))
    // Tableau de valeurs simples → une ligne par valeur (bib seul, ou "bib;heure").
    return tableToRows(value.map((v) => splitLine(String(v))))
  }
  if (value && typeof value === 'object') {
    const obj = value as Row
    for (const key of ['data', 'list', 'rows', 'results', 'passings', 'records', 'participants', 'items', 'Data', 'List', 'Passings']) {
      if (Array.isArray(obj[key])) return jsonToRows(obj[key])
    }
    const arrays = Object.values(obj).filter(Array.isArray)
    if (arrays.length === 1 && findKey(obj, ALIASES.bib) === undefined) return jsonToRows(arrays[0])
    return [obj]
  }
  return []
}

function textToRows(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  return tableToRows(lines.map(splitLine))
}

function splitLine(line: string): string[] {
  const delimiters = ['\t', ';', '|', ',']
  const delim = delimiters.find((d) => line.includes(d))
  if (!delim) return [line.trim()]
  return line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
}

/** Tableau brut → objets. Si la 1re ligne ressemble à un en-tête, on s'en sert. */
function tableToRows(table: unknown[][]): Row[] {
  if (table.length === 0) return []
  const first = table[0].map((c) => String(c ?? ''))
  const allAliases = [...ALIASES.bib, ...ALIASES.laps, ...ALIASES.time, ...ALIASES.id]
  const looksLikeHeader = first.some((c) => /[a-z]/i.test(c) && allAliases.includes(norm(c)))
  if (looksLikeHeader) {
    return table.slice(1).map((cells) => Object.fromEntries(first.map((h, i) => [h, cells[i]])))
  }
  // Pas d'en-tête : colonne 0 = dossard, colonne 1 = tours (petit entier) ou heure.
  return table.map((cells) => {
    const row: Row = { bib: cells[0] }
    const second = cells[1] !== undefined ? String(cells[1]).trim() : ''
    if (second) {
      if (/^\d{1,4}$/.test(second)) row.laps = second
      else row.time = second
    }
    return row
  })
}

function findKey(obj: Row, aliases: string[], forced?: string): string | undefined {
  const keys = Object.keys(obj)
  if (forced) {
    const f = norm(forced)
    const hit = keys.find((k) => norm(k) === f)
    if (hit) return hit
  }
  for (const alias of aliases) {
    const hit = keys.find((k) => norm(k) === alias)
    if (hit) return hit
  }
  return undefined
}

function rowsToRecords(rows: Row[], mapping: FieldMapping): ParsedRecord[] {
  const out: ParsedRecord[] = []
  for (const row of rows) {
    const bibKey = findKey(row, ALIASES.bib, mapping.bibField)
    if (!bibKey) continue
    const bib = toInt(row[bibKey])
    if (bib === null || bib <= 0) continue

    const rec: ParsedRecord = { bib }
    const lapsKey = findKey(row, ALIASES.laps, mapping.lapsField)
    if (lapsKey) {
      const laps = toInt(row[lapsKey])
      if (laps !== null && laps >= 0) rec.laps = laps
    }
    const timeKey = findKey(row, ALIASES.time, mapping.timeField)
    if (timeKey && row[timeKey] !== undefined && row[timeKey] !== null && String(row[timeKey]).trim() !== '') {
      rec.time = String(row[timeKey]).trim()
    }
    const idKey = findKey(row, ALIASES.id, mapping.idField)
    if (idKey && row[idKey] !== undefined && row[idKey] !== null && String(row[idKey]).trim() !== '') {
      rec.externalId = String(row[idKey]).trim()
    }
    out.push(rec)
  }
  return out
}

function toInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v !== 'string') return null
  const m = v.match(/-?\d+/)
  return m ? parseInt(m[0], 10) : null
}

/**
 * Heure de passage → Date. Accepte ISO complet, "HH:MM:SS(.mmm)" (heure du
 * jour, Europe/Brussels), secondes depuis minuit (format brut RaceResult),
 * epoch s/ms. Retourne null si illisible (→ l'appelant prend "maintenant").
 */
export function parsePassingTime(raw: string | undefined, now = new Date()): Date | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}[T ]\d/.test(s)) {
    const d = new Date(s.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T'))
    return Number.isNaN(d.getTime()) ? null : d
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
