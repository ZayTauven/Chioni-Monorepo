/*
 * Chioni — le réseau des pharmacies (S9, ADR 0022), contrat §Réseau.
 *
 * **Quatre familles d'URL, cinq audiences, un seul module** — parce que ce
 * qu'il faut lire avant d'écrire une ligne d'écran, c'est la frontière :
 *
 * 1. `pharmacy/{p}/…`                     → le 5ᵉ espace (l'officine elle-même)
 * 2. `centers/{c}/pharmacies|…`           → l'annuaire et la diffusion
 * 3. `centers/{c}/prescriptions/…`        → le comptoir (dette C.1, soldée)
 * 4. `patients/me/prescriptions/{p}/…`    → le carnet du patient
 * 5. `platform/pharmacies/…`              → le back-office
 *
 * Et une cinquième famille qui **n'existe pas et n'existera pas** :
 * `guardian/…`. Le tuteur ne voit ni la demande, ni la réponse, ni l'annuaire.
 * La disponibilité d'un traitement est une information clinique, le verrou
 * tuteur de S3 tient tel quel, et une sonde de routes le vérifie côté serveur.
 *
 * ─── L'invariant du sprint, côté client ───────────────────────────────────
 *
 * Une officine connaît une ZONE, une LISTE DE MÉDICAMENTS et un NUMÉRO de
 * demande. Jamais le centre, jamais l'ordonnance, jamais le patient, jamais la
 * posologie. Le backend ne les envoie pas ; les types ne leur réservent aucun
 * emplacement ; les écrans n'en inventent pas.
 *
 * ─── Ce qui n'est PAS ici, et qui n'est pas un oubli ──────────────────────
 *
 * Aucun **prix** (un prix affiché à un patient devient une promesse), aucun
 * **stock déclaré** (un catalogue non tenu à jour ment, et son mensonge coûte
 * un déplacement), aucune **demande libre hors ordonnance** (un champ de texte
 * libre partant vers un tiers est le canal par lequel un nom de patient
 * finirait par sortir), aucune **carte ni géolocalisation** (le ciblage est
 * administratif : île + commune), aucune **délivrance partielle**, aucune
 * **inscription en self-service** d'une officine. Décisions, pas manques.
 *
 * ─── Gel d'abonnement et KYC ──────────────────────────────────────────────
 *
 * **Rien de ce module n'est gelé, et rien n'est conditionné au KYC du centre**
 * (ADR 0022 décision 7) : chercher un médicament pour un patient est un geste
 * de soin, et le centre en impayé est précisément celui dont les patients ont
 * le moins les moyens de courir la ville. Ne griser aucun bouton, ne monter
 * aucun bandeau d'abonnement sur ces écrans.
 */

import { apiDownload, apiFetch } from '../api';
import type {
  AvailabilityRequestCenter,
  AvailabilityRequestCenterDetail,
  AvailabilityRequestPatient,
  Island,
  InboxRequest,
  Paginated,
  PharmacyDirectoryEntry,
  PharmacyDocType,
  PharmacyDocument,
  PharmacyMember,
  PharmacySelf,
  PharmacyStatus,
  PlatformPharmacy,
  PlatformPharmacyCreated,
  Prescription,
  PrescriptionStatus,
} from '../types';

/* ═════════════════════════════════════════════════════════════════════════
   1. CÔTÉ CENTRE — l'annuaire et la diffusion
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * L'annuaire des officines **validées** — lisible par TOUT staff actif.
 *
 * Savoir quelles pharmacies existent n'est pas une information clinique : une
 * secrétaire peut avoir à en appeler une. Non paginé (le réseau d'une île
 * tient à l'écran), trié par commune puis par nom.
 *
 * C'est aussi **l'endpoint qui annonce la diffusion** : appelé avec l'île et
 * la commune choisies, il rend la liste RÉELLE des officines qui vont
 * recevoir. L'ADR l'exige — « la diffusion est bornée ET annoncée » — et un
 * compteur abstrait ne suffit pas : on montre les noms.
 *
 * `island` hors liste fermée → 400 par champ, d'où le type `Island`.
 */
export function listPharmacies(
  centerId: number,
  filters: { island?: Island; city?: string; q?: string } = {},
): Promise<PharmacyDirectoryEntry[]> {
  const query = new URLSearchParams();
  if (filters.island) query.set('island', filters.island);
  if (filters.city) query.set('city', filters.city);
  if (filters.q) query.set('q', filters.q);
  const qs = query.toString();
  return apiFetch(`/centers/${centerId}/pharmacies/${qs ? `?${qs}` : ''}`);
}

/** Les recherches déjà lancées pour CETTE ordonnance (tableau nu). */
export function listPrescriptionAvailabilityRequests(
  centerId: number,
  prescriptionId: number,
): Promise<AvailabilityRequestCenter[]> {
  return apiFetch(
    `/centers/${centerId}/prescriptions/${prescriptionId}/availability-requests/`,
  );
}

/**
 * **LE geste du sprint** : diffuser les lignes COCHÉES d'une ordonnance aux
 * officines d'une zone. Rôles cliniques + pharmacien (une secrétaire ne
 * diffuse pas une liste de médicaments).
 *
 * `item_ids` est **obligatoire et explicite** — le service ne prend jamais
 * « toute l'ordonnance » par défaut. Le « tout coché » est une affordance
 * d'écran, jamais une règle de serveur : c'est la traduction, dans le contrat
 * d'API, de la garde n° 1 de l'ADR 0022 — *le prescripteur choisit ce qui
 * sort*, parce que c'est lui qui sait quelle ligne est parlante dans une
 * commune de deux mille habitants.
 *
 * Six refus, tous en 400 avec une phrase française **à afficher telle quelle**
 * (elles sont actionnables, ce que nos reformulations ne seraient pas) :
 * ordonnance déjà délivrée · aucune ligne cochée · ligne étrangère à
 * l'ordonnance · aucune officine validée dans la zone · **diffusion au-delà du
 * plafond** (avec le compte réel et « précisez la commune ») · **recherche
 * déjà ouverte** sur la même ordonnance et la même zone — le double-clic ne
 * diffuse pas deux fois.
 *
 * Throttle dédié `availability` (60/h) : c'est le seul geste du produit qui
 * parle à des tiers en masse, et il déclenche N SMS. Prévoir le 429.
 *
 * L'objet rendu **n'est pas annoté** : `recipient_count`, `response_count` et
 * `last_response_at` y valent `0`/`null`. Refetcher la liste après création.
 */
export function createAvailabilityRequest(
  centerId: number,
  prescriptionId: number,
  payload: { island: Island; city?: string; item_ids: number[] },
): Promise<AvailabilityRequestCenter> {
  return apiFetch(
    `/centers/${centerId}/prescriptions/${prescriptionId}/availability-requests/`,
    { method: 'POST', body: payload },
  );
}

/** Le fil des recherches du centre (paginé). Rôles cliniques + pharmacien. */
export function listCenterAvailabilityRequests(
  centerId: number,
  filters: { status?: 'ouverte' | 'close'; prescription?: number; page?: number } = {},
): Promise<Paginated<AvailabilityRequestCenter>> {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.prescription !== undefined) {
    query.set('prescription', String(filters.prescription));
  }
  query.set('page', String(filters.page ?? 1));
  return apiFetch(`/centers/${centerId}/availability-requests/?${query.toString()}`);
}

/** Une recherche et **les réponses reçues** — la plus récente d'abord. */
export function getCenterAvailabilityRequest(
  centerId: number,
  requestId: number,
): Promise<AvailabilityRequestCenterDetail> {
  return apiFetch(`/centers/${centerId}/availability-requests/${requestId}/`);
}

/**
 * « On a trouvé. » Fermer est un geste ORDINAIRE et sans motif — ce n'est ni
 * une annulation ni un échec, et l'écran ne doit pas le peindre en rouge.
 *
 * La péremption automatique fait la même chose 48 h plus tard, avec un code de
 * raison distinct (`peremption`).
 */
export function closeAvailabilityRequest(
  centerId: number,
  requestId: number,
): Promise<AvailabilityRequestCenterDetail> {
  return apiFetch(`/centers/${centerId}/availability-requests/${requestId}/close/`, {
    method: 'POST',
  });
}

/* ═════════════════════════════════════════════════════════════════════════
   2. LE COMPTOIR DU PHARMACIEN — dette C.1 de l'audit, soldée par S9
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Les ordonnances du centre, **paginé**, plus récentes d'abord.
 *
 * Le poste de travail que le pharmacien n'a jamais eu : jusqu'ici il pouvait
 * lire une ordonnance consultation par consultation, à condition d'en
 * connaître l'identifiant. Aucune liste, aucun filtre — un métier sans écran.
 *
 * Audience : rôles cliniques **+ pharmacien** (R-API-1, la même que la lecture
 * d'une ordonnance). Le staff administratif reçoit 403 : **ne pas monter
 * l'écran hors de ces rôles, fetch compris.**
 *
 * Périmètre : le centre PRODUCTEUR. Le carnet transversal reste l'espace du
 * patient.
 */
export function listCenterPrescriptions(
  centerId: number,
  filters: {
    patient?: number;
    status?: PrescriptionStatus;
    date?: string;
    page?: number;
  } = {},
): Promise<Paginated<Prescription>> {
  const query = new URLSearchParams();
  if (filters.patient !== undefined) query.set('patient', String(filters.patient));
  if (filters.status) query.set('status', filters.status);
  if (filters.date) query.set('date', filters.date);
  query.set('page', String(filters.page ?? 1));
  return apiFetch(`/centers/${centerId}/prescriptions/?${query.toString()}`);
}

/**
 * Remettre les médicaments. **La délivrance est DÉFINITIVE.**
 *
 * Aucune route ne la défait — le second appel renvoie 400 « Cette ordonnance a
 * déjà été délivrée. » Conséquences pour l'écran, non négociables :
 *
 * - **confirmer avant**, comme une contre-passation de caisse ;
 * - **ne jamais afficher de bouton « annuler la délivrance »** : il n'existe
 *   pas côté serveur, et une erreur se raconte dans le carnet, elle ne
 *   s'efface pas ;
 * - une ordonnance délivrée **ne se recherche plus** dans le réseau : masquer
 *   le bouton de diffusion sur ces lignes plutôt que de le laisser échouer.
 *
 * Ouverte aux mêmes rôles que la lecture : dans un centre sans officine
 * interne — la majorité aux Comores — c'est l'infirmière qui remet les
 * médicaments.
 */
export function deliverPrescription(
  centerId: number,
  prescriptionId: number,
): Promise<Prescription> {
  return apiFetch(`/centers/${centerId}/prescriptions/${prescriptionId}/deliver/`, {
    method: 'POST',
  });
}

/* ═════════════════════════════════════════════════════════════════════════
   3. CÔTÉ PATIENT — « où trouver mes médicaments ? »
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Les recherches lancées pour MON ordonnance, et qui a répondu quoi.
 *
 * Tableau nu (non paginé), ordonnance d'autrui → 404. **Lecture seule** : le
 * patient consulte, le centre lance (arbitrage PO n° 3) — pas de bouton
 * « chercher mes médicaments ».
 *
 * Le payload est le sérialiseur PATIENT : **pas de `comment`** (le texte libre
 * d'un tiers s'arrête au centre) et pas de compteurs de diffusion. Le
 * téléphone de l'officine, lui, y est : c'est exactement ce qui évite le
 * trajet inutile, et c'est le geste à mettre en avant (`tel:`).
 */
export function listMyPrescriptionAvailability(
  prescriptionId: number,
): Promise<AvailabilityRequestPatient[]> {
  return apiFetch(`/patients/me/prescriptions/${prescriptionId}/availability/`);
}

/* ═════════════════════════════════════════════════════════════════════════
   4. LE 5ᵉ ESPACE — l'officine elle-même (`/pharmacy/{p}/…`)
   ═════════════════════════════════════════════════════════════════════════ */

const officine = (pharmacyId: number, suffix = ''): string =>
  `/pharmacy/${pharmacyId}/${suffix}`;

/** Sa fiche. `status_reason` est la consigne de Chioni : l'afficher entière. */
export function getPharmacy(pharmacyId: number): Promise<PharmacySelf> {
  return apiFetch(officine(pharmacyId));
}

/** Ce qu'une officine corrige elle-même — `status` n'en fait PAS partie. */
export interface PharmacyPatch {
  name?: string;
  island?: Island;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
}

/**
 * Corriger sa fiche.
 *
 * **ATTENTION — le déménagement déclaré renvoie l'officine en vérification**
 * (revue guardian S9). Modifier `island` ou `city` sur une officine `validee`
 * la repasse `en_attente` : la commune n'est pas une ligne d'adresse, c'est la
 * SEULE borne à la distance que parcourt une liste de médicaments, donc elle
 * se revérifie. L'officine garde tout (historique, pièces, gens, demandes déjà
 * reçues) et ne reçoit plus rien jusqu'à confirmation par Chioni.
 *
 * Le PATCH répond 200 **avec le nouveau statut** et le `status_reason` qui
 * l'explique. L'écran doit donc **prévenir AVANT** de valider un changement de
 * zone — sinon la rétrogradation se découvre sur une boîte de réception vide,
 * et se vit comme un bug. Corriger l'adresse, le téléphone, l'e-mail ou le nom
 * ne change rien au statut : ne pas avertir dans ces cas-là.
 *
 * `status` envoyé quand même est **ignoré** — le type l'interdit ici plutôt
 * que de laisser essayer (patron `updateEquipment` de S8).
 */
export function updatePharmacy(
  pharmacyId: number,
  payload: PharmacyPatch,
): Promise<PharmacySelf> {
  return apiFetch(officine(pharmacyId), { method: 'PATCH', body: payload });
}

/**
 * La boîte de réception — **paginée**.
 *
 * Le queryset part des LIGNES DE DIFFUSION adressées à cette officine : ce qui
 * ne lui a pas été adressé n'existe pas pour elle, et aucune officine ne peut
 * deviner l'activité d'une autre.
 */
export function listInbox(
  pharmacyId: number,
  filters: { status?: 'ouverte' | 'close'; page?: number } = {},
): Promise<Paginated<InboxRequest>> {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  query.set('page', String(filters.page ?? 1));
  return apiFetch(officine(pharmacyId, `requests/?${query.toString()}`));
}

/** Une demande reçue. `pk` = id de la ligne de diffusion, pas de la demande. */
export function getInboxRequest(
  pharmacyId: number,
  recipientId: number,
): Promise<InboxRequest> {
  return apiFetch(officine(pharmacyId, `requests/${recipientId}/`));
}

/**
 * « Je l'ai / je ne l'ai pas », **ligne par ligne**.
 *
 * `lines` doit couvrir **tous** les médicaments demandés (400 « Répondez pour
 * chacun des médicaments demandés. » sinon). D'où la forme d'écran imposée :
 * **deux boutons par ligne, jamais une case à cocher** — une case laisse un
 * doute entre « je n'ai pas répondu » et « je ne l'ai pas », et ce doute-là se
 * paie en trajet pour quelqu'un qui marche.
 *
 * **Répondre à nouveau est prévu et normal** : le stock bouge, une officine se
 * corrige par une nouvelle réponse (append-only), la dernière fait foi et
 * l'historique reste. Le bouton reste « Mettre à jour ma réponse », **jamais
 * grisé** après le premier envoi.
 *
 * Trois refus à afficher tels quels : demande close · demande expirée (48 h) ·
 * officine non validée (« votre officine ne peut pas répondre pour le
 * moment » — enchaîner sur `status_reason`).
 */
export function respondToRequest(
  pharmacyId: number,
  recipientId: number,
  payload: { lines: { item: number; is_available: boolean }[]; comment?: string },
): Promise<InboxRequest> {
  return apiFetch(officine(pharmacyId, `requests/${recipientId}/respond/`), {
    method: 'POST',
    body: payload,
  });
}

/** Les collègues (tableau nu) — actifs d'abord. Aucun rôle, aucune hiérarchie. */
export function listPharmacyMembers(pharmacyId: number): Promise<PharmacyMember[]> {
  return apiFetch(officine(pharmacyId, 'members/'));
}

/**
 * Inscrire un collègue. Tout membre ACTIF le peut — il n'y a pas de patron
 * dans une officine de trois personnes.
 *
 * Compte **ombre** réclamé par OTP : aucun mot de passe n'est créé ni transmis.
 * Le dire à l'écran (« il recevra un code par SMS à sa première connexion »),
 * jamais promettre un identifiant.
 */
export function addPharmacyMember(
  pharmacyId: number,
  payload: { phone: string; first_name?: string; last_name?: string },
): Promise<PharmacyMember> {
  return apiFetch(officine(pharmacyId, 'members/'), { method: 'POST', body: payload });
}

/**
 * Se retirer, ou retirer un collègue — **sauf le dernier actif** (400 avec une
 * consigne). Une officine sans personne est une boîte de réception que plus
 * personne ne relève : miroir exact de la garde « dernier directeur ».
 */
export function deactivatePharmacyMember(
  pharmacyId: number,
  membershipId: number,
): Promise<PharmacyMember> {
  return apiFetch(officine(pharmacyId, `members/${membershipId}/deactivate/`), {
    method: 'POST',
  });
}

/** Les pièces justificatives (tableau nu), plus récentes d'abord. */
export function listPharmacyDocuments(pharmacyId: number): Promise<PharmacyDocument[]> {
  return apiFetch(officine(pharmacyId, 'documents/'));
}

/**
 * Déposer une pièce. **Multipart**, socle d'uploads durci ADR 0014 : JPEG /
 * PNG / WebP **réels** (le format est décodé, l'extension du client est
 * ignorée), 2 Mo, 2048² max, EXIF strippé — **le PDF est refusé**, une photo
 * de licence est un JPEG. Throttle strict `uploads` (20/h) : prévoir le 429.
 */
export function uploadPharmacyDocument(
  pharmacyId: number,
  payload: { file: File; doc_type: PharmacyDocType },
): Promise<PharmacyDocument> {
  const form = new FormData();
  form.append('file', payload.file);
  form.append('doc_type', payload.doc_type);
  return apiFetch(officine(pharmacyId, 'documents/'), { method: 'POST', body: form });
}

/**
 * Lire les octets d'une pièce. **Seul chemin de lecture** : le stockage privé
 * n'a pas d'URL (`url()` lève toujours), donc jamais d'`<img src>`, jamais de
 * lien direct — `apiDownload` porte le Bearer et révoque l'object URL.
 */
export function downloadPharmacyDocument(
  pharmacyId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    officine(pharmacyId, `documents/${documentId}/download/`),
    `piece-${documentId}`,
  );
}

/** Archiver une pièce — correction sans destruction, et **définitif**. */
export function archivePharmacyDocument(
  pharmacyId: number,
  documentId: number,
): Promise<PharmacyDocument> {
  return apiFetch(officine(pharmacyId, `documents/${documentId}/archive/`), {
    method: 'POST',
  });
}

/* ═════════════════════════════════════════════════════════════════════════
   5. LE BACK-OFFICE — `/platform/pharmacies/…`
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Toutes les officines (paginé). `support` **et** `admin` lisent.
 *
 * `status`/`island` hors liste fermée → 400 par champ ; `q` cherche le nom ou
 * la commune.
 */
export function listPlatformPharmacies(
  filters: { status?: PharmacyStatus; island?: Island; q?: string; page?: number } = {},
): Promise<Paginated<PlatformPharmacy>> {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.island) query.set('island', filters.island);
  if (filters.q) query.set('q', filters.q);
  query.set('page', String(filters.page ?? 1));
  return apiFetch(`/platform/pharmacies/?${query.toString()}`);
}

/**
 * Doublons possibles — **NON bloquant** (miroir de la porte C patient et de la
 * détection des centres). Aucune contrainte d'unicité n'existe : deux
 * « Pharmacie du Port » peuvent coexister sur deux îles. L'exploitant est
 * INFORMÉ, il décide.
 *
 * Aucun critère (`name` et `city` vides) → 400 : ne pas appeler à vide.
 */
export function listSimilarPharmacies(criteria: {
  name?: string;
  city?: string;
  island?: Island;
}): Promise<Paginated<PlatformPharmacy>> {
  const query = new URLSearchParams();
  if (criteria.name) query.set('name', criteria.name);
  if (criteria.city) query.set('city', criteria.city);
  if (criteria.island) query.set('island', criteria.island);
  return apiFetch(`/platform/pharmacies/similar/?${query.toString()}`);
}

export function getPlatformPharmacy(pharmacyId: number): Promise<PlatformPharmacy> {
  return apiFetch(`/platform/pharmacies/${pharmacyId}/`);
}

/**
 * Enregistrer une officine **et sa première personne** en une transaction —
 * `admin` seul. Une pharmacie sans personne est une boîte de réception morte.
 *
 * L'officine naît **toujours** `en_attente` : un statut envoyé serait ignoré,
 * seule la transition dédiée la déplace. Le membre naît en compte **ombre**
 * (OTP, aucun mot de passe transmis).
 *
 * Séparation des pouvoirs : un exploitant Chioni **ne peut pas** être inscrit
 * dans une officine (400 explicite) — celui qui valide ne valide pas la
 * sienne.
 */
export function createPlatformPharmacy(payload: {
  name: string;
  island: Island;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  member_phone: string;
  member_first_name?: string;
  member_last_name?: string;
}): Promise<PlatformPharmacyCreated> {
  return apiFetch('/platform/pharmacies/', { method: 'POST', body: payload });
}

/**
 * **LA porte unique du statut** — `admin` seul, et le seul vrai pouvoir de ce
 * module : la validation ouvre la réception des demandes.
 *
 * Machine fermée : `en_attente → validee|suspendue`, `validee →
 * suspendue|en_attente`, `suspendue → validee`. **Motif obligatoire pour
 * suspendre** (400 sinon) ; facultatif pour remettre en examen — « je
 * revérifie » n'est pas « je sanctionne ».
 *
 * Le motif est **lu par l'officine elle-même** : l'écrire comme une consigne
 * actionnable, jamais comme une note interne. Il n'entre dans aucun journal
 * d'audit.
 *
 * Ce qu'une suspension ferme, et **rien de plus** : recevoir de nouvelles
 * demandes, et y répondre. L'officine garde la lecture de son historique et le
 * dépôt de ses pièces — c'est ainsi qu'elle se régularise. Le dire dans la
 * modale, comme pour un centre.
 */
export function setPlatformPharmacyStatus(
  pharmacyId: number,
  status: PharmacyStatus,
  reason: string,
): Promise<PlatformPharmacy> {
  return apiFetch(`/platform/pharmacies/${pharmacyId}/status/`, {
    method: 'POST',
    body: { status, reason },
  });
}

/**
 * Amorcer une personne dans une officine qui n'en a plus (départ, accident) —
 * `admin` seul. Sans elle, la boîte reste sans relève et plus personne ne peut
 * s'inscrire. Miroir de `POST /platform/centers/{pk}/directors/`.
 */
export function createPlatformPharmacyMember(
  pharmacyId: number,
  payload: { phone: string; first_name?: string; last_name?: string },
): Promise<PharmacyMember> {
  return apiFetch(`/platform/pharmacies/${pharmacyId}/members/`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Les pièces déposées, **archivées comprises** : une validation doit rester
 * auditable contre ce qui l'a fondée. Tableau nu.
 */
export function listPlatformPharmacyDocuments(
  pharmacyId: number,
): Promise<PharmacyDocument[]> {
  return apiFetch(`/platform/pharmacies/${pharmacyId}/documents/`);
}

/** Les octets d'une pièce, côté plateforme — même stockage privé. */
export function downloadPlatformPharmacyDocument(
  pharmacyId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    `/platform/pharmacies/${pharmacyId}/documents/${documentId}/download/`,
    `piece-${documentId}`,
  );
}
