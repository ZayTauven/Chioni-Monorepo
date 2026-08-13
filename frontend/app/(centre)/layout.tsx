'use client';
/*
 * Chioni — (centre) route-group layout.
 *
 * Every route under /centre renders inside the full Vireo shell (sidebar +
 * header + footer + customizer + command palette), guarded client-side:
 * RequireSpace('centre') redirects anonymous users to /auth/sign-in and
 * staff-less users to /espaces. CenterProvider picks the active center
 * (first membership by default, persisted, switchable from the header).
 */
import type { ReactNode } from 'react';
import { Layout } from '../../src/components/shell/Layout';
import { RequireSpace } from '@/components/auth/RequireSpace';
import { CenterProvider } from '@/context/CenterContext';

export default function CentreLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSpace space="centre">
      <CenterProvider>
        <Layout>{children}</Layout>
      </CenterProvider>
    </RequireSpace>
  );
}
