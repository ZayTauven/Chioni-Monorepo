'use client';
/*
 * Chioni — sign-in by phone (route /auth/sign-in).
 *
 * Based on the Vireo SignInBasic screen: one phone field, one button.
 * POST /auth/otp/request/ then → /auth/verify (the phone travels via
 * sessionStorage). Anti-enumeration: the API success message is constant —
 * we never reveal whether a number is known.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappTools, BrandCentered } from './authShared';
import { otpRequest } from '@/lib/endpoints/auth';
import { ApiError } from '@/lib/api';

export const PENDING_PHONE_KEY = 'chioni:pending-phone';

export function PhoneSignIn() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [throttleMsg, setThrottleMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((left) => {
        if (left <= 1 && timer.current) clearInterval(timer.current);
        return Math.max(0, left - 1);
      });
    }, 1000);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setPhoneErr('');
    setThrottleMsg('');
    if (!phone.trim()) {
      setPhoneErr('Saisissez votre numéro de téléphone.');
      return;
    }
    setLoading(true);
    try {
      await otpRequest(phone.trim());
      try {
        sessionStorage.setItem(PENDING_PHONE_KEY, phone.trim());
      } catch {
        /* ignore */
      }
      router.push('/auth/verify');
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        const wait = err.retryAfterSeconds ?? 60;
        setThrottleMsg(
          `Trop de demandes pour le moment. Vous pourrez réessayer dans ${wait} seconde${wait > 1 ? 's' : ''}.`,
        );
        startCooldown(wait);
      } else if (err instanceof ApiError && err.status === 400) {
        setPhoneErr(
          err.fieldErrors.phone?.[0] ??
            err.messages[0] ??
            'Ce numéro ne semble pas valide. Vérifiez-le et réessayez.',
        );
      } else {
        setThrottleMsg('Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.');
      }
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || cooldown > 0;

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandCentered />

          <section className="ax-card" role="region" aria-label="Connexion" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Connexion</h1>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Saisissez votre numéro de téléphone. Vous recevrez un code par SMS.
                </p>
              </header>

              {throttleMsg && (
                <div role="alert" className="ax-alert ax-alert--warning" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                  <div className="ax-alert__content"><p className="ax-alert__message">{throttleMsg}</p></div>
                </div>
              )}

              <form className="ax-stack" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="si-phone">Numéro de téléphone</label>
                  <input
                    id="si-phone"
                    type="tel"
                    inputMode="tel"
                    className={`ax-input${phoneErr ? ' is-invalid' : ''}`}
                    autoComplete="tel"
                    placeholder="+269 332 12 34"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={phoneErr ? 'true' : 'false'}
                    aria-describedby="si-phone-msg"
                    required
                  />
                  {phoneErr ? (
                    <p id="si-phone-msg" className="ax-field__message ax-field__message--error">{phoneErr}</p>
                  ) : (
                    <p id="si-phone-msg" className="ax-field__message">Les numéros comoriens peuvent être saisis sans le +269.</p>
                  )}
                </div>

                <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} disabled={disabled} aria-busy={loading}>
                  <span className="ax-btn__spinner" aria-hidden="true"></span>
                  <span className="ax-btn__label">
                    {cooldown > 0 ? `Réessayer dans ${cooldown} s` : 'Recevoir mon code'}
                  </span>
                </button>
              </form>

              <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                Pas encore de compte ? Il sera créé automatiquement à la première connexion.
              </p>
            </div>
          </section>

          <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
            Personnel de santé ?{' '}
            <Link className="ax-link" href="/auth/staff">Connexion par mot de passe</Link>
          </p>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default PhoneSignIn;
