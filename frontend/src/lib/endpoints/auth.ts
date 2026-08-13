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

/**
 * Display name ONLY — `phone` (identity pivot) and `username` are never
 * modifiable (submitted values are ignored server-side).
 */
export function updateMe(payload: { first_name?: string; last_name?: string }): Promise<Me> {
  return apiFetch('/auth/me/', { method: 'PATCH', body: payload });
}

/**
 * Profile photo of the CALLER (any hat). Real JPEG/PNG/WebP only, 2 Mo max,
 * 2048×2048 max — replacing deletes the old file server-side.
 */
export function uploadAvatar(file: File): Promise<{ avatar: string }> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/auth/me/avatar/', { method: 'POST', body: form });
}

/** 400 when there is no avatar; the file is physically deleted. */
export function deleteAvatar(): Promise<{ avatar: null }> {
  return apiFetch('/auth/me/avatar/', { method: 'DELETE' });
}
