'use client';
/*
 * Chioni — (plateforme) route-group layout (S4, ADR 0017).
 *
 * Le 4ᵉ espace : le back-office de Chioni. Garde client
 * RequireSpace('plateforme') — anonyme → /auth/sign-in, authentifié sans la
 * casquette exploitant → /espaces.
 *
 * **CenterProvider n'est JAMAIS monté ici** (invariant du sprint) : un
 * exploitant gouverne des tenants, il n'appartient à aucun. Aucun composant
 * sous ce layout ne doit appeler useCenter().
 */
import type { ReactNode } from 'react';
import { RequireSpace } from '@/components/auth/RequireSpace';
import { PlatformLayout } from '@/components/shell-platform/PlatformLayout';

export default function PlateformeLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSpace space="plateforme">
      <PlatformLayout>{children}</PlatformLayout>
    </RequireSpace>
  );
}
