import { NextResponse, type NextRequest } from 'next/server'
import { getSessionId } from './auth'
import { prisma } from './prisma'

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function requireAdmin(req: NextRequest) {
  const id = await getSessionId(req, 'admin')
  if (!id) return null
  return prisma.adminUser.findUnique({ where: { id } })
}

export async function requireOrganizer(req: NextRequest) {
  const id = await getSessionId(req, 'organizer')
  if (!id) return null
  return prisma.organizer.findUnique({ where: { id } })
}

export type Staff = { role: 'admin' | 'organizer'; id: string; name: string; organizerId: string | null }

/**
 * Direction de course = organisateur OU comité. Le comité peut tout faire
 * ce qu'un organisateur fait (points, achats, inscriptions) + l'admin.
 */
export async function requireStaff(req: NextRequest): Promise<Staff | null> {
  const organizer = await requireOrganizer(req)
  if (organizer) return { role: 'organizer', id: organizer.id, name: organizer.displayName, organizerId: organizer.id }
  const admin = await requireAdmin(req)
  if (admin) return { role: 'admin', id: admin.id, name: admin.displayName, organizerId: null }
  return null
}

export async function requireTeamSession(req: NextRequest, expectedSlug?: string) {
  const id = await getSessionId(req, 'team')
  if (!id) return null
  const team = await prisma.team.findUnique({ where: { id } })
  if (!team) return null
  if (expectedSlug && team.slug !== expectedSlug) return null
  return team
}

// Limiteur d'ÉCHECS en mémoire (un seul process Next.js) : seules les
// tentatives ratées comptent, pour ne pas bloquer toute une wifi d'événement
// (même IP publique) qui se connecte légitimement. Contre le bourrinage de PIN.
const g = globalThis as unknown as { __ftFailures?: Map<string, { count: number; resetAt: number }> }
const failures = (g.__ftFailures ??= new Map())

function clientKey(req: NextRequest, scope: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
  return `${scope}:${ip}`
}

export function tooManyFailures(req: NextRequest, scope: string, max = 30): boolean {
  const bucket = failures.get(clientKey(req, scope))
  return Boolean(bucket && bucket.resetAt > Date.now() && bucket.count >= max)
}

export function recordFailure(req: NextRequest, scope: string, windowMs = 10 * 60 * 1000) {
  const key = clientKey(req, scope)
  const now = Date.now()
  const bucket = failures.get(key)
  if (!bucket || bucket.resetAt < now) failures.set(key, { count: 1, resetAt: now + windowMs })
  else bucket.count++
}
