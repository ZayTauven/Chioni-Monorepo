'use client';
/*
 * Chioni — /plateforme/offres : le catalogue commercial (S5 lot 1, ADR 0018).
 *
 * Base Vireo : la table de `tables/DataTables` et la modale du socle, comme
 * l'écran « Tarifs » du centre dont celui-ci est le miroir côté éditeur.
 *
 * Trois choses que cet écran doit dire :
 *
 * 1. **Le prix est en francs ENTIERS.** Le backend refuse une décimale
 *    (« Le franc comorien ne porte pas de décimales. ») — l'aide du champ le
 *    dit AVANT le refus, et l'`input` porte `step={1}`.
 * 2. **Un changement de prix n'est JAMAIS rétroactif** : les factures déjà
 *    émises portent leur propre montant figé.
 * 3. **On ne supprime pas une offre**, on la retire du catalogue
 *    (`is_active: false`) : un contrat en cours la référence toujours.
 *
 * `support` LIT : ni le bouton « Créer », ni le bouton « Modifier » ne sont
 * montés pour lui.
 */
import { useState } from 'react';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import { createPlan, listPlans, updatePlan, type PlanPayload } from '@/lib/endpoints/platform';
import {
  BILLING_PERIOD_LABELS,
  BILLING_PERIOD_NOUNS,
  KMF_INTEGRAL_HINT,
  formatKmf,
} from '@/lib/labels';
import type { BillingPeriod, SubscriptionPlan } from '@/lib/types';
import {
  EmptyState,
  ErrorAlert,
  FieldError,
  IconEdit,
  IconPlus,
  Modal,
  ReadOnlyNotice,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  usePlatformRole,
} from './shared';

const PERIODS: BillingPeriod[] = ['mensuel', 'annuel'];

/** `null` = illimité — jamais « 0 », qui voudrait dire « aucun siège ». */
function quotaField(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function quotaText(value: number | null): string {
  return value === null ? 'Sans limite' : String(value);
}

function PlanModal({
  plan,
  onClose,
  onDone,
}: {
  /** `null` = création. */
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState(plan?.code ?? '');
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(
    plan ? String(Math.round(Number.parseFloat(plan.price_kmf))) : '',
  );
  const [period, setPeriod] = useState<BillingPeriod>(plan?.billing_period ?? 'mensuel');
  const [staff, setStaff] = useState(
    plan?.included_staff !== undefined && plan?.included_staff !== null
      ? String(plan.included_staff)
      : '',
  );
  const [practitioners, setPractitioners] = useState(
    plan?.included_practitioners !== undefined && plan?.included_practitioners !== null
      ? String(plan.included_practitioners)
      : '',
  );
  const [active, setActive] = useState(plan?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const payload: PlanPayload = {
      code: code.trim(),
      name: name.trim(),
      price_kmf: price.trim(),
      billing_period: period,
      included_staff: quotaField(staff),
      included_practitioners: quotaField(practitioners),
      is_active: active,
    };
    try {
      if (plan) await updatePlan(plan.id, payload);
      else await createPlan(payload);
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={plan ? `Modifier l’offre « ${plan.name} »` : 'Créer une offre'}
      onClose={onClose}
      width={620}
      busy={saving}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="plan-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || code.trim().length === 0 || name.trim().length === 0}
          >
            {saving ? 'Enregistrement…' : plan ? 'Enregistrer' : 'Créer l’offre'}
          </button>
        </>
      }
    >
      <form
        id="plan-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {plan && (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
            Un changement de prix n&apos;est <b>jamais rétroactif</b> : les factures déjà émises
            portent leur propre montant figé.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="plan-code">
              Code <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="plan-code"
              type="text"
              className={`ax-input${error?.fieldErrors.code ? ' is-invalid' : ''}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              data-autofocus=""
            />
            <FieldError error={error} field="code" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="plan-name">
              Nom commercial <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="plan-name"
              type="text"
              className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <FieldError error={error} field="name" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="plan-price">
              Prix <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="plan-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className={`ax-input${error?.fieldErrors.price_kmf ? ' is-invalid' : ''}`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              aria-describedby="plan-price-help"
            />
            <p id="plan-price-help" className="ax-field__message">
              {KMF_INTEGRAL_HINT}
            </p>
            <FieldError error={error} field="price_kmf" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="plan-period">
              Périodicité
            </label>
            <select
              id="plan-period"
              className="ax-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value as BillingPeriod)}
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {BILLING_PERIOD_NOUNS[p]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="billing_period" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="plan-staff">
              Membres inclus
            </label>
            <input
              id="plan-staff"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="ax-input"
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              placeholder="Sans limite"
              aria-describedby="plan-quota-help"
            />
            <FieldError error={error} field="included_staff" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="plan-practitioners">
              Praticiens inclus
            </label>
            <input
              id="plan-practitioners"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="ax-input"
              value={practitioners}
              onChange={(e) => setPractitioners(e.target.value)}
              placeholder="Sans limite"
              aria-describedby="plan-quota-help"
            />
            <FieldError error={error} field="included_practitioners" />
          </div>
        </div>
        {/* Les quotas sont MESURÉS et affichés, jamais opposés : le dire ici
            évite qu'un exploitant les prenne pour un plafond technique. */}
        <p id="plan-quota-help" className="ax-field__message">
          Laisser vide = sans limite. Ces quotas sont <b>indicatifs</b> : un centre qui les dépasse
          continue d&apos;inscrire des patients, d&apos;embaucher et de soigner.
        </p>

        <div className="ax-field">
          <label className="ax-cluster" htmlFor="plan-active" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)' }}>
            <input
              id="plan-active"
              type="checkbox"
              className="ax-checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Proposer cette offre aux nouveaux contrats
          </label>
          <p className="ax-field__message">
            Une offre retirée du catalogue reste en vigueur pour les contrats qui la portent — elle
            ne se supprime pas.
          </p>
        </div>
      </form>
    </Modal>
  );
}

/* ── écran ── */

export function PlatformPlans() {
  const { canWrite } = usePlatformRole();
  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [creating, setCreating] = useState(false);

  const plans = useAsync(() => listPlans(), []);
  const rows = plans.data ?? [];

  return (
    <>
      <PlatformPageHead
        title="Offres"
        subtitle="Ce que Chioni vend aux centres de santé — prix, périodicité et sièges inclus."
        actions={
          canWrite ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreating(true)}>
              <IconPlus />
              <span className="ax-btn__label">Créer une offre</span>
            </button>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Catalogue d'offres">
          {!canWrite && (
            <div className="ax-card__body" style={{ paddingBottom: 'var(--ax-space-3)' }}>
              <ReadOnlyNotice />
            </div>
          )}

          {plans.loading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : plans.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={plans.error} onRetry={plans.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucune offre au catalogue"
              message="Créez une première offre pour pouvoir ouvrir des contrats d'abonnement."
              action={
                canWrite ? (
                  <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setCreating(true)}>
                    <IconPlus />
                    <span className="ax-btn__label">Créer une offre</span>
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Offre</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Prix</th>
                    <th className="ax-table__th" scope="col">Membres inclus</th>
                    <th className="ax-table__th" scope="col">Praticiens inclus</th>
                    <th className="ax-table__th" scope="col">Catalogue</th>
                    {canWrite && <th className="ax-table__th" scope="col">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((plan) => (
                    <tr key={plan.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>
                          {plan.name}
                        </div>
                        <div
                          className="ax-num"
                          style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}
                        >
                          {plan.code}
                        </div>
                      </td>
                      <td
                        className="ax-table__td ax-table__td--num ax-num"
                        style={{ fontFamily: 'var(--ax-font-mono)', whiteSpace: 'nowrap' }}
                      >
                        {formatKmf(plan.price_kmf)}
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {BILLING_PERIOD_LABELS[plan.billing_period]}
                        </div>
                      </td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                        {quotaText(plan.included_staff)}
                      </td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                        {quotaText(plan.included_practitioners)}
                      </td>
                      <td className="ax-table__td">
                        <StatusBadge
                          tone={plan.is_active ? 'success' : 'neutral'}
                          label={plan.is_active ? 'Proposée' : 'Retirée'}
                        />
                      </td>
                      {canWrite && (
                        <td className="ax-table__td">
                          <button
                            type="button"
                            className="ax-btn ax-btn--ghost ax-btn--sm"
                            onClick={() => setEditing(plan)}
                            aria-label={`Modifier l’offre ${plan.name}`}
                          >
                            <IconEdit />
                            <span className="ax-btn__label">Modifier</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {(creating || editing) && canWrite && (
        <PlanModal
          plan={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            plans.reload();
          }}
        />
      )}
    </>
  );
}

export default PlatformPlans;
