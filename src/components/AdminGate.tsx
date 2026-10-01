'use client'

import { useEffect, useState } from 'react'
import { api } from '@/components/ui'

type Admin = { id: string; email: string; displayName: string }

export default function AdminGate({ children }: { children: (admin: Admin) => React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<Admin>('/api/admin/me').then(({ ok, data }) => {
      setAdmin(ok ? data : null)
      setChecking(false)
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { ok, data } = await api<Admin>('/api/admin/login', 'POST', { email, password })
    if (!ok) return setError(data.error ?? 'Erreur')
    setAdmin(data)
  }

  if (checking) return <main className="flex min-h-screen items-center justify-center text-white/40">Chargement…</main>

  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <form onSubmit={handleLogin} className="card w-full max-w-sm space-y-4 p-6">
          <div>
            <p className="text-3xl">🛠️</p>
            <h1 className="mt-1 font-mono-race text-2xl">Comité d&apos;organisation</h1>
          </div>
          <div>
            <label className="label">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" className="input" />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" className="input" />
          </div>
          {error && <p className="text-sm text-ft-red2">{error}</p>}
          <button className="btn-red w-full">Se connecter</button>
        </form>
      </main>
    )
  }

  return <>{children(admin)}</>
}
