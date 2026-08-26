import { prisma } from './prisma'

export async function computeCourseLeaderboard() {
  const teams = await prisma.team.findMany({ include: { dossards: true } })
  const lapCounts = await prisma.raceLapEvent.groupBy({ by: ['dossardNumber'], _count: { _all: true } })
  const adjustments = await prisma.raceAdjustment.groupBy({ by: ['teamId'], _sum: { lapDelta: true } })

  const lapByDossard = new Map(lapCounts.map((l) => [l.dossardNumber, l._count._all]))
  const adjByTeam = new Map(adjustments.map((a) => [a.teamId, a._sum.lapDelta ?? 0]))

  const rows = teams
    .filter((team) => team.dossards.length > 0)
    .map((team) => {
      // Plusieurs vélos possibles par équipe (section) — on additionne les tours de chaque dossard.
      const rawLaps = team.dossards.reduce((sum, d) => sum + (lapByDossard.get(d.number) ?? 0), 0)
      const adjustment = adjByTeam.get(team.id) ?? 0
      return {
        teamId: team.id,
        slug: team.slug,
        unitName: team.unitName,
        sectionName: team.sectionName,
        dossardNumbers: team.dossards.map((d) => d.number).sort((a, b) => a - b),
        foulardName: team.foulardName,
        foulardColor: team.foulardColor,
        foulardEmoji: team.foulardEmoji,
        rawLaps,
        adjustment,
        adjustedLaps: rawLaps + adjustment,
      }
    })

  rows.sort((a, b) => b.adjustedLaps - a.adjustedLaps)
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

export async function computePointsLeaderboard() {
  const teams = await prisma.team.findMany()
  const earned = await prisma.pointsTransaction.groupBy({ by: ['teamId'], _sum: { points: true } })
  const spent = await prisma.purchase.groupBy({ by: ['buyingTeamId'], _sum: { costPoints: true } })

  const earnedByTeam = new Map(earned.map((e) => [e.teamId, e._sum.points ?? 0]))
  const spentByTeam = new Map(spent.map((s) => [s.buyingTeamId, s._sum.costPoints ?? 0]))

  const rows = teams.map((team) => {
    const totalEarned = earnedByTeam.get(team.id) ?? 0
    const totalSpent = spentByTeam.get(team.id) ?? 0
    return {
      teamId: team.id,
      slug: team.slug,
      unitName: team.unitName,
      sectionName: team.sectionName,
      foulardName: team.foulardName,
      foulardColor: team.foulardColor,
      foulardEmoji: team.foulardEmoji,
      pointsBalance: totalEarned - totalSpent,
    }
  })

  rows.sort((a, b) => b.pointsBalance - a.pointsBalance)
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

export async function getTeamPointsBalance(teamId: string): Promise<number> {
  const earned = await prisma.pointsTransaction.aggregate({ where: { teamId }, _sum: { points: true } })
  const spent = await prisma.purchase.aggregate({ where: { buyingTeamId: teamId }, _sum: { costPoints: true } })
  return (earned._sum.points ?? 0) - (spent._sum.costPoints ?? 0)
}
