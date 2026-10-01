import { prisma } from '@/lib/prisma'
import type { TimingConfig } from '@/lib/settings'
import { parsePassingTime, type ParsedRecord } from './parse'

export type IngestResult = {
  records: number
  inserted: number
  removed: number
  duplicates: number
  debounced: number
  unknownBibs: number[]
  mode: 'passings' | 'counts' | 'mixed' | 'empty'
}

/**
 * Point d'entrée UNIQUE de toutes les données chrono (push RaceResult, poll
 * RaceResult, simulation...). Deux natures de données possibles :
 *
 * - PASSAGE (bib [+ heure, id]) → un RaceLapEvent de plus, sauf doublon
 *   (même externalId) ou relecture trop rapprochée (< minLapSeconds).
 * - COMPTEUR (bib + tours absolus, typiquement une liste RaceResult) → on
 *   aligne le nombre de RaceLapEvent de CETTE source sur le compteur : ajoute
 *   les tours manquants, retire les derniers si le chrono a corrigé à la baisse.
 *   Un dossard absent de la réponse n'est jamais touché.
 */
export async function ingestRecords(records: ParsedRecord[], source: string, cfg: Pick<TimingConfig, 'dataMode' | 'minLapSeconds'>): Promise<IngestResult> {
  const result: IngestResult = { records: records.length, inserted: 0, removed: 0, duplicates: 0, debounced: 0, unknownBibs: [], mode: 'empty' }
  if (records.length === 0) return result

  const known = new Set((await prisma.dossard.findMany({ select: { number: true } })).map((d) => d.number))
  const unknown = new Set<number>()

  const asCount = (r: ParsedRecord) => cfg.dataMode === 'counts' || (cfg.dataMode === 'auto' && r.laps !== undefined)
  const counts = records.filter((r) => asCount(r) && r.laps !== undefined)
  const passings = records.filter((r) => !asCount(r))
  result.mode = counts.length && passings.length ? 'mixed' : counts.length ? 'counts' : 'passings'

  // --- Compteurs absolus ---------------------------------------------------
  // Source distincte ("…-counts") : l'alignement ne doit jamais toucher des
  // passages unitaires reçus par ailleurs. Dernière valeur gagnante si un
  // dossard apparaît plusieurs fois dans la même réponse.
  const countSource = `${source}-counts`
  const target = new Map<number, number>()
  for (const r of counts) target.set(r.bib, r.laps as number)
  for (const [bib, laps] of target) {
    if (!known.has(bib)) unknown.add(bib)
    const current = await prisma.raceLapEvent.count({ where: { dossardNumber: bib, source: countSource } })
    if (laps > current) {
      const now = new Date()
      await prisma.raceLapEvent.createMany({
        data: Array.from({ length: laps - current }, () => ({ dossardNumber: bib, timestamp: now, source: countSource })),
      })
      result.inserted += laps - current
    } else if (laps < current) {
      const extra = await prisma.raceLapEvent.findMany({
        where: { dossardNumber: bib, source: countSource },
        orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }],
        take: current - laps,
        select: { id: true },
      })
      await prisma.raceLapEvent.deleteMany({ where: { id: { in: extra.map((e) => e.id) } } })
      result.removed += extra.length
    }
  }

  // --- Passages unitaires --------------------------------------------------
  const now = new Date()
  for (const r of passings) {
    if (!known.has(r.bib)) unknown.add(r.bib)
    const ts = parsePassingTime(r.time, now) ?? now
    const externalId = r.externalId ? `${source}:${r.externalId}` : r.time ? `${source}:${r.bib}@${r.time}` : null

    if (externalId && (await prisma.raceLapEvent.findUnique({ where: { externalId }, select: { id: true } }))) {
      result.duplicates++
      continue
    }
    if (cfg.minLapSeconds > 0) {
      const windowMs = cfg.minLapSeconds * 1000
      const near = await prisma.raceLapEvent.findFirst({
        where: { dossardNumber: r.bib, timestamp: { gt: new Date(ts.getTime() - windowMs), lt: new Date(ts.getTime() + windowMs) } },
        select: { id: true },
      })
      if (near) {
        result.debounced++
        continue
      }
    }
    try {
      await prisma.raceLapEvent.create({
        data: { dossardNumber: r.bib, timestamp: ts, source, externalId, rawPayload: r as object },
      })
      result.inserted++
    } catch {
      // Course entre deux requêtes simultanées sur le même externalId.
      result.duplicates++
    }
  }

  result.unknownBibs = [...unknown].sort((a, b) => a - b)
  return result
}

export function summarize(r: IngestResult) {
  const parts = [`${r.records} reçu(s)`, `+${r.inserted} tour(s)`]
  if (r.removed) parts.push(`−${r.removed} corrigé(s)`)
  if (r.duplicates) parts.push(`${r.duplicates} doublon(s)`)
  if (r.debounced) parts.push(`${r.debounced} relecture(s) ignorée(s)`)
  if (r.unknownBibs.length) parts.push(`dossards inconnus : ${r.unknownBibs.join(', ')}`)
  return parts.join(' · ')
}
