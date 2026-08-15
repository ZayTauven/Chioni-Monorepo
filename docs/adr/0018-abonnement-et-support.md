# ADR 0018 — Abonnement SaaS et module Support (sprint S5)

- **Statut** : acté (cadrage S5 — les 3 arbitrages structurants sont TRANCHÉS PAR LE PO le 2026-08-14)
- **Date** : 2026-08-14
- **Sources** : audit §B.6 + §F.5 + §G/S5, étude des besoins §5.4, ADR 0003 (ledger), 0012 (SMS),
  0014 (uploads), 0015 (caisse), 0017 (tenant de plein droit)

## Contexte

Chioni vend un abonnement à des centres de santé, et rien dans le produit ne le modélise :
pas de plan, pas d'échéance, pas d'état commercial du tenant, aucune facturation
Chioni → centre, aucun canal de support. L'ADR 0017 a posé la 4ᵉ casquette et a explicitement
renvoyé à S5 « la sanction commerciale (couper l'accès) » et la fermeture des deux dernières
portes d'écriture de l'admin Django. C'est le moment de les traiter — sans trahir l'arbitrage
qui a fondé S4 : **suspendre ne doit jamais empêcher de soigner.**

## Arbitrages du PO (14/08/2026)

1. **Factures SaaS dans l'app, règlement hors ligne.** Chioni émet, le centre consulte,
   l'exploitant enregistre les règlements reçus, les relances partent automatiquement. Le
   paiement en ligne du centre dépend des rails comoriens — risque n° 1 non instruit : on ne
   le présuppose pas.
2. **Grâce, puis gel de l'administratif — soin et caisse intacts.** Ce qui se ferme :
   personnel, tarifs, statistiques, exports. Ce qui reste **toujours** ouvert : consultations,
   carnet, rendez-vous, facturation patient, caisse, et la lecture/export de ses propres
   données.
3. **Quotas indicatifs, jamais bloquants.** Mesurés, affichés, alertés — mais inscrire un
   patient ou créer une consultation n'échoue jamais pour cause de plan.

## Décision 1 — Un registre séparé, jamais le ledger des soins

L'abonnement vit dans une **app dédiée** (`apps/billing`) avec ses propres tables. Il n'écrit
**aucune** `LedgerTransaction`, `LedgerEntry`, `Invoice`, `Receipt` ou `CashPayment`.

Quatre raisons, toutes tirées du code :

- **Le ledger est append-only à trois niveaux** (ORM, queryset, triggers PostgreSQL). Un cycle
  d'abonnement est mutable par nature : essai → actif → impayé → relancé → régularisé. L'y
  loger le figerait, et chaque correction deviendrait une écriture inverse.
- **Le fléchage du ledger est patient-centré** : `Receipt.payment_request` est un OneToOne
  obligatoire, `CashPayment.invoice` aussi. Une créance Chioni → centre n'a ni patient, ni acte,
  ni demande de paiement — il faudrait de toute façon un registre parallèle.
- **Les lecteurs du ledger sont les gens du centre** : `stats/finances` et `cash-journal`
  agrègent ses lignes pour le caissier. Une facture d'abonnement qui y apparaîtrait serait un
  bug de lecture, pas une donnée.
- **Le précédent existe** : `CashReceipt` (série « G- ») s'est délibérément séparée de `Receipt`
  (« mélanger les numérotations ferait passer un trou dans une série pour un trou dans
  l'autre »). On applique la même discipline.

Ce que le registre séparé emprunte quand même au ledger : **l'immuabilité là où elle a du sens**.
`SubscriptionPayment` (un règlement reçu) est **append-only** — l'argent encaissé ne se réécrit
pas ; une erreur se corrige par une contre-passation motivée, comme à la caisse (ADR 0015).
Les factures et l'abonnement, eux, restent mutables au bon niveau (statut, échéance).

Devise : **KMF**, avec la garde d'intégralité (`validate_kmf_integral`, ADR 0015) — un montant
fractionnaire rendrait la facture insoldable.

## Décision 2 — L'état d'abonnement est un axe INDÉPENDANT du KYC

`CenterSubscription.status` ∈ `essai` | `actif` | `impaye` | `suspendu` | `resilie`, **distinct
de `kyc_status`** (l'audit §B.6 le demandait explicitement). Les deux axes se composent sans se
confondre : un centre peut être vérifié et impayé, ou suspendu par le KYC et à jour de son
abonnement. `KYC_TRANSITIONS` n'est pas touché.

**Garde distincte, jamais `_require_center_can_collect`.** Cette garde-là est câblée en quatre
points du rail diaspora et nulle part ailleurs ; la réutiliser couperait le Pont de Confiance
d'un centre solvable. L'abonnement introduit sa propre garde,
`require_center_can_administer(center)` (`apps/billing/guards.py`), sur le même patron éprouvé :
**relecture du statut en base** (jamais l'objet en mémoire — leçon de la revue S4), message
français explicite, et jamais sur la queue d'un flux déjà engagé.

### Ce que chaque état ferme (arbitrage PO n° 2)

| État | Effet |
|---|---|
| `essai`, `actif` | rien n'est fermé |
| `impaye` (échéance dépassée, dans la grâce) | **rien n'est fermé** — bandeau + relances SMS |
| `suspendu` (grâce épuisée) | **gel administratif** (ci-dessous) |
| `resilie` | gel administratif + lecture et export garantis pendant la rétention |

**Gelé** (refus 400 explicite avec le motif et la marche à suivre) : ajout / modification /
réactivation de personnel · création / modification de tarifs · statistiques (activité et
finances) · exports.

**JAMAIS gelé, testé comme contrat** : consultations, carnet, documents, signes vitaux,
ordonnances · rendez-vous · **inscription d'un patient qui se présente au guichet** ·
facturation patient · caisse et encaissement · reçus · toute lecture · l'export RGPD de ses
données · le journal d'audit du directeur.

**Le rail diaspora reste OUVERT sur un centre impayé** (décision, à signaler au PO) : le fermer
punirait le tuteur et le patient, pas le centre ; le KYC porte déjà ce levier-là ; et Chioni
prélève ses frais sur ce rail — le couper réduirait ses propres recettes au moment où elle
cherche à se faire payer.

**Jamais de prise d'otage des données.** Un centre résilié conserve la lecture et l'export de
ses données pendant la période de rétention. Le dossier des patients ne cesse pas d'exister
parce qu'un contrat s'arrête.

## Décision 3 — Plans et quotas indicatifs

`SubscriptionPlan` : `code`, `name`, `price_kmf` (intégralité KMF garantie), `billing_period`
(`mensuel` | `annuel`), quotas inclus (`included_practitioners`, `included_staff`), `is_active`.
Un plan est **référencé** par les abonnements : ses prix passés ne sont jamais réécrits
rétroactivement — la facture émise porte son propre montant figé.

`subscription_usage(center)` mesure l'usage réel à partir des compteurs qui existent déjà
(personnel actif, praticiens actifs) et le compare aux quotas du plan. Le résultat est
**affiché et alerté, jamais opposé** : aucun service métier ne consulte les quotas pour refuser
quoi que ce soit. Test obligatoire — un centre en dépassement inscrit un patient, embauche et
crée une consultation sans erreur (arbitrage PO n° 3 : bloquer un dossier patient au motif d'un
plan reviendrait à refuser un soin pour une raison comptable).

## Décision 4 — Facturation SaaS (Chioni → centre)

- `SubscriptionInvoice` : `center`, `subscription`, `number` (**série « A- », globale Chioni** —
  c'est Chioni qui émet, la numérotation n'est pas par tenant et ne doit donc PAS verrouiller
  la ligne `HealthCenter`, sous peine d'entrer en contention avec `Receipt.issue()`),
  `period_start`/`period_end`, `amount_kmf` figé, `due_date`, `status`
  (`emise` | `payee` | `annulee`), `issued_by`, motif d'annulation.
- `SubscriptionPayment` (append-only) : `invoice`, `amount_kmf`, `method`
  (`virement` | `especes` | `mobile_money` | `autre`), `reference`, `received_at`,
  `recorded_by` (exploitant). Règlements partiels admis, jamais au-delà du solde.
  `SubscriptionPaymentReversal` (OneToOne, motif obligatoire) pour l'erreur de saisie.
- **Émission** : tâche Celery beat mensuelle (`billing.issue_due_subscription_invoices`,
  déclarée par nom dans `CELERY_BEAT_SCHEDULE` — les settings n'importent jamais de code
  applicatif) + émission manuelle possible par l'exploitant `admin`.
- **Relances** : nouvelles constantes de template dans `apps/common/notifications.py`, envoyées
  via `_schedule()` (remise après commit, échec jamais propagé). **Nouveauté à acter
  explicitement** : c'est le premier SMS qui porte un montant vers un membre du personnel
  (jusqu'ici seul le tuteur en recevait). Règles ADR 0012 maintenues et étendues : destinataire
  = **le directeur seul** (jamais le reste du personnel), aucune donnée patient, aucune donnée
  médicale, jamais le détail des lignes.
- API : côté centre `GET /centers/{c}/subscription/` et `GET /centers/{c}/subscription/invoices/`
  (rôles à trancher à l'implémentation entre directeur seul et BILLING — le gate frontend doit
  refléter la permission backend, sinon l'écran s'affiche pour recevoir un 403) ; côté
  plateforme `/platform/subscriptions/` et `/platform/subscriptions/{pk}/invoices/…`
  (`support` lit, `admin` seul écrit).

## Décision 5 — Module Support (centre → Chioni)

- `SupportTicket` : `center`, `opened_by` (staff), `subject`, `category`
  (`bug` | `question` | `facturation` | `autre`), `status`
  (`ouvert` | `en_cours` | `resolu` | `ferme`), `priority`, horodatages.
- `SupportMessage` (**append-only** — un message envoyé ne se réécrit pas) : `ticket`, `author`
  (staff du centre ou exploitant), `body`.
- **Ouverture par tout staff actif** : c'est la secrétaire qui rencontre le bug, pas le
  directeur. Lecture : l'auteur, le directeur du centre (tous les tickets de son centre), et la
  plateforme.
- Pièces jointes : socle ADR 0014 **tel quel** (JPEG/PNG/WebP, 2 Mo) sur `PrivateMediaStorage`,
  téléchargement par endpoint authentifié. Une capture d'écran est un PNG — le cas d'usage
  principal passe. Le PDF reste différé (arbitrage commun ADR 0016/0017).
- **Le risque résiduel, nommé et assumé** : un ticket est un champ de texte libre qu'un
  exploitant Chioni lira. Rien n'empêche techniquement d'y écrire « le dossier de Mme X ne
  s'ouvre pas ». Les parades sont : (a) **aucun champ structuré ne pointe un patient** — pas de
  FK patient sur un ticket, un module de support n'est pas une porte d'accès au dossier ;
  (b) un **avertissement explicite au moment d'écrire** (« ne mettez pas de nom de patient ni
  d'information médicale — donnez le numéro de dossier ») ; (c) le **contenu d'un ticket
  n'entre jamais dans un payload d'audit**. On informe, on structure, on ne prétend pas
  empêcher — et on le consigne comme risque assumé plutôt que de faire semblant.

## Décision 6 — Ce que S5 referme (dette ADR 0017)

L'ADR 0017 laissait deux portes d'écriture sensibles dans l'admin Django, « à refermer avec le
module Support de S5 » :

- **`PlatformStaffAdmin`** : une API plateforme gère désormais les exploitants (créer,
  changer de rôle, désactiver — `admin` seul, audité), et l'admin passe en lecture seule. Le
  bootstrap du tout premier exploitant se fait par **commande de management**
  (`create_platform_staff`, sur le modèle de `createsuperuser`), pas par un formulaire web.
- **`StaffMembershipAdmin`** : l'amorçage de secours existe déjà par API depuis S4
  (`POST /platform/centers/{pk}/directors/`, avec la séparation des pouvoirs). L'admin passe en
  lecture seule ; le test de fermeture du registre le verrouille.

## Invariants transverses (obligations d'implémentation)

1. **L'impayé ne ferme jamais le soin ni la caisse** — contrat testé sur le gabarit de
   `tests/test_kyc_suspension_effects.py` (ce qui s'arrête / ce qui continue, les deux prouvés).
2. **Les quotas ne bloquent jamais** — test dédié sur un centre en dépassement.
3. **Garde distincte** du rail diaspora ; `_require_center_can_collect` n'est pas touchée.
4. **Étanchéité des registres** : une facture d'abonnement n'apparaît dans aucune vue du centre
   qui lit le ledger (`stats/finances`, `cash-journal`, impayés patients) — testé par absence.
5. **Garde-fou structurel plateforme** (S4) : tout nouveau module `platform_*` déclare
   `permission_classes` en **attribut de classe** avec `platform_gate`, ne contient aucun
   symbole « patient », et s'ajoute aux trois listes de `tests/test_permissions_platform.py`.
6. **Journal du directeur** : les actions `subscription.*` et `support_ticket.*` sont
   **invisibles par défaut** (liste blanche fail-closed) — les y ajouter est un acte conscient,
   et on le fait : ce sont des actions d'exploitation de son propre centre.
7. **Audit** : payload scalaire, `center` en colonne ; **jamais** le motif d'une suspension
   d'abonnement, **jamais** le contenu d'un ticket, **jamais** une PII.
8. **SMS** : relances au directeur seul, montant admis, aucune donnée patient (ADR 0012 étendu).
9. Seed démo étendu (un plan, un abonnement actif, une facture, un ticket) ; contrat frontend
   à jour.

## Hors périmètre S5 (consigné)

Paiement en ligne du centre (rails locaux non instruits — risque n° 1) ; support ouvert aux
patients et tuteurs (la tab bar lite est déjà pleine à 4 onglets : ce serait un chantier
d'ergonomie à part) ; PDF des pièces jointes ; comptabilité analytique de Chioni ; notation des
centres ; facturation à l'usage (les quotas de S5 la préparent sans l'engager).

## Addendum d'implémentation — LOT 1 (décisions 1, 2 et 3 livrées le 2026-08-14)

Choix arrêtés à l'implémentation du premier lot (app `apps/billing`, plans, abonnements, garde
de gel, quotas indicatifs). Les points marqués **[ARBITRAGE]** tranchent un point que l'ADR
laissait ouvert ou vont au-delà de sa lettre ; tous sont RÉVERSIBLES et aucun n'est silencieux.
Le lot 1 ne construit **ni** la facturation SaaS (lot 2) **ni** le module Support (lot 3), et ne
referme aucune porte d'admin de l'ADR 0017 (lot 3).

### Les modèles

1. **Deux tables, aucune écriture ailleurs** : `SubscriptionPlan` et `CenterSubscription`
   (migration `billing/0001`, schéma seul, entièrement réversible, aucun `RunPython`). Le test
   d'étanchéité est explicite : ouvrir un abonnement puis le suspendre laisse
   `LedgerTransaction`, `LedgerEntry`, `Invoice`, `CashPayment` et `Receipt` **au compteur
   exact d'avant**, et le prix de l'offre n'apparaît ni dans `stats/finances`, ni dans le
   `cash-journal`, ni dans les impayés du centre.
2. **`CenterSubscription` est un OneToOne vers le centre** : un tenant, un contrat. Le
   multi-contrat (une offre par établissement d'un groupe) n'est pas modélisé — il n'a pas de
   demande, et le déplier plus tard est une migration additive.
3. **Intégralité KMF au niveau base** : `subscription_plan_price_kmf_integral`
   (`price_kmf = ROUND(price_kmf)`) + validateur de champ + `save()`, patron exact de
   `TariffItem`. Contrairement à `centers/0004`, la contrainte naît AVEC la table : aucun
   existant fractionnaire à refuser, donc pas de `RunPython` garde-fou.
4. **`status_reason` = motif de la DERNIÈRE décision** (écrasé à chaque transition, vidé quand
   on dégèle), stocké sur la ligne, rendu à la plateforme et au **directeur du centre
   concerné** — patron `kyc_reason` (ADR 0017 lot 1 §5). Jamais dans un payload d'audit.
   **Vigilance** : l'historique des motifs successifs n'est pas conservé (l'audit garde la
   chronologie des statuts, jamais le texte).
5. `current_period_end` existe dès le lot 1 (échéance de la période en cours) mais **rien ne la
   fait avancer** : c'est le lot 2 qui l'entretiendra avec l'émission des factures.

### La garde de gel

6. **`require_center_can_administer(center)`** (`apps/billing/guards.py`) — distincte de
   `_require_center_can_collect`, qui n'est **pas touchée** (aucun appel ajouté ni retiré sur le
   rail diaspora : il reste OUVERT sur un centre impayé, décision de l'ADR). La garde **relit le
   statut en base** (`values_list` par pk), jamais l'objet en mémoire — leçon de la revue
   guardian S4, verrouillée par un test à objet périmé.
7. **Pas d'abonnement = rien de gelé.** `None` est un état de première classe : tous les centres
   nés avant S5 n'ont pas de ligne, et un tenant sans contrat en base n'est pas un tenant en
   défaut. Le gel est une décision, jamais l'état par défaut du produit.
8. **Deux messages distincts** (`SUBSCRIPTION_SUSPENDED_MESSAGE` /
   `SUBSCRIPTION_TERMINATED_MESSAGE`, constantes exportées) : « régularisez » et « le contrat est
   terminé » ne sont pas la même nouvelle. Tous deux se terminent par la même phrase — « Les
   soins, les rendez-vous, l'inscription des patients, la facturation et la caisse continuent
   normalement. » — patron du refus KYC : un refus dit ce qui continue, il ne laisse jamais
   croire à une panne générale.
9. **[ARBITRAGE] La désactivation d'un membre N'EST PAS gelée.** L'énumération de la décision 2
   dit « ajout / modification / réactivation de personnel » et omet la désactivation ; on suit
   l'ADR à la lettre, pour deux raisons de fond : (a) **révoquer l'accès d'un salarié parti est
   un geste de sécurité**, jamais une fonctionnalité payante — un centre en retard de paiement
   ne doit pas être condamné à laisser un compte ouvert ; (b) `anonymize_user` (RGPD, ADR 0017
   décision 7) **appelle** `deactivate_staff_member` : le geler ferait échouer un droit
   fondamental pour une raison commerciale. Verrouillé dans les deux sens par test.
10. **[ARBITRAGE] La porte PLATEFORME n'est jamais gelée.** `add_staff_member` (porte du tenant)
    porte la garde ; `add_center_director` (amorçage de secours Chioni) partage désormais le
    même corps d'écriture via `_create_staff_membership` mais **pas** la garde. Une sanction
    commerciale ne doit pas enfermer Chioni hors du centre qu'elle a sanctionné.
11. **« Exports » (liste gelée de la décision 2) : sans objet en lot 1.** Aucun export centre
    n'existe encore (l'absence d'export CSV du journal et de la réconciliation est déjà consignée
    en vigilance S4 lot 2) ; l'export RGPD `/auth/me/export/` est **explicitement hors gel**
    (test dédié). Le jour où un export comptable naît, il naît gelé.
12. **Coût mesuré** : +1 requête indexée sur `stats/activity` et `stats/finances` (6 → 7). Les
    probes de comptes de requêtes sont mises à jour et continuent de prouver ce qu'elles
    prouvaient : le compte reste CONSTANT avec le volume.

### La machine à états et les quotas

13. **`SUBSCRIPTION_TRANSITIONS`** explicite et fermée, dans `billing.services` (patron
    `KYC_TRANSITIONS`, qui reste intact) : `resilie → actif` est la seule sortie d'un contrat
    terminé (re-signature) ; `suspendu → impaye` existe (un règlement partiel lève le gel sans
    solder la dette). Verrou de ligne `select_for_update` : deux exploitants qui cliquent en
    même temps sérialisent.
14. **Un abonnement naît vivant** (`essai` ou `actif` seulement) : un contrat créé directement
    `suspendu` gèlerait un tenant **sans** passer par la transition auditée et **sans** le motif
    dont son directeur a besoin.
15. **Motif obligatoire pour `suspendu` ET `resilie`** — l'ADR ne l'exige nommément que pour la
    suspension ; résilier ferme les mêmes portes, la même exigence s'applique.
16. **Quotas : un siège = une PERSONNE**, même avec deux casquettes dans le centre
    (`Count(user_id, distinct=True)`) — cohérent avec l'ADR 0001 (les rôles se cumulent) et avec
    la réalité d'un salaire. `None` = illimité. **Deux lectures, un seul verdict** :
    `subscription_usage(center)` (agrégat par centre) et `annotate_subscription_usage(qs)`
    (annotations SQL de la liste back-office) passent par la MÊME comparaison, et un test
    verrouille leur accord ligne à ligne — patron `unpaid_invoices_qs` ↔ `invoice_balance_kmf`.
17. **Les quotas ne bloquent jamais, prouvé deux fois** : un centre en dépassement inscrit un
    patient, embauche et ouvre une consultation ; et un **test structurel** interdit à tout
    module hors `apps/billing` d'importer `subscription_usage` — le jour où un service métier le
    lit, le quota devient opposable et le test rougit.

### L'API

18. **[ARBITRAGE] `GET /centers/{c}/subscription/` est réservé au DIRECTEUR.** L'ADR laissait le
    choix « directeur seul ou BILLING » ; on tranche par symétrie avec les deux objets les plus
    proches — le dossier KYC et le journal d'audit, tous deux directeur seul. Le contrat porte un
    prix, une échéance et le motif d'une sanction. Le caissier bloqué sur la grille tarifaire
    n'est pas laissé dans le noir pour autant : le refus lui dit ce qui s'est passé, quoi faire
    et ce qui continue. **RÉVERSIBLE** — et la garde frontend doit suivre le côté choisi.
19. **404 quand il n'y a pas d'abonnement** (patron `GET /guardian/profile/`) : inventer un
    contrat vide serait un mensonge, et « il n'y en a pas » n'est pas une erreur.
20. **Côté plateforme : `/platform/plans/` et `/platform/subscriptions/`**, quatrième module
    monté sur le préfixe (`apps/billing/platform_urls.py`) — exactement le plan du lot 1 de S4.
    `support` lit, `admin` seul écrit. Les transitions passent par des **actions POST explicites**
    (`/status/`, `/plan/`) plutôt qu'un PATCH : un PATCH qui glisserait un statut à côté de la
    machine à états serait la porte parallèle que S4 a passé un sprint à fermer.
21. **Contrat de champs de `/platform/centers/` INCHANGÉ** : l'abonnement n'y est pas ajouté (il
    a sa propre route). Le test qui fige ce payload n'a pas été modifié.
22. **Garde-fou structurel mis à jour** (`tests/test_permissions_platform.py`) : les 3 nouvelles
    routes GET entrent dans la liste de champs négatifs (avec un abonnement RÉEL, pas une liste
    vide), les 4 nouvelles routes d'écriture dans le balayage « un `support` ne peut rien
    écrire » (dont la seule route d'écriture non-POST du back-office, `PATCH /platform/plans/{pk}/`),
    et les deux modules `apps.billing.platform_*` dans l'assertion « aucun module plateforme ne
    contient de symbole `patient` ».

### Audit, journal, admin, seed

23. **Cinq actions neuves** : `subscription.created`, `subscription.plan_changed`,
    `subscription.status_changed` (portées par leur `center`) et `subscription_plan.created`,
    `subscription_plan.updated` (transverses, `center=None` — le catalogue d'offres n'appartient à
    aucun tenant). Payloads : ids, codes de statut, prix de l'offre, `has_reason` — **jamais le
    motif**.
24. **Les trois actions de centre entrent dans `DIRECTOR_JOURNAL_ACTIONS`** (invariant 6 de
    l'ADR) : ouvrir un contrat, changer d'offre ou geler l'administration sont des événements
    d'exploitation de son propre centre. Les deux actions de catalogue n'y sont pas et ne peuvent
    pas y apparaître (elles ne portent aucun centre).
25. **[ARBITRAGE] Les deux admins Django naissent read-only** (`ReadOnlyAdminMixin` +
    `readonly_fields`) et sont déclarés dans `SENSITIVE_MODELS` du test de fermeture du registre.
    Ce n'est pas la « fermeture des admins » de la décision 6 (lot 3, `PlatformStaffAdmin` /
    `StaffMembershipAdmin`) : c'est simplement le refus d'ouvrir une porte neuve — un formulaire
    d'admin ferait passer un centre à « suspendu » sans motif, sans machine à états et sans
    trace.
26. **Seed démo** : offre « Essentiel » (25 000 KMF/mois, 10 membres, 3 praticiens) et abonnement
    **ACTIF** de la Clinique Ylang, échéance à trois semaines. Actif à dessein — le gel est une
    ÉTAPE de démo (étape 9 du récapitulatif : suspendre depuis l'espace plateforme et constater
    que le personnel et les statistiques se ferment pendant que la caisse et les consultations
    continuent).

### Tests

**97 tests neufs** — `tests/test_subscription_effects.py` (33 : le gabarit « ce qui continue »
écrit AVANT « ce qui s'arrête », étanchéité des registres, quotas non bloquants) et
`tests/test_subscription_api.py` (58 : modèle, machine à états, audit, quotas, API centre et
plateforme), plus les extensions de `test_permissions_platform.py`, `test_admin_hardening.py`,
`test_seed_demo.py` et la mise à jour des comptes de requêtes (6 → 7) dans
`test_center_stats.py` / `test_adversarial_stats_wave2b.py`. **Total suite : 1585 verts.**

### Vigilances consignées (lot 1)

- **Aucun trigger PostgreSQL** sur les deux nouvelles tables — même famille que la dette SV.2
  (tables S3) et qu'`ErasureRequest` : elles ne sont pas append-only (un abonnement a un cycle de
  vie), mais un `update()` brut par shell contourne la machine à états et l'audit.
- **`status_reason` n'est pas borné en longueur** (même convention que `kyc_reason`,
  `cancel_reason`, motif de litige) : si un exploitant y tape une donnée patient, le directeur du
  centre la lit. Contrat de revue, pas de code.
- **Le gel n'est pas notifié** : aucun SMS ne part quand un abonnement est suspendu (les relances
  sont le lot 2). Un directeur découvre le gel en butant dessus — à corriger avec les relances,
  qui sont exactement le canal manquant.
- **Un centre gelé perd ses graphiques de dashboard** (les deux `stats/*` répondent 400) : le
  frontend doit afficher un bandeau explicatif à la place, pas une page d'erreur.
- **Pas de garde « le dernier plan actif »** : rien n'empêche un `admin` de retirer toutes les
  offres du catalogue ; les abonnements en cours survivent (`PROTECT`), seul un nouveau contrat
  deviendrait impossible.
- **`subscription_usage` est calculé à chaque lecture** de la fiche centre (un agrégat) : sans
  cache, assumé pour un écran consulté rarement.
- **Course garde/écriture bornée et assumée** : une suspension commitée entre la lecture de la
  garde et l'écriture laisse passer cette écriture-là (même propriété que la garde KYC). Sans
  conséquence — le gel est une sanction commerciale, pas une garde d'argent : aucune écriture
  du ledger n'en dépend. L'ouverture d'un contrat, elle, est protégée par l'index unique
  (`OneToOne`), qui rend le MÊME 400 français que le contrôle d'existence grâce à un point de
  sauvegarde — **sans jamais verrouiller la ligne `HealthCenter`** (contention `Receipt.issue()`
  explicitement proscrite par la décision 4).
- **Le rail diaspora reste ouvert sur un centre impayé** — décision de l'ADR, signalée au PO et
  verrouillée par test : si le PO change d'avis, c'est un appel de garde à ajouter, pas une
  réécriture.

## Addendum d'implémentation — LOT 2 (décision 4 livrée le 2026-08-14)

La facturation SaaS Chioni → centre : émission, règlements reçus, contre-passation,
annulation, cycle automatique et relances SMS. Le lot 2 ne construit **ni** le module Support
**ni** la fermeture des admins de l'ADR 0017 (lot 3). Les points marqués **[ARBITRAGE]**
tranchent un point que l'ADR laissait ouvert ; tous sont RÉVERSIBLES, aucun n'est silencieux.

### La numérotation « A- » : globale, contiguë, sans verrou sur un centre

1. **Une ligne compteur dédiée** (`SubscriptionInvoiceCounter`, singleton verrouillé
   `FOR UPDATE` le temps de l'émission) plutôt que le patron `Receipt.issue()` /
   `CashReceipt.issue()`. Ces deux-là numérotent **par tenant** et sérialisent sur la ligne
   `HealthCenter` ; la décision 4 proscrit ce verrou-là pour la série SaaS — une tâche de
   facturation mensuelle ne doit jamais faire attendre (ni attendre) le reçu d'un patient au
   comptoir. **Sonde structurelle pérenne** : le SQL réellement émis par l'émission est
   capturé et le test échoue si un `FOR UPDATE` porte sur `centers_healthcenter`.
2. **Pourquoi pas une `SEQUENCE` PostgreSQL** (l'autre candidat évident, sans contention du
   tout) : `nextval()` n'est pas transactionnel — un rollback brûlerait un numéro et laisserait
   un **trou** dans la série. C'est exactement l'argument qui a séparé les séries « G- » et
   diaspora (ADR 0015 §6) : un trou dans une série ressemble à une facture disparue. Le verrou
   de ligne rend le numéro au rollback — testé.
3. **La ligne du compteur naît à la volée**, jamais par une migration de données :
   `TransactionTestCase` vide les tables entre deux tests, et une numérotation qui dépendrait
   d'une ligne semée serait un piège différé.
4. Coût assumé et mesuré : l'émission SaaS est sérialisée **globalement**. C'est une poignée
   d'écritures par mois, faites par une tâche planifiée. Deux tenants facturés au même instant
   (threads réels) obtiennent `A-000001` et `A-000002`, jamais deux fois le même numéro.
5. Nom de colonne : `sequence_number` + propriété `number` (« A-000001 »), patron exact de
   `CashReceipt` — un entier est ce qui rend la continuité d'une série vérifiable.

### La hiérarchie des verrous de ce registre

**facture d'abonnement → abonnement → compteur de la série.** L'émission prend
(abonnement, compteur) ; un règlement, une contre-passation et une annulation prennent
(facture, abonnement). Aucun cycle, et **aucune intersection** avec la hiérarchie du rail
diaspora (intent → demande → facture patient → centre, correctif guardian S1) : les tables sont
disjointes et aucun chemin ne tient un verrou de l'une en demandant l'autre. Toute écriture
future de ce registre respecte cet ordre.

### Le cycle de vie

6. **[ARBITRAGE] Seuls `actif` et `impaye` sont facturés.** `essai` ne se facture pas (c'est un
   essai) ; `suspendu` et `resilie` non plus — **on n'accumule pas de dette sur ce qu'on a
   gelé**. Reprendre le service, c'est réactiver le contrat, et la période suivante repart.
7. **Deux transitions automatiques, et deux seulement** : `actif → impaye` quand une échéance
   est **strictement** dépassée et non réglée, et le retour `impaye → actif` dès qu'il ne reste
   plus rien d'échu. Le jour de l'échéance n'est pas un retard (un règlement peut arriver dans
   la journée) : il déclenche la relance, pas le drapeau.
8. **`suspendu` n'est JAMAIS automatique**, et c'est LE test du lot : un contrat `essai`,
   `suspendu` ou `resilie` avec 90 jours de retard n'est touché par aucune tâche, et ne se
   dégèle pas davantage tout seul une fois la dette soldée. Justification : geler
   l'administratif est une **sanction** — elle se décide, se motive et s'audite ; un centre qui
   a payé par virement non encore saisi ne doit pas se réveiller gelé par une tâche de nuit.
9. **Un seul point de synchronisation** (`_sync_subscription_payment_status`), appelé par le
   règlement, la contre-passation, l'annulation ET la tâche quotidienne : impossible que deux
   chemins divergent sur « ce centre est-il en retard ? ». Les transitions automatiques
   écrivent le MÊME `subscription.status_changed` que les décisions humaines, avec
   `automatic: true` et `actor=None` dans le payload — le directeur les voit dans son journal
   et sait qu'aucune main ne les a posées.
10. **`current_period_end` est LE curseur** (le lot 1 le posait à la main, plus rien ne le fait
    désormais que l'émission). Les périodes se suivent sans trou ni chevauchement ; la première
    part de `started_at`. Arithmétique bornée au dernier jour du mois cible — un abonnement
    démarré un 31 dérive vers le 28 et n'y revient pas (dérive assumée : conserver l'ancre
    demanderait un champ de plus pour un bénéfice nul au MVP).
11. **Rattrapage borné à 12 périodes** par exécution : un tenant oublié un an ne déclenche pas
    une émission infinie ; au-delà, un humain regarde le dossier.

### [ARBITRAGE] Le déclencheur d'émission est QUOTIDIEN — le seul écart au brief

Le brief demandait un beat **mensuel**. La facturation EST mensuelle **par tenant** (une
facture par période, garantie par le curseur + l'index unique par période vivante), mais les
périodes courent depuis la date de souscription de chaque centre, pas depuis le 1ᵉʳ du mois :
un beat mensuel retarderait de près de 30 jours la facture d'un centre dont la période s'achève
le 14. Le beat est donc quotidien (06h00 heure des Comores, avant le drapeau d'impayé de 07h00
et les relances de 08h00) et la tâche est **idempotente** — relancée dans la minute, elle
n'émet rien. Réversible en une ligne de `CELERY_BEAT_SCHEDULE`.

`SUBSCRIPTION_INVOICE_DUE_DAYS` (défaut 15) porte le délai de règlement, avec garde-fou au boot
(`< 1` refusé : une facture exigible le jour de son émission serait « impayée » avant d'avoir
été lue).

### Les relances SMS — la première exception à « le montant ne va qu'au tuteur »

12. **Périmètre strict** : le **directeur seul** (tous les directeurs actifs si le centre est en
    co-gérance — deux responsables, deux SMS ; jamais le reste du personnel, testé sur
    caissier, secrétaire, infirmier), le montant que SON centre doit à Chioni, **aucune donnée
    patient, aucune donnée médicale, aucun détail de ligne**.
13. **[ARBITRAGE] Pas même le nom du centre**, comme partout ailleurs dans l'ADR 0012 : un SMS
    se lit par-dessus l'épaule, et « la clinique X doit 25 000 KMF » n'a pas à circuler. Le
    numéro de facture suffit à l'identifier dans l'app, qui porte le détail.
14. **Cadence J+0 / J+7 / J+21, puis silence** — trois messages, espacés de plus en plus. Un
    virement met des jours à arriver aux Comores, et au quatrième SMS ce n'est plus une
    relance : à ce stade c'est un appel de Chioni qui règle l'affaire. Une seule relance par
    facture et par exécution.
15. **[ARBITRAGE] Aucun SMS à l'émission.** On notifie ce qui demande une action, pas ce qui est
    normal : un client SaaS sait qu'il est facturé chaque mois, et l'app le lui montre. Le
    premier SMS part le jour de l'échéance.
16. **Le montant relancé est le SOLDE restant**, jamais le montant facturé : relancer sur une
    somme déjà réglée pour moitié serait faux et vexant.
17. Compteur anti-doublon (`reminders_sent`) et envoi commités **ensemble** (patron du rappel de
    rendez-vous J-1) : un rollback n'envoie rien et laisse la facture re-éligible. Un tenant
    **sans directeur actif joignable** ne consomme AUCUNE relance — sinon il brûlerait ses trois
    messages en silence et ne serait plus jamais relancé le jour où il en a un.

### Facture, règlements, corrections

18. **Une facture est gelée dès l'émission** (il n'y a pas d'étape brouillon ici) : montant,
    période, numéro, rattachements et snapshot d'offre sont figés par `save()` (patron
    `Invoice._FROZEN_OUTSIDE_DRAFT`). Seuls bougent le statut, la trace d'annulation et le
    compteur de relances. Repricer l'offre ne réécrit pas un franc du passé — testé dans les
    deux sens (la facture émise ne bouge pas, la période suivante part au nouveau prix).
19. **Solde DÉRIVÉ, jamais stocké** : montant figé − règlements non contre-passés. Deux
    lectures (`subscription_invoice_balance_kmf` unitaire et
    `annotate_subscription_invoice_balance` en SQL pur), **un seul verdict**, accord verrouillé
    ligne à ligne par test — patron `unpaid_invoices_qs` ↔ `invoice_balance_kmf`.
20. **Règlements partiels admis, jamais au-delà du solde**, sérialisés par le verrou de la ligne
    facture (deux exploitants, threads réels : un encaissement, un refus). Append-only ORM.
21. **La contre-passation est la seule correction** : motif obligatoire, une par règlement,
    rouvre le solde, ramène une facture `payee` à `emise` et re-signale l'impayé si l'échéance
    est passée.
22. **[ARBITRAGE] L'annulation d'une facture recule le curseur de période** jusqu'à la veille de
    la période annulée, et l'index d'unicité `(subscription, period_start)` est **partiel**
    (factures vivantes seulement). Sans cela, une faute de frappe rendrait un tenant
    définitivement non facturable pour ce mois-là. Annulation refusée tant qu'un règlement
    actif existe (contre-passez d'abord — patron `cancel_invoice`, ADR 0015 addendum S1).
23. **[ARBITRAGE] `cancel_reason` est LU par le directeur du centre**, contrairement à
    `Invoice.cancel_reason` (BILLING seul, S1). L'asymétrie est délibérée : celui-là est écrit
    par le centre à propos de la facture d'un patient, celui-ci est écrit par **Chioni** à
    propos de la facture du centre — le directeur est précisément la personne à qui il
    s'adresse. Même raisonnement pour le motif d'une contre-passation, rendu sur la ligne : le
    fait sans le pourquoi serait pire qu'inutile.
24. **L'identité de l'exploitant Chioni ne traverse pas** : `recorded_by`/`reversed_by` sont
    absents du payload centre (le directeur lirait une personne qu'il n'a aucun autre moyen de
    voir — même discipline qu'`actor_display` dans son journal, qui ne résout un nom que pour
    les membres de SON centre).

### L'API

25. **Côté centre : `GET /centers/{c}/subscription/invoices/[{pk}/]`, DIRECTEUR SEUL** — même
    audience que le contrat lui-même (cohérence assumée du lot 1 ; la garde frontend doit
    refléter la permission backend). Lecture seule : c'est Chioni qui émet, encaisse, corrige.
    **Aucune facture = liste vide 200**, là où l'absence de contrat est un 404 : « pas de
    contrat » et « pas encore de facture » ne sont pas la même nouvelle.
26. **Côté plateforme** : `POST /platform/subscriptions/{pk}/invoices/` (émission manuelle,
    `admin`), `GET /platform/subscription-invoices/?status=&center=&overdue=` (le registre
    transverse), détail, `POST …/payments/`, `POST …/payments/{pk}/reverse/`, `POST …/cancel/`.
    `support` lit, `admin` seul écrit.
27. **[ARBITRAGE] L'émission manuelle est à CORPS VIDE** : elle déclenche exactement ce que
    ferait la tâche pour ce tenant (même période, même montant figé depuis l'offre, même
    échéance). Laisser saisir un montant libre ferait de cette route une porte parallèle à la
    grille tarifaire — le prix d'une offre se change sur l'offre. Une facture exceptionnelle
    (frais de mise en service) n'a pas de demande : hors périmètre, consigné.
28. `?overdue=true` applique **la même définition** que le drapeau d'impayé (échéance
    strictement dépassée, solde positif) — jamais une seconde règle qui divergerait.
29. Norme S1 des refus tenue : toutes les références de ces routes sont en URL → **404**
    (centre étranger, facture étrangère, règlement d'une autre facture) ; les corps répondent
    400 par champ (`method` inconnu, `reason` vide, filtres invalides).
30. **Garde-fou structurel plateforme mis à jour** : 5 nouvelles routes GET dans la liste de
    champs négatifs (mesurées sur une facture RÉELLE avec un règlement imbriqué, jamais un
    payload vide), 4 nouvelles routes d'écriture dans le balayage « un `support` n'écrit rien »
    (sur des objets EXISTANTS, un 404 masquerait le 403). Aucun module `platform_*` neuf : les
    vues rejoignent `apps.billing.platform_views`, déjà couvert par l'assertion « aucun symbole
    `patient` ».

### Audit, journal, admin, seed

31. **Quatre actions neuves** — `subscription_invoice.issued|cancelled`,
    `subscription_payment.recorded|reversed` — toutes porteuses de leur `center`, toutes dans
    `DIRECTOR_JOURNAL_ACTIONS` : c'est l'argent de SON centre. Payloads : références, montants,
    devise, statuts, dates ISO, `has_reason` — **jamais** le motif d'une annulation ni celui
    d'une contre-passation (règle `cancel_reason`/`kyc_reason`, testée par absence du mot).
32. **Trois admins neufs, tous fermés** : `SubscriptionInvoiceAdmin` en lecture seule (un
    formulaire poserait « payée » sur une facture que personne n'a réglée, sans règlement, sans
    audit et sans que le centre le sache), les deux autres en `AppendOnlyAdminMixin`. Ajoutés à
    `SENSITIVE_MODELS`. Le compteur de série n'est pas enregistré du tout.
33. **Seed démo** : facture `A-000001` de 25 000 KMF émise par les vrais services, échéance à
    15 jours, **10 000 KMF reçus par virement**, solde 15 000 KMF — le cas le plus parlant
    (solde visible des deux côtés, contre-passation démontrable). Étape 10 du récapitulatif. Le
    lot 1 posait `current_period_end` à la main ; c'est désormais l'émission qui le fait, et le
    seed reprend une base de dev héritée en remettant le curseur à zéro.

### Étanchéité des registres (invariant transverse n° 4)

34. Le cycle COMPLET (émission → règlement → contre-passation → annulation) laisse
    `LedgerTransaction`, `LedgerEntry`, `Invoice`, `CashPayment`, `CashReceipt` et `Receipt` au
    **compteur exact d'avant**, et ni le montant de l'abonnement, ni celui du règlement, ni le
    numéro « A- » n'apparaissent dans `stats/finances`, `cash-journal`, les impayés patients ou
    la liste des factures du centre.
35. **Test structurel** : aucun module d'`apps/billing` n'IMPORTE `trustbridge` (le regex ne
    porte que sur les lignes d'import — le module a le droit, et même le devoir, de nommer le
    rail diaspora dans ses commentaires pour expliquer pourquoi il n'y touche pas).

### Tests

**117 tests neufs** — `tests/test_subscription_invoicing.py` (74 : série et gel, périodes,
règlements et courses à threads réels, contre-passation, annulation, cycle automatique,
relances SMS, étanchéité, accord SQL↔dérivation, audit) et
`tests/test_subscription_invoice_api.py` (34 : côté centre directeur-seul et cloisonnement,
côté plateforme émission/règlement/correction/registre), plus les extensions de
`test_subscription_effects.py`, `test_permissions_platform.py`, `test_admin_hardening.py`,
`test_seed_demo.py` et la factory `make_subscription_invoice`. **Total suite : 1704 verts.**

### Vigilances consignées (lot 2)

- **Aucun trigger PostgreSQL** sur les quatre nouvelles tables, alors que `SubscriptionPayment`
  et `SubscriptionPaymentReversal` sont append-only au niveau ORM seulement — même famille de
  dette que les tables S3 et que le lot 1. Un `update()` brut par shell contournerait
  l'immuabilité ; la caisse, elle, a ses triggers (ADR 0015). **Candidat n° 1 du sprint SV.**
- **La numérotation SaaS est sérialisée globalement** : à très gros volume (des milliers de
  tenants facturés dans la même minute), le compteur devient le goulot. Le remède connu est le
  passage à une `SEQUENCE` + acceptation des trous, ou une série par année — pas avant qu'un
  vrai volume l'exige.
- **`cancel_reason` et le motif de contre-passation ne sont pas bornés en longueur** (même
  convention que `status_reason`, `kyc_reason`, motif de litige) : un exploitant qui y taperait
  une donnée patient la ferait lire au directeur. Contrat de revue, pas de code.
- **Le gel n'est toujours pas notifié par SMS** (vigilance du lot 1) : les relances couvrent
  l'impayé, pas la suspension. Un directeur suspendu découvre le gel en butant dessus — à
  traiter quand un canal « décision commerciale » sera acté.
- **Aucune clé d'idempotence sur l'enregistrement d'un règlement** (contrairement au guichet,
  ADR 0015 addendum S1) : un double-clic de l'exploitant crée deux tranches, contre-passables.
  Volume et audience très différents (une poignée de saisies par mois, par un exploitant
  Chioni) — à rouvrir si le back-office devient un outil de masse.
- **Un règlement contre-passé disparaît rétroactivement du solde** sans champ de rapprochement
  daté (même propriété que la caisse, ADR 0015) : sans export comptable figé, c'est sans
  conséquence.
- **La dérive de fin de mois** (31 → 28) n'est pas rattrapée, et **une facture annulée puis
  ré-émise reprend un nouveau numéro** (la série ne se réutilise jamais) : les deux sont des
  choix, pas des oublis.
- **Pas d'export comptable, pas de PDF, pas de relance par e-mail** : hors périmètre S5, comme
  le paiement en ligne de l'abonnement (risque n° 1 non instruit).

## Addendum d'implémentation — LOT 3 (décisions 5 et 6 livrées le 2026-08-15)

Le module Support et la fermeture des deux dernières portes d'écriture de l'admin Django —
la dette explicitement renvoyée à S5 par l'ADR 0017. Dernier lot backend de S5. Les points
marqués **[ARBITRAGE]** tranchent un point que l'ADR laissait ouvert ou vont au-delà de sa
lettre ; tous sont RÉVERSIBLES, aucun n'est silencieux.

### Le module Support (décision 5)

1. **[ARBITRAGE] App dédiée `apps/support`, pas un coin d'`apps/billing`.** Le registre
   d'abonnement porte une discipline de bout en bout (décision 1 : c'est de l'argent, il est
   séparé du ledger des soins, et un test structurel lui interdit d'importer `trustbridge`).
   Une conversation n'est pas de l'argent : aucun montant, aucune période, aucun état dont un
   franc dépend — et son unique risque est l'inverse (du texte libre qu'un exploitant lira).
   La replier dans `billing` brouillerait une frontière que le sprint a payé cher pour tracer.
   Et l'app n'est pas anémique : trois modèles, une couche de services, deux audiences, deux
   modules d'URL, un admin — le poids d'`apps/scheduling`.
2. **Trois tables** (migration `support/0001`, schéma seul, entièrement réversible, aucun
   `RunPython`) : `SupportTicket` (centre + ouvreur + objet + catégorie + statut + priorité),
   `SupportMessage` (**append-only**, ADR 0018 : « un message envoyé ne se réécrit pas ») et
   `SupportAttachment` (socle ADR 0014 **tel quel** sur `PrivateMediaStorage`).
3. **[ARBITRAGE] La priorité est déclarée à l'ouverture et ne change plus.** C'est une
   déclaration d'urgence par la personne qui a le problème, pas un état de workflow ; le tri
   de Chioni se fait au `status`, qui porte la machine à états et l'audit. RÉVERSIBLE : si le
   support a besoin de re-prioriser, c'est une action POST de plus (et une action d'audit).
4. **`author_side` (`centre` | `chioni`) est posé par le SERVICE**, d'après la porte
   empruntée — jamais par le client, et jamais dérivé à la lecture : un exploitant Chioni qui
   serait aussi infirmier quelque part ne doit pas voir ses vieilles réponses changer de côté
   le jour où il quitte l'équipe.
5. **Machine à états explicite et fermée** (`SUPPORT_TRANSITIONS`, patron `KYC_TRANSITIONS`) :
   `ouvert ⇄ en_cours`, les deux vers `resolu`, `resolu → en_cours` (« ça ne marche toujours
   pas » est la transition la plus utile d'un outil de support) et **`ferme` est DÉFINITIF** —
   rouvrir un dossier clos, c'est en ouvrir un nouveau, pour que le fil d'un incident reste le
   fil de CET incident. Verrou de ligne : deux exploitants qui cliquent en même temps
   sérialisent.
6. **Poster ne déplace RIEN tout seul.** Un message sur un ticket `resolu` le laisse `resolu` :
   une transition implicite serait exactement la porte parallèle que le projet passe ses
   sprints à fermer. Le statut bouge par une action explicite, auditée.
7. **`body` optionnel à l'ouverture, et il devient le PREMIER message** dans la même
   transaction : « décrire son problème » et « ouvrir un ticket » sont un seul geste pour la
   personne qui le fait, et deux allers-retours sur une connexion comorienne, c'est un de trop.
   Même raison pour le détail imbriqué (`messages` + `attachments` dans
   `GET .../tickets/{pk}/`) : un écran de ticket coûte UNE requête.
8. **Permissions** : ouverture par **tout staff ACTIF** du centre (« c'est la secrétaire qui
   rencontre le bug ») ; lecture par **l'auteur + le directeur** (tous les tickets de son
   centre) ; réponse par quiconque peut lire (un fil que son auteur ne peut pas alimenter est
   un formulaire, pas une conversation). Le cloisonnement vit dans le QUERYSET : le ticket
   d'un collègue est un **404**, jamais un 403 qui apprendrait son existence (norme S1).
9. **[ARBITRAGE] Un `support` ÉCRIT — l'unique exception du back-office.** Partout ailleurs
   « `support` lit, `admin` seul écrit », et ça ne bouge pas : créer un centre, bouger un KYC,
   ouvrir un contrat, geler une administration, enregistrer un règlement, exécuter un
   effacement, gérer l'équipe Chioni. Ce sont des décisions sur le **tenant** et sur
   l'**argent**. Répondre à un ticket et le faire avancer n'est ni l'un ni l'autre : c'est
   littéralement le métier du rôle, et un `support` qui lirait la file sans jamais pouvoir y
   répondre serait décoratif. L'exception est **étroite** (poster un message, changer un
   statut), elle ne touche aucun droit de tenant ni aucun franc, et elle est **déclarée** dans
   le garde-fou (`TestSupportAnswersTicketsAndNothingElse`) plutôt que glissée en silence.
10. **LE point du lot : le gel administratif ne s'applique PAS au support.**
    `require_center_can_administer` n'est appelé nulle part dans `apps/support` — un centre
    suspendu pour impayé est précisément celui qui doit pouvoir demander « pourquoi suis-je
    gelé ? », et fermer le canal qui répond à la question ferait une boucle sans sortie.
    Verrouillé **trois fois** : par le gabarit « ce qui continue » (ouverture, réponse et
    dépôt de pièce sur un tenant `suspendu` ET `resilie`), par le **contraste** sur le MÊME
    centre (l'ajout de personnel répond bien 400 — l'absence de garde est une décision, pas
    un oubli), et par une **sonde structurelle** qui refuse l'import de la garde dans le
    module.
11. **Le risque résiduel, structuré et testé** (les trois parades de la décision 5) :
    (a) **aucun champ ne pointe un patient** — test structurel qui parcourt les relations des
    trois modèles contre une liste noire (`PatientProfile`, `Encounter`, `Prescription`,
    `VitalSigns`, `PatientDocument`, `Consent`, `Invoice`…) et refuse jusqu'à un nom de champ
    contenant « patient » ; (b) **le contenu n'entre JAMAIS dans un payload d'audit** — les
    quatre actions ne portent que des ids, la catégorie et les codes de statut, et un test
    ouvre un ticket au sujet volontairement toxique (« Le dossier de Mme Combo… ») pour
    vérifier qu'aucun mot n'en ressort ; (c) l'avertissement est **exporté côté API**
    (`SUPPORT_PRIVACY_NOTICE` dans `apps/support/models.py`) pour que l'écran et le backend ne
    dérivent pas. On informe, on structure, **on ne prétend pas empêcher**.
12. **[ARBITRAGE] Quatre actions d'audit, pas trois.** Le brief en nommait trois
    (`support_ticket.opened|status_changed|message_posted`) ; `support_ticket.attachment_uploaded`
    s'y ajoute — un fichier qui entre dans le système est exactement la classe d'événement que
    les ADR 0014/0016/0017 auditent partout ailleurs (`kyc_document.uploaded`,
    `patient_document.created`). Payload : ids seuls, **jamais un nom de fichier**. Les quatre
    portent leur `center` et entrent dans `DIRECTOR_JOURNAL_ACTIONS` (invariant 6) : ce sont
    les demandes de SON centre, et il les voit **sans le contenu**.
13. **Pièces jointes** : POST multipart sous le scope strict `uploads` (**POST seul** — lire la
    liste ne doit jamais s'affamer sur le budget d'upload), téléchargement par endpoint
    authentifié rejouant EXACTEMENT les permissions de la liste (`FileResponse` attachment,
    nom neutre `piece-<id>.<ext>`, `nosniff`), aucune URL nulle part (`url()` lève toujours).
    Une capture d'écran est un PNG : le cas d'usage principal passe sans toucher au socle, et
    le PDF reste différé (arbitrage commun ADR 0016/0017).
14. **[ARBITRAGE] L'exploitant reste anonyme côté centre.** `author_display` nomme l'auteur du
    côté `centre` uniquement (les gens de sa propre maison, qu'il lit déjà dans
    `GET /centers/{c}/staff/`) et vaut `null` pour Chioni — patron `actor_display` du journal
    du directeur. L'interlocuteur du centre est « Chioni », pas une personne. Symétriquement,
    aucun payload plateforme ne nomme un humain.

### La fermeture des deux derniers admins (décision 6)

15. **`PlatformStaffAdmin` et `StaffMembershipAdmin` passent en lecture seule**, et sont
    déclarés dans `SENSITIVE_MODELS` du test de fermeture du registre — avec les trois tables
    de support. La vigilance de la revue guardian S4 (« un superuser Django est toujours à un
    formulaire de la 4ᵉ casquette ») est **soldée** : un test bout-en-bout POSTe sur le
    formulaire de modification d'un exploitant existant et reçoit 403.
16. **Ce que ça retire, écrit noir sur blanc** dans les deux docstrings : pour le tenant, la
    création d'un membership sans `add_staff_member` (donc sans audit, sans compte ombre par
    téléphone, sans refus de doublon de rôle) et le changement de rôle sans la garde « dernier
    directeur actif » ; pour la plateforme, la révocation d'urgence par un superuser. Les deux
    leviers existent ailleurs, **audités** : `POST /platform/centers/{pk}/directors/` (déjà là
    depuis S4, avec la séparation des pouvoirs, et délibérément NON gelée par l'abonnement) et
    `PATCH /platform/operators/{pk}/`.
17. **`GET|POST /platform/operators/`, `PATCH /platform/operators/{pk}/` — `admin` SEUL, en
    lecture comme en écriture.** [ARBITRAGE] : la liste des personnes qui détiennent la 4ᵉ
    casquette est de la gouvernance, pas de la matière de support — un `support` n'a pas à
    savoir qui peut le désactiver. C'est la SEULE lecture du back-office fermée au `support`,
    et le garde-fou l'assure explicitement.
18. **Garde « dernier admin actif » RÉUTILISÉE, jamais dupliquée** : `update_platform_staff`
    appelle `_is_last_platform_admin(..., lock=True)` — la fonction du RGPD, avec son verrou de
    lignes ordonné qui a fermé la course des deux derniers admins en revue S4. Un test
    d'inspection de source verrouille la réutilisation : une garde recopiée dérive.
19. **[ARBITRAGE] Séparation des pouvoirs en MIROIR** :
    `accounts.services._refuse_center_staff_as_operator` refuse la 4ᵉ casquette à un compte
    portant un membership ACTIF dans un centre. Sans elle, l'état que
    `_refuse_platform_operator_as_director` (correctif guardian S4) interdit d'atteindre dans un
    sens restait atteignable dans l'autre : nommer directeur d'abord, donner la casquette
    ensuite. Une garde qui ne tient que dans un sens n'est pas une garde. **Honnêteté du
    correctif, identique à son miroir** : il supprime le chemin self-service, pas la
    possibilité — un employé Chioni qui est aussi infirmier quelque part le fait avec un SECOND
    compte. Et **la porte du tenant reste ouverte** : un directeur reste libre d'embaucher
    quelqu'un qui travaille chez Chioni, c'est SA décision, tracée (testé dans les deux sens).
20. **Payload d'un exploitant : des IDS, rien d'autre** (`{id, user, role, is_active,
    created_at, updated_at}`). Deux raisons, la seconde étant décisive : cohérence avec la file
    RGPD juste à côté (ADR 0017 lot 3 §5), et un compte ombre créé par téléphone porte son
    NUMÉRO dans son username (`invite-2693440020`) — rendre le username publierait
    discrètement un téléphone dans un payload que le test de champs négatifs existe pour garder
    propre. **Vigilance consignée** : une liste d'exploitants faite d'ids est austère ; donner
    des noms à l'équipe Chioni dans son propre back-office est un besoin légitime — ce sera un
    changement de contrat CONSCIENT, argumenté, pas un champ qui aura glissé.
21. **Pas de DELETE** sur un exploitant : la ligne est de l'histoire (c'est elle qui rend
    lisible une vieille entrée d'audit). On révoque (`is_active: false`), on ne supprime pas.
22. **`PATCH` partiel obligatoire, et c'est porteur** : `BooleanField` de DRF lit une clé
    ABSENTE d'un corps multipart comme `False` (une case décochée n'est pas soumise). Sans
    `partial=True`, un client qui n'envoie que `role` **désactivait silencieusement**
    l'exploitant. Corrigé, commenté sur place.
23. **Commande d'amorçage `create_platform_staff`** (`apps/accounts/management/commands/`), sur
    le modèle de `createsuperuser` : **aucune garde DEBUG** (contrairement à `seed_demo` et
    `simulate_psp_payment`, c'est LE geste d'installation), **aucun identifiant transmis** (le
    compte naît ombre, la personne le revendique par OTP — ADR 0010, même pour l'équipe
    Chioni), téléphone **normalisé E.164** (un numéro invalide arrête la commande en français
    plutôt que de créer un exploitant à qui personne ne peut se connecter), doublon **nommé**
    (jamais une promotion silencieuse), et la même séparation des pouvoirs qu'à l'API. Audit
    `platform_staff.created` avec `actor=None` : l'amorçage n'a pas d'acteur authentifié et le
    journal le dit plutôt que de prêter le geste à quelqu'un.
24. **Les deux actions `platform_staff.*` sont TRANSVERSES** (`center=None`) et donc hors
    liste blanche du journal du directeur par construction — elles ne concernent aucun tenant
    (même famille que l'authentification, la tutelle et le RGPD).

### Garde-fou structurel plateforme (invariant 5)

25. `tests/test_permissions_platform.py` étendu sur les quatre axes demandés : les 5 nouvelles
    routes GET dans la liste de champs négatifs (mesurées sur un ticket RÉEL, avec son fil, et
    sur un centre où vit une patiente nommée) ; les 2 nouvelles routes d'écriture `admin` dans
    le balayage « un `support` n'écrit rien » (dont la seconde route non-POST du back-office,
    `PATCH /platform/operators/{pk}/`) ; le module `apps.support.platform_views|serializers`
    dans l'assertion « aucun symbole `patient` » ; et l'exception du `support` sur les tickets
    prouvée POSITIVEMENT dans une classe dédiée qui la borne dans les deux sens.

### Seed démo

26. Un **second exploitant** `support.demo` (rôle `support`, +2693440021) — sans lui,
    l'arbitrage n° 9 n'est pas démontrable — et **un ticket OUVERT avec deux messages** :
    ouvert par `secretaire.demo` (pas le directeur, c'est le point), une réponse de Chioni.
    Contenu volontairement exemplaire : aucun nom de patient, aucune donnée médicale — le seed
    montre l'usage attendu. Étapes 11 et 12 du récapitulatif (répondre depuis `support.demo`,
    puis rouvrir un ticket sur un centre gelé pour voir que le canal reste ouvert).
27. `_ensure_platform_staff` passe désormais par le SERVICE (`create_platform_staff`), comme la
    commande d'amorçage : l'admin Django s'étant refermé sur cette table, le seed ne doit plus
    être le seul chemin qui l'écrit à la main.

### Tests

**106 tests neufs** — `tests/test_support.py` (49 : le gel qui ne s'applique pas écrit AVANT le
reste, permissions et cloisonnement, append-only du fil, machine à états, pièces jointes
privées, les deux parades du risque résiduel, file plateforme) et
`tests/test_platform_operators.py` (32 : création par téléphone, séparation des pouvoirs en
miroir, garde du dernier admin, audit, commande d'amorçage), plus les extensions de
`test_permissions_platform.py`, `test_admin_hardening.py` et `test_seed_demo.py`, et la factory
`make_support_ticket`. **Total suite : 1810 verts.**

Correctif de sonde au passage : `test_vital_signs.py::test_audit_references_only_never_a_value`
cherchait « 142 » et « 97 » dans le payload SÉRIALISÉ — un id de patient à 1297 la faisait
rougir sans qu'aucune mesure ait fuité. Elle est réécrite en contrat de CLÉS (le vrai contrat),
avec le motif consigné sur place.

### Vigilances consignées (lot 3)

- **Aucun trigger PostgreSQL** sur les trois nouvelles tables, alors que `SupportMessage` est
  append-only au niveau ORM seulement — même famille de dette que les tables S3, le lot 1 et le
  lot 2. Un `update()` brut par shell réécrirait un message envoyé. **Candidat du sprint SV**,
  avec les six autres tables de S5.
- **Le contenu d'un ticket n'est ni borné ni filtré** (au-delà des 5 000 caractères d'un
  message) : c'est le risque assumé de la décision 5. La parade est structurelle (aucune FK
  patient), informationnelle (`SUPPORT_PRIVACY_NOTICE`) et de gouvernance (contrat de revue) —
  jamais un filtre automatique, qui donnerait une fausse sécurité.
- **Aucune notification** : ni SMS ni e-mail quand Chioni répond, ni quand un ticket est ouvert.
  Le centre revoit son écran, l'exploitant sa file. Un SMS « Chioni vous a répondu » est un
  candidat naturel, à cadrer avec l'ADR 0012 (et il ne devra JAMAIS porter le contenu).
- **Aucun archivage ni suppression d'une pièce jointe** : contrairement aux pièces KYC et aux
  documents patients, il n'y a pas de chemin de correction. Une capture déposée par erreur y
  reste — à rouvrir si le terrain le demande (le geste existe déjà deux fois dans le produit).
- **La priorité n'est pas re-priorisable** (arbitrage n° 3) : un exploitant qui juge un ticket
  urgent ne peut que le dire dans un message. Réversible en une action POST.
- **Pas de support pour les patients ni les tuteurs** (hors périmètre acté de l'ADR : la tab bar
  lite est déjà pleine à 4 onglets), **pas de recherche plein texte** dans la file, **pas
  d'assignation** d'un ticket à un exploitant, **pas de SLA**. Une file de quelques dizaines de
  lignes s'en passe ; un vrai volume les demandera.
- **La liste des exploitants est faite d'ids** (§20) : austère, assumé, à rouvrir consciemment.
- **La séparation des pouvoirs reste contournable avec un second numéro**, exactement comme son
  miroir de S4 — c'est ce que la séparation des pouvoirs achète, pas une impossibilité.
- **Le frontend du module Support n'existe pas** : ce lot est backend. Les écrans (côté centre
  et 4ᵉ espace) restent à construire, avec l'avertissement de `SUPPORT_PRIVACY_NOTICE` **au
  moment d'écrire**, pas dans une aide repliée.

## Addendum — revue guardian S5 (2026-08-15)

Campagne adversariale sur les trois lots. **4 failles confirmées et corrigées**, 45 probes
pérennes (`backend/tests/test_adversarial_s5.py`), suite complète à 1855 tests.

### Ce que la revue a démenti dans cet ADR

Deux garanties écrites plus haut n'étaient pas tenues telles quelles — elles le sont
maintenant, et le texte d'origine est conservé pour mémoire :

1. **[ÉLEVÉ] La séparation des pouvoirs se contournait en trois appels, sans second numéro.**
   L'addendum LOT 3 disait la garde « contournable avec un SECOND numéro ». C'était optimiste :
   la garde ne regardait que les lignes `PlatformStaff` **actives**, et `update_platform_staff`
   n'en rejouait aucune. Un exploitant `admin` se désactivait (1), s'amorçait directeur d'un
   centre (2), se réactivait (3) — **même compte, en self-service** — et lisait le registre
   patients en clair. C'est l'escalade que S4 avait classée élevée et passé un sprint à fermer,
   rouverte par l'autre bout. Correctif : **réactiver une ligne d'exploitant vaut la créer**,
   donc porte la même garde. La porte du tenant reste ouverte (un directeur embauche qui il
   veut) et un changement de rôle sur une double casquette légitime passe toujours.
2. **[MOYEN] Les deux gardes en miroir passaient toutes les deux sous course réelle.** Chacune
   lisait la table de l'autre sans verrou : deux threads sur le même numéro créaient l'exploitant
   **et** le directeur. Correctif : les deux verrouillent d'abord la ligne `User` — pivot commun
   des deux portes et sommet de la hiérarchie de verrous depuis S4.

### Les deux autres correctifs

3. **[MOYEN] La relance SaaS partait deux fois** quand deux exécutions du beat se chevauchaient
   (`reminders_sent` incrémenté sans verrou) : le directeur recevait deux fois un SMS **portant
   un montant**, et le compteur retombait, rendant la cadence « J+0/J+7/J+21 puis silence »
   dépassable. Doubler ce message-là, c'est du harcèlement, pas une gêne. Correctif : verrou de
   ligne avant l'incrément, **avec solde et statut relus dessous** — une facture réglée entre la
   sélection et l'envoi ne relance plus et ne brûle pas de message.
4. **[FAIBLE] Deadlock PostgreSQL** sur deux rétrogradations d'exploitants simultanées (la ligne
   visée était verrouillée avant l'ensemble des sièges `admin`, qui la contient) : un 500 sur une
   route de gouvernance au lieu d'un refus français. Ordre canonique posé :
   **utilisateur → sièges → ligne visée**.

### Les invariants, vérifiés

- **« Le gel n'empêche jamais de soigner » : CONFIRMÉ**, et désormais garanti **par
  construction** plutôt que par énumération. Deux sondes fail-closed ferment la liste des
  modules qui *importent* la garde et celle des fonctions qui l'*appellent*, avec assertion
  négative explicite sur `deactivate_staff_member`, `add_center_director` et
  `_create_staff_membership`. Aucune cascade trouvée : la chaîne complète RDV → consultation →
  ordonnance → signes vitaux → clôture → facture patient → caisse → reçu « G- » passe sur
  `suspendu` **et** `resilie`, la fusion de doublons passe, l'anonymisation RGPD passe. Le
  contraste tient sur le même centre (embauche et statistiques répondent bien 400), et le gel
  n'est pas contournable : ni tarifs ni personnel n'ont d'autre porte, admin Django compris.
- **« L'exploitant ne voit ni clinique ni PII patient, support compris » : CONFIRMÉ pour le
  code.** Aucun champ des trois modèles support ne pointe un patient ; sujet, corps et nom de
  fichier n'apparaissent nulle part dans la table d'audit (balayage complet avec un ticket
  volontairement toxique) ; les pièces jointes sont en 404 croisé ; le directeur voit la réponse
  de Chioni dans son journal **sans le contenu et sans nommer l'exploitant**. Le risque résiduel
  reste celui que la Décision 5 nomme : un humain qui tape un nom de patient dans un champ
  libre. Rien dans le code ne l'empêche — c'est assumé, pas ignoré.
- **Étanchéité des registres : CONFIRMÉE dans les deux sens.** Le cycle SaaS complet laisse les
  six tables du ledger des soins au compteur exact, et — sens qui manquait — **encaisser au
  guichet ne bouge pas d'un franc le solde de Chioni**. Le miroir SQL et la dérivation unitaire
  du solde SaaS s'accordent sur les cinq états.

### Vigilances ajoutées (aucune preuve d'exploitation)

`send_appointment_reminders` (rappel J-1) a **exactement la même forme** que la faille 3 —
charge utile anodine, même remède le jour où on y touche · le premier SMS d'une facture très en
retard annonce « arrive à échéance aujourd'hui » (arbitrage de copie, non appliqué) · aucun
trigger PostgreSQL sur les 7 tables de S5 (dette la plus ancienne du lot, candidat n° 1 de SV) ·
annuler une facture qui n'est pas la dernière ne recule pas le curseur (perte de recette, pas de
sécurité) · une offre repricée à 0 KMF arrête silencieusement la facturation d'un tenant ·
`status_reason` / `cancel_reason` / motif de contre-passation sont des textes libres non bornés
écrits par Chioni et **lus par le directeur** (contrat de revue, comme `kyc_reason`).

## Conséquences

- Chioni devient un SaaS au sens plein : un contrat, une échéance, une facture, un canal de
  support — et un levier commercial réel, mais **borné par la même éthique que S4**.
- L'admin Django cesse d'avoir la moindre porte d'écriture sensible.
- Le registre séparé laisse intact le ledger des soins : la promesse « chaque franc relié à un
  patient, un acte et un prestataire » n'est pas diluée par la trésorerie de l'éditeur.
