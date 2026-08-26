import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePin, slugify } from '@/lib/auth'
import { jsonError, requireAdmin, requireOrganizer } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  // Comité ET organisateurs voient le PIN — ils doivent pouvoir le
  // retrouver à tout moment pour le recommuniquer à une équipe.
  const teams = await prisma.team.findMany({
    include: { dossards: { select: { number: true } } },
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
      foulardEmoji: t.foulardEmoji,
      dossardNumbers: t.dossards.map((d) => d.number).sort((a, b) => a - b),
    })),
  )
}

/**
 * Création d'équipe — comité ET organisateurs (voir retour du comité :
 * les organisateurs doivent pouvoir créer une équipe et l'associer à un
 * vélo directement sur le terrain).
 *
 * Par défaut, l'équipe est créée VIERGE (unitName/sectionName vides) — le
 * PIN est généré et retourné pour être communiqué, à charge pour l'équipe
 * de se personnaliser elle-même via sa page. `unitNames` reste accepté en
 * option pour un import en masse si le comité a déjà une liste (CSV).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  const { unitNames, count } = await req.json()

  const names: string[] = Array.isArray(unitNames) && unitNames.length > 0
    ? unitNames.map((n: string) => String(n).trim()).filter(Boolean)
    : Array.from({ length: Number(count) > 0 ? Number(count) : 1 }, () => '')

  const results: { unitName: string; slug: string; pin: string }[] = []

  for (const unitName of names) {
    const baseSlug = unitName ? slugify(unitName) : 'equipe'
    let slug = baseSlug
    let n = 1
    while (await prisma.team.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++n}`
    }

    let pin = generatePin()
    while (await prisma.team.findUnique({ where: { pin } })) {
      pin = generatePin()
    }

    await prisma.team.create({ data: { unitName, slug, pin } })
    results.push({ unitName, slug, pin })
  }

  return NextResponse.json({ created: results.length, teams: results })
}
