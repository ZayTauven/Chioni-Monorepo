'use client';
/*
 * Chioni — auth session provider.
 *
 * Mounted once in app/layout.tsx (inside CustomizerProvider). On mount it
 * reads the stored tokens and calls /auth/me/ ; exposes the sign-in flows
 * (OTP for patients/guardians, password for staff), sign-out and a `me`
 * refresh. `spacesOf(me)` derives the user's hats — the router of the
 * 3 spaces per ADR 0011.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMe, logout, otpVerify, tokenObtain } from '@/lib/endpoints/auth';
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  clearPendingPhone,
  clearTokens,
  getRefreshToken,
  hasTokens,
  storeTokens,
} from '@/lib/tokens';
import type { Me } from '@/lib/types';

export type Space = 'centre' | 'patient' | 'tuteur';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

/** Which spaces this user can enter (a user can wear several hats). */
export function spacesOf(me: Me | null): Space[] {
  if (!me) return [];
  const spaces: Space[] = [];
  if (me.staff_memberships.length > 0) spaces.push('centre');
  if (me.patient_profile) spaces.push('patient');
  if (me.guardian_profile) spaces.push('tuteur');
  return spaces;
}

/** Home route of a space. */
export function homeOfSpace(space: Space): string {
  return { centre: '/centre', patient: '/patient', tuteur: '/tuteur' }[space];
}

/** Where to send a user right after sign-in. */
export function routeAfterSignIn(me: Me): string {
  const spaces = spacesOf(me);
  if (spaces.length === 1) return homeOfSpace(spaces[0]);
  // Several hats → chooser ; none → same screen in orientation mode.
  return '/espaces';
}

export interface AuthApi {
  me: Me | null;
  status: AuthStatus;
  /** OTP flow — verify the code, store the pair, hydrate `me`. Returns `me`. */
  signInWithOtp: (phone: string, code: string) => Promise<Me>;
  /** Staff password flow. Returns `me`. */
  signInStaff: (username: string, password: string) => Promise<Me>;
  /** Blacklist the refresh, purge tokens, redirect to sign-in. */
  signOut: () => Promise<void>;
  /** Re-fetch /auth/me/ (after creating a profile, confirming a link…). */
  refreshMe: () => Promise<Me>;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // Boot: hydrate the session from stored tokens.
  useEffect(() => {
    let cancelled = false;
    if (!hasTokens()) {
      setStatus('anonymous');
      return;
    }
    getMe()
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        clearTokens();
        setMe(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cross-tab sign-out: if the tokens disappear from localStorage (the user
  // signed out in another tab), purge the session here too and go to sign-in.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // e.key === null means the whole storage was cleared.
      if (e.key !== null && e.key !== ACCESS_TOKEN_KEY && e.key !== REFRESH_TOKEN_KEY) return;
      if (hasTokens()) return;
      setMe(null);
      setStatus('anonymous');
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.assign('/auth/sign-in');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const signInWithOtp = useCallback(async (phone: string, code: string): Promise<Me> => {
    const { access, refresh, me: freshMe } = await otpVerify(phone, code);
    storeTokens(access, refresh);
    setMe(freshMe);
    setStatus('authenticated');
    return freshMe;
  }, []);

  const signInStaff = useCallback(async (username: string, password: string): Promise<Me> => {
    const { access, refresh } = await tokenObtain(username, password);
    storeTokens(access, refresh);
    const freshMe = await getMe();
    setMe(freshMe);
    setStatus('authenticated');
    return freshMe;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await logout(refresh);
      } catch {
        /* best effort — the local purge is what matters */
      }
    }
    clearTokens();
    clearPendingPhone();
    setMe(null);
    setStatus('anonymous');
    window.location.assign('/auth/sign-in');
  }, []);

  const refreshMe = useCallback(async (): Promise<Me> => {
    const freshMe = await getMe();
    setMe(freshMe);
    setStatus('authenticated');
    return freshMe;
  }, []);

  const api = useMemo<AuthApi>(
    () => ({ me, status, signInWithOtp, signInStaff, signOut, refreshMe }),
    [me, status, signInWithOtp, signInStaff, signOut, refreshMe],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
