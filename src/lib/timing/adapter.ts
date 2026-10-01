/**
 * Contrat d'un adaptateur de chronométrage "actif" (qui va chercher ou
 * génère les données lui-même, dans le daemon). Toutes les données passent
 * ensuite par `ingestRecords()` (./ingest.ts) — le reste du système ne
 * consomme QUE des RaceLapEvent normalisés.
 *
 * Adaptateurs disponibles (choisis à chaud depuis /admin/chrono, table Setting) :
 * - MockTimingAdapter          : simulation pour démo/tests
 * - RaceResultPollAdapter      : interroge une URL RaceResult (Simple API, liste...)
 * Le mode "push" (Exporter HTTP RaceResult → /api/timing/push/<token>) ne
 * passe pas par le daemon : c'est une route Next.js.
 */
export interface TimingAdapter {
  /** Nom de la source, stocké tel quel dans RaceLapEvent.source. */
  readonly name: string
  start(): void
  stop(): void
}
