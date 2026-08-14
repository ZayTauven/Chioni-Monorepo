'use client';
/*
 * Chioni — /centre/profil/parametres : modification du profil.
 *
 * Adapté de l'écran « Profile Settings » de Vireo
 * (src/screens/pages/ProfileSettings.tsx) : on garde la carte « Profile
 * photo », la carte « Personal information » et la barre d'enregistrement
 * collante pilotée par l'état dirty/saved. Écartés faute de backend : le rail
 * d'onglets (Security / Notifications / Billing) et les champs sans données
 * réelles (username, email, bio, timezone, langue).
 *
 * API : photo → POST|DELETE /auth/me/avatar/ (multipart, toute casquette,
 * throttle `uploads` 20/h → 429 affiché en français) ; nom d'affichage →
 * PATCH /auth/me/ (prénom/nom SEULEMENT — le téléphone est le pivot
 * d'identité). Après chaque succès, /auth/me/ est rafraîchi pour propager
 * l'avatar au header et aux annuaires.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/api';
import { deleteAvatar, updateMe, uploadAvatar } from '@/lib/endpoints/auth';
import { UPLOAD_IMAGE_HINT, uploadThrottled } from '@/lib/labels';
import { MyDataCard } from '@/screens/lite/MyDataCard';
import { ErrorAlert, FieldError, IconArrowLeft, IconCheck, initialsOf, toApiError } from './shared';

/** 429 du scope `uploads` (20/h) : remplacer le message anglais de DRF. */
function toUploadError(err: unknown): ApiError {
  const e = toApiError(err);
  if (e.status === 429) return new ApiError(429, [uploadThrottled(e.retryAfterSeconds)]);
  return e;
}

export function ProfileSettings() {
  const { me, refreshMe } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(me?.first_name ?? '');
  const [lastName, setLastName] = useState(me?.last_name ?? '');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<ApiError | null>(null);

  const [busyAvatar, setBusyAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<ApiError | null>(null);

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const displayName = `${firstName} ${lastName}`.trim() || (me?.phone ?? '');

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };

  const discard = () => {
    setFirstName(me?.first_name ?? '');
    setLastName(me?.last_name ?? '');
    setNameError(null);
    setDirty(false);
  };

  const save = async () => {
    setSaving(true);
    setNameError(null);
    try {
      await updateMe({ first_name: firstName.trim(), last_name: lastName.trim() });
      await refreshMe();
      setDirty(false);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setNameError(toApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusyAvatar(true);
    setAvatarError(null);
    try {
      await uploadAvatar(file);
      await refreshMe();
    } catch (err) {
      setAvatarError(toUploadError(err));
    } finally {
      setBusyAvatar(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDeleteAvatar = async () => {
    setBusyAvatar(true);
    setAvatarError(null);
    try {
      await deleteAvatar();
      await refreshMe();
    } catch (err) {
      setAvatarError(toUploadError(err));
    } finally {
      setBusyAvatar(false);
    }
  };

  return (
    <>
      <PageHead
        title="Paramètres du profil"
        subtitle="Votre photo, votre nom d'affichage — communs à toutes vos casquettes — et vos droits sur vos données."
        actions={
          <>
            {dirty && (
              <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-warning-700, var(--ax-warning-500))', fontSize: 'var(--ax-text-xs)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-warning-500)' }} />
                Modifications non enregistrées
              </span>
            )}
            <Link href="/centre/profil" className="ax-btn ax-btn--secondary">
              <IconArrowLeft />
              <span className="ax-btn__label">Mon profil</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* PHOTO DE PROFIL (asset Vireo « Profile photo » — actions immédiates) */}
          <section className="ax-card" role="region" aria-label="Photo de profil">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Photo de profil</h2>
                <p className="ax-card__subtitle">{UPLOAD_IMAGE_HINT}. Un carré rend mieux.</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              {avatarError && <ErrorAlert error={avatarError} />}
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)' }}>
                {me?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
                  <img
                    src={me.avatar}
                    alt={`Photo de profil de ${displayName}`}
                    width={72}
                    height={72}
                    style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--ax-border)' }}
                  />
                ) : (
                  <span
                    className="ax-avatar ax-avatar--xl ax-avatar--ringed"
                    aria-hidden="true"
                    style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}
                  >
                    <span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-lg)' }}>
                      {initialsOf(displayName)}
                    </span>
                  </span>
                )}
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                    aria-label="Choisir une photo de profil"
                  />
                  <button
                    type="button"
                    className="ax-btn ax-btn--secondary"
                    onClick={() => inputRef.current?.click()}
                    disabled={busyAvatar}
                  >
                    <span className="ax-btn__label">
                      {busyAvatar ? 'Envoi…' : me?.avatar ? 'Remplacer la photo' : 'Ajouter une photo'}
                    </span>
                  </button>
                  {me?.avatar && (
                    <button type="button" className="ax-btn ax-btn--ghost" onClick={() => void onDeleteAvatar()} disabled={busyAvatar}>
                      <span className="ax-btn__label">Supprimer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* IDENTITÉ (asset Vireo « Personal information », réduit au réel) */}
          <section className="ax-card" role="region" aria-label="Nom d'affichage">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Nom d&rsquo;affichage</h2>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <form
                id="profile-name-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
              >
                {nameError && nameError.messages.length > 0 && <ErrorAlert error={nameError} />}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="ps-first">Prénom</label>
                    <input
                      id="ps-first"
                      type="text"
                      className={`ax-input${nameError?.fieldErrors.first_name ? ' is-invalid' : ''}`}
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        touch();
                      }}
                    />
                    <FieldError error={nameError} field="first_name" />
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="ps-last">Nom</label>
                    <input
                      id="ps-last"
                      type="text"
                      className={`ax-input${nameError?.fieldErrors.last_name ? ' is-invalid' : ''}`}
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        touch();
                      }}
                    />
                    <FieldError error={nameError} field="last_name" />
                  </div>
                </div>
                <div className="ax-field">
                  <span className="ax-label">Téléphone</span>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                    {me?.phone}
                  </span>
                  <span className="ax-field__message">
                    Votre numéro est votre identifiant de connexion — il ne se modifie pas ici.
                  </span>
                </div>
              </form>
            </div>
          </section>

          {/* BARRE D'ENREGISTREMENT COLLANTE (asset Vireo, état dirty/saved) */}
          <div style={{ position: 'sticky', bottom: 'var(--ax-space-4)', zIndex: 5 }}>
            <div className="ax-card" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', boxShadow: 'var(--ax-shadow-md)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} role="status">
                  {saved ? (
                    <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-success-700, var(--ax-success-500))' }}>
                      <IconCheck className="" />
                      Profil mis à jour.
                    </span>
                  ) : dirty ? (
                    <span>Votre nom d&rsquo;affichage a changé — pensez à enregistrer.</span>
                  ) : (
                    <span>Tout est à jour.</span>
                  )}
                </span>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <button type="button" className="ax-btn ax-btn--ghost" disabled={!dirty || saving} onClick={discard}>
                    Annuler les modifications
                  </button>
                  <button type="submit" form="profile-name-form" className="ax-btn ax-btn--primary" disabled={!dirty || saving}>
                    <IconCheck />
                    <span className="ax-btn__label">{saving ? 'Enregistrement…' : 'Enregistrer'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MES DROITS (S4, ADR 0017 décision 7) — le MÊME composant que les
            espaces patient et tuteur, en registre `staff` : les droits RGPD
            appartiennent à la personne, pas à une casquette, et aucun rôle ne
            garde cette carte (une secrétaire y a droit comme un directeur).
            Rail droit plutôt que sous le formulaire : la colonne de gauche se
            termine par la barre d'enregistrement collante, qui flotterait
            par-dessus toute carte placée après elle dans la même colonne. */}
        <div className="ax-col--4" style={{ alignSelf: 'start' }}>
          <MyDataCard audience="staff" />
        </div>
      </div>
    </>
  );
}

export default ProfileSettings;
