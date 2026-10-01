import { randomBytes } from 'node:crypto'
import { prisma } from './prisma'

/**
 * Réglages modifiables à chaud depuis /admin (table Setting, clé → JSON).
 * Lus à la fois par Next.js et par le daemon de chronométrage — changer le
 * mode chrono ou l'URL RaceResult ne demande AUCUN redéploiement.
 */

export type TimingMode = 'off' | 'mock' | 'poll'
export type TimingDataMode = 'auto' | 'passings' | 'counts'

export type TimingConfig = {
  /** Ce que fait le daemon : rien, simulation, ou interrogation périodique d'une URL RaceResult. */
  mode: TimingMode
  /** URL à interroger en mode "poll" (Simple API RaceResult, liste publiée, CSV...). */
  pollUrl: string
  pollIntervalSec: number
  /** Réception des passages poussés par le serveur RaceResult (Exporter HTTP). */
  pushEnabled: boolean
  pushToken: string
  /** auto = "laps" présent → compteur absolu, sinon → un passage = un tour. */
  dataMode: TimingDataMode
  /** Deux passages du même dossard plus rapprochés que ça = doublon de lecture, ignoré. */
  minLapSeconds: number
  /** Noms de colonnes forcés si l'auto-détection ne suffit pas (vide = auto). */
  bibField: string
  lapsField: string
  timeField: string
  idField: string
  mockIntervalMs: number
}

export type TimingStatus = {
  lastPollAt?: string
  lastPollOk?: boolean
  lastPollError?: string
  lastPollSummary?: string
  lastPushAt?: string
  lastPushSummary?: string
  lastPushError?: string
}

export type RaceConfig = {
  title: string
  /** ISO — null tant que le départ n'est pas donné. */
  startedAt: string | null
  durationMin: number
  finishedAt: string | null
}

const DEFAULT_TIMING: Omit<TimingConfig, 'pushToken'> = {
  mode: 'off',
  pollUrl: '',
  pollIntervalSec: 10,
  pushEnabled: true,
  dataMode: 'auto',
  minLapSeconds: 20,
  bibField: '',
  lapsField: '',
  timeField: '',
  idField: '',
  mockIntervalMs: 3000,
}

const DEFAULT_RACE: RaceConfig = {
  title: 'Ferme Trophy 2026',
  startedAt: null,
  durationMin: 240,
  finishedAt: null,
}

export function newPushToken() {
  return randomBytes(16).toString('hex')
}

async function readSetting<T>(key: string): Promise<Partial<T> | null> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return (row?.value as Partial<T>) ?? null
}

async function writeSetting(key: string, value: object) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
}

export async function getTimingConfig(): Promise<TimingConfig> {
  const stored = await readSetting<TimingConfig>('timing')
  const cfg = { ...DEFAULT_TIMING, ...(stored ?? {}) } as TimingConfig
  if (!cfg.pushToken) {
    // Généré une fois, à la première lecture — c'est le "mot de passe" de l'URL de push.
    cfg.pushToken = newPushToken()
    await writeSetting('timing', cfg)
  }
  return cfg
}

export async function updateTimingConfig(patch: Partial<TimingConfig>): Promise<TimingConfig> {
  const current = await getTimingConfig()
  const next: TimingConfig = { ...current }
  if (patch.mode && ['off', 'mock', 'poll'].includes(patch.mode)) next.mode = patch.mode
  if (patch.dataMode && ['auto', 'passings', 'counts'].includes(patch.dataMode)) next.dataMode = patch.dataMode
  if (typeof patch.pollUrl === 'string') next.pollUrl = patch.pollUrl.trim().slice(0, 1000)
  if (patch.pollIntervalSec !== undefined) next.pollIntervalSec = clamp(Number(patch.pollIntervalSec), 2, 600, 10)
  if (patch.minLapSeconds !== undefined) next.minLapSeconds = clamp(Number(patch.minLapSeconds), 0, 3600, 20)
  if (patch.mockIntervalMs !== undefined) next.mockIntervalMs = clamp(Number(patch.mockIntervalMs), 500, 60000, 3000)
  if (typeof patch.pushEnabled === 'boolean') next.pushEnabled = patch.pushEnabled
  if (typeof patch.pushToken === 'string' && patch.pushToken.length >= 16) next.pushToken = patch.pushToken
  for (const f of ['bibField', 'lapsField', 'timeField', 'idField'] as const) {
    if (typeof patch[f] === 'string') next[f] = (patch[f] as string).trim().slice(0, 80)
  }
  await writeSetting('timing', next)
  return next
}

export async function getTimingStatus(): Promise<TimingStatus> {
  return (await readSetting<TimingStatus>('timingStatus')) ?? {}
}

export async function patchTimingStatus(patch: TimingStatus) {
  const current = await getTimingStatus()
  await writeSetting('timingStatus', { ...current, ...patch })
}

export async function getRaceConfig(): Promise<RaceConfig> {
  return { ...DEFAULT_RACE, ...((await readSetting<RaceConfig>('race')) ?? {}) }
}

export async function updateRaceConfig(patch: Partial<RaceConfig>): Promise<RaceConfig> {
  const next = { ...(await getRaceConfig()) }
  if (typeof patch.title === 'string') next.title = patch.title.trim().slice(0, 80) || DEFAULT_RACE.title
  if (patch.durationMin !== undefined) next.durationMin = clamp(Number(patch.durationMin), 0, 24 * 60, 240)
  if (patch.startedAt !== undefined) next.startedAt = patch.startedAt ? new Date(patch.startedAt).toISOString() : null
  if (patch.finishedAt !== undefined) next.finishedAt = patch.finishedAt ? new Date(patch.finishedAt).toISOString() : null
  await writeSetting('race', next)
  return next
}

function clamp(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
