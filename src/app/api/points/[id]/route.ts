import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

// Annulation (soft delete, gardée pour l'audit) d'un crédit de points.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await requireStaff(req)
  if (!staff) return jsonError('Non autorisé', 403)
  const tx = await prisma.pointsTransaction.findUnique({ where: { id: params.id } })
  if (!tx) return jsonError('Introuvable', 404)
  if (tx.cancelledAt) return NextResponse.json({ ok: true })
  await prisma.pointsTransaction.update({ where: { id: tx.id }, data: { cancelledAt: new Date(), cancelledBy: staff.name } })
  invalidateLive()
  return NextResponse.json({ ok: true })
}
