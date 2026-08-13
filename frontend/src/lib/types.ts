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

export type RecordEntryType = 'antecedent' | 'allergie' | 'traitement_en_cours' | 'vaccination';

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
  kyc_status: KycStatus;
  /** Read-only here — written via POST|DELETE /centers/{pk}/logo/ (multipart). */
  logo: string | null;
  created_at: string;
}

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  sex: Sex;
  phone: string | null;
  city: string;
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
