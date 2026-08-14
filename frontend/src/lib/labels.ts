/*
 * Chioni — French labels for every API enum + shared formatters.
 *
 * The API returns raw enum values ("actif", "medecin"…) — every screen goes
 * through these maps so wording stays consistent and the future shikomori
 * i18n has a single extraction point.
 */

import type {
  AppointmentStatus,
  AuditAction,
  BloodGroup,
  CashMethod,
  CenterType,
  ClaimStatus,
  ConsentCollectedVia,
  ConsentScope,
  Currency,
  DisputeStatus,
  EncounterStatus,
  ErasureBlocker,
  ErasureStatus,
  GenericCategory,
  GuardianLinkStatus,
  IncidentCode,
  InitiatedBy,
  InvoiceStatus,
  Island,
  KycDocType,
  KycStatus,
  MobileMoneyOperator,
  PatientDocumentType,
  PaymentIntentStatus,
  PaymentRequestStatus,
  PlatformRole,
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

/* ══ S4 (ADR 0017) — plateforme, KYC, journal d'audit, RGPD ══════════════ */

/* ── casquette exploitant ── */

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  support: 'Support',
  admin: 'Administrateur',
};

/** Ce que chaque rôle peut faire — affiché sous le nom du rôle. */
export const PLATFORM_ROLE_HELP: Record<PlatformRole, string> = {
  support: 'Vous consultez les centres, les incidents de paiement et les demandes d’effacement.',
  admin: 'Vous pouvez créer un centre, changer une vérification et traiter une demande d’effacement.',
};

/** Refus d'écriture rendu à un `support` (jamais de bouton fantôme). */
export const PLATFORM_READ_ONLY_NOTICE =
  'Lecture seule : les actions sont réservées aux administrateurs de la plateforme Chioni.';

/* ── pièces justificatives du KYC ── */

export const KYC_DOC_TYPE_LABELS: Record<KycDocType, string> = {
  registre_commerce: 'Registre du commerce',
  licence_sante: 'Licence sanitaire',
  piece_identite_directeur: 'Pièce d’identité du directeur',
  autre: 'Autre pièce',
};

/* ── effets réels d'un statut KYC (arbitrage PO n° 1 du sprint S4) ─────────
   Le mot « suspendu » a un sens BORNÉ : il ferme le Pont de Confiance, il ne
   renvoie jamais un centre au papier. Ces phrases sont le cœur produit du
   sprint — elles vivent ici pour être dites à l'identique partout (bandeau du
   dashboard, carte Vérification, modale de suspension côté plateforme). */

/** Ce qui continue de fonctionner, quel que soit le statut KYC. */
export const KYC_STILL_WORKS =
  'Les soins, le carnet, les rendez-vous, la facturation et la caisse du centre (espèces et mobile money, avec reçu) continuent normalement.';

/** Ce qui est fermé tant que le centre n'est pas vérifié / est suspendu. */
export const KYC_CLOSED_RAIL =
  'Seuls les paiements de la diaspora (Pont de Confiance) sont fermés : aucune nouvelle demande de paiement ne peut être créée, partagée ni envoyée.';

/** Titre du bandeau, par statut — jamais « erreur », jamais « panne ». */
export const KYC_BANNER_TITLE: Record<KycStatus, string> = {
  en_attente: 'Pont de Confiance en attente de vérification',
  actif: 'Centre vérifié',
  suspendu: 'Pont de Confiance suspendu',
};

/** Phrase d'ouverture du bandeau, par statut. */
export const KYC_BANNER_LEAD: Record<KycStatus, string> = {
  en_attente:
    'La vérification de votre centre par l’équipe Chioni est en cours.',
  actif:
    'Votre centre est vérifié : les paiements de la diaspora sont encaissés directement par le centre, en francs comoriens, avec un reçu pour chaque franc.',
  suspendu:
    'Les paiements de la diaspora sont suspendus pour votre centre par l’équipe Chioni.',
};

/** Ce que la plateforme rappelle à l'exploitant avant de suspendre un centre. */
export const KYC_SUSPEND_WARNING =
  'Suspendre ferme le Pont de Confiance : plus aucune demande de paiement ne peut être créée, partagée ni envoyée à la diaspora. Le centre continue de soigner ses patients, de facturer et d’encaisser au guichet — un paiement déjà abouti va jusqu’à son reçu.';

/** Ce que la plateforme rappelle avant d'activer un centre. */
export const KYC_ACTIVATE_NOTICE =
  'Activer ouvre le Pont de Confiance : le centre pourra demander à la diaspora de payer les soins de ses patients, et recevra 100 % du montant en francs comoriens.';

/**
 * Titre du bloc portant le motif de la dernière décision KYC, lu par le
 * DIRECTEUR SEUL. `kyc_reason` porte le motif de la dernière décision, quelle
 * qu'elle soit : après une activation, « Que faire ? » sonnerait comme un
 * reproche adressé à quelqu'un qui vient d'être validé.
 */
export const KYC_REASON_TITLE: Record<KycStatus, string> = {
  en_attente: 'Ce que l’équipe Chioni attend de vous',
  actif: 'Message de l’équipe Chioni',
  suspendu: 'Ce qu’il faut corriger',
};

/** Rappel de confidentialité du motif — il n'est lu que par le directeur. */
export const KYC_REASON_PRIVACY =
  'Ce message vous est adressé à vous seul : ni vos patients ni leurs proches ne le voient.';

/* ── incidents de paiement PSP (réconciliation plateforme) ── */

export const INCIDENT_LABELS: Record<IncidentCode, string> = {
  webhook_intent_not_payable: 'Paiement abouti sur une intention déjà close',
  webhook_request_not_payable: 'Paiement abouti sur une demande qui n’attendait plus',
  webhook_invoice_cancelled: 'Paiement abouti sur une facture annulée',
  webhook_balance_changed: 'Paiement abouti après un encaissement au guichet',
  intent_stale_cancelled: 'Intention abandonnée, annulée automatiquement',
  intent_failed: 'Échec signalé par le prestataire de paiement',
};

/** Ce que l'incident coûte — la colonne « conséquence » de la liste. */
export const INCIDENT_IMPACT: Record<IncidentCode, string> = {
  webhook_intent_not_payable: 'Le proche a peut-être été débité sans reçu — à vérifier chez le prestataire.',
  webhook_request_not_payable: 'Le proche a peut-être été débité sans reçu — à vérifier chez le prestataire.',
  webhook_invoice_cancelled: 'Le proche a peut-être été débité sans reçu — à vérifier chez le prestataire.',
  webhook_balance_changed: 'Le proche a peut-être été débité sans reçu — à vérifier chez le prestataire.',
  intent_stale_cancelled: 'Aucun débit attendu — à annuler côté prestataire.',
  intent_failed: 'Aucun débit attendu.',
};

/** Ordre d'affichage du sélecteur — les débits possibles d'abord. */
export const INCIDENT_CODES: IncidentCode[] = [
  'webhook_intent_not_payable',
  'webhook_request_not_payable',
  'webhook_invoice_cancelled',
  'webhook_balance_changed',
  'intent_stale_cancelled',
  'intent_failed',
];

/** Libellés FR des références techniques d'un incident. */
export const INCIDENT_REF_LABELS: Record<string, string> = {
  intent_id: 'Intention',
  payment_request_id: 'Demande',
  invoice_id: 'Facture',
  intent_status: 'État de l’intention',
  request_status: 'État de la demande',
  intent_kmf: 'Montant de l’intention',
  balance_kmf: 'Solde de la facture',
};

/* ── journal d'audit du centre (directeur seul) ──────────────────────────
   Ce dictionnaire EST le sélecteur d'action : une valeur hors liste blanche
   renvoie 400 « Action inconnue. » côté API — ne jamais proposer autre chose,
   et ne jamais laisser deviner ce qui existe mais reste caché. */

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'staff.membership_created': 'Membre ajouté',
  'staff.membership_updated': 'Membre modifié',
  'staff.membership_deactivated': 'Membre désactivé',
  'staff.membership_reactivated': 'Membre réactivé',
  'center.created': 'Centre créé',
  'center.updated': 'Centre modifié',
  'center.kyc_changed': 'Vérification (KYC) modifiée',
  'kyc_document.uploaded': 'Pièce justificative déposée',
  'kyc_document.archived': 'Pièce justificative archivée',
  'tariff.created': 'Tarif créé',
  'tariff.updated': 'Tarif modifié',
  'invoice.created': 'Facture créée',
  'invoice.issued': 'Facture émise',
  'invoice.cancelled': 'Facture annulée',
  'payment_request.created': 'Demande de paiement créée',
  'payment_request.sent': 'Demande de paiement envoyée',
  'payment_request.shared': 'Demande partagée à un proche',
  'payment_request.unshared': 'Partage retiré',
  'payment_request.care_confirmed': 'Soin confirmé',
  'payment_request.patient_acknowledged': 'Soin reçu, confirmé par le patient',
  'payment_request.closed': 'Demande clôturée, reçu émis',
  'payment_intent.created': 'Paiement diaspora ouvert',
  'payment_intent.failed': 'Paiement diaspora en échec',
  'payment_intent.cancelled': 'Paiement diaspora annulé',
  'payment.recorded': 'Paiement diaspora encaissé',
  'payment.webhook_refused': 'Paiement diaspora refusé à l’encaissement',
  'cash_payment.recorded': 'Encaissement au guichet',
  'cash_payment.reversed': 'Encaissement contre-passé',
  'dispute.opened': 'Litige ouvert',
  'dispute.resolved': 'Litige résolu',
  'patient_profile.merged': 'Dossiers patients fusionnés',
};

/** Familles du sélecteur — l'ordre et le regroupement de la liste blanche. */
export const AUDIT_ACTION_GROUPS: Array<{ label: string; actions: AuditAction[] }> = [
  {
    label: 'Personnel',
    actions: [
      'staff.membership_created',
      'staff.membership_updated',
      'staff.membership_deactivated',
      'staff.membership_reactivated',
    ],
  },
  {
    label: 'Le centre et sa vérification',
    actions: [
      'center.created',
      'center.updated',
      'center.kyc_changed',
      'kyc_document.uploaded',
      'kyc_document.archived',
    ],
  },
  { label: 'Tarifs', actions: ['tariff.created', 'tariff.updated'] },
  {
    label: 'Factures',
    actions: ['invoice.created', 'invoice.issued', 'invoice.cancelled'],
  },
  {
    label: 'Pont de Confiance',
    actions: [
      'payment_request.created',
      'payment_request.sent',
      'payment_request.shared',
      'payment_request.unshared',
      'payment_request.care_confirmed',
      'payment_request.patient_acknowledged',
      'payment_request.closed',
      'payment_intent.created',
      'payment_intent.failed',
      'payment_intent.cancelled',
      'payment.recorded',
      'payment.webhook_refused',
    ],
  },
  { label: 'Caisse', actions: ['cash_payment.recorded', 'cash_payment.reversed'] },
  { label: 'Litiges', actions: ['dispute.opened', 'dispute.resolved'] },
  { label: 'Dossiers patients', actions: ['patient_profile.merged'] },
];

/**
 * Pourquoi le clinique n'est pas dans ce journal — dit au directeur SANS
 * jargon (« métadonnées » ne veut rien dire pour un gestionnaire) et SANS
 * ton défensif : c'est une règle de maison assumée, pas une lacune cachée.
 */
export const AUDIT_NO_CLINICAL_NOTICE =
  'Les soins, les ordonnances, le carnet de santé et les consentements n’apparaissent pas ici. C’est voulu : le dossier d’un patient se lit dans son dossier, par les soignants qui le suivent.';

/** Le journal ne rétro-remplit rien — l'écran le dit, l'API le prouve. */
export function auditJournalStartsAt(date: string): string {
  return `Le journal de votre centre commence le ${date}. Ce qui s’est passé avant n’a pas été enregistré, et ne peut pas l’être après coup.`;
}

/** Un centre tout neuf : rien à lire, rien d'anormal. */
export const AUDIT_JOURNAL_EMPTY =
  'Le journal de votre centre est encore vide : il se remplira au fil des actions de votre équipe.';

/**
 * Libellés FR des clés de payload du journal — et **liste blanche
 * d'AFFICHAGE** (revue guardian S4 frontend).
 *
 * Le contrat backend « références only » (ADR 0007) porte sur ce qui est
 * ÉCRIT ; l'ADR 0017 (lot 2, vigilances) note que le journal du directeur en
 * fait aussi un contrat d'EXPOSITION, puisque `payload` est rendu tel quel.
 * Un contrat de revue n'est pas une garantie de code : le jour où un service
 * ajoute une clé bavarde à une action de la liste blanche, une UI qui rend
 * `Object.entries(payload)` l'affiche toute seule, sans qu'une ligne de
 * frontend ait bougé.
 *
 * Donc l'écran ne rend QUE les clés listées ici (`PayloadCell`) : ajouter une
 * clé au journal est un acte conscient d'une ligne, comme l'est l'ajout d'une
 * action à `DIRECTOR_JOURNAL_ACTIONS` côté backend. Le compte des clés
 * ignorées est dit honnêtement plutôt que caché.
 *
 * Couverture vérifiée clé par clé contre les `audit()` des actions de la
 * liste blanche (personnel, centre, KYC, tarifs, factures, demandes, caisse,
 * rail diaspora, litiges, fusion).
 */
export const AUDIT_PAYLOAD_LABELS: Record<string, string> = {
  /* personnel */
  membership_id: 'Rattachement',
  user_id: 'Compte',
  role: 'Rôle',
  old_role: 'Ancien rôle',
  new_role: 'Nouveau rôle',
  fields: 'Champs modifiés',
  /* centre, KYC */
  center_id: 'Centre',
  type: 'Type d’établissement',
  island: 'Île',
  status: 'Statut',
  old_status: 'Ancien statut',
  kyc_status: 'Statut KYC',
  has_reason: 'Motif renseigné',
  kyc_document_id: 'Pièce justificative',
  doc_type: 'Type de pièce',
  cleared: 'Effacé',
  /* tarifs */
  tariff_id: 'Tarif',
  code: 'Code de l’acte',
  price_kmf: 'Prix (KMF)',
  generic_category: 'Catégorie générique',
  /* factures et actes */
  invoice_id: 'Facture',
  encounter_id: 'Consultation',
  patient_id: 'Dossier patient',
  line_count: 'Nombre de lignes',
  total_kmf: 'Total (KMF)',
  currency: 'Devise',
  status_before: 'Statut précédent',
  invoice_status_after: 'Statut de la facture après',
  /* demandes de paiement diaspora */
  payment_request_id: 'Demande',
  link_id: 'Lien de tutelle',
  guardian_link_id: 'Lien de tutelle',
  guardian_id: 'Tuteur',
  share_count: 'Partages',
  receipt_id: 'Reçu',
  receipt_number: 'N° de reçu',
  /* rail PSP */
  intent_id: 'Intention',
  intent_status: 'État de l’intention',
  request_status: 'État de la demande',
  intent_kmf: 'Montant de l’intention (KMF)',
  refusal: 'Cause du refus',
  reason: 'Motif technique',
  amount_eur: 'Montant (EUR)',
  fees_eur: 'Frais (EUR)',
  exchange_rate: 'Taux appliqué',
  currency_paid: 'Devise payée',
  currency_received: 'Devise reçue',
  /* caisse */
  cash_payment_id: 'Encaissement',
  cash_receipt_id: 'Reçu de caisse',
  reversal_id: 'Contre-passation',
  ledger_transaction_id: 'Écriture comptable',
  method: 'Moyen de paiement',
  operator: 'Opérateur mobile',
  amount_kmf: 'Montant (KMF)',
  balance_kmf: 'Solde (KMF)',
  balance_after_kmf: 'Solde après (KMF)',
  /* litiges */
  dispute_id: 'Litige',
  previous_status: 'Statut précédent',
  restored_status: 'Statut rétabli',
  opened_as: 'Ouvert en tant que',
  /* fusion de dossiers */
  source_id: 'Dossier absorbé',
  target_id: 'Dossier conservé',
  links_moved: 'Liens déplacés',
  links_revoked: 'Liens révoqués',
  links_suspended: 'Liens suspendus',
  encounters_moved: 'Consultations déplacées',
  entries_moved: 'Entrées déplacées',
  appointments_moved: 'Rendez-vous déplacés',
  documents_moved: 'Documents déplacés',
  insurances_moved: 'Assurances déplacées',
  medical_file_moved: 'Fiche médicale reprise',
  user_transferred: 'Compte transféré',
};

/**
 * Ce que l'écran a refusé d'afficher — dit, jamais tu.
 *
 * Vaut zéro en fonctionnement normal (la liste blanche couvre tout ce que les
 * services posent aujourd'hui). Une valeur non nulle signale à l'équipe qu'une
 * clé neuve attend son libellé, sans jamais rendre son contenu.
 */
export function auditPayloadHidden(count: number): string {
  return count > 1
    ? `${count} références techniques non affichées`
    : '1 référence technique non affichée';
}

/* ── RGPD — droits sur mon compte (les TROIS espaces : patient, tuteur, et
      le personnel des centres depuis /centre/profil/parametres) ── */

/** Statut d'une demande d'effacement, dit à la personne concernée. */
export const ERASURE_STATUS_SELF: Record<ErasureStatus, string> = {
  en_attente: 'Votre demande est en cours d’examen',
  traitee: 'Votre demande a été traitée',
  refusee: 'Votre demande n’a pas pu être acceptée',
};

/** Statut d'une demande, côté back-office. */
export const ERASURE_STATUS_LABELS: Record<ErasureStatus, string> = {
  en_attente: 'En attente',
  traitee: 'Traitée',
  refusee: 'Refusée',
};

/** Ce qu'il faut corriger AVANT de pouvoir anonymiser (codes du backend). */
export const ERASURE_BLOCKER_LABELS: Record<ErasureBlocker, string> = {
  dernier_directeur: 'Nommer un autre directeur dans le centre concerné',
  paiement_en_cours: 'Attendre que le paiement en cours aboutisse (ou soit annulé automatiquement)',
  dernier_admin_plateforme: 'Nommer un autre administrateur Chioni',
};

/** Casquettes d'un compte, pour mesurer les conséquences d'un effacement. */
export const ERASURE_HAT_LABELS = {
  is_patient: 'Patient (carnet de santé)',
  is_guardian: 'Tuteur (paiements de proches)',
  is_center_staff: 'Membre du personnel d’un centre',
  is_platform_operator: 'Exploitant Chioni',
} as const;

/**
 * Ce que fait réellement l'anonymisation, dit À LA PERSONNE — deuxième
 * personne, verbes du quotidien, une conséquence concrète par ligne. Une
 * liste, jamais un paragraphe : la personne doit pouvoir la relire.
 *
 * Registre volontairement différent de `ERASURE_EFFECTS_OPERATOR` : « les
 * liens de tutelle sont révoqués dans les deux sens » est exact et illisible
 * pour Mariama ; « vos proches ne pourront plus payer vos soins » dit la même
 * chose dans sa vie.
 *
 * Registre GRAND PUBLIC — lu tel quel par `ERASURE_COPY['grand-public']`. Le
 * personnel des centres lit `ERASURE_COPY.staff`, plus bas.
 */
export const ERASURE_EFFECTS: string[] = [
  'Votre nom, votre numéro de téléphone et votre photo sont effacés de Chioni.',
  'Vous ne pourrez plus vous connecter : votre compte est fermé.',
  'Vos proches ne pourront plus payer vos soins depuis l’étranger, et vous ne pourrez plus payer les soins de quelqu’un d’autre.',
];

/** Ce qui est conservé, et pourquoi — dit avant la demande, jamais après. */
export const ERASURE_KEPT: string[] = [
  'Votre carnet de santé reste au centre de santé, sans votre nom. C’est la loi, et c’est pour votre sécurité : un soignant doit pouvoir savoir quels soins ont déjà été donnés.',
  'Les factures et les reçus déjà établis restent au centre : ce sont ses papiers de comptabilité.',
];

/** La phrase la plus importante de l'écran : ce n'est pas un bouton magique. */
export const ERASURE_NOT_INSTANT =
  'Votre demande sera examinée par l’équipe Chioni. Ce n’est pas immédiat, et vous pouvez continuer à utiliser Chioni normalement en attendant.';

/**
 * Dit AVANT le clic, jamais après : la personne ne peut pas retirer sa
 * demande elle-même (vigilance actée à l'ADR 0017 lot 3 — aucune rétractation
 * n'est implémentée). Le taire ferait de « Envoyer ma demande » un piège.
 */
export const ERASURE_NO_UNDO =
  'Une fois envoyée, vous ne pourrez pas retirer votre demande vous-même.';

/* ── copie de mes données (portabilité, art. 20) ── */

/** Ce que le bouton donne — dit avant, pour qu'il n'y ait pas de surprise. */
export const EXPORT_HINT =
  'Un fichier contenant ce que vous voyez déjà dans votre espace. Il s’ouvre sur un ordinateur.';

/** Ce qui vient de se passer — le nom du fichier aide à le retrouver. */
export function exportSaved(filename: string): string {
  return `Fichier enregistré dans les téléchargements de votre appareil, sous le nom « ${filename} ».`;
}

/* ── un seul écran, deux registres ────────────────────────────────────────
   La carte « Mes données » est la MÊME dans les trois espaces (même appels,
   même modale, même garde anti-double-demande) : seules les phrases changent,
   parce que les conséquences vécues ne sont pas les mêmes.

   « Vos proches ne pourront plus payer vos soins depuis l'étranger » ne veut
   rien dire pour une secrétaire ; « vos postes dans les centres sont
   désactivés » ne veut rien dire pour Mariama. Les deux registres portent
   EXACTEMENT les mêmes garanties, dans le même ordre — ce qui n'est pas
   immédiat, ce que couvre la demande, ce qui se passe si elle est acceptée,
   ce qui est conservé, et le fait qu'on ne peut pas la retirer — pour qu'une
   relecture des deux colonnes côte à côte suffise à vérifier qu'aucune n'a
   dérivé.

   Règle pour les retards (`delay` / `pendingNote`) : ce qui peut CHANGER la
   décision se dit AVANT le dépôt (le dernier directeur d'un centre a intérêt
   à nommer son remplaçant d'abord) ; ce qui se dénoue tout seul se dit APRÈS,
   à qui revient voir où en est sa demande (un paiement en vol). Les deux
   registres suivent cette règle — ils ne diffèrent que par les cas qui les
   concernent, jamais par la promesse. */

/** Registre d'écriture de la carte « Mes données ». */
export type ErasureAudience = 'grand-public' | 'staff';

export interface ErasureCopy {
  /** Titre de la carte (= son `aria-label`). */
  heading: string;
  /** Ce que la carte permet, en une phrase. */
  intro: string;
  /** Ce que contient le fichier téléchargé — dit AVANT le clic. */
  exportHint: string;
  /** La phrase la plus importante : ce n'est pas un bouton magique. */
  notInstant: string;
  /** Ce que couvre la demande — un compte, pas un espace (multi-casquettes). */
  scope: string;
  /** Ce qui se passe si la demande est acceptée. */
  effects: string[];
  /** Ce qui est conservé, et pourquoi. */
  kept: string[];
  /** Ce qui peut RETARDER la demande, dit avant le dépôt (facultatif). */
  delayTitle?: string;
  delay?: string[];
  /** Pendant l'examen de la demande. */
  pending: string;
  /** Redit après le dépôt, pour qui revient sans se souvenir (facultatif). */
  pendingNote?: string;
}

export const ERASURE_COPY: Record<ErasureAudience, ErasureCopy> = {
  /* Mariama et Nassim : les mots de leur vie, jamais ceux du modèle. */
  'grand-public': {
    heading: 'Mes données',
    intro:
      'Vos informations vous appartiennent. Vous pouvez en obtenir une copie, ou demander la suppression de votre compte.',
    exportHint: EXPORT_HINT,
    notInstant: ERASURE_NOT_INSTANT,
    scope: 'Cette demande concerne tout votre compte Chioni, pas seulement cet espace.',
    effects: ERASURE_EFFECTS,
    kept: ERASURE_KEPT,
    pending:
      'L’équipe Chioni l’examine. Vous pouvez continuer à utiliser Chioni normalement en attendant.',
    /* Le seul retard qui touche le grand public (backend : un intent PSP
       `cree`/`en_cours` bloque l'anonymisation du payeur). Dit APRÈS le dépôt
       et pas avant, à la différence du cas « dernier directeur » : celui-ci
       change une décision — on nomme un remplaçant d'abord — alors qu'un
       paiement se dénoue tout seul en quelques heures. L'annoncer dans la
       modale n'aiderait personne et allongerait un texte déjà dense. */
    pendingNote:
      'Si vous avez lancé un paiement qui n’est pas encore terminé, votre demande attend qu’il aboutisse.',
  },

  /* Dr Saïd, la secrétaire, le caissier, la sage-femme : un salarié exerce le
     même droit, avec des conséquences professionnelles qu'il faut nommer —
     son accès, son poste, et ce que son travail laisse comme traces. On dit
     tout avant le dépôt : personne ne doit découvrir après coup qu'il a fermé
     son propre outil de travail. */
  staff: {
    heading: 'Mes données personnelles',
    intro:
      'Ce sont vos informations à vous, pas celles du centre ni de ses patients. Vous pouvez en obtenir une copie, ou demander la suppression de votre compte.',
    exportHint:
      'Un fichier contenant votre compte et vos postes dans les centres. Les dossiers du centre n’y sont pas : ils appartiennent au centre. Il s’ouvre sur un ordinateur.',
    notInstant:
      'Votre demande sera examinée par l’équipe Chioni. Ce n’est pas immédiat : en attendant, vous gardez votre accès et vous travaillez normalement.',
    /* Même première proposition que le registre grand public, exprès : une
       personne qui cumule les casquettes lit la MÊME promesse de portée dans
       ses deux espaces, et n'a pas à se demander si ce sont deux règles. */
    scope:
      'Cette demande concerne tout votre compte Chioni, pas seulement cet espace : votre accès au centre, et vos autres espaces si vous en avez.',
    effects: [
      'Votre nom, votre numéro de téléphone et votre photo sont effacés de Chioni.',
      'Vous ne pourrez plus vous connecter : votre compte est fermé.',
      'Vos postes dans les centres sont désactivés : plus d’accès à l’espace du centre, et le centre devra vous retirer de son personnel.',
      'C’est donc une décision qui touche aussi votre travail, pas seulement votre vie privée.',
    ],
    kept: [
      'Ce que vous avez fait dans l’application reste enregistré : consultations saisies, factures, encaissements, journal des actions. Ces traces ne portent plus votre nom, mais elles existent.',
      'C’est la loi, et c’est ce qui protège tout le monde : un centre doit pouvoir justifier les soins qu’il a donnés et l’argent qu’il a reçu.',
    ],
    delayTitle: 'Ce qui peut retarder votre demande :',
    /* Dit AVANT le dépôt, parce que le backend renvoie ce cas comme un
       blocage et laisse la demande « en attente » : quelqu'un qui attend sans
       explication le vit comme un refus arbitraire. */
    delay: [
      'Si vous êtes le seul directeur en activité d’un centre, votre demande restera en attente tant qu’un autre directeur n’aura pas été nommé : un centre ne peut pas rester sans responsable.',
      'Ce n’est pas un refus — votre demande reste enregistrée — mais rien n’avancera avant.',
    ],
    pending:
      'L’équipe Chioni examine votre demande. En attendant, vous gardez votre accès et vous travaillez normalement.',
    pendingNote:
      'Si vous êtes le seul directeur en activité d’un centre, votre demande restera en attente tant qu’un autre directeur n’aura pas été nommé. Si vous avez lancé un paiement qui n’est pas encore terminé, elle attend aussi qu’il aboutisse.',
  },
};

/* Les mots des deux registres — ils disent la même chose à tout le monde. */

/** Intitulé du bouton d'appel ET titre de la modale : mêmes mots, exprès. */
export const ERASURE_ASK_LABEL = 'Demander la suppression de mon compte';
export const ERASURE_ASK_CONFIRM = 'Envoyer ma demande';
/** La sortie sûre : « ne rien faire » est une réponse, pas un abandon. */
export const ERASURE_ASK_CANCEL = 'Ne rien faire';
export const ERASURE_EFFECTS_TITLE = 'Si votre demande est acceptée :';
export const ERASURE_KEPT_TITLE = 'Ce qui est conservé :';
export const ERASURE_ASK_AGAIN =
  'Vous pouvez redemander la suppression de votre compte si votre situation change.';
export const EXPORT_LABEL = 'Télécharger mes données';

/** Dates d'une demande — « envoyée le », et la réponse quand elle existe. */
export function erasureFiledOn(requestedAt: string, processedAt: string | null): string {
  const filed = `Demande envoyée le ${formatDate(requestedAt)}`;
  return processedAt ? `${filed} · réponse le ${formatDate(processedAt)}` : filed;
}

/* ── mêmes faits, registre EXPLOITANT (back-office plateforme) ────────────
   Deux listes plutôt qu'une : l'exploitant a besoin des mots exacts du
   modèle (révocation, consentements, memberships) pour juger d'un cas, la
   personne a besoin des mots de sa vie. Elles disent la même chose et
   vivent côte à côte pour qu'aucune ne dérive sans l'autre. */

export const ERASURE_EFFECTS_OPERATOR: string[] = [
  'Identité neutralisée (nom, téléphone, e-mail, photo), compte désactivé.',
  'Liens de tutelle révoqués des deux côtés, consentements révoqués.',
  'Rattachements au personnel désactivés, codes SMS purgés.',
];

export const ERASURE_KEPT_OPERATOR: string[] = [
  'Le carnet de santé : il appartient au patient et relève du droit local de conservation. Il devient orphelin d’identité.',
  'Le ledger, le journal d’audit, les factures et les reçus — pièces comptables des centres.',
];

/* ══ Envoi de photos — socle d'uploads partagé (ADR 0014) ════════════════
   Un SEUL jeu de phrases pour les cinq points d'envoi du produit (logo du
   centre, avatar, documents patients, pièces KYC) : le socle est commun, les
   messages doivent l'être aussi — sinon la même règle s'explique de quatre
   façons différentes, et l'extraction i18n en oublie une. */

/** Contrainte affichée à côté d'un sélecteur de fichier. */
export const UPLOAD_IMAGE_HINT = 'JPEG, PNG ou WebP · 2 Mo maximum';

/** Le fichier choisi n'est pas une photo acceptée — dit quoi faire. */
export const UPLOAD_FORMAT_REFUSED =
  'Formats acceptés : photo JPEG, PNG ou WebP. Le PDF n’est pas encore pris en charge — photographiez le document.';

/** Taille lisible d'un fichier (Ko/Mo), en français. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

/** Photo trop lourde — la taille refusée est dite, jamais devinée. */
export function uploadTooLarge(bytes: number): string {
  return `Photo trop lourde (${formatBytes(bytes)}). Le maximum est de 2 Mo.`;
}

/** 429 du scope `uploads` (20/h) traduit en attente concrète. */
export function uploadThrottled(retryAfterSeconds?: number): string {
  return retryAfterSeconds
    ? `Trop d’envois rapprochés. Réessayez dans ${formatWait(retryAfterSeconds)}.`
    : 'Trop d’envois rapprochés. Patientez un moment avant de réessayer.';
}

/* ══ Comptes créés par un tiers (porte plateforme, ADR 0017 décision 2) ═══ */

/**
 * Le premier directeur naît en COMPTE OMBRE : il n'existe aucun mot de passe
 * à transmettre. La phrase est la même dans les deux écrans qui créent un
 * directeur — la laisser en double a déjà produit deux formulations.
 */
export const SHADOW_ACCOUNT_NOTICE =
  'Le compte est créé sans mot de passe. La personne en prend possession elle-même : à sa première connexion, elle saisit son numéro et reçoit un code à 6 chiffres par SMS. Ne lui transmettez aucun identifiant — il n’en existe pas.';

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
