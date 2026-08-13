'use client';
/*
 * Chioni — « Mon profil » (espace centre, ouvert depuis le menu du compte).
 *
 * Photo de profil (POST|DELETE /auth/me/avatar/ — multipart `file`,
 * JPEG/PNG/WebP ≤ 2 Mo, valable pour TOUTE casquette) et nom d'affichage
 * (PATCH /auth/me/ — prénom/nom UNIQUEMENT ; le téléphone est le pivot
 * d'identité, il ne se modifie pas ici). Après chaque changement, /auth/me/
 * est rafraîchi pour propager l'avatar au header et aux annuaires.
 */
import { useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { ApiError } from '@/lib/api';
import { deleteAvatar, updateMe, uploadAvatar } from '@/lib/endpoints/auth';
import { ErrorAlert, FieldError, IconCheck, Modal, toApiError } from './shared';

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { me, refreshMe } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(me?.first_name ?? '');
  const [lastName, setLastName] = useState(me?.last_name ?? '');
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [avatarError, setAvatarError] = useState<ApiError | null>(null);
  const [nameError, setNameError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusyAvatar(true);
    setAvatarError(null);
    try {
      await uploadAvatar(file);
      await refreshMe();
    } catch (err) {
      setAvatarError(toApiError(err));
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
      setAvatarError(toApiError(err));
    } finally {
      setBusyAvatar(false);
    }
  };

  const onSaveName = async () => {
    setSavingName(true);
    setNameError(null);
    setSaved(false);
    try {
      await updateMe({ first_name: firstName.trim(), last_name: lastName.trim() });
      await refreshMe();
      setSaved(true);
    } catch (err) {
      setNameError(toApiError(err));
    } finally {
      setSavingName(false);
    }
  };

  const displayName = `${firstName} ${lastName}`.trim() || (me?.phone ?? '');

  return (
    <Modal title="Mon profil" onClose={onClose} width={480}>
      {/* Photo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
        {avatarError && <ErrorAlert error={avatarError} />}
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
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
              aria-hidden="true"
              style={{ width: 72, height: 72, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', fontWeight: 600, fontSize: 'var(--ax-text-lg)' }}
            >
              {displayName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('') || '·'}
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              aria-label="Choisir une photo de profil"
            />
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <button
                type="button"
                className="ax-btn ax-btn--secondary ax-btn--sm"
                onClick={() => inputRef.current?.click()}
                disabled={busyAvatar}
              >
                <span className="ax-btn__label">
                  {busyAvatar ? 'Envoi…' : me?.avatar ? 'Remplacer la photo' : 'Ajouter une photo'}
                </span>
              </button>
              {me?.avatar && (
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => void onDeleteAvatar()} disabled={busyAvatar}>
                  <span className="ax-btn__label">Supprimer</span>
                </button>
              )}
            </div>
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              JPEG, PNG ou WebP — 2 Mo maximum.
            </span>
          </div>
        </div>
      </div>

      <hr className="ax-divider" aria-hidden="true" style={{ margin: 0 }} />

      {/* Nom d'affichage */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSaveName();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {nameError && nameError.messages.length > 0 && <ErrorAlert error={nameError} />}
        {saved && (
          <div className="ax-alert ax-alert--success" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__message">Profil mis à jour.</p>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-first">Prénom</label>
            <input
              id="pf-first"
              type="text"
              className={`ax-input${nameError?.fieldErrors.first_name ? ' is-invalid' : ''}`}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <FieldError error={nameError} field="first_name" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pf-last">Nom</label>
            <input
              id="pf-last"
              type="text"
              className={`ax-input${nameError?.fieldErrors.last_name ? ' is-invalid' : ''}`}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="ax-btn ax-btn--primary" disabled={savingName}>
            <IconCheck />
            <span className="ax-btn__label">{savingName ? 'Enregistrement…' : 'Enregistrer'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default ProfileDialog;
