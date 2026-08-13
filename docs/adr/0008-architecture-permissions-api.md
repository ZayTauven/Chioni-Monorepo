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
