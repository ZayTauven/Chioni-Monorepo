# ADR 0014 — Uploads d'images durcis (logo du centre, photo de profil) et gestion des rôles enrichie

- **Statut** : acté (chantier « Gâter les centres », vague 1b)
- **Date** : 2026-08-13

## Contexte

Le SaaS socle doit gâter les centres : logo affiché en sidebar et sur les
factures/reçus à l'écran (l'impression PDF viendra avec le chantier PDF),
photos de profil dans l'annuaire du personnel, et un directeur capable de
corriger un rôle sans détruire/recréer le membership. Un endpoint d'upload
est une surface d'attaque (fichiers attaquant-contrôlés, re-servis aux
navigateurs) : il fallait une porte unique et durcie.

## Décisions

1. **Une seule porte d'entrée** : `apps/common/uploads.process_image_upload()`.
   Toute image atteignant un `ImageField` passe par elle. Règles, dans
   l'ordre : taille ≤ 2 Mo vérifiée AVANT tout parsing ; format réel décodé
   par Pillow (whitelist fermée **JPEG/PNG/WebP — jamais SVG**, XML
   scriptable = XSS stocké ; extension et Content-Type client ignorés) ;
   dimensions ≤ 2048² lues dans l'en-tête AVANT décodage des pixels (bombes
   de décompression) ; `verify()` structurel ; **ré-encodage complet** qui
   strippe EXIF (GPS), ICC, XMP et toute charge utile en fin de fichier
   (`exif_transpose` d'abord pour ne pas faire pivoter les photos ;
   `info.clear()` + `exif=b""` ferment les chemins de report silencieux des
   encodeurs, WebP notamment) ; nom stocké = `uuid4` + extension déduite du
   format RÉEL (le nom client ne touche jamais le disque).
2. **Pas d'orphelins** : `replace_file()`/`clear_file()` (même module) —
   la ligne est sauvée pointant vers le nouveau fichier PUIS l'ancien est
   effacé du stockage ; le pire cas d'une panne est un fichier périmé,
   jamais une ligne pointant dans le vide. Les media de test vivent dans un
   `MEDIA_ROOT` temporaire par test (conftest).
3. **La photo de profil est une donnée personnelle** : exposée à soi-même
   (`/auth/me/`) et à l'annuaire du personnel d'un centre
   (`StaffUserSerializer`) — **jamais** dans les vues croisées
   patient/tuteur (le tuteur ne voit pas la photo du patient ni l'inverse).
   Le logo, lui, est public par nature (marque du centre).
4. **Identité des comptes staff = même règle que R-API-2** : le directeur
   n'édite `first_name`/`last_name` que d'un compte ombre jamais revendiqué
   (téléphone non vérifié ET mot de passe inutilisable) ; un compte activé
   gère son identité via `PATCH /auth/me/` (nom d'affichage seul — jamais le
   téléphone-pivot ni le username). Rétrograder le **dernier directeur
   actif** est refusé (garde partagée avec la désactivation :
   `_is_last_active_director`). Changement audité
   (`staff.membership_updated`, refs `old_role`/`role`/`fields`).
5. **Écritures d'images hors JSON** : `logo`/`avatar` sont read-only dans
   les serializers ; seuls les endpoints multipart dédiés
   (`POST|DELETE /centers/{pk}/logo/`, directeur seul via
   `StaffOfObjectCenter` ; `POST|DELETE /auth/me/avatar/`, soi-même)
   écrivent, à travers des services audités (logo → `center.updated`).
   Django ne sert `/media/` qu'en DEBUG ; en déploiement, serveur web /
   stockage objet devant (et penser au `Content-Disposition`/CSP si un
   jour un format non-image était admis — il ne l'est pas).

## Conséquences

- Tout futur upload (documents du carnet, pièces KYC…) DOIT réutiliser ce
  module ou étendre sa whitelist en revue — un upload qui le contourne est
  un défaut bloquant.
- Les entrées animées (WebP animé) ne conservent que la première frame —
  logo et avatar sont des images fixes par contrat.
- Limitation assumée : les fichiers vivent sur le disque local
  (`MEDIA_ROOT`) ; le passage à un stockage objet (S3-compatible) au
  déploiement ne change pas le contrat (`replace_file` passe par l'API
  storage de Django).
