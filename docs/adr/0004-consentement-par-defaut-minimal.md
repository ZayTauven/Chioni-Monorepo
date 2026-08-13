# ADR 0004 — Consentement : portée minimale par défaut

- **Statut** : acté — complété le 2026-08-13 (révocation en cascade, nature générique matérialisée par l'ADR 0005)
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
