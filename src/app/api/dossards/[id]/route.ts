import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin, requireOrganizer } from '@/lib/api-helpers'

// Associe (ou retire) un dossard à une équipe — une équipe peut avoir
// plusieurs dossards (plusieurs vélos), donc pas de contrainte d'unicité
// côté équipe, juste un dossard ne peut appartenir qu'à UNE équipe à la fois.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  const { teamId } = await req.json()

  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) return jsonError('Équipe introuvable', 404)
  }

  const dossard = await prisma.dossard.update({
    where: { id: params.id },
    data: { teamId: teamId || null },
    include: { team: { select: { id: true, unitName: true, sectionName: true } } },
  })
  return NextResponse.json(dossard)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  await prisma.dossard.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
