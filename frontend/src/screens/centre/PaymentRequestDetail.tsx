'use client';
/*
 * Chioni — /centre/demandes/[id] : détail d'une demande de paiement.
 *
 * Timeline visuelle de la machine à états (brouillon → envoyée → payée →
 * soin confirmé → clôturée ; litige en dérivation), actions par étape selon
 * le rôle, partages existants, accusé patient.
 *
 * PARTAGE AU GUICHET : `GET /centers/{c}/patients/{pk}/guardian-links/`
 * (rôles BILLING) liste les liens ACTIFS du patient — minimum administratif
 * (nom d'affichage + relation, jamais de téléphone). Ce partage existe pour
 * le patient sans smartphone qui désigne son proche au guichet : la modal le
 * rappelle (« à faire avec l'accord du patient présent »). Le patient reste
 * maître de ses tuteurs depuis son espace.
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
  listPatientGuardianLinks,
  sendPaymentRequest,
  sharePaymentRequest,
  unsharePaymentRequest,
} from '@/lib/endpoints/centers';
import {
  PAYMENT_REQUEST_STATUS_LABELS,
  RELATIONSHIP_LABELS,
  formatDate,
  formatDateTime,
  formatEur,
  formatKmf,
} from '@/lib/labels';
import type {
  GuardianLinkCenter,
  PaymentRequestStatus,
  PaymentRequestStaff,
  Receipt,
} from '@/lib/types';
import {
  BILLING_ROLES,
  CARE_CONFIRM_ROLES,
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  IconArrowLeft,
  IconCheck,
  IconPlus,
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

function StatusTimeline({ status, paidAt }: { status: PaymentRequestStatus; paidAt: string | null }) {
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
              {/* The REAL payment date (webhook), shown once the step is reached. */}
              {step.status === 'payee' && (done || current) && paidAt && (
                <span className="ax-timeline__time">Payée le {formatDate(paidAt)}</span>
              )}
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

/* ── desk-share modal (BILLING roles — the patient designates their guardian) ── */

function ShareModal({
  links,
  busy,
  error,
  onShare,
  onClose,
}: {
  links: GuardianLinkCenter[];
  busy: boolean;
  error: ApiError | null;
  onShare: (linkId: number) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<number | ''>(links.length === 1 ? links[0].id : '');
  return (
    <Modal
      title="Partager avec un tuteur"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" disabled={busy} onClick={onClose}>
            <span className="ax-btn__label">Annuler</span>
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            disabled={busy || selected === ''}
            onClick={() => {
              if (selected !== '') onShare(selected);
            }}
          >
            <span className="ax-btn__label">{busy ? 'Partage…' : 'Partager'}</span>
          </button>
        </>
      }
    >
      <div className="ax-alert ax-alert--info" role="note">
        <div className="ax-alert__content">
          <p className="ax-alert__message">
            À faire avec l&apos;accord du patient présent au guichet : c&apos;est lui qui désigne son proche.
          </p>
        </div>
      </div>
      <div className="ax-field">
        <label className="ax-field__label" htmlFor="pr-share-link">
          Tuteur du patient
        </label>
        <select
          id="pr-share-link"
          className="ax-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="" disabled>
            Choisir…
          </option>
          {links.map((link) => (
            <option key={link.id} value={link.id}>
              {link.guardian_name} — {RELATIONSHIP_LABELS[link.relationship]}
            </option>
          ))}
        </select>
        <p className="ax-field__hint">
          Le proche verra le montant à payer et la nature générique des actes — jamais le dossier médical.
        </p>
      </div>
      {error && <ErrorAlert error={error} />}
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

  // ACTIVE guardian links of the invoiced patient — the endpoint is BILLING
  // only (403 otherwise), so the fetch is gated on the caller's role.
  const patientId = invoice.data?.patient ?? null;
  const guardianLinks = useAsync(
    () =>
      billing && patientId !== null
        ? listPatientGuardianLinks(centerId, patientId)
        : Promise.resolve(null),
    [centerId, billing, patientId],
  );

  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareError, setShareError] = useState<ApiError | null>(null);

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

  const doShare = async (guardianLinkId: number) => {
    if (!request) return;
    setBusy('share');
    setShareError(null);
    try {
      setFresh(await sharePaymentRequest(centerId, request.id, guardianLinkId));
      setShareOpen(false);
    } catch (err) {
      setShareError(toApiError(err));
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

  /* — desk-share derivations (BILLING) — */
  const activeLinks = guardianLinks.data?.results ?? [];
  const sharedLinkIds = new Set(request.shares.map((s) => s.guardian_link));
  const shareableLinks = activeLinks.filter((l) => !sharedLinkIds.has(l.id));
  const canManageShares = billing && (request.status === 'brouillon' || request.status === 'envoyee');
  const linksReady = billing && !guardianLinks.loading && guardianLinks.error === null && guardianLinks.data !== null;

  /** Display name of a share — resolved from the links list when the link is
      still active, honest fallback otherwise (e.g. link revoked since). */
  const shareLabel = (guardianLinkId: number): string => {
    const link = activeLinks.find((l) => l.id === guardianLinkId);
    return link
      ? `${link.guardian_name} — ${RELATIONSHIP_LABELS[link.relationship]}`
      : `Lien de tutelle n° ${guardianLinkId}`;
  };

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
              partage n&apos;existe pas.{' '}
              {billing
                ? 'Partagez-la avec un tuteur du patient (avec son accord), ou le patient peut le faire depuis son espace.'
                : 'Le patient choisit ses tuteurs et partage ses demandes depuis son espace.'}
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
                          {shareLabel(share.guardian_link)}
                        </span>
                        <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                          Partagé le {formatDate(share.shared_at)}
                        </span>
                      </span>
                      {canManageShares && (
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

              {/* Desk share — BILLING roles, the patient designates their guardian. */}
              {canManageShares && guardianLinks.error && (
                <div style={{ marginTop: 'var(--ax-space-3)' }}>
                  <ErrorAlert error={guardianLinks.error} onRetry={guardianLinks.reload} />
                </div>
              )}
              {canManageShares && linksReady && activeLinks.length === 0 && (
                <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                  Ce patient n&apos;a pas encore de tuteur actif — il peut en inviter un depuis son espace, ou vous
                  pouvez enregistrer un proche à la création du dossier.
                </p>
              )}
              {canManageShares && linksReady && shareableLinks.length > 0 && (
                <p style={{ margin: 'var(--ax-space-3) 0 0' }}>
                  <button
                    type="button"
                    className="ax-btn ax-btn--secondary ax-btn--sm"
                    onClick={() => {
                      setShareError(null);
                      setShareOpen(true);
                    }}
                    disabled={busy !== null}
                  >
                    <IconPlus />
                    <span className="ax-btn__label">Partager avec un tuteur</span>
                  </button>
                </p>
              )}
              {canManageShares && linksReady && activeLinks.length > 0 && shareableLinks.length === 0 && (
                <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  Tous les tuteurs actifs de ce patient voient déjà cette demande.
                </p>
              )}
              {!billing && (
                <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                  Le patient choisit ses tuteurs et partage ses demandes depuis son espace.
                </p>
              )}
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
            <StatusTimeline status={request.status} paidAt={request.paid_at} />
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
      {shareOpen && (
        <ShareModal
          links={shareableLinks}
          busy={busy === 'share'}
          error={shareError}
          onShare={(id) => void doShare(id)}
          onClose={() => {
            if (busy !== 'share') setShareOpen(false);
          }}
        />
      )}
    </>
  );
}

export default PaymentRequestDetail;
