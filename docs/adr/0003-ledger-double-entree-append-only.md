# ADR 0003 — Ledger en double entrée, append-only

- **Statut** : acté — renforcé par l'ADR 0006 (2026-08-13)
- **Date** : 2026-08-12

## Contexte

Le Pont de Confiance repose sur une promesse : « chaque franc envoyé est relié à un patient, un acte et un prestataire, avec un reçu vérifiable ». Un montant stocké dans un champ mutable peut être réécrit — c'est exactement l'opacité que le produit combat. Le flux traverse en outre deux devises (EUR payé par le tuteur, KMF reçu par le centre) avec un taux qui doit être figé et visible (étude des besoins §4.5).

## Décision

- **Double entrée** : toute opération financière = une `LedgerTransaction` portant ≥ 2 `LedgerEntry` (compte énuméré, sens débit/crédit, montant `DecimalField`, devise explicite EUR/KMF, taux appliqué le cas échéant). L'équilibre débits = crédits est validé **par devise** à la création, via l'unique point d'entrée `LedgerTransaction.record(...)` (transaction atomique).
- **Append-only** : `LedgerTransaction`, `LedgerEntry`, `Receipt` et `AuditLog` héritent d'`AppendOnlyModel` — `save()` refuse toute mise à jour d'une ligne existante (INSERT forcé), `delete()` refuse toujours, et le queryset refuse `update()`/`delete()`/`bulk_update()` ainsi que `bulk_create(update_conflicts=True)` (UPDATE déguisé en `ON CONFLICT DO UPDATE`). Une correction = une transaction inverse, jamais une édition. L'admin Django reflète le même verrou (pas de modification ni de suppression). Depuis l'ADR 0006, des **triggers PostgreSQL** doublent ce verrou au niveau base : même le SQL brut ne peut plus muter ces tables.
- **Jamais de `Float`** : tous les montants sont des `DecimalField` (2 décimales, taux de change à 6 décimales), chaque montant porte sa devise. Uniformité assumée : le KMF n'a pas de subdivision en pratique — la contrainte « pas de décimales en KMF » sera portée par les serializers, pas par le schéma.
- **PSP = abstraction** : `PaymentIntent` porte le PSP (Stripe d'abord), la référence PSP, le taux EUR→KMF figé avant paiement et une **clé d'idempotence unique** (webhooks rejoués et doubles soumissions ne créent jamais deux paiements).
- **Reçus** : `Receipt` immuable, numéroté séquentiellement **par centre** (verrou `select_for_update` sur le centre dans `Receipt.issue()`), en double devise avec frais explicites et taux appliqué. Depuis l'ADR 0006 : FK **obligatoire** `ledger_transaction` vers la transaction de clôture (le reçu se réconcilie avec le ledger) et `CheckConstraint` de positivité (montants > 0, frais ≥ 0, taux > 0).
- **Fléchage par centre** : `LedgerTransaction.center` (nullable, `PROTECT`) est renseigné automatiquement par `record()` depuis la facture de la demande de paiement ; `LedgerTransaction.objects.for_center()` sert le reporting par tenant.
- Les statuts métier (`Invoice.status`, `PaymentRequest.status`) restent des champs mutables : ce sont des états de workflow, pas des vérités financières — la vérité, c'est le ledger. En revanche, les **montants** d'une `Invoice` sortie du brouillon sont figés (`save()` refuse, lignes verrouillées) : le statut bouge, jamais les chiffres.

## Conséquences

- Aucun service ne PEUT créer des `LedgerEntry` directement : la création est verrouillée sur le chemin `LedgerTransaction.record()` (fenêtre d'écriture privée du module, ADR 0006) — la consigne est devenue une contrainte structurelle. Les tests (`test_ledger.py`, `test_hardening.py`) verrouillent l'équilibre, le rejet des montants ≤ 0 et l'immuabilité.
- Le rapprochement caisse ↔ paiements en ligne (parade anti-détournement §4.3) se fera en interrogeant le ledger, source de vérité unique quel que soit le rail de paiement.
- Le volume de lignes croît sans jamais décroître : prévoir l'archivage/partitionnement bien plus tard, jamais la purge.
