'use client'

import { useEffect, useState } from 'react'

type Admin = { id: string; email: string; displayName: string }

export default function AdminGate({ children }: { children: (admin: Admin) => React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/me').then(async (r) => {
      setAdmin(r.ok ? await r.json() : null)
      setChecking(false)
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    setAdmin(body)
  }

  if (checking) return <main className="min-h-screen flex items-center justify-center text-white/40">Chargement...</main>

  if (!admin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="card p-6 w-full max-w-sm space-y-3">
          <p className="font-mono-race font-bold text-lg mb-1">🛠️ Comité d'organisation</p>
          <input
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" type="email"
            className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
          />
          <input
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe" type="password"
            className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
          />
          {error && <p className="text-ft-red2 text-sm">{error}</p>}
          <button className="w-full bg-ft-red text-white font-mono-race font-bold py-2.5 rounded-lg">Se connecter</button>
        </form>
      </main>
    )
  }

  return <>{children(admin)}</>
}
