import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePin, hashPin } from '@/lib/auth'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

// Nouveau PIN (affiché une seule fois) — comité uniquement.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const pin = generatePin(4)
  const organizer = await prisma.organizer.update({ where: { id: params.id }, data: { pinHash: await hashPin(pin) } })
  return NextResponse.json({ displayName: organizer.displayName, pin })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  await prisma.organizer.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
