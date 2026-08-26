'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminGate from '@/components/AdminGate'
import AdminNav from '@/components/AdminNav'

type Team = {
  id: string
  unitName: string
  slug: string
  dossardNumber: number | null
  foulardEmoji: string
}

type CreatedTeam = { unitName: string; slug: string; pin: string }

export default function EquipesPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [namesText, setNamesText] = useState('')
  const [importError, setImportError] = useState('')
  const [created, setCreated] = useState<CreatedTeam[] | null>(null)
  const [dossardDrafts, setDossardDrafts] = useState<Record<string, string>>({})
  const [dossardError, setDossardError] = useState<Record<string, string>>({})

  const load = () => fetch('/api/teams').then((r) => r.json()).then(setTeams)
  useEffect(() => { load() }, [])

  const handleImport = async (confirm = false) => {
    setImportError('')
    const unitNames = namesText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (unitNames.length === 0) return

    const res = await fetch('/api/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitNames, confirm }),
    })
    const body = await res.json()
    if (!res.ok) {
      if (res.status === 409 && confirm === false) {
        if (window.confirm(`${body.error}\n\nContinuer quand même ?`)) return handleImport(true)
      }
      setImportError(body.error)
      return
    }
    setCreated(body.teams)
    setNamesText('')
    load()
  }

  const handleDossard = async (teamId: string) => {
    setDossardError((prev) => ({ ...prev, [teamId]: '' }))
    const value = dossardDrafts[teamId]
    const res = await fetch(`/api/teams/${teamId}/dossard`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dossardNumber: value === '' ? null : Number(value) }),
    })
    const body = await res.json()
    if (!res.ok) {
      setDossardError((prev) => ({ ...prev, [teamId]: body.error }))
      return
    }
    load()
  }

  return (
    <AdminGate>
      {() => (
        <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
          <AdminNav />
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-mono-race text-2xl font-bold">🏎️ Équipes</h1>
            <Link href="/admin/equipes/qrcodes" className="bg-ft-gold text-ft-bg font-mono-race font-bold text-sm px-4 py-2 rounded-lg">
              📱 QR codes
            </Link>
          </div>

          <div className="card p-5 mb-6">
            <p className="font-mono-race font-bold text-sm mb-2">Import (one-shot)</p>
            <p className="text-white/40 text-xs mb-3">
              Un nom d'unité par ligne. MVP volontairement simple — à adapter dès qu'on a le vrai format du CSV d'inscription.
            </p>
            <textarea
              value={namesText} onChange={(e) => setNamesText(e.target.value)}
              rows={5} placeholder={'Unité Faucons\nUnité Loups\nUnité Aigles...'}
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2 mb-3 font-mono text-sm"
            />
            {importError && <p className="text-ft-red2 text-sm mb-2">{importError}</p>}
            <button onClick={() => handleImport(false)} className="bg-ft-red text-white font-mono-race font-bold px-4 py-2 rounded-lg text-sm">
              Importer
            </button>
          </div>

          {created && (
            <div className="card p-5 mb-6 border-ft-gold" style={{ borderWidth: 2 }}>
              <p className="font-mono-race font-bold text-sm mb-2">✅ {created.length} équipe(s) créée(s) — PIN à distribuer (affichés une seule fois) :</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-white/40 text-left">
                    <tr><th className="pr-4 py-1">Unité</th><th className="pr-4 py-1">URL</th><th className="py-1">PIN</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {created.map((t) => (
                      <tr key={t.slug} className="border-t border-white/10">
                        <td className="pr-4 py-1.5">{t.unitName}</td>
                        <td className="pr-4 py-1.5 text-white/50">/equipe/{t.slug}</td>
                        <td className="py-1.5 font-bold text-ft-gold">{t.pin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card p-5">
            <p className="font-mono-race font-bold text-sm mb-3">Toutes les équipes ({teams.length})</p>
            <div className="space-y-2">
              {teams.map((t) => (
                <div key={t.id} className="bg-ft-carbon rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-mono-race font-bold text-sm">{t.foulardEmoji} {t.unitName}</p>
                    <p className="text-white/30 text-xs">/equipe/{t.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Dossard"
                      defaultValue={t.dossardNumber ?? ''}
                      onChange={(e) => setDossardDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      className="w-24 bg-ft-panel border border-white/10 rounded-lg px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => handleDossard(t.id)}
                      className="bg-ft-gold text-ft-bg font-mono-race font-bold text-xs px-3 py-1.5 rounded-lg"
                    >
                      Assigner
                    </button>
                  </div>
                  {dossardError[t.id] && <p className="w-full text-ft-red2 text-xs">{dossardError[t.id]}</p>}
                </div>
              ))}
              {teams.length === 0 && <p className="text-white/40 text-sm">Aucune équipe importée.</p>}
            </div>
          </div>
        </main>
      )}
    </AdminGate>
  )
}
