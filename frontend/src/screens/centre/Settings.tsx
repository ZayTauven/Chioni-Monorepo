'use client';
/*
 * Chioni — /centre/parametres : le centre lui-même.
 *
 * Infos du centre (édition directeur seul, PATCH /centers/{pk}/), logo du
 * centre (directeur seul — multipart `file`, JPEG/PNG/WebP ≤ 2 Mo, jamais via
 * le PATCH JSON), badge KYC expliqué (statut read-only), et rappel du
 * sélecteur de centre pour les comptes multi-centres (déjà dans l'en-tête).
 * Après upload/suppression du logo, /auth/me/ est rafraîchi pour que la
 * sidebar l'affiche sans rechargement.
 */
import { useRef, useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useAuth } from '@/context/AuthContext';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { deleteCenterLogo, getCenter, updateCenter, uploadCenterLogo } from '@/lib/endpoints/centers';
import {
  CENTER_TYPE_LABELS,
  ISLAND_LABELS,
  KYC_BANNER_LEAD,
  KYC_CLOSED_RAIL,
  KYC_REASON_PRIVACY,
  KYC_REASON_TITLE,
  KYC_STATUS_LABELS,
  KYC_STILL_WORKS,
  UPLOAD_IMAGE_HINT,
  formatDate,
} from '@/lib/labels';
import type { CenterType, HealthCenter, Island } from '@/lib/types';
import { KycDocumentsCard } from './KycDocuments';
import {
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  FieldError,
  IconCheck,
  IconEdit,
  KYC_TONES,
  StatusBadge,
  toApiError,
  useAsync,
} from './shared';

/* ── logo du centre (directeur seul) ── */

function LogoCard({
  center,
  isDirector,
  onLogoChanged,
}: {
  center: HealthCenter;
  isDirector: boolean;
  onLogoChanged: (logo: string | null) => void;
}) {
  const { refreshMe } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const afterChange = async (logo: string | null) => {
    onLogoChanged(logo);
    try {
      await refreshMe(); // la sidebar lit le logo depuis /auth/me/
    } catch {
      /* la session est gérée par le garde d'auth */
    }
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const res = await uploadCenterLogo(center.id, file);
      await afterChange(res.logo);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteCenterLogo(center.id);
      await afterChange(null);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ax-card" role="region" aria-label="Logo du centre">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Logo</h2>
          <p className="ax-card__subtitle">
            {isDirector
              ? 'Affiché dans la barre latérale et sur les documents du centre.'
              : 'Modification réservée au directeur.'}
          </p>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
        {error && <ErrorAlert error={error} />}

        <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          {center.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
            <img
              src={center.logo}
              alt={`Logo de ${center.name}`}
              width={72}
              height={72}
              style={{ width: 72, height: 72, borderRadius: 'var(--ax-radius-md)', objectFit: 'cover', border: '1px solid var(--ax-border)' }}
            />
          ) : (
            <span
              aria-hidden="true"
              style={{ width: 72, height: 72, borderRadius: 'var(--ax-radius-md)', border: '1px dashed var(--ax-border-strong)', display: 'inline-grid', placeItems: 'center', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)' }}
            >
              Aucun logo
            </span>
          )}

          {isDirector && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                aria-label="Choisir un fichier de logo"
              />
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <button
                  type="button"
                  className="ax-btn ax-btn--secondary ax-btn--sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={busy}
                >
                  <span className="ax-btn__label">
                    {busy ? 'Envoi…' : center.logo ? 'Remplacer le logo' : 'Ajouter un logo'}
                  </span>
                </button>
                {center.logo && (
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => void onDelete()} disabled={busy}>
                    <span className="ax-btn__label">Supprimer</span>
                  </button>
                )}
              </div>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                {UPLOAD_IMAGE_HINT}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CenterForm({
  center,
  onCancel,
  onSaved,
}: {
  center: HealthCenter;
  onCancel: () => void;
  onSaved: (fresh: HealthCenter) => void;
}) {
  const [form, setForm] = useState({
    name: center.name,
    type: center.type,
    island: center.island,
    city: center.city,
    address: center.address,
    phone: center.phone,
    email: center.email,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await updateCenter(center.id, {
        name: form.name.trim(),
        type: form.type,
        island: form.island,
        city: form.city.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      onSaved(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}

      <div className="ax-field">
        <label className="ax-label" htmlFor="cs-name">Nom du centre</label>
        <input
          id="cs-name"
          type="text"
          className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <FieldError error={error} field="name" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
        <div className="ax-field">
          <label className="ax-label" htmlFor="cs-type">Type</label>
          <select id="cs-type" className="ax-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CenterType }))}>
            {(Object.keys(CENTER_TYPE_LABELS) as CenterType[]).map((t) => (
              <option key={t} value={t}>
                {CENTER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <FieldError error={error} field="type" />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="cs-island">Île</label>
          <select id="cs-island" className="ax-select" value={form.island} onChange={(e) => setForm((f) => ({ ...f, island: e.target.value as Island }))}>
            {(Object.keys(ISLAND_LABELS) as Island[]).map((i) => (
              <option key={i} value={i}>
                {ISLAND_LABELS[i]}
              </option>
            ))}
          </select>
          <FieldError error={error} field="island" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
        <div className="ax-field">
          <label className="ax-label" htmlFor="cs-city">Ville</label>
          <input id="cs-city" type="text" className="ax-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <FieldError error={error} field="city" />
        </div>
        <div className="ax-field">
          <label className="ax-label" htmlFor="cs-phone">Téléphone</label>
          <input
            id="cs-phone"
            type="tel"
            className={`ax-input${error?.fieldErrors.phone ? ' is-invalid' : ''}`}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+269…"
          />
          <FieldError error={error} field="phone" />
        </div>
      </div>

      <div className="ax-field">
        <label className="ax-label" htmlFor="cs-address">Adresse</label>
        <input id="cs-address" type="text" className="ax-input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        <FieldError error={error} field="address" />
      </div>

      <div className="ax-field">
        <label className="ax-label" htmlFor="cs-email">E-mail</label>
        <input
          id="cs-email"
          type="email"
          className={`ax-input${error?.fieldErrors.email ? ' is-invalid' : ''}`}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <FieldError error={error} field="email" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)' }}>
        <button type="button" className="ax-btn ax-btn--ghost" onClick={onCancel} disabled={saving}>
          Annuler
        </button>
        <button type="submit" className="ax-btn ax-btn--primary" disabled={saving}>
          <IconCheck />
          <span className="ax-btn__label">{saving ? 'Enregistrement…' : 'Enregistrer'}</span>
        </button>
      </div>
    </form>
  );
}

export function Settings() {
  const { centerId, roles, centers, switchCenter } = useCenter();
  // Multi-roles S2 : un directeur-médecin garde l'édition du centre.
  const isDirector = roles.includes('directeur');
  const [editing, setEditing] = useState(false);
  const [patched, setPatched] = useState<HealthCenter | null>(null);

  const centerState = useAsync(() => getCenter(centerId), [centerId]);
  const center = patched ?? centerState.data;

  return (
    <>
      <PageHead
        title="Mon centre"
        subtitle="Coordonnées de l'établissement et statut de vérification."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--7" role="region" aria-label="Coordonnées du centre">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Coordonnées</h2>
              {!isDirector && <p className="ax-card__subtitle">Modification réservée au directeur.</p>}
            </div>
            {isDirector && center && !editing && (
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setEditing(true)}>
                <IconEdit />
                <span className="ax-btn__label">Modifier</span>
              </button>
            )}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {centerState.loading && !center ? (
              <CardSkeleton lines={6} />
            ) : centerState.error && !center ? (
              <ErrorAlert error={centerState.error} onRetry={centerState.reload} />
            ) : center && editing ? (
              <CenterForm
                center={center}
                onCancel={() => setEditing(false)}
                onSaved={(fresh) => {
                  setPatched(fresh);
                  setEditing(false);
                }}
              />
            ) : center ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <DetailItem label="Nom">{center.name}</DetailItem>
                <DetailItem label="Type">{CENTER_TYPE_LABELS[center.type]}</DetailItem>
                <DetailItem label="Île">{ISLAND_LABELS[center.island]}</DetailItem>
                <DetailItem label="Ville">{center.city || '—'}</DetailItem>
                <DetailItem label="Adresse">{center.address || '—'}</DetailItem>
                <DetailItem label="Téléphone">{center.phone || '—'}</DetailItem>
                <DetailItem label="E-mail">{center.email || '—'}</DetailItem>
                <DetailItem label="Inscrit depuis">{formatDate(center.created_at)}</DetailItem>
              </div>
            ) : null}
          </div>
        </section>

        <div className="ax-col--5" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {center && (
            <LogoCard
              center={center}
              isDirector={isDirector}
              onLogoChanged={(logo) => setPatched({ ...center, logo })}
            />
          )}

          <section className="ax-card" role="region" aria-label="Vérification du centre">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Vérification (KYC)</h2>
              </div>
              {center && <StatusBadge tone={KYC_TONES[center.kyc_status]} label={KYC_STATUS_LABELS[center.kyc_status]} />}
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {center ? (
                <>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
                    {KYC_BANNER_LEAD[center.kyc_status]}
                  </p>

                  {/* S4 — le mot « suspendu » a un sens BORNÉ : ce qui continue
                      est dit avant ce qui s'arrête, pour ne jamais laisser
                      croire à une panne générale du centre. */}
                  {center.kyc_status !== 'actif' && (
                    <>
                      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                        {KYC_STILL_WORKS}
                      </p>
                      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                        {KYC_CLOSED_RAIL}
                      </p>
                    </>
                  )}

                  {/* Motif de la dernière décision — rendu au DIRECTEUR SEUL
                      par l'API (`null` pour tout autre rôle). Le titre et le
                      ton SUIVENT le statut : `kyc_reason` porte le motif de la
                      DERNIÈRE décision, y compris une activation — « Que
                      faire ? » en jaune sur une bonne nouvelle donnait à un
                      centre validé le sentiment d'être encore en faute. */}
                  {center.kyc_reason && (
                    <div
                      className={`ax-alert ax-alert--${center.kyc_status === 'actif' ? 'info' : 'warning'}`}
                      role="status"
                    >
                      <div className="ax-alert__content">
                        <p className="ax-alert__title">{KYC_REASON_TITLE[center.kyc_status]}</p>
                        <p className="ax-alert__message">{center.kyc_reason}</p>
                        {center.kyc_updated_at && (
                          <p className="ax-alert__message" style={{ fontSize: 'var(--ax-text-xs)' }}>
                            Décision du {formatDate(center.kyc_updated_at)}. {KYC_REASON_PRIVACY}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* `--ax-text-subtle` (#6E7A92) tombe à 4,3:1 sur la surface
                      des cartes : sous AA. Une phrase qui explique une règle
                      n'est pas une légende décorative — elle passe en muted. */}
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
                    Ce statut ne se modifie pas depuis l&apos;application : seule l&apos;équipe
                    Chioni le change, après examen de vos pièces justificatives.
                  </p>
                </>
              ) : (
                <CardSkeleton lines={3} />
              )}
            </div>
          </section>

          {/* S4 — pièces justificatives : DIRECTEUR SEUL, jamais montée pour un
              autre rôle (fetch compris — l'API répond 403). */}
          {isDirector && <KycDocumentsCard />}

          {centers.length > 1 && (
            <section className="ax-card" role="region" aria-label="Changer de centre">
              <div className="ax-card__header">
                <div className="ax-card__titles">
                  <h2 className="ax-card__title">Mes centres</h2>
                  <p className="ax-card__subtitle">Vous travaillez dans plusieurs centres — le sélecteur est aussi dans l&apos;en-tête.</p>
                </div>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0 }}>
                <ul className="ax-list ax-list--compact">
                  {/* Centres dédupliqués (multi-roles S2) — un centre où l'on
                      cumule deux rôles n'apparaît qu'une fois. */}
                  {centers.map((c) => (
                    <li key={c.id} className="ax-list__row">
                      <span className="ax-list__content">
                        <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{c.name}</span>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                          {c.city} · {CENTER_TYPE_LABELS[c.type]}
                        </span>
                      </span>
                      <span className="ax-list__trailing">
                        {c.id === centerId ? (
                          <StatusBadge tone="accent" label="Centre actuel" />
                        ) : (
                          <button
                            type="button"
                            className="ax-btn ax-btn--secondary ax-btn--sm"
                            onClick={() => {
                              switchCenter(c.id);
                              setPatched(null);
                              setEditing(false);
                            }}
                          >
                            <span className="ax-btn__label">Basculer</span>
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default Settings;
