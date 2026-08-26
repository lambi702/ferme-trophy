import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireTeamSession } from '@/lib/api-helpers'
import { getTeamPointsBalance } from '@/lib/leaderboard'

// Achat appliqué immédiatement (pas de validation commissaire pour ce MVP —
// point ouvert #4 du handover, à trancher avant le jour J si besoin).
export async function POST(req: NextRequest) {
  const buyingTeam = await requireTeamSession(req)
  if (!buyingTeam) return jsonError('Déverrouille ta page avec le PIN d\'abord', 401)

  const { itemId, targetTeamId } = await req.json()
  if (!itemId) return jsonError('itemId requis')

  const item = await prisma.marketplaceItem.findUnique({ where: { id: itemId } })
  if (!item || !item.active) return jsonError('Item indisponible', 404)

  if (item.type === 'MALUS_OTHER') {
    if (!targetTeamId) return jsonError('Choisis une équipe cible pour un malus')
    if (targetTeamId === buyingTeam.id) return jsonError('Tu ne peux pas cibler ta propre équipe')
    const target = await prisma.team.findUnique({ where: { id: targetTeamId } })
    if (!target) return jsonError('Équipe cible introuvable', 404)
  }

  const balance = await getTeamPointsBalance(buyingTeam.id)
  if (balance < item.costPoints) {
    return jsonError(`Solde insuffisant (${balance} pts, il en faut ${item.costPoints})`, 402)
  }

  const affectedTeamId = item.type === 'BONUS_SELF' ? buyingTeam.id : targetTeamId

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        buyingTeamId: buyingTeam.id,
        targetTeamId: item.type === 'MALUS_OTHER' ? targetTeamId : null,
        itemId: item.id,
        costPoints: item.costPoints,
      },
    })
    const adjustment = await tx.raceAdjustment.create({
      data: {
        teamId: affectedTeamId,
        lapDelta: item.lapEffect,
        source: `purchase:${purchase.id}`,
        purchaseId: purchase.id,
      },
    })
    return { purchase, adjustment }
  })

  return NextResponse.json(result)
}
