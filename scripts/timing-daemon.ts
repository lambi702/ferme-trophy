/**
 * Process séparé, lancé en tâche de fond dans le même conteneur que Next.js
 * (voir docker-entrypoint.sh). Superviseur : relit la config chrono en base
 * toutes les 5 s (table Setting, modifiable depuis /admin/chrono) et démarre
 * / arrête l'adaptateur correspondant — off, simulation, ou poll RaceResult.
 *
 * Le push RaceResult (Exporter HTTP) n'a pas besoin du daemon : il arrive
 * directement sur la route /api/timing/push/<token>.
 */
import { getTimingConfig } from '../src/lib/settings'
import type { TimingAdapter } from '../src/lib/timing/adapter'
import { MockTimingAdapter } from '../src/lib/timing/mockAdapter'
import { RaceResultPollAdapter } from '../src/lib/timing/raceResultPoll'

let current: { key: string; adapter: TimingAdapter | null } = { key: '', adapter: null }

async function supervise() {
  try {
    const cfg = await getTimingConfig()
    const key = cfg.mode === 'poll'
      ? JSON.stringify(['poll', cfg.pollUrl, cfg.pollIntervalSec, cfg.dataMode, cfg.minLapSeconds, cfg.bibField, cfg.lapsField, cfg.timeField, cfg.idField])
      : cfg.mode === 'mock' ? `mock:${cfg.mockIntervalMs}` : 'off'
    if (key === current.key) return

    current.adapter?.stop()
    let adapter: TimingAdapter | null = null
    if (cfg.mode === 'mock') adapter = new MockTimingAdapter(cfg.mockIntervalMs)
    if (cfg.mode === 'poll' && cfg.pollUrl) adapter = new RaceResultPollAdapter(cfg)
    adapter?.start()
    current = { key, adapter }
    console.log(`[timing-daemon] mode = ${cfg.mode}${adapter ? ` (adaptateur "${adapter.name}")` : ''}`)
  } catch (err) {
    console.error('[timing-daemon] erreur de supervision', err)
  }
}

supervise()
setInterval(supervise, 5000)

process.on('SIGTERM', () => {
  current.adapter?.stop()
  process.exit(0)
})
