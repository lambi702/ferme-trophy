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
    prisma.raceLapEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, dossardNumber: true, timestamp: true, source: true, createdAt: true } }),
    prisma.raceLapEvent.groupBy({ by: ['source'], _count: { _all: true }, _max: { createdAt: true } }),
    prisma.raceLapEvent.groupBy({ by: ['dossardNumber'], _count: { _all: true } }),
    prisma.dossard.findMany({ select: { number: true, teamId: true } }),
  ])
  const assigned = new Set(dossards.filter((d) => d.teamId).map((d) => d.number))
  return NextResponse.json({
    config,
    status,
    recent,
    sources: bySource.map((s) => ({ source: s.source, count: s._count._all, lastAt: s._max.createdAt })),
    orphanBibs: seen.filter((s) => !assigned.has(s.dossardNumber)).map((s) => ({ number: s.dossardNumber, count: s._count._all })),
  })
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const body = await req.json()
  if (body.regenerateToken) body.pushToken = newPushToken()
  return NextResponse.json(await updateTimingConfig(body))
}
