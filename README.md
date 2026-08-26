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
- **Comité** (`AdminUser`) : email + mot de passe. Vue globale, création des comptes organisateurs, correction manuelle des points/tours.
- **Organisateur de mini-jeu** (`Organizer`) : nom + PIN, **compte créé par le comité** (`/admin/organisateurs`) — pas de self-service (retiré suite à un risque de triche identifié : n'importe qui pouvait sinon se créer un accès et créditer des points). Peut : créditer des points, éditer les prix marketplace, créer une équipe et l'associer à un/des dossard(s) (`/organisateur/equipes`).
- **Équipe** (`Team`, = une section scoute) : PIN à 5 chiffres **retrouvable à tout moment par le comité/les organisateurs** (`GET /api/teams`, stocké en clair — voir AGENTS.md pour le pourquoi). Pas de compte. Créée **vierge** par un organisateur ou le comité ; c'est l'équipe qui se personnalise elle-même (nom d'unité, nom de section, foulard) via sa page publique `/equipe/{slug}`, déverrouillée par PIN pour éditer et acheter en marketplace. **Une équipe peut avoir plusieurs dossards** (plusieurs vélos) — les tours de tous ses dossards sont additionnés au classement.

## Adaptateur de chronométrage
Interface `TimingAdapter` (`src/lib/timing/adapter.ts`) — le reste du système ne consomme que des `RaceLapEvent` normalisés. `MockTimingAdapter` tourne en tâche de fond (process séparé dans le même conteneur, `scripts/timing-daemon.ts`) et simule des passages tant que les specs O'Top ne sont pas connues. **Brancher O'Top = implémenter la même interface, rien d'autre ne change.**

## Points ouverts (voir le handover original)
Format CSV d'inscription, specs O'Top, catalogue marketplace définitif, validation commissaire ou application immédiate des achats (actuellement : immédiate), anti-abus sur les malus, sort des points non dépensés en fin de course.

## Déployé sur
https://ft.lambi-house.be
