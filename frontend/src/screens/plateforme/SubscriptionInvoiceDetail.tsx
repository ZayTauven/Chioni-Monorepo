'use client';
/*
 * Chioni — /plateforme/factures/[id] : une facture SaaS, côté back-office
 * (S5 lot 2, ADR 0018 décision 4).
 *
 * Le PAPIER est le même composant que côté centre
 * (`components/documents/DocumentPaper`, adapté de `ecommerce/InvoiceDetails`
 * du template) : émetteur CHIONI, destinataire le centre. Les deux audiences
 * lisent donc rigoureusement le même document — ce qui est la moindre des
 * choses pour une créance.
 *
 * Ce que cet écran ajoute au papier : les trois gestes de Chioni, tous
 * modalisés et tous `busy` pendant l'appel (un geste d'argent quitté en vol
 * laisse « je ne sais pas si ça a été fait », le pire des états) —
 * enregistrer un règlement REÇU, le contre-passer (motif obligatoire, seule
 * correction possible), annuler la facture (motif obligatoire).
 *
 * `support` LIT : aucune de ces trois commandes n'est montée pour lui.
 *
 * Écart de contrat consigné : le payload plateforme d'un centre ne porte PAS
 * son logo (`/platform/centers/` ne l'expose pas). Le papier rend donc les
 * initiales du centre côté destinataire — le logo du centre s'affichera de
 * lui-même le jour où l'API l'exposera, sans toucher à cet écran.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlatformPageHead } from '@/components/shell-platform/PlatformPageHead';
import type { ApiError } from '@/lib/api';
import {
  cancelSubscriptionInvoice,
  getPlatformSubscriptionInvoice,
  recordSubscriptionPayment,
  reverseSubscriptionPayment,
} from '@/lib/endpoints/platform';
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
  KMF_INTEGRAL_HINT,
  SUBSCRIPTION_INVOICE_BALANCE_LABEL,
  SUBSCRIPTION_INVOICE_PAID_LABEL,
  SUBSCRIPTION_INVOICE_SETTLED_LABEL,
  SUBSCRIPTION_INVOICE_STATUS_LABELS,
  SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE,
  SUBSCRIPTION_PAYMENT_METHOD_LABELS,
  SUBSCRIPTION_PAYMENT_REVERSED_LABEL,
  formatDate,
  formatDateTime,
  formatKmf,
  operatorLabel,
  subscriptionPeriodLine,
  todayIsoDate,
} from '@/lib/labels';
import type {
  PlatformSubscriptionInvoice,
  PlatformSubscriptionPayment,
  SubscriptionPaymentMethod,
} from '@/lib/types';
import {
  CardSkeleton,
  DocumentPaper,
  ErrorAlert,
  FieldError,
  Modal,
  PrintDocumentButton,
  ReadOnlyNotice,
  Ref,
  SUBSCRIPTION_INVOICE_TONES,
  StatusBadge,
  toApiError,
  useAsync,
  usePlatformRole,
} from './shared';

const METHODS: SubscriptionPaymentMethod[] = ['virement', 'especes', 'mobile_money', 'autre'];

/* ── enregistrer un règlement reçu ── */

function PaymentModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: PlatformSubscriptionInvoice;
  onClose: () => void;
  onDone: (fresh: PlatformSubscriptionInvoice) => void;
}) {
  // Pré-rempli au SOLDE : le cas courant est un règlement intégral, et un
  // champ déjà juste évite une faute de frappe sur un montant.
  const [amount, setAmount] = useState(String(Math.round(Number.parseFloat(invoice.balance_kmf))));
  const [method, setMethod] = useState<SubscriptionPaymentMethod>('virement');
  const [reference, setReference] = useState('');
  const [receivedAt, setReceivedAt] = useState(todayIsoDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await recordSubscriptionPayment(invoice.id, {
        amount_kmf: amount.trim(),
        method,
        reference: reference.trim() || undefined,
        received_at: receivedAt || undefined,
      });
      onDone(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Enregistrer un règlement — ${invoice.number}`}
      onClose={onClose}
      width={580}
      busy={saving}
      footer={
        <>
          {/* `data-autofocus` sur ANNULER, pas sur le montant.
              Correctif UX care S5 — le piège de focus de S4, revenu sur de
              l'argent : le champ montant est pré-rempli au solde INTÉGRAL et
              le bouton d'envoi est le bouton par défaut du formulaire. Une
              touche Entrée à l'ouverture enregistrait un règlement complet que
              personne n'a peut-être reçu. Les trois autres modales à
              conséquence de ce sprint posent déjà l'autofocus sur la sortie ;
              celle-ci fait comme elles. */}
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
            form="sub-payment-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || amount.trim().length === 0}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le règlement'}
          </button>
        </>
      }
    >
      <form
        id="sub-payment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
          Vous enregistrez un règlement <b>déjà reçu</b> hors de l&apos;application. Un règlement
          partiel est admis&nbsp;; il ne peut jamais dépasser le solde restant.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pay-amount">
              Montant reçu <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="pay-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className={`ax-input${error?.fieldErrors.amount_kmf ? ' is-invalid' : ''}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              aria-describedby="pay-amount-help"
              /* La molette de la souris incrémente un `type=number` focalisé :
                 sur un montant, un scroll de page changerait la somme saisie
                 sans que personne le voie. */
              onWheel={(e) => e.currentTarget.blur()}
            />
            <p id="pay-amount-help" className="ax-field__message">
              {KMF_INTEGRAL_HINT} Solde restant&nbsp;: {formatKmf(invoice.balance_kmf)}.
            </p>
            <FieldError error={error} field="amount_kmf" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pay-method">
              Moyen <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <select
              id="pay-method"
              className="ax-select"
              value={method}
              onChange={(e) => setMethod(e.target.value as SubscriptionPaymentMethod)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {SUBSCRIPTION_PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="method" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pay-reference">
              Référence
            </label>
            <input
              id="pay-reference"
              type="text"
              maxLength={64}
              className="ax-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° de virement, de transaction…"
            />
            <FieldError error={error} field="reference" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="pay-received">
              Reçu le
            </label>
            <input
              id="pay-received"
              type="date"
              className="ax-input"
              value={receivedAt}
              max={todayIsoDate()}
              onChange={(e) => setReceivedAt(e.target.value)}
              aria-describedby="pay-received-help"
            />
            <p id="pay-received-help" className="ax-field__message">
              Le jour où l&apos;argent est réellement arrivé — un virement vu lundi a pu partir
              vendredi.
            </p>
            <FieldError error={error} field="received_at" />
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ── contre-passer un règlement / annuler une facture ── */

function ReasonModal({
  title,
  intro,
  confirmLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  intro: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={560}
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
            form="reason-form"
            className="ax-btn ax-btn--danger"
            disabled={saving || reason.trim().length === 0}
          >
            {saving ? 'Enregistrement…' : confirmLabel}
          </button>
        </>
      }
    >
      <form
        id="reason-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
          {intro}
        </p>
        <div className="ax-field">
          <label className="ax-label" htmlFor="reason-field">
            Motif <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="reason-field"
            className={`ax-input${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            aria-describedby="reason-field-help"
          />
          {/* Ce motif est LU PAR LE DIRECTEUR du centre : il explique une ligne
              qui disparaît de son solde ou une facture qui s'efface. */}
          <p id="reason-field-help" className="ax-field__message">
            Ce motif est lu par le directeur du centre&nbsp;: écrivez-le pour lui.
          </p>
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── écran ── */

export function PlatformSubscriptionInvoiceDetail({ invoiceId }: { invoiceId: number }) {
  const { canWrite } = usePlatformRole();
  const [patched, setPatched] = useState<PlatformSubscriptionInvoice | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [reversing, setReversing] = useState<PlatformSubscriptionPayment | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const state = useAsync(() => getPlatformSubscriptionInvoice(invoiceId), [invoiceId]);
  /*
   * `patched` est la facture RENVOYÉE par une écriture (règlement,
   * contre-passation, annulation) : elle prime sur le fetch, le temps que
   * l'écran se recharge. Elle doit mourir avec l'id qu'elle décrit — sinon un
   * changement de `invoiceId` sans démontage laisserait des montants et un
   * solde de la facture PRÉCÉDENTE sous le numéro de la nouvelle, et
   * `patched ?? state.data` ne rendrait plus jamais la main au fetch.
   * Aucun chemin de l'UI ne relie deux factures entre elles aujourd'hui : la
   * garde est un durcissement, pas la correction d'une faille prouvée. Sur un
   * écran d'argent, elle coûte une ligne.
   */
  useEffect(() => setPatched(null), [invoiceId]);
  const invoice = patched ?? state.data;

  if (!invoice) {
    return (
      <>
        <PlatformPageHead
          title="Facture d’abonnement"
          trail={[{ label: 'Factures d’abonnement', href: '/plateforme/factures' }, { label: 'Facture' }]}
        />
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
  const cancelled = invoice.status === 'annulee';
  const activePayments = invoice.payments.filter((p) => !p.reversed);
  const payable = !cancelled && balance > 0;
  // Le backend refuse l'annulation tant qu'un règlement actif existe : on
  // n'affiche donc pas un bouton qui ne peut que refuser.
  const cancellable = !cancelled && activePayments.length === 0;

  return (
    <>
      <PlatformPageHead
        title={invoice.number}
        subtitle={`${invoice.center_name} · échéance du ${formatDate(invoice.due_date)}`}
        trail={[
          { label: 'Factures d’abonnement', href: '/plateforme/factures' },
          { label: invoice.number },
        ]}
        actions={<PrintDocumentButton />}
      />

      <div className="ax-dash-grid">
        <div className="ax-col--8">
          <DocumentPaper
            markId={`platform-invoice-${invoice.id}`}
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
              name: invoice.center_name,
              qualifier: CENTER_RECIPIENT_QUALIFIER,
              lines: [`Centre n° ${invoice.center}`],
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
                  <b style={{ color: 'var(--ax-text-strong)' }}>Facture annulée</b>
                  {invoice.cancelled_at ? ` le ${formatDate(invoice.cancelled_at)}` : ''}.
                  {invoice.cancel_reason ? ` Motif : ${invoice.cancel_reason}` : ''}
                </>
              ) : undefined
            }
            paymentDetailsLabel={DOC_PAYMENT_LABEL}
            paymentDetails={SUBSCRIPTION_OFFLINE_PAYMENT_NOTICE}
          />
        </div>

        <aside
          className="ax-col--4 ax-print-hide"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0, alignSelf: 'start' }}
        >
          {/* ── recouvrement ── */}
          <section className="ax-card" role="region" aria-label="Recouvrement">
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
                {/* Le vert ne suffit pas à dire « c'est réglé » (revue a11y
                    S5) : le même mot que côté centre, pour que les deux
                    audiences lisent la même chose du même solde. */}
                {balance <= 0 && !cancelled && (
                  <p style={{ margin: '6px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-success-700)' }}>
                    {SUBSCRIPTION_INVOICE_SETTLED_LABEL}
                  </p>
                )}
              </div>

              {canWrite ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  {payable && (
                    <button
                      type="button"
                      className="ax-btn ax-btn--primary ax-btn--block"
                      onClick={() => setPayOpen(true)}
                    >
                      <span className="ax-btn__label">Enregistrer un règlement</span>
                    </button>
                  )}
                  {cancellable && (
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--block"
                      onClick={() => setCancelOpen(true)}
                    >
                      <span className="ax-btn__label">Annuler la facture</span>
                    </button>
                  )}
                  {!cancelled && !cancellable && activePayments.length > 0 && (
                    <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                      Pour annuler cette facture, contre-passez d&apos;abord ses règlements.
                    </p>
                  )}
                </div>
              ) : (
                <ReadOnlyNotice />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Ref>facture #{invoice.id}</Ref>
                <Ref>contrat #{invoice.subscription}</Ref>
              </div>
              <Link
                className="ax-link"
                href={`/plateforme/abonnements/${invoice.subscription}`}
                style={{ textAlign: 'center', fontSize: 'var(--ax-text-sm)' }}
              >
                ← Voir le contrat du centre
              </Link>
            </div>
          </section>

          {/* ── règlements reçus ── */}
          <section className="ax-card" role="region" aria-label="Règlements reçus">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Règlements reçus</h2>
                <p className="ax-card__subtitle">
                  La contre-passation est la seule correction possible.
                </p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {invoice.payments.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Aucun règlement enregistré.
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
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          Reçu le {formatDate(payment.received_at)} · saisi le{' '}
                          {formatDateTime(payment.created_at)}
                          {payment.reference ? ` · réf. ${payment.reference}` : ''}
                        </span>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {payment.recorded_by !== null ? operatorLabel(payment.recorded_by) : '—'}
                        </span>
                        {payment.reversed && payment.reversal_reason && (
                          <span
                            style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', marginTop: 2 }}
                          >
                            Motif&nbsp;: {payment.reversal_reason}
                          </span>
                        )}
                      </span>
                      <span
                        className="ax-list__trailing"
                        style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}
                      >
                        {payment.reversed ? (
                          <StatusBadge tone="neutral" label={SUBSCRIPTION_PAYMENT_REVERSED_LABEL} />
                        ) : (
                          canWrite && (
                            <button
                              type="button"
                              className="ax-btn ax-btn--ghost ax-btn--sm"
                              onClick={() => setReversing(payment)}
                            >
                              <span className="ax-btn__label">Contre-passer</span>
                            </button>
                          )
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>
      </div>

      {payOpen && canWrite && (
        <PaymentModal
          invoice={invoice}
          onClose={() => setPayOpen(false)}
          onDone={(fresh) => {
            setPatched(fresh);
            setPayOpen(false);
          }}
        />
      )}

      {reversing && canWrite && (
        <ReasonModal
          title={`Contre-passer ${formatKmf(reversing.amount_kmf)} ?`}
          intro="Le solde de la facture rouvre d'autant, et une facture réglée redevient à régler. Ce geste est unique : un règlement ne se contre-passe qu'une fois."
          confirmLabel="Contre-passer"
          onClose={() => setReversing(null)}
          onSubmit={async (reason) => {
            const fresh = await reverseSubscriptionPayment(invoice.id, reversing.id, reason);
            setPatched(fresh);
            setReversing(null);
          }}
        />
      )}

      {cancelOpen && canWrite && (
        <ReasonModal
          title={`Annuler la facture ${invoice.number} ?`}
          intro="La période redevient facturable et le centre verra cette facture barrée avec votre motif. La série ne se réutilise jamais : une nouvelle émission prendra un nouveau numéro."
          confirmLabel="Annuler la facture"
          onClose={() => setCancelOpen(false)}
          onSubmit={async (reason) => {
            const fresh = await cancelSubscriptionInvoice(invoice.id, reason);
            setPatched(fresh);
            setCancelOpen(false);
          }}
        />
      )}
    </>
  );
}

export default PlatformSubscriptionInvoiceDetail;
