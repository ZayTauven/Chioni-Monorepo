/*
 * Chioni — auth endpoints (contract §Auth).
 */

import { apiFetch } from '../api';
import type { Me, OtpVerifyResponse, TokenPair } from '../types';

/**
 * Request an SMS code. Anti-enumeration: the success message is ALWAYS the
 * same, whether the number exists or not — display it verbatim.
 * Throttles: 3/h per phone, 10/h per IP (429 with Retry-After).
 */
export function otpRequest(phone: string): Promise<{ detail: string }> {
  return apiFetch('/auth/otp/request/', { method: 'POST', body: { phone }, auth: false });
}

/** Verify the SMS code. Single indistinguishable 400: "Code invalide ou expiré." */
export function otpVerify(phone: string, code: string): Promise<OtpVerifyResponse> {
  return apiFetch('/auth/otp/verify/', { method: 'POST', body: { phone, code }, auth: false });
}

/** Staff/back-office password login. 401 on bad credentials. */
export function tokenObtain(username: string, password: string): Promise<TokenPair> {
  return apiFetch('/auth/token/', { method: 'POST', body: { username, password }, auth: false });
}

/** Blacklist the refresh token (server replies 205, empty body). */
export function logout(refresh: string): Promise<void> {
  return apiFetch('/auth/logout/', { method: 'POST', body: { refresh } });
}

/** The router of the 3 spaces. */
export function getMe(): Promise<Me> {
  return apiFetch('/auth/me/');
}
