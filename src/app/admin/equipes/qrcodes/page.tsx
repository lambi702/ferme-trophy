'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import AdminGate from '@/components/AdminGate'

type Team = {
  id: string
  unitName: string
  slug: string
  dossardNumbers: number[]
  foulardName: string
  foulardEmoji: string
}

export default function QrCodesPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch('/api/teams').then((r) => r.json()).then((data: Team[]) => {
      setTeams([...data].sort((a, b) => (a.dossardNumbers[0] ?? 999) - (b.dossardNumbers[0] ?? 999)))
    })
  }, [])

  return (
    <AdminGate>
      {() => (
        <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <Link href="/admin/equipes" className="font-mono-race text-ft-silver text-sm">← Équipes</Link>
            <button
              onClick={() => window.print()}
              className="bg-ft-red text-white font-mono-race font-bold px-4 py-2 rounded-lg text-sm"
            >
              🖨️ Imprimer tout
            </button>
          </div>

          <h1 className="font-mono-race text-2xl font-bold mb-1 print:hidden">📱 QR codes des équipes</h1>
          <p className="text-white/40 text-sm mb-6 print:hidden">
            Un QR code par équipe → mène à sa page publique <code>/equipe/&#123;slug&#125;</code>. À découper et coller sur chaque vélo (une équipe avec plusieurs dossards : colle le même QR sur chaque vélo).
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-3 print:gap-6">
            {teams.map((team) => (
              <div
                key={team.id}
                className="card p-4 flex flex-col items-center text-center gap-2 print:border print:border-black print:break-inside-avoid"
              >
                <p className="font-mono-race font-bold text-lg print:text-black">
                  {team.dossardNumbers.length > 0 ? team.dossardNumbers.map((n) => `#${n}`).join(' ') : '?'} {team.foulardEmoji}
                </p>
                <div className="bg-white p-2 rounded-lg">
                  <QRCodeSVG value={`${origin}/equipe/${team.slug}`} size={128} />
                </div>
                <p className="font-mono-race font-bold text-sm print:text-black">{team.foulardName || team.unitName || '(équipe vierge)'}</p>
                <p className="text-white/40 text-xs print:text-black/60">{team.unitName}</p>
              </div>
            ))}
            {teams.length === 0 && <p className="text-white/40 text-sm print:hidden">Aucune équipe.</p>}
          </div>
        </div>
      )}
    </AdminGate>
  )
}
