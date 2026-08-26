import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const body = await req.json()
  const data: Record<string, unknown> = {}
  for (const key of ['name', 'description', 'costPoints', 'lapEffect', 'active'] as const) {
    if (body[key] !== undefined) data[key] = body[key]
  }
  const item = await prisma.marketplaceItem.update({ where: { id: params.id }, data })
  return NextResponse.json(item)
}
