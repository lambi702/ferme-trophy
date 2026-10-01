import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getTimingConfig, patchTimingStatus } from '@/lib/settings'
import { parseParams, parseTimingPayload } from '@/lib/timing/parse'
import { ingestRecords, summarize } from '@/lib/timing/ingest'
import { invalidateLive } from '@/lib/live'

export const dynamic = 'force-dynamic'

/**
 * Réception "push" depuis le serveur RaceResult d'O'Top (Exporter HTTP Get
 * ou HTTP Post déclenché à chaque passage), ou depuis n'importe quel outil.
 * L'URL contient un jeton secret (régénérable dans /admin/chrono).
 *
 *   GET  /api/timing/push/<token>?bib=12&time=14:03:22.418
 *   POST /api/timing/push/<token>   body JSON / CSV / texte / formulaire
 *
 * Répond toujours en texte court "OK ..." (certains exporters n'aiment pas le JSON).
 */
async function handle(req: NextRequest, token: string, read: () => Promise<{ text: string; type: string } | URLSearchParams>) {
  const cfg = await getTimingConfig()
  const a = Buffer.from(token)
  const b = Buffer.from(cfg.pushToken)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse('Forbidden', { status: 403 })
  if (!cfg.pushEnabled) return new NextResponse('Push disabled', { status: 503 })

  const at = new Date().toISOString()
  try {
    const input = await read()
    const records = input instanceof URLSearchParams ? parseParams(input, cfg) : parseTimingPayload(input.text, input.type, cfg)
    // Un POST peut aussi porter ses données en query string.
    if (records.length === 0 && !(input instanceof URLSearchParams)) records.push(...parseParams(req.nextUrl.searchParams, cfg))
    if (records.length === 0) {
      await patchTimingStatus({ lastPushAt: at, lastPushError: 'Requête reçue mais aucun dossard reconnu' })
      return new NextResponse('OK 0 record (no bib found)', { status: 200 })
    }
    const result = await ingestRecords(records, 'raceresult-push', cfg)
    await patchTimingStatus({ lastPushAt: at, lastPushSummary: summarize(result), lastPushError: '' })
    invalidateLive()
    return new NextResponse(`OK ${result.inserted} inserted, ${result.removed} removed, ${result.duplicates + result.debounced} ignored`, { status: 200 })
  } catch (err) {
    await patchTimingStatus({ lastPushAt: at, lastPushError: String((err as Error).message ?? err) }).catch(() => {})
    return new NextResponse('Error', { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  return handle(req, params.token, async () => req.nextUrl.searchParams)
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  return handle(req, params.token, async () => ({ text: await req.text(), type: req.headers.get('content-type') ?? '' }))
}
