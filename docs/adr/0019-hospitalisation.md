# ADR 0019 — Hospitalisation : lits, séjours, surveillance (sprint S6)

- **Statut** : acté (cadrage S6 — les 3 arbitrages structurants sont TRANCHÉS PAR LE PO le 2026-08-15)
- **Date** : 2026-08-15
- **Sources** : audit §F.3 + §F.2.2 + §D.4 + §G/S6, étude des besoins §5.1, ADR 0002 (carnet
  transversal), 0005 (nature générique), 0013 (rendez-vous), 0016 (dossier enrichi), 0018 (gel)

## Contexte

Un centre qui hospitalise ne sait pas, dans Chioni, où sont physiquement ses patients ni
combien de places il lui reste. `VitalSigns` (S3) porte une FK **obligatoire** vers une
consultation, avec un commentaire qui renvoyait explicitement l'hospitalisé à ce sprint. Et
l'infirmière qui relève une tension à 6 h du matin ne fait pas une consultation.

## Arbitrages du PO (15/08/2026)

1. **Socle exploitable** : chambres, lits, admission, sortie, transfert, tableau d'occupation
   du jour. Étages et services s'ajouteront sans refonte.
2. **La journée d'hospitalisation est un acte tarifé ordinaire**, facturé par la grille
   existante — aucun second moteur de facturation.
3. **Le patient voit son séjour, le tuteur ne voit rien de clinique** : le verrou de S3 tient.

## Décision 1 — Le séjour héberge, la consultation soigne

Un `Encounter` **ne peut pas** porter un séjour, et le code le prouve : il n'a pas de date de
fin (`occurred_at` est un instant), son `practitioner` est un singleton non-nul quand un séjour
a plusieurs intervenants, et les statistiques comptent chaque `Encounter` comme une unité
d'activité — un séjour de huit jours compté pour une consultation fausserait le pilotage.

Mais l'inverse est tout aussi vrai : **la production clinique n'a pas à déménager**. Actes,
ordonnances, carnet, documents et signes vitaux pendent déjà à `Encounter`, et
`ActPerformed.encounter` comme `Invoice.encounter` sont non-nuls — un séjour facturable sans
consultation exigerait de toucher au gel des factures et aux triggers de validation, c'est-à-dire
au cœur de l'argent, pour un gain nul.

**Décision** : nouvelle app `apps/inpatient`, modèle `Stay` portant le **contexte
d'hébergement** (patient, centre, lit, dates, priorité, médecins assignés), adossé à un
**`Encounter` pivot obligatoire** (`OneToOne`) qui porte la **production clinique et la
facturation**. L'admission crée sa consultation ; la sortie la clôture. On n'hospitalise pas
sans acte médical : cette obligation est médicalement juste avant d'être commode.

### Conséquence heureuse : `VitalSigns` n'est pas touché

Puisque le séjour a une consultation ouverte du premier au dernier jour, **les relevés répétés
s'y rattachent tels quels**. Aucune migration, aucune contrainte XOR, et surtout aucun des sept
points de rupture que la cartographie a identifiés — dont le plus dangereux :
`ViaEncounterQuerySet.for_patient()` filtre sur `encounter__patient`, et l'oublier aurait rendu
le carnet du patient **silencieusement incomplet**. `VITAL_SIGNS_BOUNDS`, la règle « au moins
une mesure » et l'invariant praticien-du-centre restent une définition unique.

L'ADR 0016 disait « l'hospitalisé est le module S6, ce modèle ne le préfigure pas » : la réponse
de S6 est qu'il n'a pas besoin d'être préfiguré — le séjour apporte le contexte, la consultation
reste le porteur. Un **addendum à l'ADR 0016** consignera ce dénouement.

Ce que cela coûte, et qui est assumé : `measured_at` reste libre (vigilance SV.2 ouverte), donc
rien n'empêche techniquement un relevé daté hors des bornes du séjour ; et la feuille de
surveillance se lit par la consultation pivot, pas par une table dédiée.

## Décision 2 — Le lit est une ressource exclusive, garantie par la base

- `Room` : `center`, `name`, `is_active`. `Bed` : `room`, `name`, `is_active`. Pas d'étage ni de
  service en S6 (arbitrage PO n° 1) — `Room` est prête à recevoir un `floor` nullable plus tard.
- `BedAssignment` : `stay`, `bed`, `assigned_at`, `released_at` (nullable), `assigned_by`.
  **Append-only** : un transfert libère l'assignation courante et en ouvre une nouvelle — on ne
  réécrit pas l'historique d'un lit, on l'empile. C'est ce qui rend un transfert traçable.
- **Invariant central** : `UniqueConstraint` **partielle** sur `bed` `WHERE released_at IS NULL`.
  Deux admissions simultanées sur le même lit sont impossibles **par la base**, pas par
  discipline de service — et la course est testée à threads réels, comme la caisse (ADR 0015).
- `Stay.bed` n'existe pas comme champ : le lit courant se lit par l'assignation ouverte. Un
  patient **admis sans lit** (attente, couloir — réalité comorienne) est donc représentable, et
  c'est voulu : refuser l'admission faute de lit libre reviendrait à refuser un patient présent.
- Invariant de périmètre rejoué dans `save()` (règle d'ingénierie du projet, jamais seulement
  dans le service) : le lit, la consultation pivot et les médecins assignés appartiennent au
  centre du séjour.

## Décision 3 — Machine à états du séjour

`Stay.status` ∈ `en_cours` | `sortie` | `annule`, transitions **fermées** et sérialisées par
verrou de ligne (patron `_transition` de `apps/scheduling/services.py`) :
`en_cours → sortie` (sortie, libère l'assignation et clôture la consultation pivot),
`en_cours → annule` (admission saisie par erreur, motif obligatoire, aucune journée facturée).
Jamais de saut d'état, jamais de retour depuis un terminal.

`priority` (`normale` | `urgente` | `critique`) et `attending` (médecins assignés, plusieurs,
réassignables) vivent sur le séjour. Le **motif d'admission** est du clinique : il vit sur
`Encounter.reason`, déjà role-gaté, jamais dupliqué sur le séjour.

## Décision 4 — Facturation : N journées = N actes

Le centre crée un `TariffItem` de catégorie générique `hospitalisation` (la valeur **existe
déjà** dans `ActCategory`). Un service `bill_stay_days(stay, tariff, days)` pose **un
`ActPerformed` par journée** sur la consultation pivot, puis la facturation existante prend le
relais sans rien apprendre de nouveau.

- **Jamais de quantité sur une ligne** : ajouter `quantity` casserait `recompute_total()`,
  `unpaid_invoices_qs` et `stats/finances`. N lignes, pas une ligne × N.
- **Le staff déclenche, le système ne facture pas tout seul.** Une facturation automatique à la
  sortie transformerait une erreur de saisie de date en créance réelle sur un patient.
- Le tuteur qui finance verra `hospitalisation` comme nature générique de l'acte — c'est déjà
  le contrat du Pont de Confiance (ADR 0005), et cela n'ouvre aucune donnée clinique.

## Décision 5 — Visibilité (arbitrage PO n° 3)

| Audience | Ce qu'elle voit |
|---|---|
| Rôles cliniques du centre | tout : séjours, lits, assignations, surveillance |
| Staff administratif du centre | l'occupation et les séjours **sans le clinique** (ni motif, ni diagnostic) — même segmentation qu'`EncounterAdminSerializer` |
| Patient | son séjour dans son carnet (`GET /patients/me/stays/`) : centre, dates, sans le lit ni la priorité |
| Tuteur | **rien** |

Le verrou tuteur de S3 est **structurellement fermé** par une sonde qui refuse toute route
`/guardian/` touchant une ressource clinique : S6 ne l'étend pas, et la sonde doit être
**complétée** avec les marqueurs du séjour pour que l'interdit soit explicite plutôt
qu'accidentel.

## Décision 6 — Ce que S6 ne touche pas

- **Le gel commercial ne s'applique JAMAIS à l'hospitalisation**, paramétrage des chambres et
  des lits **compris** : un lit est le prérequis physique d'une admission, le bloquer
  reviendrait à empêcher d'hospitaliser. Concrètement, `apps/inpatient` **n'importe pas**
  `require_center_can_administer` — et la sonde fail-closed de S5, qui verrouille la liste des
  importeurs par égalité stricte, fera échouer la suite si quelqu'un l'oublie un jour.
- **Le journal du directeur** : `stay.admitted`, `stay.discharged`, `bed.assigned` disent quel
  patient occupe quel lit — c'est clinique, donc invisible du directeur (la liste blanche les
  exclut déjà par défaut). En revanche `room.created` / `bed.created` sont de la configuration,
  au même titre qu'un tarif : elles y entrent consciemment.
- **L'occupation instantanée** (« combien de lits libres maintenant ? ») sert à admettre : elle
  vit dans le module, pas dans `stats_views.py` — qui est du pilotage, gelable, et dont les
  `assertNumQueries` sont verrouillés. Une série d'occupation dans le temps sera un endpoint
  dédié, plus tard.

## Invariants transverses (obligations d'implémentation)

1. **Exclusivité du lit garantie par contrainte DB**, course prouvée à threads réels.
2. **Rien de S6 n'atteint le tuteur** — sonde de routes étendue.
3. **`apps/inpatient` n'importe jamais la garde de gel** (sonde S5 fail-closed).
4. Audit : `stay.admitted|discharged|cancelled`, `bed.assigned|released`, `room.created`,
   `bed.created` — références et codes seuls, **jamais** un motif d'admission (même classe qu'un
   diagnostic), jamais un nom.
5. `merge_profiles` gagne une étape par table patient-ancrée : les séjours suivent la cible.
   Le commentaire actuel qui affirme que les signes vitaux « pendent à leurs consultations »
   reste vrai — et c'est précisément pourquoi la Décision 1 est la bonne.
6. Admin Django : nouveaux modèles déclarés dans les listes du test de fermeture du registre,
   sinon la suite casse (c'est le but).
7. Seed démo étendu : deux chambres, quatre lits, un patient hospitalisé avec sa surveillance.

## Hors périmètre S6 (consigné)

Étages et services · types de lits et états d'entretien · réservation prévisionnelle · forfaits
journaliers et suppléments de chambre · sortie contre avis médical · série temporelle
d'occupation · stocks et laboratoire (module ultérieur) · lecture tuteur du séjour (conditionnée
à SV.1.1 comme toute lecture clinique tuteur).

## Addendum d'implémentation (S6 backend livré — 2026-08-15)

Choix arrêtés à l'implémentation, dans l'esprit des décisions ci-dessus. Aucun n'est un écart
de périmètre ; les deux ajouts au-delà de l'énumération de l'ADR sont signalés comme tels.

1. **Invariant des médecins assignés : récepteur `m2m_changed`, pas `save()`.** Un
   `ManyToManyField` n'est jamais écrit par `Stay.save()` (`add()`/`set()` compilent en insert
   groupé sur la table de liaison). L'équivalent structurel exact de l'invariant
   praticien-du-centre d'`Appointment.save()` est donc un récepteur `pre_add` : il couvre le
   service, l'admin, le shell et les fixtures. Le lit et la consultation pivot, eux, sont bien
   dans `save()` comme le demande la décision 2.
2. **Deux contraintes partielles, pas une.** À l'exclusivité du lit (`WHERE released_at IS
   NULL` sur `bed`) s'ajoute son miroir sur `stay` : un patient est dans **un** lit à la fois.
   Sans elle, un transfert qui aurait oublié de libérer compterait le patient deux fois au
   tableau d'occupation.
3. **Verrou de ligne sur le lit AVANT la contrainte.** La contrainte est la garantie ; le
   verrou (`select_for_update` sur `Bed`, puis sur `Stay` — hiérarchie **lit → séjour**, disjointe
   de la hiérarchie argent) sert à rendre le refus du perdant *propre* (400 français) plutôt
   qu'une `IntegrityError` qui empoisonnerait sa transaction. Les deux couches sont testées, la
   seconde à threads réels.
4. **Une admission qui demande un lit occupé est refusée en bloc** (rollback de toute
   l'admission, pivot compris). Ce n'est pas « refuser un patient faute de lit » : le champ
   `bed` est optionnel, et le même patient est immédiatement ré-admissible sans lit. On refuse
   une demande *non satisfaisable telle qu'écrite*, on n'admet pas en douce ailleurs que là où
   le service l'a demandé (verrouillé par la course à threads réels).
5. **Un patient n'a qu'un séjour en cours à la fois** (garde de service) : deux séjours ouverts
   pour la même personne seraient une erreur de saisie, jamais un cas réel.
6. **La sortie clôture le pivot, l'annulation aussi.** `annulee` sur un `Encounter` reste hors
   périmètre (cascade de facture non tranchée — ADR 0008 addendum S1) : une admission annulée
   clôture donc son pivot en `terminee`. La clôture **tolère un pivot déjà fermé** (un
   clinicien a pu le clore depuis les routes encounter) — sinon un vrai patient resterait
   coincé dans un lit pour une raison de plomberie.
7. **Garde d'annulation : « aucun acte sur le pivot »** — lecture stricte de « aucune journée
   facturée ». Une admission qui a déjà produit du soin facturable n'était pas une erreur de
   saisie ; on n'ouvre pas la question de la cascade de facture par la porte de derrière.
8. **`_require_open_encounter` ne s'applique PAS à `bill_stay_days`** : cette règle garde la
   production *clinique* (ordonnances, carnet), alors qu'un acte est de la production
   *facturation* — et les journées d'un séjour se facturent normalement **après** la sortie,
   qui vient de clôturer le pivot. Cohérent avec la décision S1 « facturer une consultation
   close reste permis ».
9. **`billed_days` est DÉRIVÉ, jamais stocké** : nombre d'`ActPerformed` du pivot dont la
   catégorie générique *figée* (snapshot ADR 0005) vaut `hospitalisation`. Annoté en SQL sur
   la liste des séjours pour ne pas payer une requête par ligne.
10. **[AJOUT au-delà de l'énumération §4, assumé] `stay.days_billed`.** Poser N actes est de
    l'argent, et la règle de projet (« AuditLog sur toute action sensible : argent ») prime sur
    l'exhaustivité de la liste de l'ADR. Payload : ids, tarif, nombre de journées — jamais un
    libellé. Comme les autres actions de séjour, elle est **hors** liste blanche du journal du
    directeur (elle dirait combien de temps un patient a été hospitalisé).
11. **Permissions arrêtées** (RÉVERSIBLES, à rouvrir si le terrain le demande) : lecture des
    séjours et de l'occupation = **tout staff actif**, payload segmenté ; admission / sortie /
    annulation / lit / médecins assignés = **rôles cliniques** (une admission ouvre une
    consultation, c'est un acte clinique par construction) ; facturation des journées =
    **rôles BILLING** (patron `create_invoice`) ; déclaration des chambres et des lits =
    **directeur seul** (structure physique de l'établissement, change rarement). La trace des
    transferts (`bed-assignments/`) est **clinique seule** : le guichet a déjà la seule réponse
    dont il a besoin, « où est le patient maintenant ».
12. **`cancel_reason` visible des rôles cliniques SEULS** — précédent `Invoice.cancel_reason`
    (visible des BILLING seuls) : texte libre écrit par les décideurs, pour les décideurs.
13. **Le pharmacien lit la vue d'exploitation**, pas la clinique : il livre dans les chambres,
    il n'a pas à lire le motif d'admission (`is_clinical_member` reste le seul test, et
    `CLINICAL_ROLES` ne le contient pas).
14. **Renommer / désactiver une chambre ou un lit est HORS périmètre S6** : `is_active` existe
    sur les deux modèles (les querysets l'honorent) mais aucune route ne le bascule. Deux
    raisons : les états d'entretien d'un lit sont explicitement hors périmètre, et l'énumération
    d'audit de l'ADR ne comporte pas de `room.updated` / `bed.updated` — ajouter une action
    de configuration au journal du directeur est une décision, pas un effet de bord. Consigné.
15. **Bornes de plausibilité** : admission ni dans le futur (tolérance 5 min, patron du
    guichet RDV) ni antérieure à un an ; sortie ni dans le futur ni avant l'admission ;
    facturation bornée à 366 journées par geste.
16. **L'export RGPD (`/auth/me/export/`) n'a PAS gagné de clé `stays`.** Son contrat est
    verrouillé par les tests S4 et l'ajouter est un geste à faire en conscience. L'épisode
    reste lisible par sa consultation pivot, qui **est** dans l'export — rien n'est caché au
    patient. Reliquat consigné, verrouillé par un test qui dit l'état réel du produit.

## Addendum — correctif PO du 15/08/2026 : facturation idempotente et plafonnée

Tranché par le PO après la revue guardian, qui avait laissé deux constats ouverts sur la
décision 4 (gravité moyenne, consignés en SV plutôt que corrigés) :

1. `bill_stay_days` n'avait **aucun jeton d'idempotence**. Deux POST identiques posaient
   2 × N `ActPerformed` sur la consultation pivot — et comme `create_invoice` sans `act_ids`
   facture **tous** les actes de la consultation, le doublon partait en créance réelle
   réclamée à un patient.
2. **Aucun plafond** : rien ne reliait le nombre de journées facturables à la durée réelle du
   séjour. La sonde le prouvait — 200 journées facturées sur un séjour d'une heure.

### A. Où vit la clé, et pourquoi là

Nouveau modèle `inpatient.StayDayBilling` : **un lot = un geste de facturation** (séjour,
centre, tarif, nombre de journées, clé d'idempotence, `acts` en M2M vers les `ActPerformed`
posés, `billed_by`). Append-only, comme tout ce qui touche à l'argent.

L'alternative était un champ sur les actes eux-mêmes ; elle a été écartée sur le critère posé
par le PO — « pouvoir répondre *ces N actes ont déjà été posés par cet appel* sans ambiguïté » :

- sur `ActPerformed`, la clé serait **dupliquée N fois**, donc aucune contrainte d'unicité ne
  pourrait la porter — or c'est précisément la base qui doit trancher les rejeux concurrents ;
- `ActPerformed` n'a **pas de centre** (il l'atteint par deux jointures), et l'unicité voulue
  est *par centre* (patron `CashPayment`) ;
- cela pousserait une préoccupation d'hospitalisation dans le modèle d'argent **partagé** de
  tout le produit, alors que S6 s'était tenu à ne rien déplacer.

Le lot répond exactement à la question (`acts` **est** la liste), porte son propre `center`
pour la contrainte, et garde toutes les colonnes S6 dans `apps/inpatient`.

**Contraintes DB** : `unique_stay_day_billing_key_per_center` (clé obligatoire, unique par
centre — pas seulement applicative) et `stay_day_billing_days_positive`.

**Sémantique**, copiée de la caisse (ADR 0015 + correctif guardian S1) :

- clé **fournie par le client** et **OBLIGATOIRE** (le guichet la rend facultative pour ne pas
  casser ses appelants historiques ; cette route est neuve, personne n'a d'excuse — et un jeton
  facultatif est un jeton que la moitié des clients oublie) ;
- rejeu **à l'identique** → **200** avec le même résultat, aucun acte de plus, **aucune entrée
  d'audit de plus** ;
- rejeu **à paramètres différents** (autre séjour, autre tarif, autre nombre de journées) →
  **400 explicite**. Répondre en silence l'ancien résultat effacerait des livres la seconde
  intention — c'est le correctif guardian S1, il n'est pas perdu ;
- le rejeu se résout **sous le verrou du séjour et avant toute autre vérification** : le geste
  qui a *atteint* le plafond doit rester rejouable, sinon le seul cas où le client a perdu la
  réponse serait justement celui qui échoue (leçon « facture déjà réglée » de la caisse) ;
- la course sur des séjours **différents** (lignes de verrou distinctes) est arbitrée par la
  contrainte : `IntegrityError` → transaction du perdant annulée (actes compris) → relecture du
  gagnant commité → 400 de non-concordance.

**Le code de statut reste 200 dans les deux cas**, contrairement au 201/200 du guichet : le
corps de cette route est le **séjour** (une ressource qui existait déjà), jamais le lot créé.
Annoncer un `201 Created` pour une ressource absente de la réponse serait une information sur
laquelle le client ne peut rien faire. `billed_days` dit ce qui s'est passé.

### B. La règle de durée (choix produit, à relire comme tel)

> **Toute journée civile entamée sous le toit du centre est facturable, et pas une de plus.**

`billable_days_cap(stay) = (date de fin − date d'admission) + 1`, en **heure des Comores**
(`TIME_ZONE`, comme le journal de caisse et la file du jour) :

- séjour **en cours** → la fin est *maintenant* : le plafond grandit avec le séjour, sans
  qu'aucune tâche n'ait à le rafraîchir ;
- séjour **sorti** → la fin est `discharged_at`, définitivement (l'état est terminal) ;
- admission et sortie le même jour → **1 journée** : quatre heures d'hospitalisation se
  facturent, elles ne sont pas gratuites.

Pourquoi la journée civile plutôt que des tranches de 24 h : c'est ainsi qu'un service compte
(« elle est restée du 3 au 7 »), c'est vérifiable par le patient sur un calendrier mural sans
arithmétique sur des horodatages, et cela n'interdit pas la pratique courante « jour d'entrée +
jour de sortie » (une nuit à cheval sur deux dates ouvre bien 2 journées). Un décompte en
tranches de 24 h l'aurait interdite : Chioni aurait imposé une politique de facturation là où
il ne doit poser qu'une borne.

Le plafond est **cumulé** (les journées déjà facturées comptent) et le refus **dit** le plafond,
les dates, ce qui est déjà facturé et ce qui est demandé — un refus qui n'explique pas est un mur.

**Corollaire assumé** : le tarif doit désormais être de nature générique `hospitalisation`. Le
compteur de journées est dérivé de la catégorie *figée* (addendum n° 9) ; une « journée »
facturée sous une autre nature serait invisible du compteur et rouvrirait le plafond à chaque
geste. Refus 400 explicite.

**Sur l'existant** : le plafond borne les gestes à venir, il ne réécrit rien. Un séjour
sur-facturé avant ce correctif garde ses actes (la correction est une annulation de facture,
pas une réécriture silencieuse de l'historique) — mais il ne peut plus rien ajouter. Verrouillé
par un test qui dit cet état.

### C. Ce que le correctif ne change pas

- **Aucun import de `require_center_can_administer`** : facturer les journées est de la caisse,
  cela doit continuer sur un centre gelé (sonde S5 fail-closed, par égalité stricte).
- **Hiérarchie de verrous inchangée** : ce geste prend la ligne du **séjour** et rien d'autre —
  patient → lit → séjour, disjointe de celle de l'argent.
- **Payload d'audit** : `billing_id` s'ajoute aux références existantes ; la clé d'idempotence,
  qui est du **texte libre écrit par un client**, n'y entre **jamais** (même règle qu'un motif).
- **Admin** : `StayDayBillingAdmin` en lecture seule et inscrit dans la liste de fermeture du
  registre — un formulaire y serait la seule porte capable de rejouer une clé ou de délier un
  lot de ses actes.
- **Fusion de doublons** : rien à ajouter à `merge_profiles`. Le lot est ancré au **séjour**,
  pas au patient ; il suit donc le séjour que la fusion ré-ancre déjà (invariant 5).
- **Rien de tout cela n'atteint le tuteur ni le patient** : aucun sérialiseur n'expose le lot,
  qui est un objet de plomberie du guichet.
- Les deux sondes de la revue guardian qui documentaient l'état défaillant sont **converties**,
  pas supprimées : elles disent maintenant « le rejeu ne double plus » et « les journées sont
  bornées par la durée », en rappelant la faille qu'elles fermaient.

## Conséquences

- Le carnet du patient gagne son épisode le plus lourd sans qu'une seule ligne de sa lecture
  transversale ne bouge.
- Le centre sait où sont ses patients et ce qu'il lui reste de places — et ne peut pas mettre
  deux personnes dans le même lit.
- La facturation d'un séjour n'invente aucun mécanisme : elle réutilise la grille tarifaire, la
  caisse, le rail diaspora et les reçus, tels qu'ils sont.
