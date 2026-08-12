'use client';
/*
 * Vireo Next.js — Two-step verification (cover split).
 * 1:1 re-expression of src/html/auth/two-step-cover.html: a duotone material
 * panel (lg+) beside the OTP card (label + 6 cells, resend/trust, error banner).
 * Demo code "123456" passes → redirects to "/". Cooldown starts at 30s.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappToolsCompact } from './authShared';

const LOCAL_STYLE = `
@keyframes ax-spin-local { to { transform: rotate(360deg); } }
.ax-spin { animation: ax-spin-local 0.7s var(--ax-ease-linear) infinite; }
@media (min-width: 992px) {
  .ax-auth-cover { grid-template-columns: 52% 48% !important; }
  .ax-auth-cover__panel { display: flex !important; }
}
@media (prefers-reduced-motion: reduce) { .ax-spin { animation: none; } }
`;

const HEX = (_size: number) => (
  <svg viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

export function TwoStepCover() {
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [trust, setTrust] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function tick() {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c > 0) return c - 1;
        if (timer.current) clearInterval(timer.current);
        return 0;
      });
    }, 1000);
  }
  useEffect(() => {
    tick();
    cells.current[0]?.focus();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  function onInput(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(-1);
    setDigits((d) => { const next = [...d]; next[i] = v; return next; });
    setInvalid(false);
    if (v && i < 5) cells.current[i + 1]?.focus();
  }
  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) cells.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) cells.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) cells.current[i + 1]?.focus();
  }
  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
    setDigits(() => {
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) next[i] = t[i] || '';
      return next;
    });
    const last = Math.min(t.length, 6) - 1;
    if (last >= 0) cells.current[last]?.focus();
  }
  function resend() {
    if (cooldown > 0) return;
    setCooldown(30);
    tick();
    setError('');
    setInvalid(false);
  }
  function verify(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    const code = digits.join('');
    if (code.length < 6) {
      setInvalid(true);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (code === '123456') {
        router.push('/');
      } else {
        setInvalid(true);
        setError('Incorrect code. Please try again.');
        setDigits(['', '', '', '', '', '']);
        cells.current[0]?.focus();
      }
    }, 650);
  }

  return (
    <AuthStandalone cover>
      <style>{LOCAL_STYLE}</style>
      <OffappToolsCompact />

      <main className="ax-center" id="ax-main" style={{ position: 'relative', zIndex: 1, minBlockSize: '100vh', width: '100%' }}>
        <div className="ax-auth-cover" style={{ display: 'grid', gridTemplateColumns: '1fr', width: '100%', minBlockSize: '100vh' }}>

          <aside className="ax-auth-cover__panel" aria-hidden="true"
            style={{ position: 'relative', overflow: 'hidden', display: 'none', flexDirection: 'column', justifyContent: 'space-between', padding: 'var(--ax-space-10)', background: 'radial-gradient(120% 120% at 18% 12%, rgba(var(--ax-accent-rgb),.34), transparent 55%), radial-gradient(140% 120% at 92% 96%, rgba(var(--ax-accent-rgb),.20), transparent 60%), linear-gradient(160deg, var(--ax-surface-solid), var(--ax-accent-wash))' }}>
            <span style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(135deg, transparent 0 22px, rgba(var(--ax-accent-rgb),.05) 22px 23px)' }} />
            <span style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', right: -90, top: '18%', border: '1px solid rgba(var(--ax-accent-rgb),.30)' }} />
            <span style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', right: 10, top: '32%', border: '1px solid rgba(var(--ax-accent-rgb),.18)' }} />
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', position: 'relative' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{HEX(22)}</span>
              <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', letterSpacing: '-.01em' }}>Vireo</b>
            </div>
            <div style={{ position: 'relative', maxWidth: '30ch' }}>
              <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ax-accent)', marginBlockEnd: 'var(--ax-space-4)' }}><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
              <p style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 600, color: 'var(--ax-text-strong)', lineHeight: 1.3, margin: 0 }}>A second step keeps your workspace yours.</p>
              <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBlockStart: 'var(--ax-space-3)' }}>Codes rotate every 30 seconds and never leave your device.</p>
            </div>
          </aside>

          <section className="ax-auth-cover__pane" style={{ display: 'grid', placeItems: 'center', padding: 'var(--ax-space-8) var(--ax-space-6)' }}>
            <div className="ax-card" style={{ width: '100%', maxWidth: 440 }}>
              <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginBlockEnd: 'var(--ax-space-6)' }}>
                  <span style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>{HEX(23)}</span>
                  <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)' }}>Vireo</b>
                </div>

                <h1 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '0 0 var(--ax-space-2)', letterSpacing: '-.01em' }}>Two-step verification</h1>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: '0 0 var(--ax-space-6)' }}>We sent a 6-digit code to <b className="ax-num" style={{ color: 'var(--ax-text)' }}>+1 (•••) •••-4417</b>. Enter it below to continue.</p>

                {error && (
                  <div className="ax-alert ax-alert--danger" role="alert" style={{ marginBlockEnd: 'var(--ax-space-5)' }}>
                    <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M5.07 19h13.86a2 2 0 0 0 1.73 -3l-6.93 -12a2 2 0 0 0 -3.46 0l-6.93 12a2 2 0 0 0 1.73 3" /></svg>
                    <div className="ax-alert__content"><p className="ax-alert__message">{error}</p></div>
                  </div>
                )}

                <form className="ax-stack" onSubmit={verify} noValidate>
                  <div>
                    <label className="ax-label" style={{ display: 'block', marginBlockEnd: 'var(--ax-space-3)' }}>Verification code</label>
                    <div className={`ax-otp${invalid ? ' is-invalid' : ''}`} role="group" aria-label="6-digit verification code">
                      {digits.map((d, i) => (
                        <input key={i} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={1}
                          className="ax-otp__cell ax-num" aria-label={`Digit ${i + 1} of 6`}
                          style={invalid ? { borderColor: 'var(--ax-danger-500)' } : undefined}
                          value={d} ref={(el) => { cells.current[i] = el; }}
                          onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKey(i, e)} onPaste={onPaste} />
                      ))}
                    </div>
                    {invalid && <p className="ax-field__message ax-error" style={{ marginBlockStart: 'var(--ax-space-2)' }}>Incorrect code — please re-enter all six digits.</p>}
                  </div>

                  <div className="ax-cluster ax-cluster--between" style={{ marginBlockStart: 'var(--ax-space-1)' }}>
                    <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Didn't get it?</span>
                    <button type="button" className="ax-btn ax-btn--link ax-btn--sm" disabled={cooldown > 0} onClick={resend}>
                      {cooldown === 0
                        ? <span>Resend code</span>
                        : <span className="ax-num">Resend in <span>{cooldown}</span>s</span>}
                    </button>
                  </div>

                  <label className="ax-cluster" style={{ gap: 'var(--ax-space-3)', cursor: 'pointer', marginBlockStart: 'var(--ax-space-1)' }}>
                    <input type="checkbox" className="ax-checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
                    <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Trust this device for 30 days</span>
                  </label>

                  <button type="submit" className="ax-btn ax-btn--primary ax-btn--block" aria-busy={loading} disabled={loading} style={{ marginBlockStart: 'var(--ax-space-3)', minHeight: 44 }}>
                    {loading && <svg className="ax-btn__icon ax-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                    <span className="ax-btn__label">{loading ? 'Verifying…' : 'Verify'}</span>
                  </button>
                </form>

                <div style={{ marginBlockStart: 'var(--ax-space-5)', textAlign: 'center' }}>
                  <Link className="ax-link" href="/auth/two-step-basic" style={{ fontSize: 'var(--ax-text-sm)' }}>Use a different method</Link>
                  <span style={{ color: 'var(--ax-text-subtle)', marginInline: 'var(--ax-space-2)' }}>·</span>
                  <Link className="ax-link" href="/auth/sign-in-basic" style={{ fontSize: 'var(--ax-text-sm)' }}>Back to sign in</Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default TwoStepCover;
