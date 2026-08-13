/*
 * Chioni — guardian-space endpoints (contract §Espace tuteur).
 * Payment requests: NEVER expose act labels here (generic category only,
 * ADR 0005) and NEVER send an amount from the client (`pay/` has an empty body).
 */

import { apiFetch } from '../api';
import type {
  GuardianLinkGuardian,
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
}

/** GET without a profile → 404. */
export function getGuardianProfile(): Promise<GuardianProfile> {
  return apiFetch('/guardian/profile/');
}

export function createGuardianProfile(payload: GuardianProfilePayload): Promise<GuardianProfile> {
  return apiFetch('/guardian/profile/', { method: 'POST', body: payload });
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

export function revokeLink(linkId: number): Promise<GuardianLinkGuardian> {
  return apiFetch(`/guardian/links/${linkId}/revoke/`, { method: 'POST' });
}

/* ── payment requests ── */

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
