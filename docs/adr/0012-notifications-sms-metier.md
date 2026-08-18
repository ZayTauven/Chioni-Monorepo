# ADR 0012 — Notifications SMS métier : contrat de contenu et remise après commit

- **Statut** : acté (chantier « notifications SMS métier »)
- **Date** : 2026-08-13

## Contexte

Le SMS est le canal principal aux Comores (étude §5.4) ; seul l'OTP partait en SMS (ADR 0010). Six événements métier doivent désormais notifier : invitation de tutelle envoyée, invitation acceptée, lien en attente de confirmation du titulaire, demande de paiement envoyée, paiement reçu, reçu émis. Un SMS se lit par-dessus l'épaule et reste dans la boîte de réception : le contenu est une question de secret médical, pas de style.

## Décision

1. **Module unique** `apps/common/notifications.py` : une fonction par événement, textes en CONSTANTES du module (point d'extraction i18n/shikomori unique, comme `labels.ts` côté frontend). Seul appelant métier de la tâche `accounts.send_sms`.
2. **Contrat de contenu (revue guardian, non négociable)** :
   - JAMAIS d'information médicale dans un SMS — ni libellé d'acte, ni motif, ni diagnostic, ni même la catégorie générique (elle reste dans l'app, derrière l'authentification — plus strict que le périmètre tuteur de l'ADR 0005) ;
   - un MONTANT ne va qu'au TUTEUR (notification de demande) ; jamais au patient — son téléphone peut circuler dans le foyer (le SMS « paiement reçu » ne porte aucun chiffre **ni nom de centre** : le téléphone d'un profil non revendiqué est déclaratif, et le nom d'un centre spécialisé est une information quasi médicale) ;
   - le SMS « attente de confirmation » ne nomme JAMAIS le tuteur demandeur, et UN SEUL SMS générique part quel que soit le nombre de liens suspendus (revendication comme fusion) ;
   - le SMS d'invitation est ANONYME (ni nom du patient ni de l'invitant) : le numéro saisi peut être erroné — il se clôt par « Si vous n'êtes pas concerné, ignorez ce message. » (information minimale du destinataire non concerné) ;
   - la demande de paiement ne part que vers les tuteurs dont le lien est encore **ACTIF** au moment de l'envoi (un partage peut survivre à la révocation ou à la suspension du lien — le montant suit la visibilité dans l'app, jamais l'inverse) ;
   - français simple, préfixe « Chioni : » (même style que l'OTP), < 160 caractères visés.
3. **Remise après commit** : tout envoi passe par `transaction.on_commit` — un rollback métier ne notifie personne. Numéro et texte sont résolus DANS la transaction et capturés en chaînes (le callback ne relit jamais l'ORM). Résolution du téléphone patient : compte vérifié si revendiqué, sinon téléphone déclaratif du profil ; destinataire sans téléphone = ignoré en silence (log DEBUG).
4. **Un échec SMS ne casse jamais l'opération métier** : en mode Celery eager (dev/tests, `CELERY_TASK_EAGER_PROPAGATES` suit `DEBUG`), l'exception du backend est attrapée dans le callback et loggée — jamais de corps ni de téléphone au niveau INFO+ (contrat de `apps/common/sms.py`). La tâche `accounts.send_sms` reste inchangée (l'OTP garde son comportement).
5. **Points d'accroche = services uniquement** : `invite_guardian`, `accept_link`, `claim_profile` + `merge_profiles` (les trois portes de `PENDING_CLAIMANT_CONFIRMATION` : revendication, lien déplacé sur cible revendiquée, transfert du titulaire par fusion — ADR 0010), `send_payment_request` (un SMS par tuteur partagé au lien actif) + `share_payment_request` sur une demande déjà envoyée (rattrapage : ce tuteur seul), `register_payment_success` (le rejeu du webhook retourne avant la notification — jamais deux SMS pour un encaissement), `close_payment_request` (tuteur payeur = celui de l'intent réconcilié).

## Conséquences

- `tests/test_notifications.py` (30 tests) verrouille : bon numéro + texte exact par événement, assertions négatives de contenu, rollback → rien, sans-téléphone → rien sans erreur, backend en échec → opération intacte, non-régression OTP.
- L'affichage KMF en SMS arrondit au franc (`format_kmf`) — les montants exacts font foi dans l'app et sur le reçu (relus du ledger), jamais dans un SMS.
- OTP-3 (ADR 0010) s'étend aux notifications : les corps transitent par le broker en async — mêmes consignes de déploiement (réseau privé, TLS, TTL courts, jamais `result_extended`).
- Hors périmètre, à traiter dans leurs chantiers : notification e-mail, préférences de canal par utilisateur, agrégateur SMS comorien réel (backend `stub`).

## Addendum (2026-08-13, revue guardian de l'incrément)

- **Base légale du SMS d'invitation (événement 1)** : intérêt légitime — mise en relation demandée par le patient (porte B) ou par le centre pour son patient (porte C), texte anonyme sans aucune donnée du patient, contact unique par paire (tuteur, patient) grâce à la contrainte d'unicité du lien de tutelle. Le SMS porte l'information minimale du destinataire non concerné (« Si vous n'êtes pas concerné, ignorez ce message. ») ; l'information complète art. 14 RGPD (lien d'information et d'opposition) sera portée par le chantier agrégateur SMS (backlog).
- **Anti-harcèlement sur l'invitation** : `POST /patients/me/guardians/invite/` est throttlé par appelant (`invite_guardian_user`, 5/jour) ET par téléphone cible (`invite_guardian_phone`, 3/jour), env-tunables comme les scopes OTP. La porte C (création guichet) reste non throttlée : staff authentifié d'un centre KYC-vérifié, responsabilité tracée.
- **Événement 4 durci** : l'envoi ne notifie que les partages dont le lien est ACTIF ; un partage ajouté sur une demande déjà envoyée notifie ce tuteur seul (`notify_payment_request_share_added`, même template).
- **Événement 5 muet** : plus de nom de centre (« Chioni : votre soin a été payé par un proche. ») — le texte redevient une constante sans interpolation.

## Addendum (2026-08-16, arbitrage PO — exigences du futur chantier agrégateur)

Consigné maintenant pour que le chantier « agrégateur SMS comorien » (toujours différé) naisse
avec le bon contrat ; rien n'est implémenté ici.

1. **Twilio entre dans le périmètre du chantier, aux côtés des agrégateurs comoriens**, et sur
   DEUX canaux : **SMS et WhatsApp**. L'abstraction `apps/common/sms.py` devra donc porter une
   notion de **canal** (aujourd'hui elle n'en connaît qu'un), avec une politique de repli à
   trancher au cadrage du chantier (WhatsApp d'abord, SMS en repli ? par destinataire ?).
2. Conséquences déjà identifiables, à instruire au cadrage : les templates WhatsApp Business
   sont **pré-approuvés par Meta** (le point d'extraction unique de `notifications.py` devient
   un atout : la liste des textes à soumettre existe déjà) ; l'opt-in WhatsApp est plus strict
   que le SMS ; les accusés de remise Twilio (delivery receipts) ouvrent enfin la voie au
   retry borné + dead-letter déjà actés ; le coût par canal diffère — le choix du canal par
   destinataire est aussi un choix économique.
3. Invariants INCHANGÉS quel que soit le canal : le contrat de contenu de cet ADR (jamais de
   donnée médicale, montant selon destinataire, le contenu suit la visibilité dans l'app),
   `transaction.on_commit`, jamais de corps ni de téléphone au niveau INFO+, et l'information
   art. 14 portée par ce même chantier. **Un canal plus riche n'autorise pas un contenu plus
   riche** : une bulle WhatsApp se lit par-dessus l'épaule exactement comme un SMS.
4. La **préférence de langue par personne** (chantier i18n shikomori, décidé le même jour)
   sera résolue au moment de l'envoi par `notifications.py` — l'agrégateur reçoit un texte
   final, il ne choisit jamais une langue.
