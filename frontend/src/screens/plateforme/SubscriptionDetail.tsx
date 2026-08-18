'use client';
/*
 * Chioni — /plateforme/abonnements/[id] : la fiche d'un contrat (S5, ADR 0018).
 *
 * Quatre blocs : le contrat, les sièges consommés, les transitions d'état, et
 * les factures SaaS de ce tenant (avec l'émission manuelle).
 *
 * **Le poids de la décision est porté par l'UI, pas seulement par l'API** —
 * patron de la modale KYC de S4. Suspendre un abonnement gèle le personnel,
 * les tarifs et les statistiques, ET RIEN D'AUTRE : le centre continue de
 * soigner, d'inscrire au guichet, de facturer et d'encaisser, et les paiements
 * de la diaspora continuent d'arriver. La modale le dit AVANT le clic, avec le
 * motif obligatoire — qui sera lu par le directeur du centre.
 *
 * Rôles : `support` LIT (aucune commande d'écriture n'est montée pour lui,
 * pas même désactivée) ; `admin` écrit.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import {
  changeSubscriptionPlan,
  getPlatformSubscription,
  issueSubscriptionInvoice,
  listPlans,
  listSubscriptionInvoicesOf,
  setSubscriptionStatus,
} from '@/lib/endpoints/platform';
import {
  BILLING_PERIOD_LABELS,
  QUOTA_OVER_NOTICE,
  QUOTA_WITHIN_NOTICE,
  SUBSCRIPTION_INVOICE_BALANCE_LABEL,
  SUBSCRIPTION_INVOICE_STATUS_LABELS,
  SUBSCRIPTION_ISSUE_NOTICE,
  SUBSCRIPTION_NO_AUTO_CUT,
  SUBSCRIPTION_REASON_HELP,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_SUSPEND_WARNING,
  SUBSCRIPTION_TERMINATE_WARNING,
  SUBSCRIPTION_UNFREEZE_NOTICE,
  SUBSCRIPTION_UNPAID_FLAG_NOTICE,
  formatDate,
  formatKmf,
  quotaSummary,
} from '@/lib/labels';
import type { PlatformSubscription, SubscriptionStatus } from '@/lib/types';
import {
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconChevronRight,
  IconPlus,
  Modal,
  Pagination,
  ReadOnlyNotice,
  Ref,
  SUBSCRIPTION_INVOICE_TONES,
  SUBSCRIPTION_TONES,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  usePlatformRole,
} from './shared';

/**
 * La machine à états du backend, recopiée pour NE PROPOSER que des transitions
 * légales : un bouton qui mènerait droit à « Transition refusée » apprendrait
 * à l'exploitant à se méfier de l'écran.
 */
const TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  essai: ['actif', 'impaye', 'suspendu', 'resilie'],
  actif: ['impaye', 'suspendu', 'resilie'],
  impaye: ['actif', 'suspendu', 'resilie'],
  suspendu: ['actif', 'impaye', 'resilie'],
  resilie: ['actif'],
};

/** Ce que la transition déclenche, dit avant le clic. */
function transitionWarning(target: SubscriptionStatus): string {
  if (target === 'suspendu') return SUBSCRIPTION_SUSPEND_WARNING;
  if (target === 'resilie') return SUBSCRIPTION_TERMINATE_WARNING;
  if (target === 'impaye') return SUBSCRIPTION_UNPAID_FLAG_NOTICE;
  return SUBSCRIPTION_UNFREEZE_NOTICE;
}

const REASON_REQUIRED: SubscriptionStatus[] = ['suspendu', 'resilie'];

function TransitionModal({
  subscription,
  target,
  onClose,
  onDone,
}: {
  subscription: PlatformSubscription;
  target: SubscriptionStatus;
  onClose: () => void;
  onDone: (fresh: PlatformSubscription) => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const mandatory = REASON_REQUIRED.includes(target);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await setSubscriptionStatus(subscription.id, target, reason.trim());
      onDone(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${SUBSCRIPTION_STATUS_LABELS[target]} — ${subscription.center_name}`}
      onClose={onClose}
      width={600}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            Annuler
          </button>
          <button
            type="submit"
            form="subscription-transition-form"
            className={`ax-btn ${mandatory ? 'ax-btn--danger' : 'ax-btn--primary'}`}
            disabled={saving || (mandatory && reason.trim().length === 0)}
          >
            {saving ? 'Enregistrement…' : `Passer en « ${SUBSCRIPTION_STATUS_LABELS[target]} »`}
          </button>
        </>
      }
    >
      <form
        id="subscription-transition-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
          {transitionWarning(target)}
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="subscription-reason">
            Motif{' '}
            {mandatory ? (
              <span className="ax-field__required" aria-hidden="true">*</span>
            ) : (
              <span style={{ color: 'var(--ax-text-muted)', fontWeight: 400 }}>(facultatif)</span>
            )}
          </label>
          <textarea
            id="subscription-reason"
            className={`ax-input${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={mandatory}
            aria-describedby="subscription-reason-help"
          />
          <p id="subscription-reason-help" className="ax-field__message">
            {SUBSCRIPTION_REASON_HELP}
          </p>
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── changement d'offre ── */

function PlanModal({
  subscription,
  onClose,
  onDone,
}: {
  subscription: PlatformSubscription;
  onClose: () => void;
  onDone: (fresh: PlatformSubscription) => void;
}) {
  const plans = useAsync(() => listPlans(true), []);
  const [planId, setPlanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await changeSubscriptionPlan(subscription.id, Number.parseInt(planId, 10));
      onDone(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Changer d’offre"
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
            form="plan-change-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !planId}
          >
            {saving ? 'Enregistrement…' : 'Changer d’offre'}
          </button>
        </>
      }
    >
      <form
        id="plan-change-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* Un changement d'offre n'est JAMAIS rétroactif : les factures déjà
            émises portent leur propre montant figé. */}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          Rien de déjà facturé ne change&nbsp;: les factures émises portent leur montant figé. La
          nouvelle offre s&apos;applique à partir de la période suivante.
        </p>

        <div className="ax-field">
          <label className="ax-label" htmlFor="plan-target">
            Nouvelle offre <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <select
            id="plan-target"
            className="ax-select"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            required
            data-autofocus=""
          >
            <option value="">Choisir une offre…</option>
            {(plans.data ?? [])
              .filter((plan) => plan.id !== subscription.plan.id)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {formatKmf(plan.price_kmf)}{' '}
                  {BILLING_PERIOD_LABELS[plan.billing_period]}
                </option>
              ))}
          </select>
          <FieldError error={error} field="plan" />
        </div>
      </form>
    </Modal>
  );
}

/* ── les factures SaaS de ce tenant ── */

function InvoicesCard({ subscriptionId, canWrite }: { subscriptionId: number; canWrite: boolean }) {
  const [page, setPage] = useState(1);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<ApiError | null>(null);
  const invoices = useAsync(() => listSubscriptionInvoicesOf(subscriptionId, page), [subscriptionId, page]);
  const rows = invoices.data?.results ?? [];

  const issue = async () => {
    setIssuing(true);
    setIssueError(null);
    try {
      await issueSubscriptionInvoice(subscriptionId);
      setPage(1);
      invoices.reload();
    } catch (err) {
      setIssueError(toApiError(err));
    }
    setIssuing(false);
  };

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Factures d'abonnement du contrat">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Factures de ce contrat</h2>
          <p className="ax-card__subtitle">Série « A- », globale Chioni — plus récente d&apos;abord.</p>
        </div>
        {canWrite && (
          <button
            type="button"
            className="ax-btn ax-btn--secondary ax-btn--sm"
            onClick={() => void issue()}
            disabled={issuing}
          >
            <IconPlus />
            <span className="ax-btn__label">{issuing ? 'Émission…' : 'Émettre la période due'}</span>
          </button>
        )}
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, paddingBottom: 'var(--ax-space-3)' }}>
        {issueError && <ErrorAlert error={issueError} />}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {SUBSCRIPTION_ISSUE_NOTICE}
        </p>
      </div>

      {invoices.loading ? (
        <TableSkeleton rows={4} cols={5} />
      ) : invoices.error ? (
        <div style={{ padding: 'var(--ax-space-4)' }}>
          <ErrorAlert error={invoices.error} onRetry={invoices.reload} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucune facture émise"
          message="La première facture partira à la fin de la période en cours — ou dès maintenant si la période est arrivée à terme."
        />
      ) : (
        <>
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Facture</th>
                  <th className="ax-table__th" scope="col">Période</th>
                  <th className="ax-table__th" scope="col">Échéance</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
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
                      {/* `issued_by: null` = émission AUTOMATIQUE par la tâche
                          planifiée, jamais un oubli. */}
                      {invoice.issued_by === null && (
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          Émise automatiquement
                        </div>
                      )}
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(invoice.period_start)} — {formatDate(invoice.period_end)}
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(invoice.due_date)}
                    </td>
                    <td
                      className="ax-table__td ax-table__td--num ax-num"
                      style={{ fontFamily: 'var(--ax-font-mono)', whiteSpace: 'nowrap' }}
                    >
                      {formatKmf(invoice.amount_kmf)}
                    </td>
                    <td
                      className="ax-table__td ax-table__td--num ax-num"
                      style={{ fontFamily: 'var(--ax-font-mono)', whiteSpace: 'nowrap' }}
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
  );
}

/* ── écran ── */

export function PlatformSubscriptionDetail({ subscriptionId }: { subscriptionId: number }) {
  const { canWrite } = usePlatformRole();
  const [patched, setPatched] = useState<PlatformSubscription | null>(null);
  const [target, setTarget] = useState<SubscriptionStatus | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const state = useAsync(() => getPlatformSubscription(subscriptionId), [subscriptionId]);
  /* Le contrat renvoyé par une transition prime sur le fetch — mais il ne
     décrit QUE l'id courant. Sans cette remise à zéro, un changement de route
     sans démontage figerait l'état commercial du tenant précédent sous le nom
     du nouveau. Durcissement (aucun lien contrat→contrat n'existe). */
  useEffect(() => setPatched(null), [subscriptionId]);
  const subscription = patched ?? state.data;

  if (!subscription) {
    return (
      <>
        <PlatformPageHead
          title="Contrat"
          trail={[{ label: 'Abonnements', href: '/plateforme/abonnements' }, { label: 'Contrat' }]}
        />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              {state.error ? (
                <ErrorAlert error={state.error} onRetry={state.reload} />
              ) : (
                <CardSkeleton lines={6} />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  const { usage } = subscription;

  return (
    <>
      <PlatformPageHead
        title={subscription.center_name}
        subtitle={`Contrat ${subscription.plan.name} · ${formatKmf(subscription.plan.price_kmf)} ${BILLING_PERIOD_LABELS[subscription.plan.billing_period]}`}
        trail={[
          { label: 'Abonnements', href: '/plateforme/abonnements' },
          { label: subscription.center_name },
        ]}
      />

      <div className="ax-dash-grid">
        {/* ── le contrat ── */}
        <section className="ax-card ax-col--7" role="region" aria-label="Le contrat">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Le contrat</h2>
              <p className="ax-card__subtitle">
                L&apos;abonnement gouverne l&apos;administratif. La vérification (KYC), qui gouverne
                le Pont de Confiance, est un autre axe —{' '}
                <Link href={`/plateforme/centres/${subscription.center}`} className="ax-link">
                  fiche du centre
                </Link>
                .
              </p>
            </div>
            <StatusBadge
              tone={SUBSCRIPTION_TONES[subscription.status]}
              label={SUBSCRIPTION_STATUS_LABELS[subscription.status]}
            />
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
              <DetailItem label="Offre">{subscription.plan.name}</DetailItem>
              <DetailItem label="Prix">
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                  {formatKmf(subscription.plan.price_kmf)}
                </span>{' '}
                {BILLING_PERIOD_LABELS[subscription.plan.billing_period]}
              </DetailItem>
              <DetailItem label="Souscrit le">{formatDate(subscription.started_at)}</DetailItem>
              <DetailItem label="Fin de période">
                {subscription.current_period_end ? formatDate(subscription.current_period_end) : '—'}
              </DetailItem>
              <DetailItem label="Dernière décision">
                {subscription.status_updated_at ? formatDate(subscription.status_updated_at) : '—'}
              </DetailItem>
              <DetailItem label="Motif de la dernière décision">
                {subscription.status_reason || '—'}
              </DetailItem>
            </div>

            {canWrite ? (
              <div>
                <button
                  type="button"
                  className="ax-btn ax-btn--secondary ax-btn--sm"
                  onClick={() => setPlanOpen(true)}
                >
                  <span className="ax-btn__label">Changer d’offre</span>
                </button>
              </div>
            ) : (
              <ReadOnlyNotice />
            )}

            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              Référence&nbsp;: <Ref>contrat #{subscription.id}</Ref> · <Ref>centre #{subscription.center}</Ref>
            </p>
          </div>
        </section>

        {/* ── les sièges ── */}
        <section className="ax-card ax-col--5" role="region" aria-label="Sièges consommés">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Sièges consommés</h2>
              <p className="ax-card__subtitle">Une personne = un siège, même avec deux casquettes.</p>
            </div>
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--ax-space-4)' }}>
              <DetailItem label="Personnel">
                {quotaSummary(usage.staff, usage.included_staff, 'staff')}
              </DetailItem>
              <DetailItem label="Praticiens">
                {quotaSummary(usage.practitioners, usage.included_practitioners, 'practitioners')}
              </DetailItem>
            </div>
            {/* Signal COMMERCIAL, jamais un levier de blocage : ce centre
                continue d'inscrire, de soigner et d'embaucher. */}
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {usage.over_quota ? QUOTA_OVER_NOTICE : QUOTA_WITHIN_NOTICE}
            </p>
          </div>
        </section>

        {/* ── transitions ── */}
        <section className="ax-card ax-col--12" role="region" aria-label="État commercial">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">État commercial</h2>
              <p className="ax-card__subtitle">
                Geler l&apos;administration d&apos;un centre est une sanction&nbsp;: elle se décide,
                se motive et se trace. Elle n&apos;empêche jamais de soigner.
              </p>
            </div>
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
          >
            {canWrite ? (
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                {TRANSITIONS[subscription.status].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ax-btn ${
                      REASON_REQUIRED.includes(t) ? 'ax-btn--danger' : 'ax-btn--secondary'
                    } ax-btn--sm`}
                    onClick={() => setTarget(t)}
                  >
                    <span className="ax-btn__label">{SUBSCRIPTION_STATUS_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <ReadOnlyNotice />
            )}
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {SUBSCRIPTION_NO_AUTO_CUT}
            </p>
          </div>
        </section>

        <InvoicesCard subscriptionId={subscription.id} canWrite={canWrite} />
      </div>

      {target && canWrite && (
        <TransitionModal
          subscription={subscription}
          target={target}
          onClose={() => setTarget(null)}
          onDone={(fresh) => {
            setPatched(fresh);
            setTarget(null);
          }}
        />
      )}
      {planOpen && canWrite && (
        <PlanModal
          subscription={subscription}
          onClose={() => setPlanOpen(false)}
          onDone={(fresh) => {
            setPatched(fresh);
            setPlanOpen(false);
          }}
        />
      )}
    </>
  );
}

export default PlatformSubscriptionDetail;
