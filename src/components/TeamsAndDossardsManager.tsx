'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Team = {
  id: string
  slug: string
  pin: string
  unitName: string
  sectionName: string
  foulardName: string
  foulardEmoji: string
  dossardNumbers: number[]
}

type Dossard = {
  id: string
  number: number
  teamId: string | null
  team: { id: string; unitName: string; sectionName: string; foulardEmoji: string } | null
}

export default function TeamsAndDossardsManager({ showQrLink = false }: { showQrLink?: boolean }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [dossards, setDossards] = useState<Dossard[]>([])
  const [lastCreatedPin, setLastCreatedPin] = useState<{ slug: string; pin: string } | null>(null)
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(20)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const loadTeams = () => fetch('/api/teams').then((r) => r.json()).then(setTeams)
  const loadDossards = () => fetch('/api/dossards').then((r) => r.json()).then(setDossards)

  useEffect(() => { loadTeams(); loadDossards() }, [])

  const handleCreateTeam = async () => {
    setError('')
    const res = await fetch('/api/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 }),
    })
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    setLastCreatedPin(body.teams[0])
    loadTeams()
  }

  const handleCreateDossards = async () => {
    setError('')
    const res = await fetch('/api/dossards', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: rangeFrom, to: rangeTo }),
    })
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    loadDossards()
  }

  const handleAssign = async (dossardId: string, teamId: string) => {
    await fetch(`/api/dossards/${dossardId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: teamId || null }),
    })
    loadDossards()
    loadTeams()
  }

  const copyPin = (team: Team) => {
    navigator.clipboard.writeText(team.pin)
    setCopiedId(team.id)
    setTimeout(() => setCopiedId(''), 1200)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={handleCreateTeam} className="bg-ft-red text-white font-mono-race font-bold px-4 py-2 rounded-lg text-sm">
          ➕ Créer une équipe vierge
        </button>
        {showQrLink && (
          <Link href="/admin/equipes/qrcodes" className="bg-ft-gold text-ft-bg font-mono-race font-bold text-sm px-4 py-2 rounded-lg">
            📱 QR codes
          </Link>
        )}
      </div>

      {error && <p className="text-ft-red2 text-sm">{error}</p>}

      {lastCreatedPin && (
        <div className="card p-4 border-ft-gold" style={{ borderWidth: 2 }}>
          <p className="font-mono-race font-bold text-sm">
            ✅ Équipe créée — <code>/equipe/{lastCreatedPin.slug}</code> — PIN : <span className="text-ft-gold font-bold">{lastCreatedPin.pin}</span>
          </p>
          <p className="text-white/40 text-xs mt-1">Elle est vierge : à distribuer avec un dossard, la section la personnalisera elle-même.</p>
        </div>
      )}

      <div className="card p-5">
        <p className="font-mono-race font-bold text-sm mb-3">🔢 Dossards (vélos)</p>
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input type="number" value={rangeFrom} onChange={(e) => setRangeFrom(Number(e.target.value))}
            className="w-24 bg-ft-carbon border border-white/10 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-white/40 text-sm">à</span>
          <input type="number" value={rangeTo} onChange={(e) => setRangeTo(Number(e.target.value))}
            className="w-24 bg-ft-carbon border border-white/10 rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={handleCreateDossards} className="bg-ft-gold text-ft-bg font-mono-race font-bold text-xs px-3 py-1.5 rounded-lg">
            Créer la plage
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-1.5 max-h-96 overflow-y-auto pr-1">
          {dossards.map((d) => (
            <div key={d.id} className="bg-ft-carbon rounded-lg p-2 flex items-center justify-between gap-2">
              <span className="font-mono-race font-bold text-sm w-10">#{d.number}</span>
              <select
                value={d.teamId ?? ''}
                onChange={(e) => handleAssign(d.id, e.target.value)}
                className="flex-1 bg-ft-panel border border-white/10 rounded-lg px-2 py-1 text-xs min-w-0"
              >
                <option value="">— non assigné —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.foulardEmoji} {t.unitName || '(équipe vierge)'} {t.sectionName && `— ${t.sectionName}`}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {dossards.length === 0 && <p className="text-white/40 text-sm">Aucun dossard créé.</p>}
        </div>
      </div>

      <div className="card p-5">
        <p className="font-mono-race font-bold text-sm mb-3">🏎️ Équipes ({teams.length})</p>
        <div className="space-y-2">
          {teams.map((t) => (
            <div key={t.id} className="bg-ft-carbon rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-mono-race font-bold text-sm">
                  {t.foulardEmoji} {t.unitName || <span className="text-white/30 italic">équipe vierge</span>}
                  {t.sectionName && ` — ${t.sectionName}`}
                </p>
                <p className="text-white/30 text-xs">
                  /equipe/{t.slug} · dossards : {t.dossardNumbers.length > 0 ? t.dossardNumbers.map((n) => `#${n}`).join(' ') : 'aucun'}
                </p>
              </div>
              <button
                onClick={() => copyPin(t)}
                className="bg-ft-panel border border-white/10 font-mono-race font-bold text-sm px-3 py-1.5 rounded-lg"
                title="Copier le PIN"
              >
                PIN : <span className="text-ft-gold">{t.pin}</span> {copiedId === t.id ? '✓' : '📋'}
              </button>
            </div>
          ))}
          {teams.length === 0 && <p className="text-white/40 text-sm">Aucune équipe créée.</p>}
        </div>
      </div>
    </div>
  )
}
