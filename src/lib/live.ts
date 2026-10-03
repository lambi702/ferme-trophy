import { prisma } from './prisma'
import { getRaceConfig } from './settings'
import { categoryName, contestName, groupKey, teamDisplayName, type FeedItem, type LiveBike, type LiveContest, type LiveState, type LiveTeam } from './live-types'

/**
 * État live complet, recalculé à la volée (aucun solde stocké) depuis
 * RaceLapEvent / RaceAdjustment / PointsTransaction / Purchase.
 *
 * - Classement COURSE = par vélo (dossard) : passages chrono + ajustements.
 * - Classement POINTS = par écurie : gagnés (mini-jeux) − dépensés (achats).
 * Les lignes annulées (cancelledAt) sont exclues partout.
 *
 * Mis en cache ~1,5 s : avec 100 téléphones + l'écran géant branchés en SSE,
 * on recalcule une fois par tick, pas une fois par client.
 */
// Sur globalThis : garanti partagé entre toutes les routes du process Next.js.
const g = globalThis as unknown as { __ftLiveCache?: { at: number; promise: Promise<LiveState> } | null }

export function getLiveState(): Promise<LiveState> {
  const now = Date.now()
  const cache = g.__ftLiveCache
  if (cache && now - cache.at < 1500) return cache.promise
  const promise = computeLiveState()
  g.__ftLiveCache = { at: now, promise }
  promise.catch(() => { g.__ftLiveCache = null })
  return promise
}

/** À appeler après une écriture pour que le prochain tick reflète le changement. */
export function invalidateLive() {
  g.__ftLiveCache = null
}

async function computeLiveState(): Promise<LiveState> {
  const [teams, lapCounts, adjustments, earned, spent, race, catalog] = await Promise.all([
    prisma.team.findMany({ include: { dossards: true }, orderBy: { createdAt: 'asc' } }),
    prisma.raceLapEvent.groupBy({ by: ['dossardNumber'], _count: { _all: true }, _max: { timestamp: true } }),
    prisma.raceAdjustment.groupBy({ by: ['dossardId'], _sum: { lapDelta: true } }),
    prisma.pointsTransaction.groupBy({ by: ['teamId'], where: { cancelledAt: null }, _sum: { points: true } }),
    prisma.purchase.groupBy({ by: ['buyingTeamId'], where: { cancelledAt: null }, _sum: { costPoints: true } }),
    getRaceConfig(),
    prisma.marketplaceItem.findMany({ where: { active: true }, orderBy: [{ type: 'asc' }, { costPoints: 'asc' }] }),
  ])

  const lapsByNumber = new Map(lapCounts.map((l) => [l.dossardNumber, { count: l._count._all, last: l._max.timestamp }]))
  const adjByDossard = new Map(adjustments.map((a) => [a.dossardId, a._sum.lapDelta ?? 0]))
  const earnedByTeam = new Map(earned.map((e) => [e.teamId, e._sum.points ?? 0]))
  const spentByTeam = new Map(spent.map((s) => [s.buyingTeamId, s._sum.costPoints ?? 0]))

  const bikes: LiveBike[] = []
  for (const team of teams) {
    const numbers = team.dossards.map((d) => d.number).sort((a, b) => a - b)
    for (const d of team.dossards) {
      const lap = lapsByNumber.get(d.number)
      const adjustment = adjByDossard.get(d.id) ?? 0
      const rawLaps = lap?.count ?? 0
      bikes.push({
        dossardId: d.id,
        number: d.number,
        name: d.name,
        teamId: team.id,
        teamSlug: team.slug,
        teamName: teamDisplayName(team, numbers),
        teamColor: team.foulardColor,
        teamEmoji: team.foulardEmoji,
        rawLaps,
        adjustment,
        laps: rawLaps + adjustment,
        rank: 0,
        gap: 0,
        contest: d.contest,
        category: d.category,
        group: groupKey(d.contest, d.category),
        lastLapAt: lap?.last ? lap.last.toISOString() : null,
      })
    }
  }

  // Classement PAR ÉPREUVE (contests RaceResult : ex. Guides/Scouts vs Lutins/Louveteaux),
  // épreuves dans l'ordre (sans épreuve à la fin). Égalité de tours : devant = celui
  // qui a bouclé ce tour le plus tôt.
  const contestOrder = (c: number | null) => (c === null ? Number.MAX_SAFE_INTEGER : c)
  bikes.sort((a, b) => {
    if (a.contest !== b.contest) return contestOrder(a.contest) - contestOrder(b.contest)
    if (a.category !== b.category) return contestOrder(a.category) - contestOrder(b.category)
    if (b.laps !== a.laps) return b.laps - a.laps
    if (a.lastLapAt && b.lastLapAt && a.lastLapAt !== b.lastLapAt) return a.lastLapAt < b.lastLapAt ? -1 : 1
    if (a.lastLapAt && !b.lastLapAt) return -1
    if (!a.lastLapAt && b.lastLapAt) return 1
    return a.number - b.number
  })
  const contests: LiveContest[] = []
  for (const b of bikes) {
    let c = contests[contests.length - 1]
    if (!c || c.key !== b.group) {
      const cn = contestName(race.contestNames, b.contest)
      const kn = categoryName(race.categoryNames, b.contest, b.category)
      c = {
        key: b.group, contest: b.contest, category: b.category, contestName: cn, categoryName: kn,
        name: [cn, kn].filter(Boolean).join(' · ') || 'Course', bikes: 0, leaderLaps: b.laps,
      }
      contests.push(c)
    }
    c.bikes++
    b.rank = c.bikes
    b.gap = c.leaderLaps - b.laps
  }

  const liveTeams: LiveTeam[] = teams.map((team) => {
    const numbers = team.dossards.map((d) => d.number).sort((a, b) => a - b)
    const myBikes = bikes.filter((b) => b.teamId === team.id)
    const e = earnedByTeam.get(team.id) ?? 0
    const s = spentByTeam.get(team.id) ?? 0
    return {
      id: team.id,
      slug: team.slug,
      name: teamDisplayName(team, numbers),
      unitName: team.unitName,
      sectionName: team.sectionName,
      color: team.foulardColor,
      emoji: team.foulardEmoji,
      points: e - s,
      earned: e,
      spent: s,
      totalLaps: myBikes.reduce((sum, b) => sum + b.laps, 0),
      bestRank: myBikes.length > 0 ? Math.min(...myBikes.map((b) => b.rank)) : null,
      contest: team.dossards.find((d) => d.contest !== null)?.contest ?? null,
      bikes: numbers,
      pointsRank: 0,
    }
  })
  liveTeams.sort((a, b) => b.points - a.points || b.totalLaps - a.totalLaps || a.name.localeCompare(b.name))
  liveTeams.forEach((t, i) => { t.pointsRank = i + 1 })

  const feed = await computeFeed({ limit: 25 })

  return {
    generatedAt: new Date().toISOString(),
    race: { title: race.title, startedAt: race.startedAt, durationMin: race.durationMin, finishedAt: race.finishedAt },
    contests,
    bikes,
    teams: liveTeams,
    feed,
    catalog: catalog.map((i) => ({
      id: i.id, name: i.name, description: i.description, costPoints: i.costPoints, type: i.type, lapEffect: i.lapEffect,
    })),
    totalLaps: bikes.reduce((sum, b) => sum + b.rawLaps, 0),
  }
}

type FeedOptions = { limit: number; teamId?: string; includeCancelled?: boolean }

/**
 * Fil d'actu fusionné : points crédités, achats bonus/malus, corrections
 * comité. `teamId` filtre sur ce qui concerne une écurie (reçu, acheté, subi).
 */
export async function computeFeed({ limit, teamId, includeCancelled = false }: FeedOptions): Promise<(FeedItem & { cancelled?: boolean })[]> {
  const cancelledFilter = includeCancelled ? {} : { cancelledAt: null }
  const [points, purchases, corrections] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where: { ...cancelledFilter, ...(teamId ? { teamId } : {}) },
      include: { team: { include: { dossards: { select: { number: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.purchase.findMany({
      where: {
        ...cancelledFilter,
        ...(teamId ? { OR: [{ buyingTeamId: teamId }, { targetDossard: { teamId } }] } : {}),
      },
      include: {
        buyingTeam: { include: { dossards: { select: { number: true } } } },
        targetDossard: { include: { team: { include: { dossards: { select: { number: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.raceAdjustment.findMany({
      where: { source: 'correction', ...(teamId ? { dossard: { teamId } } : {}) },
      include: { dossard: { include: { team: { include: { dossards: { select: { number: true } } } } } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  ])

  const teamRef = (t: { id: string; slug: string; foulardName: string; unitName: string; foulardEmoji: string; foulardColor: string; dossards: { number: number }[] }) => ({
    id: t.id,
    slug: t.slug,
    name: teamDisplayName(t, t.dossards.map((d) => d.number).sort((a, b) => a - b)),
    emoji: t.foulardEmoji,
    color: t.foulardColor,
  })
  type DossardWithTeam = { number: number; name: string; team: Parameters<typeof teamRef>[0] | null }
  const bikeRef = (d: DossardWithTeam) => ({
    number: d.number,
    name: d.name,
    teamName: d.team ? teamRef(d.team).name : 'sans écurie',
    teamEmoji: d.team?.foulardEmoji ?? '🏁',
    teamColor: d.team?.foulardColor ?? '#888888',
    teamSlug: d.team?.slug ?? '',
  })

  const items: (FeedItem & { cancelled?: boolean })[] = [
    ...points.map((p) => ({
      id: `pts_${p.id}`,
      kind: 'points' as const,
      at: p.createdAt.toISOString(),
      team: teamRef(p.team),
      points: p.points,
      label: p.reason,
      by: p.performedBy || undefined,
      cancelled: Boolean(p.cancelledAt),
    })),
    ...purchases.map((p) => ({
      id: `buy_${p.id}`,
      kind: (p.type === 'BONUS_SELF' ? 'bonus' : 'malus') as FeedItem['kind'],
      at: p.createdAt.toISOString(),
      team: teamRef(p.buyingTeam),
      bike: bikeRef(p.targetDossard),
      points: -p.costPoints,
      lapDelta: p.lapDelta,
      label: p.itemName,
      by: p.performedBy || undefined,
      cancelled: Boolean(p.cancelledAt),
    })),
    ...corrections.map((c) => ({
      id: `adj_${c.id}`,
      kind: 'correction' as const,
      at: c.createdAt.toISOString(),
      bike: bikeRef(c.dossard),
      lapDelta: c.lapDelta,
      label: c.reason || 'Correction de la direction de course',
      by: c.performedBy || undefined,
    })),
  ]
  items.sort((a, b) => (a.at < b.at ? 1 : -1))
  return items.slice(0, limit)
}

export async function getTeamPointsBalance(teamId: string): Promise<number> {
  const [earned, spent] = await Promise.all([
    prisma.pointsTransaction.aggregate({ where: { teamId, cancelledAt: null }, _sum: { points: true } }),
    prisma.purchase.aggregate({ where: { buyingTeamId: teamId, cancelledAt: null }, _sum: { costPoints: true } }),
  ])
  return (earned._sum.points ?? 0) - (spent._sum.costPoints ?? 0)
}
