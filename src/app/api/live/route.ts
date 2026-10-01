import { NextResponse } from 'next/server'
import { getLiveState } from '@/lib/live'

export const dynamic = 'force-dynamic'

// Public : tout ce qui est affiché sur l'écran géant / le classement.
// Jamais de PIN ni de donnée d'inscription ici.
export async function GET() {
  return NextResponse.json(await getLiveState(), { headers: { 'Cache-Control': 'no-store' } })
}
