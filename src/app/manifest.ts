import type { MetadataRoute } from 'next'

// "Ajouter à l'écran d'accueil" sur les téléphones des participants.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ferme Trophy 2026',
    short_name: 'Ferme Trophy',
    description: 'Classement live, points des écuries et radio course — Ferme Trophy 2026, Embourg',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#0a0a0c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
