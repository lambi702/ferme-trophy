'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/components/ui'

export type StaffUser = { role: 'admin' | 'organizer'; id: string; name: string }

/**
 * Accès direction de course : organisateur (nom + PIN donné par le comité)
 * ou membre du comité déjà connecté sur /admin (même session acceptée).
 */
export default function StaffGate({ children }: { children: (staff: StaffUser, logout: () => void) => React.ReactNode }) {
  const [staff, setStaff] = useState<StaffUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<StaffUser>('/api/staff/me').then(({ ok, data }) => {
      setStaff(ok ? data : null)
      setChecking(false)
    })
  }, [])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { ok, data } = await api<{ id: string; displayName: string }>('/api/organizer/login', 'POST', { displayName: name.trim(), pin })
    setBusy(false)
    if (!ok) return setError(data.error ?? 'Erreur')
    setStaff({ role: 'organizer', id: data.id, name: data.displayName })
  }

  const logout = async () => {
    await api(staff?.role === 'admin' ? '/api/admin/logout' : '/api/organizer/logout', 'POST')
    setStaff(null)
  }

  if (checking) return <div className="flex min-h-screen items-center justify-center text-white/40">Chargement…</div>

  if (!staff) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <form onSubmit={login} className="card w-full max-w-sm space-y-4 p-6">
          <div>
            <p className="text-3xl">🎮</p>
            <h1 className="mt-1 font-mono-race text-2xl">Direction de course</h1>
            <p className="text-sm text-white/50">Points des mini-jeux, bonus/malus, inscriptions. Accès donné par le comité.</p>
          </div>
          <div>
            <label className="label">Ton nom</label>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" placeholder="ex : Julie" className="input" />
          </div>
          <div>
            <label className="label">PIN</label>
            <input
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} type="password"
              inputMode="numeric" autoComplete="current-password" placeholder="••••" className="input font-mono-race tracking-[0.4em]"
            />
          </div>
          {error && <p className="text-sm text-ft-red2">{error}</p>}
          <button disabled={!name.trim() || !pin || busy} className="btn-red w-full">Entrer</button>
          <p className="text-center text-xs text-white/35">
            Membre du comité ? <Link href="/admin" className="underline">Connecte-toi ici</Link>, puis reviens.
          </p>
        </form>
      </main>
    )
  }

  return <>{children(staff, logout)}</>
}
