import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { getTeamPointsBalance, invalidateLive } from '@/lib/live'

/**
 * Achat bonus/malus — fait par la DIRECTION DE COURSE pour le compte d'une
 * écurie (l'écurie vient le demander au stand ; plus d'achat self-service).
 * - BONUS_SELF  : cible = un vélo DE l'écurie qui paie
 * - MALUS_OTHER : cible = un vélo d'une AUTRE écurie
 * Appliqué immédiatement ; annulable (= remboursé) via DELETE /api/purchases/{id}.
 */
export async function POST(req: NextRequest) {
  const staff = await requireStaff(req)
  if (!staff) return jsonError('Non autorisé', 403)

  const { buyingTeamId, itemId, targetDossardId } = await req.json()
  if (!buyingTeamId || !itemId || !targetDossardId) return jsonError('Écurie, item et vélo cible requis')

  const [team, item, target] = await Promise.all([
    prisma.team.findUnique({ where: { id: String(buyingTeamId) } }),
    prisma.marketplaceItem.findUnique({ where: { id: String(itemId) } }),
    prisma.dossard.findUnique({ where: { id: String(targetDossardId) } }),
  ])
  if (!team) return jsonError('Écurie introuvable', 404)
  if (!item || !item.active) return jsonError('Item indisponible', 404)
  if (!target || !target.teamId) return jsonError('Vélo cible introuvable', 404)
  if (item.type === 'BONUS_SELF' && target.teamId !== team.id) return jsonError('Un bonus se met sur un vélo de sa propre écurie')
  if (item.type === 'MALUS_OTHER' && target.teamId === team.id) return jsonError('Un malus se met sur un vélo adverse')

  const lapDelta = item.type === 'BONUS_SELF' ? Math.abs(item.lapEffect) : -Math.abs(item.lapEffect)

  // Vérif du solde DANS la transaction (sérialisée sur l'écurie) : deux
  // organisateurs qui cliquent en même temps ne peuvent pas passer en négatif.
  try {
    const purchase = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Team" WHERE id = ${team.id} FOR UPDATE`
      const balance = await getTeamPointsBalanceTx(tx, team.id)
      if (balance < item.costPoints) throw new Error(`Solde insuffisant : ${balance} pts, il en faut ${item.costPoints}`)
      const p = await tx.purchase.create({
        data: {
          buyingTeamId: team.id,
          targetDossardId: target.id,
          itemId: item.id,
          itemName: item.name,
          type: item.type,
          costPoints: item.costPoints,
          lapDelta,
          performedBy: staff.name,
        },
      })
      await tx.raceAdjustment.create({
        data: { dossardId: target.id, lapDelta, source: 'purchase', reason: item.name, performedBy: staff.name, purchaseId: p.id },
      })
      return p
    })
    invalidateLive()
    return NextResponse.json({ id: purchase.id, balance: await getTeamPointsBalance(team.id) })
  } catch (err) {
    return jsonError((err as Error).message, 402)
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function getTeamPointsBalanceTx(tx: Tx, teamId: string) {
  const earned = await tx.pointsTransaction.aggregate({ where: { teamId, cancelledAt: null }, _sum: { points: true } })
  const spent = await tx.purchase.aggregate({ where: { buyingTeamId: teamId, cancelledAt: null }, _sum: { costPoints: true } })
  return (earned._sum.points ?? 0) - (spent._sum.costPoints ?? 0)
}
