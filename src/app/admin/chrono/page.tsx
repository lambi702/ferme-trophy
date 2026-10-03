'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminShell from '@/components/AdminShell'
import { NumberPlate, api } from '@/components/ui'
import { useLive, useNow } from '@/lib/useLive'
import { relTime } from '@/lib/format'

type Config = {
  mode: 'off' | 'mock' | 'poll'
  pollUrl: string
  pollIntervalSec: number
  pushEnabled: boolean
  pushToken: string
  dataMode: 'auto' | 'passings' | 'counts'
  minLapSeconds: number
  bibField: string
  lapsField: string
  timeField: string
  idField: string
  timingPoint: string
  mockIntervalMs: number
}

type TimingInfo = {
  config: Config
  status: {
    lastPollAt?: string; lastPollOk?: boolean; lastPollError?: string; lastPollSummary?: string
    lastPushAt?: string; lastPushSummary?: string; lastPushError?: string
  }
  recent: { id: string; dossardNumber: number; timestamp: string; source: string; createdAt: string; mats: string[] }[]
  mats: { total: number; withMat: number; both: number; perMat: { mat: string; seen: number; missed: number; lastAt: string }[] }
  unknownChips: { chip: string; count: number; lastAt: string }[]
  sources: { source: string; count: number; lastAt: string | null }[]
  orphanBibs: { number: number; count: number }[]
}

type Parsed = { bib: number; laps?: number; time?: string; externalId?: string }
type Toast = (msg: string, kind?: 'ok' | 'error') => void

const SOURCE_LABEL: Record<string, string> = {
  'raceresult-push': 'RaceResult (push)',
  'raceresult-poll': 'RaceResult (poll)',
  'raceresult-push-counts': 'RaceResult (push, compteurs)',
  'raceresult-poll-counts': 'RaceResult (poll, compteurs)',
  manual: 'Manuel',
  mock: 'Simulation',
  seed: 'Démo',
}

export default function ChronoPage() {
  return (
    <AdminShell title="Chronométrage" subtitle="Brancher RaceResult (O'Top), surveiller les passages, compter à la main si besoin." wide>
      {({ toast }) => <Chrono toast={toast} />}
    </AdminShell>
  )
}

function Chrono({ toast }: { toast: Toast }) {
  const [info, setInfo] = useState<TimingInfo | null>(null)
  const now = useNow(5000)

  const load = useCallback(async () => {
    const { ok, data } = await api<TimingInfo>('/api/admin/timing')
    if (ok) setInfo(data)
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  const save = async (patch: Partial<Config> & { regenerateToken?: boolean }, msg = 'Réglage enregistré ✓') => {
    const { ok, data } = await api('/api/admin/timing', 'PUT', patch)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast(msg)
    load()
  }

  if (!info) return <p className="text-white/40">Chargement…</p>
  const { config, status } = info

  return (
    <div className="space-y-6">
      <ModeCard config={config} status={status} now={now} onMode={(mode) => save({ mode }, `Mode chrono : ${mode === 'off' ? 'arrêté' : mode === 'mock' ? 'simulation' : 'interrogation RaceResult'}`)} />

      <MatsCard info={info} now={now} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PushCard config={config} status={status} now={now} save={save} />
        <PollCard config={config} save={save} toast={toast} />
      </div>

      <AdvancedCard config={config} save={save} />
      <TestBench toast={toast} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentCard info={info} now={now} />
        <ManualCard toast={toast} />
      </div>

      <ResetLaps toast={toast} reload={load} />
    </div>
  )
}

function ModeCard({ config, status, now, onMode }: { config: Config; status: TimingInfo['status']; now: number; onMode: (m: Config['mode']) => void }) {
  const modes: { id: Config['mode']; label: string; hint: string }[] = [
    { id: 'off', label: '⏸️ Aucun daemon', hint: 'Le push RaceResult reste actif s\'il est activé.' },
    { id: 'poll', label: '🔄 Interroger RaceResult', hint: 'Le serveur va chercher les données toutes les X s.' },
    { id: 'mock', label: '🧪 Simulation', hint: 'Faux tours aléatoires — JAMAIS le jour J.' },
  ]
  return (
    <section className={`card p-4 ${config.mode === 'mock' ? 'border-ft-red' : ''}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-mono-race text-xl">Source active</h2>
        <StatusPill label="Push" ok={config.pushEnabled && !!status.lastPushAt && !status.lastPushError} on={config.pushEnabled} detail={status.lastPushAt ? relTime(status.lastPushAt, now) : 'jamais reçu'} />
        {config.mode === 'poll' && <StatusPill label="Poll" ok={!!status.lastPollOk} on detail={status.lastPollAt ? relTime(status.lastPollAt, now) : 'pas encore'} />}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onMode(m.id)}
            className={`rounded-xl border p-3 text-left transition ${
              config.mode === m.id ? (m.id === 'mock' ? 'border-ft-red bg-ft-red/15' : 'border-white bg-white/10') : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'
            }`}
          >
            <p className="font-bold">{m.label}</p>
            <p className="text-xs text-white/45">{m.hint}</p>
          </button>
        ))}
      </div>
      {config.mode === 'mock' && <p className="mt-3 rounded-lg bg-ft-red/15 p-2.5 text-sm text-ft-red2">⚠️ La simulation ajoute de FAUX tours à tous les vélos inscrits. À couper avant la course, puis « Remettre les tours à zéro » plus bas.</p>}
      {config.mode === 'poll' && status.lastPollError && <p className="mt-3 rounded-lg bg-ft-red/15 p-2.5 text-sm text-ft-red2">Dernière erreur : {status.lastPollError}</p>}
      {config.mode === 'poll' && status.lastPollSummary && !status.lastPollError && <p className="mt-3 text-sm text-white/55">Dernier poll : {status.lastPollSummary}</p>}
    </section>
  )
}

function StatusPill({ label, on, ok, detail }: { label: string; on: boolean; ok: boolean; detail: string }) {
  const color = !on ? 'bg-white/10 text-white/40' : ok ? 'bg-ft-green/15 text-ft-green' : 'bg-ft-gold/15 text-ft-gold'
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>
      {label} {on ? '●' : '○'} {on ? detail : 'off'}
    </span>
  )
}

function PushCard({ config, status, now, save }: { config: Config; status: TimingInfo['status']; now: number; save: (p: Partial<Config> & { regenerateToken?: boolean }, msg?: string) => void }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])
  const url = `${origin}/api/timing/push/${config.pushToken}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono-race text-xl">A · Push (recommandé)</h2>
        <button onClick={() => save({ pushEnabled: !config.pushEnabled }, config.pushEnabled ? 'Push désactivé' : 'Push activé')} className={`chip text-xs ${config.pushEnabled ? 'border-ft-green bg-ft-green/15' : ''}`}>
          {config.pushEnabled ? '● Activé' : '○ Désactivé'}
        </button>
      </div>
      <p className="text-sm text-white/55">
        Dans RaceResult, O&apos;Top crée un <b>Exporter</b> (déclenché à chaque passage sur la ligne) vers cette URL, en <b>HTTP GET</b> ou <b>HTTP POST</b>.
        On accepte JSON, CSV, texte ou paramètres d&apos;URL — il suffit qu&apos;il y ait le dossard.
      </p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-3 py-2.5 text-xs text-ft-gold">{url}</code>
        <button onClick={copy} className="btn-ghost px-3 py-2 text-sm">{copied ? '✓' : 'Copier'}</button>
      </div>
      <div className="rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/60">
        <p className="text-white/40"># Formats RaceResult reconnus d&apos;office (Export Data)</p>
        <p>Raw Data Record JSON · Raw Data Record V1/V2 · RunScore RSBCI</p>
        <p>[Event.ID] &amp; &quot;;&quot; &amp; [RD_TimingPoint] &amp; &quot;;&quot; &amp; [Bib] &amp; &quot;;&quot; &amp; [RD_Time]</p>
        <p className="mt-1 text-white/40"># Ou à la main</p>
        <p>GET  …/push/&lt;jeton&gt;?bib=[Bib]&amp;time=[RD_Time]</p>
        <p>POST Bib;Laps⏎12;7⏎13;6   <span className="text-white/35">(compteurs absolus)</span></p>
      </div>
      <p className="text-xs text-white/40">Le dossard doit être un numéro : un code transpondeur (ex. ZCMBG52) sans dossard associé dans RaceResult est ignoré.</p>
      {status.lastPushAt && (
        <p className={`text-sm ${status.lastPushError ? 'text-ft-red2' : 'text-white/55'}`}>
          Dernier push {relTime(status.lastPushAt, now)} : {status.lastPushError || status.lastPushSummary}
        </p>
      )}
      <button onClick={() => window.confirm('Générer une nouvelle URL ? L\'ancienne cessera de fonctionner (à redonner à O\'Top).') && save({ regenerateToken: true }, 'Nouvelle URL générée')} className="text-xs text-white/40 hover:text-white">
        ↻ Régénérer le jeton secret
      </button>
    </section>
  )
}

function PollCard({ config, save, toast }: { config: Config; save: (p: Partial<Config>, msg?: string) => void; toast: Toast }) {
  const [url, setUrl] = useState(config.pollUrl)
  const [interval, setIntervalSec] = useState(String(config.pollIntervalSec))
  const [preview, setPreview] = useState<{ httpStatus: number; contentType: string | null; rawPreview: string; records: Parsed[]; total: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const tryUrl = async () => {
    setBusy(true)
    const { ok, data } = await api<NonNullable<typeof preview>>('/api/admin/timing/try-url', 'POST', { url })
    setBusy(false)
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setPreview(data)
  }

  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-mono-race text-xl">B · Interroger une URL (poll)</h2>
      <p className="text-sm text-white/55">
        Si O&apos;Top préfère nous donner un lien (<b>Simple API</b> RaceResult du type <code className="text-xs">api.raceresult.com/&lt;event&gt;/&lt;clé&gt;</code>, ou une liste publiée)
        avec au minimum le <b>dossard</b> et le <b>nombre de tours</b>. RaceResult met ces réponses en cache 10 à 30 s et refuse plus d&apos;1 appel/s : 10 s est un bon rythme.
      </p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.raceresult.com/123456/ABCDEF…" className="input font-mono text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-white/55">
          Toutes les
          <input value={interval} onChange={(e) => setIntervalSec(e.target.value.replace(/\D/g, ''))} className="input w-16 px-2 py-2 text-center" />
          s
        </label>
        <button onClick={tryUrl} disabled={!url || busy} className="btn-ghost px-3 py-2 text-sm">{busy ? 'Test…' : '🔍 Tester (sans rien écrire)'}</button>
        <button onClick={() => save({ pollUrl: url, pollIntervalSec: Number(interval) || 10 })} className="btn-ghost px-3 py-2 text-sm">Enregistrer</button>
        <button onClick={() => save({ pollUrl: url, pollIntervalSec: Number(interval) || 10, mode: 'poll' }, 'Interrogation RaceResult activée')} disabled={!url} className="btn-red px-3 py-2 text-sm">Activer</button>
      </div>
      {preview && (
        <div className="space-y-2 rounded-lg bg-black/30 p-3 text-xs">
          <p className="text-white/50">HTTP {preview.httpStatus} · {preview.contentType ?? '?'} · {preview.total} enregistrement(s) compris</p>
          <ParsedTable records={preview.records} />
          <details>
            <summary className="cursor-pointer text-white/40">Réponse brute</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-white/60">{preview.rawPreview}</pre>
          </details>
        </div>
      )}
    </section>
  )
}

function AdvancedCard({ config, save }: { config: Config; save: (p: Partial<Config>, msg?: string) => void }) {
  const [form, setForm] = useState({
    dataMode: config.dataMode, minLapSeconds: String(config.minLapSeconds),
    bibField: config.bibField, lapsField: config.lapsField, timeField: config.timeField, idField: config.idField,
    timingPoint: config.timingPoint,
  })
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-mono-race text-xl">⚙️ Interprétation des données</summary>
      <div className="mt-4 space-y-4">
        <div>
          <label className="label">Nature des données</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ['auto', 'Auto', 'Colonne « tours » présente → compteur, sinon → 1 ligne = 1 passage'],
              ['passings', 'Passages', 'Chaque ligne reçue = un tour bouclé'],
              ['counts', 'Compteurs', 'Chaque ligne = nombre total de tours du dossard'],
            ] as const).map(([id, label, hint]) => (
              <button key={id} onClick={() => setForm({ ...form, dataMode: id })} className={`rounded-xl border p-3 text-left ${form.dataMode === id ? 'border-white bg-white/10' : 'border-white/[0.07]'}`}>
                <p className="font-bold">{label}</p>
                <p className="text-xs text-white/45">{hint}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Fusion 2 tapis / anti-doublon : écart minimum entre 2 passages d&apos;un même dossard (secondes)</label>
          <input value={form.minLapSeconds} onChange={(e) => setForm({ ...form, minLapSeconds: e.target.value.replace(/\D/g, '') })} className="input w-28" />
          <p className="mt-1 text-xs text-white/40">Les 2 tapis côte à côte lisent chaque vélo 2× à quelques dixièmes d&apos;écart : tout ce qui tombe dans cette fenêtre compte pour UN passage. Mets nettement moins que le tour le plus rapide possible.</p>
        </div>
        <div>
          <label className="label">Point de chrono à garder (vide = tous)</label>
          <input value={form.timingPoint} onChange={(e) => setForm({ ...form, timingPoint: e.target.value })} placeholder="ex : TAPIS1, TAPIS2" className="input w-72" />
          <p className="mt-1 text-xs text-white/40">Plusieurs possibles, séparés par une virgule (2 tapis = parfois 2 points de chrono). Les autres points (départ, intermédiaire…) sont ignorés.</p>
        </div>
        <div>
          <label className="label">Colonnes forcées — nom, ou numéro (1, 2, 3…) si pas d&apos;en-tête. Vide = détection auto</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['bibField', 'lapsField', 'timeField', 'idField'] as const).map((f) => (
              <input key={f} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                placeholder={{ bibField: 'Dossard (ex: Bib)', lapsField: 'Tours (ex: Laps)', timeField: 'Heure (ex: Time)', idField: 'ID passage' }[f]}
                className="input py-2 text-sm" />
            ))}
          </div>
        </div>
        <button onClick={() => save({ ...form, minLapSeconds: Number(form.minLapSeconds) || 0 })} className="btn-red px-4 py-2 text-sm">Enregistrer</button>
      </div>
    </details>
  )
}

function TestBench({ toast }: { toast: Toast }) {
  const [payload, setPayload] = useState('')
  const [result, setResult] = useState<{ records: Parsed[]; total: number } | null>(null)
  const run = async () => {
    const { ok, data } = await api<{ records: Parsed[]; total: number }>('/api/admin/timing/test', 'POST', { payload })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setResult(data)
  }
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-mono-race text-xl">🧪 Banc d&apos;essai — coller un exemple d&apos;O&apos;Top</summary>
      <p className="mt-3 text-sm text-white/55">Colle ici un échantillon de ce que RaceResult envoie (JSON, CSV…) pour voir comment on le comprend. Rien n&apos;est enregistré.</p>
      <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={5} placeholder={'Bib;Laps\n12;7\n13;6'} className="input mt-2 font-mono text-sm" />
      <button onClick={run} disabled={!payload.trim()} className="btn-ghost mt-2 px-4 py-2 text-sm">Analyser</button>
      {result && <div className="mt-3 rounded-lg bg-black/30 p-3 text-xs"><p className="mb-2 text-white/50">{result.total} enregistrement(s) compris</p><ParsedTable records={result.records} /></div>}
    </details>
  )
}

function ParsedTable({ records }: { records: Parsed[] }) {
  if (records.length === 0) return <p className="text-ft-red2">Aucun dossard reconnu — vérifie le nom de la colonne dossard (réglages avancés).</p>
  return (
    <table className="w-full text-left">
      <thead className="text-white/40"><tr><th className="py-1">Dossard</th><th>Tours (compteur)</th><th>Heure</th><th>ID</th></tr></thead>
      <tbody className="font-mono">
        {records.slice(0, 20).map((r, i) => (
          <tr key={i} className="border-t border-white/5">
            <td className="py-1">{r.bib}</td><td>{r.laps ?? '—'}</td><td>{r.time ?? '—'}</td><td>{r.externalId ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RecentCard({ info, now }: { info: TimingInfo; now: number }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 font-mono-race text-xl">Derniers passages</h2>
      {info.sources.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {info.sources.map((s) => (
            <span key={s.source} className="chip text-xs">{SOURCE_LABEL[s.source] ?? s.source} · {s.count} · {relTime(s.lastAt, now)}</span>
          ))}
        </div>
      )}
      {info.orphanBibs.length > 0 && (
        <p className="mb-3 rounded-lg bg-ft-gold/10 p-2.5 text-sm text-ft-gold">
          ⚠️ Vus par le chrono mais attribués à aucune écurie : {info.orphanBibs.map((o) => `#${o.number} (${o.count})`).join(', ')}.
          Leurs tours sont gardés et compteront dès que le dossard sera attribué.
        </p>
      )}
      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {info.recent.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-sm">
            <span className="font-mono-race text-lg">#{e.dossardNumber}</span>
            <span className="text-xs text-white/45">{SOURCE_LABEL[e.source] ?? e.source}{e.mats.length > 0 && ` · ${e.mats.length === 1 ? e.mats[0] : `${e.mats.length} tapis ✓`}`}</span>
            <span className="text-xs text-white/45">{new Date(e.timestamp).toLocaleTimeString('fr-BE')} · {relTime(e.createdAt, now)}</span>
          </div>
        ))}
        {info.recent.length === 0 && <p className="text-sm text-white/40">Aucun passage reçu.</p>}
      </div>
    </section>
  )
}

function ManualCard({ toast }: { toast: Toast }) {
  const { data } = useLive()
  const [open, setOpen] = useState(false)
  const bikes = data ? [...data.bikes].sort((a, b) => a.number - b.number) : []
  const tap = async (number: number, delta: 1 | -1) => {
    const { ok, data: res } = await api('/api/admin/timing/manual', 'POST', { dossardNumber: number, delta })
    if (!ok) toast(res.error ?? 'Erreur', 'error')
  }
  return (
    <section className="card p-4">
      <h2 className="font-mono-race text-xl">🖐️ Comptage manuel de secours</h2>
      <p className="mt-1 text-sm text-white/55">Si le chrono tombe : un bénévole tape +1 à chaque passage. À ne pas utiliser en même temps que le chrono (double comptage).</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-ghost mt-3 px-4 py-2 text-sm">Ouvrir le pupitre</button>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {bikes.map((b) => (
            <div key={b.dossardId} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2">
              <NumberPlate number={b.number} color={b.teamColor} className="text-lg" />
              <span className="flex-1 font-mono-race tnum text-xl">{b.laps}</span>
              <button onClick={() => tap(b.number, -1)} className="h-10 w-9 rounded-lg bg-white/10 font-bold">−</button>
              <button onClick={() => tap(b.number, 1)} className="h-10 w-12 rounded-lg bg-ft-green font-mono-race text-xl text-black active:scale-95">+1</button>
            </div>
          ))}
          {bikes.length === 0 && <p className="text-sm text-white/40">Aucun vélo inscrit.</p>}
        </div>
      )}
    </section>
  )
}

function ResetLaps({ toast, reload }: { toast: Toast; reload: () => void }) {
  const reset = async () => {
    const confirm = window.prompt('Effacer TOUS les passages chrono (tous vélos, toutes sources) ? Les points, achats et écuries sont gardés.\n\nTape RESET pour confirmer.')
    if (confirm !== 'RESET') return
    const { ok, data } = await api('/api/admin/reset', 'POST', { scope: 'laps', confirm })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Tours remis à zéro')
    reload()
  }
  return (
    <section className="card flex flex-wrap items-center gap-3 border-ft-red/40 p-4">
      <div className="flex-1">
        <h2 className="font-mono-race text-xl text-ft-red2">Remettre les tours à zéro</h2>
        <p className="text-sm text-white/55">Après les tests avec O&apos;Top ou la simulation, juste avant le départ.</p>
      </div>
      <button onClick={reset} className="btn-red px-4 py-2 text-sm">Effacer les passages…</button>
    </section>
  )
}

function MatsCard({ info, now }: { info: TimingInfo; now: number }) {
  const { mats, unknownChips } = info
  if (mats.total === 0 && unknownChips.length === 0) {
    return (
      <section className="card p-4">
        <h2 className="font-mono-race text-xl">🟰 Double tapis</h2>
        <p className="mt-1 text-sm text-white/55">
          Les 2 tapis côte à côte sont fusionnés automatiquement : un vélo lu par les deux = 1 tour ; lu par un seul = 1 tour aussi (l&apos;autre l&apos;a raté).
          La santé de chaque tapis s&apos;affichera ici dès les premiers passages RaceResult.
        </p>
      </section>
    )
  }
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono-race text-xl">🟰 Double tapis — santé</h2>
        <p className="text-sm text-white/55">
          {mats.total} passage(s) · <span className="text-ft-green">{mats.both} vus par les 2 tapis</span>
          {mats.withMat > mats.both && <span className="text-ft-gold"> · {mats.withMat - mats.both} rattrapés par un seul</span>}
        </p>
      </div>
      {mats.perMat.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {mats.perMat.map((m) => {
            const rate = pct(m.seen, mats.withMat)
            const bad = mats.withMat >= 10 && rate < 90
            return (
              <div key={m.mat} className={`rounded-xl p-3 ${bad ? 'bg-ft-red/15' : 'bg-white/[0.04]'}`}>
                <div className="flex items-baseline justify-between">
                  <p className="font-bold">{m.mat}</p>
                  <p className={`font-mono-race text-2xl ${bad ? 'text-ft-red2' : rate >= 98 ? 'text-ft-green' : 'text-ft-gold'}`}>{rate}%</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${bad ? 'bg-ft-red' : 'bg-ft-green'}`} style={{ width: `${rate}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-white/50">
                  {m.seen} vus · {m.missed} ratés (rattrapés par l&apos;autre) · dernier {relTime(m.lastAt, now)}
                </p>
                {bad && <p className="mt-1 text-xs font-bold text-ft-red2">⚠️ Ce tapis rate beaucoup de passages : prévenir O&apos;Top.</p>}
              </div>
            )
          })}
        </div>
      )}
      {mats.perMat.length === 1 && mats.total >= 5 && (
        <p className="text-sm text-ft-gold">⚠️ Un seul tapis identifié dans les données reçues : soit l&apos;autre ne transmet rien, soit RaceResult fusionne déjà les deux avant de nous envoyer.</p>
      )}
      {unknownChips.length > 0 && (
        <p className="rounded-lg bg-ft-gold/10 p-2.5 text-sm text-ft-gold">
          ⚠️ Puces reçues sans vélo correspondant (non comptées) : {unknownChips.slice(0, 12).map((c) => `${c.chip} (${c.count}×)`).join(', ')}.
          Les ajouter via la synchro du fichier RaceResult (Écuries).
        </p>
      )}
    </section>
  )
}
