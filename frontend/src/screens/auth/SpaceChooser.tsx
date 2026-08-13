'use client';
/*
 * Chioni — space chooser + orientation (route /espaces).
 *
 * Two modes from the same screen:
 * - the user has hats → one interactive card per available space;
 * - the user has NO hat yet (fresh OTP account) → orientation: create a
 *   patient profile (porte B) or a guardian profile, with a short form that
 *   unfolds inside the chosen card. Simple words, one action per screen.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthStandalone, OffappTools, BrandCentered } from './authShared';
import { homeOfSpace, spacesOf, useAuth } from '@/context/AuthContext';
import { createPatientMe } from '@/lib/endpoints/patients';
import { createGuardianProfile } from '@/lib/endpoints/guardian';
import { ApiError } from '@/lib/api';
import type { Sex } from '@/lib/types';

const COUNTRIES: Array<[string, string]> = [
  ['FR', 'France'],
  ['BE', 'Belgique'],
  ['CH', 'Suisse'],
  ['DE', 'Allemagne'],
  ['IT', 'Italie'],
  ['NL', 'Pays-Bas'],
  ['GB', 'Royaume-Uni'],
  ['ES', 'Espagne'],
  ['CA', 'Canada'],
  ['US', 'États-Unis'],
  ['AE', 'Émirats arabes unis'],
  ['SA', 'Arabie saoudite'],
  ['MG', 'Madagascar'],
  ['KM', 'Comores'],
];

const cardTitleStyle = {
  margin: 0,
  fontFamily: 'var(--ax-font-display)',
  fontSize: 'var(--ax-text-md)',
  fontWeight: 'var(--ax-weight-semibold)',
  color: 'var(--ax-text-strong)',
} as const;
const cardTextStyle = {
  margin: 0,
  fontSize: 'var(--ax-text-sm)',
  color: 'var(--ax-text-muted)',
  lineHeight: 1.5,
} as const;

function ErrorAlert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="ax-alert ax-alert--danger" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
      <div className="ax-alert__content"><p className="ax-alert__message" style={{ color: 'var(--ax-danger-500)' }}>{message}</p></div>
    </div>
  );
}

function firstApiMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const fieldMsg = Object.values(err.fieldErrors)[0]?.[0];
    return err.messages[0] ?? fieldMsg ?? fallback;
  }
  return fallback;
}

export function SpaceChooser() {
  const router = useRouter();
  const { me, status, refreshMe } = useAuth();
  const spaces = spacesOf(me);
  const [openForm, setOpenForm] = useState<'patient' | 'tuteur' | null>(null);

  // Patient form state.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<Sex>('');
  const [city, setCity] = useState('');
  // Guardian form state.
  const [country, setCountry] = useState('FR');
  const [currency, setCurrency] = useState<'EUR' | 'KMF'>('EUR');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (status === 'anonymous') router.replace('/auth/sign-in');
  }, [status, router]);

  if (status !== 'authenticated' || !me) {
    return (
      <AuthStandalone>
        <main className="ax-center" id="ax-main" style={{ minHeight: '60dvh' }} role="status" aria-label="Chargement">
          <span className="ax-spinner ax-spinner--lg" aria-hidden="true"><span className="ax-spinner__glyph"></span></span>
        </main>
      </AuthStandalone>
    );
  }

  async function submitPatient(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Le prénom et le nom sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      await createPatientMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate || undefined,
        sex,
        city: city.trim() || undefined,
      });
      await refreshMe();
      router.push('/patient');
    } catch (err) {
      setSaving(false);
      setFormError(firstApiMessage(err, 'Impossible de créer votre profil. Réessayez.'));
    }
  }

  async function submitGuardian(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await createGuardianProfile({ country_of_residence: country, preferred_currency: currency });
      await refreshMe();
      router.push('/tuteur');
    } catch (err) {
      setSaving(false);
      setFormError(firstApiMessage(err, 'Impossible de créer votre profil. Réessayez.'));
    }
  }

  const hasSpaces = spaces.length > 0;
  const centerNames = (me.staff_memberships ?? []).map((m) => m.center.name);

  return (
    <AuthStandalone>
      <OffappTools style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-5)', zIndex: 5 }} />

      <main className="ax-center" id="ax-main" style={{ inlineSize: '100%', maxInlineSize: 480, position: 'relative', zIndex: 1, paddingBlock: 'var(--ax-space-8)' }}>
        <div style={{ inlineSize: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <BrandCentered />

          <header style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
            <h1 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', letterSpacing: '-.015em' }}>
              {hasSpaces ? 'Choisissez votre espace' : 'Bienvenue sur Chioni'}
            </h1>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              {hasSpaces
                ? 'Vous pourrez changer d’espace à tout moment depuis le menu.'
                : 'Dites-nous qui vous êtes pour commencer.'}
            </p>
          </header>

          {hasSpaces ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {spaces.includes('centre') && (
                <Link href={homeOfSpace('centre')} className="ax-card ax-card--interactive" style={{ textDecoration: 'none' }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                    <h2 style={cardTitleStyle}>Mon centre de santé</h2>
                    <p style={cardTextStyle}>
                      {centerNames.length > 0 ? centerNames.join(' · ') : 'Gestion du centre'}
                    </p>
                  </div>
                </Link>
              )}
              {spaces.includes('patient') && (
                <Link href={homeOfSpace('patient')} className="ax-card ax-card--interactive" style={{ textDecoration: 'none' }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                    <h2 style={cardTitleStyle}>Mon espace patient</h2>
                    <p style={cardTextStyle}>Mon carnet de santé, mes paiements et mes proches.</p>
                  </div>
                </Link>
              )}
              {spaces.includes('tuteur') && (
                <Link href={homeOfSpace('tuteur')} className="ax-card ax-card--interactive" style={{ textDecoration: 'none' }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                    <h2 style={cardTitleStyle}>Mon espace tuteur</h2>
                    <p style={cardTextStyle}>Soutenir mes proches en payant leurs soins directement au centre.</p>
                  </div>
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {/* ── Orientation card 1 : patient ── */}
              <section className="ax-card" aria-label="Je suis un patient">
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                    <h2 style={cardTitleStyle}>Je suis un patient</h2>
                    <p style={cardTextStyle}>Je me soigne aux Comores et je veux suivre mon carnet et mes paiements.</p>
                  </div>
                  {openForm === 'patient' ? (
                    <form onSubmit={submitPatient} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }} noValidate>
                      <ErrorAlert message={formError} />
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="pt-first">Prénom *</label>
                        <input id="pt-first" type="text" className="ax-input" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                      </div>
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="pt-last">Nom *</label>
                        <input id="pt-last" type="text" className="ax-input" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                      </div>
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="pt-birth">Date de naissance</label>
                        <input id="pt-birth" type="date" className="ax-input" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                      </div>
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="pt-sex">Sexe</label>
                        <select id="pt-sex" className="ax-input" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                          <option value="">Je préfère ne pas dire</option>
                          <option value="f">Féminin</option>
                          <option value="m">Masculin</option>
                        </select>
                      </div>
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="pt-city">Ville</label>
                        <input id="pt-city" type="text" className="ax-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Moroni" />
                      </div>
                      <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`} disabled={saving} aria-busy={saving}>
                        <span className="ax-btn__spinner" aria-hidden="true"></span>
                        <span className="ax-btn__label">Créer mon espace patient</span>
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block" onClick={() => { setOpenForm('patient'); setFormError(''); }}>
                      <span className="ax-btn__label">Continuer</span>
                    </button>
                  )}
                </div>
              </section>

              {/* ── Orientation card 2 : guardian ── */}
              <section className="ax-card" aria-label="Je soutiens un proche depuis l'étranger">
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                    <h2 style={cardTitleStyle}>Je soutiens un proche depuis l&rsquo;étranger</h2>
                    <p style={cardTextStyle}>Je veux payer les soins d&rsquo;un proche directement au centre de santé, avec un reçu à chaque fois.</p>
                  </div>
                  {openForm === 'tuteur' ? (
                    <form onSubmit={submitGuardian} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }} noValidate>
                      <ErrorAlert message={formError} />
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="gd-country">Pays de résidence</label>
                        <select id="gd-country" className="ax-input" value={country} onChange={(e) => setCountry(e.target.value)}>
                          {COUNTRIES.map(([code, name]) => (
                            <option key={code} value={code}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="ax-field">
                        <label className="ax-label" htmlFor="gd-currency">Devise de paiement</label>
                        <select id="gd-currency" className="ax-input" value={currency} onChange={(e) => setCurrency(e.target.value as 'EUR' | 'KMF')}>
                          <option value="EUR">Euro (€)</option>
                          <option value="KMF">Franc comorien (KMF)</option>
                        </select>
                      </div>
                      <button type="submit" className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`} disabled={saving} aria-busy={saving}>
                        <span className="ax-btn__spinner" aria-hidden="true"></span>
                        <span className="ax-btn__label">Créer mon espace tuteur</span>
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--lg ax-btn--block" onClick={() => { setOpenForm('tuteur'); setFormError(''); }}>
                      <span className="ax-btn__label">Continuer</span>
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AuthStandalone>
  );
}

export default SpaceChooser;
