# ADR 0015 — Caisse du centre : l'encaissement généralisé recouvre le Pont de Confiance

- **Statut** : acté (vague 2a « Gâter les centres »)
- **Date** : 2026-08-13

## Contexte

L'étude §5.1 classe [M] « Facturation et caisse : facture par acte, encaissement (espèces, mobile money, Pont de Confiance), journal de caisse ». Jusqu'ici seul le rail diaspora existait (`PaymentRequest` → webhook PSP → ledger, ADR 0009) : un patient qui paie en espèces au comptoir n'existait pas dans le système, alors que c'est le cas MAJORITAIRE comorien — souvent par tranches. Cadrage PO ferme : l'encaissement est le concept général, le paiement diaspora un cas particulier qu'on RECOUVRE sans le casser ; nouveaux comptes `caisse_especes`, `mobile_money`, `creances_patient` créés uniquement via `LedgerTransaction.record()` ; jamais d'annulation (contre-passation) ; reçu guichet dédié en série séparée.

## Décisions

### 1. Localisation : `apps/trustbridge`, aucun modèle déplacé

Les trois nouveaux modèles (`CashPayment`, `CashPaymentReversal`, `CashReceipt`) vivent dans `apps/trustbridge`, pas dans une app nouvelle. L'ADR 0003 fait déjà du ledger « la source de vérité unique quel que soit le rail de paiement » et le rapprochement caisse ↔ paiements en ligne est une parade anti-détournement de l'étude (§4.3) : la caisse est le MÊME contexte borné que l'argent diaspora — mêmes triggers, même fenêtre d'écriture E4, même admin verrouillé. Une app séparée aurait coupé cette sémantique en deux pour un bénéfice nul et un churn de migrations interdit par le cadrage.

### 2. Le modèle unifié : `CashPayment`, append-only, adossé à SA transaction

- `method` : `especes` | `mobile_money` (+ `operator` : enum simple extensible `huri`/`mvola`/`autre` — les rails locaux sont encore à l'étude §4.6) | `pont_confiance`.
- **Append-only + triggers PostgreSQL** (migration `trustbridge/0007`, même fonction `trustbridge_forbid_mutation()` que l'ADR 0006) sur les trois tables : un encaissement ne se corrige QUE par contre-passation, même en SQL brut.
- Chaque encaissement porte une FK **obligatoire** vers sa `LedgerTransaction` équilibrée. Pour `pont_confiance`, c'est la transaction d'encaissement diaspora EXISTANTE (fonds_tuteur → du_au_centre) : **jamais deux écritures pour le même franc**.
- Contraintes DB : montant > 0 ; `operator` porté ssi mobile money ; `payment_intent` porté ssi `pont_confiance`. Le `center` est dénormalisé depuis la facture (garde `save()`), jamais une entrée client.
- `register_payment_success()` crée désormais le `CashPayment` `pont_confiance` (montant = KMF de l'intent, `received_by=None`) dans le MÊME bloc atomique que le ledger — la machine à états, les entrées du ledger diaspora et les triggers existants sont inchangés (les 181 tests trustbridge antérieurs passent tels quels).

### 3. Schéma comptable : dérivation des impayés, pas d'écriture à l'émission

Deux options étaient sur la table ; **la dérivation est retenue** :

- **Encaissement guichet** : `DEBIT caisse_especes|mobile_money / CREDIT creances_patient` (KMF, équilibré par `record()`).
- **Contre-passation** : écriture inverse exacte (`DEBIT creances_patient / CREDIT caisse|momo`).
- **Aucune écriture à l'émission de la facture.** La facture émise — gelée par le trigger R3 (`total_kmf` immuable hors brouillon) — EST le débit de créance ; le compte `creances_patient` du ledger enregistre les remboursements de cette créance. **Solde restant = `total_kmf` − Σ encaissements non contre-passés** (`invoice_balance_kmf()`, seule dérivation légale — aucun champ mutable « reste dû » nulle part).
- Pourquoi pas la créance au ledger à l'émission : il aurait fallu soit créer un compte de produits nouveau, soit créditer `du_au_centre` à l'émission — ce qui aurait pollué sa sémantique diaspora précise (dette de la plateforme envers le centre) et exigé de modifier les écritures existantes de `register_payment_success` (double crédit du même compte pour le même soin). La dérivation est « le plus simple qui reste vrai » : le ledger n'enregistre que l'argent qui BOUGE, cohérent avec l'ADR 0003 (les états métier sont des champs de workflow, la vérité financière est le mouvement).
- **Vague 2b (impayés)** : requête directe — factures `emise` dont `invoice_balance_kmf() > 0` ; le détail par méthode se lit dans le ledger (`for_center()` + comptes caisse).
- Pas de KYC exigé pour un encaissement guichet : l'argent ne transite jamais par la plateforme, il entre directement dans la caisse du centre (le KYC reste exigé sur le rail diaspora, inchangé).

### 4. Paiement partiel : le verrou de la facture est LE point de sérialisation

- Un encaissement ne dépasse JAMAIS le solde restant ; la facture passe `payee` atomiquement quand le solde tombe à zéro (`record_cash_payment`, un seul bloc).
- **Deux caissiers** : `record_cash_payment` re-lit la facture sous `select_for_update` — le second re-calcule le solde APRÈS le commit du premier (test à threads réels : jamais de dépassement cumulé).
- **Caissier vs webhook PSP** : le devis et l'intent diaspora sont figés sur le **solde restant au moment de leur création** ; `_register_payment_success` verrouille la ligne facture et **re-vérifie que `intent.amount_kmf == solde courant`** avant d'écrire un franc. Solde changé (tranche guichet ou contre-passation entre-temps) → refus 400 SANS écriture + AuditLog `payment.webhook_refused` (`refusal="balance_changed"`, références seules) — le provider a pu débiter le tuteur : cette ligne est la pièce de réconciliation (pattern ADR 0009).
- **Garde miroir anti-double-débit côté guichet** : un intent `cree`/`en_cours` plus récent que `PSP_INTENT_GUARD_MINUTES` sur la demande de la facture **bloque l'encaissement guichet** (« Un paiement diaspora est en cours… »). Justification : le MVP n'a pas de flux de remboursement — mieux vaut faire patienter le comptoir quelques minutes que débiter un tuteur pour rien. Course résiduelle assumée : un intent commité entre la garde et notre commit (verrous sur des lignes différentes : l'intent verrouille la demande, la caisse verrouille la facture) — c'est exactement ce que le re-check du webhook ferme. Ordres d'acquisition sans cycle : caisse = facture → centre ; webhook = intent → demande → facture ; clôture = demande → centre.
- `send_payment_request` refuse une facture au solde nul (jamais de SMS « demande à payer » pour une facture qui ne doit rien). **Limitation assumée** : une demande DÉJÀ `envoyee` dont la facture est ensuite réglée au guichet reste `envoyee` (pas de transition d'annulation dans la machine ADR 0009) — devis et paiement répondent 400 « déjà entièrement réglée », le frontend l'affiche honnêtement.

### 5. Contre-passation : la seule correction, effet de statut documenté

- `CashPaymentReversal` : OneToOne vers l'encaissement (**une seule contre-passation par encaissement**, contrainte DB race-safe), motif texte OBLIGATOIRE, transaction inverse équilibrée, ligne append-only + trigger. Pas de contre-passation de contre-passation : structurellement irreprésentable (une contre-passation n'est pas un encaissement).
- **Effet honnête sur la facture** : si elle était `payee` et que le solde redevient > 0, elle revient à `emise` — l'argent est de nouveau dû et la caisse le dit. Cas mixte documenté : une facture soldée par le diaspora (demande `payee`) dont une tranche guichet antérieure est contre-passée revient `emise` alors que la demande reste `payee` (SA part a bien été encaissée) ; comme une seule demande par facture est permise, le reliquat se recouvre au guichet.
- Un encaissement `pont_confiance` ne se contre-passe JAMAIS au guichet : le rail diaspora a ses remèdes (litige, futur refund Stripe) et sa machine à états n'a pas de retour arrière depuis `payee`.
- Motif : visible du staff du centre (c'est leur caisse), **jamais dans le payload d'audit** (ADR 0007 — testé).

### 6. Reçu guichet : série « G- » séparée, réconciliée, un reçu par encaissement guichet

- `CashReceipt` : KMF pur, OneToOne vers l'encaissement, numérotation séquentielle par centre **race-safe** (verrou de la ligne centre, même discipline que `Receipt.issue`) dans une table SÉPARÉE — préfixe d'affichage « G- » (`G-000001`). Pourquoi une série séparée : les deux documents n'ont pas la même forme (double devise vs KMF pur) et entrelacer les numérotations ferait ressembler un trou d'une série à une fraude dans l'autre ; deux contraintes uniques distinctes rendent chaque série individuellement continue et auditable.
- **Réconcilié M1/M3** : `CashReceipt.issue()` relit les écritures de la transaction (débit du compte caisse de la méthode, KMF) et refuse un reçu que le ledger ne corrobore pas — même exigence que le reçu diaspora.
- L'encaissement `pont_confiance` n'a PAS de reçu guichet : son reçu est le reçu double devise émis à la clôture (ADR 0009) — **jamais deux reçus pour le même franc**. Un reçu contre-passé n'est pas détruit (append-only) : il est exposé avec `reversed: true` côté patient.

### 7. API (pattern ADR 0008, rôles BILLING = directeur, secrétaire, caissier)

- `POST/GET /centers/{c}/invoices/{pk}/payments/` — 201 avec reçu embarqué ; 400 explicites (dépassement, brouillon/annulée/réglée, `pont_confiance` au guichet, opérateur, décimales KMF, diaspora en cours).
- `POST .../payments/{pk}/reverse/` `{reason}` — 201 ; garde d'unicité ; 404 déterministe hors périmètre (centre ET facture).
- `GET /centers/{c}/cash-journal/?date=` — défaut aujourd'hui en heure Comores (bornes locales, pattern ADR 0013 réutilisé sans toucher `apps/scheduling`) ; tous moyens confondus ; contre-passations du jour visibles et signées (même sur un encaissement d'un autre jour) ; totaux encaissé/contre-passé/net par méthode + total.
- `GET /patients/me/cash-receipts/` — le patient voit ses reçus guichet. **Le tuteur ne les voit pas** : sa portée `paiements` n'ouvre que les demandes qui LUI sont partagées — ce que le patient paie de sa poche au comptoir ne le regarde pas (« aider mieux, jamais surveiller »).
- `InvoiceStaffSerializer` expose `paid_kmf`/`balance_kmf` (dérivés, jamais stockés). Les serializers tuteur/patient existants sont inchangés (contrats de champs verrouillés par tests) : côté tuteur, **le devis fait foi** pour le montant à payer.
- Pas de SMS pour un encaissement guichet : le patient est au comptoir et repart avec son reçu (ADR 0012 inchangé pour le rail diaspora).

### 8. Audit

`cash_payment.recorded` et `cash_payment.reversed` (références, montants, devise, solde après — jamais le motif ni une PII) ; le `payment.recorded` diaspora porte désormais aussi `cash_payment_id` (un seul événement d'audit pour un seul encaissement — pas de double journalisation).

## Conséquences

- Migrations `trustbridge/0006` (modèles + choices comptes, réversible) et `0007` (triggers, réversible).
- `tests/test_cash_payments.py` (37) + `tests/test_cash_api.py` (34) verrouillent : équilibre par méthode, solde/dépassement, `payee` à zéro, concurrence réelle (2 caissiers ; caissier vs webhook via re-check), contre-passation (unicité, motif, statut), séries de reçus séparées et race-safe, journal (bornes locales, totaux, tenant), immuabilité ORM + SQL brut, non-régression diaspora (suite complète : 754 tests).
- Vigilance de revue permanente : toute nouvelle vue caisse dérive le solde de `invoice_balance_kmf()` et n'écrit que via `record_cash_payment`/`reverse_cash_payment` ; ne jamais exposer un reçu guichet à un tuteur.
- Reste ouvert (hors périmètre) : transition d'annulation d'une demande `envoyee` sur facture réglée ; rapprochement bancaire mobile money (référence opérateur saisie mais non vérifiée) ; mode dégradé hors-ligne de la caisse (exigence §8 de l'étude, chantier dédié).

## Addendum vague 2b — endpoints de pilotage (lecture seule, 2026-08-13)

Trois endpoints de lecture (`/centers/{c}/stats/activity/`, `/stats/finances/`, `/invoices/unpaid/` — module `apps/centers/stats_views.py` + vue impayés dans `apps/trustbridge/views.py`), aucun modèle, aucune écriture, pas d'AuditLog. Décisions non évidentes actées :

1. **Dérivation SQL des impayés** : `services.unpaid_invoices_qs(center)` est le miroir ensembliste de `invoice_balance_kmf()` (sous-requête `Sum` des encaissements non contre-passés annotée sur chaque facture `emise`, filtre solde > 0). L'accord ligne à ligne entre l'annotation et la dérivation unitaire est verrouillé par test (`test_sql_balance_agrees_with_invoice_balance_kmf`). Toute nouvelle vue de masse passe par ce helper, jamais par un appel de `invoice_balance_kmf()` par ligne (N+1).
2. **« Facturé de la période »** : la facture n'a pas d'horodatage d'émission (seul le statut bouge) — le facturé est pris sur `created_at` des factures `emise`/`payee`. Imprécision assumée (un brouillon émis plus tard compte à sa date de création) : au guichet comorien la facture est créée et émise dans la foulée ; si un vrai besoin d'`issued_at` émerge, ce sera un champ posé par `issue_invoice`, pas une lecture de l'audit.
3. **Contre-passations dans les stats** : mêmes règles que le journal — les recettes ne comptent que les encaissements non contre-passés, et les contre-passations FAITES dans la période sortent dans un champ dédié (`reversals`), jamais soustraites en silence.
4. **`new_patients` (activité)** : patients créés au guichet de CE centre (`created_by_center`, doublons absorbés exclus). Un patient arrivé par un autre canal (porte A/B) qui consulte au centre n'y compte pas — c'est le compteur d'enregistrements du guichet, pas un compteur de « premières visites » (dérivation Min(occurred_at) par patient, refusée pour l'instant : complexité sans demande).
5. **Téléphone patient masqué sur la liste des impayés** : le registre patient expose déjà le numéro complet fiche par fiche ; une liste de masse orientée relances ne doit pas être un annuaire moissonnable — même helper de masquage que les guardian-links.
6. **Permissions** : activité = tout staff actif (même périmètre que la file du jour, aucune donnée financière dans le payload) ; finances + impayés = rôles BILLING (le pilotage financier est une vue exploitation — symétrique du cloisonnement clinique R-API-1 : le médecin reçoit 403).
7. **Fenêtre commune** : `?from=&to=` jours locaux Comores inclusifs (pattern ADR 0013 réutilisé sans toucher `apps/scheduling`), défaut 30 jours, max 366, séries zéro-remplies, dates invalides/impossibles/hors calendrier → 400 par champ. `unpaid` reste une photo à l'instant T, indépendante de la fenêtre.

Tests : `tests/test_center_stats.py` (39) — exactitude des agrégats (multi-statuts, tranches + contre-passation + diaspora, factures partiellement soldées), bornes 00h30/23h30 locales, fenêtre, permissions par casquette, cloisonnement tenant, accord SQL↔dérivation, centre vide, comptes de requêtes exacts (6/6/4 — aucun N+1).

## Addendum S1 — Annulation de facture, idempotence guichet, intégralité tarif (2026-08-13)

### 1. Annulation de facture — le chemin de refacturation propre

`POST /centers/{c}/invoices/{pk}/cancel/` (rôles BILLING, motif OBLIGATOIRE) via le service `cancel_invoice` — le premier code qui atteint `Invoice.Status.CANCELLED` (jusqu'ici testé défensivement en 4 endroits mais jamais assigné). Tout sous le verrou de la ligne facture (LE point de sérialisation de la caisse) :

**Conditions strictes** :
- jamais sur une facture `payee` (contre-passez d'abord les encaissements guichet ; le rail diaspora passe par un litige) ni déjà `annulee` ;
- jamais tant qu'un encaissement ACTIF (non contre-passé) existe — contre-passer d'abord garde l'histoire de chaque franc explicite ;
- jamais si la demande liée est `payee`/`soin_confirme`/`cloturee`/`litige` (de l'argent a bougé ou un désaccord est ouvert) ;
- garde miroir anti-double-débit : un intent `cree`/`en_cours` < `PSP_INTENT_GUARD_MINUTES` bloque l'annulation quelques minutes (un tuteur en plein 3DS ne doit pas être débité vers un refus — le MVP n'a pas de refund).

**Cas demande `envoyee` — tranché honnêtement** : l'annulation est PERMISE. Le rail diaspora est déjà structurellement fermé sur facture annulée (revue 2a) : devis → 400, `pay/` → 400, webhook tardif → 400 + AuditLog `payment.webhook_refused` (`refusal="invoice_cancelled"`, pièce de réconciliation). La demande RESTE `envoyee` (pas de transition d'annulation dans la machine ADR 0009 — limitation §4 inchangée) : le tuteur qui ouvre le devis reçoit le 400 honnête « Cette facture a été annulée par le centre ».

**Pas de SMS** : la règle actée est « le contenu d'un SMS suit la visibilité dans l'app, jamais l'inverse » (ADR 0012). L'app ne présente AUCUN événement « annulation » au tuteur (la demande garde son statut ; seul le devis répond 400) — donc aucun SMS ne part. Si une vue tuteur « demande annulée » naît un jour, le SMS viendra AVEC elle, pas avant. Verrouillé par test (`sms_outbox == []`).

**Traçabilité** : motif stocké SUR la facture (`cancel_reason` + `cancelled_at`/`cancelled_by`, exposés au staff seul), audit `invoice.cancelled` références-only (le motif n'entre JAMAIS dans le payload — même règle que contre-passation et litige). Effet libérateur : les actes de la facture annulée redeviennent facturables (`create_invoice` exclut déjà les factures annulées) — c'est la refacturation propre. Une facture annulée refuse toute nouvelle demande de paiement (« émise » exigée, inchangé).

### 2. Idempotence guichet (vigilance 2a soldée)

Champ optionnel `idempotency_key` (≤ 64 car.) sur `POST /centers/{c}/invoices/{pk}/payments/`, stocké sur `CashPayment`, **unique par centre** (contrainte DB partielle `unique_cash_idempotency_key_per_center`, NULL exclus — deux centres peuvent réutiliser la même clé sans se coupler).

- **Rejeu nominal** : même clé → **200** avec l'encaissement DÉJÀ créé et le MÊME reçu — jamais un second encaissement, jamais une seconde transaction du ledger, jamais un second événement d'audit (le rejeu est une lecture). La résolution du rejeu se fait APRÈS le verrou de la ligne facture et AVANT les contrôles d'état — le rejeu du paiement qui a SOLDÉ la facture répond 200, jamais « déjà réglée » (c'est le cas timeout-retry pour lequel la feature existe).
- **Clé réutilisée à tort** (autre facture, autre montant, autre méthode/opérateur) → 400 explicite — jamais de « fusion » silencieuse vers le mauvais encaissement.
- **Concurrence** : même facture → sérialisée par le verrou facture (le second trouve la ligne du gagnant, test à 2 threads réels : un seul encaissement, les deux appels tiennent le même). Factures différentes, même clé → la contrainte DB arbitre : le perdant voit son IntegrityError, sa transaction ENTIÈRE (ledger compris) est annulée, et le wrapper hors-transaction relit le gagnant → 400 de non-concordance (test à threads réels : un seul encaissement, zéro écriture orpheline).
- Un encaissement `pont_confiance` ne porte JAMAIS de clé guichet (le rail diaspora a son `PaymentIntent.idempotency_key`).
- Sémantique DRF assumée : en JSON une clé vide explicite → 400 ; en form-data `""` équivaut à « champ absent » (comportement HTML standard de DRF) → traité comme sans clé.

### 2 bis. Passe guardian S1 — trois courses fermées, un contrat élargi

Revue adversariale du sprint (probes pérennes : `tests/test_adversarial_s1.py`) :

- **`create_payment_intent` prend le verrou de la ligne FACTURE** (ordre demande → facture, le même que le webhook — aucun cycle) : sans lui, une annulation à la caisse pendant qu'un tuteur est dans `pay/` ne voyait aucun intent (pas encore commité), passait, et le tuteur était débité vers un refus webhook garanti (pas de refund en MVP) — entrelacement démontré déterministe par probe. Le gel du solde de l'intent se lit désormais sous ce même verrou (plus de solde périmé face à un encaissement guichet simultané).
- **`send_payment_request` lit la facture sous le même verrou** : une annulation commitée dans la fenêtre d'envoi ne laisse plus partir le SMS « demande envoyée » pour une facture morte.
- **`create_invoice` prend le verrou de la ligne CONSULTATION** : le contrôle « acte déjà porté » ne vaut que sérialisé — deux `create_invoice` simultanés sur la même consultation produisaient DEUX factures vivantes des mêmes actes (double facturation, probe à threads réels).
- **La RÉFÉRENCE entre dans le contrat d'idempotence** : une clé rejouée avec une autre référence désigne une AUTRE transaction mobile money — la « fusionner » silencieusement effaçait le second versement des livres. Désormais 400 de non-concordance, comme montant/méthode/opérateur/facture.
- **`cancel_reason` réservé aux rôles BILLING en lecture** (serializer par rôle, pattern R-API-1) — voir ADR 0008 §3.

### 3. Intégralité tarif au niveau base (vigilance 2a soldée)

`CheckConstraint` `tariff_price_kmf_integral` (`price_kmf = ROUND(price_kmf)`) sur `TariffItem` — la garde `save()`/serializer existait, mais `update()`/`bulk_create()` la contournaient (l'angle mort exact sondé par la revue 2b). La migration `centers/0004` fait précéder la contrainte d'un garde `RunPython` qui **REFUSE de s'appliquer** (message FR listant les lignes) tant que des tarifs fractionnaires existent — **jamais d'arrondi silencieux** : un prix est une décision du centre, seul un humain le corrige. La probe wave2b « ligne fractionnaire pré-existante » a été reconvertie : le contournement tarif est désormais fermé (IntegrityError testé) ; le résidu historique possible reste la vieille `InvoiceLine` fractionnaire (instantané sans contrainte), dont la dégradation honnête (solde 0,50 visible, jamais « payée ») reste testée telle quelle.
