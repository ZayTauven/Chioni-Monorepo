'use client';
/*
 * Chioni — /patient/profil : edit my identity (PATCH /patients/me/).
 *
 * Reached from the home card, outside the tab bar. The phone is displayed
 * but locked: it is the account key (« C'est votre clé d'accès »). Field
 * errors from the API land under their field. S3: extended identity fields
 * (address, second phone, ID number, emergency contact) and the read-only
 * « Mes assurances » card (desk-entered by the centers).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getPatientMe, listMyInsurances, updatePatientMe } from '@/lib/endpoints/patients';
import { SEX_LABELS, formatDate } from '@/lib/labels';
import { ApiError } from '@/lib/api';
import type { PatientMe, Sex } from '@/lib/types';
import { MyDataCard } from '@/screens/lite/MyDataCard';
import { useLoadMore } from './useLoadMore';
import { ErrorAlert, LoadMoreButton, SkeletonCards, SuccessAlert } from './ui';

const SEX_OPTIONS = Object.entries(SEX_LABELS) as [Sex, string][];

/* ── S3 — « Mes assurances » (lecture seule : la saisie est au guichet) ── */

function InsurancesCard() {
  const list = useLoadMore(listMyInsurances);

  return (
    <section className="ax-card" role="region" aria-label="Mes assurances">
      <div className="ax-card__body pat-gate__body">
        <h3 className="pat-row__title" style={{ margin: 0 }}>Mes assurances</h3>
        {list.loading ? (
          <div className="pat-skeleton-body" aria-hidden="true">
            <div className="ax-skeleton ax-skeleton--line" style={{ width: '60%' }} />
            <div className="ax-skeleton ax-skeleton--line" style={{ width: '40%' }} />
          </div>
        ) : list.error != null && list.items.length === 0 ? (
          <ErrorAlert error={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <p className="pat-row__meta" style={{ margin: 0 }}>
            Aucune assurance pour le moment. Si vous avez une mutuelle ou une assurance,
            présentez votre carte au centre de santé&nbsp;: il l&apos;enregistrera ici.
          </p>
        ) : (
          <>
            <ul className="pat-lines">
              {list.items.map((ins) => (
                <li key={ins.id}>
                  <span className="pat-line__label">
                    <span className="pat-line__name">{ins.insurer_name}</span>
                    <span className="pat-line__cat">
                      N° {ins.member_number}
                      {ins.valid_until ? ` · valable jusqu'au ${formatDate(ins.valid_until)}` : ''}
                      {ins.is_active ? '' : ' · plus active'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="pat-row__meta" style={{ margin: 0, fontSize: 'var(--ax-text-xs)' }}>
              Ces informations sont enregistrées par les centres de santé.
            </p>
            <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </>
        )}
      </div>
    </section>
  );
}

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
  const [address, setAddress] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecRelationship, setEcRelationship] = useState('');

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
        setAddress(me.address);
        setPhoneAlt(me.phone_alt ?? '');
        setNationalId(me.national_id);
        setEcName(me.emergency_contact_name);
        setEcPhone(me.emergency_contact_phone ?? '');
        setEcRelationship(me.emergency_contact_relationship);
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
        address: address.trim(),
        phone_alt: phoneAlt.trim(),
        national_id: nationalId.trim(),
        emergency_contact_name: ecName.trim(),
        emergency_contact_phone: ecPhone.trim(),
        emergency_contact_relationship: ecRelationship.trim(),
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
            <label className="ax-label" htmlFor="pf-address">Adresse</label>
            <input
              id="pf-address"
              type="text"
              className={`ax-input ax-input--lg${fieldError('address') ? ' is-invalid' : ''}`}
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-invalid={fieldError('address') ? 'true' : 'false'}
            />
            {fieldError('address') && (
              <p className="ax-field__message ax-field__message--error">{fieldError('address')}</p>
            )}
          </div>

          {/* La clé d'accès juste avant le second numéro : lue ici, elle ne
              peut plus être confondue avec le téléphone de la personne à
              prévenir (elle fermait le formulaire auparavant). */}
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

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-phone-alt">Deuxième téléphone</label>
            <input
              id="pf-phone-alt"
              type="tel"
              className={`ax-input ax-input--lg${fieldError('phone_alt') ? ' is-invalid' : ''}`}
              value={phoneAlt}
              onChange={(e) => setPhoneAlt(e.target.value)}
              placeholder="+269…"
              aria-invalid={fieldError('phone_alt') ? 'true' : 'false'}
              aria-describedby="pf-phone-alt-msg"
            />
            {fieldError('phone_alt') ? (
              <p id="pf-phone-alt-msg" className="ax-field__message ax-field__message--error">{fieldError('phone_alt')}</p>
            ) : (
              <p id="pf-phone-alt-msg" className="ax-field__message">
                Un autre numéro où vous joindre, si vous en avez un.
              </p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-national-id">Numéro d&apos;identité</label>
            <input
              id="pf-national-id"
              type="text"
              className={`ax-input ax-input--lg${fieldError('national_id') ? ' is-invalid' : ''}`}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              aria-invalid={fieldError('national_id') ? 'true' : 'false'}
              aria-describedby="pf-national-id-msg"
            />
            {fieldError('national_id') ? (
              <p id="pf-national-id-msg" className="ax-field__message ax-field__message--error">{fieldError('national_id')}</p>
            ) : (
              <p id="pf-national-id-msg" className="ax-field__message">
                Carte d&apos;identité, passeport ou carnet — comme écrit sur le document.
              </p>
            )}
          </div>

          <h3 className="pat-section" style={{ margin: 0 }}>Personne à prévenir en cas d&apos;urgence</h3>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-ec-name">Son nom</label>
            <input
              id="pf-ec-name"
              type="text"
              className={`ax-input ax-input--lg${fieldError('emergency_contact_name') ? ' is-invalid' : ''}`}
              value={ecName}
              onChange={(e) => setEcName(e.target.value)}
              aria-invalid={fieldError('emergency_contact_name') ? 'true' : 'false'}
            />
            {fieldError('emergency_contact_name') && (
              <p className="ax-field__message ax-field__message--error">
                {fieldError('emergency_contact_name')}
              </p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-ec-phone">Son téléphone</label>
            <input
              id="pf-ec-phone"
              type="tel"
              className={`ax-input ax-input--lg${fieldError('emergency_contact_phone') ? ' is-invalid' : ''}`}
              value={ecPhone}
              onChange={(e) => setEcPhone(e.target.value)}
              placeholder="+269…"
              aria-invalid={fieldError('emergency_contact_phone') ? 'true' : 'false'}
            />
            {fieldError('emergency_contact_phone') && (
              <p className="ax-field__message ax-field__message--error">
                {fieldError('emergency_contact_phone')}
              </p>
            )}
          </div>

          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-ec-rel">Qui est-ce pour vous&nbsp;?</label>
            <input
              id="pf-ec-rel"
              type="text"
              className={`ax-input ax-input--lg${fieldError('emergency_contact_relationship') ? ' is-invalid' : ''}`}
              value={ecRelationship}
              onChange={(e) => setEcRelationship(e.target.value)}
              placeholder="ex. ma mère, mon frère…"
              aria-invalid={fieldError('emergency_contact_relationship') ? 'true' : 'false'}
            />
            {fieldError('emergency_contact_relationship') && (
              <p className="ax-field__message ax-field__message--error">
                {fieldError('emergency_contact_relationship')}
              </p>
            )}
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

      <InsurancesCard />

      {/* S4 (ADR 0017 décision 7) — mes droits sur mes données : copie et
          demande de suppression. Partagée avec l'espace tuteur. */}
      <MyDataCard />
    </div>
  );
}

export default PatientProfil;
