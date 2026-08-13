'use client';
/*
 * Chioni — /centre/parametres : le centre lui-même.
 *
 * Infos du centre (édition directeur seul, PATCH /centers/{pk}/), badge KYC
 * expliqué (vérification par l'équipe Chioni, statut read-only), et rappel du
 * sélecteur de centre pour les comptes multi-centres (déjà dans l'en-tête).
 */
import { useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { getCenter, updateCenter } from '@/lib/endpoints/centers';
import {
  CENTER_TYPE_LABELS,
  ISLAND_LABELS,
  KYC_STATUS_LABELS,
  formatDate,
} from '@/lib/labels';
import type { CenterType, HealthCenter, Island } from '@/lib/types';
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
  const { centerId, role, memberships, switchCenter } = useCenter();
  const isDirector = role === 'directeur';
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
          <section className="ax-card" role="region" aria-label="Vérification du centre">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Vérification (KYC)</h2>
              </div>
              {center && <StatusBadge tone={KYC_TONES[center.kyc_status]} label={KYC_STATUS_LABELS[center.kyc_status]} />}
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {center ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>
                  {center.kyc_status === 'actif'
                    ? 'Votre centre est vérifié : les paiements de la diaspora sont encaissés directement par le centre, en KMF, avec reçu pour chaque franc.'
                    : center.kyc_status === 'en_attente'
                      ? 'La vérification de votre centre par l’équipe Chioni est en cours. Tant qu’elle n’est pas terminée, les demandes de paiement ne peuvent pas être encaissées. Ce statut ne se modifie pas depuis l’application.'
                      : 'Les encaissements de votre centre sont suspendus. Contactez l’équipe Chioni pour comprendre la situation et la régulariser. Ce statut ne se modifie pas depuis l’application.'}
                </p>
              ) : (
                <CardSkeleton lines={3} />
              )}
            </div>
          </section>

          {memberships.length > 1 && (
            <section className="ax-card" role="region" aria-label="Changer de centre">
              <div className="ax-card__header">
                <div className="ax-card__titles">
                  <h2 className="ax-card__title">Mes centres</h2>
                  <p className="ax-card__subtitle">Vous travaillez dans plusieurs centres — le sélecteur est aussi dans l&apos;en-tête.</p>
                </div>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0 }}>
                <ul className="ax-list ax-list--compact">
                  {memberships.map((m) => (
                    <li key={m.id} className="ax-list__row">
                      <span className="ax-list__content">
                        <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{m.center.name}</span>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                          {m.center.city} · {CENTER_TYPE_LABELS[m.center.type]}
                        </span>
                      </span>
                      <span className="ax-list__trailing">
                        {m.center.id === centerId ? (
                          <StatusBadge tone="accent" label="Centre actuel" />
                        ) : (
                          <button
                            type="button"
                            className="ax-btn ax-btn--secondary ax-btn--sm"
                            onClick={() => {
                              switchCenter(m.center.id);
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
