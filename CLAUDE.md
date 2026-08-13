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

- **Backend complet jusqu'à la couche API/services** : venv `backend/.venv` (Python 3.13), settings via `backend/.env` (django-environ), `/api/v1/health/` public, Swagger sur `/api/docs/`, DRF deny-by-default.
  - **Modèles durcis** (revue adversariale) : append-only ORM + **triggers PostgreSQL** (ledger, reçus, audit + validation same-patient / lien révoqué définitif / facture gelée — ADR 0006), `generic_category` distinct du libellé comptable (ADR 0005), `Consent.objects.active_scopes()` = point de vérité.
  - **API phase A** : JWT + blacklist + throttling (`/api/v1/auth/*`, `/auth/me/` = routeur des 3 espaces), architecture permissions (ADR 0008 : une vue = une casquette, cloisonnement au queryset, 404 déterministe, `guardian_links_with_scope` seul chemin tuteur), 3 portes d'onboarding, consentements, fusion de doublons anti-cycle, AuditLog câblé (payload = références only). Lecture clinique segmentée par rôle (diagnostic = rôles cliniques seuls ; ordonnances + pharmacien ; staff admin = vue exploitation sans clinique) ; identité d'un profil revendiqué non modifiable par le staff. Téléphones normalisés E.164 (`apps/common/phones.py`, région KM).
  - **API phase B (Pont de Confiance)** : machine à états exclusive (`payee` uniquement via webhook signé → ledger équilibré + intent lié), abstraction PSP (`psp/fake.py` HMAC ; `psp/stripe.py` drop-in à implémenter — garde-fou boot : fake interdit si DEBUG=False), FX EUR→KMF à taux figé (devis avant paiement, frais 2,50 % en sus, le centre reçoit 100 % en KMF), reçus double devise relus depuis le ledger, litiges (`Dispute`), accusé patient stocké (indicateur de mission). ADR 0009.
  - **365 tests verts** (`pytest` depuis `backend/`, ~25 s), dont 3 campagnes adversariales conservées en régression (`test_hardening.py`, `test_adversarial_api_recheck.py`). ADR 0001→0009 dans `docs/adr/`.
- **Frontend initialisé** : copie fidèle de Vireo, paquet `chioni-frontend`, `.env.local` avec `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`, `npm run build` OK (leaflet ajouté — manquait au template). Élagage des sections hors sujet (crypto, NFT, e-commerce…) PAS encore fait.
- Git initialisé sur `main`, **aucun commit encore**.
- **Auth OTP SMS en place** : `/api/v1/auth/otp/request|verify/` (code 6 chiffres haché HMAC, 10 min, 5 tentatives, anti-énumération byte-à-byte, throttles par téléphone + IP), abstraction SMS `apps/common/sms.py` (console/memory/stub, `stub` à implémenter pour agrégateurs comoriens ; garde-fou boot comme le PSP), activation des comptes ombres + revendication STRICTE de profil (jamais sur simple téléphone déclaratif d'un profil guichet — ADR 0010). Login mot de passe JWT conservé pour le staff/back-office. Envoi via Celery.
  - **Porte de confirmation du titulaire (invariant éthique — cœur du produit)** : toute arrivée d'un lien de tutelle sur un profil REVENDIQUÉ exige la confirmation explicite du patient — que le lien arrive par revendication OTP OU par fusion de doublons. Le lien passe en `PENDING_CLAIMANT_CONFIRMATION` (consentements révoqués, aucun accès `paiements`) jusqu'à ce que le patient l'active via `POST /patients/me/guardians/{link}/confirm/` (ou le refuse définitivement via `/decline/`). Tant qu'un profil est NON revendiqué, le lien porte-A reste actif (le tuteur gère le dossier — cas Mariama sans smartphone). Ne jamais réintroduire un lien tuteur `ACTIVE` sur un profil revendiqué sans passer par cette porte.
- Reste à faire (dans l'ordre) : adaptation du frontend aux 3 espaces (élagage de Vireo + branchement API, dont écrans OTP), notifications SMS/e-mail métier (Celery), intégration Stripe réelle (`psp/stripe.py`) + backend SMS agrégateur comorien (chantiers dédiés avec clés), purge planifiée des `OtpCode` expirés, maquettes des parcours, étude paiement partenaire local (risque n° 1), étude du module IA de reprise du papier. Vigilances actées par le guardian : ne jamais exposer `Dispute.reason` à l'autre partie si des vues litige patient/tuteur apparaissent ; règle « pas de PII dans les payloads d'audit » = contrat de revue permanent.

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
- **Règle d'ingénierie (issue de la revue adversariale)** : les invariants de `GuardianLink`, `Invoice`, `PatientProfile` et `PaymentRequestShare` vivent dans `save()`/`clean()` — ne JAMAIS muter ces modèles par `update()`/`bulk_update()` bruts ; toute écriture passe par un service qui rejoue `save()`. Les transitions les plus sensibles ont en plus un trigger PostgreSQL (voir ADR 0006). Les probes résiduelles documentées dans `backend/tests/test_hardening.py` (machine à états PaymentRequest, cohérence intent↔ledger, `active_scopes` + `shared_with` à combiner dans les permissions) sont des invariants OBLIGATOIRES de la couche API/services.
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
