import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'
import { signedEffect } from '@/lib/catalog'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const current = await prisma.marketplaceItem.findUnique({ where: { id: params.id } })
  if (!current) return jsonError('Item introuvable', 404)

  const body = await req.json()
  const data: { name?: string; description?: string; costPoints?: number; lapEffect?: number; active?: boolean } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80)
  if (typeof body.description === 'string') data.description = body.description.slice(0, 240)
  if (body.costPoints !== undefined) {
    const cost = Math.trunc(Number(body.costPoints))
    if (!Number.isFinite(cost) || cost < 0) return jsonError('Prix invalide')
    data.costPoints = cost
  }
  if (body.lapEffect !== undefined) data.lapEffect = signedEffect(current.type, body.lapEffect)
  if (typeof body.active === 'boolean') data.active = body.active

  const item = await prisma.marketplaceItem.update({ where: { id: params.id }, data })
  invalidateLive()
  return NextResponse.json(item)
}
