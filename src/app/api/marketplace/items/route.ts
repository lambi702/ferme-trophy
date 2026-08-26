import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin, requireOrganizer } from '@/lib/api-helpers'

// Public (visible par tous, PIN équipe pas nécessaire pour consulter le
// catalogue — seul l'achat est réservé aux équipes déverrouillées) :
// visiteurs anonymes = items actifs seulement. Comité/organisateurs voient
// aussi les items désactivés (pour pouvoir les réactiver).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  const canSeeInactive = Boolean(admin || organizer)

  const items = await prisma.marketplaceItem.findMany({
    where: canSeeInactive ? {} : { active: true },
    orderBy: { costPoints: 'asc' },
  })
  return NextResponse.json(items)
}

// Édition du catalogue : comité ET organisateurs (les prix doivent rester
// ajustables sur le terrain le jour J, pas juste par le comité).
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

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
