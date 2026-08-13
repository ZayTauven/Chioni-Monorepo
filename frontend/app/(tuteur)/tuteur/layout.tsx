'use client';
/*
 * Chioni — guardian space layout: RequireSpace('tuteur') + LiteLayout
 * (mobile-first chrome, 4-tab bottom bar).
 */
import type { ReactNode } from 'react';
import { RequireSpace } from '@/components/auth/RequireSpace';
import { LiteLayout, type LiteTab } from '@/components/shell-lite/LiteLayout';

const TUTEUR_TABS: LiteTab[] = [
  { href: '/tuteur', label: 'Accueil', icon: 'home' },
  { href: '/tuteur/demandes', label: 'Demandes', icon: 'file-invoice' },
  { href: '/tuteur/recus', label: 'Reçus', icon: 'receipt' },
  { href: '/tuteur/proteges', label: 'Mes protégés', icon: 'heart-handshake' },
];

export default function TuteurLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSpace space="tuteur">
      <LiteLayout tabs={TUTEUR_TABS}>{children}</LiteLayout>
    </RequireSpace>
  );
}
