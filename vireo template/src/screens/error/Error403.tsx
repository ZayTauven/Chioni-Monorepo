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

      <StatusHeading code="403" title="Access denied" bodyMaxCh={44}
        body="You're signed in, but you don't have permission to view this page. If you think this is a mistake, ask a workspace admin to grant you access." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <Link className="ax-btn ax-btn--primary" href="/">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 13a1 1 0 0 1 1 -1h7v-7a1 1 0 0 1 1 -1h7a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" /></svg>
          <span className="ax-btn__label">Go to dashboard</span>
        </Link>
        <Link className="ax-btn ax-btn--secondary" href="/pages/support">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 11h6m-3 -3v6" /></svg>
          <span className="ax-btn__label">Request access</span>
        </Link>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
        Signed in as the wrong account? <Link className="ax-link" href="/auth/sign-in-basic">Switch user</Link>
      </p>
    </StatusStandalone>
  );
}

export default Error403;
