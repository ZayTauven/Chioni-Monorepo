# ADR 0004 — Consentement : portée minimale par défaut

- **Statut** : acté — complété le 2026-08-13 (révocation en cascade, nature générique matérialisée par l'ADR 0005) ; addendum S2 (consentement recueilli au guichet)
- **Date** : 2026-08-12

## Contexte

« Payer n'est pas tout savoir » (étude des besoins §4.4) : le tuteur finance les soins mais le secret médical reste la règle. C'est le cœur éthique du produit — la confiance financière ne s'achète pas au prix de l'intimité médicale. Cette règle doit vivre dans le backend (modèles + permissions), jamais seulement dans le frontend.

## Décision

- Un `GuardianLink` **actif** n'ouvre par défaut que la portée minimale `paiements` : demandes de paiement, montants, nature générique de l'acte (champ `generic_category`, ADR 0005 — jamais le libellé détaillé), reçus. Cette portée ne se stocke pas : elle découle du lien actif.
- Le ciblage d'un tuteur sur une demande de paiement passe par le through-model `PaymentRequestShare`, qui garantit structurellement qu'une demande ne se partage qu'avec un tuteur **du patient facturé** (horodatage et auteur du partage tracés).
- Une ligne `medical.Consent` matérialise un octroi **étendu** (`detail_clinique` : ordonnances détaillées, éléments du carnet), accordé par le patient, horodaté, **révocable** (`revoked_at`) — la ligne révoquée est conservée pour la traçabilité, et une contrainte partielle interdit deux octrois actifs identiques sur un même lien.
- **Point de vérité unique** : `Consent.objects.active_scopes(guardian_link)` (et son raccourci `allows(link, scope)`) — retourne l'ensemble vide si le lien n'est pas actif, sinon `{paiements}` plus les portées explicitement accordées et non révoquées. Les classes de permission DRF (session suivante) appelleront exclusivement ce helper : la règle n'est **jamais** re-dérivée ailleurs.
- Intégrité : un consentement doit porter sur le patient du lien (validé à la sauvegarde), et un octroi/une révocation devront écrire dans l'`AuditLog` au niveau des services API.

## Conséquences

- La révocation est effective immédiatement (les tests `test_consents.py` le verrouillent), et la portée minimale survit à la révocation de l'octroi étendu tant que le lien reste actif.
- **Révocation du lien = révocation en cascade** : `GuardianLink.revoke()` révoque atomiquement le lien ET tous ses consentements actifs — aucun octroi clinique périmé ne peut survivre en sommeil. Un lien révoqué est **définitif** (`save()` interdit toute sortie de l'état révoqué) : ré-établir une tutelle exige un nouveau lien, donc une nouvelle base de consentement (tests `test_hardening.py::TestLinkRevocationClosed`).
- Les cas particuliers (mineurs, patients hors d'état de consentir, pathologies sensibles) sont hors périmètre de ce modèle MVP : ils s'ajouteront comme portées ou régimes supplémentaires SANS élargir le défaut.
- Toute nouvelle donnée exposée à un tuteur devra déclarer sa portée (`paiements` ou `detail_clinique`) — l'oubli doit se voir en revue (`chioni-health-data-guardian`).

## Addendum S2 — Consentement clinique recueilli au guichet (2026-08-13)

**Trou fermé (audit C.4)** : un patient NON revendiqué ne pouvait jamais accorder `detail_clinique` (les endpoints de consentement exigent `IsPatientSelf`), et le centre n'avait aucun moyen d'enregistrer un consentement recueilli au guichet. Le cas nominal porte A/porte C (Mariama, sans smartphone) était sans solution.

### Décision

`POST|DELETE /centers/{c}/patients/{pk}/consents/clinical/` (rôles BILLING — le recueil se fait au guichet), corps `{guardian_link, collected_via}` (`collected_via` ∈ `{papier, oral}` ; DELETE : `{guardian_link}` seul). Conditions STRICTES :

- patient du **périmètre du centre** (référence d'URL → 404 sinon) ;
- patient **NON revendiqué UNIQUEMENT** — un profil revendiqué gère lui-même ses consentements : le guichet reçoit un 400 explicite (« Ce patient gère lui-même ses consentements depuis son espace. ») sur les deux verbes ;
- `guardian_link` = lien **ACTIF de ce patient** — référence de corps → 400 unique, byte-identique pour un lien étranger, révoqué, en attente ou inexistant (norme S1, vérifié par test d'égalité des corps).

### Extension du modèle (et ses limites)

`Consent` gagne deux champs de **trace de recueil** : `collected_by` (FK User — l'agent du guichet) et `collected_via` (`papier`/`oral`). Tous deux **vides sur le chemin historique** (le patient accorde depuis son espace) : la sémantique de l'octroi est IDENTIQUE — `active_scopes()` reste LE point de vérité, aucun régime parallèle. Le mode `oral` est assumé comme le plus faible des deux (aucune pièce) : c'est la trace honnête de la réalité du guichet, pas une preuve — la protection réelle est la réversibilité ci-dessous. Audit obligatoire : `consent.granted_by_center` / `consent.revoked_by_center` (références + code du mode de recueil uniquement, jamais de contenu).

### Réversibilité (l'invariant éthique, verrouillé par test)

Un consentement recueilli par le centre **meurt à l'instant où le patient prend possession de son profil**, par HÉRITAGE de la porte de confirmation du titulaire (OTP-1) : les trois portes (revendication OTP, fusion — lien déplacé sur cible revendiquée, fusion — transfert du titulaire) suspendent le lien et révoquent ses consentements actifs, guichet compris. La confirmation ultérieure du lien par le titulaire ne restaure QUE la portée minimale `paiements` — jamais le `detail_clinique` recueilli au guichet (ré-octroi explicite requis, par le patient seul désormais). Le retrait au guichet reste possible à tout moment tant que le profil n'est pas revendiqué (`DELETE`). Tests : `tests/test_center_clinical_consent.py::TestClaimGateInvariant`.

## Addendum SV — Les deux arbitrages PO de S2, implémentés (2026-08-16)

Les deux arbitrages tranchés par le PO le 14/08/2026 (consignés en SV.1 de l'audit) entrent dans le code.

### SV.1.1 — Consentement guichet interdit sur un lien initié par le centre lui-même (option b)

**La chaîne « le centre fabrique le tuteur » est fermée** : le même guichet ne peut pas inviter le tuteur PUIS lui ouvrir la sphère clinique, le patient nulle part dans la boucle.

- **Provenance tracée** : `GuardianLink.initiated_by_center` (FK nullable vers `HealthCenter`), posée par `invite_guardian` quand `initiated_by = centre` (porte C), NULL pour les portes A/B. **Aucun rétro-remplissage** (l'histoire ne se réécrit pas — même posture qu'ADR 0017 pour `AuditLog.center`).
- **La garde vit dans le service** (`grant_clinical_consent_at_center`), SOUS les relectures `select_for_update` posées en S2 (le TOCTOU revendication×octroi reste fermé, la provenance est immuable). Refus explicite si `initiated_by = centre` ET (`initiated_by_center` = ce centre OU NULL).
- **Fail-closed sur la provenance inconnue** : un lien historique porte C sans `initiated_by_center` ne peut pas être prouvé étranger — refuser un octroi de consentement clinique est toujours la posture du produit. Le corps du refus est **byte-identique** entre « centre initiateur » et « provenance inconnue » (le refus ne dit pas si la provenance est connue).
- **Le centre B reste libre** (sous toutes les autres règles) : la garde vise le conflit d'intérêts du CENTRE, pas le lien ni la personne — un staff multi-centres est refusé au guichet de A et accepté au guichet de B (testé). Le RETRAIT reste ouvert au centre initiateur (révoquer ne fait que retirer une portée).
- Tests : `tests/test_center_clinical_consent.py::TestSelfInitiatedLinkGuard` (dont la course réelle A×B à deux threads, sérialisée sur le verrou du lien).

### SV.1.2 — Papier signé obligatoire (mode `oral` supprimé)

- `collected_via` n'accepte plus que `papier` — au serializer (choix d'entrée réduit) ET au service (garde pour les appelants directs). Motivation PO : trace opposable, éviter les litiges des consentements oraux.
- **L'historique reste lisible** : le choix `oral` demeure sur le modèle (affichage), seule l'ENTRÉE le refuse.
- **Migration défensive** `medical/0005_revoke_oral_desk_consents` : tout consentement `oral` encore ACTIF est **révoqué à la migration, avec une entrée d'AuditLog par ligne** (`consent.revoked`, reason `collected_via_oral_retired_sv12`) — jamais requalifié en silence. Reverse no-op assumé (une révocation de consentement ne se rejoue pas à l'envers).
- L'option `oral` doit disparaître de l'UI — **à la charge de la vague frontend** (signalé au rapport SV).

### Lecture de l'état persistant (SV.2)

`GET /centers/{c}/patients/{pk}/consents/clinical/` (BILLING) : les consentements cliniques ACTIFS porteurs d'une trace de recueil guichet, sur les liens ACTIFS du patient. Les consentements accordés par le patient depuis son espace (`collected_via` vide) ne transitent JAMAIS ici — le guichet relit SES recueils. Un patient revendiqué se lit comme une liste vide (tout consentement guichet est mort à la revendication) : **lire n'est pas octroyer**, pas de 400 sur le GET. Rend aussi la garde SV.1.1 auditable (un lien auto-initié n'apparaît jamais dans cette liste).
