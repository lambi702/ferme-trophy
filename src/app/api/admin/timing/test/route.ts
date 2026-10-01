import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { getTimingConfig } from '@/lib/settings'
import { parseTimingPayload } from '@/lib/timing/parse'

// Banc d'essai : colle un exemple de données O'Top, vois comment il est
// interprété (AUCUNE écriture en base).
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const { payload, contentType } = await req.json()
  const cfg = await getTimingConfig()
  const records = parseTimingPayload(String(payload ?? ''), String(contentType ?? ''), cfg)
  return NextResponse.json({ records: records.slice(0, 200), total: records.length })
}
