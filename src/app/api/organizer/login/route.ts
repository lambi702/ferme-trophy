import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession, hashPin, verifyPin, COOKIE_NAMES } from '@/lib/auth'
import { jsonError } from '@/lib/api-helpers'

/**
 * Self-service : si le nom n'existe pas encore, on crée le compte avec ce PIN.
 * S'il existe, le PIN doit correspondre. Pas de vérification email — voir
 * section 5 du handover ("création facile en self-service").
 */
export async function POST(req: NextRequest) {
  const { displayName, pin } = await req.json()
  const name = String(displayName ?? '').trim()
  const pinStr = String(pin ?? '').trim()

  if (!name) return jsonError('Nom requis')
  if (!/^\d{4,6}$/.test(pinStr)) return jsonError('PIN à 4-6 chiffres requis')

  let organizer = await prisma.organizer.findFirst({ where: { displayName: name } })

  if (!organizer) {
    organizer = await prisma.organizer.create({
      data: { displayName: name, pinHash: await hashPin(pinStr) },
    })
  } else if (!(await verifyPin(pinStr, organizer.pinHash))) {
    return jsonError('PIN incorrect pour ce nom (déjà utilisé par quelqu\'un d\'autre ?)', 401)
  }

  const token = await signSession('organizer', organizer.id)
  const res = NextResponse.json({ id: organizer.id, displayName: organizer.displayName })
  res.cookies.set(COOKIE_NAMES.organizer, token, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
