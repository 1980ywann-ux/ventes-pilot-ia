# Ventes Pilot IA

Application web SaaS B2B, en français, qui fusionne les fichiers de ventes d'un site de loisirs, contrôle leur qualité et calcule des indicateurs fiables. Le besoin est décrit dans le PRD « Ventes Pilot IA ».

**État : étape 1 du plan de développement** (PRD section 15) : squelette applicatif, authentification, entreprises, rôles, isolation en base, jeux fictifs.

## Ce que fait l'étape 1

- Création de compte avec confirmation de l'adresse e-mail obligatoire, puis connexion et déconnexion.
- Création d'une entreprise : son créateur en devient administrateur.
- Deux rôles (PRD H13) :
  - **Administrateur** : configure, invite, gère les rôles.
  - **Lecteur** : consulte.
- Invitation par adresse e-mail : la personne rejoint l'entreprise à sa connexion, une fois son adresse confirmée.
- Sources de ventes : nom, type, base HT/TTC (H1) et priorité (H5).
- Journal d'audit des actions (membres, invitations, sources), sans contenu de ventes.
- Une entreprise garde toujours au moins un administrateur.

## Isolation des données

Critère de validation de l'étape 1 : *test d'isolation entre deux entreprises réussi*.

- Chaque table métier porte `organisation_id`. **PostgreSQL applique l'isolation par Row Level Security** : le code applicatif n'est jamais la seule barrière.
- L'application n'utilise aucune clé de service : chaque requête part avec la session de l'utilisateur.
- Les identifiants sont des UUID aléatoires. Une entreprise dont on n'est pas membre répond « introuvable », exactement comme un identifiant qui n'existe pas.
- On n'entre dans une entreprise qu'en la créant ou par invitation. Personne ne peut s'y ajouter seul ni y ajouter quelqu'un sans son accord.
- Une ligne ne peut pas changer d'entreprise.
- Rien n'est mis en cache côté serveur : aucune donnée ne peut passer d'une entreprise à l'autre par un cache.

Deux niveaux de tests le vérifient :

| Commande | Ce qui est testé | Prérequis |
| --- | --- | --- |
| `npm test` | 36 tests SQL de la RLS : lecture, écriture, devinette d'existence, visiteur anonyme, rôles, invitations, et une garde qui échoue si une nouvelle table oublie la RLS ou `organisation_id` | PostgreSQL 16 |
| `npm run test:e2e` | 34 vérifications dans un vrai navigateur : inscription, confirmation, création, invitation, refus d'accès entre entreprises, appels directs à l'API Supabase | Supabase local + `npm run dev` |

`npm test` tourne automatiquement sur GitHub à chaque envoi (`.github/workflows/verifications.yml`).

## Démarrer en local

Prérequis : Node 22, Docker.

```bash
npm install
npx supabase start          # base, authentification, boîte mail de test (Mailpit)
cp .env.example .env.local  # puis y mettre l'URL et la clé « publishable » affichées par supabase start
npm run dev                 # http://localhost:3000
```

Les e-mails de confirmation arrivent dans Mailpit : http://127.0.0.1:54324.

Tests :

```bash
npm test            # isolation en base (PostgreSQL sur localhost:5432, voir DATABASE_URL_ADMIN)
npm run test:e2e    # bout en bout (Supabase local et npm run dev lancés)
```

## Mettre en ligne (Supabase hébergé, UE)

1. Créer un projet Supabase dans une **région UE**, par exemple Francfort (`eu-central-1`) ou Paris (`eu-west-3`), conformément à H16.
2. Appliquer le schéma : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.
3. Dans le tableau de bord Supabase, rubrique Authentication :
   - **URL Configuration** : Site URL = l'adresse de l'application ; Redirect URLs = `https://<votre-domaine>/**`.
   - Confirmation d'e-mail activée.
   - Mot de passe : 10 caractères minimum, avec minuscules, majuscules et chiffres.
   - SMTP : configurer un fournisseur d'e-mails hébergé dans l'UE. Le service d'envoi par défaut de Supabase est limité et réservé aux essais.
4. Déployer l'application Next.js chez un hébergeur UE, avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Structure

```
supabase/migrations/      schéma, RLS, fonctions (source de vérité de la sécurité)
supabase/tests/           imitation minimale de Supabase pour tester sur PostgreSQL nu
src/proxy.ts              rafraîchit la session, renvoie les visiteurs vers /connexion
src/lib/supabase/         clients Supabase côté serveur
src/lib/organisation.ts   chargement de l'entreprise et du rôle (introuvable si non-membre)
src/app/connexion/        inscription, connexion, déconnexion
src/app/entreprises/      choix et création d'entreprise
src/app/e/[orgId]/        espace d'une entreprise : tableau de bord, sources, équipe
tests/db/                 tests d'isolation (Vitest + PostgreSQL), jeu fictif
tests/e2e/                scénario navigateur (Playwright)
```

## Limites connues de cette étape

- L'application n'envoie pas encore d'e-mail d'invitation : l'administrateur prévient la personne lui-même.
- Le PRD (section 2) demande de valider les hypothèses H1 à H21 avant de développer. Cette étape n'en dépend presque pas ; les étapes suivantes, si.

## Étape suivante

Étape 2 du PRD : import de fichier (dépôt, empreinte SHA-256, lecture CSV/Excel, prévisualisation), validée par les jeux de test d'encodage et de séparateurs.
