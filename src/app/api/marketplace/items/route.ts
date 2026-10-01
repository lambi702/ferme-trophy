import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'
import { signedEffect } from '@/lib/catalog'

// Catalogue public (items actifs) ; la direction de course voit aussi les
// items désactivés pour pouvoir les réactiver.
export async function GET(req: NextRequest) {
  const staff = await requireStaff(req)
  const items = await prisma.marketplaceItem.findMany({
    where: staff ? {} : { active: true },
    orderBy: [{ type: 'asc' }, { costPoints: 'asc' }],
  })
  return NextResponse.json(items)
}

// Édition du catalogue : comité ET organisateurs (prix ajustables sur le terrain).
export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const { name, description, costPoints, type, lapEffect } = await req.json()
  if (!name || !['BONUS_SELF', 'MALUS_OTHER'].includes(type)) return jsonError('Nom et type (bonus/malus) requis')
  const cost = Math.trunc(Number(costPoints))
  if (!Number.isFinite(cost) || cost < 0) return jsonError('Prix invalide')
  const item = await prisma.marketplaceItem.create({
    data: {
      name: String(name).trim().slice(0, 80),
      description: String(description ?? '').slice(0, 240),
      costPoints: cost,
      type,
      lapEffect: signedEffect(type, lapEffect),
    },
  })
  invalidateLive()
  return NextResponse.json(item)
}
