import type { TimingAdapter } from './adapter'
import type { TimingConfig } from '@/lib/settings'
import { patchTimingStatus } from '@/lib/settings'
import { parseTimingPayload } from './parse'
import { ingestRecords, summarize } from './ingest'

/**
 * Interroge périodiquement une URL RaceResult et ingère ce qu'elle renvoie.
 * Cas d'usage typiques (à confirmer avec O'Top) :
 *  - "Simple API" RaceResult : https://api.raceresult.com/<eventID>/<clé> —
 *    une liste avec au minimum [Bib] + nombre de tours (→ mode compteur), ou
 *    les données brutes de passage (→ mode passages).
 *  - n'importe quel export CSV/JSON accessible en HTTP.
 * Le format est auto-détecté (voir parse.ts) ; mapping forçable dans l'admin.
 */
export class RaceResultPollAdapter implements TimingAdapter {
  readonly name = 'raceresult-poll'
  private timer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  constructor(private cfg: TimingConfig) {}

  start() {
    this.stopped = false
    const loop = async () => {
      await this.pollOnce()
      if (!this.stopped) this.timer = setTimeout(loop, this.cfg.pollIntervalSec * 1000)
    }
    loop()
  }

  async pollOnce() {
    const at = new Date().toISOString()
    try {
      const res = await fetch(this.cfg.pollUrl, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json, text/csv, text/plain, */*' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const records = parseTimingPayload(text, res.headers.get('content-type') ?? '', this.cfg)
      if (records.length === 0) {
        // Une réponse vide ne doit JAMAIS effacer des tours : on ne touche à rien.
        await patchTimingStatus({ lastPollAt: at, lastPollOk: false, lastPollError: `Réponse sans dossard exploitable (${text.length} octets) : ${text.slice(0, 160)}` })
        return
      }
      const result = await ingestRecords(records, this.name, this.cfg)
      await patchTimingStatus({ lastPollAt: at, lastPollOk: true, lastPollError: '', lastPollSummary: summarize(result) })
    } catch (err) {
      await patchTimingStatus({ lastPollAt: at, lastPollOk: false, lastPollError: String((err as Error).message ?? err) }).catch(() => {})
    }
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}
