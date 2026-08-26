import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireTeamSession } from '@/lib/api-helpers'
import { getTeamPointsBalance } from '@/lib/leaderboard'

export async function GET(req: NextRequest) {
  const team = await requireTeamSession(req)
  if (!team) return NextResponse.json({ error: 'Non déverrouillé' }, { status: 401 })

  const dossards = await prisma.dossard.findMany({ where: { teamId: team.id }, select: { number: true } })
  const pointsBalance = await getTeamPointsBalance(team.id)

  return NextResponse.json({
    id: team.id,
    slug: team.slug,
    unitName: team.unitName,
    sectionName: team.sectionName,
    dossardNumbers: dossards.map((d) => d.number).sort((a, b) => a - b),
    foulardName: team.foulardName,
    foulardColor: team.foulardColor,
    foulardEmoji: team.foulardEmoji,
    pointsBalance,
  })
}
