'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from '@/components/AdminShell'
import { api } from '@/components/ui'
import { useLive } from '@/lib/useLive'
import { racePhase } from '@/lib/format'

type TimingInfo = {
  config: { mode: 'off' | 'mock' | 'poll'; pushEnabled: boolean }
  status: { lastPushAt?: string; lastPollOk?: boolean }
  sources: { source: string; count: number }[]
  orphanBibs: { number: number }[]
}

export default function AdminDashboard() {
  return (
    <AdminShell title="Tableau de bord" wide>
      {({ admin }) => <Dashboard name={admin.displayName} />}
    </AdminShell>
  )
}

function Dashboard({ name }: { name: string }) {
  const { data } = useLive()
  const [timing, setTiming] = useState<TimingInfo | null>(null)
  const [organizers, setOrganizers] = useState<number | null>(null)

  useEffect(() => {
    api<TimingInfo>('/api/admin/timing').then(({ ok, data }) => ok && setTiming(data))
    api<unknown[]>('/api/organizers').then(({ ok, data }) => ok && setOrganizers(data.length))
  }, [])

  const pointsGiven = data?.teams.reduce((s, t) => s + t.earned, 0) ?? 0
  const pointsSpent = data?.teams.reduce((s, t) => s + t.spent, 0) ?? 0
  const realTiming = timing?.sources.some((s) => s.source.startsWith('raceresult')) ?? false
  const phase = racePhase(data?.race)

  // Check-list "avant le départ" — ce qui doit être vrai le jour J.
  const checks: { ok: boolean; warn?: boolean; label: string; href: string; hint: string }[] = [
    { ok: (organizers ?? 0) > 0, label: 'Comptes organisateurs créés', href: '/admin/organisateurs', hint: `${organizers ?? '…'} compte(s)` },
    { ok: (data?.teams.length ?? 0) > 0, label: 'Écuries inscrites avec leurs dossards', href: '/admin/equipes', hint: `${data?.teams.length ?? 0} écuries · ${data?.bikes.length ?? 0} vélos` },
    { ok: (data?.catalog.length ?? 0) > 0, label: 'Catalogue bonus/malus prêt', href: '/admin/marketplace', hint: `${data?.catalog.length ?? 0} item(s) actif(s)` },
    { ok: timing?.config.mode !== 'mock', warn: timing?.config.mode === 'mock', label: 'Simulation chrono coupée', href: '/admin/chrono', hint: timing?.config.mode === 'mock' ? '⚠️ la simulation tourne !' : 'OK' },
    { ok: realTiming, label: 'Passage RaceResult reçu (test avec O\'Top)', href: '/admin/chrono', hint: realTiming ? 'reçu ✓' : 'pas encore' },
    { ok: (timing?.orphanBibs.length ?? 0) === 0, warn: (timing?.orphanBibs.length ?? 0) > 0, label: 'Tous les dossards vus par le chrono sont attribués', href: '/admin/chrono', hint: timing?.orphanBibs.length ? timing.orphanBibs.map((o) => `#${o.number}`).join(' ') : 'OK' },
    { ok: phase.phase !== 'pre' || !!data?.race.startedAt, label: 'Horloge de course réglée', href: '/admin/course', hint: data?.race.startedAt ? 'départ réglé' : 'départ non donné' },
  ]

  return (
    <div className="space-y-6">
      <p className="-mt-3 text-white/50">Bonjour {name} 👋</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Écuries" value={data?.teams.length ?? '…'} />
        <Kpi label="Vélos" value={data?.bikes.length ?? '…'} />
        <Kpi label="Tours chrono" value={data?.totalLaps ?? '…'} />
        <Kpi label="Points distribués" value={pointsGiven} sub={`${pointsSpent} dépensés`} />
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-mono-race text-xl">✅ Check-list jour J</h2>
        <ul className="space-y-1.5">
          {checks.map((c) => (
            <li key={c.label}>
              <Link href={c.href} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 hover:bg-white/[0.06]">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${c.warn ? 'bg-ft-red text-white' : c.ok ? 'bg-ft-green text-black' : 'bg-white/10 text-white/40'}`}>
                  {c.warn ? '!' : c.ok ? '✓' : '·'}
                </span>
                <span className="flex-1 text-sm font-semibold">{c.label}</span>
                <span className="text-xs text-white/40">{c.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile href="/ecran" icon="📺" title="Écran géant" hint="À ouvrir en plein écran sur la TV (double-clic)" />
        <Tile href="/organisateur" icon="🎮" title="Direction de course" hint="Points, bonus/malus, inscriptions" />
        <Tile href="/" icon="📱" title="Site participants" hint="Ce que voient les téléphones" />
      </div>
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="font-mono-race tnum text-4xl leading-tight">{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </div>
  )
}

function Tile({ href, icon, title, hint }: { href: string; icon: string; title: string; hint: string }) {
  return (
    <Link href={href} className="card block p-4 transition hover:border-white/20">
      <p className="text-3xl">{icon}</p>
      <p className="mt-1 font-mono-race text-lg">{title}</p>
      <p className="text-xs text-white/45">{hint}</p>
    </Link>
  )
}
