import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireTeamSession } from '@/lib/api-helpers'

// "[id]" transporte en réalité le slug ici — voir note dans ../route.ts
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const team = await requireTeamSession(req, params.id)
  if (!team) return jsonError('Déverrouille ta page avec le PIN d\'abord', 401)

  const { foulardName, foulardColor, foulardEmoji } = await req.json()
  const updated = await prisma.team.update({
    where: { id: team.id },
    data: {
      ...(foulardName !== undefined && { foulardName: String(foulardName).slice(0, 60) }),
      ...(foulardColor !== undefined && { foulardColor: String(foulardColor).slice(0, 20) }),
      ...(foulardEmoji !== undefined && { foulardEmoji: String(foulardEmoji).slice(0, 8) }),
    },
  })
  return NextResponse.json({
    foulardName: updated.foulardName,
    foulardColor: updated.foulardColor,
    foulardEmoji: updated.foulardEmoji,
  })
}
