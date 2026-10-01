import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

/**
 * Crédit de points mini-jeu (ou pénalité si négatif) — direction de course.
 * `teamIds` permet de créditer le même montant à plusieurs écuries d'un coup
 * (ex : toutes les écuries qui ont participé à un jeu).
 */
export async function POST(req: NextRequest) {
  const staff = await requireStaff(req)
  if (!staff) return jsonError('Non autorisé', 403)

  const body = await req.json()
  const teamIds: string[] = Array.isArray(body.teamIds) ? body.teamIds.map(String) : body.teamId ? [String(body.teamId)] : []
  const points = Number(body.points)
  const reason = String(body.reason ?? '').trim().slice(0, 120)
  if (teamIds.length === 0) return jsonError('Choisis au moins une écurie')
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 10000) return jsonError('Nombre de points invalide')
  if (!reason) return jsonError('Motif requis (nom du mini-jeu)')

  const found = await prisma.team.count({ where: { id: { in: teamIds } } })
  if (found !== teamIds.length) return jsonError('Écurie introuvable', 404)

  const created = await prisma.$transaction(
    teamIds.map((teamId) =>
      prisma.pointsTransaction.create({
        data: { teamId, organizerId: staff.organizerId, points, reason, performedBy: staff.name },
      }),
    ),
  )
  invalidateLive()
  return NextResponse.json({ ids: created.map((c) => c.id) })
}
