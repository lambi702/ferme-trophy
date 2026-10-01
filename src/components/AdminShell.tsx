'use client'

import AdminGate from './AdminGate'
import AdminNav from './AdminNav'
import { useToast } from './ui'

type ToastFn = ReturnType<typeof useToast>['show']

/** Mise en page commune des pages /admin : garde + navigation + toasts. */
export default function AdminShell({ title, subtitle, children, wide = false }: {
  title: string
  subtitle?: string
  children: (ctx: { admin: { id: string; displayName: string }; toast: ToastFn }) => React.ReactNode
  wide?: boolean
}) {
  const toast = useToast()
  return (
    <AdminGate>
      {(admin) => (
        <main className={`mx-auto min-h-screen px-4 py-6 ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
          <AdminNav />
          <h1 className="font-mono-race text-3xl">{title}</h1>
          {subtitle && <p className="mb-5 text-sm text-white/45">{subtitle}</p>}
          {!subtitle && <div className="mb-5" />}
          {children({ admin, toast: toast.show })}
          {toast.node}
        </main>
      )}
    </AdminGate>
  )
}
