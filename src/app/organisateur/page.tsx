'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Me = { id: string; displayName: string }
type TeamLite = { id: string; unitName: string; dossardNumbers: number[]; foulardEmoji: string }
type Item = {
  id: string; name: string; description: string; costPoints: number
  type: 'BONUS_SELF' | 'MALUS_OTHER'; lapEffect: number; active: boolean
}

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

  const [items, setItems] = useState<Item[]>([])
  const [itemName, setItemName] = useState('')
  const [itemCost, setItemCost] = useState(50)
  const [itemType, setItemType] = useState<'BONUS_SELF' | 'MALUS_OTHER'>('BONUS_SELF')
  const [itemEffect, setItemEffect] = useState(1)

  const loadMe = () =>
    fetch('/api/organizer/me').then(async (r) => {
      setMe(r.ok ? await r.json() : null)
      setChecking(false)
    })

  const loadItems = () => fetch('/api/marketplace/items').then((r) => r.json()).then(setItems)

  useEffect(() => { loadMe() }, [])

  useEffect(() => {
    if (me) {
      fetch('/api/teams').then((r) => r.json()).then(setTeams)
      loadItems()
    }
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

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemName.trim()) return
    await fetch('/api/marketplace/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: itemName, costPoints: itemCost, type: itemType, lapEffect: itemEffect }),
    })
    setItemName('')
    loadItems()
  }

  const handleUpdateItemCost = async (item: Item, costPoints: number) => {
    await fetch(`/api/marketplace/items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ costPoints }),
    })
    loadItems()
  }

  const toggleActive = async (item: Item) => {
    await fetch(`/api/marketplace/items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    })
    loadItems()
  }

  if (checking) return <main className="min-h-screen flex items-center justify-center text-white/40">Chargement...</main>

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="font-mono-race text-ft-silver text-sm">← Ferme Trophy</Link>
      <div className="flex items-center justify-between mt-4 mb-6">
        <h1 className="font-mono-race text-2xl font-bold">🎮 Mini-jeux</h1>
        {me && (
          <Link href="/organisateur/equipes" className="bg-ft-gold text-ft-bg font-mono-race font-bold text-sm px-4 py-2 rounded-lg">
            🏎️ Équipes & dossards
          </Link>
        )}
      </div>

      {!me ? (
        <form onSubmit={handleLogin} className="card p-5 space-y-3">
          <p className="text-white/50 text-sm">Connecte-toi avec le nom et le PIN donnés par le comité.</p>
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

          <form onSubmit={handleCredit} className="card p-5 space-y-3 mb-6">
            <p className="font-mono-race font-bold text-sm">⭐ Créditer des points</p>
            <select
              value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2"
            >
              <option value="">Choisir une équipe...</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.foulardEmoji} {t.dossardNumbers.map((n) => `#${n}`).join(' ') || '(sans dossard)'} — {t.unitName || 'équipe vierge'}
                </option>
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

          <div className="card p-5">
            <p className="font-mono-race font-bold text-sm mb-3">🏪 Marketplace — ajuster les prix</p>
            <div className="space-y-2 mb-4">
              {items.map((item) => (
                <div key={item.id} className={`bg-ft-carbon rounded-lg p-3 flex items-center justify-between gap-2 flex-wrap ${!item.active ? 'opacity-40' : ''}`}>
                  <div>
                    <p className="font-mono-race font-bold text-sm">{item.name}</p>
                    <p className="text-white/40 text-xs">{item.type === 'BONUS_SELF' ? 'bonus' : 'malus'}, {item.lapEffect > 0 ? '+' : ''}{item.lapEffect} tour</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" defaultValue={item.costPoints}
                      onBlur={(e) => handleUpdateItemCost(item, Number(e.target.value))}
                      className="w-20 bg-ft-panel border border-white/10 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <span className="text-white/40 text-xs">pts</span>
                    <button onClick={() => toggleActive(item)} className="text-xs font-mono-race font-bold px-2 py-1.5 rounded-lg bg-white/10">
                      {item.active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="text-white/40 text-sm">Aucun item.</p>}
            </div>

            <form onSubmit={handleCreateItem} className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-mono-race text-white/50">Nouvel item</p>
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Nom"
                className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-3 gap-2">
                <select value={itemType} onChange={(e) => setItemType(e.target.value as typeof itemType)}
                  className="bg-ft-carbon border border-white/10 rounded-lg px-2 py-2 text-sm">
                  <option value="BONUS_SELF">Bonus</option>
                  <option value="MALUS_OTHER">Malus</option>
                </select>
                <input type="number" value={itemCost} onChange={(e) => setItemCost(Number(e.target.value))}
                  placeholder="Coût" className="bg-ft-carbon border border-white/10 rounded-lg px-2 py-2 text-sm" />
                <input type="number" value={itemEffect} onChange={(e) => setItemEffect(Number(e.target.value))}
                  placeholder="Effet" className="bg-ft-carbon border border-white/10 rounded-lg px-2 py-2 text-sm" />
              </div>
              <button className="bg-ft-red text-white font-mono-race font-bold px-4 py-2 rounded-lg text-sm">Ajouter au catalogue</button>
            </form>
          </div>
        </>
      )}
    </main>
  )
}
