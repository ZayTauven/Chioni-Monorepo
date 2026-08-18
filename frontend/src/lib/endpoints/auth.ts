/*
 * Chioni — auth endpoints (contract §Auth).
 */

import { ApiError, apiDownloadJson, apiFetch } from '../api';
import { todayIsoDate } from '../labels';
import type { ErasureRequestMine, Me, OtpVerifyResponse, TokenPair } from '../types';

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

/* ── S4 (ADR 0017 décision 7) — my RGPD rights on my own account ── */

/**
 * The MOST RECENT erasure request of the caller, whatever its status (a
 * refusal and its motive must stay readable). **404 = no request at all** —
 * a normal state, not an error: callers map it to `null`.
 */
export async function getMyErasureRequest(): Promise<ErasureRequestMine | null> {
  try {
    return await apiFetch<ErasureRequestMine>('/auth/me/erasure-request/');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Deposit an erasure request (art. 17) — EMPTY body, any hat. This is NOT a
 * « delete my account » button: the request is executed by the Chioni team.
 * A second open request → 400 « Une demande d'effacement est déjà en cours… ».
 */
export function createErasureRequest(): Promise<ErasureRequestMine> {
  return apiFetch('/auth/me/erasure-request/', { method: 'POST', body: {} });
}

/**
 * SV — rétractation (art. 12) : the person withdraws their OWN request while
 * it is still `en_attente`. EMPTY body ; 200 with the same shape, `status:
 * "annulee"`. No pending request → 400 « Aucune demande d'effacement en
 * attente… ». Re-asking afterwards is possible (a new row).
 */
export function cancelErasureRequest(): Promise<ErasureRequestMine> {
  return apiFetch('/auth/me/erasure-request/cancel/', { method: 'POST', body: {} });
}

/**
 * Portability (art. 20): a JSON of what the caller ALREADY sees in their own
 * space — the backend replays the very same querysets and serializers, so
 * nothing new is revealed. Ordinary API JSON (no Content-Disposition): the
 * file is built client-side from the parsed body. Throttle `data_export`
 * 10/h → surface the 429 honestly.
 */
export async function downloadMyDataExport(): Promise<string> {
  const filename = `chioni-mes-donnees-${todayIsoDate()}.json`;
  await apiDownloadJson('/auth/me/export/', filename);
  // Rendu à l'appelant pour que la confirmation puisse NOMMER le fichier :
  // « c'est enregistré » ne sert à rien si on ne sait pas quoi chercher.
  return filename;
}
