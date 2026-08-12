'use client';
/*
 * Vireo Next.js — Coming soon.
 * 1:1 re-expression of src/html/auth/coming-soon.html: a live 30-day countdown,
 * a notify-me email form with a honeypot bot trap, and a social row. The countdown
 * stops updating under reduced motion; the heading flips to "We're live." at zero.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthStandalone, OffappToolsCompact } from './authShared';

const LOCAL_STYLE = `
@keyframes ax-spin-local { to { transform: rotate(360deg); } }
.ax-spin { animation: ax-spin-local 0.7s var(--ax-ease-linear) infinite; }
@media (prefers-reduced-motion: reduce) { .ax-spin { animation: none; } }
.ax-cd__unit { display:flex; flex-direction:column; align-items:center; gap:6px; min-width:84px; }
@media (max-width: 575px) { .ax-cd__unit { min-width:64px; } }
`;

const HEX = (
  <svg viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

const numStyle = (accent = false): React.CSSProperties => ({
  fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-3xl)', fontWeight: 600, color: accent ? 'var(--ax-accent)' : 'var(--ax-text-strong)', lineHeight: 1,
});
const unitLabel: React.CSSProperties = { fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em' };
const colon: React.CSSProperties = { fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-subtle)', lineHeight: 1.4 };

const pad = (n: number) => String(n).padStart(2, '0');

export function ComingSoon() {
  const [cd, setCd] = useState({ d: '30', h: '00', m: '00', s: '00' });
  const [live, setLive] = useState(false);
  const [email, setEmail] = useState('');
  const [honey, setHoney] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [emailError, setEmailError] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const update = () => {
      let diff = target - Date.now();
      if (diff <= 0) {
        setLive(true);
        setCd({ d: '00', h: '00', m: '00', s: '00' });
        return;
      }
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000); diff -= h * 3600000;
      const m = Math.floor(diff / 60000); diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      setCd({ d: pad(d), h: pad(h), m: pad(m), s: pad(s) });
    };
    update();
    if (reduce) return;
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  function notify(ev: React.FormEvent) {
    ev.preventDefault();
    if (honey) { setSubscribed(true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError(true); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); setSubscribed(true); }, 650);
  }

  return (
    <AuthStandalone>
      <style>{LOCAL_STYLE}</style>
      <OffappToolsCompact />

      <main id="ax-main" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 680, textAlign: 'center' }}>
        <div className="ax-center" style={{ marginBlockEnd: 'var(--ax-space-6)' }}>
          <Link href="/" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none' }} aria-label="Vireo home">
            <span style={{ display: 'inline-grid', placeItems: 'center', width: 42, height: 42, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{HEX}</span>
            <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Vireo</b>
          </Link>
        </div>

        <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ marginBlockEnd: 'var(--ax-space-4)' }}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3" /><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3" /><path d="M14 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
          Launching soon
        </span>

        <h1 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '0 0 var(--ax-space-3)', letterSpacing: '-.02em', lineHeight: 1.1 }}>{live ? "We're live." : 'Something precise is on the way.'}</h1>
        <p style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', margin: '0 auto var(--ax-space-8)', maxWidth: '46ch' }}>The next Vireo release lands soon — 6 new dashboards, a refreshed Aurora theme, and a faster build. Leave your email and we'll tell you the moment it's ready.</p>

        <div className="ax-card" style={{ display: 'inline-block', padding: 'var(--ax-space-6) var(--ax-space-8)', marginBlockEnd: 'var(--ax-space-8)' }}>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', justifyContent: 'center', alignItems: 'flex-start' }} role="timer" aria-live="off" aria-label={`${cd.d} days, ${cd.h} hours, ${cd.m} minutes, ${cd.s} seconds remaining`}>
            <div className="ax-cd__unit"><span className="ax-num" style={numStyle()}>{cd.d}</span><span style={unitLabel}>Days</span></div>
            <span style={colon}>:</span>
            <div className="ax-cd__unit"><span className="ax-num" style={numStyle()}>{cd.h}</span><span style={unitLabel}>Hours</span></div>
            <span style={colon}>:</span>
            <div className="ax-cd__unit"><span className="ax-num" style={numStyle()}>{cd.m}</span><span style={unitLabel}>Minutes</span></div>
            <span style={colon}>:</span>
            <div className="ax-cd__unit"><span className="ax-num" style={numStyle(true)}>{cd.s}</span><span style={unitLabel}>Seconds</span></div>
          </div>
        </div>

        <form className="ax-center" onSubmit={notify} noValidate style={{ marginBlockEnd: 'var(--ax-space-6)' }}>
          {!subscribed ? (
            <div style={{ width: '100%', maxWidth: 440 }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                <input type="email" className="ax-input" placeholder="you@company.com" autoComplete="email"
                  value={email} aria-invalid={emailError} aria-label="Email address"
                  style={{ flex: '1 1 auto', minHeight: 44, ...(emailError ? { borderColor: 'var(--ax-danger-500)' } : {}) }}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(false); }} />
                <button type="submit" className="ax-btn ax-btn--primary" aria-busy={loading} disabled={loading} style={{ minHeight: 44, flex: '0 0 auto' }}>
                  {loading && <svg className="ax-btn__icon ax-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                  <span className="ax-btn__label">Notify me</span>
                </button>
              </div>
              {emailError && <p className="ax-field__message ax-error" style={{ textAlign: 'start', marginBlockStart: 'var(--ax-space-2)' }}>Please enter a valid email address.</p>}
              <input type="text" name="company_url" value={honey} onChange={(e) => setHoney(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="ax-visually-hidden" />
            </div>
          ) : (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', color: 'var(--ax-success-500)', fontSize: 'var(--ax-text-md)', fontWeight: 600 }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              You're on the list — we'll be in touch.
            </div>
          )}
        </form>

        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center' }}>
          <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Vireo on X">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16l-4.267 0" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg>
          </a>
          <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Vireo on GitHub">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" /></svg>
          </a>
          <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Vireo on LinkedIn">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 11v5" /><path d="M8 8v.01" /><path d="M12 16v-5" /><path d="M16 16v-3a2 2 0 1 0 -4 0" /><path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10" /></svg>
          </a>
          <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Vireo on Dribbble">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 3.6c5 6 7 10.5 7.5 16.2" /><path d="M6.4 19c3.5 -3.5 6 -6.5 14.5 -6.4" /><path d="M3.1 10.75c5 0 9.814 -.38 15.314 -5" /></svg>
          </a>
        </div>

        <p style={{ marginBlockStart: 'var(--ax-space-8)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>© 2026 Vireo · We'll only email you about the launch.</p>
      </main>
    </AuthStandalone>
  );
}

export default ComingSoon;
