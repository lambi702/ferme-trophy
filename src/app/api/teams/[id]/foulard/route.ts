import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireTeamSession } from '@/lib/api-helpers'

// "[id]" transporte en réalité le slug ici — voir note dans ../route.ts
// Page de personnalisation de l'équipe : nom d'unité, nom de section,
// foulard (nom/couleur/emoji) — tout est éditable par l'équipe elle-même,
// vierge par défaut à la création (voir /api/teams POST).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const team = await requireTeamSession(req, params.id)
  if (!team) return jsonError('Déverrouille ta page avec le PIN d\'abord', 401)

  const body = await req.json()
  const data: Record<string, string> = {}
  for (const [field, maxLen] of [
    ['unitName', 80], ['sectionName', 60],
    ['foulardName', 60], ['foulardColor', 20], ['foulardEmoji', 8],
  ] as const) {
    if (body[field] !== undefined) data[field] = String(body[field]).slice(0, maxLen)
  }

  const updated = await prisma.team.update({ where: { id: team.id }, data })
  return NextResponse.json({
    unitName: updated.unitName,
    sectionName: updated.sectionName,
    foulardName: updated.foulardName,
    foulardColor: updated.foulardColor,
    foulardEmoji: updated.foulardEmoji,
  })
}
