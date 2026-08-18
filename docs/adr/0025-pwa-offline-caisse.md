# ADR 0025 — PWA/offline et mode dégradé caisse (chantier à clés)

- **Statut** : acté (cadrage dédié obligatoire — de l'argent va être saisi hors ligne ;
  guardian obligatoire après implémentation)
- **Date** : 2026-08-16
- **Sources** : audit §D.6 + chantiers à clés, étude des besoins (« la caisse ne doit jamais
  être bloquée par une panne réseau »), ADR 0015 (caisse), addendum S1 (idempotence guichet),
  ADR 0016 (stockage privé — rien de clinique ne traîne), arbitrage PO du 16/08/2026

## Contexte

La connectivité comorienne est le risque technique n° 1 de l'étude. Aujourd'hui, une coupure
réseau rend la caisse muette : le centre retourne au papier, et le papier ne revient pas
toujours dans Chioni. L'arbitrage PO : **lecture hors ligne + encaissements saisis hors
ligne, mis en file locale et synchronisés au retour du réseau**. Les clés d'idempotence du
guichet (S1) existent précisément pour ça — c'est la fondation, pas un ajout.

## Le risque directeur, nommé au cadrage

Écrire de l'argent hors ligne ouvre trois portes qu'il faut fermer par conception :

1. **Le double débit à la synchronisation.** Remède existant : la clé d'idempotence par
   encaissement, générée À LA SAISIE (pas à l'envoi), rejouée telle quelle à chaque
   tentative de sync. Le serveur reconnaît le rejeu et rend le même reçu (verrouillé par
   les tests S1).
2. **Le dépassement de solde à plusieurs.** Deux caissiers hors ligne peuvent encaisser
   chacun le solde entier de la même facture. Le serveur reste l'arbitre : à la sync, la
   règle « jamais au-delà du solde sous verrou » (ADR 0015) refuse le second. La décision
   de cadrage est ailleurs : **ce refus doit être rendu à un humain et acquitté par lui**
   — un encaissement refusé en silence est de l'argent réellement reçu au guichet qui
   n'existe nulle part. C'est LA règle n° 1 du chantier.
3. **Des données de santé sur un appareil partagé.** Un poste de guichet se prête, se vole.
   Conséquence de conception : **le cache hors ligne ne porte JAMAIS de donnée clinique** —
   ni carnet, ni diagnostic, ni ordonnance, ni document. Uniquement l'opérationnel de
   caisse : file du jour (identités administratives), tarifs, factures émises et soldes.

## Décision 1 — Un seul geste s'écrit hors ligne : l'encaissement guichet

`CashPayment` (espèces, mobile money), et rien d'autre. Les exclusions sont des décisions :

- **pas de contre-passation hors ligne** — une correction sur un encaissement peut-être
  pas-encore-synchronisé est le pire graphe de dépendances du produit ; corriger attendra
  le réseau ;
- **pas de création de facture ni d'acte** — la facture naît d'une consultation, parcours
  en ligne ;
- **aucun geste clinique, aucun geste diaspora** — le rail PSP est par nature en ligne ;
- **pas d'écriture patient/tuteur hors ligne** — la PWA installable leur donne l'app shell
  et un état « hors ligne » honnête, pas des données locales.

## Décision 2 — La file d'attente locale et sa synchronisation

- **IndexedDB**, une file FIFO par appareil. Chaque élément : clé d'idempotence, id de
  facture, montant, méthode (+ opérateur), **moment de saisie local** (`offline_recorded_at`),
  et le minimum d'affichage (masque du nom, solde affiché au moment de la saisie). Jamais
  plus.
- Sync au retour du réseau (et à l'ouverture de l'app) : chaque élément rejoue le POST
  normal du guichet avec sa clé. Réponses :
  - 200/201 → l'élément passe « synchronisé », le reçu « G- » existe désormais ;
  - 400 « solde dépassé » / « facture annulée » / autre refus métier → l'élément passe
    **« refusé » et RESTE VISIBLE jusqu'à acquittement explicite** d'un humain (règle n° 1) ;
  - erreur réseau → l'élément reste en file, retry borné avec backoff.
- **La numérotation des reçus reste au serveur** (race-safe, ADR 0015). Hors ligne, le
  ticket local dit « enregistré sur cet appareil — reçu à suivre à la synchronisation » et
  l'UI **ne promet jamais un numéro**.

## Décision 3 — Le temps : le serveur fait foi, la saisie est dite

Un encaissement saisi lundi hors ligne et synchronisé mardi tombe dans la journée de mardi
(`created_at` serveur — les séries de recettes et l'export comptable restent incorruptibles :
un horodatage client qui ferait foi serait une porte d'antidatage). Le **moment de saisie**
(`offline_recorded_at`) voyage dans le payload à titre déclaratif, est stocké, et s'affiche
avec sa nature (« saisi hors ligne le …, enregistré le … ») — la transparence sans donner au
client l'autorité sur le temps. Petit champ backend + affichage journal/reçu.

## Décision 4 — Le cache de lecture : minimal, périssable, purgé

- Périmètre : file du jour, tarifs, factures émises + soldes, la file d'attente elle-même.
  **Espace centre, rôles caisse** — aucun cache de données pour patient/tuteur/plateforme/
  pharmacie.
- TTL court (24 h) ; **purge du cache de lecture au `signOut`**.
- **La file d'ÉCRITURE survit à la déconnexion** — décision explicite : perdre des
  encaissements saisis serait pire que la trace minimale qu'ils laissent (montants + ids +
  masques, jamais un dossier). Elle se vide par synchronisation ou acquittement, jamais par
  logout.

## Décision 5 — Service worker artisanal, zéro dépendance

App shell en cache (manifest + icônes + bascule réseau détectée), service worker écrit à la
main — pas de workbox : la surface est petite, et chaque dépendance du chemin de l'argent
est une surface d'audit de plus. Bandeau « hors ligne » global honnête sur les 5 espaces ;
écran « File d'attente de caisse » (en attente / refusés à acquitter / synchronisés
récents) dans l'espace centre.

## Ce qui n'entre pas dans ce chantier

Mode dégradé clinique (consultations hors ligne) ; multi-appareils coordonnés (chaque file
est locale à son appareil) ; résolution de conflits au-delà du refus serveur (le serveur
est l'arbitre, pas un CRDT) ; notifications push ; installation forcée.

## Conséquences

- Backend : champ déclaratif `offline_recorded_at` sur l'encaissement (+ exposition
  lecture), rien d'autre — l'idempotence et les verrous existants font le travail.
- Frontend : service worker, manifest, IndexedDB, file de sync, UI d'état réseau et
  d'acquittement. Le gros du chantier.
- **Guardian obligatoire après implémentation** : rejeu de sync sous course, refus rendus,
  contenu réel du cache (rien de clinique), survie/purge des files.
