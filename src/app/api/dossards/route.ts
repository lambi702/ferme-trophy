import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonError, requireStaff } from '@/lib/api-helpers'
import { parseDossardList } from '@/lib/teams'

export async function GET(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const dossards = await prisma.dossard.findMany({
    include: { team: { select: { id: true, slug: true, foulardName: true, unitName: true, sectionName: true, foulardEmoji: true } } },
    orderBy: { number: 'asc' },
  })
  return NextResponse.json(dossards)
}

/** Pool de dossards connus ("1-60" ou liste), pas encore attribués. */
export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) return jsonError('Non autorisé', 403)
  const body = await req.json()
  const list = body.from && body.to ? parseDossardList(`${body.from}-${body.to}`) : parseDossardList(body.numbers)
  if (list.length === 0) return jsonError('Fournis "numbers" ou "from"/"to"')
  const res = await prisma.dossard.createMany({ data: list.map((number) => ({ number })), skipDuplicates: true })
  return NextResponse.json({ created: res.count, total: list.length })
}
