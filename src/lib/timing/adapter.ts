/**
 * Interface unique que tout adaptateur de chronométrage doit respecter.
 * Le reste du système (classement course, calcul des tours) ne consomme
 * QUE des RaceLapEvent normalisés — jamais le format brut du prestataire.
 *
 * Pour brancher O'Top (ou tout autre prestataire) : implémenter cette
 * interface (probablement un poller REST ou un import périodique), et
 * l'enregistrer à la place de MockTimingAdapter dans le point d'entrée du
 * daemon. Rien d'autre dans le code ne doit changer.
 */
export interface NormalizedLapEvent {
  dossardNumber: number
  timestamp: Date
}

export interface TimingAdapter {
  /** Nom de la source, stocké tel quel dans RaceLapEvent.source. */
  readonly name: string
  /** Démarre l'ingestion en continu ; appelle `onEvent` pour chaque passage détecté. */
  start(onEvent: (event: NormalizedLapEvent) => void | Promise<void>): void
  stop(): void
}
