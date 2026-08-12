'use client';
/*
 * Vireo Next.js — Create / set new password (basic).
 * 1:1 re-expression of src/html/auth/create-password-basic.html: an expired-token
 * path (?token=expired), a new-password field with strength meter + a live rules
 * checklist, a confirm field, and a success alert that redirects to sign-in.
 *
 * `useSearchParams` (next/navigation) needs a Suspense boundary at build time;
 * the route file wraps this screen in <Suspense> (see app/(bare)/auth/
 * create-password-basic/page.tsx).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthStandalone, OffappToolsCompact, EYE, EYE_OFF } from './authShared';

const LOCAL_STYLE = `
@keyframes ax-spin-local { to { transform: rotate(360deg); } }
.ax-spin { animation: ax-spin-local 0.7s var(--ax-ease-linear) infinite; }
@media (prefers-reduced-motion: reduce) { .ax-spin { animation: none; } .ax-strength__bar { transition: none !important; } }
.ax-strength__bar { transition: background var(--ax-motion-fast) var(--ax-ease-standard); }
`;

const HEX = (
  <svg viewBox="0 0 32 32" width={23} height={23} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

export function CreatePasswordBasic() {
  const params = useSearchParams();
  const router = useRouter();
  const expired = params.get('token') === 'expired';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const rules = useMemo(() => [
    { id: 'len', text: 'At least 8 characters', ok: pw.length >= 8 },
    { id: 'num', text: 'Contains a number', ok: /\d/.test(pw) },
    { id: 'upper', text: 'Contains an uppercase letter', ok: /[A-Z]/.test(pw) },
    { id: 'sym', text: 'Contains a symbol', ok: /[^A-Za-z0-9]/.test(pw) },
  ], [pw]);
  const score = useMemo(() => {
    if (!pw) return 0;
    const met = rules.filter((r) => r.ok).length;
    let s = met;
    if (pw.length < 8) s = Math.min(s, 1);
    if (pw.length >= 12 && met === 4) s = 4;
    return Math.min(s, 4);
  }, [pw, rules]);
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const barColor = ['', 'var(--ax-danger-500)', 'var(--ax-warning-500)', 'var(--ax-info-500)', 'var(--ax-success-500)'][score] || 'var(--ax-fill-hover)';
  const match = confirm.length > 0 && pw === confirm;
  const canSubmit = rules.every((r) => r.ok) && match;

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDone(true);
      setTimeout(() => router.push('/auth/sign-in-basic'), 1400);
    }, 650);
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
              {expired ? (
                <div>
                  <div className="ax-alert ax-alert--danger" role="alert" style={{ marginBlockEnd: 'var(--ax-space-5)' }}>
                    <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M5.07 19h13.86a2 2 0 0 0 1.73 -3l-6.93 -12a2 2 0 0 0 -3.46 0l-6.93 12a2 2 0 0 0 1.73 3" /></svg>
                    <div className="ax-alert__content">
                      <p className="ax-alert__title">This reset link has expired</p>
                      <p className="ax-alert__message">For your security, reset links are valid for 60 minutes. Request a fresh one to continue.</p>
                    </div>
                  </div>
                  <Link className="ax-btn ax-btn--primary ax-btn--block" href="/auth/reset-password-basic" style={{ minHeight: 44 }}>
                    <span className="ax-btn__label">Request a new link</span>
                  </Link>
                </div>
              ) : (
                <div>
                  <h1 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '0 0 var(--ax-space-2)', letterSpacing: '-.01em' }}>Set a new password</h1>
                  <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: '0 0 var(--ax-space-6)' }}>Choose a strong password you don't use elsewhere. It'll apply across all your devices.</p>

                  {done && (
                    <div className="ax-alert ax-alert--success" role="alert" style={{ marginBlockEnd: 'var(--ax-space-5)' }}>
                      <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
                      <div className="ax-alert__content"><p className="ax-alert__message">Password updated. Redirecting you to sign in…</p></div>
                    </div>
                  )}

                  {!done && (
                    <form className="ax-stack" onSubmit={submit} noValidate>
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="np">New password</label>
                        <div className="ax-field__control">
                          <input id="np" className="ax-input ax-input--with-trailing" type={reveal ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter a new password"
                            value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="np-rules" />
                          <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'} onClick={() => setReveal((v) => !v)}>
                            {reveal ? EYE_OFF : EYE}
                          </button>
                        </div>

                        {pw.length > 0 && (
                          <div className="ax-strength" style={{ marginBlockStart: 'var(--ax-space-2)' }} aria-hidden="true">
                            <div className="ax-strength__bars">
                              <span className="ax-strength__bar" style={score >= 1 ? { background: barColor } : undefined}></span>
                              <span className="ax-strength__bar" style={score >= 2 ? { background: barColor } : undefined}></span>
                              <span className="ax-strength__bar" style={score >= 3 ? { background: barColor } : undefined}></span>
                              <span className="ax-strength__bar" style={score >= 4 ? { background: barColor } : undefined}></span>
                            </div>
                            <span className="ax-strength__label">Strength: <b style={{ color: barColor }}>{label}</b></span>
                          </div>
                        )}

                        <ul id="np-rules" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-1)', marginBlockStart: 'var(--ax-space-3)', listStyle: 'none', padding: 0 }} aria-live="polite">
                          {rules.map((r) => (
                            <li key={r.id} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: r.ok ? 'var(--ax-success-500)' : 'var(--ax-text-muted)' }}>
                              {r.ok
                                ? <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
                                : <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>}
                              <span>{r.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="ax-field">
                        <label className="ax-label" htmlFor="cp">Confirm new password</label>
                        <input id="cp" className="ax-input" type={reveal ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter your new password"
                          value={confirm} onChange={(e) => setConfirm(e.target.value)}
                          aria-invalid={confirm.length > 0 && !match}
                          style={confirm.length > 0 && !match ? { borderColor: 'var(--ax-danger-500)' } : undefined}
                          aria-describedby="cp-msg" />
                        {confirm.length > 0 && !match && <p id="cp-msg" className="ax-field__message ax-error">Passwords don't match yet.</p>}
                      </div>

                      <button type="submit" className="ax-btn ax-btn--primary ax-btn--block" aria-busy={loading} disabled={loading || !canSubmit} style={{ marginBlockStart: 'var(--ax-space-2)', minHeight: 44 }}>
                        {loading && <svg className="ax-btn__icon ax-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                        <span className="ax-btn__label">{loading ? 'Saving…' : 'Set new password'}</span>
                      </button>
                    </form>
                  )}

                  <p style={{ marginBlockStart: 'var(--ax-space-5)', textAlign: 'center', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                    Remembered it? <Link className="ax-link" href="/auth/sign-in-basic">Back to sign in</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default CreatePasswordBasic;
