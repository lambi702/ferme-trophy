# Ferme Trophy 2026 🏁

Plateforme pour la course de vélo "Ferme Trophy 2026" à Embourg (thème Formule 1) — remplace la gestion papier/Excel : génération des équipes, dossards, ingestion chronométrage, système de points de mini-jeux, marketplace de bonus/malus, classements live, pages équipe avec QR code.

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
- **Organisateur de mini-jeu** (`Organizer`) : nom + PIN, **compte créé par le comité** (`/admin/organisateurs`) — pas de self-service (retiré suite à un risque de triche identifié : n'importe qui pouvait sinon se créer un accès et créditer des points). Peut (direction de course, `/organisateur`) : créditer des points, **dépenser les points de n'importe quelle écurie** en bonus/malus à sa demande, éditer les prix, inscrire des écuries et leurs dossards.
- **Équipe** (`Team`, = une section scoute) : PIN à 5 chiffres **retrouvable à tout moment par le comité/les organisateurs** (`GET /api/teams`, stocké en clair — voir AGENTS.md pour le pourquoi). Pas de compte. Inscrite par la direction de course ; l'écurie se personnalise elle-même (nom, unité, section, couleur, emoji, surnom des vélos) via `/equipe/{slug}` déverrouillée par PIN. Le PIN ne permet PAS de dépenser des points. **Une écurie peut avoir plusieurs vélos** : le classement course est par vélo, les points par écurie.

## Les 3 interfaces
- **`/ecran`** — grand écran TV : classement par vélo, points par écurie, radio course, annonces bonus/malus.
- **`/organisateur`** — direction de course : points des mini-jeux, achats bonus/malus pour le compte d'une écurie, inscriptions, historique avec annulation.
- **`/`** — participants (téléphone) : live, « mon écurie », boutique, radio ; `/equipe/{slug}` pour personnaliser son écurie avec le PIN.
Plus `/admin` pour le comité (chrono, horloge, check-list jour J...).

## Chronométrage (O'Top / RaceResult)
Toutes les sources passent par `ingestRecords()` (`src/lib/timing/ingest.ts`) avec un parseur tolérant (JSON/CSV/texte/formulaire). Push : Exporter HTTP RaceResult → `/api/timing/push/<jeton>`. Poll : URL RaceResult interrogée par le daemon. Mode, URL, mapping des colonnes : tout se règle à chaud dans `/admin/chrono` (banc d'essai inclus). Détails dans `AGENTS.md`.

## Points ouverts
Specs exactes O'Top (push ou poll, passages ou compteurs), catalogue marketplace définitif, anti-abus sur les malus, sort des points non dépensés en fin de course.

## Déployé sur
https://ft.lambi-house.be
