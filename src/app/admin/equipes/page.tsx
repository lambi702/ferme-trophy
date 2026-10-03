'use client'

import { useState } from 'react'
import AdminShell from '@/components/AdminShell'
import EcuriesManager from '@/components/staff/EcuriesManager'
import RaceResultSync from '@/components/staff/RaceResultSync'

export default function AdminEquipesPage() {
  const [version, setVersion] = useState(0)
  return (
    <AdminShell title="Écuries & dossards" subtitle="Inscriptions, PIN, vélos, classements, synchro avec le fichier RaceResult d'O'Top.">
      {({ toast }) => (
        <div className="space-y-5">
          <RaceResultSync toast={toast} onApplied={() => setVersion((v) => v + 1)} />
          <EcuriesManager key={version} toast={toast} />
        </div>
      )}
    </AdminShell>
  )
}
