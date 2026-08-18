'use client';
/*
 * Chioni — /centre/tarifs : grille tarifaire du centre.
 *
 * Lecture : tout le staff. Écriture (création, PATCH, activation) : directeur
 * et caissier. La `generic_category` est ce que verront les proches payeurs
 * (jamais le libellé — secret médical, ADR 0005) : le formulaire l'explique.
 */
import { useEffect, useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { createTariff, listTariffs, updateTariff, type TariffPayload } from '@/lib/endpoints/centers';
import { GENERIC_CATEGORY_LABELS, formatKmf } from '@/lib/labels';
import type { GenericCategory, TariffItem } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  IconEdit,
  IconPlus,
  Modal,
  Pagination,
  StatusBadge,
  TARIFF_WRITE_ROLES,
  TableSkeleton,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

interface TariffForm {
  code: string;
  label: string;
  generic_category: GenericCategory;
  price_kmf: string;
}

function TariffModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: TariffItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { centerId } = useCenter();
  const [form, setForm] = useState<TariffForm>({
    code: existing?.code ?? '',
    label: existing?.label ?? '',
    generic_category: existing?.generic_category ?? 'consultation',
    price_kmf: existing?.price_kmf ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: TariffPayload = {
      code: form.code.trim(),
      label: form.label.trim(),
      generic_category: form.generic_category,
      price_kmf: form.price_kmf.trim(),
    };
    try {
      if (existing) await updateTariff(centerId, existing.id, payload);
      else await createTariff(centerId, payload);
      onSaved();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={existing ? `Modifier « ${existing.label} »` : 'Nouvel acte tarifé'}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="tariff-form" className="ax-btn ax-btn--primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        id="tariff-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="tf-code">
              Code <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="tf-code"
              type="text"
              className={`ax-input${error?.fieldErrors.code ? ' is-invalid' : ''}`}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="ex. CONS-01"
              required
            />
            <FieldError error={error} field="code" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="tf-label">
              Libellé <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="tf-label"
              type="text"
              className={`ax-input${error?.fieldErrors.label ? ' is-invalid' : ''}`}
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="ex. Consultation généraliste"
              required
            />
            <FieldError error={error} field="label" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="tf-cat">
              Catégorie générique <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="tf-cat"
              className="ax-select"
              value={form.generic_category}
              onChange={(e) => setForm((f) => ({ ...f, generic_category: e.target.value as GenericCategory }))}
            >
              {(Object.keys(GENERIC_CATEGORY_LABELS) as GenericCategory[]).map((c) => (
                <option key={c} value={c}>
                  {GENERIC_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <span className="ax-field__message">
              C&apos;est la seule information visible par un proche payeur — jamais le libellé (secret médical).
            </span>
            <FieldError error={error} field="generic_category" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="tf-price">
              Prix (KMF) <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="tf-price"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              className={`ax-input${error?.fieldErrors.price_kmf ? ' is-invalid' : ''}`}
              value={form.price_kmf}
              onChange={(e) => setForm((f) => ({ ...f, price_kmf: e.target.value }))}
              required
            />
            <FieldError error={error} field="price_kmf" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function Tariffs() {
  const { centerId, roles } = useCenter();
  const canWrite = hasRole(roles, TARIFF_WRITE_ROLES);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; item: TariffItem | null }>({ open: false, item: null });
  const [toggleError, setToggleError] = useState<ApiError | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const tariffs = useAsync(() => listTariffs(centerId, page), [centerId, page]);
  const results = tariffs.data?.results ?? [];

  useEffect(() => {
    setPage(1);
  }, [centerId]);

  const toggleActive = async (item: TariffItem) => {
    setTogglingId(item.id);
    setToggleError(null);
    try {
      await updateTariff(centerId, item.id, { is_active: !item.is_active });
      tariffs.reload();
    } catch (err) {
      setToggleError(toApiError(err));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <PageHead
        title="Tarifs"
        subtitle={
          canWrite
            ? 'Grille tarifaire du centre — chaque acte facturé s’appuie sur cette grille.'
            : 'Grille tarifaire du centre — la modification est réservée au directeur et au caissier.'
        }
        actions={
          canWrite ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setModal({ open: true, item: null })}>
              <IconPlus />
              <span className="ax-btn__label">Nouvel acte</span>
            </button>
          ) : undefined
        }
      />

      {toggleError && (
        <div style={{ marginBottom: 'var(--ax-space-5)' }}>
          <ErrorAlert error={toggleError} />
        </div>
      )}

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Grille tarifaire">
          {tariffs.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : tariffs.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={tariffs.error} onRetry={tariffs.reload} />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="Grille tarifaire vide"
              message={
                canWrite
                  ? 'Ajoutez les actes du centre (consultations, analyses, médicaments…) : les consultations et factures s’appuieront dessus.'
                  : 'Aucun acte tarifé pour l’instant — le directeur ou le caissier peut remplir la grille.'
              }
              action={
                canWrite ? (
                  <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setModal({ open: true, item: null })}>
                    <IconPlus />
                    <span className="ax-btn__label">Nouvel acte</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Code</th>
                      <th className="ax-table__th" scope="col">Libellé</th>
                      <th className="ax-table__th" scope="col">Catégorie générique</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Prix</th>
                      <th className="ax-table__th" scope="col">Actif</th>
                      {canWrite && <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((t) => (
                      <tr key={t.id} className="ax-table__row" style={t.is_active ? undefined : { opacity: 0.6 }}>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {t.code}
                        </td>
                        <td className="ax-table__td" style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>{t.label}</td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {GENERIC_CATEGORY_LABELS[t.generic_category]}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                          {formatKmf(t.price_kmf)}
                        </td>
                        <td className="ax-table__td">
                          {t.is_active ? (
                            <StatusBadge tone="success" label="Actif" />
                          ) : (
                            <StatusBadge tone="neutral" label="Inactif" />
                          )}
                        </td>
                        {canWrite && (
                          <td className="ax-table__td" style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="ax-btn ax-btn--ghost ax-btn--sm"
                              onClick={() => setModal({ open: true, item: t })}
                            >
                              <IconEdit />
                              <span className="ax-btn__label">Modifier</span>
                            </button>
                            <button
                              type="button"
                              className="ax-btn ax-btn--ghost ax-btn--sm"
                              onClick={() => void toggleActive(t)}
                              disabled={togglingId === t.id}
                            >
                              <span className="ax-btn__label">
                                {togglingId === t.id ? '…' : t.is_active ? 'Désactiver' : 'Réactiver'}
                              </span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tariffs.data && <Pagination count={tariffs.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {modal.open && (
        <TariffModal
          existing={modal.item}
          onClose={() => setModal({ open: false, item: null })}
          onSaved={() => {
            setModal({ open: false, item: null });
            tariffs.reload();
          }}
        />
      )}
    </>
  );
}

export default Tariffs;
