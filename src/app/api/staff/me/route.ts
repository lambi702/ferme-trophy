import { NextResponse, type NextRequest } from 'next/server'
import { requireStaff } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const staff = await requireStaff(req)
  if (!staff) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  return NextResponse.json({ role: staff.role, id: staff.id, name: staff.name })
}
