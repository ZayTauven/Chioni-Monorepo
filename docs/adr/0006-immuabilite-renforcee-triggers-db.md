# ADR 0006 — Immuabilité renforcée : verrous ORM complets + triggers PostgreSQL

- **Statut** : acté
- **Date** : 2026-08-13

## Contexte

L'ADR 0003 posait l'append-only au niveau ORM (`AppendOnlyModel`). La revue adversariale a démontré trois contournements réels :

1. **C1** — `bulk_create(update_conflicts=True)` compile en `INSERT ... ON CONFLICT DO UPDATE` : un UPDATE déguisé qui réécrivait une écriture du ledger.
2. **C2** — le SQL brut (ou toute autre connexion) mutait librement les tables « immuables » : aucune ceinture côté base.
3. **E4** — l'équilibre en double entrée n'était garanti que dans `LedgerTransaction.record()` : `LedgerEntry.objects.create()` posait un crédit orphelin non équilibré sans la moindre validation.

## Décision

- **C1** : `AppendOnlyQuerySet.bulk_create()` refuse `update_conflicts=True` (`AppendOnlyError`) pour tous les modèles append-only (ledger, reçus, journal d'audit).
- **C2 — ceinture-bretelles DB** : deux migrations `RunSQL` réversibles (`trustbridge/0002`, `audit/0002`) posent des triggers PostgreSQL `BEFORE UPDATE OR DELETE ... RAISE EXCEPTION` sur `trustbridge_ledgertransaction`, `trustbridge_ledgerentry`, `trustbridge_receipt` et `audit_auditlog`. Quel que soit le chemin (ORM, SQL brut, autre client), la base refuse la mutation. Le reverse supprime triggers et fonctions. Les triggers ligne à ligne ne se déclenchent pas sur `TRUNCATE` : les mécanismes de test (flush, teardown) sont inaffectés, et aucun chemin légitime ne fait d'UPDATE/DELETE sur ces tables (correction = transaction inverse).
- **Triggers de validation (contre-vérification du guardian)** : les gardes `save()`-only sont contournables par `QuerySet.update()` ; trois triggers de validation ferment les contournements prouvés (migrations réversibles `patients/0002`, `trustbridge/0003`) :
  - **R1** `trustbridge_paymentrequestshare_same_patient` (`BEFORE INSERT OR UPDATE`) — un partage doit viser un tuteur du patient facturé (jointure `payment_request → invoice` vs `guardian_link.patient_id`) : la règle de confidentialité E1 tient désormais en base ;
  - **R2** `patients_guardianlink_revoked_final` (`BEFORE UPDATE`) — aucune sortie de l'état `revoque` : un lien révoqué est définitif aussi pour le SQL brut ;
  - **R3** `trustbridge_invoice_frozen_outside_draft` (`BEFORE UPDATE`) — hors `brouillon`, `total_kmf` et les rattachements encounter/center/patient sont figés ; seule la transition de statut reste libre.
- **E4 — la double entrée devient une contrainte structurelle** : un flag privé de module (thread-local), ouvert uniquement par `LedgerTransaction.record()` autour de son bloc atomique, verrouille la création de `LedgerEntry`. Manager (`create()`, `bulk_create()`) et `save()` refusent toute écriture hors de cette fenêtre : impossible de poser une écriture non équilibrée, l'équilibre par devise validé par `record()` est le seul chemin.
- **M8 (connexe)** : `LedgerTransaction` porte désormais une FK `center` (nullable, `PROTECT`), renseignée automatiquement par `record()` depuis `payment_request.invoice.center`, avec un queryset `for_center()` — reporting et rapprochement caisse par tenant sans jointures fragiles.
- **M3 (connexe)** : `Receipt` porte une FK **obligatoire** `ledger_transaction` vers sa transaction de clôture, plus des `CheckConstraint` (montants > 0, frais ≥ 0, taux > 0) : un reçu est réconciliable avec le ledger, jamais seulement affirmé. L'égalité des sommes reçu ↔ écritures sera imposée par le service d'émission (probe F3 documentée).

## Conséquences

- La suite `tests/test_hardening.py` (ex-probes adversariales inversées) verrouille chaque contournement : `update_conflicts`, UPDATE/DELETE SQL bruts (erreur PostgreSQL), création directe de `LedgerEntry`.
- Un point de vigilance assumé : le flag E4 est thread-local — un code async multi-tâches sur un même thread partagerait la fenêtre pendant un `record()` ; le risque est théorique (la fenêtre n'est ouverte que le temps du bloc atomique) et les triggers DB restent la ceinture finale.
- Les environnements non-PostgreSQL (il n'y en a pas : dev, CI et prod sont sur PostgreSQL) ne bénéficieraient pas des triggers — les verrous ORM restent actifs partout.

## Addendum SV — Extension du socle EN BLOC (2026-08-16)

La dette « invariants ORM sans ceinture DB », consignée par CINQ revues (S3, S5, S6+S7, S9, S10), est soldée en un lot : **26 triggers** posés par 10 migrations `RunSQL` réversibles (`*_sv_db_triggers` par app + `accounts/0007`). **Règle d'or tenue : chaque trigger est le MIROIR d'un invariant ORM/service existant, jamais un invariant nouveau** — les tables mutables par conception sont consignées SANS trigger dans la docstring de la migration de leur app (`PatientMedicalFile`, `PatientInsurance`, `Department`, `JobTitle`, `Holiday`, `AttendanceRecord`, `Employment`, `Pharmacy`, `PharmacyMembership`, `AvailabilityRequest`, `PatientContactPreference`, `SupportTicket`/`SupportAttachment`).

- **Append-only** (`<app>_forbid_mutation()`, patron trustbridge/0002) : `medical_vitalsigns`, `billing_subscriptionpayment`, `billing_subscriptionpaymentreversal`, `support_supportmessage`, `inpatient_staydaybilling`, `pharmacy_availabilityrequestitem`, `pharmacy_availabilityrequestrecipient`, `pharmacy_availabilityresponse`, `pharmacy_availabilityresponseline`, `crm_contactlog`, `accounting_accountingexport` (**l'enjeu le plus haut du lot : le snapshot comptable est le seul objet du produit qui prétend survivre à l'application**), `equipment_equipmentreport`.
- **Archivage définitif** (DELETE refusé + `archived_at` jamais dé-posé ; l'UPDATE du champ fichier reste LIBRE — la purge RGPD S7 efface les octets et garde la ligne, prouvé par test) : `medical_patientdocument`, `hrm_leavedocument`, `pharmacy_pharmacydocument`.
- **États terminaux / décisions gelées** : `inpatient_stay` (sortie/annulé définitifs), `equipment_equipment` (réforme définitive — les autres champs restent corrigeables, miroir exact), `hrm_leaverequest` (statut + `decided_at`/`decided_by` gelés hors `demande` ; les DATES restent libres — reliquat import de masse assumé), `medical_prescription` (délivrance définitive), `accounts_erasurerequest` (issue définitive hors `en_attente`, `annulee` comprise).
- **Champs gelés** : `billing_subscriptioninvoice` (miroir de `_FROZEN_FIELDS` — inconditionnel, la facture naît émise), `inpatient_bedassignment` (`stay`/`bed`/`assigned_at` figés + `released_at` posé UNE seule fois — l'ORM a été ALIGNÉ d'abord : il ne refusait que la réouverture, pas la re-datation).
- **Garde de monotonie** : `accounting_accountingexportseries` (`last_number` ne recule jamais — compteur mutable par conception, rien de plus).

Chaque trigger est prouvé par un test qui tente l'`UPDATE`/`DELETE` **brut en SQL** et vérifie le refus PostgreSQL (`tests/test_sv_triggers.py`, 37 tests — patron `test_hardening.py`), plus les chemins légitimes (transition légale de séjour, purge RGPD d'un justificatif, correction d'une fiche réformée, incrément de série). Le contournement `QuerySet.update()` est arrêté par la BASE sur les modèles non-`AppendOnlyModel`.
