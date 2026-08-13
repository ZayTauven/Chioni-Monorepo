'use client';
/*
 * Chioni — /tuteur/demandes (all payment requests, filterable).
 *
 * Filters are client-side (the API has no filter params): by protégé and by
 * status, applied to the pages loaded so far. Statuses use the
 * guardian-facing wording of common.tsx. Lines never show act labels
 * (ADR 0005) — this list only shows totals anyway.
 *
 * S1 scope gate: a guardian with NO active link gets a 403 here — rendered as
 * the caring « aucun protégé » empty state, never as an error alert.
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { isNoActiveLinkError, listPaymentRequests } from '@/lib/endpoints/guardian';
import { PR_STATUS_TUTEUR_SHORT, formatDate, formatKmf } from '@/lib/labels';
import type { PaymentRequestGuardian, PaymentRequestStatus } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  HEART_ICON,
  INVOICE_ICON,
  LoadingCard,
  PrStatusBadge,
  protegeName,
  usePagedList,
} from './common';

/** Statuses a guardian can actually meet (drafts are never shared). */
const FILTERABLE_STATUSES: PaymentRequestStatus[] = [
  'envoyee',
  'payee',
  'soin_confirme',
  'cloturee',
  'litige',
];

export function TuteurDemandes() {
  /** True quand l'API a répondu « aucun lien de tutelle actif » (403 S1). */
  const [noActiveLink, setNoActiveLink] = useState(false);
  const fetchPage = useCallback(async (page: number) => {
    try {
      const data = await listPaymentRequests(page);
      setNoActiveLink(false);
      return data;
    } catch (e) {
      if (isNoActiveLinkError(e)) {
        setNoActiveLink(true);
        return { count: 0, next: null, results: [] as PaymentRequestGuardian[] };
      }
      throw e;
    }
  }, []);
  const { items, count, hasMore, loading, loadingMore, error, reload, loadMore } =
    usePagedList(fetchPage);

  const [patientFilter, setPatientFilter] = useState<string>('tous');
  const [statusFilter, setStatusFilter] = useState<string>('tous');

  /** Distinct protégés across the loaded pages. */
  const patients = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of items) {
      if (!seen.has(r.patient.id)) seen.set(r.patient.id, protegeName(r.patient));
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (r) =>
          (patientFilter === 'tous' || r.patient.id === Number(patientFilter)) &&
          (statusFilter === 'tous' || r.status === statusFilter),
      ),
    [items, patientFilter, statusFilter],
  );

  const hasFilters = patientFilter !== 'tous' || statusFilter !== 'tous';

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
            text="Acceptez une invitation ou ajoutez un proche : les demandes de paiement de ses soins apparaîtront ici."
          >
            <p style={{ margin: 'var(--ax-space-3) 0 0' }}>
              <Link className="ax-btn ax-btn--secondary" href="/tuteur/proteges">
                <span className="ax-btn__label">Ajouter un proche</span>
              </Link>
            </p>
          </EmptyState>
        ) : (
          <EmptyState
            icon={INVOICE_ICON}
            title="Aucune demande de paiement"
            text="Quand un centre de santé enverra une demande pour un de vos proches, elle apparaîtra ici."
          />
        )
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="tuteur-filters">
            <div className="ax-field">
              <label className="ax-field__label" htmlFor="tuteur-filtre-protege">
                Protégé
              </label>
              <select
                id="tuteur-filtre-protege"
                className="ax-select"
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
              >
                <option value="tous">Tous</option>
                {patients.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ax-field">
              <label className="ax-field__label" htmlFor="tuteur-filtre-statut">
                Statut
              </label>
              <select
                id="tuteur-filtre-statut"
                className="ax-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="tous">Tous</option>
                {FILTERABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PR_STATUS_TUTEUR_SHORT[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="Rien avec ces filtres"
              text="Aucune demande ne correspond. Essayez d’élargir votre choix."
            />
          ) : (
            <div className="ax-stack" style={{ gap: 'var(--ax-space-3)' }}>
              {filtered.map((r) => (
                <Link key={r.id} href={`/tuteur/demandes/${r.id}`} className="tuteur-pr-card">
                  <div className="tuteur-pr-card__top">
                    <span className="tuteur-pr-card__who">
                      <span className="tuteur-pr-card__name">{protegeName(r.patient)}</span>
                      <span className="tuteur-pr-card__center">{r.center_name}</span>
                    </span>
                    <span className="tuteur-pr-card__amount ax-num">{formatKmf(r.total_kmf)}</span>
                  </div>
                  <div className="tuteur-pr-card__meta">
                    {/* Once paid, the payment date matters more than the request date. */}
                    <span>
                      {r.status === 'payee' && r.paid_at
                        ? `Payée le ${formatDate(r.paid_at)}`
                        : formatDate(r.created_at)}
                    </span>
                    <PrStatusBadge status={r.status} short />
                  </div>
                </Link>
              ))}
            </div>
          )}

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
          {hasFilters && hasMore && (
            <p className="tuteur-money-card__note">
              Les filtres s&rsquo;appliquent aux demandes déjà chargées. Touchez «&nbsp;Voir
              plus&nbsp;» pour élargir.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default TuteurDemandes;
