'use client';
/*
 * Chioni — /centre/factures : factures du centre.
 *
 * Base Vireo : ecommerce/Invoices (table + statuts), refondue sur l'API réelle.
 * Création (rôles BILLING) : choisir une consultation récente puis les actes à
 * facturer (`act_ids` — tous par défaut). Le lien « Créer une facture » du
 * détail de consultation pré-remplit via `?encounter=` (lu sans useSearchParams
 * pour rester compatible avec le prérendu).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  createInvoice,
  getEncounter,
  listEncounters,
  listInvoices,
  type EncounterStaff,
} from '@/lib/endpoints/centers';
import {
  GENERIC_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS,
  formatDateTime,
  formatKmf,
} from '@/lib/labels';
import type { InvoiceStatus } from '@/lib/types';
import {
  AvatarChip,
  BILLING_ROLES,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  INVOICE_TONES,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  hasRole,
  patientLabel,
  toApiError,
  useAsync,
  usePatientNames,
} from './shared';

/* ── create modal ── */

function CreateInvoiceModal({
  prefillEncounterId,
  onClose,
  onCreated,
}: {
  prefillEncounterId: number | null;
  onClose: () => void;
  onCreated: (invoiceId: number) => void;
}) {
  const { centerId } = useCenter();
  const [encounter, setEncounter] = useState<EncounterStaff | null>(null);
  const [selectedActs, setSelectedActs] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const recent = useAsync(() => listEncounters(centerId, { page: 1 }), [centerId]);
  const prefill = useAsync(
    () => (prefillEncounterId ? getEncounter(centerId, prefillEncounterId) : Promise.resolve(null)),
    [centerId, prefillEncounterId],
  );

  // Apply the prefill once loaded.
  useEffect(() => {
    if (prefill.data && !encounter) {
      setEncounter(prefill.data);
      setSelectedActs(prefill.data.acts.map((a) => a.id));
    }
  }, [prefill.data, encounter]);

  const names = usePatientNames(centerId, (recent.data?.results ?? []).map((e) => e.patient));

  const pick = (e: EncounterStaff) => {
    setEncounter(e);
    setSelectedActs(e.acts.map((a) => a.id));
  };

  const toggleAct = (id: number) =>
    setSelectedActs((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const total = (encounter?.acts ?? [])
    .filter((a) => selectedActs.includes(a.id))
    .reduce((sum, a) => sum + Number.parseFloat(a.price_kmf_snapshot), 0);

  const submit = async () => {
    if (!encounter) return;
    setSaving(true);
    setError(null);
    try {
      const invoice = await createInvoice(centerId, {
        encounter: encounter.id,
        act_ids: selectedActs,
      });
      onCreated(invoice.id);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouvelle facture"
      onClose={onClose}
      width={620}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving || !encounter || selectedActs.length === 0}
          >
            {saving ? 'Création…' : 'Créer la facture'}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <FieldError error={error} field="encounter" />
      <FieldError error={error} field="act_ids" />

      {!encounter ? (
        <>
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            Choisissez la consultation à facturer (les plus récentes du centre) :
          </p>
          {recent.loading ? (
            <CardSkeleton lines={4} />
          ) : recent.error ? (
            <ErrorAlert error={recent.error} onRetry={recent.reload} />
          ) : (recent.data?.results.length ?? 0) === 0 ? (
            <EmptyState title="Aucune consultation" message="Aucune consultation à facturer pour l'instant." />
          ) : (
            <ul className="ax-list ax-list--compact" role="listbox" aria-label="Consultations récentes">
              {recent.data?.results
                .filter((e) => e.acts.length > 0)
                .slice(0, 10)
                .map((e) => (
                  <li key={e.id} className="ax-list__row">
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--block"
                      onClick={() => pick(e)}
                      style={{ justifyContent: 'flex-start', gap: 'var(--ax-space-3)' }}
                    >
                      <AvatarChip name={patientLabel(names, e.patient)} seed={e.patient} />
                      <span className="ax-btn__label" style={{ textAlign: 'start' }}>
                        {patientLabel(names, e.patient)} — consultation n° {e.id}
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontWeight: 400 }}>
                          {formatDateTime(e.occurred_at)} · {e.acts.length} acte{e.acts.length > 1 ? 's' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
          {(recent.data?.results ?? []).some((e) => e.acts.length === 0) && (
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              Les consultations sans acte rattaché ne peuvent pas être facturées et ne sont pas listées.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>
              Consultation n° {encounter.id} · {formatDateTime(encounter.occurred_at)}
            </b>
            {!prefillEncounterId && (
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setEncounter(null)}>
                Changer
              </button>
            )}
          </div>
          <div className="ax-field">
            <span className="ax-label">Actes à facturer</span>
            <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-2)' }}>
              {encounter.acts.map((a) => (
                <label
                  key={a.id}
                  className="ax-cluster"
                  style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-2)', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    className="ax-checkbox"
                    checked={selectedActs.includes(a.id)}
                    onChange={() => toggleAct(a.id)}
                  />
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{a.label_snapshot}</span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      {GENERIC_CATEGORY_LABELS[a.generic_category]}
                    </span>
                  </span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', whiteSpace: 'nowrap' }}>
                    {formatKmf(a.price_kmf_snapshot)}
                  </b>
                </label>
              ))}
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Total facturé</span>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{formatKmf(String(total))}</b>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ── screen ── */

export function Invoices() {
  const { centerId, roles } = useCenter();
  const router = useRouter();
  const billing = hasRole(roles, BILLING_ROLES);
  const [page, setPage] = useState(1);
  // Pré-remplissage depuis /centre/factures?encounter=N (sans useSearchParams).
  const [prefillEncounter] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('encounter');
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });
  const [createOpen, setCreateOpen] = useState(prefillEncounter !== null);
  /** Filtre statut serveur (S1 — `?status=`). */
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');

  const invoices = useAsync(
    () => listInvoices(centerId, { page, ...(statusFilter ? { status: statusFilter } : {}) }),
    [centerId, page, statusFilter],
  );
  const results = invoices.data?.results ?? [];
  const names = usePatientNames(centerId, results.map((i) => i.patient));

  useEffect(() => {
    setPage(1);
  }, [centerId, statusFilter]);

  return (
    <>
      <PageHead
        title="Factures"
        subtitle="Factures du centre — chaque ligne est reliée à un acte réalisé."
        actions={
          billing ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">Nouvelle facture</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Liste des factures">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-field" style={{ marginBottom: 0 }}>
              <label className="ax-label" htmlFor="inv-f-status">Statut</label>
              <select
                id="inv-f-status"
                className="ax-select"
                style={{ minWidth: 160 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
              >
                <option value="">Tous</option>
                {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {INVOICE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {invoices.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : invoices.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={invoices.error} onRetry={invoices.reload} />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="Aucune facture"
              message={
                statusFilter
                  ? 'Aucune facture avec ce statut.'
                  : billing
                    ? 'Créez la première facture à partir d’une consultation avec actes.'
                    : 'Les factures créées par l’équipe de facturation apparaîtront ici.'
              }
              action={
                billing && !statusFilter ? (
                  <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setCreateOpen(true)}>
                    <IconPlus />
                    <span className="ax-btn__label">Nouvelle facture</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Facture</th>
                      <th className="ax-table__th" scope="col">Patient</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Lignes</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                      <th className="ax-table__th" scope="col">Statut</th>
                      <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((inv) => (
                      <tr
                        key={inv.id}
                        className="ax-table__row"
                        onClick={() => router.push(`/centre/factures/${inv.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="ax-table__td">
                          <Link
                            href={`/centre/factures/${inv.id}`}
                            className="ax-link"
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                          >
                            Facture n° {inv.id}
                          </Link>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {patientLabel(names, inv.patient)}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num">{inv.lines.length}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                          {formatKmf(inv.total_kmf)}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge tone={INVOICE_TONES[inv.status]} label={INVOICE_STATUS_LABELS[inv.status]} />
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end' }}>
                          <IconChevronRight className="" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invoices.data && <Pagination count={invoices.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {createOpen && billing && (
        <CreateInvoiceModal
          prefillEncounterId={prefillEncounter}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            router.push(`/centre/factures/${id}`);
          }}
        />
      )}
    </>
  );
}

export default Invoices;
