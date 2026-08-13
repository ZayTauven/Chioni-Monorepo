/*
 * Chioni — center-space endpoints (contract §Espace centre).
 * Everything is scoped by `/centers/{center_pk}/…` — a foreign center is a 404,
 * a member without the right role is a 403.
 */

import { apiFetch } from '../api';
import type {
  ActivityStats,
  Appointment,
  AppointmentStatus,
  AppointmentWithOverlaps,
  CashJournal,
  CashMethod,
  CashPayment,
  Dispute,
  EncounterAct,
  EncounterStatus,
  FinanceStats,
  GenericCategory,
  GuardianLinkCenter,
  HealthCenter,
  Invoice,
  InvoiceStatus,
  MobileMoneyOperator,
  Paginated,
  Patient,
  PaymentRequestStaff,
  Practitioner,
  Prescription,
  Receipt,
  RecordEntry,
  RecordEntryType,
  Relationship,
  Sex,
  StaffMember,
  StaffRole,
  TariffItem,
  UnpaidInvoice,
  UnpaidOrdering,
} from '../types';

/**
 * Staff-side encounter (serializers `EncounterClinicalSerializer` /
 * `EncounterAdminSerializer`, backend R-API-1) : `reason` and `diagnosis`
 * are ABSENT for administrative roles — the UI must render both cases.
 * Differs from the patient-side `Encounter` of types.ts (no center fields,
 * patient as id, practitioner included).
 */
export interface EncounterStaff {
  id: number;
  patient: number;
  practitioner: number;
  practitioner_name: string;
  occurred_at: string;
  /** Absent pour les rôles administratifs (vue exploitation). */
  reason?: string;
  /** Absent pour les rôles administratifs (vue exploitation). */
  diagnosis?: string;
  status: EncounterStatus;
  acts: EncounterAct[];
  created_at: string;
}

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

/* ── center logo (director only — multipart, never via the JSON PATCH) ── */

/** JPEG/PNG/WebP réels, 2 Mo max, 2048×2048 max — the backend re-validates. */
export function uploadCenterLogo(centerId: number, file: File): Promise<{ logo: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/centers/${centerId}/logo/`, { method: 'POST', body: form });
}

/** 400 when there is no logo; the old file is physically deleted. */
export function deleteCenterLogo(centerId: number): Promise<{ logo: null }> {
  return apiFetch(`/centers/${centerId}/logo/`, { method: 'DELETE' });
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

export function getPatient(centerId: number, patientId: number): Promise<Patient> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/`);
}

/**
 * PATCH identity fields — the backend answers 400 (« Ce profil est géré par
 * le patient… ») when the profile is claimed and the caller is not its owner.
 */
export function updatePatient(
  centerId: number,
  patientId: number,
  payload: Partial<Pick<Patient, 'first_name' | 'last_name' | 'birth_date' | 'sex' | 'phone' | 'city'>>,
): Promise<Patient> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/`, { method: 'PATCH', body: payload });
}

/**
 * ACTIVE guardian links of a patient — desk-share routing (BILLING roles only,
 * patient outside the center's perimeter → 404). Administrative minimum:
 * `{id, guardian_name, relationship}`, never a phone/scopes/history. The `id`
 * feeds `sharePaymentRequest()` — the case of the patient without a smartphone
 * who designates their guardian at the desk.
 */
export function listPatientGuardianLinks(
  centerId: number,
  patientId: number,
  page = 1,
): Promise<Paginated<GuardianLinkCenter>> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/guardian-links/?page=${page}`);
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

/* ── practitioners directory (S1 — the appointment/encounter selector) ── */

/**
 * Every active staff member may read it. Bare NON-paginated array of ACTIVE
 * clinical memberships — a practitioner hired yesterday shows up (no more
 * falling back on `stats/activity`).
 */
export function listPractitioners(centerId: number): Promise<Practitioner[]> {
  return apiFetch(`/centers/${centerId}/practitioners/`);
}

/* ── encounters ── */

export interface EncounterPayload {
  patient: number;
  reason: string;
  diagnosis?: string;
  occurred_at?: string;
  tariff_items?: number[];
}

export interface EncounterFilters {
  page?: number;
  /** Patient id — foreign/unknown id yields an empty list. */
  patient?: number;
  /** "YYYY-MM-DD" — Comoros local day of `occurred_at`. */
  date?: string;
  /** StaffMembership id. */
  practitioner?: number;
}

export function listEncounters(
  centerId: number,
  { page = 1, patient, date, practitioner }: EncounterFilters = {},
): Promise<Paginated<EncounterStaff>> {
  const query = new URLSearchParams({ page: String(page) });
  if (patient !== undefined) query.set('patient', String(patient));
  if (date) query.set('date', date);
  if (practitioner !== undefined) query.set('practitioner', String(practitioner));
  return apiFetch(`/centers/${centerId}/encounters/?${query.toString()}`);
}

export function getEncounter(centerId: number, encounterId: number): Promise<EncounterStaff> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/`);
}

export function createEncounter(centerId: number, payload: EncounterPayload): Promise<EncounterStaff> {
  return apiFetch(`/centers/${centerId}/encounters/`, { method: 'POST', body: payload });
}

/**
 * Close an encounter (S1) — clinical roles ONLY (a non-clinician director gets
 * a 403). A closed encounter refuses new prescriptions/record entries;
 * invoicing stays possible. Already closed → 400.
 */
export function closeEncounter(centerId: number, encounterId: number): Promise<EncounterStaff> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/close/`, { method: 'POST' });
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

/* ── appointments (day queue — every active staff member) ── */

export interface AppointmentFilters {
  /** "YYYY-MM-DD" — defaults to TODAY (Comoros local day) server-side. */
  date?: string;
  /** StaffMembership id. */
  practitioner?: number;
  status?: AppointmentStatus;
  page?: number;
}

export function listAppointments(
  centerId: number,
  { date, practitioner, status, page = 1 }: AppointmentFilters = {},
): Promise<Paginated<Appointment>> {
  const query = new URLSearchParams({ page: String(page) });
  if (date) query.set('date', date);
  if (practitioner !== undefined) query.set('practitioner', String(practitioner));
  if (status) query.set('status', status);
  return apiFetch(`/centers/${centerId}/appointments/?${query.toString()}`);
}

/**
 * Range listing (S1 — the calendar grid). Both bounds are REQUIRED together,
 * inclusive Comoros local days, max 62 days, exclusive of `?date=`. Paginated,
 * same item, sorted by `scheduled_at`.
 */
export function listAppointmentsRange(
  centerId: number,
  { from, to, page = 1 }: { from: string; to: string; page?: number },
): Promise<Paginated<Appointment>> {
  const query = new URLSearchParams({ from, to, page: String(page) });
  return apiFetch(`/centers/${centerId}/appointments/?${query.toString()}`);
}

export interface AppointmentCreatePayload {
  patient: number;
  scheduled_at: string;
  /** 5–480, defaults to 20 server-side. */
  duration_minutes?: number;
  /** Null/absent = « rendez-vous avec le centre ». */
  practitioner?: number | null;
  reason?: string;
}

/** 201 — `overlaps` non-empty is a NON-blocking warning (the desk decides). */
export function createAppointment(
  centerId: number,
  payload: AppointmentCreatePayload,
): Promise<AppointmentWithOverlaps> {
  return apiFetch(`/centers/${centerId}/appointments/`, { method: 'POST', body: payload });
}

export function getAppointment(centerId: number, id: number): Promise<Appointment> {
  return apiFetch(`/centers/${centerId}/appointments/${id}/`);
}

export interface AppointmentUpdatePayload {
  scheduled_at?: string;
  duration_minutes?: number;
  /** `null` explicitly detaches the practitioner. */
  practitioner?: number | null;
  reason?: string;
}

/** Move/edit — `prevu` only (400 otherwise). Re-arms the J-1 reminder. */
export function updateAppointment(
  centerId: number,
  id: number,
  payload: AppointmentUpdatePayload,
): Promise<AppointmentWithOverlaps> {
  return apiFetch(`/centers/${centerId}/appointments/${id}/`, { method: 'PATCH', body: payload });
}

function appointmentAction(centerId: number, id: number, action: string): Promise<Appointment> {
  return apiFetch(`/centers/${centerId}/appointments/${id}/${action}/`, { method: 'POST' });
}

/** → `arrive`. */
export function checkInAppointment(centerId: number, id: number): Promise<Appointment> {
  return appointmentAction(centerId, id, 'check-in');
}

/** → `annule` (from `prevu` or `arrive`). */
export function cancelAppointment(centerId: number, id: number): Promise<Appointment> {
  return appointmentAction(centerId, id, 'cancel');
}

/** → `manque` (from `prevu`). */
export function noShowAppointment(centerId: number, id: number): Promise<Appointment> {
  return appointmentAction(centerId, id, 'no-show');
}

/** → `honore` (requires `arrive`). */
export function honorAppointment(centerId: number, id: number): Promise<Appointment> {
  return appointmentAction(centerId, id, 'honor');
}

/* ── invoices ── */

export interface InvoiceFilters {
  page?: number;
  /** Patient id — foreign/unknown id yields an empty list. */
  patient?: number;
  status?: InvoiceStatus;
}

export function listInvoices(
  centerId: number,
  { page = 1, patient, status }: InvoiceFilters = {},
): Promise<Paginated<Invoice>> {
  const query = new URLSearchParams({ page: String(page) });
  if (patient !== undefined) query.set('patient', String(patient));
  if (status) query.set('status', status);
  return apiFetch(`/centers/${centerId}/invoices/?${query.toString()}`);
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

/**
 * Cancel an invoice (S1) — BILLING roles, reason MANDATORY. Explicit 400s from
 * the backend (settled invoice, active cash-in, linked request paid/closed,
 * diaspora payment in flight…) are shown as-is. The acts become invoicable
 * again; a request still `envoyee` will answer 400 on quote/pay.
 */
export function cancelInvoice(centerId: number, invoiceId: number, reason: string): Promise<Invoice> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/cancel/`, {
    method: 'POST',
    body: { reason },
  });
}

/* ── caisse (ADR 0015 — BILLING roles) ── */

export function listInvoicePayments(
  centerId: number,
  invoiceId: number,
  page = 1,
): Promise<Paginated<CashPayment>> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/payments/?page=${page}`);
}

export interface CashPaymentPayload {
  /** `pont_confiance` is REFUSED at the desk (webhook only). */
  method: Exclude<CashMethod, 'pont_confiance'>;
  /** WHOLE KMF (decimals → 400). Sent as a string. */
  amount_kmf: string;
  /** Required by the backend when method is mobile money. */
  operator?: MobileMoneyOperator;
  reference?: string;
  /**
   * S1 idempotence — one UUID per cash-in ATTEMPT (≤ 64 chars, unique per
   * center). Replaying the same key returns 200 with the SAME payment and the
   * SAME receipt (never a double debit on timeout/double-click); same key with
   * different parameters → explicit 400.
   */
  idempotency_key?: string;
}

/** 201 with the counter receipt embedded. Never exceeds the remaining balance. */
export function createInvoicePayment(
  centerId: number,
  invoiceId: number,
  payload: CashPaymentPayload,
): Promise<CashPayment> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/payments/`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Corrective entry — NEVER a deletion: one reversal max per cash-in, reason
 * mandatory, `pont_confiance` never reversible at the desk (→ dispute).
 */
export function reverseInvoicePayment(
  centerId: number,
  invoiceId: number,
  paymentId: number,
  reason: string,
): Promise<CashPayment> {
  return apiFetch(`/centers/${centerId}/invoices/${invoiceId}/payments/${paymentId}/reverse/`, {
    method: 'POST',
    body: { reason },
  });
}

/** Day journal — `date` defaults to today (Comoros local day) server-side. */
export function getCashJournal(centerId: number, date?: string): Promise<CashJournal> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch(`/centers/${centerId}/cash-journal/${query}`);
}

/** Issued invoices with balance > 0 — the raw material of future reminders. */
export function listUnpaidInvoices(
  centerId: number,
  { ordering = '-balance', page = 1 }: { ordering?: UnpaidOrdering; page?: number } = {},
): Promise<Paginated<UnpaidInvoice>> {
  const query = new URLSearchParams({ page: String(page), ordering });
  return apiFetch(`/centers/${centerId}/invoices/unpaid/?${query.toString()}`);
}

/* ── pilotage (vague 2b — read-only stats) ── */

export interface StatsWindow {
  /** "YYYY-MM-DD" — defaults: to = today, from = to − 29 j (max 366 j). */
  from?: string;
  to?: string;
}

function statsQuery({ from, to }: StatsWindow): string {
  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  const s = query.toString();
  return s ? `?${s}` : '';
}

/** Every active staff member. */
export function getActivityStats(centerId: number, window: StatsWindow = {}): Promise<ActivityStats> {
  return apiFetch(`/centers/${centerId}/stats/activity/${statsQuery(window)}`);
}

/** BILLING roles only — clinical roles get a 403 (exploitation view). */
export function getFinanceStats(centerId: number, window: StatsWindow = {}): Promise<FinanceStats> {
  return apiFetch(`/centers/${centerId}/stats/finances/${statsQuery(window)}`);
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

/** S1 — deactivation is no longer irreversible. Already active → 400. */
export function reactivateStaff(centerId: number, staffId: number): Promise<StaffMember> {
  return apiFetch(`/centers/${centerId}/staff/${staffId}/reactivate/`, { method: 'POST' });
}

export interface StaffUpdatePayload {
  role?: StaffRole;
  /** Writable ONLY while the account is a never-claimed shadow account. */
  first_name?: string;
  last_name?: string;
}

/**
 * Director only. Explicit 400s: inactive membership, role already held,
 * demotion of the last active director, activated account (identity is then
 * the person's own via PATCH /auth/me/).
 */
export function updateStaff(
  centerId: number,
  staffId: number,
  payload: StaffUpdatePayload,
): Promise<StaffMember> {
  return apiFetch(`/centers/${centerId}/staff/${staffId}/`, { method: 'PATCH', body: payload });
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
