'use client';
/*
 * Chioni — 404 page introuvable (also mounted as the App Router not-found
 * boundary). Adapted from the Vireo standalone 404: French copy, no demo
 * search form, links limited to routes that exist.
 */
import Link from 'next/link';
import { StatusStandalone, StatusHeading, StatusIllustration } from './errorShared';

export function Error404() {
  return (
    <StatusStandalone maxWidth={560}>
      <StatusIllustration>
        <svg viewBox="0 0 24 24" width={72} height={72} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 16l-4 4" /><path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5" /><path d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5" /><path d="M3 21l2.5 -2.5" /><path d="M18.5 5.5l2.5 -2.5" stroke="var(--ax-accent)" /><path d="M10 11l-2 2" stroke="var(--ax-accent)" /><path d="M13 14l-2 2" /><path d="M16 16l4 4" />
        </svg>
      </StatusIllustration>

      <StatusHeading code="404" title="Page introuvable"
        body="Cette page n'existe pas ou a été déplacée. Vérifiez l'adresse, ou revenez à l'accueil." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <Link className="ax-btn ax-btn--primary" href="/">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
          <span className="ax-btn__label">Retour à l&rsquo;accueil</span>
        </Link>
        <Link className="ax-btn ax-btn--secondary" href="/auth/sign-in">
          <span className="ax-btn__label">Se connecter</span>
        </Link>
      </div>
    </StatusStandalone>
  );
}

export default Error404;
