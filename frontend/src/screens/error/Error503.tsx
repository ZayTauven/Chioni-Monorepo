'use client';
/*
 * Vireo Next.js — 503 Service unavailable.
 * 1:1 re-expression of src/html/error/503.html: standalone status screen with a
 * tools + paused-service illustration (warning-tinted ring), try-again (reload) /
 * maintenance-status actions, an estimated back-online time and a copy-on-click
 * service reference id.
 */
import Link from 'next/link';
import { StatusStandalone, StatusHeading, StatusIllustration, ReferenceId } from './errorShared';

export function Error503() {
  return (
    <StatusStandalone>
      <StatusIllustration bg="radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--ax-warning-500) 14%, transparent), transparent 70%)">
        <svg viewBox="0 0 24 24" width={68} height={68} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" /><path d="M14.5 5.5l4 4" /><path d="M12 8l-5 -5l-4 4l5 5" /><path d="M7 8l-1.5 1.5" /><path d="M16 12l5 5l-4 4l-5 -5" /><path d="M16 17l-1.5 1.5" />
        </svg>
        <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="var(--ax-warning-500)" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 34, top: 38 }}>
          <path d="M6 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12" /><path d="M14 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -12" />
        </svg>
      </StatusIllustration>

      <StatusHeading code="503" title="Service unavailable" bodyMaxCh={44}
        body="The service is temporarily unavailable — it may be under maintenance. Everything should be back shortly. Thanks for your patience." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <button type="button" className="ax-btn ax-btn--primary" onClick={() => window.location.reload()}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
          <span className="ax-btn__label">Try again</span>
        </button>
        <Link className="ax-btn ax-btn--secondary" href="/auth/maintenance">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4l3 3" /></svg>
          <span className="ax-btn__label">View maintenance status</span>
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>Estimated back online by <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>14:30 UTC</b></p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
          <ReferenceId refId="SVC-503-2C7B14" />
        </div>
      </div>
    </StatusStandalone>
  );
}

export default Error503;
