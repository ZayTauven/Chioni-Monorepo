/*
 * Chioni — JWT token storage (localStorage).
 *
 * Keys are namespaced `chioni:*` to avoid colliding with the template's `ax:*`
 * theme keys. All access is guarded: localStorage can throw (private mode,
 * blocked storage) and these helpers must never crash the app for that.
 */

const ACCESS_KEY = 'chioni:access';
const REFRESH_KEY = 'chioni:refresh';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return safeGet(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return safeGet(REFRESH_KEY);
}

/** Store a full token pair (SimpleJWT rotates BOTH on refresh). */
export function storeTokens(access: string, refresh: string): void {
  safeSet(ACCESS_KEY, access);
  safeSet(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  safeRemove(ACCESS_KEY);
  safeRemove(REFRESH_KEY);
}

export function hasTokens(): boolean {
  return getAccessToken() !== null || getRefreshToken() !== null;
}
