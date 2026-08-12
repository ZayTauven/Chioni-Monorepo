# Chioni — Étude des besoins

> SaaS de gestion des centres de santé pour l'Union des Comores, avec un « Pont de Confiance » reliant patients, corps médical et diaspora.
>
> Version 1.1 — 12 août 2026 — **cadrage validé** par le porteur de projet, amendé : PostgreSQL confirmé (base dev créée), Stripe retenu, abonnement SaaS par centre retenu, module de conversion EUR→KMF, chantier dédié « IA de reprise du papier », priorité aux fonctionnalités centres.

---

## 1. Contexte et problème à résoudre

### 1.1 Le terrain

- Aux Comores, l'offre de soins repose sur des hôpitaux publics (ex. El-Maarouf à Moroni), des centres de santé de district et un tissu croissant de cliniques et cabinets privés. La gestion y est encore très largement **papier** : dossiers patients, ordonnances, caisses.
- Le financement des soins est majoritairement **direct (out-of-pocket)** : peu de couverture assurantielle, le patient ou sa famille paie au guichet.
- La **diaspora comorienne** (France en tête — Marseille, Île-de-France — mais aussi Mayotte, La Réunion, pays du Golfe) finance une part considérable des dépenses des familles restées au pays. Les transferts de la diaspora représentent une part majeure du PIB comorien (parmi les taux les plus élevés au monde — chiffre exact à sourcer pour le dossier investisseurs).

### 1.2 Le problème central

Quand un proche tombe malade aux Comores, le schéma habituel est :

```
Diaspora ──(Western Union / Ria / mobile money)──► Intermédiaire sur place ──► ??? ──► Soins (ou pas)
```

L'argent transite par un **intermédiaire individuel** (membre de la famille, connaissance). Ce maillon est le point de défaillance : détournement partiel ou total des fonds, soins retardés ou jamais réalisés, absence totale de traçabilité. Conséquences :

- le **patient** ne reçoit pas les soins financés ;
- le **payeur diaspora** perd confiance et finit par sur-contrôler ou sous-financer ;
- le **centre de santé** subit des impayés et des parcours de soins interrompus ;
- le tissu familial se dégrade (soupçons, conflits).

### 1.3 La réponse Chioni

Chioni attaque le problème sur deux fronts indissociables :

1. **Numériser la gestion des centres de santé** (dossiers patients, consultations, ordonnances, facturation) — c'est le socle qui rend l'information fiable et vérifiable.
2. **Le Pont de Confiance** : permettre au patient de partager son carnet/ordonnance avec ses proches payeurs, et permettre à la diaspora de **payer directement le centre de santé** pour un acte identifié — l'argent ne passe plus par un intermédiaire individuel.

Principe fondateur : **chaque franc envoyé est relié à un patient, un acte et un prestataire, avec un reçu vérifiable à la clôture.**

Posture produit importante : Chioni doit être présenté comme un outil pour **« aider mieux »**, jamais comme un outil de surveillance de la famille. La dignité de tous les acteurs (y compris l'ancien intermédiaire, souvent de bonne foi) est une contrainte de conception à part entière.

Seconde posture, tout aussi structurante : la mission est communautaire, mais **le fond de commerce, ce sont les centres de santé** — ce sont eux qui paient l'abonnement. Il faut les « gâter » en fonctionnalités : gestion d'activité complète, outils d'optimisation, tableaux de bord qui rendent le directeur meilleur dans son métier. Le Pont de Confiance amène de la patientèle solvabilisée aux centres ; le SaaS socle doit, lui, être si bon qu'un centre le garderait même sans le Pont.

---

## 2. Acteurs et personas

| Acteur | Rôle sur la plateforme | Enjeux clés |
|---|---|---|
| **Centre de santé** (directeur, secrétariat, caisse) | Tenant SaaS : gère patients, RDV, actes, facturation, encaissements | Simplicité de saisie, fiabilité de la caisse, image de sérieux |
| **Corps médical** (médecin, infirmier, sage-femme) | Consultations, carnet de santé, ordonnances | Rapidité (pas de double saisie), secret médical |
| **Patient résident** | Consulte son carnet, partage ordonnances/factures, demande un soutien | Accès simple (mobile), maîtrise de ce qui est partagé |
| **Tuteur diaspora** | Inscrit et suit ses protégés, reçoit les demandes, paie à distance, reçoit les reçus | Confiance, visibilité sur l'usage des fonds, paiement facile en EUR |
| **Pharmacie / laboratoire** *(phase 2+)* | Reçoit les ordonnances, confirme la délivrance | Volume de clients solvabilisés |
| **Admin plateforme Chioni** | Onboarding et vérification (KYC) des centres, support, supervision | Lutte anti-fraude, conformité |

### Personas de référence

- **Dr Saïd**, généraliste dans une clinique privée à Moroni. Consulte 30 patients/jour, tout au papier. N'adoptera l'outil que s'il lui fait gagner du temps dès la première semaine.
- **Mariama**, 58 ans, hypertendue, à Mitsamiouli. Smartphone Android d'entrée de gamme, littératie numérique faible, parle shikomori au quotidien. Sa fille paie ses soins depuis Marseille.
- **Nassim**, 34 ans, aide-soignant à Marseille. Envoie 150–300 € plusieurs fois par an pour la santé de sa mère et de deux neveux. A déjà vécu deux détournements. Veut payer « l'hôpital, pas le cousin ».
- **Anfia**, 26 ans, étudiante à Moroni, très à l'aise avec le numérique. Gère elle-même son dossier et celui de sa grand-mère.

---

## 3. Les trois portes d'entrée (onboarding)

Les trois circuits d'inscription demandés sont **tous retenus**, car chacun correspond à un persona réel :

| Porte | Qui initie | Parcours |
|---|---|---|
| **A. Diaspora d'abord** | Le tuteur (Nassim) | Crée son compte, inscrit ses protégés (nom, téléphone, lien de parenté), gère leurs dossiers « administratifs ». Le protégé est invité par SMS à activer son accès. |
| **B. Patient autonome** | Le patient (Anfia) | Crée son compte, gère son dossier, **invite** un ou plusieurs tuteurs qui acceptent le lien. |
| **C. Centre de santé** | Le centre (clinique du Dr Saïd) | Crée le dossier patient au guichet, enregistre les coordonnées du tuteur ; patient et tuteur reçoivent une invitation. |

**Point de conception critique — le rapprochement d'identité.** Un même patient peut être créé par la porte A puis se présenter dans un centre (porte C) : il faut un mécanisme de **détection et fusion des doublons** (correspondance sur téléphone + nom + date de naissance, confirmation par OTP ou en présentiel au centre), sinon le carnet de santé se fragmente. Il n'existe pas d'identifiant patient national exploitable : l'identité pivot sera **le numéro de téléphone vérifié par OTP**, complété par la vérification physique au centre. Les profils créés par un tiers (portes A et C) restent « non revendiqués » jusqu'à activation par le patient, avec des droits limités pour le créateur.

---

## 4. Le Pont de Confiance — conception détaillée

### 4.1 Flux nominal

```
1. Consultation        Le médecin saisit l'acte ; le centre émet une demande de
                       paiement (consultation, examens, ordonnance chiffrée).
2. Partage             Le patient (ou le centre, avec son consentement) transmet
                       la demande au tuteur : notification + montant + détail.
3. Paiement            Le tuteur paie en ligne depuis l'étranger (carte EUR,
                       virement, mobile money). Les fonds sont fléchés vers le
                       centre de santé — jamais vers un particulier.
4. Réalisation         Le centre confirme l'acte / la pharmacie confirme la
                       délivrance des médicaments.
5. Clôture             Reçu numérique horodaté et signé envoyé au tuteur et au
                       patient. Chaque étape est journalisée.
```

### 4.2 Variantes à prévoir dès la conception (même si livrées plus tard)

- **Bon de soins prépayé (voucher)** : le tuteur achète un montant utilisable dans le réseau Chioni, matérialisé par un QR code que le patient présente au guichet — utile pour les urgences et les soins non encore prescrits.
- **Cagnotte familiale** : plusieurs tuteurs cofinancent une même demande (cas très fréquent culturellement).
- **Solde santé du patient** : provision déposée à l'avance, débitée acte par acte.
- **Séquestre (escrow)** : les fonds ne sont reversés au centre qu'après confirmation de réalisation — protection maximale mais complexité réglementaire ; le MVP peut démarrer en paiement direct au centre + reçu obligatoire.

### 4.3 La fraude ne disparaît pas, elle se déplace — menaces à traiter

| Menace | Parade |
|---|---|
| Centre/agent véreux : fausse facture, acte surfacturé ou jamais réalisé | KYC des centres à l'onboarding, grille tarifaire visible, reçus signés, confirmation de réalisation par le patient (bouton « j'ai bien reçu ce soin »), traitement des litiges, notation interne des centres |
| Collusion patient-intermédiaire (faux patient, fausse maladie) | Dossier médical réel exigé (acte relié à une consultation), vérification d'identité au guichet |
| Compte tuteur compromis | OTP, confirmation des paiements, plafonds |
| Employé du centre qui détourne la caisse | Rapprochement automatique paiements en ligne ↔ actes, journal d'audit immuable |

### 4.4 Confidentialité : payer n'est pas tout savoir

Le tuteur finance, mais **le secret médical reste la règle**. Modèle de partage granulaire, contrôlé par le patient :

- Par défaut, le tuteur voit : demandes de paiement, montants, nature générique de l'acte (« consultation », « analyses », « médicaments »), reçus.
- Sur autorisation explicite du patient (consentement tracé, révocable) : ordonnance détaillée, éléments du carnet.
- Cas particuliers à spécifier avec soin : mineurs (le tuteur légal voit plus), patients hors d'état de consentir (procédure d'urgence tracée), pathologies sensibles.

C'est le cœur éthique du produit : **la confiance financière ne s'achète pas au prix de l'intimité médicale.**

### 4.5 Point dur n° 1 du projet : les rails de paiement

C'est le risque majeur, à instruire en priorité (étude de faisabilité dédiée avant tout développement du module) :

- **Côté diaspora** : **Stripe retenu** — carte bancaire EUR depuis la France, éventuellement virement SEPA.
- **Côté Comores** : réseau bancaire limité ; mobile money local (offres des opérateurs télécoms comoriens — à vérifier précisément : couverture, API disponibles, agrégateurs régionaux) ; reversement aux centres en KMF.
- **Réglementaire** : un flux EUR → KMF fléché vers un tiers relève potentiellement de la réglementation des transferts de fonds / établissements de paiement. Un **partenariat avec une banque locale ou un établissement de paiement agréé** sera probablement nécessaire ; Chioni ne doit pas détenir les fonds elle-même sans statut adapté.
- **Transparence du change — module de conversion EUR→KMF** (décision actée) : le taux est affiché au tuteur AVANT paiement, figé à la transaction, et le reçu est établi en double devise (montant payé en EUR, montant reçu par le centre en KMF, frais explicites). Le tuteur sait exactement ce qui arrive au centre — la conversion ne doit jamais être une boîte noire, ce serait reproduire l'opacité qu'on combat.
- Conséquence d'architecture : le module paiement doit être une **abstraction PSP** (Stripe d'abord, fournisseur interchangeable) adossée à un **ledger interne en double entrée** qui fait foi pour la traçabilité, quel que soit le rail utilisé — chaque écriture porte sa devise et le taux appliqué.

---

## 5. Périmètre fonctionnel par module

Priorisation : **[M]** MVP · **[2]** phase 2 · **[3]** phase 3+

### 5.1 Gestion du centre de santé (le SaaS socle)
- [M] Établissements multi-tenant, profil du centre, grille tarifaire des actes
- [M] Personnel et rôles (directeur, médecin, secrétaire, caissier)
- [M] Registre patients, recherche, création au guichet (porte C)
- [M] Rendez-vous et file du jour (simple d'abord)
- [M] Consultations : motif, diagnostic, actes réalisés
- [M] Facturation et caisse : facture par acte, encaissement (espèces, mobile money, Pont de Confiance), journal de caisse
- [2] Hospitalisations, lits ; stocks et pharmacie interne ; examens/labo
- [2] Tableaux de bord du centre (activité, recettes, impayés)
- [2] **Optimisation d'activité** (les centres sont le fond de commerce — les gâter) : taux d'occupation et d'affluence, relances automatiques des impayés et des RDV manqués, performance par praticien/acte, prévisions d'affluence, export comptable
- [3] Statistiques sanitaires anonymisées (autorités de santé), API assureurs/mutuelles

### 5.2 Carnet de santé du patient
- [M] Identité, antécédents, allergies, traitements en cours
- [M] Historique des consultations et ordonnances (alimenté par les centres)
- [M] Documents (résultats, comptes rendus) en pièces jointes
- [M] Partage granulaire avec tuteurs (cf. 4.4), consentements tracés et révocables
- [2] Vaccinations, suivi maternité, maladies chroniques (rappels)
- Le carnet **appartient au patient** et agrège ses épisodes de soins de tous les centres — il est transversal aux tenants (voir architecture, § 7.3).

### 5.3 Pont de Confiance
- [M] Liens de tutelle (invitations dans les deux sens, multi-tuteurs, multi-protégés)
- [M] Demandes de paiement reliées à des actes/ordonnances
- [M] Paiement en ligne côté diaspora (Stripe, carte EUR)
- [M] Conversion EUR→KMF transparente : taux affiché avant paiement, figé à la transaction, reçu en double devise
- [M] Reçus numériques horodatés, historique complet par protégé
- [M] Confirmation de réalisation du soin par le centre + accusé du patient
- [2] Mobile money local, cagnotte multi-tuteurs, voucher QR, séquestre
- [3] Solde santé, paiements récurrents (maladies chroniques)

### 5.4 Transverse
- [M] Authentification : téléphone + OTP SMS en priorité (email en second), sessions sécurisées
- [M] Notifications : SMS (canal principal aux Comores) + e-mail ; [2] WhatsApp, push
- [M] i18n : **français** d'abord, architecture prête pour **shikomori** ([2]) et arabe ([3])
- [M] Journal d'audit immuable sur toutes les actions sensibles (argent, dossier médical, consentements)
- [M] Back-office Chioni : onboarding/KYC des centres, supervision, support

### 5.5 Chantier dédié — Reprise du papier assistée par IA

Décision actée : ce module fait l'objet d'un **chantier d'étude dédié** (le potentiel est énorme, il mérite sa propre étude approfondie avant spécification).

**La vision.** Un centre qui rejoint Chioni apporte des années d'archives papier : dossiers patients, registres, ordonnances, carnets. Plutôt que d'exiger une ressaisie manuelle (le frein d'adoption n° 1), le centre photographie/scanne ses documents et un pipeline IA (OCR + extraction structurée par modèle de langage) crée les dossiers patients et reconstitue leur **historique médical**. Double bénéfice stratégique :

1. **Adoption** : l'onboarding d'un centre passe de « des semaines de saisie » à « déposez vos archives » — c'est la mitigation la plus puissante du risque n° 2.
2. **Valeur unique** : un historique médical numérisé des patients comoriens n'existe nulle part ailleurs ; c'est un actif différenciant majeur pour les centres comme pour les patients.

**Garde-fous impératifs** (données de santé, l'IA peut se tromper) :
- L'IA **propose**, un soignant **valide** — aucune donnée extraite n'entre dans le carnet sans validation humaine ;
- Traçabilité de provenance : chaque donnée extraite reste liée à l'image du document source ;
- Confidentialité du traitement (où et comment les documents sont traités — même exigence que le reste de la plateforme) ;
- Robustesse au réel comorien : écritures manuscrites, documents dégradés, mélange français/arabe/shikomori.

**À explorer dans l'étude dédiée** : périmètre exact (quels types de documents d'abord), faisabilité sur un échantillon réel d'un centre pilote, coûts d'inférence et modèle économique du module, et les prolongements (rappels de suivi, détection de doublons patients via les archives, codage automatique des actes, pré-remplissage des consultations…).

---

## 6. Exigences non fonctionnelles

| Exigence | Traduction concrète |
|---|---|
| **Sécurité des données de santé** | Chiffrement en transit et au repos, contrôle d'accès par rôle strict (RBAC + règles objet), cloisonnement par tenant, journal d'audit, sauvegardes testées |
| **Conformité** | RGPD dès le départ (les tuteurs sont résidents UE) : minimisation, consentements, droit d'accès/effacement, registre des traitements. Vérifier le cadre comorien sur les données de santé. Choix d'hébergement documenté |
| **Faible connectivité** | Pages légères (budget poids strict), tolérance aux coupures (reprise de formulaires), SMS en canal de secours ; PWA/offline en phase 2 |
| **Mobile-first** | Tout parcours patient/tuteur conçu d'abord pour un petit écran Android d'entrée de gamme |
| **Simplicité radicale** | Publics à littératie numérique très variable : parcours courts, vocabulaire simple, icônes, pas de jargon ; tests utilisateurs réels avant chaque jalon |
| **Accessibilité** | Contrastes, tailles de touche, lisibilité — traité comme une exigence, pas un bonus |
| **Disponibilité** | Objectif raisonnable (99 %+) ; la caisse d'un centre ne doit jamais être bloquée par une panne réseau (mode dégradé à spécifier) |

---

## 7. Architecture technique cible

### 7.1 Stack retenue

| Couche | Choix |
|---|---|
| Backend | **Django 5 + Django REST Framework**, **PostgreSQL** (validé — base de dev `chioni_db` créée, config dans CLAUDE.md), Redis + Celery (notifications, tâches asynchrones, relances) |
| Frontend | **Next.js 15 (App Router) + React 19 + Tailwind v4**, à partir du template **Vireo** (design « Aurora », tokens `--ax-*`) présent dans le repo |
| Auth | JWT (SimpleJWT) ou sessions + OTP SMS ; rôles multi-casquettes (un même humain peut être médecin ET tuteur) |
| Paiements | Abstraction PSP (Stripe d'abord) + **ledger interne en double entrée** |
| Infra (à trancher) | Hébergement européen probable (RGPD, latence acceptable vers Moroni), CDN, sauvegardes hors site |

### 7.2 Exploitation du template Vireo

Le template fournit : shell d'admin complet (sidebar, topbar, thème clair/sombre), **dashboard healthcare** directement réutilisable, pages d'auth (sign-in, two-step → OTP), apps (calendar → RDV, contacts → patients, chat → messagerie interne), tables, formulaires, graphiques ApexCharts. Stratégie : **copier le template vers `frontend/`** puis élaguer (crypto, NFT, e-commerce…) et adapter les écrans conservés aux entités Chioni. Trois espaces cibles :

1. **Espace centre/médical** (dashboard riche — c'est là que Vireo brille) ;
2. **Espace patient & tuteur** (parcours simplifiés, mobile-first — réutiliser les tokens mais épurer fortement) ;
3. **Site vitrine** (landing du template en base).

### 7.3 Modèle de données — esquisse

```
User ─────────────┬── StaffMembership ──► HealthCenter (tenant)
                  ├── PatientProfile ◄── GuardianLink ──► GuardianProfile (diaspora)
                  │        │
                  │        ├── Encounter (consultation, par centre)
                  │        │      ├── ActePerformed (acte + tarif)
                  │        │      └── Prescription (ordonnance)
                  │        ├── HealthRecordEntry (carnet transversal)
                  │        └── Consent (qui voit quoi, révocable, tracé)
                  │
PaymentRequest ◄── Invoice ◄── Encounter
      │
      ├── PaymentIntent (PSP) ──► LedgerEntry (double entrée) ──► Payout (vers centre)
      └── Receipt (reçu signé, horodaté)

AuditLog (immuable, toutes actions sensibles)
```

Règle structurante : les **données médicales** sont rattachées au patient (transversales aux centres, sous consentement) ; les **données d'exploitation** (RDV, caisse, personnel) sont cloisonnées par tenant ; l'**argent** vit dans un ledger central inviolable.

---

## 8. Modèle économique

**Modèle retenu : l'abonnement SaaS par centre** (paliers selon taille/nombre de praticiens). C'est le socle de revenus — et cela renforce la ligne produit : le centre est le client, il doit en avoir pour son argent (cf. §1.3 et le module optimisation du §5.1).

- **Gratuit pour les patients et les tuteurs** — non négociable pour l'adoption.
- Le Pont de Confiance est un **argument de vente de l'abonnement** (il amène aux centres une patientèle solvabilisée), pas une source de commission à ce stade ; une commission éventuelle reste une piste à réétudier plus tard, avec prudence (taxer la santé détruirait la légitimité).
- Plus tard : paliers premium (stocks, labo, module IA de reprise du papier, API assureurs).

---

## 9. Risques majeurs et questions ouvertes

| # | Risque | Gravité | Mitigation |
|---|---|---|---|
| 1 | **Réglementation des flux financiers transfrontaliers** (statut d'établissement de paiement, change EUR→KMF) | Critique | Étude de faisabilité dédiée AVANT le développement du module ; partenariat banque locale / EP agréé ; module de conversion EUR→KMF transparent (taux figé, reçu double devise) ; MVP possible en « paiement au centre via PSP du centre » |
| 2 | Adoption par les centres (effort de saisie vs papier) | Élevée | Pilote avec 1–2 cliniques, saisie ultra-rapide, bénéfice caisse immédiat, **chantier IA de reprise du papier (§5.5)** |
| 3 | Doublons/erreurs d'identité patient | Élevée | Mécanisme de fusion (§ 3), OTP, vérification au guichet |
| 4 | Fraude déplacée vers les centres | Élevée | KYC, reçus, confirmation patient, litiges (§ 4.3) |
| 5 | Cadre légal comorien sur les données de santé | Moyenne | Veille juridique, conseil local, RGPD comme plancher |
| 6 | Connectivité et équipement des centres | Moyenne | Web léger, mode dégradé, support d'onboarding |
| 7 | Friction sociale (contournement de l'intermédiaire familial) | Moyenne | Positionnement « aider mieux », communication soignée, rôle valorisant pour l'aidant local (il peut rester le « référent » non financier) |

**Questions à trancher rapidement** : partenaire paiement (n° 1), centres pilotes, hébergement, statut juridique de Chioni, nom de domaine/marque.

---

## 10. Feuille de route proposée

| Phase | Contenu | Horizon indicatif |
|---|---|---|
| **0 — Cadrage & POC** | Maquettes des 3 parcours, validation terrain avec 1–2 cliniques à Moroni, étude paiement (risque n° 1), identité visuelle | 4–6 semaines |
| **1 — MVP** | Socle SaaS centre (patients, consultations, ordonnances, facturation) + tutelle + demandes de paiement + paiement carte EUR + reçus. Sans séquestre : paiement direct + confirmation | 3–4 mois |
| **2 — Confiance renforcée** | Mobile money local, séquestre, cagnotte, voucher QR, pharmacie, WhatsApp, shikomori, PWA, optimisation d'activité des centres | +3–4 mois |
| **3 — Écosystème** | Hospitalisations, stocks, labo, statistiques sanitaires, assureurs | ensuite |
| **Chantier parallèle — IA de reprise du papier** | Étude dédiée (§5.5) puis POC OCR/extraction sur les archives réelles d'un centre pilote, validation humaine systématique | étude dès la phase 1, POC en phase 2 |

**Indicateurs de succès (KPIs)** : centres actifs, patients enregistrés, tuteurs actifs, volume mensuel du Pont de Confiance, **% de demandes clôturées avec reçu confirmé** (l'indicateur de mission), délai médian demande → paiement, taux de litiges, rétention des centres à 6 mois.

---

## 11. Prochaines étapes immédiates

1. ~~Valider ce cadrage~~ — **fait** (v1.1, 12 août 2026).
2. Lancer l'étude de faisabilité paiement (risque n° 1) — Stripe côté diaspora, partenaire local à identifier.
3. Maquetter les trois parcours d'onboarding et le flux Pont de Confiance.
4. Initialiser le monorepo : `backend/` (Django + PostgreSQL `chioni_db`) + `frontend/` (copie élaguée de Vireo).
5. Modéliser la base (entités du § 7.3) et poser l'ossature d'API.
6. Ouvrir l'étude dédiée du module IA de reprise du papier (§ 5.5).
