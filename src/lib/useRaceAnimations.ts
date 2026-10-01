'use client'

import { useEffect, useRef, useState } from 'react'
import type { LiveBike } from './live-types'

/**
 * Détecte, d'un état live à l'autre : les vélos qui viennent de boucler un
 * tour (flash) et ceux qui ont gagné/perdu des places (▲/▼ pendant 10 s).
 * Rien au premier chargement — on n'anime que les vrais changements.
 */
export function useRaceAnimations(bikes: LiveBike[] | undefined) {
  const prev = useRef<Map<number, { laps: number; rank: number }> | null>(null)
  const [flash, setFlash] = useState<Map<number, number>>(new Map())
  const [moves, setMoves] = useState<Map<number, { delta: number; at: number }>>(new Map())

  useEffect(() => {
    if (!bikes) return
    const now = Date.now()
    if (prev.current) {
      const nextFlash = new Map(flash)
      const nextMoves = new Map([...moves].filter(([, m]) => now - m.at < 10000))
      for (const b of bikes) {
        const before = prev.current.get(b.number)
        if (!before) continue
        if (b.laps > before.laps) nextFlash.set(b.number, now)
        if (b.rank !== before.rank) nextMoves.set(b.number, { delta: before.rank - b.rank, at: now })
      }
      setFlash(nextFlash)
      setMoves(nextMoves)
    }
    prev.current = new Map(bikes.map((b) => [b.number, { laps: b.laps, rank: b.rank }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bikes])

  const now = Date.now()
  return {
    flashKey: (n: number) => flash.get(n) ?? 0,
    move: (n: number) => {
      const m = moves.get(n)
      return m && now - m.at < 10000 ? m.delta : 0
    },
  }
}
