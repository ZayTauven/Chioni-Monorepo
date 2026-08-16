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
  /* S6 (ADR 0019 décision 6) — SEULES ces deux actions d'hospitalisation
     entrent dans le journal du directeur : déclarer une chambre ou un lit est
     de la CONFIGURATION, au même titre qu'un tarif. `stay.admitted`,
     `stay.discharged`, `stay.cancelled`, `stay.days_billed`, `bed.assigned` et
     `bed.released` en sont exclues — elles diraient quel patient occupe quel
     lit et combien de temps, c'est-à-dire du clinique. */
  | 'room.created'
  | 'bed.created'
  /* S8 (ADR 0021) — le parc de matériel est de la CONFIGURATION
     d'établissement, même famille que `room.created` et `tariff.created`.
     `equipment.reported` y entre aussi : le journal note QU'un constat a été
     posé, jamais ce qu'il dit — la description est du texte libre, écarté du
     payload comme le corps d'un ticket de support. */
  | 'equipment.created'
  | 'equipment.updated'
  | 'equipment.status_changed'
  | 'equipment.reported'
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
  | 'patient_profile.merged'
  /* S5 (ADR 0018) — l'abonnement du centre est une action d'EXPLOITATION de
     son propre tenant : les sept entrent dans la liste blanche du journal.
     Le motif d'un gel, d'une annulation ou d'une contre-passation n'y figure
     jamais (`has_reason` seulement) — il se lit sur les écrans dédiés. */
  | 'subscription.created'
  | 'subscription.plan_changed'
  | 'subscription.status_changed'
  | 'subscription_invoice.issued'
  | 'subscription_invoice.cancelled'
  | 'subscription_payment.recorded'
  | 'subscription_payment.reversed'
  /* S5 lot 3 — le canal de support de SON centre entre aussi dans la liste
     blanche du journal (ADR 0018 lot 3 §12) : savoir que sa secrétaire a
     signalé une anomalie et où en est le dossier est de l'exploitation. Les
     payloads ne portent que des ids, la catégorie et des codes de statut —
     jamais l'objet, jamais le corps, jamais un nom de fichier. */
  | 'support_ticket.opened'
  | 'support_ticket.status_changed'
  | 'support_ticket.message_posted'
  | 'support_ticket.attachment_uploaded';

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

/**
 * S9 — la 5ᵉ casquette dans `/auth/me/` (ADR 0022 décision 10).
 *
 * Une **LISTE**, et non un objet nullable comme `platform_staff` : une même
 * personne peut tenir deux officines (rare, mais réel aux Comores), et
 * l'ambiguïté « laquelle ? » ne doit jamais être tranchée en silence — d'où
 * l'identifiant de pharmacie dans chaque URL de l'espace.
 *
 * `pharmacy.status` voyage ici **exprès** : le 5ᵉ espace en a besoin sur son
 * tout premier écran, avant le moindre fetch, pour dire la vérité (« votre
 * inscription est en cours d'examen ») plutôt qu'afficher une boîte vide qui
 * ressemble à une panne.
 */
export interface MePharmacyMembership {
  id: number;
  pharmacy: {
    id: number;
    name: string;
    island: Island;
    city: string;
    status: PharmacyStatus;
  };
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
  /** S9 — the 5th hat. Empty array for everyone outside the network. */
  pharmacy_memberships: MePharmacyMembership[];
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

/**
 * Une ordonnance — même payload pour le staff du centre producteur et pour le
 * patient titulaire.
 *
 * **S9** : `delivered_at` dit au comptoir ce qui reste à servir et au patient
 * « vos médicaments vous ont été remis le … ». Il n'y a **pas** de
 * `delivered_by` : le sérialiseur est partagé avec le patient, et aucune
 * identité de personnel ne traverse une vue patient (même règle que l'avatar
 * du staff, ADR 0014). Ne pas prévoir d'emplacement pour.
 *
 * La délivrance est **définitive** : aucune route ne la défait, donc aucun
 * écran ne propose « annuler la délivrance ».
 */
export interface Prescription {
  id: number;
  encounter: number;
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  delivered_at: string | null;
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

/* ── hospitalisation (S6, ADR 0019 — le séjour héberge, la consultation soigne) ──
   Deux sérialiseurs par audience côté staff (patron EncounterClinical/Admin) :
   `reason`, `diagnosis` et `cancel_reason` sont ABSENTS du payload d'un rôle
   administratif — d'où leur optionalité ici. `billed_days`, lui, est rendu aux
   deux : c'est la base de facturation, et le caissier ne peut pas facturer ce
   qu'il ne peut pas compter. Le tuteur ne voit RIEN de ce module. */

export type StayStatus = 'en_cours' | 'sortie' | 'annule';

export type StayPriority = 'normale' | 'urgente' | 'critique';

/** Une chambre du parc — `bed_count` compte les lits déclarés (actifs ou non). */
export interface Room {
  id: number;
  name: string;
  is_active: boolean;
  bed_count: number;
  created_at: string;
}

export interface Bed {
  id: number;
  room: number;
  room_name: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/** Le lit COURANT d'un séjour (assignation ouverte) — `null` = sans lit. */
export interface StayBedPosition {
  id: number;
  name: string;
  room: number;
  room_name: string;
}

/** Un médecin assigné : id de membership + nom déjà résolu par l'API. */
export interface StayAttending {
  id: number;
  name: string;
}

export interface Stay {
  id: number;
  patient: number;
  patient_name: string;
  /** Consultation PIVOT : la production clinique et la facturation y pendent. */
  encounter: number;
  admitted_at: string;
  discharged_at: string | null;
  status: StayStatus;
  priority: StayPriority;
  bed: StayBedPosition | null;
  attending: StayAttending[];
  /** Dérivé côté backend : nombre d'actes « hospitalisation » du pivot. */
  billed_days: number;
  created_at: string;
  /** Rôles cliniques SEULS (motif d'admission = clinique, sur le pivot). */
  reason?: string;
  /** Rôles cliniques SEULS. */
  diagnosis?: string;
  /** Rôles cliniques SEULS (précédent `Invoice.cancel_reason`). */
  cancel_reason?: string;
}

/** L'historique des lits d'un séjour — append-only, rôles cliniques seuls. */
export interface BedAssignment {
  id: number;
  bed: number;
  bed_name: string;
  room_name: string;
  assigned_at: string;
  released_at: string | null;
  created_at: string;
}

/** L'occupant d'un lit au tableau — `reason` seulement pour les cliniques. */
export interface OccupancyOccupant {
  stay: number;
  patient: number;
  patient_name: string;
  since: string;
  priority: StayPriority;
  reason?: string;
}

export interface OccupancyBed {
  id: number;
  name: string;
  is_active: boolean;
  occupant: OccupancyOccupant | null;
}

/** Photo INSTANTANÉE de l'occupation (jamais une série) — sert à admettre. */
export interface OccupancyRoom {
  id: number;
  name: string;
  is_active: boolean;
  beds: OccupancyBed[];
  /** Lits actifs sans occupant — déjà calculé par l'API. */
  free_beds: number;
}

/**
 * `GET /patients/me/stays/` — mes hospitalisations, tous centres confondus.
 * Payload volontairement court : **ni lit, ni priorité, ni motif d'annulation**
 * (ADR 0019 §5) — ce sont des données de gestion de service, écrites par le
 * staff pour le staff. L'histoire clinique se lit sur la consultation pivot.
 */
export interface PatientStay {
  id: number;
  center: number;
  center_name: string;
  encounter: number;
  admitted_at: string;
  discharged_at: string | null;
  status: StayStatus;
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

/* ══ S5 (ADR 0018) — abonnement SaaS et module Support ═══════════════════ */

/**
 * L'état commercial du tenant — **axe TOTALEMENT indépendant de `kyc_status`**
 * (décision 2 de l'ADR 0018). Un centre peut être vérifié et impayé, ou
 * suspendu au KYC et à jour de son abonnement : ne jamais fondre les deux
 * badges, ni les deux bandeaux.
 */
export type SubscriptionStatus =
  | 'essai'
  | 'actif'
  | 'impaye'
  | 'suspendu'
  | 'resilie';

export type BillingPeriod = 'mensuel' | 'annuel';

/** Facture SaaS Chioni → centre (série « A- » globale). */
export type SubscriptionInvoiceStatus = 'emise' | 'payee' | 'annulee';

/** Un règlement est reçu HORS LIGNE et saisi par l'exploitant Chioni. */
export type SubscriptionPaymentMethod =
  | 'virement'
  | 'especes'
  | 'mobile_money'
  | 'autre';

/** L'offre commerciale — même payload des deux côtés (tenant et plateforme). */
export interface SubscriptionPlan {
  id: number;
  code: string;
  name: string;
  /** Chaîne décimale KMF — francs ENTIERS (le backend refuse les décimales). */
  price_kmf: string;
  billing_period: BillingPeriod;
  /** `null` = illimité, jamais « zéro ». */
  included_practitioners: number | null;
  included_staff: number | null;
  is_active: boolean;
}

/**
 * Sièges consommés vs quotas de l'offre. **INDICATIF** (décision 3) : c'est un
 * signal commercial, jamais un levier de blocage — aucun formulaire ne se
 * désactive à cause d'un dépassement. Un siège = une PERSONNE, même avec deux
 * casquettes dans le centre.
 */
export interface SubscriptionUsage {
  staff: number;
  practitioners: number;
  included_staff: number | null;
  included_practitioners: number | null;
  /** Sous-ensemble de `["practitioners", "staff"]`. */
  exceeded: Array<'practitioners' | 'staff'>;
  over_quota: boolean;
}

/**
 * `GET /centers/{c}/subscription/` — **DIRECTEUR SEUL** (arbitrage réversible,
 * symétrique du dossier KYC et du journal d'audit). **404 = état NORMAL** :
 * tous les centres nés avant S5 n'ont pas de contrat, et « il n'y en a pas »
 * n'est pas une erreur.
 */
export interface CenterSubscription {
  id: number;
  status: SubscriptionStatus;
  /** Motif de la DERNIÈRE décision, écrit par Chioni POUR le directeur. */
  status_reason: string;
  started_at: string;
  current_period_end: string | null;
  status_updated_at: string | null;
  /** `true` pour `suspendu` et `resilie` SEULEMENT — `impaye` ne gèle RIEN. */
  is_frozen: boolean;
  plan: SubscriptionPlan;
  usage: SubscriptionUsage;
}

/**
 * Un règlement reçu par Chioni, tel que le CENTRE le lit. L'identité de
 * l'exploitant qui a saisi ou contre-passé ne traverse pas : le directeur
 * lirait une personne qu'il n'a aucun autre moyen de voir.
 */
export interface SubscriptionInvoicePayment {
  id: number;
  amount_kmf: string;
  method: SubscriptionPaymentMethod;
  reference: string;
  received_at: string;
  created_at: string;
  /** Règlement annulé par Chioni — vocabulaire écran : « annulé ». */
  reversed: boolean;
  /** Le pourquoi de l'annulation — le fait sans le motif serait pire qu'inutile. */
  reversal_reason: string | null;
}

/**
 * `GET /centers/{c}/subscription/invoices/` — **DIRECTEUR SEUL**, lecture
 * seule de bout en bout (c'est Chioni qui émet, encaisse et corrige : aucun
 * bouton d'action sur cet écran). Liste vide = 200, à la différence du contrat
 * lui-même dont l'absence est un 404.
 */
export interface CenterSubscriptionInvoice {
  id: number;
  /** Série « A- » GLOBALE Chioni — jamais un reçu « G- », jamais un id. */
  number: string;
  status: SubscriptionInvoiceStatus;
  period_start: string;
  period_end: string;
  amount_kmf: string;
  paid_kmf: string;
  /** DÉRIVÉ côté serveur : l'afficher, ne jamais le recalculer. */
  balance_kmf: string;
  due_date: string;
  plan_code: string;
  plan_label: string;
  created_at: string;
  cancelled_at: string | null;
  /** Écrit par CHIONI pour le directeur — contrairement à `Invoice.cancel_reason`. */
  cancel_reason: string;
  payments: SubscriptionInvoicePayment[];
}

/* ── support du centre (tout staff actif) ── */

export type SupportCategory = 'bug' | 'question' | 'facturation' | 'autre';

export type SupportTicketStatus = 'ouvert' | 'en_cours' | 'resolu' | 'ferme';

/** Déclarée à l'ouverture, et plus jamais modifiable (arbitrage lot 3). */
export type SupportPriority = 'basse' | 'normale' | 'haute' | 'urgente';

/** Posé par le SERVICE d'après la porte empruntée — jamais par le client. */
export type SupportSide = 'centre' | 'chioni';

export interface SupportMessage {
  id: number;
  author: number;
  author_side: SupportSide;
  /** `null` côté `chioni` : l'interlocuteur du centre est « Chioni », pas quelqu'un. */
  author_display: string | null;
  body: string;
  created_at: string;
}

/** Métadonnées seules — **jamais d'URL** (stockage privé, ADR 0016 §5). */
export interface SupportAttachment {
  id: number;
  uploaded_by: number;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  priority: SupportPriority;
  opened_by: number;
  opened_by_display: string | null;
  message_count: number;
  attachment_count: number;
  last_message_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Le détail embarque le fil complet : un écran de ticket coûte UNE requête. */
export interface SupportTicketDetail extends SupportTicket {
  messages: SupportMessage[];
  attachments: SupportAttachment[];
}

/* ── back-office : abonnements, factures SaaS, offres, tickets, exploitants ── */

export interface PlatformSubscription {
  id: number;
  center: number;
  center_name: string;
  status: SubscriptionStatus;
  status_reason: string;
  started_at: string;
  current_period_end: string | null;
  status_updated_at: string | null;
  is_frozen: boolean;
  plan: SubscriptionPlan;
  usage: SubscriptionUsage;
  created_at: string;
}

/** Le règlement côté back-office : deux champs de plus, tous deux des ids. */
export interface PlatformSubscriptionPayment extends SubscriptionInvoicePayment {
  invoice: number;
  recorded_by: number | null;
  reversed_by: number | null;
}

export interface PlatformSubscriptionInvoice {
  id: number;
  number: string;
  center: number;
  center_name: string;
  subscription: number;
  status: SubscriptionInvoiceStatus;
  period_start: string;
  period_end: string;
  amount_kmf: string;
  paid_kmf: string;
  balance_kmf: string;
  due_date: string;
  plan_code: string;
  plan_label: string;
  /** `null` = émission AUTOMATIQUE par la tâche planifiée, jamais un oubli. */
  issued_by: number | null;
  cancelled_at: string | null;
  cancelled_by: number | null;
  cancel_reason: string;
  reminders_sent: number;
  last_reminder_at: string | null;
  created_at: string;
  payments: PlatformSubscriptionPayment[];
}

/** Côté back-office, aucun humain n'est nommé — `author` est un id de compte. */
export interface PlatformSupportMessage {
  id: number;
  author: number;
  author_side: SupportSide;
  body: string;
  created_at: string;
}

export interface PlatformSupportTicket {
  id: number;
  center: number;
  center_name: string;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  priority: SupportPriority;
  opened_by: number;
  message_count: number;
  attachment_count: number;
  last_message_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSupportTicketDetail extends PlatformSupportTicket {
  messages: PlatformSupportMessage[];
  attachments: SupportAttachment[];
}

/**
 * Un exploitant Chioni — **des IDS, rien d'autre** (contrat verrouillé) : un
 * compte ombre porte son numéro dans son username, et rendre ce username
 * publierait discrètement un téléphone. L'écran affiche « Exploitant n° … » ;
 * c'est austère et assumé.
 */
export interface PlatformOperator {
  id: number;
  user: number;
  role: PlatformRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* ── ressources humaines (S7, ADR 0020 — `centers/{c}/hrm/…`) ─────────────
   Trois règles gouvernent ces types, et elles viennent du backend :
   1. le pivot est `Employment` (un dossier par personne et par centre),
      JAMAIS `StaffMembership` — un médecin qui est aussi directeur porte
      deux casquettes et **un seul** dossier ;
   2. le planning collectif ne dit jamais le régime d'une absence :
      `PublicAttendanceStatus` n'a pas de valeur `conge`, et il n'en aura
      jamais — le backend fond `absent` et `conge` avant d'écrire le payload ;
   3. rien de tout cela ne porte de motif en texte libre ni de rémunération. */

/** Le statut RÉEL d'une journée — feuille du directeur et données de la personne. */
export type AttendanceStatus = 'present' | 'absent' | 'conge' | 'repos' | 'ferie';

/**
 * Le statut vu par les COLLÈGUES (`…/hrm/schedule/`). `conge` est absent de
 * cette union **par construction** : le backend le fond dans `absent` (table
 * de traduction `serializers.PUBLIC_ATTENDANCE`). Ne jamais l'y rajouter, et
 * ne jamais recroiser deux appels pour « deviner » le régime — l'invariant
 * serait contourné par l'écran.
 */
export type PublicAttendanceStatus = 'present' | 'absent' | 'repos' | 'ferie';

/** Choix FERMÉS — il n'existe aucun champ « précisez » côté serveur. */
export type LeaveType =
  | 'annuel'
  | 'maladie'
  | 'maternite'
  | 'paternite'
  | 'deuil'
  | 'sans_solde'
  | 'autre';

/** `approuve`, `refuse` et `annule` sont TERMINAUX (machine à états fermée). */
export type LeaveStatus = 'demande' | 'approuve' | 'refuse' | 'annule';

/** Un service du centre. Libellé d'organisation — **aucun droit** n'en découle. */
export interface HrDepartment {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

/** Une fonction (« Sage-femme cheffe »). **Aucun droit** n'en découle non plus. */
export interface HrJobTitle {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
}

/** Un jour férié DU CENTRE (une clinique privée peut travailler un 14 août). */
export interface Holiday {
  id: number;
  date: string;
  name: string;
  created_at: string;
}

/**
 * Une ligne du planning collectif. Le payload est **exactement** ces quatre
 * champs : ni nom de service, ni type de congé, ni qui a noté la journée.
 * `status: null` = rien n'a été noté → « non renseigné », **jamais** « présent ».
 */
export interface ScheduleEntry {
  employment: number;
  display_name: string;
  job_title: string | null;
  status: PublicAttendanceStatus | null;
}

/** Le dossier RH d'une personne DANS ce centre (directeur seul). */
export interface Employment {
  id: number;
  /** Id de COMPTE (`row.user.id` de `GET /centers/{c}/staff/`), pas de membership. */
  user: number;
  user_display_name: string;
  department: number | null;
  department_name: string | null;
  job_title: number | null;
  job_title_name: string | null;
  hired_at: string;
  ended_at: string | null;
  is_running: boolean;
  created_at: string;
}

/**
 * Une journée de la feuille de présence. **Ni heure d'arrivée, ni heure de
 * départ, ni position** : le modèle n'a pas ces champs et n'en aura pas sans
 * arbitrage explicite (ADR 0020 décision 3). Ne pas construire de pointeuse.
 */
export interface AttendanceRecord {
  id: number;
  employment: number;
  employment_display_name: string;
  date: string;
  status: AttendanceStatus;
  noted_by: number | null;
  created_at: string;
}

/** Une demande de congé, côté directeur. `days` est un AFFICHAGE, pas un solde. */
export interface LeaveRequest {
  id: number;
  employment: number;
  employment_display_name: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  status: LeaveStatus;
  decided_by: number | null;
  decided_at: string | null;
  has_document: boolean;
  created_at: string;
}

/**
 * Un justificatif — **ni titre, ni type de pièce** : le congé porte déjà son
 * type fermé, et un intitulé libre (« certificat-oncologie ») rouvrirait par
 * la fenêtre le motif que l'ADR ferme par la porte. Aucune URL dans le
 * payload : le téléchargement passe par `apiDownload`.
 */
export interface LeaveDocument {
  id: number;
  leave: number;
  archived_at: string | null;
  created_at: string;
}

/**
 * Le dossier de LA PERSONNE (`…/hrm/me/`). Un **404** est un état NORMAL :
 * personne n'a de dossier avant que le directeur ne l'ouvre.
 */
export interface MyEmployment {
  id: number;
  center: number;
  center_name: string;
  department_name: string | null;
  job_title_name: string | null;
  hired_at: string;
  ended_at: string | null;
  is_running: boolean;
}

/** Ses journées à elle — statut RÉEL (`conge` compris), sans `noted_by`. */
export interface MyAttendanceRecord {
  id: number;
  date: string;
  status: AttendanceStatus;
}

/** Ses congés à elle — sans `decided_by` (le décideur n'est pas nommé). */
export interface MyLeaveRequest {
  id: number;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  status: LeaveStatus;
  decided_at: string | null;
  has_document: boolean;
  created_at: string;
}

/** Le décompte d'une journée (ou d'une personne) — série zéro-remplie. */
export interface AttendanceTally {
  present: number;
  absent: number;
  conge: number;
  repos: number;
  ferie: number;
  total: number;
}

export interface AttendanceStatsDay extends AttendanceTally {
  date: string;
}

export interface AttendanceStatsEmployment extends AttendanceTally {
  employment: number;
  display_name: string;
}

/**
 * Endpoint DÉDIÉ (`…/hrm/stats/attendance/`) — il n'y a **aucune** donnée RH
 * dans `stats/activity` ni `stats/finances`, ne pas y chercher.
 */
export interface AttendanceStats {
  from: string;
  to: string;
  days: AttendanceStatsDay[];
  totals: AttendanceTally;
  by_employment: AttendanceStatsEmployment[];
}

/* ── S8 — équipements (ADR 0021) ────────────────────────────────────────────
   Le plus petit domaine du produit : deux tables, quatre routes. Ni patient,
   ni argent, ni donnée personnelle — SAUF une, le nom de qui signale une
   panne, et c'est tout l'enjeu de typage de la section (voir
   `EquipmentReport`). */

/**
 * L'état officiel d'un appareil. `reforme` est **terminal** : la machine à
 * états backend est `en_service ⇄ en_panne`, et les deux → `reforme`.
 */
export type EquipmentStatus = 'en_service' | 'en_panne' | 'reforme';

export type EquipmentCategory =
  | 'diagnostic'
  | 'imagerie'
  | 'bloc_operatoire'
  | 'laboratoire'
  | 'mobilier_medical'
  | 'informatique'
  | 'autre';

/**
 * Une ligne de parc. **Une seule audience** : tout membre actif du centre lit
 * exactement cette fiche — un appareil n'a ni régime, ni secret médical, ni
 * argent, et le backend n'a qu'un sérialiseur de lecture.
 *
 * `location` est un **texte libre**, jamais une chambre d'hospitalisation
 * (ADR 0021 décision 2) : ne pas y brancher `inpatient/rooms/`.
 *
 * `report_count` / `last_report_at` sont des **compteurs de lecture** annotés
 * par la liste. Ils valent `0` / `null` dans la réponse d'une ÉCRITURE (POST,
 * PATCH, changement d'état) : ne jamais s'en servir pour décider d'un rendu
 * juste après une écriture — relire la liste.
 *
 * Aucun champ de valeur financière, aucune maintenance préventive, aucun champ
 * de responsabilité : ce sont des absences DÉCIDÉES (ADR 0021 décision 3), pas
 * des oublis. Un parc sert à réparer, pas à imputer.
 */
export interface Equipment {
  id: number;
  name: string;
  category: EquipmentCategory;
  serial_number: string;
  location: string;
  commissioned_on: string | null;
  status: EquipmentStatus;
  notes: string;
  report_count: number;
  last_report_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Un constat de panne. **Append-only** : un signalement ne se corrige pas et
 * ne se supprime pas — on en poste un second (« Corrigé : c'était le câble »).
 * Il n'a **aucun cycle de vie** (ni statut, ni « résolu ») : c'est l'ÉTAT de
 * l'équipement qui dit où on en est.
 *
 * ─── LA décision d'audience du sprint ───────────────────────────────────────
 *
 * Le backend rend DEUX payloads pour la même ligne :
 *
 * - **tout staff actif** → `{id, equipment, description, created_at}` : le
 *   constat et sa date, **sans son auteur** — ni nom, ni id ;
 * - **directeur** → les mêmes champs **plus** `reported_by` et
 *   `reported_by_display`.
 *
 * Les deux champs d'auteur sont donc `?:` — ils sont **absents** du payload
 * d'une infirmière, ils n'y valent pas `null`. L'écran REND ce qui arrive et
 * **ne réserve aucun emplacement** pour un auteur qu'il ne recevra pas : pas
 * de colonne vide, et surtout **jamais d'« Anonyme »** — l'absence d'auteur
 * n'est pas une donnée manquante, c'est une décision de produit (nommer le
 * signaleur devant toute l'équipe refroidirait la prochaine panne).
 *
 * Ne pas tenter de résoudre l'auteur par un autre appel : il n'est pas dans le
 * payload, et `GET /centers/{c}/staff/` est déjà directeur seul.
 */
export interface EquipmentReport {
  id: number;
  equipment: number;
  description: string;
  created_at: string;
  /** DIRECTEUR SEUL — absent (jamais `null`) pour toute autre casquette. */
  reported_by?: number;
  /** DIRECTEUR SEUL — absent (jamais `null`) pour toute autre casquette. */
  reported_by_display?: string;
}

/* ── S9 — le réseau des pharmacies (ADR 0022) ───────────────────────────────

   LE module où une donnée de soin franchit la frontière du centre vers un
   tiers qui n'a signé aucun consentement. Tout le typage de cette section
   sert **un seul invariant**, et il vaut pour le code du frontend autant que
   pour les types :

       une officine connaît une ZONE, une LISTE DE MÉDICAMENTS et un NUMÉRO
       de demande. Jamais le centre, jamais l'ordonnance, jamais le patient,
       jamais la posologie.

   Le backend ne les envoie pas — et les types ci-dessous ne réservent aucun
   emplacement pour eux. Ne pas « enrichir » un écran de pharmacie avec un nom
   de clinique : il n'y a rien à y brancher, et c'est délibéré. */

/**
 * Le cycle de vie d'une officine (machine fermée côté serveur) :
 * `en_attente → validee|suspendue`, `validee → suspendue|en_attente`,
 * `suspendue → validee`.
 *
 * `validee → en_attente` n'est PAS une sanction : c'est le retour en
 * vérification d'une officine qui a DÉCLARÉ un déménagement (revue guardian
 * S9), ou une plateforme qui revérifie sans suspendre.
 */
export type PharmacyStatus = 'en_attente' | 'validee' | 'suspendue';

/** Pièces justificatives d'une officine — photos seulement, le PDF est différé. */
export type PharmacyDocType =
  | 'registre_commerce'
  | 'licence_officine'
  | 'piece_identite_responsable'
  | 'autre';

/** Une recherche de disponibilité vit 48 h, puis se ferme toute seule. */
export type AvailabilityRequestStatus = 'ouverte' | 'close';

/**
 * Pourquoi une recherche s'est fermée. `''` tant qu'elle est ouverte.
 * `peremption` n'est **pas un échec** : le centre n'attend simplement plus.
 */
export type AvailabilityCloseReason = 'manuelle' | 'peremption' | '';

/**
 * Une officine telle que le centre et le patient la voient.
 *
 * Cinq champs publics par nature — c'est ce qu'une enseigne affiche sur sa
 * devanture. **Pas de statut** : l'annuaire ne rend que des officines
 * validées, donc le champ n'apprendrait rien, et il ferait de l'annuaire une
 * fenêtre sur les décisions de la plateforme.
 *
 * `phone` est **le geste utile** côté patient : un lien `tel:` avant tout le
 * reste (ADR 0022 décision 4 — on ne localise personne, il n'y a ni carte, ni
 * coordonnées, ni calcul de distance).
 */
export interface PharmacyDirectoryEntry {
  id: number;
  name: string;
  island: Island;
  city: string;
  address: string;
  phone: string;
}

/** Un médicament parti au réseau — copie FIGÉE du libellé, sans posologie. */
export interface AvailabilityItem {
  id: number;
  medication: string;
}

/** « Ce médicament-là : oui / non. » `item` = id d'un `AvailabilityItem`. */
export interface AvailabilityResponseLine {
  item: number;
  is_available: boolean;
}

/**
 * La réponse d'une officine, telle que le CENTRE la lit.
 *
 * Elle porte le `comment` (« j'ai le générique ») — texte libre écrit par un
 * tiers, utile au personnel, **et qui s'arrête ici** : il ne descend pas dans
 * le carnet du patient (ADR 0022 décision 3).
 */
export interface AvailabilityResponseCenter {
  id: number;
  pharmacy: PharmacyDirectoryEntry;
  comment: string;
  lines: AvailabilityResponseLine[];
  created_at: string;
}

/**
 * Une recherche vue du centre.
 *
 * `recipient_count` / `response_count` / `last_response_at` sont **annotés par
 * la liste** : ils valent `0`/`null` dans la réponse d'une création — relire
 * la liste plutôt que de s'y fier juste après un envoi.
 */
export interface AvailabilityRequestCenter {
  id: number;
  prescription: number;
  island: Island;
  city: string;
  status: AvailabilityRequestStatus;
  close_reason: AvailabilityCloseReason;
  items: AvailabilityItem[];
  recipient_count: number;
  response_count: number;
  last_response_at: string | null;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
}

/**
 * Le détail : la même, plus les réponses reçues (plus récente d'abord).
 *
 * **Plusieurs réponses d'une même officine sont NORMALES** — le stock bouge,
 * la dernière fait foi, l'historique reste. Ne jamais présenter une correction
 * comme une contradiction.
 */
export interface AvailabilityRequestCenterDetail extends AvailabilityRequestCenter {
  responses: AvailabilityResponseCenter[];
}

/** La réponse telle que le PATIENT la lit — volontairement SANS `comment`. */
export interface AvailabilityResponsePatient {
  id: number;
  pharmacy: PharmacyDirectoryEntry;
  lines: AvailabilityResponseLine[];
  created_at: string;
}

/**
 * Une recherche dans le carnet du patient — **lecture seule**.
 *
 * Le patient ne lance pas de recherche (arbitrage PO S9 : c'est le médecin ou
 * le pharmacien du centre, en fin de consultation). Ne pas construire de
 * bouton « chercher mes médicaments ».
 */
export interface AvailabilityRequestPatient {
  id: number;
  status: AvailabilityRequestStatus;
  city: string;
  island: Island;
  items: AvailabilityItem[];
  responses: AvailabilityResponsePatient[];
  created_at: string;
  expires_at: string;
}

/**
 * L'officine telle qu'elle se voit elle-même (5ᵉ espace).
 *
 * `status_reason` est la consigne écrite par Chioni — miroir exact du
 * `kyc_reason` d'un directeur de centre : suspendre quelqu'un sans lui dire ce
 * qu'il doit corriger n'est pas une décision, c'est une punition. L'afficher
 * en toutes lettres.
 */
export interface PharmacySelf {
  id: number;
  name: string;
  island: Island;
  city: string;
  address: string;
  phone: string;
  email: string;
  status: PharmacyStatus;
  status_reason: string;
  status_updated_at: string | null;
  created_at: string;
}

/**
 * Un membre de l'officine. **Aucun rôle, aucune hiérarchie** (ADR 0022 §12) :
 * une officine comorienne compte une à trois personnes qui font le même
 * travail. Tout membre actif répond, dépose les pièces et inscrit un collègue.
 *
 * Pas de téléphone : il a servi à créer le compte (pivot d'identité) et n'a
 * aucune raison de circuler dans une liste.
 */
export interface PharmacyMember {
  id: number;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

/** Une pièce justificative — **jamais d'URL** (stockage privé, `apiDownload`). */
export interface PharmacyDocument {
  id: number;
  doc_type: PharmacyDocType;
  created_at: string;
  archived_at: string | null;
}

/** Ce que CETTE officine a déjà répondu — jamais ce que les autres ont dit. */
export interface InboxResponse {
  id: number;
  comment: string;
  lines: AvailabilityResponseLine[];
  created_at: string;
}

/**
 * **LA liste blanche du sprint.** Ce qu'une pharmacie voit d'une demande.
 *
 * `id` est celui de la **ligne de diffusion**, pas de la demande. Et il n'y a
 * RIEN d'autre : ni centre, ni ordonnance, ni patient, ni prescripteur, ni
 * posologie — le backend n'a aucun chemin pour les ajouter (sérialiseur nu
 * monté sur la ligne de diffusion, pas sur la demande).
 *
 * `my_response` vaut `null` tant que l'officine n'a pas répondu. **Répondre à
 * nouveau est prévu et normal** : le bouton reste « Mettre à jour ma
 * réponse », jamais grisé après le premier envoi.
 */
export interface InboxRequest {
  id: number;
  island: Island;
  city: string;
  status: AvailabilityRequestStatus;
  created_at: string;
  expires_at: string;
  items: AvailabilityItem[];
  my_response: InboxResponse | null;
}

/**
 * Une officine vue du back-office Chioni.
 *
 * Des **compteurs**, jamais une liste de personnes ni un médicament : savoir
 * qu'une pharmacie n'a plus aucun membre actif est de la supervision (sa boîte
 * de réception n'est plus relevée) ; parcourir ses gens, ou lire les
 * ordonnances du pays, ne l'est pas. `received_request_count` n'ouvre sur rien.
 */
export interface PlatformPharmacy {
  id: number;
  name: string;
  island: Island;
  city: string;
  address: string;
  phone: string;
  email: string;
  status: PharmacyStatus;
  status_reason: string;
  status_updated_at: string | null;
  member_active_count: number;
  document_count: number;
  received_request_count: number;
  created_at: string;
}

/** La création rend l'officine ET sa première personne, en un appel. */
export interface PlatformPharmacyCreated extends PlatformPharmacy {
  member: PharmacyMember;
}
