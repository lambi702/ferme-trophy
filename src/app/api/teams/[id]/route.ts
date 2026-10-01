import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeFeed, invalidateLive } from '@/lib/live'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { teamDisplayName } from '@/lib/live-types'

export const dynamic = 'force-dynamic'

// Note : ce segment s'appelle "[id]" pour des raisons techniques Next.js
// (un seul nom de segment dynamique possible à ce niveau de l'arbre de
// routes), mais la valeur transportée ici est bien le SLUG de l'écurie.
//
// Vue publique — jamais de PIN, juste ce qui est légitimement visible
// au classement. Les tours/rangs live viennent de /api/live côté client.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const team = await prisma.team.findUnique({
    where: { slug: params.id },
    include: { dossards: { select: { number: true, name: true }, orderBy: { number: 'asc' } } },
  })
  if (!team) return jsonError('Écurie introuvable', 404)

  const feed = await computeFeed({ limit: 40, teamId: team.id })
  return NextResponse.json({
    id: team.id,
    slug: team.slug,
    name: teamDisplayName(team, team.dossards.map((d) => d.number)),
    unitName: team.unitName,
    sectionName: team.sectionName,
    foulardName: team.foulardName,
    foulardColor: team.foulardColor,
    foulardEmoji: team.foulardEmoji,
    bikes: team.dossards,
    feed,
  })
}

// Suppression d'une écurie (erreur d'inscription) — direction de course.
// Ses dossards repassent "non attribués" (onDelete: SetNull), ses points
// et achats disparaissent avec elle.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const team = await prisma.team.findUnique({ where: { slug: params.id } })
  if (!team) return jsonError('Écurie introuvable', 404)
  await prisma.team.delete({ where: { id: team.id } })
  invalidateLive()
  return NextResponse.json({ ok: true })
}
