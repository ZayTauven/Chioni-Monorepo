# ADR 0017 — Le tenant de plein droit : plateforme, KYC, audit lisible, RGPD (sprint S4)

- **Statut** : acté (cadrage S4 — les 3 arbitrages structurants sont TRANCHÉS PAR LE PO le 2026-08-14)
- **Date** : 2026-08-14
- **Sources** : audit §B (10 constats) + §G/S4 + §SV.2, étude des besoins §5.4, ADR 0006 (triggers),
  0007 (RGPD), 0008 (permissions), 0009 (PSP), 0014 (uploads), 0015 (caisse)

## Contexte

Chioni vend un SaaS à des centres de santé, mais le tenant n'existe pas comme objet de plein
droit : aucun centre ne peut naître par API, aucun premier directeur ne peut être amorcé,
`kyc_status` ne se change qu'à la main dans l'admin Django, `SUSPENDED` est déclaré et jamais
lu, il n'y a aucun compte exploitant côté API, l'admin Django voit tous les tenants sans
cloisonnement, le directeur ne peut pas lire le journal d'audit de son propre centre, les
refus de webhook PSP (matière de réconciliation voulue par l'ADR 0009) ne sont lisibles que
par un superuser, et l'ADR 0007 (RGPD) n'a aucune implémentation. C'est le [M] de l'étude le
moins couvert.

## Arbitrages du PO (14/08/2026)

1. **Suspendre un centre ferme le rail diaspora, et lui seul.** Le soin (consultations, RDV,
   carnet, documents) et la caisse locale continuent : suspendre ne doit jamais empêcher de
   soigner un patient présent, ni renvoyer un centre au papier. Ce qui se ferme, c'est le Pont
   de Confiance — là où Chioni engage sa parole envers un tuteur à l'étranger. La sanction
   commerciale (couper l'accès) relèvera de l'abonnement (S5).
2. **Back-office = API cloisonnée + 4ᵉ espace frontend sobre.** Le module Support riche et le
   dashboard exploitant viennent en S5, sur ces fondations.
3. **RGPD = demande depuis l'espace + traitement par l'exploitant.** Pas d'auto-suppression
   immédiate : un compte finançant des soins ne doit pas disparaître en un clic, ni sous la
   pression d'un tiers ayant accès au téléphone.

## Décision 1 — La 4ᵉ casquette : `PlatformStaff` (et ce qu'elle ne voit JAMAIS)

L'ADR 0008 pose « une vue = une casquette ». L'exploitant devient la quatrième, à côté de
staff-de-centre, patient et tuteur.

- **Modèle dédié `accounts.PlatformStaff`** : OneToOne `User`, `role` ∈ `support` | `admin`,
  `is_active`. **Ni `is_staff` ni `is_superuser` ne sont réutilisés comme droit d'API** : ces
  flags Django gouvernent l'admin, pas le produit ; les coupler rendrait tout compte d'admin
  automatiquement exploitant. Un `PlatformStaff` ordinaire n'a par défaut aucun accès admin.
- **Permission `IsPlatformStaff(*roles)`** (`apps/common/permissions.py`), avec **garde-fou
  structurel testé** : toute route sous `/api/v1/platform/` doit la déclarer — même patron
  que le test existant sur les routes `/guardian/`.
- **Invariant éthique du sprint, testé, non négociable** : **l'exploitant ne voit AUCUNE donnée
  clinique et aucune PII de patient.** Ni carnet, ni consultation, ni document, ni signes
  vitaux, ni fiche médicale, ni nom/téléphone de patient. Son périmètre est le **tenant** :
  centres, KYC, personnel (identités staff), abonnement (S5), argent au niveau agrégé et
  réconciliation technique, journal d'audit (références). Chioni supervise des centres, pas
  des malades. Aucune vue plateforme ne monte un serializer patient ; test de champs négatif
  en régression.
- Exposition : `/auth/me/` gagne `platform_staff` (rôle + actif) — c'est le routeur des
  espaces qui débloque le 4ᵉ espace côté frontend. `spacesOf()` s'étend, `CenterContext`
  n'est jamais monté pour cet espace.
- Les rôles `support` / `admin` : `support` lit (centres, audit, réconciliation) ;
  `admin` seul écrit (créer un centre, changer un KYC, exécuter un effacement RGPD).

## Décision 2 — Onboarding du tenant par la plateforme

`POST /platform/centers/` (rôle `admin`) crée le centre **et son premier directeur** dans une
seule transaction : identité du centre + téléphone du directeur. Le directeur naît en **compte
ombre** (`get_or_create_shadow_user`, chemin existant) et prend possession de son compte par
OTP — jamais de mot de passe transmis hors bande. Le centre naît en `kyc_status=en_attente`.

- **L'inscription en self-service d'un centre est hors périmètre S4** : elle suppose un plan,
  une facturation et une lutte anti-abus — c'est S5 (abonnement). En S4, un centre entre par
  l'exploitant, ce qui est le fonctionnement réel (démarchage, contrat signé).
- Audit obligatoire : `center.created` (refs) + `staff.membership_created` (chemin existant).
- Unicité : aucune contrainte d'unicité sur `name` n'est ajoutée (deux « Clinique El-Maarouf »
  peuvent coexister sur deux îles) ; la **détection de similitude** est retournée à l'appelant
  comme au guichet patient (porte C, S3) — informer, jamais bloquer.
- `POST /platform/centers/{pk}/directors/` (rôle `admin`) : amorcer un directeur sur un centre
  qui n'en a plus (accident, départ) — le seul chemin de secours hors admin Django.

## Décision 3 — KYC : pièces, transitions, effets réels

**Modèle `centers.KycDocument`** : `center`, `doc_type` (`registre_commerce`, `licence_sante`,
`piece_identite_directeur`, `autre`), `file`, `uploaded_by`, `uploaded_at`, archivage sans
suppression. Stockage **privé obligatoire** (`PrivateMediaStorage`, ADR 0016 §5) : une pièce
d'identité de directeur n'est jamais servie statiquement ; téléchargement par endpoint
authentifié (plateforme, et directeur du centre pour ses propres pièces).

- **Socle ADR 0014 réutilisé tel quel : photos JPEG/PNG/WebP seules.** Le PDF reste différé
  (cohérence avec l'ADR 0016) : un centre photographie son registre. **Arbitrage RÉVERSIBLE
  signalé au PO** — si le terrain impose le PDF, ce sera un chantier transverse unique
  (documents patients + pièces KYC) par addendum ADR 0014, jamais une exception locale.
- Upload par le **directeur du centre** (c'est lui qui fournit) et lecture par la plateforme.
  Throttle `uploads`.
- **Transitions par la plateforme uniquement** : `POST /platform/centers/{pk}/kyc/`
  (`{status, reason}`, rôle `admin`), machine à états explicite
  `en_attente → actif | suspendu`, `actif → suspendu`, `suspendu → actif`. `reason`
  **obligatoire** pour toute suspension, stockée (`kyc_reason`, `kyc_updated_at`,
  `kyc_updated_by`) et **jamais exposée au patient ni au tuteur**. Audit
  `center.kyc_changed` (refs + code de statut, jamais le motif en clair).
- `update_center` continue de refuser `kyc_status` (double verrou existant conservé) ;
  `HealthCenterAdmin.kyc_status` devient **read-only** : l'API plateforme est désormais la
  porte unique, et l'admin cesse d'être un chemin parallèle non audité.
- **Effets réels (arbitrage PO n° 1)** — un centre `suspendu` :
  - ✅ continue : consultations, carnet, documents, RDV, patients, personnel, tarifs,
    **facturation et encaissement au guichet** (espèces/mobile money), reçus « G- » ;
  - ❌ s'arrête : **création de demande de paiement diaspora**, partage d'une demande à un
    tuteur, envoi de la demande, création d'intent PSP — c'est-à-dire tout **NOUVEAU**
    paiement ;
  - ✅ **le paiement en vol atterrit** (arbitrage PO du 14/08/2026, tranché après une
    divergence d'interprétation en LOT 1) : le webhook d'encaissement n'est **pas** gardé par
    le KYC. Un intent n'existe que parce que le centre était `actif` à son ouverture (la garde
    vit en amont) : y arriver signifie que la carte du tuteur est déjà débitée. Refuser
    laisserait un débit réel sans reçu — l'opacité même que le Pont de Confiance combat — et
    le MVP n'a pas de chemin de remboursement. **Encaisser n'est pas verser** : l'écriture au
    ledger et le reçu sont ce qui est dû au tuteur ; retenir les fonds d'un centre suspendu
    est le travail du reversement (processus séparé, non construit), pas celui du ledger ;
  - la garde existante `_require_center_can_collect` est **étendue en amont de la chaîne**
    (aujourd'hui elle n'agit qu'à l'intent et à l'encaissement) et **distingue enfin
    `suspendu` de `en_attente`** dans le message rendu au staff — deux situations différentes
    méritent deux explications différentes.

## Décision 4 — Durcissement de l'admin Django

- `AppendOnlyAdminMixin` remonte de `trustbridge/admin.py` vers **`apps/common/admin.py`**
  (`ReadOnlyAdminMixin` + `AppendOnlyAdminMixin`), et couvre aussi `has_add_permission`.
- Passent en **lecture seule stricte** : tout `medical` (`Encounter`, `Prescription`,
  `HealthRecordEntry`, `Consent`, `PatientMedicalFile`, `VitalSigns`, `PatientDocument`),
  tout `patients` (`PatientProfile`, `GuardianProfile`, `GuardianLink`, `PatientInsurance`),
  `Invoice`, `PaymentRequest`, `Dispute`. **`ConsentAdmin` et les admins S3 sont soldés ici**
  (dette SV.2). Motif : ces objets ont des invariants de service (portes de confirmation du
  titulaire, machines à états, ledger) qu'un formulaire d'admin contourne en silence.
- `HealthCenterAdmin` : `kyc_status` read-only (cf. Décision 3).
- `StaffMembershipAdmin` : conservé en écriture pour l'amorçage de secours **mais** l'API
  plateforme devient le chemin normal — l'admin cesse d'être la seule porte.
- **Tests d'admin, aujourd'hui inexistants** : un fichier dédié verrouille les permissions de
  chaque ModelAdmin sensible (`has_add/change/delete`), sinon le durcissement se perd à la
  première nouvelle app.
- Le cloisonnement tenant de l'admin n'est **pas** tenté (un admin Django est par nature
  transverse) : la parade est que plus rien de sensible n'y soit modifiable, et que les comptes
  `is_staff` restent rares — consigné.

## Décision 5 — Journal d'audit lisible par le directeur

- **`AuditLog` gagne `center` (FK nullable, indexé avec `created_at`)**, posé explicitement par
  le helper `audit(center=…)`. Il n'existait aucun moyen de requêter « le journal de mon
  centre » : `payload__center_id` est présent sur une partie seulement des actions, en JSONB
  non indexé.
- **Aucun rétro-remplissage** : les lignes sont append-only (ORM + trigger PostgreSQL,
  ADR 0006) et le resteront — réécrire l'historique pour le confort d'une API serait
  exactement ce que l'ADR 0006 interdit. L'API le dit honnêtement au directeur (« le journal
  commence le … »).
- `GET /centers/{c}/audit-log/` (**directeur seul**, filtres `?action=&from=&to=`, pagination).
- **Liste blanche d'actions** : le directeur voit l'**exploitation** (personnel, centre, KYC,
  tarifs, factures, caisse, paiements, litiges, fusions). Il **ne voit pas** les actions
  cliniques ni les consentements (`encounter.*`, `prescription.*`, `health_record_entry.*`,
  `vital_signs.*`, `patient_document.*`, `patient_medical_file.*`, `consent.*`) : un directeur
  non soignant n'a pas à savoir quel patient a reçu quel soin, fût-ce par métadonnées. La
  segmentation clinique de S3 serait vidée de son sens par une fuite via le journal.
- Le payload reste références-only (ADR 0007) : l'API rend des ids, jamais des noms.

## Décision 6 — Réconciliation PSP (plateforme)

`GET /platform/reconciliation/` (rôles `support`/`admin`) : les incidents de paiement
lisibles au même endroit — `payment.webhook_refused` (4 cas de refus déjà tracés),
`payment_intent.cancelled` (purge zombie), `payment_intent.failed`, avec leurs références
(intent, demande, facture, montants, motif technique). Filtres `?from=&to=&reason=`.
C'est une **vue d'exploitation technique** : elle porte des ids et des montants, jamais un nom
de patient. Le miroir côté centre (« votre paiement diaspora a été refusé ») n'est pas fait en
S4 — consigné en vigilance, car c'est une information légitime pour le centre et le tuteur.

## Décision 7 — RGPD (ADR 0007 implémenté)

- **`accounts.ErasureRequest`** : `user`, `requested_at`, `status`
  (`en_attente` | `traitee` | `refusee`), `processed_by`, `processed_at`, `refusal_reason`.
  Demande déposée depuis l'espace (`POST /auth/me/erasure-request/`, état visible en `GET`),
  exécutée par la plateforme (`GET /platform/erasure-requests/`,
  `POST /platform/erasure-requests/{pk}/process/`). Une seule demande ouverte par utilisateur.
- **`anonymize_user(user)`** (service, transactionnel) : `username` neutre déterministe
  (`anon-{pk}`), `first_name`/`last_name`/`email` vidés, `phone` mis à `NULL` (le champ est
  unique et nullable — le pivot disparaît), `avatar` effacé du stockage, `is_active=False`,
  `anonymized_at` posé ; les `PatientProfile`/`GuardianProfile` rattachés sont anonymisés de
  la même façon (identité, adresse, contacts d'urgence, assurances) ; les liens de tutelle
  actifs sont **révoqués** (cascade existante = consentements révoqués) ; les codes OTP sont
  purgés. **Jamais de `DELETE`** : les FK `PROTECT` et les immuabilités (ledger, audit, reçus)
  sont préservées telles quelles.
- **Ce qui n'est pas effacé, et pourquoi** : le carnet médical (ADR 0007 — il appartient au
  patient et relève du droit local de conservation ; il devient orphelin d'identité), le
  ledger (aucune PII), l'audit (références only — l'anonymisation du compte anonymise
  mécaniquement l'historique).
- **Gardes de refus** (l'exploitant tranche, l'API l'aide) : un utilisateur **dernier directeur
  actif d'un centre** ne peut pas être anonymisé (garde partagée avec la rétrogradation) ; un
  tuteur avec un intent PSP en cours non plus (le paiement doit atterrir). Refus explicite et
  motivé, jamais silencieux.
- **Export de ses données** (portabilité art. 20) : `GET /auth/me/export/` — JSON de ce que
  l'utilisateur voit déjà dans son espace (identité, profils, liens, rendez-vous, carnet pour
  un patient, paiements et reçus pour un tuteur). Aucune donnée nouvelle n'est révélée par
  l'export : il rejoue les mêmes règles de visibilité que les écrans. Throttlé.
- Audit : `erasure.requested`, `erasure.processed`, `erasure.refused`, `user.anonymized`
  (références only).

## Invariants transverses (obligations d'implémentation)

1. **L'exploitant ne voit jamais le clinique ni la PII patient** (Décision 1) — test de
   régression sur toutes les routes `/platform/`.
2. **Garde-fou structurel** : toute route `/platform/` déclare `IsPlatformStaff` (test qui
   parcourt l'URLconf, patron `/guardian/`).
3. **Le KYC ne se change que par l'API plateforme** (admin read-only) et écrit toujours un
   audit avec son motif hors payload.
4. **Suspension = rail diaspora seul** (arbitrage PO n° 1), vérifié des deux côtés :
   ce qui doit continuer continue (caisse testée), ce qui doit s'arrêter s'arrête.
5. **Pas de rétro-écriture de l'audit** (Décision 5) ni de suppression physique (Décision 7).
6. Écriture par services + audit ; invariants dans `save()`/`clean()` ; hiérarchie de verrous
   de S1 respectée par toute nouvelle écriture d'argent.
7. Seed démo étendu (un `PlatformStaff` de démo, une pièce KYC, une demande d'effacement) et
   contrat frontend à jour.

## Hors périmètre S4 (consigné)

Abonnement/plans/quotas et module Support (S5) ; self-service d'inscription d'un centre (S5) ;
miroir centre de la réconciliation ; triggers PostgreSQL sur les tables S3 (SV.2) ; PDF des
pièces KYC (arbitrage réversible ci-dessus) ; notation des centres.

## Addendum d'implémentation — LOT 1 (décisions 1, 2 et 3 livrées le 2026-08-14)

Choix arrêtés à l'implémentation du premier lot, dans l'esprit des décisions ci-dessus.
Aucun n'est un écart de périmètre ; les deux points marqués **[EXTENSION]** vont au-delà de
la lettre de l'ADR et sont signalés comme tels.

1. **Où vit le back-office.** `PlatformStaff` est dans `apps.accounts` (comme l'ADR le
   nomme) ; les vues, serializers et routes plateforme du lot 1 vivent dans
   `apps.centers` (`platform_views.py`, `platform_serializers.py`, `platform_urls.py`) —
   pas de nouvelle app : l'objet gouverné EST le centre. Les lots 2 et 3 monteront leurs
   propres modules sous le MÊME préfixe (`path("platform/", include(…))` accepte plusieurs
   includes) ; le garde-fou structurel les couvrira automatiquement.
2. **`platform_staff(user)` ne rend qu'une ligne ACTIVE**, exactement comme
   `claimed_patient_profile` : `/auth/me/` et la permission partagent une seule vérité, et
   un exploitant désactivé est byte-identique à quelqu'un qui ne l'a jamais été (aucun
   oracle). Conséquence : `is_active` dans le payload vaut toujours `true` — il est là pour
   la lisibilité du contrat, la porte frontend reste `platform_staff !== null`.
3. **Le garde-fou structurel lit `permission_classes`** (attribut de classe). Une vue qui
   n'aurait surchargé que `get_permissions()` hériterait en silence du défaut DRF
   (`IsAuthenticated` = tout patient du pays) : le test le refuse par identité avec
   `api_settings.DEFAULT_PERMISSION_CLASSES`. Les vues à double régime déclarent donc la
   porte d'espace en attribut et la porte d'écriture dans `get_permissions()`.
4. **Pas de machine à états KYC dans `save()`.** Elle vit dans
   `centers.services.set_center_kyc_status` (verrou de ligne `select_for_update` — deux
   exploitants qui cliquent en même temps sérialisent). Motif : `kyc_status` est un champ
   posé à la création (seed, fixtures) et manipulé directement par des tests historiques ;
   un `save()` bloquant aurait cassé ces chemins légitimes sans rien fermer que l'admin
   read-only et la porte de service unique ne ferment déjà. **Vigilance consignée** : le
   modèle reste mutable par shell — à durcir par trigger PostgreSQL si le besoin apparaît
   (même famille que la dette SV.2 sur les tables S3).
5. **`kyc_reason` = motif de la DERNIÈRE décision** (écrasé à chaque transition), visible de
   la plateforme et du **directeur du centre concerné seulement** — `SerializerMethodField`
   gaté par rôle, patron du `cancel_reason` de S1 : `null` pour tout autre membre du centre,
   et absent par construction de toute vue patient/tuteur. **Vigilance** : l'historique des
   motifs successifs n'est pas conservé (l'audit garde la chronologie des statuts, jamais le
   texte) — à rouvrir si le support en a besoin.
6. **Détection de similitude = endpoint séparé** (`GET /platform/centers/similar/`), miroir
   exact de la porte C patient (S3) plutôt qu'un champ dans la réponse de création :
   informer AVANT, jamais bloquer APRÈS.
7. **`POST /platform/centers/{pk}/directors/` n'est pas conditionné à « zéro directeur ».**
   L'ADR le motive par le cas de secours, mais ajouter un co-directeur à la demande du
   tenant est légitime ; `add_staff_member` refuse déjà le doublon de rôle.
8. **[EXTENSION] `send_payment_request` est gardé lui aussi.** L'ADR nomme la création et le
   partage ; envoyer, c'est faire partir le SMS « payez » vers la diaspora. Un centre
   suspendu entre le partage et l'envoi convoquerait un tuteur devant un bouton « Payer »
   qui refuse. Garde posée sous le même verrou de facture que le reste de la chaîne.
9. **[EXTENSION / précision] « Les intents déjà en cours vont à leur terme »** est implémenté
   comme : **la queue d'une demande DÉJÀ payée n'est jamais bloquée** (`confirm_care`,
   `close_payment_request` + reçu, accusé patient, ouverture de litige fonctionnent sur un
   centre suspendu). Le webhook d'encaissement, lui, **reste refusé** sur un centre suspendu
   — comportement historique conservé et verrouillé en régression (`payment.webhook_refused`
   sert de matière de réconciliation, lot 2). Autrement dit : « un tuteur qui a déjà payé
   reçoit son reçu », pas « un débit en vol est encaissé malgré la suspension ».
10. **Deux messages distincts** (`KYC_PENDING_MESSAGE` / `KYC_SUSPENDED_MESSAGE`, constantes
    exportées de `trustbridge.services`), tous deux porteurs du mot « KYC » (compatibilité
    des régressions) et tous deux terminés par « La caisse du centre reste ouverte… » : le
    refus explique ce qui continue, il ne laisse jamais croire à une panne générale.
11. **Pièces KYC** : `centers.KycDocument`, `PrivateMediaStorage` + pipeline ADR 0014 tel
    quel (PDF et SVG refusés), throttle `uploads` sur le POST seul, archivage définitif
    (garde dans `save()`), téléchargement par endpoint authentifié à nom neutre
    `kyc-<id>.<ext>` + `nosniff`. Dépôt et archivage réservés au **directeur** du centre
    (ni la secrétaire ni le caissier : une pièce d'identité de directeur n'est pas une
    donnée d'exploitation) ; lecture plateforme `support` + `admin`.
12. **Audit** : `center.created`, `center.kyc_changed` (`old_status`/`kyc_status`/
    `has_reason` — jamais le motif), `kyc_document.uploaded`/`.archived` (ids + code de
    type — jamais un nom de fichier).
13. **Admin Django** (le strict nécessaire du lot 1, le reste est le lot 2) :
    `HealthCenterAdmin` passe `kyc_status`/`kyc_reason`/`kyc_updated_at`/`kyc_updated_by` en
    `readonly_fields` ; `KycDocumentAdmin` déclaré avec `exclude=("file",)` ;
    `PlatformStaffAdmin` reste **en écriture À DESSEIN** — c'est l'amorçage du back-office
    lui-même (le tout premier exploitant ne peut naître que là) et le seul levier de
    révocation d'urgence.
14. **Tests** : 72 tests neufs — `tests/test_permissions_platform.py` (casquette + garde-fou
    structurel + champs négatifs), `tests/test_platform_api.py` (onboarding, KYC, pièces),
    `tests/test_kyc_suspension_effects.py` (ce qui s'arrête / ce qui continue). Total suite :
    1205 verts.

## Addendum d'implémentation — LOT 2 (décisions 4, 5 et 6 livrées le 2026-08-14)

Choix arrêtés à l'implémentation du deuxième lot. Aucun n'est un écart de périmètre ; les
points marqués **[ARBITRAGE]** vont au-delà de la lettre de l'ADR ou tranchent un point
qu'elle laissait ouvert, et sont tous RÉVERSIBLES.

### Décision 4 — admin Django

1. **Deux mixins, un seul comportement, deux intentions** (`apps/common/admin.py`) :
   `ReadOnlyAdminMixin` (le modèle est mutable **par service** — invariants + audit) et
   `AppendOnlyAdminMixin(ReadOnlyAdminMixin)` (la table est immuable par construction —
   ORM + trigger ADR 0006). Les trois refus sont identiques ; le nom déclaré documente
   *pourquoi* la porte est fermée. Signature unique `(self, request, obj=None)` : elle couvre
   à la fois `ModelAdmin` et `InlineModelAdmin`, donc le même mixin durcit une table **et
   ses inlines** (`InvoiceLineInline`, `PaymentRequestShareInline`, `ActPerformedInline`,
   `PrescriptionItemInline`, `LedgerEntryInline` sont passés read-only eux aussi : un inline
   éditable sur un parent verrouillé serait une porte latérale).
2. **`AppendOnlyAdminMixin` couvre enfin `has_add_permission`.** L'ancienne version locale de
   `trustbridge/admin.py` ne couvrait que change/delete : chaque classe re-déclarait l'add à
   la main — exactement le genre de discipline par classe qui pourrit. Comportement des
   admins trustbridge existants inchangé (verrouillé par un test d'identité de mixin).
3. **Lecture seule stricte** : tout `medical` (dont **`ConsentAdmin` — dette SV.2 soldée**),
   tout `patients`, `Invoice`, `PaymentRequest`, `Dispute`, plus `AuditLogAdmin` (refactoré
   sur le mixin partagé, comportement identique).
4. **[ARBITRAGE] `TariffItemAdmin` passe en lecture seule.** Un tarif ressemble à de la
   configuration, c'est de l'argent : contrainte DB d'intégralité KMF (une écriture
   fractionnaire rendrait `IntegrityError` là où le service rend un 400 français), audit
   `tariff.created`/`.updated` contourné, et la porte produit existe déjà (directeur +
   caissier). Les actes historiques sont protégés par leurs snapshots (ADR 0005) : rouvrir
   ne coûterait rien de structurel.
5. **[ARBITRAGE] `KycDocumentAdmin` passe en lecture seule** (non nommé par la décision 4,
   même classe d'objet que `PatientDocument`) : le formulaire exclut `file` (stockage privé
   sans URL) et créerait donc une ligne sans octets vérifiés par le pipeline ADR 0014 ; et
   l'archivage est définitif par garde `save()` — l'admin était le seul endroit où l'annuler
   sur une pièce justifiant une décision KYC.
6. **`StaffMembershipAdmin` reste en écriture**, documenté dans sa docstring avec ce que ça
   coûte (pas d'audit `staff.membership_created`, pas de garde « dernier directeur ») : c'est
   l'équivalent tenant de `PlatformStaffAdmin`, le dernier retour dans un centre qui s'est
   verrouillé hors de son espace. À refermer si S5 donne un module personnel complet à la
   plateforme. `HealthCenterAdmin` garde son profil éditable (ni argent, ni médical, ni
   consentement, ni rôle) et son bloc KYC read-only du lot 1.
7. **Cloisonnement tenant NON tenté, consigné en code** (`apps/common/admin.py`) : un admin
   Django est transverse par nature (il s'authentifie sur `is_staff`, résout les modèles
   globalement, ignore les memberships). Un demi-cloisonnement donnerait une fausse sécurité ;
   la parade est que **plus rien de sensible n'y soit modifiable** et que les comptes
   `is_staff` restent rares.
8. **Tests d'admin — le trou de couverture est comblé** (`tests/test_admin_hardening.py`,
   89 tests) : chaque admin sensible verrouillé sur les trois permissions (y compris la
   signature objet et les inlines), **fermeture du registre** (tout modèle enregistré est
   soit sensible-et-read-only, soit dans `WRITABLE_BY_DESIGN` avec un motif écrit, soit dans
   `THIRD_PARTY_REVIEWED` — une app nouvelle fait rougir le test tant qu'un humain n'a pas
   tranché), et vérification **de bout en bout via le vrai site admin** : un superuser Django
   reçoit 403 sur les vues d'ajout et sur le POST de modification d'un `Consent`.

### Décision 5 — journal d'audit du directeur

9. **`AuditLog.center` = colonne, jamais clé de payload** : `audit(center=…)` est un kwarg
   explicite, refusé avec une `TypeError` en famille avec la garde de payload scalaire si on
   lui passe autre chose qu'un `HealthCenter`/`None`. Index `(center, created_at)`.
   Migration `audit/0003` **schéma seul, réversible, sans rétro-remplissage** (le trigger
   ADR 0006 le refuserait de toute façon).
10. **Où `center=` a été câblé** : `centers` (personnel, centre, logo, KYC, pièces, tarifs),
    `medical` (les 8 services — les lignes cliniques PORTENT le centre, c'est la liste blanche
    qui protège, pas l'absence de donnée : une conformité future doit pouvoir répondre « quel
    centre a produit ce document »), `trustbridge` (toute la chaîne facture → caisse → rail
    diaspora, y compris les 3 incidents PSP via `_intent_center()` =
    `payment_request.invoice.center`, jamais une entrée d'appelant) et `patients` **côté
    guichet** (porte C, édition guichet, consentements guichet, assurances, fusion).
    `scheduling` n'a aucun appel d'audit (RDV = exploitation non sensible, ADR 0013).
11. **Actions transverses laissées à NULL, assumé** : authentification/OTP, portes A et B,
    cycle de vie des liens de tutelle et consentements en-application. Elles ne concernent
    aucun centre — les mettre sous un tenant serait une fiction. Conséquence directe : elles
    n'apparaissent dans aucun journal de directeur, ce qui est le résultat voulu.
    `update_patient_profile` et `invite_guardian` gagnent un `center=None` optionnel : la vue
    guichet le renseigne, l'espace patient ne le renseigne pas.
12. **Liste blanche explicite** (`DIRECTOR_JOURNAL_ACTIONS`, `apps/centers/audit_views.py`) +
    une constante `DIRECTOR_JOURNAL_EXCLUDED` qui **documente en exécutable** ce qu'on
    protège (elle ne filtre rien : la liste blanche est l'unique porte). Testé sur trois
    niveaux : une action inventée est invisible, chaque action exclue est invisible, et aucune
    action des 7 familles cliniques/consentement ne peut être whitelistée (assertion de
    préfixe).
13. **[ARBITRAGE] `payment.webhook_refused`, `payment_intent.*` sont DANS la liste blanche.**
    Lecture retenue : ce sont des actions « paiements » sur les factures du centre lui-même,
    nommées par l'énumération de la décision 5. Le « miroir côté centre » différé (décision 6)
    est un **écran/notification expliqué** pour le centre ET le tuteur — ce lot ne le
    construit pas ; le contrat frontend le dit explicitement.
14. **[ARBITRAGE] `patient_profile.created|updated` et `patient_insurance.*` restent hors
    liste blanche** : non nommés par l'énumération de la décision 5. Le registre patients est
    déjà lisible (`GET /centers/{c}/patients/`) ; une piste datée « qui a inscrit qui » est un
    objet plus intrusif. `patient_profile.merged` est bien inclus (« fusions de patients »).
15. **`actor_display` : un nom seulement pour un membre de CE centre.** Une requête par page,
    source = `StaffMembership.for_center(center)` — un acteur hors périmètre n'a
    structurellement pas d'entrée dans la carte et reste un id (patient, tuteur, exploitant)
    ou `null` (système). Les memberships **désactivés** sont inclus : la désactivation n'est
    pas de l'amnésie. `payload` rendu tel quel (contrat références-only déjà en vigueur).
16. **`journal_starts_at`** ajouté à la racine de la réponse paginée : la date de la première
    entrée du centre, **même si cette entrée n'est pas listée** (une ligne clinique fait
    commencer le journal sans jamais s'y afficher). C'est la traduction API du « le journal
    commence le … » de la décision 5.
17. **`?action=` hors liste blanche → 400 unique** « Action inconnue. » pour une valeur
    inventée ET pour une action cliniquement masquée : pas d'oracle qui apprendrait au
    directeur ce qui existe mais lui est caché (test d'égalité byte-à-byte).
18. **Directeur seul, pas BILLING** : le journal agrège personnel + argent + litiges — les
    cinq autres rôles reçoivent 403 (testé), centre étranger 404, exploitant plateforme 404
    (la 4ᵉ casquette gouverne le tenant, elle n'en est pas membre).

### Décision 6 — réconciliation PSP

19. **Module dans `trustbridge`** (`platform_views.py` + `platform_urls.py`), monté sur le
    MÊME préfixe `platform/` que celui de `centers` — exactement le plan du lot 1. Le
    garde-fou structurel le couvre automatiquement ; le test de champs négatifs et le test
    « aucun module plateforme n'importe un serializer patient » ont été **étendus** à ce
    module.
20. **Vocabulaire d'incidents fermé** (6 codes) plutôt qu'un `?reason=` sur le nom d'action :
    un exploitant raisonne en incidents, et les **4 cas de refus de webhook** doivent être
    distinguables (« la facture avait été annulée » ≠ « le solde a bougé au guichet »). Les
    codes sont dérivés déterministiquement des refs posées par les services (`refusal`,
    `request_status`), et la table `INCIDENT_FILTERS` (côté requête) est verrouillée par test
    contre la fonction `incident_code()` (côté rendu) : les deux faces d'une seule règle.
21. **Liste blanche de refs, jamais de passthrough du payload** (`INCIDENT_REF_FIELDS`) : un
    service qui enrichirait demain une de ces trois entrées d'audit ne peut pas fuiter par
    cette vue (testé avec un payload volontairement pollué d'un `patient_id` et d'un nom).
22. **Les 4 refus sont produits par les VRAIS services dans les tests**, pas par des lignes
    d'audit écrites à la main : c'est la seule façon de garantir que les refs attendues sont
    bien celles que le code pose.
23. **`?center=` inexistant → page vide, pas 404** : le périmètre de la plateforme EST
    l'ensemble des centres, il n'y a aucune sonde inter-tenant à empêcher ici. Non numérique
    → 400 par champ (norme des filtres du projet).
24. **Extraction partagée** : le contrat de fenêtre (`?from=&to=`, jours locaux Comores, 30 j
    défaut / 366 max, 400 par champ) quitte `centers/stats_views.py` pour
    `apps/common/periods.py` — un module de vues ne doit pas en importer un autre (leçon
    C.5.2 de S1). `stats_views` ré-exporte les mêmes noms : surface publique inchangée.

### Tests

**174 tests neufs** — `tests/test_admin_hardening.py` (89), `tests/test_center_audit_log.py`
(54), `tests/test_platform_reconciliation.py` (31) — plus deux extensions de
`tests/test_permissions_platform.py`. **Total suite : 1380 verts.**

### Vigilances consignées (lot 2)

- **Le journal commence à la migration.** Aucune ligne antérieure n'a de centre et n'en aura
  jamais ; l'API le dit (`journal_starts_at`), le frontend doit le dire aussi.
- **`payload` est rendu tel quel** dans le journal du directeur : le contrat « références
  only » (ADR 0007) devient donc un contrat d'exposition, pas seulement de stockage. Toute
  revue future d'un `audit()` sur une action whitelistée doit se demander « le directeur peut
  lire ça ».
- **Aucun throttle dédié** sur le journal ni sur la réconciliation : le throttle user global
  (600/min) couvre. À re-trancher si un export volumineux apparaît.
- **`StaffMembershipAdmin` et `PlatformStaffAdmin` restent les deux seules portes d'écriture
  sensibles de l'admin** — à refermer avec le module Support de S5.
- **Pas d'export CSV** du journal ni de la réconciliation (le comptable comme le support en
  voudront) : à cadrer avec l'export comptable figé déjà consigné en vague 2.

## Addendum d'implémentation — LOT 3 (décision 7 livrée le 2026-08-14)

Choix arrêtés à l'implémentation du dernier lot backend de S4 — l'ADR 0007, jusqu'ici décision
de principe sans une ligne de code, est implémentée. Les points marqués **[ARBITRAGE]** vont
au-delà de la lettre de la décision 7 ou tranchent un point qu'elle laissait ouvert ; tous
sont RÉVERSIBLES et aucun n'est silencieux.

### Le dépôt de la demande

1. **`accounts.ErasureRequest`** avec contrainte partielle
   `unique_open_erasure_request_per_user` (patron de
   `unique_active_consent_per_link_and_scope`) : une seule demande OUVERTE, l'historique des
   traitées et des refusées reste — un dossier d'effacement doit rester auditable après coup
   (« pourquoi ce refus, en mars ? » est une question de DPO). **Un refus rouvre donc le droit
   de redemander**, ce qui est le comportement voulu : les gardes sont des obstacles à lever,
   pas des verdicts.
2. **`POST|GET /auth/me/erasure-request/`, toute casquette authentifiée** — la ligne référence
   le `User`, jamais une casquette (ADR 0001 : les rôles sont des profils). `GET` rend la
   demande la PLUS RÉCENTE quel que soit son statut (sinon un refus et son motif deviendraient
   illisibles), et **404 quand il n'y en a aucune** — même contrat que `GET /guardian/profile/`.
   La course de deux dépôts simultanés est sérialisée par un verrou de ligne sur le `User` :
   la contrainte partielle est la ceinture, pas le message d'erreur.
3. **[ARBITRAGE] `refusal_reason` est RENDU à la personne concernée.** C'est le seul texte
   libre d'exploitant du projet que le sujet lit — à l'opposé de `kyc_reason`,
   `Invoice.cancel_reason` et `Dispute.reason`, tous gatés. Motif : refuser un effacement
   oblige le responsable de traitement à en expliquer la raison (RGPD art. 12.4), et ce texte
   est écrit POUR la personne. Il reste hors de tout payload d'audit (`has_reason` seulement).
   `processed_by` n'est pas exposé au sujet : la décision et son motif, pas un nom d'agent.

### Le traitement par la plateforme

4. **Module `apps.accounts.platform_views/platform_serializers/platform_urls`**, monté sur le
   MÊME préfixe `platform/` — troisième module, exactement le plan du lot 1. Le garde-fou
   structurel, le test de champs négatifs et le test « aucun module plateforme n'importe un
   serializer patient » ont été **étendus** à ces deux modules.
5. **L'exploitant ne voit toujours AUCUNE PII** — et c'est ici que l'invariant coûtait le plus
   cher, puisque l'objet gouverné EST une personne. Arbitrage : le payload porte un
   **identifiant de compte**, des **casquettes en booléens** (`hats`) et les **codes de
   blocage** (`blockers`) — jamais un nom, un téléphone, un e-mail ou une date de naissance.
   Justification : la demande a été déposée par la personne AUTHENTIFIÉE depuis son propre
   espace ; l'authentification de Chioni est la preuve d'identité, pas un nom saisi par un
   agent. Le test de champs négatifs de `/platform/` couvre désormais le cas le plus dur — un
   demandeur qui est un patient nommé.
6. **`blockers` est calculé et rendu AVANT le clic**, pas découvert au refus : un exploitant
   doit voir ce qu'il faut corriger, pas essuyer une erreur. Trois codes, la liste est
   complète en une réponse (jamais un refus au goutte-à-goutte).
7. **[ARBITRAGE] Une demande bloquée reste `en_attente`.** L'API refuse l'anonymisation avec
   les phrases françaises correspondantes, mais ne la referme pas en « refusée » : la personne
   n'a pas à redemander une fois le directeur remplaçant nommé ou le paiement atterri.
8. **[ARBITRAGE] Troisième garde : `dernier_admin_plateforme`.** La décision 7 en nomme deux
   (dernier directeur, intent PSP en cours). Perdre tous les administrateurs plateforme
   enfermerait Chioni hors de son propre back-office — même mode de panne, un étage au-dessus,
   et seul l'admin Django permettrait d'en refabriquer un. Un exploitant PEUT donc demander
   son effacement (c'est une personne), il ne peut simplement pas être le dernier. Un `support`
   n'est jamais bloqué par cette garde.
9. **Garde « dernier directeur » partagée sans import privé** : `centers.services` expose
   `centers_locked_by_last_director(user)`, qui appelle `_is_last_active_director` chez lui.
   Importer un nom privé entre apps aurait garanti la dérive des deux lectures.

### L'anonymisation elle-même

10. **`anonymize_user` ne fait JAMAIS de `DELETE`** — sauf sur `OtpCode`, seule table stockant
    un téléphone en clair (table utilitaire d'authentification, hors socle append-only, déjà
    purgée par une tâche Celery). Tout le reste est neutralisé sur place.
11. **Ce qui reste, et c'est un choix testé** : le carnet médical intégral (consultations,
    ordonnances, entrées, signes vitaux, documents, fiche médicale) — il appartient au patient
    (ADR 0002) et relève du droit local de conservation ; le ledger (aucune PII) ; l'audit
    (références only — l'anonymisation du compte anonymise mécaniquement l'historique) ; les
    factures et les reçus (pièces comptables du centre). Une classe de tests entière porte ce
    point, pour qu'un futur relecteur distingue une DÉCISION d'un oubli.
12. **[ARBITRAGE] Identité neutralisée mais LISIBLE** : `PatientProfile` devient
    « Patient / anonymisé #<pk> » plutôt que des chaînes vides. Un soignant relisant une liste
    de consultations doit voir que la personne a exercé son droit, pas une ligne blanche qui
    ressemble à un bug ; le pk garde deux profils anonymisés distinguables sans nommer
    personne. Idem pour les assurances (« Assurance anonymisée », numéro d'adhérent et notes
    vidés).
13. **Les liens de tutelle sont révoqués DANS LES DEUX SENS** (la personne comme tutrice ET
    comme protégée), via `GuardianLink.revoke()` — donc avec la cascade sur les consentements
    actifs (ADR 0004). Un compte qui n'existe plus ne doit garder aucune portée vivante d'un
    côté ni de l'autre.
14. **[ARBITRAGE] Les memberships actifs sont désactivés** (via `deactivate_staff_member`,
    donc audités et visibles dans le journal du directeur — le départ d'un membre est l'affaire
    du tenant), et la ligne `PlatformStaff` passe `is_active=False`. Non nommé par la décision
    7, mais laisser un membre « actif » sur un compte mort donnerait à un centre un salarié
    fantôme qu'il ne peut même plus appeler. La garde « dernier directeur » ne peut pas s'y
    déclencher : `erasure_blockers` a refusé l'effacement en amont.
15. **`country_of_residence` du `GuardianProfile` est vidé** (donnée de localisation) ;
    `preferred_currency` est laissé (préférence d'affichage, pas une donnée personnelle).
16. **Idempotent et sûr sur un compte déjà inactif** : rejouer ne révoque rien de plus, ne
    supprime aucun fichier absent et **conserve le PREMIER `anonymized_at`** (la date de
    l'effacement est elle-même un fait). Le rejeu est signalé dans l'audit (`replay: true`).
17. **Audit** : `erasure.requested`, `erasure.processed`, `erasure.refused`, `user.anonymized`
    — références et compteurs uniquement (`links_revoked`, `memberships_deactivated`,
    `insurances_anonymized`, `otp_codes_purged`, `had_patient_profile`…). Ces quatre actions
    sont **transverses** (`center=None`, comme l'authentification et la tutelle du lot 2) et
    **hors liste blanche du journal du directeur** : elles concernent une personne, pas un
    tenant. Verrouillé par test.

### L'export de portabilité

18. **`GET /auth/me/export/` ne révèle RIEN de nouveau** : `apps/accounts/export.py` rejoue,
    casquette par casquette, les requêtes ET les serializers des écrans existants. Le tuteur
    n'obtient donc pas le carnet de son protégé — **même porteur de `detail_clinique`**,
    puisqu'aucune lecture clinique tuteur n'existe dans le produit (verrou de sprint ADR 0016).
    Test dédié : le contenu clinique et le libellé d'acte sensible sont absents du corps.
19. **Une casquette non portée vaut `null`, pas un objet vide** : « je n'ai pas d'espace
    tuteur » et « mon espace tuteur est vide » sont deux vérités différentes, et un export qui
    les confondrait répondrait mal à une demande de portabilité.
20. **[ARBITRAGE] L'export d'un salarié = ses memberships, pas les données de son centre.**
    Le tenant appartient au centre, pas à l'employé ; un export qui embarquerait le registre
    patients d'un centre serait une exfiltration déguisée en droit individuel.
21. **Documents : métadonnées seules** (le serializer patient n'a pas de champ fichier par
    contrat ADR 0016 §5) — un export ne doit jamais devenir l'URL publique que le stockage
    privé refuse de produire. Les documents archivés restent exclus, comme dans la liste
    patient.
22. **Throttle dédié `data_export`** (10/h, env `THROTTLE_DATA_EXPORT`), patron de `uploads` :
    un endpoint qui éclate en une douzaine de requêtes ne doit pas rouler sur le seul throttle
    global généreux.
23. **Admin** : `ErasureRequestAdmin` en `ReadOnlyAdminMixin` strict + `readonly_fields`, et
    `accounts.ErasureRequest` déclaré dans `SENSITIVE_MODELS` du test de fermeture du registre.
    Motif écrit dans la docstring : un formulaire d'admin ferait passer une demande à
    « traitée » SANS rien anonymiser — un effacement déclaré fait et jamais exécuté est le
    pire mode de panne de cette fonctionnalité.
24. **Seed démo** : une demande en attente déposée par `tuteur2.demo` (la tutrice dont le lien
    est garé derrière la porte de confirmation du titulaire) — la file back-office a de la
    matière, et la traiter en démo ne touche pas au scénario d'argent porté par `tuteur.demo`.

### Tests

**66 tests neufs** — `tests/test_erasure_rgpd.py` (62 : contrainte, espace utilisateur, file
plateforme, gardes, tombstone, ce qui survit, audit, export, bout en bout), plus les extensions
de `tests/test_permissions_platform.py`, `tests/test_admin_hardening.py` et
`tests/test_seed_demo.py`. **Total suite : 1446 verts.**

### Vigilances consignées (lot 3)

- **Pas de rétractation** : la personne ne peut pas annuler sa propre demande en attente. Le
  cas « j'ai cliqué trop vite » se règle aujourd'hui par un refus motivé de l'exploitant. À
  rouvrir si le terrain le demande.
- **Aucune notification** n'est envoyée à la personne quand sa demande est traitée ou refusée
  (elle doit revenir voir son espace — et un compte anonymisé ne peut plus s'y connecter).
  Un SMS « votre demande a été traitée » est un candidat naturel, à cadrer avec l'ADR 0012.
- **Le nom d'utilisateur `anon-{pk}` est déterministe** (exigence de la décision 7) : un compte
  préexistant portant littéralement ce nom provoquerait une collision d'unicité. Le préfixe
  `anon-` est de fait réservé — à durcir si un jour des usernames sont choisis librement.
- **L'anonymisation n'est pas fenêtrée ni différée** : elle s'exécute au clic de l'exploitant.
  Aucun délai de grâce, aucune corbeille — c'est cohérent avec « il n'y a plus rien à
  restaurer », mais cela suppose que l'exploitant lise les `blockers` et les `hats` avant.
- **Un tuteur anonymisé perd ses liens** : la patiente qu'il finançait se retrouve sans ce
  tuteur, sans notification. Cohérent avec la révocation ordinaire (qui n'en envoie pas non
  plus), à re-trancher avec la vigilance SMS ci-dessus.
- **Une demande d'effacement en attente n'empêche rien** : la personne continue d'utiliser
  Chioni normalement entre le dépôt et le traitement. C'est voulu (le traitement peut prendre
  des jours), mais un centre ne sait pas qu'un de ses membres part.
- **Pas de trigger PostgreSQL sur `ErasureRequest`** — même famille que la dette SV.2 sur les
  tables S3. La table n'est pas append-only (elle a un cycle de vie), mais rien n'empêche un
  `update()` brut par shell de la faire mentir sur un effacement jamais exécuté.
- **`hats` et `blockers` sont calculés PAR LIGNE** de la file plateforme (quelques petites
  requêtes chacun) : assumé pour une file de back-office de quelques dizaines de lignes, à
  revoir en agrégats SQL (patron des stats de la vague 2b) si le volume de demandes devient
  réel — c'est-à-dire au module Support de S5.

## Addendum — revue adversariale guardian (S4, 2026-08-14)

Passe adversariale sur les 3 lots. **Six failles confirmées par probe et corrigées** ;
les probes restent en régression dans `backend/tests/test_adversarial_s4.py` (42 tests).

### Élevé

1. **L'exploitant se fabriquait une casquette tenant.**
   `POST /platform/centers/{pk}/directors/` écrit une `StaffMembership` : un `admin`
   plateforme s'amorçait DIRECTEUR de n'importe quel centre avec **son propre numéro**,
   puis lisait `/centers/{c}/patients/` en clair. L'invariant « l'exploitant ne voit aucune
   PII patient » ne vivait qu'à l'intérieur des payloads `/platform/`, jamais contre la
   PERSONNE de l'exploitant.
   **Correctif** : garde de séparation des casquettes
   (`centers.services._refuse_platform_operator_as_director`) sur les DEUX portes
   plateforme (`add_center_director`, et `create_center_with_director` qui passe
   désormais par elle) — une cible portant une ligne `PlatformStaff` ACTIVE est refusée,
   la transaction roule tout en arrière (centre inclus). **La porte du tenant est
   inchangée** : un directeur reste libre d'embaucher quelqu'un qui travaille aussi chez
   Chioni — c'est sa décision, tracée. Honnêteté du correctif : un exploitant disposant
   d'un SECOND numéro reste amorçable comme directeur ; la garde supprime le chemin
   self-service et force l'abus à passer par une identité distincte.

2. **Déni de service auto-service sur la file RGPD.** Le calcul des `blockers` prenait un
   `select_for_update` (via `centers_locked_by_last_director`) **dans un GET**, donc hors
   `atomic` → `TransactionManagementError` → 500. N'importe quel directeur cassait la file
   d'effacement de TOUTE la plateforme en déposant une demande.
   **Correctif** : `lock` devient un paramètre EXPLICITE (sans défaut) de
   `centers_locked_by_last_director`, et `erasure_blockers(user, *, lock=False)` sépare la
   lecture (écran) de la décision (écriture). Le chemin d'écriture passe `lock=True`.

### Moyen

3. **Course des deux derniers administrateurs plateforme.** Deux effacements concurrents
   voyaient chacun « l'autre admin est encore là » : les deux passaient → **zéro
   administrateur**, Chioni enfermée hors de son back-office (même mode de panne que la
   course « dernier directeur » fermée en vague 1).
   **Correctif** : `accounts.services._is_last_platform_admin` verrouille les lignes
   `PlatformStaff` actives en ordre de pk (`FOR UPDATE`) quand la réponse décide d'une
   écriture. Probe à fils réels avec entrelacement forcé.

4. **Fenêtre TOCTOU « paiement en vol » × anonymisation.** La garde `paiement_en_cours`
   était lue AVANT tout verrou partagé avec le rail argent : un `pay/` qui commitait entre
   la lecture et l'anonymisation laissait un **intent PSP vivant (carte réellement
   débitée) sur un compte pierre tombale**, incapable de voir son propre reçu.
   **Correctif** : la ligne `User` devient le point de sérialisation.
   `create_payment_intent` la verrouille **en premier** (et refuse un compte anonymisé /
   inactif), `anonymize_user` la reprend et **re-vérifie les gardes dessous**. Hiérarchie
   de verrous étendue d'un niveau externe, inchangée en dessous :
   **utilisateur → intent → demande → facture → centre**.

5. **`anonymize_user` était public, irréversible et SANS gardes.** Appelé seul (shell,
   commande, future action d'admin) il anonymisait le dernier directeur d'un centre et
   enfermait le tenant dehors. Une garde qui ne vit que chez l'appelant n'est pas une garde.
   **Correctif** : les `blockers` sont re-évalués DANS `anonymize_user`, sous le verrou de
   ligne. L'idempotence du rejeu est préservée (une pierre tombale n'a plus de blocage).

6. **La garde KYC faisait confiance à l'objet de l'appelant.** `_require_center_can_collect`
   lisait `center.kyc_status` **en mémoire** : une `Invoice` construite avec une instance
   `HealthCenter` chargée avant une suspension portait un `actif` périmé jusqu'à la garde et
   **rouvrait le rail diaspora sur un centre suspendu**. Non exploitable via l'API en l'état
   (chaque requête recharge le centre), mais latent pour toute composition future de
   services.
   **Correctif** : le statut est relu en base (une lecture pk indexée sur le rail qui déplace
   de l'argent) ; une ligne disparue vaut « n'encaisse pas », jamais « actif ».

### Vérifié sans faille (probes de non-régression conservées)

Cloison plateforme/tenant (balayage de 11 routes tenant/patient/tuteur : 403/404, jamais
200) ; aucun payload plateforme ne nomme un humain (patiente nommée + tutrice + téléphone,
file RGPD comprise) ; contrat de champs de la file d'effacement figé ; `support` lit et
n'exécute rien ; journal du directeur (lignes cliniques présentes en base et invisibles,
filtre `?action=` non-oracle byte-à-byte, directeur désactivé → 404, centre étranger → 404,
actions transverses `center=None` absentes) ; motif KYC visible du seul directeur du centre
concerné et absent des payloads d'audit ; audit `center.created` sans nom ni téléphone ;
pièce KYC injoignable par la secrétaire (403), par un centre voisin (404), par un anonyme
(401), sans URL de stockage ; aucun chemin tenant ne bouge son propre KYC ; suspension =
rail diaspora seul (porte patient comprise) alors que soin, facturation, caisse et reçu
« G- » continuent, et paiement en vol qui atterrit ; export de portabilité (verrou tuteur S3
tenu **même porteur de `detail_clinique`**, aucun téléphone de protégé, ni `cancel_reason`
ni motif de litige de l'autre partie, salarié = ses seuls memberships, exploitant = sa seule
casquette, profil non revendiqué = pas de bloc patient, throttle `data_export` dédié) ;
robustesse des identifiants grotesques sur toutes les routes plateforme (400/404, jamais 500).

### Vigilances consignées (non bloquantes, à verser au sprint SV)

- **`PlatformStaffAdmin` reste écrivable** (amorçage assumé) : un superuser Django est donc
  toujours à un formulaire de la 4ᵉ casquette. C'est le prix du bootstrap — à refermer avec
  le module Support de S5, en gardant une porte d'amorçage hors ligne.
- **`refusal_reason` (RGPD) est lu par un `support`** et n'est pas borné en longueur (même
  convention que `cancel_reason` / motif de litige / motif de contre-passation, tous non
  bornés) : si un exploitant y tape un nom de patient, un autre exploitant le lit. Contrat de
  revue, pas de code.
- **`hats.is_platform_operator`** compte une ligne `PlatformStaff` même DÉSACTIVÉE, alors que
  `is_center_staff` ne compte que l'actif — incohérence cosmétique de la file RGPD.
- **Doublons de profil patient non revendiqués** portant le téléphone d'une personne
  anonymisée : `anonymize_user` ne neutralise que le profil RATTACHÉ (`user=`). Un profil
  guichet homonyme reste en clair. À trancher avec le DPO (heuristique par téléphone
  = risque d'effacer le dossier d'un tiers).
- **Aucun blocage sur un litige ouvert** dans `erasure_blockers` : une personne peut être
  anonymisée alors qu'un litige la concernant est en cours (l'autre partie perd son
  interlocuteur).
- **Devis diaspora non gardé par le KYC** (`GET /guardian/payment-requests/{pk}/quote/`) : un
  tuteur peut obtenir un prix sur un centre suspendu et n'être refusé qu'au `pay/`. Gêne
  d'usage, pas de fuite.
- **Le frontend S4 (espace plateforme, journal du directeur, pièces KYC, « Mes données »)
  est présent dans l'arbre mais n'a PAS été couvert par cette passe** — elle porte sur les
  3 lots backend.

## Conséquences

- L'admin Django cesse d'être un back-office de fait : il redevient un outil de dernier
  recours, et le produit porte ses propres portes, auditées.
- Le mot « suspendu » a enfin un sens opérationnel — et un sens **borné** : il protège la
  diaspora sans prendre les patients en otage.
- Le directeur gagne la traçabilité de son centre sans gagner un œil sur le dossier de ses
  patients : la segmentation clinique de S3 tient aussi dans le journal.
- Chioni devient démontrable en conformité RGPD (demande, exécution, export, traces) sans
  jamais casser les immuabilités qui font la valeur du produit.
