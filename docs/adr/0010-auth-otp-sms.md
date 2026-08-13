# ADR 0010 — Authentification par téléphone + OTP SMS

- **Statut** : acté (implémenté — chantier « auth OTP »)
- **Date** : 2026-08-13

## Contexte

Le téléphone vérifié par OTP est l'identité pivot (ADR 0001) et le SMS est le canal principal aux Comores (étude §5.4). Les portes A et C créent des comptes ombre (mot de passe inutilisable) et des profils patients non revendiqués : il fallait le mécanisme qui transforme un numéro vérifié en compte actif et, sous conditions STRICTES, en revendication de profil. Le login `username`+mot de passe JWT reste pour le staff/back-office.

## Décision

### Flux

- `POST /api/v1/auth/otp/request/` `{phone}` → normalisation E.164 (région KM), émission d'un code à 6 chiffres (`secrets`), envoi SMS via Celery (`accounts.send_sms`). `POST /api/v1/auth/otp/verify/` `{phone, code}` → paire JWT (mêmes réglages SimpleJWT rotation+blacklist) + payload `me` (contrat identique à `/auth/me/`).
- `OtpCode` (apps/accounts) stocke **l'empreinte seulement** : HMAC-SHA256 clé `SECRET_KEY` (`salted_hmac`), sel lié à `(purpose, phone)` — une empreinte n'est jamais rejouable ailleurs. Comparaison en temps constant. Validité 10 min, usage unique, **5 tentatives max par code**, une nouvelle demande invalide les codes actifs du même `(phone, purpose)`. Modèle volontairement **mutable** (`attempts`, `consumed_at`) : utilitaire d'authentification, pas un enregistrement métier — hors du socle append-only.
- Le compteur de tentatives et l'audit d'échec sont écrits dans une transaction qui **commit AVANT** de lever le refus : un compteur annulé par rollback rouvrirait le brute force. `select_for_update` sérialise les vérifications concurrentes.

### Résolution du compte au verify (service transactionnel `apps/accounts/services.py`)

1. User actif dont le téléphone est déjà vérifié → login simple.
2. User existant jamais vérifié (**compte ombre** des invitations tuteur/patient, du guichet porte C, de l'onboarding staff — ou compte à mot de passe n'ayant jamais vérifié son numéro) → **activation** : `User.phone_verified_at` posé (première vérification), mot de passe **inchangé** (inutilisable pour les ombres : l'OTP est LEUR méthode).
3. Aucun user → **création** (porte B, point d'entrée officiel du patient autonome) : compte né vérifié, mot de passe inutilisable.
4. Compte désactivé (pierre tombale RGPD / banni) : aucun SMS au request, aucun login au verify — la réponse ne change jamais.

### Règle STRICTE de revendication automatique

À chaque vérification réussie, **au plus UN** `PatientProfile` est revendiqué (`claim_profile`, service existant qui audite et révoque l'auto-tutelle), si TOUTES ces conditions tiennent :

- l'utilisateur n'a pas encore de profil patient (le OneToOne est libre) ;
- le profil est non revendiqué (`user` NULL) et n'est pas une pierre tombale de fusion ;
- son téléphone **déclaratif** égale le téléphone **vérifié** de l'utilisateur ;
- il n'a PAS été créé au guichet (`created_by_center` NULL) : **le téléphone tapé par un centre n'est pas une preuve d'identité** — un profil guichet se revendique par le parcours en présentiel du centre, jamais silencieusement ;
- son créateur détient encore un lien de tutelle **ACTIF** sur ce profil (porte A : le canal d'invitation qui visait précisément ce numéro ; un lien révoqué éteint la base de confiance → pas de claim).

Plusieurs profils éligibles (plusieurs tuteurs ont déclaré le même protégé) → le plus ancien est revendiqué, les autres restent des doublons résolus par la fusion (ADR 0001/0002). Aucune structure ne rattache aujourd'hui un user ombre à un profil patient ; si un flux futur le fait, il devra repasser par cette ADR.

### La revendication remet tous les liens de tutelle en attente de confirmation (OTP-1, revue guardian)

**Règle** : la revendication d'un profil par le patient met **tous ses liens de tutelle survivants en attente de confirmation explicite** (`GuardianLink.Status.PENDING_CLAIMANT_CONFIRMATION`) ; le téléphone déclaratif n'autorise **jamais** un lien actif sans consentement du titulaire.

Motivation (cœur éthique du produit — « aider, jamais surveiller ») : `create_protege` (porte A) pose un lien ACTIVE d'emblée, ce qui est **légitime tant que le profil n'est pas revendiqué** (« Mariama, sans smartphone, gérée par sa fille » : le tuteur gère le dossier administratif). Mais laissé actif au moment de l'auto-claim, ce lien donnait à quiconque connaît un numéro — en pré-amorçant un profil « protégé » avec ce numéro — une visibilité `paiements` (montants, nature générique des soins, reçus) sur la victime à sa première connexion, **jamais consentie**. La garde du §3 authentifie le revendiquant, jamais le créateur du profil.

- Au moment de l'auto-claim, `claim_profile` appelle `GuardianLink.suspend_for_claimant_confirmation()` sur tout lien non révoqué : passage en `PENDING_CLAIMANT_CONFIRMATION` (scope **∅** — `Consent.active_scopes()` retourne l'ensemble vide hors statut ACTIF, et `guardian_links_with_scope` filtre déjà sur ACTIF, donc double protection automatique) ; les consentements actifs éventuels sont révoqués (pas de résurrection silencieuse).
- Le patient voit ces liens dans `GET /patients/me/guardians/` (statut + `scopes: []`) et agit : `POST /patients/me/guardians/{link}/confirm/` (→ ACTIF, scope paiements minimal) ou `/decline/` (→ RÉVOQUÉ, définitif). Endpoints audités (`guardian_link.pending_confirmation`, `.confirmed`, `.declined`).
- Ceci s'applique **aussi** au vrai tuteur familial (Nassim) — c'est voulu : à sa première connexion, le patient confirme « oui, c'est bien mon proche qui m'aide » (libellé rassurant côté frontend : « Nassim souhaite vous aider à payer vos soins. Est-ce bien votre proche ? »). Tant que non confirmé, le tuteur n'a **aucun** accès aux données de paiement du profil revendiqué, et le protégé disparaît même de sa liste `/guardian/proteges/`.
- `PENDING_CLAIMANT_CONFIRMATION` est un état distinct de `INVITATION_SENT` (qui vise l'acceptation par le *tuteur*) : ici c'est le *titulaire* qui confirme. Transition compatible avec le trigger DB « lien révoqué définitif » (elle ne sort jamais de `revoque`).
- **Troisième porte (addendum 2026-08-13, revue guardian de l'incrément notifications)** : le **transfert du titulaire par fusion** — quand `merge_profiles` transfère l'utilisateur revendiqué de la source vers une cible non revendiquée, les liens survivants de la cible (préexistants ET déplacés) passent eux aussi par `suspend_for_claimant_confirmation()` : sans cela, un lien ACTIF semé sur la cible gardait sa visibilité `paiements` sur le profil fraîchement revendiqué sans confirmation du titulaire.
- **La porte de confirmation couvre AUSSI la fusion (revue guardian, 2e passe).** `merge_profiles` déplaçait un lien vers la cible en conservant son statut : un orphelin ACTIVE (semé par un tiers) fusionné dans le profil **revendiqué** de la victime rouvrait OTP-1 par la porte fusion (endpoint fusion exposé au staff en phase A). Correctif : lors du déplacement d'un lien vers une cible dont le profil est revendiqué (`target.user_id` non NULL), le lien passe par `suspend_for_claimant_confirmation()` exactement comme à la revendication (→ `PENDING_CLAIMANT_CONFIRMATION`, consentements révoqués, audit `guardian_link.pending_confirmation`), et le titulaire le confirme via l'endpoint existant. Cas traités : `REVOKED` intact (définitif, trigger DB), déjà `PENDING` idempotent (sauté), et **fusion vers une cible non revendiquée inchangée** (le tuteur continue de gérer le dossier administratif). Règle générale : *toute arrivée d'un lien de tutelle sur un profil revendiqué — revendication OU fusion — exige la confirmation explicite du titulaire.*

### Anti-énumération et anti-oracle

- `request` : réponse 200 au corps **constant**, que le téléphone corresponde à un compte, un compte ombre, rien, ou une pierre tombale. Seul un format invalide produit un 400.
- `verify` : tout échec (téléphone inconnu, code faux, expiré, consommé, mort, compte désactivé) → le MÊME 400 « Code invalide ou expiré. ».
- **Oracle temporel comptes désactivés fermé (OTP-2, revue guardian)** : le chemin « compte désactivé/banni » faisait auparavant moins de travail (ni `OtpCode`, ni SMS), donnant un oracle de temps de réponse malgré le corps identique. Désormais il fait le **travail équivalent** — il génère, invalide et **stocke** un code jetable (mêmes écritures DB + HMAC) — seule la **remise du SMS** est omise (ne jamais harceler un numéro banni ; un code stocké mais non remis ne peut jamais connecter, `verify` refusant les comptes désactivés).

### Throttling multicouche (le SMS coûte et peut harceler)

- `request` : par **téléphone cible** (`otp_request_phone`, 3/h) ET par **IP** (`otp_request_ip`, 10/h), scopes indépendants ; un téléphone imparsable ne consomme que le budget IP (il ne peut pas déclencher de SMS).
- `verify` : par IP (`otp_verify_ip`, 10/h) en plus du plafond de 5 tentatives par code.
- Taux surchargeables par env (`THROTTLE_OTP_*`), comme les scopes auth existants.

### Abstraction SMS et garde-fou de boot

`apps/common/sms.py` (miroir du pattern PSP) : `console` (dev, loggue — le corps du message, donc le code, uniquement au niveau DEBUG, admis en dev seulement), `memory` (tests, boîte d'envoi en mémoire), `stub` (squelette des agrégateurs comoriens — chantier dédié, boote mais refuse d'envoyer). Sélection par `SMS_BACKEND` (.env) ; **`console` et `memory` sont refusés au démarrage si `DEBUG=False`** (`ImproperlyConfigured`, même posture que le PSP fake). Envoi via tâche Celery ; `CELERY_TASK_ALWAYS_EAGER` suit `DEBUG` par défaut (dev/tests inline, prod via workers).

### Audit sans PII (ADR 0007)

Chaque étape est journalisée (`auth.otp_requested`, `auth.otp_verified`, `auth.otp_failed`, `auth.account_created`, `auth.account_activated`, plus `patient_profile.claimed` existant). Payloads = références uniquement : **jamais le code, jamais le téléphone en clair**. Quand aucun `User` n'existe à référencer, `phone_ref` (HMAC clé secrète, tronqué) fournit une corrélation pseudonyme non réversible.

## Conséquences

- Le frontend patient/tuteur branche `otp/request` + `otp/verify` et route avec le `me` retourné ; `two-step` de Vireo correspond à ce flux. Il ajoute l'écran de **confirmation des liens de tutelle** juste après la première connexion (liste `PENDING_CLAIMANT_CONFIRMATION`, boutons confirmer/refuser, ton rassurant).
- Les lignes `OtpCode` mortes (expirées/consommées/non remises) restent en base : une purge planifiée (Celery beat) est un petit chantier d'hygiène à prévoir.
- La revendication d'un profil guichet (porte C) reste à concevoir côté centre (vérification en présentiel) — hors périmètre de cette ADR, volontairement.

### Vigilances de déploiement (OTP-3 / OTP-4, revue guardian — pas de correction code)

- **OTP-3 — le code transite par le broker Redis en async.** Inhérent à l'envoi hors process. Conf actuelle : `result_extended` n'est PAS activé (défaut Celery → les **arguments de tâche ne sont pas stockés** dans le backend de résultats), `task_send_sent_event` non activé, `CELERY_TASK_TRACK_STARTED` ne journalise pas les args. À maintenir au déploiement : **ne jamais activer `result_extended`/`task_send_sent_event` pour la tâche `accounts.send_sms`**, broker interne (réseau privé), **TLS** sur Redis, et **TTL court** sur les résultats/messages. Le broker fait partie du périmètre de confiance.
- **OTP-4 — `phone_audit_ref` est corrélable si `SECRET_KEY` fuit.** Le pseudonyme est un HMAC clé `SECRET_KEY` : irréversible sans la clé, mais deux entrées d'un même numéro sont corrélables, et une fuite de `SECRET_KEY` permettrait un test par force brute sur un numéro suspecté. Consigne d'exploitation : **ne jamais co-exporter les journaux d'audit et `SECRET_KEY`** (secrets et logs dans des périmètres séparés) ; la rotation de `SECRET_KEY` casse la corrélation historique (acceptable).
