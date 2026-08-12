'use client';
/*
 * Vireo Next.js — Sign in (cover split).
 * 1:1 re-expression of src/html/auth/sign-in-cover.html: a 52/48 split — a
 * gradient testimonial panel (lg+) and the same sign-in form as the basic
 * variant on the right. The lg breakpoint rule lives in the injected <style>.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  AuthStandalone, OffappTools, BrandInline, SocialButtons, EYE, EYE_OFF,
} from './authShared';

const COVER_STYLE = `
@media (min-width: 992px) {
  .ax-auth-cover { grid-template-columns: 52% 48%; }
  .ax-auth-cover__panel { display: flex !important; }
}
`;

export function SignInCover() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate() {
    const e = !email.trim()
      ? 'Enter your email or username.'
      : email.includes('@') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
        ? 'Enter a valid email address.'
        : '';
    const p = !password ? 'Enter your password.' : '';
    setEmailErr(e);
    setPassErr(p);
    return !e && !p;
  }
  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(false);
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setError(true); }, 900);
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

          <div style={{ position: 'relative', maxInlineSize: '30ch' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={34} height={34} style={{ color: 'var(--ax-accent)', opacity: 0.55, marginBlockEnd: 'var(--ax-space-4)' }}><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /></svg>
            <p style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', lineHeight: 1.4, fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Everything our team needs, finally in one calm surface. Vireo just gets out of the way.</p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginBlockStart: 'var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab, var(--ax-viz-violet) 18%, transparent)', color: 'var(--ax-viz-violet)' }}>
                <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
              </span>
              <div><div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Priya Nair</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Head of Operations · Northwind</div></div>
            </div>
          </div>

          <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', position: 'relative' }}>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>24K+</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>teams onboard</div></div>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>99.98%</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>uptime</div></div>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>4.9/5</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>avg. rating</div></div>
          </div>
        </aside>

        <main className="ax-center" id="ax-main" style={{ position: 'relative', padding: 'var(--ax-space-8) var(--ax-space-6)' }}>
          <OffappTools style={{ position: 'absolute', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)' }} />

          <div style={{ inlineSize: '100%', maxInlineSize: 440, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <BrandInline />

            <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Sign in</h1>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Welcome back — sign in to your workspace.</p>
            </header>

            <SocialButtons verb="Continue" />

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', whiteSpace: 'nowrap' }}>or continue with email</span>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
            </div>

            {error && (
              <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>Incorrect email or password. Please try again.</p></div>
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
              <div className="ax-field">
                <label className="ax-label" htmlFor="si-email">Email or username</label>
                <input id="si-email" type="text" className={`ax-input${emailErr ? ' is-invalid' : ''}`} autoComplete="username" placeholder="you@vireo.io"
                  value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailErr ? 'true' : 'false'} aria-describedby="si-email-msg" required />
                {emailErr && <p id="si-email-msg" className="ax-field__message ax-field__message--error">{emailErr}</p>}
              </div>
              <div className="ax-field">
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <label className="ax-label" htmlFor="si-pass">Password</label>
                  <Link className="ax-link" href="/auth/reset-password-cover" style={{ fontSize: 'var(--ax-text-xs)' }}>Forgot password?</Link>
                </div>
                <div className="ax-field__control">
                  <input id="si-pass" className={`ax-input ax-input--with-trailing${passErr ? ' is-invalid' : ''}`} autoComplete="current-password" placeholder="••••••••••"
                    type={reveal ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={passErr ? 'true' : 'false'} aria-describedby="si-pass-msg" required />
                  <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'}>
                    {reveal ? EYE_OFF : EYE}
                  </button>
                </div>
                {passErr && <p id="si-pass-msg" className="ax-field__message ax-field__message--error">{passErr}</p>}
              </div>
              <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                <input type="checkbox" className="ax-checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Keep me signed in</span>
              </label>
              <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} aria-busy={loading}>
                <span className="ax-btn__spinner" aria-hidden="true"></span>
                <span className="ax-btn__label">Sign in</span>
              </button>
            </form>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              New to Vireo? <Link className="ax-link" href="/auth/sign-up-cover" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Create an account</Link>
            </p>
          </div>
        </main>
      </div>
    </AuthStandalone>
  );
}

export default SignInCover;
