import { NextResponse, type NextRequest } from 'next/server'
import { requireTeamSession } from '@/lib/api-helpers'
import { getTeamPointsBalance } from '@/lib/leaderboard'

export async function GET(req: NextRequest) {
  const team = await requireTeamSession(req)
  if (!team) return NextResponse.json({ error: 'Non déverrouillé' }, { status: 401 })
  const pointsBalance = await getTeamPointsBalance(team.id)
  return NextResponse.json({
    id: team.id,
    slug: team.slug,
    unitName: team.unitName,
    dossardNumber: team.dossardNumber,
    foulardName: team.foulardName,
    foulardColor: team.foulardColor,
    foulardEmoji: team.foulardEmoji,
    pointsBalance,
  })
}
