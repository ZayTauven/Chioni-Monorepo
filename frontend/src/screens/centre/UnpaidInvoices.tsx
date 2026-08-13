'use client';
/*
 * Chioni — /centre/impayes : les factures émises à solde restant.
 *
 * Rôles BILLING uniquement. Le téléphone est affiché TEL QUEL, masqué par le
 * backend (« +336••••••78 ») — le numéro complet reste sur la fiche patient,
 * jamais dans une vue de masse. Tri serveur par `?ordering=` (solde ou
 * ancienneté) ; c'est la matière première des futures relances.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { listUnpaidInvoices } from '@/lib/endpoints/centers';
import { UNPAID_ORDERING_LABELS, formatDate, formatKmf } from '@/lib/labels';
import type { UnpaidOrdering } from '@/lib/types';
import {
  BILLING_ROLES,
  EmptyState,
  ErrorAlert,
  Pagination,
  TableSkeleton,
  hasRole,
  useAsync,
} from './shared';

export function UnpaidInvoices() {
  const { centerId, role } = useCenter();
  const billing = hasRole(role, BILLING_ROLES);
  const [ordering, setOrdering] = useState<UnpaidOrdering>('-balance');
  const [page, setPage] = useState(1);

  const list = useAsync(
    () => (billing ? listUnpaidInvoices(centerId, { ordering, page }) : Promise.resolve(null)),
    [centerId, ordering, page, billing],
  );

  useEffect(() => {
    setPage(1);
  }, [centerId, ordering]);

  if (!billing) {
    return (
      <>
        <PageHead title="Impayés" subtitle="Les factures émises dont le solde reste dû." />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <EmptyState
              title="Réservé aux rôles de facturation"
              message="La liste des impayés est accessible au directeur, à la secrétaire et au caissier."
            />
          </section>
        </div>
      </>
    );
  }

  const rows = list.data?.results ?? [];

  return (
    <>
      <PageHead
        title="Impayés"
        subtitle="Les factures émises dont le solde reste dû — photo à l'instant présent."
        actions={
          <div className="ax-field" style={{ marginBottom: 0 }}>
            <label className="ax-label" htmlFor="unpaid-ordering">Trier par</label>
            <select
              id="unpaid-ordering"
              className="ax-select"
              value={ordering}
              onChange={(e) => setOrdering(e.target.value as UnpaidOrdering)}
            >
              {(Object.keys(UNPAID_ORDERING_LABELS) as UnpaidOrdering[]).map((o) => (
                <option key={o} value={o}>
                  {UNPAID_ORDERING_LABELS[o]}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Factures impayées">
          {list.loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : list.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={list.error} onRetry={list.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun impayé"
              message="Toutes les factures émises sont réglées. C'est la meilleure liste vide du logiciel."
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Facture</th>
                      <th className="ax-table__th" scope="col">Patient</th>
                      <th className="ax-table__th" scope="col">Téléphone</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Payé</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Solde</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Ancienneté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((inv) => (
                      <tr key={inv.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <Link href={`/centre/factures/${inv.id}`} className="ax-link" style={{ fontWeight: 500 }}>
                            Facture n° {inv.id}
                          </Link>
                          <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
                            émise le {formatDate(inv.created_at)}
                          </span>
                        </td>
                        <td className="ax-table__td">
                          <Link href={`/centre/patients/${inv.patient}`} className="ax-link">
                            {inv.patient_name || `Patient n° ${inv.patient}`}
                          </Link>
                        </td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {inv.patient_phone_masked || '—'}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                          {formatKmf(inv.total_kmf)}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>
                          {formatKmf(inv.paid_kmf)}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>
                          {formatKmf(inv.balance_kmf)}
                        </td>
                        <td className="ax-table__td ax-table__td--num" style={{ whiteSpace: 'nowrap', color: inv.age_days > 30 ? 'var(--ax-danger-700)' : 'var(--ax-text-muted)' }}>
                          {inv.age_days} j
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {list.data && <Pagination count={list.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default UnpaidInvoices;
