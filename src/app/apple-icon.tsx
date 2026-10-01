import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Icône "écran d'accueil" iOS : damier blanc/noir sur rouge F1 (pas d'emoji → aucun fetch externe).
export default function AppleIcon() {
  const cells = Array.from({ length: 16 }, (_, i) => ((Math.floor(i / 4) + i) % 2 === 0 ? '#ffffff' : '#0a0a0c'))
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#e10600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 104, height: 104, display: 'flex', flexWrap: 'wrap' }}>
          {cells.map((c, i) => <div key={i} style={{ width: 26, height: 26, background: c }} />)}
        </div>
      </div>
    ),
    size,
  )
}
