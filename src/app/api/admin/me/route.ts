import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  return NextResponse.json({ id: admin.id, email: admin.email, displayName: admin.displayName })
}
