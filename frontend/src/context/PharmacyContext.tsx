'use client';
/*
 * Chioni — l'officine ACTIVE du 5ᵉ espace (S9, ADR 0022).
 *
 * Miroir exact de `CenterContext`, et pour la même raison : une personne peut
 * tenir deux officines (rare, mais réel), l'API porte l'identifiant dans
 * chaque URL (`/pharmacy/{p}/…`) et l'ambiguïté « laquelle ? » ne doit jamais
 * être tranchée en silence. L'officine active est la première appartenance par
 * défaut, persistée sous `chioni:pharmacy`, changeable depuis l'en-tête.
 *
 * `status` vient de `/auth/me/` — donc DISPONIBLE AVANT LE MOINDRE FETCH.
 * C'est ce qui permet au chrome de dire la vérité dès la première frame
 * (« en attente de validation ») au lieu d'afficher une boîte vide qui
 * ressemble à une panne, puis de se corriger une seconde plus tard.
 *
 * À monter SOUS `RequireSpace('pharmacie')` : `pharmacy_memberships` y est
 * garanti non vide.
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
import type { MePharmacyMembership } from '@/lib/types';

const STORAGE_KEY = 'chioni:pharmacy';

function readStoredPharmacyId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storePharmacyId(id: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

export interface PharmacyApi {
  pharmacyId: number;
  /** L'étiquette venue de `/auth/me/` : nom, zone et **statut**. */
  pharmacy: MePharmacyMembership['pharmacy'];
  /** Toutes les officines de la personne — alimente le sélecteur. */
  pharmacies: MePharmacyMembership['pharmacy'][];
  switchPharmacy: (pharmacyId: number) => void;
}

const Ctx = createContext<PharmacyApi | null>(null);

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const memberships = useMemo(() => me?.pharmacy_memberships ?? [], [me]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (memberships.length === 0) return;
    const stored = readStoredPharmacyId();
    const valid = memberships.some((m) => m.pharmacy.id === stored);
    setSelectedId(valid && stored !== null ? stored : memberships[0].pharmacy.id);
  }, [memberships]);

  const switchPharmacy = useCallback(
    (pharmacyId: number) => {
      if (!memberships.some((m) => m.pharmacy.id === pharmacyId)) return;
      storePharmacyId(pharmacyId);
      setSelectedId(pharmacyId);
    },
    [memberships],
  );

  const api = useMemo<PharmacyApi | null>(() => {
    if (memberships.length === 0) return null;
    const active =
      memberships.find((m) => m.pharmacy.id === selectedId) ?? memberships[0];
    return {
      pharmacyId: active.pharmacy.id,
      pharmacy: active.pharmacy,
      pharmacies: memberships.map((m) => m.pharmacy),
      switchPharmacy,
    };
  }, [memberships, selectedId, switchPharmacy]);

  if (!api) return null; // gardé en amont par RequireSpace('pharmacie')
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePharmacy(): PharmacyApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePharmacy must be used within PharmacyProvider');
  return ctx;
}
