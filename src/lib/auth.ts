import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import type { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me')
const TTL = '12h'

export type Role = 'admin' | 'organizer' | 'team'

export const COOKIE_NAMES: Record<Role, string> = {
  admin: 'ft_admin_session',
  organizer: 'ft_org_session',
  team: 'ft_team_session',
}

export async function signSession(role: Role, id: string): Promise<string> {
  return new SignJWT({ role, sub: id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(SECRET)
}

export async function verifySession(token: string, expectedRole: Role): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.role !== expectedRole || typeof payload.sub !== 'string') return null
    return payload.sub
  } catch {
    return null
  }
}

export async function getSessionId(req: NextRequest, role: Role): Promise<string | null> {
  const token = req.cookies.get(COOKIE_NAMES[role])?.value
  if (!token) return null
  return verifySession(token, role)
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export function generatePin(length = 5): string {
  let pin = ''
  for (let i = 0; i < length; i++) pin += Math.floor(Math.random() * 10).toString()
  return pin
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
