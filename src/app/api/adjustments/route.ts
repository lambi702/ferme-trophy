import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

// Correction manuelle du comité sur le classement course (litige, erreur de
// chrono, etc.) — indépendante des achats marketplace, tracée pareillement.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const { teamId, lapDelta, reason } = await req.json()
  const delta = Number(lapDelta)
  if (!teamId || !Number.isInteger(delta) || delta === 0) {
    return jsonError('teamId et lapDelta (entier non nul) requis')
  }

  const adjustment = await prisma.raceAdjustment.create({
    data: { teamId, lapDelta: delta, source: `comite_manuel:${admin.displayName}${reason ? ` — ${reason}` : ''}` },
  })
  return NextResponse.json(adjustment)
}
