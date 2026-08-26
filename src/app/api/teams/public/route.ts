import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Liste publique minimale — sert à choisir une équipe cible pour un malus.
// Les noms d'unité/foulard sont publics par nature (déjà visibles au classement).
export async function GET() {
  const teams = await prisma.team.findMany({
    where: { dossards: { some: {} } },
    select: { id: true, slug: true, unitName: true, foulardName: true, foulardEmoji: true },
    orderBy: { unitName: 'asc' },
  })
  return NextResponse.json(teams)
}
