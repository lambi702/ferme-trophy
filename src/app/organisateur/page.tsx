'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Me = { id: string; displayName: string }
type TeamLite = { id: string; unitName: string; dossardNumber: number | null; foulardEmoji: string }

export default function OrganisateurPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const [teams, setTeams] = useState<TeamLite[]>([])
  const [teamId, setTeamId] = useState('')
  const [points, setPoints] = useState(10)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')

  const loadMe = () =>
    fetch('/api/organizer/me').then(async (r) => {
      setMe(r.ok ? await r.json() : null)
      setChecking(false)
    })

  useEffect(() => { loadMe() }, [])

  useEffect(() => {
    if (me) fetch('/api/teams').then((r) => r.json()).then(setTeams)
  }, [me])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/organizer/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name, pin }),
    })
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    setMe(body)
  }

  const handleCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    if (!teamId || !reason.trim()) return
    const res = await fetch('/api/points', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId, points, reason }),
    })
    const body = await res.json()
    if (!res.ok) return setMsg(`❌ ${body.error}`)
    setMsg(`✅ ${points} pts crédités !`)
    setReason('')
  }

  if (checking) return <main className="min-h-screen flex items-center justify-center text-white/40">Chargement...</main>

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="font-mono-race text-ft-silver text-sm">← Ferme Trophy</Link>
      <h1 className="font-mono-race text-2xl font-bold mt-4 mb-6">🎮 Mini-jeux</h1>

      {!me ? (
        <form onSubmit={handleLogin} className="card p-5 space-y-3">
          <p className="text-white/50 text-sm">Ton nom + un PIN à 4-6 chiffres — première fois ? ça crée ton compte tout seul.</p>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ton nom (ex: Julie)"
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
      ) : (
        <>
          <p className="text-white/50 mb-4">Connecté·e en tant que <strong>{me.displayName}</strong></p>
          <form onSubmit={handleCredit} className="card p-5 space-y-3">
            <p className="font-mono-race font-bold text-sm">Créditer des points</p>
            <select
              value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
            >
              <option value="">Choisir une équipe...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.foulardEmoji} #{t.dossardNumber ?? '?'} — {t.unitName}</option>
              ))}
            </select>
            <input
              type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
            />
            <input
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Mini-jeu (ex: Chamboule-tout)"
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
            />
            {msg && <p className="text-sm">{msg}</p>}
            <button className="w-full bg-ft-gold text-ft-bg font-mono-race font-bold py-2.5 rounded-lg">Créditer</button>
          </form>
        </>
      )}
    </main>
  )
}
