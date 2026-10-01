'use client'

import { useEffect, useRef, useState } from 'react'
import type { LiveState } from './live-types'

/**
 * État live partagé (classement vélos + écuries + fil d'actu) : SSE sur
 * /api/live/stream, repli automatique sur du polling de /api/live si
 * EventSource échoue (proxy, réseau mobile capricieux...). Reconnexion SSE
 * retentée périodiquement.
 */
export function useLive(pollMs = 5000): { data: LiveState | null; live: boolean; stale: boolean } {
  const [data, setData] = useState<LiveState | null>(null)
  const [live, setLive] = useState(false)
  const [lastAt, setLastAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    let cancelled = false
    let retry: ReturnType<typeof setTimeout> | null = null

    const accept = (state: LiveState) => {
      if (cancelled) return
      setData(state)
      setLastAt(Date.now())
    }
    const poll = async () => {
      try {
        const res = await fetch('/api/live', { cache: 'no-store' })
        if (res.ok) accept(await res.json())
      } catch { /* prochain tick */ }
    }
    const startPolling = () => {
      setLive(false)
      if (pollRef.current) return
      poll()
      pollRef.current = setInterval(poll, pollMs)
    }
    const stopPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
    const connect = () => {
      if (cancelled) return
      try {
        es = new EventSource('/api/live/stream')
        es.onmessage = (event) => {
          setLive(true)
          stopPolling()
          accept(JSON.parse(event.data))
        }
        es.onerror = () => {
          es?.close()
          startPolling()
          retry = setTimeout(connect, 15000)
        }
      } catch {
        startPolling()
      }
    }
    connect()
    const tick = setInterval(() => setNow(Date.now()), 5000)

    return () => {
      cancelled = true
      es?.close()
      stopPolling()
      if (retry) clearTimeout(retry)
      clearInterval(tick)
    }
  }, [pollMs])

  return { data, live, stale: lastAt > 0 && now - lastAt > 30000 }
}

/** Re-render toutes les `ms` (horloges, "il y a 2 min"). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Mémorise "mon écurie" sur ce téléphone (simple confort, rien de sensible). */
export function useMyTeam(): [string | null, (slug: string | null) => void] {
  const [slug, setSlug] = useState<string | null>(null)
  useEffect(() => {
    try { setSlug(localStorage.getItem('ft_my_team')) } catch { /* navigation privée */ }
  }, [])
  const update = (next: string | null) => {
    setSlug(next)
    try {
      if (next) localStorage.setItem('ft_my_team', next)
      else localStorage.removeItem('ft_my_team')
    } catch { /* ignore */ }
  }
  return [slug, update]
}
