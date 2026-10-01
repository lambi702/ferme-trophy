import { NextResponse, type NextRequest } from 'next/server'
import { computeFeed } from '@/lib/live'
import { jsonError, requireStaff } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

// Historique complet (y compris annulés) pour la direction de course.
export async function GET(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 100, 500)
  return NextResponse.json(await computeFeed({ limit, includeCancelled: true }))
}
