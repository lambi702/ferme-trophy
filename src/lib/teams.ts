import { prisma } from './prisma'
import { generatePin, slugify } from './auth'

/** "12, 13 14-16" → [12, 13, 14, 15, 16] */
export function parseDossardList(input: unknown): number[] {
  if (Array.isArray(input)) return [...new Set(input.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
  const out: number[] = []
  for (const part of String(input ?? '').split(/[\s,;]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])]
      if (b >= a && b - a <= 200) for (let n = a; n <= b; n++) out.push(n)
    } else if (/^\d+$/.test(part)) {
      out.push(Number(part))
    }
  }
  return [...new Set(out)].filter((n) => n > 0)
}

/**
 * Attribue des dossards à une écurie (crée le dossard s'il n'existe pas
 * encore dans le pool). Refuse si un numéro appartient déjà à une AUTRE
 * écurie — on ne vole pas un vélo en silence.
 */
export async function assignDossards(teamId: string, numbers: number[], group: { contest?: number | null; category?: number | null } = {}) {
  const existing = await prisma.dossard.findMany({
    where: { number: { in: numbers } },
    include: { team: { select: { id: true, foulardName: true, unitName: true } } },
  })
  const conflicts = existing.filter((d) => d.teamId && d.teamId !== teamId)
  if (conflicts.length > 0) {
    return {
      error: `Dossard déjà attribué : ${conflicts.map((d) => `#${d.number} (${d.team?.foulardName || d.team?.unitName || 'autre écurie'})`).join(', ')}`,
    }
  }
  const extra = {
    ...(group.contest !== undefined ? { contest: group.contest } : {}),
    ...(group.category !== undefined ? { category: group.category } : {}),
  }
  for (const number of numbers) {
    await prisma.dossard.upsert({ where: { number }, create: { number, teamId, ...extra }, update: { teamId, ...extra } })
  }
  return { error: null }
}

export async function createTeam(data: { foulardName?: string; unitName?: string; sectionName?: string }) {
  const label = data.foulardName || data.unitName || ''
  const baseSlug = (label && slugify(label)) || 'ecurie'
  let slug = baseSlug
  let n = 1
  while (await prisma.team.findUnique({ where: { slug } })) slug = `${baseSlug}-${++n}`

  let pin = generatePin()
  while (await prisma.team.findUnique({ where: { pin } })) pin = generatePin()

  return prisma.team.create({
    data: {
      slug,
      pin,
      foulardName: (data.foulardName ?? '').slice(0, 60),
      unitName: (data.unitName ?? '').slice(0, 80),
      sectionName: (data.sectionName ?? '').slice(0, 60),
    },
  })
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Champs personnalisables d'une écurie (par elle-même via PIN, ou par la direction de course). */
export async function updateTeamProfile(teamId: string, body: Record<string, unknown>) {
  const data: Record<string, string> = {}
  for (const [field, maxLen] of [['unitName', 80], ['sectionName', 60], ['foulardName', 60], ['foulardEmoji', 16]] as const) {
    if (typeof body[field] === 'string') data[field] = (body[field] as string).trim().slice(0, maxLen)
  }
  if (typeof body.foulardColor === 'string' && COLOR_RE.test(body.foulardColor)) data.foulardColor = body.foulardColor
  if (data.foulardEmoji === '') delete data.foulardEmoji

  await prisma.team.update({ where: { id: teamId }, data })

  if (Array.isArray(body.bikes)) {
    for (const bike of body.bikes as { number?: unknown; name?: unknown }[]) {
      const number = Number(bike.number)
      if (!Number.isInteger(number) || typeof bike.name !== 'string') continue
      // updateMany + filtre teamId : une écurie ne renomme que SES vélos.
      await prisma.dossard.updateMany({ where: { number, teamId }, data: { name: bike.name.trim().slice(0, 40) } })
    }
  }
}

/** "1-2" → { contest: 1, category: 2 } ; "" → null partout ; undefined → rien. */
export function parseGroup(v: unknown): { contest?: number | null; category?: number | null } {
  if (v === undefined) return {}
  const m = String(v).match(/^(\d+)-(\d+)$/)
  return m ? { contest: Number(m[1]), category: Number(m[2]) } : { contest: null, category: null }
}
