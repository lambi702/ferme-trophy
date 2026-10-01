import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { getRaceConfig, updateRaceConfig } from '@/lib/settings'
import { invalidateLive } from '@/lib/live'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  return NextResponse.json(await getRaceConfig())
}

// Horloge de course (affichée sur l'écran géant et les téléphones).
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const race = await updateRaceConfig(await req.json())
  invalidateLive()
  return NextResponse.json(race)
}
