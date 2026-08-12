'use client';
/*
 * Vireo Next.js — application shell layout (client component).
 *
 * Reproduces the reference body structure (index.html): page loader, ambient
 * glow, .ax-layout → Sidebar + .ax-shell (Header + <main>{children} + Footer),
 * then the Customizer drawer + Command palette overlays.
 *
 * In the App Router the routed page arrives as `children` (not a router
 * <Outlet/>): app/(shell)/layout.tsx renders <Layout>{children}</Layout>, so
 * every route under the (shell) group is wrapped in this chrome. The active
 * route is read from usePathname() to keep <html data-ax-route> in sync (used by
 * the anti-flash IIFE + breadcrumb/active-trail resolution).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { Loader } from './Loader';
import { Customizer } from './Customizer';
import { CommandPalette } from './CommandPalette';
import { slugFromPath } from '../../lib/manifest';

export function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const [commandOpen, setCommandOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  // Keep <html data-ax-route> aligned with the active route.
  useEffect(() => {
    document.documentElement.setAttribute('data-ax-route', slugFromPath(pathname));
  }, [pathname]);

  // Global ⌘K / Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Loader />
      <div className="ax-ambient" aria-hidden="true"><i></i></div>
      <div className="ax-layout">
        <Sidebar />
        <div className="ax-shell">
          <Header onCommand={() => setCommandOpen(true)} onCustomizer={() => setCustomizerOpen(true)} />
          <main className="ax-main" id="ax-main">
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <Customizer open={customizerOpen} onClose={() => setCustomizerOpen(false)} />
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}

export default Layout;
