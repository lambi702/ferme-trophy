import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { invalidateLive } from '@/lib/live'

/**
 * Comptage MANUEL de secours (si le chrono tombe) : +1 ajoute un passage
 * source "manual", −1 retire le dernier passage manuel de ce dossard.
 * Attention à ne pas doubler avec le chrono s'il revient (voir /admin/chrono).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)
  const { dossardNumber, delta } = await req.json()
  const number = Number(dossardNumber)
  if (!Number.isInteger(number) || number <= 0) return jsonError('Dossard invalide')

  if (Number(delta) < 0) {
    const last = await prisma.raceLapEvent.findFirst({ where: { dossardNumber: number, source: 'manual' }, orderBy: { createdAt: 'desc' } })
    if (!last) return jsonError('Aucun tour manuel à retirer sur ce dossard (pour corriger un tour chrono, utilise une correction)')
    await prisma.raceLapEvent.delete({ where: { id: last.id } })
  } else {
    await prisma.raceLapEvent.create({
      data: { dossardNumber: number, timestamp: new Date(), source: 'manual', rawPayload: { by: admin.displayName } },
    })
  }
  invalidateLive()
  return NextResponse.json({ ok: true })
}
