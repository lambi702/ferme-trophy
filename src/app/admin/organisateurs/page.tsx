'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminShell from '@/components/AdminShell'
import { api } from '@/components/ui'

type Organizer = { id: string; displayName: string; createdAt: string }
type Created = { displayName: string; pin: string }
type Toast = (msg: string, kind?: 'ok' | 'error') => void

export default function OrganisateursPage() {
  return (
    <AdminShell title="Organisateurs" subtitle="Seul le comité crée ces accès (pas d'auto-inscription : sinon n'importe qui pourrait se créditer des points).">
      {({ toast }) => <Organizers toast={toast} />}
    </AdminShell>
  )
}

function Organizers({ toast }: { toast: Toast }) {
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [namesText, setNamesText] = useState('')
  const [created, setCreated] = useState<Created[] | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await api<Organizer[]>('/api/organizers')
    if (ok) setOrganizers(data)
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    const displayNames = namesText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (displayNames.length === 0) return
    const { ok, data } = await api<{ organizers: Created[] }>('/api/organizers', 'POST', { displayNames })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setCreated(data.organizers)
    setNamesText('')
    load()
  }
  const resetPin = async (o: Organizer) => {
    if (!window.confirm(`Générer un nouveau PIN pour ${o.displayName} ? L'ancien ne marchera plus.`)) return
    const { ok, data } = await api<Created>(`/api/organizers/${o.id}`, 'PATCH')
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setCreated([data])
  }
  const remove = async (o: Organizer) => {
    if (!window.confirm(`Supprimer l'accès de ${o.displayName} ? (son historique reste)`)) return
    await api(`/api/organizers/${o.id}`, 'DELETE')
    load()
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-3 p-4">
        <h2 className="font-mono-race text-xl">Créer des accès</h2>
        <textarea value={namesText} onChange={(e) => setNamesText(e.target.value)} rows={4} placeholder={'Un prénom par ligne\nJulie\nMarc'} className="input font-mono text-sm" />
        <button onClick={create} disabled={!namesText.trim()} className="btn-red px-4 py-2 text-sm">Créer</button>
      </section>

      {created && (
        <section className="card slide-up border-ft-gold/50 p-4">
          <p className="mb-2 font-mono-race text-lg">🔑 PIN à distribuer (affichés une seule fois)</p>
          <div className="space-y-1">
            {created.map((o) => (
              <div key={o.displayName} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                <span className="font-bold">{o.displayName}</span>
                <span className="font-mono-race text-2xl tracking-[0.3em] text-ft-gold">{o.pin}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40">Connexion sur {typeof window !== 'undefined' ? window.location.host : ''}/organisateur avec le prénom exact + le PIN.</p>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 font-mono-race text-xl">Comptes ({organizers.length})</h2>
        <div className="space-y-1.5">
          {organizers.map((o) => (
            <div key={o.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="flex-1 font-bold">{o.displayName}</span>
              <button onClick={() => resetPin(o)} className="chip text-xs">Nouveau PIN</button>
              <button onClick={() => remove(o)} className="chip text-xs text-ft-red2">Supprimer</button>
            </div>
          ))}
          {organizers.length === 0 && <p className="text-sm text-white/40">Aucun organisateur.</p>}
        </div>
      </section>
    </div>
  )
}
