import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

// Correction manuelle du comité sur les tours d'un VÉLO (litige, erreur de
// chrono...) — indépendante des achats, visible dans le fil d'actu.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const { dossardNumber, lapDelta, reason } = await req.json()
  const delta = Number(lapDelta)
  if (!Number.isInteger(delta) || delta === 0) return jsonError('Nombre de tours (entier non nul) requis')
  const dossard = await prisma.dossard.findUnique({ where: { number: Number(dossardNumber) } })
  if (!dossard) return jsonError('Dossard introuvable', 404)

  const adjustment = await prisma.raceAdjustment.create({
    data: {
      dossardId: dossard.id,
      lapDelta: delta,
      source: 'correction',
      reason: String(reason ?? '').trim().slice(0, 120),
      performedBy: admin.displayName,
    },
  })
  invalidateLive()
  return NextResponse.json(adjustment)
}
