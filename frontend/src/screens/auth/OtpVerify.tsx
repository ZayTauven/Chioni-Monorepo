'use client';
/*
 * Chioni — SMS code verification (route /auth/verify).
 *
 * Based on the Vireo TwoStepBasic screen: 6-cell OTP group with auto-advance /
 * backspace / arrow keys / paste, 60 s resend cooldown (the API throttles at
 * 3 requests per hour per phone). The pending phone comes from sessionStorage
 * (set by /auth/sign-in); without it the visitor is sent back there.
 * On success: one hat → its space, otherwise → /espaces.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappTools, BrandCentered } from './authShared';
import { PENDING_PHONE_KEY } from './PhoneSignIn';
import { routeAfterSignIn, useAuth } from '@/context/AuthContext';
import { otpRequest } from '@/lib/endpoints/auth';
import { ApiError } from '@/lib/api';
import { maskPhone } from '@/lib/labels';

const RESEND_COOLDOWN_S = 60;

export function OtpVerify() {
  const router = useRouter();
  const { signInWithOtp } = useAuth();
  const [phone, setPhone] = useState<string | null>(null);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const raf = useRef(0);

  const complete = digits.every((d) => /^\d$/.test(d));

  function focusCell(i: number) {
    const c = cells.current[i];
    if (c) { c.focus(); c.select(); }
  }
  function startCooldown(seconds: number = RESEND_COOLDOWN_S) {
    const deadline = Date.now() + seconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setCooldown(left);
      if (left > 0) raf.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(raf.current);
    tick();
  }

  // Boot: recover the pending phone, or bounce back to sign-in.
  useEffect(() => {
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_PHONE_KEY);
    } catch {
      /* ignore */
    }
    if (!pending) {
      router.replace('/auth/sign-in');
      return;
    }
    setPhone(pending);
    startCooldown();
    focusCell(0);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onInput(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    setErrorMsg('');
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
    setErrorMsg('');
    setDigits(() => {
      const next = ['', '', '', '', '', ''];
      for (let i = 0; i < 6; i++) next[i] = txt[i] || '';
      return next;
    });
    focusCell(Math.min(txt.length, 5));
  }

  async function verify(ev: React.FormEvent) {
    ev.preventDefault();
    if (!complete || !phone || loading) return;
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const me = await signInWithOtp(phone, digits.join(''));
      try {
        sessionStorage.removeItem(PENDING_PHONE_KEY);
      } catch {
        /* ignore */
      }
      router.push(routeAfterSignIn(me));
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError && err.status === 429) {
        const wait = err.retryAfterSeconds ?? 60;
        setErrorMsg(`Trop d'essais. Réessayez dans ${wait} seconde${wait > 1 ? 's' : ''}.`);
      } else {
        setErrorMsg('Code invalide ou expiré.');
      }
      setDigits(['', '', '', '', '', '']);
      focusCell(0);
    }
  }

  async function resend() {
    if (cooldown > 0 || !phone) return;
    setErrorMsg('');
    setInfoMsg('');
    try {
      await otpRequest(phone);
      setInfoMsg('Si ce numéro peut recevoir un code, un SMS vient de lui être envoyé.');
      startCooldown();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const wait = err.retryAfterSeconds ?? RESEND_COOLDOWN_S;
        setErrorMsg(`Trop de demandes. Réessayez dans ${wait} seconde${wait > 1 ? 's' : ''}.`);
        startCooldown(wait);
      } else {
        setErrorMsg('Impossible de renvoyer le code pour le moment. Réessayez plus tard.');
      }
    }
  }

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandCentered />

          <section className="ax-card" role="region" aria-label="Vérification du code" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', alignItems: 'center' }}>
                <span className="ax-center" aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={26} height={26}><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 12l0 2.5" /></svg>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                  <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Code reçu par SMS</h1>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                    Si ce numéro peut recevoir un code, un SMS vient d&rsquo;être envoyé au{' '}
                    <b style={{ color: 'var(--ax-text-strong)' }}>{phone ? maskPhone(phone) : '…'}</b>.
                  </p>
                </div>
              </header>

              {errorMsg && (
                <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                  <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>{errorMsg}</p></div>
                </div>
              )}
              {infoMsg && (
                <div role="status" className="ax-alert ax-alert--info" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
                  <div className="ax-alert__content"><p className="ax-alert__message">{infoMsg}</p></div>
                </div>
              )}

              <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }} noValidate>
                <div>
                  <div className="ax-otp" role="group" aria-label="Saisissez le code à 6 chiffres" style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-2)' }} onPaste={onPaste}>
                    {digits.map((d, i) => (
                      <input key={i} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={1}
                        className="ax-otp__cell" style={{ flex: '1 1 0', minInlineSize: 0, fontWeight: 600, ...(errorMsg ? { borderColor: 'var(--ax-danger-500)' } : {}) }}
                        aria-label={`Chiffre ${i + 1} sur 6`} ref={(el) => { cells.current[i] = el; }} value={d}
                        onChange={(e) => onInput(i, e)} onKeyDown={(e) => onKey(i, e)} onFocus={(e) => e.target.select()} />
                    ))}
                  </div>
                </div>

                <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} disabled={!complete || loading} aria-busy={loading}>
                  <span className="ax-btn__spinner" aria-hidden="true"></span>
                  <span className="ax-btn__label">Valider</span>
                </button>
              </form>

              <div className="ax-center" style={{ flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Vous n&rsquo;avez rien reçu ?{' '}
                  <button type="button" className="ax-btn ax-btn--link" disabled={cooldown > 0} onClick={() => void resend()} style={{ fontSize: 'var(--ax-text-sm)', verticalAlign: 'baseline' }}>
                    <span>{cooldown > 0 ? `Renvoyer dans ${cooldown} s` : 'Renvoyer le code'}</span>
                  </button>
                </p>
                <Link className="ax-link" href="/auth/sign-in" style={{ fontSize: 'var(--ax-text-sm)' }}>Changer de numéro</Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default OtpVerify;
