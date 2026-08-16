/*
 * Chioni — le parc de matériel du centre (S8, ADR 0021), contrat §Équipements.
 *
 * Le plus petit domaine du produit : **deux tables, quatre routes**, toutes
 * sous `centers/{c}/equipment/…`. Rien sous `guardian/`, rien sous
 * `patients/me/`, rien sous `platform/` — et il n'y en aura pas : un tuteur,
 * un patient et un exploitant Chioni n'ont rien à voir avec le matériel d'un
 * établissement (ils reçoivent 404 : sans membership, le centre n'existe pas
 * pour eux).
 *
 * Module DÉDIÉ malgré sa taille, pour une seule raison : l'arbitrage
 * d'audience du sprint mérite d'être lu avant qu'on écrive une ligne d'écran.
 *
 * ─── Les trois règles, appliquées CÔTÉ SERVEUR ────────────────────────────
 *
 * 1. **Tout staff signale, le directeur décide.** La lecture du parc est
 *    ouverte à tout membre actif ; l'écriture du parc (déclarer, corriger,
 *    changer l'état, réformer) est DIRECTEUR SEUL ; le **signalement** est
 *    ouvert à tout membre actif. C'est l'infirmière qui constate que le
 *    tensiomètre ne marche plus.
 * 2. **Un signalement ne change PAS l'état de l'appareil.** Ce sont deux
 *    gestes distincts, par deux personnes potentiellement différentes.
 *    L'écran ne doit surtout pas le laisser croire (voir les libellés
 *    `EQUIPMENT_REPORT_NOT_A_STATUS` et `equipmentReportSaved`).
 * 3. **Un équipement ne se supprime pas : il se réforme.** `reforme` est
 *    terminal. Il n'y a **aucun** `DELETE` dans ce fichier, et il ne faut pas
 *    en chercher : le backend n'en expose pas.
 *
 * ─── L'audience du signalement (LA décision du sprint) ────────────────────
 *
 * `listEquipmentReports` renvoie deux payloads selon la casquette de
 * l'appelant : tout staff reçoit `{id, equipment, description, created_at}`,
 * le directeur reçoit **en plus** `reported_by` et `reported_by_display`.
 * Voir `EquipmentReport` dans `lib/types.ts` — l'écran rend ce qui arrive et
 * ne réserve aucun emplacement pour un auteur qu'il ne recevra pas.
 *
 * ─── Gel d'abonnement ─────────────────────────────────────────────────────
 *
 * **Rien de ce module n'est gelé, jamais** — ni sur `suspendu`, ni sur
 * `resilie`, ni sur `impaye`. *Signaler une panne doit toujours passer* : un
 * appareil cassé est une information de soin, et le centre gelé est celui qui
 * a le plus besoin qu'elle circule. Ne griser aucun bouton, ne monter aucun
 * bandeau d'abonnement sur ces écrans.
 */

import { apiFetch } from '../api';
import type {
  Equipment,
  EquipmentCategory,
  EquipmentReport,
  EquipmentStatus,
  Paginated,
} from '../types';

const parc = (centerId: number, suffix = ''): string =>
  `/centers/${centerId}/equipment/${suffix}`;

/* ── le parc : lecture TOUT staff actif ─────────────────────────────────── */

/**
 * Le parc entier, **non paginé** et trié par nom (« le parc tient à
 * l'écran »). Les filtres sont serveur ; une valeur hors liste fermée renvoie
 * 400 par champ, donc les sélecteurs ne proposent que `EQUIPMENT_STATUSES` et
 * `EQUIPMENT_CATEGORIES`.
 *
 * `report_count` / `last_report_at` ne sont annotés QUE sur cette route.
 */
export function listEquipments(
  centerId: number,
  filters: { status?: EquipmentStatus; category?: EquipmentCategory } = {},
): Promise<Equipment[]> {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.category) query.set('category', filters.category);
  const qs = query.toString();
  return apiFetch(parc(centerId, qs ? `?${qs}` : ''));
}

export function getEquipment(centerId: number, equipmentId: number): Promise<Equipment> {
  return apiFetch(parc(centerId, `${equipmentId}/`));
}

/* ── le parc : écriture DIRECTEUR SEUL ──────────────────────────────────── */

export interface EquipmentPayload {
  name: string;
  category: EquipmentCategory;
  serial_number?: string;
  location?: string;
  commissioned_on?: string | null;
  notes?: string;
}

/**
 * Déclarer un appareil. **DIRECTEUR** (les autres casquettes → 403), garde
 * posée à l'écran et pas seulement dans la nav.
 *
 * `location` est un texte LIBRE, jamais une chambre d'hospitalisation ;
 * `serial_number` est libre et NON unique — ne rien valider côté écran, et ne
 * jamais signaler un doublon comme une erreur.
 *
 * La fiche renvoyée n'est **pas annotée** : `report_count` y vaut 0 et
 * `last_report_at` `null`. Relire la liste plutôt que de s'y fier.
 */
export function createEquipment(
  centerId: number,
  payload: EquipmentPayload,
): Promise<Equipment> {
  return apiFetch(parc(centerId), { method: 'POST', body: payload });
}

/**
 * Corriger une fiche. **DIRECTEUR.**
 *
 * `status` n'est **pas** un champ de ce PATCH (il serait ignoré en silence) :
 * l'état a sa porte, `changeEquipmentStatus`, parce qu'elle seule connaît la
 * machine à états. Le type l'interdit ici plutôt que de le laisser essayer.
 */
export function updateEquipment(
  centerId: number,
  equipmentId: number,
  payload: Partial<EquipmentPayload>,
): Promise<Equipment> {
  return apiFetch(parc(centerId, `${equipmentId}/`), { method: 'PATCH', body: payload });
}

/**
 * La **seule** porte de la machine à états. **DIRECTEUR.**
 *
 * `en_service ⇄ en_panne`, et les deux → `reforme`, qui est **terminal**.
 * Toute autre transition — y compris rejouer l'état courant, ou revenir d'une
 * réforme — renvoie 400 « Transition impossible : cet équipement est « … » ».
 * Afficher ce message tel quel : il nomme l'état réel, relu sous verrou, et
 * c'est exactement ce que l'utilisateur a besoin de savoir.
 *
 * Côté `reforme`, le geste est **irréversible** : le modaliser (`Modal` avec
 * `busy`), au même titre qu'une annulation de facture.
 */
export function changeEquipmentStatus(
  centerId: number,
  equipmentId: number,
  status: EquipmentStatus,
): Promise<Equipment> {
  return apiFetch(parc(centerId, `${equipmentId}/status/`), {
    method: 'POST',
    body: { status },
  });
}

/* ── les signalements : TOUT staff actif, lecture ET écriture ───────────── */

/**
 * Le fil des constats, **paginé** (20/page), du plus récent au plus ancien.
 *
 * Le payload dépend de la casquette (voir l'en-tête du module et
 * `EquipmentReport`) : `reported_by` / `reported_by_display` sont **absents**
 * hors directeur, ils n'y valent pas `null`.
 */
export function listEquipmentReports(
  centerId: number,
  equipmentId: number,
  { page = 1 }: { page?: number } = {},
): Promise<Paginated<EquipmentReport>> {
  return apiFetch(parc(centerId, `${equipmentId}/reports/?page=${page}`));
}

/**
 * Poser un constat. **TOUT membre actif** — et rien ne le ferme, gel compris.
 *
 * **Aucun autre champ que la description** : l'équipement voyage dans l'URL et
 * l'auteur est l'appelant. Un `reported_by` envoyé dans le corps est ignoré —
 * on ne signale jamais au nom d'un collègue.
 *
 * Append-only : pas de PATCH, pas de DELETE, pas de statut « résolu ». On
 * corrige un signalement en en postant un second.
 *
 * Sur un appareil **réformé** → 400 « Cet équipement est réformé : il n'est
 * plus en service. » L'écran masque le formulaire dans ce cas plutôt que de
 * laisser écrire pour rien.
 */
export function reportEquipmentIssue(
  centerId: number,
  equipmentId: number,
  description: string,
): Promise<EquipmentReport> {
  return apiFetch(parc(centerId, `${equipmentId}/reports/`), {
    method: 'POST',
    body: { description },
  });
}
