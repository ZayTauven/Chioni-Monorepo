/*
 * Chioni — center-space endpoints (contract §Espace centre).
 * Everything is scoped by `/centers/{center_pk}/…` — a foreign center is a 404,
 * a member without the right role is a 403.
 */

import { apiFetch } from '../api';
import type {
  Dispute,
  Encounter,
  GenericCategory,
  HealthCenter,
  Invoice,
  Paginated,
  Patient,
  PaymentRequestStaff,
  Prescription,
  Receipt,
  RecordEntry,
  RecordEntryType,
  Relationship,
  Sex,
  StaffMember,
  StaffRole,
  TariffItem,
} from '../types';

/* ── centers ── */

export function listCenters(): Promise<Paginated<HealthCenter>> {
  return apiFetch('/centers/');
}

export function getCenter(centerId: number): Promise<HealthCenter> {
  return apiFetch(`/centers/${centerId}/`);
}

export function updateCenter(
  centerId: number,
  payload: Partial<Pick<HealthCenter, 'name' | 'type' | 'island' | 'city' | 'address' | 'phone' | 'email'>>,
): Promise<HealthCenter> {
  return apiFetch(`/centers/${centerId}/`, { method: 'PATCH', body: payload });
}

/* ── patients ── */

export interface CenterPatientPayload {
  first_name: string;
  last_name: string;
  birth_date?: string;
  sex?: Sex;
  phone?: string;
  city?: string;
  /** Porte C — optional guardian invitation at desk-creation time (write-only). */
  guardian_phone?: string;
  guardian_relationship?: Relationship;
}

export function listPatients(
  centerId: number,
  { q, page = 1 }: { q?: string; page?: number } = {},
): Promise<Paginated<Patient>> {
  const query = new URLSearchParams({ page: String(page) });
  if (q) query.set('q', q);
  return apiFetch(`/centers/${centerId}/patients/?${query.toString()}`);
}

export function createPatient(centerId: number, payload: CenterPatientPayload): Promise<Patient> {
  return apiFetch(`/centers/${centerId}/patients/`, { method: 'POST', body: payload });
}

export function mergePatients(
  centerId: number,
  sourceId: number,
  targetId: number,
): Promise<Patient> {
  return apiFetch(`/centers/${centerId}/patients/merge/`, {
    method: 'POST',
    body: { source_id: sourceId, target_id: targetId },
  });
}

/* ── encounters ── */

export interface EncounterPayload {
  patient: number;
  reason: string;
  diagnosis?: string;
  occurred_at?: string;
  tariff_items?: number[];
}

export function listEncounters(centerId: number, page = 1): Promise<Paginated<Encounter>> {
  return apiFetch(`/centers/${centerId}/encounters/?page=${page}`);
}

export function getEncounter(centerId: number, encounterId: number): Promise<Encounter> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/`);
}

export function createEncounter(centerId: number, payload: EncounterPayload): Promise<Encounter> {
  return apiFetch(`/centers/${centerId}/encounters/`, { method: 'POST', body: payload });
}

/* ── prescriptions & record entries (NOT paginated — bare arrays) ── */

export function listEncounterPrescriptions(
  centerId: number,
  encounterId: number,
): Promise<Prescription[]> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/prescriptions/`);
}

export function createPrescription(
  centerId: number,
  encounterId: number,
  items: Array<{ medication: string; dosage: string }>,
): Promise<Prescription> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/prescriptions/`, {
    method: 'POST',
    body: { items },
  });
}

export function listEncounterRecordEntries(
  centerId: number,
  encounterId: number,
): Promise<RecordEntry[]> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/record-entries/`);
}

export function createRecordEntry(
  centerId: number,
  encounterId: number,
  payload: { entry_type: RecordEntryType; content: string },
): Promise<RecordEntry> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/record-entries/`, {
    method: 'POST',
    body: payload,
  });
}

/* ── invoices ── */

export function listInvoices(centerId: number, page = 1): Promise<Paginated<Invoice>> {
  return apiFetch(`/centers/${centerId}/invoices/?page=${page}`);
}

export function getInvoice(centerId: number, invoiceId: number): Promise<Invoice> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/`);
}

export function createInvoice(
  centerId: number,
  payload: { encounter: number; act_ids?: number[] },
): Promise<Invoice> {
  return apiFetch(`/centers/${centerId}/invoices/`, { method: 'POST', body: payload });
}

export function issueInvoice(centerId: number, invoiceId: number): Promise<Invoice> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/issue/`, { method: 'POST' });
}

/* ── payment requests ── */

export function createPaymentRequest(
  centerId: number,
  invoiceId: number,
): Promise<PaymentRequestStaff> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/payment-requests/`, {
    method: 'POST',
  });
}

export function listPaymentRequests(
  centerId: number,
  page = 1,
): Promise<Paginated<PaymentRequestStaff>> {
  return apiFetch(`/centers/${centerId}/payment-requests/?page=${page}`);
}

export function getPaymentRequest(centerId: number, id: number): Promise<PaymentRequestStaff> {
  return apiFetch(`/centers/${centerId}/payment-requests/${id}/`);
}

export function sharePaymentRequest(
  centerId: number,
  id: number,
  guardianLinkId: number,
): Promise<PaymentRequestStaff> {
  return apiFetch(`/centers/${centerId}/payment-requests/${id}/share/`, {
    method: 'POST',
    body: { guardian_link: guardianLinkId },
  });
}

export function unsharePaymentRequest(
  centerId: number,
  id: number,
  guardianLinkId: number,
): Promise<PaymentRequestStaff> {
  return apiFetch(`/centers/${centerId}/payment-requests/${id}/unshare/`, {
    method: 'POST',
    body: { guardian_link: guardianLinkId },
  });
}

export function sendPaymentRequest(centerId: number, id: number): Promise<PaymentRequestStaff> {
  return apiFetch(`/centers/${centerId}/payment-requests/${id}/send/`, { method: 'POST' });
}

/** Care-roles only. */
export function confirmCare(centerId: number, id: number): Promise<PaymentRequestStaff> {
  return apiFetch(`/centers/${centerId}/payment-requests/${id}/confirm-care/`, { method: 'POST' });
}

/** Close → 201 with the receipt. */
export function closePaymentRequest(centerId: number, id: number): Promise<Receipt> {
  return apiFetch(`/centers/${centerId}/payment-requests/${id}/close/`, { method: 'POST' });
}

/* ── disputes ── */

export function listDisputes(centerId: number, page = 1): Promise<Paginated<Dispute>> {
  return apiFetch(`/centers/${centerId}/disputes/?page=${page}`);
}

/** Director only. */
export function resolveDispute(
  centerId: number,
  disputeId: number,
  resolutionNote: string,
): Promise<Dispute> {
  return apiFetch(`/centers/${centerId}/disputes/${disputeId}/resolve/`, {
    method: 'POST',
    body: { resolution_note: resolutionNote },
  });
}

/* ── staff (director only) ── */

export interface StaffPayload {
  phone: string;
  role: StaffRole;
  first_name?: string;
  last_name?: string;
}

export function listStaff(centerId: number, page = 1): Promise<Paginated<StaffMember>> {
  return apiFetch(`/centers/${centerId}/staff/?page=${page}`);
}

export function createStaff(centerId: number, payload: StaffPayload): Promise<StaffMember> {
  return apiFetch(`/centers/${centerId}/staff/`, { method: 'POST', body: payload });
}

export function deactivateStaff(centerId: number, staffId: number): Promise<StaffMember> {
  return apiFetch(`/centers/${centerId}/staff/${staffId}/deactivate/`, { method: 'POST' });
}

/* ── tariffs (director, cashier) ── */

export interface TariffPayload {
  code: string;
  label: string;
  generic_category: GenericCategory;
  price_kmf: string;
  is_active?: boolean;
}

export function listTariffs(centerId: number, page = 1): Promise<Paginated<TariffItem>> {
  return apiFetch(`/centers/${centerId}/tariffs/?page=${page}`);
}

export function createTariff(centerId: number, payload: TariffPayload): Promise<TariffItem> {
  return apiFetch(`/centers/${centerId}/tariffs/`, { method: 'POST', body: payload });
}

export function updateTariff(
  centerId: number,
  tariffId: number,
  payload: Partial<TariffPayload>,
): Promise<TariffItem> {
  return apiFetch(`/centers/${centerId}/tariffs/${tariffId}/`, { method: 'PATCH', body: payload });
}
