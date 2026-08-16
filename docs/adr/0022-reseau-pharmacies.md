# ADR 0022 — Le réseau des pharmacies, acteur hors tenant (sprint S9)

- **Statut** : acté (cadrage dédié — l'audit §G le réclame explicitement avant toute ligne de code)
- **Date** : 2026-08-16
- **Sources** : audit §F.7 (pivot de périmètre) + §C.1 (poste pharmacien) + §G/S9,
  ADR 0002 (cloisonnement tenant), 0004/0005 (consentement minimal, nature générique),
  0012 (SMS métier), 0014 (uploads durcis), 0017 (tenant de plein droit, 4ᵉ casquette),
  0021 (patron d'app sobre)

## Contexte

Aux Comores, rares sont les centres avec une pharmacie dédiée : le rôle staff `pharmacien`
est mal ajusté au terrain. Et la douleur réelle n'est pas dans le centre — elle est sur la
route. Un patient sort avec son ordonnance et fait le tour des pharmacies jusqu'à trouver
celle qui a les médicaments, parfois d'une commune à l'autre, parfois pour rien.

Le pivot acté par le PO : **la pharmacie devient un acteur à part entière, hors du tenant
centre**. Elle s'enregistre dans Chioni, la plateforme la valide, et elle répond à des
demandes de disponibilité qui ne lui apprennent rien sur le patient.

C'est le premier module du produit où une donnée de soin franchit la frontière du centre
vers un tiers qui n'a signé aucun consentement, ne relève d'aucun secret partagé et n'est
lié au patient par rien. Tout le cadrage tient dans cette phrase.

## Arbitrages du PO (16/08/2026)

1. **Demande adressée, pas catalogue déclaré.** Le centre envoie la liste aux pharmacies
   d'une zone ; chacune répond ligne par ligne. Aucun stock n'est déclaré à l'avance —
   un catalogue non tenu à jour ment, et son mensonge coûte un déplacement au patient.
2. **La pharmacie voit la commune, jamais le centre.** Asymétrie voulue : l'annuaire des
   pharmacies est public, l'activité d'un centre ne l'est pas.
3. **Le centre lance, le patient consulte.** La recherche part en fin de consultation (le
   bon moment, la bonne personne) ; les réponses redescendent dans le carnet du patient.
4. **Le poste du pharmacien interne (dette C.1) entre dans S9.** `Status.DELIVERED` existe
   depuis le premier jour et n'est posé par aucun service.

## Le risque directeur — anonymiser n'est pas dé-identifier

Une liste de médicaments sans nom **reste réidentifiable** dans une commune de deux mille
habitants. Un antirétroviral, un traitement de tuberculose, un antipsychotique ou un
abortif demandé à la pharmacie du village désigne quelqu'un — le pharmacien connaît ses
clients, et il verra entrer la personne dans l'heure.

Trois conséquences de conception, non négociables, qui traversent toutes les décisions :

- **le prescripteur choisit les lignes qui sortent** (toutes cochées par défaut,
  décochables une à une) — c'est lui qui sait laquelle est parlante ;
- **la diffusion est bornée et annoncée** : une commune, un plafond de destinataires, et le
  nombre de pharmacies qui vont recevoir est affiché avant l'envoi. Un envoi à cinquante
  pharmacies pour un médicament rare est le pire scénario ;
- **aucun signal latéral** ne vient recomposer le contexte : ni nom de centre, ni identifiant
  de demande partagé entre officines, ni volume, ni fréquence, ni série. L'horodatage, lui,
  **reste** : la fraîcheur est la moitié de l'utilité du service — une officine doit savoir
  si la demande date de dix minutes ou de deux jours. Il ne désigne personne à lui seul,
  puisque le centre demandeur n'apparaît nulle part.

## Décision 1 — La pharmacie n'est PAS un centre de santé

App `apps/pharmacy`, modèles `Pharmacy` et `PharmacyMembership` **propres**. Aucune
réutilisation de `HealthCenter`, et surtout **aucun `StaffMembership`**.

`StaffMembership` est la clé des permissions du tenant : `active_membership_qs` est
interrogée par toutes les gardes de centre. Un utilisateur de pharmacie qui en porterait une
serait, pour chaque vue existante, « du staff » — et il faudrait alors ré-auditer chaque
route du dépôt pour en exclure « un centre qui est une pharmacie ». C'est une régression
sans fin. À l'inverse, **un compte de pharmacie sans aucun `StaffMembership` ne peut, par
construction, atteindre aucune route de centre** : le cloisonnement est structurel, pas
déclaratif. Précédent exact : `PlatformStaff` (ADR 0017) n'est pas non plus un membership,
pour cette raison-là.

Corollaire assumé : une pharmacie n'a ni patients, ni ledger, ni rail diaspora, ni
abonnement, ni RH, ni lits. Elle n'hérite d'aucun de ces modules, et n'aura pas à s'en
défendre.

## Décision 2 — La demande naît d'une ordonnance, et ne contient aucun texte libre

`AvailabilityRequest` porte : le centre (jamais rendu à la pharmacie), l'ordonnance
(idem), la zone, l'auteur, un statut, et des `AvailabilityRequestItem` qui sont des
**copies figées du libellé de médicament** des lignes cochées.

- **Copies, pas clés étrangères** : modifier une ligne d'ordonnance demain ne doit pas
  réécrire une demande d'hier, et le payload rendu à la pharmacie ne doit jamais pouvoir
  se résoudre vers le haut.
- **La posologie ne sort pas.** `PrescriptionItem.dosage` (« 2 fois par jour pendant sept
  jours ») dit comment le patient vit avec son traitement ; une pharmacie n'en a pas besoin
  pour dire qu'elle a la boîte. Seul `medication` franchit la frontière.
- **Aucune demande libre, aucun champ éditable.** Le prescripteur coche, il n'écrit pas.
  Un champ de texte libre partant vers un tiers serait le canal par lequel un nom de patient
  finirait par sortir un jour — pas par malveillance, par habitude de la fiche papier.
  Corollaire consigné : on ne peut pas interroger le réseau pour un médicament qui n'est
  pas sur une ordonnance. C'est une limite, elle est voulue.

## Décision 3 — La réponse est un constat daté, jamais un engagement

`AvailabilityResponse` (append-only, une par couple demande × pharmacie) + une ligne par
médicament : `disponible` | `indisponible`. Une pharmacie qui se trompe se corrige par une
nouvelle réponse ; l'historique reste.

**Pas de prix en S9** — c'est mon arbitrage, l'audit laissait la question ouverte (« dispo /
pas dispo (/ prix ?) »), il est réversible et tient en un champ. Trois raisons : un prix
affiché à un patient devient une promesse opposable ; un classement par prix ferait de
Chioni un comparateur, ce qui change sa relation aux pharmacies et demande son propre
cadrage (engagement, litige, réglementation locale du prix du médicament) ; et la sobriété
financière du module suit le précédent S8 (ADR 0021, décision 3). À rouvrir dès que le
terrain le réclame — ce sera un vrai sujet, pas un oubli.

Un **commentaire libre** de la pharmacie (« j'ai le générique ») revient au centre, qui saura
le lire. Il **ne descend pas dans le carnet du patient** : c'est du texte non modéré écrit
par un tiers, et l'écran patient doit rester une information, pas une conversation.

## Décision 4 — Le ciblage est administratif, jamais géographique

Île (`Ngazidja` | `Ndzuwani` | `Mwali`) et commune, en listes fermées. **Aucune coordonnée
GPS, aucune carte, aucun calcul de distance.** On ne localise personne — ni le patient, ni
le personnel, ni le commerce ; on ne charge pas de fond de carte sur un Android d'entrée de
gamme en 2G ; et le réel comorien se navigue au village, pas en latitude.

## Décision 5 — L'enregistrement suit le patron S4, allégé

La plateforme crée la pharmacie et son premier responsable en une transaction (compte ombre
→ OTP, jamais de mot de passe transmis) — miroir exact de `POST /platform/centers/`. Le
self-service d'inscription reste hors périmètre, comme il l'est pour les centres.

Statut : `en_attente` | `validee` | `suspendue`. Une pharmacie non validée **n'apparaît pas
dans l'annuaire et ne reçoit aucune demande** — valider une officine sans preuve serait du
théâtre, donc `PharmacyDocument` reprend le pipeline de pièces justificatives (socle
ADR 0014, stockage privé, archivage définitif) déjà cloné deux fois (KYC centre S4,
justificatif de congé S7). Suspendre coupe la réception des demandes, et rien d'autre :
la pharmacie garde la lecture de son historique.

## Décision 6 — Ce que le pharmacien interne gagne, et ce qu'il ne gagne pas

Il gagne son poste de travail : `GET /centers/{c}/prescriptions/` (la liste que l'audit
C.1 réclamait, rôles `PRESCRIPTION_READ_ROLES`, filtres date/patient/statut) et
`POST …/prescriptions/{pk}/deliver/` qui pose enfin `Status.DELIVERED`, avec
`delivered_at` / `delivered_by`, audité, **sans marche arrière** (on ne « dé-délivre » pas ;
une erreur se raconte dans le carnet, elle ne s'efface pas).

Il ne gagne pas : la délivrance partielle ligne par ligne, le stock de la pharmacie interne,
la substitution générique. Hors périmètre, consigné plutôt que baclé.

## Décision 7 — Rien n'est gelé, et rien ne touche l'argent

Aucune écriture au ledger, aucune facture, aucun abonnement : **la pharmacie ne paie rien en
S9** (elle apporte la valeur du réseau ; la facturer demanderait un tenant facturable
complet — c'est un autre sprint, et peut-être un autre modèle).

Le gel d'abonnement (ADR 0018) ne s'applique pas : chercher un médicament pour un patient
est un geste de soin, et un centre en impayé est précisément celui dont les patients ont le
moins les moyens de courir la ville. `ALLOWED_IMPORTERS` reste donc **inchangée** — S7 en
demeure la seule extension — avec une sonde miroir locale à S9, comme en S8.

## Décision 8 — Une demande périme

`ouverte → close` : fermeture manuelle par le centre (« on a trouvé ») et fermeture
automatique par un beat Celery au-delà de `AVAILABILITY_REQUEST_TTL_HOURS` (défaut 48, même
patron que `PSP_INTENT_STALE_HOURS`). Une réponse sur une demande close est refusée. Un
« disponible » vieux de trois semaines est un faux espoir, et un faux espoir se paie en
trajet.

## Décision 9 — Les SMS ne disent jamais le médicament

- **À la pharmacie** : « Vous avez une nouvelle demande de disponibilité. » Rien d'autre.
  Le destinataire n'est pas le patient, mais la donnée, elle, parle de lui — et un SMS
  atterrit sur un téléphone partagé, prêté, perdu (ADR 0012).
- **Au centre** : aucun SMS. Le personnel est dans l'application.
- **Au patient** : aucun SMS en S9. La notification « votre médicament est disponible » est
  le prolongement naturel le plus désirable du module — et le plus délicat à écrire sans
  rien dire du traitement. Elle mérite son propre passage, pas une ligne en fin de sprint.

## Décision 10 — Le 5ᵉ espace

`(pharmacie)` côté frontend : chrome sobre dérivé de l'espace plateforme (3ᵉ manifeste de
navigation, ni ⌘K ni customizer, `CenterContext` jamais monté), mobile-first — une officine
comorienne répond depuis un téléphone, au comptoir. `/auth/me/` gagne une clé `pharmacy`,
routeur du 5ᵉ espace, miroir de `platform_staff`.

## Décisions transverses

- **Audit** : `pharmacy.created|validated|suspended`, `availability.requested|answered`,
  `prescription.delivered` — références et codes seuls. **Jamais un libellé de médicament**
  dans un payload d'audit : c'est du `detail_clinique` (ADR 0005).
- **Le tuteur ne voit rien.** Pas la demande, pas la réponse, pas la pharmacie. La
  disponibilité d'un traitement est une information clinique ; le verrou tuteur de S3 tient
  tel quel. Sonde de routes étendue aux marqueurs `pharmacy|pharmacies|availability`.
- **Invariant du sprint, à tester par champs négatifs** : aucun nom, identifiant, téléphone,
  ordonnance, consultation ni centre n'est sérialisable vers une pharmacie. Une pharmacie
  connaît une zone, une liste de médicaments et un numéro de demande.
- **Throttle dédié** sur l'émission des demandes : la diffusion est le seul geste du produit
  qui parle à des tiers en masse.

## Conséquences

Chioni gagne un acteur qu'il ne gouverne pas : une pharmacie n'est pas un client, pas un
patient, pas un salarié du réseau. Le module est délibérément pauvre — il ne sait dire que
« qui a quoi, maintenant, près d'ici » — et c'est précisément ce qui le rend acceptable :
plus il en saurait, plus il vaudrait la peine d'être attaqué.

Les prolongements sont ouverts sans refonte : stock déclaré (une table de plus, si le terrain
prouve qu'il serait tenu), délivrance tracée côté réseau, notification patient, prix. Aucun
n'est un pré-requis de S9.

## Addendum d'implémentation (S9 backend livré — 2026-08-16)

Choix arrêtés à l'implémentation, dans l'esprit des décisions ci-dessus. Les ajouts au-delà
de l'énumération de l'ADR sont signalés comme tels ; les absences sont consignées plutôt que
comblées en douce.

1. **Huit tables, quatre familles d'URL.** `pharmacy/` (le 5ᵉ espace), `platform/pharmacies/`
   (le back-office), `centers/{c}/…` (l'annuaire, l'envoi, le fil des recherches, le comptoir
   du pharmacien) et `patients/me/prescriptions/{pk}/availability/` (le carnet). **Rien sous
   `guardian/`**, et l'interdit est vérifié de front par une sonde de routes.

2. **LA liste blanche du sprint est un `Serializer` nu monté sur la LIGNE DE DIFFUSION**
   (`InboxRequestSerializer` sur `AvailabilityRequestRecipient`), pas un `ModelSerializer` sur
   la demande : le centre et l'ordonnance ne sont pas « exclus », ils sont **hors de portée** —
   aucun champ de `AvailabilityRequest` ne peut y arriver par héritage, par `__all__` ou par
   distraction. L'`id` rendu est celui de la diffusion, pas de la demande : deux officines qui
   compareraient leurs écrans ne peuvent pas savoir qu'elles parlent de la même recherche.
   Quatorze sondes de champs négatifs (dont `request_id`) tiennent le contrat de face.

3. **La posologie ne sort pas** (au-delà de la décision 2, arrêté ici) : seul
   `PrescriptionItem.medication` est recopié. Une officine n'a pas besoin de savoir comment le
   patient vit avec son traitement pour dire qu'elle a la boîte.

4. **Aucun prix en S9** — arbitrage de l'implémenteur sur un point que l'audit laissait ouvert
   (« dispo / pas dispo (/ prix ?) »), motivé dans la décision 3 et **réversible en un champ**.
   Verrouillé par une sonde d'absence, comme la sobriété financière de S8.

5. **Le commentaire d'une officine s'arrête au centre.** Deux sérialiseurs distincts
   (`…ResponseCenterSerializer` / `…ResponsePatientSerializer`), et une sonde qui vérifie
   qu'une phrase écrite par un pharmacien n'atteint pas le carnet.

6. **Un refus, pas une troncature** : au-delà de `AVAILABILITY_REQUEST_MAX_RECIPIENTS`
   (défaut 15, garde de boot), l'envoi est refusé **avec le compte réel** et une consigne
   (« précisez la commune »). Leçon S8 : un plafond muet se lit « tout est couvert ».
   Deux autres refus protègent la même garde : une zone sans officine validée, et un doublon
   d'une recherche OUVERTE sur la même ordonnance et la même zone (le double-clic ne diffuse
   pas deux fois).

7. **La péremption est opposable AVANT le beat.** `answer_availability_request` compare
   `expires_at` à l'instant courant sous verrou de la demande ; le beat horaire ne fait que
   solder l'enregistrement (statut + raison). Un ordonnanceur en retard n'ouvre donc aucune
   fenêtre — même posture que la garde anti-double-débit de S1 vis-à-vis de la purge des
   intents.

8. **Hiérarchie de verrous du module : utilisateur → pharmacie → demande.** Disjointe de
   celles de l'argent, du soin, de l'hospitalisation et du RH. Le niveau `utilisateur` n'est
   pris que par la garde de séparation des pouvoirs (patron S4/S5, où il est déjà le niveau le
   plus externe) ; `pharmacie` sert la garde « dernier membre actif » ; `demande` sérialise une
   réponse avec la fermeture par le centre ou la péremption.

9. **[AJOUT assumé] Séparation des pouvoirs sur le réseau** : un exploitant Chioni actif ne
   peut pas être inscrit dans une officine (`_refuse_platform_operator_as_pharmacy_member`,
   ligne `User` verrouillée d'abord — leçon S5). Le conflit visé est précis : *celui qui valide
   les pharmacies ne doit pas valider la sienne*. Même honnêteté que ses deux gardes miroir :
   elle supprime le chemin en libre-service, elle ne rend pas la combinaison impossible.

10. **[AJOUT assumé] `PRESCRIPTION_ROLES` remonte dans `apps/common/roles.py`.** Le groupe
    vivait dans `apps/medical/views.py` avec la mention « ce module est son seul
    consommateur » ; S9 lui en donne un second. La règle du module est respectée — un groupe
    monte quand deux apps en dépendent, pas avant — et l'ancien nom reste en alias pour les
    appelants et les tests historiques.

11. **[AJOUT assumé] `apps/common/geo.py`.** `Island` est désormais partagée ;
    `HealthCenter.Island` reste en place (la déplacer coûterait une migration sur une table
    centrale pour un gain nul), et **un test verrouille la parité des deux listes** : si l'une
    gagne une île et pas l'autre, le ciblage d'une demande laisserait des officines hors de
    portée.

12. **Le lien d'appartenance n'a pas de rôle** (décision consignée) : une officine comorienne
    compte une à trois personnes qui font le même travail. Tout membre actif répond, dépose les
    pièces et inscrit un collègue — avec la seule garde « pas la dernière personne », miroir du
    « dernier directeur ».

13. **Ni gel ni KYC.** `apps/pharmacy` n'importe pas `require_center_can_administer` :
    `ALLOWED_IMPORTERS` reste **inchangée** (S7 en demeure la seule extension depuis la création
    de la sonde), avec un miroir local qui refuse l'import **et** l'appel nu, motif écrit à
    côté. `_require_center_can_collect` est absente pour la même raison : suspendre un centre
    ferme le rail diaspora, et lui seul.

14. **Dette C.1 soldée** : `GET /centers/{c}/prescriptions/` (la liste que le pharmacien n'a
    jamais eue) et `POST .../{pk}/deliver/`, qui pose enfin `Status.DELIVERED` avec
    `delivered_at`/`delivered_by`. La délivrance est **définitive**, rejouée dans
    `Prescription.save()` sur l'état relu EN BASE (leçon S8), sans `select_for_update` dans
    `save()` (leçon S4). Ouverte aux mêmes rôles que la lecture : dans un centre sans officine
    interne — la majorité aux Comores — c'est l'infirmière qui remet les médicaments.
    `delivered_by` n'est **pas** rendu au patient : aucune identité de personnel ne traverse une
    vue patient.

15. **Audit** : dix actions, payloads en ids / codes / **compteurs**, jamais un libellé de
    médicament ni un commentaire. `availability.requested` et `availability.closed` portent leur
    centre mais restent **hors** de la liste blanche du journal du directeur (sphère clinique,
    même famille que `prescription.created`) ; `availability.answered` ne porte **aucun** centre
    — le journal d'un directeur n'a pas à devenir la fenêtre par laquelle le réseau se lit.

16. **SMS** : un seul texte, vers le numéro DÉCLARÉ de l'officine (un envoi par pharmacie, pas
    par personne) — « vous avez une nouvelle demande de disponibilité », **sans médicament, sans
    centre, et sans même le nombre de lignes** (« 6 médicaments » dit déjà quelque chose d'une
    ordonnance).

17. **Vigilances consignées** (aucune n'est une faille, toutes vont au sprint SV) :
    - les ids d'items et de lignes de diffusion sont des compteurs globaux : une officine peut
      estimer grossièrement le **volume du réseau**. Sans conséquence patient, corrigeable par
      une référence par demande le jour où cela gêne ;
    - **aucun trigger PostgreSQL** sur les huit tables (même posture que S3/S6/S7/S8) : un
      `UPDATE` brut concurrent rouvrirait une demande close. Aucune route n'expose ce geste ;
    - `AvailabilityResponse.responded_by` est stocké mais **rendu à personne** — pas même à
      l'officine (« qui de nous deux a répondu ? »). À rouvrir si le terrain le demande ;
    - la boîte de réception n'est pas purgée : une officine accumule ses demandes closes
      indéfiniment (pagination, pas de nettoyage). Le RGPD n'est pas en cause — il n'y a
      aucune donnée personnelle dedans ;
    - la couture avec le RGPD (S4) n'a pas d'équivalent du défaut RH de S7 — aucun fichier du
      module ne porte l'identité d'un patient —, mais les **pièces justificatives d'une
      officine portent celle de son responsable : c'est exactement le genre de couture que la
      revue guardian doit attaquer.**

**Le tout est verrouillé par `backend/tests/test_pharmacy.py` (97 tests) ; la suite complète
passe à 2 474 tests.** Recommandation : passe de l'agent `chioni-health-data-guardian` — le
module fait franchir à une donnée de soin la frontière du centre vers un tiers qui n'a signé
aucun consentement, ce qui est la surface la plus sensible ouverte depuis le Pont de Confiance.

## Addendum de revue adversariale (guardian S9 — 2026-08-16)

Six correctifs, dont **deux élevés**. Le fait marquant de la passe : **l'invariant du
sprint a tenu** — aucun chemin trouvé par lequel une officine apprendrait le centre,
l'ordonnance, le patient ou la posologie (sérialiseurs, réponses d'écriture, messages de
refus, métadonnées OPTIONS, SMS, payloads d'audit : tous attaqués de front). Les six défauts
sont ailleurs, et cinq d'entre eux sont des **coutures** : la garde qui ne tient que dans un
sens, la casquette que l'effacement RGPD oublie de fermer, le réglage qui n'est branché nulle
part, l'instance en mémoire relue au lieu de la base. C'est-à-dire, à nouveau, *ce que
personne ne relit entre deux sprints*.

1. **[ÉLEVÉ] La séparation des pouvoirs ne tenait que dans un sens.** L'addendum n° 9
   pose `_refuse_platform_operator_as_pharmacy_member` — un exploitant Chioni actif ne
   s'inscrit pas dans une officine. Mais `accounts.services._refuse_center_staff_as_operator`,
   qui garde la porte inverse, ne regardait que `StaffMembership`. Il suffisait donc de
   **prendre les casquettes dans l'autre ordre** : inscrire d'abord la personne dans
   l'officine, lui donner la 4ᵉ casquette ensuite. Elle validait alors sa propre pharmacie
   sans qu'aucune pièce n'ait été lue, suspendait avec motif celle d'en face, et
   téléchargeait les licences et pièces d'identité de tout le réseau. C'est **la faille de S5
   rejouée mot pour mot** (« S4 avait fermé la porte d'entrée, S5 laissait la sortie
   ouverte »), sur une porte neuve. Correctif : la garde lit désormais les DEUX tables, sous
   le même verrou de ligne `User`, avec un message distinct par casquette ; la relecture à la
   réactivation d'un exploitant révoqué (correctif S5) hérite de la garde sans autre
   changement. Course réelle à deux fils vérifiée sur les trois portes.

2. **[ÉLEVÉ] Le throttle dédié à la diffusion était inerte.** L'ADR en fait une décision
   transverse — « la diffusion est le seul geste du produit qui parle à des tiers en masse ».
   La vue posait `self.throttle_scope = "availability"` puis retournait
   `super().get_throttles()`, or `DEFAULT_THROTTLE_CLASSES` ne contient que
   `UserRateThrottle`, dont le scope est figé à `user` et qui **ignore** l'attribut. Le budget
   de 60/h n'existait donc que dans les settings : le geste retombait sur le plafond global
   généreux de 600/min, soit des dizaines de milliers de listes de médicaments — et de SMS —
   par heure depuis un seul compte clinique compromis. Les cinq autres modules du dépôt
   retournent explicitement `[ScopedRateThrottle()]` ; celui-ci avait oublié le `return`.
   Correctif appliqué, plus une sonde de bout en bout (deuxième envoi → 429).

3. **[MOYEN] La 5ᵉ casquette ne se fermait pas à l'effacement RGPD.** `anonymize_user`
   promet « the hats close » et fermait quatre casquettes sur cinq : le lien d'appartenance à
   une officine restait `is_active=True`. Conséquence opérationnelle, et c'est elle qui
   compte : la garde « jamais la dernière personne » se satisfaisait d'un **fantôme**, si bien
   que le dernier membre réel pouvait se retirer et laisser une boîte de réception que
   personne ne peut plus ouvrir — pendant que `member_active_count` affichait « 1 » au
   back-office, rendant le problème invisible de Chioni. Correctif : écriture **directe** (et
   non via `deactivate_pharmacy_member`, dont la garde ferait ÉCHOUER l'effacement d'une
   pharmacienne seule dans son officine — **leçon S7 : aucune contrainte métier ne met en
   échec un droit RGPD** ; le chemin de secours `POST /platform/pharmacies/{pk}/members/`
   existe précisément pour ce cas), comptée dans le payload `user.anonymized`.

4. **[MOYEN] Une officine validée se relocalisait elle-même.** `PHARMACY_EDITABLE_FIELDS`
   contient `island` et `city`, et l'ADR le justifiait par « un déménagement est légitime ».
   Il l'est — mais la zone n'est pas une ligne d'adresse : c'est **la seule borne à la
   distance que parcourt une liste de médicaments**, et elle était auto-déclarée APRÈS
   validation. Une officine validée à Fomboni se déclarait à Moroni et entrait, à la seconde
   suivante et sans que personne ne revérifie rien, dans le ciblage de chaque diffusion de la
   capitale — c'est-à-dire dans le flux d'ordonnances que le plafond de destinataires existe
   pour restreindre. Correctif : **déclarer un déménagement renvoie l'officine
   `en_attente`**, par la porte unique du statut (verrou, machine à états — la transition
   `validee → en_attente` est ajoutée), avec un motif écrit POUR elle. Elle garde tout
   (historique, pièces, gens, demandes déjà reçues, qui sont figées sur des lignes de
   diffusion) et ne reçoit plus rien jusqu'à confirmation. Miroir exact du KYC d'un centre.
   **Arbitrage produit, RÉVERSIBLE — il tient dans un `if`** : si le terrain montre que Chioni
   ne revalide pas assez vite, le PO peut préférer un simple signalement au back-office.
   Effet de bord assumé et nommé : la transition `validee → en_attente` étant désormais dans
   la machine, la plateforme peut aussi remettre une officine en examen sans la suspendre —
   c'est une gradation utile (« je revérifie » n'est pas « je sanctionne »), et le motif reste
   facultatif dans ce sens-là puisqu'aucune faute n'est reprochée.

5. **[MOYEN] La diffusion lisait l'ordonnance en mémoire et ne verrouillait rien.** Deux
   défauts, une cause. (a) `prescription.status` était lu sur l'instance chargée par la vue
   AVANT la transaction : une délivrance commise entre les deux — le comptoir sert pendant que
   le médecin cherche — laissait partir la liste d'une ordonnance déjà servie. **Leçon S8 mot
   pour mot**, appliquée à `EquipmentReport` mais pas ici. (b) La garde anti-doublon lisait
   « aucune demande ouverte » sans verrou : deux envois concurrents passaient tous les deux et
   la même liste partait DEUX fois vers N officines avec 2×N SMS, alors que l'addendum n° 6
   promet que « le double-clic ne diffuse pas deux fois ». Correctif : verrou de ligne sur
   l'ordonnance, pris en premier — **la hiérarchie du module devient
   `utilisateur → pharmacie → ordonnance → demande`**, et `deliver_prescription` prend le même
   verrou et aucun autre, donc pas de cycle. Ajoutée au passage, en défense en profondeur : le
   service vérifie que l'ordonnance appartient bien au centre passé en argument (la vue le
   scellait déjà, le service ne le rejouait pas).

6. **[FAIBLE] L'archivage d'une pièce lisait l'instance en mémoire.** Deux archivages
   concurrents passaient tous les deux ; la seconde écriture réécrivait `archived_at` /
   `archived_by` et le journal portait deux entrées pour un seul geste, sur une action
   présentée comme définitive. Relecture sous verrou (le document est une feuille de la
   hiérarchie).

Deux durcissements mineurs faits au passage : les listes d'entrée (`item_ids` côté centre,
`lines` côté **pharmacie**, c'est-à-dire depuis un acteur hors tenant) sont bornées à 100 —
un corps de cent mille identifiants était matérialisé puis passé tel quel dans un `pk__in`
avant d'être refusé.

**40 sondes ajoutées** (`backend/tests/test_adversarial_s9.py`), dont quatre courses à threads
réels sur les trois portes de la séparation des pouvoirs et sur le double-clic de diffusion.
Les six correctifs sont vérifiés **détecteurs par mutation réelle du code** (patron S8) : la
sonde tombe quand on retire le correctif. Un test de `test_pharmacy.py` a été adapté (il
prouvait « la fiche s'édite, le statut ne se choisit pas » en modifiant la commune, ce qui
est désormais le cas de la relocalisation — il édite l'adresse et la preuve est intacte).

### Vigilances consignées (aucune n'est une faille — toutes vont au sprint SV)

- **La corrélation entre officines est un accepté, pas un invariant.** L'addendum n° 2
  affirme que l'`id` rendu étant celui de la ligne de diffusion, « deux officines qui
  compareraient leurs écrans ne peuvent pas savoir qu'elles parlent de la même recherche ».
  C'est **faux par conception** : le payload porte délibérément l'horodatage (la fraîcheur est
  la moitié de l'utilité) et la liste exacte des médicaments — deux officines les comparent
  trivialement, et les ids d'items, également partagés, n'ajoutent qu'un canal à un fait déjà
  acquis. La phrase est corrigée ici plutôt que dans le code : la fermer demanderait un alias
  d'item par destinataire et changerait le contrat de réponse, pour un gain nul tant que
  l'horodatage et la liste sortent (et ils doivent sortir). **Ne pas relire cette phrase comme
  une garantie.**
- **Un centre JAMAIS vérifié diffuse au réseau.** L'absence de `_require_center_can_collect`
  est motivée par la suspension (« suspendre ferme le rail diaspora, et lui seul ») — mais
  elle couvre aussi, silencieusement, le KYC `en_attente`, c'est-à-dire un tenant dont Chioni
  n'a encore rien vérifié. Il peut diffuser des listes de médicaments à N officines et
  consommer N SMS. Le raisonnement de l'ADR portait sur une sanction ; ce cas-là n'est pas une
  sanction. À trancher : rien (statu quo), ou un plafond réduit tant que le KYC n'est pas
  actif.
- **Oracle téléphone → nom sur `POST /pharmacy/{p}/members/`.** La réponse rend le
  `display_name` du compte existant quand le numéro est déjà connu : un membre d'officine —
  **y compris d'une officine encore `en_attente`, que Chioni n'a rien vérifié** — peut
  énumérer des numéros et apprendre le nom réel de leur titulaire (le nom d'un patient reste
  hors d'atteinte : il vit sur `PatientProfile`, pas sur `User`). La porte des centres a la
  même propriété depuis toujours, avec un acteur validé ; ici l'ensemble des appelants est
  plus large. Correctif possible et peu coûteux : ne pas résoudre l'identité d'un compte
  préexistant dans la réponse de création.
- **TOCTOU sur le statut de l'officine à la réponse.** `answer_availability_request` relit le
  statut EN BASE mais sans verrou, et sous le verrou de la *demande* : une suspension commise
  dans la microseconde suivante laisse passer une réponse. Verrouiller la pharmacie ici
  **inverserait la hiérarchie déclarée** (`pharmacie → demande`) et risquerait un deadlock avec
  le retrait d'un membre — le laisser en l'état est le bon arbitrage, il est nommé.
- **La pièce d'identité du responsable survit à son effacement RGPD.** `PharmacyDocument`
  n'a pas de champ désignant la PERSONNE photographiée (seulement `uploaded_by`), donc aucune
  purge ciblée n'est possible sans heuristique. Posture **identique à celle de
  `centers.KycDocument.piece_identite_directeur` depuis S4** : ce n'est donc pas une
  régression de S9 mais une question produit à trancher une fois pour les deux tables (une
  pièce justifiant une décision de licence est-elle un document d'entreprise ou une donnée
  personnelle ?).
- **Une ordonnance délivrée ne ferme pas les recherches encore ouvertes.** Elles périment
  d'elles-mêmes en 48 h et une officine qui répond ne fait de mal à personne, mais le centre
  garde une ligne « en attente » sans objet. Un `close_availability_request` en cascade dans
  `deliver_prescription` coûterait trois lignes — à faire si l'écran le réclame.
- **Le doublon n'est gardé que par (ordonnance, île, commune).** Diffuser la même ordonnance
  à trois communes voisines reste possible, chacune sous le plafond : le prescripteur peut
  donc atteindre 3 × 15 officines en trois gestes. Le throttle (désormais réel) borne le
  rythme, pas le cumul. Consigné plutôt que corrigé : le prescripteur est un acteur de
  confiance, et un plafond cumulé par ordonnance mériterait son propre cadrage.
- **L'export RGPD art. 20 n'a ni clé `availability` ni clé `pharmacy_memberships`** — même
  reliquat que `stays` (S6) et le RH (S7). Vérifié en revanche : `PrescriptionSerializer`, qui
  y est repris, gagne bien `delivered_at` et **pas** `delivered_by` (aucune identité de
  personnel ne traverse une vue patient).
- Les vigilances 17 de l'addendum d'implémentation (ids compteurs globaux, absence de trigger
  PostgreSQL sur les huit tables, `responded_by` stocké et rendu à personne, boîte de
  réception non purgée) restent valides et non traitées par cette passe.

## Addendum de revue adversariale (guardian FRONTEND S9 — 2026-08-16)

Sept correctifs, dont **deux élevés**. Le fait marquant de la passe est le même
qu'au backend, transposé : **l'invariant du sprint a tenu**. Aucun écran de
l'officine ne réserve d'emplacement à un centre, un patient, une ordonnance ou
une posologie ; `CenterContext` n'est monté nulle part sous `(pharmacie)` (la
règle de module de `screens/pharmacie/shared.tsx` rend la vérification lisible
dans les imports) ; aucune route pharmacie n'existe côté tuteur ; le 5ᵉ espace
ne garde qu'un identifiant d'officine en `localStorage` et ne journalise rien.
La modale de diffusion, elle, ne peut pas envoyer plus que ce qui est coché :
le serveur exige la liste explicite, `selectedIds` est filtré sur
`prescription.items`, et une ligne ajoutée à l'ordonnance pendant que la modale
est ouverte n'entre pas dans l'envoi — elle est écartée par omission, pas
incluse par distraction.

Les sept défauts sont, comme au backend, des **coutures**. Et deux d'entre eux
sont le même défaut : celui que les revues frontend S5, S6 et S7 ont déjà
relevé, et corrigé écran par écran à chaque fois.

1. **[ÉLEVÉ] La fenêtre d'affichage inter-tenant, rejouée sur une surface
   clinique — fermée à la RACINE cette fois.** `useAsync` conservait sa donnée
   quand ses deps changeaient : `loading` remontait, mais `data` ne tombait
   qu'au retour du réseau. Tout écran de détail qui garde sa donnée pendant un
   rechargement (`loading && !data ? squelette : …`) peignait donc l'objet
   PRÉCÉDENT sous le nouveau nom, pendant des centaines de millisecondes sur
   une connexion comorienne. Sur `/centre/ordonnances/recherches/[id]`, le
   sélecteur de centre de l'en-tête ne quitte pas la page : un soignant de deux
   centres y gardait **la liste de médicaments et les réponses d'officines du
   centre qu'il venait de quitter**. Sur `/pharmacie/demandes/[id]`, la même
   chose entre deux officines. Aggravant : l'état optimiste (`patched`)
   survivait lui aussi et, n'étant jamais nul, **empêchait le 404 de la
   relecture de s'afficher** — l'écran ne se corrigeait donc jamais tout seul.

   Correctif en deux étages, et le premier vaut pour les cinq espaces :
   (a) `useAsync` efface `data`/`error` **au rendu** où les deps changent
   (patron React « ajuster l'état quand les props changent », comparaison
   élément par élément ; `reload()` explicitement HORS de la comparaison, pour
   que recharger après une écriture ne fasse pas clignoter la liste) ;
   (b) `useScopedState(scope)` pour l'état optimiste et les messages de succès,
   vérifié **au rendu** et non dans un effet — un effet laisse une frame, et sur
   le chemin d'une écriture une frame suffit à cliquer. Appliqué à
   `AvailabilityRequestDetail`, `InboxRequestDetail`, `PharmacyProfile`,
   `PharmacyTeam`, `PharmacyDocuments`, `Prescriptions` et
   `plateforme/PharmacyDetail`.

2. **[ÉLEVÉ] `PharmacyProfile` écrivait l'identité d'une officine sur l'autre.**
   Conséquence directe du n° 1, et la seule à toucher une ÉCRITURE :
   `pharmacy = patched ?? profile.data` alimente les six champs de `EditView`,
   dont le `pharmacyId` vient du contexte. Une personne qui tient deux officines
   — corrige la fiche de A, bascule depuis le sélecteur de l'en-tête, clique
   « Modifier » puis « Enregistrer » — **écrivait le nom, l'adresse ET LA
   COMMUNE de A sur B**. Le PATCH déclenchait alors la rétrogradation
   `validee → en_attente` de B (correctif n° 4 de la revue backend) : l'officine
   B se retrouvait coupée de toute diffusion sans que personne n'ait voulu la
   déménager, et la seule trace lisible était une boîte de réception qui se
   vide. Correctif : la portée du n° 1, plus la fermeture explicite du
   formulaire au changement d'officine, plus une `key` sur `EditView` — trois
   verrous, parce que celui-là écrit.

3. **[MOYEN] Une horloge de téléphone retirait une officine du réseau.**
   `isRequestOver()` mêlait deux vérités de nature différente : `status ===
   'close'` (établie par le serveur) et `expires_at <= Date.now()` (l'horloge de
   l'appareil). Le détail s'en servait pour **retirer le formulaire de
   réponse**. Un Android d'entrée de gamme qui a perdu l'heure réseau — le cas
   ordinaire — affichait donc « cette demande a dépassé 48 h » sur des demandes
   parfaitement vivantes, et personne au comptoir n'a de raison de soupçonner sa
   date. **Leçon S6 mot pour mot** (le plafond client qui rendait une journée
   d'hospitalisation infacturable sur un décalage d'horloge). Correctif : la
   frontière est posée dans le code et dans les props — seul un fait établi par
   le SERVEUR peut barrer le formulaire (`blocked`) ; l'expiration présumée
   devient un avertissement (`notice`) qui laisse envoyer, et le refus du
   serveur, relu sous verrou, s'affiche tel quel. Une soumission perdue coûte un
   aller-retour ; une réponse impossible coûte un trajet à quelqu'un qui marche.

4. **[MOYEN] Une officine validée pendant sa session restait barrée jusqu'à sa
   reconnexion.** Le statut lu par le bandeau ET par la garde de réponse venait
   de `/auth/me/`, figé à la connexion. Une officine que Chioni vient de valider
   — c'est-à-dire précisément celle qui attend ses premières demandes — lisait
   « votre inscription est en cours d'examen » au-dessus d'une boîte qui, elle,
   se remplissait, et son formulaire refusait de s'ouvrir. Le seul chemin de
   sortie était de se déconnecter, ce que personne ne devine. Correctif : la
   fiche est relue **uniquement quand le statut pourrait bloquer** — miroir
   exact du `needsBanner` de la boîte de réception, donc le cas normal reste à
   une seule requête, comme la conception le voulait.

5. **[MOYEN] Dérive de contrat : `GET .../prescriptions/{p}/availability-requests/`
   n'a jamais atteint un écran.** La fonction existait dans
   `endpoints/pharmacy.ts`, aucun composant ne l'appelait — **la leçon S5
   rejouée** (« les quatre actions support n'avaient jamais atteint le
   frontend »). Conséquence concrète : le backend refuse un second envoi sur la
   même ordonnance dans la même zone (addendum n° 6, « le double-clic ne diffuse
   pas deux fois »), mais le prescripteur ne l'apprenait qu'APRÈS avoir décoché
   ses lignes, choisi sa commune, lu l'annonce de diffusion nominative et
   cliqué. Correctif : la modale liste les recherches déjà ouvertes pour cette
   ordonnance et signale, en `warning`, que la zone choisie est déjà couverte —
   **sans griser le bouton** : la garde reste au serveur, parce qu'un blocage
   client sur une comparaison de commune se tromperait un jour, et se tromper
   ici veut dire empêcher une recherche légitime pour quelqu'un qui attend ses
   médicaments.

6. **[FAIBLE] Le 429 du throttle dédié sortait en anglais.** La revue backend
   avait rendu réel le budget `availability` (60/h) ; côté écran, son refus
   arrivait sous la forme brute de DRF (« Request was throttled. Expected
   available in … seconds. ») sur LE geste du sprint. Un refus incompréhensible
   se rejoue. Traduit, avec l'attente en toutes lettres — patron
   `uploadThrottled` de S3/S4.

7. **[FAIBLE] Une confirmation de geste irréversible changeait de cible.** Les
   modales restées ouvertes (fermeture d'une recherche, retrait d'un membre,
   archivage définitif d'une pièce, transition de statut plateforme) ne se
   rescopaient pas : elles s'annulent désormais au changement de tenant, plutôt
   que de laisser un clic déjà armé partir sur l'officine ou le centre d'à côté.
   Vérifié au passage sur les sept modales d'écriture du périmètre : le `busy`
   de la revue S4 est posé partout (les trois sorties involontaires neutralisées
   en vol), aucun bouton d'action ne porte le `data-autofocus`, et aucune
   n'accepte de double soumission.

**Build vert (74 routes, First Load partagé 101 kB), `tsc --noEmit` propre,
backend non touché.**

### Vigilances consignées (aucune n'est une faille — toutes vont au sprint SV)

- **Le message de succès de la diffusion annonce le compte ANNONCÉ, pas celui du
  serveur.** Le 201 rend un objet non annoté (`recipient_count: 0`, addendum
  d'implémentation n° 4) : « Recherche envoyée à 5 pharmacies » reprend donc le
  décompte affiché avant l'envoi. L'annonce et le ciblage passent bien par la
  MÊME fonction serveur (`pharmacy_directory_qs`, vérifié), et l'écran refuse
  d'envoyer tant que l'annonce n'est pas à jour — la divergence se réduit à une
  officine validée ou suspendue dans l'intervalle. Correctif possible et peu
  coûteux : annoter le 201 comme la liste.
- **`PharmacyProvider` interroge la PREMIÈRE officine avant de restaurer le choix
  persisté.** `selectedId` naît à `null` et les effets enfants partent avant
  l'effet parent : une personne qui en tient deux paie un aller-retour inutile
  par écran. Miroir exact de `CenterProvider` depuis S2 — ce n'est donc pas une
  régression S9, mais la remarque vaut pour les deux contextes et se corrige
  d'une lecture synchrone de `localStorage` à l'initialisation.
- **L'appartenance à une officine reste figée à la connexion.** Le correctif
  n° 4 relit le STATUT, pas la liste des appartenances : une personne retirée de
  son officine garde l'entrée du 5ᵉ espace jusqu'à sa prochaine session (le
  serveur refuse, l'écran affiche son 403/404). Même posture que les casquettes
  de centre depuis S2.
- **`ConsultationDetail.freshEncounter`** (état optimiste de la clôture, S1)
  n'est pas porté par `useScopedState` : il est aujourd'hui protégé par le
  correctif n° 1 — l'écran repasse en squelette avant de pouvoir le lire — et
  non par une garde qui lui soit propre. À aligner lors d'un prochain passage
  sur S1.
- **Trois libellés morts en S9** : `AVAILABILITY_ALREADY_DELIVERED`,
  `AVAILABILITY_CITY_ALL` et `AVAILABILITY_FEED_TITLE` ne sont lus par aucun
  écran. Sans conséquence, mais un libellé mort ment sur ce qui est affiché — à
  verser au chantier i18n plutôt qu'à corriger à la pièce.
- **Le filtre `?prescription=` du fil des recherches n'est pas branché** : le
  lien « Ordonnance n° X » du détail renvoie au comptoir sans filtrer, alors que
  la route sait le faire. Un clic de plus pour le personnel, rien d'autre.
- **Les modales de création (officine plateforme, membre) se soumettent sur une
  touche Entrée** depuis un champ d'une seule ligne, une fois les champs requis
  remplis. C'est le patron de `POST /platform/centers/` depuis S4 — où la garde
  est même plus faible qu'ici — donc un constat repo-wide et non une régression
  S9 : à trancher une fois pour toutes les modales de création.
