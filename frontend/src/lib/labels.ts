/*
 * Chioni — French labels for every API enum + shared formatters.
 *
 * The API returns raw enum values ("actif", "medecin"…) — every screen goes
 * through these maps so wording stays consistent and the future shikomori
 * i18n has a single extraction point.
 */

import type {
  AppointmentStatus,
  BloodGroup,
  CashMethod,
  CenterType,
  ClaimStatus,
  ConsentCollectedVia,
  ConsentScope,
  Currency,
  DisputeStatus,
  EncounterStatus,
  GenericCategory,
  GuardianLinkStatus,
  InitiatedBy,
  InvoiceStatus,
  Island,
  KycStatus,
  MobileMoneyOperator,
  PatientDocumentType,
  PaymentIntentStatus,
  PaymentRequestStatus,
  PrescriptionStatus,
  RecordEntryType,
  Relationship,
  Sex,
  StaffRole,
  UnpaidOrdering,
  VitalSignsMeasures,
} from './types';

/* ── enum labels ── */

export const GUARDIAN_LINK_STATUS_LABELS: Record<GuardianLinkStatus, string> = {
  invitation_envoyee: 'Invitation envoyée',
  attente_confirmation_titulaire: 'En attente de votre confirmation',
  actif: 'Actif',
  revoque: 'Révoqué',
};

export const PAYMENT_REQUEST_STATUS_LABELS: Record<PaymentRequestStatus, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  soin_confirme: 'Soin confirmé',
  cloturee: 'Clôturée',
  litige: 'En litige',
};

/* Reader-oriented payment-request statuses. The generic labels above speak
   from the centre's point of view ; the patient and guardian spaces speak
   from THEIR reader's point of view — centralised here so wording stays
   consistent and ready for the shikomori extraction. */

/** Statuses as the PATIENT reads them. */
export const PR_STATUS_PATIENT: Record<PaymentRequestStatus, string> = {
  brouillon: 'En préparation',
  envoyee: 'En attente de paiement',
  payee: 'Payée',
  soin_confirme: 'Soin confirmé',
  cloturee: 'Terminée',
  litige: 'Litige en cours',
};

/** Statuses as the GUARDIAN reads them (full sentences). */
export const PR_STATUS_TUTEUR: Record<PaymentRequestStatus, string> = {
  brouillon: 'En préparation', // defensive: drafts are never shared with guardians
  envoyee: 'À payer',
  payee: 'Payée — en attente de confirmation du soin',
  soin_confirme: 'Soin confirmé',
  cloturee: 'Terminée — reçu disponible',
  litige: 'Litige en cours',
};

/** Short guardian variants for tight spots (badges in dense lists). */
export const PR_STATUS_TUTEUR_SHORT: Record<PaymentRequestStatus, string> = {
  brouillon: 'En préparation',
  envoyee: 'À payer',
  payee: 'Payée',
  soin_confirme: 'Soin confirmé',
  cloturee: 'Terminée',
  litige: 'Litige',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  brouillon: 'Brouillon',
  emise: 'Émise',
  payee: 'Payée',
  annulee: 'Annulée',
};

export const ENCOUNTER_STATUS_LABELS: Record<EncounterStatus, string> = {
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
};

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  emise: 'Émise',
  delivree: 'Délivrée',
};

export const RECORD_ENTRY_TYPE_LABELS: Record<RecordEntryType, string> = {
  antecedent: 'Antécédent',
  allergie: 'Allergie',
  traitement_en_cours: 'Traitement en cours',
  vaccination: 'Vaccination',
  /* S3 — plain enough for both the clinical forms and the patient's carnet. */
  chirurgie: 'Chirurgie / hospitalisation',
  antecedent_familial: 'Antécédent familial',
  observation: 'Observation',
};

/* ── S3 — enriched patient record (ADR 0016) ── */

/** The 8 recordable blood groups, in form order ('' = not recorded). */
export const BLOOD_GROUPS: Exclude<BloodGroup, ''>[] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  '': 'Non renseigné',
  'A+': 'A+',
  'A-': 'A−',
  'B+': 'B+',
  'B-': 'B−',
  'AB+': 'AB+',
  'AB-': 'AB−',
  'O+': 'O+',
  'O-': 'O−',
};

/** Document categories — simple French, shared by both spaces. */
export const DOC_TYPE_LABELS: Record<PatientDocumentType, string> = {
  resultat_biologie: "Résultat d'analyses",
  imagerie: 'Imagerie',
  compte_rendu: 'Compte rendu',
  autre: 'Autre document',
};

/** Vital-sign field definitions: form label + displayed unit + input mode. */
export interface VitalSignDef {
  key: keyof VitalSignsMeasures;
  /** Full label for the clinical entry form. */
  label: string;
  /** Unit shown next to the label and after values. */
  unit: string;
  /** Decimal measure (comma accepted, sent with a dot) vs whole number. */
  decimal: boolean;
}

export const VITAL_SIGN_DEFS: VitalSignDef[] = [
  { key: 'systolic_bp', label: 'Tension systolique', unit: 'mmHg', decimal: false },
  { key: 'diastolic_bp', label: 'Tension diastolique', unit: 'mmHg', decimal: false },
  { key: 'heart_rate', label: 'Fréquence cardiaque', unit: 'bpm', decimal: false },
  { key: 'spo2', label: 'Saturation (SpO₂)', unit: '%', decimal: false },
  { key: 'temperature_c', label: 'Température', unit: '°C', decimal: true },
  { key: 'respiratory_rate', label: 'Fréquence respiratoire', unit: '/min', decimal: false },
  { key: 'weight_kg', label: 'Poids', unit: 'kg', decimal: true },
  { key: 'height_cm', label: 'Taille', unit: 'cm', decimal: false },
];

const VITAL_VALUE_FORMAT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** "37.2" | 37 → "37,2" (French decimals, superfluous zeros dropped). */
function formatVitalNumber(value: number | string): string {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return String(value);
  return VITAL_VALUE_FORMAT.format(parsed);
}

/**
 * Compact French summary of one vital-signs reading — the measures actually
 * taken, in plain words shared by the clinical list and the patient carnet.
 * Blood pressure merges into one item when both bounds are present.
 * `plain: true` (patient side) drops the clinical jargon: no mmHg, « SpO₂ »
 * becomes « Oxygène » — « Tension 120/80 » reads the way the nurse says it.
 */
export function vitalSummary(v: VitalSignsMeasures, opts?: { plain?: boolean }): string[] {
  const plain = opts?.plain === true;
  const parts: string[] = [];
  if (v.systolic_bp !== null && v.diastolic_bp !== null) {
    parts.push(plain ? `Tension ${v.systolic_bp}/${v.diastolic_bp}` : `Tension ${v.systolic_bp}/${v.diastolic_bp} mmHg`);
  } else if (v.systolic_bp !== null) {
    parts.push(plain ? `Tension ${v.systolic_bp}` : `Tension (systolique) ${v.systolic_bp} mmHg`);
  } else if (v.diastolic_bp !== null) {
    parts.push(plain ? `Tension ${v.diastolic_bp}` : `Tension (diastolique) ${v.diastolic_bp} mmHg`);
  }
  if (v.heart_rate !== null) parts.push(`Pouls ${v.heart_rate}/min`);
  if (v.spo2 !== null) parts.push(`${plain ? 'Oxygène' : 'SpO₂'} ${v.spo2} %`);
  if (v.temperature_c !== null) parts.push(`Température ${formatVitalNumber(v.temperature_c)} °C`);
  if (v.respiratory_rate !== null) parts.push(`Respiration ${v.respiratory_rate}/min`);
  if (v.weight_kg !== null) parts.push(`Poids ${formatVitalNumber(v.weight_kg)} kg`);
  if (v.height_cm !== null) parts.push(`Taille ${v.height_cm} cm`);
  return parts;
}

export const PAYMENT_INTENT_STATUS_LABELS: Record<PaymentIntentStatus, string> = {
  cree: 'Créé',
  en_cours: 'En cours',
  reussi: 'Réussi',
  echoue: 'Échoué',
  annule: 'Annulé',
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  ouvert: 'Ouvert',
  resolu: 'Résolu',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  prevu: 'Prévu',
  arrive: 'Arrivé',
  honore: 'Honoré',
  manque: 'Manqué',
  annule: 'Annulé',
};

/** Appointment statuses as the PATIENT reads them — plain words, no desk
    jargon (« honoré » stays a staff word), gender-neutral phrasing (« Vous
    êtes arrivé » would misgender half the readers). */
export const APPOINTMENT_STATUS_PATIENT: Record<AppointmentStatus, string> = {
  prevu: 'Prévu',
  arrive: 'Vous êtes sur place',
  honore: 'Passé',
  manque: 'Manqué',
  annule: 'Annulé',
};

export const CASH_METHOD_LABELS: Record<CashMethod, string> = {
  especes: 'Espèces',
  mobile_money: 'Mobile money',
  pont_confiance: 'Pont de Confiance',
};

/** Cash methods as the PATIENT reads them (counter receipts). */
export const CASH_METHOD_PATIENT: Record<CashMethod, string> = {
  especes: 'Payé en espèces',
  mobile_money: 'Payé par mobile money',
  pont_confiance: 'Payé par un proche',
};

/** Cash-in state as the CENTRE reads it (cash journal + invoice caisse). */
export const CASH_PAYMENT_STATE_LABELS = {
  encaisse: 'Encaissé',
  contre_passe: 'Contre-passé',
} as const;

/** Reversed counter receipt as the PATIENT reads it — plain words, no
    accounting jargon (« contre-passation » never reaches the patient). */
export const CASH_RECEIPT_REVERSED_PATIENT = 'Annulé';

export const MOBILE_OPERATOR_LABELS: Record<MobileMoneyOperator, string> = {
  huri: 'Huri Money',
  mvola: 'MVola',
  autre: 'Autre opérateur',
};

export const UNPAID_ORDERING_LABELS: Record<UnpaidOrdering, string> = {
  '-balance': 'Solde le plus élevé d’abord',
  balance: 'Solde le plus faible d’abord',
  '-age': 'Les plus anciennes d’abord',
  age: 'Les plus récentes d’abord',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  directeur: 'Directeur',
  medecin: 'Médecin',
  infirmier: 'Infirmier',
  sage_femme: 'Sage-femme',
  secretaire: 'Secrétaire',
  caissier: 'Caissier',
  pharmacien: 'Pharmacien',
};

export const GENERIC_CATEGORY_LABELS: Record<GenericCategory, string> = {
  consultation: 'Consultation',
  analyses_examens: 'Analyses et examens',
  medicaments: 'Médicaments',
  hospitalisation: 'Hospitalisation',
  acte_technique: 'Acte technique',
  soins_infirmiers: 'Soins infirmiers',
  maternite: 'Maternité',
  autre: 'Autre',
};

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  parent: 'Parent',
  enfant: 'Enfant',
  conjoint: 'Conjoint / conjointe',
  frere_soeur: 'Frère / sœur',
  famille_elargie: 'Famille élargie',
  ami: 'Ami / amie',
  autre: 'Autre',
};

export const INITIATED_BY_LABELS: Record<InitiatedBy, string> = {
  tuteur: 'Par le proche',
  patient: 'Par le patient',
  centre: 'Par le centre',
};

export const CONSENT_SCOPE_LABELS: Record<ConsentScope, string> = {
  paiements: 'Paiements',
  detail_clinique: 'Détail des soins',
};

/** How a desk-collected clinical consent was gathered (S2). */
export const CONSENT_COLLECTED_VIA_LABELS: Record<ConsentCollectedVia, string> = {
  papier: 'Formulaire papier signé',
  oral: 'Accord oral',
};

/** Currencies as the guardian reads them (profile preference). */
export const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: 'Euro (€)',
  KMF: 'Franc comorien (KMF)',
};

/**
 * ISO-3166 alpha-2 codes offered in the guardian's country-of-residence
 * select — the main Comorian-diaspora countries first, then the region.
 * Display names come from countryName() (Intl), so only the CODES live here;
 * the backend accepts any valid ISO-2 code.
 */
export const RESIDENCE_COUNTRY_CODES: string[] = [
  'FR', 'BE', 'CH', 'DE', 'GB', 'IT', 'ES', 'NL', 'LU', 'CA', 'US',
  'AE', 'SA', 'MG', 'MU', 'TZ', 'KE', 'ZA', 'KM',
];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  non_revendique: 'Dossier géré au guichet',
  invite: 'Invitation envoyée',
  actif: 'Compte activé',
};

export const ISLAND_LABELS: Record<Island, string> = {
  ngazidja: 'Ngazidja (Grande Comore)',
  ndzuwani: 'Ndzuwani (Anjouan)',
  mwali: 'Mwali (Mohéli)',
};

export const CENTER_TYPE_LABELS: Record<CenterType, string> = {
  hopital_public: 'Hôpital public',
  clinique_privee: 'Clinique privée',
  centre_sante: 'Centre de santé',
  cabinet: 'Cabinet',
  pharmacie: 'Pharmacie',
};

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  en_attente: 'Vérification en attente',
  actif: 'Vérifié',
  suspendu: 'Suspendu',
};

/** Sex labels when speaking OF A THIRD PERSON (staff forms, protégé forms). */
export const SEX_LABELS: Record<Sex, string> = {
  f: 'Féminin',
  m: 'Masculin',
  '': 'Non renseigné',
};

/** Sex labels when the user speaks OF THEMSELVES. */
export const SEX_LABELS_SELF: Record<Sex, string> = {
  f: 'Féminin',
  m: 'Masculin',
  '': 'Je préfère ne pas le dire',
};

/* ── formatters ── */

const KMF_NUMBER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const KMF_NUMBER_DECIMALS = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const EUR_FORMAT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/**
 * Format a decimal-string KMF amount ("15000.00" → "15 000 KMF").
 * Whole amounts drop the superfluous decimals; genuine cents are kept.
 */
export function formatKmf(amount: string): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return `${amount} KMF`;
  const isWhole = Number.isInteger(value);
  return `${(isWhole ? KMF_NUMBER : KMF_NUMBER_DECIMALS).format(value)} KMF`;
}

/** Format a decimal-string EUR amount ("12.5" → "12,50 €"). */
export function formatEur(amount: string): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return `${amount} €`;
  return EUR_FORMAT.format(value);
}

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "2026-08-13" or ISO datetime → "13 août 2026". */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMAT.format(date);
}

/** ISO datetime → "13 août 2026, 14:05". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME_FORMAT.format(date);
}

const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const WEEKDAY_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });

/** 20 → "20 min" (appointment durations). */
export function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

/** ISO datetime → "14:05" (the agenda's column). */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIME_FORMAT.format(date);
}

/** "2026-08-13" → "jeudi 13 août 2026" (day-navigation headers). */
export function formatWeekdayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return WEEKDAY_DATE_FORMAT.format(date);
}

const WEEKDAY_DATE_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** ISO datetime → "jeudi 13 août 2026, 09:30" (patient-facing appointments —
    the weekday is what makes a date graspable at a glance). */
export function formatWeekdayDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return WEEKDAY_DATE_TIME_FORMAT.format(date);
}

/** "2026-08-13" → "13/08" (chart axis categories). */
export function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return SHORT_DATE_FORMAT.format(date);
}

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** "2026-08-01" → "août 2026" (calendar month heading). */
export function formatMonthYear(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return MONTH_YEAR_FORMAT.format(date);
}

const WEEKDAY_SHORT_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

/** Monday-first short weekday names ("lun." … "dim.") — calendar grid header.
    2024-01-01 is a Monday, so the names come from the locale, not from a
    hard-coded list (single extraction point for the shikomori i18n). */
export const WEEKDAY_SHORT_NAMES: string[] = Array.from({ length: 7 }, (_, i) =>
  WEEKDAY_SHORT_FORMAT.format(new Date(`2024-01-0${1 + i}T12:00:00`)),
);

/** French plural forms of the appointment statuses, for day-cell counters. */
const APPOINTMENT_STATUS_COUNT_FORMS: Record<AppointmentStatus, [string, string]> = {
  prevu: ['prévu', 'prévus'],
  arrive: ['arrivé', 'arrivés'],
  honore: ['honoré', 'honorés'],
  manque: ['manqué', 'manqués'],
  annule: ['annulé', 'annulés'],
};

/** ("prevu", 3) → "3 prévus" — calendar day-cell counter. */
export function appointmentCountLabel(status: AppointmentStatus, count: number): string {
  return `${count} ${APPOINTMENT_STATUS_COUNT_FORMS[status][count > 1 ? 1 : 0]}`;
}

/** Overflow line of a calendar day cell: 1 → "+1 autre", 3 → "+3 autres". */
export function moreAppointmentsLabel(count: number): string {
  return count > 1 ? `+${count} autres` : '+1 autre';
}

/** Percentage string from the API ("66.7") → "66,7 %" ; null → "—". */
export function formatPct(pct: string | null): string {
  if (pct === null) return '—';
  const value = Number.parseFloat(pct);
  if (!Number.isFinite(value)) return '—';
  return `${RATE_FORMAT_1.format(value)} %`;
}

const RATE_FORMAT_1 = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Today's LOCAL calendar date as "YYYY-MM-DD" (feeds `?date=` params). */
export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Shift a "YYYY-MM-DD" date by ±n days (local calendar, DST-safe at noon). */
export function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Mask a phone number for display: '+2693390011' → '+269 ••• ••11'.
 * The country prefix is ALWAYS kept whole (never truncated to '+3') and the
 * last two digits stay visible ; everything else is masked.
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.startsWith('+269') && cleaned.length >= 8) {
    return `+269 ••• ••${cleaned.slice(-2)}`;
  }
  if (cleaned.startsWith('+') && cleaned.length >= 6) {
    // Foreign numbers: keep the country code whole. Zone 1/7 codes are one
    // digit (+1, +7) ; zone 2 codes are mostly three digits (+261, +212…) ;
    // the common diaspora codes elsewhere are two digits (+33, +32, +49…).
    const prefixLen = /^\+[17]/.test(cleaned) ? 2 : /^\+2/.test(cleaned) ? 4 : 3;
    return `${cleaned.slice(0, prefixLen)} ••• ••${cleaned.slice(-2)}`;
  }
  if (cleaned.length >= 4) {
    return `••• ••${cleaned.slice(-2)}`;
  }
  return cleaned;
}

/**
 * Human wait duration for throttling messages: 45 → "45 secondes",
 * 720 → "environ 12 minutes", 3900 → "environ une heure".
 */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return s === 1 ? '1 seconde' : `${s} secondes`;
  if (s < 3600) {
    const m = Math.max(1, Math.round(s / 60));
    return m === 1 ? 'environ une minute' : `environ ${m} minutes`;
  }
  const h = Math.max(1, Math.round(s / 3600));
  return h === 1 ? 'environ une heure' : `environ ${h} heures`;
}

const RATE_FORMAT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "491.967800" → "1 € = 491,97 KMF". */
export function formatRate(rate: string): string {
  const value = Number.parseFloat(rate);
  if (!Number.isFinite(value)) return `1 € = ${rate} KMF`;
  return `1 € = ${RATE_FORMAT.format(value)} KMF`;
}

/** ISO-3166 alpha-2 → French country name ("FR" → "France"). */
export function countryName(code: string): string {
  if (!code) return 'Non renseigné';
  try {
    const names = new Intl.DisplayNames(['fr'], { type: 'region' });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
