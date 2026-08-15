'use client';
/*
 * Chioni — /plateforme/factures : le registre des factures SaaS (S5 lot 2).
 *
 * La créance de Chioni sur ses tenants, tous centres confondus. Base Vireo :
 * la liste filtrable de `ecommerce/Invoices`.
 *
 * Deux règles d'affichage qui viennent du backend et qu'on ne réinvente pas :
 *
 * - `?overdue=true` applique **la même définition** que le drapeau d'impayé
 *   (échéance strictement dépassée ET solde > 0). Le filtre ne fabrique pas
 *   une seconde règle qui divergerait de l'état des contrats.
 * - `issued_by: null` = **émission automatique** par la tâche planifiée, pas
 *   un oubli de saisie : la ligne le dit, pour qu'on ne cherche pas un humain.
 *
 * `?center=` inexistant rend une PAGE VIDE (jamais un 404) : l'état vide de
 * cet écran le dit plutôt que de laisser croire à une panne.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import { listPlatformSubscriptionInvoices } from '@/lib/endpoints/platform';
import {
  SUBSCRIPTION_INVOICE_BALANCE_LABEL,
  SUBSCRIPTION_INVOICE_PAID_LABEL,
  SUBSCRIPTION_INVOICE_STATUS_LABELS,
  formatDate,
  formatKmf,
} from '@/lib/labels';
import type { SubscriptionInvoiceStatus } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  IconChevronRight,
  Pagination,
  Ref,
  SUBSCRIPTION_INVOICE_TONES,
  StatusBadge,
  TableSkeleton,
  useAsync,
} from './shared';

const STATUSES: SubscriptionInvoiceStatus[] = ['emise', 'payee', 'annulee'];

export function PlatformSubscriptionInvoices() {
  const [status, setStatus] = useState<'' | SubscriptionInvoiceStatus>('');
  const [center, setCenter] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);

  const centerId = Number.parseInt(center, 10);
  const invoices = useAsync(
    () =>
      listPlatformSubscriptionInvoices({
        status: status || undefined,
        center: Number.isFinite(centerId) ? centerId : undefined,
        overdue: overdue ? true : undefined,
        page,
      }),
    [status, center, overdue, page],
  );
  const rows = invoices.data?.results ?? [];

  return (
    <>
      <PlatformPageHead
        title="Factures d’abonnement"
        subtitle="Ce que les centres doivent à Chioni — émission, règlements reçus, corrections."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Registre des factures SaaS">
          <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ minWidth: 200, flex: '1 1 200px' }}>
                <label className="ax-label" htmlFor="inv-status">
                  État
                </label>
                <select
                  id="inv-status"
                  className="ax-select ax-select--sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as '' | SubscriptionInvoiceStatus);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les états</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SUBSCRIPTION_INVOICE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ax-field" style={{ minWidth: 180 }}>
                <label className="ax-label" htmlFor="inv-center">
                  Centre (identifiant)
                </label>
                <input
                  id="inv-center"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="ax-input ax-input--sm"
                  value={center}
                  onChange={(e) => {
                    setCenter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tous"
                />
              </div>
              <div className="ax-field" style={{ minWidth: 200 }}>
                <label className="ax-label" htmlFor="inv-overdue">
                  Retard
                </label>
                <label
                  className="ax-cluster"
                  htmlFor="inv-overdue"
                  style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', minHeight: 34 }}
                >
                  <input
                    id="inv-overdue"
                    type="checkbox"
                    className="ax-checkbox"
                    checked={overdue}
                    onChange={(e) => {
                      setOverdue(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Échéance dépassée et solde restant
                </label>
              </div>
            </div>
          </div>

          {invoices.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : invoices.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={invoices.error} onRetry={invoices.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucune facture sur ce filtre"
              message={
                center
                  ? 'Aucune facture pour cet identifiant de centre — vérifiez le numéro, ou retirez le filtre.'
                  : 'Rien à recouvrer sur ce filtre. Les factures s’émettent toutes seules à la fin de chaque période.'
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Facture</th>
                      <th className="ax-table__th" scope="col">Centre</th>
                      <th className="ax-table__th" scope="col">Échéance</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">
                        {SUBSCRIPTION_INVOICE_PAID_LABEL}
                      </th>
                      <th className="ax-table__th ax-table__th--num" scope="col">
                        {SUBSCRIPTION_INVOICE_BALANCE_LABEL}
                      </th>
                      <th className="ax-table__th" scope="col">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((invoice) => (
                      <tr key={invoice.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <Link
                            href={`/plateforme/factures/${invoice.id}`}
                            className="ax-link ax-num"
                            style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)' }}
                          >
                            {invoice.number}
                          </Link>
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                            {invoice.issued_by === null
                              ? 'Émise automatiquement'
                              : `Émise le ${formatDate(invoice.created_at)}`}
                          </div>
                        </td>
                        <td className="ax-table__td">
                          <Link href={`/plateforme/centres/${invoice.center}`} className="ax-link">
                            {invoice.center_name}
                          </Link>
                          <div>
                            <Ref>centre #{invoice.center}</Ref>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(invoice.due_date)}
                          {invoice.reminders_sent > 0 && (
                            <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                              {invoice.reminders_sent} relance{invoice.reminders_sent > 1 ? 's' : ''} envoyée
                              {invoice.reminders_sent > 1 ? 's' : ''}
                            </div>
                          )}
                        </td>
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{ fontFamily: 'var(--ax-font-mono)', whiteSpace: 'nowrap' }}
                        >
                          {formatKmf(invoice.amount_kmf)}
                        </td>
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}
                        >
                          {formatKmf(invoice.paid_kmf)}
                        </td>
                        <td
                          className="ax-table__td ax-table__td--num ax-num"
                          style={{
                            fontFamily: 'var(--ax-font-mono)',
                            whiteSpace: 'nowrap',
                            color:
                              Number.parseFloat(invoice.balance_kmf) > 0
                                ? 'var(--ax-text-strong)'
                                : 'var(--ax-text-muted)',
                          }}
                        >
                          {formatKmf(invoice.balance_kmf)}
                        </td>
                        <td className="ax-table__td">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                            <StatusBadge
                              tone={SUBSCRIPTION_INVOICE_TONES[invoice.status]}
                              label={SUBSCRIPTION_INVOICE_STATUS_LABELS[invoice.status]}
                            />
                            <IconChevronRight className="" />
                          </span>
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
    </>
  );
}

export default PlatformSubscriptionInvoices;
