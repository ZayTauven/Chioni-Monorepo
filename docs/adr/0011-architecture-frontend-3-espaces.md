# ADR 0011 — Architecture frontend : élagage de Vireo et les 3 espaces

- **Statut** : acté (chantier « frontend 3 espaces »)
- **Date** : 2026-08-13

## Contexte

Le backend est complet jusqu'à la couche API (ADR 0008/0009/0010). Le frontend est une copie fidèle du template Vireo (Next.js 15, App Router, ~59 000 lignes de TSX) dont ~49 % est hors sujet (crypto, NFT, e-commerce catalogue, jobs…). Le template n'a **ni client HTTP, ni auth réelle, ni i18n** : les écrans sont autonomes avec données mock. Le design system est du **CSS pur** (classes `ax-*`, tokens `--ax-*` en 3 couches), pas des composants React. La référence source intacte vit dans `vireo template/` (lecture seule) : tout écran supprimé de `frontend/` reste repêchable.

Exigences produit : trois espaces (centre = dashboard riche ; patient et tuteur = parcours simplifiés, mobile-first, littératie numérique faible), textes UI en français, pages légères, et l'invariant éthique de la porte de confirmation du titulaire visible dès l'accueil patient.

## Décision

### Élagage

`frontend/` ne garde que ce qui est réellement adapté ; le reste est supprimé (récupérable dans `vireo template/`). Conservés : le shell (`src/components/`), le design system complet (`src/styles/`), la plomberie (`src/lib/`, `src/context/`, `src/hooks/`), et les écrans servant de base : `dashboards/Healthcare`, `apps/Contacts`, `tables/DataTables`, `forms/Wizard`, `ecommerce/{Invoices,InvoiceDetails,CreateInvoice}`, `pages/{Landing,Profile,ProfileSettings,Team,Starter,Notifications,Logout}`, `error/*`, `auth/{SignInBasic,SignInCover,TwoStepBasic,TwoStepCover,authShared}`, `Widgets` (catalogue interne), `Placeholder`. Dépendance `leaflet` retirée ; `next.config.ts` vidé des hôtes d'images de démo ; JSON morts supprimés.

### Routage — un route group par espace

```
app/(bare)/            → landing "/" (vitrine), /auth/* (OTP, staff), pages d'erreur
app/(centre)/centre/…  → shell Vireo complet (sidebar + header), nav propre à l'espace
app/(patient)/patient/…→ chrome léger mobile-first (top bar simple + tab bar basse)
app/(tuteur)/tuteur/…  → même chrome léger, nav tuteur
```

- Le manifeste de navigation unique de Vireo (`nav-manifest.json`) est remplacé par **un manifeste par espace** ; la sidebar/breadcrumb/palette ne servent que l'espace centre.
- Patient et tuteur n'utilisent **pas** le shell desktop : un chrome dédié minimal (header + navigation par onglets en bas, 4–5 entrées max) construit avec les composants `ax-*` existants. C'est le seul « neuf » de chrome autorisé — tout le reste réutilise Vireo.
- Textes en dur **en français** (i18n shikomori = phase 2, l'extraction se fera à ce moment-là). Libellés FR des enums API centralisés dans `src/lib/labels.ts`.

### Auth et session

- Parcours nominal : `/auth/sign-in` (téléphone, région KM) → `POST /auth/otp/request/` → `/auth/verify` (écran 6 cases repris de `TwoStepBasic`) → `POST /auth/otp/verify/` → routage selon `me`.
- Login staff par mot de passe (`POST /auth/token/`) sur `/auth/staff`, accessible par lien discret.
- **Routage des espaces d'après `/auth/me/`** : `staff_memberships` → centre ; `patient_profile` → patient ; `guardian_profile` → tuteur. Plusieurs casquettes → écran de choix d'espace (et commutateur dans le menu profil). Aucune casquette → écran d'orientation (créer un profil patient — porte B — ou un profil tuteur).
- Tokens en `localStorage` (`chioni:access`, `chioni:refresh`), client API central `src/lib/api.ts` : Bearer, **mutex de refresh single-flight** (le refresh SimpleJWT est à usage unique), normalisation des 3 formats d'erreurs DRF, redirection login sur 401 non rattrapable. Garde d'accès **côté client** dans le layout de chaque espace (pas de middleware serveur : les écrans sont déjà tous `'use client'`, et le token ne vit pas en cookie).
- Le contrat API de référence est `docs/frontend/api-contract.md`.

### Périmètre MVP frontend

Uniquement ce que l'API expose réellement. Pas d'écran rendez-vous, caisse, messagerie ni upload (inexistants côté API) — au besoin, placeholders « bientôt » assumés. Côté tuteur, le paiement suit le contrat PSP fake : devis (`quote/`) → `pay/` → polling du statut jusqu'à `payee` ; l'UI d'attente l'explique honnêtement.

## Conséquences

- Le frontend reflète strictement la surface API : chaque écran branché est démontrable de bout en bout.
- Les invariants d'affichage sensibles se vérifient en revue guardian : le tuteur ne voit **jamais** `label` d'une ligne (nature générique seule, ADR 0005) ; l'écran patient « mes tuteurs » traite `attente_confirmation_titulaire` comme un appel à l'action prioritaire (porte de confirmation, ADR 0010) ; aucun montant n'est jamais envoyé par le client (`pay/` à corps vide).
- La suppression d'écrans Vireo est réversible via `vireo template/` ; l'élagage ne se discute donc pas écran par écran.
- L'extraction i18n (phase 2) portera sur des écrans déjà en français — coût assumé.

## Addendum S4 — le 4ᵉ espace « plateforme » (2026-08-14, ADR 0017)

Le back-office Chioni rejoint les trois espaces. Choix arrêtés à l'implémentation :

1. **Route group `app/(plateforme)/plateforme/*`**, garde `RequireSpace('plateforme')`.
   La porte est `platform_staff !== null` dans `/auth/me/` — jamais déduite d'un droit
   d'admin Django (`is_staff`/`is_superuser` n'existent pas dans le payload).
   `spacesOf()`, `homeOfSpace()` et le `SpaceChooser` s'étendent ; `routeAfterSignIn`
   est inchangé (sa règle « une seule casquette → son espace » couvre le cas).
2. **`CenterProvider` n'est JAMAIS monté dans cet espace** — un exploitant gouverne des
   tenants, il n'appartient à aucun. La règle est rendue vérifiable par lecture des
   imports : les écrans de `src/screens/plateforme/` n'importent que
   `screens/plateforme/shared.tsx`, qui ne réexporte aucune primitive liée au contexte.
3. **Chrome sobre plutôt que shell complet** : `src/components/shell-platform/`
   reprend la structure DOM Vireo (`.ax-layout` → sidebar + `.ax-shell` → header +
   `<main>` + footer) SANS le loader de page, la lueur ambiante, le customizer ni la
   palette ⌘K. Le sélecteur de centre actif du header disparaît par nature.
4. **Un SECOND manifeste de navigation** (`src/data/platform-nav-manifest.json`) plutôt
   que des nœuds ajoutés à celui du centre. Motif : `nav-manifest.json` se déclare
   CENTRE-ONLY dans son propre `meta` et alimente trois surfaces partagées (sidebar,
   fil d'Ariane, palette ⌘K) qui vivent toutes dans le shell du centre — y ajouter
   « Centres » ou « Demandes d'effacement » aurait fait fuiter des entrées de
   back-office dans la palette d'un directeur, et imposé un filtre d'espace à chacune de
   ces surfaces. Le **contrat de nœud** reste partagé (mêmes types, même fonction
   d'indexation `indexManifest` exportée de `lib/manifest.ts`) ; seules les DONNÉES
   diffèrent. Un troisième espace manifesté suivrait le même patron.
5. **`/plateforme` EST le registre des centres** : pas de tableau de bord exploitant en
   S4 (il naîtrait vide, et le module Support riche est S5). La fiche d'un tenant vit
   sous `/plateforme/centres/[id]`.
6. **Le rôle `support` ne voit aucune commande d'écriture montée** (patron du bloc
   finances du dashboard centre) : `usePlatformRole().canWrite` gate le rendu, pas
   seulement l'action. Un back-office qui propose des gestes qu'il refusera apprend à
   ses exploitants à s'en méfier.
7. **Les droits RGPD vivent dans `src/screens/lite/MyDataCard.tsx`**, partagée par les
   espaces patient ET tuteur : ils appartiennent à la personne, pas à une casquette.
   Elle n'utilise que des classes `ax-*` neutres (ni `pat-*`, ni `tuteur-*`).
