/*
 * Chioni — guardian-space endpoints (contract §Espace tuteur).
 * Payment requests: NEVER expose act labels here (generic category only,
 * ADR 0005) and NEVER send an amount from the client (`pay/` has an empty body).
 */

import { ApiError, apiFetch } from '../api';
import type {
  GuardianLinkGuardian,
  GuardianLinkHistory,
  GuardianProfile,
  Paginated,
  PaymentIntent,
  PaymentRequestGuardian,
  Quote,
  Receipt,
  Relationship,
  Sex,
} from '../types';

/* ── profile ── */

export interface GuardianProfilePayload {
  country_of_residence?: string;
  preferred_currency?: 'EUR' | 'KMF';
  /**
   * S10 (ADR 0023 décision 1) — refuser les RELANCES d'une facture impayée.
   * Ne couvre jamais la notification initiale d'une demande de paiement, ni
   * le reçu : l'écran doit le dire, sinon le tuteur croit qu'il ne sera plus
   * prévenu du tout.
   */
  payment_reminders?: boolean;
}

/** GET without a profile → 404. */
export function getGuardianProfile(): Promise<GuardianProfile> {
  return apiFetch('/guardian/profile/');
}

export function createGuardianProfile(payload: GuardianProfilePayload): Promise<GuardianProfile> {
  return apiFetch('/guardian/profile/', { method: 'POST', body: payload });
}

/**
 * S2 — country of residence and preferred currency only. The currency is a
 * DISPLAY preference (quotes stay structurally EUR→KMF); identity goes
 * through PATCH /auth/me/. 400 per field on a bad ISO-2 code.
 */
export function updateGuardianProfile(payload: GuardianProfilePayload): Promise<GuardianProfile> {
  return apiFetch('/guardian/profile/', { method: 'PATCH', body: payload });
}

/* ── protégés ── */

export interface ProtegePayload {
  first_name: string;
  last_name: string;
  relationship: Relationship;
  birth_date?: string;
  sex?: Sex;
  phone?: string;
  city?: string;
}

/** Active links with the `paiements` scope only. */
export function listProteges(page = 1): Promise<Paginated<GuardianLinkGuardian>> {
  return apiFetch(`/guardian/proteges/?page=${page}`);
}

/** Porte A — direct active link (the guardian manages the record). */
export function createProtege(payload: ProtegePayload): Promise<GuardianLinkGuardian> {
  return apiFetch('/guardian/proteges/', { method: 'POST', body: payload });
}

export function listInvitations(page = 1): Promise<Paginated<GuardianLinkGuardian>> {
  return apiFetch(`/guardian/invitations/?page=${page}`);
}

export function acceptInvitation(linkId: number): Promise<GuardianLinkGuardian> {
  return apiFetch(`/guardian/invitations/${linkId}/accept/`, { method: 'POST' });
}

/**
 * Definitive refusal of an invitation — the link becomes `revoque` (FINAL:
 * a new relationship requires a brand-new invitation). 400 if no longer
 * pending, 404 if not this guardian's invitation.
 */
export function declineInvitation(linkId: number): Promise<GuardianLinkGuardian> {
  return apiFetch(`/guardian/invitations/${linkId}/decline/`, { method: 'POST' });
}

export function revokeLink(linkId: number): Promise<GuardianLinkGuardian> {
  return apiFetch(`/guardian/links/${linkId}/revoke/`, { method: 'POST' });
}

/**
 * S2 — my link HISTORY, every status, `-created_at`. The added value: a link
 * in `attente_confirmation_titulaire` (invisible in /proteges/ during the
 * claimant-confirmation gate) shows up here. No phone, no scopes.
 */
export function listGuardianLinks(page = 1): Promise<Paginated<GuardianLinkHistory>> {
  return apiFetch(`/guardian/links/?page=${page}`);
}

/* ── payment requests ── */

/**
 * S1 scope gate: a guardian with NO active link (fresh profile, or every link
 * revoked) gets a 403 on `/guardian/payment-requests/*` and `/guardian/receipts/`.
 * Screens treat it as the « aucun protégé » EMPTY state — never as an error
 * alert (the guardian did nothing wrong).
 */
export function isNoActiveLinkError(e: unknown): boolean {
  return e instanceof ApiError && e.status === 403;
}

export function listPaymentRequests(page = 1): Promise<Paginated<PaymentRequestGuardian>> {
  return apiFetch(`/guardian/payment-requests/?page=${page}`);
}

/** Poll this after `pay()` until `status === "payee"` (webhook-driven). */
export function getPaymentRequest(id: number): Promise<PaymentRequestGuardian> {
  return apiFetch(`/guardian/payment-requests/${id}/`);
}

/** FX quote (GET) — frozen rate, 2.50 % fees on top. 400 if not payable. */
export function getQuote(id: number): Promise<Quote> {
  return apiFetch(`/guardian/payment-requests/${id}/quote/`);
}

/** Empty body BY DESIGN: the client never sends an amount. */
export function pay(id: number): Promise<PaymentIntent> {
  return apiFetch(`/guardian/payment-requests/${id}/pay/`, { method: 'POST' });
}

export function dispute(id: number, reason: string): Promise<PaymentRequestGuardian> {
  return apiFetch(`/guardian/payment-requests/${id}/dispute/`, {
    method: 'POST',
    body: { reason },
  });
}

/* ── receipts ── */

export function listReceipts(page = 1): Promise<Paginated<Receipt>> {
  return apiFetch(`/guardian/receipts/?page=${page}`);
}
