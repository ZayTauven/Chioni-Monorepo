'use client';
/*
 * Chioni — /patient/profil : edit my identity (PATCH /patients/me/).
 *
 * Reached from the home card, outside the tab bar. The phone is displayed
 * but locked: it is the account key (« C'est votre clé d'accès »). Field
 * errors from the API land under their field.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getPatientMe, updatePatientMe } from '@/lib/endpoints/patients';
import { SEX_LABELS } from '@/lib/labels';
import { ApiError } from '@/lib/api';
import type { PatientMe, Sex } from '@/lib/types';
import { ErrorAlert, SkeletonCards, SuccessAlert } from './ui';

const SEX_OPTIONS = Object.entries(SEX_LABELS) as [Sex, string][];

export function PatientProfil() {
  const { refreshMe } = useAuth();
  const [profile, setProfile] = useState<PatientMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<Sex>('');
  const [city, setCity] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getPatientMe()
      .then((me) => {
        setProfile(me);
        setFirstName(me.first_name);
        setLastName(me.last_name);
        setBirthDate(me.birth_date ?? '');
        setSex(me.sex);
        setCity(me.city);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    setSaved(false);
    try {
      const updated = await updatePatientMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate || null,
        sex,
        city: city.trim(),
      });
      setProfile(updated);
      setSaved(true);
      // Best effort: the header greets by name — keep it in sync.
      try {
        await refreshMe();
      } catch {
        /* non-blocking */
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        if (err.messages.length > 0 || Object.keys(err.fieldErrors).length === 0) {
          setSaveError(err);
        }
      } else {
        setSaveError(err);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonCards count={2} />;
  if (loadError != null || !profile)
    return (
      <div className="pat-stack">
        <Link href="/patient" className="ax-link">← Accueil</Link>
        <ErrorAlert error={loadError ?? new Error()} onRetry={load} />
      </div>
    );

  const fieldError = (name: string) => fieldErrors[name]?.[0] ?? '';

  return (
    <div className="pat-stack">
      <Link href="/patient" className="ax-link">← Accueil</Link>

      <header>
        <h2 className="pat-hello" style={{ fontSize: 'var(--ax-text-xl)' }}>Mes informations</h2>
      </header>

      {saved && <SuccessAlert message="Vos informations ont été enregistrées." />}
      {saveError != null && <ErrorAlert error={saveError} />}

      <section className="ax-card" role="region" aria-label="Mes informations">
        <form className="ax-card__body pat-gate__body" onSubmit={submit} noValidate>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-first">Prénom</label>
            <input
              id="pf-first"
              type="text"
              className={`ax-input ax-input--lg${fieldError('first_name') ? ' is-invalid' : ''}`}
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={fieldError('first_name') ? 'true' : 'false'}
            />
            {fieldError('first_name') && (
              <p className="ax-field__message ax-field__message--error">{fieldError('first_name')}</p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-last">Nom</label>
            <input
              id="pf-last"
              type="text"
              className={`ax-input ax-input--lg${fieldError('last_name') ? ' is-invalid' : ''}`}
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              aria-invalid={fieldError('last_name') ? 'true' : 'false'}
            />
            {fieldError('last_name') && (
              <p className="ax-field__message ax-field__message--error">{fieldError('last_name')}</p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-birth">Date de naissance</label>
            <input
              id="pf-birth"
              type="date"
              className={`ax-input ax-input--lg${fieldError('birth_date') ? ' is-invalid' : ''}`}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              aria-invalid={fieldError('birth_date') ? 'true' : 'false'}
            />
            {fieldError('birth_date') && (
              <p className="ax-field__message ax-field__message--error">{fieldError('birth_date')}</p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-sex">Sexe</label>
            <select
              id="pf-sex"
              className="ax-select ax-select--lg"
              value={sex}
              onChange={(e) => setSex(e.target.value as Sex)}
            >
              {SEX_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-city">Ville</label>
            <input
              id="pf-city"
              type="text"
              className={`ax-input ax-input--lg${fieldError('city') ? ' is-invalid' : ''}`}
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-invalid={fieldError('city') ? 'true' : 'false'}
            />
            {fieldError('city') && (
              <p className="ax-field__message ax-field__message--error">{fieldError('city')}</p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-phone">Numéro de téléphone</label>
            <input
              id="pf-phone"
              type="tel"
              className="ax-input ax-input--lg"
              value={profile.phone ?? ''}
              readOnly
              style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)' }}
              aria-describedby="pf-phone-msg"
            />
            <p id="pf-phone-msg" className="ax-field__message">
              C&rsquo;est votre clé d&rsquo;accès. Il ne peut pas être modifié ici.
            </p>
          </div>

          <button
            type="submit"
            className={`ax-btn ax-btn--primary ax-btn--lg ax-btn--block${saving ? ' is-loading' : ''}`}
            disabled={saving}
            aria-busy={saving}
          >
            <span className="ax-btn__spinner" aria-hidden="true"></span>
            <span className="ax-btn__label">Enregistrer</span>
          </button>
        </form>
      </section>
    </div>
  );
}

export default PatientProfil;
