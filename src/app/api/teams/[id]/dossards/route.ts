import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { assignDossards, parseDossardList, parseGroup } from '@/lib/teams'
import { invalidateLive } from '@/lib/live'

// "[id]" = slug. Ajout de vélos à une écurie existante.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const team = await prisma.team.findUnique({ where: { slug: params.id } })
  if (!team) return jsonError('Écurie introuvable', 404)

  const body = await req.json()
  const numbers = parseDossardList(body.dossards)
  if (numbers.length === 0) return jsonError('Numéro(s) de dossard requis')
  // Un vélo ajouté hérite du classement des autres vélos de l'écurie, sauf choix explicite.
  const sibling = await prisma.dossard.findFirst({ where: { teamId: team.id, contest: { not: null } } })
  const group = body.group !== undefined ? parseGroup(body.group) : sibling ? { contest: sibling.contest, category: sibling.category } : {}
  const { error } = await assignDossards(team.id, numbers, group)
  if (error) return jsonError(error, 409)
  invalidateLive()
  return NextResponse.json({ ok: true })
}

// Retire un vélo de l'écurie (?number=12). Le dossard reste dans le pool,
// ses passages chrono restent en base (ils recompteront s'il est réattribué).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const team = await prisma.team.findUnique({ where: { slug: params.id } })
  if (!team) return jsonError('Écurie introuvable', 404)
  const number = Number(req.nextUrl.searchParams.get('number'))
  await prisma.dossard.updateMany({ where: { number, teamId: team.id }, data: { teamId: null } })
  invalidateLive()
  return NextResponse.json({ ok: true })
}

// Change le classement (parcours · catégorie) de TOUS les vélos de l'écurie : { group: "1-2" }.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const team = await prisma.team.findUnique({ where: { slug: params.id } })
  if (!team) return jsonError('Écurie introuvable', 404)
  const group = parseGroup((await req.json()).group)
  await prisma.dossard.updateMany({ where: { teamId: team.id }, data: group })
  invalidateLive()
  return NextResponse.json({ ok: true })
}
