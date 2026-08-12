'use client';
/*
 * Vireo Next.js — Create your account (cover split).
 * 1:1 re-expression of src/html/auth/sign-up-cover.html: a benefits-list gradient
 * panel (lg+) beside the same sign-up form (name/email/password+strength/confirm/
 * terms) on the right. Note: this variant's strength barClass uses score<=2=weak.
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

const STRENGTH = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><path d="M5 12l5 5l10 -10" /></svg>
);
const BENEFITS = [
  '14-day trial, full access — no card required',
  '17 dashboards, 8 apps, full eCommerce suite',
  'SSO, audit logs and SOC 2 from day one',
];

export function SignUpCover() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [termsTouched, setTermsTouched] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nameErr, setNameErr] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');
  const [confirmErr, setConfirmErr] = useState('');

  function scorePassword(p: string) {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    setScore(p.length < 8 ? Math.min(s, 1) : s);
  }
  function barClass(i: number) {
    if (i >= score) return '';
    if (score <= 2) return 'is-weak';
    if (score === 3) return 'is-medium';
    return 'is-strong';
  }
  function validate() {
    const n = name.trim();
    const ne = !n ? 'Enter your full name.' : n.length < 2 || n.length > 60 ? 'Name must be 2–60 characters.' : '';
    const ee = !email.trim() ? 'Enter your email.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Enter a valid email address.' : '';
    const pe = password.length < 8 ? 'Use at least 8 characters.' : '';
    const ce = confirm !== password ? 'Passwords do not match.' : '';
    setNameErr(ne); setEmailErr(ee); setPassErr(pe); setConfirmErr(ce); setTermsTouched(true);
    return !ne && !ee && !pe && !ce && terms;
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

          <div style={{ position: 'relative', maxInlineSize: '34ch' }}>
            <h2 style={{ margin: '0 0 var(--ax-space-4)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', lineHeight: 1.25, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Start building in minutes, not weeks.</h2>
            <ul className="ax-stack" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {BENEFITS.map((b) => (
                <li key={b} className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                  <span className="ax-center" style={{ inlineSize: 24, blockSize: 24, flex: '0 0 auto', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-success-50)', color: 'var(--ax-success-500)' }}>{CHECK}</span>
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', position: 'relative' }}>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>24K+</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>teams onboard</div></div>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>120+</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>integrations</div></div>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>4.9/5</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>avg. rating</div></div>
          </div>
        </aside>

        <main className="ax-center" id="ax-main" style={{ position: 'relative', padding: 'var(--ax-space-8) var(--ax-space-6)' }}>
          <OffappTools style={{ position: 'absolute', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)' }} />

          <div style={{ inlineSize: '100%', maxInlineSize: 440, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <BrandInline />

            <header style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
              <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Create your account</h1>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Start your 14-day trial. No card required.</p>
            </header>

            <SocialButtons verb="Sign up" />

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', whiteSpace: 'nowrap' }}>or sign up with email</span>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
            </div>

            {error && (
              <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>That email is already in use. Try signing in instead.</p></div>
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
              <div className="ax-field">
                <label className="ax-label" htmlFor="su-name">Full name</label>
                <input id="su-name" type="text" className={`ax-input${nameErr ? ' is-invalid' : ''}`} autoComplete="name" placeholder="Ada Lovelace"
                  value={name} onChange={(e) => setName(e.target.value)} aria-invalid={nameErr ? 'true' : 'false'} aria-describedby="su-name-msg" required />
                {nameErr && <p id="su-name-msg" className="ax-field__message ax-field__message--error">{nameErr}</p>}
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="su-email">Email</label>
                <input id="su-email" type="email" className={`ax-input${emailErr ? ' is-invalid' : ''}`} autoComplete="email" placeholder="you@vireo.io"
                  value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailErr ? 'true' : 'false'} aria-describedby="su-email-msg" required />
                {emailErr && <p id="su-email-msg" className="ax-field__message ax-field__message--error">{emailErr}</p>}
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="su-pass">Password</label>
                <div className="ax-field__control">
                  <input id="su-pass" className={`ax-input ax-input--with-trailing${passErr ? ' is-invalid' : ''}`} autoComplete="new-password" placeholder="At least 8 characters"
                    type={reveal ? 'text' : 'password'} value={password}
                    onChange={(e) => { setPassword(e.target.value); scorePassword(e.target.value); }}
                    aria-invalid={passErr ? 'true' : 'false'} aria-describedby="su-pass-msg su-strength" required />
                  <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'}>
                    {reveal ? EYE_OFF : EYE}
                  </button>
                </div>
                {password.length > 0 && (
                  <div id="su-strength" className="ax-strength" aria-live="polite">
                    <div className="ax-strength__bars">
                      <span className={`ax-strength__bar ${barClass(0)}`}></span>
                      <span className={`ax-strength__bar ${barClass(1)}`}></span>
                      <span className={`ax-strength__bar ${barClass(2)}`}></span>
                      <span className={`ax-strength__bar ${barClass(3)}`}></span>
                    </div>
                    <span className="ax-strength__label">{`Password strength: ${STRENGTH[score] || 'Weak'}`}</span>
                  </div>
                )}
                {passErr && <p id="su-pass-msg" className="ax-field__message ax-field__message--error">{passErr}</p>}
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="su-confirm">Confirm password</label>
                <input id="su-confirm" type="password" className={`ax-input${confirmErr ? ' is-invalid' : ''}`} autoComplete="new-password" placeholder="Re-enter your password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={confirmErr ? 'true' : 'false'} aria-describedby="su-confirm-msg" required />
                {confirmErr && <p id="su-confirm-msg" className="ax-field__message ax-field__message--error">{confirmErr}</p>}
              </div>
              <div className="ax-field" style={{ gap: 'var(--ax-space-1)' }}>
                <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', alignItems: 'center', lineHeight: 1.45 }}>
                  <input type="checkbox" className="ax-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                  <span>I agree to the <Link className="ax-link" href="/pages/terms">Terms of Service</Link> and <Link className="ax-link" href="/pages/privacy">Privacy Policy</Link>.</span>
                </label>
                {!terms && termsTouched && <p className="ax-field__hint" style={{ color: 'var(--ax-danger-500)' }}>You must accept the terms to continue.</p>}
              </div>
              <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} disabled={!terms} aria-busy={loading}>
                <span className="ax-btn__spinner" aria-hidden="true"></span>
                <span className="ax-btn__label">Create account</span>
              </button>
            </form>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              Already have an account? <Link className="ax-link" href="/auth/sign-in-cover" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Sign in</Link>
            </p>
          </div>
        </main>
      </div>
    </AuthStandalone>
  );
}

export default SignUpCover;
