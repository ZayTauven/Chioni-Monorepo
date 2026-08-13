# ADR 0008 — Architecture des permissions API : une casquette par vue, cloisonnement par queryset

- **Statut** : acté (phase A de la couche API) — complété le 2026-08-13 (revue guardian : lecture clinique segmentée par rôle R-API-1, identité des profils revendiqués protégée R-API-2)
- **Date** : 2026-08-13

## Contexte

Un même `User` cumule des casquettes (médecin ET tuteur — ADR 0001). La couche API doit servir trois audiences (personnel de centre, patient, tuteur) sans jamais qu'un droit d'une casquette n'ouvre les données d'une autre. Deux pièges documentés par la revue adversariale devaient être fermés structurellement : F3 (`Consent.objects.active_scopes()` dit *quel type de donnée* un lien ouvre, jamais *quelles lignes*) et l'IDOR « 404-par-hasard » (un contrôle objet oublié qui laisse fuiter l'existence d'une ressource).

## Décision

Tout vit dans `apps/common/permissions.py` — les vues n'improvisent jamais :

1. **Une vue = une casquette, déclarée explicitement.**
   - Personnel : `IsStaffOfCenter(*roles)` + `CenterScopedViewMixin` (le centre est résolu dans le périmètre des memberships actifs de l'appelant).
   - Patient : `IsPatientSelf` (profil **revendiqué** uniquement) + querysets `for_patient(claimed_patient_profile(user))`.
   - Tuteur : `IsGuardianWithScope(scope)` + helpers de queryset (ci-dessous).
   Aucun queryset n'est dérivé de « n'importe quel droit que l'utilisateur détient ».

2. **Le cloisonnement se fait au QUERYSET, jamais en contrôle d'objet.** Une ressource hors périmètre est indistinguable d'une ressource inexistante : 404 déterministe (IDOR inter-centres et inter-patients). Sémantique des refus : anonyme → 401 ; centre où l'on n'est pas membre → 404 (invisible) ; membre sans le bon rôle → 403.

3. **F3 fermé par centralisation** : `guardian_links_with_scope(user, scope)` / `patients_visible_to_guardian(user, scope)` sont le SEUL chemin légal vers les lignes accessibles à un tuteur — ils combinent `active_scopes()` (le type) et l'appartenance au lien (les lignes). Une vue tuteur qui requête autrement est un défaut bloquant en revue.

4. **Serializers par audience** (`PatientStaffSerializer` / `PatientSelfSerializer` / `PatientGuardianSerializer`…) : la vue tuteur d'un protégé est strictement administrative (nom, statut) — ni téléphone, ni date de naissance, ni rien de clinique. Aucun endpoint clinique tuteur en phase A : la portée `detail_clinique` sera branchée entière, jamais à moitié.

5. **Écritures = services** (`apps/*/services.py`) : chaque service passe par `save()`/méthodes de modèle (règle CLAUDE.md), journalise dans l'AuditLog (`apps/audit/services.audit`, payload = références uniquement — ADR 0007) dans la même transaction, et lève des `ValidationError` Django traduites en 400 par le handler global (`apps/common/exceptions.py`).

5 bis. **Lecture clinique segmentée par rôle DANS le tenant (R-API-1)** : au sein d'un centre, les LECTURES cliniques sont aussi des permissions, pas seulement les écritures. Rôles cliniques (médecin, infirmier, sage-femme) → `EncounterClinicalSerializer` (motif + diagnostic) et lecture des entrées de carnet produites par le centre ; ordonnances lisibles par rôles cliniques + pharmacien (il délivre) ; staff administratif (secrétaire, caissier, directeur) → `EncounterAdminSerializer` : la vue d'exploitation nécessaire à la facturation (date, patient, praticien, actes avec libellés tarifaires — donnée de facturation qu'ils gèrent déjà), SANS `diagnosis` ni `reason` (le motif peut révéler la pathologie), sans carnet ni ordonnances. Conséquence multi-casquettes : un tuteur qui détient un rôle administratif dans le centre traitant ne lit plus aucun diagnostic par sa casquette staff. Le choix du serializer vit dans `is_clinical_member()` (`apps/medical/views.py`), jamais dans le frontend.

5 ter. **Identité des profils revendiqués (R-API-2)** : dès qu'un `PatientProfile` est revendiqué (`claim_status=actif`), ses champs d'identité (`first_name`, `last_name`, `birth_date`, `sex`, `phone`, `city`) n'appartiennent qu'au patient : toute modification par un tiers (guichet compris) → 400 « Ce profil est géré par le patient ». L'édition guichet reste libre sur les profils non revendiqués. La garde vit dans `update_patient_profile()` (service), pas dans les vues.

5 quater. **Téléphones normalisés E.164 à la frontière (R-API-5)** : `apps/common/phones.normalize_phone(raw, region KM)` est appelé AVANT tout rapprochement ou création (guichet, invitations, comptes ombre, staff) — « +269… », « 269… » et formes nationales convergent vers un seul compte ; numéro invalide → 400 FR.

6. **Fusion de doublons (R4 fermé)** : `merge_profiles()` résout la cible canonique par remontée **bornée** (20 sauts) avec détection de cycle, re-vérifie la cible, re-rattache liens/consentements/données médicales via `save()`, révoque les liens qui deviendraient des doublons ou de l'auto-tutelle, et laisse les factures ancrées sur le profil absorbé (anchors gelés par trigger — ADR 0006) qui subsiste en pierre tombale `merged_into`.

## Conséquences

- La matrice de permissions est un invariant testé (`tests/test_api_*.py`) : 401/403/404, champs des payloads tuteur, effet immédiat des révocations.
- Phase B (trustbridge) devra consommer `guardian_links_with_scope(user, PAYMENTS)` pour le périmètre des demandes de paiement partagées — combiné avec `shared_with` (probe F3 du hardening).
- Limite connue à traiter : la contrainte unique `(guardian, patient)` conserve la ligne révoquée, donc un couple tuteur/patient révoqué ne peut pas être re-lié sans évolution de schéma (contrainte partielle) — refusé proprement en attendant.

## Addendum S1 — Assainissement (2026-08-13)

### 1. Sémantique des refus unifiée (norme actée)

**Référence portée par l'URL → 404** (périmètre au queryset, IDOR déterministe, inchangé). **Référence portée par le CORPS de la requête → 400 explicite** (pattern scheduling : c'est un formulaire, le guichet a droit à un message actionnable). Règle de non-fuite : le message d'un 400 de corps couvre INDIFFÉREMMENT l'id étranger et l'id inexistant (« n'est pas connu de ce centre », « ne concerne pas le patient facturé ») — verrouillé par tests d'égalité byte-à-byte des deux réponses. Mise en conformité S1 :

- `POST /centers/{c}/encounters/` : `patient`, `tariff_items`, `appointment` → 400 (étaient 404) ;
- `POST /centers/{c}/invoices/` : `encounter` → 400 ;
- `POST .../payment-requests/{pk}/share|unshare/` et `POST /patients/me/payment-requests/{pk}/share/` : `guardian_link` → 400 ;
- `POST /centers/{c}/patients/merge/` : `source_id`/`target_id` → 400.

### 2. La portée tuteur est réellement vérifiée (C.5.1)

Deux niveaux de permission remplacent l'ancien `IsGuardianWithScope` (dont le scope n'était jamais testé) :

- **`IsGuardian`** — porte de l'ESPACE tuteur (profil existant) : profil, invitations (liste/accept/décliner), création de protégé, révocation de lien. Un lien en attente n'est pas ACTIF et ne porte aucun scope par définition — exiger un scope aurait enfermé un nouveau tuteur hors de sa première invitation (piège vérifié par test).
- **`IsGuardianWithScope(scope)`** — porte des DONNÉES scopées (demandes de paiement, reçus, futurs accès cliniques) : exige AU MOINS un lien ACTIF dont les scopes effectifs (`Consent.objects.active_scopes`) incluent `scope`. Un tuteur jamais habilité est arrêté à la porte (403) même si une vue future oubliait son filtre de queryset. Les helpers F3 restent la seconde couche (le scope dit le TYPE, les helpers disent les LIGNES).
- **Garde-fou structurel testable** : marqueurs `guardian_gate`/`required_scope` sur les classes + test qui parcourt toutes les routes `/api/v1/guardian/` et refuse une vue sans permission tuteur, et une route de données sans le scope `paiements` (`tests/test_permissions_guardian_scope.py`). Une nouvelle route tuteur ne peut pas partir sans garde.
- **Changement de contrat assumé** : un tuteur SANS lien actif reçoit désormais 403 (« Aucun lien de tutelle actif ne vous ouvre cette information. ») sur `/guardian/payment-requests/` et `/guardian/receipts/` au lieu d'une liste vide — le frontend traite ce 403 comme un état « aucun protégé ». Les listes de l'espace (protégés, invitations) restent des 200 vides.

### 3. Arbitrages C.3 appliqués (défauts PO, RÉVERSIBLES)

- **Litiges** : lecture `GET /centers/{c}/disputes/` restreinte à BILLING (le motif libre d'un litige d'argent n'a rien à faire sous les yeux de tout staff, pharmacien compris) ; `resolve` reste directeur.
- **Fusion de patients** : restreinte à BILLING (opération d'administration de dossier au guichet — elle déplace des liens de tutelle). Création/modification patient : inchangé (tout staff).
- **`confirm-care`** : rôles INCHANGÉS (directeur + soignants + pharmacien — la confirmation de soin est un acte soignant, éthique produit). Limite ASSUMÉE : un centre réduit à secrétaire+caissier actifs ne peut pas passer `payee → soin_confirme` (aucun reçu diaspora émis tant qu'un soignant ou le directeur n'est pas actif).
- **Factures et demandes de paiement en LECTURE tout staff** : ASSUMÉ (l'équipe d'exploitation partage l'information de facturation ; la segmentation « argent » complète reste sur impayés/journal/stats/litiges = BILLING). **Nuance passe guardian S1** : le champ `cancel_reason` (texte libre tapé à la caisse, même classe que le motif d'un litige ou d'une contre-passation) est ABSENT du payload facture pour les rôles non BILLING — `InvoiceOperatingSerializer`, choisi par rôle dans les vues de lecture (pattern R-API-1 appliqué aux textes d'argent). L'ÉTAT (`status`, `cancelled_at`) reste visible de tout le staff.
- **Tarifs** : écriture directeur/caissier inchangée (la secrétaire facture mais n'écrit pas la grille).

### 4. Rôles : source unique (C.5.2)

`BILLING_ROLES` et `CLINICAL_ROLES` vivent dans `apps/common/roles.py` (seuls groupes multi-apps) ; les groupes à consommateur unique (prescripteurs, confirm-care, résolution litige) restent dans leur app. `stats_views` n'importe plus `trustbridge.views`. Identité d'objet verrouillée par test.

### 5. Throttles métier (C.5.4)

- **Global** : `UserRateThrottle` par défaut sur toute vue sans `throttle_classes` propre — `THROTTLE_USER` (défaut **600/min**, généreux à dessein : absorbe un script fou ou un token volé, ne gêne jamais un guichet en rush). Anonyme = clé par IP.
- **`uploads`** : scope STRICT partagé logo centre + avatar (`THROTTLE_UPLOADS`, défaut **20/heure** — chaque upload paie le pipeline Pillow, vigilance vague 1).
- **Exemptés explicitement** : webhook PSP (un retry provider en 429 = un encaissement qui n'arrive jamais — la signature est la garde, pas un débit) et health check (sonde de monitoring derrière un NAT partagé). Les scopes stricts existants (OTP, login, invitation) restent prioritaires (`throttle_classes` remplace le défaut).

### 6. Swagger/docs conditionnés (C.5.5)

`/api/schema/` et `/api/docs/` : `AllowAny` en DEBUG seulement ; déployé → `IsAdminUser` (le schéma OpenAPI est une carte de reconnaissance). Testé par sous-processus (`test_settings_guards.py`).

### 7. Cycles de vie complétés (C.2)

- **Consultation terminée** : `POST /centers/{c}/encounters/{pk}/close/` (rôles cliniques SEULS — clôturer est un acte soignant, le directeur non-clinicien reçoit 403). Effets : une consultation `terminee` refuse toute nouvelle ordonnance et entrée de carnet (400 explicite dans les services) ; la FACTURATION reste possible (la facture vient après le soin). `annulee` reste HORS périmètre S1 : annuler une consultation porteuse d'actes facturés pose la cascade de sa facture — à cadrer ensemble, pas à improviser.
- **Réactivation staff** : `POST /centers/{c}/staff/{pk}/reactivate/` (directeur, audité `staff.membership_reactivated`) — symétrique de la désactivation, qui était irréversible par API. Unicité par construction : la désactivation conserve la ligne et la contrainte `(user, center, role)` couvre actifs ET inactifs (le ré-ajout d'un inactif est déjà refusé).
- **Annulation de facture** : voir l'addendum S1 de l'ADR 0015.

### 8. Annuaire praticiens et filtres (C.1, C.6)

- `GET /centers/{c}/practitioners/` — tout staff actif, memberships ACTIFS de rôles cliniques, payload minimal `{id, display_name, role, avatar}` (id = membership), NON paginé (alimente un sélecteur). Jamais de téléphone ni d'état d'activation (ça reste l'écran directeur).
- Filtres : `encounters?patient=&date=&practitioner=`, `invoices?patient=&status=`, `payment-requests?status=`, `disputes?status=` — valeur invalide → 400 par champ (jamais 500), id étranger → liste vide (pattern `?practitioner=` de scheduling, aucune sonde cross-tenant).
- Plage RDV : `appointments?from=&to=` (jours locaux Comores INCLUSIFS, bornes exigées ensemble, max 62 jours, exclusif de `?date=` — mélange → 400, jamais une précédence silencieuse).
