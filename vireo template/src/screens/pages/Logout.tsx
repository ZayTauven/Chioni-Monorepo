'use client';
/*
 * Vireo Next.js — Pages / Logout (route "pages/logout", BARE group).
 *
 * Faithful re-expression of src/html/pages/logout.html: a centered "signed out"
 * status screen with the brand, a signed-out card (who/secure badge), sign-in /
 * home actions, and an auto-redirect countdown that the user can cancel. The
 * Alpine logoutScreen() countdown is ported to React; the theme toggle goes
 * through useCustomizer().toggleTheme (the shared code path). Renders without the
 * shell. DOM/classes/ARIA match the reference 1:1.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomizer } from '../../context/CustomizerContext';

export function Logout() {
  const router = useRouter();
  const { toggleTheme } = useCustomizer();
  const [seconds, setSeconds] = useState(10);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (cancelledRef.current) return;
      setSeconds((s) => {
        if (s <= 1) { clearInterval(timer); router.push('/'); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  const cancel = () => { cancelledRef.current = true; setCancelled(true); };

  return (
    <>
      <div style={{ position: 'fixed', top: 'var(--ax-space-5)', right: 'var(--ax-space-6)', zIndex: 5, display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Toggle color theme" onClick={toggleTheme}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
        </button>
      </div>

      <main className="ax-center" id="ax-main" style={{ position: 'relative', zIndex: 1, width: '100%', padding: 'var(--ax-space-6)' }}>
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-6)' }}>

          <Link href="/" aria-label="Vireo home" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-3)', textDecoration: 'none' }}>
            <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>
              <svg viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
            </span>
            <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', letterSpacing: '.01em' }}>Vireo</span>
          </Link>

          <div className="ax-glass" style={{ width: '100%', borderRadius: 'var(--ax-radius-xl)', padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--ax-space-5)' }}>
            <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 64, height: 64, borderRadius: '50%', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>
              <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg>
            </span>

            <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)' }}>You&apos;ve signed out</h1>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>Your session on this device has ended securely. Sign back in any time to return to your workspace.</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', width: '100%', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', textAlign: 'start' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab, var(--ax-viz-violet) 18%, transparent)', color: 'var(--ax-viz-violet)', flex: '0 0 auto' }}>
                <span style={{ fontWeight: 'var(--ax-weight-semibold)' }}>DO</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }} className="ax-text-truncate">Devon Okafor</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} className="ax-text-truncate">devon@vireo.io</div>
              </div>
              <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill" style={{ marginInlineStart: 'auto', flex: '0 0 auto' }}>
                <span className="ax-badge__dot" />Secure
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', width: '100%' }}>
              <a className="ax-btn ax-btn--primary ax-btn--block" href="#">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M21 12h-13l3 -3" /><path d="M11 15l-3 -3" /></svg>
                <span className="ax-btn__label">Sign in again</span>
              </a>
              <Link className="ax-btn ax-btn--secondary ax-btn--block" href="/">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
                <span className="ax-btn__label">Back to home</span>
              </Link>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }} aria-live="polite">
              Redirecting to sign in in <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{seconds}</b> seconds…
              {!cancelled && <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={cancel} style={{ padding: 0, minHeight: 'auto' }}>Stay here</button>}
              {cancelled && <span style={{ color: 'var(--ax-text-subtle)' }}>Auto-redirect cancelled.</span>}
            </p>
          </div>

          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', textAlign: 'center' }}>
            Not you? <a className="ax-link" href="#">Sign in as another user</a>
          </p>
        </div>
      </main>
    </>
  );
}

export default Logout;
