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

### Anti-énumération et anti-oracle

- `request` : réponse 200 au corps **constant**, que le téléphone corresponde à un compte, un compte ombre, rien, ou une pierre tombale. Seul un format invalide produit un 400.
- `verify` : tout échec (téléphone inconnu, code faux, expiré, consommé, mort, compte désactivé) → le MÊME 400 « Code invalide ou expiré. ».

### Throttling multicouche (le SMS coûte et peut harceler)

- `request` : par **téléphone cible** (`otp_request_phone`, 3/h) ET par **IP** (`otp_request_ip`, 10/h), scopes indépendants ; un téléphone imparsable ne consomme que le budget IP (il ne peut pas déclencher de SMS).
- `verify` : par IP (`otp_verify_ip`, 10/h) en plus du plafond de 5 tentatives par code.
- Taux surchargeables par env (`THROTTLE_OTP_*`), comme les scopes auth existants.

### Abstraction SMS et garde-fou de boot

`apps/common/sms.py` (miroir du pattern PSP) : `console` (dev, loggue — le corps du message, donc le code, uniquement au niveau DEBUG, admis en dev seulement), `memory` (tests, boîte d'envoi en mémoire), `stub` (squelette des agrégateurs comoriens — chantier dédié, boote mais refuse d'envoyer). Sélection par `SMS_BACKEND` (.env) ; **`console` et `memory` sont refusés au démarrage si `DEBUG=False`** (`ImproperlyConfigured`, même posture que le PSP fake). Envoi via tâche Celery ; `CELERY_TASK_ALWAYS_EAGER` suit `DEBUG` par défaut (dev/tests inline, prod via workers).

### Audit sans PII (ADR 0007)

Chaque étape est journalisée (`auth.otp_requested`, `auth.otp_verified`, `auth.otp_failed`, `auth.account_created`, `auth.account_activated`, plus `patient_profile.claimed` existant). Payloads = références uniquement : **jamais le code, jamais le téléphone en clair**. Quand aucun `User` n'existe à référencer, `phone_ref` (HMAC clé secrète, tronqué) fournit une corrélation pseudonyme non réversible.

## Conséquences

- Le frontend patient/tuteur branche `otp/request` + `otp/verify` et route avec le `me` retourné ; `two-step` de Vireo correspond à ce flux.
- Le code transite par le broker Redis quand Celery est asynchrone (inhérent à l'envoi hors process) : le broker fait partie du périmètre de confiance, à durcir au déploiement (auth Redis, réseau privé).
- Les lignes `OtpCode` mortes (expirées/consommées) restent en base : une purge planifiée (Celery beat) est un petit chantier d'hygiène à prévoir.
- Latéral assumé : le timing de `request` peut varier marginalement (pas d'envoi pour une pierre tombale) — le corps de réponse, lui, ne varie jamais ; à réévaluer si un chantier « timing uniforme » devient pertinent.
- La revendication d'un profil guichet (porte C) reste à concevoir côté centre (vérification en présentiel) — hors périmètre de cette ADR, volontairement.
