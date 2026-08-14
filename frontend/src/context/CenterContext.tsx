'use client';
/*
 * Chioni — active health-center context for the centre space.
 *
 * A staff user can belong to several centers: the active one is the first
 * membership by default, persisted under `chioni:center`, switchable from
 * the header. `centerId` feeds every `/centers/{center_pk}/…` call.
 *
 * Multi-roles (S2): /auth/me/ lists ONE membership per (center, role) —
 * a directeur-médecin has two memberships on the same center. `roles`
 * carries ALL active roles of the active center; screens gate with
 * hasRole(roles, …) so cumulating hats only ever WIDENS what is shown.
 * `centers` is the deduplicated center list for selectors.
 *
 * Must be mounted BELOW RequireSpace('centre') so `me.staff_memberships`
 * is guaranteed non-empty.
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
import { useAuth } from './AuthContext';
import type { CenterSummary, StaffMembership, StaffRole } from '@/lib/types';

const STORAGE_KEY = 'chioni:center';

function readStoredCenterId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeCenterId(id: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export interface CenterApi {
  centerId: number;
  center: CenterSummary;
  /** ALL active roles held in the active center (deduplicated, stable order). */
  roles: StaffRole[];
  /**
   * First role in the active center — kept for compat with call sites that
   * need a single label. Role GATING must go through `roles` + hasRole so a
   * multi-hat member is never restricted by whichever membership came first.
   */
  role: StaffRole;
  /** Raw memberships (one per center × role) — prefer `centers` for selectors. */
  memberships: StaffMembership[];
  /** Distinct centers (memberships deduplicated by center id). */
  centers: CenterSummary[];
  switchCenter: (centerId: number) => void;
}

const Ctx = createContext<CenterApi | null>(null);

export function CenterProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const memberships = useMemo(() => me?.staff_memberships ?? [], [me]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Restore the persisted choice once memberships are known.
  useEffect(() => {
    if (memberships.length === 0) return;
    const stored = readStoredCenterId();
    const valid = memberships.some((m) => m.center.id === stored);
    setSelectedId(valid && stored !== null ? stored : memberships[0].center.id);
  }, [memberships]);

  const switchCenter = useCallback(
    (centerId: number) => {
      if (!memberships.some((m) => m.center.id === centerId)) return;
      storeCenterId(centerId);
      setSelectedId(centerId);
    },
    [memberships],
  );

  const active = useMemo(() => {
    if (memberships.length === 0) return null;
    return memberships.find((m) => m.center.id === selectedId) ?? memberships[0];
  }, [memberships, selectedId]);

  const api = useMemo<CenterApi | null>(() => {
    if (!active) return null;
    // Every role held in the ACTIVE center (multi-membership), deduplicated.
    const roles: StaffRole[] = [];
    for (const m of memberships) {
      if (m.center.id === active.center.id && !roles.includes(m.role)) roles.push(m.role);
    }
    // Distinct centers, first-occurrence order — feeds the selectors.
    const centers: CenterSummary[] = [];
    for (const m of memberships) {
      if (!centers.some((c) => c.id === m.center.id)) centers.push(m.center);
    }
    return {
      centerId: active.center.id,
      center: active.center,
      roles,
      role: roles[0] ?? active.role,
      memberships,
      centers,
      switchCenter,
    };
  }, [active, memberships, switchCenter]);

  if (!api) return null; // guarded above by RequireSpace('centre')
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCenter(): CenterApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCenter must be used within CenterProvider');
  return ctx;
}
