'use client';
/*
 * Chioni — /patient/paiements : payment requests + receipts.
 *
 * Two pill tabs. Each request row is one big tap target towards its detail.
 * Receipts show BOTH currencies (what the center received in KMF and what
 * the relative paid in EUR) — the transparency contract of the Trust Bridge.
 */
import { useState } from 'react';
import Link from 'next/link';
import { listPaymentRequests, listReceipts } from '@/lib/endpoints/patients';
import { formatDate, formatEur, formatKmf } from '@/lib/labels';
import { useLoadMore } from './useLoadMore';
import {
  EmptyState,
  ErrorAlert,
  LoadMoreButton,
  PaymentStatusBadge,
  SkeletonCards,
} from './ui';

type TabKey = 'demandes' | 'recus';

function DemandesTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listPaymentRequests, enabled);

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Aucune demande de paiement"
        message="Quand un centre de santé préparera un paiement pour vos soins, il apparaîtra ici."
      />
    );

  return (
    <div className="pat-stack">
      {list.items.map((req) => (
        <section key={req.id} className="ax-card ax-card--interactive">
          <Link
            href={`/patient/paiements/${req.id}`}
            className="ax-card__body pat-row"
            aria-label={`Demande de ${req.center_name}, ${formatKmf(req.total_kmf)}`}
          >
            <div className="pat-row__main">
              <span className="pat-row__title">{req.center_name}</span>
              <span className="pat-row__meta">{formatDate(req.created_at)}</span>
            </div>
            <div className="pat-row__end">
              <span className="pat-amount">{formatKmf(req.total_kmf)}</span>
              <PaymentStatusBadge status={req.status} />
            </div>
          </Link>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

function RecusTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listReceipts, enabled);

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Aucun reçu pour le moment"
        message="Chaque paiement terminé donne un reçu. Ils seront conservés ici."
      />
    );

  return (
    <div className="pat-stack">
      {list.items.map((receipt) => (
        <section key={receipt.id} className="ax-card" role="region" aria-label={`Reçu ${receipt.receipt_number}`}>
          <div className="ax-card__body pat-gate__body">
            <div className="pat-row" style={{ minHeight: 0 }}>
              <div className="pat-row__main">
                <span className="pat-row__title">{receipt.center_name}</span>
                <span className="pat-row__meta">
                  Reçu n° {receipt.receipt_number} · {formatDate(receipt.issued_at)}
                </span>
              </div>
            </div>
            <ul className="pat-lines">
              <li>
                <span className="pat-line__label">
                  <span className="pat-line__name">Reçu par le centre de santé</span>
                </span>
                <span className="pat-amount">{formatKmf(receipt.amount_kmf_received)}</span>
              </li>
              <li>
                <span className="pat-line__label">
                  <span className="pat-line__name">Payé par votre proche</span>
                </span>
                <span className="pat-amount">{formatEur(receipt.amount_eur_paid)}</span>
              </li>
            </ul>
          </div>
        </section>
      ))}
      {list.error != null && <ErrorAlert error={list.error} />}
      <LoadMoreButton hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
    </div>
  );
}

export function PatientPaiements() {
  const [tab, setTab] = useState<TabKey>('demandes');
  const [visited, setVisited] = useState<Record<TabKey, boolean>>({
    demandes: true,
    recus: false,
  });

  function select(key: TabKey) {
    setTab(key);
    setVisited((cur) => (cur[key] ? cur : { ...cur, [key]: true }));
  }

  return (
    <div className="pat-stack">
      {/* Honest pattern: plain toggle buttons (aria-pressed), not an
          incomplete ARIA tabs composite. Same choice as PatientCarnet. */}
      <nav className="ax-tabs ax-tabs--pill pat-tabs" aria-label="Sections des paiements">
        <div className="ax-tabs__list">
          <button
            type="button"
            className={`ax-tabs__tab${tab === 'demandes' ? ' is-active' : ''}`}
            aria-pressed={tab === 'demandes'}
            onClick={() => select('demandes')}
          >
            Demandes
          </button>
          <button
            type="button"
            className={`ax-tabs__tab${tab === 'recus' ? ' is-active' : ''}`}
            aria-pressed={tab === 'recus'}
            onClick={() => select('recus')}
          >
            Reçus
          </button>
        </div>
      </nav>

      <div hidden={tab !== 'demandes'}>
        <DemandesTab enabled={visited.demandes} />
      </div>
      <div hidden={tab !== 'recus'}>
        <RecusTab enabled={visited.recus} />
      </div>
    </div>
  );
}

export default PatientPaiements;
