'use client';
/*
 * Chioni — (pharmacie) route-group layout (S9, ADR 0022 décision 10).
 *
 * Le 5ᵉ espace : l'officine. Garde client `RequireSpace('pharmacie')` —
 * anonyme → /auth/sign-in, authentifié sans appartenance à une officine →
 * /espaces.
 *
 * **`CenterProvider` n'est JAMAIS monté ici** (invariant du sprint, miroir
 * exact de l'espace plateforme) : une pharmacie n'est pas un tenant, et un
 * compte d'officine ne porte aucun `StaffMembership` — il ne peut donc, par
 * construction, atteindre aucune route de centre. Aucun composant sous ce
 * layout ne doit appeler `useCenter()`.
 *
 * `PharmacyProvider` choisit l'officine active (la première appartenance par
 * défaut, persistée, changeable depuis l'en-tête) : une même personne peut en
 * tenir deux, et l'API porte l'identifiant dans chaque URL.
 */
import type { ReactNode } from 'react';
import { RequireSpace } from '@/components/auth/RequireSpace';
import { PharmacyLayout } from '@/components/shell-pharmacie/PharmacyLayout';
import { PharmacyProvider } from '@/context/PharmacyContext';

export default function PharmacieLayout({ children }: { children: ReactNode }) {
  return (
    <RequireSpace space="pharmacie">
      <PharmacyProvider>
        <PharmacyLayout>{children}</PharmacyLayout>
      </PharmacyProvider>
    </RequireSpace>
  );
}
