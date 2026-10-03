import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { getTimingConfig, getTimingStatus, newPushToken, updateTimingConfig } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// Tableau de bord chrono : config, état des sources, derniers passages,
// dossards vus par le chrono mais non inscrits.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const [config, status, recent, bySource, seen, dossards] = await Promise.all([
    getTimingConfig(),
    getTimingStatus(),
    prisma.raceLapEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, dossardNumber: true, timestamp: true, source: true, createdAt: true, mats: true } }),
    prisma.raceLapEvent.groupBy({ by: ['source'], _count: { _all: true }, _max: { createdAt: true } }),
    prisma.raceLapEvent.groupBy({ by: ['dossardNumber'], _count: { _all: true } }),
    prisma.dossard.findMany({ select: { number: true, teamId: true } }),
  ])
  const assigned = new Set(dossards.filter((d) => d.teamId).map((d) => d.number))

  // Santé des tapis : sur les passages chrono (hors manuel/simulation/compteurs),
  // combien chaque tapis en a vu. Vu par un seul = l'autre l'a raté (et a été rattrapé).
  const where = `source LIKE 'raceresult%' AND source NOT LIKE '%-counts'`
  const [totals] = await prisma.$queryRawUnsafe<{ total: bigint; withmat: bigint; both: bigint }[]>(
    `SELECT count(*) AS total, count(*) FILTER (WHERE cardinality(mats) >= 1) AS withmat, count(*) FILTER (WHERE cardinality(mats) >= 2) AS both FROM "RaceLapEvent" WHERE ${where}`,
  )
  const perMat = await prisma.$queryRawUnsafe<{ mat: string; seen: bigint; last: Date }[]>(
    `SELECT m AS mat, count(*) AS seen, max("createdAt") AS last FROM "RaceLapEvent", unnest(mats) AS m WHERE ${where} GROUP BY m ORDER BY m`,
  )
  const withMat = Number(totals?.withmat ?? 0)
  const unknownChipsRow = await prisma.setting.findUnique({ where: { key: 'unknownChips' } })
  return NextResponse.json({
    config,
    status,
    recent,
    sources: bySource.map((s) => ({ source: s.source, count: s._count._all, lastAt: s._max.createdAt })),
    orphanBibs: seen.filter((s) => !assigned.has(s.dossardNumber)).map((s) => ({ number: s.dossardNumber, count: s._count._all })),
    mats: {
      total: Number(totals?.total ?? 0),
      withMat,
      both: Number(totals?.both ?? 0),
      perMat: perMat.map((m) => ({ mat: m.mat, seen: Number(m.seen), missed: withMat - Number(m.seen), lastAt: m.last })),
    },
    unknownChips: Object.entries((unknownChipsRow?.value as Record<string, { count: number; lastAt: string }>) ?? {})
      .map(([chip, v]) => ({ chip, ...v }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)),
  })
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const body = await req.json()
  if (body.regenerateToken) body.pushToken = newPushToken()
  return NextResponse.json(await updateTimingConfig(body))
}
