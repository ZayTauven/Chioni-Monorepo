'use client';
/*
 * Chioni — /centre/factures/[id] : détail d'une facture + sa vue caisse.
 *
 * Lignes (libellé + catégorie générique + montant), actions BILLING :
 * - émettre (`issue/`) : fige les montants (brouillon → émise) ;
 * - créer une demande de paiement (Pont de Confiance) ;
 * - encaisser au guichet (ADR 0015) : tranches en KMF ENTIER, jamais plus que
 *   le solde, reçu « G- » émis à chaque encaissement, contre-passation unique
 *   avec MOTIF OBLIGATOIRE (écriture corrective — le reçu reste visible barré).
 *   Idempotence S1 : une clé UUID par tentative d'encaissement (régénérée
 *   après chaque succès) — un double-clic/retry réseau renvoie le MÊME reçu ;
 * - annuler la facture (S1, BILLING, motif obligatoire) : les actes
 *   redeviennent facturables ; une demande envoyée au proche sera refusée au
 *   paiement. Le motif (`cancel_reason`) n'est lisible que par les rôles
 *   BILLING (absent du payload sinon).
 * Les 400 du backend (dépassement de solde, diaspora en cours…) s'affichent
 * tels quels près du formulaire.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  cancelInvoice,
  createInvoicePayment,
  createPaymentRequest,
  getInvoice,
  getPatient,
  issueInvoice,
  listInvoicePayments,
  reverseInvoicePayment,
} from '@/lib/endpoints/centers';
import {
  CASH_METHOD_LABELS,
  CASH_PAYMENT_STATE_LABELS,
  GENERIC_CATEGORY_LABELS,
  INVOICE_STATUS_LABELS,
  MOBILE_OPERATOR_LABELS,
  formatDate,
  formatDateTime,
  formatKmf,
} from '@/lib/labels';
import type { CashPayment, Invoice, MobileMoneyOperator } from '@/lib/types';
import {
  BILLING_ROLES,
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconArrowLeft,
  IconCheck,
  IconClose,
  IconSend,
  INVOICE_TONES,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  hasRole,
  newIdempotencyKey,
  toApiError,
  useAsync,
} from './shared';

/* ── annulation de facture (S1 — BILLING, motif obligatoire) ── */

function CancelInvoiceModal({
  invoice,
  onClose,
  onCancelled,
}: {
  invoice: Invoice;
  onClose: () => void;
  onCancelled: (fresh: Invoice) => void;
}) {
  const { centerId } = useCenter();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await cancelInvoice(centerId, invoice.id, reason.trim());
      onCancelled(fresh);
    } catch (err) {
      // Les 400 du backend (encaissement actif, demande payée, diaspora en
      // cours…) sont montrés tels quels — ils disent exactement quoi faire.
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Annuler la facture n° ${invoice.id} ?`}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Garder la facture
          </button>
          <button
            type="submit"
            form="invoice-cancel-form"
            className="ax-btn ax-btn--danger"
            disabled={saving || !reason.trim()}
          >
            <span className="ax-btn__label">{saving ? 'Annulation…' : 'Annuler la facture'}</span>
          </button>
        </>
      }
    >
      <form
        id="invoice-cancel-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && <ErrorAlert error={error} />}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
          L&apos;annulation est <b>définitive</b> : les actes de la consultation redeviennent facturables
          (vous pourrez émettre une facture propre), et si une demande de paiement a été envoyée à un
          proche, son paiement sera refusé. Le motif reste visible de l&apos;équipe de facturation.
        </p>
        <div className="ax-field">
          <label className="ax-label" htmlFor="inv-cancel-reason">
            Motif <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="inv-cancel-reason"
            className={`ax-textarea${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : erreur d'actes facturés, facture émise en double…"
            required
            data-autofocus=""
          />
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── contre-passation (écriture corrective, motif obligatoire) ── */

function ReverseModal({
  invoiceId,
  payment,
  onClose,
  onDone,
}: {
  invoiceId: number;
  payment: CashPayment;
  onClose: () => void;
  onDone: () => void;
}) {
  const { centerId } = useCenter();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await reverseInvoicePayment(centerId, invoiceId, payment.id, reason.trim());
      onDone();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Contre-passer l'encaissement de ${formatKmf(payment.amount_kmf)} ?`}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="reverse-form"
            className="ax-btn ax-btn--danger"
            disabled={saving || !reason.trim()}
          >
            <span className="ax-btn__label">{saving ? 'Contre-passation…' : 'Contre-passer'}</span>
          </button>
        </>
      }
    >
      <form
        id="reverse-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && <ErrorAlert error={error} />}
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
          Il s&apos;agit d&apos;une <b>écriture corrective</b>, pas d&apos;un effacement : l&apos;encaissement et son
          reçu {payment.receipt ? <b className="ax-num">{payment.receipt.receipt_number}</b> : null} resteront
          visibles, barrés, avec votre motif. Si la facture était réglée, elle redeviendra « Émise » à hauteur
          du solde rouvert. Une contre-passation ne peut pas être annulée.
        </p>
        <div className="ax-field">
          <label className="ax-label" htmlFor="rev-reason">
            Motif <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          <textarea
            id="rev-reason"
            className={`ax-textarea${error?.fieldErrors.reason ? ' is-invalid' : ''}`}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : erreur de montant saisi, double saisie…"
            required
            data-autofocus=""
          />
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── formulaire d'encaissement (le geste le plus fréquent du guichet) ── */

function CashInForm({
  invoice,
  onCollected,
  onAttempt,
}: {
  invoice: Invoice;
  onCollected: (fresh: CashPayment) => void;
  /** Called as soon as a submit starts — the parent clears its stale
   *  success banner so an old « reçu n° G-… » never sits next to a new
   *  error (rafale safety at the counter). */
  onAttempt?: () => void;
}) {
  const { centerId } = useCenter();
  const balanceInt = String(Math.max(0, Math.trunc(Number.parseFloat(invoice.balance_kmf) || 0)));
  const [method, setMethod] = useState<'especes' | 'mobile_money'>('especes');
  const [operator, setOperator] = useState<MobileMoneyOperator>('huri');
  const [amount, setAmount] = useState(balanceInt);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  /**
   * Idempotence S1 (transparente pour le caissier) : une clé UUID par
   * TENTATIVE d'encaissement — générée à l'ouverture du formulaire, conservée
   * en cas d'échec (rejouer la même tentative après un timeout renvoie le
   * MÊME reçu, jamais une seconde tranche), régénérée après chaque succès.
   */
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey());

  // Une tranche vient d'être encaissée ailleurs → recaler le montant proposé.
  useEffect(() => {
    setAmount(balanceInt);
  }, [balanceInt]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    onAttempt?.();
    try {
      const fresh = await createInvoicePayment(centerId, invoice.id, {
        method,
        amount_kmf: amount,
        idempotency_key: idempotencyKey,
        ...(method === 'mobile_money' ? { operator } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setReference('');
      setIdempotencyKey(newIdempotencyKey());
      onCollected(fresh);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}

      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="ax-field" style={{ marginBottom: 0 }}>
          <label className="ax-label" htmlFor="cash-method">Moyen</label>
          <select
            id="cash-method"
            className="ax-select"
            value={method}
            onChange={(e) => setMethod(e.target.value as 'especes' | 'mobile_money')}
          >
            <option value="especes">{CASH_METHOD_LABELS.especes}</option>
            <option value="mobile_money">{CASH_METHOD_LABELS.mobile_money}</option>
          </select>
          <FieldError error={error} field="method" />
        </div>

        {method === 'mobile_money' && (
          <div className="ax-field" style={{ marginBottom: 0 }}>
            <label className="ax-label" htmlFor="cash-operator">Opérateur</label>
            <select
              id="cash-operator"
              className="ax-select"
              value={operator}
              onChange={(e) => setOperator(e.target.value as MobileMoneyOperator)}
            >
              {(Object.keys(MOBILE_OPERATOR_LABELS) as MobileMoneyOperator[]).map((o) => (
                <option key={o} value={o}>
                  {MOBILE_OPERATOR_LABELS[o]}
                </option>
              ))}
            </select>
            <FieldError error={error} field="operator" />
          </div>
        )}

        <div className="ax-field" style={{ marginBottom: 0, width: 180 }}>
          <label className="ax-label" htmlFor="cash-amount">Montant (KMF entier)</label>
          <input
            id="cash-amount"
            type="number"
            min={1}
            step={1}
            className={`ax-input${error?.fieldErrors.amount_kmf ? ' is-invalid' : ''}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <FieldError error={error} field="amount_kmf" />
        </div>

        <div className="ax-field" style={{ marginBottom: 0, minWidth: 160 }}>
          <label className="ax-label" htmlFor="cash-reference">Référence (facultative)</label>
          <input
            id="cash-reference"
            type="text"
            className="ax-input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={64}
            placeholder="N° de transaction…"
          />
          <FieldError error={error} field="reference" />
        </div>

        <button type="submit" className="ax-btn ax-btn--primary" disabled={saving || !amount}>
          <IconCheck />
          <span className="ax-btn__label">{saving ? 'Encaissement…' : 'Encaisser'}</span>
        </button>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
        Le montant proposé est le solde restant ({formatKmf(invoice.balance_kmf)}) — modifiez-le pour encaisser
        une tranche. Un reçu « G- » est émis à chaque encaissement.
      </p>
    </form>
  );
}

/* ── section caisse (rôles BILLING uniquement) ── */

function CaisseSection({
  invoice,
  onInvoiceChanged,
}: {
  invoice: Invoice;
  onInvoiceChanged: () => void;
}) {
  const { centerId } = useCenter();
  const [page, setPage] = useState(1);
  const [reversing, setReversing] = useState<CashPayment | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const payments = useAsync(
    () => listInvoicePayments(centerId, invoice.id, page),
    [centerId, invoice.id, page],
  );
  const rows = payments.data?.results ?? [];

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Caisse de la facture">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Caisse</h2>
          <p className="ax-card__subtitle">
            Encaissements de cette facture, tous moyens — y compris le Pont de Confiance.
          </p>
        </div>
      </div>

      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
        {success && (
          <div className="ax-alert ax-alert--success" role="status">
            <div className="ax-alert__content">
              <p className="ax-alert__message">{success}</p>
            </div>
          </div>
        )}

        {invoice.status === 'emise' && (
          <CashInForm
            invoice={invoice}
            onAttempt={() => setSuccess(null)}
            onCollected={(fresh) => {
              setSuccess(
                fresh.receipt
                  ? `Encaissement enregistré — reçu n° ${fresh.receipt.receipt_number}.`
                  : 'Encaissement enregistré.',
              );
              payments.reload();
              onInvoiceChanged();
            }}
          />
        )}
        {invoice.status === 'brouillon' && (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            Émettez d&apos;abord la facture pour pouvoir encaisser.
          </p>
        )}
        {invoice.status === 'payee' && (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            Facture entièrement réglée — plus rien à encaisser.
          </p>
        )}
        {invoice.status === 'annulee' && (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            Facture annulée — aucun encaissement possible. Les encaissements passés restent visibles ci-dessous.
          </p>
        )}
      </div>

      {payments.loading ? (
        <TableSkeleton rows={3} cols={5} />
      ) : payments.error ? (
        <div style={{ padding: 'var(--ax-space-4)' }}>
          <ErrorAlert error={payments.error} onRetry={payments.reload} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucun encaissement"
          message="Les encaissements de cette facture (guichet et Pont de Confiance) apparaîtront ici, chacun avec son reçu."
        />
      ) : (
        <>
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Quand</th>
                  <th className="ax-table__th" scope="col">Méthode</th>
                  <th className="ax-table__th" scope="col">Reçu</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                  <th className="ax-table__th" scope="col">État</th>
                  <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="ax-table__row" style={p.reversal ? { opacity: 0.65 } : undefined}>
                    <td className="ax-table__td" style={{ whiteSpace: 'nowrap', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                      {formatDateTime(p.created_at)}
                    </td>
                    <td className="ax-table__td" style={{ whiteSpace: 'nowrap' }}>
                      {CASH_METHOD_LABELS[p.method]}
                      {(p.operator || p.reference) && (
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
                          {p.operator ? MOBILE_OPERATOR_LABELS[p.operator] : ''}
                          {p.operator && p.reference ? ' · ' : ''}
                          {p.reference}
                        </span>
                      )}
                    </td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                      {p.receipt ? (
                        <span style={{ textDecoration: p.reversal ? 'line-through' : undefined }}>{p.receipt.receipt_number}</span>
                      ) : (
                        <span style={{ color: 'var(--ax-text-subtle)' }}>Reçu diaspora à la clôture</span>
                      )}
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', textDecoration: p.reversal ? 'line-through' : undefined }}>
                      {formatKmf(p.amount_kmf)}
                    </td>
                    <td className="ax-table__td">
                      {p.reversal ? (
                        <StatusBadge tone="danger" label={CASH_PAYMENT_STATE_LABELS.contre_passe} />
                      ) : (
                        <StatusBadge tone="success" label={CASH_PAYMENT_STATE_LABELS.encaisse} />
                      )}
                    </td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      {!p.reversal && p.method !== 'pont_confiance' && (
                        <button
                          type="button"
                          className="ax-btn ax-btn--ghost ax-btn--sm"
                          onClick={() => {
                            setSuccess(null);
                            setReversing(p);
                          }}
                          aria-label={`Contre-passer l'encaissement de ${formatKmf(p.amount_kmf)} du ${formatDateTime(p.created_at)}`}
                        >
                          <span className="ax-btn__label">Contre-passer</span>
                        </button>
                      )}
                      {p.method === 'pont_confiance' && !p.reversal && (
                        <span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
                          Non contre-passable — passer par un litige
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.data && <Pagination count={payments.data.count} page={page} onPage={setPage} />}
        </>
      )}

      {reversing && (
        <ReverseModal
          invoiceId={invoice.id}
          payment={reversing}
          onClose={() => setReversing(null)}
          onDone={() => {
            setReversing(null);
            setSuccess('Contre-passation enregistrée — l’écriture corrective est visible dans le journal.');
            payments.reload();
            onInvoiceChanged();
          }}
        />
      )}
    </section>
  );
}

/* ── screen ── */

export function InvoiceDetail({ invoiceId }: { invoiceId: number }) {
  const { centerId, roles } = useCenter();
  const router = useRouter();
  const billing = hasRole(roles, BILLING_ROLES);

  const invoiceState = useAsync(() => getInvoice(centerId, invoiceId), [centerId, invoiceId]);
  const [fresh, setFresh] = useState<Invoice | null>(null);
  const invoice = fresh ?? invoiceState.data;

  const patient = useAsync(
    () => (invoice ? getPatient(centerId, invoice.patient) : Promise.resolve(null)),
    [centerId, invoice?.patient],
  );

  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<'issue' | 'request' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const doIssue = async () => {
    if (!invoice) return;
    setBusy('issue');
    setActionError(null);
    try {
      setFresh(await issueInvoice(centerId, invoice.id));
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const doCreateRequest = async () => {
    if (!invoice) return;
    setBusy('request');
    setActionError(null);
    try {
      const request = await createPaymentRequest(centerId, invoice.id);
      router.push(`/centre/demandes/${request.id}`);
    } catch (err) {
      setActionError(toApiError(err));
      setBusy(null);
    }
  };

  if (invoiceState.loading) {
    return (
      <>
        <PageHead title="Facture" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--4"><CardSkeleton lines={5} /></section>
          <section className="ax-card ax-col--8"><CardSkeleton lines={5} /></section>
        </div>
      </>
    );
  }

  if (invoiceState.error || !invoice) {
    return (
      <>
        <PageHead title="Facture" />
        <div className="ax-dash-grid">
          <div className="ax-col--12">
            <ErrorAlert error={invoiceState.error ?? toApiError(null)} onRetry={invoiceState.reload} />
            <p style={{ marginTop: 'var(--ax-space-4)' }}>
              <Link href="/centre/factures" className="ax-btn ax-btn--secondary">
                <IconArrowLeft />
                <span className="ax-btn__label">Retour aux factures</span>
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const patientName = patient.data
    ? `${patient.data.first_name} ${patient.data.last_name}`.trim()
    : `Patient n° ${invoice.patient}`;
  const balance = Number.parseFloat(invoice.balance_kmf);

  return (
    <>
      <PageHead
        title={`Facture n° ${invoice.id}`}
        subtitle={`Créée le ${formatDate(invoice.created_at)}`}
        actions={
          <>
            <Link href="/centre/factures" className="ax-btn ax-btn--secondary">
              <IconArrowLeft />
              <span className="ax-btn__label">Retour</span>
            </Link>
            {billing && invoice.status === 'brouillon' && (
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => void doIssue()} disabled={busy !== null}>
                <IconCheck />
                <span className="ax-btn__label">{busy === 'issue' ? 'Émission…' : 'Émettre la facture'}</span>
              </button>
            )}
            {billing && invoice.status === 'emise' && (
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => void doCreateRequest()} disabled={busy !== null}>
                <IconSend />
                <span className="ax-btn__label">{busy === 'request' ? 'Création…' : 'Créer une demande de paiement'}</span>
              </button>
            )}
            {/* S1 : annulation BILLING quand le statut le permet — les 400 du
                backend (encaissement actif, demande payée…) tranchent le reste. */}
            {billing && (invoice.status === 'brouillon' || invoice.status === 'emise') && (
              <button
                type="button"
                className="ax-btn ax-btn--ghost"
                onClick={() => {
                  setActionError(null);
                  setCancelOpen(true);
                }}
                disabled={busy !== null}
              >
                <IconClose />
                <span className="ax-btn__label">Annuler la facture</span>
              </button>
            )}
          </>
        }
      />

      {actionError && (
        <div style={{ marginBottom: 'var(--ax-space-5)' }}>
          <ErrorAlert error={actionError} />
        </div>
      )}

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--4" role="region" aria-label="Informations de la facture">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Informations</h2>
            </div>
            <StatusBadge tone={INVOICE_TONES[invoice.status]} label={INVOICE_STATUS_LABELS[invoice.status]} />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <DetailItem label="Patient">
              <Link href={`/centre/patients/${invoice.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
                {patientName}
              </Link>
            </DetailItem>
            <DetailItem label="Consultation">
              <Link href={`/centre/consultations/${invoice.encounter}`} className="ax-link">
                Consultation n° {invoice.encounter}
              </Link>
            </DetailItem>
            <DetailItem label="Total">
              <b className="ax-num" style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>
                {formatKmf(invoice.total_kmf)}
              </b>
            </DetailItem>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
              <DetailItem label="Déjà payé">
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{formatKmf(invoice.paid_kmf)}</span>
              </DetailItem>
              <DetailItem label="Reste à payer">
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: balance > 0 ? 'var(--ax-danger-700)' : 'var(--ax-success-700)' }}>
                  {formatKmf(invoice.balance_kmf)}
                </b>
              </DetailItem>
            </div>
            {invoice.status === 'brouillon' && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Brouillon : les montants ne sont pas encore figés. Émettez la facture pour encaisser ou créer une demande de paiement.
              </p>
            )}
            {invoice.status === 'emise' && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Facture émise : les montants sont figés. Encaissez au guichet (par tranches si besoin) ou partagez une demande de paiement avec un proche.
              </p>
            )}
            {invoice.status === 'annulee' && (
              <div className="ax-alert ax-alert--warning" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__message">
                    Facture annulée{invoice.cancelled_at ? ` le ${formatDate(invoice.cancelled_at)}` : ''}. Les
                    actes de la consultation sont redevenus facturables.
                  </p>
                  {/* `cancel_reason` n'existe que dans le payload BILLING — jamais affiché en dur. */}
                  {billing && invoice.cancel_reason ? (
                    <p className="ax-alert__message">Motif : {invoice.cancel_reason}</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="ax-card ax-col--8" role="region" aria-label="Lignes de la facture">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Lignes</h2>
              <p className="ax-card__subtitle">Chaque ligne est reliée à un acte réalisé</p>
            </div>
          </div>
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Libellé</th>
                  <th className="ax-table__th" scope="col">Catégorie</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Montant</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="ax-table__row">
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)', fontWeight: 500 }}>{line.label}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {GENERIC_CATEGORY_LABELS[line.generic_category]}
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                      {formatKmf(line.amount_kmf)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="ax-table__foot">
                <tr>
                  <td className="ax-table__td" colSpan={2} style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>Total</td>
                  <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>
                    {formatKmf(invoice.total_kmf)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {billing && (
          <CaisseSection
            invoice={invoice}
            onInvoiceChanged={() => {
              setFresh(null);
              invoiceState.reload();
            }}
          />
        )}
      </div>

      {cancelOpen && (
        <CancelInvoiceModal
          invoice={invoice}
          onClose={() => setCancelOpen(false)}
          onCancelled={(freshInvoice) => {
            setCancelOpen(false);
            setFresh(freshInvoice);
          }}
        />
      )}
    </>
  );
}

export default InvoiceDetail;
