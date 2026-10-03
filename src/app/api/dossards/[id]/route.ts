import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

// Associe (ou retire) un dossard à une écurie, ou le renomme.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const body = await req.json()
  const data: { teamId?: string | null; name?: string; transponder?: string | null; contest?: number | null; category?: number | null } = {}
  if (body.transponder !== undefined) data.transponder = body.transponder ? String(body.transponder).trim().toUpperCase() : null
  for (const f of ['contest', 'category'] as const) {
    if (body[f] !== undefined) data[f] = Number.isInteger(Number(body[f])) && Number(body[f]) > 0 ? Number(body[f]) : null
  }
  if (body.teamId !== undefined) {
    if (body.teamId && !(await prisma.team.findUnique({ where: { id: String(body.teamId) } }))) return jsonError('Écurie introuvable', 404)
    data.teamId = body.teamId ? String(body.teamId) : null
  }
  if (typeof body.name === 'string') data.name = body.name.trim().slice(0, 40)
  const dossard = await prisma.dossard.update({ where: { id: params.id }, data })
  invalidateLive()
  return NextResponse.json(dossard)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  await prisma.dossard.delete({ where: { id: params.id } })
  invalidateLive()
  return NextResponse.json({ ok: true })
}
