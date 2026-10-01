import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signSession, COOKIE_NAMES } from '@/lib/auth'
import { jsonError, recordFailure, tooManyFailures } from '@/lib/api-helpers'

export async function POST(req: NextRequest) {
  if (tooManyFailures(req, 'admin-login')) return jsonError('Trop d\'essais ratés — réessaie dans quelques minutes', 429)
  const { email, password } = await req.json()
  if (!email || !password) return jsonError('Email et mot de passe requis')

  const admin = await prisma.adminUser.findUnique({ where: { email: String(email).toLowerCase() } })
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    recordFailure(req, 'admin-login')
    return jsonError('Identifiants incorrects', 401)
  }

  const token = await signSession('admin', admin.id)
  const res = NextResponse.json({ id: admin.id, email: admin.email, displayName: admin.displayName })
  res.cookies.set(COOKIE_NAMES.admin, token, {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 12,
  })
  return res
}
