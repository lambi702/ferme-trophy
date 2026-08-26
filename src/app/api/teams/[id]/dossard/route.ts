import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const { dossardNumber } = await req.json()
  const num = dossardNumber === null ? null : Number(dossardNumber)
  if (num !== null && (!Number.isInteger(num) || num < 1)) {
    return jsonError('Numéro de dossard invalide')
  }

  if (num !== null) {
    const taken = await prisma.team.findFirst({ where: { dossardNumber: num, id: { not: params.id } } })
    if (taken) return jsonError(`Le dossard ${num} est déjà pris par "${taken.unitName}"`, 409)
  }

  const team = await prisma.team.update({ where: { id: params.id }, data: { dossardNumber: num } })
  return NextResponse.json({ id: team.id, dossardNumber: team.dossardNumber })
}
