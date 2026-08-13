'use client';
/*
 * Chioni — /centre/demandes/[id] : détail d'une demande de paiement.
 *
 * Timeline visuelle de la machine à états (brouillon → envoyée → payée →
 * soin confirmé → clôturée ; litige en dérivation), actions par étape selon
 * le rôle, partages existants, accusé patient.
 *
 * PARTAGE : le backend n'offre AUCUNE route au staff pour découvrir les liens
 * de tutelle d'un patient (vérifié dans apps/patients/urls.py) — le partage à
 * l'initiative du centre est donc impossible à construire honnêtement. L'écran
 * l'assume : les partages existants sont montrés comme information (avec
 * retrait possible, les ids étant connus), et un texte explique que le patient
 * choisit ses tuteurs depuis son espace.
 *
 * REÇU : l'API ne propose pas de relecture des reçus côté centre — le reçu
 * retourné par `close/` (201) est affiché immédiatement en modal.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  closePaymentRequest,
  confirmCare,
  getInvoice,
  getPatient,
  getPaymentRequest,
  sendPaymentRequest,
  unsharePaymentRequest,
} from '@/lib/endpoints/centers';
import {
  PAYMENT_REQUEST_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatEur,
  formatKmf,
} from '@/lib/labels';
import type { PaymentRequestStatus, PaymentRequestStaff, Receipt } from '@/lib/types';
import {
  BILLING_ROLES,
  CARE_CONFIRM_ROLES,
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  IconArrowLeft,
  IconCheck,
  IconReceipt,
  IconSend,
  IconUserOff,
  Modal,
  PAYMENT_REQUEST_TONES,
  StatusBadge,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

/* ── timeline ── */

const STEPS: Array<{ status: PaymentRequestStatus; title: string; hint: string }> = [
  { status: 'brouillon', title: 'Brouillon', hint: 'La demande est préparée par le centre.' },
  { status: 'envoyee', title: 'Envoyée', hint: 'Visible par les proches avec qui elle est partagée.' },
  { status: 'payee', title: 'Payée', hint: 'Paiement confirmé par le prestataire — le centre reçoit 100 % du montant en KMF.' },
  { status: 'soin_confirme', title: 'Soin confirmé', hint: 'Un soignant atteste que le soin a bien été délivré.' },
  { status: 'cloturee', title: 'Clôturée', hint: 'Reçu émis — le cercle de confiance est bouclé.' },
];

function StatusTimeline({ status }: { status: PaymentRequestStatus }) {
  const currentIndex = STEPS.findIndex((s) => s.status === status);
  const inDispute = status === 'litige';
  return (
    <ul className="ax-timeline">
      {STEPS.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const current = currentIndex === i;
        const cls = done
          ? 'ax-timeline__item ax-timeline__item--success'
          : current
            ? 'ax-timeline__item'
            : 'ax-timeline__item ax-timeline__item--pending';
        return (
          <li key={step.status} className={cls}>
            <span className="ax-timeline__marker" style={current ? { color: 'var(--ax-accent)' } : undefined}>
              {done ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /></svg>
              )}
            </span>
            <div className="ax-timeline__content">
              <p className="ax-timeline__title" style={current ? { color: 'var(--ax-text-strong)', fontWeight: 600 } : undefined}>
                {step.title}
                {current && ' — étape actuelle'}
              </p>
              <span className="ax-timeline__body">{step.hint}</span>
            </div>
          </li>
        );
      })}
      {inDispute && (
        <li className="ax-timeline__item ax-timeline__item--danger">
          <span className="ax-timeline__marker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
          </span>
          <div className="ax-timeline__content">
            <p className="ax-timeline__title" style={{ color: 'var(--ax-danger-500)', fontWeight: 600 }}>En litige — étape actuelle</p>
            <span className="ax-timeline__body">
              La demande est suspendue le temps de la résolution ; elle reviendra ensuite à son statut précédent (page Litiges).
            </span>
          </div>
        </li>
      )}
    </ul>
  );
}

/* ── receipt modal (shown once, right after close/) ── */

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <Modal
      title={`Reçu ${receipt.receipt_number}`}
      onClose={onClose}
      footer={
        <button type="button" className="ax-btn ax-btn--primary" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <div className="ax-alert ax-alert--success" role="status">
        <div className="ax-alert__content">
          <p className="ax-alert__title">Demande clôturée — reçu émis</p>
          <p className="ax-alert__message">
            Le reçu est disponible pour le patient et le proche payeur dans leurs espaces. Notez-en le numéro si besoin :
            l&apos;API ne permet pas de le réafficher côté centre.
          </p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
        <DetailItem label="Numéro de reçu">
          <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{receipt.receipt_number}</b>
        </DetailItem>
        <DetailItem label="Émis le">{formatDateTime(receipt.issued_at)}</DetailItem>
        <DetailItem label="Payé par le proche">
          <b className="ax-num">{formatEur(receipt.amount_eur_paid)}</b>
          <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
            {/* amount_eur_paid INCLUDES the fees — never present them as an extra. */}
            dont {formatEur(receipt.fees_eur)} de frais
          </span>
        </DetailItem>
        <DetailItem label="Reçu par le centre">
          <b className="ax-num">{formatKmf(receipt.amount_kmf_received)}</b>
          <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
            Taux figé : 1 € = {receipt.exchange_rate} KMF
          </span>
        </DetailItem>
      </div>
    </Modal>
  );
}

/* ── screen ── */

export function PaymentRequestDetail({ requestId }: { requestId: number }) {
  const { centerId, role } = useCenter();
  const billing = hasRole(role, BILLING_ROLES);
  const canConfirmCare = hasRole(role, CARE_CONFIRM_ROLES);

  const requestState = useAsync(() => getPaymentRequest(centerId, requestId), [centerId, requestId]);
  const [fresh, setFresh] = useState<PaymentRequestStaff | null>(null);
  const request = fresh ?? requestState.data;

  const invoice = useAsync(
    () => (request ? getInvoice(centerId, request.invoice) : Promise.resolve(null)),
    [centerId, request?.invoice],
  );
  const patient = useAsync(
    () => (invoice.data ? getPatient(centerId, invoice.data.patient) : Promise.resolve(null)),
    [centerId, invoice.data?.patient],
  );

  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const run = async (key: string, action: () => Promise<PaymentRequestStaff>) => {
    setBusy(key);
    setActionError(null);
    try {
      setFresh(await action());
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusy(null);
    }
  };

  const doClose = async () => {
    if (!request) return;
    setBusy('close');
    setActionError(null);
    try {
      const issued = await closePaymentRequest(centerId, request.id);
      setReceipt(issued);
      // Reflect the new status without re-fetching: close → cloturee.
      setFresh({ ...request, status: 'cloturee' });
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusy(null);
    }
  };

  if (requestState.loading) {
    return (
      <>
        <PageHead title="Demande de paiement" />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--5"><CardSkeleton lines={6} /></section>
          <section className="ax-card ax-col--7"><CardSkeleton lines={6} /></section>
        </div>
      </>
    );
  }

  if (requestState.error || !request) {
    return (
      <>
        <PageHead title="Demande de paiement" />
        <div className="ax-dash-grid">
          <div className="ax-col--12">
            <ErrorAlert error={requestState.error ?? toApiError(null)} onRetry={requestState.reload} />
            <p style={{ marginTop: 'var(--ax-space-4)' }}>
              <Link href="/centre/demandes" className="ax-btn ax-btn--secondary">
                <IconArrowLeft />
                <span className="ax-btn__label">Retour aux demandes</span>
              </Link>
            </p>
          </div>
        </div>
      </>
    );
  }

  const patientName = patient.data
    ? `${patient.data.first_name} ${patient.data.last_name}`.trim()
    : invoice.data
      ? `Patient n° ${invoice.data.patient}`
      : '…';

  return (
    <>
      <PageHead
        title={`Demande n° ${request.id}`}
        subtitle={`Créée le ${formatDate(request.created_at)} · ${formatKmf(request.total_kmf)}`}
        actions={
          <>
            <Link href="/centre/demandes" className="ax-btn ax-btn--secondary">
              <IconArrowLeft />
              <span className="ax-btn__label">Retour</span>
            </Link>
            {billing && request.status === 'brouillon' && (
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => void run('send', () => sendPaymentRequest(centerId, request.id))}
                disabled={busy !== null}
              >
                <IconSend />
                <span className="ax-btn__label">{busy === 'send' ? 'Envoi…' : 'Envoyer la demande'}</span>
              </button>
            )}
            {canConfirmCare && request.status === 'payee' && (
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => void run('care', () => confirmCare(centerId, request.id))}
                disabled={busy !== null}
              >
                <IconCheck />
                <span className="ax-btn__label">{busy === 'care' ? 'Confirmation…' : 'Confirmer le soin'}</span>
              </button>
            )}
            {billing && request.status === 'soin_confirme' && (
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => void doClose()} disabled={busy !== null}>
                <IconReceipt />
                <span className="ax-btn__label">{busy === 'close' ? 'Clôture…' : 'Clôturer et émettre le reçu'}</span>
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

      {request.status === 'brouillon' && request.shares.length === 0 && (
        <div className="ax-alert ax-alert--info" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <div className="ax-alert__content">
            <p className="ax-alert__message">
              Cette demande n&apos;est partagée avec aucun proche pour l&apos;instant : l&apos;envoi sera refusé tant qu&apos;un
              partage n&apos;existe pas. Le patient choisit ses tuteurs et partage ses demandes depuis son espace.
            </p>
          </div>
        </div>
      )}

      <div className="ax-dash-grid">
        {/* Infos + shares */}
        <section className="ax-card ax-col--5" role="region" aria-label="Informations de la demande">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Informations</h2>
            </div>
            <StatusBadge tone={PAYMENT_REQUEST_TONES[request.status]} label={PAYMENT_REQUEST_STATUS_LABELS[request.status]} />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <DetailItem label="Montant demandé">
              <b className="ax-num" style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>
                {formatKmf(request.total_kmf)}
              </b>
            </DetailItem>
            <DetailItem label="Facture liée">
              <Link href={`/centre/factures/${request.invoice}`} className="ax-link">
                Facture n° {request.invoice}
              </Link>
            </DetailItem>
            <DetailItem label="Patient">
              {invoice.data ? (
                <Link href={`/centre/patients/${invoice.data.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
                  {patientName}
                </Link>
              ) : (
                '…'
              )}
            </DetailItem>
            <DetailItem label="Soin confirmé par le patient">
              {request.patient_acknowledged_at ? (
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <StatusBadge tone="success" label="Soin confirmé" />
                  <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                    Le patient a confirmé avoir reçu ce soin le {formatDate(request.patient_acknowledged_at)}.
                  </span>
                </span>
              ) : (
                <span style={{ color: 'var(--ax-text-muted)' }}>
                  Le patient n&apos;a pas encore confirmé avoir reçu ce soin (possible après paiement).
                </span>
              )}
            </DetailItem>

            <hr className="ax-divider" />

            <div>
              <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 'var(--ax-space-2)' }}>
                Partagée avec
              </div>
              {request.shares.length === 0 ? (
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Aucun partage pour l&apos;instant.
                </p>
              ) : (
                <ul className="ax-list ax-list--compact">
                  {request.shares.map((share) => (
                    <li key={share.id} className="ax-list__row">
                      <span className="ax-list__content">
                        <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                          Lien de tutelle n° {share.guardian_link}
                        </span>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                          Partagé le {formatDate(share.shared_at)}
                        </span>
                      </span>
                      {billing && (request.status === 'brouillon' || request.status === 'envoyee') && (
                        <span className="ax-list__trailing">
                          <button
                            type="button"
                            className="ax-btn ax-btn--ghost ax-btn--sm"
                            onClick={() =>
                              void run(`unshare-${share.id}`, () =>
                                unsharePaymentRequest(centerId, request.id, share.guardian_link),
                              )
                            }
                            disabled={busy !== null}
                          >
                            <IconUserOff />
                            <span className="ax-btn__label">{busy === `unshare-${share.id}` ? 'Retrait…' : 'Retirer'}</span>
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Le patient choisit ses tuteurs et partage ses demandes depuis son espace — le centre ne peut pas désigner
                un proche à sa place.
              </p>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="ax-card ax-col--7" role="region" aria-label="Parcours de la demande">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Parcours de la demande</h2>
              <p className="ax-card__subtitle">Chaque étape est tracée — chaque franc est relié à un soin et à un reçu.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <StatusTimeline status={request.status} />
            {request.status === 'litige' && (
              <p style={{ margin: 'var(--ax-space-4) 0 0' }}>
                <Link href="/centre/litiges" className="ax-btn ax-btn--secondary ax-btn--sm">
                  <span className="ax-btn__label">Voir les litiges</span>
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

export default PaymentRequestDetail;
