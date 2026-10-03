'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { NumberPlate, TeamBadge, api } from '@/components/ui'
import { useLive } from '@/lib/useLive'
import { categoryName, contestName, groupKey } from '@/lib/live-types'

type StaffTeam = {
  id: string
  slug: string
  pin: string
  unitName: string
  sectionName: string
  foulardName: string
  foulardColor: string
  foulardEmoji: string
  dossards: { id: string; number: number; name: string; transponder: string | null; contest: number | null; category: number | null }[]
}

type GroupOption = { key: string; label: string }

/** Classements proposés : ceux qui existent déjà + les 4 du règlement 2026 (parcours 1-2 × catégorie 1-2). */
function useGroupOptions(): GroupOption[] {
  const { data } = useLive()
  const names = data?.contests ?? []
  const opts = new Map<string, string>()
  for (const c of names) if (c.contest !== null && c.category !== null) opts.set(c.key, c.name)
  for (const [ct, cat] of [[1, 1], [1, 2], [2, 1], [2, 2]]) {
    const key = groupKey(ct, cat)
    if (!opts.has(key)) opts.set(key, `${contestName({}, ct)} · ${categoryName({}, ct, cat)}`)
  }
  return [...opts].map(([key, label]) => ({ key, label })).sort((a, b) => a.key.localeCompare(b.key))
}

type Toast = (msg: string, kind?: 'ok' | 'error') => void

/**
 * Inscriptions le jour J : créer une écurie (+ ses dossards) en un geste,
 * retrouver un PIN, ajouter/retirer un vélo, corriger un nom, exporter la
 * liste pour le chronométreur. Partagé entre /organisateur et /admin/equipes.
 */
export default function EcuriesManager({ toast }: { toast: Toast }) {
  const groups = useGroupOptions()
  const [teams, setTeams] = useState<StaffTeam[] | null>(null)
  const [query, setQuery] = useState('')
  const [created, setCreated] = useState<StaffTeam | null>(null)
  const [origin, setOrigin] = useState('')

  const load = useCallback(async () => {
    const { ok, data } = await api<StaffTeam[]>('/api/teams')
    if (ok) setTeams(data)
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
    load()
  }, [load])

  const filtered = useMemo(() => {
    if (!teams) return []
    const q = query.trim().toLowerCase()
    const list = [...teams].reverse() // les plus récentes en haut (inscriptions en cours)
    if (!q) return list
    return list.filter((t) => `${t.foulardName} ${t.unitName} ${t.sectionName} ${t.pin} ${t.dossards.map((d) => d.number).join(' ')}`.toLowerCase().includes(q))
  }, [teams, query])

  const bikeCount = teams?.reduce((s, t) => s + t.dossards.length, 0) ?? 0

  return (
    <div className="space-y-5 pb-24">
      <CreateForm
        groups={groups}
        onCreated={async (slug) => {
          await load()
          const { data } = await api<StaffTeam[]>('/api/teams')
          setCreated(data.find((t) => t.slug === slug) ?? null)
        }}
        toast={toast}
      />

      {created && (
        <section className="card slide-up overflow-hidden border-ft-gold/50">
          <div className="flex items-center justify-between bg-ft-gold/15 px-4 py-2.5">
            <p className="font-mono-race text-lg">✅ Écurie inscrite</p>
            <button onClick={() => setCreated(null)} className="text-sm text-white/50">Fermer</button>
          </div>
          <div className="flex items-center gap-4 p-4">
            <div className="rounded-xl bg-white p-2"><QRCodeSVG value={`${origin}/equipe/${created.slug}`} size={104} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{created.foulardName || created.unitName || 'Écurie sans nom'}</p>
              <p className="text-xs text-white/45">Dossards : {created.dossards.map((d) => `#${d.number}`).join(' ') || 'aucun'}</p>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">PIN à donner</p>
              <p className="font-mono-race text-4xl tracking-[0.25em] text-ft-gold">{created.pin}</p>
            </div>
          </div>
          <p className="border-t border-white/[0.06] px-4 py-2.5 text-xs text-white/50">
            L&apos;écurie scanne le QR (ou va sur {origin.replace(/^https?:\/\//, '')}) et tape son PIN pour choisir nom, couleur et emoji.
          </p>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-mono-race text-lg">
            {teams ? `${teams.length} écurie${teams.length > 1 ? 's' : ''} · ${bikeCount} vélo${bikeCount > 1 ? 's' : ''}` : 'Écuries'}
          </h2>
          <a href="/api/export/participants" className="chip text-xs">⬇️ Liste pour O&apos;Top (CSV)</a>
          <Link href="/qrcodes" className="chip text-xs">🖨️ QR codes</Link>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔎 Nom, unité, PIN, n° de dossard…" className="input mb-2 py-2.5" />
        <div className="space-y-2">
          {filtered.map((t) => <TeamRow key={t.id} team={t} groups={groups} reload={load} toast={toast} />)}
          {teams && teams.length === 0 && <p className="card p-4 text-sm text-white/45">Aucune écurie pour l&apos;instant — inscris la première ci-dessus.</p>}
        </div>
      </section>
    </div>
  )
}

function CreateForm({ groups, onCreated, toast }: { groups: GroupOption[]; onCreated: (slug: string) => void; toast: Toast }) {
  const [group, setGroup] = useState('')
  const [foulardName, setFoulardName] = useState('')
  const [unitName, setUnitName] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [dossards, setDossards] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, data } = await api<{ teams: { slug: string }[] }>('/api/teams', 'POST', { foulardName, unitName, sectionName, dossards, group })
    setBusy(false)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setFoulardName(''); setUnitName(''); setSectionName(''); setDossards('')
    onCreated(data.teams[0].slug)
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="font-mono-race text-lg">➕ Inscrire une écurie</h2>
      <div>
        <label className="label">Dossard(s) — un par vélo</label>
        <input value={dossards} onChange={(e) => setDossards(e.target.value)} placeholder="ex : 12, 13   ou   20-22" className="input font-mono-race text-lg" inputMode="numeric" />
      </div>
      <div>
        <label className="label">Classement (parcours · catégorie)</label>
        <select value={group} onChange={(e) => setGroup(e.target.value)} className="input">
          <option value="">— à préciser —</option>
          {groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Nom d&apos;écurie <span className="normal-case tracking-normal text-white/30">(optionnel, modifiable par l&apos;écurie)</span></label>
        <input value={foulardName} onChange={(e) => setFoulardName(e.target.value)} placeholder="ex : Scuderia Faucons" className="input" maxLength={60} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Unité</label>
          <input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="optionnel" className="input" maxLength={80} />
        </div>
        <div>
          <label className="label">Section</label>
          <input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="optionnel" className="input" maxLength={60} />
        </div>
      </div>
      <button disabled={busy} className="btn-red w-full">Inscrire et générer le PIN</button>
    </form>
  )
}

function TeamRow({ team, groups, reload, toast }: { team: StaffTeam; groups: GroupOption[]; reload: () => void; toast: Toast }) {
  const first = team.dossards.find((d) => d.contest !== null)
  const currentGroup = first ? groupKey(first.contest, first.category) : ''
  const groupLabel = groups.find((g) => g.key === currentGroup)?.label
  const setGroup = async (group: string) => {
    const { ok, data } = await api(`/api/teams/${team.slug}/dossards`, 'PATCH', { group })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Classement mis à jour ✓')
    reload()
  }
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState({ foulardName: team.foulardName, unitName: team.unitName, sectionName: team.sectionName })
  const [newBike, setNewBike] = useState('')
  const [copied, setCopied] = useState(false)
  const name = team.foulardName || team.unitName || 'Écurie sans nom'

  const copyPin = async () => {
    try { await navigator.clipboard.writeText(team.pin) } catch { /* http / vieux navigateur */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  const saveNames = async () => {
    const { ok, data } = await api(`/api/teams/${team.slug}/foulard`, 'PATCH', edit)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Enregistré ✓')
    reload()
  }
  const addBike = async () => {
    const { ok, data } = await api(`/api/teams/${team.slug}/dossards`, 'POST', { dossards: newBike })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setNewBike('')
    reload()
  }
  const removeBike = async (number: number) => {
    if (!window.confirm(`Retirer le vélo #${number} de ${name} ?`)) return
    await api(`/api/teams/${team.slug}/dossards?number=${number}`, 'DELETE')
    reload()
  }
  const remove = async () => {
    if (!window.confirm(`Supprimer définitivement « ${name} » (points et achats compris) ?`)) return
    const { ok } = await api(`/api/teams/${team.slug}`, 'DELETE')
    if (ok) { toast('Écurie supprimée'); reload() }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <TeamBadge emoji={team.foulardEmoji} color={team.foulardColor} size={38} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-bold ${team.foulardName || team.unitName ? '' : 'italic text-white/45'}`}>{name}</span>
            <span className="flex flex-wrap items-center gap-1 pt-0.5">
              {team.dossards.map((d) => <NumberPlate key={d.id} number={d.number} color={team.foulardColor} className="text-xs" />)}
              {team.dossards.length === 0 && <span className="text-xs text-ft-red2">aucun vélo</span>}
              {(team.unitName || team.sectionName) && <span className="truncate text-xs text-white/40">{[team.unitName, team.sectionName].filter(Boolean).join(' · ')}</span>}
              {team.dossards.length > 0 && !groupLabel && <span className="text-xs text-ft-gold">classement à préciser</span>}
            </span>
          </span>
        </button>
        <button onClick={copyPin} className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-center" title="Copier le PIN">
          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">{copied ? 'Copié ✓' : 'PIN'}</span>
          <span className="font-mono-race tnum text-lg tracking-widest text-ft-gold">{team.pin}</span>
        </button>
      </div>

      {open && (
        <div className="slide-up space-y-3 border-t border-white/[0.06] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input value={edit.foulardName} onChange={(e) => setEdit({ ...edit, foulardName: e.target.value })} placeholder="Nom d'écurie" className="input py-2" />
            <input value={edit.unitName} onChange={(e) => setEdit({ ...edit, unitName: e.target.value })} placeholder="Unité" className="input py-2" />
            <input value={edit.sectionName} onChange={(e) => setEdit({ ...edit, sectionName: e.target.value })} placeholder="Section" className="input py-2" />
          </div>
          <button onClick={saveNames} className="btn-ghost w-full py-2 text-sm">Enregistrer les noms</button>

          <div>
            <p className="label">Classement</p>
            <select value={currentGroup} onChange={(e) => setGroup(e.target.value)} className="input py-2">
              <option value="">— à préciser —</option>
              {groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>

          <div>
            <p className="label">Vélos</p>
            <div className="flex flex-wrap gap-1.5">
              {team.dossards.map((d) => (
                <span key={d.id} className="inline-flex items-center gap-1 rounded-lg bg-white/[0.05] py-1 pl-1 pr-2 text-sm">
                  <NumberPlate number={d.number} color={team.foulardColor} className="text-sm" />
                  {d.name && <span className="text-white/60">{d.name}</span>}
                  {d.transponder && <span className="font-mono text-[11px] text-white/40">{d.transponder}</span>}
                  <button onClick={() => removeBike(d.number)} className="ml-1 text-white/40 hover:text-ft-red2" aria-label={`Retirer #${d.number}`}>✕</button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={newBike} onChange={(e) => setNewBike(e.target.value)} placeholder="+ dossard (ex : 14)" inputMode="numeric" className="input py-2" />
              <button onClick={addBike} disabled={!newBike.trim()} className="btn-ghost px-4 py-2 text-sm">Ajouter</button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link href={`/equipe/${team.slug}`} className="font-semibold text-white/60 underline-offset-2 hover:underline">Page publique →</Link>
            <button onClick={remove} className="font-semibold text-ft-red2/80 hover:text-ft-red2">Supprimer l&apos;écurie</button>
          </div>
        </div>
      )}
    </div>
  )
}
