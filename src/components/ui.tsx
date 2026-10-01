'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { FeedItem, LiveRace } from '@/lib/live-types'
import { racePhase, relTime, signed, textOn } from '@/lib/format'
import { useNow } from '@/lib/useLive'

/** Plaque de dossard façon F1 : numéro sur la couleur de l'écurie. */
export function NumberPlate({ number, color, className = '' }: { number: number; color: string; className?: string }) {
  return (
    <span
      className={`inline-flex min-w-[2.6em] items-center justify-center rounded-md px-1.5 font-mono-race tnum leading-none ${className}`}
      style={{ backgroundColor: color, color: textOn(color), paddingTop: '0.3em', paddingBottom: '0.22em' }}
    >
      {number}
    </span>
  )
}

export function TeamBadge({ emoji, color, size = 40 }: { emoji: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size, height: size, fontSize: size * 0.52,
        background: `radial-gradient(circle at 30% 25%, ${color}55, ${color}18 70%)`,
        boxShadow: `inset 0 0 0 2px ${color}`,
      }}
    >
      {emoji}
    </span>
  )
}

export function LiveDot({ live, stale }: { live: boolean; stale?: boolean }) {
  if (stale) return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/50">Hors ligne</span>
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${live ? 'bg-ft-red/15 text-ft-red2' : 'bg-white/10 text-white/50'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${live ? 'pulse-dot bg-ft-red2' : 'bg-white/40'}`} />
      {live ? 'Live' : 'Sync'}
    </span>
  )
}

export function RaceClock({ race, className = '' }: { race?: LiveRace; className?: string }) {
  const now = useNow(1000)
  const p = racePhase(race, now)
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{p.label}</span>
      <span className={`font-mono-race tnum text-lg ${p.phase === 'finished' ? 'text-ft-gold' : 'text-white'}`}>
        {p.phase === 'finished' ? '🏁 ' : ''}{p.value}
      </span>
    </div>
  )
}

export function Medal({ rank, className = '' }: { rank: number; className?: string }) {
  const styles: Record<number, string> = {
    1: 'bg-gradient-to-b from-[#ffe46b] to-[#c9a400] text-black',
    2: 'bg-gradient-to-b from-[#f0f0f3] to-[#9a9aa2] text-black',
    3: 'bg-gradient-to-b from-[#e7a26a] to-[#9a5a2a] text-black',
  }
  return (
    <span className={`inline-flex items-center justify-center rounded-lg font-mono-race tnum ${styles[rank] ?? 'bg-white/[0.06] text-white/80'} ${className}`}>
      {rank}
    </span>
  )
}

// --- Fil d'actu ------------------------------------------------------------

const FEED_STYLE: Record<FeedItem['kind'], { icon: string; tint: string }> = {
  points: { icon: '⭐', tint: 'text-ft-gold' },
  bonus: { icon: '🟢', tint: 'text-ft-green' },
  malus: { icon: '🔴', tint: 'text-ft-red2' },
  correction: { icon: '🏳️', tint: 'text-white/70' },
}

export function feedSentence(item: FeedItem) {
  const bikeName = item.bike ? `#${item.bike.number}${item.bike.name ? ` « ${item.bike.name} »` : ''}` : ''
  switch (item.kind) {
    case 'points':
      return { title: item.team?.name ?? '?', detail: `${item.label}` }
    case 'bonus':
      return { title: `${item.team?.name} s'offre ${signed(item.lapDelta ?? 0)} tour${Math.abs(item.lapDelta ?? 0) > 1 ? 's' : ''}`, detail: `sur ${bikeName} · ${item.label}` }
    case 'malus':
      return { title: `${item.team?.name} frappe ${bikeName}`, detail: `${signed(item.lapDelta ?? 0)} tour${Math.abs(item.lapDelta ?? 0) > 1 ? 's' : ''} pour ${item.bike?.teamName} · ${item.label}` }
    case 'correction':
      return { title: `Direction de course : ${bikeName}`, detail: `${signed(item.lapDelta ?? 0)} tour · ${item.label}` }
  }
}

export function FeedRow({
  item, now, onUndo, showBy = false, compact = false, fresh = false, perspectiveTeamId,
}: {
  item: FeedItem & { cancelled?: boolean }
  now: number
  onUndo?: () => void
  showBy?: boolean
  compact?: boolean
  fresh?: boolean
  /** Sur la page d'une écurie : ne pas afficher le coût payé par l'ADVERSAIRE pour un malus subi. */
  perspectiveTeamId?: string
}) {
  const showPoints = item.points !== undefined && item.points !== 0 && (!perspectiveTeamId || item.team?.id === perspectiveTeamId)
  const style = FEED_STYLE[item.kind]
  const { title, detail } = feedSentence(item)
  const emoji = item.kind === 'points' ? item.team?.emoji : item.kind === 'correction' ? item.bike?.teamEmoji : item.team?.emoji
  return (
    <div className={`flex items-center gap-3 rounded-xl ${compact ? 'px-2 py-2' : 'card-2 px-3 py-2.5'} ${item.cancelled ? 'opacity-40' : ''} ${fresh ? 'feed-in' : ''}`}>
      <span className="text-lg leading-none">{emoji ?? style.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${item.cancelled ? 'line-through' : ''}`}>{title}</p>
        <p className="truncate text-xs text-white/45">
          {detail}
          {showBy && item.by ? ` · par ${item.by}` : ''} · {relTime(item.at, now)}
          {item.cancelled ? ' · annulé' : ''}
        </p>
      </div>
      {showPoints && item.points !== undefined && (
        <span className={`font-mono-race tnum text-lg ${item.points > 0 ? 'text-ft-gold' : 'text-white/50'}`}>
          {signed(item.points)}<span className="text-xs"> pts</span>
        </span>
      )}
      {item.kind !== 'points' && item.lapDelta !== undefined && (
        <span className={`font-mono-race tnum text-lg ${style.tint}`}>{signed(item.lapDelta)}<span className="text-xs"> T</span></span>
      )}
      {onUndo && !item.cancelled && (
        <button onClick={onUndo} className="rounded-lg border border-white/10 px-2 py-1 text-xs font-bold text-white/60 hover:border-ft-red hover:text-white">
          Annuler
        </button>
      )}
    </div>
  )
}

// --- Toast -----------------------------------------------------------------

type ToastState = { id: number; message: string; kind: 'ok' | 'error'; action?: { label: string; run: () => void } } | null

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, kind: 'ok' | 'error' = 'ok', action?: { label: string; run: () => void }) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ id: Date.now(), message, kind, action })
    timer.current = setTimeout(() => setToast(null), action ? 9000 : 3500)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const node = toast ? (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div
        key={toast.id}
        className={`slide-up pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl ${
          toast.kind === 'ok' ? 'bg-white text-black' : 'bg-ft-red text-white'
        }`}
      >
        <span className="text-sm font-bold">{toast.message}</span>
        {toast.action && (
          <button
            onClick={() => { toast.action?.run(); setToast(null) }}
            className="rounded-lg bg-black/10 px-3 py-1.5 text-sm font-bold underline-offset-2 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  ) : null

  return { show, node }
}

// --- Divers ----------------------------------------------------------------

export function Empty({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-3 text-4xl opacity-80">{icon}</span>
      <p className="font-mono-race text-lg text-white/80">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-white/40">{hint}</p>}
    </div>
  )
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-white/40">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-ft-red" />
      {label}
    </div>
  )
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-white/50 hover:text-white">
      ← {label}
    </Link>
  )
}

export async function api<T = unknown>(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  let data: T & { error?: string }
  try {
    data = await res.json()
  } catch {
    data = { error: `Erreur ${res.status}` } as T & { error?: string }
  }
  return { ok: res.ok, data }
}
