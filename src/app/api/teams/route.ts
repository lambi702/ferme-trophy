import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePin, hashPin, slugify } from '@/lib/auth'
import { jsonError, requireAdmin, requireOrganizer } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  const organizer = admin ? null : await requireOrganizer(req)
  if (!admin && !organizer) return jsonError('Non autorisé', 403)

  const teams = await prisma.team.findMany({ orderBy: { unitName: 'asc' } })

  if (admin) return NextResponse.json(teams.map((t) => ({ ...t, pinHash: undefined })))

  // Un·e organisateur·rice de mini-jeu n'a besoin que du strict nécessaire
  // pour créditer des points — pas des PIN, pas des dates de création.
  return NextResponse.json(
    teams.map((t) => ({ id: t.id, unitName: t.unitName, dossardNumber: t.dossardNumber, foulardEmoji: t.foulardEmoji })),
  )
}

/**
 * Import "one-shot" des inscriptions (section 7.1). MVP volontairement simple :
 * une liste de noms d'unité, une ligne = une équipe. Le format réel du CSV
 * n'est pas encore connu — cet endpoint attend juste `unitNames: string[]`,
 * à adapter facilement une fois le fichier reçu (le parsing CSV se ferait
 * côté client ou ici, mais la création reste la même).
 *
 * Rejouable uniquement avec `confirm: true` explicite si des équipes
 * existent déjà (évite d'écraser des PIN déjà distribués par erreur).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return jsonError('Non autorisé', 403)

  const { unitNames, confirm } = await req.json()
  if (!Array.isArray(unitNames) || unitNames.length === 0) {
    return jsonError('unitNames (tableau de noms) requis')
  }

  const existingCount = await prisma.team.count()
  if (existingCount > 0 && !confirm) {
    return jsonError(
      `${existingCount} équipe(s) existent déjà. Relance avec confirm:true si tu es sûr (les PIN déjà distribués resteront valides pour les équipes existantes, seules les nouvelles lignes créent de nouvelles équipes).`,
      409,
    )
  }

  const results: { unitName: string; slug: string; pin: string }[] = []

  for (const rawName of unitNames as string[]) {
    const unitName = String(rawName).trim()
    if (!unitName) continue

    const baseSlug = slugify(unitName)
    let slug = baseSlug
    let n = 1
    while (await prisma.team.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++n}`
    }

    const pin = generatePin()
    await prisma.team.create({
      data: { unitName, slug, pinHash: await hashPin(pin) },
    })
    results.push({ unitName, slug, pin })
  }

  return NextResponse.json({ created: results.length, teams: results })
}
