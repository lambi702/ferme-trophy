// Types partagés client/serveur de l'état "live" (classement vélos, écuries,
// fil d'actu). Un seul flux pour l'écran géant, la page publique et les
// pages écurie — voir src/lib/live.ts.

export type LiveBike = {
  dossardId: string
  number: number
  name: string
  teamId: string
  teamSlug: string
  teamName: string
  teamColor: string
  teamEmoji: string
  rawLaps: number
  adjustment: number
  laps: number
  rank: number
  /** Tours de retard sur le leader (0 pour le leader). */
  gap: number
  lastLapAt: string | null
}

export type LiveTeam = {
  id: string
  slug: string
  name: string
  unitName: string
  sectionName: string
  color: string
  emoji: string
  points: number
  earned: number
  spent: number
  totalLaps: number
  bestRank: number | null
  bikes: number[]
  pointsRank: number
}

export type FeedKind = 'points' | 'bonus' | 'malus' | 'correction'

export type FeedItem = {
  id: string
  kind: FeedKind
  at: string
  /** Écurie à l'origine (points reçus / acheteur). */
  team?: { id: string; slug: string; name: string; emoji: string; color: string }
  /** Vélo visé (bonus/malus/correction). */
  bike?: { number: number; name: string; teamName: string; teamEmoji: string; teamColor: string; teamSlug: string }
  points?: number
  lapDelta?: number
  label: string
  by?: string
}

export type LiveItem = {
  id: string
  name: string
  description: string
  costPoints: number
  type: 'BONUS_SELF' | 'MALUS_OTHER'
  lapEffect: number
}

export type LiveRace = {
  title: string
  startedAt: string | null
  durationMin: number
  finishedAt: string | null
}

export type LiveState = {
  generatedAt: string
  race: LiveRace
  bikes: LiveBike[]
  teams: LiveTeam[]
  feed: FeedItem[]
  catalog: LiveItem[]
  totalLaps: number
}

export function teamDisplayName(t: { foulardName?: string; unitName?: string; name?: string }, bikes: number[] = []) {
  if (t.foulardName) return t.foulardName
  if (t.unitName) return t.unitName
  if (bikes.length > 0) return `Écurie #${bikes[0]}`
  return 'Écurie sans nom'
}

export function bikeLabel(b: { name: string; number: number }) {
  return b.name || `Vélo #${b.number}`
}
