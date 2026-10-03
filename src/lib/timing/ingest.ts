import { prisma } from '@/lib/prisma'
import type { TimingConfig } from '@/lib/settings'
import { normalizeChip, parsePassingTime, type ParsedRecord } from './parse'

export type IngestResult = {
  records: number
  inserted: number
  removed: number
  duplicates: number
  debounced: number
  /** Passage déjà vu par l'AUTRE tapis (2 tapis côte à côte) : fusionné, pas recompté. */
  merged: number
  /** Codes puce reçus sans vélo correspondant (Dossard.transponder). */
  unknownChips: string[]
  /** Lignes sans compteur ni heure/ID reçues en mode poll : inexploitables (sinon +1 tour à chaque interrogation). */
  unusable: number
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
export async function ingestRecords(
  records: ParsedRecord[],
  source: string,
  cfg: Pick<TimingConfig, 'dataMode' | 'minLapSeconds'>,
  opts: { snapshot?: boolean } = {},
): Promise<IngestResult> {
  const result: IngestResult = { records: records.length, inserted: 0, removed: 0, duplicates: 0, debounced: 0, merged: 0, unknownChips: [], unusable: 0, unknownBibs: [], mode: 'empty' }
  if (records.length === 0) return result

  const dossards = await prisma.dossard.findMany({ select: { number: true, transponder: true } })
  const known = new Set(dossards.map((d) => d.number))
  const byChip = new Map(dossards.filter((d) => d.transponder).map((d) => [normalizeChip(d.transponder as string), d.number]))
  const unknown = new Set<number>()
  const unknownChips = new Set<string>()

  // Code puce → dossard. Un code inconnu est mis de côté (affiché dans /admin/chrono), pas compté.
  records = records.flatMap((r) => {
    if (r.bib !== undefined) return [r]
    const bib = r.chip ? byChip.get(normalizeChip(r.chip)) : undefined
    if (bib === undefined) {
      if (r.chip) unknownChips.add(r.chip)
      return []
    }
    return [{ ...r, bib }]
  })

  const asCount = (r: ParsedRecord) => cfg.dataMode === 'counts' || (cfg.dataMode === 'auto' && r.laps !== undefined)
  const counts = records.filter((r) => asCount(r) && r.laps !== undefined)
  // Une réponse de poll est un INSTANTANÉ renvoyé à l'identique à chaque appel : un "passage" sans
  // heure ni ID n'y est pas dédoublonnable → on l'ignore plutôt que de compter un tour par appel.
  const passings = records.filter((r) => !asCount(r) && (!opts.snapshot || r.time || r.externalId))
  result.unusable = records.filter((r) => !asCount(r)).length - passings.length
  result.mode = counts.length && passings.length ? 'mixed' : counts.length ? 'counts' : 'passings'

  // --- Compteurs absolus ---------------------------------------------------
  // Source distincte ("…-counts") : l'alignement ne doit jamais toucher des
  // passages unitaires reçus par ailleurs. Dernière valeur gagnante si un
  // dossard apparaît plusieurs fois dans la même réponse.
  const countSource = `${source}-counts`
  const target = new Map<number, number>()
  for (const r of counts) target.set(r.bib as number, r.laps as number)
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
  // Deux tapis côte à côte : chaque passage arrive normalement 2× (une lecture
  // par tapis, à quelques dixièmes d'écart, parfois dans 2 requêtes HTTP
  // simultanées). Règle : toute lecture du même dossard à moins de
  // `minLapSeconds` d'un passage déjà enregistré est FUSIONNÉE dans celui-ci
  // (on ajoute le tapis à `mats`, on garde l'heure la plus tôt) au lieu d'être
  // comptée. Si un tapis rate le vélo, l'autre suffit. Un verrou Postgres par
  // dossard sérialise les lectures concurrentes (sinon double comptage).
  const now = new Date()
  for (const r of passings) {
    const bib = r.bib as number
    if (!known.has(bib)) unknown.add(bib)
    const ts = parsePassingTime(r.time, now) ?? now
    const externalId = r.externalId ? `${source}:${r.externalId}` : r.time ? `${source}:${r.mat ?? ''}:${bib}@${r.time}` : null

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7001, ${bib}::int)`
      if (externalId && (await tx.raceLapEvent.findUnique({ where: { externalId }, select: { id: true } }))) return 'duplicate' as const
      if (cfg.minLapSeconds > 0) {
        const windowMs = cfg.minLapSeconds * 1000
        const near = await tx.raceLapEvent.findFirst({
          where: { dossardNumber: bib, timestamp: { gt: new Date(ts.getTime() - windowMs), lt: new Date(ts.getTime() + windowMs) } },
          orderBy: { timestamp: 'asc' },
          select: { id: true, mats: true, timestamp: true },
        })
        if (near) {
          const otherMat = Boolean(r.mat && !near.mats.includes(r.mat) && near.mats.length > 0)
          await tx.raceLapEvent.update({
            where: { id: near.id },
            data: {
              ...(r.mat && !near.mats.includes(r.mat) ? { mats: { push: r.mat } } : {}),
              ...(ts < near.timestamp ? { timestamp: ts } : {}),
            },
          })
          return otherMat ? ('merged' as const) : ('debounced' as const)
        }
      }
      await tx.raceLapEvent.create({
        data: { dossardNumber: bib, timestamp: ts, source, externalId, mats: r.mat ? [r.mat] : [], rawPayload: r as object },
      })
      return 'inserted' as const
    }).catch((err) => {
      // Contrainte unique externalId (course extrême) — on journalise quand même au cas où ce serait autre chose.
      console.error('[ingest] passage ignoré', bib, (err as Error).message)
      return 'duplicate' as const
    })

    result[outcome === 'inserted' ? 'inserted' : outcome === 'merged' ? 'merged' : outcome === 'debounced' ? 'debounced' : 'duplicates']++
  }

  if (unknownChips.size > 0) await rememberUnknownChips([...unknownChips])
  result.unknownChips = [...unknownChips]
  result.unknownBibs = [...unknown].sort((a, b) => a - b)
  return result
}

export function summarize(r: IngestResult) {
  const parts = [`${r.records} reçu(s)`, `+${r.inserted} tour(s)`]
  if (r.removed) parts.push(`−${r.removed} corrigé(s)`)
  if (r.duplicates) parts.push(`${r.duplicates} doublon(s)`)
  if (r.merged) parts.push(`${r.merged} confirmé(s) par l'autre tapis`)
  if (r.debounced) parts.push(`${r.debounced} relecture(s) ignorée(s)`)
  if (r.unknownChips.length) parts.push(`⚠️ puces inconnues : ${r.unknownChips.join(', ')}`)
  if (r.unusable) parts.push(`⚠️ ${r.unusable} ligne(s) sans tours ni heure ignorée(s) — vérifier la colonne "tours"`)
  if (r.unknownBibs.length) parts.push(`dossards inconnus : ${r.unknownBibs.join(', ')}`)
  return parts.join(' · ')
}

/** Mémorise les codes puce non reconnus (Setting "unknownChips") pour les afficher dans l'admin. */
async function rememberUnknownChips(chips: string[]) {
  const row = await prisma.setting.findUnique({ where: { key: 'unknownChips' } })
  const current = (row?.value as Record<string, { count: number; lastAt: string }>) ?? {}
  const at = new Date().toISOString()
  for (const c of chips) current[c] = { count: (current[c]?.count ?? 0) + 1, lastAt: at }
  await prisma.setting.upsert({ where: { key: 'unknownChips' }, create: { key: 'unknownChips', value: current }, update: { value: current } })
}
