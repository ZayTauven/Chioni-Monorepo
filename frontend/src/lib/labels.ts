/*
 * Chioni — French labels for every API enum + shared formatters.
 *
 * The API returns raw enum values ("actif", "medecin"…) — every screen goes
 * through these maps so wording stays consistent and the future shikomori
 * i18n has a single extraction point.
 */

import type {
  CenterType,
  ClaimStatus,
  ConsentScope,
  DisputeStatus,
  EncounterStatus,
  GenericCategory,
  GuardianLinkStatus,
  InitiatedBy,
  InvoiceStatus,
  Island,
  KycStatus,
  PaymentIntentStatus,
  PaymentRequestStatus,
  PrescriptionStatus,
  RecordEntryType,
  Relationship,
  Sex,
  StaffRole,
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
};

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

export const SEX_LABELS: Record<Sex, string> = {
  f: 'Féminin',
  m: 'Masculin',
  '': 'Non renseigné',
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

/**
 * Mask a phone number for display: '+2693390011' → '+269 ••• ••11'.
 * Keeps the +269 prefix and the last two digits; other formats keep only
 * the last two digits visible.
 */
export function maskPhone(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.startsWith('+269') && cleaned.length >= 8) {
    return `+269 ••• ••${cleaned.slice(-2)}`;
  }
  if (cleaned.length >= 4) {
    return `${cleaned.slice(0, 2)} ••• ••${cleaned.slice(-2)}`;
  }
  return cleaned;
}
