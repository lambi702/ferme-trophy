'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useLive, useNow } from '@/lib/useLive'
import { useRaceAnimations } from '@/lib/useRaceAnimations'
import type { FeedItem, LiveBike, LiveState } from '@/lib/live-types'
import { bikeLabel } from '@/lib/live-types'
import { clockTime, racePhase, relTime, signed, textOn } from '@/lib/format'
import { feedSentence } from '@/components/ui'

/**
 * ÉCRAN GÉANT — affichage TV 16:9, aucune interaction requise.
 * Tout est dimensionné en vh/vw pour s'adapter à n'importe quelle
 * résolution. Double-clic = plein écran ; le curseur se cache tout seul.
 */
export default function EcranPage() {
  const { data, live, stale } = useLive(3000)
  const [cursorHidden, setCursorHidden] = useState(false)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const wake = () => {
      setCursorHidden(false)
      clearTimeout(t)
      t = setTimeout(() => setCursorHidden(true), 2500)
    }
    wake()
    window.addEventListener('mousemove', wake)
    return () => { window.removeEventListener('mousemove', wake); clearTimeout(t) }
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <div
      onDoubleClick={toggleFullscreen}
      className={`fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#08080a] text-white ${cursorHidden ? 'cursor-none' : ''}`}
      style={{ backgroundImage: 'radial-gradient(ellipse at 10% -20%, rgba(225,6,0,0.22), transparent 50%), radial-gradient(ellipse at 110% 120%, rgba(255,214,10,0.07), transparent 45%)' }}
    >
      <div className="checker-strip shrink-0" style={{ height: '0.7vh' }} />
      {data ? (
        <>
          <Header data={data} live={live} stale={stale} />
          <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: '1.8fr 1fr', gap: '1.2vw', padding: '0 1.4vw 1.4vw' }}>
            <Tower bikes={data.bikes} />
            <aside className="flex min-h-0 flex-col" style={{ gap: '1.2vw' }}>
              <PointsStandings data={data} />
              <Radio feed={data.feed} />
              <QrPanel />
            </aside>
          </div>
          <Announcer data={data} />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center font-mono-race text-white/40" style={{ fontSize: '4vh' }}>Connexion au live…</div>
      )}
    </div>
  )
}

function Header({ data, live, stale }: { data: LiveState; live: boolean; stale: boolean }) {
  const now = useNow(1000)
  const p = racePhase(data.race, now)
  return (
    <header className="flex shrink-0 items-center justify-between" style={{ height: '11vh', padding: '0 1.6vw' }}>
      <div className="flex items-center" style={{ gap: '1vw' }}>
        <div className="checker-bg rounded-md" style={{ width: '5.5vh', height: '5.5vh', backgroundSize: '1.4vh 1.4vh' }} />
        <div className="leading-none">
          <p className="font-mono-race italic tracking-tight" style={{ fontSize: '5.2vh' }}>FERME TROPHY</p>
          <p className="font-mono-race tracking-[0.35em] text-ft-red" style={{ fontSize: '1.7vh' }}>EMBOURG · 2026</p>
        </div>
      </div>

      <div className="flex flex-col items-center" style={{ minWidth: '28vw' }}>
        <p className="font-bold uppercase tracking-[0.3em] text-white/50" style={{ fontSize: '1.6vh' }}>
          {p.phase === 'running' ? (p.label === 'Restant' ? 'Temps restant' : 'Temps écoulé') : p.phase === 'pre' ? p.label : 'Drapeau à damier'}
        </p>
        <p className={`font-mono-race tnum leading-none ${p.phase === 'finished' ? 'text-ft-gold' : ''}`} style={{ fontSize: '6.4vh' }}>
          {p.phase === 'finished' ? '🏁 ARRIVÉE' : p.value}
        </p>
        {p.phase === 'running' && p.progress !== null && (
          <div className="mt-[0.6vh] w-full overflow-hidden rounded-full bg-white/10" style={{ height: '0.6vh' }}>
            <div className="h-full rounded-full bg-gradient-to-r from-ft-red to-ft-gold transition-all duration-1000" style={{ width: `${Math.min(100, p.progress * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="flex items-center text-right" style={{ gap: '1.6vw' }}>
        <div>
          <p className="font-bold uppercase tracking-[0.2em] text-white/45" style={{ fontSize: '1.5vh' }}>Tours bouclés</p>
          <p className="font-mono-race tnum leading-none" style={{ fontSize: '4.4vh' }}>{data.totalLaps}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-[0.2em] text-white/45" style={{ fontSize: '1.5vh' }}>{new Date(now).toLocaleDateString('fr-BE', { weekday: 'long' })}</p>
          <p className="font-mono-race tnum leading-none" style={{ fontSize: '4.4vh' }}>{clockTime(new Date(now).toISOString())}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full font-bold uppercase tracking-widest ${live && !stale ? 'bg-ft-red text-white' : 'bg-white/10 text-white/50'}`}
          style={{ fontSize: '1.7vh', padding: '0.6vh 1.1vh', gap: '0.7vh' }}
        >
          <span className={`rounded-full bg-white ${live && !stale ? 'pulse-dot' : 'opacity-40'}`} style={{ width: '1vh', height: '1vh' }} />
          {stale ? 'Hors ligne' : live ? 'Live' : 'Sync'}
        </span>
      </div>
    </header>
  )
}

// --- Tour de chronométrage (classement vélos) ------------------------------

function Tower({ bikes }: { bikes: LiveBike[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const anim = useRaceAnimations(bikes)
  const now = useNow(5000)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = bikes.length
  const cols = n <= 18 ? 1 : n <= 38 ? 2 : 3
  const perCol = Math.max(1, Math.ceil(n / cols))
  const gap = Math.max(3, size.h * 0.006)
  const rowH = size.h > 0 ? Math.min(size.h / perCol, size.h / 7) : 0
  const colW = size.w > 0 ? (size.w - (cols - 1) * gap * 3) / cols : 0

  return (
    <section className="flex min-h-0 flex-col rounded-[1.2vw] border border-white/[0.07] bg-white/[0.025]" style={{ padding: '1.2vh 1vw' }}>
      <div className="flex shrink-0 items-baseline justify-between" style={{ marginBottom: '1vh' }}>
        <h2 className="font-mono-race tracking-wide" style={{ fontSize: '3vh' }}>
          <span className="text-ft-red">▌</span>CLASSEMENT COURSE
        </h2>
        <p className="font-bold uppercase tracking-[0.2em] text-white/40" style={{ fontSize: '1.5vh' }}>{n} vélos en piste</p>
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        {n === 0 && (
          <p className="flex h-full items-center justify-center font-mono-race text-white/30" style={{ fontSize: '3.5vh' }}>En attente des inscriptions…</p>
        )}
        {rowH > 0 && bikes.map((b, i) => {
          const col = Math.floor(i / perCol)
          const row = i % perCol
          return (
            <TowerRow
              key={b.dossardId}
              bike={b}
              top={row * rowH}
              left={col * (colW + gap * 3)}
              width={colW}
              height={rowH - gap}
              fontBase={Math.min(rowH - gap, colW / 9)}
              flashKey={anim.flashKey(b.number)}
              move={anim.move(b.number)}
              now={now}
            />
          )
        })}
      </div>
    </section>
  )
}

function TowerRow({ bike: b, top, left, width, height, fontBase, flashKey, move, now }: {
  bike: LiveBike; top: number; left: number; width: number; height: number; fontBase: number; flashKey: number; move: number; now: number
}) {
  const podium = b.rank <= 3
  const medal = b.rank === 1 ? '#ffd60a' : b.rank === 2 ? '#d9d9de' : b.rank === 3 ? '#d08a52' : null
  // Taille de police bornée par la hauteur ET la largeur de colonne (sinon le nom disparaît en multi-colonnes).
  const fs = fontBase
  return (
    <div
      className="absolute flex items-center overflow-hidden rounded-[0.5vw]"
      style={{
        top, left, width, height,
        transition: 'top 0.9s cubic-bezier(0.3, 1, 0.4, 1), left 0.9s cubic-bezier(0.3, 1, 0.4, 1)',
        background: podium ? `linear-gradient(90deg, ${medal}26, rgba(255,255,255,0.035) 45%)` : 'rgba(255,255,255,0.035)',
      }}
    >
      <span key={flashKey} className={`pointer-events-none absolute inset-0 ${flashKey ? 'lap-flash' : ''}`} />
      <span
        className="flex h-full shrink-0 items-center justify-center font-mono-race tnum"
        style={{ width: fs * 1.15, fontSize: fs * 0.52, background: medal ?? 'rgba(255,255,255,0.06)', color: medal ? '#000' : '#fff' }}
      >
        {b.rank}
      </span>
      <span className="h-full shrink-0" style={{ width: Math.max(4, fs * 0.09), backgroundColor: b.teamColor }} />
      <span
        className="ml-[0.6vw] flex shrink-0 items-center justify-center rounded-[0.3vw] font-mono-race tnum"
        style={{ fontSize: fs * 0.44, height: fs * 0.66, minWidth: fs * 1.25, padding: '0 0.4vw', backgroundColor: b.teamColor, color: textOn(b.teamColor) }}
      >
        {b.number}
      </span>
      <div className="ml-[0.7vw] min-w-0 flex-1 leading-[1.05]">
        <p className="truncate font-bold" style={{ fontSize: fs * 0.42 }}>{b.name || b.teamName}</p>
        {fs > 34 && (
          <p className="truncate text-white/50" style={{ fontSize: fs * 0.27 }}>
            {b.teamEmoji} {b.name ? b.teamName : `Vélo #${b.number}`}
            {b.lastLapAt && fs > 48 && <span className="text-white/30"> · {relTime(b.lastLapAt, now)}</span>}
          </p>
        )}
      </div>
      {move !== 0 && (
        <span className={`shrink-0 font-mono-race ${move > 0 ? 'text-ft-green' : 'text-ft-red2'}`} style={{ fontSize: fs * 0.32, marginRight: '0.6vw' }}>
          {move > 0 ? '▲' : '▼'}{Math.abs(move)}
        </span>
      )}
      {b.adjustment !== 0 && (
        <span
          className={`shrink-0 rounded-[0.3vw] font-mono-race ${b.adjustment > 0 ? 'bg-ft-green/20 text-ft-green' : 'bg-ft-red/25 text-ft-red2'}`}
          style={{ fontSize: fs * 0.28, padding: `${fs * 0.04}px ${fs * 0.12}px`, marginRight: '0.6vw' }}
        >
          {signed(b.adjustment)}
        </span>
      )}
      <span className="shrink-0 text-right text-white/40 tnum font-mono-race" style={{ fontSize: fs * 0.28, width: fs * 1.2 }}>
        {b.gap > 0 ? `−${b.gap}` : b.rank === 1 && b.laps > 0 ? 'LEADER' : ''}
      </span>
      <span key={b.laps} className={`shrink-0 text-right font-mono-race tnum ${flashKey ? 'pop' : ''}`} style={{ fontSize: fs * 0.62, width: fs * 1.6, paddingRight: '0.8vw' }}>
        {b.laps}
      </span>
    </div>
  )
}

// --- Colonne de droite -------------------------------------------------------

function PointsStandings({ data }: { data: LiveState }) {
  const max = 10
  const teams = data.teams.slice(0, max)
  return (
    <section className="flex min-h-0 flex-[1.35] flex-col rounded-[1.2vw] border border-white/[0.07] bg-white/[0.025]" style={{ padding: '1.2vh 1vw' }}>
      <div className="flex shrink-0 items-baseline justify-between" style={{ marginBottom: '0.8vh' }}>
        <h2 className="font-mono-race tracking-wide" style={{ fontSize: '2.6vh' }}><span className="text-ft-gold">▌</span>ÉCURIES · POINTS</h2>
        <p className="font-bold uppercase tracking-[0.2em] text-white/40" style={{ fontSize: '1.3vh' }}>à dépenser</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col" style={{ gap: '0.5vh' }}>
        {teams.map((t) => (
          <div key={t.id} className="flex min-h-0 flex-1 items-center rounded-[0.4vw] bg-white/[0.035]" style={{ maxHeight: '5.4vh', paddingRight: '0.8vw' }}>
            <span className="flex h-full items-center justify-center font-mono-race tnum text-white/60" style={{ width: '3.6vh', fontSize: '2vh' }}>{t.pointsRank}</span>
            <span className="h-full" style={{ width: '0.35vh', backgroundColor: t.color }} />
            <span style={{ fontSize: '2.6vh', margin: '0 0.6vw' }}>{t.emoji}</span>
            <p className="min-w-0 flex-1 truncate font-bold" style={{ fontSize: '2.1vh' }}>{t.name}</p>
            <span className="text-white/35 font-mono-race tnum" style={{ fontSize: '1.6vh', marginRight: '0.8vw' }}>{t.totalLaps} T</span>
            <span className="font-mono-race tnum text-ft-gold" style={{ fontSize: '2.8vh' }}>{t.points}</span>
          </div>
        ))}
        {data.teams.length > max && (
          <p className="text-center text-white/35" style={{ fontSize: '1.5vh' }}>+ {data.teams.length - max} autres écuries sur ft.lambi-house.be</p>
        )}
        {data.teams.length === 0 && <p className="text-white/30" style={{ fontSize: '2vh' }}>Aucune écurie.</p>}
      </div>
    </section>
  )
}

function Radio({ feed }: { feed: FeedItem[] }) {
  const seen = useRef<Set<string> | null>(null)
  const items = feed.slice(0, 6)
  const fresh = new Set<string>()
  if (seen.current) items.forEach((i) => { if (!seen.current!.has(i.id)) fresh.add(i.id) })
  useEffect(() => {
    seen.current = new Set(feed.map((i) => i.id))
  }, [feed])
  const now = useNow(10000)

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[1.2vw] border border-white/[0.07] bg-white/[0.025]" style={{ padding: '1.2vh 1vw' }}>
      <h2 className="shrink-0 font-mono-race tracking-wide" style={{ fontSize: '2.6vh', marginBottom: '0.8vh' }}><span className="text-white">▌</span>RADIO COURSE</h2>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ gap: '0.6vh', maskImage: 'linear-gradient(to bottom, black 70%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent)' }}>
        {items.map((item) => {
          const { title, detail } = feedSentence(item)
          const tone = item.kind === 'bonus' ? 'text-ft-green' : item.kind === 'malus' ? 'text-ft-red2' : item.kind === 'points' ? 'text-ft-gold' : 'text-white/70'
          return (
            <div key={item.id} className={`flex shrink-0 items-center rounded-[0.4vw] bg-white/[0.035] ${fresh.has(item.id) ? 'feed-in' : ''}`} style={{ padding: '0.7vh 0.7vw', gap: '0.7vw' }}>
              <span style={{ fontSize: '2.4vh' }}>{item.team?.emoji ?? item.bike?.teamEmoji}</span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-bold" style={{ fontSize: '1.8vh' }}>{title}</p>
                <p className="truncate text-white/45" style={{ fontSize: '1.45vh' }}>{detail} · {relTime(item.at, now)}</p>
              </div>
              <span className={`font-mono-race tnum ${tone}`} style={{ fontSize: '2.4vh' }}>
                {item.kind === 'points' ? `${signed(item.points ?? 0)}` : `${signed(item.lapDelta ?? 0)} T`}
              </span>
            </div>
          )
        })}
        {items.length === 0 && <p className="text-white/30" style={{ fontSize: '1.8vh' }}>Les points, bonus et malus apparaîtront ici.</p>}
      </div>
    </section>
  )
}

function QrPanel() {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  if (!origin) return null
  return (
    <section className="flex shrink-0 items-center rounded-[1.2vw] border border-white/[0.07] bg-gradient-to-r from-ft-red/25 to-transparent" style={{ padding: '1.2vh 1vw', gap: '1vw' }}>
      <div className="rounded-[0.5vw] bg-white" style={{ padding: '0.7vh' }}>
        <QRCodeSVG value={origin} size={256} style={{ width: '10vh', height: '10vh', display: 'block' }} />
      </div>
      <div className="leading-tight">
        <p className="font-mono-race" style={{ fontSize: '2.8vh' }}>Suis la course sur ton tél 📱</p>
        <p className="text-white/60" style={{ fontSize: '1.8vh' }}>Classement, points de ton écurie, radio course</p>
        <p className="font-mono-race text-ft-gold" style={{ fontSize: '2.2vh' }}>{origin.replace(/^https?:\/\//, '')}</p>
      </div>
    </section>
  )
}

// --- Annonces plein écran (bonus/malus, nouveau leader) ------------------------

type Announcement = { id: string; tone: 'green' | 'red' | 'gold'; kicker: string; title: string; detail: string; value: string }

function Announcer({ data }: { data: LiveState }) {
  const seenFeed = useRef<Set<string> | null>(null)
  const prevLeader = useRef<number | null | undefined>(undefined)
  const [queue, setQueue] = useState<Announcement[]>([])
  const current = queue[0]

  useEffect(() => {
    const additions: Announcement[] = []
    if (seenFeed.current) {
      for (const item of [...data.feed].reverse()) {
        if (seenFeed.current.has(item.id) || (item.kind !== 'bonus' && item.kind !== 'malus')) continue
        const { title, detail } = feedSentence(item)
        additions.push({
          id: item.id,
          tone: item.kind === 'bonus' ? 'green' : 'red',
          kicker: item.kind === 'bonus' ? 'BONUS' : 'MALUS',
          title,
          detail,
          value: `${signed(item.lapDelta ?? 0)} ${Math.abs(item.lapDelta ?? 0) > 1 ? 'TOURS' : 'TOUR'}`,
        })
      }
    }
    seenFeed.current = new Set(data.feed.map((i) => i.id))

    const leader = data.bikes[0] && data.bikes[0].laps > 0 ? data.bikes[0] : null
    if (prevLeader.current !== undefined && leader && leader.number !== prevLeader.current) {
      additions.push({
        id: `leader_${leader.number}_${Date.now()}`,
        tone: 'gold',
        kicker: 'NOUVEAU LEADER',
        title: `#${leader.number} ${bikeLabel(leader)}`,
        detail: `${leader.teamEmoji} ${leader.teamName}`,
        value: `${leader.laps} TOURS`,
      })
    }
    prevLeader.current = leader?.number ?? null

    if (additions.length) setQueue((q) => [...q, ...additions].slice(-6))
  }, [data])

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => setQueue((q) => q.slice(1)), 6000)
    return () => clearTimeout(t)
  }, [current])

  if (!current) return null
  const color = current.tone === 'green' ? '#00d26a' : current.tone === 'red' ? '#e10600' : '#ffd60a'
  return (
    <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: '13vh' }}>
      <div
        key={current.id}
        className="banner-in flex items-center shadow-[0_2vh_6vh_rgba(0,0,0,0.6)]"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}dd)`, color: current.tone === 'red' ? '#fff' : '#000', padding: '2vh 3vw', gap: '2.4vw', maxWidth: '86vw' }}
      >
        <div style={{ transform: 'skewX(8deg)' }}>
          <p className="font-mono-race tracking-[0.3em] opacity-80" style={{ fontSize: '2.4vh' }}>{current.kicker}</p>
          <p className="font-mono-race leading-none" style={{ fontSize: '5.6vh' }}>{current.title}</p>
          <p className="font-bold opacity-80" style={{ fontSize: '2.4vh' }}>{current.detail}</p>
        </div>
        <p className="font-mono-race tnum leading-none" style={{ fontSize: '9vh', transform: 'skewX(8deg)' }}>{current.value}</p>
      </div>
    </div>
  )
}
