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
- **Sémantique des refus** : anonyme → 401 ; centre étranger ou objet d'autrui (IDOR) → **404** ; membre sans le bon rôle → 403.
- **429** : message anglais `"Request was throttled. Expected available in N seconds."` + header `Retry-After`.

## Auth

| Endpoint | Corps | Succès | Notes |
|---|---|---|---|
| `POST /auth/otp/request/` | `{"phone"}` | 200 `{"detail": "Si ce numéro peut recevoir un code, un SMS vient de lui être envoyé."}` (réponse constante, anti-énumération) | Throttles : 3/h par téléphone, 10/h par IP. Code : 6 chiffres, 10 min, 5 essais, un seul code vivant. 400 seulement si format téléphone invalide. |
| `POST /auth/otp/verify/` | `{"phone","code"}` | 200 `{"access","refresh","me"}` (`me` = payload de `/auth/me/`) | 400 unique et indistinguable : `["Code invalide ou expiré."]`. Crée le compte (porte B) ou active un compte ombre ; peut suspendre des liens de tutelle → écran de confirmation côté patient. |
| `POST /auth/token/` | `{"username","password"}` | 200 `{"access","refresh"}` | Staff/back-office. 401 `{"detail": "Aucun compte actif..."}` |
| `POST /auth/token/refresh/` | `{"refresh"}` | 200 `{"access","refresh"}` | **Rotation : le refresh est à usage unique** (l'ancien est blacklisté). Sérialiser les refresh (mutex single-flight) sinon 401. Access 30 min, refresh 7 j. |
| `POST /auth/logout/` | `{"refresh"}` | **205**, corps vide | |
| `GET /auth/me/` | — | 200 (voir ci-dessous) | Le routeur des 3 espaces. |

### `GET /auth/me/` — routeur des 3 espaces

```json
{
  "id": 12, "username": "user-2693390011", "first_name": "", "last_name": "",
  "phone": "+2693390011",
  "staff_memberships": [
    {"id": 3, "center": {"id": 1, "name": "CHR El-Maarouf", "type": "hopital_public",
                         "island": "ngazidja", "city": "Moroni"}, "role": "medecin"}
  ],
  "patient_profile": {"id": 7, "first_name": "…", "last_name": "…", "claim_status": "actif"},
  "guardian_profile": {"id": 4, "country_of_residence": "FR", "preferred_currency": "EUR"}
}
```

- **Espace centre** : `staff_memberships` non vide (memberships ACTIFS seulement). Rôles : `directeur, medecin, infirmier, sage_femme, secretaire, caissier, pharmacien`. Multi-centres possible → sélecteur ; `center.id` alimente tous les `/centers/{center_pk}/…`.
- **Espace patient** : `patient_profile !== null` (toujours `claim_status: "actif"` quand présent). `null` → proposer `POST /patients/me/` (porte B).
- **Espace tuteur** : `guardian_profile !== null`. `null` → proposer `POST /guardian/profile/`.
- Casquettes **cumulables** ; aucun `role` global.

## Espace patient (`IsPatientSelf` : 403 `"Réservé au patient titulaire d'un profil revendiqué."` sinon)

### Profil
- `GET|PATCH|POST /patients/me/` — champs `[id, first_name, last_name, birth_date, sex("f"|"m"|""), phone, city, claim_status, created_at]` (read-only : id, claim_status, created_at). POST = création porte B (201).

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

### Carnet
- `GET /patients/me/encounters/` → `{id, center, center_name, occurred_at, reason, diagnosis, status(en_cours|terminee|annulee), acts[{id,label_snapshot,generic_category,price_kmf_snapshot,tariff_item}], created_at}`
- `GET /patients/me/prescriptions/` → `{id, encounter, status(emise|delivree), items[{id,medication,dosage}], created_at}`
- `GET /patients/me/record-entries/` → `{id, entry_type(antecedent|allergie|traitement_en_cours|vaccination), content, source_encounter, created_at}`

### Argent côté patient
- `GET /patients/me/payment-requests/` (+`/{pk}/`) → `{id, center_name, total_kmf, status, lines[{id,label,generic_category,amount_kmf}], shared_with_links[ids], patient_acknowledged_at, created_at}`
- `POST .../{pk}/share/` `{"guardian_link": <id>}` → 201.
- `POST .../{pk}/acknowledge/` (sans corps) → 200 — possible seulement après paiement.
- `POST .../{pk}/dispute/` `{"reason"}` → 201, statut `litige`.
- `GET /patients/me/receipts/` → reçus (shape ci-dessous).

## Espace tuteur

- `GET|POST /guardian/profile/` — `{id, country_of_residence(ISO-2, déf. FR), preferred_currency(EUR|KMF, déf. EUR), created_at}`. GET sans profil → 404.
- `GET /guardian/proteges/` — liens `actif` avec scope `paiements` UNIQUEMENT. Item : `{id, patient{id,first_name,last_name,claim_status}, relationship, status, initiated_by, accepted_at}`. Patient = identité administrative STRICTE.
- `POST /guardian/proteges/` `{first_name*, last_name*, relationship*, birth_date?, sex?, phone?, city?}` → 201, lien direct `actif` (porte A).
- `GET /guardian/invitations/` (statut `invitation_envoyee`) ; `POST /guardian/invitations/{link_pk}/accept/` → 200 `actif`.
- `POST /guardian/links/{link_pk}/revoke/` → 200.

### Demandes de paiement (double dérivation : lien actif + scope + partage explicite, sinon 404)
- `GET /guardian/payment-requests/` (+`/{pk}/`) → `{id, patient, center_name, total_kmf, status, lines[{generic_category, amount_kmf}], created_at}` — **jamais de `label`** (secret médical, ADR 0005). Payable si `status === "envoyee"`.
- `GET .../{pk}/quote/` (**GET**) → devis FX :
  `{amount_kmf, currency_received:"KMF", exchange_rate, amount_eur, fees_eur, total_eur, currency_paid:"EUR"}`
  (frais 2,50 % en sus ; le centre reçoit 100 % du KMF). 400 si non payable.
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

- `GET /centers/` — mes centres. `GET|PATCH /centers/{pk}/` — `{id, name, type(hopital_public|clinique_privee|centre_sante|cabinet|pharmacie), island(ngazidja|ndzuwani|mwali), city, address, phone, email, kyc_status(en_attente|actif|suspendu, read-only), created_at}`. KYC ≠ actif → encaissement bloqué.
- **Patients** : `GET(?q=)|POST /centers/{c}/patients/` ; item `{id, first_name, last_name, birth_date, sex, phone, city, claim_status(non_revendique|invite|actif), created_at}`. Création porte C : + `guardian_phone?`, `guardian_relationship?` (write-only → lien `invitation_envoyee`). PATCH d'un profil revendiqué → 400 (identité gérée par le patient). Fusion : `POST .../patients/merge/` `{"source_id","target_id"}`.
- **Consultations** : `GET|POST /centers/{c}/encounters/` (+`/{pk}/`). POST (cliniques) : `{patient*, reason*, diagnosis?, occurred_at?, tariff_items?[ids]}`. Lecture selon rôle : clinique → avec `reason`/`diagnosis` ; admin → **sans** (vue exploitation).
- **Ordonnances** : `GET|POST /centers/{c}/encounters/{e}/prescriptions/` (POST : `medecin, sage_femme`). **Entrées carnet** : `GET|POST .../record-entries/` (non paginés).
- **Factures** : `GET|POST /centers/{c}/invoices/` (+`/{pk}/`, `/{pk}/issue/`). Item : `{id, encounter, patient, total_kmf, status(brouillon|emise|payee|annulee), lines[{id,act,label,generic_category,amount_kmf}], created_at}`. Création : `{"encounter", "act_ids"?}`.
- **Demandes de paiement** : `POST /centers/{c}/invoices/{pk}/payment-requests/` ; `GET /centers/{c}/payment-requests/` (+`/{pk}/`) → `{id, invoice, total_kmf, status, created_by, patient_acknowledged_at, shares[{id,guardian_link,shared_at,shared_by}], created_at}`. Actions : `share/`+`unshare/` (`{"guardian_link"}`), `send/`, `confirm-care/` (rôles soins), `close/` → **201 reçu**.
- **Litiges** : `GET /centers/{c}/disputes/` → `{id, payment_request, opened_by, reason, previous_status, status(ouvert|resolu), resolved_by, resolution_note, resolved_at, created_at}` ; `POST .../{pk}/resolve/` `{"resolution_note"}` (directeur).
- **Personnel** : `GET|POST /centers/{c}/staff/` (directeur) → `{id, user{id,first_name,last_name,phone}, role, is_active, created_at}`. Création : `{phone*, role*, first_name?, last_name?}` (compte ombre si inconnu). `POST .../staff/{pk}/deactivate/`. Jamais de suppression ; dernier directeur indéactivable.
- **Tarifs** : `GET|POST /centers/{c}/tariffs/` (+`/{pk}/` PATCH) → `{id, code, label, generic_category*, price_kmf, is_active, created_at}` (écriture : directeur, caissier).
- `generic_category` : `consultation, analyses_examens, medicaments, hospitalisation, acte_technique, soins_infirmiers, maternite, autre`.

## N'existe PAS côté API (ne pas construire d'écran branché dessus)
Rendez-vous/agenda, module caisse, lecture du ledger, lecture d'audit, création de centre, reset de mot de passe, messagerie, upload de documents. Les écrans correspondants sont soit à exclure du MVP frontend, soit des placeholders « bientôt » clairement assumés.
