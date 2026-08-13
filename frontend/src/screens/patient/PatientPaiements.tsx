'use client';
/*
 * Chioni — /patient/paiements : payment requests + receipts.
 *
 * Three pill tabs: the requests, MY counter receipts (« G- », what I paid at
 * the desk — a reversed cash-in shows a clear « Annulé » mention), and the
 * relatives' receipts in BOTH currencies (what the center received in KMF
 * and what the relative paid in EUR) — the Trust Bridge transparency contract.
 */
import { useState } from 'react';
import Link from 'next/link';
import { listCashReceipts, listPaymentRequests, listReceipts } from '@/lib/endpoints/patients';
import {
  CASH_METHOD_PATIENT,
  CASH_RECEIPT_REVERSED_PATIENT,
  formatDate,
  formatEur,
  formatKmf,
} from '@/lib/labels';
import { useLoadMore } from './useLoadMore';
import {
  EmptyState,
  ErrorAlert,
  LoadMoreButton,
  PaymentStatusBadge,
  SkeletonCards,
} from './ui';

type TabKey = 'demandes' | 'caisse' | 'recus';

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

function CaisseTab({ enabled }: { enabled: boolean }) {
  const list = useLoadMore(listCashReceipts, enabled);

  if (list.loading) return <SkeletonCards />;
  if (list.error != null && list.items.length === 0)
    return <ErrorAlert error={list.error} onRetry={list.reload} />;
  if (list.items.length === 0)
    return (
      <EmptyState
        title="Aucun reçu de caisse"
        message="Quand vous payez au guichet d'un centre de santé, votre reçu est conservé ici."
      />
    );

  return (
    <div className="pat-stack">
      {list.items.map((receipt) => (
        <section
          key={receipt.id}
          className="ax-card"
          role="region"
          aria-label={`Reçu ${receipt.receipt_number}${receipt.reversed ? ', annulé' : ''}`}
        >
          <div className="ax-card__body pat-gate__body">
            <div className="pat-row" style={{ minHeight: 0 }}>
              <div className="pat-row__main">
                <span className="pat-row__title">{receipt.center_name}</span>
                <span className="pat-row__meta">
                  Reçu n° {receipt.receipt_number} · {formatDate(receipt.issued_at)}
                </span>
              </div>
              <div className="pat-row__end">
                <span
                  className="pat-amount"
                  style={receipt.reversed ? { textDecoration: 'line-through', color: 'var(--ax-text-subtle)' } : undefined}
                >
                  {formatKmf(receipt.amount_kmf)}
                </span>
                {receipt.reversed && (
                  <span className="ax-badge ax-badge--soft ax-badge--danger">{CASH_RECEIPT_REVERSED_PATIENT}</span>
                )}
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              {CASH_METHOD_PATIENT[receipt.method]}
            </p>
            {receipt.reversed && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
                Ce reçu a été annulé par le centre : il ne compte plus. Le plus souvent, c&apos;est la correction
                d&apos;une erreur de saisie. En cas de doute, demandez au guichet du centre.
              </p>
            )}
          </div>
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
    caisse: false,
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
            className={`ax-tabs__tab${tab === 'caisse' ? ' is-active' : ''}`}
            aria-pressed={tab === 'caisse'}
            onClick={() => select('caisse')}
          >
            Reçus de caisse
          </button>
          <button
            type="button"
            className={`ax-tabs__tab${tab === 'recus' ? ' is-active' : ''}`}
            aria-pressed={tab === 'recus'}
            onClick={() => select('recus')}
          >
            Reçus des proches
          </button>
        </div>
      </nav>

      <div hidden={tab !== 'demandes'}>
        <DemandesTab enabled={visited.demandes} />
      </div>
      <div hidden={tab !== 'caisse'}>
        <CaisseTab enabled={visited.caisse} />
      </div>
      <div hidden={tab !== 'recus'}>
        <RecusTab enabled={visited.recus} />
      </div>
    </div>
  );
}

export default PatientPaiements;
