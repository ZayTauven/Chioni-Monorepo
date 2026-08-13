'use client';
/*
 * Vireo Next.js — 403 Access denied.
 * 1:1 re-expression of src/html/error/403.html: standalone status screen with a
 * shield + lock illustration (accent highlight on the lock dot), dashboard /
 * request-access actions and a switch-user helper link.
 */
import Link from 'next/link';
import { StatusStandalone, StatusHeading, StatusIllustration } from './errorShared';

export function Error403() {
  return (
    <StatusStandalone>
      <StatusIllustration>
        <svg viewBox="0 0 24 24" width={70} height={70} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" stroke="var(--ax-accent)" /><path d="M12 12l0 2.5" stroke="var(--ax-accent)" />
        </svg>
      </StatusIllustration>

      <StatusHeading code="403" title="Accès refusé" bodyMaxCh={44}
        body="Vous êtes connecté, mais vous n'avez pas l'autorisation de voir cette page. Si vous pensez qu'il s'agit d'une erreur, contactez le responsable de votre centre." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <Link className="ax-btn ax-btn--primary" href="/espaces">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 13a1 1 0 0 1 1 -1h7v-7a1 1 0 0 1 1 -1h7a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" /></svg>
          <span className="ax-btn__label">Mes espaces</span>
        </Link>
        <Link className="ax-btn ax-btn--secondary" href="/">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
          <span className="ax-btn__label">Retour à l&rsquo;accueil</span>
        </Link>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
        Mauvais compte ? <Link className="ax-link" href="/auth/sign-in">Changer de compte</Link>
      </p>
    </StatusStandalone>
  );
}

export default Error403;
