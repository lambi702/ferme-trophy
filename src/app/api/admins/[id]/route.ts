import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { generatePassword } from '@/lib/auth'
import { jsonError, requireAdmin } from '@/lib/api-helpers'

/**
 * - { resetPassword: true } → nouveau mot de passe généré (affiché une fois)
 * - { password, currentPassword } → changer SON PROPRE mot de passe
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)
  const target = await prisma.adminUser.findUnique({ where: { id: params.id } })
  if (!target) return jsonError('Compte introuvable', 404)
  const body = await req.json()

  if (body.resetPassword) {
    const password = generatePassword()
    await prisma.adminUser.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(password, 10) } })
    return NextResponse.json({ email: target.email, displayName: target.displayName, password })
  }

  if (typeof body.password === 'string') {
    if (target.id !== admin.id) return jsonError('Tu ne peux changer que ton propre mot de passe', 403)
    if (!(await bcrypt.compare(String(body.currentPassword ?? ''), target.passwordHash))) return jsonError('Mot de passe actuel incorrect', 401)
    if (body.password.length < 8) return jsonError('8 caractères minimum')
    await prisma.adminUser.update({ where: { id: target.id }, data: { passwordHash: await bcrypt.hash(body.password, 10) } })
    return NextResponse.json({ ok: true })
  }
  return jsonError('Rien à modifier')
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)
  if (params.id === admin.id) return jsonError('Tu ne peux pas supprimer ton propre compte')
  if ((await prisma.adminUser.count()) <= 1) return jsonError('Il faut garder au moins un compte comité')
  await prisma.adminUser.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
