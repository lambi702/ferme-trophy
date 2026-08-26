import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

// Public (visible depuis la page équipe, même avant déverrouillage par PIN) :
// seuls les items actifs, sans détails internes.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  const items = await prisma.marketplaceItem.findMany({
    where: admin ? {} : { active: true },
    orderBy: { costPoints: 'asc' },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const { name, description, costPoints, type, lapEffect } = await req.json()
  if (!name || !['BONUS_SELF', 'MALUS_OTHER'].includes(type)) {
    return jsonError('name et type (BONUS_SELF | MALUS_OTHER) requis')
  }
  const item = await prisma.marketplaceItem.create({
    data: {
      name: String(name).slice(0, 80),
      description: String(description ?? '').slice(0, 240),
      costPoints: Number(costPoints) || 0,
      type,
      lapEffect: Number(lapEffect) || (type === 'BONUS_SELF' ? 1 : -1),
    },
  })
  return NextResponse.json(item)
}
