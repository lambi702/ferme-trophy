'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/equipes', label: 'Équipes' },
  { href: '/admin/organisateurs', label: 'Organisateurs' },
  { href: '/admin/points', label: 'Points' },
  { href: '/admin/marketplace', label: 'Marketplace' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <nav className="flex flex-wrap items-center gap-2 mb-6">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`font-mono-race font-bold text-sm px-3 py-1.5 rounded-lg ${
            pathname === l.href ? 'bg-ft-red text-white' : 'card text-white/60'
          }`}
        >
          {l.label}
        </Link>
      ))}
      <button onClick={logout} className="ml-auto text-white/40 text-xs font-mono-race">Déconnexion</button>
    </nav>
  )
}
