/*
 * Chioni — central API client.
 *
 * Contract: docs/frontend/api-contract.md. Key behaviours:
 * - Base URL from NEXT_PUBLIC_API_URL (fallback: local Django dev server).
 * - Bearer auth from localStorage tokens (see tokens.ts).
 * - On 401 with a refresh token available: SINGLE-FLIGHT refresh (SimpleJWT
 *   refresh tokens are one-use — two parallel refreshes would log the user
 *   out), store the NEW pair (access AND refresh), replay the request once.
 *   If the refresh itself fails: purge tokens and send the user to sign-in.
 * - Errors are normalised into ApiError from the 3 DRF formats:
 *   1. serializer errors  → {"field": ["msg"], "non_field_errors": ["msg"]}
 *   2. service errors     → bare JSON array ["msg"] (status 400)
 *   3. framework errors   → {"detail": "...", "code"?: "..."}
 *   plus the Retry-After header on 429.
 */

import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from './tokens';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  readonly status: number;
  /** Global, human-readable messages (service/framework errors, non_field_errors). */
  readonly messages: string[];
  /** Per-field serializer errors, keyed by field name. */
  readonly fieldErrors: Record<string, string[]>;
  /** Seconds to wait before retrying (from the Retry-After header on 429). */
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    messages: string[],
    fieldErrors: Record<string, string[]> = {},
    retryAfterSeconds?: number,
  ) {
    super(messages[0] ?? `Erreur ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the Bearer token (default true). Set false for anonymous endpoints. */
  auth?: boolean;
}

/* ── error normalisation ── */

function normaliseErrorPayload(payload: unknown): {
  messages: string[];
  fieldErrors: Record<string, string[]>;
} {
  // Format 2: bare array of strings.
  if (Array.isArray(payload)) {
    return { messages: payload.filter((m): m is string => typeof m === 'string'), fieldErrors: {} };
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    // Format 3: {"detail": "..."}.
    if (typeof obj.detail === 'string') {
      return { messages: [obj.detail], fieldErrors: {} };
    }
    // Format 1: per-field serializer errors.
    const messages: string[] = [];
    const fieldErrors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(obj)) {
      const list = Array.isArray(value)
        ? value.filter((m): m is string => typeof m === 'string')
        : typeof value === 'string'
          ? [value]
          : [];
      if (list.length === 0) continue;
      if (key === 'non_field_errors') messages.push(...list);
      else fieldErrors[key] = list;
    }
    return { messages, fieldErrors };
  }
  return { messages: [], fieldErrors: {} };
}

async function toApiError(res: Response): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body (HTML error page, empty body) */
  }
  const { messages, fieldErrors } = normaliseErrorPayload(payload);
  let retryAfterSeconds: number | undefined;
  if (res.status === 429) {
    const header = res.headers.get('Retry-After');
    const parsed = header ? Number.parseInt(header, 10) : Number.NaN;
    retryAfterSeconds = Number.isFinite(parsed) ? parsed : undefined;
  }
  if (messages.length === 0 && Object.keys(fieldErrors).length === 0) {
    messages.push(`La requête a échoué (code ${res.status}).`);
  }
  return new ApiError(res.status, messages, fieldErrors, retryAfterSeconds);
}

/* ── single-flight token refresh ── */

let refreshInFlight: Promise<boolean> | null = null;

/** Refresh the token pair. Resolves true on success, false on failure. */
function refreshTokens(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refresh = getRefreshToken();
      if (!refresh) return false;
      try {
        const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { access?: string; refresh?: string };
        if (!data.access || !data.refresh) return false;
        // Rotation: the old refresh is blacklisted — store the NEW pair.
        storeTokens(data.access, data.refresh);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function redirectToSignIn(): void {
  clearTokens();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
    window.location.assign('/auth/sign-in');
  }
}

/* ── core fetch ── */

async function rawFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Multipart uploads (avatar, center logo): pass the FormData through and let
  // the browser set the Content-Type WITH its boundary.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth) {
    const access = getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
}

/**
 * Fetch a JSON API endpoint. `path` starts with `/` (e.g. `/auth/me/`).
 * Throws ApiError on any non-2xx response. Returns `undefined` (cast to T)
 * for empty bodies (204/205).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { auth = true } = options;
  let res = await rawFetch(path, options);

  if (res.status === 401 && auth && getRefreshToken()) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      redirectToSignIn();
      throw await toApiError(res);
    }
    res = await rawFetch(path, options);
  }

  if (!res.ok) {
    throw await toApiError(res);
  }
  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/* ── authenticated binary download (S3 — patient documents, ADR 0016) ── */

/** The only formats the backend serves (photos of documents — no PDF, no SVG). */
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Download a protected binary through the AUTHENTICATED endpoint (Bearer +
 * single-flight refresh, same as apiFetch) — medical documents are never
 * served from a static /media/ URL. Fetches the blob, creates an object URL,
 * triggers the save, revokes the URL. The filename comes from the neutral
 * `Content-Disposition` header when CORS exposes it; otherwise from
 * `fallbackName` + the extension of the real MIME type.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  let res = await rawFetch(path, {});
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      redirectToSignIn();
      throw await toApiError(res);
    }
    res = await rawFetch(path, {});
  }
  if (!res.ok) {
    throw await toApiError(res);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const fromHeader = disposition ? /filename="?([^";]+)"?/.exec(disposition)?.[1] : undefined;
  const ext = EXT_BY_MIME[blob.type];
  const filename = fromHeader ?? (ext ? `${fallbackName}.${ext}` : fallbackName);

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
