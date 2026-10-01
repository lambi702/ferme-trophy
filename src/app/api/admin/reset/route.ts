import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'
import { updateRaceConfig } from '@/lib/settings'

/**
 * Remise à zéro — comité uniquement, avec confirmation tapée.
 * - "laps"  : efface tous les passages chrono (ex : après les tests avec O'Top, avant le départ)
 * - "game"  : passages + ajustements + achats + points (garde écuries, dossards, catalogue)
 * - "event" : tout ce qui précède + écuries + dossards (garde comptes, organisateurs, catalogue, réglages chrono)
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const { scope, confirm } = await req.json()
  if (confirm !== 'RESET') return jsonError('Tape RESET pour confirmer')
  if (!['laps', 'game', 'event'].includes(scope)) return jsonError('Portée inconnue')

  await prisma.$transaction(async (tx) => {
    await tx.raceLapEvent.deleteMany()
    if (scope === 'game' || scope === 'event') {
      await tx.raceAdjustment.deleteMany()
      await tx.purchase.deleteMany()
      await tx.pointsTransaction.deleteMany()
    }
    if (scope === 'event') {
      await tx.dossard.deleteMany()
      await tx.team.deleteMany()
    }
  })
  if (scope !== 'laps') await updateRaceConfig({ startedAt: null, finishedAt: null })
  invalidateLive()
  return NextResponse.json({ ok: true })
}
