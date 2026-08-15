'use client';
/*
 * Chioni — /centre/abonnement/factures/[id] : la facture d'abonnement, en
 * papier imprimable (S5, ADR 0018 lot 2).
 *
 * **DIRECTEUR SEUL**, même audience que le contrat lui-même — l'écran est
 * auto-gardé avant tout fetch.
 *
 * Base Vireo : `ecommerce/InvoiceDetails`, adaptée en composant partagé
 * `components/documents/DocumentPaper` **paramétré par l'émetteur**. Ici
 * l'émetteur est CHIONI et le destinataire est le centre : le logo du papier
 * est donc la marque Chioni, pas celui du centre. Le même composant rendra
 * une facture patient (émetteur = le centre, son logo depuis l'API) et les
 * reçus « R- » / « G- » sans réécriture.
 *
 * **Lecture seule de bout en bout** : c'est Chioni qui émet, encaisse et
 * corrige. Aucun bouton d'action n'est construit sur cet écran — pas même un
 * « Payer », parce que le règlement se fait hors ligne (rails comoriens non
 * instruits, hors périmètre acté).
 */
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { DocumentPaper, PrintDocumentButton } from '@/components/documents/DocumentPaper';
import { useCenter } from '@/context/CenterContext';
import { getSubscriptionInvoice } from '@/lib/endpoints/centers';
import {
  CENTER_RECIPIENT_QUALIFIER,
  CHIONI_ISSUER,
  DOC_AMOUNT_HEADER,
  DOC_ISSUER_LABEL,
  DOC_KIND_INVOICE,
  DOC_LINES_HEADER,
  DOC_PAYMENT_LABEL,
  DOC_RECIPIENT_LABEL,
  DOC_VOIDED_LABEL,
  SUBSCRIPTION_INVOICE_BALANCE_LABEL,
  SUBSCRIPTION_INVOICE_PAID_LABEL,
  SUBSCRIPTION_INVOICE_SETTLED_LABEL,
  SUBSCRIPTION_INVOICE_STATUS_LABELS,
  SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE,
  SUBSCRIPTION_PARTIAL_NOTICE,
  SUBSCRIPTION_PAYMENT_METHOD_LABELS,
  SUBSCRIPTION_PAYMENT_REVERSED_LABEL,
  SUBSCRIPTION_DIRECTOR_ONLY_MESSAGE,
  SUBSCRIPTION_DIRECTOR_ONLY_TITLE,
  formatDate,
  formatKmf,
  subscriptionPeriodLine,
} from '@/lib/labels';
import type { CenterSubscriptionInvoice } from '@/lib/types';
import {
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  SUBSCRIPTION_INVOICE_TONES,
  StatusBadge,
  hasRole,
  useAsync,
} from './shared';

/* ── l'historique des règlements, hors du papier ── */

function PaymentsCard({ invoice }: { invoice: CenterSubscriptionInvoice }) {
  return (
    <section
      className="ax-card ax-print-hide"
      role="region"
      aria-label="Règlements reçus par Chioni"
    >
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Règlements reçus</h2>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {invoice.payments.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
            Aucun règlement enregistré pour l’instant. {SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE}
          </p>
        ) : (
          <ul className="ax-list ax-list--compact">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="ax-list__row">
                <span className="ax-list__content">
                  <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                      {formatKmf(payment.amount_kmf)}
                    </span>{' '}
                    · {SUBSCRIPTION_PAYMENT_METHOD_LABELS[payment.method]}
                  </span>
                  {/* Date et référence d'un règlement = de l'information que le
                      directeur peut avoir à rapprocher de son relevé :
                      `--ax-text-muted` (AA), jamais `--ax-text-subtle`. */}
                  <span
                    style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}
                  >
                    Reçu le {formatDate(payment.received_at)}
                    {payment.reference ? ` · référence ${payment.reference}` : ''}
                  </span>
                  {/* Le motif d'une annulation est RENDU : le fait sans le
                      pourquoi serait pire qu'inutile pour un directeur qui
                      voit son solde remonter. */}
                  {payment.reversed && payment.reversal_reason && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--ax-text-xs)',
                        color: 'var(--ax-text-muted)',
                        marginTop: 2,
                      }}
                    >
                      Motif&nbsp;: {payment.reversal_reason}
                    </span>
                  )}
                </span>
                {payment.reversed && (
                  <span className="ax-list__trailing">
                    <StatusBadge tone="neutral" label={SUBSCRIPTION_PAYMENT_REVERSED_LABEL} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── écran ── */

export function SubscriptionInvoiceScreen({ invoiceId }: { invoiceId: number }) {
  const { centerId, center, roles } = useCenter();
  const isDirector = hasRole(roles, ['directeur']);

  const state = useAsync(
    () => (isDirector ? getSubscriptionInvoice(centerId, invoiceId) : Promise.resolve(null)),
    [centerId, invoiceId, isDirector],
  );

  if (!isDirector) {
    return (
      <>
        <PageHead title="Facture d’abonnement" />
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

  const invoice = state.data;

  if (state.loading || !invoice) {
    return (
      <>
        <PageHead title="Facture d’abonnement" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              {state.error ? (
                <ErrorAlert error={state.error} onRetry={state.reload} />
              ) : (
                <CardSkeleton lines={8} />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  const balance = Number.parseFloat(invoice.balance_kmf);
  const paid = Number.parseFloat(invoice.paid_kmf);
  const cancelled = invoice.status === 'annulee';
  const partial = !cancelled && paid > 0 && balance > 0;

  return (
    <>
      <PageHead
        title={invoice.number}
        subtitle={`Facture d’abonnement émise par Chioni · échéance du ${formatDate(invoice.due_date)}`}
        actions={<PrintDocumentButton />}
      />

      <div className="ax-dash-grid">
        <div className="ax-col--8">
          <DocumentPaper
            markId={`sub-invoice-${invoice.id}`}
            kind={DOC_KIND_INVOICE}
            number={invoice.number}
            statusBadge={
              <StatusBadge
                tone={SUBSCRIPTION_INVOICE_TONES[invoice.status]}
                label={SUBSCRIPTION_INVOICE_STATUS_LABELS[invoice.status]}
              />
            }
            voidedLabel={cancelled ? DOC_VOIDED_LABEL : undefined}
            issuerLabel={DOC_ISSUER_LABEL}
            recipientLabel={DOC_RECIPIENT_LABEL}
            issuer={{
              name: CHIONI_ISSUER.name,
              qualifier: CHIONI_ISSUER.qualifier,
              lines: [...CHIONI_ISSUER.lines],
              useChioniMark: true,
            }}
            recipient={{
              name: center.name,
              qualifier: CENTER_RECIPIENT_QUALIFIER,
              logo: center.logo,
              lines: [center.city].filter(Boolean),
            }}
            meta={[
              { label: 'Émise le', value: formatDate(invoice.created_at) },
              { label: 'Échéance', value: formatDate(invoice.due_date) },
              { label: 'Offre', value: invoice.plan_label },
            ]}
            lineHeaders={{ label: DOC_LINES_HEADER, amount: DOC_AMOUNT_HEADER }}
            lines={[
              {
                key: invoice.id,
                label: invoice.plan_label,
                sub: subscriptionPeriodLine(
                  formatDate(invoice.period_start),
                  formatDate(invoice.period_end),
                ),
                amount: formatKmf(invoice.amount_kmf),
              },
            ]}
            totals={[
              { label: 'Total', value: formatKmf(invoice.amount_kmf) },
              {
                label: SUBSCRIPTION_INVOICE_PAID_LABEL,
                value: formatKmf(invoice.paid_kmf),
                tone: 'muted',
              },
              {
                label: SUBSCRIPTION_INVOICE_BALANCE_LABEL,
                value: formatKmf(invoice.balance_kmf),
                tone: balance > 0 ? 'default' : 'success',
                highlight: true,
              },
            ]}
            notes={
              cancelled ? (
                <>
                  <b style={{ color: 'var(--ax-text-strong)' }}>Facture annulée par Chioni</b>
                  {invoice.cancelled_at ? ` le ${formatDate(invoice.cancelled_at)}` : ''}.
                  {invoice.cancel_reason ? ` Motif : ${invoice.cancel_reason}` : ''}
                </>
              ) : undefined
            }
            paymentDetailsLabel={DOC_PAYMENT_LABEL}
            paymentDetails={SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE}
          />
        </div>

        {/* Rail droit — composé ici, avec des données réelles, plutôt que
            porté par le papier : le papier reste le papier. */}
        <aside
          className="ax-col--4 ax-print-hide"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ax-space-6)',
            minWidth: 0,
            alignSelf: 'start',
          }}
        >
          <section className="ax-card" role="region" aria-label="Reste à régler">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">{SUBSCRIPTION_INVOICE_BALANCE_LABEL}</h2>
              </div>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
            >
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--ax-space-4)',
                  borderRadius: 'var(--ax-radius-md)',
                  background:
                    balance > 0
                      ? 'var(--ax-surface-subtle)'
                      : 'color-mix(in oklab,var(--ax-success-500) 12%,transparent)',
                }}
              >
                <div
                  className="ax-num"
                  style={{
                    fontFamily: 'var(--ax-font-display)',
                    fontSize: 'var(--ax-text-3xl)',
                    fontWeight: 700,
                    color: balance > 0 ? 'var(--ax-text-strong)' : 'var(--ax-success-700)',
                  }}
                >
                  {formatKmf(invoice.balance_kmf)}
                </div>
                {/* Le vert ne suffit pas à dire « c'est réglé » : on l'écrit
                    (revue a11y S5 — la couleur ne porte jamais seule une
                    information de cette portée). */}
                {balance <= 0 && !cancelled && (
                  <p style={{ margin: '6px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-success-700)' }}>
                    {SUBSCRIPTION_INVOICE_SETTLED_LABEL}
                  </p>
                )}
              </div>
              {/* Un règlement partiel est NORMAL, pas un défaut : le
                  vocabulaire l'accompagne (« déjà reçu » / « reste à régler »). */}
              {partial && (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                  {SUBSCRIPTION_PARTIAL_NOTICE}
                </p>
              )}
              <Link className="ax-link" href="/centre/abonnement" style={{ textAlign: 'center', fontSize: 'var(--ax-text-sm)' }}>
                ← Revenir à mon abonnement
              </Link>
            </div>
          </section>

          <PaymentsCard invoice={invoice} />
        </aside>
      </div>
    </>
  );
}

export default SubscriptionInvoiceScreen;
