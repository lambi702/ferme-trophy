'use client'

import { useMemo, useState } from 'react'
import type { LiveBike, LiveItem, LiveTeam } from '@/lib/live-types'
import { bikeLabel } from '@/lib/live-types'
import { signed } from '@/lib/format'
import { NumberPlate, TeamBadge, api } from '@/components/ui'

/**
 * Dépense des points d'une écurie (à sa demande, au stand de la direction
 * de course) : qui paie → quoi → sur quel vélo → confirmation.
 * Bonus = un vélo de l'écurie qui paie ; malus = un vélo adverse.
 */
export default function SpendPoints({
  teams, bikes, catalog, toast,
}: {
  teams: LiveTeam[]
  bikes: LiveBike[]
  catalog: LiveItem[]
  toast: (msg: string, kind?: 'ok' | 'error', action?: { label: string; run: () => void }) => void
}) {
  const [payerId, setPayerId] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const payer = teams.find((t) => t.id === payerId) ?? null
  const item = catalog.find((i) => i.id === itemId) ?? null
  const target = bikes.find((b) => b.dossardId === targetId) ?? null
  const step = !payer ? 1 : !item ? 2 : !target ? 3 : 4

  const candidates = useMemo(() => {
    if (!payer || !item) return []
    const pool = item.type === 'BONUS_SELF' ? bikes.filter((b) => b.teamId === payer.id) : bikes.filter((b) => b.teamId !== payer.id)
    const q = query.trim().toLowerCase()
    return q ? pool.filter((b) => `${b.number} ${b.name} ${b.teamName}`.toLowerCase().includes(q)) : pool
  }, [payer, item, bikes, query])

  const pickItem = (i: LiveItem) => {
    setItemId(i.id)
    setQuery('')
    // Bonus et une seule bécane : pas besoin de demander laquelle.
    const own = bikes.filter((b) => b.teamId === payer?.id)
    setTargetId(i.type === 'BONUS_SELF' && own.length === 1 ? own[0].dossardId : null)
  }

  const reset = () => { setPayerId(null); setItemId(null); setTargetId(null); setQuery('') }

  const confirm = async () => {
    if (!payer || !item || !target) return
    setBusy(true)
    const { ok, data } = await api<{ id: string; balance: number }>('/api/purchases', 'POST', {
      buyingTeamId: payer.id, itemId: item.id, targetDossardId: target.dossardId,
    })
    setBusy(false)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast(`${item.name} appliqué sur #${target.number} — reste ${data.balance} pts`, 'ok', {
      label: 'Annuler',
      run: async () => {
        await api(`/api/purchases/${data.id}`, 'DELETE')
        toast('Achat annulé, points remboursés')
      },
    })
    reset()
  }

  return (
    <div className="space-y-4 pb-6">
      <Stepper step={step} labels={['Qui paie', 'Quoi', 'Quel vélo', 'Valider']} onBack={(s) => {
        if (s <= 1) reset()
        else if (s === 2) { setItemId(null); setTargetId(null) }
        else if (s === 3) setTargetId(null)
      }} />

      {payer && (
        <button onClick={reset} className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left" style={{ borderColor: `${payer.color}66`, background: `linear-gradient(110deg, ${payer.color}30, #141417 70%)` }}>
          <TeamBadge emoji={payer.emoji} color={payer.color} size={42} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Écurie qui paie</span>
            <span className="block truncate font-mono-race text-xl">{payer.name}</span>
          </span>
          <span className="text-right">
            <span className="block font-mono-race tnum text-3xl leading-none text-ft-gold">{payer.points}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">pts dispo</span>
          </span>
        </button>
      )}

      {step === 1 && (
        <section>
          {teams.length > 6 && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔎 Chercher une écurie…" className="input mb-2 py-2.5" />}
          <div className="grid grid-cols-2 gap-2">
            {teams
              .filter((t) => !query || `${t.name} ${t.unitName} ${t.bikes.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
              .map((t) => (
                <button key={t.id} onClick={() => { setPayerId(t.id); setQuery('') }} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-[#141417] p-2.5 text-left transition active:scale-[0.97]">
                  <TeamBadge emoji={t.emoji} color={t.color} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{t.name}</span>
                    <span className="block text-[11px] text-white/45">{t.bikes.map((n) => `#${n}`).join(' ') || 'sans vélo'}</span>
                  </span>
                  <span className="font-mono-race tnum text-lg text-ft-gold">{t.points}</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {step === 2 && payer && (
        <section className="space-y-4">
          {(['BONUS_SELF', 'MALUS_OTHER'] as const).map((type) => {
            const items = catalog.filter((i) => i.type === type)
            if (items.length === 0) return null
            return (
              <div key={type}>
                <p className={`label ${type === 'BONUS_SELF' ? 'text-ft-green' : 'text-ft-red2'}`}>
                  {type === 'BONUS_SELF' ? '🟢 Bonus — sur un de ses vélos' : '🔴 Malus — sur un vélo adverse'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((i) => {
                    const missing = i.costPoints - payer.points
                    return (
                      <button
                        key={i.id} onClick={() => pickItem(i)} disabled={missing > 0}
                        className="flex flex-col rounded-xl border border-white/[0.07] bg-[#141417] p-3 text-left transition active:scale-[0.97] disabled:opacity-40"
                      >
                        <span className={`font-mono-race text-3xl leading-none ${type === 'BONUS_SELF' ? 'text-ft-green' : 'text-ft-red2'}`}>{signed(i.lapEffect)} T</span>
                        <span className="mt-1 text-sm font-bold">{i.name}</span>
                        <span className="mt-1 font-mono-race tnum text-lg text-ft-gold">{i.costPoints} pts</span>
                        {missing > 0 && <span className="text-[11px] text-ft-red2">il manque {missing} pts</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {catalog.length === 0 && <p className="card p-4 text-sm text-white/45">Catalogue vide — ajoute des items ci-dessous.</p>}
        </section>
      )}

      {step === 3 && item && (
        <section>
          <p className="label">{item.type === 'BONUS_SELF' ? `Quel vélo reçoit ${signed(item.lapEffect)} tour ?` : `Quel vélo adverse prend ${signed(item.lapEffect)} tour ?`}</p>
          {item.type === 'MALUS_OTHER' && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔎 N° de dossard, écurie…" className="input mb-2 py-2.5" inputMode="search" />}
          <div className="space-y-1.5">
            {candidates.map((b) => (
              <button key={b.dossardId} onClick={() => setTargetId(b.dossardId)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-[#141417] p-2.5 text-left transition active:scale-[0.99]">
                <span className="w-8 text-center font-mono-race text-white/50">P{b.rank}</span>
                <NumberPlate number={b.number} color={b.teamColor} className="text-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{bikeLabel(b)}</span>
                  <span className="block truncate text-xs text-white/45">{b.teamEmoji} {b.teamName}</span>
                </span>
                <span className="font-mono-race tnum text-xl">{b.laps} T</span>
              </button>
            ))}
            {candidates.length === 0 && <p className="card p-4 text-sm text-white/45">Aucun vélo disponible.</p>}
          </div>
        </section>
      )}

      {step === 4 && payer && item && target && (
        <section className="card slide-up overflow-hidden">
          <div className={`px-4 py-3 ${item.type === 'BONUS_SELF' ? 'bg-ft-green/15' : 'bg-ft-red/20'}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Récapitulatif</p>
            <p className="font-mono-race text-2xl">{item.name}</p>
          </div>
          <div className="space-y-3 p-4 text-sm">
            <Line label="Payé par" value={`${payer.emoji} ${payer.name}`} />
            <Line label="Coût" value={`${item.costPoints} pts (reste ${payer.points - item.costPoints})`} />
            <Line label="Vélo visé" value={`#${target.number}${target.name ? ` « ${target.name} »` : ''} — ${target.teamName}`} />
            <Line label="Effet" value={`${target.laps} → ${target.laps + item.lapEffect} tours`} strong />
          </div>
        </section>
      )}

      {step === 4 && (
        <div className="above-nav fixed inset-x-0 z-30 px-4">
          <button onClick={confirm} disabled={busy} className={`${item?.type === 'BONUS_SELF' ? 'btn-green' : 'btn-red'} mx-auto flex w-full max-w-xl py-4 text-lg`}>
            Valider l&apos;achat ({item?.costPoints} pts)
          </button>
        </div>
      )}
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/45">{label}</span>
      <span className={`text-right ${strong ? 'font-mono-race text-lg' : 'font-semibold'}`}>{value}</span>
    </div>
  )
}

function Stepper({ step, labels, onBack }: { step: number; labels: string[]; onBack: (step: number) => void }) {
  return (
    <ol className="flex items-center gap-1">
      {labels.map((l, i) => {
        const n = i + 1
        const done = n < step
        return (
          <li key={l} className="flex flex-1 items-center gap-1">
            <button
              disabled={!done}
              onClick={() => onBack(n)}
              className={`flex flex-1 flex-col items-center rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider ${
                n === step ? 'bg-white text-black' : done ? 'bg-white/10 text-white/70' : 'text-white/30'
              }`}
            >
              <span className="font-mono-race text-base leading-none">{done ? '✓' : n}</span>
              {l}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
