'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type PublicInfo = {
  slug: string
  unitName: string
  dossardNumber: number | null
  foulardName: string
  foulardColor: string
  foulardEmoji: string
  rank: number | null
  adjustedLaps: number
}

type MeInfo = PublicInfo & { id: string; pointsBalance: number }

type MarketItem = {
  id: string
  name: string
  description: string
  costPoints: number
  type: 'BONUS_SELF' | 'MALUS_OTHER'
  lapEffect: number
  active: boolean
}

type OtherTeam = { id: string; slug: string; unitName: string; foulardName: string; foulardEmoji: string }

const EMOJIS = ['🏁', '🏎️', '🔥', '⚡', '🦅', '🐺', '🦁', '🐉', '⭐', '💥', '🛞', '🏆']

export default function EquipePage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const [info, setInfo] = useState<PublicInfo | null>(null)
  const [me, setMe] = useState<MeInfo | null>(null)
  const [pin, setPin] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [items, setItems] = useState<MarketItem[]>([])
  const [others, setOthers] = useState<OtherTeam[]>([])
  const [purchaseMsg, setPurchaseMsg] = useState('')
  const [foulardName, setFoulardName] = useState('')

  const loadPublic = () => fetch(`/api/teams/${slug}`).then((r) => r.json()).then(setInfo)
  const loadMe = () =>
    fetch('/api/team/me').then(async (r) => {
      if (!r.ok) return
      const data: MeInfo = await r.json()
      if (data.slug === slug) {
        setMe(data)
        setFoulardName(data.foulardName)
      }
    })
  // Catalogue + prix : public, visible sans PIN (seul l'achat est réservé).
  const loadItems = () => fetch('/api/marketplace/items').then((r) => r.json()).then(setItems)

  useEffect(() => {
    loadPublic()
    loadMe()
    loadItems()
    fetch('/api/teams/public').then((r) => r.json()).then(setOthers)
  }, [slug])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setUnlockError('')
    const res = await fetch('/api/team/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, pin }),
    })
    if (!res.ok) {
      const body = await res.json()
      setUnlockError(body.error || 'Erreur')
      return
    }
    await loadMe()
  }

  const saveFoulardField = async (field: string, value: string) => {
    const res = await fetch(`/api/teams/${slug}/foulard`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) {
      await loadMe()
      await loadPublic()
    }
  }

  const handlePurchase = async (item: MarketItem, targetTeamId?: string) => {
    setPurchaseMsg('')
    const res = await fetch('/api/marketplace/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, targetTeamId }),
    })
    const body = await res.json()
    if (!res.ok) {
      setPurchaseMsg(`❌ ${body.error}`)
    } else {
      setPurchaseMsg(`✅ ${item.name} appliqué !`)
      await loadMe()
    }
  }

  if (!info) return <main className="min-h-screen flex items-center justify-center text-white/40">Chargement...</main>

  return (
    <main className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <Link href="/classement" className="font-mono-race text-ft-silver text-sm">← Classement</Link>

      <div className="card p-6 mt-4 text-center" style={{ borderColor: info.foulardColor, borderWidth: 2 }}>
        <span className="text-6xl">{info.foulardEmoji}</span>
        <h1 className="font-mono-race text-2xl font-bold mt-2">{info.foulardName || info.unitName}</h1>
        <p className="text-white/40 text-sm">{info.unitName}</p>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div>
            <p className="text-white/40 text-xs">Dossard</p>
            <p className="font-mono-race text-2xl font-bold" style={{ color: info.foulardColor }}>#{info.dossardNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Classement</p>
            <p className="font-mono-race text-2xl font-bold">{info.rank ? `${info.rank}e` : '—'}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Tours</p>
            <p className="font-mono-race text-2xl font-bold text-ft-red">{info.adjustedLaps}</p>
          </div>
        </div>
      </div>

      {!me ? (
        <form onSubmit={handleUnlock} className="card p-5 mt-4 space-y-3">
          <p className="font-mono-race font-bold text-sm">🔒 Déverrouiller (PIN de l'équipe)</p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Code PIN"
            inputMode="numeric"
            className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2 font-mono-race text-lg tracking-widest text-center"
          />
          {unlockError && <p className="text-ft-red2 text-sm">{unlockError}</p>}
          <button className="w-full bg-ft-red text-white font-mono-race font-bold py-2.5 rounded-lg">Déverrouiller</button>
        </form>
      ) : (
        <div className="card p-5 mt-4">
          <p className="font-mono-race font-bold text-sm mb-3">⭐ Solde de points : <span className="text-ft-gold text-xl">{me.pointsBalance}</span></p>

          <p className="text-xs font-mono-race text-white/50 mb-1">Nom du foulard</p>
          <input
            value={foulardName}
            onChange={(e) => setFoulardName(e.target.value)}
            onBlur={() => saveFoulardField('foulardName', foulardName)}
            placeholder="ex: Écurie Faucons Rouges"
            className="w-full bg-ft-carbon border border-white/10 rounded-lg px-3 py-2 mb-3"
          />

          <p className="text-xs font-mono-race text-white/50 mb-1">Couleur</p>
          <input
            type="color"
            defaultValue={me.foulardColor}
            onChange={(e) => saveFoulardField('foulardColor', e.target.value)}
            className="w-16 h-9 rounded mb-3 bg-transparent"
          />

          <p className="text-xs font-mono-race text-white/50 mb-1">Emoji</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => saveFoulardField('foulardEmoji', e)}
                className={`text-xl p-1.5 rounded-md ${me.foulardEmoji === e ? 'bg-ft-red' : 'bg-white/5'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Catalogue + prix visibles par tous — seul l'achat exige le PIN de l'équipe. */}
      <div className="card p-5 mt-4">
        <p className="font-mono-race font-bold text-sm mb-1">🏪 Marketplace</p>
        {!me && <p className="text-white/40 text-xs mb-3">Déverrouille ta page ci-dessus pour pouvoir acheter.</p>}
        {purchaseMsg && <p className="text-sm mb-3">{purchaseMsg}</p>}
        <div className="space-y-3">
          {items.map((item) => (
            <MarketItemRow
              key={item.id}
              item={item}
              others={others.filter((o) => o.slug !== slug)}
              locked={!me}
              onBuy={handlePurchase}
            />
          ))}
          {items.length === 0 && <p className="text-white/40 text-sm">Aucun item disponible pour l'instant.</p>}
        </div>
      </div>
    </main>
  )
}

function MarketItemRow({
  item, others, locked, onBuy,
}: { item: MarketItem; others: OtherTeam[]; locked: boolean; onBuy: (item: MarketItem, targetTeamId?: string) => void }) {
  const [target, setTarget] = useState('')
  return (
    <div className="bg-ft-carbon rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="font-mono-race font-bold text-sm">{item.name}</p>
        {item.description && <p className="text-white/40 text-xs">{item.description}</p>}
        <p className="text-ft-gold text-xs font-mono-race font-bold">{item.costPoints} pts</p>
      </div>
      <div className="flex items-center gap-2">
        {!locked && item.type === 'MALUS_OTHER' && (
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-ft-panel border border-white/10 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">Cible...</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.foulardEmoji} {o.foulardName || o.unitName}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => onBuy(item, target || undefined)}
          disabled={locked || (item.type === 'MALUS_OTHER' && !target)}
          className="bg-ft-red text-white font-mono-race font-bold text-sm px-3 py-1.5 rounded-lg disabled:opacity-40"
        >
          {locked ? '🔒 Acheter' : 'Acheter'}
        </button>
      </div>
    </div>
  )
}
