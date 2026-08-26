/**
 * Process séparé, tourne en tâche de fond dans le même conteneur que
 * l'app Next.js (voir Dockerfile). Ingeste les passages du TimingAdapter
 * actif et les persiste en RaceLapEvent, normalisés, quelle que soit la
 * source réelle derrière l'interface.
 *
 * Pour brancher O'Top : remplacer l'import de MockTimingAdapter par le
 * futur OTopAdapter (même interface), rien d'autre à changer ici.
 */
import { prisma } from '../src/lib/prisma'
import { MockTimingAdapter } from '../src/lib/timing/mockAdapter'

const enabled = process.env.MOCK_TIMING_ENABLED !== 'false'

if (!enabled) {
  console.log('[timing-daemon] MOCK_TIMING_ENABLED=false — daemon inactif.')
} else {
  const adapter = new MockTimingAdapter(Number(process.env.MOCK_TIMING_INTERVAL_MS ?? 3000))
  console.log(`[timing-daemon] démarrage avec l'adaptateur "${adapter.name}"`)

  adapter.start(async (event) => {
    try {
      await prisma.raceLapEvent.create({
        data: {
          dossardNumber: event.dossardNumber,
          timestamp: event.timestamp,
          source: adapter.name,
        },
      })
    } catch (err) {
      console.error('[timing-daemon] erreur insertion RaceLapEvent', err)
    }
  })

  process.on('SIGTERM', () => {
    adapter.stop()
    process.exit(0)
  })
}
