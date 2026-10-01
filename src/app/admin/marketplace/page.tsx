'use client'

import AdminShell from '@/components/AdminShell'
import CatalogManager from '@/components/staff/CatalogManager'

export default function AdminCatalogPage() {
  return (
    <AdminShell title="Catalogue bonus / malus" subtitle="Les organisateurs peuvent aussi ajuster les prix depuis la direction de course.">
      {({ toast }) => <CatalogManager toast={toast} />}
    </AdminShell>
  )
}
