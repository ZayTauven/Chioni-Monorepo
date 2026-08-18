'use client';
/*
 * Chioni — /centre/demandes : demandes de paiement du centre (Pont de Confiance).
 *
 * Liste paginée, statuts de la machine à états badgés en FR, indicateur
 * d'accusé patient. Les demandes se créent depuis une facture émise
 * (détail de facture → « Créer une demande de paiement »).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { listPaymentRequests } from '@/lib/endpoints/centers';
import { PAYMENT_REQUEST_STATUS_LABELS, formatDate, formatKmf } from '@/lib/labels';
import {
  EmptyState,
  ErrorAlert,
  IconChevronRight,
  Pagination,
  PAYMENT_REQUEST_TONES,
  StatusBadge,
  TableSkeleton,
  useAsync,
} from './shared';

export function PaymentRequests() {
  const { centerId } = useCenter();
  const router = useRouter();
  const [page, setPage] = useState(1);

  const requests = useAsync(() => listPaymentRequests(centerId, page), [centerId, page]);
  const results = requests.data?.results ?? [];

  useEffect(() => {
    setPage(1);
  }, [centerId]);

  return (
    <>
      <PageHead
        title="Demandes de paiement"
        subtitle="Pont de Confiance — chaque demande est reliée à une facture et payée directement au centre."
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Liste des demandes de paiement">
          {requests.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : requests.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={requests.error} onRetry={requests.reload} />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="Aucune demande de paiement"
              message="Ouvrez une demande depuis une facture émise (page Factures) pour que les proches du patient puissent la régler depuis l'étranger."
              action={
                <Link href="/centre/factures" className="ax-btn ax-btn--secondary">
                  <span className="ax-btn__label">Voir les factures</span>
                </Link>
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Demande</th>
                      <th className="ax-table__th" scope="col">Facture</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                      <th className="ax-table__th" scope="col">Statut</th>
                      <th className="ax-table__th" scope="col">Soin confirmé par le patient</th>
                      <th className="ax-table__th" scope="col">Créée le</th>
                      <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Ouvrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr
                        key={r.id}
                        className="ax-table__row"
                        onClick={() => router.push(`/centre/demandes/${r.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="ax-table__td">
                          <Link
                            href={`/centre/demandes/${r.id}`}
                            className="ax-link"
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                          >
                            Demande n° {r.id}
                          </Link>
                        </td>
                        <td className="ax-table__td">
                          <Link
                            href={`/centre/factures/${r.invoice}`}
                            className="ax-link"
                            onClick={(ev) => ev.stopPropagation()}
                            style={{ color: 'var(--ax-text-muted)' }}
                          >
                            Facture n° {r.invoice}
                          </Link>
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                          {formatKmf(r.total_kmf)}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge tone={PAYMENT_REQUEST_TONES[r.status]} label={PAYMENT_REQUEST_STATUS_LABELS[r.status]} />
                        </td>
                        <td className="ax-table__td">
                          {r.patient_acknowledged_at ? (
                            <StatusBadge tone="success" label="Oui" />
                          ) : (
                            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Pas encore</span>
                          )}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(r.created_at)}
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end' }}>
                          <IconChevronRight className="" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {requests.data && <Pagination count={requests.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default PaymentRequests;
