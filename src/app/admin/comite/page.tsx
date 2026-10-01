'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminShell from '@/components/AdminShell'
import { api } from '@/components/ui'

type Admin = { id: string; email: string; displayName: string; createdAt: string }
type Created = { email: string; displayName: string; password: string }
type Toast = (msg: string, kind?: 'ok' | 'error') => void

export default function ComitePage() {
  return (
    <AdminShell title="Comité" subtitle="Accès complet : chrono, horloge, corrections, remises à zéro, comptes. À réserver aux membres du comité.">
      {({ toast }) => <Comite toast={toast} />}
    </AdminShell>
  )
}

function Comite({ toast }: { toast: Toast }) {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [me, setMe] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [created, setCreated] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { ok, data } = await api<{ me: string; admins: Admin[] }>('/api/admins')
    if (ok) { setAdmins(data.admins); setMe(data.me) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const { ok, data } = await api<Created>('/api/admins', 'POST', { email, displayName: name })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setCreated(data); setEmail(''); setName('')
    load()
  }
  const reset = async (a: Admin) => {
    if (!window.confirm(`Générer un nouveau mot de passe pour ${a.displayName} ? L'ancien ne marchera plus.`)) return
    const { ok, data } = await api<Created>(`/api/admins/${a.id}`, 'PATCH', { resetPassword: true })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    setCreated(data)
  }
  const remove = async (a: Admin) => {
    if (!window.confirm(`Retirer l'accès comité de ${a.displayName} (${a.email}) ?`)) return
    const { ok, data } = await api(`/api/admins/${a.id}`, 'DELETE')
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Accès retiré')
    load()
  }
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="card space-y-3 p-4">
        <h2 className="font-mono-race text-xl">➕ Ajouter un membre du comité</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Email (sert d&apos;identifiant)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="prenom@exemple.be" className="input" />
          </div>
          <div>
            <label className="label">Nom affiché</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex : Marie" className="input" maxLength={60} />
          </div>
        </div>
        <button disabled={!email.trim()} className="btn-red px-4 py-2 text-sm">Créer le compte</button>
        <p className="text-xs text-white/40">Un mot de passe est généré et affiché une seule fois. La personne pourra le changer ensuite ici même.</p>
      </form>

      {created && (
        <section className="card slide-up border-ft-gold/50 p-4">
          <p className="mb-2 font-mono-race text-lg">🔑 Accès de {created.displayName} (affiché une seule fois)</p>
          <div className="space-y-1 rounded-xl bg-black/30 p-3 text-sm">
            <p><span className="text-white/45">Adresse :</span> {typeof window !== 'undefined' ? window.location.origin : ''}/admin</p>
            <p><span className="text-white/45">Email :</span> {created.email}</p>
            <p className="flex items-center gap-2">
              <span className="text-white/45">Mot de passe :</span>
              <span className="font-mono text-lg text-ft-gold">{created.password}</span>
              <button onClick={() => copy(created.password)} className="chip text-xs">{copied ? '✓' : 'Copier'}</button>
            </p>
          </div>
          <button onClick={() => setCreated(null)} className="mt-2 text-xs text-white/40">J&apos;ai noté, masquer</button>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 font-mono-race text-xl">Membres ({admins.length})</h2>
        <div className="space-y-1.5">
          {admins.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{a.displayName}{a.id === me && <span className="ml-2 text-xs text-ft-gold">(toi)</span>}</span>
                <span className="block truncate text-xs text-white/45">{a.email}</span>
              </span>
              {a.id !== me && <button onClick={() => reset(a)} className="chip text-xs">Nouveau mot de passe</button>}
              {a.id !== me && <button onClick={() => remove(a)} className="chip text-xs text-ft-red2">Retirer</button>}
            </div>
          ))}
        </div>
      </section>

      {me && <ChangeOwnPassword id={me} toast={toast} />}
    </div>
  )
}

function ChangeOwnPassword({ id, toast }: { id: string; toast: Toast }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { ok, data } = await api(`/api/admins/${id}`, 'PATCH', { currentPassword: current, password: next })
    if (!ok) return toast(data.error ?? 'Erreur', 'error')
    toast('Mot de passe changé ✓')
    setCurrent(''); setNext('')
  }
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-mono-race text-lg">🔒 Changer mon mot de passe</summary>
      <form onSubmit={submit} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={current} onChange={(e) => setCurrent(e.target.value)} type="password" autoComplete="current-password" placeholder="Mot de passe actuel" className="input" />
        <input value={next} onChange={(e) => setNext(e.target.value)} type="password" autoComplete="new-password" placeholder="Nouveau (8 caractères min.)" className="input" />
        <button disabled={!current || next.length < 8} className="btn-red px-4 py-2 text-sm">Changer</button>
      </form>
    </details>
  )
}
