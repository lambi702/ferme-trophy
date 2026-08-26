'use client'

import Link from 'next/link'
import OrganizerGate from '@/components/OrganizerGate'
import TeamsAndDossardsManager from '@/components/TeamsAndDossardsManager'

export default function OrganisateurEquipesPage() {
  return (
    <OrganizerGate>
      {(organizer) => (
        <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
          <Link href="/organisateur" className="font-mono-race text-ft-silver text-sm">← Mini-jeux</Link>
          <h1 className="font-mono-race text-2xl font-bold mt-4 mb-1">🏎️ Équipes & dossards</h1>
          <p className="text-white/40 text-sm mb-6">Connecté·e en tant que <strong>{organizer.displayName}</strong></p>
          <TeamsAndDossardsManager />
        </main>
      )}
    </OrganizerGate>
  )
}
