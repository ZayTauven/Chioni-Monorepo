/*
 * Chioni — patient-space endpoints (contract §Espace patient).
 * All routes require the caller to be the claimed patient (IsPatientSelf).
 */

import { apiDownload, apiFetch } from '../api';
import type {
  Encounter,
  GuardianLinkPatient,
  Paginated,
  PatientAppointment,
  PatientCashReceipt,
  PatientDocumentMine,
  PatientInsurance,
  PatientMe,
  PatientMedicalFile,
  PatientStay,
  PatientVitalSigns,
  PaymentRequestPatient,
  Prescription,
  Receipt,
  RecordEntry,
  Relationship,
  Sex,
} from '../types';

/* ── profile ── */

export interface PatientMePayload {
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  sex?: Sex;
  city?: string;
  /* S3 — extended identity, all optional ('' clears a field). The two phone
     fields are normalised E.164 server-side (invalid → 400 per field). */
  address?: string;
  phone_alt?: string;
  national_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

export function getPatientMe(): Promise<PatientMe> {
  return apiFetch('/patients/me/');
}

/** Porte B — self-created patient profile (201). */
export function createPatientMe(payload: PatientMePayload): Promise<PatientMe> {
  return apiFetch('/patients/me/', { method: 'POST', body: payload });
}

export function updatePatientMe(payload: Partial<PatientMePayload>): Promise<PatientMe> {
  return apiFetch('/patients/me/', { method: 'PATCH', body: payload });
}

/* ── guardianship (the ethical core) ── */

export function listGuardians(page = 1): Promise<Paginated<GuardianLinkPatient>> {
  return apiFetch(`/patients/me/guardians/?page=${page}`);
}

/**
 * Aggregate the FULL guardian-link history across pages. The claimant
 * confirmation gate must never miss a pending link hidden on a later page,
 * and the screens need the full set to tell actives / invitations / revoked
 * apart — so we follow `next` to the end, no cap.
 */
export async function listAllGuardians(): Promise<GuardianLinkPatient[]> {
  const all: GuardianLinkPatient[] = [];
  let page = 1;
  for (;;) {
    const batch = await listGuardians(page);
    all.push(...batch.results);
    if (!batch.next) break;
    page += 1;
  }
  return all;
}

export function inviteGuardian(
  phone: string,
  relationship: Relationship,
): Promise<GuardianLinkPatient> {
  return apiFetch('/patients/me/guardians/invite/', {
    method: 'POST',
    body: { phone, relationship },
  });
}

/** The claimant-confirmation gate (ADR 0010) — activates the link. */
export function confirmGuardianLink(linkId: number): Promise<GuardianLinkPatient> {
  return apiFetch(`/patients/me/guardians/${linkId}/confirm/`, { method: 'POST' });
}

/** Definitive refusal — the link becomes `revoque` (final). */
export function declineGuardianLink(linkId: number): Promise<GuardianLinkPatient> {
  return apiFetch(`/patients/me/guardians/${linkId}/decline/`, { method: 'POST' });
}

export function revokeGuardianLink(linkId: number): Promise<GuardianLinkPatient> {
  return apiFetch(`/patients/me/guardians/${linkId}/revoke/`, { method: 'POST' });
}

/** Grant the `detail_clinique` scope — returns the link with updated scopes. */
export function grantClinicalConsent(linkId: number): Promise<GuardianLinkPatient> {
  return apiFetch(`/patients/me/guardians/${linkId}/consents/clinical/`, { method: 'POST' });
}

export function revokeClinicalConsent(linkId: number): Promise<GuardianLinkPatient> {
  return apiFetch(`/patients/me/guardians/${linkId}/consents/clinical/`, { method: 'DELETE' });
}

/* ── appointments (S2 — read + cancel; the desk books, never the patient) ── */

/**
 * My appointments, cross-center, `scheduled_at` desc. `upcoming: true` keeps
 * only appointments still `prevu` AND in the future (the « à venir » widget);
 * omitted = full history (the contract's `upcoming=false`).
 */
export function listMyAppointments({
  page = 1,
  upcoming = false,
}: { page?: number; upcoming?: boolean } = {}): Promise<Paginated<PatientAppointment>> {
  const query = new URLSearchParams({ page: String(page) });
  if (upcoming) query.set('upcoming', 'true');
  return apiFetch(`/patients/me/appointments/?${query.toString()}`);
}

/**
 * Cancel MY appointment — only while `prevu`: any other status answers
 * 400 `["Seul un rendez-vous encore prévu peut être annulé."]` (shown as-is).
 */
export function cancelMyAppointment(id: number): Promise<PatientAppointment> {
  return apiFetch(`/patients/me/appointments/${id}/cancel/`, { method: 'POST' });
}

/* ── health record ── */

export function listEncounters(page = 1): Promise<Paginated<Encounter>> {
  return apiFetch(`/patients/me/encounters/?page=${page}`);
}

export function listPrescriptions(page = 1): Promise<Paginated<Prescription>> {
  return apiFetch(`/patients/me/prescriptions/?page=${page}`);
}

export function listRecordEntries(page = 1): Promise<Paginated<RecordEntry>> {
  return apiFetch(`/patients/me/record-entries/?page=${page}`);
}

/* ── S3 — enriched record, patient side (read-only, cross-center) ── */

/**
 * My medical file — constant empty shape (`updated_at: null`) before the
 * first clinical write, never a 404. Writing is a clinical gesture.
 */
export function getMyMedicalFile(): Promise<PatientMedicalFile> {
  return apiFetch('/patients/me/medical-file/');
}

/** My vital signs, all centers, sorted `-measured_at` (no staff internals). */
export function listMyVitalSigns(page = 1): Promise<Paginated<PatientVitalSigns>> {
  return apiFetch(`/patients/me/vital-signs/?page=${page}`);
}

/** My documents (photos of results/reports), all centers, ARCHIVED EXCLUDED. */
export function listMyDocuments(page = 1): Promise<Paginated<PatientDocumentMine>> {
  return apiFetch(`/patients/me/documents/?page=${page}`);
}

/**
 * Download one of my documents through the authenticated endpoint (never a
 * static /media/ URL). Archived or someone else's → 404.
 */
export function downloadMyDocument(id: number): Promise<void> {
  return apiDownload(`/patients/me/documents/${id}/download/`, `document-${id}`);
}

/** My insurance/mutual lines — read-only here (desk-entered, billing data). */
export function listMyInsurances(page = 1): Promise<Paginated<PatientInsurance>> {
  return apiFetch(`/patients/me/insurances/?page=${page}`);
}

/* ── S6 — mes hospitalisations (ADR 0019 §5, lecture seule, tous centres) ── */

/**
 * Mes séjours, triés du plus récent au plus ancien. Payload court par
 * conception : centre, dates, statut et l'id de la consultation PIVOT — **ni
 * lit, ni priorité, ni motif d'annulation**. L'histoire clinique du séjour se
 * lit sur cette consultation, déjà rendue en entier par `listEncounters`.
 */
export function listMyStays(page = 1): Promise<Paginated<PatientStay>> {
  return apiFetch(`/patients/me/stays/?page=${page}`);
}

/* ── money (patient side) ── */

export function listPaymentRequests(page = 1): Promise<Paginated<PaymentRequestPatient>> {
  return apiFetch(`/patients/me/payment-requests/?page=${page}`);
}

export function getPaymentRequest(id: number): Promise<PaymentRequestPatient> {
  return apiFetch(`/patients/me/payment-requests/${id}/`);
}

export function sharePaymentRequest(
  id: number,
  guardianLinkId: number,
): Promise<PaymentRequestPatient> {
  return apiFetch(`/patients/me/payment-requests/${id}/share/`, {
    method: 'POST',
    body: { guardian_link: guardianLinkId },
  });
}

/** Only possible after payment — the mission indicator. */
export function acknowledgePaymentRequest(id: number): Promise<PaymentRequestPatient> {
  return apiFetch(`/patients/me/payment-requests/${id}/acknowledge/`, { method: 'POST' });
}

export function disputePaymentRequest(id: number, reason: string): Promise<PaymentRequestPatient> {
  return apiFetch(`/patients/me/payment-requests/${id}/dispute/`, {
    method: 'POST',
    body: { reason },
  });
}

export function listReceipts(page = 1): Promise<Paginated<Receipt>> {
  return apiFetch(`/patients/me/receipts/?page=${page}`);
}

/**
 * The patient's counter receipts (pure KMF, all centers). Guardians NEVER see
 * these — their `paiements` scope covers shared payment requests only.
 */
export function listCashReceipts(page = 1): Promise<Paginated<PatientCashReceipt>> {
  return apiFetch(`/patients/me/cash-receipts/?page=${page}`);
}
