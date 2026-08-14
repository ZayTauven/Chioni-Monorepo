'use client';
/*
 * Chioni — /centre/caisse : le journal de caisse du jour.
 *
 * Rôles BILLING uniquement (les autres rôles voient l'explication, sans appel
 * API). Jour par défaut, navigation par date. Tous les moyens confondus
 * (espèces, mobile money, Pont de Confiance), totaux par méthode
 * (encaissé / contre-passé / net), contre-passations FAITES ce jour visibles
 * et signalées — même si l'encaissement corrigé date d'un autre jour.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { getCashJournal } from '@/lib/endpoints/centers';
import {
  CASH_METHOD_LABELS,
  CASH_PAYMENT_STATE_LABELS,
  MOBILE_OPERATOR_LABELS,
  formatDateTime,
  formatKmf,
  formatTime,
  formatWeekdayDate,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { CashMethod } from '@/lib/types';
import {
  BILLING_ROLES,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  StatusBadge,
  hasRole,
  useAsync,
} from './shared';

const METHOD_ORDER: Array<CashMethod | 'total'> = ['especes', 'mobile_money', 'pont_confiance', 'total'];

function methodLabel(key: CashMethod | 'total'): string {
  return key === 'total' ? 'Total' : CASH_METHOD_LABELS[key];
}

export function CashJournal() {
  const { centerId, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  const [date, setDate] = useState(todayIsoDate());

  const journal = useAsync(
    () => (billing ? getCashJournal(centerId, date) : Promise.resolve(null)),
    [centerId, date, billing],
  );

  const isToday = date === todayIsoDate();
  const data = journal.data;
  const hasReversedAmounts = data ? Number.parseFloat(data.totals.total.contre_passe_kmf) > 0 : false;

  if (!billing) {
    return (
      <>
        <PageHead title="Caisse du jour" subtitle="Le journal des encaissements du centre." />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <EmptyState
              title="Réservé aux rôles de facturation"
              message="Le journal de caisse est accessible au directeur, à la secrétaire et au caissier. Votre rôle actuel ne couvre pas la vue financière du centre."
            />
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Caisse du jour"
        subtitle={`Journal du ${formatWeekdayDate(date)} — tous moyens confondus.`}
        actions={
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', flexWrap: 'nowrap' }}>
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon"
              onClick={() => setDate((d) => shiftIsoDate(d, -1))}
              aria-label="Jour précédent"
            >
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
            </button>
            <input
              type="date"
              className="ax-input"
              style={{ width: 170 }}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Choisir le jour du journal"
            />
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon"
              onClick={() => setDate((d) => shiftIsoDate(d, 1))}
              aria-label="Jour suivant"
            >
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
            </button>
            {!isToday && (
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setDate(todayIsoDate())}>
                Aujourd&apos;hui
              </button>
            )}
          </div>
        }
      />

      {journal.error && (
        <div style={{ marginBottom: 'var(--ax-space-5)' }}>
          <ErrorAlert error={journal.error} onRetry={journal.reload} />
        </div>
      )}

      <div className="ax-dash-grid">
        {/* Totaux par méthode */}
        <section className="ax-card ax-col--12" role="region" aria-label="Totaux du jour par méthode">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Totaux du jour</h2>
              <p className="ax-card__subtitle">
                Les contre-passations sont affichées à part — jamais soustraites en silence.
              </p>
            </div>
          </div>
          {journal.loading ? (
            <CardSkeleton lines={4} />
          ) : data ? (
            <div className="ax-table-wrap">
              <table className="ax-table">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Méthode</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Encaissé</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Contre-passé</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {METHOD_ORDER.map((key) => {
                    const t = data.totals[key];
                    const isTotal = key === 'total';
                    return (
                      <tr key={key} className="ax-table__row" style={isTotal ? { fontWeight: 600 } : undefined}>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)', fontWeight: isTotal ? 700 : 500 }}>
                          {methodLabel(key)}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                          {formatKmf(t.encaisse_kmf)}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: Number.parseFloat(t.contre_passe_kmf) > 0 ? 'var(--ax-danger-700)' : 'var(--ax-text-subtle)' }}>
                          {formatKmf(t.contre_passe_kmf)}
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: isTotal ? 700 : 600 }}>
                          {formatKmf(t.net_kmf)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* Encaissements du jour */}
        <section className="ax-card ax-col--12" role="region" aria-label="Encaissements du jour">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Encaissements</h2>
              <p className="ax-card__subtitle">
                Chaque encaissement guichet porte son reçu « G- » ; un encaissement Pont de Confiance a son
                reçu diaspora à la clôture de la demande.
              </p>
            </div>
          </div>
          {journal.loading ? (
            <CardSkeleton lines={5} />
          ) : data && data.payments.length === 0 ? (
            <EmptyState
              title="Aucun encaissement ce jour"
              message="Les encaissements se saisissent depuis la page d'une facture émise (bouton « Encaisser »)."
            />
          ) : data ? (
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Heure</th>
                    <th className="ax-table__th" scope="col">Facture</th>
                    <th className="ax-table__th" scope="col">Méthode</th>
                    <th className="ax-table__th" scope="col">Référence</th>
                    <th className="ax-table__th" scope="col">Reçu</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                    <th className="ax-table__th" scope="col">État</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id} className="ax-table__row" style={p.reversal ? { opacity: 0.65 } : undefined}>
                      <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', whiteSpace: 'nowrap' }}>
                        {formatTime(p.created_at)}
                      </td>
                      <td className="ax-table__td">
                        <Link href={`/centre/factures/${p.invoice}`} className="ax-link" style={{ fontWeight: 500 }}>
                          Facture n° {p.invoice}
                        </Link>
                      </td>
                      <td className="ax-table__td" style={{ whiteSpace: 'nowrap' }}>
                        {CASH_METHOD_LABELS[p.method]}
                        {p.operator && (
                          <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
                            {MOBILE_OPERATOR_LABELS[p.operator]}
                          </span>
                        )}
                      </td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                        {p.reference || '—'}
                      </td>
                      <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                        {p.receipt ? (
                          <span style={{ textDecoration: p.reversal ? 'line-through' : undefined }}>{p.receipt.receipt_number}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', textDecoration: p.reversal ? 'line-through' : undefined }}>
                        {formatKmf(p.amount_kmf)}
                      </td>
                      <td className="ax-table__td">
                        {p.reversal ? (
                          <StatusBadge tone="danger" label={CASH_PAYMENT_STATE_LABELS.contre_passe} />
                        ) : (
                          <StatusBadge tone="success" label={CASH_PAYMENT_STATE_LABELS.encaisse} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        {/* Contre-passations du jour */}
        {(journal.loading || (data && data.reversals.length > 0)) && (
          <section className="ax-card ax-col--12" role="region" aria-label="Contre-passations du jour">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Contre-passations faites ce jour</h2>
                <p className="ax-card__subtitle">
                  Écritures correctives signées — elles peuvent corriger un encaissement d&apos;un autre jour.
                </p>
              </div>
            </div>
            {journal.loading ? (
              <CardSkeleton lines={3} />
            ) : data ? (
              <div className="ax-table-wrap">
                <table className="ax-table">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Quand</th>
                      <th className="ax-table__th" scope="col">Encaissement corrigé</th>
                      <th className="ax-table__th" scope="col">Méthode</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                      <th className="ax-table__th" scope="col">Motif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reversals.map((r) => (
                      <tr key={r.id} className="ax-table__row">
                        <td className="ax-table__td" style={{ whiteSpace: 'nowrap', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                          {formatDateTime(r.created_at)}
                        </td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                          n° {r.cash_payment}
                        </td>
                        <td className="ax-table__td">{CASH_METHOD_LABELS[r.method]}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-700)' }}>
                          − {formatKmf(r.amount_kmf)}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text)', maxWidth: 320 }}>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        )}

        {data && data.reversals.length === 0 && !hasReversedAmounts && !journal.loading && (
          <p className="ax-col--12" style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
            Aucune contre-passation faite ce jour.
          </p>
        )}
      </div>
    </>
  );
}

export default CashJournal;
