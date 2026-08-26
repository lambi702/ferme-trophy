import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-mono-race text-ft-red text-sm tracking-[0.3em] mb-2">EMBOURG · 2026</p>
        <h1 className="font-mono-race text-4xl sm:text-5xl font-bold mb-1">FERME TROPHY</h1>
        <p className="text-ft-silver mb-10">Course de vélos — thème Formule 1</p>

        <div className="space-y-3">
          <Link
            href="/classement"
            className="block bg-ft-red hover:brightness-110 text-white font-mono-race font-bold text-lg py-4 rounded-lg transition"
          >
            🏁 Voir le classement live
          </Link>
          <Link
            href="/organisateur"
            className="block card hover:border-ft-gold text-white font-mono-race font-semibold py-3 rounded-lg transition"
          >
            🎮 Espace mini-jeux
          </Link>
          <Link
            href="/admin"
            className="block card hover:border-ft-red text-white/60 font-mono-race text-sm py-3 rounded-lg transition"
          >
            🛠️ Comité d'organisation
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-10">Chaque équipe accède à sa page via son QR code dédié.</p>
      </div>
    </main>
  )
}
