'use client';
/*
 * Vireo Next.js — Lock screen (cover split).
 * 1:1 re-expression of src/html/auth/lock-screen-cover.html: a live mono clock /
 * date panel (lg+) beside the unlock card (Devon Okafor). Demo password "vireo"
 * → redirects to "/". Clock updates every 15s (skipped under reduced motion).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappToolsCompact, EYE, EYE_OFF } from './authShared';

const LOCAL_STYLE = `
@keyframes ax-spin-local { to { transform: rotate(360deg); } }
.ax-spin { animation: ax-spin-local 0.7s var(--ax-ease-linear) infinite; }
@media (min-width: 992px) {
  .ax-auth-cover { grid-template-columns: 52% 48% !important; }
  .ax-auth-cover__panel { display: flex !important; }
}
@media (prefers-reduced-motion: reduce) { .ax-spin { animation: none; } }
`;

const HEX = (
  <svg viewBox="0 0 32 32" width={22} height={22} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

export function LockScreenCover() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const attempts = useRef(0);
  const pwRef = useRef<HTMLInputElement>(null);

  const [clock, setClock] = useState('--:--');
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fmt = () => {
      const d = new Date();
      setClock(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
      setDateStr(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    fmt();
    if (reduce) return;
    const t = setInterval(fmt, 1000 * 15);
    return () => clearInterval(t);
  }, []);

  function unlock(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (!pw) {
      setInvalid(true);
      setError('Please enter your password.');
      pwRef.current?.focus();
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (pw === 'vireo') {
        router.push('/');
      } else {
        attempts.current++;
        setInvalid(true);
        setError(attempts.current >= 3 ? 'Too many attempts. Locked for 30 seconds.' : 'Incorrect password. Please try again.');
        pwRef.current?.focus();
      }
    }, 600);
  }

  return (
    <AuthStandalone cover>
      <style>{LOCAL_STYLE}</style>
      <OffappToolsCompact />

      <main className="ax-center" id="ax-main" style={{ position: 'relative', zIndex: 1, minBlockSize: '100vh', width: '100%' }}>
        <div className="ax-auth-cover" style={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%', minBlockSize: '100vh' }}>

          <aside className="ax-auth-cover__panel"
            style={{ position: 'relative', overflow: 'hidden', display: 'none', flexDirection: 'column', justifyContent: 'space-between', padding: 'var(--ax-space-10)', background: 'radial-gradient(120% 120% at 16% 14%, rgba(var(--ax-accent-rgb),.32), transparent 55%), radial-gradient(140% 120% at 90% 94%, rgba(var(--ax-accent-rgb),.18), transparent 60%), linear-gradient(160deg, var(--ax-surface-solid), var(--ax-accent-wash))' }}>
            <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, transparent 0 24px, rgba(var(--ax-accent-rgb),.05) 24px 25px)' }} />
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', position: 'relative' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{HEX}</span>
              <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Vireo</b>
            </div>
            <div style={{ position: 'relative' }}>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 64, fontWeight: 600, color: 'var(--ax-text-strong)', lineHeight: 1, letterSpacing: '-.02em' }}>{clock}</div>
              <div style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', marginBlockStart: 'var(--ax-space-2)' }}>{dateStr || 'Locked'}</div>
              <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', marginBlockStart: 'var(--ax-space-5)', maxWidth: '32ch' }}>Your workspace is paused. Unlock to pick up exactly where you left off.</p>
            </div>
          </aside>

          <section className="ax-auth-cover__pane" style={{ display: 'grid', placeItems: 'center', padding: 'var(--ax-space-8) var(--ax-space-6)' }}>
            <div className="ax-card" style={{ width: '100%', maxWidth: 440 }}>
              <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)' }}>
                <div className="ax-center" style={{ textAlign: 'center', marginBlockEnd: 'var(--ax-space-6)' }}>
                  <span className="ax-avatar" style={{ width: 72, height: 72, fontSize: 26, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', boxShadow: '0 0 0 3px var(--ax-surface),0 0 0 4px rgba(var(--ax-accent-rgb),.35)', marginBlockEnd: 'var(--ax-space-4)' }}>
                    <span className="ax-avatar__initials">DO</span>
                  </span>
                  <h1 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: 0, letterSpacing: '-.01em' }}>Devon Okafor</h1>
                  <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: 'var(--ax-space-1) 0 0' }}>Session locked · Engineering workspace</p>
                </div>

                {error && (
                  <div className="ax-alert ax-alert--danger" role="alert" style={{ marginBlockEnd: 'var(--ax-space-5)' }}>
                    <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M5.07 19h13.86a2 2 0 0 0 1.73 -3l-6.93 -12a2 2 0 0 0 -3.46 0l-6.93 12a2 2 0 0 0 1.73 3" /></svg>
                    <div className="ax-alert__content"><p className="ax-alert__message">{error}</p></div>
                  </div>
                )}

                <form className="ax-stack" onSubmit={unlock} noValidate>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="lock-pw">Password</label>
                    <div className="ax-field__control">
                      <input id="lock-pw" className="ax-input ax-input--with-trailing" type={reveal ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password to unlock"
                        value={pw} ref={pwRef} aria-invalid={invalid} onChange={(e) => { setPw(e.target.value); setInvalid(false); setError(''); }} />
                      <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal((v) => !v)}>
                        {reveal ? EYE_OFF : EYE}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="ax-btn ax-btn--primary ax-btn--block" aria-busy={loading} disabled={loading} style={{ marginBlockStart: 'var(--ax-space-2)', minHeight: 44 }}>
                    {loading
                      ? <svg className="ax-btn__icon ax-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                      : <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>}
                    <span className="ax-btn__label">{loading ? 'Unlocking…' : 'Unlock'}</span>
                  </button>
                </form>

                <p style={{ marginBlockStart: 'var(--ax-space-5)', textAlign: 'center', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Not Devon? <Link className="ax-link" href="/auth/sign-in-basic">Sign in as another user</Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default LockScreenCover;
