import { NextResponse, type NextRequest } from 'next/server'
import { requireTeamSession } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const team = await requireTeamSession(req)
  if (!team) return NextResponse.json({ error: 'Non déverrouillé' }, { status: 401 })
  return NextResponse.json({ id: team.id, slug: team.slug })
}
