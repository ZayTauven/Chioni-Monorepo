# ADR 0016 — Dossier patient enrichi (sprint S3)

- **Statut** : acté — **arbitrages VALIDÉS par le PO le 2026-08-14** (re-segmentation clinique/administrative, PDF différé, directives anticipées hors périmètre, verrou tuteur S3). Ils restent réversibles au sens ADR (une décision ultérieure peut les rouvrir par addendum), mais ne sont plus « en attente de confirmation ».
- **Date** : 2026-08-14
- **Sources** : audit §F.2 + D.1, étude des besoins §5.2, ADR 0002 (carnet transversal), 0004 (consentements), 0008 (permissions), 0014 (uploads)

## Contexte

L'identité patient actuelle est minimale (nom, naissance, sexe, téléphone, ville) et le carnet
(`HealthRecordEntry`) est du texte libre en 4 types. On est dans la santé : il faut davantage —
identité élargie, fiche médicale structurée, signes vitaux en visite, documents en pièces
jointes, assurance/mutuelle. Presque tout est clinique : la segmentation par rôle existante
doit s'étendre sans jamais s'élargir en silence.

## Décision cadre n° 1 — Aucune exposition tuteur en S3 (verrou de sprint)

L'arbitrage PO SV.1.1 (consentement guichet interdit sur un lien fabriqué par le centre) est un
**pré-requis bloquant de toute lecture clinique tuteur**. Il n'est pas implémenté. Donc :
**aucune donnée nouvelle de S3 n'est exposée au tuteur, même porteur de `detail_clinique`** —
le serializer tuteur du patient reste byte-identique (verrouillé par test de champs), aucun
endpoint `/guardian/` nouveau. Le câblage lecture clinique tuteur reste un chantier ultérieur,
conditionné à SV.1.1. Directives anticipées et antécédents familiaux = sensibilité maximale :
ils n'entreront **jamais** dans le périmètre tuteur sans cadrage dédié.

## Décision cadre n° 2 — La liste F.2.1 du PO est un besoin, pas une segmentation

Le PO classe groupe sanguin/taille/poids dans « identité élargie ». Ce sont des **données de
santé** (RGPD art. 9) : elles rejoignent la sphère clinique, pas la fiche administrative.
Re-segmentation actée (RÉVERSIBLE) :

| Donnée | Sphère | Lecture | Écriture |
|---|---|---|---|
| Adresse, 2ᵉ téléphone, n° identité/identifiant médical, personne à prévenir | Administrative (`PatientProfile`) | tout staff du périmètre + patient | staff selon R-API-2 ; patient revendiqué lui-même |
| Groupe sanguin + rhésus | Clinique (fiche médicale) | rôles cliniques + patient | rôles cliniques |
| Taille, poids | Clinique — **mesures par visite** (signes vitaux), pas des attributs statiques | rôles cliniques + patient | rôles cliniques |
| Signes vitaux (PA, FC, SpO₂, T°, FR…) | Clinique, rattachés à la consultation | rôles cliniques + patient | rôles cliniques |
| Entrées carnet étendues (chirurgies, antécédents familiaux, observations) | Clinique (carnet) | rôles cliniques (bornage centre producteur inchangé) + patient (transversal) | rôles cliniques |
| Documents en pièces jointes | Clinique (carnet) | rôles cliniques du centre producteur + patient (transversal) | rôles cliniques |
| Assurance/mutuelle | Administrative-financière | tout staff du périmètre + patient | BILLING |

Le pharmacien reste exclu du carnet (statu quo `medical/views.py`) ; le staff admin
(secrétaire/caissier/directeur) ne voit **rien** de la sphère clinique — comme aujourd'hui.

## Décisions par brique

### 1. Identité administrative élargie (`PatientProfile`)

Nouveaux champs, tous optionnels (`blank`) : `address` (texte court), `phone_alt`,
`national_id` (n° pièce d'identité ou identifiant médical, texte libre — pas de format imposé,
réalité comorienne), et personne à prévenir en cas d'urgence : `emergency_contact_name`,
`emergency_contact_phone`, `emergency_contact_relationship`. Téléphones normalisés E.164
(`apps/common/phones.py`) comme `phone`.

- Tous rejoignent `IDENTITY_FIELDS` (`patients/services.py`) : la règle R-API-2 s'applique
  telle quelle — un profil revendiqué n'est plus modifiable par le staff.
- Exposés dans `PatientStaffSerializer` et `PatientSelfSerializer` ; **jamais** dans
  `PatientGuardianSerializer` (test de champs à étendre, pas à assouplir).
- Audit : `patient_profile.updated` inchangé (refs `fields=` triés, jamais les valeurs).

### 2. Peaufinage porte C : détection de doublons à la création

`GET /centers/{c}/patients/similar/?last_name=&first_name=&birth_date=&phone=` (tout staff du
périmètre, comme la création) : retourne les patients du périmètre du centre ressemblants
(même téléphone normalisé, OU nom approchant + même date de naissance). **Non bloquant** :
le guichet est informé, il décide (créer quand même ou ouvrir la fiche existante / fusionner).
Payload = `PatientStaffSerializer` (pas de donnée nouvelle). Pas d'audit (lecture d'exploitation).

### 3. Fiche médicale structurée

Deux extensions, pas de refonte :

- **`PatientMedicalFile`** (nouveau, app `medical`) : OneToOne `PatientProfile` (PROTECT),
  champs `blood_group` (choix fermés A+/A−/B+/B−/AB+/AB−/O+/O−, blank) + `notes` cliniques
  libres (blank) + trace (`updated_by` FK User). Créée à la demande (get_or_create au premier
  write). Lecture/écriture : rôles cliniques du périmètre + lecture patient.
  Audit : `patient_medical_file.updated` (refs `fields=`).
- **`HealthRecordEntry.entry_type` étendu** : + `chirurgie` (chirurgies et hospitalisations
  antérieures), + `antecedent_familial`, + `observation` (notes d'évolution). Le contenu reste
  du texte libre : la structuration fine (posologie codée, codes CIM) est explicitement
  remise à plus tard — l'i18n et l'IA de reprise du papier pèseront sur ce choix.
  Endpoints inchangés (mêmes vues, mêmes permissions, mêmes bornes centre producteur).
  Diagnostics et plans de traitement restent sur `Encounter.diagnosis` (statu quo).

### 4. Signes vitaux en visite (`VitalSigns`, app `medical`)

- FK `encounter` (PROTECT, **obligatoire** — le contexte « hospitalisé » à relevés répétés est
  le module S6, ce modèle ne le préfigure pas), `measured_at` (défaut now), `measured_by`
  (FK `StaffMembership`, PROTECT — même invariant praticien-du-centre que `Appointment`).
- Mesures toutes optionnelles mais **au moins une exigée** : `systolic_bp`/`diastolic_bp`
  (mmHg), `heart_rate` (bpm), `spo2` (%), `temperature_c` (Decimal 1 déc.),
  `respiratory_rate`, `weight_kg` (Decimal 2 déc.), `height_cm`. Bornes de plausibilité
  strictes dans `clean()`/serializer (une valeur impossible est refusée, jamais stockée).
- Plusieurs relevés par consultation possibles ; consultation `terminee` → refus
  (même règle `_require_open_encounter` que carnet/ordonnances).
- API : `GET/POST /centers/{c}/encounters/{e}/vital-signs/` (rôles cliniques) ; lecture
  patient transversale `GET /patients/me/vital-signs/` (`?encounter=` optionnel).
- Audit : `vital_signs.recorded` (refs ids uniquement — jamais les valeurs mesurées).

### 5. Documents en pièces jointes (`PatientDocument`, app `medical`)

- Champs : `patient` (PROTECT), `center` (PROTECT — centre producteur, provenance),
  `source_encounter` (PROTECT, optionnel), `doc_type` (choix : `resultat_biologie`,
  `imagerie`, `compte_rendu`, `autre`), `title` (obligatoire, saisi par le soignant),
  `file`, `uploaded_by` (FK User, PROTECT), `archived_at`/`archived_by` (correction d'erreur
  sans destruction — ADR 0002 : on ne supprime pas du médical).
- **Socle ADR 0014 réutilisé tel quel** : `process_image_upload` — JPEG/PNG/WebP seuls,
  2 Mo, ré-encodage, nom uuid. **Le PDF est explicitement différé** (RÉVERSIBLE) : la réalité
  comorienne est la photo de document ; admettre le PDF exigerait un pipeline de désarmement
  dédié (parseur complexe, JS embarqué) et un contrat de diffusion propre — ce sera un
  addendum ADR 0014 si le besoin est confirmé.
- **Diffusion privée obligatoire (le point de sécurité n° 1 du sprint)** : contrairement au
  logo/avatar, un document médical ne doit JAMAIS être servi par l'arborescence `/media/`
  publique. Stockage sous une racine privée dédiée (`PRIVATE_MEDIA_ROOT`, storage séparé non
  exposé par `MEDIA_URL`), lecture UNIQUEMENT via un endpoint authentifié qui rejoue les
  permissions (`FileResponse` ; `X-Accel-Redirect` au déploiement). Aucune URL de media dans
  les serializers de documents — un id, et l'endpoint de téléchargement.
- API : `GET/POST /centers/{c}/patients/{pk}/documents/` + `GET .../documents/{id}/download/`
  + `POST .../documents/{id}/archive/` (rôles cliniques ; liste et téléchargement bornés au
  centre producteur, comme les entrées de carnet) ; côté patient
  `GET /patients/me/documents/` + `GET .../{id}/download/` (transversal, archivés exclus).
- Throttle `uploads` (20/h) appliqué au POST. Quotas de stockage : remis au chantier
  abonnement (S5), consigné.
- Audit : `patient_document.created` / `.archived` (refs ids + doc_type — jamais le titre).

### 6. Assurance/mutuelle (`PatientInsurance`, app `patients`)

- Champs : `patient` (PROTECT), `insurer_name`, `member_number`, `valid_until` (date, opt.),
  `notes` (blank), `is_active` (booléen, défaut vrai), trace `created_by`.
  Plusieurs lignes possibles (mutuelle + assurance).
- Transversal au patient (ADR 0002) : visible de tout centre dont le patient est du périmètre.
- API : `GET/POST/PATCH /centers/{c}/patients/{pk}/insurances/` (lecture tout staff,
  écriture BILLING — c'est une donnée de facturation) ; lecture patient
  `GET /patients/me/insurances/`. Pas d'interaction avec la facturation en S3 (le tiers
  payant n'existe pas encore — consigné pour un chantier facturation ultérieur).
- Audit : `patient_insurance.created` / `.updated` (refs ids + `fields=`).

### 7. Directives anticipées — HORS périmètre S3

Sensibilité maximale (fin de vie), consentement et opposabilité à cadrer avec le PO (qui peut
les lire ? un médecin d'un autre centre ? en urgence ?). L'audit les marque « option, cadrage
dédié » : **aucune implémentation en S3**, chantier propre à ouvrir (candidat SV ou S6).

## Invariants transverses (obligations d'implémentation)

1. **Fusion de doublons** : `merge_profiles` gagne une étape par table nouvelle
   (`PatientMedicalFile` — fusion à la main : la cible garde sa fiche, celle du doublon n'est
   reprise QUE si la cible n'en a pas ; `PatientDocument`, `PatientInsurance` — ré-ancrage sur
   la cible ; `VitalSigns` suit ses encounters déjà déplacés). Tests de fusion obligatoires.
2. **Serializer tuteur figé** : le test de champs `GUARDIAN_PATIENT_FIELDS` s'étend en
   assertion NÉGATIVE (aucun des nouveaux champs n'apparaît).
3. **Pas de PII dans l'audit** : jamais une valeur mesurée, un titre de document, un nom
   d'assureur en payload — ids et codes seuls.
4. **Toute écriture par services** (audit + invariants dans `save()`/`clean()`), jamais
   d'`update()` brut sur les nouvelles tables.
5. **Seed démo** étendu (`seed_demo`) : fiche médicale, 1 relevé de signes vitaux, 1 document,
   1 assurance sur la patiente de démo — pour le test manuel de bout en bout.
6. **Contrat frontend** (`docs/frontend/api-contract.md`) mis à jour dans le même sprint.

## Addendum d'implémentation (S3 livré — 2026-08-14)

Choix arrêtés à l'implémentation, dans l'esprit des décisions ci-dessus
(aucun n'est un écart de périmètre) :

1. **Bornes de plausibilité des signes vitaux** (constantes
   `VITAL_SIGNS_BOUNDS`, `medical/models.py`) — larges mais
   physiologiquement défendables ; toute valeur hors bornes est refusée,
   jamais stockée : PA systolique 40–300 mmHg, diastolique 20–200 mmHg,
   FC 20–300 bpm, SpO₂ 40–100 %, T° 30,0–45,0 °C, FR 4–90/min, poids
   0,40–400 kg, taille 20–260 cm. En plus : diastolique ≥ systolique =
   inversion ou faute de frappe, refusée.
2. **Documents attachables à une consultation terminée** : la règle
   `_require_open_encounter` s'applique aux signes vitaux (production
   clinique DANS la visite) mais PAS aux documents — un résultat de
   laboratoire arrive régulièrement après la clôture ; `source_encounter`
   reste borné même centre + même patient (invariants du modèle).
3. **Document archivé** : invisible du patient (liste ET téléchargement,
   404) ; le staff clinique du centre producteur garde la ligne, son état
   ET le téléchargement (correction sans destruction — vérifier ce qui a
   été archivé fait partie de la correction). L'archivage est définitif
   (garde structurelle dans `save()`).
4. **Diffusion privée** : storage dédié `PrivateMediaStorage`
   (`apps/common/private_storage.py`) — racine `PRIVATE_MEDIA_ROOT` relue
   dans les settings à chaque accès, `url()` refuse TOUJOURS (pas de repli
   silencieux sur `MEDIA_URL`), champ `file` exclu de l'admin. Réponse de
   téléchargement : `Content-Disposition: attachment` à nom neutre
   (`document-<id>.<ext>`), `X-Content-Type-Options: nosniff` ;
   `X-Accel-Redirect` au déploiement.
5. **`similar/`** : le critère « nom approchant » exige nom + date de
   naissance ENSEMBLE (un nom seul scannerait tout le registre) ; le
   critère téléphone matche `phone` OU `phone_alt` ; aucun critère
   utilisable → 400 explicite.
6. **Fiche médicale** : payload sans `id` ni `updated_by`
   (`{blood_group, notes, updated_at}`) — la forme vide constante
   (`updated_at: null`) sert de « pas encore de fiche » sans 404.
7. **Assurance** : `is_active` porte un `default=True` explicite dans le
   serializer d'écriture (la sémantique checkbox des formulaires HTML
   enverrait sinon `False` pour un champ simplement absent d'un POST
   multipart).
8. **Identité élargie à la création porte C** : les 6 champs sont aussi
   acceptés par le POST de création au guichet (mêmes règles), pas
   seulement par le PATCH.

## Conséquences

- Le carnet reste transversal et le tenant cloisonné : toute donnée nouvelle est `for_patient`
  (documents et signes vitaux portent EN PLUS leur centre producteur pour le bornage de
  lecture côté staff — même modèle que `HealthRecordEntry.source_encounter`).
- Aucun changement du modèle de consentement : `detail_clinique` couvre déjà « éléments du
  carnet » — le jour où la lecture tuteur ouvrira (post-SV.1.1), documents, fiche médicale et
  signes vitaux relèveront de ce scope, antécédents familiaux et directives anticipées
  exceptés (régime à part, jamais par défaut).
- La v1 texte-libre de la fiche médicale assume sa dette : la structuration fine attendra
  les besoins réels (IA de reprise du papier, i18n).
