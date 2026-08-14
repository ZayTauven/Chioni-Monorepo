'use client';
/*
 * Chioni — carte « Assurances et mutuelles » de la fiche patient (S3).
 *
 * Donnée administrative-financière TRANSVERSALE (ADR 0016 §6) : tout centre
 * du périmètre du patient lit les mêmes lignes. Lecture pour tout le staff,
 * ajout/édition pour les rôles BILLING seuls (le bouton n'est jamais monté
 * pour les soignants/pharmacien — le backend répondrait 403 de toute façon).
 * Pas de tiers payant en S3 : la carte est purement documentaire.
 */
import { useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  createPatientInsurance,
  listPatientInsurances,
  updatePatientInsurance,
  type InsurancePayload,
} from '@/lib/endpoints/centers';
import { formatDate } from '@/lib/labels';
import type { PatientInsurance } from '@/lib/types';
import {
  BILLING_ROLES,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconEdit,
  IconPlus,
  Modal,
  Pagination,
  StatusBadge,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

/* ── create / edit modal (BILLING) ── */

function InsuranceModal({
  patientId,
  existing,
  onClose,
  onSaved,
}: {
  patientId: number;
  /** Null = création ; sinon édition de la ligne. */
  existing: PatientInsurance | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { centerId } = useCenter();
  const [form, setForm] = useState({
    insurer_name: existing?.insurer_name ?? '',
    member_number: existing?.member_number ?? '',
    valid_until: existing?.valid_until ?? '',
    notes: existing?.notes ?? '',
    is_active: existing?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: InsurancePayload = {
      insurer_name: form.insurer_name.trim(),
      member_number: form.member_number.trim(),
      valid_until: form.valid_until || null,
      notes: form.notes.trim(),
      is_active: form.is_active,
    };
    try {
      if (existing) {
        await updatePatientInsurance(centerId, patientId, existing.id, payload);
      } else {
        await createPatientInsurance(centerId, patientId, payload);
      }
      onSaved();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={existing ? "Modifier l'assurance" : 'Nouvelle assurance'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="insurance-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !form.insurer_name.trim() || !form.member_number.trim()}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        id="insurance-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="ins-name">
            Assureur ou mutuelle <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="ins-name"
            type="text"
            className={`ax-input${error?.fieldErrors.insurer_name ? ' is-invalid' : ''}`}
            value={form.insurer_name}
            onChange={(e) => setForm((f) => ({ ...f, insurer_name: e.target.value }))}
            required
          />
          <FieldError error={error} field="insurer_name" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ins-number">
              N° d&apos;adhérent <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="ins-number"
              type="text"
              className={`ax-input${error?.fieldErrors.member_number ? ' is-invalid' : ''}`}
              value={form.member_number}
              onChange={(e) => setForm((f) => ({ ...f, member_number: e.target.value }))}
              required
            />
            <FieldError error={error} field="member_number" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="ins-until">Valable jusqu&apos;au</label>
            <input
              id="ins-until"
              type="date"
              className={`ax-input${error?.fieldErrors.valid_until ? ' is-invalid' : ''}`}
              value={form.valid_until}
              onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
            />
            <FieldError error={error} field="valid_until" />
          </div>
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="ins-notes">Notes</label>
          <textarea
            id="ins-notes"
            className="ax-textarea"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <FieldError error={error} field="notes" />
        </div>

        <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            className="ax-checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
            Couverture en cours
          </span>
        </label>
      </form>
    </Modal>
  );
}

/* ── card ── */

export function InsurancesCard({ patientId }: { patientId: number }) {
  const { centerId, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; existing: PatientInsurance | null }>({
    open: false,
    existing: null,
  });

  const insurances = useAsync(
    () => listPatientInsurances(centerId, patientId, page),
    [centerId, patientId, page],
  );
  const rows = insurances.data?.results ?? [];

  return (
    <section className="ax-card ax-col--8" role="region" aria-label="Assurances et mutuelles">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Assurances et mutuelles</h2>
          <p className="ax-card__subtitle">Visibles par tous les centres qui suivent ce patient</p>
        </div>
        {billing && (
          <button
            type="button"
            className="ax-btn ax-btn--secondary ax-btn--sm"
            onClick={() => setModal({ open: true, existing: null })}
          >
            <IconPlus />
            <span className="ax-btn__label">Ajouter</span>
          </button>
        )}
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {insurances.loading ? (
          <CardSkeleton lines={3} />
        ) : insurances.error ? (
          <ErrorAlert error={insurances.error} onRetry={insurances.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Aucune assurance enregistrée"
            message={
              billing
                ? 'Ajoutez la mutuelle ou l’assurance du patient si elle vous est présentée au guichet.'
                : 'Aucune mutuelle ni assurance n’a été enregistrée pour ce patient.'
            }
          />
        ) : (
          <>
            <ul className="ax-list ax-list--compact">
              {rows.map((ins) => (
                <li key={ins.id} className="ax-list__row">
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {ins.insurer_name}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      N° {ins.member_number}
                      {ins.valid_until ? ` · Valable jusqu'au ${formatDate(ins.valid_until)}` : ''}
                    </span>
                    {ins.notes && (
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                        {ins.notes}
                      </span>
                    )}
                  </span>
                  <span className="ax-list__trailing" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
                    <StatusBadge
                      tone={ins.is_active ? 'success' : 'neutral'}
                      label={ins.is_active ? 'En cours' : 'Inactive'}
                    />
                    {billing && (
                      <button
                        type="button"
                        className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
                        onClick={() => setModal({ open: true, existing: ins })}
                        aria-label={`Modifier l'assurance ${ins.insurer_name}`}
                      >
                        <IconEdit />
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {insurances.data && (
              <Pagination count={insurances.data.count} page={page} onPage={setPage} />
            )}
          </>
        )}
      </div>

      {modal.open && (
        <InsuranceModal
          patientId={patientId}
          existing={modal.existing}
          onClose={() => setModal({ open: false, existing: null })}
          onSaved={() => {
            setModal({ open: false, existing: null });
            insurances.reload();
          }}
        />
      )}
    </section>
  );
}
