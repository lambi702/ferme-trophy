import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { applySync, parseRrTable, planSync } from '@/lib/raceresultSync'
import { invalidateLive } from '@/lib/live'

// Aperçu (apply=false) puis application (apply=true) du fichier participants RaceResult.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const { text, removeMissing, apply } = await req.json()
  const { rows, errors } = parseRrTable(String(text ?? ''))
  if (rows.length === 0) return jsonError(errors[0] ?? 'Aucune ligne exploitable')
  const opts = { removeMissing: Boolean(removeMissing) }
  if (!apply) return NextResponse.json({ plan: await planSync(rows, opts), parseErrors: errors })
  if (errors.length) return jsonError(`Corrige d'abord : ${errors.join(' · ')}`)
  const plan = await applySync(rows, opts)
  invalidateLive()
  return NextResponse.json({ plan, applied: true })
}
