import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession, verifyPin, COOKIE_NAMES } from '@/lib/auth'
import { jsonError } from '@/lib/api-helpers'

/**
 * Vérification uniquement — PAS d'auto-création. Les comptes organisateur
 * sont créés par le comité (voir /api/organizers), justement pour éviter
 * que n'importe qui se crée un accès et crédite des points à volonté
 * (triche). Revirement volontaire par rapport à la section 5 du handover
 * d'origine ("self-service") suite à un retour explicite du comité.
 */
export async function POST(req: NextRequest) {
  const { displayName, pin } = await req.json()
  const name = String(displayName ?? '').trim()
  const pinStr = String(pin ?? '').trim()

  if (!name || !pinStr) return jsonError('Nom et PIN requis')

  const organizer = await prisma.organizer.findFirst({ where: { displayName: name } })
  if (!organizer || !(await verifyPin(pinStr, organizer.pinHash))) {
    return jsonError('Compte introuvable ou PIN incorrect — demande au comité de te créer un accès.', 401)
  }

  const token = await signSession('organizer', organizer.id)
  const res = NextResponse.json({ id: organizer.id, displayName: organizer.displayName })
  res.cookies.set(COOKIE_NAMES.organizer, token, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
