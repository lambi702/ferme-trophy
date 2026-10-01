'use client'

import AdminShell from '@/components/AdminShell'
import EcuriesManager from '@/components/staff/EcuriesManager'

export default function AdminEquipesPage() {
  return (
    <AdminShell title="Écuries & dossards" subtitle="Inscriptions, PIN, vélos, export pour le chronométreur.">
      {({ toast }) => <EcuriesManager toast={toast} />}
    </AdminShell>
  )
}
