'use client';
/*
 * Vireo Next.js — Reset password (cover split).
 * 1:1 re-expression of src/html/auth/reset-password-cover.html: a reassurance
 * panel with a lock card (lg+) beside the request→success reset flow. Demo always
 * succeeds (anti-enumeration); 30s resend cooldown on the success state.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { AuthStandalone, OffappTools, BrandInline } from './authShared';

const COVER_STYLE = `
@media (min-width: 992px) {
  .ax-auth-cover { grid-template-columns: 52% 48%; }
  .ax-auth-cover__panel { display: flex !important; }
}
`;

export function ResetPasswordCover() {
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
    setTimeout(() => { setLoading(false); setMasked(maskEmail(email.trim())); setSent(true); startCooldown(); }, 800);
  }
  function resend() {
    if (cooldown > 0) return;
    startCooldown();
  }

  return (
    <AuthStandalone cover>
      <style>{COVER_STYLE}</style>
      <div className="ax-auth-cover" style={{ position: 'relative', zIndex: 1, minBlockSize: '100dvh', display: 'grid', gridTemplateColumns: '1fr' }}>

        <aside className="ax-auth-cover__panel" aria-hidden="true"
          style={{ position: 'relative', overflow: 'hidden', display: 'none', flexDirection: 'column', justifyContent: 'space-between', padding: 'var(--ax-space-12)', background: 'linear-gradient(150deg, var(--ax-accent-wash) 0%, var(--ax-surface-subtle) 65%, var(--ax-canvas) 100%)', borderInlineEnd: '1px solid var(--ax-border)' }}>
          <span aria-hidden="true" style={{ position: 'absolute', insetBlockStart: -120, insetInlineEnd: -100, inlineSize: 380, blockSize: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--ax-accent-rgb),.28), transparent 64%)', filter: 'blur(8px)' }} />
          <span aria-hidden="true" style={{ position: 'absolute', insetBlockEnd: -160, insetInlineStart: -120, inlineSize: 420, blockSize: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--ax-accent-rgb),.16), transparent 66%)', filter: 'blur(10px)' }} />

          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', position: 'relative' }}>
            <span className="ax-center" style={{ inlineSize: 40, blockSize: 40, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>
              <svg viewBox="0 0 32 32" width={23} height={23} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
            </span>
            <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Vireo</span>
          </div>

          <div style={{ position: 'relative', maxInlineSize: '32ch' }}>
            <span className="ax-center" style={{ inlineSize: 60, blockSize: 60, borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-surface-raised)', border: '1px solid var(--ax-border)', color: 'var(--ax-accent)', boxShadow: 'var(--ax-shadow-sm)', marginBlockEnd: 'var(--ax-space-5)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={30} height={30}><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
            </span>
            <h2 style={{ margin: '0 0 var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', lineHeight: 1.3, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Locked out? It happens.</h2>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>Enter the email on your account and we'll send a secure link to set a new password. Links expire after 30 minutes and can only be used once.</p>
          </div>

          <p style={{ margin: 0, position: 'relative', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Need a hand? <Link className="ax-link" href="/pages/support">Contact support</Link></p>
        </aside>

        <main className="ax-center" id="ax-main" style={{ position: 'relative', padding: 'var(--ax-space-8) var(--ax-space-6)' }}>
          <OffappTools style={{ position: 'absolute', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)' }} />

          <div style={{ inlineSize: '100%', maxInlineSize: 440, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <BrandInline />

            {!sent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
                <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                  <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Reset password</h1>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Enter your account email and we'll send a reset link.</p>
                </header>
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="rp-email">Email</label>
                    <div className="ax-field__control">
                      <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
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
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Remembered it? <Link className="ax-link" href="/auth/sign-in-cover" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Sign in</Link></p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <span className="ax-center" aria-hidden="true" style={{ inlineSize: 64, blockSize: 64, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-success-50)', color: 'var(--ax-success-500)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={30} height={30}><path d="M3 7h3" /><path d="M3 11h2" /><path d="M9.02 8.801l-.6 6a2 2 0 0 0 1.99 2.199h7.98a2 2 0 0 0 1.99 -1.801l.6 -6a2 2 0 0 0 -1.99 -2.199h-7.98a2 2 0 0 0 -1.99 1.801" /><path d="M9.8 7.5l2.982 3.28a3 3 0 0 0 4.238 .202l3.28 -2.982" /></svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Check your inbox</h1>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>We sent a password reset link to <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{masked}</b>. The link expires in 30 minutes.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" disabled={cooldown > 0} onClick={resend}>
                    <span className="ax-btn__label">{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}</span>
                  </button>
                  <Link className="ax-btn ax-btn--ghost ax-btn--block" href="/auth/sign-in-cover">
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
                    <span className="ax-btn__label">Back to sign in</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthStandalone>
  );
}

export default ResetPasswordCover;
