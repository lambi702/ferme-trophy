'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import StaffGate, { type StaffUser } from '@/components/staff/StaffGate'
import AwardPoints from '@/components/staff/AwardPoints'
import SpendPoints from '@/components/staff/SpendPoints'
import EcuriesManager from '@/components/staff/EcuriesManager'
import CatalogManager from '@/components/staff/CatalogManager'
import ActivityLog from '@/components/staff/ActivityLog'
import { LiveDot, RaceClock, Spinner, useToast } from '@/components/ui'
import { useLive } from '@/lib/useLive'

type Tab = 'points' | 'boutique' | 'ecuries' | 'historique'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'points', icon: '⭐', label: 'Points' },
  { id: 'boutique', icon: '🛒', label: 'Bonus/Malus' },
  { id: 'ecuries', icon: '🏎️', label: 'Écuries' },
  { id: 'historique', icon: '📜', label: 'Historique' },
]

export default function OrganisateurPage() {
  return <StaffGate>{(staff, logout) => <Console staff={staff} logout={logout} />}</StaffGate>
}

function Console({ staff, logout }: { staff: StaffUser; logout: () => void }) {
  const { data, live, stale } = useLive()
  const [tab, setTab] = useState<Tab>('points')
  const [showCatalog, setShowCatalog] = useState(false)
  const toast = useToast()

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab') as Tab | null
    if (fromUrl && TABS.some((t) => t.id === fromUrl)) return setTab(fromUrl)
    try {
      const saved = localStorage.getItem('ft_org_tab') as Tab | null
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved)
    } catch { /* ignore */ }
  }, [])
  const select = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem('ft_org_tab', t) } catch { /* ignore */ }
    window.scrollTo({ top: 0 })
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0a0c]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ft-red">Direction de course</p>
            <p className="truncate font-mono-race text-xl">{TABS.find((t) => t.id === tab)?.icon} {TABS.find((t) => t.id === tab)?.label}</p>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <LiveDot live={live} stale={stale} />
            <RaceClock race={data?.race} />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-white/40">
          <span>{staff.role === 'admin' ? '🛠️' : '🎮'} {staff.name}</span>
          <span className="flex gap-3">
            {staff.role === 'admin' && <Link href="/admin" className="hover:text-white">Admin</Link>}
            <Link href="/" className="hover:text-white">Live</Link>
            <button onClick={logout} className="hover:text-white">Déconnexion</button>
          </span>
        </div>
      </header>

      <div className="px-4 pt-4">
        {!data ? (
          <Spinner />
        ) : (
          <>
            {tab === 'points' && <AwardPoints teams={data.teams} toast={toast.show} />}
            {tab === 'boutique' && (
              <>
                <SpendPoints teams={data.teams} bikes={data.bikes} catalog={data.catalog} toast={toast.show} />
                <div className="border-t border-white/[0.06] pb-32 pt-4">
                  <button onClick={() => setShowCatalog(!showCatalog)} className="mb-2 text-sm font-semibold text-white/50 hover:text-white">
                    {showCatalog ? '▾' : '▸'} Gérer le catalogue (prix, effets)
                  </button>
                  {showCatalog && <CatalogManager toast={toast.show} />}
                </div>
              </>
            )}
            {tab === 'ecuries' && <EcuriesManager toast={toast.show} />}
            {tab === 'historique' && <ActivityLog isAdmin={staff.role === 'admin'} toast={toast.show} />}
          </>
        )}
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#0d0d10]/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-2 pt-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => select(t.id)} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 ${tab === t.id ? 'text-white' : 'text-white/40'}`}>
              <span className={`text-xl ${tab === t.id ? '' : 'grayscale'}`}>{t.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{t.label}</span>
              <span className={`h-0.5 w-6 rounded-full ${tab === t.id ? 'bg-ft-red' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
      </nav>
      {toast.node}
    </main>
  )
}
