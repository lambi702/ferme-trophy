import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  await prisma.raceAdjustment.deleteMany({ where: { id: params.id, source: 'correction' } })
  invalidateLive()
  return NextResponse.json({ ok: true })
}
