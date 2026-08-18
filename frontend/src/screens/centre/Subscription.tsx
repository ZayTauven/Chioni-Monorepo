'use client';
/*
 * Chioni — /centre/abonnement : le contrat du centre (S5, ADR 0018).
 *
 * **DIRECTEUR SEUL**, parce que le backend l'a tranché ainsi (lot 1 §18 :
 * `GET /centers/{c}/subscription/` et `.../subscription/invoices/` sont
 * directeur seul, par symétrie avec le dossier KYC et le journal d'audit).
 * L'écran est auto-gardé — le rôle est vérifié AVANT tout fetch — et l'entrée
 * de sidebar porte la même garde (`NAV_ROLE_GATES`) : sans ça, l'écran
 * s'afficherait pour recevoir un 403.
 *
 * Trois honnêtetés portées ici :
 *
 * 1. **404 = état NORMAL.** « Ce centre n'a pas encore d'abonnement » n'est pas
 *    une erreur : tous les centres nés avant S5 sont dans ce cas. État vide
 *    bienveillant, jamais un bandeau rouge.
 * 2. **Les quotas sont une INFORMATION.** « 18 praticiens sur 15 inclus »
 *    s'affiche comme un signal commercial ; aucun formulaire du produit ne se
 *    désactive à cause d'un dépassement, et l'écran le dit noir sur blanc.
 * 3. **Le règlement se fait hors ligne.** Aucun bouton « Payer » n'est
 *    construit : les rails comoriens ne sont pas instruits (risque n° 1 non
 *    tranché), l'exploitant enregistre le règlement reçu. Promettre un
 *    paiement en ligne qui n'existe pas serait pire que de ne rien proposer.
 *
 * Base Vireo : la carte de facture et la liste filtrable de
 * `ecommerce/Invoices` (mêmes `ax-card` / `ax-table`), déjà adaptées pour les
 * factures patient et les impayés.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { getSubscription, listSubscriptionInvoices } from '@/lib/endpoints/centers';
import {
  BILLING_PERIOD_LABELS,
  QUOTA_OVER_NOTICE,
  QUOTA_WITHIN_NOTICE,
  SUBSCRIPTION_DIRECTOR_ONLY_MESSAGE,
  SUBSCRIPTION_DIRECTOR_ONLY_TITLE,
  SUBSCRIPTION_FROZEN_CLOSED,
  SUBSCRIPTION_INVOICE_BALANCE_LABEL,
  SUBSCRIPTION_INVOICE_STATUS_LABELS,
  SUBSCRIPTION_NONE_MESSAGE,
  SUBSCRIPTION_NONE_TITLE,
  SUBSCRIPTION_NO_INVOICE_YET,
  SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE,
  SUBSCRIPTION_REASON_PRIVACY,
  SUBSCRIPTION_REASON_TITLE,
  SUBSCRIPTION_STATUS_HELP,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STILL_WORKS,
  SUBSCRIPTION_TERMINATED_DATA,
  SUBSCRIPTION_UNPAID_NOTHING_CLOSED,
  formatDate,
  formatKmf,
  quotaSummary,
} from '@/lib/labels';
import type { CenterSubscription } from '@/lib/types';
import {
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  IconChevronRight,
  Pagination,
  SUBSCRIPTION_INVOICE_TONES,
  SUBSCRIPTION_TONES,
  StatusBadge,
  TableSkeleton,
  hasRole,
  useAsync,
} from './shared';

/* ── l'offre et son état ── */

function ContractCard({ subscription }: { subscription: CenterSubscription }) {
  const { plan } = subscription;

  return (
    <section className="ax-card ax-col--7" role="region" aria-label="Votre offre Chioni">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">{plan.name}</h2>
          <p className="ax-card__subtitle">{SUBSCRIPTION_STATUS_HELP[subscription.status]}</p>
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--ax-space-4)',
          }}
        >
          <DetailItem label="Prix de l’offre">
            <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>
              {formatKmf(plan.price_kmf)}
            </b>{' '}
            {BILLING_PERIOD_LABELS[plan.billing_period]}
          </DetailItem>
          <DetailItem label="Prochaine échéance">
            {subscription.current_period_end
              ? formatDate(subscription.current_period_end)
              : 'Pas encore fixée'}
          </DetailItem>
          <DetailItem label="Abonné depuis">{formatDate(subscription.started_at)}</DetailItem>
          <DetailItem label="Dernière décision">
            {subscription.status_updated_at
              ? formatDate(subscription.status_updated_at)
              : 'Aucune décision encore'}
          </DetailItem>
        </div>

        {/* Le motif de la dernière décision — lu par le directeur, et par lui
            seul (patron `kyc_reason`). Titre par état : après une
            réactivation, « Ce qu'il faut régulariser » sonnerait comme un
            reproche adressé à quelqu'un qui vient d'être rétabli. */}
        {subscription.status_reason && (
          <div
            className={`ax-alert ${
              subscription.is_frozen ? 'ax-alert--warning' : 'ax-alert--info'
            }`}
            role="note"
          >
            <div className="ax-alert__content">
              <p className="ax-alert__title">{SUBSCRIPTION_REASON_TITLE[subscription.status]}</p>
              <p className="ax-alert__message">{subscription.status_reason}</p>
              <p className="ax-alert__message" style={{ color: 'var(--ax-text-muted)' }}>
                {SUBSCRIPTION_REASON_PRIVACY}
              </p>
            </div>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          {SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE}
        </p>
      </div>
    </section>
  );
}

/* ── les quotas : mesurés, affichés… et jamais opposés ── */

function UsageCard({ subscription }: { subscription: CenterSubscription }) {
  const { usage } = subscription;
  const rows = [
    {
      key: 'staff' as const,
      label: 'Votre équipe',
      text: quotaSummary(usage.staff, usage.included_staff, 'staff'),
      over: usage.exceeded.includes('staff'),
    },
    {
      key: 'practitioners' as const,
      label: 'Vos praticiens',
      text: quotaSummary(usage.practitioners, usage.included_practitioners, 'practitioners'),
      over: usage.exceeded.includes('practitioners'),
    },
  ];

  return (
    <section className="ax-card ax-col--5" role="region" aria-label="Votre usage">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Votre usage</h2>
          <p className="ax-card__subtitle">
            Une personne compte pour une place, même si elle porte deux casquettes.
          </p>
        </div>
      </div>
      <div
        className="ax-card__body"
        style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        <ul className="ax-list ax-list--compact">
          {rows.map((row) => (
            <li key={row.key} className="ax-list__row">
              <span className="ax-list__content">
                <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                  {row.label}
                </span>
                <span
                  className="ax-num"
                  style={{
                    display: 'block',
                    fontFamily: 'var(--ax-font-mono)',
                    fontSize: 'var(--ax-text-sm)',
                    color: 'var(--ax-text-muted)',
                  }}
                >
                  {row.text}
                </span>
              </span>
              {row.over && (
                <span className="ax-list__trailing">
                  <StatusBadge tone="warning" label="Au-delà de l’offre" />
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Le dépassement est un signal COMMERCIAL, jamais un verrou : le ton
            de la carte le dit (`info`, pas `warning`), et la phrase aussi. */}
        <div className={`ax-alert ${usage.over_quota ? 'ax-alert--info' : 'ax-alert--success'}`} role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message">
              {usage.over_quota ? QUOTA_OVER_NOTICE : QUOTA_WITHIN_NOTICE}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── ce que l'état de l'abonnement change, et ce qu'il ne change pas ── */

function EffectsCard({ subscription }: { subscription: CenterSubscription }) {
  if (subscription.status === 'essai' || subscription.status === 'actif') return null;

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Ce qui fonctionne">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Ce qui continue de fonctionner</h2>
        </div>
      </div>
      <div
        className="ax-card__body"
        style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
      >
        {/* L'ordre n'est pas décoratif : on dit CE QUI CONTINUE avant ce qui
            est fermé. Suspendre ne doit jamais empêcher de soigner, et le
            découvrir dans cet ordre-là évite la panique du « tout est cassé ». */}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
          {SUBSCRIPTION_STILL_WORKS}
        </p>
        {subscription.is_frozen ? (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
            {SUBSCRIPTION_FROZEN_CLOSED}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
            {SUBSCRIPTION_UNPAID_NOTHING_CLOSED}
          </p>
        )}
        {subscription.status === 'resilie' && (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
            {SUBSCRIPTION_TERMINATED_DATA}
          </p>
        )}
      </div>
    </section>
  );
}

/* ── les factures d'abonnement (lecture seule de bout en bout) ── */

function InvoicesCard({ centerId }: { centerId: number }) {
  const [page, setPage] = useState(1);
  const invoices = useAsync(() => listSubscriptionInvoices(centerId, { page }), [centerId, page]);
  const rows = invoices.data?.results ?? [];

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Vos factures d'abonnement">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Vos factures d’abonnement</h2>
          <p className="ax-card__subtitle">
            Émises par Chioni. Le règlement se fait hors de l’application — cet écran suit ce qui a
            été reçu.
          </p>
        </div>
      </div>

      {invoices.loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : invoices.error ? (
        <div style={{ padding: 'var(--ax-space-4)' }}>
          <ErrorAlert error={invoices.error} onRetry={invoices.reload} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune facture pour l’instant" message={SUBSCRIPTION_NO_INVOICE_YET} />
      ) : (
        <>
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">
                    Facture
                  </th>
                  <th className="ax-table__th" scope="col">
                    Période
                  </th>
                  <th className="ax-table__th" scope="col">
                    Échéance
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">
                    Montant
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">
                    {SUBSCRIPTION_INVOICE_BALANCE_LABEL}
                  </th>
                  <th className="ax-table__th" scope="col">
                    État
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => (
                  <tr key={invoice.id} className="ax-table__row">
                    <td className="ax-table__td">
                      <Link
                        href={`/centre/abonnement/factures/${invoice.id}`}
                        className="ax-link ax-num"
                        style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)' }}
                      >
                        {invoice.number}
                      </Link>
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
                      style={{
                        fontFamily: 'var(--ax-font-mono)',
                        whiteSpace: 'nowrap',
                        color:
                          Number.parseFloat(invoice.balance_kmf) > 0
                            ? 'var(--ax-text-strong)'
                            : 'var(--ax-text-muted)',
                      }}
                    >
                      {formatKmf(invoice.balance_kmf)}
                    </td>
                    <td className="ax-table__td">
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}
                      >
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

export function Subscription() {
  const { centerId, roles } = useCenter();
  const isDirector = hasRole(roles, ['directeur']);

  const subscription = useAsync(
    () => (isDirector ? getSubscription(centerId) : Promise.resolve(null)),
    [centerId, isDirector],
  );

  if (!isDirector) {
    return (
      <>
        <PageHead title="Mon abonnement" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <EmptyState
                title={SUBSCRIPTION_DIRECTOR_ONLY_TITLE}
                message={SUBSCRIPTION_DIRECTOR_ONLY_MESSAGE}
              />
            </div>
          </section>
        </div>
      </>
    );
  }

  // 404 = « ce centre n'a pas encore d'abonnement » : un état, pas une panne.
  const noContract = subscription.error?.status === 404;

  return (
    <>
      <PageHead
        title="Mon abonnement"
        subtitle="Votre offre, votre usage et les factures que Chioni vous adresse."
      />

      <div className="ax-dash-grid">
        {subscription.loading ? (
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <CardSkeleton lines={6} />
            </div>
          </section>
        ) : noContract ? (
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <EmptyState title={SUBSCRIPTION_NONE_TITLE} message={SUBSCRIPTION_NONE_MESSAGE} />
            </div>
          </section>
        ) : subscription.error ? (
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <ErrorAlert error={subscription.error} onRetry={subscription.reload} />
            </div>
          </section>
        ) : subscription.data ? (
          <>
            {/* L'ORDRE EST L'ARBITRAGE PRODUIT (revue UX care S5).
                « Ce qui continue » était rendu en TROISIÈME position, sous deux
                cartes : un directeur gelé lisait « Gestion suspendue » et le
                motif de la sanction, puis devait faire défiler pour apprendre
                qu'il peut encore soigner, inscrire, facturer et encaisser. Sur
                un écran de portable, la réassurance était sous la ligne de
                flottaison. Elle passe en tête — exactement comme dans le
                bandeau du tableau de bord, qui, lui, tenait déjà l'ordre.
                La carte ne se monte pas sur `essai` / `actif` : rien à
                rassurer quand rien n'est fermé. */}
            <EffectsCard subscription={subscription.data} />
            <ContractCard subscription={subscription.data} />
            <UsageCard subscription={subscription.data} />
          </>
        ) : null}

        {/* Les factures restent lisibles même sans contrat en base : « pas de
            contrat » et « pas encore de facture » sont deux nouvelles
            différentes, et l'API les traite différemment (404 vs 200 vide). */}
        <InvoicesCard centerId={centerId} />
      </div>
    </>
  );
}

export default Subscription;
