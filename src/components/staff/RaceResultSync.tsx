'use client'

import { useState } from 'react'
import { api } from '@/components/ui'

type Plan = {
  rows: number
  createTeams: { name: string; bikes: number[] }[]
  createBikes: { number: number; team: string }[]
  moveBikes: { number: number; from: string; to: string }[]
  updateBikes: { number: number; changes: string[] }[]
  removeBikes: { number: number; team: string }[]
  removeTeams: string[]
  keptTeamsWithoutBikes: string[]
}

/**
 * Coller le fichier participants RaceResult d'O'Top (sélection dans Excel →
 * copier → coller ici) : aperçu des changements, puis application.
 */
export default function RaceResultSync({ toast, onApplied }: { toast: (m: string, k?: 'ok' | 'error') => void; onApplied?: () => void }) {
  const [text, setText] = useState('')
  const [removeMissing, setRemoveMissing] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const run = async (apply: boolean) => {
    setBusy(true)
    const { ok, data } = await api<{ plan: Plan; parseErrors?: string[] }>('/api/admin/raceresult-sync', 'POST', { text, removeMissing, apply })
    setBusy(false)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    if (apply) {
      toast('Listing synchronisé avec RaceResult ✓')
      setPlan(null); setText('')
      onApplied?.()
      return
    }
    setPlan(data.plan)
    setWarnings(data.parseErrors ?? [])
  }

  const nothing = plan && !plan.createTeams.length && !plan.createBikes.length && !plan.moveBikes.length && !plan.updateBikes.length && !plan.removeBikes.length && !plan.removeTeams.length

  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-mono-race text-xl">🔄 Synchroniser avec le fichier RaceResult d&apos;O&apos;Top</summary>
      <p className="mt-3 text-sm text-white/55">
        Ouvre leur fichier (Dossard, Transpondeur1, NomFamille, Prénom, Club, Categ, Épreuve), sélectionne tout le tableau <b>avec l&apos;en-tête</b>,
        copie, colle ici. Le fichier fait foi pour les vélos, puces, parcours (Épreuve) et catégories (déduites de Categ).
        Couleurs, emojis et surnoms choisis par les écuries sont gardés.
      </p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setPlan(null) }} rows={6} placeholder={'Dossard\tTranspondeur1\tNomFamille\tPrénom\tClub\tCateg\tÉpreuve\n91\tABEA-1111\tVélo 91\tEmbourg Cubango\tEmbourg\tLutins\t2'} className="input mt-3 font-mono text-xs" />
      <label className="mt-2 flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={removeMissing} onChange={(e) => { setRemoveMissing(e.target.checked); setPlan(null) }} className="accent-ft-red" />
        Retirer de la course les vélos absents du fichier
      </label>
      <button onClick={() => run(false)} disabled={!text.trim() || busy} className="btn-ghost mt-3 px-4 py-2 text-sm">Analyser</button>

      {plan && (
        <div className="mt-4 space-y-2 rounded-xl bg-black/30 p-3 text-sm">
          <p className="font-bold">{plan.rows} vélos dans le fichier</p>
          {warnings.map((w) => <p key={w} className="text-ft-gold">⚠️ {w}</p>)}
          {nothing && <p className="text-ft-green">Tout est déjà à jour ✓</p>}
          {plan.createTeams.length > 0 && <p>➕ Nouvelles écuries : {plan.createTeams.map((t) => `${t.name} (${t.bikes.join(', ')})`).join(' · ')}</p>}
          {plan.createBikes.length > 0 && <p>➕ Nouveaux vélos : {plan.createBikes.map((b) => `#${b.number}`).join(' ')}</p>}
          {plan.moveBikes.length > 0 && <p>↔️ Changent d&apos;écurie : {plan.moveBikes.map((b) => `#${b.number} ${b.from} → ${b.to}`).join(' · ')}</p>}
          {plan.updateBikes.length > 0 && (
            <details>
              <summary className="cursor-pointer">✏️ {plan.updateBikes.length} vélo(s) mis à jour (puce, parcours, catégorie)</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-white/60">
                {plan.updateBikes.map((b) => <li key={b.number}>#{b.number} : {b.changes.join(', ')}</li>)}
              </ul>
            </details>
          )}
          {plan.removeBikes.length > 0 && <p className="text-ft-red2">➖ Vélos retirés : {plan.removeBikes.map((b) => `#${b.number}`).join(' ')}</p>}
          {plan.removeTeams.length > 0 && <p className="text-ft-red2">➖ Écuries supprimées (plus aucun vélo, aucun point) : {plan.removeTeams.join(', ')}</p>}
          {plan.keptTeamsWithoutBikes.length > 0 && <p className="text-ft-gold">Gardées sans vélo (elles ont des points) : {plan.keptTeamsWithoutBikes.join(', ')}</p>}
          {!nothing && (
            <button onClick={() => window.confirm('Appliquer ces changements ?') && run(true)} disabled={busy || warnings.length > 0} className="btn-red mt-2 px-4 py-2 text-sm">
              Appliquer
            </button>
          )}
        </div>
      )}
    </details>
  )
}
