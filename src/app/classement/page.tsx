'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSSE } from '@/lib/useSSE'

type CourseRow = {
  teamId: string
  slug: string
  unitName: string
  dossardNumber: number
  foulardName: string
  foulardColor: string
  foulardEmoji: string
  rawLaps: number
  adjustment: number
  adjustedLaps: number
  rank: number
}

type PointsRow = {
  teamId: string
  slug: string
  unitName: string
  foulardName: string
  foulardColor: string
  foulardEmoji: string
  pointsBalance: number
  rank: number
}

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`)

export default function ClassementPage() {
  const [tab, setTab] = useState<'course' | 'points'>('course')
  const course = useSSE<CourseRow[]>('/api/leaderboard/course/stream')
  const points = useSSE<PointsRow[]>('/api/leaderboard/points/stream')
  const live = tab === 'course' ? course.live : points.live

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="font-mono-race text-ft-silver text-sm">← Ferme Trophy</Link>
        <span className={`text-xs font-mono-race font-bold px-2 py-1 rounded ${live ? 'bg-ft-red text-white' : 'bg-white/10 text-white/50'}`}>
          {live ? '● LIVE' : '○ actualisation périodique'}
        </span>
      </div>

      <h1 className="font-mono-race text-3xl font-bold mb-6">🏁 CLASSEMENT</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('course')}
          className={`flex-1 py-2.5 rounded-lg font-mono-race font-bold text-sm ${tab === 'course' ? 'bg-ft-red text-white' : 'card text-white/60'}`}
        >
          🏎️ Course
        </button>
        <button
          onClick={() => setTab('points')}
          className={`flex-1 py-2.5 rounded-lg font-mono-race font-bold text-sm ${tab === 'points' ? 'bg-ft-gold text-ft-bg' : 'card text-white/60'}`}
        >
          ⭐ Points
        </button>
      </div>

      {tab === 'course' && (
        <div className="space-y-2">
          {course.data?.map((row) => (
            <Link
              key={row.teamId}
              href={`/equipe/${row.slug}`}
              className="card flex items-center gap-3 p-3 hover:border-ft-red transition"
            >
              <span className="font-mono-race font-bold text-xl w-9 text-center">{medal(row.rank)}</span>
              <span className="text-2xl">{row.foulardEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-mono-race font-bold truncate">{row.foulardName || row.unitName}</p>
                <p className="text-white/40 text-xs truncate">
                  #{row.dossardNumber} · {row.unitName}
                  {row.adjustment !== 0 && (
                    <span className={row.adjustment > 0 ? 'text-ft-gold' : 'text-ft-red2'}>
                      {' '}({row.adjustment > 0 ? '+' : ''}{row.adjustment} bonus/malus)
                    </span>
                  )}
                </p>
              </div>
              <span className="font-mono-race text-2xl font-bold text-ft-red">{row.adjustedLaps}</span>
            </Link>
          ))}
          {course.data?.length === 0 && <p className="text-white/40 text-center py-10">Aucun dossard assigné pour l'instant.</p>}
          {!course.data && <p className="text-white/40 text-center py-10">Chargement...</p>}
        </div>
      )}

      {tab === 'points' && (
        <div className="space-y-2">
          {points.data?.map((row) => (
            <Link
              key={row.teamId}
              href={`/equipe/${row.slug}`}
              className="card flex items-center gap-3 p-3 hover:border-ft-gold transition"
            >
              <span className="font-mono-race font-bold text-xl w-9 text-center">{medal(row.rank)}</span>
              <span className="text-2xl">{row.foulardEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-mono-race font-bold truncate">{row.foulardName || row.unitName}</p>
                <p className="text-white/40 text-xs truncate">{row.unitName}</p>
              </div>
              <span className="font-mono-race text-2xl font-bold text-ft-gold">{row.pointsBalance}</span>
            </Link>
          ))}
          {points.data?.length === 0 && <p className="text-white/40 text-center py-10">Aucune équipe pour l'instant.</p>}
          {!points.data && <p className="text-white/40 text-center py-10">Chargement...</p>}
        </div>
      )}
    </main>
  )
}
