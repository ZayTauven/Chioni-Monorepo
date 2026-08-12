'use client';
/*
 * Vireo Next.js — Reset password (basic).
 * 1:1 re-expression of src/html/auth/reset-password-basic.html: request state
 * (email + leading mail icon) flips to a "check your inbox" success state with a
 * masked email and a 30s resend cooldown. Demo always succeeds (anti-enumeration).
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { AuthStandalone, OffappTools, BrandCentered } from './authShared';

export function ResetPasswordBasic() {
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [masked, setMasked] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const raf = useRef(0);

  function maskEmail(v: string) {
    const [u, d] = v.split('@');
    if (!d) return v;
    return (u[0] || '') + '•••@' + d;
  }
  function startCooldown() {
    const deadline = Date.now() + 30000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCooldown(left);
      if (left > 0) raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    tick();
  }
  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const err = !email.trim() ? 'Enter your email.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Enter a valid email address.' : '';
    setEmailErr(err);
    if (err) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMasked(maskEmail(email.trim()));
      setSent(true);
      startCooldown();
    }, 800);
  }
  function resend() {
    if (cooldown > 0) return;
    startCooldown();
  }

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandCentered />

          <section className="ax-card" role="region" aria-label="Reset password" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              {!sent ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                  <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                    <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Reset password</h1>
                    <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Enter your account email and we'll send a reset link.</p>
                  </header>

                  <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
                    <div className="ax-field">
                      <label className="ax-label" htmlFor="rp-email">Email</label>
                      <div className="ax-field__control">
                        <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
                        </span>
                        <input id="rp-email" type="email" className={`ax-input ax-input--with-leading-icon${emailErr ? ' is-invalid' : ''}`} autoComplete="email" placeholder="you@vireo.io"
                          value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailErr ? 'true' : 'false'} aria-describedby="rp-email-msg" required />
                      </div>
                      {emailErr && <p id="rp-email-msg" className="ax-field__message ax-field__message--error">{emailErr}</p>}
                    </div>

                    <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} aria-busy={loading}>
                      <span className="ax-btn__spinner" aria-hidden="true"></span>
                      <span className="ax-btn__label">Send reset link</span>
                    </button>
                  </form>

                  <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                    Remembered it? <Link className="ax-link" href="/auth/sign-in-basic" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Sign in</Link>
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', textAlign: 'center' }}>
                  <span className="ax-center" aria-hidden="true" style={{ inlineSize: 64, blockSize: 64, marginInline: 'auto', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-success-50)', color: 'var(--ax-success-500)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={30} height={30}><path d="M3 7h3" /><path d="M3 11h2" /><path d="M9.02 8.801l-.6 6a2 2 0 0 0 1.99 2.199h7.98a2 2 0 0 0 1.99 -1.801l.6 -6a2 2 0 0 0 -1.99 -2.199h-7.98a2 2 0 0 0 -1.99 1.801" /><path d="M9.8 7.5l2.982 3.28a3 3 0 0 0 4.238 .202l3.28 -2.982" /></svg>
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                    <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Check your inbox</h1>
                    <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>We sent a password reset link to <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{masked}</b>. The link expires in 30 minutes.</p>
                  </div>
                  <div className="ax-center" style={{ flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" disabled={cooldown > 0} onClick={resend}>
                      <span className="ax-btn__label">{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}</span>
                    </button>
                    <Link className="ax-btn ax-btn--ghost ax-btn--block" href="/auth/sign-in-basic">
                      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
                      <span className="ax-btn__label">Back to sign in</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
            Didn't request this? You can safely ignore the email.
          </p>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default ResetPasswordBasic;
