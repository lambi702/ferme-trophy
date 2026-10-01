'use client'

import AdminShell from '@/components/AdminShell'
import ActivityLog from '@/components/staff/ActivityLog'

export default function AdminHistoriquePage() {
  return (
    <AdminShell title="Historique" subtitle="Tous les points, achats et corrections — avec auteur. Annuler = garder la trace, barrée.">
      {({ toast }) => <ActivityLog isAdmin toast={toast} />}
    </AdminShell>
  )
}
