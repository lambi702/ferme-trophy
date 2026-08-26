import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeCourseLeaderboard } from '@/lib/leaderboard'

// Note : ce segment s'appelle "[id]" pour des raisons techniques Next.js
// (un seul nom de segment dynamique possible à ce niveau de l'arbre de
// routes), mais la valeur transportée ici est bien le SLUG de l'équipe.
//
// Vue publique — jamais de PIN, jamais de données d'inscription/enfants,
// juste ce qui est légitimement visible sur un panneau/QR code public.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const team = await prisma.team.findUnique({
    where: { slug: params.id },
    include: { dossards: { select: { number: true } } },
  })
  if (!team) return NextResponse.json({ error: 'Équipe introuvable' }, { status: 404 })

  const leaderboard = await computeCourseLeaderboard()
  const entry = leaderboard.find((r) => r.teamId === team.id)

  return NextResponse.json({
    slug: team.slug,
    unitName: team.unitName,
    sectionName: team.sectionName,
    dossardNumbers: team.dossards.map((d) => d.number).sort((a, b) => a - b),
    foulardName: team.foulardName,
    foulardColor: team.foulardColor,
    foulardEmoji: team.foulardEmoji,
    rank: entry?.rank ?? null,
    adjustedLaps: entry?.adjustedLaps ?? 0,
  })
}
