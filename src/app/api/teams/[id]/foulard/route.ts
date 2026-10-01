import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff, requireTeamSession } from '@/lib/api-helpers'
import { updateTeamProfile } from '@/lib/teams'
import { invalidateLive } from '@/lib/live'

// "[id]" transporte en réalité le slug ici — voir note dans ../route.ts
// Personnalisation de l'écurie : nom d'écurie, unité, section, couleur,
// emoji, surnoms des vélos. Par l'écurie elle-même (session PIN) ou par la
// direction de course (pour aider à l'inscription).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const team = (await requireTeamSession(req, params.id))
    ?? ((await requireStaff(req)) ? await prisma.team.findUnique({ where: { slug: params.id } }) : null)
  if (!team) return jsonError('Déverrouille ta page avec le PIN d\'abord', 401)

  await updateTeamProfile(team.id, await req.json())
  invalidateLive()
  return NextResponse.json({ ok: true })
}
