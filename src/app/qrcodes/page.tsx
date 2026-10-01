'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import StaffGate from '@/components/staff/StaffGate'
import { BackLink, api } from '@/components/ui'

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

/**
 * Fiches à imprimer : une par écurie, QR vers sa page + PIN (à découper et
 * à remettre à l'écurie à l'inscription). Option "sans PIN" pour coller sur
 * les vélos.
 */
export default function QrCodesPage() {
  return (
    <StaffGate>
      {() => <Sheets />}
    </StaffGate>
  )
}

function Sheets() {
  const [teams, setTeams] = useState<Team[]>([])
  const [origin, setOrigin] = useState('')
  const [withPin, setWithPin] = useState(true)

  useEffect(() => {
    setOrigin(window.location.origin)
    api<Team[]>('/api/teams').then(({ ok, data }) => {
      if (ok) setTeams([...data].sort((a, b) => (a.dossardNumbers[0] ?? 9999) - (b.dossardNumbers[0] ?? 9999)))
    })
  }, [])

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
        <BackLink href="/organisateur?tab=ecuries" label="Écuries" />
        <h1 className="mr-auto font-mono-race text-2xl">🖨️ Fiches QR</h1>
        <label className="chip cursor-pointer">
          <input type="checkbox" checked={withPin} onChange={(e) => setWithPin(e.target.checked)} className="accent-ft-red" />
          Afficher le PIN
        </label>
        <button onClick={() => window.print()} className="btn-red py-2 text-sm">Imprimer</button>
      </div>
      <p className="mb-5 text-sm text-white/45 print:hidden">
        Avec PIN : fiche à remettre au chef d&apos;écurie. Sans PIN : étiquette à coller sur les vélos.
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3 print:gap-4">
        {teams.map((t) => (
          <div key={t.id} className="card flex flex-col items-center gap-2 p-4 text-center print:break-inside-avoid print:rounded-none print:border print:border-dashed print:border-black print:bg-white print:text-black">
            <p className="font-mono-race text-lg">{t.foulardEmoji} {t.dossardNumbers.map((n) => `#${n}`).join(' ') || '—'}</p>
            <div className="rounded-lg bg-white p-2"><QRCodeSVG value={`${origin}/equipe/${t.slug}`} size={120} /></div>
            <p className="font-bold leading-tight">{t.foulardName || t.unitName || 'Ferme Trophy'}</p>
            {withPin && (
              <p className="font-mono-race text-sm">
                PIN <span className="text-2xl tracking-[0.2em] text-ft-gold print:text-black">{t.pin}</span>
              </p>
            )}
            <p className="text-[10px] text-white/40 print:text-black/60">{origin.replace(/^https?:\/\//, '')}/equipe/{t.slug}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
