'use client';
/*
 * Chioni — carte « Signes vitaux » du détail de consultation (S3, ADR 0016 §4).
 *
 * Rôles cliniques SEULS (la carte n'est montée que derrière la garde du
 * parent, comme le carnet). Plusieurs relevés par consultation ; consultation
 * terminée → plus d'ajout (même règle que ordonnances/carnet). Les bornes de
 * plausibilité vivent au backend : une valeur impossible est refusée champ
 * par champ et JAMAIS stockée — l'écran restitue ces erreurs sous chaque
 * champ, telles quelles.
 */
import { useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  createVitalSigns,
  listVitalSigns,
  type VitalSignsPayload,
} from '@/lib/endpoints/centers';
import { VITAL_SIGN_DEFS, formatDateTime, vitalSummary } from '@/lib/labels';
import type { EncounterStatus } from '@/lib/types';
import {
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconPlus,
  Modal,
  toApiError,
  useAsync,
} from './shared';

type FormValues = Record<string, string>;

const EMPTY_FORM: FormValues = Object.fromEntries(
  VITAL_SIGN_DEFS.map((def) => [def.key, '']),
);

function AddVitalSignsModal({
  encounterId,
  onClose,
  onCreated,
}: {
  encounterId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { centerId } = useCenter();
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const filled = VITAL_SIGN_DEFS.some((def) => form[def.key].trim() !== '');

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: VitalSignsPayload = {};
    for (const def of VITAL_SIGN_DEFS) {
      const raw = form[def.key].trim();
      if (!raw) continue;
      // Claviers français : la virgule décimale est acceptée, envoyée en point.
      payload[def.key] = def.decimal ? raw.replace(',', '.') : raw;
    }
    try {
      await createVitalSigns(centerId, encounterId, payload);
      onCreated();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouveau relevé de signes vitaux"
      busy={saving}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="vitals-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !filled}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le relevé'}
          </button>
        </>
      }
    >
      <form
        id="vitals-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
          Renseignez les mesures prises — au moins une. Les champs vides ne sont pas enregistrés.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 'var(--ax-space-4)' }}>
          {VITAL_SIGN_DEFS.map((def) => (
            <div key={def.key} className="ax-field">
              <label className="ax-label" htmlFor={`vs-${def.key}`}>
                {def.label}{' '}
                <span style={{ color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-regular)' }}>
                  ({def.unit})
                </span>
              </label>
              <input
                id={`vs-${def.key}`}
                type="text"
                inputMode="decimal"
                className={`ax-input${error?.fieldErrors[def.key] ? ' is-invalid' : ''}`}
                value={form[def.key]}
                onChange={(e) => setForm((f) => ({ ...f, [def.key]: e.target.value }))}
              />
              <FieldError error={error} field={def.key} />
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}

/** À ne monter QUE derrière la garde de rôle clinique du parent. */
export function VitalSignsCard({
  encounterId,
  status,
}: {
  encounterId: number;
  status: EncounterStatus;
}) {
  const { centerId } = useCenter();
  const [addOpen, setAddOpen] = useState(false);

  const readings = useAsync(
    () => listVitalSigns(centerId, encounterId),
    [centerId, encounterId],
  );
  const rows = readings.data ?? [];

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Signes vitaux">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Signes vitaux</h2>
          <p className="ax-card__subtitle">Relevés pris pendant cette consultation</p>
        </div>
        {status === 'en_cours' && (
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setAddOpen(true)}>
            <IconPlus />
            <span className="ax-btn__label">Nouveau relevé</span>
          </button>
        )}
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {status === 'terminee' && (
          <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            Consultation terminée : elle n&apos;accepte plus de nouveau relevé.
          </p>
        )}
        {readings.loading ? (
          <CardSkeleton lines={2} />
        ) : readings.error ? (
          <ErrorAlert error={readings.error} onRetry={readings.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Aucun relevé"
            message="Aucun signe vital n'a été relevé pendant cette consultation."
          />
        ) : (
          <ul className="ax-list ax-list--compact">
            {rows.map((reading) => (
              <li key={reading.id} className="ax-list__row">
                <span className="ax-list__content">
                  <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                    {vitalSummary(reading).join(' · ') || '—'}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                    {formatDateTime(reading.measured_at)} · {reading.measured_by_name}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {addOpen && (
        <AddVitalSignsModal
          encounterId={encounterId}
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            readings.reload();
          }}
        />
      )}
    </section>
  );
}
