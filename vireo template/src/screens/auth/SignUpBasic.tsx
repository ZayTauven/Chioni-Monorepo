'use client';
/*
 * Vireo Next.js — Create your account (basic).
 * 1:1 re-expression of src/html/auth/sign-up-basic.html: standalone centered
 * card, social row, name/email/password/confirm with a live strength meter and
 * a terms checkbox gating submit. Demo submit flashes "email already in use".
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  AuthStandalone, OffappTools, BrandCentered, SocialButtons, EYE, EYE_OFF,
} from './authShared';

const STRENGTH = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];

export function SignUpBasic() {
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
    if (score <= 1) return 'is-weak';
    if (score === 2) return 'is-weak';
    if (score === 3) return 'is-medium';
    return 'is-strong';
  }
  function validate() {
    const n = name.trim();
    const ne = !n ? 'Enter your full name.' : n.length < 2 || n.length > 60 ? 'Name must be 2–60 characters.' : '';
    const ee = !email.trim() ? 'Enter your email.' : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Enter a valid email address.' : '';
    const pe = password.length < 8 ? 'Use at least 8 characters.' : '';
    const ce = confirm !== password ? 'Passwords do not match.' : '';
    setNameErr(ne);
    setEmailErr(ee);
    setPassErr(pe);
    setConfirmErr(ce);
    setTermsTouched(true);
    return !ne && !ee && !pe && !ce && terms;
  }
  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(false);
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setError(true);
    }, 900);
  }

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandCentered />

          <section className="ax-card" role="region" aria-label="Create your account" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
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

              <form className="ax-stack" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
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

              <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Already have an account? <Link className="ax-link" href="/auth/sign-in-basic" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Sign in</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default SignUpBasic;
