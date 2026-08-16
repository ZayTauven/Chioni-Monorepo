/*
 * Chioni — French labels for every API enum + shared formatters.
 *
 * The API returns raw enum values ("actif", "medecin"…) — every screen goes
 * through these maps so wording stays consistent and the future shikomori
 * i18n has a single extraction point.
 */

import type {
  AppointmentStatus,
  AttendanceStatus,
  AuditAction,
  BillingPeriod,
  BloodGroup,
  CashMethod,
  CenterType,
  ClaimStatus,
  ConsentCollectedVia,
  ConsentScope,
  Currency,
  DisputeStatus,
  EncounterStatus,
  EquipmentCategory,
  EquipmentStatus,
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
  LeaveStatus,
  LeaveType,
  MobileMoneyOperator,
  PublicAttendanceStatus,
  PatientDocumentType,
  PaymentIntentStatus,
  PaymentRequestStatus,
  PlatformRole,
  PrescriptionStatus,
  RecordEntryType,
  Relationship,
  Sex,
  StaffRole,
  StayPriority,
  StayStatus,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentMethod,
  SubscriptionStatus,
  SupportCategory,
  SupportPriority,
  SupportTicketStatus,
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

/* ── S6 — hospitalisation (ADR 0019) ────────────────────────────────────────
   Le séjour héberge, la consultation soigne. Deux registres de phrases : celui
   du service (dense, opérationnel) et celui du patient (une phrase, sans
   jargon) — le second n'est JAMAIS une traduction littérale du premier. */

/** Statut d'un séjour, côté centre. */
export const STAY_STATUS_LABELS: Record<StayStatus, string> = {
  en_cours: 'En cours',
  sortie: 'Sorti',
  annule: 'Annulé',
};

/** Ordre des pastilles de filtre — l'état de travail d'abord. */
export const STAY_STATUSES: StayStatus[] = ['en_cours', 'sortie', 'annule'];

/**
 * Statut d'un séjour comme le PATIENT le lit. Formulation dégenrée
 * (« hospitalisé(e) ») : l'écran ne connaît pas toujours le sexe de la
 * personne, et se tromper sur ce mot-là est un manque d'égard.
 *
 * `annule` n'est JAMAIS rendu en rouge (voir `STAY_CANCELLED_PATIENT_HINT`) :
 * c'est presque toujours une correction de saisie du centre, pas un échec du
 * patient — le même arbitrage que « Manqué » sur un rendez-vous.
 */
export const STAY_STATUS_PATIENT: Record<StayStatus, string> = {
  en_cours: 'Vous êtes hospitalisé(e)',
  sortie: 'Séjour terminé',
  annule: 'Séjour annulé',
};

/** Ce que « Séjour annulé » veut dire pour la personne — dit, jamais deviné. */
export const STAY_CANCELLED_PATIENT_HINT =
  'Le centre a retiré ce séjour de votre carnet. C’est presque toujours une erreur de saisie corrigée : vous n’avez rien à faire.';

export const STAY_PATIENT_SECTION_TITLE = 'Mes hospitalisations';

/**
 * L'hospitalisation en cours n'a pas encore de fin — le dire honnêtement, et
 * sans mot administratif : « établissement » est du vocabulaire de dossier,
 * « le centre de santé » est le mot que Mariama emploie.
 */
export const STAY_PATIENT_ONGOING_HINT =
  'Vous êtes actuellement soigné(e) sur place. Le centre de santé notera votre sortie ici quand vous quitterez les lieux.';

/**
 * Le pont entre le séjour et SA consultation, dit dans les deux sens.
 *
 * Sans lui, le carnet montre deux blocs qui parlent du même épisode sans se
 * relier : une carte « hospitalisation du 3 au 8 » en tête, puis, plus bas, une
 * consultation d'un seul jour qui semble sans rapport. La question que se pose
 * la personne — « pourquoi cette visite-là dure-t-elle plusieurs jours ? » —
 * doit trouver sa réponse SUR la consultation, pas dans un raisonnement.
 */
export function stayPatientEncounterNote(
  admittedAt: string,
  dischargedAt: string | null,
): string {
  const period = dischargedAt
    ? `du ${formatDate(admittedAt)} au ${formatDate(dischargedAt)}`
    : `commencée le ${formatDate(admittedAt)}`;
  return `Cette visite couvre votre hospitalisation ${period}.`;
}

/** Rendu sur la carte du séjour SEULEMENT si la consultation est bien affichée. */
export const STAY_PATIENT_ENCOUNTER_LINK =
  'Les soins reçus pendant ce séjour sont notés dans la consultation de ce séjour, plus bas dans cette liste.';

/** Priorité déclarée à l'admission (triage du service). */
export const STAY_PRIORITY_LABELS: Record<StayPriority, string> = {
  normale: 'Normale',
  urgente: 'Urgente',
  critique: 'Critique',
};

export const STAY_PRIORITIES: StayPriority[] = ['normale', 'urgente', 'critique'];

/* — le lit — */

/** Un séjour sans assignation ouverte : un état NORMAL, jamais une anomalie. */
export const STAY_NO_BED_LABEL = 'Sans lit';

export const STAY_NO_BED_HINT =
  'Ce patient est hospitalisé sans lit attribué, en attente d’une place. Refuser l’admission faute de lit reviendrait à refuser un patient qui est là.';

export const BED_FIELD_HINT =
  'Facultatif : un patient peut être admis sans lit, et la place lui être attribuée plus tard.';

export const BED_NONE_FREE =
  'Aucun lit libre à cet instant. L’admission reste possible : le patient sera enregistré sans lit.';

export const BED_ASSIGN_TITLE = 'Attribuer un lit';
export const BED_TRANSFER_TITLE = 'Transférer vers un autre lit';

export const BED_TRANSFER_HINT =
  'Le lit occupé est libéré et le nouveau lui est attribué. L’historique garde la trace des deux — un transfert s’empile, il ne réécrit rien.';

export const BED_FREE_ONLY_NOTICE =
  'Seuls les lits libres à cet instant sont proposés. Si quelqu’un vient d’en prendre un, l’enregistrement sera refusé : un lit n’accueille jamais deux personnes.';

export const BED_RELEASE_TITLE = 'Libérer le lit ?';

export const BED_RELEASE_HINT =
  'Le patient reste hospitalisé, sans lit attribué, et la place redevient disponible pour quelqu’un d’autre.';

export const BED_INACTIVE_LABEL = 'Hors service';

/* — les médecins qui suivent — */

export const ATTENDING_TITLE = 'Médecins qui suivent le patient';

export const ATTENDING_HINT =
  'Plusieurs soignants peuvent suivre un même séjour. Cochez la liste complète : elle remplace la précédente.';

export const ATTENDING_EMPTY = 'Aucun médecin assigné pour l’instant.';

/* — sortie et annulation — */

export const STAY_DISCHARGE_TITLE = 'Enregistrer la sortie ?';

/** Les trois effets réels de la sortie, dans l'ordre où ils comptent. */
export const STAY_DISCHARGE_EFFECTS: string[] = [
  'Le lit est libéré immédiatement et redevient disponible.',
  'La consultation du séjour est clôturée : plus d’ordonnance ni d’entrée au carnet.',
  'La facturation des journées reste possible après la sortie — c’est même le moment habituel.',
];

export const STAY_DISCHARGE_FINAL =
  'Une sortie est définitive : un séjour terminé ne se rouvre pas.';

export const STAY_CANCEL_TITLE = 'Annuler cette admission ?';

export const STAY_CANCEL_LEAD =
  'À n’utiliser que si l’admission a été saisie par erreur : un séjour annulé n’a jamais eu lieu. Si le patient est bien venu, enregistrez une sortie.';

export const STAY_CANCEL_REASON_LABEL = 'Motif de l’annulation';

export const STAY_CANCEL_REASON_PRIVACY =
  'Ce motif n’est lu que par l’équipe soignante — ni le patient, ni le guichet, ni le journal du centre ne le voient.';

export const STAY_CANCEL_FINAL = 'Une annulation est définitive.';

/** Rendu AVANT le clic quand des journées sont déjà facturées (le backend le
 *  refuserait de toute façon — mais découvrir un refus au clic est un défaut). */
export const STAY_CANCEL_BLOCKED_BY_ACTS =
  'Ce séjour porte déjà des actes facturés : il ne peut plus être annulé comme une erreur de saisie. Enregistrez une sortie.';

/* — admission — */

export const ADMISSION_TITLE = 'Admettre un patient';

export const ADMISSION_PIVOT_NOTICE =
  'L’admission ouvre la consultation du séjour. C’est sur elle que se prennent les mesures, les ordonnances et les actes, du premier au dernier jour.';

export const ADMISSION_REASON_HINT =
  'Le motif d’admission est une donnée clinique : il est lu par l’équipe soignante seule, jamais par le guichet.';

/* — surveillance — */

export const STAY_SURVEILLANCE_TITLE = 'Surveillance';

export const STAY_SURVEILLANCE_HINT =
  'Les mesures d’un patient hospitalisé se prennent sur la consultation du séjour : mêmes unités, mêmes bornes qu’en consultation ordinaire, et elles rejoignent son carnet.';

/* — facturation des journées (rôles BILLING) — */

export const BILL_DAYS_TITLE = 'Facturer des journées d’hospitalisation';

export const BILL_DAYS_HOWTO =
  'Chaque journée devient un acte de la grille tarifaire. Les actes se posent sur la consultation du séjour ; la facture se crée ensuite depuis « Factures », et reprendra ces journées avec les autres soins.';

/**
 * Les deux constats de la revue guardian S6 ont été corrigés au backend le
 * 15/08/2026 (clé d'idempotence obligatoire + plafond de journées). L'écran
 * porte donc la GARANTIE, pas l'avertissement : dire « attention, ce geste
 * n'est pas rejouable » serait devenu un mensonge, et l'inverse — se taire —
 * laisserait un caissier hésiter devant un bouton après un timeout.
 */
export const BILL_DAYS_REPLAY_SAFE =
  'Si la connexion coupe, réessayez sans crainte : les journées ne seront pas posées deux fois.';

export const BILL_DAYS_DURATION_LABEL = 'Durée du séjour';

export const BILL_DAYS_CAP_LABEL = 'Journées facturables';

/**
 * La règle du plafond, en mots de guichet. Le calcul côté écran suit celui du
 * backend (journées civiles entamées) mais le fuseau du navigateur peut
 * différer de l'heure des Comores d'une journée aux bornes : le nombre affiché
 * est une INDICATION, et c'est le refus du serveur qui fait foi — on l'affiche
 * alors tel quel, avec ses dates et son décompte.
 */
export const BILL_DAYS_CAP_RULE =
  'Toute journée commencée est facturable, et pas une de plus : on ne facture jamais plus de journées que le séjour n’en a duré.';

/**
 * L'écart de fuseau, dit SANS jargon (ni « fuseau », ni « client », ni « UTC »).
 *
 * Le décompte affiché est calculé par le navigateur ; le refus vient du serveur,
 * à l'heure des Comores. Aux bornes d'une journée, les deux peuvent différer de
 * un. Se taire ferait passer un refus légitime pour une panne ; expliquer le
 * mécanisme perdrait un caissier. On dit donc ce qu'il faut faire : lire le
 * message, il porte le bon compte.
 */
export const BILL_DAYS_CLOCK_NOTICE =
  'Ce décompte suit l’heure de cet appareil. S’il diffère d’une journée, le message affiché à l’enregistrement donne le bon compte : c’est celui-là qui fait foi.';

/** Le refus de dépassement, AVANT le clic — une phrase par idée, sans faute. */
export function billDaysOverCapMessage(
  cap: number,
  billed: number,
  asked: number,
  remaining: number,
): string {
  const opened = `Ce séjour ouvre ${cap} journée${cap > 1 ? 's' : ''} facturable${cap > 1 ? 's' : ''} en tout`;
  const already =
    billed > 0
      ? `, dont ${billed} déjà posée${billed > 1 ? 's' : ''}`
      : ', dont aucune posée pour l’instant';
  const left =
    remaining > 0
      ? `il en reste ${remaining} à facturer`
      : 'il n’en reste aucune à facturer';
  return `${opened}${already}. Vous en demandez ${asked} : ${left}, l’enregistrement sera refusé au-delà.`;
}

/** Un séjour annulé n'a jamais eu lieu : rien à facturer, rien à « rester ». */
export const BILL_DAYS_CANCELLED_STAY =
  'Cette admission a été annulée : elle ne peut porter aucune journée facturée.';

/** Le champ est pré-rempli avec ce qui RESTE facturable — jamais au-delà. */
export const BILL_DAYS_PREFILL_HINT =
  'Pré-rempli avec ce qu’il reste de facturable. Corrigez-le si votre centre en compte moins : le montant reste votre décision.';

/**
 * Plus rien à poser : le dire avant le formulaire, pas après le refus — mais
 * sans FERMER le formulaire pour autant.
 *
 * Le décompte est calculé par le navigateur : aux bornes d'une journée, une
 * horloge d'appareil décalée peut compter un jour de moins que l'heure des
 * Comores. Désactiver le champ sur cette base rendait la dernière journée d'un
 * séjour définitivement infacturable depuis l'écran, sans recours ni
 * explication. On informe, le serveur tranche.
 */
export const BILL_DAYS_ALL_BILLED =
  'D’après ce décompte, toutes les journées de ce séjour sont déjà facturées : il n’y a normalement rien à ajouter. S’il vous semble qu’il en manque une, saisissez-la quand même — la réponse affichée donnera le compte exact.';

/** « reste 3 journées à facturer » / « reste 1 journée à facturer ». */
export function billDaysRemainingLabel(count: number): string {
  if (count <= 0) return 'plus aucune journée à facturer';
  return `reste ${count} journée${count > 1 ? 's' : ''} à facturer`;
}

export const BILL_DAYS_NO_TARIFF_TITLE = 'Aucun tarif d’hospitalisation';

/** L'écriture d'un tarif est ouverte au directeur et au caissier : une
 *  secrétaire lit ce message et sait à qui s'adresser plutôt que de buter. */
export const BILL_DAYS_NO_TARIFF =
  'La grille du centre ne contient aucun acte de catégorie « Hospitalisation », et une journée ne peut se facturer qu’avec un tarif de cette nature. Le directeur ou le caissier peut en créer un depuis « Tarifs » : la journée d’hospitalisation est un acte tarifé ordinaire.';

/* — occupation — */

export const OCCUPANCY_RATE_LABEL = 'Taux d’occupation';

export const OCCUPANCY_EMPTY_TITLE = 'Aucune chambre déclarée';

export const OCCUPANCY_EMPTY_DIRECTOR =
  'Décrivez le parc du centre : une chambre, puis ses lits. C’est la condition pour attribuer un lit à un patient — l’admission, elle, fonctionne déjà sans.';

export const OCCUPANCY_EMPTY_STAFF =
  'Le parc de chambres et de lits n’est pas encore décrit. Le directeur du centre peut l’ajouter. L’admission d’un patient fonctionne déjà sans lit.';

export const ROOM_ADD_LABEL = 'Nouvelle chambre';
export const BED_ADD_LABEL = 'Ajouter un lit';

export const ROOM_BED_DIRECTOR_ONLY =
  'Seul le directeur du centre déclare les chambres et les lits.';

/** Limite assumée de cette version (ADR 0019 addendum §14) — dite, pas cachée. */
export const ROOM_BED_NO_EDIT_NOTICE =
  'Une chambre ou un lit déjà déclaré ne se renomme ni ne se retire depuis Chioni pour l’instant.';

/* — ce que l'écran d'hospitalisation annonce à chaque casquette — */

export const INPATIENT_SUBTITLE_CLINICAL =
  'Qui occupe quel lit, ce qu’il reste de places, et les séjours du centre.';

/**
 * Ce que le guichet ne voit pas est dit POSITIVEMENT (règle produit : « Les
 * détails médicaux restent privés », jamais « réservé aux soignants », qui
 * sonne comme un refus opposé à la personne qui lit).
 */
export const INPATIENT_SUBTITLE_ADMIN =
  'Qui occupe quel lit et ce qu’il reste de places. Les informations médicales, elles, restent entre le patient et les soignants.';

/** Le plafond de chargement du tableau — dit toujours, pas dans une carte qui
 *  n'apparaît que s'il y a des patients sans lit. */
export const OCCUPANCY_TRUNCATED_NOTICE =
  'Ce centre compte plus de 100 séjours en cours : le tableau s’arrête aux 100 plus récents. L’onglet « Séjours » les parcourt tous.';

/* — filtre de priorité : côté écran, sur la page affichée seulement — */

export const STAY_PRIORITY_FILTER_NOTICE =
  'Le filtre de priorité s’applique aux séjours de la page affichée.';

/** Cul-de-sac évité : la page suivante existe peut-être, on le dit ET on laisse
 *  la pagination à l'écran. */
export const STAY_PRIORITY_FILTER_EMPTY_PAGE =
  'Aucun séjour de cette priorité sur cette page. Les suivantes en contiennent peut-être : utilisez la pagination ci-dessous.';

/* — compteurs et durées — */

/** 0 → « Aucun lit libre », 1 → « 1 lit libre », n → « n lits libres ». */
export function freeBedsLabel(count: number): string {
  if (count <= 0) return 'Aucun lit libre';
  return `${count} lit${count > 1 ? 's' : ''} libre${count > 1 ? 's' : ''}`;
}

/** « 12 lits occupés sur 20 ». */
export function occupancySummary(occupied: number, total: number): string {
  return `${occupied} lit${occupied > 1 ? 's' : ''} occupé${occupied > 1 ? 's' : ''} sur ${total}`;
}

/** « 3 patients sans lit » — l'information qui manque le plus au tableau. */
export function staysWithoutBedLabel(count: number): string {
  return `${count} patient${count > 1 ? 's' : ''} hospitalisé${count > 1 ? 's' : ''} sans lit`;
}

/** 0 → « Aucune journée facturée » · n → « n journées facturées ». */
export function billedDaysLabel(count: number): string {
  if (count <= 0) return 'Aucune journée facturée';
  return `${count} journée${count > 1 ? 's' : ''} facturée${count > 1 ? 's' : ''}`;
}

/** « 1 jour » · « 5 jours ». */
export function dayCountLabel(count: number): string {
  return `${count} jour${count > 1 ? 's' : ''}`;
}

/**
 * Durée d'un séjour en **jours entamés** (l'admission compte pour un jour),
 * calculée sur les jours du calendrier local. Un séjour en cours se mesure
 * jusqu'à aujourd'hui.
 *
 * C'est une INFORMATION, jamais une règle de facturation : le backend ne
 * relie pas ce nombre au geste `bill-days`, et l'écran ne prétend pas le
 * faire non plus (voir `BILL_DAYS_FREE_COUNT_NOTICE`).
 */
export function stayDurationDays(admittedAt: string, dischargedAt: string | null): number {
  const start = new Date(admittedAt);
  const end = dischargedAt ? new Date(dischargedAt) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const spanned = Math.round((endDay - startDay) / 86_400_000) + 1;
  return spanned < 1 ? 1 : spanned;
}

/**
 * « 5 jours » · « 5 jours (en cours) » quand la sortie n'est pas enregistrée.
 *
 * Un séjour ANNULÉ n'a pas de durée : `cancel_stay` ne pose pas de
 * `discharged_at` (l'admission n'a jamais eu lieu), et compter les jours depuis
 * une admission effacée affichait « 5 jours (en cours) » à côté du badge
 * « Annulé » — deux informations qui se contredisent sur la même ligne.
 */
export function stayDurationLabel(
  admittedAt: string,
  dischargedAt: string | null,
  status?: StayStatus,
): string {
  if (status === 'annule') return '—';
  const days = dayCountLabel(stayDurationDays(admittedAt, dischargedAt));
  return dischargedAt ? days : `${days} (en cours)`;
}

/**
 * La période d'un séjour, dite au PATIENT : « Du 3 au 8 août 2026 ».
 *
 * Même raison que ci-dessus, en plus sensible : « Depuis le 3 août 2026 » sur
 * un séjour annulé dit à quelqu'un qu'il est encore hospitalisé. On ne rend
 * alors que la date d'enregistrement, et la phrase d'explication fait le reste.
 */
export function stayPatientPeriod(
  admittedAt: string,
  dischargedAt: string | null,
  status?: StayStatus,
): string {
  if (status === 'annule') return `Enregistré le ${formatDate(admittedAt)}`;
  if (!dischargedAt) return `Depuis le ${formatDate(admittedAt)}`;
  return `Du ${formatDate(admittedAt)} au ${formatDate(dischargedAt)}`;
}

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
  /* S6 — configuration du parc d'hébergement. Le libellé ne nomme jamais la
     chambre ni le lit : le backend n'en journalise que les identifiants (un
     nom de chambre peut être « Isolement tuberculose »). */
  'room.created': 'Chambre déclarée',
  'bed.created': 'Lit déclaré',
  /* S8 — le parc de matériel. Comme pour les chambres, le libellé ne nomme
     jamais l'appareil (« Échographe du service VIH » ferait d'une ligne de
     parc une ligne clinique) : le backend n'en journalise que les ids et des
     codes fermés. « Panne signalée » dit l'ÉVÉNEMENT, jamais le constat. */
  'equipment.created': 'Équipement déclaré',
  'equipment.updated': 'Fiche d’équipement modifiée',
  'equipment.status_changed': 'État d’un équipement modifié',
  'equipment.reported': 'Panne signalée',
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
  /* S5 (ADR 0018) — l'abonnement du centre. « Modifié » plutôt que « gelé » :
     le libellé d'une ligne de journal ne préjuge pas du sens de la décision
     (une réactivation passe par la même action que la suspension). */
  'subscription.created': 'Abonnement ouvert',
  'subscription.plan_changed': 'Offre d’abonnement changée',
  'subscription.status_changed': 'État de l’abonnement modifié',
  'subscription_invoice.issued': 'Facture d’abonnement émise',
  'subscription_invoice.cancelled': 'Facture d’abonnement annulée',
  'subscription_payment.recorded': 'Règlement d’abonnement enregistré',
  'subscription_payment.reversed': 'Règlement d’abonnement annulé',
  /* S5 lot 3 — le support de SON centre. Le libellé dit l'ÉVÉNEMENT, jamais
     de quoi il parle : l'objet et le corps d'un ticket ne sont pas dans le
     journal, et le directeur les lit dans le fil, à sa place. */
  'support_ticket.opened': 'Demande d’aide ouverte',
  'support_ticket.status_changed': 'État d’une demande d’aide modifié',
  'support_ticket.message_posted': 'Message sur une demande d’aide',
  'support_ticket.attachment_uploaded': 'Pièce jointe déposée sur une demande d’aide',
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
  { label: 'Chambres et lits', actions: ['room.created', 'bed.created'] },
  {
    label: 'Équipements',
    actions: [
      'equipment.created',
      'equipment.updated',
      'equipment.status_changed',
      'equipment.reported',
    ],
  },
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
  {
    label: 'Abonnement Chioni',
    actions: [
      'subscription.created',
      'subscription.plan_changed',
      'subscription.status_changed',
      'subscription_invoice.issued',
      'subscription_invoice.cancelled',
      'subscription_payment.recorded',
      'subscription_payment.reversed',
    ],
  },
  {
    label: 'Support',
    actions: [
      'support_ticket.opened',
      'support_ticket.status_changed',
      'support_ticket.message_posted',
      'support_ticket.attachment_uploaded',
    ],
  },
];

/**
 * Une transition `actif ⇄ impaye` posée par la tâche quotidienne : `actor`
 * vaut `null` et le payload porte `automatic: true`. Le journal le DIT plutôt
 * que d'afficher un tiret qui laisserait chercher une main.
 */
export const AUDIT_ACTOR_AUTOMATIC = 'Constaté automatiquement';

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
 * rail diaspora, litiges, fusion, abonnement SaaS et support). Revue guardian
 * S5 : les clés du lot 3 (support) manquaient — le fail-closed a tenu (rien
 * n'a fuité), mais une ligne de journal réduite à « 3 références techniques
 * non affichées » n'est plus un journal. Toute action neuve du backend
 * s'accompagne désormais de ses clés ici, sinon elle s'affiche muette.
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
  /* S6 — parc d'hébergement (références seules, jamais un nom de chambre). */
  room_id: 'Chambre',
  bed_id: 'Lit',
  /* S8 — parc de matériel. Les clés couvrent les quatre actions
     d'`apps/equipment/services.py` ; `status`, `center_id` et `fields` sont
     déjà déclarés plus haut. `report_id` est la référence du constat — sa
     DESCRIPTION n'est jamais journalisée, il n'y a donc aucune clé à lui
     donner ici, et c'est voulu. */
  equipment_id: 'Équipement',
  /* `category` est déclaré plus bas (clé partagée avec le support) — une
     seconde entrée serait une erreur de compilation, et surtout deux vérités
     pour une même clé. */
  from_status: 'État précédent',
  to_status: 'Nouvel état',
  report_id: 'Signalement',
  equipment_status: 'État de l’équipement au moment du constat',
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
  /* abonnement SaaS (S5) — des références, des codes, des montants, jamais un
     motif : `has_reason` dit qu'il en existe un, l'écran d'abonnement le rend. */
  subscription_id: 'Abonnement',
  plan_id: 'Offre',
  plan_code: 'Code de l’offre',
  old_plan_id: 'Ancienne offre',
  automatic: 'Constaté automatiquement',
  subscription_invoice_id: 'Facture d’abonnement',
  subscription_payment_id: 'Règlement d’abonnement',
  subscription_status_after: 'État de l’abonnement après',
  number: 'N° de facture',
  period_start: 'Début de période',
  period_end: 'Fin de période',
  due_date: 'Échéance',
  /* support (S5 lot 3) — des ids et des CODES fermés (catégorie, urgence,
     côté, statut). L'objet du ticket, le corps d'un message et le nom d'un
     fichier ne sont posés dans AUCUN payload par le backend, et n'ont donc
     aucune clé ici : rien à masquer, rien à rendre. */
  ticket_id: 'Demande d’aide',
  /* `category` est une clé PARTAGÉE (support S5, équipements S8) : ce
     dictionnaire est indexé par nom de clé, pas par action, donc son libellé
     doit valoir pour les deux. « Sujet de la demande » était plus parlant côté
     support, mais aurait été faux sur une ligne de parc — « Catégorie » est
     juste des deux côtés, et la colonne « Action » lève l'ambiguïté. */
  category: 'Catégorie',
  priority: 'Urgence déclarée',
  ticket_status: 'État de la demande',
  message_id: 'Message',
  author_side: 'Écrit par',
  attachment_id: 'Pièce jointe',
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

/**
 * Taille lisible d'un fichier (Ko/Mo), en français.
 *
 * `toFixed(1)` rendait « 1.5 Mo » — un point décimal anglais dans une phrase
 * lue par une secrétaire à qui l'on refuse sa capture d'écran. Tout le reste
 * du fichier passe par `Intl` ; celui-ci aussi (correctif revue S5).
 */
const MB_FORMAT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${MB_FORMAT.format(bytes / 1048576)} Mo`;
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

/* ══ S5 (ADR 0018) — abonnement SaaS et module Support ═══════════════════
   Les phrases produit du sprint vivent ici, comme celles du KYC en S4 : elles
   sont dites À L'IDENTIQUE des deux côtés (le bandeau du directeur et la
   modale de l'exploitant qui décide le gel). Un texte recopié dérive ; un
   texte partagé se corrige une fois. ══════════════════════════════════════ */

/* ── l'abonnement du centre ── */

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  essai: 'Période d’essai',
  actif: 'Actif',
  impaye: 'Facture en retard',
  suspendu: 'Gestion suspendue',
  resilie: 'Contrat terminé',
};

/** Ce que l'état signifie, en une phrase, sous le badge. */
export const SUBSCRIPTION_STATUS_HELP: Record<SubscriptionStatus, string> = {
  essai: 'Votre centre découvre Chioni : rien n’est facturé pendant l’essai.',
  actif: 'Votre abonnement est à jour. Rien n’est fermé.',
  impaye: 'Une facture a dépassé son échéance. Rien n’est fermé pour autant.',
  suspendu:
    'La gestion administrative de votre centre est gelée le temps de régulariser.',
  resilie:
    'Le contrat est terminé. Vos données restent lisibles et exportables.',
};

export const BILLING_PERIOD_LABELS: Record<BillingPeriod, string> = {
  mensuel: 'par mois',
  annuel: 'par an',
};

/** Périodicité en tête de phrase (sélecteur back-office). */
export const BILLING_PERIOD_NOUNS: Record<BillingPeriod, string> = {
  mensuel: 'Mensuel',
  annuel: 'Annuel',
};

/**
 * Ce qui continue de fonctionner, quel que soit l'état de l'abonnement.
 * C'est l'arbitrage produit n° 2 du sprint : **suspendre ne doit jamais
 * empêcher de soigner ni renvoyer un centre au papier.** Phrase du backend
 * (`SUBSCRIPTION_SUSPENDED_MESSAGE`), tenue à l'identique côté écran.
 */
export const SUBSCRIPTION_STILL_WORKS =
  'Les soins, le carnet de santé, les rendez-vous, l’inscription des patients, la facturation et la caisse continuent normalement — ainsi que la lecture et l’export de vos données.';

/** Ce que le gel administratif ferme — et rien d'autre. */
export const SUBSCRIPTION_FROZEN_CLOSED =
  'Sont temporairement fermés : l’ajout, la modification et la réactivation d’un membre du personnel, la création et la modification des tarifs, ainsi que les statistiques du tableau de bord.';

/** Un impayé ne ferme rien : le dire est le cœur du bandeau. */
export const SUBSCRIPTION_UNPAID_NOTHING_CLOSED =
  'Aucune fonction n’est fermée : votre centre travaille exactement comme avant.';

/** Titre du bandeau, par état — jamais « erreur », jamais « panne ». */
export const SUBSCRIPTION_BANNER_TITLE: Record<SubscriptionStatus, string> = {
  essai: 'Période d’essai en cours',
  actif: 'Abonnement à jour',
  impaye: 'Une facture d’abonnement est en retard',
  suspendu: 'Gestion administrative suspendue',
  resilie: 'Contrat Chioni terminé',
};

/** Phrase d'ouverture du bandeau, par état. */
export const SUBSCRIPTION_BANNER_LEAD: Record<SubscriptionStatus, string> = {
  essai: 'Votre centre est en période d’essai.',
  actif: 'Votre abonnement Chioni est à jour.',
  impaye:
    'Une facture d’abonnement a dépassé son échéance. Réglez-la quand vous le pouvez, puis prévenez l’équipe Chioni.',
  suspendu:
    'L’équipe Chioni a suspendu la gestion administrative de votre centre.',
  resilie:
    'Le contrat de votre centre avec Chioni est terminé. Vos données restent à vous.',
};

/** Un contrat terminé n'est jamais une prise d'otage des données. */
export const SUBSCRIPTION_TERMINATED_DATA =
  'Rien n’est effacé : les dossiers de vos patients, vos factures et vos reçus restent lisibles, et vous pouvez continuer à les exporter.';

/** Titre du bloc portant le motif de la dernière décision (directeur seul). */
export const SUBSCRIPTION_REASON_TITLE: Record<SubscriptionStatus, string> = {
  essai: 'Message de l’équipe Chioni',
  actif: 'Message de l’équipe Chioni',
  impaye: 'Message de l’équipe Chioni',
  suspendu: 'Ce qu’il faut régulariser',
  resilie: 'Motif de la fin du contrat',
};

/** Rappel de confidentialité du motif — il n'est lu que par le directeur. */
export const SUBSCRIPTION_REASON_PRIVACY =
  'Ce message vous est adressé à vous seul : ni votre équipe, ni vos patients, ni leurs proches ne le voient.';

/**
 * Les deux `stats/*` répondent 400 sur un centre gelé (vigilance ADR 0018) :
 * l'écran met une explication à la place des graphiques, jamais une page
 * d'erreur — et surtout jamais l'idée que le produit est en panne.
 */
export const SUBSCRIPTION_STATS_FROZEN_TITLE = 'Chiffres momentanément indisponibles';
export const SUBSCRIPTION_STATS_FROZEN_HINT =
  'Vos graphiques reviendront dès que l’abonnement sera régularisé. Le reste du centre fonctionne : la file du jour, les dossiers et la caisse sont à leur place.';

/**
 * Version courte, pour les blocs SECONDAIRES du tableau de bord.
 *
 * Revue UX care S5 : un centre gelé recevait quatre fois le même paragraphe de
 * trois phrases (les deux graphiques + les deux compteurs financiers). Répéter
 * une mauvaise nouvelle quatre fois la transforme en mur ; l'explication
 * complète reste sur le graphique principal de chaque bloc, les compteurs se
 * contentent d'une ligne.
 */
export const SUBSCRIPTION_STATS_FROZEN_SHORT =
  'Chiffre indisponible le temps de régulariser l’abonnement.';

/* ── quotas : une information, jamais un blocage ── */

export const QUOTA_LABELS = {
  staff: 'Membres du personnel',
  practitioners: 'Praticiens',
} as const;

/** « 18 praticiens sur 15 inclus » / « 8 praticiens (illimité) ». */
export function quotaSummary(
  used: number,
  included: number | null,
  what: 'staff' | 'practitioners',
): string {
  const noun = what === 'staff' ? 'membre' : 'praticien';
  const plural = used > 1 ? 's' : '';
  if (included === null) return `${used} ${noun}${plural} · sans limite`;
  return `${used} ${noun}${plural} sur ${included} inclus`;
}

/** Le dépassement est une information COMMERCIALE — jamais un verrou. */
export const QUOTA_OVER_NOTICE =
  'Vous dépassez ce que votre offre inclut. Rien n’est bloqué pour autant : continuez à travailler, l’équipe Chioni vous proposera l’offre adaptée.';

export const QUOTA_WITHIN_NOTICE =
  'Votre usage tient dans votre offre.';

/* ── les factures d'abonnement (Chioni → centre) ── */

export const SUBSCRIPTION_INVOICE_STATUS_LABELS: Record<
  SubscriptionInvoiceStatus,
  string
> = {
  emise: 'À régler',
  payee: 'Réglée',
  annulee: 'Annulée',
};

/** Vocabulaire du solde : « déjà reçu » / « reste à régler », jamais « impayé ». */
export const SUBSCRIPTION_INVOICE_PAID_LABEL = 'Déjà reçu par Chioni';
export const SUBSCRIPTION_INVOICE_BALANCE_LABEL = 'Reste à régler';

/**
 * Le solde à zéro, DIT — et pas seulement peint en vert.
 *
 * Revue a11y S5 : « il ne reste rien à payer » n'était porté que par la
 * couleur du grand nombre (`--ax-success-700` + fond teinté). Une information
 * de cette portée ne repose jamais sur la couleur seule.
 */
export const SUBSCRIPTION_INVOICE_SETTLED_LABEL = 'Facture soldée — rien à régler.';

/** Un règlement partiel est normal, pas un défaut. */
export const SUBSCRIPTION_PARTIAL_NOTICE =
  'Un règlement partiel est enregistré : le reste à régler ci-dessous est le montant qui manque encore.';

export const SUBSCRIPTION_PAYMENT_METHOD_LABELS: Record<
  SubscriptionPaymentMethod,
  string
> = {
  virement: 'Virement',
  especes: 'Espèces',
  mobile_money: 'Mobile money',
  autre: 'Autre moyen',
};

/** Un règlement contre-passé, dit au directeur : « annulé », jamais le jargon. */
export const SUBSCRIPTION_PAYMENT_REVERSED_LABEL = 'Annulé par Chioni';

/** Le règlement se fait hors ligne — l'écran ne promet aucun bouton « payer ». */
export const SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE =
  'Le règlement se fait hors de l’application (virement, espèces ou mobile money) : dès que l’équipe Chioni l’a reçu, elle l’enregistre et cet écran se met à jour.';

/** Aucune facture encore émise — ce n'est pas « aucun contrat ». */
export const SUBSCRIPTION_NO_INVOICE_YET =
  'Aucune facture pour l’instant : la première sera émise à la fin de la période en cours.';

/** Aucun contrat en base : l'état NORMAL d'un centre né avant S5 (404). */
export const SUBSCRIPTION_NONE_TITLE = 'Aucun abonnement enregistré';
export const SUBSCRIPTION_NONE_MESSAGE =
  'Votre centre n’a pas encore de contrat d’abonnement dans Chioni. Ce n’est pas une erreur : rien n’est fermé, et l’équipe Chioni ouvrira le contrat le moment venu.';

/** Écran réservé au directeur — la garde frontend suit la permission backend. */
export const SUBSCRIPTION_DIRECTOR_ONLY_TITLE = 'Écran réservé au directeur';
export const SUBSCRIPTION_DIRECTOR_ONLY_MESSAGE =
  'Le contrat d’abonnement porte un prix, une échéance et les messages de l’équipe Chioni : il est réservé à la direction du centre.';

/* ── le module Support ── */

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  bug: 'Quelque chose ne marche pas',
  question: 'Une question',
  facturation: 'Facturation et abonnement',
  autre: 'Autre sujet',
};

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours de traitement',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  basse: 'Pas urgent',
  normale: 'Normal',
  haute: 'Important',
  urgente: 'Urgent — le centre est bloqué',
};

/** Ordre d'affichage du sélecteur, du plus calme au plus urgent. */
export const SUPPORT_PRIORITIES: SupportPriority[] = [
  'basse',
  'normale',
  'haute',
  'urgente',
];

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  'bug',
  'question',
  'facturation',
  'autre',
];

export const SUPPORT_STATUSES: SupportTicketStatus[] = [
  'ouvert',
  'en_cours',
  'resolu',
  'ferme',
];

/**
 * **L'AVERTISSEMENT OBLIGATOIRE, au moment d'écrire.** Phrase exposée par le
 * backend (`SUPPORT_PRIVACY_NOTICE` dans `apps/support/models.py`) et reprise
 * ici À LA LETTRE pour que l'écran et l'API ne dérivent pas. Elle se place à
 * côté du champ de saisie — jamais dans une aide repliée : c'est la seule
 * parade informationnelle d'un risque assumé (un ticket est du texte libre
 * qu'un exploitant Chioni lira).
 */
export const SUPPORT_PRIVACY_NOTICE =
  'Ne mettez ni nom de patient ni information médicale dans un ticket : donnez le numéro de dossier ou l’identifiant affiché à l’écran. L’équipe Chioni lit ces messages.';

/**
 * Le titre du bloc — il dit AIDE, pas interdiction.
 *
 * Revue UX care S5 : l'avertissement était monté en `ax-alert--warning`, avec
 * exactement le poids visuel de « Gestion suspendue ». Sur l'écran où l'on
 * demande de l'aide, un panneau jaune en tête de formulaire se lit comme un
 * reproche AVANT d'avoir écrit un mot — et le premier réflexe d'une secrétaire
 * pressée est de refermer. Le contenu ne bouge pas (parité backend), le
 * CADRAGE change : un titre d'aide, un ton `info`, et la marche à suivre juste
 * en dessous.
 */
export const SUPPORT_PRIVACY_TITLE = 'Comment décrire votre problème';

/**
 * Ce qu'il faut écrire À LA PLACE, aussi concrètement que ce qui est interdit.
 *
 * Revue UX care S5 : `SUPPORT_PRIVACY_NOTICE` renvoie au « numéro de dossier »,
 * or AUCUN écran du centre n'affiche de « numéro de dossier » patient — la
 * consigne pointe vers quelque chose d'introuvable. Ce qui EST affiché et
 * recopiable : « Facture n° 42 », un numéro de reçu (« G-000001 »), une date,
 * le nom de l'écran. On le dit, avec un exemple, parce qu'un exemple vaut mieux
 * qu'une règle.
 */
export const SUPPORT_PRIVACY_HOWTO =
  'Décrivez ce que vous avez fait et ce qui s’est passé, en désignant les choses par ce qui est écrit à l’écran : un numéro de facture, un numéro de reçu, une date, le nom de la page.';

/** L'exemple, à côté de la règle — c'est lui qui débloque la rédaction. */
export const SUPPORT_PRIVACY_EXAMPLE =
  'Par exemple : « Impossible d’enregistrer un paiement sur la facture n° 42, hier vers 10 h — le bouton reste gris. »';

/**
 * **Aucune notification n'existe** (vigilance actée ADR 0018 lot 3) : ni SMS
 * ni e-mail quand Chioni répond. Le taire ferait attendre une secrétaire
 * devant son téléphone. On le dit — et on dit le geste utile à la place.
 */
export const SUPPORT_NO_NOTIFICATION_NOTICE =
  'Vous ne recevrez ni SMS ni e-mail : revenez sur cette page pour lire la réponse de l’équipe Chioni.';

/** Qui voit quoi — dit à l'ouverture, pour qu'on écrive en connaissance. */
export const SUPPORT_VISIBILITY_NOTICE =
  'Ce ticket sera lu par l’équipe Chioni et par la direction de votre centre.';

/** Le support reste ouvert quoi qu'il arrive — y compris sur un centre gelé. */
export const SUPPORT_ALWAYS_OPEN_NOTICE =
  'Le support reste ouvert quel que soit l’état de votre abonnement : si votre gestion est suspendue, c’est précisément ici qu’il faut demander pourquoi.';

/** Un ticket fermé n'accepte plus rien — l'écran le dit avant le refus. */
export const SUPPORT_CLOSED_NOTICE =
  'Ce ticket est fermé : il ne reçoit plus de message ni de pièce jointe. Pour un autre sujet, ouvrez un nouveau ticket.';

/** Un ticket résolu accepte encore un message, et ne se rouvre pas tout seul. */
export const SUPPORT_RESOLVED_NOTICE =
  'Ce ticket est marqué résolu. Si le problème persiste, écrivez-le ici : l’équipe Chioni le reprendra.';

/** Le centre ne trie pas : le statut est le geste de Chioni. */
export const SUPPORT_STATUS_READONLY_NOTICE =
  'L’état du ticket est mis à jour par l’équipe Chioni.';

/** La sortie d'un ticket fermé, en geste plutôt qu'en lien de retour. */
export const SUPPORT_NEW_TICKET_ACTION = 'Ouvrir un nouveau ticket';

/* ── back-office : ce que le tri d'un ticket déclenche ── */

/**
 * `ferme` est DÉFINITIF (machine à états backend). Le poids du geste est porté
 * par l'UI avant le clic — et il est porté ici, partagé, parce que la même
 * nouvelle est annoncée au centre par `SUPPORT_CLOSED_NOTICE`.
 */
export const SUPPORT_CLOSE_WARNING =
  'Fermer un ticket est définitif : il n’acceptera plus aucun message ni aucune pièce, et il ne se rouvrira pas. Pour un autre sujet, le centre en ouvrira un nouveau.';

/** Les autres transitions : le centre les voit, mais rien ne le prévient. */
export const SUPPORT_STATUS_CHANGE_NOTICE =
  'Le centre verra ce changement d’état sur son écran. Aucune notification ne lui est envoyée.';

/** Les deux côtés du fil, nommés. */
export const SUPPORT_SIDE_LABELS = {
  centre: 'Votre centre',
  chioni: 'Chioni',
} as const;

/** L'interlocuteur est « Chioni », jamais une personne (author_display null). */
export const SUPPORT_CHIONI_AUTHOR = 'Équipe Chioni';

export const SUPPORT_EMPTY_TITLE = 'Aucun ticket pour l’instant';
export const SUPPORT_EMPTY_MESSAGE =
  'Quand quelque chose ne fonctionne pas, ou qu’une question reste sans réponse, ouvrez un ticket : l’équipe Chioni vous répond ici même.';

/** Pièces jointes : une capture d'écran est un PNG, le PDF est refusé. */
export const SUPPORT_ATTACHMENT_HINT =
  'Une capture d’écran aide beaucoup. Photo ou capture uniquement — les PDF ne sont pas acceptés.';

export function supportAttachmentLabel(id: number): string {
  return `Pièce jointe n° ${id}`;
}

/* ── le papier (facture / reçu), partagé par les émetteurs ───────────────
   Base Vireo `ecommerce/InvoiceDetails`. Ces libellés sont ceux du DOCUMENT
   lui-même, pas d'un écran : ils seront lus tels quels sur une impression, et
   ils serviront aux factures patient et aux reçus « R- » / « G- » quand ces
   écrans se brancheront sur le même composant. */

export const DOC_KIND_INVOICE = 'Facture';
export const DOC_KIND_RECEIPT = 'Reçu';
export const DOC_ISSUER_LABEL = 'Émis par';
export const DOC_RECIPIENT_LABEL = 'Émis à';
export const DOC_LINES_HEADER = 'Désignation';
export const DOC_AMOUNT_HEADER = 'Montant';
export const DOC_NOTES_LABEL = 'Notes';
export const DOC_PAYMENT_LABEL = 'Règlement';
export const DOC_PRINT_LABEL = 'Imprimer';
/** Un document annulé ne doit JAMAIS s'imprimer comme un document valide. */
export const DOC_VOIDED_LABEL = 'Facture annulée — sans valeur';

/** L'émetteur « Chioni » d'une facture d'abonnement. */
export const CHIONI_ISSUER = {
  name: 'Chioni',
  qualifier: 'Éditeur du logiciel de gestion',
  lines: ['Abonnement au logiciel de gestion Chioni', 'Union des Comores'],
} as const;

/** La qualité du destinataire d'une facture d'abonnement. */
export const CENTER_RECIPIENT_QUALIFIER = 'Centre de santé abonné';

/** Une facture d'abonnement porte UNE ligne : la période servie. */
export function subscriptionPeriodLine(start: string, end: string): string {
  return `Période du ${start} au ${end}`;
}

/* ── back-office : ce qu'une décision d'abonnement déclenche ── */

/**
 * Le poids de la décision, porté par l'UI avant le clic — patron
 * `KYC_SUSPEND_WARNING`. Ce que gèle une suspension d'abonnement est BORNÉ, et
 * ce qui continue est dit EN PREMIER.
 */
export const SUBSCRIPTION_SUSPEND_WARNING =
  'Suspendre gèle la gestion administrative du centre : personnel, tarifs et statistiques. Le centre continue de soigner, de prendre des rendez-vous, d’inscrire des patients au guichet, de facturer et d’encaisser — et les paiements de la diaspora continuent d’arriver.';

export const SUBSCRIPTION_TERMINATE_WARNING =
  'Résilier ferme la gestion administrative comme une suspension, et met fin au contrat. Le centre continue de soigner et d’encaisser, et garde la lecture ET l’export de ses données : on ne prend jamais les dossiers d’un centre en otage.';

export const SUBSCRIPTION_UNFREEZE_NOTICE =
  'Le centre retrouve la gestion de son personnel, de ses tarifs et de ses statistiques.';

export const SUBSCRIPTION_UNPAID_FLAG_NOTICE =
  'Signaler un impayé ne ferme rien : le centre voit un bandeau et reçoit des relances. Le gel, lui, se décide séparément.';

/** Le motif est LU PAR LE DIRECTEUR — une consigne, pas une note interne. */
export const SUBSCRIPTION_REASON_HELP =
  'Ce motif est lu par le directeur du centre, et par lui seul. Écrivez une consigne actionnable (« régularisez la facture A-000012 »), pas une note interne.';

/** Aucune tâche ne suspend ni ne résilie : le dire au back-office. */
export const SUBSCRIPTION_NO_AUTO_CUT =
  'Le cycle tourne seul (émission, drapeau d’impayé, relances) mais aucune tâche ne suspend ni ne résilie : le gel reste une décision d’exploitant, motivée et tracée.';

/** L'émission manuelle est à corps vide : le prix vient de l'offre. */
export const SUBSCRIPTION_ISSUE_NOTICE =
  'L’émission reprend exactement ce que ferait la tâche planifiée pour ce contrat : la période due, au montant figé de l’offre, avec son échéance. Le prix d’une offre se change sur l’offre.';

/** Le franc comorien ne porte pas de décimales — dit DANS le champ. */
export const KMF_INTEGRAL_HINT =
  'En francs comoriens entiers — le franc ne porte pas de décimales.';

/* ── back-office : l'équipe Chioni ── */

/** Un exploitant n'a ni nom ni téléphone dans ce payload : des ids. */
export function operatorLabel(id: number): string {
  return `Exploitant n° ${id}`;
}

export function operatorAccountLabel(userId: number): string {
  return `Compte n° ${userId}`;
}

/** Un exploitant naît en compte ombre — ne jamais promettre d'identifiants. */
export const OPERATOR_SHADOW_NOTICE =
  'Le compte est créé sans mot de passe : la personne en prend possession en recevant un code par SMS à sa première connexion. Aucun identifiant n’est à transmettre.';

/** Séparation des pouvoirs, expliquée AVANT le refus. */
export const OPERATOR_SEPARATION_NOTICE =
  'Un compte qui travaille déjà dans un centre de santé ne peut pas recevoir cette casquette : quelqu’un de l’équipe Chioni qui exerce aussi dans un centre utilise deux comptes.';

/** La garde « dernier admin » est EXPLIQUÉE, pas subie. */
export const OPERATOR_LAST_ADMIN_NOTICE =
  'Vous êtes le dernier administrateur actif : ni la rétrogradation ni la désactivation ne sont possibles tant que personne d’autre ne porte ce rôle. Nommez d’abord un autre administrateur.';

/**
 * La même garde, sur la LIGNE concernée — une explication à trois cartouches
 * de distance du bouton absent se subit quand même.
 */
export const OPERATOR_LAST_ADMIN_ROW =
  'Dernier administrateur actif — nommez-en un autre pour pouvoir modifier ce compte.';

/**
 * Réactiver vaut créer (correctif guardian S5) : la séparation des pouvoirs
 * s'applique aussi au retour. Le dire avant le clic évite un refus opaque.
 */
export const OPERATOR_REACTIVATE_NOTICE =
  'Rendre l’accès revient à recréer la casquette : si ce compte travaille désormais dans un centre de santé, le retour sera refusé.';

/** On révoque, on ne supprime pas : la ligne est de l'histoire. */
export const OPERATOR_NO_DELETE_NOTICE =
  'Un exploitant ne se supprime pas : on lui retire l’accès. La ligne reste, c’est elle qui rend lisibles les anciennes entrées du journal.';

export const OPERATOR_LIST_AUSTERE_NOTICE =
  'Cette liste ne montre que des identifiants de compte : ni nom, ni téléphone. C’est voulu — un compte créé par SMS porte son numéro dans son identifiant.';

/** Écran réservé à l'`admin`, en lecture COMME en écriture. */
export const OPERATOR_ADMIN_ONLY_TITLE = 'Réservé aux administrateurs';
export const OPERATOR_ADMIN_ONLY_MESSAGE =
  'Savoir qui détient la casquette d’exploitant relève de la gouvernance de Chioni : seuls les administrateurs de la plateforme accèdent à cet écran.';

/* ── ressources humaines (S7, ADR 0020) ──────────────────────────────────
   Ce module parle de PERSONNES QUI TRAVAILLENT, pas de ressources. Le
   vocabulaire suit celui du registre papier qu'on numérise — « feuille de
   présence », « absent ce jour » — et évite systématiquement le registre du
   contrôle : ni « pointage », ni « taux de présence » brandi comme un
   jugement, ni « effectif ». C'est une contrainte de conception, pas une
   coquetterie : la ligne n° 1 du produit (« aider mieux, jamais surveiller »)
   cesse ici d'être une formule sur les patients. */

/** Le statut RÉEL d'une journée (feuille du directeur, données de la personne). */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent',
  conge: 'En congé',
  repos: 'Repos',
  ferie: 'Jour férié',
};

/** Ordre de saisie : les deux cas courants d'abord, le férié en sortie. */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'absent',
  'conge',
  'repos',
  'ferie',
];

/**
 * Le planning collectif. **`conge` n'existe pas ici et n'existera jamais** :
 * le backend le fond dans `absent` (ADR 0020 décision 6). « Absent ce jour »
 * plutôt qu'« Absent » sec — on ne sait pas pourquoi la personne n'est pas
 * là, et c'est exactement le but.
 */
export const PUBLIC_ATTENDANCE_LABELS: Record<PublicAttendanceStatus, string> = {
  present: 'Présent',
  absent: 'Absent ce jour',
  repos: 'Repos',
  ferie: 'Jour férié',
};

/** Une journée non notée. **Jamais « présent » par défaut** — c'est un trou. */
export const ATTENDANCE_UNSET_LABEL = 'Non renseigné';

/** L'option « vider » n'existe pas côté API : on ne peut que noter. */
export const ATTENDANCE_UNSET_OPTION = '— à noter';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annuel: 'Congé annuel',
  maladie: 'Congé maladie',
  maternite: 'Congé maternité',
  paternite: 'Congé paternité',
  deuil: 'Congé de deuil',
  sans_solde: 'Congé sans solde',
  autre: 'Autre congé',
};

/** Ordre du sélecteur : le cas de loin le plus courant en tête. */
export const LEAVE_TYPES: LeaveType[] = [
  'annuel',
  'maladie',
  'maternite',
  'paternite',
  'deuil',
  'sans_solde',
  'autre',
];

/**
 * `annule` est le geste de LA PERSONNE (elle retire sa demande) : « Retiré »,
 * jamais « Annulé », qui se lirait comme une décision prise contre elle.
 */
export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  demande: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
  annule: 'Retiré',
};

export const LEAVE_STATUSES: LeaveStatus[] = ['demande', 'approuve', 'refuse', 'annule'];

/** « 1 journée » / « 4 journées » — un AFFICHAGE, jamais un solde de droits. */
export function leaveDaysLabel(days: number): string {
  return days > 1 ? `${days} journées` : `${days} journée`;
}

/** « du 3 septembre 2026 au 7 septembre 2026 », ou la date seule si un jour. */
export function leaveRangeLabel(start: string, end: string): string {
  if (start === end) return `le ${formatDate(start)}`;
  return `du ${formatDate(start)} au ${formatDate(end)}`;
}

/* ── ce que l'écran doit dire à voix haute ── */

/**
 * **La décision la plus importante du sprint pour la sécurité** (ADR 0020
 * décision 2), redite dans l'UI : confondre fonction et rôle créerait un
 * second système de permissions à côté du premier, et c'est ainsi qu'un jour
 * quelqu'un lirait un dossier médical parce que sa fiche de poste dit
 * « soignant ».
 */
export const HRM_JOB_TITLE_NO_RIGHTS =
  'Un service et une fonction sont des libellés d’organisation : ils n’ouvrent aucun droit dans Chioni. Les accès restent gouvernés par les rôles, dans « Personnel ».';

/** Version courte, posée au contact du sélecteur de fonction d'un dossier. */
export const HRM_JOB_TITLE_NO_RIGHTS_SHORT =
  'Libellé d’organisation — n’ouvre aucun droit.';

/** Ce que la feuille de présence est, et ce qu'elle n'est pas. */
export const HRM_ATTENDANCE_INTENT =
  'C’est la feuille de présence de votre centre, telle que vous la teniez sur papier : une journée par personne, notée par vous.';

/**
 * Ce que le produit REFUSE de construire, dit à l'écran plutôt que subi :
 * ni heure d'arrivée, ni heure de départ, ni position (ADR 0020 décision 3).
 */
export const HRM_ATTENDANCE_NO_CLOCK =
  'Chioni ne note ni heure d’arrivée, ni heure de départ, ni position : la numérisation ne crée aucune surveillance qui n’existait pas sur le papier.';

/** La feuille se corrige : re-choisir un statut remplace la note du jour. */
export const HRM_ATTENDANCE_UPSERT_HINT =
  'Une feuille se corrige : rechoisir un statut remplace simplement la note de cette journée.';

/** Bornes du backend, annoncées avant le refus. */
export const HRM_ATTENDANCE_FUTURE_HINT =
  'Les journées à venir ne se notent pas : la feuille dit ce qui s’est passé.';

/**
 * Le geste de saisie rapide, décrit sans ambiguïté.
 *
 * **Revue UX care S7** : la phrase disait ce que le bouton NE touche pas
 * (« uniquement les cases encore vides ») sans jamais dire ce qu'il ÉCRIT.
 * Un responsable pouvait cliquer « Compléter » en croyant ouvrir la colonne à
 * la saisie, et noter toute son équipe présente. Le libellé du bouton porte
 * maintenant la valeur écrite, et la phrase la répète.
 */
export const HRM_ATTENDANCE_FILL_HINT =
  'Note « Présent » sur les cases encore vides de cette journée. Ce qui est déjà noté n’est jamais touché.';

/** Le libellé du bouton lui-même — il dit la valeur écrite, pas « Compléter ». */
export const HRM_ATTENDANCE_FILL_ACTION = 'Tous présents';

/** Une saisie groupée interrompue : ce qui est passé reste, on le dit. */
export const HRM_ATTENDANCE_BULK_PARTIAL =
  'Les journées déjà enregistrées avant ce refus sont conservées : reprenez à la première case restée vide.';

/**
 * L'invariant du planning collectif, dit AUX COLLÈGUES qui le lisent.
 * Sans cette phrase, « Absent ce jour » se lit comme une information
 * incomplète, et quelqu'un cherchera à la compléter ailleurs.
 */
export const HRM_SCHEDULE_NO_REGIME =
  'Vous voyez qui est là et qui ne l’est pas — jamais pourquoi. Le motif d’une absence ne regarde que la personne et la direction.';

export const HRM_SCHEDULE_UNSET_HINT =
  '« Non renseigné » veut dire que la journée n’a pas encore été notée sur la feuille de présence — pas que la personne est absente.';

/**
 * La fenêtre de service (±31 jours, revue guardian S7), dite AVANT le refus.
 *
 * Le planning répond à « qui est là aujourd'hui ? » : ce n'est pas un
 * historique, et le backend le borne pour qu'on ne puisse pas reconstituer le
 * relevé d'absences nominatif de tout le service sur l'année. L'écran renvoie
 * chacun vers SON dossier plutôt que de laisser buter sur un 400.
 */
export const HRM_SCHEDULE_WINDOW_HINT =
  'Ce planning est un tableau de service : il couvre le mois autour d’aujourd’hui. Pour retrouver vos propres journées plus anciennes, ouvrez « Mon dossier dans ce centre ».';

/**
 * Le titre de la journée. **Aucun dénominateur** : « 0 présent sur 12 » sur une
 * journée que personne n'a encore notée se lit comme une équipe absente, et
 * « 5 sur 12 » comme un taux de présence — soit exactement le KPI que ce
 * module refuse d'afficher à toute une équipe. On compte des présences
 * constatées, dégenrées, et rien d'autre (revue UX care S7).
 */
export function schedulePresentLabel(present: number): string {
  if (present === 0) return 'Aucune présence notée';
  if (present === 1) return '1 personne présente';
  return `${present} personnes présentes`;
}

/** Aucune journée notée du tout : ce n'est pas une absence générale. */
export const HRM_SCHEDULE_ALL_UNSET = 'Journée pas encore renseignée';

/**
 * **Aucun motif libre, nulle part** (ADR 0020 décision 4) — dit au demandeur
 * comme au décideur. Un motif de congé est de la donnée de santé ou de vie
 * privée : le type suffit à décompter des droits, la phrase n'ajoute qu'un
 * risque.
 */
export const HRM_LEAVE_NO_REASON =
  'Choisissez un type dans la liste : Chioni n’enregistre aucun motif écrit. Si votre centre demande un justificatif, joignez-le en photo — il reste privé.';

/** Le refus, expliqué au directeur AVANT qu'il ne cherche le champ absent. */
export const HRM_LEAVE_REFUSE_WARNING =
  'Refuser n’enregistre aucun motif : Chioni ne conserve aucun texte écrit sur le congé de quelqu’un. Expliquez votre décision de vive voix — la personne verra seulement que sa demande est refusée.';

export const HRM_LEAVE_APPROVE_WARNING =
  'La personne verra sa demande approuvée. Pensez à noter ses journées sur la feuille de présence le moment venu : c’est elle qui fait foi.';

/** Les trois issues sont terminales — le dire avant le clic, pas après le 400. */
export const HRM_LEAVE_DECISION_FINAL =
  'Une décision est définitive : elle ne se reprend pas depuis Chioni.';

/** Le chevauchement se tranche à l'approbation, jamais à la saisie. */
export const HRM_LEAVE_OVERLAP_HINT =
  'Deux demandes peuvent se chevaucher : c’est à l’approbation que cela se tranche.';

/** Ce que l'annulation d'un congé approuvé N'EST PAS (consigné hors périmètre). */
export const HRM_LEAVE_CANCEL_SCOPE =
  'Une demande ne se retire que tant qu’elle est en attente. Une fois décidée, c’est la feuille de présence qui dit ce qui s’est réellement passé.';

/** Le justificatif : une photo privée, jamais un texte. */
export const HRM_LEAVE_DOCUMENT_HINT =
  'Photo ou capture uniquement (JPEG, PNG ou WebP, 2 Mo maximum) — les PDF ne sont pas acceptés. La pièce n’est lisible que par vous et la direction de votre centre.';

/**
 * **Revue UX care S7** — trois défauts sur un geste DÉFINITIF :
 *
 * 1. le verbe « Archiver » se lit « ranger, mettre de côté » par quelqu'un qui
 *    n'est pas du métier — soit l'inverse de ce qu'il fait ;
 * 2. la phrase ne vivait que dans un attribut `title`, qui ne s'ouvre jamais
 *    au doigt sur un Android (l'écran de la feuille de présence l'écrit
 *    lui-même deux fichiers plus loin) ;
 * 3. un seul clic suffisait, sans confirmation.
 *
 * Le geste s'appelle donc « Retirer », sa conséquence est écrite en clair au
 * contact du bouton, et il demande une confirmation sur place.
 */
export const HRM_LEAVE_DOCUMENT_ARCHIVE_WARNING =
  'Retirer une pièce est définitif : elle ne sera plus présentée avec votre demande et vous ne pourrez pas la remettre. Vous pouvez en revanche en joindre une autre.';

export const HRM_LEAVE_DOCUMENT_ARCHIVE_CONFIRM = 'Confirmer le retrait';

export const HRM_LEAVE_DOCUMENT_EMPTY = 'Aucun justificatif joint à cette demande.';

export function leaveDocumentLabel(id: number): string {
  return `Justificatif n° ${id}`;
}

/* ── états vides, bienveillants ── */

export const HRM_NO_EMPLOYMENT_TITLE = 'Aucun dossier ouvert pour l’instant';
export const HRM_NO_EMPLOYMENT_DIRECTOR =
  'Ouvrez un dossier pour chaque personne qui travaille dans votre centre : c’est lui qui porte sa feuille de présence et ses congés.';
export const HRM_NO_EMPLOYMENT_STAFF =
  'La direction n’a pas encore ouvert de dossier pour l’équipe. Le planning apparaîtra ici dès que ce sera fait.';

export const HRM_SCHEDULE_EMPTY_TITLE = 'Personne dans le planning';
export const HRM_SCHEDULE_EMPTY_MESSAGE =
  'Le planning se remplit à partir des dossiers du personnel. Dès qu’un dossier est ouvert, la personne y apparaît.';

export const HRM_NO_LEAVE_TITLE = 'Aucune demande de congé';
export const HRM_NO_LEAVE_DIRECTOR =
  'Les demandes déposées par votre équipe arrivent ici. Rien à décider pour le moment.';
export const HRM_NO_LEAVE_FILTER =
  'Aucune demande ne correspond à ce filtre.';

export const HRM_NO_DEPARTMENT_MESSAGE =
  'Aucun service pour l’instant. Créez ceux de votre centre — « Maternité », « Laboratoire », « Accueil » — pour ranger les dossiers du personnel.';
export const HRM_NO_JOB_TITLE_MESSAGE =
  'Aucune fonction pour l’instant. Créez celles de votre centre — « Sage-femme », « Aide-soignant », « Caissier » — pour qualifier les dossiers.';
export const HRM_NO_HOLIDAY_MESSAGE =
  'Aucun jour férié enregistré. Ajoutez ceux que votre centre observe : ce calendrier vous appartient, une clinique peut très bien travailler un jour férié national.';

export const HRM_HOLIDAY_DELETE_WARNING =
  'Retirer ce jour férié ne touche pas la feuille de présence : ce qui a été noté ce jour-là reste noté.';

/* ── « Mon dossier » — la personne, sur ses propres données ── */

export const HRM_ME_TITLE = 'Mon dossier dans ce centre';

/** **404 = état NORMAL**, jamais une erreur rouge (contrat §HRM). */
export const HRM_ME_NONE_TITLE = 'Pas encore de dossier ici';
export const HRM_ME_NONE_MESSAGE =
  'La direction de votre centre n’a pas encore ouvert votre dossier du personnel. Ce n’est pas une erreur : rien de ce que vous faites dans Chioni n’en dépend.';

export const HRM_ME_ATTENDANCE_TITLE = 'Mes journées';
export const HRM_ME_ATTENDANCE_EMPTY = 'Aucune journée notée sur les 30 derniers jours.';

/**
 * Qui tient la feuille, et quoi faire en cas d'erreur.
 *
 * **Revue UX care S7** : la liste arrivait nue. Une personne qui lit « Absent »
 * sur une journée où elle était au travail n'avait aucun recours indiqué — et
 * comme `MyAttendanceSerializer` n'expose volontairement pas `noted_by`
 * (arbitrage ADR 0020 n° 11 : ne pas transformer la feuille en objet de
 * conflit entre collègues), elle n'avait même pas d'interlocuteur. On nomme
 * l'interlocuteur sans nommer personne : la direction.
 */
export const HRM_ME_ATTENDANCE_HINT =
  'Vos dernières journées notées, les plus récentes en premier. C’est la direction de votre centre qui tient la feuille, comme sur le registre papier : si une journée vous semble inexacte, dites-le-lui, elle peut la corriger.';

export const HRM_ME_LEAVES_TITLE = 'Mes congés';
export const HRM_ME_LEAVES_EMPTY = 'Vous n’avez déposé aucune demande de congé.';

/**
 * Un refus, dit avec tact et sans mensonge.
 *
 * Le backend ne porte **aucun** motif (ADR 0020 décision 4) : l'écran ne doit
 * donc ni en inventer un, ni laisser croire qu'il en existe un caché quelque
 * part. La phrase dit les deux choses en une : rien n'est enregistré, et la
 * conversation se tient hors de l'application.
 */
export const HRM_ME_REFUSED_NO_REASON =
  'Chioni n’enregistre aucun motif de refus, ni ici ni ailleurs. Votre direction peut vous l’expliquer directement.';

/**
 * La lecture de ses propres données reste ouverte **même quand le centre est
 * gelé** (ADR 0020 décision 7, arbitrage PO n° 3) — et les gestes de la
 * personne aussi. On ne prend jamais en otage les données de quelqu'un pour
 * une facture que son employeur n'a pas réglée.
 */
export const HRM_ME_ALWAYS_OPEN =
  'Votre dossier reste consultable quel que soit l’état de l’abonnement de votre centre, et vous pouvez toujours demander un congé.';

export const HRM_ME_HIRED_LABEL = 'Dans l’équipe depuis le';
export const HRM_ME_ENDED_LABEL = 'Fin de l’emploi';
export const HRM_ME_REQUEST_LEAVE = 'Demander un congé';

/* ── gel d'abonnement, décliné au registre du personnel ── */

/**
 * Patron obligatoire des bandeaux de gel : **ce qui continue AVANT ce qui est
 * fermé**. Décliné ici parce que la phrase générale
 * (`SUBSCRIPTION_FROZEN_CLOSED`) n'énumère que le personnel, les tarifs et
 * les statistiques — un directeur ne doit pas deviner ce qu'il advient de sa
 * feuille de présence.
 */
export const HRM_FROZEN_STILL_WORKS =
  'La lecture du registre reste entière : le planning, la feuille de présence, les congés et les dossiers restent consultables. Chacun continue de demander ses congés, de les retirer et de déposer un justificatif — personne n’est puni pour une facture en attente.';

export const HRM_FROZEN_CLOSED =
  'Sont temporairement fermées : la saisie de la feuille de présence, les décisions sur les congés, l’ouverture et la modification des dossiers, ainsi que les services, les fonctions et les jours fériés.';

/* ── en-têtes des deux écrans ── */

export const HRM_REGISTER_TITLE = 'Registre du personnel';
export const HRM_REGISTER_SUBTITLE =
  'La feuille de présence, les congés, les dossiers et l’organisation de votre centre.';
export const HRM_TEAM_DAY_TITLE = 'Équipe du jour';
export const HRM_TEAM_DAY_SUBTITLE = 'Qui est là, jour par jour.';

/* ── le graphique de la feuille : ce qu'il compte, et ce qu'il ne compte pas ── */

export const HRM_STATS_TITLE = 'Ce que dit la feuille';

/**
 * Le cadrage du graphique, écrit plutôt que sous-entendu.
 *
 * L'endpoint renvoie aussi `by_employment` — un décompte PAR PERSONNE — et
 * l'écran ne le dessine pas : un classement nominatif des journées d'absence
 * serait l'instrument d'évaluation que ce module refuse d'inventer. Le dire à
 * l'écran engage la direction qui le lit chaque matin, et pas seulement le
 * code qui l'a écrit (revue UX care S7).
 */
export const HRM_STATS_SUBTITLE =
  'Les journées notées sur les 30 derniers jours — de quoi repérer d’un coup d’œil les périodes qui restent à remplir.';

export const HRM_STATS_NO_RANKING =
  'Ce graphique compte des journées, jamais des personnes : Chioni ne calcule aucun taux de présence ni aucun classement individuel.';

export const HRM_STATS_EMPTY =
  'Aucune journée notée sur les 30 derniers jours. Le graphique apparaîtra dès les premières notes de la feuille.';

/** L'administration RH suit la permission backend : directeur seul. */
export const HRM_DIRECTOR_ONLY_TITLE = 'Écran réservé à la direction';
export const HRM_DIRECTOR_ONLY_MESSAGE =
  'La feuille de présence, les congés et les dossiers du personnel portent des données personnelles : ils sont réservés à la direction du centre. Vous pouvez consulter le planning de l’équipe et votre propre dossier.';

/* ════════════════════════════════════════════════════════════════════════════
   S8 — ÉQUIPEMENTS (ADR 0021)

   Le plus petit module du produit, et celui dont le TON compte le plus par
   unité de texte. Deux règles gouvernent chaque phrase de cette section :

   1. **Signaler ≠ décider.** Un signalement est un CONSTAT ; il ne change pas
      l'état de l'appareil. Chaque phrase du parcours de signalement le
      rappelle, jusqu'au message de succès qui NOMME l'état resté inchangé —
      sans quoi l'infirmière croira avoir mis l'appareil hors service.
   2. **Un constat est un service rendu à l'équipe, jamais une dénonciation ni
      une réclamation.** Personne ne doit hésiter à le poser. Le vocabulaire
      exclut donc « plainte », « responsable », « incident » et « faute » — et
      le modèle backend n'a d'ailleurs aucun champ de responsabilité.

   Rien de ce module n'est gelé par l'abonnement (décision 4) : aucune phrase
   de gel ici, et il ne faut pas en ajouter.
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * L'état officiel, tel que tout le staff le lit.
 *
 * `en_panne` n'est **jamais rendu en rouge d'alarme** (voir `EQUIPMENT_TONES`
 * dans `screens/centre/shared.tsx`) : c'est une information de service, pas
 * une faute — le même arbitrage que « Manqué » sur un rendez-vous.
 */
export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  en_service: 'En service',
  en_panne: 'En panne',
  reforme: 'Réformé',
};

/** Ordre des pastilles de filtre (« Tous » est ajouté en tête par l'écran). */
export const EQUIPMENT_STATUSES: EquipmentStatus[] = ['en_service', 'en_panne', 'reforme'];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  diagnostic: 'Diagnostic',
  imagerie: 'Imagerie',
  bloc_operatoire: 'Bloc opératoire',
  laboratoire: 'Laboratoire',
  mobilier_medical: 'Mobilier médical',
  informatique: 'Informatique',
  autre: 'Autre',
};

/** Les seules valeurs acceptées par `?category=` (hors liste → 400 par champ). */
export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  'diagnostic',
  'imagerie',
  'bloc_operatoire',
  'laboratoire',
  'mobilier_medical',
  'informatique',
  'autre',
];

/* ── en-têtes ── */

export const EQUIPMENT_TITLE = 'Équipements';

/** Ce que l'écran répond, en une phrase : ce qu'on a, où, et si ça marche. */
export const EQUIPMENT_SUBTITLE = 'Le matériel du centre : où il se trouve, et s’il marche.';

export const EQUIPMENT_DETAIL_BACK = 'Équipements';
export const EQUIPMENT_SHEET_TITLE = 'Fiche de l’appareil';

/* ── la distinction centrale du module, dite partout où elle peut manquer ── */

/**
 * Sur le formulaire de signalement, AVANT le champ. La phrase la plus
 * importante du sprint : sans elle, on croit avoir mis l'appareil hors
 * service en le signalant.
 */
export const EQUIPMENT_REPORT_NOT_A_STATUS =
  'Votre signalement ne change pas l’état de l’appareil : il prévient l’équipe et la direction, qui décide de la suite.';

/**
 * Après l'envoi — et le message **nomme l'état resté inchangé**. Un
 * « Signalement enregistré » seul laisserait exactement le doute que la phrase
 * ci-dessus vient de lever.
 */
export function equipmentReportSaved(status: EquipmentStatus): string {
  return `Signalement enregistré, merci. L’appareil reste noté « ${EQUIPMENT_STATUS_LABELS[status]} » : c’est la direction qui change l’état.`;
}

/** Le ton : un constat rendu service, pas une réclamation. */
export const EQUIPMENT_REPORT_INVITE =
  'Décrivez ce que vous avez constaté, avec vos mots. Un appareil signalé tôt est un appareil réparé tôt — personne n’est mis en cause.';

/**
 * L'honnêteté qui accompagne l'audience : ne JAMAIS promettre un anonymat qui
 * n'existe pas. Le fil ne porte pas l'auteur, mais la direction, elle, le
 * sait — le dire calmement vaut mieux qu'un silence qu'on découvrirait.
 *
 * La phrase **s'arrête là** (revue UX care S8) : elle finissait par « c'est
 * elle qui décide de la suite », mot pour mot la fin de
 * `EQUIPMENT_REPORT_NOT_A_STATUS` affichée trente mots plus haut dans la MÊME
 * modale. Trois blocs de prose autour d'un seul champ, dont deux qui se
 * répètent, c'est la dose au-delà de laquelle on ne lit plus rien — et ce
 * qu'on cesse alors de lire, c'est justement la phrase du sprint.
 */
export const EQUIPMENT_REPORT_WHO_SEES =
  'Votre nom n’apparaît pas dans le fil : l’équipe lit le constat, pas son auteur. La direction, elle, sait qui a signalé.';

export const EQUIPMENT_REPORT_ACTION = 'Signaler une panne';
export const EQUIPMENT_REPORT_SUBMIT = 'Envoyer le signalement';
export const EQUIPMENT_REPORT_FIELD_LABEL = 'Ce que vous avez constaté';

/** Append-only : on ne corrige pas, on ajoute. Dit au bon moment, pas en note. */
export const EQUIPMENT_REPORT_APPEND_ONLY =
  'Un signalement ne se modifie pas et ne s’efface pas. Pour corriger ou compléter, ajoutez-en un second — le fil garde les deux.';

export const EQUIPMENT_REPORTS_TITLE = 'Signalements';
export const EQUIPMENT_REPORTS_SUBTITLE = 'Du plus récent au plus ancien';

export const EQUIPMENT_REPORTS_EMPTY_TITLE = 'Aucun signalement';
export const EQUIPMENT_REPORTS_EMPTY_MESSAGE =
  'Personne n’a encore rien constaté sur cet appareil. Si quelque chose ne va pas, dites-le ici : c’est utile à toute l’équipe.';

/** L'appareil est sorti du parc : le formulaire est masqué, et on dit pourquoi. */
export const EQUIPMENT_REPORT_CLOSED_REFORME =
  'Cet appareil est réformé : il n’est plus en service, on n’y signale donc plus de panne. Les constats déjà posés restent lisibles ci-dessous.';

/* ── compteurs de lecture du tableau ── */

export function equipmentReportCountLabel(count: number): string {
  if (count === 0) return 'Aucun';
  return count === 1 ? '1 signalement' : `${count} signalements`;
}

export function equipmentLastReportLabel(iso: string): string {
  return `dernier le ${formatDate(iso)}`;
}

/** Le résumé du parc — affiché SEULEMENT quand aucun filtre ne le fausse. */
export function equipmentParkSummary(total: number, broken: number, retired: number): string {
  const parts = [total === 1 ? '1 appareil' : `${total} appareils`];
  if (broken > 0) parts.push(broken === 1 ? '1 en panne' : `${broken} en panne`);
  if (retired > 0) parts.push(retired === 1 ? '1 réformé' : `${retired} réformés`);
  return parts.join(' · ');
}

/* ── le geste du directeur : changer l'état ── */

export const EQUIPMENT_STATUS_SECTION_TITLE = 'État de l’appareil';

/** Qui décide, dit à ceux qui ne décident pas — sans les renvoyer nulle part. */
export const EQUIPMENT_STATUS_DIRECTOR_ONLY =
  'Seule la direction change l’état officiel d’un appareil. Vous pouvez signaler une panne à tout moment : c’est le geste qui déclenche la décision.';

export const EQUIPMENT_MARK_BROKEN = 'Noter en panne';
export const EQUIPMENT_MARK_IN_SERVICE = 'Remettre en service';
export const EQUIPMENT_RETIRE = 'Réformer';

/** `en_service ⇄ en_panne` est RÉVERSIBLE : le dire distingue ce geste-là du
    seul geste définitif de l'écran, juste à côté. */
export const EQUIPMENT_STATUS_REVERSIBLE =
  '« En service » et « en panne » se corrigent l’un par l’autre : vous pourrez revenir sur ce choix.';

export function equipmentStatusChanged(status: EquipmentStatus): string {
  return `État mis à jour : l’appareil est noté « ${EQUIPMENT_STATUS_LABELS[status]} ».`;
}

/* ── réformer : le seul geste définitif du module ── */

export const EQUIPMENT_RETIRE_TITLE = 'Réformer cet appareil';

/**
 * Ce que réformer fait — et, tout aussi important, ce que ça ne fait PAS.
 * Un équipement ne se supprime jamais : le parc raconte son histoire, y
 * compris ce qui en est sorti. Le dire évite la peur d'effacer une trace.
 */
export const EQUIPMENT_RETIRE_WARNING =
  'Réformer sort définitivement l’appareil du service. C’est le seul geste de cet écran sur lequel on ne peut pas revenir : un appareil réformé ne peut plus être remis en service, et on ne peut plus y signaler de panne.';

export const EQUIPMENT_RETIRE_KEEPS =
  'L’appareil n’est pas supprimé : sa fiche et ses signalements restent lisibles dans la liste. Le parc garde la mémoire de ce qui en est sorti.';

export const EQUIPMENT_RETIRE_CONFIRM = 'Réformer définitivement';

/**
 * Le constat, une fois la réforme faite, sur la fiche elle-même.
 *
 * `EQUIPMENT_RETIRE_KEEPS` y était réemployé (revue UX care S8) : écrite pour
 * la modale, elle est tournée vers l'avenir et renvoie « dans la liste » — ce
 * qui sonne faux quand on est justement EN TRAIN de lire la fiche. Même
 * promesse, au bon temps et au bon endroit.
 */
export const EQUIPMENT_RETIRED_NOTE =
  'Cet appareil est sorti du service. Sa fiche et ses signalements restent consultables.';

/* ── déclarer et corriger une fiche (directeur seul) ── */

export const EQUIPMENT_CREATE_ACTION = 'Déclarer un équipement';
export const EQUIPMENT_CREATE_TITLE = 'Déclarer un équipement';
export const EQUIPMENT_EDIT_ACTION = 'Modifier la fiche';
export const EQUIPMENT_EDIT_TITLE = 'Modifier la fiche';

export const EQUIPMENT_NAME_LABEL = 'Nom de l’appareil';
export const EQUIPMENT_NAME_HINT =
  'Le nom que votre équipe emploie : « Échographe salle 2 », « Tensiomètre accueil ».';

export const EQUIPMENT_CATEGORY_LABEL = 'Catégorie';

export const EQUIPMENT_LOCATION_LABEL = 'Emplacement';

/** Texte libre ASSUMÉ (décision 2) : un échographe vit là où il vit. */
export const EQUIPMENT_LOCATION_HINT =
  'Écrivez-le comme vous le diriez : « bloc », « salle d’accouchement », « couloir de l’accueil ». Facultatif.';

export const EQUIPMENT_SERIAL_LABEL = 'Numéro de série';

/** Libre et NON unique : deux appareils identiques sans numéro sont normaux. */
export const EQUIPMENT_SERIAL_HINT =
  'Facultatif, et sans format imposé. Deux appareils identiques peuvent porter le même numéro, ou aucun.';

export const EQUIPMENT_COMMISSIONED_LABEL = 'Mis en service le';
export const EQUIPMENT_COMMISSIONED_HINT =
  'Facultatif — la date à partir de laquelle l’appareil sert.';

export const EQUIPMENT_NOTES_LABEL = 'Notes';
export const EQUIPMENT_NOTES_HINT =
  'Ce qui aide à s’en servir ou à le réparer : accessoires, contact du réparateur, particularités. Facultatif.';

export const EQUIPMENT_NO_SERIAL = 'Sans numéro';
export const EQUIPMENT_NO_LOCATION = 'Emplacement non précisé';
export const EQUIPMENT_NO_NOTES = 'Aucune note';
export const EQUIPMENT_NO_COMMISSIONED = 'Non précisée';

/** Le parc n'a AUCUNE valeur financière, et c'est une décision (ADR 0021 §3). */
export const EQUIPMENT_NO_MONEY_NOTICE =
  'Cette fiche ne porte ni prix d’achat, ni valeur : le parc sert à savoir ce qui marche, pas à faire de la comptabilité.';

/* ── recherche, filtres, états vides ── */

export const EQUIPMENT_SEARCH_PLACEHOLDER = 'Rechercher un appareil, un emplacement, un numéro…';

/**
 * La recherche travaille sur la liste DÉJÀ chargée : le dire, sinon on doute.
 *
 * **Deux phrases, parce qu'une seule mentait par omission** (revue UX care
 * S8). « La recherche porte sur la liste affichée » est exact mais inerte : il
 * ne dit ni ce qui manque, ni quoi faire. Or le piège est réel — pastille
 * « En panne » active, on tape « échographe », on ne trouve rien, et on en
 * conclut que le centre n'a pas d'échographe. Sous filtre, la phrase nomme
 * donc la cause ET le geste qui la lève.
 */
export const EQUIPMENT_SEARCH_LOCAL_HINT =
  'La recherche porte sur les appareils listés ci-dessous.';

export const EQUIPMENT_SEARCH_FILTERED_HINT =
  'La recherche porte sur les appareils du filtre choisi. Effacez les filtres pour chercher dans tout le parc.';

export const EQUIPMENT_SEARCH_LABEL = 'Rechercher';
export const EQUIPMENT_FILTER_STATUS_GROUP = 'Filtrer par état';
export const EQUIPMENT_FILTER_ALL = 'Tous';
export const EQUIPMENT_FILTER_ALL_CATEGORIES = 'Toutes les catégories';
export const EQUIPMENT_FILTER_CLEAR = 'Effacer les filtres';

/* ── colonnes du tableau de parc ── */

export const EQUIPMENT_COL_NAME = 'Appareil';
export const EQUIPMENT_COL_STATUS = 'État';
export const EQUIPMENT_OPEN_SR = 'Ouvrir';

/** Confirmation de déclaration — elle NOMME l'appareil, elle ne dit pas « ok ». */
export function equipmentCreated(name: string): string {
  return `« ${name} » est déclaré dans le parc.`;
}

export function equipmentUpdated(name: string): string {
  return `La fiche de « ${name} » est à jour.`;
}

export const EQUIPMENT_EMPTY_TITLE = 'Aucun équipement déclaré';

export const EQUIPMENT_EMPTY_DIRECTOR =
  'Commencez par le matériel que votre équipe utilise tous les jours : tensiomètre, échographe, centrifugeuse. Vous pourrez compléter au fil du temps.';

export const EQUIPMENT_EMPTY_STAFF =
  'Le parc de matériel n’est pas encore décrit. C’est la direction du centre qui déclare les appareils.';

export const EQUIPMENT_FILTER_EMPTY_TITLE = 'Aucun appareil ne correspond';
export const EQUIPMENT_FILTER_EMPTY_MESSAGE =
  'Essayez un autre état, une autre catégorie, ou effacez les filtres.';

/**
 * L'état vide de la RECHERCHE, distinct de celui des filtres : « essayez un
 * autre état » ne répond pas à quelqu'un qui vient de taper un nom. Cet
 * état-là n'apparaît que lorsque la liste chargée n'est PAS vide — la seule
 * cause possible est donc la recherche, et le message peut la nommer.
 */
export const EQUIPMENT_SEARCH_EMPTY_MESSAGE =
  'Aucun appareil de la liste ne correspond à ce que vous avez tapé. Vérifiez l’orthographe, ou effacez les filtres pour chercher dans tout le parc.';

export const EQUIPMENT_NOT_FOUND_TITLE = 'Équipement introuvable';
export const EQUIPMENT_NOT_FOUND_MESSAGE = 'Cet appareil n’existe pas dans ce centre.';
