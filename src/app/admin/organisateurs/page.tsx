'use client'

import { useEffect, useState } from 'react'
import AdminGate from '@/components/AdminGate'
import AdminNav from '@/components/AdminNav'

type Organizer = { id: string; displayName: string; createdAt: string }
type CreatedOrganizer = { displayName: string; pin: string }

export default function OrganisateursPage() {
  const [organizers, setOrganizers] = useState<Organizer[]>([])
  const [namesText, setNamesText] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CreatedOrganizer[] | null>(null)

  const load = () => fetch('/api/organizers').then((r) => r.json()).then(setOrganizers)
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    setError('')
    const displayNames = namesText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (displayNames.length === 0) return
    const res = await fetch('/api/organizers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayNames }),
    })
    const body = await res.json()
    if (!res.ok) return setError(body.error)
    setCreated(body.organizers)
    setNamesText('')
    load()
  }

  return (
    <AdminGate>
      {() => (
        <main className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
          <AdminNav />
          <h1 className="font-mono-race text-2xl font-bold mb-2">🎮 Organisateurs de mini-jeux</h1>
          <p className="text-white/40 text-sm mb-6">
            Seul le comité peut créer ces comptes — évite que n&apos;importe qui s&apos;auto-inscrive et crédite des points (triche).
          </p>

          <div className="card p-5 mb-6">
            <p className="font-mono-race font-bold text-sm mb-2">Créer des accès</p>
            <p className="text-white/40 text-xs mb-3">Un nom par ligne.</p>
            <textarea
              value={namesText} onChange={(e) => setNamesText(e.target.value)}
              rows={4} placeholder={'Julie\nMarc\nSophie'}
              className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2 mb-3 font-mono text-sm"
            />
            {error && <p className="text-ft-red2 text-sm mb-2">{error}</p>}
            <button onClick={handleCreate} className="bg-ft-red text-white font-mono-race font-bold px-4 py-2 rounded-lg text-sm">
              Créer
            </button>
          </div>

          {created && (
            <div className="card p-5 mb-6 border-ft-gold" style={{ borderWidth: 2 }}>
              <p className="font-mono-race font-bold text-sm mb-2">✅ PIN à distribuer (affichés une seule fois) :</p>
              <table className="w-full text-sm">
                <tbody className="font-mono">
                  {created.map((o) => (
                    <tr key={o.displayName} className="border-t border-white/10">
                      <td className="pr-4 py-1.5">{o.displayName}</td>
                      <td className="py-1.5 font-bold text-ft-gold">{o.pin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-5">
            <p className="font-mono-race font-bold text-sm mb-3">Comptes existants ({organizers.length})</p>
            <div className="space-y-1">
              {organizers.map((o) => (
                <p key={o.id} className="text-sm font-mono-race">{o.displayName}</p>
              ))}
              {organizers.length === 0 && <p className="text-white/40 text-sm">Aucun organisateur créé.</p>}
            </div>
          </div>
        </main>
      )}
    </AdminGate>
  )
}
