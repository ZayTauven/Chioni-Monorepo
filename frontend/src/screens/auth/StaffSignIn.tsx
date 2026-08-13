'use client';
/*
 * Chioni — staff password sign-in (route /auth/staff).
 *
 * Based on the Vireo SignInBasic screen. Password login is reserved for
 * health-center staff and back-office accounts; patients and guardians use
 * the SMS-code flow on /auth/sign-in.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappTools, BrandCentered, EYE, EYE_OFF } from './authShared';
import { routeAfterSignIn, useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';

export function StaffSignIn() {
  const router = useRouter();
  const { signInStaff } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [userErr, setUserErr] = useState('');
  const [passErr, setPassErr] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    const u = !username.trim() ? 'Saisissez votre identifiant.' : '';
    const p = !password ? 'Saisissez votre mot de passe.' : '';
    setUserErr(u);
    setPassErr(p);
    return !u && !p;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErrorMsg('');
    if (!validate()) return;
    setLoading(true);
    try {
      const me = await signInStaff(username.trim(), password);
      router.push(routeAfterSignIn(me));
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError && err.status === 401) {
        setErrorMsg('Identifiants invalides. Vérifiez votre identifiant et votre mot de passe.');
      } else if (err instanceof ApiError && err.status === 429) {
        const wait = err.retryAfterSeconds ?? 60;
        setErrorMsg(`Trop de tentatives. Réessayez dans ${wait} seconde${wait > 1 ? 's' : ''}.`);
      } else {
        setErrorMsg('Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.');
      }
    }
  }

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 400, position: 'relative', zIndex: 1 }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandCentered />

          <section className="ax-card" role="region" aria-label="Connexion du personnel" style={{ borderRadius: 'var(--ax-radius-xl)' }}>
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>Personnel de santé</h1>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Connectez-vous avec votre identifiant et votre mot de passe.</p>
              </header>

              {errorMsg && (
                <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                  <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>{errorMsg}</p></div>
                </div>
              )}

              <form className="ax-stack" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} noValidate>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="st-user">Identifiant</label>
                  <input id="st-user" type="text" className={`ax-input${userErr ? ' is-invalid' : ''}`} autoComplete="username"
                    value={username} onChange={(e) => setUsername(e.target.value)} aria-invalid={userErr ? 'true' : 'false'} aria-describedby="st-user-msg" required />
                  {userErr && <p id="st-user-msg" className="ax-field__message ax-field__message--error">{userErr}</p>}
                </div>

                <div className="ax-field">
                  <label className="ax-label" htmlFor="st-pass">Mot de passe</label>
                  <div className="ax-field__control">
                    <input id="st-pass" className={`ax-input ax-input--with-trailing${passErr ? ' is-invalid' : ''}`} autoComplete="current-password" placeholder="••••••••••"
                      type={reveal ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={passErr ? 'true' : 'false'} aria-describedby="st-pass-msg" required />
                    <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} aria-label={reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {reveal ? EYE_OFF : EYE}
                    </button>
                  </div>
                  {passErr && <p id="st-pass-msg" className="ax-field__message ax-field__message--error">{passErr}</p>}
                </div>

                <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`} aria-busy={loading}>
                  <span className="ax-btn__spinner" aria-hidden="true"></span>
                  <span className="ax-btn__label">Se connecter</span>
                </button>
              </form>

              <p style={{ textAlign: 'center', margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Patient ou proche ?{' '}
                <Link className="ax-link" href="/auth/sign-in" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Connexion par SMS</Link>
              </p>
            </div>
          </section>
        </div>
      </main>
    </AuthStandalone>
  );
}

export default StaffSignIn;
