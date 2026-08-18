'use client';
/*
 * Chioni — chrome of the PLATEFORME space (S4, ADR 0017 décision 1).
 *
 * The Vireo shell structure reused as-is (.ax-layout → sidebar + .ax-shell →
 * header + <main> + footer) because a back-office IS a desktop workstation.
 * What the centre Layout carries and this one does NOT: the page loader, the
 * ambient glow, the customizer drawer and the ⌘K command palette. Sober by
 * decision of the sprint — the rich support module is S5.
 *
 * CenterContext is NEVER mounted here: the operator governs tenants, he is
 * not a member of one. Nothing under this layout may call `useCenter()`.
 */
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PlatformSidebar } from './PlatformSidebar';
import { PlatformHeader } from './PlatformHeader';
import { Footer } from '../shell/Footer';
import { platformSlugFromPath } from '@/lib/platform-manifest';

export function PlatformLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  // Keep <html data-ax-route> aligned with the active route, like the shell.
  useEffect(() => {
    document.documentElement.setAttribute('data-ax-route', platformSlugFromPath(pathname));
  }, [pathname]);

  return (
    <div className="ax-layout">
      {/* SV — lien d'évitement, même patron que les autres shells. */}
      <a href="#ax-main" className="visually-hidden-focusable ax-skip">
        Aller au contenu
      </a>
      <PlatformSidebar />
      <div className="ax-shell">
        <PlatformHeader />
        <main className="ax-main" id="ax-main">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default PlatformLayout;
