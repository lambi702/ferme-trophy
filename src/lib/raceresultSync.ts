import { prisma } from './prisma'
import { createTeam } from './teams'
import { normalizeChip } from './timing/parse'

/**
 * Synchronisation avec le fichier participants RaceResult d'O'Top
 * (colonnes : Dossard · Transpondeur1 · NomFamille · Prénom · Club · Categ · Épreuve,
 * c.-à-d. le format de notre propre export, enrichi par O'Top).
 *
 * Le fichier fait foi pour : la liste des vélos en course, leur transpondeur,
 * leur épreuve, et l'écurie de chaque vélo (colonne Prénom = nom d'écurie).
 * Les personnalisations faites par les écuries (couleur, emoji, surnoms) sont gardées.
 */

export type RrRow = {
  number: number
  transponder: string | null
  teamName: string
  unitName: string
  sectionName: string
  contest: number | null
  category: number | null
  bikeName: string | null
}

/**
 * Catégorie dans le parcours, déduite de la section (règle du comité 2026) :
 *  - grand parcours : cat 1 = Scouts, cat 2 = Scoutes / Guides
 *  - petit parcours : cat 1 = Louveteaux, cat 2 = Louvettes / Lutins
 */
export function categoryFromSection(section: string): number | null {
  const n = norm(section)
  if (['scouts', 'scout', 'eclaireurs', 'louveteaux', 'louveteau', 'meute'].includes(n)) return 1
  if (['scoutes', 'scoute', 'guides', 'guide', 'louvettes', 'louvette', 'lutins', 'lutin'].includes(n)) return 2
  return null
}

export type SyncPlan = {
  rows: number
  createTeams: { name: string; unitName: string; sectionName: string; bikes: number[] }[]
  createBikes: { number: number; team: string }[]
  moveBikes: { number: number; from: string; to: string }[]
  updateBikes: { number: number; changes: string[] }[]
  removeBikes: { number: number; team: string }[]
  removeTeams: string[]
  keptTeamsWithoutBikes: string[]
  errors: string[]
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

const COLS = {
  number: ['dossard', 'bib', 'numero', 'startnumber', 'nr'],
  transponder: ['transpondeur1', 'transpondeur', 'transponder1', 'transponder', 'chip', 'puce'],
  bikeName: ['nomfamille', 'lastname', 'nom', 'velo'],
  teamName: ['prenom', 'firstname', 'ecurie', 'team', 'equipe'],
  unitName: ['club', 'unite', 'unit'],
  sectionName: ['categ', 'categorie', 'category', 'section'],
  contest: ['epreuve', 'contest', 'course'],
}

/** Tableau collé depuis Excel (tabulations) ou CSV (; ou ,), avec ligne d'en-tête. */
export function parseRrTable(text: string): { rows: RrRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { rows: [], errors: ['Colle le tableau AVEC sa ligne d\'en-tête (Dossard, Transpondeur1, …).'] }
  const delim = ['\t', ';', ','].find((d) => lines[0].includes(d)) ?? '\t'
  const split = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
  const header = split(lines[0]).map(norm)
  const idx = Object.fromEntries(
    Object.entries(COLS).map(([k, aliases]) => [k, header.findIndex((h) => aliases.includes(h))]),
  ) as Record<keyof typeof COLS, number>
  if (idx.number < 0) return { rows: [], errors: ['Colonne « Dossard » introuvable dans l\'en-tête.'] }
  if (idx.teamName < 0) return { rows: [], errors: ['Colonne « Prénom » (= nom d\'écurie) introuvable dans l\'en-tête.'] }

  const rows: RrRow[] = []
  const errors: string[] = []
  const seen = new Set<number>()
  const seenChips = new Map<string, number>()
  lines.slice(1).forEach((line, i) => {
    const c = split(line)
    const get = (k: keyof typeof COLS) => (idx[k] >= 0 ? c[idx[k]] ?? '' : '')
    const number = Number(get('number'))
    if (!Number.isInteger(number) || number <= 0) {
      if (c.some(Boolean)) errors.push(`Ligne ${i + 2} ignorée : dossard « ${get('number')} » invalide`)
      return
    }
    if (seen.has(number)) return void errors.push(`Dossard ${number} présent deux fois`)
    seen.add(number)
    const transponder = get('transponder') ? normalizeChip(get('transponder')) : null
    if (transponder) {
      if (seenChips.has(transponder)) errors.push(`Transpondeur ${transponder} utilisé par ${seenChips.get(transponder)} et ${number}`)
      seenChips.set(transponder, number)
    }
    const contest = Number(get('contest'))
    const rawBikeName = get('bikeName')
    rows.push({
      number,
      transponder,
      teamName: get('teamName'),
      unitName: get('unitName'),
      sectionName: get('sectionName'),
      contest: Number.isInteger(contest) && contest > 0 ? contest : null,
      category: categoryFromSection(get('sectionName')),
      // "Vélo 91" = libellé générique de notre export, pas un vrai surnom.
      bikeName: rawBikeName && !/^v[ée]lo\s*#?\d+$/i.test(rawBikeName) ? rawBikeName.slice(0, 40) : null,
    })
  })
  rows.forEach((r) => {
    if (!r.teamName) errors.push(`Dossard ${r.number} : pas de nom d'écurie (colonne Prénom)`)
    if (r.sectionName && r.category === null) errors.push(`Dossard ${r.number} : catégorie inconnue pour la section « ${r.sectionName} »`)
  })
  return { rows, errors }
}

export async function planSync(rows: RrRow[], opts: { removeMissing: boolean }): Promise<SyncPlan> {
  const teams = await prisma.team.findMany({
    include: { dossards: true, _count: { select: { pointsTransactions: true, purchasesMade: true } } },
  })
  const dossards = await prisma.dossard.findMany({ include: { team: true } })
  const teamName = (t: { foulardName: string; unitName: string }) => t.foulardName || t.unitName
  const teamByName = new Map(teams.map((t) => [norm(teamName(t)), t]))
  const dossardByNumber = new Map(dossards.map((d) => [d.number, d]))

  const plan: SyncPlan = {
    rows: rows.length, createTeams: [], createBikes: [], moveBikes: [], updateBikes: [], removeBikes: [], removeTeams: [], keptTeamsWithoutBikes: [], errors: [],
  }
  const newTeams = new Map<string, SyncPlan['createTeams'][number]>()

  for (const r of rows) {
    if (!r.teamName) continue
    const key = norm(r.teamName)
    const existingTeam = teamByName.get(key)
    if (!existingTeam && !newTeams.has(key)) {
      newTeams.set(key, { name: r.teamName, unitName: r.unitName, sectionName: r.sectionName, bikes: [] })
    }
    const d = dossardByNumber.get(r.number)
    if (!d) {
      plan.createBikes.push({ number: r.number, team: r.teamName })
      newTeams.get(key)?.bikes.push(r.number)
      continue
    }
    if (!d.team || norm(teamName(d.team)) !== key) {
      plan.moveBikes.push({ number: r.number, from: d.team ? teamName(d.team) : '—', to: r.teamName })
      newTeams.get(key)?.bikes.push(r.number)
    }
    const changes: string[] = []
    if ((d.transponder ?? null) !== r.transponder) changes.push(`puce ${d.transponder ?? '—'} → ${r.transponder ?? '—'}`)
    if ((d.contest ?? null) !== r.contest) changes.push(`parcours ${d.contest ?? '—'} → ${r.contest ?? '—'}`)
    if ((d.category ?? null) !== r.category) changes.push(`catégorie ${d.category ?? '—'} → ${r.category ?? '—'}`)
    if (r.bikeName && r.bikeName !== d.name) changes.push(`surnom « ${r.bikeName} »`)
    if (changes.length) plan.updateBikes.push({ number: r.number, changes })
  }
  plan.createTeams = [...newTeams.values()]

  const inFile = new Set(rows.map((r) => r.number))
  if (opts.removeMissing) {
    for (const d of dossards) {
      if (!inFile.has(d.number) && d.teamId) plan.removeBikes.push({ number: d.number, team: d.team ? teamName(d.team) : '—' })
    }
    // Écuries qui n'ont plus aucun vélo : supprimées si elles n'ont aucun historique, sinon gardées (points visibles).
    const stillHasBike = new Set(rows.map((r) => norm(r.teamName)))
    for (const t of teams) {
      if (stillHasBike.has(norm(teamName(t)))) continue // encore présente dans le fichier
      if (t.dossards.length === 0) continue // déjà sans vélo : on n'y touche pas
      if (t.dossards.some((d) => inFile.has(d.number))) continue // ses vélos changent juste d'écurie
      if (t._count.pointsTransactions + t._count.purchasesMade === 0) plan.removeTeams.push(teamName(t))
      else plan.keptTeamsWithoutBikes.push(teamName(t))
    }
  }
  return plan
}

export async function applySync(rows: RrRow[], opts: { removeMissing: boolean }) {
  const plan = await planSync(rows, opts)
  const teams = await prisma.team.findMany()
  const teamName = (t: { foulardName: string; unitName: string }) => t.foulardName || t.unitName
  const teamIdByName = new Map(teams.map((t) => [norm(teamName(t)), t.id]))

  for (const t of plan.createTeams) {
    const created = await createTeam({ foulardName: t.name, unitName: t.unitName, sectionName: t.sectionName })
    teamIdByName.set(norm(t.name), created.id)
  }

  await prisma.$transaction(async (tx) => {
    const inFile = new Set(rows.map((r) => r.number))
    if (opts.removeMissing) {
      // Vélos absents du fichier : supprimés (leurs passages éventuels restent en base, orphelins).
      await tx.dossard.deleteMany({ where: { number: { notIn: [...inFile] }, teamId: { not: null } } })
      const names = new Set(plan.removeTeams.map(norm))
      const toDelete = teams.filter((t) => names.has(norm(teamName(t)))).map((t) => t.id)
      if (toDelete.length) await tx.team.deleteMany({ where: { id: { in: toDelete } } })
    }
    // Libère d'abord les transpondeurs (contrainte unique) avant de les réattribuer.
    await tx.dossard.updateMany({ where: { number: { in: [...inFile] } }, data: { transponder: null } })
    const chips = rows.map((r) => r.transponder).filter(Boolean) as string[]
    if (chips.length) await tx.dossard.updateMany({ where: { transponder: { in: chips } }, data: { transponder: null } })

    for (const r of rows) {
      const teamId = teamIdByName.get(norm(r.teamName))
      if (!teamId) continue
      await tx.dossard.upsert({
        where: { number: r.number },
        create: { number: r.number, teamId, transponder: r.transponder, contest: r.contest, category: r.category, ...(r.bikeName ? { name: r.bikeName } : {}) },
        update: { teamId, transponder: r.transponder, contest: r.contest, category: r.category, ...(r.bikeName ? { name: r.bikeName } : {}) },
      })
    }
  })
  return plan
}
