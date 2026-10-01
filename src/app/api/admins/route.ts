import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { generatePassword } from '@/lib/auth'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

// Comptes comité — gérés par le comité lui-même (aucune auto-inscription).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)
  const admins = await prisma.adminUser.findMany({
    select: { id: true, email: true, displayName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ me: admin.id, admins })
}

// Mot de passe GÉNÉRÉ et renvoyé une seule fois (jamais choisi/transmis par le chat).
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const { email, displayName } = await req.json()
  const mail = String(email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return jsonError('Email invalide')
  if (await prisma.adminUser.findUnique({ where: { email: mail } })) return jsonError('Ce compte existe déjà', 409)

  const password = generatePassword()
  const created = await prisma.adminUser.create({
    data: { email: mail, displayName: String(displayName ?? '').trim().slice(0, 60) || mail, passwordHash: await bcrypt.hash(password, 10) },
  })
  return NextResponse.json({ email: created.email, displayName: created.displayName, password })
}
