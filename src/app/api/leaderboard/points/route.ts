import { NextResponse } from 'next/server'
import { computePointsLeaderboard } from '@/lib/leaderboard'

export const dynamic = 'force-dynamic'

// Variante JSON simple, utilisée en repli si le SSE (/stream) échoue.
export async function GET() {
  return NextResponse.json(await computePointsLeaderboard())
}
