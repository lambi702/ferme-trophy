import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

// Annulation d'un achat = remboursement des points + retrait de l'effet sur
// le vélo. L'achat reste visible (barré) dans l'historique pour l'audit.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await requireStaff(req)
  if (!staff) return jsonError('Non autorisé', 403)
  const purchase = await prisma.purchase.findUnique({ where: { id: params.id } })
  if (!purchase) return jsonError('Introuvable', 404)
  if (!purchase.cancelledAt) {
    await prisma.$transaction([
      prisma.raceAdjustment.deleteMany({ where: { purchaseId: purchase.id } }),
      prisma.purchase.update({ where: { id: purchase.id }, data: { cancelledAt: new Date(), cancelledBy: staff.name } }),
    ])
  }
  invalidateLive()
  return NextResponse.json({ ok: true })
}
