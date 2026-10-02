'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLive, useMyTeam, useNow } from '@/lib/useLive'
import { useRaceAnimations } from '@/lib/useRaceAnimations'
import type { LiveBike, LiveState, LiveTeam } from '@/lib/live-types'
import { plural, relTime, signed } from '@/lib/format'
import { Empty, FeedRow, LiveDot, Medal, NumberPlate, RaceClock, Spinner, TeamBadge, api } from '@/components/ui'

type Tab = 'course' | 'ecuries' | 'boutique' | 'radio'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'course', icon: '🏁', label: 'Course' },
  { id: 'ecuries', icon: '⭐', label: 'Écuries' },
  { id: 'boutique', icon: '🛒', label: 'Boutique' },
  { id: 'radio', icon: '📻', label: 'Radio' },
]

export default function PublicLivePage() {
  const { data, live, stale } = useLive()
  const [tab, setTab] = useState<Tab>('course')
  const [mySlug, setMySlug] = useMyTeam()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ft_tab') as Tab | null
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved)
    } catch { /* ignore */ }
  }, [])
  const selectTab = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem('ft_tab', t) } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const myTeam = data?.teams.find((t) => t.slug === mySlug) ?? null

  return (
    <main className="mx-auto min-h-screen max-w-xl pb-28">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0a0c]/85 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="leading-none">
            <p className="font-mono-race text-[11px] tracking-[0.3em] text-ft-red">EMBOURG · 2026</p>
            <h1 className="font-mono-race text-2xl italic tracking-tight">FERME TROPHY</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <LiveDot live={live} stale={stale} />
            <RaceClock race={data?.race} />
          </div>
        </div>
      </header>

      {!data ? (
        <Spinner />
      ) : (
        <div className="px-4 pt-4">
          <MyTeamCard team={myTeam} bikes={data.bikes} onForget={() => setMySlug(null)} onPickFromList={() => selectTab('ecuries')} />

          {tab === 'course' && <CourseTab data={data} mySlug={mySlug} />}
          {tab === 'ecuries' && <EcuriesTab teams={data.teams} mySlug={mySlug} />}
          {tab === 'boutique' && <BoutiqueTab data={data} myTeam={myTeam} />}
          {tab === 'radio' && <RadioTab data={data} />}

          <footer className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/30">
            <Link href="/ecran" className="hover:text-white">📺 Écran géant</Link>
            <Link href="/organisateur" className="hover:text-white">🎮 Direction de course</Link>
            <Link href="/admin" className="hover:text-white">🛠️ Comité</Link>
          </footer>
        </div>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#0d0d10]/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-2 pt-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition ${tab === t.id ? 'text-white' : 'text-white/40'}`}
            >
              <span className={`text-xl transition ${tab === t.id ? 'scale-110' : 'grayscale'}`}>{t.icon}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider">{t.label}</span>
              <span className={`h-0.5 w-6 rounded-full ${tab === t.id ? 'bg-ft-red' : 'bg-transparent'}`} />
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}

function MyTeamCard({ team, bikes, onForget, onPickFromList }: { team: LiveTeam | null; bikes: LiveBike[]; onForget: () => void; onPickFromList: () => void }) {
  const router = useRouter()
  const [askPin, setAskPin] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (team) {
    const mine = bikes.filter((b) => b.teamId === team.id)
    return (
      <Link
        href={`/equipe/${team.slug}`}
        className="mb-4 block overflow-hidden rounded-2xl border p-4 transition active:scale-[0.99]"
        style={{ borderColor: `${team.color}66`, background: `linear-gradient(120deg, ${team.color}30, #141417 60%)` }}
      >
        <div className="flex items-center gap-3">
          <TeamBadge emoji={team.emoji} color={team.color} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Mon écurie</p>
            <p className="truncate font-mono-race text-xl">{team.name}</p>
            <p className="truncate text-xs text-white/50">
              {mine.length > 0 ? mine.map((b) => `#${b.number} P${b.rank}`).join(' · ') : 'Aucun vélo inscrit'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono-race tnum text-3xl leading-none text-ft-gold">{team.points}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">points</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-white/60">Voir ma page, personnaliser →</span>
          <button
            onClick={(e) => { e.preventDefault(); onForget() }}
            className="text-white/30 hover:text-white/70"
          >
            Ce n&apos;est pas mon écurie
          </button>
        </div>
      </Link>
    )
  }

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { ok, data } = await api<{ slug: string }>('/api/team/unlock', 'POST', { pin })
    setBusy(false)
    if (!ok) return setError(data.error ?? 'PIN incorrect')
    try { localStorage.setItem('ft_my_team', data.slug) } catch { /* ignore */ }
    router.push(`/equipe/${data.slug}`)
  }

  return (
    <div className="card mb-4 p-4">
      {!askPin ? (
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏎️</span>
          <div className="min-w-0 flex-1">
            <p className="font-mono-race text-lg leading-tight">Tu fais partie d&apos;une écurie ?</p>
            <p className="text-xs text-white/45">Suis tes vélos et tes points en un coup d&apos;œil.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setAskPin(true)} className="btn-red px-3 py-2 text-sm">J&apos;ai un PIN</button>
            <button onClick={onPickFromList} className="text-xs font-semibold text-white/50 hover:text-white">ou choisir →</button>
          </div>
        </div>
      ) : (
        <form onSubmit={unlock} className="slide-up">
          <label className="label">PIN de ton écurie</label>
          <div className="flex gap-2">
            <input
              autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="• • • • •"
              className="input text-center font-mono-race text-2xl tracking-[0.5em]"
            />
            <button disabled={pin.length < 4 || busy} className="btn-red px-5">OK</button>
          </div>
          {error && <p className="mt-2 text-sm text-ft-red2">{error}</p>}
          <button type="button" onClick={() => setAskPin(false)} className="mt-2 text-xs text-white/40">Annuler</button>
        </form>
      )}
    </div>
  )
}

function CourseTab({ data, mySlug }: { data: LiveState; mySlug: string | null }) {
  const anim = useRaceAnimations(data.bikes)
  const now = useNow(5000)
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const q = query.trim().toLowerCase()
  const shown = data.bikes.filter((b) =>
    (!onlyMine || b.teamSlug === mySlug) &&
    (!q || String(b.number) === q.replace('#', '') || `${b.name} ${b.teamName}`.toLowerCase().includes(q)),
  )
  if (data.bikes.length === 0) return <Empty icon="🏎️" title="Aucun vélo inscrit pour l'instant" hint="Le classement apparaîtra dès que les écuries auront reçu leurs dossards." />
  const leader = data.bikes[0]

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="font-mono-race text-xl">Classement vélos</h2>
        <p className="text-xs text-white/40">{plural(data.bikes.length, 'vélo')} · {plural(data.totalLaps, 'tour')} au total</p>
      </div>

      {leader && leader.laps > 0 && (
        <div className="mb-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-ft-gold/30 bg-gradient-to-r from-ft-gold/15 to-transparent p-3">
          <span className="text-2xl">🏆</span>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-bold">#{leader.number}{leader.name ? ` ${leader.name}` : ''}</span>
            <span className="text-white/50"> mène pour {leader.teamName}</span>
          </p>
          <span className="font-mono-race tnum text-2xl text-ft-gold">{leader.laps}</span>
        </div>
      )}

      {data.bikes.length > 12 && (
        <div className="mb-3 flex gap-2">
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="🔎 N° de dossard ou écurie" inputMode="search"
            className="input py-2.5"
          />
          {mySlug && (
            <button onClick={() => setOnlyMine(!onlyMine)} className={`chip shrink-0 ${onlyMine ? 'chip-on' : ''}`}>⭐ Les miens</button>
          )}
        </div>
      )}

      <ol className="space-y-1.5">
        {shown.length === 0 && <li className="card p-4 text-center text-sm text-white/45">Aucun vélo ne correspond.</li>}
        {shown.map((b) => {
          const mine = b.teamSlug === mySlug
          const move = anim.move(b.number)
          return (
            <li key={b.dossardId}>
              <Link
                href={`/equipe/${b.teamSlug}`}
                className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl border py-2 pl-2 pr-3 transition active:scale-[0.99] ${
                  mine ? 'border-ft-gold/50 bg-ft-gold/[0.07]' : 'border-white/[0.06] bg-[#141417]'
                }`}
              >
                <span key={anim.flashKey(b.number)} className={`pointer-events-none absolute inset-0 ${anim.flashKey(b.number) ? 'lap-flash' : ''}`} />
                <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: b.teamColor }} />
                <Medal rank={b.rank} className="ml-1 h-9 w-9 text-lg" />
                <NumberPlate number={b.number} color={b.teamColor} className="text-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold leading-tight">
                    {mine && <span className="mr-1">⭐</span>}
                    {b.name || b.teamName}
                  </p>
                  <p className="truncate text-xs text-white/45">
                    {b.teamEmoji} {b.name ? b.teamName : `Vélo #${b.number}`}
                    {b.lastLapAt && <span> · {relTime(b.lastLapAt, now)}</span>}
                  </p>
                </div>
                {move !== 0 && (
                  <span className={`font-mono-race text-sm ${move > 0 ? 'text-ft-green' : 'text-ft-red2'}`}>
                    {move > 0 ? '▲' : '▼'}{Math.abs(move)}
                  </span>
                )}
                {b.adjustment !== 0 && (
                  <span className={`rounded-md px-1.5 py-0.5 font-mono-race text-xs ${b.adjustment > 0 ? 'bg-ft-green/15 text-ft-green' : 'bg-ft-red/20 text-ft-red2'}`}>
                    {signed(b.adjustment)}
                  </span>
                )}
                <div className="w-12 text-right">
                  <p key={b.laps} className={`font-mono-race tnum text-2xl leading-none ${anim.flashKey(b.number) ? 'pop' : ''}`}>{b.laps}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">{b.gap > 0 ? `−${b.gap}` : 'tours'}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function EcuriesTab({ teams, mySlug }: { teams: LiveTeam[]; mySlug: string | null }) {
  const [sort, setSort] = useState<'points' | 'laps'>('points')
  const sorted = useMemo(
    () => (sort === 'points' ? teams : [...teams].sort((a, b) => b.totalLaps - a.totalLaps || b.points - a.points)),
    [teams, sort],
  )
  if (teams.length === 0) return <Empty icon="⭐" title="Aucune écurie inscrite" />

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-mono-race text-xl">Écuries</h2>
        <div className="flex rounded-xl bg-white/[0.05] p-1 text-xs font-bold">
          {(['points', 'laps'] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`rounded-lg px-3 py-1.5 ${sort === s ? 'bg-white text-black' : 'text-white/50'}`}>
              {s === 'points' ? '⭐ Points' : '🏁 Tours'}
            </button>
          ))}
        </div>
      </div>
      <ol className="space-y-1.5">
        {sorted.map((t, i) => (
          <li key={t.id}>
            <Link
              href={`/equipe/${t.slug}`}
              className={`flex items-center gap-3 rounded-xl border p-2.5 transition active:scale-[0.99] ${
                t.slug === mySlug ? 'border-ft-gold/50 bg-ft-gold/[0.07]' : 'border-white/[0.06] bg-[#141417]'
              }`}
            >
              <Medal rank={i + 1} className="h-8 w-8 text-base" />
              <TeamBadge emoji={t.emoji} color={t.color} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold leading-tight">{t.slug === mySlug && '⭐ '}{t.name}</p>
                <p className="truncate text-xs text-white/45">
                  {[t.unitName, t.sectionName].filter(Boolean).join(' · ') || plural(t.bikes.length, 'vélo')}
                  {t.bikes.length > 0 && ` · ${t.bikes.map((n) => `#${n}`).join(' ')}`}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-mono-race tnum text-2xl leading-none ${sort === 'points' ? 'text-ft-gold' : ''}`}>
                  {sort === 'points' ? t.points : t.totalLaps}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                  {sort === 'points' ? `pts · ${t.totalLaps} T` : `tours · ${t.points} pts`}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function BoutiqueTab({ data, myTeam }: { data: LiveState; myTeam: LiveTeam | null }) {
  const bonus = data.catalog.filter((i) => i.type === 'BONUS_SELF')
  const malus = data.catalog.filter((i) => i.type === 'MALUS_OTHER')
  return (
    <section className="space-y-5">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-ft-red/25 to-transparent px-4 py-3">
          <h2 className="font-mono-race text-xl">Comment ça marche ?</h2>
        </div>
        <ol className="space-y-3 p-4 text-sm">
          {[
            ['🎯', 'Gagne des points', 'en participant aux mini-jeux tout au long de la course.'],
            ['🏁', 'Va voir la direction de course', 'avec ton chef d\'écurie : c\'est elle qui dépense les points.'],
            ['⚡', 'Choisis ta stratégie', 'des tours bonus pour UN de tes vélos, ou un malus sur un vélo adverse.'],
          ].map(([icon, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="w-7 shrink-0 text-center text-xl">{icon}</span>
              <p><span className="font-bold">{title}</span> <span className="text-white/55">{text}</span></p>
            </li>
          ))}
        </ol>
        {myTeam && (
          <div className="border-t border-white/[0.06] px-4 py-3 text-sm">
            {myTeam.emoji} {myTeam.name} a <span className="font-mono-race text-lg text-ft-gold">{myTeam.points}</span> points à dépenser.
          </div>
        )}
      </div>

      <ItemGroup title="Bonus — pour un de tes vélos" tone="green" items={bonus} budget={myTeam?.points} />
      <ItemGroup title="Malus — sur un vélo adverse" tone="red" items={malus} budget={myTeam?.points} />
      {data.catalog.length === 0 && <Empty icon="🛒" title="Boutique pas encore ouverte" />}
    </section>
  )
}

function ItemGroup({ title, tone, items, budget }: { title: string; tone: 'green' | 'red'; items: LiveState['catalog']; budget?: number }) {
  if (items.length === 0) return null
  return (
    <div>
      <h3 className={`mb-2 text-xs font-bold uppercase tracking-[0.14em] ${tone === 'green' ? 'text-ft-green' : 'text-ft-red2'}`}>{title}</h3>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const affordable = budget === undefined || budget >= item.costPoints
          return (
            <div key={item.id} className={`card flex flex-col p-3 ${affordable ? '' : 'opacity-50'}`}>
              <p className={`font-mono-race text-3xl leading-none ${tone === 'green' ? 'text-ft-green' : 'text-ft-red2'}`}>
                {signed(item.lapEffect)}<span className="text-base"> {Math.abs(item.lapEffect) > 1 ? 'tours' : 'tour'}</span>
              </p>
              <p className="mt-1 font-bold leading-tight">{item.name}</p>
              {item.description && <p className="text-xs text-white/45">{item.description}</p>}
              <p className="mt-auto pt-2 font-mono-race tnum text-xl text-ft-gold">{item.costPoints} <span className="text-xs">pts</span></p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RadioTab({ data }: { data: LiveState }) {
  const now = useNow(10000)
  if (data.feed.length === 0) return <Empty icon="📻" title="Radio silencieuse" hint="Les points gagnés, bonus et malus s'afficheront ici en direct." />
  return (
    <section>
      <h2 className="mb-3 font-mono-race text-xl">Radio course</h2>
      <div className="space-y-1.5">
        {data.feed.map((item) => <FeedRow key={item.id} item={item} now={now} />)}
      </div>
    </section>
  )
}
