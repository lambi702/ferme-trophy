'use client'

import { useEffect, useState } from 'react'

type Organizer = { id: string; displayName: string }

export default function OrganizerGate({ children }: { children: (organizer: Organizer) => React.ReactNode }) {
  const [organizer, setOrganizer] = useState<Organizer | null>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/organizer/me').then(async (r) => {
      setOrganizer(r.ok ? await r.json() : null)
      setChecking(false)
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/organizer/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name, pin }),
    })
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    setOrganizer(body)
  }

  if (checking) return <main className="min-h-screen flex items-center justify-center text-white/40">Chargement...</main>

  if (!organizer) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="card p-6 w-full max-w-sm space-y-3">
          <p className="font-mono-race font-bold text-lg mb-1">🎮 Organisateur</p>
          <p className="text-white/50 text-sm">Connecte-toi avec le nom et le PIN donnés par le comité.</p>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ton nom"
            className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
          />
          <input
            value={pin} onChange={(e) => setPin(e.target.value)}
            placeholder="PIN" inputMode="numeric"
            className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2 tracking-widest"
          />
          {error && <p className="text-ft-red2 text-sm">{error}</p>}
          <button className="w-full bg-ft-red text-white font-mono-race font-bold py-2.5 rounded-lg">Entrer</button>
        </form>
      </main>
    )
  }

  return <>{children(organizer)}</>
}
