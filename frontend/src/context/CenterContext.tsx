'use client';
/*
 * Chioni — active health-center context for the centre space.
 *
 * A staff user can belong to several centers: the active one is the first
 * membership by default, persisted under `chioni:center`, switchable from
 * the header. `centerId` feeds every `/centers/{center_pk}/…` call.
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
  role: StaffRole;
  memberships: StaffMembership[];
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
    return {
      centerId: active.center.id,
      center: active.center,
      role: active.role,
      memberships,
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
