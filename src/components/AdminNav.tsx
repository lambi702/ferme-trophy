'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/chrono', label: '⏱️ Chrono' },
  { href: '/admin/course', label: '🏁 Course' },
  { href: '/admin/equipes', label: '🏎️ Écuries' },
  { href: '/admin/points', label: '📜 Historique' },
  { href: '/admin/marketplace', label: '🛒 Catalogue' },
  { href: '/admin/organisateurs', label: '🎮 Organisateurs' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <nav className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono-race text-sm tracking-[0.2em] text-ft-red">COMITÉ · FERME TROPHY</p>
        <div className="flex gap-4 text-xs text-white/40">
          <Link href="/organisateur" className="hover:text-white">🎮 Direction de course</Link>
          <Link href="/ecran" className="hover:text-white">📺 Écran</Link>
          <button onClick={logout} className="hover:text-white">Déconnexion</button>
        </div>
      </div>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition ${
              pathname === l.href ? 'bg-white text-black' : 'bg-white/[0.05] text-white/60 hover:bg-white/10'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
