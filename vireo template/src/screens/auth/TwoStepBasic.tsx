'use client';
/*
 * Vireo Next.js — Two-step verification (basic).
 * 1:1 re-expression of src/html/auth/two-step-basic.html: a 6-cell OTP group
 * with auto-advance / backspace / arrow-key nav / paste, a trust-device check
 * and a 30s resend cooldown. Demo code "111111" passes → redirects to "/".
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappTools, BrandCentered } from './authShared';

export function TwoStepBasic() {
  const router = useRouter();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [trust, setTrust] = useState(false);
  const [loading, setLoading] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const raf = useRef(0);

  const complete = digits.every((d) => /^\d$/.test(d));

  function focusCell(i: number) {
    const c = cells.current[i];
    if (c) { c.focus(); c.select(); }
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
  useEffect(() => {
    startCooldown();
    focusCell(0);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onInput(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    setInvalid(false);
    const v = e.target.value.replace(/\D/g, '');
    setDigits((d) => {
      const next = [...d];
      next[i] = v.slice(-1) || '';
      return next;
    });
    if (v && i < 5) focusCell(i + 1);
  }
  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      setDigits((d) => { const next = [...d]; next[i - 1] = ''; return next; });
      focusCell(i - 1);
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault();
      focusCell(i + 1);
    }
  }
  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!txt) return;
    setInvalid(false);
    setDigits(() => {
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) next[i] = txt[i] || '';
      return next;
    });
    focusCell(Math.min(txt.length, 5));
  }
  function verify(ev: React.FormEvent) {
    ev.preventDefault();
    if (!complete) return;
    setLoading(true);
    setInvalid(false);
    setTimeout(() => {
      setLoading(false);
      if (digits.join('') === '111111') {
        router.push('/');
      } else {
        setInvalid(true);
        setDigits(['', '', '', '', '', '']);
        focusCell(0);
      }
    }, 900);
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

          <section className="ax-card" role="region" aria-label="Two-step verification" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', alignItems: 'center' }}>
                <span className="ax-center" aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={26} height={26}><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 12l0 2.5" /></svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                  <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Two-step verification</h1>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>We sent a 6-digit code to <b style={{ color: 'var(--ax-text-strong)' }}>+1 ••• ••• 4072</b>.</p>
                </div>
              </header>

              {invalid && (
                <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                  <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>Incorrect code. Please check the code and try again.</p></div>
                </div>
              )}

              <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }} noValidate>
                <div>
                  <div className="ax-otp" role="group" aria-label="Enter the 6-digit verification code" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-2)' }} onPaste={onPaste}>
                    {digits.map((d, i) => (
                      <input key={i} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={1}
                        className="ax-otp__cell" style={{ flex: '1 1 0', minInlineSize: 0, fontWeight: 600, ...(invalid ? { borderColor: 'var(--ax-danger-500)' } : {}) }}
                        aria-label={`Digit ${i + 1} of 6`} ref={(el) => { cells.current[i] = el; }} value={d}
                        onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()} />
                    ))}
                  </div>
                </div>

                <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                  <input type="checkbox" className="ax-checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
                  <span>Trust this device for 30 days</span>
                </label>

                <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} disabled={!complete} aria-busy={loading}>
                  <span className="ax-btn__spinner" aria-hidden="true"></span>
                  <span className="ax-btn__label">Verify</span>
                </button>
              </form>

              <div className="ax-center" style={{ flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Didn't get a code?{' '}
                  <button type="button" className="ax-btn ax-btn--link" disabled={cooldown > 0} onClick={resend} style={{ fontSize: 'var(--ax-text-sm)', verticalAlign: 'baseline' }}>
                    <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</span>
                  </button>
                </p>
                <Link className="ax-link" href="/auth/sign-in-basic" style={{ fontSize: 'var(--ax-text-sm)' }}>Use a different method</Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default TwoStepBasic;
