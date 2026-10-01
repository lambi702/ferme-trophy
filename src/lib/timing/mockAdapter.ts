import type { TimingAdapter } from './adapter'
import { prisma } from '@/lib/prisma'

/**
 * Génère des passages simulés pour les dossards assignés à une écurie.
 * UNIQUEMENT pour la démo/les tests — à laisser sur "off" le jour J
 * (sinon de faux tours s'ajoutent aux vrais).
 */
export class MockTimingAdapter implements TimingAdapter {
  readonly name = 'mock'
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private tickMs = 3000) {}

  start() {
    this.timer = setInterval(async () => {
      try {
        const dossards = await prisma.dossard.findMany({ where: { teamId: { not: null } }, select: { number: true } })
        if (dossards.length === 0) return
        // Un sous-ensemble aléatoire "boucle" à chaque tick, pas tous en même temps.
        const shuffled = [...dossards].sort(() => Math.random() - 0.5)
        const count = Math.max(1, Math.floor(dossards.length * 0.15))
        const now = new Date()
        await prisma.raceLapEvent.createMany({
          data: shuffled.slice(0, count).map((d) => ({ dossardNumber: d.number, timestamp: now, source: this.name })),
        })
      } catch (err) {
        console.error('[mock] erreur', err)
      }
    }, this.tickMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
