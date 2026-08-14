/*
 * Chioni — TypeScript shapes of the API contract (docs/frontend/api-contract.md).
 *
 * Conventions: ids are numbers, amounts are DECIMAL STRINGS ("15000.00"),
 * dates are ISO-8601 strings with offset, enums are unions of raw backend
 * values (French labels live in src/lib/labels.ts).
 */

/* ── pagination ── */

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ── enums ── */

export type StaffRole =
  | 'directeur'
  | 'medecin'
  | 'infirmier'
  | 'sage_femme'
  | 'secretaire'
  | 'caissier'
  | 'pharmacien';

export type Island = 'ngazidja' | 'ndzuwani' | 'mwali';

export type CenterType =
  | 'hopital_public'
  | 'clinique_privee'
  | 'centre_sante'
  | 'cabinet'
  | 'pharmacie';

export type KycStatus = 'en_attente' | 'actif' | 'suspendu';

export type ClaimStatus = 'non_revendique' | 'invite' | 'actif';

export type Sex = 'f' | 'm' | '';

export type GuardianLinkStatus =
  | 'invitation_envoyee'
  | 'attente_confirmation_titulaire'
  | 'actif'
  | 'revoque';

export type Relationship =
  | 'parent'
  | 'enfant'
  | 'conjoint'
  | 'frere_soeur'
  | 'famille_elargie'
  | 'ami'
  | 'autre';

export type InitiatedBy = 'tuteur' | 'patient' | 'centre';

export type ConsentScope = 'paiements' | 'detail_clinique';

export type GenericCategory =
  | 'consultation'
  | 'analyses_examens'
  | 'medicaments'
  | 'hospitalisation'
  | 'acte_technique'
  | 'soins_infirmiers'
  | 'maternite'
  | 'autre';

export type EncounterStatus = 'en_cours' | 'terminee' | 'annulee';

export type PrescriptionStatus = 'emise' | 'delivree';

export type RecordEntryType =
  | 'antecedent'
  | 'allergie'
  | 'traitement_en_cours'
  | 'vaccination'
  /* S3 (ADR 0016) — same free-text contract, three more shelves. */
  | 'chirurgie'
  | 'antecedent_familial'
  | 'observation';

/** Blood group of the medical file (S3) — '' means « not recorded ». */
export type BloodGroup = '' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

/** Attached-document category (S3). Photos only — the PDF is deferred. */
export type PatientDocumentType = 'resultat_biologie' | 'imagerie' | 'compte_rendu' | 'autre';

export type PaymentRequestStatus =
  | 'brouillon'
  | 'envoyee'
  | 'payee'
  | 'soin_confirme'
  | 'cloturee'
  | 'litige';

export type InvoiceStatus = 'brouillon' | 'emise' | 'payee' | 'annulee';

export type PaymentIntentStatus = 'cree' | 'en_cours' | 'reussi' | 'echoue' | 'annule';

export type DisputeStatus = 'ouvert' | 'resolu';

export type Currency = 'EUR' | 'KMF';

export type AppointmentStatus = 'prevu' | 'arrive' | 'honore' | 'manque' | 'annule';

/** Cash-in rail. `pont_confiance` NEVER comes from the desk (webhook only). */
export type CashMethod = 'especes' | 'mobile_money' | 'pont_confiance';

export type MobileMoneyOperator = 'huri' | 'mvola' | 'autre';

/** `?ordering=` of GET /centers/{c}/invoices/unpaid/ — any other value is a 400. */
export type UnpaidOrdering = '-balance' | 'balance' | '-age' | 'age';

/** How a desk-collected clinical consent was gathered (S2, ADR 0004 addendum). */
export type ConsentCollectedVia = 'papier' | 'oral';

/* ── S4 (ADR 0017) — the platform space, KYC file, audit, RGPD ── */

/** Chioni operator role. `support` READS, `admin` alone WRITES. */
export type PlatformRole = 'support' | 'admin';

/** KYC supporting-document categories (photos only — the PDF is deferred). */
export type KycDocType =
  | 'registre_commerce'
  | 'licence_sante'
  | 'piece_identite_directeur'
  | 'autre';

/** Closed vocabulary of PSP payment incidents (reconciliation view). */
export type IncidentCode =
  | 'webhook_intent_not_payable'
  | 'webhook_request_not_payable'
  | 'webhook_invoice_cancelled'
  | 'webhook_balance_changed'
  | 'intent_stale_cancelled'
  | 'intent_failed';

/** The three audited actions behind an incident. */
export type IncidentAction =
  | 'payment.webhook_refused'
  | 'payment_intent.cancelled'
  | 'payment_intent.failed';

export type ErasureStatus = 'en_attente' | 'traitee' | 'refusee';

/** What must be fixed BEFORE an erasure can run (empty list = executable). */
export type ErasureBlocker =
  | 'dernier_directeur'
  | 'paiement_en_cours'
  | 'dernier_admin_plateforme';

export type ErasureDecision = 'anonymiser' | 'refuser';

/**
 * The director's journal whitelist (ADR 0017 décision 5). ANY other value —
 * a typo or a deliberately hidden clinical action — is a 400 « Action
 * inconnue. » : the selector must never offer anything outside this union.
 */
export type AuditAction =
  | 'staff.membership_created'
  | 'staff.membership_updated'
  | 'staff.membership_deactivated'
  | 'staff.membership_reactivated'
  | 'center.created'
  | 'center.updated'
  | 'center.kyc_changed'
  | 'kyc_document.uploaded'
  | 'kyc_document.archived'
  | 'tariff.created'
  | 'tariff.updated'
  | 'invoice.created'
  | 'invoice.issued'
  | 'invoice.cancelled'
  | 'payment_request.created'
  | 'payment_request.sent'
  | 'payment_request.shared'
  | 'payment_request.unshared'
  | 'payment_request.care_confirmed'
  | 'payment_request.patient_acknowledged'
  | 'payment_request.closed'
  | 'payment_intent.created'
  | 'payment_intent.failed'
  | 'payment_intent.cancelled'
  | 'payment.recorded'
  | 'payment.webhook_refused'
  | 'cash_payment.recorded'
  | 'cash_payment.reversed'
  | 'dispute.opened'
  | 'dispute.resolved'
  | 'patient_profile.merged';

/* ── /auth/me/ — router of the 3 spaces ── */

export interface CenterSummary {
  id: number;
  name: string;
  type: CenterType;
  island: Island;
  city: string;
  /** Absolute URL or null — feeds the sidebar and on-screen documents. */
  logo: string | null;
}

export interface StaffMembership {
  id: number;
  center: CenterSummary;
  role: StaffRole;
}

export interface MePatientProfile {
  id: number;
  first_name: string;
  last_name: string;
  claim_status: ClaimStatus;
}

export interface GuardianProfile {
  id: number;
  country_of_residence: string;
  preferred_currency: Currency;
  created_at?: string;
}

/**
 * S4 — the operator hat in `/auth/me/`. Only an ACTIVE row surfaces (a
 * deactivated operator gets `null`, byte-identical to someone who never was
 * one), so the frontend gate is `platform_staff !== null` — never
 * `is_staff`/`is_superuser`, which do not exist in this payload and grant no
 * API right whatsoever.
 */
export interface MePlatformStaff {
  id: number;
  role: PlatformRole;
  /** Always `true` when present — kept for contract readability. */
  is_active: boolean;
}

export interface Me {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  /** Absolute URL of the profile photo, or null. */
  avatar: string | null;
  staff_memberships: StaffMembership[];
  patient_profile: MePatientProfile | null;
  guardian_profile: GuardianProfile | null;
  /** S4 — the 4th hat. `null` for everyone who is not a Chioni operator. */
  platform_staff: MePlatformStaff | null;
}

/**
 * GET|POST /auth/me/erasure-request/ — MY own request (RGPD art. 17).
 * `refusal_reason` is the ONLY free operator text of the project rendered to
 * the person concerned (art. 12.4): display it in full on a refusal.
 */
export interface ErasureRequestMine {
  id: number;
  status: ErasureStatus;
  requested_at: string;
  processed_at: string | null;
  refusal_reason: string;
}

/* ── auth responses ── */

export interface OtpVerifyResponse {
  access: string;
  refresh: string;
  me: Me;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/* ── patient space ── */

export interface PatientMe {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  sex: Sex;
  phone: string | null;
  city: string;
  /* S3 — extended administrative identity (all optional, '' when empty). */
  address: string;
  phone_alt: string | null;
  national_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string;
  claim_status: ClaimStatus;
  created_at: string;
}

export interface GuardianLinkPatient {
  id: number;
  guardian_name: string;
  relationship: Relationship;
  status: GuardianLinkStatus;
  initiated_by: InitiatedBy;
  accepted_at: string | null;
  revoked_at: string | null;
  scopes: ConsentScope[];
}

export interface EncounterAct {
  id: number;
  label_snapshot: string;
  generic_category: GenericCategory;
  price_kmf_snapshot: string;
  tariff_item: number;
}

export interface Encounter {
  id: number;
  center: number;
  center_name: string;
  occurred_at: string;
  reason: string;
  diagnosis: string;
  status: EncounterStatus;
  acts: EncounterAct[];
  created_at: string;
}

export interface PrescriptionItem {
  id: number;
  medication: string;
  dosage: string;
}

export interface Prescription {
  id: number;
  encounter: number;
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  created_at: string;
}

export interface RecordEntry {
  id: number;
  entry_type: RecordEntryType;
  content: string;
  source_encounter: number | null;
  created_at: string;
}

/* ── S3 — enriched patient record (ADR 0016) ── */

/**
 * Medical file (clinical sphere). Constant empty shape before the first
 * clinical write: `{blood_group: '', notes: '', updated_at: null}` — never a
 * 404. Patient side is read-only; staff side is clinical roles ONLY.
 */
export interface PatientMedicalFile {
  blood_group: BloodGroup;
  notes: string;
  updated_at: string | null;
}

/**
 * Vital-signs measures (S3). Integers come as numbers, decimals as STRINGS
 * (DRF DecimalField) ; a measure not taken is null.
 */
export interface VitalSignsMeasures {
  systolic_bp: number | null;
  diastolic_bp: number | null;
  heart_rate: number | null;
  spo2: number | null;
  /** Decimal string, 1 decimal ("37.2"). */
  temperature_c: string | null;
  respiratory_rate: number | null;
  /** Decimal string, 2 decimals ("62.00"). */
  weight_kg: string | null;
  height_cm: number | null;
}

/** GET /patients/me/vital-signs/ item — NO `measured_by` (staff internals never cross). */
export interface PatientVitalSigns extends VitalSignsMeasures {
  id: number;
  encounter: number;
  measured_at: string;
  created_at: string;
}

/** GET|POST /centers/{c}/encounters/{e}/vital-signs/ item (clinical roles). */
export interface VitalSignsStaff extends PatientVitalSigns {
  /** StaffMembership id of the measuring caregiver (always the caller on POST). */
  measured_by: number;
  measured_by_name: string;
}

/**
 * GET /patients/me/documents/ item — archived documents excluded. NEVER a
 * file URL: bytes only flow through the authenticated download endpoint.
 */
export interface PatientDocumentMine {
  id: number;
  center: number;
  center_name: string;
  doc_type: PatientDocumentType;
  title: string;
  source_encounter: number | null;
  created_at: string;
}

/**
 * GET|POST /centers/{c}/patients/{pk}/documents/ item (clinical roles of the
 * PRODUCING center only). `archived_at` filled = invisible to the patient,
 * kept (line + download) for the staff — correction without destruction.
 */
export interface PatientDocumentStaff {
  id: number;
  patient: number;
  doc_type: PatientDocumentType;
  title: string;
  source_encounter: number | null;
  archived_at: string | null;
  created_at: string;
}

/**
 * Insurance/mutual line (S3) — administrative-financial sphere, transversal
 * to the patient (every center of the perimeter sees the same lines).
 * Read: all staff + patient ; write: BILLING roles.
 */
export interface PatientInsurance {
  id: number;
  insurer_name: string;
  member_number: string;
  valid_until: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface PaymentRequestLinePatient {
  id: number;
  label: string;
  generic_category: GenericCategory;
  amount_kmf: string;
}

export interface PaymentRequestPatient {
  id: number;
  center_name: string;
  total_kmf: string;
  status: PaymentRequestStatus;
  lines: PaymentRequestLinePatient[];
  shared_with_links: number[];
  /** Set by the cash-in webhook — the REAL payment date (« payée par un proche le … »). */
  paid_at: string | null;
  patient_acknowledged_at: string | null;
  created_at: string;
}

/* ── patient appointments (S2 — read + cancel only, no self-booking) ── */

/**
 * GET /patients/me/appointments/ item — cross-center, sorted by
 * `scheduled_at` desc. Deliberately WITHOUT `reason` (operational desk note,
 * staff only — the contract forbids planning a slot for it).
 */
export interface PatientAppointment {
  id: number;
  center: { id: number; name: string };
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  /** Full name, or null (« rendez-vous avec le centre », or unnamed staff). */
  practitioner_display_name: string | null;
}

/* ── guardian space ── */

export interface ProtegePatient {
  id: number;
  first_name: string;
  last_name: string;
  claim_status: ClaimStatus;
}

export interface GuardianLinkGuardian {
  id: number;
  patient: ProtegePatient;
  relationship: Relationship;
  status: GuardianLinkStatus;
  initiated_by: InitiatedBy;
  accepted_at: string | null;
}

/**
 * GET /guardian/links/ item (S2) — the guardian's link HISTORY, every status.
 * Deliberately minimal: no phone, no scopes, no relationship. Its value: a
 * protégé in `attente_confirmation_titulaire` (invisible in /proteges/ during
 * the claimant-confirmation gate) is visible here — the UI presents it as the
 * patient's protection, never as an error.
 */
export interface GuardianLinkHistory {
  id: number;
  protege_display_name: string;
  status: GuardianLinkStatus;
  created_at: string;
  revoked_at: string | null;
}

/** Guardian-side line: NEVER carries `label` (medical secrecy, ADR 0005). */
export interface PaymentRequestLineGuardian {
  generic_category: GenericCategory;
  amount_kmf: string;
}

export interface PaymentRequestGuardian {
  id: number;
  patient: ProtegePatient;
  center_name: string;
  total_kmf: string;
  status: PaymentRequestStatus;
  /** Set by the cash-in webhook — the REAL payment date. */
  paid_at: string | null;
  lines: PaymentRequestLineGuardian[];
  created_at: string;
}

/** FX quote — rate frozen before payment, fees on top, center receives 100 % KMF. */
export interface Quote {
  amount_kmf: string;
  currency_received: 'KMF';
  exchange_rate: string;
  amount_eur: string;
  fees_eur: string;
  total_eur: string;
  currency_paid: 'EUR';
}

export interface PaymentIntent {
  id: number;
  payment_request: number;
  psp: 'fake' | 'stripe';
  psp_reference: string;
  amount_eur: string;
  exchange_rate: string;
  amount_kmf: string;
  status: PaymentIntentStatus;
  created_at: string;
}

/** Dual-currency receipt — no care information, per-center numbering. */
export interface Receipt {
  id: number;
  payment_request: number;
  center: number;
  center_name: string;
  receipt_number: string;
  amount_eur_paid: string;
  fees_eur: string;
  amount_kmf_received: string;
  exchange_rate: string;
  issued_at: string;
}

/* ── center space ── */

export interface HealthCenter {
  id: number;
  name: string;
  type: CenterType;
  island: Island;
  city: string;
  address: string;
  phone: string;
  email: string;
  /** NEVER writable by the tenant (S4) — only the Chioni platform moves it. */
  kyc_status: KycStatus;
  /**
   * Motive of the LAST KYC decision — rendered to the DIRECTOR of this center
   * only (`null` for every other role, same free-text class as
   * `Invoice.cancel_reason`). Never render a hard-coded fallback for it.
   */
  kyc_reason: string | null;
  kyc_updated_at: string | null;
  /** Read-only here — written via POST|DELETE /centers/{pk}/logo/ (multipart). */
  logo: string | null;
  created_at: string;
}

/**
 * One KYC supporting document (S4, ADR 0017 décision 3) — identical payload
 * for the center's director and for the platform. **Never a file URL**: the
 * storage is private, the bytes only flow through the authenticated download
 * endpoint of each audience.
 */
export interface KycDocument {
  id: number;
  center: number;
  doc_type: KycDocType;
  /** User id of the depositor (the director) — never a name. */
  uploaded_by: number;
  /** Filled = archived (correction without destruction, FINAL). */
  archived_at: string | null;
  created_at: string;
}

/* ── S4 — center audit journal (director only, ADR 0017 décision 5) ── */

export interface AuditLogEntry {
  id: number;
  created_at: string;
  action: AuditAction;
  actor: number | null;
  /** A name ONLY for a member of THIS center; `null` otherwise — never guess. */
  actor_display: string | null;
  /** "app_label.model" of the generic target, or null. */
  target_type: string | null;
  /** Stored as a CHAR by the backend generic FK — "" when absent. */
  object_id: string;
  /** References only (ids, codes, decimal strings) — never a name (ADR 0007). */
  payload: Record<string, unknown>;
}

/**
 * The journal's paginated envelope carries one extra root key: the date of
 * the center's FIRST entry (even one not listed). The log is append-only and
 * never back-filled — the screen must say « le journal commence le … » rather
 * than let a director believe the history is complete.
 */
export interface AuditLogPage extends Paginated<AuditLogEntry> {
  journal_starts_at: string | null;
}

/* ── S4 — platform space (back-office Chioni, ADR 0017) ── */

/**
 * One tenant as the platform sees it. **No patient ever crosses this
 * payload** (invariant of the sprint, verified backend-side by a negative
 * field test): identity of the center, its KYC file, and HEADCOUNTS.
 * `director_active_count === 0` is the « this center is locked out of its own
 * space, bootstrap a director » signal.
 */
export interface PlatformCenter {
  id: number;
  name: string;
  type: CenterType;
  island: Island;
  city: string;
  address: string;
  phone: string;
  email: string;
  kyc_status: KycStatus;
  /** Motive of the last decision — "" when there is none. */
  kyc_reason: string;
  kyc_updated_at: string | null;
  created_at: string;
  staff_active_count: number;
  director_active_count: number;
  kyc_document_count: number;
}

/** Membership echoed back by an onboarding — ids and role, nothing else. */
export interface PlatformMembership {
  id: number;
  user_id: number;
  center: number;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

/** 201 of POST /platform/centers/ — the tenant AND its first director. */
export interface PlatformCenterCreated extends PlatformCenter {
  director: PlatformMembership;
}

/**
 * References of a payment incident — a STRICT allow-list backend-side: only
 * the keys actually present are rendered.
 */
export interface IncidentRefs {
  intent_id?: number;
  payment_request_id?: number;
  invoice_id?: number;
  intent_status?: string;
  request_status?: string;
  intent_kmf?: string;
  balance_kmf?: string;
}

/**
 * One PSP incident (S4 lot 2). Technical operations view: ids, statuses,
 * amounts — never a patient name, a guardian name or a care label.
 * `center` is `null` for incidents audited before the S4 column existed
 * (append-only log): show « centre inconnu », never hide the row.
 */
export interface ReconciliationIncident {
  id: number;
  created_at: string;
  action: IncidentAction;
  incident: IncidentCode;
  center: number | null;
  center_name: string | null;
  refs: IncidentRefs;
}

/** Which hats the account of an erasure request wears (booleans, never rows). */
export interface ErasureHats {
  is_patient: boolean;
  is_guardian: boolean;
  is_center_staff: boolean;
  is_platform_operator: boolean;
}

/**
 * One erasure request in the back-office queue. `user`/`processed_by` are
 * ACCOUNT IDS, never names: the request was deposited by the AUTHENTICATED
 * person from their own space — Chioni's auth is the proof of identity.
 */
export interface PlatformErasureRequest {
  id: number;
  user: number;
  status: ErasureStatus;
  requested_at: string;
  processed_at: string | null;
  processed_by: number | null;
  refusal_reason: string;
  hats: ErasureHats;
  /** Empty = executable. Show them BEFORE the button, never at the click. */
  blockers: ErasureBlocker[];
}

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  sex: Sex;
  phone: string | null;
  city: string;
  /* S3 — extended administrative identity (same R-API-2 editing rules). */
  address: string;
  phone_alt: string | null;
  national_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string;
  claim_status: ClaimStatus;
  created_at: string;
}

export interface InvoiceLine {
  id: number;
  act: number;
  label: string;
  generic_category: GenericCategory;
  amount_kmf: string;
}

export interface Invoice {
  id: number;
  encounter: number;
  patient: number;
  total_kmf: string;
  /** Collected so far (all rails, reversals excluded) — the caisse view (ADR 0015). */
  paid_kmf: string;
  /** Still owed. The invoice flips `payee` when this reaches zero. */
  balance_kmf: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  /** Set when the invoice was cancelled (S1) — null otherwise. */
  cancelled_at: string | null;
  /**
   * Cancellation reason — BILLING roles ONLY: the field is ABSENT from the
   * payload for every other role (same free-text class as a dispute reason).
   * Never render it from a hard-coded fallback.
   */
  cancel_reason?: string;
  created_at: string;
}

/**
 * Guardian link as the CENTER sees it (desk-share routing, BILLING roles).
 * Administrative minimum by design: ACTIVE links only, never a phone number
 * (`guardian_name` may be a masked display name like « +336••••••78 » for a
 * guardian without a recorded name), never scopes nor history.
 */
export interface GuardianLinkCenter {
  id: number;
  guardian_name: string;
  relationship: Relationship;
}

/**
 * Desk-collected clinical consent (S2, ADR 0004 addendum) — response of
 * POST|DELETE /centers/{c}/patients/{pk}/consents/clinical/. NON-claimed
 * patients only; automatically revoked when the patient claims their profile
 * (claimant-confirmation gate) — never present it as permanent.
 */
export interface DeskClinicalConsent {
  guardian_link: number;
  scope: 'detail_clinique';
  collected_via: ConsentCollectedVia;
  granted_at: string;
  revoked_at: string | null;
}

export interface PaymentRequestShare {
  id: number;
  guardian_link: number;
  shared_at: string;
  shared_by: number;
}

export interface PaymentRequestStaff {
  id: number;
  invoice: number;
  total_kmf: string;
  status: PaymentRequestStatus;
  created_by: number;
  /** Set by the cash-in webhook — the REAL payment date. */
  paid_at: string | null;
  patient_acknowledged_at: string | null;
  shares: PaymentRequestShare[];
  created_at: string;
}

export interface Dispute {
  id: number;
  payment_request: number;
  opened_by: number;
  reason: string;
  previous_status: PaymentRequestStatus;
  status: DisputeStatus;
  resolved_by: number | null;
  resolution_note: string;
  resolved_at: string | null;
  created_at: string;
}

export interface StaffUser {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  /** Absolute URL of the member's profile photo, or null. */
  avatar: string | null;
}

export interface StaffMember {
  id: number;
  user: StaffUser;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
}

export interface TariffItem {
  id: number;
  code: string;
  label: string;
  generic_category: GenericCategory;
  price_kmf: string;
  is_active: boolean;
  created_at: string;
}

/**
 * GET /centers/{c}/practitioners/ item (S1 — the appointment/encounter
 * selector). Bare NON-paginated array, ACTIVE clinical memberships only.
 * Never carries a phone number nor an activation state (that stays on
 * GET /staff/, director only).
 */
export interface Practitioner {
  /** StaffMembership id — plugs directly into `practitioner` fields. */
  id: number;
  display_name: string;
  role: Extract<StaffRole, 'medecin' | 'infirmier' | 'sage_femme'>;
  avatar: string | null;
}

/* ── appointments (day queue — every active staff member) ── */

export interface Appointment {
  id: number;
  patient: number;
  patient_name: string;
  /** StaffMembership id, or null — « rendez-vous avec le centre ». */
  practitioner: number | null;
  practitioner_name: string | null;
  scheduled_at: string;
  duration_minutes: number;
  end_at: string;
  /** Operational desk note — NEVER clinical content. */
  reason: string;
  status: AppointmentStatus;
  reminder_sent_at: string | null;
  created_at: string;
}

/** Creation/move responses append the same-practitioner overlap ids — a
 *  NON-blocking warning: the desk decides. */
export interface AppointmentWithOverlaps extends Appointment {
  overlaps: number[];
}

/* ── caisse (ADR 0015 — BILLING roles) ── */

/** Counter receipt (« G- » series, pure KMF) embedded in a cash payment. */
export interface CashReceipt {
  id: number;
  receipt_number: string;
  sequence_number: number;
  center: number;
  center_name: string;
  amount_kmf: string;
  method: CashMethod;
  issued_at: string;
}

/** A reversal — visible and signed, never an erasure. */
export interface CashReversal {
  id: number;
  cash_payment: number;
  method: CashMethod;
  amount_kmf: string;
  reason: string;
  reversed_by: number;
  ledger_transaction: number;
  created_at: string;
}

export interface CashPayment {
  id: number;
  invoice: number;
  method: CashMethod;
  operator: MobileMoneyOperator | '';
  reference: string;
  amount_kmf: string;
  received_by: number;
  /** Null except for `pont_confiance` cash-ins (webhook-driven). */
  payment_intent: number | null;
  ledger_transaction: number;
  /** Null for `pont_confiance` (its receipt is the diaspora one at closure). */
  receipt: CashReceipt | null;
  reversal: CashReversal | null;
  created_at: string;
}

export interface CashJournalTotals {
  encaisse_kmf: string;
  contre_passe_kmf: string;
  net_kmf: string;
}

export interface CashJournal {
  date: string;
  payments: CashPayment[];
  /** Reversals MADE that day, even if the reversed cash-in is older. */
  reversals: CashReversal[];
  totals: Record<'especes' | 'mobile_money' | 'pont_confiance' | 'total', CashJournalTotals>;
}

/** GET /centers/{c}/invoices/unpaid/ item — issued invoices with balance > 0. */
export interface UnpaidInvoice {
  id: number;
  patient: number;
  patient_name: string;
  /** Masked AS-IS by the backend (« +336••••••78 », "" if no phone). */
  patient_phone_masked: string;
  total_kmf: string;
  paid_kmf: string;
  balance_kmf: string;
  age_days: number;
  created_at: string;
}

/** The patient's own counter receipts (all centers). */
export interface PatientCashReceipt {
  id: number;
  receipt_number: string;
  center_name: string;
  amount_kmf: string;
  method: CashMethod;
  /** True when the cash-in was reversed — the receipt no longer proves payment. */
  reversed: boolean;
  issued_at: string;
}

/* ── pilotage (vague 2b — read-only stats) ── */

export interface ActivityStatsDay {
  date: string;
  appointments: Record<AppointmentStatus, number>;
  encounters: number;
  new_patients: number;
}

export interface PractitionerActivity {
  practitioner: number;
  practitioner_name: string;
  role: StaffRole;
  encounters: number;
}

export interface ActivityStats {
  from: string;
  to: string;
  /** Complete, zero-filled series — plug straight into a chart. */
  days: ActivityStatsDay[];
  totals: {
    appointments: Record<AppointmentStatus, number> & { total: number };
    encounters: number;
    new_patients: number;
    /** Percentage string (« 66.7 ») or null when nothing is measurable. */
    attendance_rate_pct: string | null;
  };
  /** Sorted by volume — doubles as the center's internal directory. */
  encounters_by_practitioner: PractitionerActivity[];
}

export interface FinanceStatsDay {
  date: string;
  especes_kmf: string;
  mobile_money_kmf: string;
  pont_confiance_kmf: string;
  total_kmf: string;
}

export interface FinanceStats {
  from: string;
  to: string;
  days: FinanceStatsDay[];
  totals: {
    especes_kmf: string;
    mobile_money_kmf: string;
    pont_confiance_kmf: string;
    total_kmf: string;
  };
  /** Reversals made in the window — a dedicated field, never silently subtracted. */
  reversals: { count: number; total_kmf: string };
  /** Invoices issued in the window vs `collected_kmf` — the #1 steering gap. */
  invoiced: { count: number; total_kmf: string };
  collected_kmf: string;
  /** Snapshot at query time (window-independent): issued invoices, balance > 0. */
  unpaid: { count: number; total_kmf: string };
}
