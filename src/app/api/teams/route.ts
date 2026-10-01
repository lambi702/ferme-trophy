import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { assignDossards, createTeam, parseDossardList } from '@/lib/teams'
import { invalidateLive } from '@/lib/live'

export async function GET(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)

  // Comité ET organisateurs voient le PIN — ils doivent pouvoir le
  // retrouver à tout moment pour le recommuniquer à une écurie.
  const teams = await prisma.team.findMany({
    include: { dossards: { select: { id: true, number: true, name: true }, orderBy: { number: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(
    teams.map((t) => ({
      id: t.id,
      slug: t.slug,
      pin: t.pin,
      unitName: t.unitName,
      sectionName: t.sectionName,
      foulardName: t.foulardName,
      foulardColor: t.foulardColor,
      foulardEmoji: t.foulardEmoji,
      createdAt: t.createdAt,
      dossards: t.dossards,
      dossardNumbers: t.dossards.map((d) => d.number),
    })),
  )
}

/**
 * Inscription d'une écurie — comité ET organisateurs. Tout est optionnel :
 * nom d'écurie / unité / section (l'écurie peut les changer ensuite elle-même
 * avec son PIN) et dossards ("12, 13" ou "12-14"). `count` crée N écuries
 * vierges d'un coup (ancien comportement).
 */
export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const body = await req.json()

  const count = Math.min(Math.max(Number(body.count) || 1, 1), 100)
  const numbers = parseDossardList(body.dossards)
  if (count > 1 && numbers.length > 0) return jsonError('Dossards : une écurie à la fois')

  if (numbers.length > 0) {
    const taken = await prisma.dossard.findMany({ where: { number: { in: numbers }, teamId: { not: null } }, select: { number: true } })
    if (taken.length > 0) return jsonError(`Dossard déjà attribué : ${taken.map((d) => `#${d.number}`).join(', ')}`, 409)
  }

  const created = []
  for (let i = 0; i < count; i++) {
    const team = await createTeam({
      foulardName: String(body.foulardName ?? '').trim(),
      unitName: String(body.unitName ?? '').trim(),
      sectionName: String(body.sectionName ?? '').trim(),
    })
    if (numbers.length > 0) {
      const { error } = await assignDossards(team.id, numbers)
      if (error) {
        await prisma.team.delete({ where: { id: team.id } })
        return jsonError(error, 409)
      }
    }
    created.push({ id: team.id, slug: team.slug, pin: team.pin, foulardName: team.foulardName, dossardNumbers: numbers })
  }
  invalidateLive()
  return NextResponse.json({ created: created.length, teams: created })
}
