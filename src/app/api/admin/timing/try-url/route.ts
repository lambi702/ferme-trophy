import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/api-helpers'
import { getTimingConfig } from '@/lib/settings'
import { parseTimingPayload } from '@/lib/timing/parse'

// Teste une URL RaceResult (Simple API...) SANS rien écrire : montre la
// réponse brute et ce qu'on en comprend, avant d'activer le mode "poll".
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return jsonError('Non autorisé', 403)
  const { url } = await req.json()
  if (!/^https?:\/\//.test(String(url ?? ''))) return jsonError('URL http(s) requise')
  const cfg = await getTimingConfig()
  try {
    const res = await fetch(String(url), { signal: AbortSignal.timeout(15000) })
    const text = await res.text()
    const records = parseTimingPayload(text, res.headers.get('content-type') ?? '', cfg)
    return NextResponse.json({
      httpStatus: res.status,
      contentType: res.headers.get('content-type'),
      rawPreview: text.slice(0, 2000),
      records: records.slice(0, 100),
      total: records.length,
    })
  } catch (err) {
    return jsonError(`Impossible de joindre l'URL : ${(err as Error).message}`, 502)
  }
}
