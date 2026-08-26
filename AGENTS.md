# AGENTS.md — Ferme Trophy 2026

Plateforme pour la course de vélo "Ferme Trophy 2026" (Embourg, thème F1). Voir `/root/AGENTS.md` pour le contexte serveur partagé (Caddy, DNS, accès GitHub, persistance tmux).

## Différence majeure avec dour-crew / les-potes
Ce projet est en **Next.js/TypeScript/Prisma**, pas FastAPI/React/SQLAlchemy. **Prisma gère de vraies migrations versionnées** (`prisma/migrations/`) — contrairement aux deux autres sites du serveur, **pas besoin d'ALTER TABLE manuel** : `prisma migrate dev --name xxx` (en dev, génère + applique) puis `prisma migrate deploy` (auto au démarrage du conteneur, voir `docker-entrypoint.sh`) suffisent.

## Générer une nouvelle migration après avoir modifié `prisma/schema.prisma`
```bash
docker compose run --rm -v /opt/ft/prisma:/app/prisma web npx prisma migrate dev --name description_du_changement
docker compose build web && docker compose up -d web
```
Le montage du volume est nécessaire pour que les fichiers de migration générés atterrissent sur l'hôte (et donc dans le prochain build de l'image) plutôt que de rester perdus dans un conteneur jetable.

## Architecture clé
- **3 types de session cookie distincts** (`ft_admin_session`, `ft_org_session`, `ft_team_session`), JWT via `jose`, voir `src/lib/auth.ts`. Un navigateur ne garde qu'une session team à la fois (utile de le rappeler si un test semble "coller" à la mauvaise équipe).
- **Aucun solde de points/tours stocké** — tout est recalculé à la volée depuis `PointsTransaction`/`Purchase`/`RaceLapEvent`/`RaceAdjustment` (voir `src/lib/leaderboard.ts`). Pas de champ dénormalisé à resynchroniser.
- **`TimingAdapter`** (`src/lib/timing/adapter.ts`) : interface unique pour brancher un prestataire de chronométrage. `MockTimingAdapter` tourne dans un process séparé (`scripts/timing-daemon.ts`, lancé en arrière-plan par `docker-entrypoint.sh` avec `tsx`, dans le **même conteneur** que Next.js). **Brancher O'Top = remplacer l'import dans `timing-daemon.ts`, rien d'autre ne doit changer.**
- **Achats marketplace appliqués immédiatement** (pas de validation commissaire) — point ouvert du handover original, à trancher avant le jour J si besoin (voir README).

## ⚠️ Revirement volontaire vs le handover d'origine : comptes organisateur
Le handover initial (section 5) demandait un **self-service** pour les comptes organisateur (nom + PIN, création automatique au premier login). **Ça a été retiré suite à un retour direct du comité** : n'importe qui pouvait ainsi se créer un accès et créditer des points à sa propre équipe (triche). Désormais :
- `/api/organizer/login` (`src/app/api/organizer/login/route.ts`) **vérifie uniquement** — aucune création automatique.
- `/api/organizers` POST (admin only, `src/app/api/organizers/route.ts`) crée les comptes, PIN généré affiché une seule fois — même pattern que la création d'équipes.
- Ne JAMAIS réintroduire l'auto-création sur `/api/organizer/login`, même si ça semble "pratique" — c'est précisément le trou de sécurité corrigé.
- Les organisateurs gardent le droit d'éditer le catalogue marketplace (prix, activer/désactiver) — voir `/api/marketplace/items` — mais pas de créer d'autres comptes organisateur (admin only).
- Le catalogue marketplace (items + prix) est **public**, sans PIN — seul l'achat proprement dit exige le PIN de l'équipe (`/api/marketplace/purchase`).

## ⚠️ Revirement volontaire vs le handover d'origine : PIN équipe en clair + multi-dossards
Deux changements de fond suite à un retour direct du comité :
- **`Team.pin` est stocké EN CLAIR** (pas de hash, contrairement à `Organizer.pinHash`/`AdminUser.passwordHash`). Décision assumée : les organisateurs doivent pouvoir retrouver le PIN d'une équipe à tout moment pour le recommuniquer (badge/QR perdu, équipe qui a oublié) — un hash à sens unique rendrait ça impossible. Enjeu jugé faible (pas de données sensibles derrière un PIN d'équipe scoute). `GET /api/teams` renvoie donc le PIN en clair à tout comité/organisateur authentifié — **ne jamais exposer cette route sans authentification**.
- **Une équipe peut avoir plusieurs dossards** (plusieurs vélos) — `Team.dossardNumber` (unique, 1-1) a été remplacé par un modèle `Dossard` séparé (`teamId` nullable, relation 1-N). `computeCourseLeaderboard()` (`src/lib/leaderboard.ts`) additionne les tours de TOUS les dossards d'une équipe. Gestion des dossards : `/api/dossards` (pool, création par plage) + `/api/dossards/{id}` PATCH (assignation à une équipe) — comité ET organisateurs.
- **Les équipes sont créées VIERGES par défaut** (`unitName`/`sectionName`/`foulardName` vides) — `POST /api/teams` sans `unitNames` crée `count` équipes vides avec juste un slug technique (`equipe`, `equipe-2`...) et un PIN. C'est l'équipe elle-même qui se personnalise ensuite via `/api/teams/{slug}/foulard` (nom d'unité, nom de section, foulard). Le slug ne change JAMAIS après création (déjà imprimé sur le QR code) même si le nom change.
- **Création d'équipe + assignation de dossard ouvertes aux organisateurs**, pas juste au comité (`src/components/TeamsAndDossardsManager.tsx`, réutilisé par `/admin/equipes` et `/organisateur/equipes`).

## Déployer un changement (sans migration de schéma)
```bash
docker compose build web && docker compose up -d web
```

## Rejouer le scénario de démo
```bash
docker compose exec web npx tsx prisma/seed.ts
```
Purge et régénère tout (14 équipes, 3 organisateurs, historique de points, tours déjà courus, quelques achats bonus/malus déjà effectués). Identifiants affichés dans la sortie de la commande.

## Secrets
`.env` (jamais commité, voir `.env.example`) : `DB_PASSWORD`, `JWT_SECRET`. Comité et organisateurs de démo créés par `prisma/seed.ts`, pas par variables d'env (contrairement aux deux autres sites).

## ⚠️ Feedback
Ce projet n'a pas (encore) de page feedback in-app comme dour-crew/les-potes. Si le comité fait des retours par un autre canal (email, oral), les noter explicitement plutôt que de les laisser filer — pas de mécanisme automatique ici pour l'instant.

## Git
Remote SSH via la deploy key du serveur (voir `/root/AGENTS.md`) :
```bash
git add -A && git commit -m "..." && git push
```
