'use client';
/*
 * Chioni — /tuteur/recus (dual-currency receipts).
 *
 * The receipt shape carries NO care information — the screen shows exactly
 * what the API gives (number, center, date, EUR paid, fees, KMF received,
 * rate) and never invents more. The detail modal reuses the transparency-card
 * frame (same visual family as the quote and the landing's hero receipt).
 *
 * S1 scope gate: a guardian with NO active link gets a 403 here — rendered as
 * the caring « aucun protégé » empty state, never as an error alert.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { isNoActiveLinkError, listReceipts } from '@/lib/endpoints/guardian';
import { formatDate, formatEur, formatKmf, formatRate } from '@/lib/labels';
import type { Receipt } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  HEART_ICON,
  LoadingCard,
  Modal,
  RECEIPT_ICON,
  usePagedList,
} from './common';

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <Modal title="Reçu officiel" onClose={onClose}>
      <div className="tuteur-money-card" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
        <div className="tuteur-money-card__head">
          <span className="tuteur-money-card__label">{receipt.center_name}</span>
          <span className="tuteur-money-card__number ax-mono">N°&nbsp;{receipt.receipt_number}</span>
        </div>
        <hr className="ax-divider" aria-hidden="true" />
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">Date</span>
          <span className="tuteur-money-row__value">{formatDate(receipt.issued_at)}</span>
        </div>
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">Vous avez payé</span>
          <span className="tuteur-money-row__value ax-num">{formatEur(receipt.amount_eur_paid)}</span>
        </div>
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">dont frais de service</span>
          <span className="tuteur-money-row__value ax-num">{formatEur(receipt.fees_eur)}</span>
        </div>
        <hr className="ax-divider" aria-hidden="true" />
        <div className="tuteur-money-card__kmf">
          <span className="tuteur-money-card__kmf-label">Reçu par le centre</span>
          <span className="tuteur-money-card__kmf-amount ax-num">
            {formatKmf(receipt.amount_kmf_received)}
          </span>
        </div>
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">Taux appliqué</span>
          <span className="tuteur-money-row__value ax-num">{formatRate(receipt.exchange_rate)}</span>
        </div>
        <p className="tuteur-money-card__note">
          Reçu émis par {receipt.center_name} via Chioni. Il prouve que le centre a bien reçu la
          somme en francs comoriens.
        </p>
      </div>
    </Modal>
  );
}

export function TuteurRecus() {
  /** True quand l'API a répondu « aucun lien de tutelle actif » (403 S1). */
  const [noActiveLink, setNoActiveLink] = useState(false);
  const fetchPage = useCallback(async (page: number) => {
    try {
      const data = await listReceipts(page);
      setNoActiveLink(false);
      return data;
    } catch (e) {
      if (isNoActiveLinkError(e)) {
        setNoActiveLink(true);
        return { count: 0, next: null, results: [] as Receipt[] };
      }
      throw e;
    }
  }, []);
  const { items, count, hasMore, loading, loadingMore, error, reload, loadMore } =
    usePagedList(fetchPage);
  const [selected, setSelected] = useState<Receipt | null>(null);

  return (
    <div className="tuteur-screen">
      {loading && <LoadingCard />}
      {!loading && error && items.length === 0 && (
        <ErrorAlert error={error} onRetry={() => void reload()} />
      )}

      {!loading && !error && items.length === 0 && (
        noActiveLink ? (
          <EmptyState
            icon={HEART_ICON}
            title="Aucun protégé pour le moment"
            text="Acceptez une invitation ou ajoutez un proche : un reçu officiel apparaîtra ici pour chacun de vos paiements."
          >
            <p style={{ margin: 'var(--ax-space-3) 0 0' }}>
              <Link className="ax-btn ax-btn--secondary" href="/tuteur/proteges">
                <span className="ax-btn__label">Ajouter un proche</span>
              </Link>
            </p>
          </EmptyState>
        ) : (
          <EmptyState
            icon={RECEIPT_ICON}
            title="Aucun reçu pour le moment"
            text="Un reçu officiel apparaît ici pour chaque paiement, dès que le centre a confirmé le soin et clôturé la demande."
          />
        )
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
            {items.map((receipt) => (
              <button
                key={receipt.id}
                type="button"
                className="tuteur-pr-card"
                style={{ textAlign: 'start', width: '100%', cursor: 'pointer' }}
                onClick={() => setSelected(receipt)}
              >
                <div className="tuteur-pr-card__top">
                  <span className="tuteur-pr-card__who">
                    <span className="tuteur-pr-card__name">{receipt.center_name}</span>
                    <span className="tuteur-pr-card__center ax-mono">
                      N°&nbsp;{receipt.receipt_number} · {formatDate(receipt.issued_at)}
                    </span>
                  </span>
                  <span style={{ color: 'var(--ax-accent)', flexShrink: 0 }} aria-hidden="true">
                    {RECEIPT_ICON}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.55 }}>
                  Vous avez payé{' '}
                  <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>
                    {formatEur(receipt.amount_eur_paid)}
                  </b>{' '}
                  (dont {formatEur(receipt.fees_eur)} de frais) — le centre a reçu{' '}
                  <b className="ax-num" style={{ color: 'var(--ax-accent)' }}>
                    {formatKmf(receipt.amount_kmf_received)}
                  </b>
                  .
                </p>
                <div className="tuteur-pr-card__meta" style={{ marginBlockStart: 'var(--ax-space-2)' }}>
                  <span className="ax-num">{formatRate(receipt.exchange_rate)}</span>
                  <span className="ax-link" aria-hidden="true">Voir le reçu</span>
                </div>
              </button>
            ))}
          </div>

          {error && <ErrorAlert error={error} onRetry={() => void loadMore()} />}

          {hasMore && (
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--block"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              <span className="ax-btn__label">
                {loadingMore ? 'Chargement…' : `Voir plus (${items.length} sur ${count})`}
              </span>
            </button>
          )}
        </>
      )}

      {selected && <ReceiptModal receipt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default TuteurRecus;
