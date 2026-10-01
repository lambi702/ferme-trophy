'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FeedItem } from '@/lib/live-types'
import { FeedRow, api } from '@/components/ui'
import { useNow } from '@/lib/useLive'

type Entry = FeedItem & { cancelled?: boolean }

/**
 * Journal complet (annulés compris, barrés) avec annulation : un crédit de
 * points est désactivé, un achat est remboursé et son effet retiré. Les
 * corrections comité ne sont annulables que par le comité.
 */
export default function ActivityLog({ isAdmin, toast }: { isAdmin: boolean; toast: (msg: string, kind?: 'ok' | 'error') => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'points' | 'shop'>('all')
  const now = useNow(15000)

  const load = useCallback(async () => {
    const { ok, data } = await api<Entry[]>('/api/activity?limit=300')
    if (ok) setEntries(data)
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const undo = async (entry: Entry) => {
    const [kind, id] = [entry.id.slice(0, 3), entry.id.slice(4)]
    const url = kind === 'pts' ? `/api/points/${id}` : kind === 'buy' ? `/api/purchases/${id}` : `/api/adjustments/${id}`
    const label = kind === 'buy' ? 'Annuler cet achat et rembourser les points ?' : 'Annuler cette ligne ?'
    if (!window.confirm(label)) return
    const { ok, data } = await api(url, 'DELETE')
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Annulé ✓')
    load()
  }

  const shown = (entries ?? []).filter((e) => filter === 'all' || (filter === 'points' ? e.kind === 'points' : e.kind !== 'points'))

  return (
    <div className="space-y-3 pb-24">
      <div className="flex gap-1.5">
        {([['all', 'Tout'], ['points', '⭐ Points'], ['shop', '🛒 Bonus/malus']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`chip ${filter === id ? 'chip-on' : ''}`}>{label}</button>
        ))}
      </div>
      <div className="space-y-1.5">
        {shown.map((e) => (
          <FeedRow
            key={e.id} item={e} now={now} showBy
            onUndo={e.kind === 'correction' && !isAdmin ? undefined : () => undo(e)}
          />
        ))}
        {entries && shown.length === 0 && <p className="card p-4 text-sm text-white/45">Rien pour l&apos;instant.</p>}
      </div>
    </div>
  )
}
