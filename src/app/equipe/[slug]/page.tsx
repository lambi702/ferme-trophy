'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLive, useMyTeam, useNow } from '@/lib/useLive'
import type { FeedItem } from '@/lib/live-types'
import { bikeLabel } from '@/lib/live-types'
import { plural, relTime, signed, textOn } from '@/lib/format'
import { BackLink, Empty, FeedRow, Medal, NumberPlate, Spinner, TeamBadge, api, useToast } from '@/components/ui'

type TeamDetail = {
  id: string
  slug: string
  name: string
  unitName: string
  sectionName: string
  foulardName: string
  foulardColor: string
  foulardEmoji: string
  bikes: { number: number; name: string }[]
  feed: FeedItem[]
}

type Draft = {
  foulardName: string
  unitName: string
  sectionName: string
  foulardColor: string
  foulardEmoji: string
  bikes: Record<number, string>
}

const COLORS = ['#e10600', '#ff8700', '#ffd60a', '#00d26a', '#0e9f6e', '#00d4ff', '#1e5bc6', '#6b2bd9', '#d61f8c', '#ff5fa2', '#8b5a2b', '#c7c7cc', '#f2f2f4', '#2b2b30']
const EMOJIS = [
  '🏁', '🏎️', '🚲', '🔥', '⚡', '💥', '🚀', '⭐', '🏆', '👑', '💎', '🎯',
  '🦅', '🐺', '🦁', '🐯', '🐆', '🐉', '🦊', '🐻', '🐗', '🦉', '🐍', '🦈',
  '🐝', '🦄', '🐸', '🐙', '🦖', '🐄', '🐓', '🐑', '🚜', '🌽', '🍀', '🌪️',
  '☄️', '🌈', '🍕', '🥖', '🍺', '🧀', '🎸', '🤘', '👻', '🤖', '🛞', '🪖',
]

export default function EquipePage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { data: live } = useLive()
  const now = useNow(10000)
  const [mySlug, setMySlug] = useMyTeam()
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const toast = useToast()

  const loadDetail = useCallback(async () => {
    const { ok, data } = await api<TeamDetail>(`/api/teams/${slug}`)
    if (!ok) return setNotFound(true)
    setDetail(data)
  }, [slug])

  useEffect(() => {
    loadDetail()
    api<{ slug: string }>('/api/team/me').then(({ ok, data }) => setUnlocked(ok && data.slug === slug))
    const t = setInterval(loadDetail, 15000)
    return () => clearInterval(t)
  }, [slug, loadDetail])

  const startEditing = () => {
    if (!detail) return
    setDraft({
      foulardName: detail.foulardName,
      unitName: detail.unitName,
      sectionName: detail.sectionName,
      foulardColor: detail.foulardColor,
      foulardEmoji: detail.foulardEmoji,
      bikes: Object.fromEntries(detail.bikes.map((b) => [b.number, b.name])),
    })
    setEditing(true)
  }

  const save = async () => {
    if (!draft) return
    const { ok, data } = await api(`/api/teams/${slug}/foulard`, 'PATCH', {
      ...draft,
      bikes: Object.entries(draft.bikes).map(([number, name]) => ({ number: Number(number), name })),
    })
    if (!ok) return toast.show(data.error ?? 'Erreur', 'error')
    toast.show('Écurie mise à jour ✓')
    setEditing(false)
    loadDetail()
  }

  const lock = async () => {
    await api('/api/team/logout', 'POST')
    setUnlocked(false)
    setEditing(false)
  }

  if (notFound) return <main className="mx-auto max-w-lg px-4 py-8"><BackLink href="/" label="Live" /><Empty icon="🤷" title="Écurie introuvable" hint="Le lien est peut-être incomplet. Retourne au classement pour la retrouver." /></main>
  if (!detail) return <Spinner />

  const liveTeam = live?.teams.find((t) => t.id === detail.id)
  const liveBikes = live?.bikes.filter((b) => b.teamId === detail.id) ?? []
  // Pendant l'édition, la carte d'en-tête montre le brouillon (aperçu en direct).
  const view = editing && draft
    ? { name: draft.foulardName || detail.name, color: draft.foulardColor, emoji: draft.foulardEmoji, unit: draft.unitName, section: draft.sectionName }
    : { name: detail.name, color: detail.foulardColor, emoji: detail.foulardEmoji, unit: detail.unitName, section: detail.sectionName }
  const isMine = mySlug === slug

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 pb-32 pt-4">
      <BackLink href="/" label="Classement live" />

      {/* En-tête aux couleurs de l'écurie */}
      <section
        className="relative mt-3 overflow-hidden rounded-3xl border p-5"
        style={{ borderColor: `${view.color}88`, background: `linear-gradient(150deg, ${view.color}55 0%, ${view.color}18 45%, #141417 80%)` }}
      >
        <div className="checker-bg absolute -right-6 -top-6 h-24 w-24 rotate-12 opacity-[0.07]" />
        <div className="flex items-center gap-4">
          <TeamBadge emoji={view.emoji} color={view.color} size={76} />
          <div className="min-w-0 flex-1">
            <h1 className="font-mono-race text-3xl leading-[0.95]">{view.name}</h1>
            {(view.unit || view.section) && <p className="mt-1 text-sm text-white/60">{[view.unit, view.section].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
        <button
          onClick={() => setMySlug(isMine ? null : slug)}
          className={`mt-4 rounded-full px-3 py-1.5 text-xs font-bold transition ${isMine ? 'bg-ft-gold text-black' : 'bg-black/30 text-white/70 hover:text-white'}`}
        >
          {isMine ? '⭐ Mon écurie' : '☆ C\'est mon écurie'}
        </button>
      </section>

      {/* Chiffres clés */}
      <section className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Points" value={liveTeam?.points ?? '—'} tone="gold" sub={liveTeam ? `#${liveTeam.pointsRank} au général` : undefined} />
        <Stat label="Tours" value={liveTeam?.totalLaps ?? '—'} sub={plural(detail.bikes.length, 'vélo')} />
        <Stat label="Meilleur vélo" value={liveTeam?.bestRank ? `P${liveTeam.bestRank}` : '—'} sub={live ? `sur ${live.contests.find((c) => c.key === liveBikes[0]?.group)?.bikes ?? live.bikes.length}` : undefined} />
      </section>

      {/* Vélos */}
      <section className="mt-6">
        <h2 className="mb-2 font-mono-race text-lg">{detail.bikes.length > 1 ? 'Nos vélos' : 'Notre vélo'}</h2>
        {liveBikes.length === 0 && <p className="card p-4 text-sm text-white/45">Pas encore de dossard attribué — passe voir la direction de course.</p>}
        <div className="space-y-2">
          {liveBikes.map((b) => (
            <div key={b.dossardId} className="card flex items-center gap-3 p-3">
              <Medal rank={b.rank} className="h-11 w-11 text-xl" />
              <NumberPlate number={b.number} color={b.teamColor} className="text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{bikeLabel(b)}</p>
                <p className="text-xs text-white/45">
                  {live && live.contests.length > 1 && <span className="font-semibold text-white/70">{live.contests.find((c) => c.key === b.group)?.name} · </span>}
                  {b.lastLapAt ? `Dernier tour ${relTime(b.lastLapAt, now)}` : 'Pas encore de tour'}
                  {b.gap > 0 && ` · ${b.gap} T du leader`}
                </p>
              </div>
              {b.adjustment !== 0 && (
                <span className={`rounded-md px-1.5 py-0.5 font-mono-race text-sm ${b.adjustment > 0 ? 'bg-ft-green/15 text-ft-green' : 'bg-ft-red/20 text-ft-red2'}`}>
                  {signed(b.adjustment)}
                </span>
              )}
              <div className="text-right">
                <p className="font-mono-race tnum text-3xl leading-none">{b.laps}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">tours</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dépenser ses points */}
      <section className="mt-4 flex items-center gap-3 rounded-2xl border border-ft-gold/25 bg-ft-gold/[0.06] p-4">
        <span className="text-2xl">🛒</span>
        <p className="text-sm text-white/75">
          Pour transformer vos <span className="font-bold text-ft-gold">{liveTeam?.points ?? 0} points</span> en tours bonus (ou en malus pour les autres),
          venez voir la <span className="font-bold">direction de course</span>.
        </p>
      </section>

      {/* Personnalisation */}
      <section className="mt-6">
        {!unlocked ? (
          <UnlockCard slug={slug} onUnlocked={() => { setUnlocked(true); setMySlug(slug); startEditing() }} />
        ) : !editing ? (
          <div className="card flex items-center gap-3 p-4">
            <span className="text-2xl">🎨</span>
            <p className="flex-1 text-sm text-white/70">Page déverrouillée — change le nom, la couleur, l&apos;emoji et le surnom de tes vélos.</p>
            <button onClick={startEditing} className="btn-red px-4 py-2 text-sm">Personnaliser</button>
          </div>
        ) : draft && (
          <Editor draft={draft} setDraft={setDraft} bikes={detail.bikes} onCancel={() => setEditing(false)} onLock={lock} />
        )}
      </section>

      {/* Historique */}
      <section className="mt-6">
        <h2 className="mb-2 font-mono-race text-lg">Historique</h2>
        {detail.feed.length === 0 ? (
          <p className="card p-4 text-sm text-white/45">Rien pour l&apos;instant. Les points gagnés, achats et malus subis apparaîtront ici.</p>
        ) : (
          <div className="space-y-1.5">{detail.feed.map((item) => <FeedRow key={item.id} item={item} now={now} perspectiveTeamId={detail.id} />)}</div>
        )}
      </section>

      {editing && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d0d10]/95 px-4 pt-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-lg gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost flex-1">Annuler</button>
            <button onClick={save} className="btn-red flex-[2]">Enregistrer</button>
          </div>
        </div>
      )}
      {toast.node}
    </main>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'gold' }) {
  return (
    <div className="card px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className={`font-mono-race tnum text-3xl leading-tight ${tone === 'gold' ? 'text-ft-gold' : ''}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/35">{sub}</p>}
    </div>
  )
}

function UnlockCard({ slug, onUnlocked }: { slug: string; onUnlocked: () => void }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { ok, data } = await api('/api/team/unlock', 'POST', { slug, pin })
    setBusy(false)
    if (!ok) return setError(data.error ?? 'PIN incorrect')
    onUnlocked()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="card flex w-full items-center gap-3 p-4 text-left transition hover:border-white/20">
        <span className="text-2xl">✏️</span>
        <span className="flex-1">
          <span className="block font-bold">Personnaliser l&apos;écurie</span>
          <span className="block text-xs text-white/45">Nom, couleur, emoji, surnom des vélos — avec le PIN reçu à l&apos;inscription.</span>
        </span>
        <span className="text-white/30">→</span>
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="card slide-up p-4">
      <label className="label">PIN de l&apos;écurie</label>
      <div className="flex gap-2">
        <input
          autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" placeholder="• • • • •"
          className="input text-center font-mono-race text-2xl tracking-[0.5em]"
        />
        <button disabled={pin.length < 4 || busy} className="btn-red px-5">OK</button>
      </div>
      {error && <p className="mt-2 text-sm text-ft-red2">{error}</p>}
      <p className="mt-2 text-xs text-white/35">PIN perdu ? La direction de course peut le retrouver.</p>
    </form>
  )
}

function Editor({
  draft, setDraft, bikes, onCancel, onLock,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  bikes: { number: number; name: string }[]
  onCancel: () => void
  onLock: () => void
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  return (
    <div className="card slide-up space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono-race text-lg">🎨 Personnaliser</h2>
        <button onClick={onLock} className="text-xs font-semibold text-white/40 hover:text-white">🔒 Verrouiller</button>
      </div>

      <div>
        <label className="label">Nom d&apos;écurie — affiché partout</label>
        <input value={draft.foulardName} onChange={(e) => set({ foulardName: e.target.value })} maxLength={60} placeholder="ex : Scuderia Faucons Rouges" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Unité</label>
          <input value={draft.unitName} onChange={(e) => set({ unitName: e.target.value })} maxLength={80} placeholder="ex : 3e Embourg" className="input" />
        </div>
        <div>
          <label className="label">Section</label>
          <input value={draft.sectionName} onChange={(e) => set({ sectionName: e.target.value })} maxLength={60} placeholder="ex : Pionniers" className="input" />
        </div>
      </div>

      <div>
        <label className="label">Couleur</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c} onClick={() => set({ foulardColor: c })} aria-label={c}
              className={`h-9 w-9 rounded-full transition ${draft.foulardColor.toLowerCase() === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#141417]' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-white/30 text-xs text-white/50" title="Couleur perso">
            +
            <input type="color" value={draft.foulardColor} onChange={(e) => set({ foulardColor: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>
        <p className="mt-2 inline-block rounded-md px-2 py-1 font-mono-race text-sm" style={{ backgroundColor: draft.foulardColor, color: textOn(draft.foulardColor) }}>
          Aperçu dossard #{bikes[0]?.number ?? 12}
        </p>
      </div>

      <div>
        <label className="label">Emoji</label>
        <div className="grid grid-cols-8 gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e} onClick={() => set({ foulardEmoji: e })}
              className={`aspect-square rounded-lg text-xl transition ${draft.foulardEmoji === e ? 'bg-ft-red/30 ring-2 ring-ft-red' : 'bg-white/[0.04] hover:bg-white/10'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          value={draft.foulardEmoji} onChange={(e) => set({ foulardEmoji: [...e.target.value].slice(-2).join('') })}
          placeholder="ou colle ton emoji" className="input mt-2 w-40 text-center text-xl"
        />
      </div>

      {bikes.length > 0 && (
        <div>
          <label className="label">Surnom {bikes.length > 1 ? 'des vélos' : 'du vélo'}</label>
          <div className="space-y-2">
            {bikes.map((b) => (
              <div key={b.number} className="flex items-center gap-2">
                <NumberPlate number={b.number} color={draft.foulardColor} className="text-lg" />
                <input
                  value={draft.bikes[b.number] ?? ''} maxLength={40}
                  onChange={(e) => set({ bikes: { ...draft.bikes, [b.number]: e.target.value } })}
                  placeholder={`ex : La Fusée`} className="input py-2.5"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onCancel} className="text-xs text-white/40">Fermer sans enregistrer</button>
    </div>
  )
}
