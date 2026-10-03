'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminShell from '@/components/AdminShell'
import { NumberPlate, RaceClock, api } from '@/components/ui'
import { useLive } from '@/lib/useLive'
import { bikeLabel, type LiveRace } from '@/lib/live-types'

type Toast = (msg: string, kind?: 'ok' | 'error') => void

export default function CoursePage() {
  return (
    <AdminShell title="Course" subtitle="Horloge (écran géant + téléphones), corrections de tours, remise à zéro.">
      {({ toast }) => (
        <div className="space-y-6">
          <ClockCard toast={toast} />
          <NamesCard toast={toast} />
          <CorrectionCard toast={toast} />
          <DangerZone toast={toast} />
        </div>
      )}
    </AdminShell>
  )
}

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ClockCard({ toast }: { toast: Toast }) {
  const [race, setRace] = useState<LiveRace | null>(null)
  const [duration, setDuration] = useState('')
  const [start, setStart] = useState('')

  const load = useCallback(async () => {
    const { ok, data } = await api<LiveRace>('/api/admin/race')
    if (!ok) return
    setRace(data)
    setDuration(String(data.durationMin))
    setStart(toLocalInput(data.startedAt))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (patch: Partial<LiveRace>, msg: string) => {
    const { ok, data } = await api<LiveRace>('/api/admin/race', 'PUT', patch)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast(msg)
    load()
  }

  if (!race) return null
  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono-race text-xl">⏱️ Horloge de course</h2>
        <RaceClock race={race} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Durée (minutes, 0 = pas de compte à rebours)</label>
          <div className="flex gap-2">
            <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} className="input" inputMode="numeric" />
            <button onClick={() => save({ durationMin: Number(duration) || 0 }, 'Durée enregistrée')} className="btn-ghost px-3 text-sm">OK</button>
          </div>
        </div>
        <div>
          <label className="label">Heure de départ (programmée ou corrigée)</label>
          <div className="flex gap-2">
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="input" />
            <button onClick={() => save({ startedAt: start ? new Date(start).toISOString() : null, finishedAt: null }, 'Départ programmé')} className="btn-ghost px-3 text-sm">OK</button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => window.confirm('Donner le départ MAINTENANT ?') && save({ startedAt: new Date().toISOString(), finishedAt: null }, '🟢 Départ donné !')} className="btn-green">🟢 Départ maintenant</button>
        <button onClick={() => window.confirm('Agiter le drapeau à damier ?') && save({ finishedAt: new Date().toISOString() }, '🏁 Course terminée')} className="btn-ghost">🏁 Terminer la course</button>
        <button onClick={() => window.confirm('Remettre l\'horloge à « départ bientôt » ?') && save({ startedAt: null, finishedAt: null }, 'Horloge réinitialisée')} className="btn-ghost">↺ Réinitialiser l&apos;horloge</button>
      </div>
      <p className="text-xs text-white/40">L&apos;horloge n&apos;influence pas le comptage des tours (c&apos;est le chrono qui fait foi) — elle sert à l&apos;affichage.</p>
    </section>
  )
}

function CorrectionCard({ toast }: { toast: Toast }) {
  const { data } = useLive()
  const [number, setNumber] = useState('')
  const [delta, setDelta] = useState(-1)
  const [reason, setReason] = useState('')
  const bike = data?.bikes.find((b) => b.number === Number(number))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { ok, data: res } = await api('/api/adjustments', 'POST', { dossardNumber: Number(number), lapDelta: delta, reason })
    if (!ok) return toast(res.error ?? 'Erreur', 'error')
    toast(`Correction appliquée sur #${number}`)
    setReason('')
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="font-mono-race text-xl">🏳️ Correction de tours</h2>
      <p className="text-sm text-white/55">Litige, pénalité, erreur de chrono… Visible dans la radio course et l&apos;historique (annulable).</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label">Dossard</label>
          <input value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="input font-mono-race text-lg" placeholder="ex : 12" />
          {bike && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-white/60">
              <NumberPlate number={bike.number} color={bike.teamColor} className="text-sm" /> {bikeLabel(bike)} · {bike.teamName} · {bike.laps} tours (P{bike.rank})
            </p>
          )}
        </div>
        <div>
          <label className="label">Tours</label>
          <div className="flex items-center gap-1">
            {[-3, -2, -1, 1, 2, 3].map((d) => (
              <button type="button" key={d} onClick={() => setDelta(d)} className={`h-11 w-11 rounded-lg font-mono-race text-lg ${delta === d ? (d < 0 ? 'bg-ft-red text-white' : 'bg-ft-green text-black') : 'bg-white/[0.06]'}`}>
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
          </div>
        </div>
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif (ex : coupé le circuit)" className="input" maxLength={120} />
      <button disabled={!bike} className="btn-red">Appliquer {delta > 0 ? `+${delta}` : delta} tour{Math.abs(delta) > 1 ? 's' : ''}</button>
    </form>
  )
}

function DangerZone({ toast }: { toast: Toast }) {
  const reset = async (scope: 'game' | 'event', label: string) => {
    const confirm = window.prompt(`${label}\n\nCette action est irréversible. Tape RESET pour confirmer.`)
    if (confirm !== 'RESET') return
    const { ok, data } = await api('/api/admin/reset', 'POST', { scope, confirm })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Remise à zéro effectuée')
  }
  return (
    <section className="card space-y-3 border-ft-red/40 p-4">
      <h2 className="font-mono-race text-xl text-ft-red2">Zone dangereuse</h2>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-white/55"><b>Remise à zéro du jeu</b> : tours, points, achats, corrections. Garde écuries, dossards, PIN, catalogue.</p>
        <button onClick={() => reset('game', 'Effacer tours + points + achats ?')} className="btn-ghost border-ft-red/50 px-4 py-2 text-sm text-ft-red2">Remettre le jeu à zéro…</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-white/55"><b>Remise à zéro complète</b> : tout ce qui précède + écuries et dossards. Garde comptes comité/organisateurs, catalogue, réglages chrono.</p>
        <button onClick={() => reset('event', 'Effacer TOUTES les écuries, dossards, tours et points ?')} className="btn-red px-4 py-2 text-sm">Tout effacer…</button>
      </div>
    </section>
  )
}

type RaceNames = { contestNames: Record<string, string>; categoryNames: Record<string, string> }

// Noms des parcours et catégories (= les 4 classements), affichés partout.
function NamesCard({ toast }: { toast: Toast }) {
  const [names, setNames] = useState<RaceNames | null>(null)
  useEffect(() => {
    api<RaceNames>('/api/admin/race').then(({ ok, data }) => ok && setNames({ contestNames: data.contestNames ?? {}, categoryNames: data.categoryNames ?? {} }))
  }, [])
  if (!names) return null
  const save = async () => {
    const { ok, data } = await api('/api/admin/race', 'PUT', names)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Noms enregistrés ✓')
  }
  const setC = (k: string, v: string) => setNames({ ...names, contestNames: { ...names.contestNames, [k]: v } })
  const setK = (k: string, v: string) => setNames({ ...names, categoryNames: { ...names.categoryNames, [k]: v } })
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-mono-race text-xl">🏷️ Parcours & catégories</h2>
      <p className="text-sm text-white/55">Un classement par parcours (= « Épreuve » RaceResult) et par catégorie (déduite de la section).</p>
      {['1', '2'].map((c) => (
        <div key={c} className="grid gap-2 rounded-xl bg-white/[0.03] p-3 sm:grid-cols-3">
          <label className="text-xs text-white/50">Parcours / épreuve {c}<input value={names.contestNames[c] ?? ''} onChange={(e) => setC(c, e.target.value)} placeholder={`Épreuve ${c}`} className="input mt-1 py-2" /></label>
          <label className="text-xs text-white/50">Catégorie 1<input value={names.categoryNames[`${c}-1`] ?? ''} onChange={(e) => setK(`${c}-1`, e.target.value)} placeholder="Catégorie 1" className="input mt-1 py-2" /></label>
          <label className="text-xs text-white/50">Catégorie 2<input value={names.categoryNames[`${c}-2`] ?? ''} onChange={(e) => setK(`${c}-2`, e.target.value)} placeholder="Catégorie 2" className="input mt-1 py-2" /></label>
        </div>
      ))}
      <button onClick={save} className="btn-red px-4 py-2 text-sm">Enregistrer</button>
    </section>
  )
}
