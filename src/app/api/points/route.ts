import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin, requireOrganizer } from '@/lib/api-helpers'

// Historique — pour audit/correction par le comité (section 7.4).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)
  const transactions = await prisma.pointsTransaction.findMany({
    include: { team: { select: { unitName: true, slug: true } }, organizer: { select: { displayName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(transactions)
}

export async function POST(req: NextRequest) {
  const organizer = await requireOrganizer(req)
  const admin = organizer ? null : await requireAdmin(req)
  if (!organizer && !admin) return jsonError('Non autorisé', 403)

  const { teamId, points, reason } = await req.json()
  const pointsNum = Number(points)
  if (!teamId || !Number.isInteger(pointsNum) || pointsNum === 0) {
    return jsonError('teamId et points (entier non nul) requis')
  }
  if (!reason || String(reason).trim().length === 0) return jsonError('Motif requis (nom du mini-jeu)')

  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team) return jsonError('Équipe introuvable', 404)

  const transaction = await prisma.pointsTransaction.create({
    data: {
      teamId,
      organizerId: organizer?.id ?? null,
      points: pointsNum,
      reason: String(reason).trim().slice(0, 120),
    },
  })
  return NextResponse.json(transaction)
}
