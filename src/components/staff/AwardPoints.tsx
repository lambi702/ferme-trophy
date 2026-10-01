'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LiveTeam } from '@/lib/live-types'
import { TeamBadge, api } from '@/components/ui'

const AMOUNTS = [5, 10, 15, 20, 25, 30, 50, 100]

/**
 * Créditer des points mini-jeu : motif → écurie(s) → montant → valider.
 * Multi-sélection possible (même montant pour plusieurs écuries).
 */
export default function AwardPoints({ teams, toast }: { teams: LiveTeam[]; toast: (msg: string, kind?: 'ok' | 'error', action?: { label: string; run: () => void }) => void }) {
  const [reason, setReason] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [amount, setAmount] = useState<number>(10)
  const [custom, setCustom] = useState('')
  const [penalty, setPenalty] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ft_recent_games') ?? '[]')
      setRecent(saved)
      if (saved[0]) setReason(saved[0])
    } catch { /* ignore */ }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) => `${t.name} ${t.unitName} ${t.sectionName} ${t.bikes.join(' ')}`.toLowerCase().includes(q))
  }, [teams, query])

  const value = (custom ? Math.abs(Number(custom)) || 0 : amount) * (penalty ? -1 : 1)
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const submit = async () => {
    if (!reason.trim() || selected.size === 0 || value === 0) return
    setBusy(true)
    const teamIds = [...selected]
    const { ok, data } = await api<{ ids: string[] }>('/api/points', 'POST', { teamIds, points: value, reason: reason.trim() })
    setBusy(false)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')

    const nextRecent = [reason.trim(), ...recent.filter((r) => r !== reason.trim())].slice(0, 6)
    setRecent(nextRecent)
    try { localStorage.setItem('ft_recent_games', JSON.stringify(nextRecent)) } catch { /* ignore */ }

    const names = teams.filter((t) => selected.has(t.id)).map((t) => t.name)
    setSelected(new Set())
    toast(`${value > 0 ? '+' : ''}${value} pts → ${names.length > 1 ? `${names.length} écuries` : names[0]}`, 'ok', {
      label: 'Annuler',
      run: async () => {
        await Promise.all(data.ids.map((id) => api(`/api/points/${id}`, 'DELETE')))
        toast('Crédit annulé')
      },
    })
  }

  return (
    <div className="space-y-5 pb-28">
      <section>
        <label className="label">1 · Mini-jeu</label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex : Chamboule-tout" maxLength={120} className="input" />
        {recent.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button key={r} onClick={() => setReason(r)} className={`chip ${reason === r ? 'chip-on' : ''}`}>{r}</button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-1.5 flex items-end justify-between">
          <label className="label mb-0">2 · Écurie(s) {selected.size > 0 && <span className="text-ft-gold">· {selected.size} choisie{selected.size > 1 ? 's' : ''}</span>}</label>
          {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="text-xs text-white/40">Tout désélectionner</button>}
        </div>
        {teams.length > 6 && (
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔎 Nom, unité, n° de dossard…" className="input mb-2 py-2.5" />
        )}
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((t) => {
            const on = selected.has(t.id)
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={`relative flex items-center gap-2 rounded-xl border p-2.5 text-left transition active:scale-[0.97] ${
                  on ? 'border-ft-gold bg-ft-gold/15' : 'border-white/[0.07] bg-[#141417]'
                }`}
              >
                <TeamBadge emoji={t.emoji} color={t.color} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-tight">{t.name}</span>
                  <span className="block truncate text-[11px] text-white/45">{t.bikes.map((n) => `#${n}`).join(' ') || 'sans vélo'} · {t.points} pts</span>
                </span>
                {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ft-gold text-xs font-bold text-black">✓</span>}
              </button>
            )
          })}
        </div>
        {teams.length === 0 && <p className="card p-4 text-sm text-white/45">Aucune écurie inscrite — onglet « Écuries ».</p>}
      </section>

      <section>
        <div className="mb-1.5 flex items-end justify-between">
          <label className="label mb-0">3 · Points</label>
          <button onClick={() => setPenalty(!penalty)} className={`chip text-xs ${penalty ? 'border-ft-red bg-ft-red/20' : ''}`}>
            {penalty ? '➖ Pénalité' : '➕ Gain'}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => { setAmount(a); setCustom('') }}
              className={`rounded-xl border py-3 font-mono-race text-xl transition active:scale-95 ${
                !custom && amount === a ? (penalty ? 'border-ft-red bg-ft-red/20' : 'border-ft-gold bg-ft-gold/15 text-ft-gold') : 'border-white/[0.07] bg-[#141417]'
              }`}
            >
              {penalty ? '−' : '+'}{a}
            </button>
          ))}
        </div>
        <input
          value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric" placeholder="Autre montant" className="input mt-2 py-2.5"
        />
      </section>

      <div className="above-nav fixed inset-x-0 z-30 px-4">
        <button
          onClick={submit}
          disabled={busy || !reason.trim() || selected.size === 0 || value === 0}
          className={`${penalty ? 'btn-red' : 'btn-gold'} mx-auto flex w-full max-w-xl py-4 text-lg`}
        >
          {selected.size === 0
            ? 'Choisis une écurie'
            : !reason.trim()
              ? 'Indique le mini-jeu'
              : `${value > 0 ? 'Créditer +' : 'Retirer '}${Math.abs(value)} pts${selected.size > 1 ? ` × ${selected.size} écuries` : ''}`}
        </button>
      </div>
    </div>
  )
}
