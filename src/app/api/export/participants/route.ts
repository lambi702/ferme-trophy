import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { teamDisplayName } from '@/lib/live-types'

export const dynamic = 'force-dynamic'

/**
 * Liste des inscrits pour le chronométreur (O'Top / RaceResult), au format de LEUR fichier : une ligne
 * par VÉLO (= un dossard = un transpondeur). CSV point-virgule UTF-8 avec BOM
 * (s'ouvre proprement dans Excel, s'importe dans RaceResult via
 * "Participants > Import"). Colonnes volontairement simples, à mapper chez eux.
 */
export async function GET(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const dossards = await prisma.dossard.findMany({
    where: { teamId: { not: null } },
    include: { team: { include: { dossards: { select: { number: true } } } } },
    orderBy: { number: 'asc' },
  })
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Mêmes colonnes que le fichier participants RaceResult renvoyé par O'Top (aller-retour sans retouche).
  const header = ['Dossard', 'Transpondeur1', 'NomFamille', 'Prénom', 'Club', 'Categ', 'Épreuve']
  const lines = dossards.map((d) => {
    const team = d.team!
    const teamName = teamDisplayName(team, team.dossards.map((x) => x.number).sort((a, b) => a - b))
    return [
      d.number,
      d.transponder ?? '',
      d.name || `Vélo ${d.number}`,
      teamName,
      team.unitName,
      team.sectionName,
      d.contest ?? '',
    ].map(esc).join(';')
  })
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n'
  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ferme-trophy-inscrits-${date}.csv"`,
    },
  })
}
