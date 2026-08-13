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

/* ── /auth/me/ — router of the 3 spaces ── */

export interface CenterSummary {
  id: number;
  name: string;
  type: CenterType;
  island: Island;
  city: string;
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
  status: InvoiceStatus;
  lines: InvoiceLine[];
  created_at: string;
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
