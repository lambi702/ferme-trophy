import { NextResponse, type NextRequest } from 'next/server'
import { requireOrganizer } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const organizer = await requireOrganizer(req)
  if (!organizer) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  return NextResponse.json({ id: organizer.id, displayName: organizer.displayName })
}
