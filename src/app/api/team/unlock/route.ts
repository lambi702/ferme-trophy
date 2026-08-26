import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession, COOKIE_NAMES } from '@/lib/auth'
import { jsonError } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  const { slug, pin } = await req.json()
  if (!slug || !pin) return jsonError('Slug et PIN requis')

  const team = await prisma.team.findUnique({ where: { slug: String(slug) } })
  if (!team || team.pin !== String(pin)) {
    return jsonError('PIN incorrect', 401)
  }

  const token = await signSession('team', team.id)
  const res = NextResponse.json({ id: team.id, slug: team.slug })
  res.cookies.set(COOKIE_NAMES.team, token, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
