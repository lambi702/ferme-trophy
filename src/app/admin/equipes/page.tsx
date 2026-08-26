'use client'

import AdminGate from '@/components/AdminGate'
import AdminNav from '@/components/AdminNav'
import TeamsAndDossardsManager from '@/components/TeamsAndDossardsManager'

export default function EquipesPage() {
  return (
    <AdminGate>
      {() => (
        <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
          <AdminNav />
          <h1 className="font-mono-race text-2xl font-bold mb-6">🏎️ Équipes & dossards</h1>
          <TeamsAndDossardsManager showQrLink />
        </main>
      )}
    </AdminGate>
  )
}
