'use client';
/*
 * Vireo Next.js — (bare) route-group layout.
 *
 * Standalone screens that render WITHOUT the app shell (landing, logout,
 * coming-soon) live in this group. Per CONVENTIONS.md §5, shell-less pages go in
 * a different route group with their own minimal layout — NOT under (shell).
 *
 * This layout reproduces just the chrome those reference pages carry in <body>:
 * the boot loader + the ambient glow. Each page brings its own <main>/<header>
 * markup (and the marketing nav, for landing). The document <head> (anti-flash
 * IIFE, fonts, app.css) and <CustomizerProvider> come from the ROOT layout, so
 * the theme attribute contract still applies here.
 */
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Loader } from '../../src/components/shell/Loader';
import { slugFromPath } from '../../src/lib/manifest';

export default function BareLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';

  // Keep <html data-ax-route> aligned with the active route (parity with the shell).
  useEffect(() => {
    document.documentElement.setAttribute('data-ax-route', slugFromPath(pathname));
  }, [pathname]);

  return (
    <>
      <Loader />
      <div className="ax-ambient" aria-hidden="true"><i></i></div>
      {children}
    </>
  );
}
