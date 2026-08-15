/*
 * Chioni — endpoints of the PLATFORM space (back-office Chioni, S4/ADR 0017).
 *
 * Single gate: `platform_staff !== null` in /auth/me/. Anonymous → 401 ;
 * authenticated without the operator hat (a Django superuser included) →
 * 403 « Réservé à l'équipe Chioni. » ; a `support` on a write route → 403
 * « Cette action est réservée aux administrateurs… ».
 *
 * INVARIANT of the sprint, and the reason no patient type is imported here:
 * NO /platform/ route ever returns a patient — not a name, not a phone, not
 * a birth date, nothing clinical. The operator's perimeter is the TENANT.
 * Never build a platform screen that pretends to show a patient record: the
 * data does not exist in these payloads (locked by a backend negative test).
 */

import { apiDownload, apiFetch } from '../api';
import type {
  BillingPeriod,
  CenterType,
  ErasureDecision,
  ErasureStatus,
  IncidentCode,
  Island,
  KycDocument,
  KycStatus,
  Paginated,
  PlatformCenter,
  PlatformCenterCreated,
  PlatformErasureRequest,
  PlatformMembership,
  PlatformOperator,
  PlatformRole,
  PlatformSubscription,
  PlatformSubscriptionInvoice,
  PlatformSupportMessage,
  PlatformSupportTicket,
  PlatformSupportTicketDetail,
  ReconciliationIncident,
  SubscriptionInvoiceStatus,
  SubscriptionPaymentMethod,
  SubscriptionPlan,
  SubscriptionStatus,
  SupportCategory,
  SupportTicketStatus,
} from '../types';

/* ── centres (tenants) ── */

export interface PlatformCenterQuery {
  q?: string;
  kyc_status?: KycStatus;
  page?: number;
}

/** Every center of the platform, paginated. `q` matches name or city. */
export function listPlatformCenters({
  q,
  kyc_status,
  page = 1,
}: PlatformCenterQuery = {}): Promise<Paginated<PlatformCenter>> {
  const query = new URLSearchParams({ page: String(page) });
  if (q) query.set('q', q);
  if (kyc_status) query.set('kyc_status', kyc_status);
  return apiFetch(`/platform/centers/?${query.toString()}`);
}

export function getPlatformCenter(centerId: number): Promise<PlatformCenter> {
  return apiFetch(`/platform/centers/${centerId}/`);
}

export interface SimilarCentersQuery {
  name?: string;
  city?: string;
  island?: Island;
}

/**
 * Look-alike centers — NON-blocking by design (mirror of the patient porte C
 * of S3): no uniqueness constraint exists on a center name, two « Clinique
 * El-Maarouf » may legitimately coexist on two islands. Inform, never block.
 * No usable criterion (empty name AND city) → 400 : callers debounce and
 * swallow that case rather than shout at a half-typed field.
 */
export function listSimilarCenters({
  name,
  city,
  island,
}: SimilarCentersQuery): Promise<Paginated<PlatformCenter>> {
  const query = new URLSearchParams();
  if (name) query.set('name', name);
  if (city) query.set('city', city);
  if (island) query.set('island', island);
  return apiFetch(`/platform/centers/similar/?${query.toString()}`);
}

export interface PlatformCenterPayload {
  name: string;
  type: CenterType;
  island: Island;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  /** The first director is referenced by PHONE — a shadow account claimed by OTP. */
  director_phone: string;
  director_first_name?: string;
  director_last_name?: string;
}

/**
 * Onboarding (role `admin`): the center AND its first director in ONE
 * transaction. The center is ALWAYS born `en_attente` (a submitted
 * `kyc_status` is ignored). An invalid phone → 400 and NOTHING is created —
 * never an orphan center.
 */
export function createPlatformCenter(
  payload: PlatformCenterPayload,
): Promise<PlatformCenterCreated> {
  return apiFetch('/platform/centers/', { method: 'POST', body: payload });
}

export interface DirectorPayload {
  phone: string;
  first_name?: string;
  last_name?: string;
}

/** Bootstrap a director on a center that has none (accident, departure). */
export function createPlatformDirector(
  centerId: number,
  payload: DirectorPayload,
): Promise<PlatformMembership> {
  return apiFetch(`/platform/centers/${centerId}/directors/`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * KYC transition (role `admin`). State machine:
 * `en_attente → actif|suspendu`, `actif → suspendu`, `suspendu → actif`.
 * `reason` is MANDATORY for a suspension (400 otherwise) and is stored as the
 * motive of the LAST decision — read by the platform and by the DIRECTOR of
 * that center only, never by a patient nor a guardian.
 */
export function setPlatformCenterKyc(
  centerId: number,
  status: KycStatus,
  reason?: string,
): Promise<PlatformCenter> {
  return apiFetch(`/platform/centers/${centerId}/kyc/`, {
    method: 'POST',
    body: { status, reason: reason ?? '' },
  });
}

/* ── pièces justificatives du KYC (lecture plateforme) ── */

export function listPlatformKycDocuments(
  centerId: number,
  page = 1,
): Promise<Paginated<KycDocument>> {
  return apiFetch(`/platform/centers/${centerId}/kyc-documents/?page=${page}`);
}

/** Authenticated binary download — the private storage has no public URL. */
export function downloadPlatformKycDocument(
  centerId: number,
  documentId: number,
): Promise<void> {
  return apiDownload(
    `/platform/centers/${centerId}/kyc-documents/${documentId}/download/`,
    `kyc-${documentId}`,
  );
}

/* ── réconciliation PSP ── */

export interface ReconciliationQuery {
  from?: string;
  to?: string;
  reason?: IncidentCode;
  center?: number;
  page?: number;
}

/**
 * Payment incidents, most recent first (read: `support` AND `admin`).
 * Window contract identical to the stats: inclusive local Comoros days,
 * 30 by default, 366 max. An unknown `?center=` id yields an EMPTY page,
 * not a 404 — the platform's perimeter is every center.
 */
export function listReconciliation({
  from,
  to,
  reason,
  center,
  page = 1,
}: ReconciliationQuery = {}): Promise<Paginated<ReconciliationIncident>> {
  const query = new URLSearchParams({ page: String(page) });
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (reason) query.set('reason', reason);
  if (center !== undefined) query.set('center', String(center));
  return apiFetch(`/platform/reconciliation/?${query.toString()}`);
}

/* ── file RGPD ── */

/** Read: `support` and `admin` (answering « où en est ma demande ? »). */
export function listErasureRequests(
  status?: ErasureStatus,
  page = 1,
): Promise<Paginated<PlatformErasureRequest>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  return apiFetch(`/platform/erasure-requests/?${query.toString()}`);
}

/**
 * Execute the decision — role `admin` ONLY (anonymisation is irreversible,
 * a refusal is a legal act). `refuser` requires a non-empty
 * `refusal_reason`, which is then READ BY THE PERSON in their own space.
 * `anonymiser` on a blocked request → 400 with the French sentences, and the
 * request STAYS `en_attente` (the person must not have to ask again).
 */
export function processErasureRequest(
  requestId: number,
  decision: ErasureDecision,
  refusalReason?: string,
): Promise<PlatformErasureRequest> {
  return apiFetch(`/platform/erasure-requests/${requestId}/process/`, {
    method: 'POST',
    body: { decision, refusal_reason: refusalReason ?? '' },
  });
}

/* ══ S5 (ADR 0018) — offres, abonnements, factures SaaS, support, équipe ══
   Règle du back-office, inchangée : `support` lit, `admin` seul écrit. UNE
   exception, tranchée par le backend et déclarée dans son garde-fou — le
   `support` RÉPOND aux tickets et fait avancer leur statut : c'est
   littéralement son métier, et ça ne touche ni un droit de tenant ni un franc.
   Seconde asymétrie : `/platform/operators/` est `admin` SEUL **même en
   lecture** (qui détient la 4ᵉ casquette relève de la gouvernance). ═══════ */

/* ── le catalogue d'offres (tableau nu, non paginé) ── */

export function listPlans(isActive?: boolean): Promise<SubscriptionPlan[]> {
  const query = new URLSearchParams();
  if (isActive !== undefined) query.set('is_active', String(isActive));
  const suffix = query.toString();
  return apiFetch(`/platform/plans/${suffix ? `?${suffix}` : ''}`);
}

export interface PlanPayload {
  code: string;
  name: string;
  /** Francs ENTIERS — une décimale renvoie 400 « Le franc comorien… ». */
  price_kmf: string;
  billing_period?: BillingPeriod;
  included_practitioners?: number | null;
  included_staff?: number | null;
  is_active?: boolean;
}

export function createPlan(payload: PlanPayload): Promise<SubscriptionPlan> {
  return apiFetch('/platform/plans/', { method: 'POST', body: payload });
}

/**
 * PATCH partiel, **jamais rétroactif** : les factures SaaS déjà émises portent
 * leur propre montant figé. Pas de DELETE — retirer une offre, c'est
 * `is_active: false` (un plan référencé par un contrat vivant est protégé).
 */
export function updatePlan(
  planId: number,
  payload: Partial<PlanPayload>,
): Promise<SubscriptionPlan> {
  return apiFetch(`/platform/plans/${planId}/`, { method: 'PATCH', body: payload });
}

/* ── les contrats des tenants ── */

export interface PlatformSubscriptionQuery {
  status?: SubscriptionStatus;
  center?: number;
  page?: number;
}

/** Un `?center=` inexistant rend une PAGE VIDE, jamais un 404. */
export function listPlatformSubscriptions({
  status,
  center,
  page = 1,
}: PlatformSubscriptionQuery = {}): Promise<Paginated<PlatformSubscription>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  if (center !== undefined) query.set('center', String(center));
  return apiFetch(`/platform/subscriptions/?${query.toString()}`);
}

export function getPlatformSubscription(id: number): Promise<PlatformSubscription> {
  return apiFetch(`/platform/subscriptions/${id}/`);
}

export interface SubscriptionCreatePayload {
  center: number;
  plan: number;
  /** `essai` ou `actif` SEULEMENT : un contrat naît vivant. */
  status?: Extract<SubscriptionStatus, 'essai' | 'actif'>;
  started_at?: string;
  current_period_end?: string;
}

export function createPlatformSubscription(
  payload: SubscriptionCreatePayload,
): Promise<PlatformSubscription> {
  return apiFetch('/platform/subscriptions/', { method: 'POST', body: payload });
}

/** Changement d'offre — rien de déjà facturé ne bouge (montants figés). */
export function changeSubscriptionPlan(
  subscriptionId: number,
  planId: number,
): Promise<PlatformSubscription> {
  return apiFetch(`/platform/subscriptions/${subscriptionId}/plan/`, {
    method: 'POST',
    body: { plan: planId },
  });
}

/**
 * LA seule porte des transitions (action POST explicite, jamais un PATCH qui
 * glisserait un statut à côté de la machine à états).
 *
 * `reason` est **OBLIGATOIRE pour `suspendu` et `resilie`** : geler
 * l'administration d'un centre sans motif écrit laisserait son directeur sans
 * rien sur quoi agir. Ce motif est **lu par le directeur du centre**, jamais
 * journalisé.
 */
export function setSubscriptionStatus(
  subscriptionId: number,
  status: SubscriptionStatus,
  reason?: string,
): Promise<PlatformSubscription> {
  return apiFetch(`/platform/subscriptions/${subscriptionId}/status/`, {
    method: 'POST',
    body: { status, reason: reason ?? '' },
  });
}

/* ── les factures SaaS (créance de Chioni) ── */

/** Les factures d'UN contrat, plus récente d'abord. */
export function listSubscriptionInvoicesOf(
  subscriptionId: number,
  page = 1,
): Promise<Paginated<PlatformSubscriptionInvoice>> {
  return apiFetch(`/platform/subscriptions/${subscriptionId}/invoices/?page=${page}`);
}

/**
 * Émission manuelle — **CORPS VIDE** : elle déclenche exactement ce que ferait
 * la tâche planifiée pour ce tenant (même période, même montant figé depuis
 * l'offre, même échéance). Laisser saisir un montant libre ferait de cette
 * route une porte parallèle à la grille tarifaire.
 */
export function issueSubscriptionInvoice(
  subscriptionId: number,
): Promise<PlatformSubscriptionInvoice> {
  return apiFetch(`/platform/subscriptions/${subscriptionId}/invoices/`, {
    method: 'POST',
    body: {},
  });
}

export interface SubscriptionInvoiceQuery {
  status?: SubscriptionInvoiceStatus;
  center?: number;
  /** `true` = échéance STRICTEMENT dépassée ET solde > 0 — la règle du drapeau. */
  overdue?: boolean;
  page?: number;
}

export function listPlatformSubscriptionInvoices({
  status,
  center,
  overdue,
  page = 1,
}: SubscriptionInvoiceQuery = {}): Promise<Paginated<PlatformSubscriptionInvoice>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  if (center !== undefined) query.set('center', String(center));
  if (overdue !== undefined) query.set('overdue', String(overdue));
  return apiFetch(`/platform/subscription-invoices/?${query.toString()}`);
}

export function getPlatformSubscriptionInvoice(
  invoiceId: number,
): Promise<PlatformSubscriptionInvoice> {
  return apiFetch(`/platform/subscription-invoices/${invoiceId}/`);
}

export interface SubscriptionPaymentPayload {
  amount_kmf: string;
  method: SubscriptionPaymentMethod;
  reference?: string;
  /** Le jour où l'argent est RÉELLEMENT arrivé — le futur est refusé. */
  received_at?: string;
}

/**
 * Enregistrer un règlement REÇU (le centre paie hors ligne). Partiel admis,
 * **jamais au-delà du solde**. Réponse 201 = la facture ENTIÈRE, statut,
 * soldes et historique à jour.
 */
export function recordSubscriptionPayment(
  invoiceId: number,
  payload: SubscriptionPaymentPayload,
): Promise<PlatformSubscriptionInvoice> {
  return apiFetch(`/platform/subscription-invoices/${invoiceId}/payments/`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * La SEULE correction d'un règlement : motif obligatoire, une par règlement.
 * Rouvre le solde et ramène une facture `payee` à `emise`.
 */
export function reverseSubscriptionPayment(
  invoiceId: number,
  paymentId: number,
  reason: string,
): Promise<PlatformSubscriptionInvoice> {
  return apiFetch(
    `/platform/subscription-invoices/${invoiceId}/payments/${paymentId}/reverse/`,
    { method: 'POST', body: { reason } },
  );
}

/**
 * Annuler une facture — refusée tant qu'un règlement actif existe
 * (contre-passez d'abord). La période redevient facturable, et le motif est
 * **lu par le directeur du centre** : c'est Chioni qui l'écrit pour lui.
 */
export function cancelSubscriptionInvoice(
  invoiceId: number,
  reason: string,
): Promise<PlatformSubscriptionInvoice> {
  return apiFetch(`/platform/subscription-invoices/${invoiceId}/cancel/`, {
    method: 'POST',
    body: { reason },
  });
}

/* ── la file de support, tous tenants ── */

export interface PlatformTicketQuery {
  status?: SupportTicketStatus;
  category?: SupportCategory;
  center?: number;
  /** `true` = `ouvert` + `en_cours` — le filtre de travail par défaut. */
  open?: boolean;
  page?: number;
}

export function listPlatformTickets({
  status,
  category,
  center,
  open,
  page = 1,
}: PlatformTicketQuery = {}): Promise<Paginated<PlatformSupportTicket>> {
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  if (category) query.set('category', category);
  if (center !== undefined) query.set('center', String(center));
  if (open !== undefined) query.set('open', String(open));
  return apiFetch(`/platform/support/tickets/?${query.toString()}`);
}

/** Le ticket ET son fil en une requête. */
export function getPlatformTicket(ticketId: number): Promise<PlatformSupportTicketDetail> {
  return apiFetch(`/platform/support/tickets/${ticketId}/`);
}

/**
 * Répondre — **`support` ET `admin`** : l'unique écriture ouverte au support
 * de tout le back-office. `author_side` est posé à `chioni` par le backend.
 */
export function postPlatformTicketMessage(
  ticketId: number,
  body: string,
): Promise<PlatformSupportMessage> {
  return apiFetch(`/platform/support/tickets/${ticketId}/messages/`, {
    method: 'POST',
    body: { body },
  });
}

/**
 * Faire avancer un ticket — `support` ET `admin`. Machine à états :
 * `ouvert ⇄ en_cours`, les deux → `resolu`, `resolu → en_cours`, tout →
 * `ferme` — et **`ferme` est DÉFINITIF** (rouvrir un dossier clos, c'est en
 * ouvrir un nouveau).
 */
export function setPlatformTicketStatus(
  ticketId: number,
  status: SupportTicketStatus,
): Promise<PlatformSupportTicketDetail> {
  return apiFetch(`/platform/support/tickets/${ticketId}/status/`, {
    method: 'POST',
    body: { status },
  });
}

/** Téléchargement authentifié — aucune URL n'existe pour ces octets. */
export function downloadPlatformTicketAttachment(
  ticketId: number,
  attachmentId: number,
): Promise<void> {
  return apiDownload(
    `/platform/support/tickets/${ticketId}/attachments/${attachmentId}/download/`,
    `piece-${attachmentId}`,
  );
}

/* ── l'équipe Chioni (`admin` SEUL, lecture comprise) ── */

export function listOperators({
  role,
  is_active,
  page = 1,
}: { role?: PlatformRole; is_active?: boolean; page?: number } = {}): Promise<
  Paginated<PlatformOperator>
> {
  const query = new URLSearchParams({ page: String(page) });
  if (role) query.set('role', role);
  if (is_active !== undefined) query.set('is_active', String(is_active));
  return apiFetch(`/platform/operators/?${query.toString()}`);
}

export interface OperatorPayload {
  /** Pivot d'identité : le compte naît OMBRE et se revendique par OTP. */
  phone: string;
  role: PlatformRole;
  first_name?: string;
  last_name?: string;
}

/**
 * Créer un exploitant. Aucun mot de passe n'est créé ni transmis — pas même
 * pour l'équipe Chioni. **Séparation des pouvoirs** : un compte portant un
 * membership ACTIF dans un centre est refusé (400 explicite).
 */
export function createOperator(payload: OperatorPayload): Promise<PlatformOperator> {
  return apiFetch('/platform/operators/', { method: 'POST', body: payload });
}

/**
 * PATCH partiel `{role?, is_active?}` — au moins un champ. **Pas de DELETE** :
 * on révoque (`is_active: false`), on ne supprime pas, la ligne est de
 * l'histoire. Rétrograder ou désactiver le DERNIER administrateur actif → 400
 * dont le message est une consigne : l'afficher tel quel.
 */
export function updateOperator(
  operatorId: number,
  payload: { role?: PlatformRole; is_active?: boolean },
): Promise<PlatformOperator> {
  return apiFetch(`/platform/operators/${operatorId}/`, { method: 'PATCH', body: payload });
}
