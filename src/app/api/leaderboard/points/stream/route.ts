import { computePointsLeaderboard } from '@/lib/leaderboard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let interval: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const data = await computePointsLeaderboard()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (err) {
          console.error('[sse points] erreur', err)
        }
      }
      await send()
      interval = setInterval(send, 3000)
    },
    cancel() {
      if (interval) clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
