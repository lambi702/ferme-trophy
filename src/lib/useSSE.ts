'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Se connecte en SSE, avec repli automatique sur du polling si EventSource
 * échoue ou n'est pas disponible (voir section 3 du handover).
 */
export function useSSE<T>(url: string, pollMs = 8000): { data: T | null; live: boolean } {
  const [data, setData] = useState<T | null>(null)
  const [live, setLive] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let es: EventSource | null = null
    let cancelled = false

    const startPolling = () => {
      if (pollRef.current) return
      setLive(false)
      const poll = async () => {
        try {
          const res = await fetch(url.replace('/stream', ''))
          if (res.ok) setData(await res.json())
        } catch {
          /* ignore, on réessaiera au prochain tick */
        }
      }
      poll()
      pollRef.current = setInterval(poll, pollMs)
    }

    try {
      es = new EventSource(url)
      es.onmessage = (event) => {
        if (cancelled) return
        setLive(true)
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        setData(JSON.parse(event.data))
      }
      es.onerror = () => {
        es?.close()
        if (!cancelled) startPolling()
      }
    } catch {
      startPolling()
    }

    return () => {
      cancelled = true
      es?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [url, pollMs])

  return { data, live }
}
