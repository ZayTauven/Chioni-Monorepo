'use client';
/*
 * Vireo Next.js — Pages / Coming Soon (route "pages/coming-soon", BARE group).
 *
 * Faithful re-expression of src/html/pages/coming-soon.html: a centered launch
 * screen with brand + status pill, headline, a live 30-day countdown (days/hours/
 * minutes/seconds), an email notify form (honeypot + validation + simulated
 * submit → subscribed confirmation) and a social row. The Alpine comingSoon()
 * state machine is ported to React; the theme toggle uses
 * useCustomizer().toggleTheme. Renders without the shell. DOM/classes/ARIA match
 * the reference 1:1.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useCustomizer } from '../../context/CustomizerContext';

const pad = (n: number) => String(n).padStart(2, '0');
const UNIT_LABELS = ['Days', 'Hours', 'Minutes', 'Seconds'];

export function ComingSoon() {
  const { toggleTheme } = useCustomizer();
  const targetRef = useRef<number>(0);
  const [units, setUnits] = useState(['00', '00', '00', '00']);
  const [live, setLive] = useState(false);
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    targetRef.current = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const tick = () => {
      let diff = Math.max(0, targetRef.current - Date.now());
      if (diff === 0) setLive(true);
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000); diff -= h * 3600000;
      const m = Math.floor(diff / 60000); diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      setUnits([pad(d), pad(h), pad(m), pad(s)]);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (hp) return; // honeypot tripped — silently ignore
    const okEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
    if (!okEmail) { setError('Enter a valid email address.'); return; }
    setSending(true);
    setTimeout(() => { setSending(false); setSubscribed(true); }, 700);
  };

  return (
    <>
      <div style={{ position: 'fixed', top: 'var(--ax-space-5)', right: 'var(--ax-space-6)', zIndex: 5, display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Toggle color theme" onClick={toggleTheme}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
        </button>
        <Link className="ax-btn ax-btn--ghost ax-btn--sm" href="/">
          <span className="ax-btn__label">Skip preview</span>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
        </Link>
      </div>

      <main className="ax-center" id="ax-main" style={{ position: 'relative', zIndex: 1, width: '100%', padding: 'var(--ax-space-6)' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--ax-space-7)' }}>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-4)' }}>
            <Link href="/" aria-label="Vireo home" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-3)', textDecoration: 'none' }}>
              <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 42, height: 42, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>
                <svg viewBox="0 0 32 32" width={25} height={25} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
              </span>
              <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)', letterSpacing: '.01em' }}>Vireo</span>
            </Link>
            <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3" /><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3" /></svg>
              Launching soon
            </span>
          </div>

          <div>
            <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-3xl)', lineHeight: 1.1, color: 'var(--ax-text-strong)', letterSpacing: '-.01em' }}>
              {live ? "We're live." : 'Something precise is on the way.'}
            </h1>
            <p style={{ margin: 'var(--ax-space-4) auto 0', maxWidth: '48ch', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>
              The next Vireo release brings a redesigned analytics workspace, native dark glass surfaces, and 12 retunable accents. Be the first to know when it ships.
            </p>
          </div>

          {/* countdown */}
          <div className="ax-num" role="timer" aria-label="Time remaining until launch" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--ax-space-3)', width: '100%', maxWidth: 460 }}>
            {units.map((value, i) => (
              <div key={UNIT_LABELS[i]} className="ax-glass" style={{ borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-4) var(--ax-space-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 600, fontSize: 'var(--ax-num-kpi, var(--ax-text-3xl))', lineHeight: 1, color: 'var(--ax-text-strong)' }}>{value}</span>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{UNIT_LABELS[i]}</span>
              </div>
            ))}
          </div>

          {/* notify form */}
          {!subscribed && (
            <form className="ax-notify" style={{ width: '100%', maxWidth: 440 }} noValidate onSubmit={submit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <div className={`ax-input-group${error ? ' is-invalid' : ''}`} style={{ height: 46 }}>
                  <span className="ax-input-group__addon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
                  </span>
                  <label htmlFor="cs-email" className="ax-visually-hidden">Email address</label>
                  <input id="cs-email" type="email" className="ax-input" value={email} onChange={(e) => setEmail(e.target.value)} name="email" placeholder="you@company.com" autoComplete="email" aria-invalid={error ? 'true' : 'false'} aria-describedby="cs-email-msg" />
                  {/* honeypot (must stay empty) */}
                  <input type="text" value={hp} onChange={(e) => setHp(e.target.value)} name="company_url" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
                  <button type="submit" className="ax-btn ax-btn--primary" style={{ borderRadius: 0 }} disabled={sending}>
                    {sending && <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: 'ax-spin .8s linear infinite' }}><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                    <span className="ax-btn__label">{sending ? 'Adding…' : 'Notify me'}</span>
                  </button>
                </div>
                {error && <p id="cs-email-msg" className="ax-error" role="alert" style={{ margin: 0, textAlign: 'start', fontSize: 'var(--ax-text-xs)' }}>{error}</p>}
              </div>
            </form>
          )}

          {/* subscribed confirmation */}
          {subscribed && (
            <div aria-live="polite" className="ax-glass" style={{ width: '100%', maxWidth: 440, borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-4) var(--ax-space-5)', display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', textAlign: 'start' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 36, height: 36, borderRadius: '50%', background: 'var(--ax-success-50)', color: 'var(--ax-success-500)', flex: '0 0 auto' }}>
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
              </span>
              <div>
                <p style={{ margin: 0, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>You&apos;re on the list</p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>We&apos;ll email <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{email}</b> the moment we launch.</p>
              </div>
            </div>
          )}

          {/* social row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', marginInlineEnd: 'var(--ax-space-2)' }}>Follow along</span>
            <a className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" href="#" aria-label="Vireo on X"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16l-4.267 0" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg></a>
            <a className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" href="#" aria-label="Vireo on GitHub"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" /></svg></a>
            <a className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" href="#" aria-label="Vireo on Dribbble"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 3.6c5 6 7 10.5 7.5 16.2" /><path d="M6.4 19c3.5 -3.5 6 -6.5 14.5 -6.4" /><path d="M3.1 10.75c5 0 9.814 -.38 15.314 -5" /></svg></a>
            <a className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" href="#" aria-label="Vireo on LinkedIn"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 11v5" /><path d="M8 8v.01" /><path d="M12 16v-5" /><path d="M16 16v-3a2 2 0 1 0 -4 0" /><path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10" /></svg></a>
          </div>
        </div>
      </main>
    </>
  );
}

export default ComingSoon;
