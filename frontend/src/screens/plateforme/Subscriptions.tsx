'use client';
/*
 * Chioni — /plateforme/abonnements : les contrats des tenants (S5, ADR 0018).
 *
 * Base Vireo : la liste filtrable de `ecommerce/Invoices`, déjà adaptée pour
 * les centres et la réconciliation.
 *
 * Ce que cette liste dit, et ce qu'elle ne dit pas :
 *
 * - **L'abonnement n'est PAS le KYC.** Deux axes, deux écrans, deux badges :
 *   `kyc_status` gouverne le rail diaspora (ADR 0017), `status` gouverne
 *   l'administratif (ADR 0018). Le badge de cette liste ne parle QUE du
 *   second — le premier se lit sur la fiche du centre.
 * - **Les sièges sont un signal commercial**, jamais un levier de blocage :
 *   « au-delà de l'offre » est une information pour appeler le client, pas un
 *   état d'erreur.
 * - **La créance ne s'affiche pas ici**, et c'est délibéré : le payload d'un
 *   abonnement ne porte aucun solde (contrat backend), et sommer les factures
 *   d'un tenant depuis le client demanderait une requête par ligne. Le montant
 *   dû est réel sur la fiche du contrat et dans « Factures d'abonnement ».
 */
import { useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import { createPlatformSubscription, listPlans, listPlatformSubscriptions } from '@/lib/endpoints/platform';
import type { ApiError } from '@/lib/api';
import {
  BILLING_PERIOD_LABELS,
  SUBSCRIPTION_NO_AUTO_CUT,
  SUBSCRIPTION_STATUS_LABELS,
  formatDate,
  formatKmf,
  quotaSummary,
} from '@/lib/labels';
import type { SubscriptionStatus } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  Modal,
  Pagination,
  ReadOnlyNotice,
  Ref,
  SUBSCRIPTION_TONES,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  usePlatformRole,
} from './shared';

const STATUSES: SubscriptionStatus[] = ['essai', 'actif', 'impaye', 'suspendu', 'resilie'];

/* ── ouverture d'un contrat ── */

function NewSubscriptionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const plans = useAsync(() => listPlans(true), []);
  const [centerId, setCenterId] = useState('');
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState<'essai' | 'actif'>('essai');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPlatformSubscription({
        center: Number.parseInt(centerId, 10),
        plan: Number.parseInt(planId, 10),
        status,
      });
      onCreated();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  const activePlans = plans.data ?? [];

  return (
    <Modal
      title="Ouvrir un contrat"
      onClose={onClose}
      width={560}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="new-subscription-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !centerId || !planId}
          >
            {saving ? 'Ouverture…' : 'Ouvrir le contrat'}
          </button>
        </>
      }
    >
      <form
        id="new-subscription-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* Un contrat naît VIVANT : `essai` ou `actif`. Un gel se décide
            ensuite, avec son motif et sa transition auditée — c'est pourquoi
            ce formulaire ne propose pas les trois autres états. */}
        <div className="ax-field">
          <label className="ax-label" htmlFor="sub-center">
            Centre (identifiant) <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <input
            id="sub-center"
            type="number"
            inputMode="numeric"
            min={1}
            className={`ax-input${error?.fieldErrors.center ? ' is-invalid' : ''}`}
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            required
            data-autofocus=""
            aria-describedby="sub-center-help"
          />
          <p id="sub-center-help" className="ax-field__message">
            L&apos;identifiant se lit sur la fiche du centre, dans « Centres ».
          </p>
          <FieldError error={error} field="center" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="sub-plan">
            Offre <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <select
            id="sub-plan"
            className="ax-select"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            required
          >
            <option value="">Choisir une offre…</option>
            {activePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {formatKmf(plan.price_kmf)} {BILLING_PERIOD_LABELS[plan.billing_period]}
              </option>
            ))}
          </select>
          <FieldError error={error} field="plan" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="sub-status">
            État initial
          </label>
          <select
            id="sub-status"
            className="ax-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'essai' | 'actif')}
          >
            <option value="essai">{SUBSCRIPTION_STATUS_LABELS.essai}</option>
            <option value="actif">{SUBSCRIPTION_STATUS_LABELS.actif}</option>
          </select>
          <p className="ax-field__message">
            Un contrat naît vivant&nbsp;: un gel se décide ensuite, avec son motif.
          </p>
          <FieldError error={error} field="status" />
        </div>
      </form>
    </Modal>
  );
}

/* ── écran ── */

export function PlatformSubscriptions() {
  const { canWrite } = usePlatformRole();
  const [status, setStatus] = useState<'' | SubscriptionStatus>('');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const subscriptions = useAsync(
    () => listPlatformSubscriptions({ status: status || undefined, page }),
    [status, page],
  );
  const rows = subscriptions.data?.results ?? [];

  return (
    <>
      <PlatformPageHead
        title="Abonnements"
        subtitle="Un contrat par tenant — l'offre, l'état commercial et les sièges consommés."
        actions={
          canWrite ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setNewOpen(true)}>
              <IconPlus />
              <span className="ax-btn__label">Ouvrir un contrat</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Contrats des centres">
          <div
            className="ax-card__body"
            style={{ paddingBottom: 'var(--ax-space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
          >
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="ax-field" style={{ minWidth: 240, flex: '1 1 240px' }}>
                <label className="ax-label" htmlFor="sub-filter-status">
                  État du contrat
                </label>
                <select
                  id="sub-filter-status"
                  className="ax-select ax-select--sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as '' | SubscriptionStatus);
                    setPage(1);
                  }}
                >
                  <option value="">Tous les états</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {SUBSCRIPTION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {SUBSCRIPTION_NO_AUTO_CUT}
            </p>
            {!canWrite && <ReadOnlyNotice />}
          </div>

          {subscriptions.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : subscriptions.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={subscriptions.error} onRetry={subscriptions.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun contrat sur ce filtre"
              message="Un centre sans contrat n'est pas un centre en défaut : tous ceux qui sont nés avant l'arrivée des abonnements sont simplement sans ligne ici."
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Centre</th>
                      <th className="ax-table__th" scope="col">Offre</th>
                      <th className="ax-table__th" scope="col">Prochaine échéance</th>
                      <th className="ax-table__th" scope="col">Sièges</th>
                      <th className="ax-table__th" scope="col">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((sub) => (
                      <tr key={sub.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <Link
                            href={`/plateforme/abonnements/${sub.id}`}
                            className="ax-link"
                            style={{ fontWeight: 'var(--ax-weight-medium)' }}
                          >
                            {sub.center_name}
                          </Link>
                          <div>
                            <Ref>centre #{sub.center}</Ref>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {sub.plan.name}
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                              {formatKmf(sub.plan.price_kmf)}
                            </span>{' '}
                            {BILLING_PERIOD_LABELS[sub.plan.billing_period]}
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {sub.current_period_end ? formatDate(sub.current_period_end) : '—'}
                        </td>
                        <td className="ax-table__td" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          <div>{quotaSummary(sub.usage.staff, sub.usage.included_staff, 'staff')}</div>
                          <div>
                            {quotaSummary(
                              sub.usage.practitioners,
                              sub.usage.included_practitioners,
                              'practitioners',
                            )}
                          </div>
                          {sub.usage.over_quota && (
                            <div style={{ marginTop: 4 }}>
                              <StatusBadge tone="warning" label="Au-delà de l’offre" />
                            </div>
                          )}
                        </td>
                        <td className="ax-table__td">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                            <StatusBadge
                              tone={SUBSCRIPTION_TONES[sub.status]}
                              label={SUBSCRIPTION_STATUS_LABELS[sub.status]}
                            />
                            <IconChevronRight className="" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {subscriptions.data && (
                <Pagination count={subscriptions.data.count} page={page} onPage={setPage} />
              )}
            </>
          )}
        </section>
      </div>

      {newOpen && canWrite && (
        <NewSubscriptionModal
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            setPage(1);
            subscriptions.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformSubscriptions;
