'use client';
/*
 * Vireo Next.js — 500 Something went wrong.
 * 1:1 re-expression of src/html/error/500.html: standalone status screen with a
 * tools/wrench illustration (danger-tinted ring), retry (reload) / go-home actions
 * and a copy-on-click error reference id.
 */
import Link from 'next/link';
import { StatusStandalone, StatusHeading, StatusIllustration, ReferenceId } from './errorShared';

export function Error500() {
  return (
    <StatusStandalone>
      <StatusIllustration bg="radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--ax-danger-500) 14%, transparent), transparent 70%)">
        <svg viewBox="0 0 24 24" width={70} height={70} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" /><path d="M14.5 5.5l4 4" /><path d="M12 8l-5 -5l-4 4l5 5" stroke="var(--ax-danger-500)" /><path d="M7 8l-1.5 1.5" /><path d="M16 12l5 5l-4 4l-5 -5" /><path d="M16 17l-1.5 1.5" />
        </svg>
      </StatusIllustration>

      <StatusHeading code="500" title="Une erreur est survenue" bodyMaxCh={44}
        body="Un problème est survenu de notre côté — pas du vôtre. Réessayez dans un instant, ou revenez à l'accueil." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <button type="button" className="ax-btn ax-btn--primary" onClick={() => window.location.reload()}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
          <span className="ax-btn__label">Réessayer</span>
        </button>
        <Link className="ax-btn ax-btn--secondary" href="/">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
          <span className="ax-btn__label">Retour à l&rsquo;accueil</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
        <ReferenceId refId="ERR-5XX-9F3A21C" />
      </div>
    </StatusStandalone>
  );
}

export default Error500;
