# Contrat API v1 — référence d'intégration frontend

> Source de vérité : le code backend (`backend/apps/*/urls.py`, `serializers.py`) et Swagger sur `/api/docs/`.
> Ce document est le condensé opérationnel pour brancher le frontend. Base : `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.

## Conventions transverses

- **Ids** : entiers partout (pas d'UUID). **Casse** : `snake_case` strict.
- **Montants** : `DecimalField` sérialisés en **chaînes** (`"15000.00"`, `"491.967800"`) — parser côté client.
- **Dates** : ISO-8601 avec offset (`Indian/Comoro`).
- **Enums** : valeurs brutes (`"actif"`, `"medecin"`) — les libellés FR sont à fournir côté frontend (`src/lib/labels.ts`).
- **Auth** : `Authorization: Bearer <access>`. Deny-by-default : tout endpoint exige un token sauf mention `AllowAny`.
- **Pagination** : `PageNumberPagination`, 20/page, `?page=<n>` uniquement. Réponse `{count, next, previous, results}`. Toutes les listes sont paginées **sauf** `GET /centers/{c}/encounters/{e}/prescriptions/` et `.../record-entries/` (tableaux nus).
- **CORS** : seul `http://localhost:3000` autorisé par défaut. Pas de cookies cross-origin → Bearer pur.
- **3 formats d'erreurs** à normaliser dans le client API :
  1. Erreurs de serializer → objet par champ : `{"phone": ["msg"], "non_field_errors": ["msg"]}`
  2. Erreurs de service métier (les plus fréquentes sur les POST d'action) → **tableau JSON nu** : `["Ce lien n'est pas en attente de votre confirmation."]` (statut 400)
  3. Erreurs framework → `{"detail": "...", "code"?: "..."}` (401/403/404/405/429)
- **Sémantique des refus (norme S1, ADR 0008 addendum)** : anonyme → 401 ; centre étranger ou objet d'autrui référencé par l'**URL** (IDOR) → **404** ; membre sans le bon rôle → 403 ; référence portée par le **CORPS** d'une requête (`patient`, `encounter`, `guardian_link`, `source_id`… d'un POST) hors périmètre → **400 explicite** dont le message couvre indifféremment l'id étranger et l'id inexistant.
- **429** : message anglais `"Request was throttled. Expected available in N seconds."` + header `Retry-After`. **S1** : throttle global généreux par utilisateur (600/min — jamais atteint par un usage normal) sur tous les endpoints, + scope STRICT `uploads` (20/h par utilisateur) partagé par `POST /auth/me/avatar/` et `POST /centers/{pk}/logo/` — prévoir l'affichage du 429 sur ces deux formulaires. **S4 lot 3** : scope `data_export` (10/h) sur `GET /auth/me/export/`.
- **Swagger** : `/api/docs/` et `/api/schema/` publics en DEV seulement (admin en prod).

## Auth

| Endpoint | Corps | Succès | Notes |
|---|---|---|---|
| `POST /auth/otp/request/` | `{"phone"}` | 200 `{"detail": "Si ce numéro peut recevoir un code, un SMS vient de lui être envoyé."}` (réponse constante, anti-énumération) | Throttles : 3/h par téléphone, 10/h par IP. Code : 6 chiffres, 10 min, 5 essais, un seul code vivant. 400 seulement si format téléphone invalide. |
| `POST /auth/otp/verify/` | `{"phone","code"}` | 200 `{"access","refresh","me"}` (`me` = payload de `/auth/me/`) | 400 unique et indistinguable : `["Code invalide ou expiré."]`. Crée le compte (porte B) ou active un compte ombre ; peut suspendre des liens de tutelle → écran de confirmation côté patient. |
| `POST /auth/token/` | `{"username","password"}` | 200 `{"access","refresh"}` | Staff/back-office. 401 `{"detail": "Aucun compte actif..."}` |
| `POST /auth/token/refresh/` | `{"refresh"}` | 200 `{"access","refresh"}` | **Rotation : le refresh est à usage unique** (l'ancien est blacklisté). Sérialiser les refresh (mutex single-flight) sinon 401. Access 30 min, refresh 7 j. |
| `POST /auth/logout/` | `{"refresh"}` | **205**, corps vide | |
| `GET /auth/me/` | — | 200 (voir ci-dessous) | Le routeur des 4 espaces. |
| `PATCH /auth/me/` | `{"first_name"?, "last_name"?}` | 200 (payload `me` complet) | Nom d'affichage UNIQUEMENT — `phone` (pivot d'identité) et `username` ne sont jamais modifiables (valeurs soumises ignorées). |
| `POST /auth/me/avatar/` | **multipart** `file` | 200 `{"avatar": "<url absolue>"}` | Photo de profil de l'utilisateur LUI-MÊME (toute casquette). JPEG/PNG/WebP réels seulement (jamais SVG), 2 Mo max, 2048×2048 max, EXIF strippé, nom de fichier régénéré. 400 : `["Image invalide : formats acceptés JPEG, PNG ou WebP (2 Mo maximum)."]` etc. Remplacement = l'ancien fichier est supprimé du serveur. |
| `DELETE /auth/me/avatar/` | — | 200 `{"avatar": null}` | 400 si aucun avatar. Fichier physiquement supprimé. |
| `GET /auth/me/erasure-request/` | — | 200 `{id, status, requested_at, processed_at, refusal_reason}` | **404** `{"detail": "Vous n'avez déposé aucune demande d'effacement."}` si aucune demande — état normal, pas une erreur. Rend la demande la PLUS RÉCENTE, quel que soit son statut. |
| `POST /auth/me/erasure-request/` | **corps vide** | 201 même shape | Droit à l'effacement (RGPD art. 17). Toute casquette. Une seule demande ouverte à la fois → 400 `["Une demande d'effacement est déjà en cours pour votre compte."]`. |
| `GET /auth/me/export/` | — | 200 (voir « RGPD » ci-dessous) | Portabilité (art. 20). Throttle `data_export` 10/h → prévoir le 429. |

### RGPD — mes droits sur mon compte (S4 lot 3, ADR 0007 + 0017 décision 7)

**Ce n'est PAS un bouton « supprimer mon compte ».** L'utilisateur DÉPOSE une demande depuis son espace ; l'équipe Chioni l'exécute. Arbitrage produit assumé : un compte qui finance des soins ne doit pas disparaître en un clic, ni sous la pression d'un tiers ayant accès au téléphone de la personne. **L'écran doit le dire honnêtement** : « votre demande sera traitée par l'équipe Chioni », jamais « votre compte va être supprimé ».

- `status` : `en_attente` | `traitee` | `refusee`.
- `refusal_reason` : texte libre écrit par l'exploitant **et destiné à la personne** (RGPD art. 12.4) — **c'est le seul texte libre d'exploitant du projet que le sujet lit** (contrairement à `kyc_reason`, `cancel_reason`, `Dispute.reason`). L'afficher intégralement sur un refus. Vide sinon.
- Après un refus, une NOUVELLE demande est possible (la contrainte d'unicité ne porte que sur les demandes ouvertes) : proposer le bouton à nouveau, sans le présenter comme un recours formel.
- Un compte `traitee` est désactivé : il ne peut plus se connecter du tout (ni OTP, ni mot de passe). Il n'y a **pas** d'écran « après effacement » à construire.

**`GET /auth/me/export/`** — JSON de ce que l'appelant voit DÉJÀ dans son espace, casquette par casquette. **Aucune donnée nouvelle n'est révélée** : l'export rejoue exactement les requêtes et les serializers des écrans. Racine :

```json
{
  "generated_at": "2026-08-14T18:30:00+03:00",
  "account": {"id", "username", "first_name", "last_name", "email", "phone",
              "avatar", "phone_verified_at", "date_joined", "last_login",
              "erasure_requests": [...]},
  "patient": null,
  "guardian": null,
  "center_staff": null,
  "platform_staff": null
}
```

- Une casquette non portée vaut **`null`** (≠ objet vide) : « je n'ai pas d'espace tuteur » et « mon espace tuteur est vide » sont deux vérités différentes.
- `patient` (si profil revendiqué) : `{profile, guardian_links, appointments, encounters, prescriptions, record_entries, medical_file, vital_signs, documents, insurances, payment_requests, receipts, cash_receipts}` — items **identiques** aux endpoints `/patients/me/*` correspondants. `documents` = **métadonnées seules**, jamais d'URL ni d'octets (contrat ADR 0016 §5 inchangé) ; documents archivés exclus, comme dans la liste patient.
- `guardian` (si profil tuteur) : `{profile, links, proteges, invitations, payment_requests, receipts}` — miroirs exacts de `/guardian/profile/`, `/guardian/links/`, `/guardian/proteges/`, `/guardian/invitations/`, `/guardian/payment-requests/`, `/guardian/receipts/`. **Jamais le carnet du protégé**, même avec un consentement `detail_clinique` : aucune lecture clinique tuteur n'existe dans le produit (verrou de sprint ADR 0016), donc aucune ici. Un lien révoqué vide `proteges` et `payment_requests` exactement comme il vide les écrans.
- `center_staff` : `{memberships: [...]}` au format de `/auth/me/` — **les memberships du salarié, pas les données de son centre**.
- `platform_staff` : `{id, role, is_active}`.
- Rendu tel quel dans un fichier téléchargeable côté client (`Blob` + `a.download`) : le backend ne pose pas de `Content-Disposition` ici, c'est un JSON d'API ordinaire.

### `GET /auth/me/` — routeur des 4 espaces

```json
{
  "id": 12, "username": "user-2693390011", "first_name": "", "last_name": "",
  "phone": "+2693390011",
  "avatar": "http://localhost:8000/media/avatars/12/3f2a….jpg",
  "staff_memberships": [
    {"id": 3, "center": {"id": 1, "name": "CHR El-Maarouf", "type": "hopital_public",
                         "island": "ngazidja", "city": "Moroni",
                         "logo": "http://localhost:8000/media/centers/1/logo/9b1c….png"}, "role": "medecin"}
  ],
  "patient_profile": {"id": 7, "first_name": "…", "last_name": "…", "claim_status": "actif"},
  "guardian_profile": {"id": 4, "country_of_residence": "FR", "preferred_currency": "EUR"},
  "platform_staff": {"id": 2, "role": "admin", "is_active": true}
}
```

- `avatar` et `center.logo` : **URL absolue ou `null`** — brancher directement dans `<img src>`. Le logo alimente la sidebar (et l'affichage écran des factures/reçus ; l'impression PDF viendra avec le chantier PDF).

- **Espace centre** : `staff_memberships` non vide (memberships ACTIFS seulement). Rôles : `directeur, medecin, infirmier, sage_femme, secretaire, caissier, pharmacien`. Multi-centres possible → sélecteur ; `center.id` alimente tous les `/centers/{center_pk}/…`.
- **Espace patient** : `patient_profile !== null` (toujours `claim_status: "actif"` quand présent). `null` → proposer `POST /patients/me/` (porte B).
- **Espace tuteur** : `guardian_profile !== null`. `null` → proposer `POST /guardian/profile/`.
- **Espace plateforme (S4)** : `platform_staff !== null` (seule une ligne ACTIVE remonte — un exploitant désactivé reçoit `null`, exactement comme quelqu'un qui ne l'a jamais été). `role` : `support` (lecture) | `admin` (écriture). **Ne JAMAIS déduire cet espace de quoi que ce soit d'autre** : `is_staff`/`is_superuser` n'existent pas dans le payload et ne donnent aucun droit d'API. `CenterContext` n'est jamais monté pour cet espace (l'exploitant n'est pas un tenant).
- Casquettes **cumulables** ; aucun `role` global.

## Espace patient (`IsPatientSelf` : 403 `"Réservé au patient titulaire d'un profil revendiqué."` sinon)

### Profil
- `GET|PATCH|POST /patients/me/` — champs `[id, first_name, last_name, birth_date, sex("f"|"m"|""), phone, city, address, phone_alt, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, claim_status, created_at]` (read-only : id, claim_status, created_at). POST = création porte B (201). **S3** : les 6 champs d'identité élargie sont tous optionnels ; `phone_alt` et `emergency_contact_phone` sont normalisés E.164 (téléphone invalide → 400).
- `GET /patients/me/insurances/` — mes assurances/mutuelles, tous centres, paginé. Item : `{id, insurer_name, member_number, valid_until(date|null), notes, is_active, created_at}` — lecture seule côté patient (la saisie est au guichet, donnée de facturation).
- `GET /patients/me/medical-file/` — ma fiche médicale (transversale) : `{blood_group("A+"…"O-"|""), notes, updated_at(null si jamais écrite)}` — forme vide constante avant la première écriture clinique. Lecture seule (l'écriture est un geste clinique).
- `GET /patients/me/vital-signs/?encounter=<id>` — mes signes vitaux, tous centres, paginé, tri `-measured_at`. Item : `{id, encounter, measured_at, systolic_bp, diastolic_bp, heart_rate, spo2, temperature_c, respiratory_rate, weight_kg, height_cm, created_at}` (mesures nulles si non prises ; **pas de `measured_by`** — les internes staff ne traversent pas). `?encounter=` invalide → 400 par champ ; consultation d'autrui → liste vide.
- `GET /patients/me/documents/` — mes documents du carnet (photos de résultats/comptes rendus), tous centres, **archivés exclus**, paginé. Item : `{id, center, center_name, doc_type(resultat_biologie|imagerie|compte_rendu|autre), title, source_encounter(null?), created_at}` — **jamais d'URL de fichier** : le téléchargement passe par `GET /patients/me/documents/{id}/download/` (réponse binaire `Content-Disposition: attachment`, nom neutre `document-<id>.<ext>` ; document archivé ou d'autrui → 404). Ne JAMAIS construire d'`<img src>` vers /media/ pour un document.

### Tutelle — cœur éthique
- `GET /patients/me/guardians/` — historique complet, tri `-created_at`. Item :
  `{id, guardian_name, relationship, status, initiated_by, accepted_at, revoked_at, scopes}`
- `status` : `invitation_envoyee` (attend le tuteur) · **`attente_confirmation_titulaire`** (attend MOI, scopes=[]) · `actif` · `revoque` (FINAL).
- `relationship` : `parent, enfant, conjoint, frere_soeur, famille_elargie, ami, autre`. `initiated_by` : `tuteur|patient|centre`.
- `scopes` : `[]` | `["paiements"]` | `["detail_clinique","paiements"]`.
- `POST .../guardians/invite/` `{"phone","relationship"}` → 201.
- `POST .../guardians/{link_pk}/confirm/` (sans corps) → 200, lien `actif`. **La porte de confirmation du titulaire.**
- `POST .../guardians/{link_pk}/decline/` (sans corps) → 200, lien `revoque` (définitif).
- `POST .../guardians/{link_pk}/revoke/` → 200.
- `POST|DELETE .../guardians/{link_pk}/consents/clinical/` (sans corps) → 201/200, renvoie le lien avec `scopes` à jour. (Le scope `detail_clinique` n'ouvre encore aucun endpoint tuteur — phase A.)

### Rendez-vous (S2)
- `GET /patients/me/appointments/` — mes RDV, **transversal tous centres**, paginé, tri `scheduled_at` décroissant. Item :
  `{id, center{id,name}, scheduled_at, duration_minutes, status(prevu|arrive|honore|manque|annule), practitioner_display_name(string|null)}`
- **PAS de `reason`** dans ce payload (note opérationnelle de guichet, staff seulement — ne pas prévoir d'emplacement). `practitioner_display_name` : nom complet ou `null` (RDV « avec le centre », ou praticien sans nom renseigné).
- Filtre `?upcoming=true` — seulement les RDV encore `prevu` ET dans le futur (le widget « mes prochains rendez-vous ») ; `?upcoming=false` = tout ; autre valeur → 400 `{"upcoming": [...]}`.
- `POST /patients/me/appointments/{pk}/cancel/` (sans corps) → 200 item — **seulement si `prevu`** : RDV `arrive`/`honore`/`manque`/`annule` → 400 `["Seul un rendez-vous encore prévu peut être annulé."]` ; RDV d'autrui → 404. La PRISE de RDV par le patient n'existe pas (hors périmètre S2 — pas d'écran de booking).

### Carnet
- `GET /patients/me/encounters/` → `{id, center, center_name, occurred_at, reason, diagnosis, status(en_cours|terminee|annulee), acts[{id,label_snapshot,generic_category,price_kmf_snapshot,tariff_item}], created_at}`
- `GET /patients/me/prescriptions/` → `{id, encounter, status(emise|delivree), items[{id,medication,dosage}], created_at}`
- `GET /patients/me/record-entries/` → `{id, entry_type(antecedent|allergie|traitement_en_cours|vaccination|chirurgie|antecedent_familial|observation), content, source_encounter, created_at}` — **S3** : 3 types de plus, même contrat texte libre.
- **`GET /patients/me/stays/` (S6, ADR 0019)** — mes hospitalisations, **transversal tous centres**, paginé, tri `-admitted_at`. Item : `{id, center, center_name, encounter, admitted_at, discharged_at(ISO|null), status(en_cours|sortie|annule)}`.
  - **Payload volontairement petit** : **pas de lit, pas de priorité, pas de motif d'annulation, pas de motif d'admission ni de diagnostic**. Un numéro de lit et une priorité de triage sont des données de gestion de service, écrites par le personnel pour le personnel — ne pas prévoir d'emplacement. L'histoire clinique de l'épisode se lit **entièrement** dans `GET /patients/me/encounters/` : la clé `encounter` fait le lien (motif, diagnostic, actes), et `GET /patients/me/vital-signs/?encounter=<id>` rend la feuille de surveillance.
  - Vocabulaire d'écran attendu (littératie faible) : `en_cours` → « Vous êtes hospitalisé(e) », `sortie` → « Séjour terminé », `annule` → « Séjour annulé » (jamais en rouge : c'est presque toujours une correction de saisie du centre, pas un échec du patient).

### Argent côté patient
- `GET /patients/me/payment-requests/` (+`/{pk}/`) → `{id, center_name, total_kmf, status, lines[{id,label,generic_category,amount_kmf}], shared_with_links[ids], paid_at, patient_acknowledged_at, created_at}` — `paid_at` : ISO-8601 nullable, posé par le webhook d'encaissement (« payée par un proche le … »).
- `POST .../{pk}/share/` `{"guardian_link": <id>}` → 201 — **S1** : lien qui n'est pas au patient → **400 explicite** `"Ce lien de tutelle n'est pas l'un des vôtres : partage refusé."` (plus 404 — ref de corps).
- `POST .../{pk}/acknowledge/` (sans corps) → 200 — possible seulement après paiement.
- `POST .../{pk}/dispute/` `{"reason"}` → 201, statut `litige`.
- `GET /patients/me/receipts/` → reçus diaspora (shape ci-dessous).
- `GET /patients/me/cash-receipts/` → mes reçus guichet (KMF pur, tous centres) : `{id, receipt_number("G-000001"), center_name, amount_kmf, method(especes|mobile_money), reversed(bool — true si l'encaissement a été contre-passé), issued_at}`. Le tuteur ne voit JAMAIS ces reçus (sa portée `paiements` = demandes qui lui sont partagées uniquement).

## Espace tuteur

- `GET|POST|PATCH /guardian/profile/` — `{id, country_of_residence(ISO-2, déf. FR), preferred_currency(EUR|KMF, déf. EUR), created_at}`. GET/PATCH sans profil → 404. **S2 — PATCH** : `country_of_residence` et `preferred_currency` modifiables (la devise est un préférence d'AFFICHAGE — les devis restent structurellement EUR→KMF) ; pays normalisé en majuscules, format ISO-2 sinon 400 par champ. Identité (prénom/nom) → `PATCH /auth/me/`.
- **S2 — `GET /guardian/links/`** — l'HISTORIQUE de mes liens, **tous statuts**, paginé, tri `-created_at`. Item : `{id, protege_display_name, status(invitation_envoyee|attente_confirmation_titulaire|actif|revoque), created_at, revoked_at(nullable)}` — rien d'autre (ni téléphone, ni scopes, ni relationship). **La valeur ajoutée : `attente_confirmation_titulaire`** — le protégé qui « disparaissait » de `/proteges/` pendant la porte de confirmation est ici, l'UI dit « en attente de confirmation de votre proche » (ne PAS présenter comme une erreur ni pousser à relancer). Tuteur sans lien → 200 vide. Les listes `proteges`/`invitations` sont inchangées.
- `GET /guardian/proteges/` — liens `actif` avec scope `paiements` UNIQUEMENT. Item : `{id, patient{id,first_name,last_name,claim_status}, relationship, status, initiated_by, accepted_at}`. Patient = identité administrative STRICTE.
- `POST /guardian/proteges/` `{first_name*, last_name*, relationship*, birth_date?, sex?, phone?, city?}` → 201, lien direct `actif` (porte A).
- `GET /guardian/invitations/` (statut `invitation_envoyee`) ; `POST /guardian/invitations/{link_pk}/accept/` → 200 `actif` ; `POST /guardian/invitations/{link_pk}/decline/` (sans corps) → 200 `revoque` (**définitif** — une nouvelle relation exige une nouvelle invitation). 400 si plus en attente ; 404 si pas mon invitation.
- `POST /guardian/links/{link_pk}/revoke/` → 200.

### Demandes de paiement (double dérivation : lien actif + scope + partage explicite, sinon 404)
- **S1 — porte de portée** : un tuteur **sans aucun lien actif** (nouveau profil, ou dernier lien révoqué) reçoit **403** `["Aucun lien de tutelle actif ne vous ouvre cette information."]` sur `/guardian/payment-requests/*` et `/guardian/receipts/` — traiter ce 403 comme l'état « aucun protégé » (pas comme une erreur). Les listes de l'espace (`/guardian/proteges/`, `/guardian/invitations/`) restent des 200 vides.
- `GET /guardian/payment-requests/` (+`/{pk}/`) → `{id, patient, center_name, total_kmf, status, paid_at, lines[{generic_category, amount_kmf}], created_at}` — **jamais de `label`** (secret médical, ADR 0005). Payable si `status === "envoyee"` ; `paid_at` : ISO-8601 nullable, posé par le webhook d'encaissement.
- `GET .../{pk}/quote/` (**GET**) → devis FX :
  `{amount_kmf, currency_received:"KMF", exchange_rate, amount_eur, fees_eur, total_eur, currency_paid:"EUR"}`
  (frais 2,50 % en sus ; le centre reçoit 100 % du KMF). 400 si non payable.
  **Le devis porte le SOLDE RESTANT de la facture** (ADR 0015 — des tranches guichet ont pu la régler en partie) : `amount_kmf` peut être < `total_kmf` de la demande — c'est le devis qui fait foi pour « ce que je paie », jamais `total_kmf`. Facture déjà réglée au guichet → 400 `"Cette facture est déjà entièrement réglée : plus rien à payer."` (la demande peut rester `envoyee` — afficher ce 400 honnêtement). **S1** : facture annulée par le centre → 400 `"Cette facture a été annulée par le centre : elle n'est plus payable."` sur `quote/` et `pay/` (même règle d'affichage honnête — la demande peut rester `envoyee`).
- `POST .../{pk}/pay/` (**corps vide** — aucun montant client) → 201 intent :
  `{id, payment_request, psp(fake|stripe), psp_reference, amount_eur, exchange_rate, amount_kmf, status(cree|en_cours|reussi|echoue|annule), created_at}` — retour immédiat `"en_cours"` ; en PSP fake, ni redirect ni client_secret.
  Le passage à `payee` vient du **webhook PSP** (serveur→serveur) → le frontend **re-poll** `GET .../{pk}/` jusqu'à `status: "payee"`. Aucun endpoint de lecture d'intent par id.
  400 notables : demande non ouverte, non partagée, KYC centre inactif.
- `POST .../{pk}/dispute/` `{"reason"}` → 201, statut `litige`. Pas d'endpoint de lecture des litiges côté tuteur.
- `GET /guardian/receipts/` → `{id, payment_request, center, center_name, receipt_number, amount_eur_paid, fees_eur, amount_kmf_received, exchange_rate, issued_at}` — double devise, numérotation par centre, aucune info de soin.

### Machine à états `PaymentRequest`
`brouillon → envoyee → payee → soin_confirme → cloturee` ; `envoyee|payee → litige → (resolve) → statut précédent`. `payee` uniquement via webhook. Transition illégale → 400 `["Transition refusée : …"]`.

## Espace centre (`/centers/{center_pk}/…` ; centre étranger → 404)

Rôles requis notables : BILLING = `directeur, secretaire, caissier` ; cliniques = `medecin, infirmier, sage_femme` (+ `pharmacien` lecture ordonnances) ; directeur seul : staff, litiges resolve, édition centre.

- `GET /centers/` — mes centres. `GET|PATCH /centers/{pk}/` — `{id, name, type(hopital_public|clinique_privee|centre_sante|cabinet|pharmacie), island(ngazidja|ndzuwani|mwali), city, address, phone, email, kyc_status(en_attente|actif|suspendu, read-only), kyc_reason(texte|null, read-only), kyc_updated_at(ISO|null, read-only), logo(url absolue|null, read-only), created_at}`.
  - **KYC (S4, ADR 0017)** : `kyc_status` n'est **jamais** modifiable par le tenant (valeur soumise silencieusement ignorée) — seule la plateforme Chioni le change. `kyc_reason` = motif de la dernière décision, **rendu au DIRECTEUR du centre concerné SEULEMENT** (`null` pour tout autre rôle, même classe de texte libre que `cancel_reason`) : afficher un bandeau « Que faire ? » sur le seul écran directeur.
  - **Effet de `suspendu` — RAIL DIASPORA SEUL** : soins, carnet, documents, RDV, patients, personnel, tarifs, **facturation et caisse (espèces / mobile money, reçus « G- »)** continuent normalement. Ce qui répond 400 : créer une demande de paiement, la partager, l'envoyer, ouvrir un paiement tuteur. Message rendu tel quel (deux textes DISTINCTS selon `en_attente` / `suspendu`, tous deux terminés par « La caisse du centre reste ouverte… ») — l'afficher intégralement, ne pas le résumer par « erreur ». Une demande DÉJÀ payée va à son terme : `confirm-care`, `close/` et le reçu fonctionnent sur un centre suspendu.
- **Pièces justificatives du KYC (S4 — DIRECTEUR SEUL ; les autres rôles → 403)** : `GET|POST /centers/{c}/kyc-documents/` (POST **multipart** `{file, doc_type(registre_commerce|licence_sante|piece_identite_directeur|autre)}`, throttle `uploads` 20/h) → item `{id, center, doc_type, uploaded_by, archived_at(null|date), created_at}` — **jamais d'URL de fichier** (stockage privé, ADR 0016 §5) : lecture des octets UNIQUEMENT via `GET .../kyc-documents/{id}/download/` (binaire, `Content-Disposition: attachment; filename="kyc-<id>.<ext>"`, nosniff). Upload : mêmes règles que logo/avatar (JPEG/PNG/WebP **réels**, 2 Mo, EXIF strippé) — **le PDF est refusé** (le centre photographie son registre). `POST .../kyc-documents/{id}/archive/` → 200 (correction sans destruction, définitif ; déjà archivé → 400). Pièce d'un autre centre → 404.
- **Logo du centre** (directeur seul) : `POST /centers/{pk}/logo/` — **multipart** `file` → 200 `{"logo": "<url absolue>"}` ; `DELETE` → 200 `{"logo": null}` (400 si aucun logo). Mêmes règles d'upload que l'avatar (JPEG/PNG/WebP réels, 2 Mo, 2048² max, EXIF strippé) ; remplacement/suppression effacent physiquement l'ancien fichier. Jamais via le PATCH JSON du centre.
- **Patients** : `GET(?q=)|POST /centers/{c}/patients/` ; item `{id, first_name, last_name, birth_date, sex, phone, city, address, phone_alt, national_id, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, claim_status(non_revendique|invite|actif), created_at}` — **S3** : identité administrative élargie (6 champs optionnels ; téléphones normalisés E.164, invalide → 400). Création porte C : + `guardian_phone?`, `guardian_relationship?` (write-only → lien `invitation_envoyee`). PATCH d'un profil revendiqué → 400 (identité gérée par le patient — les nouveaux champs suivent la même règle R-API-2). Fusion : `POST .../patients/merge/` `{"source_id","target_id"}` — **S1 : rôles BILLING seuls** (la fusion déplace des liens de tutelle ; soignants/pharmacien → 403) ; id hors périmètre du centre → **400 explicite** `"Ce patient n'est pas connu de ce centre : fusion refusée."` (plus 404 — refs de corps). **La fusion ré-ancre aussi (S3)** : documents, assurances, fiche médicale (reprise seulement si la cible n'en a pas), signes vitaux (via leurs consultations).
- **Détection de doublons au guichet (S3)** : `GET /centers/{c}/patients/similar/?phone=&last_name=&first_name=&birth_date=` (tout staff) → liste paginée au format patient du registre. Règle : même téléphone E.164 (`phone` OU `phone_alt`), OU nom approchant (`last_name` icontains, `first_name` affine) + même `birth_date`. **Non bloquant** : informer le guichet, qui décide (créer quand même / ouvrir la fiche / fusionner) — à appeler avant la création porte C. Aucun critère utilisable → 400 ; téléphone ou date invalide → 400 par champ.
- **Assurances/mutuelles d'un patient (S3)** : `GET|POST /centers/{c}/patients/{pk}/insurances/` + `GET|PATCH .../insurances/{id}/` — lecture **tout staff**, écriture **rôles BILLING** (donnée de facturation ; soignants/pharmacien → 403 en écriture). Item : `{id, insurer_name, member_number, valid_until, notes, is_active, created_at}` ; `insurer_name` et `member_number` requis. **Transversal** (ADR 0002) : tout centre du périmètre du patient voit les mêmes lignes, qui que soit le centre qui les a saisies. Plusieurs lignes possibles (mutuelle + assurance) ; pas de tiers payant en S3 (aucune interaction avec la facturation).
- **Fiche médicale d'un patient (S3 — rôles cliniques SEULS, lecture ET écriture)** : `GET|PATCH /centers/{c}/patients/{pk}/medical-file/` → `{blood_group(""|A+|A-|B+|B-|AB+|AB-|O+|O-), notes, updated_at}` — forme vide constante avant la première écriture (`updated_at: null`), créée au premier PATCH. Secrétaire/caissier/directeur/pharmacien → **403** (le groupe sanguin est une donnée de santé — resegmentation actée ADR 0016, jamais dans la fenêtre administrative). Groupe invalide → 400.
- **Documents du carnet (S3 — rôles cliniques du centre producteur)** : `GET|POST /centers/{c}/patients/{pk}/documents/` (POST **multipart** `{file, doc_type(resultat_biologie|imagerie|compte_rendu|autre), title, source_encounter?}`, throttle `uploads` 20/h) → item `{id, patient, doc_type, title, source_encounter, archived_at(null|date), created_at}` — **jamais d'URL de fichier** (diffusion privée, ADR 0016) : lecture des octets UNIQUEMENT via `GET .../documents/{id}/download/` (binaire, `Content-Disposition: attachment; filename="document-<id>.<ext>"`, nosniff). Upload : mêmes règles que logo/avatar (JPEG/PNG/WebP réels, 2 Mo, EXIF strippé) — **le PDF est refusé** (différé, la réalité est la photo de document). `source_encounter` hors centre → 400 ; d'un autre patient → 400. Bornage centre producteur : un document produit ailleurs est invisible ici (liste ET download → 404). Archivage : `POST .../documents/{id}/archive/` → 200 (`archived_at` rempli) — correction sans destruction : le staff du centre producteur garde la ligne (et le download), **le patient ne le voit plus** ; déjà archivé → 400 ; définitif.
- **Signes vitaux d'une consultation (S3 — rôles cliniques)** : `GET|POST /centers/{c}/encounters/{e}/vital-signs/` (tableau nu comme ordonnances/carnet). POST : `{systolic_bp?, diastolic_bp?, heart_rate?, spo2?, temperature_c?, respiratory_rate?, weight_kg?, height_cm?, measured_at?}` — **au moins une mesure** ; bornes de plausibilité strictes (valeur impossible → 400 par champ, jamais stockée : PA 40–300/20–200, FC 20–300, SpO₂ 40–100, T° 30,0–45,0, FR 4–90, poids 0,4–400 kg, taille 20–260 cm ; diastolique ≥ systolique → 400) ; consultation `terminee` → 400. `measured_by` = TOUJOURS la casquette clinique de l'appelant (jamais envoyé par le client). Item : + `{id, encounter, measured_at, measured_by, measured_by_name, created_at}`. Plusieurs relevés par consultation possibles. Staff admin/pharmacien → 403.
- **Liens de tutelle d'un patient (routage du partage au guichet)** : `GET /centers/{c}/patients/{pk}/guardian-links/` (rôles BILLING ; patient hors périmètre → 404) → liste paginée `{id, guardian_name, relationship}` — liens **`actif` uniquement**, minimum administratif : jamais de téléphone (tuteur sans nom → nom d'affichage masqué `"+336••••••78"`), jamais de scopes ni d'historique. `id` alimente le `guardian_link` de `POST .../payment-requests/{pk}/share/` (cas Mariama : le patient désigne son tuteur au guichet).
- **S2 — Consentement clinique recueilli au guichet (ADR 0004 addendum)** : `POST /centers/{c}/patients/{pk}/consents/clinical/` (rôles BILLING) `{"guardian_link": <id>, "collected_via": "papier"|"oral"}` → 201 `{guardian_link, scope:"detail_clinique", collected_via, granted_at, revoked_at:null}` ; `DELETE` (retrait) `{"guardian_link"}` → 200 (même shape, `revoked_at` rempli). **Patients NON revendiqués UNIQUEMENT** — patient revendiqué → 400 `["Ce patient gère lui-même ses consentements depuis son espace."]` (afficher tel quel : le patient passe par SON espace) ; patient hors périmètre → 404 ; `guardian_link` qui n'est pas un lien `actif` de CE patient (étranger, révoqué, en attente, inexistant) → 400 unique `["Ce lien de tutelle n'est pas un lien actif de ce patient."]` ; déjà accordé → 400 ; retrait sans consentement actif → 400. Le `guardian_link` vient de `GET .../guardian-links/` ci-dessus. À la revendication du profil par le patient, ce consentement est automatiquement révoqué (porte de confirmation du titulaire) — ne pas le présenter comme permanent.
- **Annuaire praticiens (S1 — le sélecteur RDV/consultation)** : `GET /centers/{c}/practitioners/` (tout staff actif) → **tableau nu NON paginé** `[{id, display_name, role(medecin|infirmier|sage_femme), avatar(url|null)}]` — memberships **actifs** de rôles cliniques uniquement, `id` = id de membership à brancher directement dans `practitioner` des RDV/consultations. Un praticien recruté la veille y figure (ne plus se rabattre sur `stats/activity`). Jamais de téléphone ni d'état d'activation (ça reste `GET /staff/`, directeur).
- **Rendez-vous & file du jour** (tout staff actif — la file sert la secrétaire ET le médecin) :
  - `GET /centers/{c}/appointments/` — **la file du jour** : `?date=YYYY-MM-DD` (défaut **aujourd'hui**, bornes en heure locale Comores), `?practitioner=<id>`, `?status=`. Tri `scheduled_at` croissant, paginé. Item : `{id, patient, patient_name, practitioner(nullable), practitioner_name(nullable), scheduled_at, duration_minutes, end_at, reason, status, reminder_sent_at(nullable), created_at}`. Filtre invalide → 400 par champ.
  - **Plage (S1 — la grille calendrier)** : `?from=YYYY-MM-DD&to=YYYY-MM-DD` — jours locaux Comores **inclusifs**, les deux bornes exigées ensemble, **max 62 jours**, **exclusif de `?date=`** (mélange → 400 `{"date": [...]}`). Mêmes refus 400 par champ que les stats (`from` > `to`, période trop longue, date malformée/impossible/hors calendrier). Paginé, même item.
  - `status` : `prevu → arrive → honore` ; `prevu → manque` ; `prevu|arrive → annule` (`honore`/`manque`/`annule` finaux).
  - `reason` = note **opérationnelle** de guichet (visible de tout le staff) — jamais un contenu clinique.
  - `POST /centers/{c}/appointments/` : `{patient*, scheduled_at*, duration_minutes?(défaut 20, 5–480), practitioner?(nullable — RDV « avec le centre »), reason?}` → 201. Réponse : item + **`overlaps: [ids]`** (chevauchements même praticien, **avertissement non bloquant** — le guichet décide). Passé (tolérance 5 min) → 400 ; patient hors périmètre → 400 `"Ce patient n'est pas connu de ce centre."` ; praticien d'un autre centre → 400 `"Ce praticien n'appartient pas à ce centre."`.
  - `GET|PATCH /centers/{c}/appointments/{pk}/` — PATCH = déplacement/édition (**seulement si `prevu`**, sinon 400) : `{scheduled_at?, duration_minutes?, practitioner?(null = détacher), reason?}` → 200 + `overlaps`. Un déplacement ré-arme le rappel J-1 (`reminder_sent_at` → null).
  - Actions (POST sans corps, → 200 item) : `.../check-in/` (→ `arrive`), `.../cancel/`, `.../no-show/` (→ `manque`), `.../honor/` (→ `honore`, exige `arrive`). Transition illégale → 400 `"Transition impossible : …"`.
  - Rappel J-1 automatique : SMS au patient la veille à 18h (contenu minimal : heure seule — ni motif, ni praticien, ni nom de centre).
- **Consultations** : `GET|POST /centers/{c}/encounters/` (+`/{pk}/`). **Filtres S1** : `?patient=<id>&date=YYYY-MM-DD&practitioner=<id>` (combinables ; `date` = jour local Comores de `occurred_at`) — valeur invalide → 400 par champ, id étranger → liste vide. POST (cliniques) : `{patient*, reason*, diagnosis?, occurred_at?, tariff_items?[ids], appointment?}` — **S1** : `patient`/`tariff_items`/`appointment` hors périmètre → **400 explicite** (plus jamais 404 — ce sont des refs de corps) : `"Ce patient n'est pas connu de ce centre."`, `"Un acte ne peut référencer qu'un tarif de la grille de ce centre."`, `"Ce rendez-vous n'appartient pas à ce centre."` ; `appointment` valide passe le RDV à `honore` automatiquement ; RDV d'un autre patient → 400, RDV déjà clos → 400. Lecture selon rôle : clinique → avec `reason`/`diagnosis` ; admin → **sans** (vue exploitation).
  - **Clôture (S1)** : `POST /centers/{c}/encounters/{pk}/close/` (rôles cliniques SEULS — le directeur non-clinicien reçoit 403 ; corps vide) → 200 item clinique avec `status: "terminee"`. Déjà terminée → 400. **Effets** : une consultation terminée refuse toute nouvelle ordonnance/entrée carnet (400 `"Cette consultation est terminée : …"`) ; la facturation reste possible. `annulee` n'est pas atteignable (hors périmètre S1).
- **Ordonnances** : `GET|POST /centers/{c}/encounters/{e}/prescriptions/` (POST : `medecin, sage_femme` — 400 si consultation terminée). **Entrées carnet** : `GET|POST .../record-entries/` (non paginés ; même 400 si terminée).
- **Factures** : `GET|POST /centers/{c}/invoices/` (+`/{pk}/`, `/{pk}/issue/`). **Filtres S1** : `?patient=<id>&status=` (400 par champ si invalide, id étranger → vide). Item : `{id, encounter, patient, total_kmf, paid_kmf, balance_kmf, status(brouillon|emise|payee|annulee), lines[{id,act,label,generic_category,amount_kmf}], cancelled_at(nullable), cancel_reason(""|texte — **rôles BILLING seuls** : le champ est ABSENT du payload pour les autres rôles, même classe de texte libre que le motif de litige), created_at}`. Création : `{"encounter", "act_ids"?}` — **S1** : `encounter` hors périmètre → **400 explicite** (plus 404). `paid_kmf`/`balance_kmf` : dérivés des encaissements non contre-passés (tous moyens, Pont de Confiance compris) — la vue caisse de la facture.
  - **Annulation (S1)** : `POST /centers/{c}/invoices/{pk}/cancel/` `{"reason"*}` (rôles BILLING) → 200 item `status: "annulee"` + `cancel_reason`/`cancelled_at` remplis. 400 explicites : motif manquant, facture réglée (« contre-passez d'abord »), encaissement actif non contre-passé, demande liée `payee`/`soin_confirme`/`cloturee`/`litige`, paiement diaspora en cours (« Attendez quelques minutes »). Une demande `envoyee` ne bloque PAS : elle reste `envoyee` mais son devis/pay répondent 400 « facture annulée » (affichage honnête côté tuteur). Les actes redeviennent facturables (refacturation propre). Aucune SMS n'est émis.
- **Caisse (ADR 0015 — rôles BILLING)** :
  - `POST /centers/{c}/invoices/{pk}/payments/` `{method("especes"|"mobile_money"), amount_kmf(entier ≥ 1 — le KMF ne porte pas de décimales), operator?("huri"|"mvola"|"autre" — requis si mobile money), reference?, idempotency_key?(≤ 64 car.)}` → **201 avec le reçu guichet embarqué**. **Idempotence S1** : envoyer une `idempotency_key` (générer un UUID côté client par tentative d'encaissement) rend le POST rejouable — rejouer la même clé renvoie **200** avec le MÊME encaissement et le MÊME reçu (jamais un double débit sur timeout/re-clic) ; même clé avec d'autres paramètres (facture, montant, méthode) → 400 explicite. Clé unique par centre. Item : `{id, invoice, method, operator, reference, amount_kmf, received_by, payment_intent(null sauf pont_confiance), ledger_transaction, receipt{id, receipt_number("G-000001"), sequence_number, center, center_name, amount_kmf, method, issued_at} | null, reversal | null, created_at}`. **Paiement par tranches** : un encaissement ne dépasse jamais le solde restant ; la facture passe `payee` quand le solde tombe à zéro. 400 explicites : dépassement du solde, facture brouillon/annulée/déjà réglée, `pont_confiance` saisi au guichet (il n'arrive que par le webhook PSP), opérateur manquant/interdit, décimales KMF, **paiement diaspora en cours sur la facture** (garde anti-double-débit miroir — réessayer dans quelques minutes).
  - `GET /centers/{c}/invoices/{pk}/payments/` → les encaissements de la facture (tous moyens ; l'encaissement `pont_confiance` a `receipt: null` — son reçu est le reçu diaspora émis à la clôture).
  - `POST .../payments/{pk}/reverse/` `{"reason"*}` → 201 (item avec `reversal` rempli : `{id, cash_payment, method, amount_kmf, reason, reversed_by, ledger_transaction, created_at}`). **Jamais d'annulation** : contre-passation unique par encaissement (2e → 400), motif obligatoire, `pont_confiance` jamais contre-passable au guichet (→ litige). Effet honnête : facture `payee` → `emise` si le solde redevient > 0.
  - `GET /centers/{c}/cash-journal/?date=YYYY-MM-DD` (défaut aujourd'hui, bornes en heure locale Comores) → `{date, payments[items ci-dessus], reversals[...], totals{especes|mobile_money|pont_confiance|total: {encaisse_kmf, contre_passe_kmf, net_kmf}}}`. Les contre-passations FAITES ce jour apparaissent même si l'encaissement contre-passé date d'un autre jour. Date invalide (malformée ou impossible) → 400 `{"date": [...]}`.
  - Pas de SMS pour un encaissement guichet (le patient est au comptoir, il repart avec son reçu).
- **Pilotage (vague 2b — lecture seule, données réelles pour le dashboard)** :
  - **Fenêtre commune** aux deux endpoints stats : `?from=YYYY-MM-DD&to=YYYY-MM-DD`, jours **locaux Comores inclusifs** (un encaissement à 00h30 ou 23h30 heure locale compte sur SON jour local). Défauts : `to` = aujourd'hui, `from` = `to` − 29 j (30 jours). Max **366 jours**. 400 par champ : date malformée ou impossible (`{"from"|"to": ["Format attendu : AAAA-MM-JJ."]}`), `from` > `to`, période > 366 j, date hors calendrier (`"9999-12-31"`). La série `days` est **complète et zéro-remplie** (une entrée par jour de la fenêtre, même vide) — brancher directement dans un graphique.
  - `GET /centers/{c}/stats/activity/?from=&to=` (**tout staff actif** — l'infirmière voit la file, le médecin son activité) →
    `{from, to, days: [{date, appointments: {prevu, arrive, honore, manque, annule}, encounters, new_patients}], totals: {appointments: {…mêmes clés…, total}, encounters, new_patients, attendance_rate_pct}, encounters_by_practitioner: [{practitioner, practitioner_name, role, encounters}]}`.
    `encounters` = consultations par date de consultation (`occurred_at`) ; `new_patients` = patients créés au guichet de CE centre (porte C, doublons absorbés exclus) ; `attendance_rate_pct` = honorés / (honorés + manqués) en **chaîne pourcentage** (`"66.7"`) ou **`null`** si rien de mesurable (jamais de division par zéro) ; `encounters_by_practitioner` trié par volume décroissant (annuaire interne du centre — id de membership + nom + rôle). Aucune donnée financière dans ce payload.
  - `GET /centers/{c}/stats/finances/?from=&to=` (**rôles BILLING seuls** — le médecin reçoit 403 : le pilotage financier est une vue exploitation, symétrique du cloisonnement clinique) →
    `{from, to, days: [{date, especes_kmf, mobile_money_kmf, pont_confiance_kmf, total_kmf}], totals: {…mêmes clés…}, reversals: {count, total_kmf}, invoiced: {count, total_kmf}, collected_kmf, unpaid: {count, total_kmf}}`. Montants = chaînes décimales KMF (`"0"` quand vide).
    Recettes = encaissements **non contre-passés** (tous rails, Pont de Confiance compris) par jour d'encaissement ; les contre-passations FAITES dans la période sont dans `reversals` (champ dédié, **jamais soustraites en silence** des séries). `invoiced` = factures émises (`emise`/`payee`) créées dans la période vs `collected_kmf` = encaissé de la période — **l'écart est l'information de pilotage n° 1**. `unpaid` = **photo à l'instant T** (pas une série, indépendante de la fenêtre) : factures `emise` à solde > 0.
  - `GET /centers/{c}/invoices/unpaid/?ordering=` (**rôles BILLING**, liste paginée — la matière première des futures relances) → item `{id, patient, patient_name, patient_phone_masked, total_kmf, paid_kmf, balance_kmf, age_days, created_at}`.
    `patient_phone_masked` : masqué comme les guardian-links (`"+336••••••78"`, `""` si aucun téléphone) — le numéro complet reste sur la fiche patient du registre, jamais dans une vue de masse. `age_days` = ancienneté en jours locaux depuis la création de la facture. `ordering` : `-balance` (défaut, plus gros solde d'abord) | `balance` | `-age` (plus anciennes d'abord) | `age` — autre valeur → 400 `{"ordering": [...]}`.
- **Demandes de paiement** : `POST /centers/{c}/invoices/{pk}/payment-requests/` ; `GET /centers/{c}/payment-requests/` (+`/{pk}/`, **filtre S1** `?status=` — 400 si statut inconnu) → `{id, invoice, total_kmf, status, created_by, paid_at, patient_acknowledged_at, shares[{id,guardian_link,shared_at,shared_by}], created_at}` (`paid_at` : ISO-8601 nullable). Actions : `share/`+`unshare/` (`{"guardian_link"}` — **S1** : lien hors périmètre du patient facturé → **400 explicite**, plus 404), `send/`, `confirm-care/` (rôles soins), `close/` → **201 reçu**.
- **Litiges** : `GET /centers/{c}/disputes/` (**S1 : rôles BILLING seuls** — le motif libre ne s'affiche plus à tout staff ; soignants/pharmacien → 403 ; **filtre** `?status=ouvert|resolu`) → `{id, payment_request, opened_by, reason, previous_status, status(ouvert|resolu), resolved_by, resolution_note, resolved_at, created_at}` ; `POST .../{pk}/resolve/` `{"resolution_note"}` (directeur).
- **Personnel** : `GET|POST /centers/{c}/staff/` (directeur) → `{id, user{id,first_name,last_name,phone,avatar(url|null)}, role, is_active, created_at}`. Création : `{phone*, role*, first_name?, last_name?}` (compte ombre si inconnu). `POST .../staff/{pk}/deactivate/`. **S1** : `POST .../staff/{pk}/reactivate/` (directeur, corps vide) → 200 item `is_active: true` — la désactivation n'est plus irréversible ; déjà actif → 400. Jamais de suppression ; dernier directeur indéactivable.
- **Édition d'un membre** (directeur) : `GET|PATCH /centers/{c}/staff/{pk}/` — PATCH `{role?, first_name?, last_name?}` → 200 (item complet). Règles : membership **actif** seulement (sinon 400) ; `role` refuse un rôle déjà détenu dans ce centre et la rétrogradation du **dernier directeur actif** (400 explicites) ; `first_name`/`last_name` modifiables UNIQUEMENT tant que le compte est un compte ombre jamais revendiqué — compte activé (OTP ou mot de passe) → 400 `["Ce compte est activé : seule la personne concernée peut modifier son identité."]`, la personne passe par `PATCH /auth/me/`. Audité (`staff.membership_updated`).
- **Tarifs** : `GET|POST /centers/{c}/tariffs/` (+`/{pk}/` PATCH) → `{id, code, label, generic_category*, price_kmf, is_active, created_at}` (écriture : directeur, caissier).
- `generic_category` : `consultation, analyses_examens, medicaments, hospitalisation, acte_technique, soins_infirmiers, maternite, autre`.

### Hospitalisation (S6, ADR 0019) — `centers/{c}/inpatient/…`

**Doctrine** : le séjour **héberge**, la consultation **soigne**. Chaque séjour est adossé à une consultation pivot (`encounter`) ouverte du premier au dernier jour : actes, ordonnances, carnet, documents et **signes vitaux** s'y rattachent par les routes `encounters/` existantes — il n'y a pas de route de surveillance dédiée, et c'est voulu. **Aucune route `guardian/`** : le verrou clinique tuteur reste fermé (ADR 0016).

_Configuration (chambres et lits)_

- `GET|POST /centers/{c}/inpatient/rooms/` — GET tout staff, **POST directeur**. Item : `{id, name, is_active, bed_count, created_at}`. Non paginé.
- `GET|POST /centers/{c}/inpatient/rooms/{room}/beds/` — GET tout staff, **POST directeur**. Item : `{id, room, room_name, name, is_active, created_at}`. Chambre d'un autre centre → **404** (jamais un 400 qui confirmerait son existence).
- `GET /centers/{c}/inpatient/beds/?free=true` — tout staff, la liste plate. `?free=true` ne garde que les lits **assignables maintenant** (lit actif, chambre active, aucune assignation ouverte) : c'est le sélecteur du formulaire d'admission. Toute autre valeur → 400 par champ.
- `GET /centers/{c}/inpatient/occupancy/` — tout staff, **photo instantanée** (pas une série). Sert à admettre, donc vit ici et **jamais dans `stats/`** (qui est du pilotage, gelable par un impayé).

_Séjours_

- `GET|POST /centers/{c}/inpatient/stays/` — GET tout staff (**serializer par rôle**, ci-dessous), **POST rôles cliniques** (l'admission est un acte médical). L'admission crée sa consultation pivot ; `bed` est **facultatif** — un patient peut être admis sans lit (attente), refuser l'admission faute de lit reviendrait à refuser un patient présent.
- Filtres de la liste : `?status=en_cours|sortie|annule` (valeur inconnue → 400 `{"status": ["Statut inconnu."]}`), `?patient=<id>` (non numérique → 400 par champ ; id étranger → page vide). **Sans `status`, la liste rend les séjours `en_cours` SEULS** — le tableau de service est ce qu'on ouvre. Pour tout voir : `?all=true`. Tri `-admitted_at`. Pas de filtre `?priority=` : le trier côté écran (sur la page affichée) et le dire.
- `GET /centers/{c}/inpatient/stays/{pk}/` — tout staff, serializer par rôle.
- **Rôles cliniques** → `{id, patient, patient_name, encounter, admitted_at, discharged_at, status, priority, bed, attending[{id,name}], reason, diagnosis, billed_days, cancel_reason, created_at}`.
- **Staff administratif** (secrétaire, caissier, directeur non clinicien) → **les mêmes champs SANS `reason`, `diagnosis` ni `cancel_reason`** (R-API-1, patron `EncounterAdminSerializer`). `billed_days` **y est** : c'est la base de facturation, et le caissier ne peut pas facturer ce qu'il ne peut pas compter.
- `status` : `en_cours | sortie | annule` · `priority` : `normale | urgente | critique`.

_Gestes (rôles cliniques, sauf mention)_

- `POST .../stays/{pk}/bed/` `{bed}` — assigner ou **transférer** : libère l'assignation courante et en ouvre une nouvelle. Un lit déjà occupé est refusé **par la base** (contrainte partielle), pas par discipline de service.
- `DELETE .../stays/{pk}/bed/` — **corps vide** : libérer le lit SANS en attribuer un autre. « Le patient attend dans le couloir » est un état que le produit doit savoir dire. Séjour sans lit → 400.
- `GET .../stays/{pk}/bed-assignments/` — l'historique des lits du séjour (append-only : un transfert s'empile, ne se réécrit pas).
- `PUT .../stays/{pk}/attending/` `{attending: [<id de membership>]}` — médecins assignés (plusieurs, réassignables). C'est un **PUT** : l'ensemble envoyé REMPLACE le précédent (« qui suit ce patient » est une liste, pas un champ qu'on pousse). Les ids sont des memberships **cliniques actifs de ce centre** — hors périmètre → 400 explicite.
- `POST .../stays/{pk}/discharge/` — sortie : libère le lit et **clôture la consultation pivot**.
- `POST .../stays/{pk}/cancel/` `{reason*}` — admission saisie par erreur, **motif obligatoire** (visible des seuls rôles cliniques), refusée si des journées sont déjà facturées.
- `POST .../stays/{pk}/bill-days/` `{tariff*, days*, idempotency_key*}` — **rôles BILLING** : pose **un acte par journée** sur la consultation pivot, puis la facturation ordinaire prend le relais. **Jamais automatique** : le staff déclenche, sans quoi une faute de frappe sur une date deviendrait une créance réelle contre un patient. Réponse : **200** avec le **séjour** (serializer de la casquette de l'appelant) — `billed_days` dit ce qui s'est passé.
  - **`idempotency_key` est OBLIGATOIRE** (correctif PO du 15/08/2026, ADR 0019 addendum) — chaîne ≤ 64 caractères générée par le client, **unique par centre**. Absente ou vide → 400 par champ (`{"idempotency_key": ["La clé d'idempotence est requise."]}`). Contrairement à l'encaissement guichet, où elle est facultative, elle ne l'est pas ici.
  - **Cycle de vie de la clé, côté client** (identique à celui de la caisse) : en générer une **au moment d'ouvrir le formulaire**, la **conserver** tant que la requête a échoué (timeout, réseau coupé, 5xx) pour rejouer **le même corps**, et n'en **régénérer** une qu'après un succès. Ne jamais la dériver du contenu du formulaire.
  - **Rejeu à l'identique → 200 avec le même état** : rien n'est écrit une seconde fois. C'est ce qui rend le double-clic et le retry sûrs — sans quoi 2 × N actes partaient en créance réelle sur un patient (`create_invoice` sans `act_ids` facture tous les actes de la consultation).
  - **Même clé, paramètres différents** (autre séjour, autre tarif, autre nombre de journées) → **400 explicite** « Cette clé d'idempotence a déjà servi pour une autre facturation de journées ». C'est un bug client : régénérer une clé, ne pas réessayer en boucle.
  - **Plafond de journées** : on ne facture jamais plus de journées que le séjour n'en a duré, **en cumulé**. Règle : **toute journée civile entamée est facturable, et pas une de plus** (heure des Comores) — `plafond = (date de fin − date d'admission) + 1`, la fin étant `discharged_at` pour un séjour sorti et *maintenant* pour un séjour en cours. Admission et sortie le même jour → **1 journée**. Dépassement → **400** qui énonce le plafond, les dates, les journées déjà facturées et celles demandées : **afficher le message tel quel**. Pour pré-remplir le champ sans jamais dépasser : `plafond − billed_days` (les deux valeurs sont dans le payload du séjour et ses dates).
  - **Le tarif doit être de nature générique `hospitalisation`** (sinon 400) : le compteur `billed_days` est dérivé de cette nature figée. Filtrer le sélecteur de tarif sur `generic_category === "hospitalisation"`.
  - **Jamais gelé** : cette route reste ouverte sur un centre suspendu (abonnement) ou dont le KYC est suspendu — c'est de la caisse locale, pas de l'administratif.
- **Journal d'audit du centre (S4 lot 2 — DIRECTEUR SEUL, ADR 0017 décision 5)** : `GET /centers/{c}/audit-log/?action=&from=&to=` — liste paginée, **plus récent d'abord**, + une clé `journal_starts_at` à la racine (aux côtés de `count/next/previous/results`).
  - **Rôle** : directeur uniquement. Caissier, secrétaire, médecin, infirmier, sage-femme, pharmacien → **403** (ce n'est pas une vue BILLING : le journal agrège les décisions de personnel, l'argent et les litiges). Centre étranger → 404.
  - Item : `{id, created_at, action, actor(id|null), actor_display(nom|null), target_type("app.model"|null), object_id, payload{…}}`. `payload` = **références seules** (ids, codes, montants en chaînes) — jamais un nom, jamais un texte libre, jamais de contenu clinique (contrat ADR 0007).
  - `actor_display` n'est rempli **que si l'acteur est membre de CE centre** (actif ou désactivé — l'historique reste lisible). Un patient, un tuteur, un exploitant Chioni ou une tâche système → `null` : afficher « — » ou l'id, ne jamais deviner un nom.
  - **Liste blanche d'actions** (rien d'autre n'existe dans ce flux) : `staff.membership_created|_updated|_deactivated|_reactivated`, `center.created|updated|kyc_changed`, `kyc_document.uploaded|archived`, `tariff.created|updated`, `room.created`, `bed.created`, `invoice.created|issued|cancelled`, `payment_request.created|sent|shared|unshared|care_confirmed|patient_acknowledged|closed`, `payment_intent.created|failed|cancelled`, `payment.recorded`, `payment.webhook_refused`, `cash_payment.recorded|reversed`, `dispute.opened|resolved`, `patient_profile.merged`.
  - **Jamais** : le clinique (`encounter.*`, `prescription.*`, `health_record_entry.*`, `vital_signs.*`, `patient_document.*`, `patient_medical_file.*`) ni les consentements (`consent.*`) — la segmentation clinique de S3 tient aussi ici. Ne pas construire d'écran « qui a vu quel dossier ». **S6** : les séjours suivent la même règle — `stay.admitted|discharged|cancelled|days_billed`, `bed.assigned`, `bed.released` disent quel patient occupe quel lit et combien de temps ; seules `room.created` / `bed.created` (configuration du parc) entrent dans le journal. **S7** : la CONFIGURATION du travail y entre (`hrm_department.created|updated`, `hrm_job_title.created|updated`, `holiday.created|deleted`) ainsi que `leave.requested` et `leave.decided` (l'exploitation dont le directeur répond, **sans jamais le type du congé** — le payload porte des ids, un nombre de journées et un code de statut). En sont exclues `attendance.recorded` (volumétrie quotidienne **et** surveillance individuelle), `employment.created|updated`, `leave.cancelled` et les deux actions de justificatif : un journal daté « qui a déposé quelle pièce » serait un signal sur la santé d'une personne. **S8** : les quatre actions du parc y entrent (`equipment.created|updated|status_changed|reported`) — configuration d'établissement, même famille qu'un tarif ; `actor_display` y résout le nom du signaleur **pour le directeur seul**, exactement comme le fait le sérialiseur des signalements.
  - `?action=` hors liste blanche (valeur inventée **ou** action clinique volontairement masquée) → **400 identique** `{"action": ["Action inconnue."]}` — pas d'oracle : ne pas proposer les actions cachées dans un sélecteur, se limiter à la liste blanche ci-dessus.
  - `?from=&to=` : **même contrat que les stats** (jours locaux Comores inclusifs, défaut 30 j, max 366 j, 400 par champ sur date malformée/impossible, `from` > `to`, période trop longue).
  - `journal_starts_at` (ISO|`null`) = date de la **première entrée du centre**, y compris une entrée non listée. Le journal ne rétro-remplit rien (table append-only + trigger PostgreSQL) : afficher honnêtement « Le journal de votre centre commence le … » et ne jamais laisser croire que l'historique est complet depuis l'ouverture du centre. `null` = aucune entrée : état vide, pas une erreur.

### Ressources humaines (S7, ADR 0020) — `centers/{c}/hrm/…`

**Doctrine** : c'est le premier module dont l'objet **est un salarié**. Trois règles gouvernent chaque écran, et elles sont appliquées **côté serveur** — l'UI ne fait que ne pas mentir :

1. **Chacun voit les siennes, le directeur voit tout.** Il n'y a **pas de délégué RH** (hors périmètre S7) : caissier, secrétaire, médecin, infirmier, sage-femme, pharmacien reçoivent **403** sur dossiers/présence/congés/stats. Ne pas monter ces écrans hors casquette directeur.
2. **Le planning collectif ne dit jamais le régime.** `absent` et `conge` y sont **fondus** en une seule valeur `absent` — le backend ne renvoie jamais `conge` sur cette route. Ne surtout pas « déduire » le congé en croisant deux appels : l'invariant serait contourné par l'écran.
3. **Aucun motif de congé en texte libre, nulle part.** Types fermés, et un justificatif est un **fichier privé** (jamais un champ texte, jamais un titre). Ne pas ajouter de zone « précisez » : le backend n'a aucun champ pour la recevoir.

_Cloisonnement_ : le dossier RH d'une personne existe **DANS un centre**. Le même humain employé dans deux centres a deux dossiers étanches, et aucune route transversale n'existe (pas de `/staff/me/hr/`) — l'écran est toujours dans le contexte du centre actif.

_Configuration (tout staff lit, **DIRECTEUR écrit**)_

- `GET|POST /centers/{c}/hrm/departments/` — services. Item `{id, name, is_active, created_at}`. `PATCH .../departments/{pk}/` `{name?, is_active?}`. Non paginé.
- `GET|POST /centers/{c}/hrm/job-titles/` — fonctions, même forme, même `PATCH`. **Une fonction n'ouvre AUCUN droit** : ne jamais s'en servir pour afficher/masquer quoi que ce soit — les gardes se font sur le rôle (`CenterContext.roles`), comme partout.
- `GET|POST /centers/{c}/hrm/holidays/?from=&to=` — jours fériés **du centre** (pas une liste nationale). Item `{id, date, name, created_at}`. `DELETE .../holidays/{pk}/` → **204**. Le calendrier appartient au centre : une clinique peut travailler un 14 août.

_Planning collectif (**TOUT membre actif**)_

- `GET /centers/{c}/hrm/schedule/?date=YYYY-MM-DD` (défaut aujourd'hui, jour local Comores ; date malformée ou impossible → 400 `{"date": [...]}`). Non paginé.
- **Fenêtre bornée à ±31 jours autour d'aujourd'hui** (revue guardian S7) — au-delà, 400 `{"date": [...]}`. C'est un **tableau de service**, pas un historique : sans borne, 365 requêtes suffisaient à reconstituer le relevé d'absentéisme nominatif de tout le service. Ne pas construire de sélecteur de mois ni de vue calendrier dessus ; pour l'historique, chacun a `…/hrm/me/attendance/` et le directeur a `…/hrm/attendance/` (366 j).
- Item : **exactement** `{employment, display_name, job_title(string|null), status}` avec `status ∈ "present" | "absent" | "repos" | "ferie" | null`.
- **`"conge"` n'existe pas dans ce payload** et n'y existera jamais. `null` = rien n'a été noté ce jour-là : afficher « non renseigné », **jamais « présent » par défaut**.
- Ton d'écran : « Absent » sans point d'exclamation, sans couleur d'alerte, sans icône de gravité — on ne sait pas pourquoi la personne n'est pas là, et c'est exactement le but.

_Dossiers RH (**DIRECTEUR SEUL**)_

- `GET|POST /centers/{c}/hrm/employments/?running=true|false` — non paginé. Item `{id, user, user_display_name, department, department_name, job_title, job_title_name, hired_at, ended_at, is_running, created_at}`.
- Création `{user*, hired_at*, department?, job_title?}` — `user` est un **id de compte**, à prendre dans `GET /centers/{c}/staff/` (`row.user.id`). **Une personne = UN dossier**, même si elle porte deux casquettes dans le centre (un médecin qui est aussi directeur a deux memberships et **un** dossier). Second POST sur la même personne → 400 « Cette personne a déjà un dossier RH dans ce centre. »
- `GET|PATCH .../employments/{pk}/` — PATCH `{hired_at?, ended_at?, department?, job_title?}`. `user` et `center` ne sont **pas** modifiables (ce serait un autre dossier).
- Références hors périmètre dans le CORPS → **400 explicite** (norme S1) : personne étrangère au personnel, service/fonction d'un autre centre. Le message d'un id étranger et celui d'un id inexistant sont **identiques** (pas d'oracle).

_Feuille de présence (**DIRECTEUR SEUL**)_

- `GET /centers/{c}/hrm/attendance/?from=&to=&employment=` — paginé, `-date`. Fenêtre : jours locaux Comores inclusifs, **30 par défaut, 366 max** (même contrat que le journal d'audit et les stats). Item `{id, employment, employment_display_name, date, status, noted_by, created_at}`.
- `POST /centers/{c}/hrm/attendance/` `{employment*, date*, status*}` — `status ∈ present|absent|conge|repos|ferie`. **C'est un upsert** : re-poster la même (personne, date) **corrige** la ligne — **201** à la création, **200** à la correction, jamais de doublon. Une feuille papier se corrige.
- Refus : journée **dans le futur** (400 « la feuille note ce qui s'est passé »), plus d'un an en arrière, date hors période d'emploi.
- **Ni heure d'arrivée, ni heure de départ, ni position** : le modèle n'a pas ces champs et n'en aura pas sans arbitrage explicite. Ne pas construire de pointeuse.

_Congés — côté **DIRECTEUR**_

- `GET /centers/{c}/hrm/leaves/?status=&employment=` — paginé. Item `{id, employment, employment_display_name, leave_type, start_date, end_date, days, status, decided_by, decided_at, has_document, created_at}`. `GET .../leaves/{pk}/` pour le détail.
- `POST .../leaves/{pk}/approve/` et `POST .../leaves/{pk}/refuse/` — **corps vide**. **Le refus ne demande aucun motif, et il ne faut pas en inventer un** : le produit ne stocke aucun texte libre sur le congé de quelqu'un (ADR 0020, décision 4). Un refus s'explique de vive voix.
- **Chevauchement** : deux congés **approuvés** ne peuvent pas se superposer → 400 « Un congé déjà approuvé couvre une partie de ces dates… ». Deux **demandes** qui se chevauchent sont normales (on tranche à l'approbation) : ne pas les signaler comme une erreur à la saisie.
- **États terminaux** : `approuve`, `refuse`, `annule` sont définitifs. Rejouer → 400 « Transition impossible ». **Annuler un congé DÉJÀ approuvé n'existe pas en S7** (consigné) : ne pas afficher le geste ; la feuille de présence dit ce qui s'est réellement passé.
- `GET .../leaves/{pk}/documents/` + `GET .../leaves/{pk}/documents/{doc}/download/` — le directeur lit les justificatifs des congés qu'il décide.

_Congés et dossier — côté **LA PERSONNE** (`…/hrm/me/`, **jamais gelé**)_

- `GET /centers/{c}/hrm/me/` → `{id, center, center_name, department_name, job_title_name, hired_at, ended_at, is_running}`. **404 `{"detail": "Vous n'avez pas encore de dossier RH dans ce centre."}` est un état NORMAL** (personne n'en a avant que le directeur ne l'ouvre) — état vide honnête, jamais une erreur rouge.
- `GET /centers/{c}/hrm/me/attendance/?from=&to=` — paginé. Item **minimal** `{id, date, status}` avec le statut **réel** (`conge` compris : ce sont ses données). Pas de `noted_by` — savoir qui a coché la case n'apporte rien à la personne.
- `GET|POST /centers/{c}/hrm/me/leaves/` — non paginé. Item `{id, leave_type, start_date, end_date, days, status, decided_at, has_document, created_at}`. Création `{leave_type*, start_date*, end_date*}` — **jamais d'`employment` dans le corps** : c'est celui de l'appelant (un id ouvrirait la porte à une demande au nom d'un collègue ; le champ est ignoré côté serveur).
- `POST .../me/leaves/{pk}/cancel/` — corps vide, **demande EN ATTENTE seulement**.
- `GET|POST .../me/leaves/{pk}/documents/` (multipart `file`, throttle `uploads` 20/h), `GET .../documents/{doc}/download/`, `POST .../documents/{doc}/archive/`.
  - **JPEG/PNG/WebP seulement**, 2 Mo, 2048² max — PDF refusé (différé, arbitrage réversible commun aux ADR 0016/0017). Le pipeline strippe EXIF/GPS et renomme en uuid.
  - **Aucune URL dans le payload** (`{id, leave, archived_at, created_at}`) : télécharger passe par `apiDownload` (blob), **jamais** un `<img src>` ni un lien statique — patron des documents patients (S3).
  - Nom de fichier rendu : `justificatif-{id}.jpg` (neutre, volontairement) ; en-tête `X-Content-Type-Options: nosniff`.
  - **Archivage définitif** : une pièce archivée reste téléchargeable, ne se « désarchive » pas. Deuxième archivage → 400.
  - **Pièce purgée par un effacement RGPD** (revue guardian S7) : la ligne reste (`archived_at` posé, `has_document` repasse à `false`), le téléchargement rend **404** `{"detail": "Ce justificatif n'est plus disponible : son propriétaire a exercé son droit à l'effacement."}`. À afficher tel quel, sans point d'exclamation : ce n'est pas une panne, c'est un droit exercé.

_Statistiques RH (**DIRECTEUR SEUL**) — endpoint dédié_

- `GET /centers/{c}/hrm/stats/attendance/?from=&to=` → `{from, to, days:[{date, present, absent, conge, repos, ferie, total}], totals:{…mêmes clés…, total}, by_employment:[{employment, display_name, present, absent, conge, repos, ferie, total}]}`.
- Série **complète et zéro-remplie** (une entrée par jour de la fenêtre), 30 j par défaut / 366 max. **Ce n'est PAS dans `stats/activity` ni `stats/finances`** — ne pas chercher de données RH dans les payloads de pilotage, il n'y en a pas.

_Gel d'abonnement (ADR 0018 × ADR 0020 décision 7)_

- **Gelé** sur un centre `suspendu`/`resilie` : écrire un service, une fonction, un jour férié, un dossier RH, une journée de présence, **approuver ou refuser** un congé → 400 avec le message habituel, qui dit **ce qui continue** avant ce qui est fermé. Afficher le message tel quel.
- **Jamais gelé** : **toute lecture** (y compris les stats RH et le planning), et **tous les gestes de la personne sur son propre dossier** — demander un congé, le retirer, déposer ou archiver un justificatif. Une personne n'est jamais prise en otage par la facture impayée de son employeur : ne pas griser ces boutons sur un centre gelé.
- `impaye` ne ferme **rien** (bannière + relances seulement).

_Ce que le RH n'expose à personne d'autre_ : un **patient**, un **tuteur** et un **exploitant Chioni** reçoivent **404** sur toutes ces routes (aucun membership → le centre n'existe pas pour eux). Aucune route `guardian/`, `patients/me/` ou `platform/` ne touche le personnel.

### Équipements (S8, ADR 0021) — `centers/{c}/equipment/…`

**Doctrine** : ce que le centre possède, **où**, et **si ça marche**. C'est le plus petit module du produit et le moins sensible — ni patient, ni argent, ni donnée personnelle, **hormis le nom de qui signale une panne**. Deux règles gouvernent chaque écran, appliquées côté serveur :

1. **Tout staff signale, le directeur décide.** Signaler une panne est un **constat** (c'est l'infirmière qui voit que le tensiomètre ne marche plus) ; changer l'état officiel est un **geste de directeur**. Ce sont deux gestes distincts, par deux personnes potentiellement différentes — **un signalement ne change PAS l'état de l'appareil**, et l'UI ne doit surtout pas le laisser croire.
2. **Un équipement ne se supprime pas : il se réforme.** `reforme` est un état **terminal et définitif**. Pas de bouton « supprimer », jamais — le parc raconte son histoire, y compris ce qui en est sorti.

_Le parc (lecture **tout staff actif**, écriture **DIRECTEUR**)_

- `GET /centers/{c}/equipment/?status=&category=` — **non paginé** (le parc tient à l'écran). Item : `{id, name, category, serial_number, location, commissioned_on, status, notes, report_count, last_report_at, created_at, updated_at}`, trié par nom.
  - `status ∈ en_service | en_panne | reforme` · `category ∈ diagnostic | imagerie | bloc_operatoire | laboratoire | mobilier_medical | informatique | autre`.
  - Valeur de filtre inconnue → **400 par champ** (`{"status": ["État inconnu."]}` / `{"category": ["Catégorie inconnue."]}`) : ne proposer que les valeurs ci-dessus dans les sélecteurs.
  - `report_count` / `last_report_at` (ISO|`null`) sont des compteurs de lecture : ils valent `0`/`null` dans la réponse d'une écriture (l'objet n'y est pas annoté) — ne pas s'en servir pour décider d'un rendu juste après un POST, relire la liste.
- `POST /centers/{c}/equipment/` `{name*, category*, serial_number?, location?, commissioned_on?, notes?}` → **201** avec la fiche. **DIRECTEUR** (les autres casquettes → 403).
  - `location` est un **texte libre**, jamais une chambre : tous les centres n'ont pas d'hospitalisation, et un échographe vit au bloc, en salle d'accouchement ou dans un couloir. Ne pas brancher de sélecteur sur `inpatient/rooms/`.
  - `serial_number` est **libre et non unique** : deux appareils identiques sans numéro sont un cas normal. Ne pas valider de format côté écran, ne pas signaler un doublon comme une erreur.
- `GET /centers/{c}/equipment/{pk}/` — tout staff. `PATCH` — **DIRECTEUR**, champs `{name?, category?, serial_number?, location?, commissioned_on?, notes?}`.
  - **`status` n'est PAS modifiable par ce PATCH** (il serait ignoré en silence) : l'état a sa porte, ci-dessous, parce qu'elle seule connaît la machine à états.
- `POST /centers/{c}/equipment/{pk}/status/` `{status*}` → **200** avec la fiche. **DIRECTEUR**.
  - Machine à états : `en_service ⇄ en_panne`, et **les deux → `reforme`**, qui est **terminal**. Toute autre transition (y compris rejouer l'état courant, ou revenir d'une réforme) → **400** « Transition impossible : cet équipement est « … » ». Afficher le message tel quel.
  - Geste **irréversible** côté réforme : le modaliser (confirmation explicite), au même titre qu'une annulation de facture.

_Signalements de panne (**TOUT staff actif**, lecture ET écriture)_

- `GET /centers/{c}/equipment/{pk}/reports/` — **paginé** (20/page), du plus récent au plus ancien.
- `POST /centers/{c}/equipment/{pk}/reports/` `{description*}` → **201**. **Aucun autre champ** : l'équipement voyage dans l'URL et l'auteur est l'appelant (un `reported_by` envoyé dans le corps est ignoré — on ne signale jamais au nom d'un collègue).
- **Append-only** : un signalement ne se corrige pas et ne se supprime pas — **on en poste un second** (« Corrigé : c'était le câble »). Ne construire ni bouton « modifier », ni bouton « supprimer », ni statut « résolu » : un signalement n'a pas de cycle de vie, c'est l'**état de l'équipement** qui dit où on en est.
- Signaler un équipement **réformé** → 400 « Cet équipement est réformé : il n'est plus en service. » (masquer le formulaire dans ce cas).
- **Le payload dépend de la casquette, et c'est LA décision du sprint** :
  - **tout staff actif** → `{id, equipment, description, created_at}` — le constat et sa date, **sans son auteur** (ni nom, ni id) ;
  - **directeur** → les mêmes champs **plus** `reported_by` (id) et `reported_by_display` (nom).
  - Pourquoi : un signalement **ne change rien**, donc l'équipe n'a besoin d'aucun responsable pour agir — seulement de la phrase. Nommer le signaleur devant toute l'équipe refroidirait la prochaine panne (« qui a encore dit que l'appareil est cassé ? »), et `GET /centers/{c}/staff/` est déjà **directeur seul**. **Ne pas afficher « signalé par … » hors casquette directeur**, et ne pas tenter de résoudre l'auteur par un autre appel : il n'est pas dans le payload. Arbitrage **RÉVERSIBLE** (un champ).

_Gel d'abonnement (ADR 0018 × ADR 0021 décision 4)_

- **Rien de ce module n'est gelé, jamais** — ni sur `suspendu`, ni sur `resilie`, ni sur `impaye` : déclarer, corriger, changer l'état et **signaler une panne** passent exactement comme sur un centre à jour. *Signaler une panne doit toujours passer* : un appareil cassé est une information de soin, et le centre gelé est celui qui a le plus besoin qu'elle circule. **Ne griser aucun bouton de cet écran sur un centre gelé.**

_Journal du directeur_ : les quatre actions (`equipment.created|updated|status_changed|reported`) sont dans la liste blanche de `GET /centers/{c}/audit-log/` — c'est de la configuration d'établissement, même famille que `room.created` et `tariff.created`. Les payloads ne portent que des **ids et des codes fermés** : jamais le nom d'un appareil, jamais son emplacement, jamais les notes, **jamais la description d'un signalement**.

_Ce que le module n'expose à personne d'autre_ : un **patient**, un **tuteur** et un **exploitant Chioni** reçoivent **404** sur ces routes (aucun membership → le centre n'existe pas pour eux). Aucune route `guardian/`, `patients/me/` ou `platform/` ne touche le matériel.

_Ce que le backend n'a PAS, et n'aura pas sans arbitrage explicite_ : **aucune valeur financière** (ni prix d'achat, ni amortissement, ni valeur de parc — la comptabilité est le sujet de S10), **aucune maintenance préventive** (ni périodicité, ni prochaine révision), **aucun champ de responsabilité** (« qui l'a cassé ») : un parc sert à réparer, pas à imputer. Ne pas construire d'écran branché dessus.

### Abonnement SaaS du centre (S5 lot 1 — DIRECTEUR SEUL, ADR 0018)

`GET /centers/{c}/subscription/` → `{id, status, status_reason, started_at, current_period_end, status_updated_at, is_frozen, plan{id, code, name, price_kmf, billing_period, included_practitioners, included_staff, is_active}, usage{staff, practitioners, included_staff, included_practitioners, exceeded[], over_quota}}`.

- **Rôle** : directeur uniquement (arbitrage RÉVERSIBLE, symétrique du dossier KYC et du journal d'audit — le contrat commercial est de son ressort). Caissier, secrétaire, médecin, infirmier, sage-femme, pharmacien → **403**. Centre étranger → 404. **Ne pas monter l'écran hors casquette directeur** : il s'afficherait pour recevoir un 403.
- **404 `{"detail": "Ce centre n'a pas encore d'abonnement."}`** = état NORMAL (tous les centres nés avant S5) — état vide honnête, jamais une erreur rouge.
- `status` ∈ `essai` | `actif` | `impaye` | `suspendu` | `resilie` — **axe totalement indépendant de `kyc_status`** : un centre peut être `actif` au KYC et `impaye` à l'abonnement, ou l'inverse. Ne jamais fusionner les deux badges.
- `is_frozen` = `true` pour `suspendu` et `resilie` **seulement**. **`impaye` ne gèle RIEN** : bandeau d'information + relances (lot 2), aucun verrou d'écran. Ton du bandeau impayé : informer et proposer de régulariser, jamais alarmer.
- `status_reason` = motif de la DERNIÈRE décision (texte libre d'un exploitant Chioni), rendu au directeur seul. Vide tant qu'aucune décision n'a été prise. Ne le recopier dans aucun autre écran.
- `usage` est **INDICATIF** : `over_quota: true` s'affiche comme une information commerciale (« vous dépassez votre offre »), **jamais** comme un blocage — aucun formulaire ne doit se désactiver à cause d'un quota. `included_* : null` = illimité. `exceeded` ⊂ `["practitioners", "staff"]`.

**Le gel administratif (ce qui répond 400 quand `is_frozen`)** — le message backend est complet, l'afficher tel quel :

| Ferme (400) | Continue (jamais gelé) |
|---|---|
| `POST/PATCH /centers/{c}/staff/…` (ajout, modification, **réactivation**) | `POST .../staff/{pk}/deactivate/` (révoquer un accès n'est jamais puni) |
| `POST/PATCH /centers/{c}/tariffs/…` | Toute la facturation patient, la caisse, les reçus |
| `GET /centers/{c}/stats/activity/` et `/stats/finances/` | `GET /centers/{c}/cash-journal/`, `/invoices/unpaid/`, toutes les listes |
| | Consultations, carnet, documents, ordonnances, signes vitaux |
| | Rendez-vous, **inscription d'un patient au guichet** |
| | Toute LECTURE, `GET /auth/me/export/`, `GET /centers/{c}/audit-log/` |

> Conséquence frontend : sur un centre gelé, **le dashboard perd ses graphiques** (les deux `stats/*` répondent 400) alors que la file du jour, la caisse et les dossiers fonctionnent. Afficher un bandeau explicatif à la place des cartes, pas une page d'erreur — et ne jamais laisser croire que le produit est en panne.

Le journal du directeur (`?action=`) accepte sept actions de plus : `subscription.created`, `subscription.plan_changed`, `subscription.status_changed`, `subscription_invoice.issued`, `subscription_invoice.cancelled`, `subscription_payment.recorded`, `subscription_payment.reversed`. Le motif d'un gel, d'une annulation ou d'une contre-passation n'y figure jamais (payload `has_reason` seulement) — il se lit sur les écrans ci-dessous. Une ligne `subscription.status_changed` avec `payload.automatic === true` et `actor: null` est un passage **automatique** `actif ⇄ impaye` : la libeller « constaté automatiquement », jamais l'attribuer à quelqu'un.

### Factures d'abonnement du centre (S5 lot 2 — DIRECTEUR SEUL, ADR 0018)

`GET /centers/{c}/subscription/invoices/?status=` (paginé, plus récente d'abord) et `GET /centers/{c}/subscription/invoices/{pk}/` → `{id, number, status, period_start, period_end, amount_kmf, paid_kmf, balance_kmf, due_date, plan_code, plan_label, created_at, cancelled_at, cancel_reason, payments[]}` — **exactement ces champs**.

`payments[]` = `{id, amount_kmf, method, reference, received_at, created_at, reversed, reversal_reason}`. **Lecture seule de bout en bout** : c'est Chioni qui émet, encaisse et corrige — ne construire aucun bouton d'action sur cet écran.

- **Rôle : directeur uniquement**, comme le contrat lui-même. Tout autre staff → **403**, centre ou facture étrangère → **404**. Ne pas monter l'écran hors casquette directeur.
- **Liste vide = 200**, à la différence de `GET /centers/{c}/subscription/` qui répond 404 sans contrat : « pas encore de facture » (période en cours pas terminée) n'est pas « pas de contrat ». Deux états vides, deux phrases.
- `number` = série **« A- » globale Chioni** (`A-000001`) — ne jamais la confondre avec les reçus guichet « G- » ni avec l'id d'une facture patient.
- `status` ∈ `emise` | `payee` | `annulee`. `balance_kmf` est **dérivé** (`amount_kmf` − règlements non contre-passés) : l'afficher comme LE montant restant dû, jamais recalculer côté client.
- **Règlements partiels normaux** : une facture `emise` avec `paid_kmf > 0` est en cours de règlement, pas en défaut. Vocabulaire : « déjà reçu » / « reste à régler ».
- `reversed: true` = règlement annulé par Chioni ; `reversal_reason` explique pourquoi (l'afficher : le fait sans le pourquoi est pire qu'inutile). Vocabulaire patient-friendly : « annulé », jamais « contre-passé ».
- `cancel_reason` est rendu au directeur (contrairement à `Invoice.cancel_reason` d'une facture patient, réservé BILLING) : c'est Chioni qui l'écrit **pour lui**.
- L'identité de l'exploitant Chioni (qui a saisi, qui a contre-passé) n'est **pas** dans le payload : ne pas prévoir de colonne pour.
- `?status=` inconnu → 400 `{"status": ["Statut inconnu."]}`.
- **Jamais gelé** : cet écran reste lisible sur un centre `suspendu` — c'est même par là qu'un directeur gelé comprend ce qu'il doit.
- **Relances SMS** (pour information, aucun réglage côté frontend) : au **directeur seul**, le jour de l'échéance puis J+7 et J+21, puis silence. Le SMS porte le numéro de facture, le **solde restant** et l'échéance — jamais le nom du centre, jamais rien de patient ni de médical.
- **Un retard ne ferme rien** : l'abonnement passe `impaye` (bandeau), la suspension reste une décision humaine motivée. Ne jamais présenter l'impayé comme une coupure imminente automatique.

### Support du centre (S5 lot 3 — TOUT STAFF ACTIF, ADR 0018 décision 5)

`GET|POST /centers/{c}/support/tickets/` (paginé, plus récent d'abord) · `GET /centers/{c}/support/tickets/{pk}/` · `GET|POST .../{pk}/messages/` (**tableau nu**, non paginé) · `GET|POST .../{pk}/attachments/` (**tableau nu**) · `GET .../{pk}/attachments/{id}/download/`.

- **Ouverture : n'importe quel membre ACTIF du personnel.** C'est la secrétaire qui rencontre le bug, pas le directeur — ne jamais gater ce bouton sur un rôle.
- **Lecture : l'AUTEUR du ticket, plus le DIRECTEUR** (tous les tickets de son centre). Le ticket d'un collègue est un **404**, jamais un 403 : ne pas afficher de ligne grisée « ticket d'un collègue ». Réponse : quiconque peut lire.
- **JAMAIS gelé par l'abonnement** (le point qui compte) : un centre `suspendu` ou `resilie` ouvre un ticket, répond et dépose une capture. C'est précisément le moment où il en a besoin (« pourquoi suis-je gelé ? »). Aucun écran de support ne doit se verrouiller sur `is_frozen`.
- POST ticket : `{subject*, category*(bug|question|facturation|autre), priority?(basse|normale|haute|urgente, défaut normale), body?}` → **201 = le ticket AVEC son fil**. `body` devient le premier message : un seul aller-retour.
- Item ticket : `{id, subject, category, status, priority, opened_by, opened_by_display, message_count, attachment_count, last_message_at, closed_at, created_at, updated_at}` ; le DÉTAIL ajoute `messages[]` et `attachments[]` — **exactement ces champs**.
- `messages[]` = `{id, author, author_side("centre"|"chioni"), author_display, body, created_at}`. **`author_display` vaut `null` côté `chioni`** : afficher « Chioni » (l'exploitant n'est jamais nommé), et le nom du collègue côté `centre`.
- `attachments[]` = `{id, uploaded_by, created_at}` — **jamais d'URL de fichier** (stockage privé) : télécharger via `.../attachments/{id}/download/` (binaire, `attachment; filename="piece-<id>.<ext>"`, nosniff), avec `apiDownload` comme pour les documents patients. POST **multipart** `{file}`, throttle `uploads` 20/h, mêmes règles qu'ailleurs (JPEG/PNG/WebP **réels**, 2 Mo, EXIF strippé) — **le PDF est refusé**, une capture d'écran est un PNG.
- `status` ∈ `ouvert` | `en_cours` | `resolu` | `ferme` — **le centre ne le change jamais** (le tri est le geste de Chioni ; il n'existe aucune route tenant pour ça). Un ticket **`ferme` refuse tout nouveau message et toute nouvelle pièce** → 400 `"Ce ticket est fermé : ouvrez-en un nouveau pour un autre sujet…"` : afficher le fil en lecture seule avec un bouton « Ouvrir un nouveau ticket ».
- Un ticket `resolu` accepte encore un message (« ça ne marche toujours pas ») et **ne se rouvre pas tout seul** : ne pas afficher de changement d'état après l'envoi.
- `priority` est déclarée à l'ouverture et **n'est plus modifiable** : pas de sélecteur sur la fiche.
- Filtres : `?status=` et `?category=` (valeur inconnue → 400 par champ). Message vide ou > 5 000 caractères → 400.
- **AVERTISSEMENT OBLIGATOIRE au moment d'écrire** (objet ET message), pas dans une aide repliée : « Ne mettez ni nom de patient ni information médicale dans un ticket : donnez le numéro de dossier ou l'identifiant affiché à l'écran. L'équipe Chioni lit ces messages. » Le backend expose la phrase (`SUPPORT_PRIVACY_NOTICE`) — la reprendre telle quelle. Aucun champ ne relie un ticket à un patient, et c'est voulu : ne jamais ajouter de sélecteur « patient concerné ».

## Espace plateforme — back-office Chioni (`/platform/…`, S4 ADR 0017 + S5 ADR 0018)

**Porte unique : `platform_staff !== null` dans `/auth/me/`.** Anonyme → 401 ; authentifié sans casquette exploitant (y compris un superuser Django) → **403** `"Réservé à l'équipe Chioni."` ; exploitant `support` sur une route d'écriture → **403** `"Cette action est réservée aux administrateurs de la plateforme Chioni."`. Centre inexistant dans l'URL → 404.

> **Invariant produit non négociable** : aucune route `/platform/` ne renvoie de patient — ni nom, ni téléphone, ni date de naissance, ni la moindre donnée clinique. Le périmètre de l'exploitant est le **tenant**. Ne construire aucun écran plateforme qui prétendrait afficher un dossier patient : la donnée n'existe pas dans ces payloads (verrouillé par test de champs négatif).

| Endpoint | Rôle | Notes |
|---|---|---|
| `GET /platform/centers/?kyc_status=&q=` | support+admin | Liste paginée de TOUS les centres. `q` : nom ou ville. `kyc_status` inconnu → 400 `{"kyc_status": […]}`. |
| `GET /platform/centers/similar/?name=&city=&island=` | support+admin | Détection de doublons **non bloquante** avant création (miroir de la porte C patient) : aucune contrainte d'unicité sur le nom — deux « Clinique El-Maarouf » peuvent coexister. Aucun critère (`name` et `city` vides) → 400 ; `island` inconnue → 400 par champ. |
| `POST /platform/centers/` | **admin** | Onboarding : centre **+ premier directeur** dans UNE transaction. Corps `{name*, type*, island*, city*, address?, phone?, email?, director_phone*, director_first_name?, director_last_name?}`. Le centre naît **toujours** `en_attente` (un `kyc_status` envoyé est ignoré). 201 = payload centre + `director{id, user_id, center, role, is_active, created_at}`. Téléphone invalide → 400 **et rien n'est créé** (pas de centre orphelin). |
| `GET /platform/centers/{pk}/` | support+admin | Idem item de liste. |
| `POST /platform/centers/{pk}/directors/` | **admin** | Amorçage de secours (centre sans directeur : accident, départ). `{phone*, first_name?, last_name?}` → 201 membership. Rôle déjà détenu → 400. |
| `POST /platform/centers/{pk}/kyc/` | **admin** | `{status*, reason?}`. Machine à états : `en_attente → actif|suspendu`, `actif → suspendu`, `suspendu → actif`. **`reason` obligatoire pour `suspendu`** → sinon 400 `"Le motif est obligatoire pour suspendre un centre : …"`. Même statut → 400 ; transition impossible → 400 `"Transition KYC refusée : …"`. |
| `GET /platform/centers/{pk}/kyc-documents/` | support+admin | Les pièces déposées par le directeur (archivées comprises, leur état est visible). Même item que côté centre — **jamais d'URL de fichier**. |
| `GET /platform/centers/{pk}/kyc-documents/{id}/download/` | support+admin | Binaire, `attachment; filename="kyc-<id>.<ext>"`, nosniff. |
| `GET /platform/reconciliation/?from=&to=&reason=&center=` | support+admin | **S4 lot 2** — les incidents de paiement PSP (voir ci-dessous). |
| `GET /platform/erasure-requests/?status=` | support+admin | **S4 lot 3** — la file RGPD (voir ci-dessous). `status` inconnu → 400 `{"status": […]}`. |
| `POST /platform/erasure-requests/{pk}/process/` | **admin** | `{decision: "anonymiser"\|"refuser", refusal_reason?}`. Demande inexistante → 404 ; déjà traitée → 400. |
| `GET /platform/plans/?is_active=` | support+admin | **S5 lot 1** — le catalogue d'offres, **non paginé** (tableau nu). `is_active` hors `true`/`false` → 400 par champ. |
| `POST /platform/plans/` | **admin** | `{code*, name*, price_kmf*, billing_period?, included_practitioners?, included_staff?, is_active?}`. Prix en francs ENTIERS → décimales = 400 `"Le franc comorien ne porte pas de décimales."`. Code déjà pris → 400. |
| `GET\|PATCH /platform/plans/{pk}/` | support+admin / **admin** | PATCH partiel. **Jamais rétroactif** : les factures SaaS déjà émises (lot 2) portent leur propre montant figé. Pas de DELETE — retirer une offre = `is_active: false`. |
| `GET /platform/subscriptions/?status=&center=` | support+admin | **S5 lot 1** — les contrats des tenants (paginé). `status` inconnu → 400 par champ ; `center` non numérique → 400 ; `center` inexistant → **page vide**, pas 404. |
| `POST /platform/subscriptions/` | **admin** | `{center*, plan*, status?("essai"\|"actif"), started_at?, current_period_end?}`. Un centre déjà abonné → 400 ; offre retirée → 400 ; `status` gelé à la création → 400 (un gel est une décision, prise ci-dessous, avec son motif). |
| `GET /platform/subscriptions/{pk}/` | support+admin | Idem item de liste. |
| `POST /platform/subscriptions/{pk}/plan/` | **admin** | `{plan*}` — changement d'offre. Même offre → 400 ; offre retirée → 400. |
| `POST /platform/subscriptions/{pk}/status/` | **admin** | `{status*, reason?}`. **Machine à états** : `essai → actif\|impaye\|suspendu\|resilie` · `actif → impaye\|suspendu\|resilie` · `impaye → actif\|suspendu\|resilie` · `suspendu → actif\|impaye\|resilie` · `resilie → actif`. **`reason` OBLIGATOIRE pour `suspendu` et `resilie`** → sinon 400 `"Le motif est obligatoire pour suspendre ou résilier un abonnement : …"`. Même statut → 400 ; transition impossible → 400 `"Transition refusée : …"`. |
| `GET /platform/subscriptions/{pk}/invoices/` | support+admin | **S5 lot 2** — les factures SaaS de CE contrat (paginé, plus récente d'abord). |
| `POST /platform/subscriptions/{pk}/invoices/` | **admin** | **CORPS VIDE** (`{}`) — émet la période due, au montant figé de l'offre. Période pas encore à terme → 400 `"La période en cours n'est pas encore arrivée à terme : …"` ; contrat `essai`/`suspendu`/`resilie` → 400 `"… n'est pas facturé : …"` ; offre à 0 KMF → 400. Réponse **201 = la facture complète**. |
| `GET /platform/subscription-invoices/?status=&center=&overdue=` | support+admin | Le registre transverse (créance de Chioni). `status` inconnu, `center` non numérique, `overdue` ≠ `true\|false` → 400 par champ. `overdue=true` = échéance **strictement** dépassée ET solde > 0 (exactement la règle du drapeau `impaye`). |
| `GET /platform/subscription-invoices/{pk}/` | support+admin | Idem item de liste. |
| `GET /platform/subscription-invoices/{pk}/payments/` | support+admin | Les règlements de la facture. |
| `POST /platform/subscription-invoices/{pk}/payments/` | **admin** | `{amount_kmf*, method*("virement"\|"especes"\|"mobile_money"\|"autre"), reference?, received_at?}`. Partiel admis, **jamais au-delà du solde** → 400 `"… dépasse le solde restant …"` ; décimales KMF → 400 ; `received_at` futur → 400 ; facture `payee`/`annulee` → 400. Réponse **201 = la facture entière** (statut + soldes + historique à jour). |
| `POST /platform/subscription-invoices/{i}/payments/{pk}/reverse/` | **admin** | `{reason*}` — la SEULE correction. Motif vide → 400 `{"reason": ["Le motif est obligatoire."]}` ; déjà contre-passé → 400. Rouvre le solde et ramène `payee → emise`. Règlement d'une autre facture → **404**. Réponse 201 = la facture entière. |
| `POST /platform/subscription-invoices/{pk}/cancel/` | **admin** | `{reason*}`. Refusée tant qu'un règlement actif existe → 400 `"… contre-passez-les avant de l'annuler."` ; déjà annulée → 400. La période redevient facturable. Réponse 200 = la facture entière. |
| `GET /platform/support/tickets/?status=&category=&center=&open=` | support+admin | **S5 lot 3** — la file de support, tous tenants (voir ci-dessous). `open=true` = `ouvert` + `en_cours`. Filtres invalides → 400 par champ ; `center` inexistant → **page vide**, pas 404. |
| `GET /platform/support/tickets/{pk}/` | support+admin | Ticket + fil complet en une requête. |
| `GET\|POST /platform/support/tickets/{pk}/messages/` | **support ET admin** | **L'EXCEPTION assumée** : répondre à un ticket est le métier du support. `{body*}` → 201, `author_side` posé à `chioni` par le backend. |
| `POST /platform/support/tickets/{pk}/status/` | **support ET admin** | `{status*}`. Machine à états : `ouvert ⇄ en_cours`, les deux → `resolu`, `resolu → en_cours`, tout → `ferme` — **`ferme` est DÉFINITIF** (400 `"Transition refusée : …"`). Même statut → 400. |
| `GET /platform/support/tickets/{pk}/attachments/{id}/download/` | support+admin | Binaire, `attachment; filename="piece-<id>.<ext>"`, nosniff. Pièce d'un autre ticket → 404. |
| `GET\|POST /platform/operators/?role=&is_active=` | **admin** | **S5 lot 3** — l'équipe Chioni. `support` reçoit **403 même en LECTURE** (qui détient la casquette est de la gouvernance). POST `{phone*, role*(support\|admin), first_name?, last_name?}` → 201. Compte déjà exploitant → 400 ; **compte portant un membership actif dans un centre → 400** (séparation des pouvoirs) ; téléphone invalide → 400. |
| `GET\|PATCH /platform/operators/{pk}/` | **admin** | PATCH `{role?, is_active?}` (au moins un ; corps vide → 400). **Pas de DELETE** (405) : on révoque avec `is_active: false`. Rétrograder ou désactiver le **dernier administrateur actif** → 400 `"… dernier administrateur actif de la plateforme Chioni…"`. |

Item facture SaaS plateforme : `{id, number, center, center_name, subscription, status, period_start, period_end, amount_kmf, paid_kmf, balance_kmf, due_date, plan_code, plan_label, issued_by, cancelled_at, cancelled_by, cancel_reason, reminders_sent, last_reminder_at, created_at, payments[]}` — **exactement ces champs**. `payments[]` ajoute `invoice`, `recorded_by` et `reversed_by` (des ids d'exploitants) au payload centre. `issued_by: null` = émission **automatique** par la tâche planifiée, pas un oubli.

> **Le cycle tourne tout seul, et il ne coupe rien.** Trois tâches quotidiennes : émission des périodes échues, passage `actif → impaye` sur échéance dépassée (retour automatique dès que réglé), relances SMS J+0 / J+7 / J+21 au directeur. **Aucune tâche ne suspend ni ne résilie** : le gel reste une décision d'exploitant, motivée et auditée. Ne jamais présenter un écran back-office qui laisserait croire à une coupure automatique.

### Réconciliation PSP (`GET /platform/reconciliation/`, S4 lot 2, ADR 0017 décision 6)

Liste paginée, **plus récent d'abord**. Lecture seule, `support` **et** `admin`. C'est une vue d'exploitation **technique** : des ids, des statuts, des montants, un code d'incident — **jamais un nom de patient, jamais un nom de tuteur, jamais un libellé d'acte** (verrouillé par test de champs négatif, comme tout `/platform/`).

Item : `{id, created_at, action, incident, center(id|null), center_name(string|null), refs{…}}`.

- `action` ∈ `payment.webhook_refused` | `payment_intent.cancelled` | `payment_intent.failed`.
- `incident` = **vocabulaire fermé**, c'est lui qu'on affiche et qu'on filtre :
  | code | ce qui s'est passé | ce que ça coûte |
  |---|---|---|
  | `webhook_intent_not_payable` | succès PSP sur une intention déjà `echoue`/`annule` (purge des zombies) | le tuteur a peut-être été débité |
  | `webhook_request_not_payable` | succès PSP sur une demande qui n'est plus `envoyee` | idem |
  | `webhook_invoice_cancelled` | succès PSP sur une facture annulée par le centre | idem |
  | `webhook_balance_changed` | succès PSP alors que le solde a bougé (encaissement guichet entre-temps) | idem |
  | `intent_stale_cancelled` | intention abandonnée annulée par la purge horaire | rien, mais à annuler côté PSP |
  | `intent_failed` | le prestataire a signalé un échec | rien |
- `refs` : sous-ensemble de `{intent_id, payment_request_id, invoice_id, intent_status, request_status, intent_kmf, balance_kmf}` — **seules les clés présentes** sont rendues (liste blanche stricte : un service qui enrichirait le payload demain ne fuitera pas ici).
- `center`/`center_name` : le tenant. **`null` pour un incident antérieur à S4 lot 2** (la colonne n'existait pas et le journal est append-only) — afficher « centre inconnu », ne pas masquer la ligne.
- Filtres : `?reason=<code d'incident>` (valeur hors vocabulaire → 400 `{"reason": […]}`), `?center=<id>` (non numérique → 400 par champ ; id inexistant → page vide), `?from=&to=` (même contrat de fenêtre que les stats : jours locaux Comores, 30 j par défaut, 366 max).

> **Le miroir côté centre n'existe pas** (« votre paiement diaspora a été refusé » pour le centre et pour le tuteur) : hors périmètre S4, consigné en vigilance dans l'ADR 0017. Le directeur voit toutefois ces mêmes lignes brutes dans son journal d'audit (`payment.webhook_refused`) — ce n'est pas un écran d'explication, ne pas le présenter comme tel.

### File RGPD (`GET /platform/erasure-requests/`, S4 lot 3, ADR 0017 décision 7)

Liste paginée, plus récente d'abord. Lecture `support` **et** `admin` (répondre « où en est ma demande ? » est un geste de support) ; exécution **`admin` seul** (l'anonymisation est irréversible, le refus est un acte juridique).

Item : `{id, user, status, requested_at, processed_at, processed_by, refusal_reason, hats, blockers}`.

- `user` / `processed_by` : des **identifiants de compte**, jamais un nom ni un téléphone. **L'exploitant n'a pas besoin de l'identité pour effacer** : la demande a été déposée par la personne AUTHENTIFIÉE depuis son propre espace — l'auth de Chioni est la preuve d'identité, pas un nom saisi. L'invariant « aucune PII de patient côté plateforme » tient donc ici aussi (verrouillé par test, y compris quand le demandeur est un patient).
- `hats` : `{is_patient, is_guardian, is_center_staff, is_platform_operator}` — des booléens, pour que l'exploitant mesure les conséquences (« ce compte porte un carnet, qui ne sera pas effacé »).
- `blockers` : liste de codes, **vide = exécutable**. Les afficher AVANT le bouton, jamais découvrir le refus au clic :
  | code | ce qu'il faut faire d'abord |
  |---|---|
  | `dernier_directeur` | nommer un autre directeur dans le centre concerné |
  | `paiement_en_cours` | attendre que le paiement PSP aboutisse (ou que la purge horaire l'annule) |
  | `dernier_admin_plateforme` | nommer un autre administrateur Chioni |
- `POST .../process/` avec `{"decision": "anonymiser"}` sur une demande bloquée → **400** avec les phrases françaises correspondantes, et **la demande RESTE `en_attente`** (elle n'est pas refermée : la personne n'a pas à redemander une fois l'obstacle levé).
- `{"decision": "refuser"}` exige `refusal_reason` non vide → 400 `["Le motif du refus est obligatoire : …"]`. Le motif est ensuite **lu par la personne** dans son espace.
- **Effet de `anonymiser`, à écrire noir sur blanc dans l'écran de confirmation** : identité neutralisée (`anon-<id>`, téléphone à NULL, avatar supprimé), compte désactivé, liens de tutelle révoqués (des deux côtés), consentements révoqués, memberships désactivés, codes OTP purgés. **Rien n'est supprimé** : ledger, journal d'audit, factures, reçus et **le carnet de santé** restent (ADR 0007 — le carnet appartient au patient et relève du droit local de conservation ; il devient orphelin d'identité). Un patient anonymisé apparaît sous « Patient anonymisé #<id> » dans les listes du centre.

### Abonnements et offres (`/platform/plans|subscriptions/`, S5 lot 1, ADR 0018)

Item abonnement : `{id, center, center_name, status, status_reason, started_at, current_period_end, status_updated_at, is_frozen, plan{…}, usage{…}, created_at}` — **exactement ces champs**. `center` est un id, `center_name` le nom du tenant : aucun patient n'entre ici non plus (invariant `/platform/` verrouillé par test).

- **L'abonnement n'est PAS le KYC.** Deux axes, deux écrans, deux badges : `kyc_status` gouverne le **rail diaspora** (ADR 0017), `status` gouverne l'**administratif** (ADR 0018). Un centre suspendu commercialement encaisse toujours au guichet ET reçoit toujours les paiements de la diaspora — c'est une décision explicite : fermer le Pont punirait le tuteur et le patient, pas le centre.
- **Ce qu'un gel ferme réellement** : personnel (ajout/modification/réactivation), tarifs, statistiques. **Rien d'autre.** L'écran de suspension doit dire au support ce qu'il déclenche : soins, rendez-vous, inscription au guichet, facturation, caisse et lecture continuent.
- `reason` d'une suspension : texte libre lu par **le directeur du centre** dans son propre espace — l'écrire comme une consigne actionnable (« régularisez la facture A-000012 »), jamais comme une note interne. Il n'entre dans aucun journal d'audit.
- `usage` : compteurs de sièges (une PERSONNE = un siège, même avec deux rôles) contre les quotas de l'offre. Signal commercial (« ce centre déborde son offre »), **jamais** un levier de blocage produit.

Item centre plateforme : `{id, name, type, island, city, address, phone, email, kyc_status, kyc_reason, kyc_updated_at, created_at, staff_active_count, director_active_count, kyc_document_count}` — **exactement ces champs** (l'abonnement n'y figure pas : il a sa propre route). `director_active_count == 0` est le signal « ce centre est verrouillé hors de son propre espace, amorcer un directeur ».

Le premier directeur naît en **compte ombre** : aucun mot de passe n'est transmis, il prend possession de son compte par OTP. Ne jamais afficher ni promettre un identifiant/mot de passe dans l'écran d'onboarding — dire « le directeur recevra un code par SMS à sa première connexion ».

### Support (`/platform/support/tickets/`, S5 lot 3, ADR 0018 décision 5)

Item : `{id, center, center_name, subject, category, status, priority, opened_by, message_count, attachment_count, last_message_at, closed_at, created_at, updated_at}` — **exactement ces champs** ; le détail ajoute `messages[]` et `attachments[]`. `messages[]` côté plateforme = `{id, author, author_side, body, created_at}` — **sans `author_display`** : aucun humain n'est nommé dans le back-office (`opened_by` et `author` sont des ids de compte, comme dans la file RGPD).

- **La SEULE écriture ouverte au `support` de tout le back-office** : répondre (`messages/`) et faire avancer (`status/`). Partout ailleurs il lit. L'écran doit le refléter — ne pas griser ces deux actions pour un `support`, et ne pas les ouvrir ailleurs.
- **Le centre n'est jamais bloqué par un gel** pour écrire ici : un ticket d'un tenant `suspendu` arrive normalement dans la file. C'est souvent exactement le sujet du ticket — le prévoir dans le tri (`?center=` croisé avec l'abonnement).
- **Le contenu est du texte libre écrit par un humain pressé.** Aucun champ ne relie un ticket à un patient (par conception, ADR 0018 : « un module de support n'est pas une porte d'accès au dossier ») — mais rien n'empêche quelqu'un d'écrire un nom dans le corps. Ne jamais recopier ce contenu ailleurs (export, notification, capture), et ne pas construire de recherche plein texte qui l'indexerait durablement.
- `?open=true` = `ouvert` + `en_cours` : le filtre de travail par défaut.

### L'équipe Chioni (`/platform/operators/`, S5 lot 3, ADR 0018 décision 6)

Item : `{id, user, role, is_active, created_at, updated_at}` — **exactement ces champs, des IDS**. Ni nom, ni téléphone, ni e-mail, ni username : un compte ombre porte son numéro dans son username, et le back-office rend des identifiants (même contrat que la file RGPD). Afficher « Exploitant #<id> » ; c'est austère et assumé.

- **`admin` seul, y compris en lecture** : un `support` reçoit 403 sur toutes ces routes.
- Un exploitant naît en **compte ombre** claimé par OTP — aucun mot de passe n'est créé ni transmis. Le dire dans l'écran, comme pour l'onboarding d'un directeur.
- **Séparation des pouvoirs** : un compte portant un membership ACTIF dans un centre ne peut pas recevoir la casquette (400 explicite) — et réciproquement, la plateforme ne peut pas s'amorcer directeur. Un employé Chioni qui travaille aussi dans un centre utilise deux comptes.
- **Garde « dernier administrateur »** : le 400 est une consigne (« nommez un autre administrateur avant… ») — l'afficher tel quel, et désactiver le bouton quand la liste ne compte qu'un seul `admin` actif.
- **L'admin Django ne gère plus rien de tout ça** (S5 lot 3) : `PlatformStaffAdmin` et `StaffMembershipAdmin` sont en lecture seule. Le tout premier exploitant s'amorce hors ligne (`python manage.py create_platform_staff`) — ce n'est pas un écran.

## N'existe PAS côté API (ne pas construire d'écran branché dessus)
Prise de RDV par le patient (self-booking — la lecture et l'annulation d'un `prevu` existent depuis S2, voir Espace patient ; la prise reste au guichet), agenda côté tuteur (aucun accès tuteur aux RDV), lecture du ledger, **miroir centre/tuteur d'un paiement diaspora refusé** (hors périmètre S4 — le directeur voit la ligne brute dans son journal d'audit, ce n'est pas un écran d'explication), **annulation d'une demande d'effacement par la personne** (S4 lot 3 : on dépose, on ne retire pas — à rouvrir si le terrain le demande), **restauration d'un compte anonymisé** (structurellement impossible : il n'y a plus rien à restaurer), **inscription en self-service d'un centre** (un centre entre toujours par l'exploitant), **paiement de sa facture d'abonnement par le centre depuis l'app** (le règlement se fait hors ligne, l'exploitant l'enregistre — les rails comoriens ne sont pas instruits), **export comptable / PDF des factures d'abonnement** (hors périmètre S5), **paiement en ligne de l'abonnement par le centre** (rails comoriens non instruits — hors périmètre acté), **édition d'un centre par la plateforme** (le profil du centre reste au directeur ; la plateforme décide le KYC, pas l'adresse), **annuaire du personnel côté plateforme** (compteurs seulement : la plateforme gouverne le tenant, elle ne consulte pas ses salariés), **support ouvert aux patients et aux tuteurs** (hors périmètre S5 acté — la tab bar lite est déjà pleine à 4 onglets), **notification d'une réponse de support** (ni SMS ni e-mail : le centre revoit son écran), **assignation / SLA / recherche plein texte** dans la file de support, **archivage d'une pièce jointe de ticket** (pas de chemin de correction, contrairement aux pièces KYC et aux documents patients), **suppression d'un exploitant** (on révoque, on ne supprime pas), reset de mot de passe, messagerie, **toute donnée S3 côté tuteur** (fiche médicale, signes vitaux, documents, assurances, identité élargie — verrou de sprint ADR 0016 : rien de nouveau n'est exposé au tuteur, même porteur de `detail_clinique` ; le payload protégé reste `{id, first_name, last_name, claim_status}`), upload PDF (différé — photos JPEG/PNG/WebP seulement), directives anticipées (hors périmètre S3, cadrage dédié à venir), **toute forme de PAIE** (barèmes, salaires, bulletins, taux — hors périmètre S7 acté, cadrage séparé : aucun champ de rémunération n'existe côté serveur et il ne faut en afficher aucun), **délégué RH** (le directeur assume ou délègue hors application — ne pas prévoir de rôle « responsable RH »), **pointage horaire** (arrivée/départ, badgeuse, géolocalisation : la feuille note une JOURNÉE, jamais des minutes), **soldes de congés calculés et reports** d'une année sur l'autre (`days` est un affichage, pas un solde), **plannings de garde prévisionnels** (roster), **contrats et documents d'embauche**, **évaluations**, **pré-remplissage des fériés nationaux** (le calendrier appartient au centre), **annulation d'un congé déjà approuvé** (S7 : les trois issues sont terminales — la feuille de présence fait foi). La photo de profil n'apparaît JAMAIS dans les vues croisées patient/tuteur (le tuteur ne voit pas la photo du patient ni l'inverse) : ne pas prévoir d'emplacement pour. Les écrans correspondants sont soit à exclure du MVP frontend, soit des placeholders « bientôt » clairement assumés.
