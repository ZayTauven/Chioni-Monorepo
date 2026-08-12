/*
 * Vireo React — storage helper (ax: prefix, schema-guarded, never throws).
 * Direct TS port of src/js/core/storage.js. Single source of truth for the
 * customizer persistence keys; mirrors the blocking anti-flash head IIFE.
 */

export const PREFIX = 'ax:';
export const SCHEMA = '1';

let LS: Storage | null = null;
try {
  LS = window.localStorage;
} catch {
  LS = null;
}

/** Read a raw ax: key. Returns null on miss or storage failure. */
export function get(key: string): string | null {
  try {
    return LS ? LS.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Write an ax: key. Silently no-ops if storage is unavailable. */
export function set(key: string, value: string): void {
  try {
    if (LS) LS.setItem(key, value);
  } catch {
    /* in-memory fallback only — never throw */
  }
}

/** Remove an ax: key. */
export function remove(key: string): void {
  try {
    if (LS) LS.removeItem(key);
  } catch {
    /* noop */
  }
}

/** Every ax: key currently persisted. */
export function keys(): string[] {
  try {
    if (!LS) return [];
    return Object.keys(LS).filter((k) => k.indexOf(PREFIX) === 0);
  } catch {
    return [];
  }
}

/** Wipe every ax: key (used by customizer Reset). */
export function clearAll(): void {
  keys().forEach((k) => remove(k));
}

/** Schema guard — wipe all ax: keys if a stored schema version mismatches. */
export function ensureSchema(): void {
  try {
    if (!LS) return;
    const stored = get(PREFIX + 'schema');
    if (stored && stored !== SCHEMA) clearAll();
    set(PREFIX + 'schema', SCHEMA);
  } catch {
    /* noop */
  }
}
