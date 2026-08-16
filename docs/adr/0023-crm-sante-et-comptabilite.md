# ADR 0023 — CRM santé & comptabilité (sprint S10)

- **Statut** : acté (cadrage dédié — le sprint modifie le contrat de contenu des SMS et fait
  sortir de l'application la donnée financière du centre ; ni l'un ni l'autre ne se décide
  dans un commit)
- **Date** : 2026-08-16
- **Sources** : audit §D.2 (relances automatiques), §D.3 (export comptable), §G/S10 et §SV
  (vigilance « contre-passation retirée rétroactivement de sa journée »),
  ADR 0003 (ledger double entrée), 0007 (audit références-only), 0012 (SMS métier),
  0013 (rappel J-1), 0015 (caisse, encaissement généralisé), 0018 (gel, séries numérotées),
  0022 (patron d'app sobre, sondes miroir)

## Contexte

Deux besoins que l'audit tient ensemble depuis le début, et qui n'ont rien à voir l'un avec
l'autre — sauf qu'ils achèvent le SaaS socle :

1. **Les relances.** La matière existe depuis la vague 2 : une liste d'impayés, un statut
   `manque` sur les rendez-vous, une infrastructure SMS éprouvée par six événements métier et
   par les rappels J-1. Rien ne s'en sert. Un centre voit ses impayés et ses absents, et
   n'a aucun outil pour y donner suite.
2. **L'export comptable.** Le ledger et le journal de caisse existent, mais rien ne sort de
   l'application. Un comptable comorien travaille sur papier ou sur tableur ; tant que Chioni
   ne produit pas de pièce exportable, la caisse est saisie deux fois.

Le sprint porte donc **le premier geste sortant automatique de Chioni** (un message que
personne n'a demandé, à propos d'argent dû ou d'un rendez-vous manqué) et **la première sortie
de la donnée financière hors de l'application**. Les deux méritent d'être cadrés avant d'être
écrits.

## Le risque directeur, nommé au cadrage

Une relance est un message qu'on n'a pas sollicité, sur un sujet qui expose : une dette, ou une
absence. Trois conséquences que le code doit porter, pas la bonne volonté :

- **Une relance mal adressée devient une humiliation.** Le SMS d'impayé arrive sur un téléphone
  qui circule dans le foyer. « Vous devez 18 000 KMF » lu par un voisin ne se rattrape pas.
- **Une relance répétée devient du harcèlement.** La différence entre un service et une
  pression tient dans un compteur borné et dans une porte de sortie.
- **Un rendez-vous manqué n'est pas une faute.** On manque un rendez-vous parce qu'on n'a pas
  le transport, pas l'argent, ou parce qu'on avait honte. Un automate qui le rappelle sèchement
  éloigne durablement la personne du centre — l'inverse exact de la ligne produit n° 1.

Côté comptabilité, le risque est d'une autre nature mais tout aussi concret : **un export est
une pièce qui survit à l'application**. Une fois le fichier sur une clé USB, Chioni n'a plus
aucun droit dessus. Le cadrage doit décider ce qu'un export a le droit de contenir, et ce qu'il
fige exactement.

## Arbitrages du PO (16/08/2026)

1. **Impayés : file de travail au guichet + SMS au tuteur seul.** Aucun SMS automatique de
   dette ne part vers un patient. Le centre reçoit une file « à relancer » et téléphone
   lui-même ; le SMS automatique ne part qu'au tuteur d'une demande déjà partagée, qui a
   déjà droit au montant dans l'application.
2. **Rendez-vous manqué : file de rappel + un SMS neutre unique.** Une file « à recontacter »
   pour le secrétariat, et un seul message, sans reproche, qui ne nomme ni le motif, ni le
   praticien, ni le centre. Jamais répété.
3. **Export comptable : photo datée, jamais une clôture bloquante.** L'export fige un
   instantané numéroté ; rien ne se ferme derrière lui, et surtout pas la caisse.
4. **Le patient peut refuser les SMS, par type de message.** Réglage granulaire, dans son
   espace, et au guichet pour les profils non revendiqués.

## Décision 1 — La porte de sortie est construite AVANT les canaux

Le lot des préférences de contact passe en premier, pas en dernier. Trois canaux de relance
neufs livrés sans possibilité de refus, ce serait exactement la dérive que le sprint est censé
éviter — et l'article 21 du RGPD n'est pas une option pour des tuteurs résidents UE.

- `patients.PatientContactPreference` — OneToOne sur `PatientProfile` (la préférence appartient
  à la **personne**, pas au centre : elle est transversale, comme le carnet). Champs booléens
  par type, `True` par défaut, `get_or_create` au premier write et **forme complète constante
  en lecture** (patron `PatientMedicalFile`, S3) :
  - `appointment_reminders` — le rappel J-1 (ADR 0013) devient refusable, ce qu'il n'était pas ;
  - `missed_appointment_followup` — la reprise de contact de la décision 5.
- `patients.GuardianProfile` gagne `payment_reminders` (défaut `True`) : le tuteur peut refuser
  **les relances**, jamais la notification initiale d'une demande de paiement — celle-là est le
  service qu'il est venu chercher, pas une sollicitation.

**Ce que l'opt-out ne couvre jamais** (décision explicite, pour qu'un futur champ soit un choix
et non un glissement) : les messages de **sécurité et de consentement** — OTP de connexion,
« un proche demande à pouvoir payer vos soins » (porte de confirmation du titulaire, invariant
éthique du produit), « votre soin a été payé ». Se taire sur ceux-là ne protégerait personne :
ça retirerait à la personne l'information dont elle a besoin pour décider.

**Écriture.** `GET|PATCH /patients/me/contact-preferences/` (le patient seul) ;
`GET|PUT /centers/{c}/patients/{pk}/contact-preferences/` au guichet **uniquement pour un
profil non revendiqué** — même règle exactement que le consentement clinique porte C (S2) : dès
que la personne a revendiqué son profil, elle gère elle-même, et le centre reçoit un 400
explicite qui le dit.

## Décision 2 — Aucune relance ne porte de montant vers un patient

Le contrat de contenu de l'ADR 0012 tient. Il avait connu **une** entorse, actée en S5 : la
relance d'abonnement, vers le directeur, sur une dette commerciale de son propre centre. S10
n'en ouvre pas une seconde.

| Événement                    | Destinataire         | Montant | Nom du centre |
| ---------------------------- | -------------------- | ------- | ------------- |
| Relance d'impayé             | **tuteur seul**      | oui     | oui           |
| Reprise de contact (RDV)     | patient              | non     | **non**       |

La relance d'impayé est adressée au tuteur d'une demande de paiement **déjà partagée avec lui**
et dont le lien de tutelle est **encore actif au moment de l'envoi** (règle de l'événement 4,
inchangée : un partage peut survivre à son lien, le SMS ne le doit pas). Elle porte le **solde
restant**, jamais le montant facturé — relancer sur un montant à moitié réglé serait faux et
vexant (leçon S5, même remède).

Un patient sans tuteur ne reçoit donc **rien** : son impayé vit dans la file du guichet, et
c'est un humain qui appelle. C'est le prix de l'arbitrage n° 1, et il est assumé.

## Décision 3 — Ce « CRM » ne fait aucune campagne et n'écrit aucun texte

Le mot CRM appelle des segments, des ciblages et des messages libres. Dans un produit de santé,
un ciblage par donnée clinique est une catastrophe de confidentialité en une requête : une
campagne « rappel de suivi » envoyée aux diabétiques d'une commune de deux mille habitants les
désigne. La leçon est celle de l'ADR 0022 — **anonymiser n'est pas dé-identifier**.

Donc, par construction et pas par discipline :

- **aucun ciblage** n'est possible : les deux seuls déclencheurs sont des **faits
  d'exploitation** — une facture émise dont le solde est positif, un rendez-vous passé au
  statut `manque`. Aucun filtre par acte, par diagnostic, par ordonnance, par catégorie
  générique ;
- **aucun message libre** : les textes sont des constantes de `apps/common/notifications.py`,
  comme les dix autres. Personne, dans aucun écran, ne compose un SMS ;
- **aucun envoi de masse** : un destinataire = un fait qui le concerne.

Corollaire consigné : on ne peut pas se servir de Chioni pour envoyer un message à ses patients.
C'est une limite, elle est voulue, et elle est la raison pour laquelle ce module peut exister.

## Décision 4 — La trace de contact est append-only et à choix fermés

`crm.ContactLog` — une ligne par contact sortant, **append-only** :

`center`, `patient`, `kind` ∈ `relance_impaye` | `reprise_contact`, `channel` ∈ `sms` | `appel`
| `guichet`, `recipient` ∈ `patient` | `tuteur`, `invoice` (nullable), `appointment`
(nullable), `outcome` ∈ `joint` | `sans_reponse` | `promesse_de_reglement` | `a_rappeler`
(nullable — un SMS automatique n'a pas d'issue), `created_by` (nullable : **`NULL` = l'automate**).

Trois propriétés portent tout le lot :

1. **C'est l'anti-doublon.** La cadence se calcule sur les lignes existantes, relues **sous
   verrou** avant écriture. Le compteur non verrouillé de `send_subscription_payment_reminders`
   avait produit un double envoi réel en S5, et le guardian a noté que
   `send_appointment_reminders` a « exactement la même forme » — S10 touche à ce fichier, donc
   **S10 le corrige** (dette SV.2 soldée en passant).
2. **C'est le « dernier contact »** des deux files de travail, sans champ mutable nulle part.
3. **Aucun texte libre.** Pas de note d'appel : une note d'appel dans un dossier patient finit
   toujours par contenir de la donnée clinique, et ce module n'est gardé par aucun rôle
   clinique. Les issues fermées disent le nécessaire pour organiser un rappel.

## Décision 5 — Le rendez-vous manqué appelle une reprise de contact, jamais un reproche

Un seul SMS, le lendemain, jamais répété, et **muet sur le manquement** :

> « Chioni : votre rendez-vous n'a pas eu lieu. Ouvrez Chioni ou appelez le centre pour en
> fixer un nouveau. »

Ni motif, ni praticien, ni nom de centre — mêmes règles que le rappel J-1 (ADR 0012), pour la
même raison : le téléphone d'un profil non revendiqué est déclaratif et circule.

Deux gardes de bon sens, qui valent plus que le texte :

- **rien ne part si le patient a déjà repris rendez-vous** depuis (un rendez-vous futur au
  statut `prevu` dans le même centre) — relancer quelqu'un qui a déjà fait le geste est le
  meilleur moyen de lui apprendre à ignorer nos messages ;
- **rien ne part sur un rendez-vous annulé**, ni sur un `manque` antérieur à la fenêtre de la
  tâche : on ne réveille pas un absent de l'an dernier.

## Décision 6 — L'export comptable est une photo datée, pas une clôture

`accounting.AccountingExport` — **append-only**, une ligne par export :

`center`, `period_start`/`period_end` (jours locaux inclusifs, contrat `apps/common/periods.py`),
`sequence_number` (**série « E- » par centre**), `generated_by`, `generated_at`, les totaux
figés, et **le contenu figé des lignes**. Le téléchargement relit le **snapshot stocké** ; il ne
recalcule jamais — sans quoi « figé » ne voudrait rien dire, et deux téléchargements du même
export pourraient différer.

**Rien ne se ferme derrière l'export** (arbitrage n° 3) : une contre-passation reste possible
sur une période déjà exportée, un même mois peut être exporté deux fois. La cohérence avec le
reste du produit est exacte — l'ADR 0018 refuse déjà la prise d'otage des données, et l'ADR
0015 refuse qu'on empêche la caisse de corriger une erreur. Ce que l'application doit, c'est
**le dire** : un export qui recouvre une période déjà exportée l'annonce, avec la date et le
numéro du précédent.

**La série.** Une ligne compteur par centre, verrouillée à l'émission. **Jamais** un verrou sur
`HealthCenter` (contention avec `Receipt.issue()`, écartée en S5), **jamais** une `SEQUENCE`
PostgreSQL (non transactionnelle : un rollback brûlerait un numéro).

## Décision 7 — L'export retraite enfin la vigilance ADR 0015

C'est la raison technique pour laquelle l'audit a placé l'export ici, et pas ailleurs.

Aujourd'hui, un encaissement contre-passé **disparaît rétroactivement de sa journée** dans les
séries de `stats/finances` : la recette du 3 août change si on contre-passe le 12. C'est
acceptable pour un tableau de pilotage — c'est inacceptable pour une pièce comptable.

L'export porte donc **des mouvements, pas des soldes** : une ligne par encaissement **à sa
date**, une ligne par contre-passation **à SA date**, avec la référence de l'encaissement
d'origine et sa date. Une contre-passation n'est jamais soustraite en silence d'un jour
antérieur ; les deux lignes coexistent, et le total de la période est la somme algébrique de ce
qui est écrit. Un comptable retrouve son chemin, et la photo du 3 août reste la photo du
3 août.

Corollaire : l'export est aussi la réponse à la vigilance SV.2 correspondante, qui peut être
soldée plutôt qu'assumée.

## Décisions transverses

- **Permissions.** Files et relances d'impayés + exports comptables : **rôles BILLING**
  (cohérent avec `stats/finances`, `cash-journal` et `invoices/unpaid/` depuis S1). File des
  rendez-vous manqués : **tout staff actif** (c'est de l'exploitation, comme la file du jour).
  Cloisonnement par centre au queryset, 404 hors périmètre.
- **Rien n'est gelé, et rien n'est gardé par le KYC** — `ALLOWED_IMPORTERS` reste inchangée
  (troisième sprint consécutif), avec une sonde miroir locale. Trois raisons : l'export est
  **la donnée du centre**, et l'ADR 0018 interdit déjà la prise d'otage des données ; la
  relance d'impayé recouvre **les créances du centre**, la geler ferait perdre de l'argent au
  centre pour une dette envers Chioni, et pénaliserait au passage un patient et un tuteur qui
  n'y sont pour rien ; la reprise de contact après un rendez-vous manqué est un geste de
  continuité de soin. **Réserve honnête** : le coût des SMS d'un tenant suspendu est assumé ;
  si le sujet devient réel, la garde s'ajoute dans la **tâche** (jamais dans le service, jamais
  sur l'export).
- **Audit.** `accounting.export_generated` (références, période, numéro — jamais une ligne, ni
  un montant) et `patient.contact_preferences_updated` (codes des préférences touchées, jamais
  qui les a lues). Le **ContactLog est la trace des relances** : un `AuditLog` par SMS noierait
  le journal sans rien apprendre. `accounting.export_generated` entre dans le journal du
  directeur (exploitation) ; **les actions CRM qui référencent un patient n'y entrent pas** —
  un journal qui liste « le centre a relancé le patient #42 » est un registre de comportement de
  paiement, même famille que l'exclusion des actions cliniques et de `availability.*` (S9).
- **Verrous.** Deux chaînes courtes et disjointes du reste : `facture → ContactLog` pour la
  relance, `compteur de série → export` pour la comptabilité. Aucune n'entre dans la hiérarchie
  `utilisateur → intent → demande → facture → centre` par le milieu.
- **Throttles.** Scope dédié `accounting_export` (génération = agrégats + snapshot).
  Et la **leçon S9** est vérifiée par sonde : un `throttle_scope` posé sans
  `get_throttles()` qui retourne `ScopedRateThrottle` est **inerte** — le défaut avait rendu
  muet le seul garde-fou du geste le plus bruyant du sprint précédent.
- **Beats** : `crm.send_unpaid_invoice_reminders` et `crm.send_missed_appointment_followups`,
  quotidiens, **09h00 heure des Comores** — jamais la nuit, jamais un dimanche à 6 h. Cadence
  d'impayé bornée à trois envois puis silence (patron S5).
- **Réserve d'honnêteté sur la cadence** : `Invoice` ne stocke **aucun horodatage d'émission**
  (limitation déjà consignée dans l'addendum ADR 0015 pour `stats/finances`). La cadence
  s'ancre donc sur `created_at`, ce qui est exact dans la pratique réelle (une facture est
  émise dans la foulée de sa création) et faux pour un brouillon oublié trois semaines. Écart
  documenté, réversible par un champ `issued_at` le jour où il gêne.

## Ce qui n'entre pas dans S10

Nommé pour que ce soit un choix, pas un oubli : aucun rappel de suivi, de vaccination ou de
contrôle (ce serait le ciblage clinique que la décision 3 interdit) ; aucun canal autre que le
SMS (ni e-mail, ni WhatsApp) ; aucune relance vers un tuteur sans demande partagée ; aucun
échéancier ni frais de retard ; aucun plan comptable normalisé ni écriture au format d'un
logiciel tiers (l'export est un relevé de mouvements, pas un journal comptable OHADA) ; aucun
export automatique planifié — un humain déclenche et signe la photo.

## Conséquences

- Deux apps neuves et sobres : `apps/crm` (une table) et `apps/accounting` (deux tables, dont
  le compteur de série). Deux champs de préférence et une table OneToOne dans `apps/patients`.
- Le rappel J-1 devient refusable : c'est un changement de comportement d'un canal existant,
  à dire dans les notes de version.
- Deux dettes SV soldées en passant : l'incrément non verrouillé de
  `send_appointment_reminders`, et le retraitement de la contre-passation dans une pièce figée.
- Le libellé frontend de `accounting.export_generated` est posé dans le même lot que l'action
  backend (la dérive silencieuse du journal du directeur, S5) ; le **test de parité** reste
  l'arbitrage d'architecture de tests consigné en SV.2.
- Après S10, le plan des sprints fonctionnels est complet : reste SV (validation finale) et les
  chantiers à clés parallèles.

---

## Addendum — revue guardian backend S10 (16/08/2026)

Six constats : **trois élevés, deux moyens, un faible**. Tous corrigés, chaque correctif
**vérifié détecteur par mutation réelle du code** (neuf mutations appliquées, neuf sondes
rouges — discipline S8/S9). Sondes pérennes : `backend/tests/test_adversarial_s10.py`
(35 sondes, dont trois courses à threads réels).

Le fil de la passe confirme la leçon de S9 : **quatre constats sur six sont des coutures entre
sprints**, pas des défauts du module neuf. Le module S10 pris isolément est propre — son
anti-doublon tient sous course réelle du premier coup, sur les trois beats.

### Constat n° 1 (ÉLEVÉ) — le plafond bornait l'objet, jamais la personne

`apps/crm/services.py` — `send_unpaid_invoice_reminders` et `send_missed_appointment_followups`.

La cadence `UNPAID_REMINDER_OFFSETS_DAYS` borne le nombre de messages **par facture**. Elle ne
bornait rien du tout pour l'humain qui les reçoit. Trois factures impayées d'une même patiente
créées le même jour — deux consultations et une hospitalisation, c'est-à-dire la vie normale
d'un centre — faisaient partir **trois SMS byte-identiques le même matin** sur le téléphone du
même proche : même centre, même solde, même prénom, trois fois la même phrase. Reproduit
directement (`waves = 3, SMS = 3`). Symétriquement, trois rendez-vous manqués dans la fenêtre
envoyaient trois fois le même texte générique au patient.

C'est le risque directeur de l'ADR, mot pour mot : « une relance répétée devient du
harcèlement ; la différence entre un service et une pression tient dans un compteur borné et
dans une porte de sortie ». Un compteur qui compte des factures n'est pas ce compteur-là.

**Corrigé** : plafond de la **personne**, en deux gardes. (1) `UNPAID_REMINDER_PATIENT_GAP_DAYS`
(7 j, l'espacement le plus court de la cadence existante) et `MISSED_FOLLOWUP_PATIENT_GAP_DAYS`
(3 j) — relus en base avant chaque envoi ; (2) un ensemble `served_patients` par exécution, qui
ferme le jour charnière où l'espacement vient d'expirer et où deux objets en attente
repartiraient ensemble. Les deux gardes sont individuellement détectrices (mutations 4a/4b et
5/5b).

Propriété qui compte autant que la garde elle-même, et vérifiée : **écarter n'est pas
consommer**. Une facture écartée par le plafond de la personne n'écrit aucune ligne, donc sa
cadence est intacte et elle repart au passage suivant — sans quoi le correctif anti-harcèlement
aurait supprimé en silence deux relances légitimes sur trois.

**Écart assumé, écrit ici pour qu'il soit un choix** : ce plafond est **transverse aux
centres**. Un téléphone ne sait pas ce qu'est un tenant, et c'est le seul endroit du produit où
la personne prime sur le cloisonnement — possible uniquement parce que le lecteur est un
automate de plateforme, jamais une vue. Conséquence : une personne suivie par deux centres voit
sa seconde relance décalée de quelques jours. Verrouillé par sonde dans les deux sens (le
plafond traverse les tenants ; deux personnes différentes ne se plafonnent jamais l'une
l'autre).

### Constat n° 2 (ÉLEVÉ) — une demande en LITIGE continuait d'être relancée

`apps/crm/services.py:reminder_reachable_links` — le statut de la demande n'était pas filtré.

Une demande passée en `litige` laisse sa facture `emise` à solde positif : l'automate envoyait
donc « il reste 7 500 KMF à régler » à quelqu'un qui venait précisément d'écrire « ce soin n'a
pas eu lieu ». Reproduit.

C'est une couture S1 × S10. S1 a fermé le rail diaspora sur une facture annulée, et
`cancel_invoice` refuse d'annuler tant qu'une demande est en `litige` — le rail *relance*, lui,
était resté grand ouvert sur le même argent contesté.

**Corrigé** à deux niveaux : `REMINDABLE_REQUEST_STATUSES` écarte la demande litigieuse
elle-même, et `invoice_has_open_dispute()` fait taire la **facture entière** dès qu'une de ses
demandes est en litige (une facture peut en porter plusieurs ; relancer par la porte d'à côté un
argent partiellement contesté serait pire que de se taire). Miroir exact de `cancel_invoice`.

### Constat n° 3 (ÉLEVÉ) — une demande jamais ENVOYÉE déclenchait une relance

Même fonction. `share_payment_request` autorise le partage d'une demande en `brouillon`, et le
produit reste alors **délibérément muet** jusqu'à l'envoi (`notify_payment_request_share_added` :
« un partage en brouillon reste muet jusqu'à `send_payment_request` »). Sans filtre de statut, le
tout premier SMS qu'un proche recevait au sujet de cette facture pouvait donc être une
**relance** — d'une sollicitation qui ne lui avait jamais été adressée. Reproduit.

**Corrigé** par la même liste fermée : `envoyee`, `payee`, `soin_confirme`, `cloturee` (les
statuts postérieurs à l'envoi restent éligibles — un règlement partiel peut laisser un solde, et
le proche a bien été sollicité). Un statut ajouté demain à `PaymentRequest` n'entre pas dans le
rail par accident : une sonde ferme la liste.

**Conséquence de lecture** : `unpaid_followup_rows.guardian_reachable` a été aligné sur la même
règle. Le sérialiseur promet « honnête par construction » — un booléen qui dirait « oui » là où
aucun SMS ne peut partir mentirait au caissier, et la file de travail existe précisément pour
lui dire qui l'automate ne joindra pas.

### Constat n° 4 (MOYEN) — les destinataires étaient lus HORS du verrou

`apps/crm/services.py:send_unpaid_invoice_reminders` — `reminder_reachable_links(invoice)` était
appelé **avant** `transaction.atomic()`.

L'ADR promet que le montant ne part que vers un lien « encore ACTIF **au moment de l'envoi** ».
Il était en réalité actif quelques instants plus tôt : une révocation par la patiente — ou un
opt-out du tuteur — commitée entre la sélection et l'écriture ne changeait rien, le SMS partait.
Reproduit sur les deux fenêtres.

**Corrigé** : la lecture qui fait foi est **dans la transaction qui écrit la trace**, après le
verrou de la facture. La lecture en amont est conservée comme pré-filtre de confort (ne pas
poser un verrou de ligne sur des milliers de factures qui ne parleront à personne) et la sonde
vérifie qu'il y a bien **deux** appels — un seul signifierait un retour à l'état d'avant.

### Constat n° 5 (MOYEN) — la garde du guichet vivait dans l'appelant et lisait la mémoire

`apps/patients/services.py:update_patient_contact_preferences` +
`apps/patients/views.py:CenterPatientContactPreferencesView`.

Deux patrons déjà rencontrés sur ce dépôt, cumulés sur la même porte :

1. **leçon S4** — « une garde qui vit dans l'appelant n'est pas une garde » : le service était
   public et n'avait **aucune** garde propre ; appelé directement (shell, commande, future vue),
   il écrivait les préférences d'un profil revendiqué ;
2. **leçon S8** — une garde qui lit l'instance en mémoire n'en est pas une : la vue résout le
   patient **avant** la transaction, si bien qu'une revendication OTP commitée dans l'intervalle
   laissait le guichet régler les canaux de quelqu'un qui gère désormais lui-même.

Les deux reproduits. C'est le TOCTOU jumeau de celui que la revue S2 avait fermé sur le
consentement clinique porte C — même règle, même message, même famille de porte, rejoué sur une
porte neuve un sprint plus tard.

**Corrigé** : la garde vit dans le service, sur une relecture `select_for_update` du patient —
patron exact de `grant_clinical_consent_at_center`, ordre de verrous inchangé.
`require_unclaimed_for_desk_preferences` reste, dégradé en refus **précoce** de confort, et rend
le même message. Vérifié aussi dans l'autre sens : la garde vise le **geste de guichet**
(`center` renseigné), jamais la personne — sans quoi le correctif fermerait la porte de sortie à
celui-là même qu'elle protège.

### Constat n° 6 (FAIBLE) — le tri du snapshot comptable était lexicographique

`apps/accounting/services.py:build_movements` — la clé de tri finissait sur la **référence
textuelle**, donc `ENC-10` se rangeait avant `ENC-9`. Les mouvements d'une même journée
n'apparaissaient pas dans l'ordre où la caisse les avait pris, à partir du dixième. Sans enjeu
de montant (le total est exact), mais une pièce comptable se relit ligne à ligne.

**Corrigé** : tri sur l'identifiant numérique, retiré du snapshot juste après (la clé de tri ne
voyage pas dans la pièce figée — vérifié par sonde, snapshot ET CSV).

### Ce qui a été attaqué et jugé SAIN

Conservé en sondes malgré tout : ce sont ces zones-là que le prochain sprint fera bouger.

- **L'anti-doublon des trois beats sous course réelle** (deux threads, barrière de
  synchronisation) : une ligne, un SMS, sur les impayés, les reprises de contact **et** le rappel
  J-1. La dette SV.2 héritée de S5 (« `send_appointment_reminders` a exactement la forme de la
  faille de double-envoi ») est bien soldée, et elle est désormais prouvée là où elle vivait.
- **L'annulation de facture ferme le rail relance** (héritée de `unpaid_invoices_qs`, régression
  posée).
- **L'export** : deux téléchargements de la même pièce rendent le même octet même après une
  contre-passation et un nouvel encaissement ; aucun franc d'un autre tenant n'y entre ; une
  contre-passation postérieure ne réécrit ni les totaux ni les lignes d'une pièce émise
  (décision 7 tenue) ; la pièce est append-only aux trois niveaux (instance, `update()`,
  `delete()`) ; un export étranger atteint par mon URL répond 404 sur le détail **et** sur le
  téléchargement ; la série « E- » reste contiguë sous deux émissions concurrentes.
- **Le throttle `accounting_export` est réellement branché** — `get_throttles()` retourne bien un
  `ScopedRateThrottle` (la faille élevée n° 2 de S9 n'a pas été rejouée), vérifié en plus de la
  sonde générique livrée par le sprint.
- **RGPD × S10** : après anonymisation, le pivot téléphone disparaît et les liens de tutelle sont
  révoqués — les deux canaux neufs se taisent **par construction**. Rien de ce que S10 stocke ne
  parle d'une personne : `ContactLog` ne porte que des références et des codes fermés (sonde
  d'absence de champ de texte), et les lignes figées d'un export ne portent ni nom, ni
  identifiant de patient. Le défaut de S7 — des **octets** (un arrêt maladie photographié)
  survivaient à l'effacement — n'a pas d'équivalent ici, et l'absence est verrouillée plutôt que
  constatée.
- **`ALLOWED_IMPORTERS` intacte** (quatrième sprint consécutif), avec une sonde locale qui refuse
  que `apps.crm` ou `apps.accounting` importe la garde de gel **ou** celle du KYC.

### Ce qui est ASSUMÉ, et pourquoi

- **Les `ContactLog` d'un doublon ne suivent pas la cible à la fusion.** Vérifié : la trace reste
  ancrée sur le tombstone alors que le rendez-vous, lui, migre. C'est cohérent avec le traitement
  des factures, que `merge_profiles` laisse elles aussi sur le tombstone (« financial history
  stays exact »), et c'est ce qu'être append-only veut dire : une trace dit « ce jour-là, nous
  avons contacté au sujet de CE dossier ». Ce qui compte est vérifié par sonde : l'anti-doublon
  est ancré sur l'**objet** (facture, rendez-vous), donc il tient de part et d'autre d'une fusion,
  et **la relance part bien vers le téléphone de la cible** — le correctif qu'avait exigé le
  module rendez-vous en vague 1 n'a pas d'équivalent à faire ici.
- **Une pièce comptable émise survit à l'effacement d'une personne.** Elle ne porte aucun nom ni
  identifiant de patient — des références de facture et de reçu, des montants, des dates. La
  conservation est défendable parce qu'il n'y a rien d'identifiant dedans, et une pièce comptable
  a par ailleurs des obligations légales de conservation.
- **Le plafond par personne traverse les tenants** (voir constat n° 1).
- **Les préférences de contact au guichet restent ouvertes à tout membre actif** (arbitrage du
  lot 1, réversible) : un refus qu'une infirmière ne peut pas noter est un refus qui n'existe
  pas.
- **La cadence s'ancre toujours sur `Invoice.created_at`** (réserve d'honnêteté déjà écrite au
  cadrage) : la revue n'a pas ajouté de champ `issued_at`, elle confirme l'écart.

### Effet sur le contrat exposé au frontend

Aucun champ ajouté, retiré ni renommé. Deux comportements de lecture changent, et ils sont à
répercuter dans les écrans le jour où ils existent : `guardian_reachable` de la file « à
relancer » rend désormais `false` sur une demande en brouillon ou en litige (il dit la vérité,
il ne dit plus l'espoir), et l'ordre des lignes d'un export suit la caisse au-delà du dixième
mouvement d'une journée.

## Addendum — revue UX care S10 (16/08/2026)

Douze correctifs appliqués côté frontend (**2 bloquants, 8 importants, 2 cosmétiques**) et
**deux reformulations de SMS répercutées dans `apps/common/notifications.py`**. Les deux
bloquants méritent d'être consignés ici : aucun des deux n'était un défaut d'apparence.

### Bloquant 1 — l'interface trahissait l'arbitrage n° 1 du PO

La file affichait « **Appelé le** 30 juillet » sous une colonne « Dernier appel », en rendant
un agrégat que le backend documente comme « le dernier contact de **toute nature** — SMS
automatique compris ». Une facture que l'automate avait relancée trois fois, et que personne
n'avait jamais appelée, se présentait donc au caissier comme déjà traitée. Il saute la ligne.

C'est le renversement exact de l'arbitrage n° 1 : *le centre reçoit une file et téléphone
lui-même*. Le service tenait sa part ; c'est l'écran qui la défaisait — et il la défaisait
d'autant mieux que la phrase était rassurante.

Le tri est sûr sans champ nouveau : un geste humain porte **toujours** une issue
(`outcome` est obligatoire), l'automate n'en pose jamais. D'où trois états distincts —
« Message automatique le … », « Dernier contact le … — Personne jointe », « Personne n'a
encore appelé ». Réserve consignée : quand une issue existe, la date rendue peut rester celle
d'un SMS postérieur à l'appel — une annotation `last_human_contact_at` lèverait la réserve.

### Bloquant 2 — la porte de sortie paraissait cassée

L'interrupteur de préférences du patient était piloté par la seule valeur serveur : le geste
ne produisait **aucun mouvement** jusqu'au retour du PATCH. Sur un Android d'entrée de gamme
en EDGE, c'est plusieurs secondes pendant lesquelles la personne conclut que ça ne marche pas,
retape, et se heurte au garde-fou anti-course. Sur l'écran dont ce sprint dit qu'il est
construit *avant* les canaux, et qui est la mise en œuvre de l'article 21.

Corrigé par un état d'intention (la position suit le doigt, `aria-busy`, retour à la vérité du
serveur **avec sa raison** en cas d'échec).

### Les deux textes SMS, reformulés

- **Reprise de contact** : « Ouvrez Chioni ou appelez le centre » s'adressait en priorité à un
  profil non revendiqué — quelqu'un qui, par définition, n'a pas l'application. La moitié de la
  consigne était inapplicable pour son destinataire type. Le message n'ordonne plus rien :
  « Vous pouvez en fixer un nouveau quand vous voulez. »
- **Relance d'impayé** : deux `:` d'affilée se lisent mal sur un téléphone, et « à régler » est
  une injonction là où le cadrage demande un fait. Devient : « Chioni — {centre} : il reste
  {montant} KMF sur les soins de {prénom}. Détail et paiement sur Chioni. »

Le reste du contrat de contenu est tenu : solde restant et non montant facturé, tuteur seul,
aucun libellé d'acte, aucune donnée clinique.

### Un défaut de design system révélé par S10

`.ax-switch:disabled` écrasait `.ax-switch:checked` (déclarée après, à spécificité égale) : un
réglage **activé mais en lecture seule** perdait sa couleur d'accent. Le cas est structurel sur
la carte du guichet — dès qu'un patient a revendiqué son profil, tous les interrupteurs sont
désactivés, et la carte dont le sous-titre est « ce que le patient accepte de recevoir » ne
permettait plus de le lire. Corrigé dans `components.css` : le correctif bénéficie à tous les
espaces.

### Trous de contrat signalés, non comblés

`last_human_contact_at` (ci-dessus) · aucune issue « un nouveau rendez-vous a été fixé » dans
la liste fermée, alors que c'est l'issue naturelle d'un appel de reprise de contact · le
téléphone est masqué sur l'écran dont la raison d'être est d'appeler (cohérent avec la posture
anti-moissonnage, à rouvrir si le guichet s'en plaint) · `generated_by` est un id nu, la pièce
comptable ne nomme donc pas qui l'a signée alors que l'ADR dit « un humain déclenche et
**signe** la photo ».
