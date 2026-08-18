# ADR 0024 — i18n shikomori, mécanisme léger à repli français (chantier à clés)

- **Statut** : acté (cadrage court — le mécanisme est petit, mais il touche les textes que
  lisent les personnes les plus fragiles du produit ; les décisions méritent d'être écrites)
- **Date** : 2026-08-16
- **Sources** : audit §D.5 + chantiers à clés, ADR 0011 (architecture frontend), ADR 0012
  (SMS — point d'extraction unique), CLAUDE.md (« i18n prévue : shikomori en phase 2 »),
  arbitrages PO du 16/08/2026

## Contexte

Les points d'extraction existent depuis le premier jour et ont été défendus sprint après
sprint : `frontend/src/lib/labels.ts` est l'unique maison des libellés FR, et les templates
SMS sont des constantes de `apps/common/notifications.py`. Le mécanisme, lui, n'a jamais été
monté. Le public cible est celui de l'étude : des patients et des proches dont le français
n'est pas toujours la langue de confort, sur des téléphones d'entrée de gamme.

## Arbitrages du PO (16/08/2026)

1. **Grand public d'abord** : espaces patient + tuteur + écrans d'authentification. Le
   personnel des centres, la plateforme et la pharmacie travaillent en français — leurs
   écrans ne bougent pas.
2. **Les SMS basculeront plus tard, après validation humaine des traductions.** L'UI
   d'abord. Les SMS (OTP, porte de confirmation du titulaire, argent) sont les textes les
   plus sensibles du produit : aucun ne part en shikomori avant relecture du PO. Le
   **mécanisme** (préférence de langue par personne) est posé dès maintenant pour que la
   bascule soit triviale le jour venu.
3. **Le PO relit et corrige les traductions lui-même.** Conséquence de conception : le
   dictionnaire doit être UN fichier lisible et éditable par un non-développeur soigneux,
   pas un arbre de fichiers par namespace.
4. **Non envahissant.** Le dictionnaire sera partiel, longtemps. Un mot non traduit
   s'affiche en français — jamais une clé technique, jamais un trou.

## Décision 1 — Un dictionnaire de recouvrement, pas une réécriture

Le mécanisme est un **overlay** au-dessus de `labels.ts`, qui reste la source de vérité
française et l'unique point d'extraction :

- `frontend/src/lib/i18n/sn.ts` : UN fichier, un objet plat `{ "texte français": "texte
  shikomori" }`, **clé = la chaîne française elle-même**. C'est le choix assumé qui rend le
  système non envahissant : aucune indirection de clés à inventer, aucun écran à réécrire,
  et le repli français est **structurel** (chaîne absente → la chaîne française EST le
  rendu). Fragilité connue et acceptée : reformuler un libellé français « détache » sa
  traduction — le test de couverture (décision 4) le rend visible au lieu de le laisser
  pourrir.
- Une fonction `t(text)` et un contexte `LangContext` ; les **composants partagés du
  chrome lite et des écrans grand public** appellent `t()` à leurs points de rendu. Les
  écrans du centre/plateforme/pharmacie n'importent rien.
- Aucune dépendance npm : pas de framework i18n pour un overlay à une langue.

## Décision 2 — La préférence de langue appartient à la personne

- `User.preferred_language`, choix fermés `fr` (défaut) | `zdj`. **Code ISO 639-3 `zdj`
  (shingazidja)** — jamais `sn` (shona) ni `km` (khmer), pièges classiques. Le choix du
  variant dialectal des traductions est éditorial et appartient au PO ; le code stocké dit
  « shikomori » au sens du produit, l'étiquette UI dit « Shikomori ».
- Exposée dans `/auth/me/`, modifiable par `PATCH /auth/me/` (elle appartient au compte,
  pas à un espace) ; réglable aussi **avant connexion** (bascule locale sur les écrans
  d'auth, persistée au premier login).
- **Un utilisateur au guichet ne règle PAS la langue d'un patient** : la préférence n'est
  pas une donnée que le centre administre. Le jour des SMS traduits, un profil non
  revendiqué (pas de compte) recevra le français par défaut — consigné, réversible.
- `notifications.py` résoudra la langue **au moment de l'envoi** le jour de la bascule SMS
  (contrat déjà consigné dans l'addendum Twilio de l'ADR 0012 : l'agrégateur reçoit un
  texte final, il ne choisit jamais une langue).

## Décision 3 — La bascule est visible sans être un réglage enfoui

Sur le chrome lite (patient/tuteur) et les écrans d'auth : une bascule « FR / Shikomori »
directement visible (pas dans un sous-menu de paramètres — le public cible ne fouille pas).
Elle écrit la préférence du compte quand il y en a un, `localStorage` sinon.

## Décision 4 — Le dictionnaire livré est un BROUILLON, et le produit le sait

- L'agent livre une première passe de traductions **marquées brouillon** (en-tête du
  fichier : « traductions non validées — relecture PO requise ligne à ligne »).
- Un test de couverture **informatif, jamais bloquant** : il liste les chaînes grand public
  sans traduction (le repli français est un comportement normal, pas un échec) et les
  traductions orphelines (chaîne française reformulée depuis).
- **Aucun SMS traduit dans ce chantier** — la sonde de non-régression vérifie que
  `notifications.py` ne consomme encore aucun dictionnaire.

## Ce qui n'entre pas dans ce chantier

Nommé pour que ce soit un choix : la traduction des espaces professionnels ; les SMS
(différés à la validation PO) ; le pluriel/genre grammaticaux (les libellés du produit sont
des phrases complètes, pas des gabarits composables) ; les formats de dates/nombres
(déjà localisés FR, inchangés) ; toute langue tierce (l'anglais n'a pas de public ici).

## Conséquences

- Deux champs de surface : migration `User.preferred_language`, bascule UI, `t()` posé sur
  les surfaces grand public. Le reste du produit ne bouge pas d'une ligne.
- Le jour de la bascule SMS : templates `zdj` dans `notifications.py` + résolution par
  destinataire — le mécanisme d'aujourd'hui n'aura pas à changer.
