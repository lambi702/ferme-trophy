import type { TimingAdapter, NormalizedLapEvent } from './adapter'
import { prisma } from '@/lib/prisma'

/**
 * Génère des passages de tours simulés pour chaque dossard actuellement
 * assigné à une équipe. Sert au développement et à la démo tant que les
 * specs O'Top ne sont pas connues (voir section 7.3 du handover).
 *
 * Intervalle volontairement rapide (quelques secondes) pour que le
 * leaderboard bouge visiblement pendant une démo live — une vraie course de
 * 4h aurait un rythme bien plus lent par dossard.
 */
export class MockTimingAdapter implements TimingAdapter {
  readonly name = 'mock'
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private tickMs = 3000) {}

  start(onEvent: (event: NormalizedLapEvent) => void | Promise<void>) {
    this.timer = setInterval(async () => {
      const dossards = await prisma.dossard.findMany({
        where: { teamId: { not: null } },
        select: { number: true },
      })
      if (dossards.length === 0) return
      // Un sous-ensemble aléatoire de dossards "boucle" à chaque tick, pas tous en même temps.
      const shuffled = [...dossards].sort(() => Math.random() - 0.5)
      const count = Math.max(1, Math.floor(dossards.length * 0.15))
      for (const d of shuffled.slice(0, count)) {
        await onEvent({ dossardNumber: d.number, timestamp: new Date() })
      }
    }, this.tickMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
