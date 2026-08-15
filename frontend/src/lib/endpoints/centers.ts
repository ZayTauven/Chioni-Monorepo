/*
 * Chioni — center-space endpoints (contract §Espace centre).
 * Everything is scoped by `/centers/{center_pk}/…` — a foreign center is a 404,
 * a member without the right role is a 403.
 */

import { apiDownload, apiFetch } from '../api';
import type {
  ActivityStats,
  Appointment,
  AppointmentStatus,
  AppointmentWithOverlaps,
  AuditAction,
  AuditLogPage,
  Bed,
  BedAssignment,
  CashJournal,
  CashMethod,
  CashPayment,
  CenterSubscription,
  CenterSubscriptionInvoice,
  ConsentCollectedVia,
  DeskClinicalConsent,
  Dispute,
  EncounterAct,
  EncounterStatus,
  FinanceStats,
  GenericCategory,
  GuardianLinkCenter,
  HealthCenter,
  Invoice,
  InvoiceStatus,
  KycDocType,
  KycDocument,
  MobileMoneyOperator,
  OccupancyRoom,
  Paginated,
  Patient,
  PatientDocumentStaff,
  PatientDocumentType,
  PatientInsurance,
  PatientMedicalFile,
  PaymentRequestStaff,
  Practitioner,
  Prescription,
  Receipt,
  RecordEntry,
  RecordEntryType,
  Relationship,
  Room,
  Sex,
  StaffMember,
  StaffRole,
  Stay,
  StayPriority,
  StayStatus,
  SubscriptionInvoiceStatus,
  SupportAttachment,
  SupportCategory,
  SupportMessage,
  SupportPriority,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
  TariffItem,
  UnpaidInvoice,
  UnpaidOrdering,
  VitalSignsStaff,
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

/* ── S4 (ADR 0017) — KYC supporting documents: DIRECTOR ONLY ──────────────
   The KYC file is the director's own paperwork: he provides it, the Chioni
   platform reads it. Nobody else in the center sees it — a director's ID card
   has no business under a secretary's eyes (every other role gets a 403).
   Private storage: NEVER a file URL, the bytes flow through the authenticated
   download endpoint only. */

export function listKycDocuments(
  centerId: number,
  page = 1,
): Promise<Paginated<KycDocument>> {
  return apiFetch(`/centers/${centerId}/kyc-documents/?page=${page}`);
}

/**
 * Multipart upload — real JPEG/PNG/WebP only (the center photographs its
 * registry; the PDF is deferred, arbitrage réversible ADR 0017), 2 MB max,
 * EXIF stripped server-side. Throttle scope `uploads` (20/h, shared with
 * avatar/logo/patient documents) → map the 429 to French.
 */
export function uploadKycDocument(
  centerId: number,
  { file, doc_type }: { file: File; doc_type: KycDocType },
): Promise<KycDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('doc_type', doc_type);
  return apiFetch(`/centers/${centerId}/kyc-documents/`, { method: 'POST', body: form });
}

/** Authenticated download — an archived piece stays downloadable. */
export function downloadKycDocument(centerId: number, documentId: number): Promise<void> {
  return apiDownload(
    `/centers/${centerId}/kyc-documents/${documentId}/download/`,
    `kyc-${documentId}`,
  );
}

/** Correction WITHOUT destruction, and FINAL — already archived → 400. */
export function archiveKycDocument(
  centerId: number,
  documentId: number,
): Promise<KycDocument> {
  return apiFetch(`/centers/${centerId}/kyc-documents/${documentId}/archive/`, {
    method: 'POST',
  });
}

/* ── S4 (ADR 0017 décision 5) — the center's audit journal: DIRECTOR ONLY ──
   Not a BILLING view: the journal aggregates personnel decisions, money and
   disputes. `action` MUST come from the whitelist (AUDIT_ACTION_LABELS) — any
   other value, invented or deliberately hidden (clinical, consents), answers
   the SAME 400 « Action inconnue. » so no oracle tells the director what
   exists but stays hidden. */

export interface AuditLogQuery extends StatsWindow {
  action?: AuditAction;
  page?: number;
}

export function listAuditLog(
  centerId: number,
  { action, from, to, page = 1 }: AuditLogQuery = {},
): Promise<AuditLogPage> {
  const query = new URLSearchParams({ page: String(page) });
  if (action) query.set('action', action);
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  return apiFetch(`/centers/${centerId}/audit-log/?${query.toString()}`);
}

/* ── patients ── */

export interface CenterPatientPayload {
  first_name: string;
  last_name: string;
  birth_date?: string;
  sex?: Sex;
  phone?: string;
  city?: string;
  /* S3 — extended identity, also accepted at desk creation (ADR 0016 add. 8). */
  address?: string;
  phone_alt?: string;
  national_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
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
  payload: Partial<
    Pick<
      Patient,
      | 'first_name'
      | 'last_name'
      | 'birth_date'
      | 'sex'
      | 'phone'
      | 'city'
      | 'address'
      | 'phone_alt'
      | 'national_id'
      | 'emergency_contact_name'
      | 'emergency_contact_phone'
      | 'emergency_contact_relationship'
    >
  >,
): Promise<Patient> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/`, { method: 'PATCH', body: payload });
}

/* ── S3 — duplicate detection at desk creation (every staff member) ── */

export interface SimilarPatientsQuery {
  /** Matched against `phone` OR `phone_alt` (E.164-normalised server-side). */
  phone?: string;
  /** Name criterion requires last_name AND birth_date TOGETHER. */
  last_name?: string;
  /** Optional refinement of the name criterion. */
  first_name?: string;
  birth_date?: string;
}

/**
 * Look-alike patients of the center's perimeter — NON-blocking by design:
 * the desk is informed, the desk decides (create anyway / open the record /
 * merge). No usable criterion → 400 ; invalid phone or date → 400 per field.
 */
export function listSimilarPatients(
  centerId: number,
  { phone, last_name, first_name, birth_date }: SimilarPatientsQuery,
): Promise<Paginated<Patient>> {
  const query = new URLSearchParams();
  if (phone) query.set('phone', phone);
  if (last_name) query.set('last_name', last_name);
  if (first_name) query.set('first_name', first_name);
  if (birth_date) query.set('birth_date', birth_date);
  return apiFetch(`/centers/${centerId}/patients/similar/?${query.toString()}`);
}

/* ── S3 — insurance/mutual lines (read all staff, write BILLING) ── */

export interface InsurancePayload {
  insurer_name: string;
  member_number: string;
  valid_until?: string | null;
  notes?: string;
  is_active?: boolean;
}

export function listPatientInsurances(
  centerId: number,
  patientId: number,
  page = 1,
): Promise<Paginated<PatientInsurance>> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/insurances/?page=${page}`);
}

export function createPatientInsurance(
  centerId: number,
  patientId: number,
  payload: InsurancePayload,
): Promise<PatientInsurance> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/insurances/`, {
    method: 'POST',
    body: payload,
  });
}

export function updatePatientInsurance(
  centerId: number,
  patientId: number,
  insuranceId: number,
  payload: Partial<InsurancePayload>,
): Promise<PatientInsurance> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/insurances/${insuranceId}/`, {
    method: 'PATCH',
    body: payload,
  });
}

/* ── S3 — medical file (clinical roles ONLY, read AND write) ── */

/**
 * Constant empty shape before the first write (`updated_at: null`), created
 * on first PATCH. Administrative staff and pharmacist get a 403 — never call
 * this outside a clinical-role gate.
 */
export function getPatientMedicalFile(
  centerId: number,
  patientId: number,
): Promise<PatientMedicalFile> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/medical-file/`);
}

export function updatePatientMedicalFile(
  centerId: number,
  patientId: number,
  payload: Partial<Pick<PatientMedicalFile, 'blood_group' | 'notes'>>,
): Promise<PatientMedicalFile> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/medical-file/`, {
    method: 'PATCH',
    body: payload,
  });
}

/* ── S3 — attached documents (clinical roles of the producing center) ── */

export function listPatientDocuments(
  centerId: number,
  patientId: number,
  page = 1,
): Promise<Paginated<PatientDocumentStaff>> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/documents/?page=${page}`);
}

/**
 * Multipart upload — real JPEG/PNG/WebP only (photos of documents ; the PDF
 * is deferred), 2 MB max, EXIF stripped server-side. Throttle scope
 * `uploads` (20/h shared with avatar/logo) → map the 429 to French.
 */
export function uploadPatientDocument(
  centerId: number,
  patientId: number,
  {
    file,
    doc_type,
    title,
    source_encounter,
  }: { file: File; doc_type: PatientDocumentType; title: string; source_encounter?: number },
): Promise<PatientDocumentStaff> {
  const form = new FormData();
  form.append('file', file);
  form.append('doc_type', doc_type);
  form.append('title', title);
  if (source_encounter !== undefined) form.append('source_encounter', String(source_encounter));
  return apiFetch(`/centers/${centerId}/patients/${patientId}/documents/`, {
    method: 'POST',
    body: form,
  });
}

/** Authenticated download — bytes never flow through a static /media/ URL. */
export function downloadPatientDocument(
  centerId: number,
  patientId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    `/centers/${centerId}/patients/${patientId}/documents/${documentId}/download/`,
    `document-${documentId}`,
  );
}

/**
 * Archive (definitive) — correction WITHOUT destruction: the patient no
 * longer sees the document, the producing center's clinical staff keeps the
 * line and the download. Already archived → 400.
 */
export function archivePatientDocument(
  centerId: number,
  patientId: number,
  documentId: number,
): Promise<PatientDocumentStaff> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/documents/${documentId}/archive/`, {
    method: 'POST',
  });
}

/* ── S3 — vital signs of an encounter (clinical roles) ── */

/** Bare NON-paginated array, like prescriptions/record entries. */
export function listVitalSigns(
  centerId: number,
  encounterId: number,
): Promise<VitalSignsStaff[]> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/vital-signs/`);
}

export interface VitalSignsPayload {
  /** Values as typed (strings) — DRF coerces and answers 400 per field on
      implausible bounds. At least one measure is required. */
  systolic_bp?: string;
  diastolic_bp?: string;
  heart_rate?: string;
  spo2?: string;
  temperature_c?: string;
  respiratory_rate?: string;
  weight_kg?: string;
  height_cm?: string;
}

/**
 * `measured_by` is ALWAYS the caller's clinical hat (never sent). Closed
 * encounter → 400 (same `_require_open_encounter` rule as the carnet).
 */
export function createVitalSigns(
  centerId: number,
  encounterId: number,
  payload: VitalSignsPayload,
): Promise<VitalSignsStaff> {
  return apiFetch(`/centers/${centerId}/encounters/${encounterId}/vital-signs/`, {
    method: 'POST',
    body: payload,
  });
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

/* ── desk-collected clinical consent (S2, ADR 0004 addendum — BILLING) ── */

/**
 * Record a clinical consent gathered at the desk (paper form / oral accord)
 * for a NON-claimed patient. Explicit 400s shown as-is: claimed patient
 * (« gère lui-même ses consentements »), link not an active link of THIS
 * patient, already granted. The consent is auto-revoked when the patient
 * claims their profile — never present it as permanent.
 */
export function grantDeskClinicalConsent(
  centerId: number,
  patientId: number,
  guardianLinkId: number,
  collectedVia: ConsentCollectedVia,
): Promise<DeskClinicalConsent> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/consents/clinical/`, {
    method: 'POST',
    body: { guardian_link: guardianLinkId, collected_via: collectedVia },
  });
}

/** Withdraw a desk-collected clinical consent. 400 if none is active. */
export function revokeDeskClinicalConsent(
  centerId: number,
  patientId: number,
  guardianLinkId: number,
): Promise<DeskClinicalConsent> {
  return apiFetch(`/centers/${centerId}/patients/${patientId}/consents/clinical/`, {
    method: 'DELETE',
    body: { guardian_link: guardianLinkId },
  });
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
  /**
   * Appointment id (S1 reliquat) — a valid one flips the appointment to
   * `honore` automatically server-side. 400 explicites shown as-is: foreign
   * center, another patient's appointment, already-closed appointment.
   */
  appointment?: number;
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

/* ── hospitalisation (S6, ADR 0019) ─────────────────────────────────────────
   Le séjour héberge, la consultation soigne : chaque séjour porte un
   `encounter` PIVOT ouvert du premier au dernier jour — les signes vitaux, les
   ordonnances et le carnet passent par les routes `encounters/` existantes, il
   n'y a PAS de route de surveillance dédiée (et c'est voulu).

   Permissions (ADR 0019 addendum §11) : lecture = tout staff actif avec un
   payload segmenté par rôle ; admission / sortie / annulation / lit / médecins
   assignés = rôles cliniques ; facturation des journées = rôles BILLING ;
   déclaration des chambres et des lits = directeur seul. Le gel commercial ne
   s'applique JAMAIS ici : un lit est le prérequis physique d'une admission. */

/** Les chambres du centre — tableau NU (non paginé). */
export function listRooms(centerId: number): Promise<Room[]> {
  return apiFetch(`/centers/${centerId}/inpatient/rooms/`);
}

/** Directeur seul — la structure physique de l'établissement. */
export function createRoom(centerId: number, name: string): Promise<Room> {
  return apiFetch(`/centers/${centerId}/inpatient/rooms/`, {
    method: 'POST',
    body: { name },
  });
}

/** Les lits d'UNE chambre. Chambre d'un autre centre → 404 (jamais un 400). */
export function listRoomBeds(centerId: number, roomId: number): Promise<Bed[]> {
  return apiFetch(`/centers/${centerId}/inpatient/rooms/${roomId}/beds/`);
}

/** Directeur seul. */
export function createBed(centerId: number, roomId: number, name: string): Promise<Bed> {
  return apiFetch(`/centers/${centerId}/inpatient/rooms/${roomId}/beds/`, {
    method: 'POST',
    body: { name },
  });
}

/**
 * La liste plate des lits. `free: true` ne garde que les lits assignables
 * MAINTENANT (lit actif, chambre active, aucune assignation ouverte) : c'est
 * le sélecteur du formulaire d'admission et de la modale de transfert.
 */
export function listBeds(centerId: number, { free }: { free?: boolean } = {}): Promise<Bed[]> {
  const query = free === undefined ? '' : `?free=${free ? 'true' : 'false'}`;
  return apiFetch(`/centers/${centerId}/inpatient/beds/${query}`);
}

/** Photo INSTANTANÉE de l'occupation — tout staff. Jamais dans `stats/`. */
export function getOccupancy(centerId: number): Promise<OccupancyRoom[]> {
  return apiFetch(`/centers/${centerId}/inpatient/occupancy/`);
}

export interface StayFilters {
  page?: number;
  status?: StayStatus;
  /** Sans `status` ni `all`, l'API rend les séjours EN COURS seuls. */
  all?: boolean;
  patient?: number;
}

export function listStays(
  centerId: number,
  { page = 1, status, all, patient }: StayFilters = {},
): Promise<Paginated<Stay>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  else if (all) query.set('all', 'true');
  if (patient !== undefined) query.set('patient', String(patient));
  return apiFetch(`/centers/${centerId}/inpatient/stays/?${query.toString()}`);
}

export function getStay(centerId: number, stayId: number): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/`);
}

export interface AdmissionPayload {
  patient: number;
  /** Motif d'admission — CLINIQUE : il atterrit sur la consultation pivot. */
  reason: string;
  diagnosis?: string;
  priority?: StayPriority;
  /** FACULTATIF : un patient peut être admis sans lit (attente, couloir). */
  bed?: number | null;
  /** Ids de memberships cliniques actifs de CE centre. */
  attending?: number[];
  admitted_at?: string;
}

/** Rôles cliniques : l'admission ouvre la consultation pivot, en une transaction. */
export function admitPatient(centerId: number, payload: AdmissionPayload): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/`, {
    method: 'POST',
    body: payload,
  });
}

/** Assigner OU transférer : l'assignation courante est libérée, la nouvelle
 *  empilée. Un lit déjà occupé est refusé par la BASE (contrainte partielle). */
export function assignStayBed(centerId: number, stayId: number, bed: number): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/bed/`, {
    method: 'POST',
    body: { bed },
  });
}

/** Libérer le lit SANS en donner un autre — « le patient attend dans le couloir »
 *  est un état que le produit doit savoir dire. */
export function releaseStayBed(centerId: number, stayId: number): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/bed/`, {
    method: 'DELETE',
  });
}

/** L'historique des lits — rôles CLINIQUES seuls, tableau nu. */
export function listStayBedAssignments(
  centerId: number,
  stayId: number,
): Promise<BedAssignment[]> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/bed-assignments/`);
}

/** PUT : l'ensemble COMPLET des médecins assignés (une liste se remplace). */
export function setStayAttending(
  centerId: number,
  stayId: number,
  attending: number[],
): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/attending/`, {
    method: 'PUT',
    body: { attending },
  });
}

/** Sortie : libère le lit ET clôture la consultation pivot, en une transaction. */
export function dischargeStay(
  centerId: number,
  stayId: number,
  dischargedAt?: string,
): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/discharge/`, {
    method: 'POST',
    body: dischargedAt ? { discharged_at: dischargedAt } : {},
  });
}

/** Admission saisie PAR ERREUR — motif obligatoire, refusée dès qu'un acte
 *  pend au pivot (« aucune journée facturée »). Ce n'est pas une sortie. */
export function cancelStay(centerId: number, stayId: number, reason: string): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/cancel/`, {
    method: 'POST',
    body: { reason },
  });
}

/**
 * Rôles BILLING — pose UN acte par journée sur la consultation pivot.
 *
 * **`idempotency_key` est OBLIGATOIRE** (correctif PO du 15/08/2026, revue
 * guardian S6) : poser des journées produit des actes qu'une facture réclamera
 * à un vrai patient, donc une réponse perdue doit être REJOUABLE plutôt que
 * doublante. Contrat client, identique à celui de la caisse (ADR 0015) :
 * générer la clé à l'ouverture du formulaire, la CONSERVER tant que la requête
 * a échoué (timeout, réseau coupé, 5xx) pour rejouer le MÊME corps, et n'en
 * régénérer une qu'après un succès. Jamais dérivée du contenu du formulaire.
 *
 * Rejeu à l'identique → 200 avec le même état. Même clé, autres paramètres →
 * 400 explicite (bug client : régénérer, ne pas boucler).
 *
 * Le backend borne aussi le CUMUL : jamais plus de journées que le séjour n'en
 * a duré (journées civiles entamées, heure des Comores). Le 400 énonce le
 * plafond, les dates et le déjà-facturé — l'afficher tel quel.
 */
export function billStayDays(
  centerId: number,
  stayId: number,
  payload: { tariff: number; days: number; idempotency_key: string },
): Promise<Stay> {
  return apiFetch(`/centers/${centerId}/inpatient/stays/${stayId}/bill-days/`, {
    method: 'POST',
    body: payload,
  });
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

/* ── abonnement SaaS du centre (S5, ADR 0018 — DIRECTEUR SEUL) ── */

/**
 * Le contrat du tenant, lu par son directeur.
 *
 * **404 = état NORMAL**, pas une erreur : tous les centres nés avant S5 n'ont
 * pas de ligne d'abonnement, et un tenant sans contrat n'est pas un tenant en
 * défaut. L'appelant rend un état vide honnête (`SUBSCRIPTION_NONE_*`).
 *
 * Rôle : directeur uniquement (arbitrage RÉVERSIBLE, symétrique du dossier KYC
 * et du journal d'audit). **Ne pas monter l'écran hors casquette directeur** —
 * il s'afficherait pour recevoir un 403.
 */
export function getSubscription(centerId: number): Promise<CenterSubscription> {
  return apiFetch(`/centers/${centerId}/subscription/`);
}

/**
 * Les factures d'abonnement du centre — **lecture seule de bout en bout** :
 * c'est Chioni qui émet, encaisse et corrige. Liste vide = 200, là où
 * l'absence de contrat est un 404 : « pas de contrat » et « pas encore de
 * facture » ne sont pas la même nouvelle.
 */
export function listSubscriptionInvoices(
  centerId: number,
  { status, page = 1 }: { status?: SubscriptionInvoiceStatus; page?: number } = {},
): Promise<Paginated<CenterSubscriptionInvoice>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  return apiFetch(`/centers/${centerId}/subscription/invoices/?${query.toString()}`);
}

export function getSubscriptionInvoice(
  centerId: number,
  invoiceId: number,
): Promise<CenterSubscriptionInvoice> {
  return apiFetch(`/centers/${centerId}/subscription/invoices/${invoiceId}/`);
}

/* ── support du centre (S5 lot 3 — TOUT STAFF ACTIF) ── */

/**
 * Les tickets : les siens, plus TOUS ceux du centre pour le directeur.
 *
 * Deux règles qui gouvernent les écrans :
 * - **l'ouverture n'est gatée sur aucun rôle** — c'est la secrétaire qui
 *   rencontre le bug, pas le directeur ;
 * - **le support n'est JAMAIS gelé par l'abonnement** : un centre suspendu
 *   ouvre un ticket et dépose une capture. C'est précisément le moment où il
 *   en a besoin, et fermer le canal qui répond ferait une boucle sans sortie.
 */
export function listSupportTickets(
  centerId: number,
  {
    status,
    category,
    page = 1,
  }: { status?: SupportTicketStatus; category?: SupportCategory; page?: number } = {},
): Promise<Paginated<SupportTicket>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  if (category) query.set('category', category);
  return apiFetch(`/centers/${centerId}/support/tickets/?${query.toString()}`);
}

export interface SupportTicketPayload {
  subject: string;
  category: SupportCategory;
  priority?: SupportPriority;
  /** Devient le PREMIER message du fil, dans la même transaction. */
  body?: string;
}

/** 201 = le ticket AVEC son fil : un seul aller-retour sur une connexion faible. */
export function createSupportTicket(
  centerId: number,
  payload: SupportTicketPayload,
): Promise<SupportTicketDetail> {
  return apiFetch(`/centers/${centerId}/support/tickets/`, { method: 'POST', body: payload });
}

/** Le ticket d'un collègue est un 404, jamais un 403 qui apprendrait son existence. */
export function getSupportTicket(
  centerId: number,
  ticketId: number,
): Promise<SupportTicketDetail> {
  return apiFetch(`/centers/${centerId}/support/tickets/${ticketId}/`);
}

/**
 * Répondre — possible pour quiconque peut lire (un fil que son auteur ne peut
 * pas alimenter est un formulaire, pas une conversation). Poster ne déplace
 * RIEN : un message sur un ticket `resolu` le laisse `resolu`.
 */
export function postSupportMessage(
  centerId: number,
  ticketId: number,
  body: string,
): Promise<SupportMessage> {
  return apiFetch(`/centers/${centerId}/support/tickets/${ticketId}/messages/`, {
    method: 'POST',
    body: { body },
  });
}

/**
 * Dépôt d'une pièce — socle ADR 0014 tel quel (JPEG/PNG/WebP réels, 2 Mo, EXIF
 * strippé), throttle `uploads` 20/h. **Le PDF est refusé** : une capture
 * d'écran est un PNG.
 */
export function uploadSupportAttachment(
  centerId: number,
  ticketId: number,
  file: File,
): Promise<SupportAttachment> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch(`/centers/${centerId}/support/tickets/${ticketId}/attachments/`, {
    method: 'POST',
    body: form,
  });
}

/** Téléchargement authentifié — le stockage est privé, il n'existe aucune URL. */
export function downloadSupportAttachment(
  centerId: number,
  ticketId: number,
  attachmentId: number,
): Promise<void> {
  return apiDownload(
    `/centers/${centerId}/support/tickets/${ticketId}/attachments/${attachmentId}/download/`,
    `piece-${attachmentId}`,
  );
}
