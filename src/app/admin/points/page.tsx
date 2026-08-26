'use client'

import { useEffect, useState } from 'react'
import AdminGate from '@/components/AdminGate'
import AdminNav from '@/components/AdminNav'

type Tx = {
  id: string
  points: number
  reason: string
  createdAt: string
  team: { unitName: string; slug: string }
  organizer: { displayName: string } | null
}

export default function PointsAuditPage() {
  const [transactions, setTransactions] = useState<Tx[]>([])

  useEffect(() => {
    fetch('/api/points').then((r) => r.json()).then(setTransactions)
  }, [])

  return (
    <AdminGate>
      {() => (
        <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
          <AdminNav />
          <h1 className="font-mono-race text-2xl font-bold mb-6">⭐ Points — audit</h1>

          <div className="card p-5">
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-ft-carbon rounded-lg p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono-race font-bold text-sm">{tx.team.unitName}</p>
                    <p className="text-white/40 text-xs">
                      {tx.reason} — {tx.organizer?.displayName ?? 'comité'} · {new Date(tx.createdAt).toLocaleString('fr-BE')}
                    </p>
                  </div>
                  <span className={`font-mono-race font-bold text-lg ${tx.points >= 0 ? 'text-ft-gold' : 'text-ft-red2'}`}>
                    {tx.points >= 0 ? '+' : ''}{tx.points}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-white/40 text-sm">Aucune transaction pour l'instant.</p>}
            </div>
          </div>
        </main>
      )}
    </AdminGate>
  )
}
