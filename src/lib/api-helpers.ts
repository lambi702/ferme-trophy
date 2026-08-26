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

export async function requireTeamSession(req: NextRequest, expectedSlug?: string) {
  const id = await getSessionId(req, 'team')
  if (!id) return null
  const team = await prisma.team.findUnique({ where: { id } })
  if (!team) return null
  if (expectedSlug && team.slug !== expectedSlug) return null
  return team
}
