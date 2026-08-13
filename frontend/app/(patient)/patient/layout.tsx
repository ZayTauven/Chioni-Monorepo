'use client';
/*
 * Chioni — patient space layout: RequireSpace('patient') + LiteLayout
 * (mobile-first chrome, 4-tab bottom bar).
 */
import type { ReactNode } from 'react';
import { RequireSpace } from '@/components/auth/RequireSpace';
import { LiteLayout, type LiteTab } from '@/components/shell-lite/LiteLayout';

const PATIENT_TABS: LiteTab[] = [
  { href: '/patient', label: 'Accueil', icon: 'home' },
  { href: '/patient/carnet', label: 'Carnet', icon: 'notebook' },
  { href: '/patient/paiements', label: 'Paiements', icon: 'cash' },
  { href: '/patient/tuteurs', label: 'Mes tuteurs', icon: 'heart-handshake' },
];

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSpace space="patient">
      <LiteLayout tabs={PATIENT_TABS}>{children}</LiteLayout>
    </RequireSpace>
  );
}
