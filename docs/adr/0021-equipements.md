# ADR 0021 — Inventaire des équipements (sprint S8)

- **Statut** : acté (cadrage court — l'audit ne réclamait pas d'ADR dédié pour ce module ;
  celui-ci existe pour tracer quatre décisions, pas pour cérémonie)
- **Date** : 2026-08-15
- **Sources** : audit §F.4 + §G/S8, ADR 0018 (gel), 0019/0020 (patrons d'app)

## Contexte

Un centre ne sait pas, dans Chioni, ce qu'il possède comme matériel médical ni ce qui marche.
C'est le plus petit module du plan et le moins sensible : ni donnée patient, ni argent, ni
donnée personnelle — hormis le nom de qui signale une panne.

## Arbitrages du PO (15/08/2026)

1. **Inventaire + état + signalement de panne.** Ce qu'un centre a besoin de savoir tout de
   suite : ce qu'il a, où, et si ça marche. La maintenance préventive planifiée attendra d'être
   vérifiée sur le terrain.
2. **Tout staff signale, le directeur décide.** C'est l'infirmière qui constate qu'un
   tensiomètre ne marche plus ; seul le directeur change l'état officiel et gère le parc — même
   esprit que le module Support, où la secrétaire ouvre le ticket.

## Décision 1 — App `apps/equipment`, deux tables

- `Equipment` : `center`, `name`, `category` (choix fermés : `diagnostic`, `imagerie`,
  `bloc_operatoire`, `laboratoire`, `mobilier_medical`, `informatique`, `autre`),
  `serial_number` (libre — le réel comorien n'a pas de format), `location`, `commissioned_on`
  (nullable), `status` ∈ `en_service` | `en_panne` | `reforme`, `notes`.
- `EquipmentReport` : `equipment`, `reported_by`, `description`, **append-only** — un
  signalement se corrige par un nouveau signalement, jamais par réécriture. Il ne change pas
  l'état de l'équipement : signaler est un constat, décider est un geste de directeur.

## Décision 2 — La localisation est un texte, pas une chambre

Aucune clé étrangère vers `inpatient.Room` : tous les centres n'ont pas d'hospitalisation, et
un échographe vit au bloc, en salle d'accouchement ou dans un couloir. Un texte libre couvre le
réel sans coupler deux modules qui n'ont pas de raison de se connaître.

## Décision 3 — Aucune valeur financière

Ni prix d'achat, ni amortissement, ni valeur de parc. Ce serait ouvrir une surface d'argent
sans cadrage, dans le module le moins surveillé du produit — et la comptabilité est le sujet
de S10. Décision explicite, pour qu'un futur champ « prix » soit un choix et non un glissement.

## Décision 4 — Rien n'est gelé, et c'est un écart assumé au patron RH

Contrairement au module RH (S7), **`apps/equipment` n'importe pas la garde de gel** :

- **signaler une panne doit toujours passer** — un appareil cassé est une information de soin,
  et le centre gelé est précisément celui qui a le plus besoin qu'elle circule ;
- geler la saisie d'un inventaire n'a **aucun levier commercial réel** : personne ne paie pour
  enregistrer un tensiomètre ;
- chaque extension de la liste des modules autorisés à importer cette garde **affaiblit la
  sonde fail-closed** qui la protège. Elle ne s'étend que quand elle sert.

## Décisions transverses

- **Permissions** : lecture par tout staff actif du centre ; **écriture du parc** (créer,
  modifier, changer l'état, réformer) **directeur seul** ; **signalement** par tout staff actif.
  Cloisonnement par centre au queryset (404 hors périmètre).
- **Audit** : `equipment.created|updated|status_changed`, `equipment.reported` — références et
  codes seuls, **jamais** la description d'un signalement (texte libre). Ces actions entrent
  dans la liste blanche du journal du directeur : c'est de la configuration de l'établissement,
  même famille que `room.created` et `tariff.created`.
- **Rien de S8 n'atteint le patient, le tuteur ou l'exploitant plateforme** — sonde de routes.
- Un équipement ne se supprime pas : il se **réforme** (`reforme`), état terminal. Le parc
  raconte son histoire, y compris ce qui est sorti du service.

## Conséquences

Le module est délibérément petit et pourra grandir sans refonte : la maintenance préventive
s'ajoutera comme une table de plus, et le lien vers une chambre — si un jour il a du sens —
comme un champ nullable à côté du texte libre, jamais à sa place.

## Addendum d'implémentation (S8 backend livré — 2026-08-15)

Choix arrêtés à l'implémentation, dans l'esprit des décisions ci-dessus. Aucun n'est un écart
de périmètre ; les ajouts au-delà de l'énumération de l'ADR sont signalés comme tels.

1. **Deux tables, quatre routes, une seule famille d'URL** (`centers/{c}/equipment/…`) :
   liste/création, détail/PATCH, `…/status/` (la seule porte de la machine à états) et
   `…/{pk}/reports/`. Rien sous `guardian/`, `patients/me/` ni `platform/`, et l'interdit est
   vérifié de front par la sonde de routes (`tests/test_adversarial_s3.py`, marqueurs
   `equipment`/`equipments`).

2. **LA décision de lecture du sprint : le constat à tout le staff, son AUTEUR au directeur
   seul.** `EquipmentReportSerializer` rend `{id, equipment, description, created_at}` ;
   `EquipmentReportDirectorSerializer` en hérite et n'ajoute que `reported_by` +
   `reported_by_display`. Les trois raisons, dans l'ordre de poids :
   - **un signalement ne change rien** (décision 1) : l'équipe n'a besoin d'aucun responsable
     pour agir, seulement de la phrase et de la date. Le nom n'est utile qu'à qui **décide** ;
   - **nommer le signaleur devant toute l'équipe refroidit le signalement** — dans une clinique
     de huit personnes, « qui a encore dit que l'appareil est cassé ? » suffit à faire taire la
     prochaine panne. La ligne n° 1 du produit vaut pour le personnel depuis S7 ;
   - **cohérence avec l'existant** : `GET /centers/{c}/staff/` est directeur seul ; rendre un
     nom — ou même un id résoluble via l'annuaire des praticiens — à tout le staff ferait de
     cette route une fenêtre latérale sur l'annuaire du personnel. Précédent exact :
     `AuditLogEntrySerializer.actor_display`.
     Le directeur, lui, ne gagne rien de neuf : son journal lui résolvait déjà le nom.
   **Arbitrage RÉVERSIBLE**, et il tient en un champ. L'équipement lui-même, à l'inverse, a **un
   seul sérialiseur de lecture** : un appareil n'a ni régime, ni secret médical, ni argent.

3. **Ce que la BASE garantit, et ce qu'elle ne garantit pas.** Trois `CheckConstraint` sur
   `Equipment` (statut et catégorie dans leur liste fermée, nom non vide) et une sur
   `EquipmentReport` (description non vide) : un `update()` brut ne peut pas inventer un état
   hors machine ni fabriquer une ligne de parc anonyme. La **terminalité** de `reforme`, elle,
   n'est pas exprimable en `CHECK` (elle compare deux versions d'une ligne) : elle est rejouée
   dans `Equipment.save()` — donc valable sur tout chemin d'écriture, y compris hors service.
   **Vigilance consignée** (même posture qu'en S3/S6/S7) : **aucun trigger PostgreSQL** sur les
   deux tables, donc un `UPDATE` brut concurrent ressusciterait un appareil réformé. Aucune
   route n'expose ce geste ; à rouvrir le jour d'un import de masse d'inventaire.

4. **`status` n'est pas dans les champs modifiables du PATCH** (`services.EDITABLE_FIELDS`) :
   un PATCH générique aurait contourné la machine à états, qui est la seule chose que ce module
   ait à protéger. Envoyé quand même, il est ignoré en silence — testé.

5. **Le signalement d'un appareil RÉFORMÉ est refusé** (400 français). Corollaire direct de
   l'état terminal — l'appareil est sorti du parc — et **sans aucun rapport avec le gel**, qui
   lui ne ferme jamais rien ici. Rejoué dans `save()`, **sur l'état relu EN BASE** (correctif de
   la revue guardian, voir l'addendum ci-dessous).

6. **Verrou de ligne sur l'équipement, et rien d'autre** (patron `_transition` de
   `apps/scheduling/services.py`) : deux décisions concurrentes se sérialisent, le perdant relit
   l'état du gagnant et reçoit le refus français, jamais un 500 — prouvé à threads réels. La
   hiérarchie est disjointe de celles de l'argent, du soin, de l'hospitalisation et du RH.

7. **[AJOUT au-delà de l'énumération, assumé] Deux compteurs de lecture** — `report_count` et
   `last_report_at`, annotés en une jointure agrégée dans `services.equipments_queryset` : le
   tableau de parc affiche « 3 signalements, le dernier le 12 août » sans N+1. Ils valent
   `0`/`null` dans la réponse d'une écriture (l'objet n'y est pas annoté), et le contrat
   frontend le dit.

8. **Le gel : première application du patron sans extension de la sonde.** `apps/equipment`
   n'importe pas `require_center_can_administer` — la liste `ALLOWED_IMPORTERS` de
   `tests/test_adversarial_s5.py` est **inchangée** (S7 en reste la seule extension depuis sa
   création). Le module pose son propre miroir local (`test_equipment.py`), qui refuse l'import
   **et** l'appel nu, avec le motif écrit à côté : *signaler une panne doit toujours passer*.
   Un test de contraste montre que le gel est bien câblé ailleurs sur le même centre.

9. **Django admin fermé dès la naissance** : les deux tables sont en lecture seule et déclarées
   dans `SENSITIVE_MODELS` (`test_admin_hardening.py`), donc couvertes par la fermeture de
   registre. `EquipmentReportAdmin.list_display` **n'affiche pas la description** : le texte
   libre d'un constat n'a pas à s'afficher en liste à côté du nom de qui l'a écrit — même
   posture que le contenu d'un ticket de support.

10. **Seed démo** : quatre appareils (tensiomètre, échographe, centrifugeuse, table
    d'accouchement), dont l'échographe **signalé par `medecin.demo` puis mis en panne par le
    directeur** — les deux gestes, les deux personnes, par les vrais services. Idempotent.

11. **Hors périmètre confirmé à l'implémentation, et consigné plutôt que comblé en douce** :
    aucune valeur financière (décision 3, verrouillée par une sonde d'absence de champ **et**
    par l'absence de tout `DecimalField`/`FloatField`), aucune maintenance préventive, aucun
    champ de responsabilité, aucun cycle de vie sur un signalement (ni statut, ni `resolved_at`),
    **aucune liste de signalements à l'échelle du centre** (un « fil des pannes récentes » serait
    utile au directeur ; il n'est pas dans l'ADR — à ouvrir si le terrain le demande), et aucun
    export.

12. **Reliquat** : le module n'a **pas** de vue de pilotage (« taux de panne », « parc par
    catégorie »). Le patron existe (`hrm/stats/attendance/`, `inpatient/occupancy/`), mais un
    indicateur sur quatre appareils n'apprend rien — à rouvrir quand un centre aura un parc
    réel.

**Le tout est verrouillé par `backend/tests/test_equipment.py` (47 tests), et la suite complète
passe à 2327 tests.** Recommandation : passe de l'agent `chioni-health-data-guardian` — le
module ne touche ni argent ni donnée médicale, mais il expose une PII de personnel (le nom du
signaleur) et l'arbitrage d'audience mérite d'être attaqué.

## Addendum de revue guardian (S8 — 2026-08-15)

Passe adversariale ciblée, calibrée sur la taille du module : **23 sondes** dans
`backend/tests/test_adversarial_s8.py`, deux d'entre elles vérifiées détectrices par mutation
réelle du code (garde d'audience privée de son centre → la sonde multi-centre échoue ;
`OrderingFilter` posé sur la liste des signalements → la sonde d'oracle échoue).

**L'arbitrage d'audience tient.** L'auteur d'un signalement n'atteint aucun non-directeur :
ni par le tri, le filtre, la pagination ou une sélection de champs (aucun `filter_backend`
n'est déclaré, ni localement ni globalement) ; ni par les métadonnées `OPTIONS` ; ni par
contamination de classe entre les deux sérialiseurs (`Meta.fields` du directeur est une
**nouvelle** liste, pas un `+=` sur celle du parent) ; ni par une casquette de directeur portée
dans un AUTRE centre ; ni par une rétrogradation non prise en compte ; ni par une fenêtre
latérale (`/staff/` et le journal sont 403, et le signalement ne porte **aucun** identifiant —
ni celui de l'utilisateur, ni celui du membership qui est la clé de l'annuaire des praticiens).

**Un constat, gravité Faible, corrigé** — la garde « un appareil réformé ne se signale plus »
lisait le statut de l'instance **en mémoire** (`self.equipment.is_decommissioned`). La vue
charge l'appareil puis insère : une instance chargée avant la décision du directeur glissait un
signalement sur un appareil sorti du parc. L'état est désormais **relu en base** dans
`EquipmentReport.save()`, comme la terminalité l'est déjà dans `Equipment.save()`. Pas de
`select_for_update` : `save()` est appelable hors transaction (factories, imports), où il
lèverait — leçon de la faille S4 du `select_for_update` hors `atomic`. **Fenêtre résiduelle
assumée** : un commit concurrent à la microseconde entre la relecture et l'INSERT, sans
conséquence (un constat de plus sur un appareil réformé à cet instant). Sonde de régression :
`TestTheTerminalStateHoldsOnEveryPath`.

**Vigilances non bloquantes** (à consigner au sprint SV, aucune n'est une faille) :

- `update_equipment` sur une fiche dont un autre directeur vient de prononcer la réforme
  échoue avec le message de terminalité, alors qu'il ne touchait pas au statut : refus
  **fail-closed** mais message trompeur. À retoucher si le cas remonte du terrain.
- Pas de trigger PostgreSQL sur les deux tables (déjà consigné au point 3) : un `UPDATE` brut
  ressusciterait un appareil réformé. Aucune route n'expose ce geste.
- `GET /centers/{c}/equipment/` n'est pas paginé (choix assumé, point 1) : un parc très grand
  rendrait une réponse lourde. Même posture que les chambres et l'annuaire RH.
