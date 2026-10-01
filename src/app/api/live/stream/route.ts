import type { NextRequest } from 'next/server'
import { getLiveState } from '@/lib/live'

export const dynamic = 'force-dynamic'

/**
 * SSE : pousse l'état live dès qu'il change (vérifié toutes les 2 s), plus
 * un ping toutes les 20 s pour garder la connexion ouverte derrière Caddy.
 * Le client retombe sur du polling de /api/live si EventSource échoue.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setInterval> | undefined
  let closed = false
  let lastPayload = ''
  let lastSentAt = 0

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return
        closed = true
        if (timer) clearInterval(timer)
        try { controller.close() } catch { /* déjà fermé */ }
      }
      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
          lastSentAt = Date.now()
        } catch {
          close()
        }
      }
      const tick = async () => {
        try {
          const state = await getLiveState()
          const { generatedAt: _ignored, ...comparable } = state
          const payload = JSON.stringify(comparable)
          if (payload !== lastPayload) {
            lastPayload = payload
            write(`data: ${JSON.stringify(state)}\n\n`)
          } else if (Date.now() - lastSentAt > 20000) {
            write(': ping\n\n')
          }
        } catch (err) {
          console.error('[sse live] erreur', err)
        }
      }
      req.signal.addEventListener('abort', close)
      write('retry: 3000\n\n')
      tick()
      timer = setInterval(tick, 2000)
    },
    cancel() {
      closed = true
      if (timer) clearInterval(timer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
