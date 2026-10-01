import type { LiveRace } from './live-types'

export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 10) return "à l'instant"
  if (s < 60) return `il y a ${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return `il y a ${h} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

export function hms(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export type RacePhase =
  | { phase: 'pre'; label: string; value: string }
  | { phase: 'running'; label: string; value: string; progress: number | null }
  | { phase: 'finished'; label: string; value: string }

/** Ce que l'horloge de course doit afficher, à l'instant `now`. */
export function racePhase(race: LiveRace | undefined, now = Date.now()): RacePhase {
  if (!race?.startedAt) return { phase: 'pre', label: 'Départ', value: 'Bientôt' }
  const start = new Date(race.startedAt).getTime()
  if (start > now) return { phase: 'pre', label: 'Départ dans', value: hms((start - now) / 1000) }
  const end = race.durationMin > 0 ? start + race.durationMin * 60000 : null
  if (race.finishedAt || (end && now >= end)) return { phase: 'finished', label: 'Course', value: 'Terminée' }
  if (end) return { phase: 'running', label: 'Restant', value: hms((end - now) / 1000), progress: (now - start) / (end - start) }
  return { phase: 'running', label: 'Écoulé', value: hms((now - start) / 1000), progress: null }
}

/** Texte noir ou blanc selon la couleur de fond (couleurs d'écurie libres). */
export function textOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#fff'
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000' : '#fff'
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${Math.abs(n) > 1 ? many : one}`

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
