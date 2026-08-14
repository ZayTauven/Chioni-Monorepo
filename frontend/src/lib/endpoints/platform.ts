/*
 * Chioni — endpoints of the PLATFORM space (back-office Chioni, S4/ADR 0017).
 *
 * Single gate: `platform_staff !== null` in /auth/me/. Anonymous → 401 ;
 * authenticated without the operator hat (a Django superuser included) →
 * 403 « Réservé à l'équipe Chioni. » ; a `support` on a write route → 403
 * « Cette action est réservée aux administrateurs… ».
 *
 * INVARIANT of the sprint, and the reason no patient type is imported here:
 * NO /platform/ route ever returns a patient — not a name, not a phone, not
 * a birth date, nothing clinical. The operator's perimeter is the TENANT.
 * Never build a platform screen that pretends to show a patient record: the
 * data does not exist in these payloads (locked by a backend negative test).
 */

import { apiDownload, apiFetch } from '../api';
import type {
  CenterType,
  ErasureDecision,
  ErasureStatus,
  IncidentCode,
  Island,
  KycDocument,
  KycStatus,
  Paginated,
  PlatformCenter,
  PlatformCenterCreated,
  PlatformErasureRequest,
  PlatformMembership,
  ReconciliationIncident,
} from '../types';

/* ── centres (tenants) ── */

export interface PlatformCenterQuery {
  q?: string;
  kyc_status?: KycStatus;
  page?: number;
}

/** Every center of the platform, paginated. `q` matches name or city. */
export function listPlatformCenters({
  q,
  kyc_status,
  page = 1,
}: PlatformCenterQuery = {}): Promise<Paginated<PlatformCenter>> {
  const query = new URLSearchParams({ page: String(page) });
  if (q) query.set('q', q);
  if (kyc_status) query.set('kyc_status', kyc_status);
  return apiFetch(`/platform/centers/?${query.toString()}`);
}

export function getPlatformCenter(centerId: number): Promise<PlatformCenter> {
  return apiFetch(`/platform/centers/${centerId}/`);
}

export interface SimilarCentersQuery {
  name?: string;
  city?: string;
  island?: Island;
}

/**
 * Look-alike centers — NON-blocking by design (mirror of the patient porte C
 * of S3): no uniqueness constraint exists on a center name, two « Clinique
 * El-Maarouf » may legitimately coexist on two islands. Inform, never block.
 * No usable criterion (empty name AND city) → 400 : callers debounce and
 * swallow that case rather than shout at a half-typed field.
 */
export function listSimilarCenters({
  name,
  city,
  island,
}: SimilarCentersQuery): Promise<Paginated<PlatformCenter>> {
  const query = new URLSearchParams();
  if (name) query.set('name', name);
  if (city) query.set('city', city);
  if (island) query.set('island', island);
  return apiFetch(`/platform/centers/similar/?${query.toString()}`);
}

export interface PlatformCenterPayload {
  name: string;
  type: CenterType;
  island: Island;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  /** The first director is referenced by PHONE — a shadow account claimed by OTP. */
  director_phone: string;
  director_first_name?: string;
  director_last_name?: string;
}

/**
 * Onboarding (role `admin`): the center AND its first director in ONE
 * transaction. The center is ALWAYS born `en_attente` (a submitted
 * `kyc_status` is ignored). An invalid phone → 400 and NOTHING is created —
 * never an orphan center.
 */
export function createPlatformCenter(
  payload: PlatformCenterPayload,
): Promise<PlatformCenterCreated> {
  return apiFetch('/platform/centers/', { method: 'POST', body: payload });
}

export interface DirectorPayload {
  phone: string;
  first_name?: string;
  last_name?: string;
}

/** Bootstrap a director on a center that has none (accident, departure). */
export function createPlatformDirector(
  centerId: number,
  payload: DirectorPayload,
): Promise<PlatformMembership> {
  return apiFetch(`/platform/centers/${centerId}/directors/`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * KYC transition (role `admin`). State machine:
 * `en_attente → actif|suspendu`, `actif → suspendu`, `suspendu → actif`.
 * `reason` is MANDATORY for a suspension (400 otherwise) and is stored as the
 * motive of the LAST decision — read by the platform and by the DIRECTOR of
 * that center only, never by a patient nor a guardian.
 */
export function setPlatformCenterKyc(
  centerId: number,
  status: KycStatus,
  reason?: string,
): Promise<PlatformCenter> {
  return apiFetch(`/platform/centers/${centerId}/kyc/`, {
    method: 'POST',
    body: { status, reason: reason ?? '' },
  });
}

/* ── pièces justificatives du KYC (lecture plateforme) ── */

export function listPlatformKycDocuments(
  centerId: number,
  page = 1,
): Promise<Paginated<KycDocument>> {
  return apiFetch(`/platform/centers/${centerId}/kyc-documents/?page=${page}`);
}

/** Authenticated binary download — the private storage has no public URL. */
export function downloadPlatformKycDocument(
  centerId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    `/platform/centers/${centerId}/kyc-documents/${documentId}/download/`,
    `kyc-${documentId}`,
  );
}

/* ── réconciliation PSP ── */

export interface ReconciliationQuery {
  from?: string;
  to?: string;
  reason?: IncidentCode;
  center?: number;
  page?: number;
}

/**
 * Payment incidents, most recent first (read: `support` AND `admin`).
 * Window contract identical to the stats: inclusive local Comoros days,
 * 30 by default, 366 max. An unknown `?center=` id yields an EMPTY page,
 * not a 404 — the platform's perimeter is every center.
 */
export function listReconciliation({
  from,
  to,
  reason,
  center,
  page = 1,
}: ReconciliationQuery = {}): Promise<Paginated<ReconciliationIncident>> {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (reason) query.set('reason', reason);
  if (center !== undefined) query.set('center', String(center));
  return apiFetch(`/platform/reconciliation/?${query.toString()}`);
}

/* ── file RGPD ── */

/** Read: `support` and `admin` (answering « où en est ma demande ? »). */
export function listErasureRequests(
  status?: ErasureStatus,
  page = 1,
): Promise<Paginated<PlatformErasureRequest>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  return apiFetch(`/platform/erasure-requests/?${query.toString()}`);
}

/**
 * Execute the decision — role `admin` ONLY (anonymisation is irreversible,
 * a refusal is a legal act). `refuser` requires a non-empty
 * `refusal_reason`, which is then READ BY THE PERSON in their own space.
 * `anonymiser` on a blocked request → 400 with the French sentences, and the
 * request STAYS `en_attente` (the person must not have to ask again).
 */
export function processErasureRequest(
  requestId: number,
  decision: ErasureDecision,
  refusalReason?: string,
): Promise<PlatformErasureRequest> {
  return apiFetch(`/platform/erasure-requests/${requestId}/process/`, {
    method: 'POST',
    body: { decision, refusal_reason: refusalReason ?? '' },
  });
}
