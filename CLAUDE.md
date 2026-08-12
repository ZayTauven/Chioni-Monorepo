# Chioni — SaaS de gestion des centres de santé (Comores)

## Vision

Chioni numérise la gestion des centres de santé comoriens (hôpitaux, cliniques privées) et fiabilise le financement des soins par la diaspora grâce au **« Pont de Confiance »** : le patient partage son carnet/ordonnance avec ses proches à l'étranger, qui paient **directement le centre de santé** pour un acte identifié — jamais via un intermédiaire individuel. Chaque franc est relié à un patient, un acte, un prestataire et un reçu.

**Document de référence : [docs/etude-des-besoins.md](docs/etude-des-besoins.md)** (v1.1, validé) — contexte, personas, les 3 portes d'onboarding, conception du Pont de Confiance, périmètre MVP, risques. Le lire avant toute décision produit ou d'architecture.

Deux lignes produit à garder en tête en permanence :
1. **« Aider mieux », jamais surveiller** — la dignité de tous les acteurs est une contrainte de conception.
2. **Les centres de santé sont le fond de commerce** (modèle retenu : abonnement SaaS par centre ; gratuit pour patients et tuteurs). Les gâter en fonctionnalités : gestion d'activité complète, optimisation, tableaux de bord. Le SaaS socle doit être si bon qu'un centre le garderait même sans le Pont de Confiance.

## Langue de travail

Répondre à l'utilisateur **en français**. Code, identifiants et commits en anglais ; textes UI destinés aux utilisateurs finaux en français (i18n prévue : shikomori en phase 2).

## État actuel du repo

```
Chioni/
├── backend/          # Django 5.2 + DRF — projet `config`, apps dans backend/apps/
├── frontend/         # Next.js 15 (chioni-frontend), copie de vireo template/ — builde
├── vireo template/   # référence source (LECTURE SEULE, ne jamais modifier)
└── docs/             # cadrage, décisions (ADR), spécifications
```

- **Backend initialisé** : venv `backend/.venv` (Python 3.13), settings via `backend/.env` (django-environ), User personnalisé `accounts.User` (champ `phone` unique, pivot OTP à venir), apps `accounts/centers/patients/medical/trustbridge/audit` enregistrées (seule `accounts` a un modèle), `/api/v1/health/` public, Swagger sur `/api/docs/`, DRF en deny-by-default (`IsAuthenticated`). Migrations appliquées sur `chioni_db` ; tests pytest verts (`pytest` depuis `backend/`).
- **Frontend initialisé** : copie fidèle de Vireo, paquet `chioni-frontend`, `.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`, `npm run build` OK (leaflet ajouté — manquait au template). Élagage des sections hors sujet (crypto, NFT, e-commerce…) PAS encore fait.
- Git initialisé sur `main`, **aucun commit encore**.
- Reste à faire (dans l'ordre) : modèles métier backend (+ ADR), auth téléphone+OTP, élagage/adaptation du frontend, maquettes des parcours, étude paiement (risque n° 1), étude du module IA de reprise du papier.

## Stack et conventions

### Backend (Django)
- Django 5 + Django REST Framework ; PostgreSQL ; Redis + Celery pour les tâches asynchrones (SMS, notifications, relances).
- Base de dev locale (déjà créée) — à consommer via `.env` (jamais de secrets en dur dans le code ; ces valeurs sont locales uniquement, les environnements déployés auront les leurs) :
  ```env
  DB_NAME=chioni_db
  DB_USER=postgres
  DB_PASSWORD=admin
  DB_HOST=localhost
  DB_PORT=5432
  ```
- Multi-tenant : les données d'exploitation (RDV, caisse, personnel) sont cloisonnées par centre (`HealthCenter`) ; le carnet de santé appartient au patient et est transversal, sous consentement ; l'argent vit dans un ledger en double entrée, append-only.
- Toute action sensible (argent, données médicales, consentements) écrit dans `AuditLog` (immuable).
- Auth : téléphone + OTP SMS en priorité ; un même `User` peut cumuler des rôles (médecin ET tuteur).
- Tests obligatoires sur : permissions/cloisonnement tenant, ledger, consentements.

### Frontend (Next.js / Vireo)
- Toujours réutiliser les composants et tokens `--ax-*` de Vireo avant d'écrire du neuf. Écrans utiles déjà présents : dashboard `healthcare`, auth (`sign-in`, `two-step` → OTP), apps `calendar`/`contacts`/`chat`, tables, formulaires.
- Trois espaces : centre/médical (dashboard riche), patient & tuteur (parcours simplifiés, mobile-first, littératie numérique faible), site vitrine (landing).
- Exigences UX non négociables : mobile-first sur Android d'entrée de gamme, pages légères (faible connectivité aux Comores), vocabulaire simple sans jargon, accessibilité (contrastes, tailles de touche).

### Principes transverses
- Secret médical : le tuteur qui paie ne voit PAS le dossier médical par défaut — uniquement demandes de paiement, montants, nature générique de l'acte, reçus. Tout accès élargi = consentement explicite, tracé, révocable.
- RGPD dès la conception (les tuteurs sont résidents UE) : minimisation, consentements, droit d'effacement.
- Le module paiement est une abstraction PSP (**Stripe retenu** côté diaspora) ; le ledger interne en double entrée fait foi. Conversion EUR→KMF transparente : taux affiché avant paiement, figé à la transaction, reçu en double devise, chaque écriture du ledger porte sa devise et le taux appliqué.
- Chantier dédié « IA de reprise du papier » (onboarding des centres par numérisation de leurs archives — étude à mener, voir §5.5 de l'étude des besoins) : l'IA propose, un soignant valide ; provenance tracée jusqu'au document source.

## Stack Claude du projet

### Agents projet (`.claude/agents/`)
- **chioni-django-architect** — conception et implémentation backend (modèles, DRF, multi-tenant, ledger, permissions).
- **chioni-vireo-frontend** — construction du frontend en exploitant le template Vireo.
- **chioni-health-data-guardian** — revue adversariale de tout code touchant l'argent, les données médicales ou les consentements. À lancer après chaque feature sensible.
- **chioni-ux-care** — revue « soin et attention » des parcours utilisateurs (simplicité, mobile-first, accessibilité, ton).

### Skills globaux à utiliser selon la tâche
| Tâche | Skill(s) |
|---|---|
| Backend Django / DRF / ORM | `django-expert`, `django-patterns` |
| Sécurité Django (auth, permissions, déploiement) | `django-security` |
| Next.js App Router, RSC, server actions | `nextjs-developer` |
| Design UI/UX, palettes, typographie, guidelines | `ui-ux-pro-max`, `frontend-design` |
| Audit d'accessibilité / bonnes pratiques web | `web-design-guidelines` |
| Graphiques et dashboards | `dataviz` |
| Revue de code / sécurité avant merge | `code-review`, `security-review`, `simplify` |
