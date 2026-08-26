import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePin, hashPin } from '@/lib/auth'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)
  const organizers = await prisma.organizer.findMany({
    select: { id: true, displayName: true, createdAt: true },
    orderBy: { displayName: 'asc' },
  })
  return NextResponse.json(organizers)
}

// Création par le comité UNIQUEMENT — voir la note dans /api/organizer/login.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const { displayNames } = await req.json()
  if (!Array.isArray(displayNames) || displayNames.length === 0) {
    return jsonError('displayNames (tableau de noms) requis')
  }

  const results: { displayName: string; pin: string }[] = []
  for (const raw of displayNames as string[]) {
    const displayName = String(raw).trim()
    if (!displayName) continue
    if (await prisma.organizer.findFirst({ where: { displayName } })) {
      return jsonError(`"${displayName}" existe déjà`, 409)
    }
    const pin = generatePin(4)
    await prisma.organizer.create({ data: { displayName, pinHash: await hashPin(pin) } })
    results.push({ displayName, pin })
  }

  return NextResponse.json({ created: results.length, organizers: results })
}
