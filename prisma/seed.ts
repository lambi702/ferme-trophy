/**
 * Scénario de démo rejouable (section 8 du handover). Purge et régénère
 * tout — à lancer avant chaque répétition/présentation au comité.
 *
 * Usage : npm run seed
 */
import { PrismaClient } from '@prisma/client'
import { slugify, hashPin } from '../src/lib/auth'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEAM_NAMES = [
  'Écurie Faucons Rouges', 'Écurie Loups Ardents', 'Écurie Aigles Noirs',
  'Écurie Panthères', 'Écurie Cobras', 'Écurie Renards Bleus',
  'Écurie Lynx', 'Écurie Griffons', 'Écurie Sangliers',
  'Écurie Hiboux', 'Écurie Faucons Dorés', 'Écurie Tigres',
  'Écurie Vipères', 'Écurie Ours Bruns',
]
const SECTIONS = ['Louveteaux', 'Éclaireurs', 'Pionniers', 'Nutons']

const COLORS = ['#e10600', '#ffd60a', '#1e90ff', '#39ff14', '#ff8c00', '#c7c7cc', '#ff3b30', '#00d4ff']
const EMOJIS = ['🏎️', '🦅', '🐺', '🐆', '🐍', '🦊', '🐈‍⬛', '🦁', '🐗', '🦉', '🐯', '🐻', '⚡', '🔥']

const MINI_GAMES = ['Chamboule-tout', 'Course en sac', 'Tir à la corde', 'Quiz F1', 'Relais ballon', 'Chasse au trésor']

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}
function randomPin() {
  return String(randInt(10000, 99999))
}

async function main() {
  console.log('🧹 Purge des données existantes...')
  await prisma.raceAdjustment.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.raceLapEvent.deleteMany()
  await prisma.pointsTransaction.deleteMany()
  await prisma.marketplaceItem.deleteMany()
  await prisma.dossard.deleteMany()
  await prisma.organizer.deleteMany()
  await prisma.team.deleteMany()
  await prisma.adminUser.deleteMany()

  console.log('👤 Compte comité...')
  const adminPassword = 'ferme2026'
  await prisma.adminUser.create({
    data: {
      email: 'comite@fermetrophy.be',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      displayName: 'Comité FT2026',
    },
  })

  console.log('🔢 Pool de dossards (1 à 20 pour la démo)...')
  const dossardIds: Record<number, string> = {}
  for (let n = 1; n <= 20; n++) {
    const d = await prisma.dossard.create({ data: { number: n } })
    dossardIds[n] = d.id
  }

  console.log('🏎️ Équipes (une équipe = une "section", 1 à 2 dossards chacune)...')
  const teams = []
  let nextDossard = 1
  for (let i = 0; i < TEAM_NAMES.length; i++) {
    const unitName = TEAM_NAMES[i]
    const pin = randomPin()
    const bikeCount = i < 2 ? 2 : 1 // les deux premières équipes ont 2 vélos, pour illustrer le multi-dossard
    const myDossards: number[] = []
    for (let b = 0; b < bikeCount && nextDossard <= 20; b++) {
      myDossards.push(nextDossard)
      nextDossard++
    }

    const team = await prisma.team.create({
      data: {
        unitName,
        sectionName: pick(SECTIONS),
        slug: slugify(unitName),
        pin,
        foulardName: unitName,
        foulardColor: COLORS[i % COLORS.length],
        foulardEmoji: EMOJIS[i % EMOJIS.length],
      },
    })
    for (const num of myDossards) {
      await prisma.dossard.update({ where: { id: dossardIds[num] }, data: { teamId: team.id } })
    }
    teams.push({ ...team, pin, dossards: myDossards })
  }
  console.log('   PIN de démo (toutes les équipes) :')
  teams.forEach((t) => console.log(`   ${t.unitName.padEnd(24)} /equipe/${t.slug.padEnd(20)} dossard(s) ${t.dossards.join(',').padEnd(6)} PIN ${t.pin}`))

  console.log('🎮 Organisateurs de mini-jeux (créés par le comité, PLUS de self-service)...')
  const organizers = []
  for (const name of ['Julie', 'Marc', 'Sophie']) {
    organizers.push(
      await prisma.organizer.create({ data: { displayName: name, pinHash: await hashPin('1234') } }),
    )
  }

  console.log('⭐ Historique de points (3 dernières heures)...')
  const now = Date.now()
  for (const team of teams) {
    const txCount = randInt(2, 4)
    for (let i = 0; i < txCount; i++) {
      await prisma.pointsTransaction.create({
        data: {
          teamId: team.id,
          organizerId: pick(organizers).id,
          points: randInt(5, 30),
          reason: pick(MINI_GAMES),
          createdAt: new Date(now - randInt(0, 3 * 60 * 60 * 1000)),
        },
      })
    }
  }

  console.log('🏁 Tours déjà courus (course "en cours")...')
  for (const team of teams) {
    for (const dossardNumber of team.dossards) {
      const laps = randInt(3, 15)
      for (let i = 0; i < laps; i++) {
        await prisma.raceLapEvent.create({
          data: { dossardNumber, timestamp: new Date(now - randInt(0, 3 * 60 * 60 * 1000)), source: 'seed' },
        })
      }
    }
  }

  console.log('🏪 Catalogue marketplace...')
  const bonusItem = await prisma.marketplaceItem.create({
    data: { name: 'Tour bonus', description: '+1 tour pour ton équipe', costPoints: 50, type: 'BONUS_SELF', lapEffect: 1 },
  })
  const malusItem = await prisma.marketplaceItem.create({
    data: { name: 'Tour malus', description: '-1 tour pour une équipe cible', costPoints: 70, type: 'MALUS_OTHER', lapEffect: -1 },
  })

  console.log('🛒 Quelques achats déjà effectués...')
  for (const team of teams.slice(0, 3)) {
    const purchase = await prisma.purchase.create({
      data: { buyingTeamId: team.id, itemId: bonusItem.id, costPoints: bonusItem.costPoints },
    })
    await prisma.raceAdjustment.create({
      data: { teamId: team.id, lapDelta: bonusItem.lapEffect, source: `purchase:${purchase.id}`, purchaseId: purchase.id },
    })
  }
  for (let i = 0; i < 2; i++) {
    const buyer = teams[10 + i]
    const target = teams[i]
    const purchase = await prisma.purchase.create({
      data: { buyingTeamId: buyer.id, targetTeamId: target.id, itemId: malusItem.id, costPoints: malusItem.costPoints },
    })
    await prisma.raceAdjustment.create({
      data: { teamId: target.id, lapDelta: malusItem.lapEffect, source: `purchase:${purchase.id}`, purchaseId: purchase.id },
    })
  }

  console.log('\n✅ Seed terminé.')
  console.log(`   Comité : comite@fermetrophy.be / ${adminPassword}`)
  console.log('   Organisateurs : Julie / Marc / Sophie, PIN 1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
