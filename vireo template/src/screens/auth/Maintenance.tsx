/*
 * Vireo Next.js — Maintenance.
 * 1:1 re-expression of src/html/auth/maintenance.html: a two-tone slow-spinning
 * gear illustration with a warning wrench accent, an ETA card with an
 * indeterminate progress bar, and status/support actions. Static (no scripts) —
 * a server component that renders the client AuthStandalone + off-app tools.
 */
import Link from 'next/link';
import { AuthStandalone, OffappToolsCompact } from './authShared';

const LOCAL_STYLE = `
@keyframes ax-spin-slow { to { transform: rotate(360deg); } }
.ax-gear-spin { transform-origin: center; animation: ax-spin-slow 14s linear infinite; }
@media (prefers-reduced-motion: reduce) { .ax-gear-spin { animation: none; } .ax-bar-indet::after { animation: none !important; left: 0 !important; width: 100% !important; } }
.ax-bar-indet { position: relative; height: 6px; border-radius: var(--ax-radius-pill); background: var(--ax-fill-hover); overflow: hidden; }
.ax-bar-indet::after {
  content: ""; position: absolute; inset-block: 0; inset-inline-start: -40%; width: 40%;
  border-radius: var(--ax-radius-pill); background: var(--ax-gradient-accent);
  animation: ax-indet 1.6s var(--ax-ease-standard) infinite;
}
@keyframes ax-indet { 0% { inset-inline-start: -40%; } 100% { inset-inline-start: 100%; } }
`;

const HEX = (
  <svg viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

export function Maintenance() {
  return (
    <AuthStandalone>
      <style>{LOCAL_STYLE}</style>
      <OffappToolsCompact />

      <main id="ax-main" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div className="ax-center" style={{ marginBlockEnd: 'var(--ax-space-6)' }}>
          <Link href="/" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none' }} aria-label="Vireo home">
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 42, height: 42, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{HEX}</span>
            <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Vireo</b>
          </Link>
        </div>

        <div className="ax-center" style={{ marginBlockEnd: 'var(--ax-space-6)' }} aria-hidden="true">
          <span style={{ display: 'inline-grid', placeItems: 'center', width: 128, height: 128, borderRadius: '50%', background: 'var(--ax-warning-50)', position: 'relative' }}>
            <svg viewBox="0 0 24 24" width={78} height={78} fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><g className="ax-gear-spin"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></g></svg>
            <span style={{ position: 'absolute', right: 14, bottom: 14, display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: '50%', background: 'var(--ax-surface-solid)', boxShadow: 'var(--ax-shadow-sm)' }}>
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="var(--ax-warning-500)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5" /></svg>
            </span>
          </span>
        </div>

        <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill" style={{ marginBlockEnd: 'var(--ax-space-4)' }}>
          <span className="ax-badge__dot"></span>Scheduled maintenance
        </span>

        <h1 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '0 0 var(--ax-space-3)', letterSpacing: '-.02em', lineHeight: 1.1 }}>We'll be back shortly.</h1>
        <p style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', margin: '0 auto var(--ax-space-6)', maxWidth: '48ch' }}>
          Vireo is undergoing planned maintenance to ship database upgrades and faster dashboards. Your data is safe and nothing is lost — this is a routine, scheduled window.
        </p>

        <div className="ax-card" style={{ textAlign: 'start', maxWidth: 460, marginInline: 'auto', marginBlockEnd: 'var(--ax-space-6)' }}>
          <div className="ax-card__body" style={{ padding: 'var(--ax-space-6)' }}>
            <div className="ax-cluster ax-cluster--between" style={{ marginBlockEnd: 'var(--ax-space-3)' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Estimated time remaining</span>
              <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)' }}>00:42:00</b>
            </div>
            <div className="ax-bar-indet" role="progressbar" aria-label="Maintenance in progress" aria-valuetext="Estimated 42 minutes remaining"></div>
            <div className="ax-cluster ax-cluster--between" style={{ marginBlockStart: 'var(--ax-space-4)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              <span>Started <span className="ax-num">02:00 UTC</span></span>
              <span>Expected back by <span className="ax-num" style={{ color: 'var(--ax-text-muted)' }}>02:45 UTC</span></span>
            </div>
          </div>
        </div>

        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
          <a className="ax-btn ax-btn--secondary" href="#">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h4.5l1.5 -6l4 12l2 -9l1.5 3h4.5" /></svg>
            <span className="ax-btn__label">View system status</span>
          </a>
          <a className="ax-btn ax-btn--ghost" href="mailto:support@vireo.io">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
            <span className="ax-btn__label">Contact support</span>
          </a>
        </div>

        <p style={{ marginBlockStart: 'var(--ax-space-8)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
          Need urgent help? Email <a className="ax-link" href="mailto:support@vireo.io">support@vireo.io</a> · Status code <span className="ax-num">503</span>
        </p>
      </main>
    </AuthStandalone>
  );
}

export default Maintenance;
