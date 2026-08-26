# Ferme Trophy 2026 🏁

Plateforme complète pour la course de vélo "Ferme Trophy 2026" à Embourg (thème Formule 1) — remplace la gestion papier/Excel : génération des équipes, dossards, ingestion chronométrage, système de points de mini-jeux, marketplace de bonus/malus, classements live, pages équipe avec QR code.

## Stack
- **Next.js 14** (App Router) + TypeScript
- **PostgreSQL** + **Prisma** (vraies migrations versionnées, `prisma migrate deploy` au démarrage du conteneur — contrairement aux deux autres sites du serveur qui font du `create_all()` manuel)
- **SSE** pour le leaderboard live, repli automatique sur polling si indisponible
- **Tailwind CSS**, thème F1 (rouge/noir/carbone)
- Déploiement : Docker Compose (`web` + `db`), Caddy en reverse proxy, HTTPS auto

## Développement local
```bash
cp .env.example .env   # remplir DB_PASSWORD, JWT_SECRET
docker compose up -d db
docker compose build web
docker compose run --rm -v $(pwd)/prisma:/app/prisma web npx prisma migrate dev --name <nom>
docker compose up -d
docker compose exec web npx tsx prisma/seed.ts   # scénario de démo rejouable
```

## Modèle d'accès (3 rôles)
- **Comité** (`AdminUser`) : email + mot de passe
- **Organisateur de mini-jeu** (`Organizer`) : self-service, nom + PIN (créé automatiquement à la première connexion)
- **Équipe** (`Team`) : PIN à 4-6 chiffres, pas de compte — page publique `/equipe/{slug}`, déverrouillée par PIN pour éditer le foulard et acheter en marketplace

## Adaptateur de chronométrage
Interface `TimingAdapter` (`src/lib/timing/adapter.ts`) — le reste du système ne consomme que des `RaceLapEvent` normalisés. `MockTimingAdapter` tourne en tâche de fond (process séparé dans le même conteneur, `scripts/timing-daemon.ts`) et simule des passages tant que les specs O'Top ne sont pas connues. **Brancher O'Top = implémenter la même interface, rien d'autre ne change.**

## Points ouverts (voir le handover original)
Format CSV d'inscription, specs O'Top, catalogue marketplace définitif, validation commissaire ou application immédiate des achats (actuellement : immédiate), anti-abus sur les malus, sort des points non dépensés en fin de course.

## Déployé sur
https://ft.lambi-house.be
