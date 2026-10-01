import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession, COOKIE_NAMES } from '@/lib/auth'
import { jsonError, recordFailure, tooManyFailures } from '@/lib/api-helpers'

// Déverrouillage d'une page écurie (personnalisation). Le PIN seul suffit
// (il est unique) — le slug, s'il est fourni, doit correspondre.
// Le PIN ne donne PAS le droit de dépenser des points : ça passe par la
// direction de course (voir /api/purchases).
export async function POST(req: NextRequest) {
  if (tooManyFailures(req, 'team-unlock')) return jsonError('Trop d\'essais ratés — réessaie dans quelques minutes', 429)
  const { slug, pin } = await req.json()
  const pinStr = String(pin ?? '').replace(/\D/g, '')
  if (!pinStr) return jsonError('PIN requis')

  const team = await prisma.team.findUnique({ where: { pin: pinStr } })
  if (!team || (slug && team.slug !== String(slug))) {
    recordFailure(req, 'team-unlock')
    return jsonError('PIN incorrect', 401)
  }

  const token = await signSession('team', team.id)
  const res = NextResponse.json({ id: team.id, slug: team.slug })
  res.cookies.set(COOKIE_NAMES.team, token, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 3,
  })
  return res
}
