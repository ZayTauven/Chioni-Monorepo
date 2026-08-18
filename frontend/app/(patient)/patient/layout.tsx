'use client';
/*
 * Chioni — patient space layout: RequireSpace('patient') + LiteLayout
 * (mobile-first chrome, 4-tab bottom bar).
 */
import type { ReactNode } from 'react';
import { RequireSpace } from '@/components/auth/RequireSpace';
import { LiteLayout, type LitePageTitle, type LiteTab } from '@/components/shell-lite/LiteLayout';

const PATIENT_TABS: LiteTab[] = [
  { href: '/patient', label: 'Accueil', icon: 'home' },
  { href: '/patient/carnet', label: 'Carnet', icon: 'notebook' },
  { href: '/patient/paiements', label: 'Paiements', icon: 'cash' },
  { href: '/patient/tuteurs', label: 'Mes tuteurs', icon: 'heart-handshake' },
];

/* SV — les pages hors onglets affichaient « Accueil » dans l'en-tête (le
   préfixe /patient gagnait). Les libellés reprennent le titre que chaque
   écran se donne déjà. */
const PATIENT_PAGE_TITLES: LitePageTitle[] = [
  { href: '/patient/rendez-vous', label: 'Mes rendez-vous' },
  { href: '/patient/profil', label: 'Mes informations' },
];

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSpace space="patient">
      <LiteLayout tabs={PATIENT_TABS} pageTitles={PATIENT_PAGE_TITLES}>
        {children}
      </LiteLayout>
    </RequireSpace>
  );
}
