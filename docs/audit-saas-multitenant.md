# Audit — modules multi-tenant SaaS : ce qui reste à réaliser

**Date** : 13/08/2026 · **État de référence** : commit `b5cb9c2`, 832 tests backend verts, build frontend vert, chantier « Gâter les centres » vagues 1–3 livré et revu (guardian ×3, UX care ×1), tests manuels de bout en bout validés.

**Méthode** : extraction exhaustive de la matrice permissions × vues du backend (71 routes API v1, 7 rôles staff, 3 casquettes hors staff, admin Django) croisée avec le périmètre fonctionnel de l'étude des besoins (§5). Tout constat ci-dessous est tiré du code, pas des intentions.

Ce document liste **ce qui doit être réalisé**. Il est volontairement neutre : les arbitrages (priorités, montée en niveau) sont à trancher avec le product owner.

---

## A. Photo de l'existant (rappel court)

| Module (étude §5)                                                                              | État                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Multi-tenant, profil centre, tarifs [M]                                                        | ✅ fait (tarifs : intégralité KMF verrouillée)                                                                |
| Personnel et rôles [M]                                                                         | ✅ fait (7 rôles, garde dernier directeur) — ❗ pas de réactivation, annuaire réservé directeur               |
| Registre patients, porte C, fusion [M]                                                         | ✅ fait                                                                                                       |
| Rendez-vous et file du jour [M]                                                                | ✅ fait (+ rappels J-1, calendrier Vireo)                                                                     |
| Consultations (motif, diagnostic, actes) [M]                                                   | ✅ fait — ❗ statut de consultation jamais clôturé                                                            |
| Facturation et caisse [M]                                                                      | ✅ fait (encaissement généralisé, tranches, contre-passation, journal) — ❗ annulation de facture inexistante |
| Tableaux de bord centre [2]                                                                    | ✅ fait (activité, finances, impayés)                                                                         |
| Carnet patient : identité, antécédents, allergies, traitements, consultations, ordonnances [M] | ✅ fait                                                                                                       |
| Carnet : documents en pièces jointes [M]                                                       | ❌ **absent** (aucun modèle Document)                                                                         |
| Pont de Confiance [M]                                                                          | ✅ fait (jusqu'aux litiges ; Stripe réel restant)                                                             |
| Auth OTP + consentements + audit immuable [M]                                                  | ✅ fait                                                                                                       |
| **Back-office Chioni : onboarding/KYC, supervision, support [M]**                              | ❌ **quasi absent** (admin Django brut uniquement)                                                            |
| Relances impayés / RDV manqués, export comptable, prévisions [2]                               | ❌ absents                                                                                                    |
| Hospitalisations/lits, stocks/pharmacie interne, examens/labo [2]                              | ❌ absents                                                                                                    |
| i18n shikomori [2], PWA/offline [2], mode dégradé caisse                                       | ❌ absents (architecture prête pour i18n : `labels.ts`, templates SMS centralisés)                            |

---

## B. Le trou structurant : le cycle de vie du tenant (back-office plateforme)

C'est le [M] de l'étude (§5.4) le moins couvert, et le cœur de « modules multi-tenant SaaS ». Aujourd'hui :

1. **Aucune API de création de `HealthCenter`** — l'onboarding d'un centre passe exclusivement par l'admin Django (ou `seed_demo`).
2. **Aucun endpoint d'amorçage du premier directeur** — `/centers/{c}/staff/` exige déjà un directeur en place ; le premier membership ne peut naître qu'en admin.
3. **Aucune API ni service de transition KYC** — `kyc_status` est read-only côté serializer, retiré par `update_center` ; seule la main de l'admin le change. Aucun champ de pièce justificative n'existe.
4. **`KycStatus.SUSPENDED` est mort** — déclaré, jamais lu : suspendre un centre ≡ « en attente », aucun comportement dédié.
5. **Le KYC ne bloque que le rail diaspora** — un centre non vérifié (ou « suspendu ») facture, encaisse au guichet, tient sa caisse et émet des reçus « G- » sans restriction (`record_cash_payment` s'en dispense explicitement). _Décision produit à prendre : que doit réellement fermer une suspension ?_
6. **Aucun modèle d'abonnement SaaS** — pas de plan, pas de facturation Chioni→centre, pas de quotas, pas d'état « tenant actif/suspendu/résilié » distinct du KYC.
7. **Aucun espace superadmin API** — zéro contrôle `is_staff`/`is_superuser` dans l'API ; tout l'outillage exploitant est l'admin Django, **sans cloisonnement tenant** (tout compte `is_staff` voit tous les centres).
8. **Admin Django inégalement durci** — ledger/reçus/intents/audit sont append-only, mais : `InvoiceAdmin` sans aucune protection (créer/modifier/supprimer une facture à la main), `PaymentRequestAdmin` et `DisputeAdmin` ajoutables, **données cliniques modifiables et supprimables** (`Encounter`, `Prescription`, `HealthRecordEntry`, `Consent`) sans trace.
9. **Aucune vue d'exploitation de la réconciliation PSP** — les `payment.webhook_refused` (pièces de réconciliation voulues par l'ADR 0009) ne sont lisibles que dans l'admin AuditLog.
10. **RGPD : ADR 0007 non implémenté** — aucun service d'anonymisation/effacement, aucun export de données (les tuteurs sont résidents UE : c'est un [M] de conformité).

---

## C. Permissions & vues — ce qui doit être réalisé

### C.1 Rôles avec des vues manquantes

| Constat                                  | Détail                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pharmacien sans poste de travail**     | Sa seule prérogative : lire les ordonnances consultation par consultation (en connaissant l'`encounter_pk`). Pas de liste des ordonnances du centre, pas de filtre patient, et `Prescription.Status.DELIVERED` n'est posé par **aucun** service : la délivrance n'existe pas.                                                                                                                                                                 |
| **Annuaire praticiens verrouillé**       | `GET /staff/` = directeur seul → la secrétaire ne peut pas résoudre un praticien pour un RDV ; le frontend se rabat sur `stats/activity` (praticiens ayant déjà consulté sur 12 mois) : un praticien nouvellement recruté est inassignable. Incohérence : `stats/activity` publie déjà id + nom + rôle à tout staff (demi-annuaire). → Un endpoint « praticiens actifs » lisible par tout staff est le manque n° 1 signalé depuis la vague 3. |
| **Directeur aveugle sur la traçabilité** | `AuditLog` n'a aucune API : le directeur ne peut pas consulter le journal d'audit de son propre centre.                                                                                                                                                                                                                                                                                                                                       |
| **Infirmier/sage-femme**                 | Couverts par les rôles cliniques (l'infirmier ne prescrit pas — correct), rien de bloquant.                                                                                                                                                                                                                                                                                                                                                   |
| **Laborantin/imagerie**                  | Aucun rôle, alors qu'`ActCategory` comporte `analyse`/`imagerie` — cohérent avec l'absence du module labo [2], à prévoir ensemble.                                                                                                                                                                                                                                                                                                            |

### C.2 Cycles de vie incomplets (états déclarés jamais atteints)

| Objet                           | Trou                                                                                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Encounter.Status`              | `terminee`/`annulee` jamais posés par aucun service — toute consultation reste « en cours » à vie.                                                                                                                                                                          |
| `Invoice.Status.CANCELLED`      | Testé défensivement en 4 endroits (dont la faille corrigée en revue 2a), mais **aucun code ne l'assigne** : l'annulation de facture n'existe pas hors admin/shell. La refacturation propre (annuler une facture erronée non encaissée → refacturer) est impossible par API. |
| `StaffMembership` désactivé     | Irréversible par API (le PATCH refuse l'inactif, la contrainte d'unicité empêche le doublon) : une désactivation par erreur = passage obligé par l'admin Django.                                                                                                            |
| `Prescription.Status.DELIVERED` | Cf. pharmacien ci-dessus.                                                                                                                                                                                                                                                   |

### C.3 Incohérences de segmentation à trancher

| Constat                                                     | Décision à prendre                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Segmentation « argent » à moitié appliquée**              | Impayés, journal de caisse, stats finances = BILLING seuls ; mais factures (avec libellés d'actes + montants), demandes de paiement et **litiges (motif en texte libre)** sont lisibles par tout staff, pharmacien compris. Soit on assume (petite équipe), soit on aligne tout sur BILLING. |
| **`confirm-care` peut bloquer la clôture**                  | Rôles habilités = directeur + soignants + pharmacien ; la clôture = BILLING. Un centre réduit à secrétaire+caissier actifs ne peut jamais passer `payee → soin_confirme` → aucun reçu diaspora émis.                                                                                         |
| **Secrétaire et grille tarifaire**                          | Elle facture mais ne peut pas écrire un tarif (réservé directeur/caissier). Voulu ?                                                                                                                                                                                                          |
| **Tout staff peut fusionner des patients et gérer les RDV** | Y compris le pharmacien. La fusion est une opération lourde (elle déplace des liens de tutelle) — la laisser à « tout staff » est un choix à confirmer.                                                                                                                                      |
| **Sémantique 400/404 divergente**                           | Patient hors périmètre : 400 explicite en scheduling, 404 en medical — deux réponses pour la même faute. À unifier (ADR 0008).                                                                                                                                                               |

### C.4 Espaces patient et tuteur — trous de parcours

| Casquette              | Trou                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patient                | Aucun endpoint `patients/me/appointments/` : il ne voit pas ses rendez-vous (alors qu'il reçoit des SMS de rappel), n'en prend pas, n'en annule pas.                                                                                                                                                        |
| Patient                | Carnet en lecture seule pour son propriétaire (voulu à confirmer : « le carnet appartient au patient », mais il ne peut rien y écrire).                                                                                                                                                                     |
| Patient non revendiqué | **Personne ne peut accorder `detail_clinique`** : le consentement clinique exige `IsPatientSelf`, et le centre n'a aucun endpoint d'enregistrement d'un consentement (papier ou oral). Le cas nominal porte A/porte C est sans solution.                                                                    |
| Tuteur                 | Le scope `detail_clinique` accordé **n'ouvre aucun endpoint** (aucune route tuteur dans medical) : consentement accordable et sans effet. À traiter avec la vigilance actée « le tuteur payeur ne voit PAS le dossier par défaut » — c'est le chantier le plus sensible de la liste (guardian obligatoire). |
| Tuteur                 | Liens en `attente_confirmation_titulaire` **invisibles** (ni protégés, ni invitations) : le protégé disparaît de l'espace tuteur sans explication pendant la porte de confirmation. Liens révoqués : aucun historique non plus.                                                                             |
| Tuteur                 | `GuardianProfile` non modifiable (pays de résidence/devise figés à la création).                                                                                                                                                                                                                            |
| Tuteur/patient         | Re-liaison après révocation impossible (limitation de schéma déjà actée — pour mémoire).                                                                                                                                                                                                                    |

### C.5 Mécanique des permissions (dette technique)

1. `IsGuardianWithScope(scope)` **ne vérifie jamais le scope** : la portée repose entièrement sur la discipline du queryset de chaque vue — aucun garde-fou mécanique.
2. `BILLING_ROLES` défini 3 fois (trustbridge, patients, frontend) sans source unique.
3. `StaffOfObjectCenter` a deux chemins de déclenchement (générique DRF vs appel manuel) pour la même règle.
4. Aucun throttle sur les endpoints métier/staff (seuls auth et invitation tuteur) — inclut les uploads (CPU Pillow, vigilance vague 1).
5. `/api/schema/` et `/api/docs/` publics dans **tous** les environnements (AllowAny) — à conditionner à DEBUG au déploiement.

### C.6 Confort d'API attendu par le frontend (trous déjà listés en vague 3)

- Aucun filtre sur les listes `encounters`, `invoices`, `payment-requests`, `disputes` (ni `?patient=`, ni `?date=`, ni `?status=`).
- Pas d'endpoint plage RDV `?from=&to=` (la grille calendrier se limite à la semaine sélectionnée).
- `received_by`/`reversed_by` en ids bruts sans résolution de nom ; item `reversal` du journal sans id de facture.
- `StaffUser` n'expose pas l'état d'activation du compte (griser l'identité proactivement).
- Le frontend ne gère qu'**un rôle actif par centre** alors que le backend autorise le cumul (un directeur+médecin ne voit l'UI que d'une casquette).

---

## D. Fonctionnalités de l'étude non couvertes (hors permissions)

1. **Documents du carnet en pièces jointes [M]** — le socle upload durci (ADR 0014) existe, il manque le modèle Document + consentements + vues (sensible : guardian obligatoire).
2. **Relances automatiques (impayés, RDV manqués) [2]** — la matière existe (liste d'impayés, statut `manque`, infra SMS ADR 0012) ; c'est la suite « CRM santé » déjà amorcée par les rappels J-1.
3. **Export comptable [2]** — le ledger et le journal existent ; il manque l'export figé (interaction avec la vigilance « photo avec recul » des séries de recettes, actée ADR 0015).
4. **Hospitalisations/lits, stocks/pharmacie interne, examens/labo [2]** — modules entiers, à cadrer chacun.
5. **i18n shikomori [2]** — les points d'extraction sont prêts (`labels.ts`, templates SMS) ; le mécanisme reste à monter.
6. **PWA/offline + mode dégradé caisse** — exigence non fonctionnelle de l'étude (« la caisse ne doit jamais être bloquée par une panne réseau ») , rien n'existe.
7. **Stripe réel (`psp/stripe.py`) + SMS agrégateur comorien** — chantiers à clés, exigences déjà actées (ADR 0009 addendum, ADR 0012).
8. **Étude paiement partenaire local** (risque n° 1) et **étude IA de reprise du papier** (§5.5) — études dédiées.

---

## E. Lecture d'ensemble proposée

Trois familles se dégagent, d'ampleur très différente :

- **E1 — Le tenant comme objet de plein droit** (section B) : onboarding API des centres, KYC avec effets réels (dont SUSPENDED), amorçage du premier directeur, abonnement SaaS, superadmin API cloisonné, durcissement admin, audit lisible par le directeur, RGPD (ADR 0007). C'est le chantier « multi-tenant SaaS » proprement dit — quasi tout est à construire, et presque tout est sensible (guardian systématique).
- **E2 — Compléter les casquettes existantes** (C.1 à C.4) : poste pharmacien + délivrance, annuaire praticiens, cycles de vie (consultation terminée, annulation de facture, réactivation staff), cohérences de segmentation à trancher, RDV côté patient, consentement clinique des non-revendiqués. Beaucoup de gains rapides pour les centres (« les gâter ») et des décisions produit courtes.
- **E3 — Dette mécanique + confort frontend** (C.5, C.6) : scope réellement vérifié, sources uniques, throttles, filtres de listes, endpoint plage RDV. Petit, non spectaculaire, mais conditionne la sûreté des évolutions suivantes.

Les priorités entre E1/E2/E3 — et le niveau d'ambition de chaque brique (ex. : l'abonnement SaaS va-t-il jusqu'au paiement en ligne du centre ?) — sont arbitrées avec le product owner : voir sections F et G.

---

## F. Remarques du product owner (13/08/2026) — assimilées à l'audit

### F.1 « Mon profil » (frontend)

La modification du profil s'ouvre aujourd'hui en modale bloquante. **Acté** : reprendre le module « My Profile » de Vireo pour la **visualisation** du profil utilisateur et le module « Profile Settings » pour la **modification** — conforme à la politique assets Vireo (adapter, jamais coder en dur).

### F.2 Dossier patient enrichi (santé d'abord)

L'identité patient actuelle est minimale (naissance, sexe, téléphone, ville). On est dans la santé : il faut davantage.

1. **Identité élargie** : groupe sanguin + rhésus, taille, poids, coordonnées complètes (adresse, téléphones), personne à prévenir en cas d'urgence, numéro d'identité / identifiant médical. + Peaufinage du processus de création/validation patient (porte C).
2. **Signes vitaux** : pression artérielle, fréquence cardiaque, SpO₂, température, fréquence respiratoire… — en **distinguant deux contextes** : le patient en visite (prise ponctuelle au triage/consultation) et le patient hospitalisé (relevés répétés — dépend du module Hospitalisation, F.3).
3. **Fiche médicale complète** : antécédents médicaux (maladies passées et chroniques — diabète, hypertension), chirurgies et hospitalisations antérieures, allergies (médicaments, aliments, latex), antécédents familiaux, traitements actuels et posologie, vaccinations, résultats d'examens (biologie, imagerie — rejoint « Documents en pièces jointes » [M]), observations et notes d'évolution, diagnostics et plans de traitement, assurance maladie/mutuelle, directives anticipées.
   > Note d'assimilation : `HealthRecordEntry` couvre déjà antécédents/allergies/traitements/vaccinations en texte libre — ce chantier le structure et l'étend. Les nouvelles données sont presque toutes cliniques : segmentation par rôle existante à étendre, et **jamais** d'exposition tuteur hors `detail_clinique`. Directives anticipées et antécédents familiaux = sensibilité maximale (guardian obligatoire, consentement à cadrer).

### F.3 Hospitalisation (module entier, non évoqué jusqu'ici mais nécessaire)

**Bed management** : étages, chambres, lits, admission/sortie, médecins assignés, niveau de priorité. Rejoint le [2] « Hospitalisations, lits » de l'étude et porte le contexte « patient hospitalisé » des signes vitaux (F.2.2).

### F.4 Équipements

Inventaire des équipements médicaux du centre (nouveau module d'exploitation, cloisonné tenant).

### F.5 Support (SaaS)

Module de support client : les centres (et à terme patients/tuteurs) ouvrent des tickets vers l'exploitant Chioni. S'appuie sur le back-office plateforme (section B) — il en est même une brique.

### F.6 HRM — faire évoluer le contexte RH des centres

Personnel (existant) → **Services, Fonctions, Présence, Congés, Jours fériés, Paie**. Extension majeure du « SaaS socle si bon qu'un centre le garderait même sans le Pont de Confiance ». La **paie** est le sous-module le plus lourd (barèmes locaux, confidentialité des salaires : visibilité directeur seul, et interaction avec la caisse/ledger à trancher — la paie sort-elle du ledger de soins ? recommandation : ledger séparé ou comptes dédiés, jamais mélangée aux créances patients).

### F.7 Pharmacie — pivot de périmètre (décision produit)

Constat PO : aux Comores, rares sont les centres avec pharmacie dédiée — le rôle staff `pharmacien` est mal ajusté au terrain.
**Nouveau périmètre acté à cadrer** : la pharmacie devient un **acteur à part entière, HORS tenant centre** :

- Les pharmacies **s'enregistrent dans Chioni** (annuaire, validation par le back-office plateforme — dépend de la section B) et disposent d'un **module de gestion limité, axé disponibilité des médicaments**.
- Les médecins/centres (et à terme le patient) peuvent lancer une **recherche/demande de disponibilité** des médicaments d'une ordonnance auprès des pharmacies enregistrées — fini de circuler jusqu'à pas d'heure pour trouver « la » pharmacie qui a les médicaments.
  > Notes d'assimilation (à instruire au cadrage, guardian obligatoire) :
  >
  > - **Minimisation absolue** : la demande de disponibilité ne doit porter QUE la liste des médicaments — jamais l'identité du patient, jamais l'ordonnance complète (le contenu d'une ordonnance est du `detail_clinique`). Une pharmacie répond « dispo / pas dispo (/ prix ?) » sans savoir pour qui.
  > - Le rôle staff `pharmacien` **reste** pour les centres qui ont une pharmacie interne (son poste de travail — C.1 — reste à construire pour eux) ; le réseau hors-périmètre devient le chemin principal.
  > - Nouvel espace utilisateur (4ᵉ espace frontend) + onboarding/validation pharmacie côté plateforme.
  > - Prolongements naturels : stock pharmacie (module dédié), délivrance tracée, notification du patient quand un médicament est disponible.

---

## G. Les sprints restants jusqu'à la complétion du SaaS Chioni

Consolidation audit (A–E) + remarques PO (F). Ordre proposé selon les dépendances techniques et l'habitude du projet (backend d'abord, guardian sur tout ce qui est sensible, frontend ensuite, UX care sur les parcours). À re-prioriser librement.

| Sprint                                   | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Sources            | Sensibilité                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------- |
| **S1 — Assainissement**                  | Dette mécanique (scope tuteur réellement vérifié, `BILLING_ROLES` source unique, sémantique 400/404 unifiée, throttles métier + uploads, Swagger conditionné à DEBUG) ; cycles de vie manquants (annulation de facture par API, consultation `terminee`, réactivation staff) ; annuaire « praticiens actifs » tout staff ; filtres de listes + endpoint plage RDV ; correctifs `confirm-care`/segmentation argent selon arbitrages C.3 ; contrainte DB intégralité tarif + idempotence guichet (vigilances 2a) | C.2, C.3, C.5, C.6 | guardian ciblé                        |
| **S2 — Casquettes & parcours complétés** | RDV côté patient (`patients/me/appointments/`) ; consentement clinique des non-revendiqués (enregistrement porte C par le centre, tracé) ; visibilité tuteur des liens en attente/révoqués ; PATCH GuardianProfile ; **frontend « Mon profil » Vireo (F.1)** ; multi-rôles dans l'UI centre                                                                                                                                                                                                                    | C.4, C.6, F.1      | guardian (consentements) + UX care    |
| **S3 — Dossier patient enrichi**         | Identité élargie + processus de création/validation porte C ; fiche médicale structurée ; signes vitaux en visite ; **Documents en pièces jointes [M]** (socle upload ADR 0014 réutilisé) ; assurance/mutuelle ; directives anticipées (option, cadrage dédié)                                                                                                                                                                                                                                                 | F.2, D.1           | guardian obligatoire + UX care        |
| **S4 — Le tenant de plein droit**        | Onboarding API des centres (création, premier directeur), KYC avec pièces et effets réels (dont `SUSPENDED` effectif — décision : que ferme une suspension ?), superadmin API cloisonné, durcissement admin (Invoice/clinique append-only), AuditLog lisible par le directeur, vue de réconciliation PSP, **RGPD ADR 0007 implémenté**                                                                                                                                                                         | B                  | guardian obligatoire                  |
| **S5 — Abonnement & Support**            | Modèle d'abonnement SaaS (plans, quotas, état du tenant, facturation Chioni→centre — ambition à trancher : paiement en ligne du centre ?) ; **module Support (F.5)** (tickets centre→Chioni)                                                                                                                                                                                                                                                                                                                   | B, F.5             | guardian (argent)                     |
| **S6 — Hospitalisation**                 | Bed management (étages, chambres, lits, admissions, médecins assignés, priorités) ; signes vitaux du patient hospitalisé (relevés répétés) ; base des [2] stocks/labo ultérieurs                                                                                                                                                                                                                                                                                                                               | F.3, F.2.2, D.4    | guardian + UX care                    |
| **S7 — HRM**                             | Services, fonctions, présence, congés, jours fériés ; **paie en cadrage séparé** (confidentialité, rapport au ledger)                                                                                                                                                                                                                                                                                                                                                                                          | F.6                | guardian (paie)                       |
| **S8 — Équipements**                     | Inventaire des équipements médicaux (petit module, peut se coller à S6 ou S7)                                                                                                                                                                                                                                                                                                                                                                                                                                  | F.4                | faible                                |
| **S9 — Pharmacie hors-périmètre**        | Cadrage dédié (type étude) PUIS : enregistrement/validation des pharmacies (s'appuie sur S4), espace pharmacie (4ᵉ espace), demande de disponibilité **anonymisée par conception**, module disponibilité ; poste pharmacien interne (C.1) pour les centres qui en ont un                                                                                                                                                                                                                                       | F.7, C.1           | guardian obligatoire (secret médical) |
| **S10 — CRM santé & comptabilité**       | Relances automatiques (impayés, RDV manqués — infra SMS prête), export comptable figé (vigilance ADR 0015 à retraiter)                                                                                                                                                                                                                                                                                                                                                                                         | D.2, D.3           | guardian (SMS, argent)                |
| **Chantiers à clés (parallèles)**        | Stripe réel (`psp/stripe.py`), SMS agrégateur comorien (+ retry borné, dead-letter, art. 14), i18n shikomori, PWA/offline + mode dégradé caisse, étude paiement partenaire local, étude IA reprise du papier                                                                                                                                                                                                                                                                                                   | D.5–D.8            | selon chantier                        |

Règles transverses maintenues sur tous les sprints : cadrage avant code sur les modules neufs (S3, S4, S5, S6, S7, S9 = ADR dédiés), revue `chioni-health-data-guardian` sur tout ce qui touche argent/médical/consentements, `chioni-ux-care` sur tout parcours utilisateur, assets Vireo adaptés jamais codés en dur, aucune PII dans les payloads d'audit, le contenu d'un SMS suit la visibilité dans l'app.
