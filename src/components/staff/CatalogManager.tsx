'use client'

import { useCallback, useEffect, useState } from 'react'
import { signed } from '@/lib/format'
import { api } from '@/components/ui'

type Item = {
  id: string
  name: string
  description: string
  costPoints: number
  type: 'BONUS_SELF' | 'MALUS_OTHER'
  lapEffect: number
  active: boolean
}

/** Catalogue bonus/malus : prix et effets ajustables sur le terrain. */
export default function CatalogManager({ toast }: { toast: (msg: string, kind?: 'ok' | 'error') => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState({ name: '', description: '', costPoints: '50', lapEffect: '1', type: 'BONUS_SELF' as Item['type'] })

  const load = useCallback(async () => {
    const { ok, data } = await api<Item[]>('/api/marketplace/items')
    if (ok) setItems(data)
  }, [])
  useEffect(() => { load() }, [load])

  const patch = async (item: Item, body: Partial<Item>) => {
    const { ok, data } = await api(`/api/marketplace/items/${item.id}`, 'PATCH', body)
    if (!ok) toast(data.error ?? 'Erreur', 'error')
    load()
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const { ok, data } = await api('/api/marketplace/items', 'POST', { ...draft, costPoints: Number(draft.costPoints), lapEffect: Number(draft.lapEffect) })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setDraft({ ...draft, name: '', description: '' })
    toast('Item ajouté ✓')
    load()
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className={`card flex flex-wrap items-center gap-3 p-3 ${item.active ? '' : 'opacity-45'}`}>
          <span className={`w-14 text-center font-mono-race text-2xl ${item.type === 'BONUS_SELF' ? 'text-ft-green' : 'text-ft-red2'}`}>{signed(item.lapEffect)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{item.name}</p>
            <p className="truncate text-xs text-white/45">{item.type === 'BONUS_SELF' ? 'Bonus · un de ses vélos' : 'Malus · vélo adverse'}{item.description && ` · ${item.description}`}</p>
          </div>
          <label className="flex items-center gap-1 text-xs text-white/50">
            Tours
            <input
              type="number" min={1} defaultValue={Math.abs(item.lapEffect)} key={`e${item.lapEffect}`}
              onBlur={(e) => Number(e.target.value) !== Math.abs(item.lapEffect) && patch(item, { lapEffect: Number(e.target.value) })}
              className="input w-16 px-2 py-1.5 text-center"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-white/50">
            Prix
            <input
              type="number" min={0} defaultValue={item.costPoints} key={`c${item.costPoints}`}
              onBlur={(e) => Number(e.target.value) !== item.costPoints && patch(item, { costPoints: Number(e.target.value) })}
              className="input w-20 px-2 py-1.5 text-center"
            />
          </label>
          <button onClick={() => patch(item, { active: !item.active })} className="chip text-xs">{item.active ? 'Désactiver' : 'Activer'}</button>
        </div>
      ))}

      <form onSubmit={create} className="card space-y-2 p-3">
        <p className="label">Nouvel item</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDraft({ ...draft, type: 'BONUS_SELF' })} className={`chip justify-center ${draft.type === 'BONUS_SELF' ? 'border-ft-green bg-ft-green/15' : ''}`}>🟢 Bonus</button>
          <button type="button" onClick={() => setDraft({ ...draft, type: 'MALUS_OTHER' })} className={`chip justify-center ${draft.type === 'MALUS_OTHER' ? 'border-ft-red bg-ft-red/20' : ''}`}>🔴 Malus</button>
        </div>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nom (ex : Double tour)" className="input py-2.5" />
        <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optionnel)" className="input py-2.5" />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-white/50">Tours<input type="number" min={1} value={draft.lapEffect} onChange={(e) => setDraft({ ...draft, lapEffect: e.target.value })} className="input mt-1 py-2.5" /></label>
          <label className="text-xs text-white/50">Prix (pts)<input type="number" min={0} value={draft.costPoints} onChange={(e) => setDraft({ ...draft, costPoints: e.target.value })} className="input mt-1 py-2.5" /></label>
        </div>
        <button disabled={!draft.name.trim()} className="btn-ghost w-full py-2.5 text-sm">Ajouter au catalogue</button>
      </form>
    </div>
  )
}
