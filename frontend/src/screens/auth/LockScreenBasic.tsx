'use client';
/*
 * Vireo Next.js — Lock screen (basic).
 * 1:1 re-expression of src/html/auth/lock-screen-basic.html: identity avatar
 * (Ava Sutton), password unlock with reveal toggle, an error banner that escalates
 * after 3 attempts. Demo password is "vireo" → redirects to "/".
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappToolsCompact, EYE, EYE_OFF } from './authShared';

const LOCAL_STYLE = `
@keyframes ax-spin-local { to { transform: rotate(360deg); } }
.ax-spin { animation: ax-spin-local 0.7s var(--ax-ease-linear) infinite; }
@media (prefers-reduced-motion: reduce) { .ax-spin { animation: none; } }
`;

const HEX = (
  <svg viewBox="0 0 32 32" width={23} height={23} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

export function LockScreenBasic() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const attempts = useRef(0);
  const pwRef = useRef<HTMLInputElement>(null);

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
    <AuthStandalone>
      <style>{LOCAL_STYLE}</style>
      <OffappToolsCompact />

      <main className="ax-center" id="ax-main" style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div className="ax-center" style={{ marginBlockEnd: 'var(--ax-space-6)' }}>
            <Link href="/" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none' }} aria-label="Vireo home">
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{HEX}</span>
              <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Vireo</b>
            </Link>
          </div>

          <div className="ax-card">
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)' }}>
              <div className="ax-center" style={{ textAlign: 'center', marginBlockEnd: 'var(--ax-space-6)' }}>
                <span className="ax-avatar" style={{ width: 72, height: 72, fontSize: 26, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', boxShadow: '0 0 0 3px var(--ax-surface),0 0 0 4px rgba(var(--ax-accent-rgb),.35)', marginBlockEnd: 'var(--ax-space-4)' }}>
                  <span className="ax-avatar__initials">AS</span>
                </span>
                <h1 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: 0, letterSpacing: '-.01em' }}>Ava Sutton</h1>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: 'var(--ax-space-1) 0 0' }}>Session locked · last active <span className="ax-num">14 min</span> ago</p>
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
                Not Ava? <Link className="ax-link" href="/auth/sign-in-basic">Sign in as another user</Link>
              </p>
            </div>
          </div>

          <p style={{ marginBlockStart: 'var(--ax-space-5)', textAlign: 'center', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
            Protected workspace · Vireo keeps your session encrypted while you're away.
          </p>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default LockScreenBasic;
