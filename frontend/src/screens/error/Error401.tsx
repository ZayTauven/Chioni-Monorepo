'use client';
/*
 * Vireo Next.js — 401 Authentication required.
 * 1:1 re-expression of src/html/error/401.html: standalone status screen with a
 * closed-door + key illustration (accent highlight on the key), sign-in / go-home
 * actions and a reset-password helper link.
 */
import Link from 'next/link';
import { StatusStandalone, StatusHeading, StatusIllustration } from './errorShared';

export function Error401() {
  return (
    <StatusStandalone>
      <StatusIllustration>
        <svg viewBox="0 0 24 24" width={64} height={64} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative', left: -9 }}>
          <path d="M13 12v.01" /><path d="M3 21h18" /><path d="M5 21v-16a2 2 0 0 1 2 -2h6m4 10.5v7.5" /><path d="M21 7h-7m3 -3l-3 3l3 3" />
        </svg>
        <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="var(--ax-accent)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 30, bottom: 38 }}>
          <path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0" /><path d="M15 9h.01" />
        </svg>
      </StatusIllustration>

      <StatusHeading code="401" title="Connexion requise"
        body="Vous devez vous connecter pour voir cette page. Votre session a peut-être expiré — reconnectez-vous pour reprendre là où vous en étiez." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <Link className="ax-btn ax-btn--primary" href="/auth/sign-in">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M21 12h-13l3 -3" /><path d="M11 15l-3 -3" /></svg>
          <span className="ax-btn__label">Se connecter</span>
        </Link>
        <Link className="ax-btn ax-btn--secondary" href="/">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
          <span className="ax-btn__label">Retour à l&rsquo;accueil</span>
        </Link>
      </div>
    </StatusStandalone>
  );
}

export default Error401;
