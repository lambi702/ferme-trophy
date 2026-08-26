'use client'

import AdminGate from '@/components/AdminGate'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'

export default function AdminDashboard() {
  return (
    <AdminGate>
      {(admin) => (
        <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
          <AdminNav />
          <h1 className="font-mono-race text-2xl font-bold mb-1">Bonjour {admin.displayName} 👋</h1>
          <p className="text-white/40 mb-6">Comité d'organisation — Ferme Trophy 2026</p>

          <div className="grid sm:grid-cols-3 gap-3">
            <Link href="/admin/equipes" className="card p-5 hover:border-ft-red">
              <p className="text-3xl mb-2">🏎️</p>
              <p className="font-mono-race font-bold">Équipes</p>
              <p className="text-white/40 text-xs">Import, dossards</p>
            </Link>
            <Link href="/admin/points" className="card p-5 hover:border-ft-gold">
              <p className="text-3xl mb-2">⭐</p>
              <p className="font-mono-race font-bold">Points</p>
              <p className="text-white/40 text-xs">Audit des transactions</p>
            </Link>
            <Link href="/admin/marketplace" className="card p-5 hover:border-ft-red">
              <p className="text-3xl mb-2">🏪</p>
              <p className="font-mono-race font-bold">Marketplace</p>
              <p className="text-white/40 text-xs">Catalogue bonus/malus</p>
            </Link>
          </div>

          <Link href="/classement" className="block text-center mt-6 text-ft-silver font-mono-race text-sm">
            🏁 Voir le classement public →
          </Link>
        </main>
      )}
    </AdminGate>
  )
}
