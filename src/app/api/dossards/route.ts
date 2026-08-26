import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin, requireOrganizer } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  const dossards = await prisma.dossard.findMany({
    include: { team: { select: { id: true, unitName: true, sectionName: true, foulardEmoji: true } } },
    orderBy: { number: 'asc' },
  })
  return NextResponse.json(dossards)
}

/**
 * Crée le "pool" de dossards connus pour l'événement (ex: 1 à 100), pas
 * encore associés à une équipe. L'association se fait ensuite via PATCH
 * /api/dossards/{id}. Accepte soit `numbers: number[]`, soit `from`/`to`
 * pour une plage.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  const { numbers, from, to } = await req.json()
  let list: number[] = []
  if (Array.isArray(numbers)) {
    list = numbers.map(Number)
  } else if (Number.isInteger(from) && Number.isInteger(to) && to >= from) {
    list = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  } else {
    return jsonError('Fournis "numbers" ou "from"/"to"')
  }

  let created = 0
  for (const number of list) {
    const exists = await prisma.dossard.findUnique({ where: { number } })
    if (!exists) {
      await prisma.dossard.create({ data: { number } })
      created++
    }
  }
  return NextResponse.json({ created, total: list.length })
}
