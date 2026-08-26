'use client'

import { useEffect, useState } from 'react'
import AdminGate from '@/components/AdminGate'
import AdminNav from '@/components/AdminNav'

type Item = {
  id: string
  name: string
  description: string
  costPoints: number
  type: 'BONUS_SELF' | 'MALUS_OTHER'
  lapEffect: number
  active: boolean
}

export default function MarketplaceAdminPage() {
  const [items, setItems] = useState<Item[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [costPoints, setCostPoints] = useState(50)
  const [type, setType] = useState<'BONUS_SELF' | 'MALUS_OTHER'>('BONUS_SELF')
  const [lapEffect, setLapEffect] = useState(1)

  const load = () => fetch('/api/marketplace/items').then((r) => r.json()).then(setItems)
  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch('/api/marketplace/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, costPoints, type, lapEffect }),
    })
    setName(''); setDescription('')
    load()
  }

  const toggleActive = async (item: Item) => {
    await fetch(`/api/marketplace/items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    })
    load()
  }

  return (
    <AdminGate>
      {() => (
        <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
          <AdminNav />
          <h1 className="font-mono-race text-2xl font-bold mb-6">🏪 Marketplace</h1>

          <form onSubmit={handleCreate} className="card p-5 mb-6 space-y-3">
            <p className="font-mono-race font-bold text-sm">Nouvel item</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex: Tour bonus)"
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)"
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2" />
            <div className="grid grid-cols-3 gap-2">
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
                className="bg-ft-carbon border border-white/10 rounded-lg px-3 py-2">
                <option value="BONUS_SELF">Bonus (soi)</option>
                <option value="MALUS_OTHER">Malus (cible)</option>
              </select>
              <input type="number" value={costPoints} onChange={(e) => setCostPoints(Number(e.target.value))}
                placeholder="Coût (pts)" className="bg-ft-carbon border border-white/10 rounded-lg px-3 py-2" />
              <input type="number" value={lapEffect} onChange={(e) => setLapEffect(Number(e.target.value))}
                placeholder="Effet (+1/-1)" className="bg-ft-carbon border border-white/10 rounded-lg px-3 py-2" />
            </div>
            <button className="bg-ft-red text-white font-mono-race font-bold px-4 py-2 rounded-lg text-sm">Créer</button>
          </form>

          <div className="card p-5">
            <p className="font-mono-race font-bold text-sm mb-3">Catalogue</p>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className={`bg-ft-carbon rounded-lg p-3 flex items-center justify-between gap-3 ${!item.active ? 'opacity-40' : ''}`}>
                  <div>
                    <p className="font-mono-race font-bold text-sm">{item.name} <span className="text-white/40 text-xs">({item.type === 'BONUS_SELF' ? 'bonus' : 'malus'}, {item.lapEffect > 0 ? '+' : ''}{item.lapEffect} tour)</span></p>
                    <p className="text-ft-gold text-xs font-mono-race">{item.costPoints} pts</p>
                  </div>
                  <button onClick={() => toggleActive(item)} className="text-xs font-mono-race font-bold px-3 py-1.5 rounded-lg bg-white/10">
                    {item.active ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              ))}
              {items.length === 0 && <p className="text-white/40 text-sm">Aucun item — le seed en propose déjà quelques-uns.</p>}
            </div>
          </div>
        </main>
      )}
    </AdminGate>
  )
}
