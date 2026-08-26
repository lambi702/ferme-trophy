/**
 * Crée (ou met à jour) un compte comité, en saisie interactive — le mot de
 * passe n'est jamais un argument de ligne de commande (ça finirait dans
 * l'historique bash), toujours tapé au prompt avec écho masqué.
 *
 * Usage : docker compose exec -it web npx tsx scripts/create-admin.ts
 */
import readline from 'node:readline'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (hidden) {
      // Accès à une API interne de readline pour masquer la saisie — pas de
      // types officiels pour ça, on caste en any délibérément.
      const rlInternal = rl as unknown as { output: NodeJS.WritableStream; _writeToOutput: (str: string) => void }
      rlInternal._writeToOutput = (str: string) => {
        if (str.includes('\n')) rlInternal.output.write('\n')
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function main() {
  const email = (await ask('Email : ')).toLowerCase()
  const displayName = await ask('Nom affiché : ')
  const password = await ask('Mot de passe (saisie masquée) : ', true)
  console.log()

  if (!email || !password) {
    console.error('❌ Email et mot de passe requis.')
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('❌ Mot de passe trop court (6 caractères minimum).')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, displayName: displayName || email },
    create: { email, passwordHash, displayName: displayName || email },
  })
  console.log(`✅ Compte comité prêt : ${admin.email} (${admin.displayName})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
