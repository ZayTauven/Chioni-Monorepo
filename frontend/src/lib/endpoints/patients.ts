/*
 * Chioni — patient-space endpoints (contract §Espace patient).
 * All routes require the caller to be the claimed patient (IsPatientSelf).
 */

import { apiFetch } from '../api';
import type {
  Encounter,
  GuardianLinkPatient,
  Paginated,
  PatientCashReceipt,
  PatientMe,
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
