/*
 * Chioni — ressources humaines du centre (S7, ADR 0020), contrat §HRM.
 *
 * Module DÉDIÉ plutôt qu'une section de `centers.ts` : c'est le premier
 * domaine du produit dont l'objet est un salarié, et le regrouper rend
 * lisible d'un seul coup d'œil ce que chaque audience a le droit de lire.
 *
 * Trois règles, appliquées CÔTÉ SERVEUR — l'UI ne fait que ne pas mentir :
 *
 * 1. **Chacun voit les siennes, le directeur voit tout.** Il n'existe aucun
 *    délégué RH : caissier, secrétaire, médecin, infirmier, sage-femme et
 *    pharmacien reçoivent 403 sur dossiers / feuille / congés / stats. Ne pas
 *    monter ces écrans hors casquette directeur (ils s'afficheraient pour
 *    recevoir un refus).
 * 2. **Le planning collectif ne dit jamais le régime** : `absent` et `conge`
 *    y sont fondus par le backend. Ne jamais croiser deux appels pour le
 *    reconstituer — l'invariant serait contourné par l'écran.
 * 3. **Aucun motif de congé en texte libre, nulle part** — ni à la demande,
 *    ni au refus. Le backend n'a aucun champ pour le recevoir.
 *
 * Cloisonnement : le dossier RH d'une personne existe DANS un centre. Aucune
 * route transversale n'existe (pas de `/staff/me/hr/`) — tout passe par le
 * centre actif de `CenterContext`.
 *
 * Gel d'abonnement : les DIX écritures d'administration (services, fonctions,
 * fériés, dossiers, feuille de présence, décisions de congé) répondent 400 sur
 * un centre `suspendu`/`resilie`, avec un message complet à afficher tel quel.
 * **Rien de `…/hrm/me/` n'est gelé** : demander un congé, le retirer, déposer
 * ou archiver un justificatif restent ouverts — une personne n'est jamais
 * prise en otage par la facture impayée de son employeur.
 */

import { apiDownload, apiFetch } from '../api';
import type {
  AttendanceRecord,
  AttendanceStats,
  AttendanceStatus,
  Employment,
  Holiday,
  HrDepartment,
  HrJobTitle,
  LeaveDocument,
  LeaveRequest,
  LeaveType,
  MyAttendanceRecord,
  MyEmployment,
  MyLeaveRequest,
  Paginated,
  ScheduleEntry,
} from '../types';

const hrm = (centerId: number, suffix: string): string =>
  `/centers/${centerId}/hrm/${suffix}`;

/* ── configuration : tout staff LIT, le directeur ÉCRIT ─────────────────── */

/** Les services du centre. Liste NON paginée (un organigramme est court). */
export function listDepartments(centerId: number): Promise<HrDepartment[]> {
  return apiFetch(hrm(centerId, 'departments/'));
}

export function createDepartment(centerId: number, name: string): Promise<HrDepartment> {
  return apiFetch(hrm(centerId, 'departments/'), { method: 'POST', body: { name } });
}

export function updateDepartment(
  centerId: number,
  departmentId: number,
  payload: { name?: string; is_active?: boolean },
): Promise<HrDepartment> {
  return apiFetch(hrm(centerId, `departments/${departmentId}/`), {
    method: 'PATCH',
    body: payload,
  });
}

/**
 * Les fonctions du centre. **Une fonction n'ouvre AUCUN droit** : ne jamais
 * s'en servir pour afficher ou masquer quoi que ce soit — les gardes se font
 * sur le rôle (`CenterContext.roles`), comme partout ailleurs.
 */
export function listJobTitles(centerId: number): Promise<HrJobTitle[]> {
  return apiFetch(hrm(centerId, 'job-titles/'));
}

export function createJobTitle(centerId: number, name: string): Promise<HrJobTitle> {
  return apiFetch(hrm(centerId, 'job-titles/'), { method: 'POST', body: { name } });
}

export function updateJobTitle(
  centerId: number,
  jobTitleId: number,
  payload: { name?: string; is_active?: boolean },
): Promise<HrJobTitle> {
  return apiFetch(hrm(centerId, `job-titles/${jobTitleId}/`), {
    method: 'PATCH',
    body: payload,
  });
}

/** Les jours fériés DU CENTRE — pas une liste nationale (ADR 0020 décision 5). */
export function listHolidays(
  centerId: number,
  range: { from?: string; to?: string } = {},
): Promise<Holiday[]> {
  const query = new URLSearchParams();
  if (range.from) query.set('from', range.from);
  if (range.to) query.set('to', range.to);
  const qs = query.toString();
  return apiFetch(hrm(centerId, `holidays/${qs ? `?${qs}` : ''}`));
}

export function createHoliday(
  centerId: number,
  payload: { date: string; name: string },
): Promise<Holiday> {
  return apiFetch(hrm(centerId, 'holidays/'), { method: 'POST', body: payload });
}

/**
 * Le SEUL modèle du module qui se supprime (204). C'est de la configuration de
 * calendrier pure : elle ne documente aucune décision sur une personne, et ce
 * qui s'est passé ce jour-là reste sur la feuille de présence, intacte.
 */
export function deleteHoliday(centerId: number, holidayId: number): Promise<void> {
  return apiFetch(hrm(centerId, `holidays/${holidayId}/`), { method: 'DELETE' });
}

/* ── planning collectif : TOUT membre actif ─────────────────────────────── */

/**
 * Qui est là aujourd'hui. Liste non paginée, jour local Comores.
 *
 * Le payload ne porte **jamais** `conge` (voir `PublicAttendanceStatus`), et
 * `status: null` veut dire « rien n'a été noté », pas « présent ».
 */
export function getSchedule(centerId: number, date?: string): Promise<ScheduleEntry[]> {
  return apiFetch(hrm(centerId, `schedule/${date ? `?date=${date}` : ''}`));
}

/* ── dossiers RH : DIRECTEUR SEUL ───────────────────────────────────────── */

/** Non paginé. `running` filtre les dossiers ouverts / clos. */
export function listEmployments(
  centerId: number,
  options: { running?: boolean } = {},
): Promise<Employment[]> {
  const qs = options.running === undefined ? '' : `?running=${options.running}`;
  return apiFetch(hrm(centerId, `employments/${qs}`));
}

export interface EmploymentPayload {
  /** Id de COMPTE, pris dans `GET /centers/{c}/staff/` (`row.user.id`). */
  user: number;
  hired_at: string;
  department?: number | null;
  job_title?: number | null;
}

/**
 * **Une personne = UN dossier**, même si elle porte deux casquettes dans le
 * centre. Un second POST sur la même personne → 400 explicite.
 */
export function createEmployment(
  centerId: number,
  payload: EmploymentPayload,
): Promise<Employment> {
  return apiFetch(hrm(centerId, 'employments/'), { method: 'POST', body: payload });
}

/** `user` et `center` ne sont PAS modifiables (ce serait un autre dossier). */
export function updateEmployment(
  centerId: number,
  employmentId: number,
  payload: {
    hired_at?: string;
    ended_at?: string | null;
    department?: number | null;
    job_title?: number | null;
  },
): Promise<Employment> {
  return apiFetch(hrm(centerId, `employments/${employmentId}/`), {
    method: 'PATCH',
    body: payload,
  });
}

/* ── feuille de présence : DIRECTEUR SEUL ───────────────────────────────── */

/**
 * Paginé, `-date`. Fenêtre en jours locaux Comores inclusifs : 30 par défaut,
 * **366 au maximum** — un registre du personnel se lit au mois et à l'année,
 * là où l'agenda de rendez-vous borne à 62 jours.
 */
export function listAttendance(
  centerId: number,
  {
    from,
    to,
    employment,
    page = 1,
  }: { from?: string; to?: string; employment?: number; page?: number } = {},
): Promise<Paginated<AttendanceRecord>> {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (employment !== undefined) query.set('employment', String(employment));
  return apiFetch(hrm(centerId, `attendance/?${query.toString()}`));
}

/**
 * **C'est un UPSERT** : re-poster la même (personne, date) CORRIGE la ligne —
 * 201 à la création, 200 à la correction, jamais de doublon. Une feuille
 * papier se corrige ; empiler des lignes de correction aurait fabriqué le
 * registre horodaté que l'ADR refuse d'inventer.
 *
 * Refus attendus, à afficher tels quels : journée dans le futur (« la feuille
 * note ce qui s'est passé »), plus d'un an en arrière, date hors période
 * d'emploi.
 */
export function recordAttendance(
  centerId: number,
  payload: { employment: number; date: string; status: AttendanceStatus },
): Promise<AttendanceRecord> {
  return apiFetch(hrm(centerId, 'attendance/'), { method: 'POST', body: payload });
}

/* ── congés, côté DIRECTEUR ─────────────────────────────────────────────── */

export function listLeaves(
  centerId: number,
  {
    status,
    employment,
    page = 1,
  }: { status?: string; employment?: number; page?: number } = {},
): Promise<Paginated<LeaveRequest>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  if (employment !== undefined) query.set('employment', String(employment));
  return apiFetch(hrm(centerId, `leaves/?${query.toString()}`));
}

export function getLeave(centerId: number, leaveId: number): Promise<LeaveRequest> {
  return apiFetch(hrm(centerId, `leaves/${leaveId}/`));
}

/**
 * Corps VIDE. Deux congés approuvés ne peuvent pas se chevaucher → 400 dont
 * le message est complet : l'afficher tel quel. Deux DEMANDES qui se
 * chevauchent sont normales (on tranche à l'approbation).
 */
export function approveLeave(centerId: number, leaveId: number): Promise<LeaveRequest> {
  return apiFetch(hrm(centerId, `leaves/${leaveId}/approve/`), { method: 'POST' });
}

/**
 * Corps VIDE, et **le refus ne demande aucun motif** : le produit ne stocke
 * aucun texte libre sur le congé de quelqu'un, y compris écrit par le
 * décideur — ici la personne concernée serait l'objet du texte. Un refus
 * s'explique de vive voix (ADR 0020 décision 4).
 */
export function refuseLeave(centerId: number, leaveId: number): Promise<LeaveRequest> {
  return apiFetch(hrm(centerId, `leaves/${leaveId}/refuse/`), { method: 'POST' });
}

/** Le directeur lit les justificatifs des congés qu'il décide. */
export function listLeaveDocuments(
  centerId: number,
  leaveId: number,
): Promise<LeaveDocument[]> {
  return apiFetch(hrm(centerId, `leaves/${leaveId}/documents/`));
}

/** Stockage privé : aucune URL n'existe, le blob passe par l'endpoint authentifié. */
export function downloadLeaveDocument(
  centerId: number,
  leaveId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    hrm(centerId, `leaves/${leaveId}/documents/${documentId}/download/`),
    `justificatif-${documentId}`,
  );
}

/* ── mon dossier : TOUT membre actif, JAMAIS gelé ───────────────────────── */

/**
 * **404 est un état NORMAL** (`{"detail": "Vous n'avez pas encore de dossier
 * RH dans ce centre."}`) : personne n'en a avant que le directeur ne l'ouvre.
 * L'appelant rend un état vide honnête, jamais une erreur rouge.
 */
export function getMyEmployment(centerId: number): Promise<MyEmployment> {
  return apiFetch(hrm(centerId, 'me/'));
}

/** Ses journées, statut RÉEL (`conge` compris — ce sont ses données). Paginé. */
export function listMyAttendance(
  centerId: number,
  { from, to, page = 1 }: { from?: string; to?: string; page?: number } = {},
): Promise<Paginated<MyAttendanceRecord>> {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiFetch(hrm(centerId, `me/attendance/?${query.toString()}`));
}

/** Non paginé. */
export function listMyLeaves(centerId: number): Promise<MyLeaveRequest[]> {
  return apiFetch(hrm(centerId, 'me/leaves/'));
}

/**
 * **Jamais d'`employment` dans le corps** : c'est celui de l'appelant. Un id
 * ouvrirait la porte à une demande au nom d'un collègue — le champ est de
 * toute façon ignoré côté serveur.
 */
export function requestMyLeave(
  centerId: number,
  payload: { leave_type: LeaveType; start_date: string; end_date: string },
): Promise<MyLeaveRequest> {
  return apiFetch(hrm(centerId, 'me/leaves/'), { method: 'POST', body: payload });
}

/** Corps vide, **demande EN ATTENTE seulement** (les trois issues sont terminales). */
export function cancelMyLeave(centerId: number, leaveId: number): Promise<MyLeaveRequest> {
  return apiFetch(hrm(centerId, `me/leaves/${leaveId}/cancel/`), { method: 'POST' });
}

export function listMyLeaveDocuments(
  centerId: number,
  leaveId: number,
): Promise<LeaveDocument[]> {
  return apiFetch(hrm(centerId, `me/leaves/${leaveId}/documents/`));
}

/**
 * Socle ADR 0014 tel quel : JPEG/PNG/WebP RÉELS, 2 Mo, 2048² max, EXIF/GPS
 * strippés, nom remplacé par un uuid — **le PDF est refusé** (différé).
 * Throttle `uploads` 20/h.
 */
export function uploadMyLeaveDocument(
  centerId: number,
  leaveId: number,
  file: File,
): Promise<LeaveDocument> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(hrm(centerId, `me/leaves/${leaveId}/documents/`), {
    method: 'POST',
    body: form,
  });
}

export function downloadMyLeaveDocument(
  centerId: number,
  leaveId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    hrm(centerId, `me/leaves/${leaveId}/documents/${documentId}/download/`),
    `justificatif-${documentId}`,
  );
}

/** Archivage DÉFINITIF : la pièce reste téléchargeable, elle ne se désarchive pas. */
export function archiveMyLeaveDocument(
  centerId: number,
  leaveId: number,
  documentId: number,
): Promise<LeaveDocument> {
  return apiFetch(hrm(centerId, `me/leaves/${leaveId}/documents/${documentId}/archive/`), {
    method: 'POST',
  });
}

/* ── statistiques : DIRECTEUR SEUL, endpoint dédié ──────────────────────── */

/**
 * Série complète et zéro-remplie (une entrée par jour de la fenêtre), 30 j par
 * défaut / 366 max. **Ce n'est ni `stats/activity` ni `stats/finances`** — il
 * n'y a aucune donnée RH dans les payloads de pilotage.
 */
export function getAttendanceStats(
  centerId: number,
  { from, to }: { from?: string; to?: string } = {},
): Promise<AttendanceStats> {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const qs = query.toString();
  return apiFetch(hrm(centerId, `stats/attendance/${qs ? `?${qs}` : ''}`));
}
