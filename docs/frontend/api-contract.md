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
- **429** : message anglais `"Request was throttled. Expected available in N seconds."` + header `Retry-After`. **S1** : throttle global généreux par utilisateur (600/min — jamais atteint par un usage normal) sur tous les endpoints, + scope STRICT `uploads` (20/h par utilisateur) partagé par `POST /auth/me/avatar/` et `POST /centers/{pk}/logo/` — prévoir l'affichage du 429 sur ces deux formulaires.
- **Swagger** : `/api/docs/` et `/api/schema/` publics en DEV seulement (admin en prod).

## Auth

| Endpoint | Corps | Succès | Notes |
|---|---|---|---|
| `POST /auth/otp/request/` | `{"phone"}` | 200 `{"detail": "Si ce numéro peut recevoir un code, un SMS vient de lui être envoyé."}` (réponse constante, anti-énumération) | Throttles : 3/h par téléphone, 10/h par IP. Code : 6 chiffres, 10 min, 5 essais, un seul code vivant. 400 seulement si format téléphone invalide. |
| `POST /auth/otp/verify/` | `{"phone","code"}` | 200 `{"access","refresh","me"}` (`me` = payload de `/auth/me/`) | 400 unique et indistinguable : `["Code invalide ou expiré."]`. Crée le compte (porte B) ou active un compte ombre ; peut suspendre des liens de tutelle → écran de confirmation côté patient. |
| `POST /auth/token/` | `{"username","password"}` | 200 `{"access","refresh"}` | Staff/back-office. 401 `{"detail": "Aucun compte actif..."}` |
| `POST /auth/token/refresh/` | `{"refresh"}` | 200 `{"access","refresh"}` | **Rotation : le refresh est à usage unique** (l'ancien est blacklisté). Sérialiser les refresh (mutex single-flight) sinon 401. Access 30 min, refresh 7 j. |
| `POST /auth/logout/` | `{"refresh"}` | **205**, corps vide | |
| `GET /auth/me/` | — | 200 (voir ci-dessous) | Le routeur des 3 espaces. |
| `PATCH /auth/me/` | `{"first_name"?, "last_name"?}` | 200 (payload `me` complet) | Nom d'affichage UNIQUEMENT — `phone` (pivot d'identité) et `username` ne sont jamais modifiables (valeurs soumises ignorées). |
| `POST /auth/me/avatar/` | **multipart** `file` | 200 `{"avatar": "<url absolue>"}` | Photo de profil de l'utilisateur LUI-MÊME (toute casquette). JPEG/PNG/WebP réels seulement (jamais SVG), 2 Mo max, 2048×2048 max, EXIF strippé, nom de fichier régénéré. 400 : `["Image invalide : formats acceptés JPEG, PNG ou WebP (2 Mo maximum)."]` etc. Remplacement = l'ancien fichier est supprimé du serveur. |
| `DELETE /auth/me/avatar/` | — | 200 `{"avatar": null}` | 400 si aucun avatar. Fichier physiquement supprimé. |

### `GET /auth/me/` — routeur des 3 espaces

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
  "guardian_profile": {"id": 4, "country_of_residence": "FR", "preferred_currency": "EUR"}
}
```

- `avatar` et `center.logo` : **URL absolue ou `null`** — brancher directement dans `<img src>`. Le logo alimente la sidebar (et l'affichage écran des factures/reçus ; l'impression PDF viendra avec le chantier PDF).

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
- `GET /patients/me/payment-requests/` (+`/{pk}/`) → `{id, center_name, total_kmf, status, lines[{id,label,generic_category,amount_kmf}], shared_with_links[ids], paid_at, patient_acknowledged_at, created_at}` — `paid_at` : ISO-8601 nullable, posé par le webhook d'encaissement (« payée par un proche le … »).
- `POST .../{pk}/share/` `{"guardian_link": <id>}` → 201 — **S1** : lien qui n'est pas au patient → **400 explicite** `"Ce lien de tutelle n'est pas l'un des vôtres : partage refusé."` (plus 404 — ref de corps).
- `POST .../{pk}/acknowledge/` (sans corps) → 200 — possible seulement après paiement.
- `POST .../{pk}/dispute/` `{"reason"}` → 201, statut `litige`.
- `GET /patients/me/receipts/` → reçus diaspora (shape ci-dessous).
- `GET /patients/me/cash-receipts/` → mes reçus guichet (KMF pur, tous centres) : `{id, receipt_number("G-000001"), center_name, amount_kmf, method(especes|mobile_money), reversed(bool — true si l'encaissement a été contre-passé), issued_at}`. Le tuteur ne voit JAMAIS ces reçus (sa portée `paiements` = demandes qui lui sont partagées uniquement).

## Espace tuteur

- `GET|POST /guardian/profile/` — `{id, country_of_residence(ISO-2, déf. FR), preferred_currency(EUR|KMF, déf. EUR), created_at}`. GET sans profil → 404.
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

- `GET /centers/` — mes centres. `GET|PATCH /centers/{pk}/` — `{id, name, type(hopital_public|clinique_privee|centre_sante|cabinet|pharmacie), island(ngazidja|ndzuwani|mwali), city, address, phone, email, kyc_status(en_attente|actif|suspendu, read-only), logo(url absolue|null, read-only), created_at}`. KYC ≠ actif → encaissement bloqué.
- **Logo du centre** (directeur seul) : `POST /centers/{pk}/logo/` — **multipart** `file` → 200 `{"logo": "<url absolue>"}` ; `DELETE` → 200 `{"logo": null}` (400 si aucun logo). Mêmes règles d'upload que l'avatar (JPEG/PNG/WebP réels, 2 Mo, 2048² max, EXIF strippé) ; remplacement/suppression effacent physiquement l'ancien fichier. Jamais via le PATCH JSON du centre.
- **Patients** : `GET(?q=)|POST /centers/{c}/patients/` ; item `{id, first_name, last_name, birth_date, sex, phone, city, claim_status(non_revendique|invite|actif), created_at}`. Création porte C : + `guardian_phone?`, `guardian_relationship?` (write-only → lien `invitation_envoyee`). PATCH d'un profil revendiqué → 400 (identité gérée par le patient). Fusion : `POST .../patients/merge/` `{"source_id","target_id"}` — **S1 : rôles BILLING seuls** (la fusion déplace des liens de tutelle ; soignants/pharmacien → 403) ; id hors périmètre du centre → **400 explicite** `"Ce patient n'est pas connu de ce centre : fusion refusée."` (plus 404 — refs de corps).
- **Liens de tutelle d'un patient (routage du partage au guichet)** : `GET /centers/{c}/patients/{pk}/guardian-links/` (rôles BILLING ; patient hors périmètre → 404) → liste paginée `{id, guardian_name, relationship}` — liens **`actif` uniquement**, minimum administratif : jamais de téléphone (tuteur sans nom → nom d'affichage masqué `"+336••••••78"`), jamais de scopes ni d'historique. `id` alimente le `guardian_link` de `POST .../payment-requests/{pk}/share/` (cas Mariama : le patient désigne son tuteur au guichet).
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

## N'existe PAS côté API (ne pas construire d'écran branché dessus)
Agenda côté patient/tuteur (les rendez-vous sont une donnée d'exploitation du centre — seul le staff y accède), lecture du ledger, lecture d'audit, création de centre, reset de mot de passe, messagerie, upload de documents du carnet (seuls le logo du centre et la photo de profil existent — voir sections Centre et Auth). La photo de profil n'apparaît JAMAIS dans les vues croisées patient/tuteur (le tuteur ne voit pas la photo du patient ni l'inverse) : ne pas prévoir d'emplacement pour. Les écrans correspondants sont soit à exclure du MVP frontend, soit des placeholders « bientôt » clairement assumés.
