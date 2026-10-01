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

## Les 3 interfaces (refonte UX 2026-10-01)
| URL | Pour qui | Contenu |
|---|---|---|
| `/` | Participants (téléphone) | Live : classement vélos, écuries/points, boutique (prix + règles), radio course. « Mon écurie » mémorisée sur le tél (localStorage). `/classement` redirige ici. |
| `/equipe/{slug}` | Une écurie | Ses vélos (rang, tours), points, historique ; personnalisation avec le PIN (nom d'écurie, unité, section, couleur, emoji, **surnom de chaque vélo**). |
| `/ecran` | Grand écran TV | Tour de chrono par vélo (animations dépassements/tours), points par écurie, radio, QR, horloge, **annonces plein écran** à chaque bonus/malus et changement de leader. Double-clic = plein écran. |
| `/organisateur` | Direction de course (organisateurs ET comité) | 4 onglets : Points (mini-jeux, multi-écuries), Bonus/Malus (dépenser les points d'une écurie), Écuries (inscriptions + PIN + dossards + export O'Top), Historique (annulation). |
| `/admin/*` | Comité | Tableau de bord + check-list jour J, Chrono, Course (horloge, corrections, remise à zéro), Écuries, Historique, Catalogue, Organisateurs. |
| `/qrcodes` | Direction de course | Fiches imprimables QR + PIN par écurie. |

## Architecture clé
- **3 types de session cookie distincts** (`ft_admin_session`, `ft_org_session`, `ft_team_session`), JWT via `jose`, voir `src/lib/auth.ts`. `requireStaff()` (`src/lib/api-helpers.ts`) = organisateur OU comité : le comité peut tout faire côté direction de course.
- **Classement COURSE = par vélo (dossard)**, classement POINTS = par écurie. Les bonus/malus visent un **vélo précis** (`RaceAdjustment.dossardId`, `Purchase.targetDossardId`).
- **Aucun solde stocké** — tout est recalculé à la volée (`src/lib/live.ts`, `getLiveState()`), mis en cache 1,5 s sur `globalThis` pour que 100 téléphones en SSE ne fassent pas 100 calculs. Un seul flux : `/api/live` + `/api/live/stream` (SSE, repli polling). Appeler `invalidateLive()` après toute écriture.
- **Annulations = soft delete** (`cancelledAt`/`cancelledBy` sur `PointsTransaction` et `Purchase`) : exclues des soldes, gardées barrées dans l'historique. Annuler un achat supprime son `RaceAdjustment` (= remboursement + effet retiré).
- **Achat = vérification du solde DANS une transaction avec `SELECT … FOR UPDATE` sur l'écurie** (`/api/purchases`) — testé : 6 achats simultanés ne font jamais passer le solde en négatif.
- **Réglages à chaud dans la table `Setting`** (`src/lib/settings.ts`) : config chrono, état chrono, horloge de course. Lus par Next.js ET par le daemon.

## ⚠️ Revirement volontaire : achats bonus/malus par la direction de course, plus par l'écurie
Décision de l'utilisateur (2026-10-01) : une écurie ne dépense plus ses points elle-même. Elle va voir la direction de course, qui a le droit de dépenser les points de **toutes** les écuries (`POST /api/purchases`, `requireStaff`). Le PIN d'écurie ne sert plus qu'à **personnaliser** sa page. L'ancienne route `/api/marketplace/purchase` a été supprimée — ne pas la réintroduire.

## Chronométrage — O'Top / RaceResult
Contexte : O'Top Services (Benjamin Olivier) chronomètre avec **RaceResult sur leur propre serveur en ligne**. Format exact pas encore connu au 2026-10-01 → tout a été préparé pour s'adapter sans redéployer :
- **Point d'entrée unique** : `ingestRecords()` (`src/lib/timing/ingest.ts`). Deux natures : *passage* (dossard [+ heure/ID], dédoublonné par `externalId`, anti-relecture `minLapSeconds`) ou *compteur* (dossard + tours absolus → aligne les `RaceLapEvent` d'une source dédiée `…-counts`, y compris corrections à la baisse ; un dossard absent de la réponse n'est jamais touché ; une réponse vide n'efface rien).
- **Parseur tolérant** `src/lib/timing/parse.ts`, calé sur la doc officielle RaceResult : exporters par défaut *Raw Data Record JSON* (objet imbriqué, `Passing.UTCTime` prioritaire, `Invalid:true` ignoré), *Raw Data Record V1/V2* (`N°passage;Dossard;Date;Heure;…` — le dossard est en 2e colonne !), *RunScore RSBCI*, expressions perso type `[Event.ID];[RD_TimingPoint];[Bib];[RD_Time]`, listes `data/list` JSON sans en-tête, webhooks RaceResult, CSV, formulaire, query string. Un code transpondeur (`ZCMBG52`) n'est jamais lu comme un dossard. Colonnes forçables par nom ou par numéro, filtre par point de chrono. Heures `HH:MM:SS.mmm` / secondes depuis minuit en Europe/Brussels. **Tests : `npm test`** (`scripts/test-timing-parse.ts`, sans base) — à relancer après toute modif du parseur.
- **Mode poll = instantanés** : une ligne sans compteur ni heure/ID y est ignorée (sinon +1 tour à chaque interrogation) et signalée dans le statut. Simple API RaceResult : cache 10-30 s, 406 au-delà d'1 appel/s → intervalle mini 5 s.
- **Option A — push** (recommandé) : Exporter HTTP GET/POST RaceResult → `/api/timing/push/<jeton>` (jeton secret dans `Setting`, régénérable). Pas de daemon.
- **Option B — poll** : le daemon (`scripts/timing-daemon.ts`, superviseur qui relit la config toutes les 5 s) interroge une URL (Simple API RaceResult, liste publiée...).
- **Secours** : comptage manuel (+1/−1 par vélo, source `manual`) dans `/admin/chrono`, corrections de tours dans `/admin/course`.
- `/admin/chrono` a un **banc d'essai** (coller un échantillon O'Top → voir l'interprétation, rien n'est écrit) et un bouton « Tester l'URL » (dry-run).
- Liste des inscrits pour O'Top : `GET /api/export/participants` (CSV `;` UTF-8 BOM, une ligne par vélo : Bib, Lastname=surnom vélo, Firstname=écurie, Club=unité...). Bouton dans l'onglet Écuries.
- **Le mode simulation (`mock`) ajoute de FAUX tours** à tous les vélos inscrits : il doit rester sur `off` en prod (défaut). La check-list du tableau de bord le signale.

## Charge
Testé le 2026-10-01 : 300 clients SSE simultanés + simulation à 1 tick/s → ~9 % CPU, `/api/live` médiane 5 ms / p95 43 ms, aucune connexion qui fuit après déconnexion.

## ⚠️ Ne pas tuer les process par motif depuis l'hôte
Les process du conteneur sont visibles depuis l'hôte : un `pkill -f timing-daemon` lancé sur l'hôte tue AUSSI le daemon du conteneur de prod (c'est arrivé le 2026-10-01). Utiliser `docker compose restart web` ou des PID précis.

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
- **Une équipe peut avoir plusieurs dossards** (plusieurs vélos) — `Team.dossardNumber` (unique, 1-1) a été remplacé par un modèle `Dossard` séparé (`teamId` nullable, relation 1-N). Depuis le 2026-10-01 le classement course est **par vélo** (chaque dossard classé séparément), les points restent par écurie. Gestion : `POST /api/teams` accepte directement `dossards: "12, 13"` ; `/api/teams/{slug}/dossards` POST/DELETE pour ajouter/retirer un vélo ; `/api/dossards` reste dispo (pool) — comité ET organisateurs.
- **Les noms sont optionnels à l'inscription** — l'écurie se personnalise ensuite elle-même via `/api/teams/{slug}/foulard` (session PIN ; la direction de course peut aussi corriger). Le slug ne change JAMAIS après création (déjà imprimé sur le QR code) même si le nom change.
- **Création d'écurie + dossards ouvertes aux organisateurs**, pas juste au comité (`src/components/staff/EcuriesManager.tsx`, réutilisé par `/admin/equipes` et l'onglet Écuries de `/organisateur`).

## Déployer un changement (sans migration de schéma)
```bash
docker compose build web && docker compose up -d web
```

## Rejouer le scénario de démo — ⚠️ PLUS EN PROD
```bash
docker compose exec web npx tsx prisma/seed.ts
```
Purge et régénère TOUT, y compris les comptes comité (identifiants de démo publics dans le seed). **Ne plus lancer en prod** depuis la remise à zéro du 2026-10-01 (vraies inscriptions). Pour la prod : `/admin/course` → zone dangereuse (« remettre le jeu à zéro » garde écuries/dossards ; « tout effacer » garde comptes, catalogue, réglages) ou `/admin/chrono` → « remettre les tours à zéro » (après les tests O'Top, avant le départ).

## Remise à zéro du 2026-10-01
Toutes les données de démo ont été effacées pour les vraies inscriptions (712k faux tours de la simulation, 46 écuries de test, comptes organisateurs de démo au PIN 1234, compte comité de démo `comite@fermetrophy.be` dont le mot de passe était dans le seed). Conservés : le compte comité de l'utilisateur, le catalogue. Sauvegarde avant reset : `/root/backups/ft-2026-10-01-1637-avant-reset.dump` (`pg_restore`).

## Secrets / comptes
`.env` (jamais commité, voir `.env.example`) : `DB_PASSWORD`, `JWT_SECRET`.
- **Comptes comité** : page `/admin/comite` (un membre du comité en ajoute un autre ; mot de passe GÉNÉRÉ et affiché une seule fois, réinitialisable ; chacun change le sien sur la même page ; impossible de se supprimer soi-même ou de supprimer le dernier compte). Le script `scripts/create-admin.ts` (saisie masquée en terminal) reste le secours si plus personne ne peut se connecter.
- **Comptes organisateurs** : `/admin/organisateurs` (PIN 4 chiffres généré).

## ⚠️ Feedback
Ce projet n'a pas (encore) de page feedback in-app comme dour-crew/les-potes. Si le comité fait des retours par un autre canal (email, oral), les noter explicitement plutôt que de les laisser filer — pas de mécanisme automatique ici pour l'instant.

## Git
Remote SSH via la deploy key du serveur (voir `/root/AGENTS.md`) :
```bash
git add -A && git commit -m "..." && git push
```
