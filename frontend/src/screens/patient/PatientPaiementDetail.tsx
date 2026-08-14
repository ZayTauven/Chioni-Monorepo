'use client';
/*
 * Chioni — /patient/paiements/[id] : payment request detail.
 *
 * The patient sees the FULL lines (exact label + generic category + amount)
 * — it is their care. Actions, one per card: share with a guardian (select
 * among MY active links), confirm the care was received (after payment),
 * report a problem (dispute, reason required, neutral tone).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  acknowledgePaymentRequest,
  disputePaymentRequest,
  getPaymentRequest,
  listAllGuardians,
  sharePaymentRequest,
} from '@/lib/endpoints/patients';
import {
  formatDate,
  formatKmf,
  GENERIC_CATEGORY_LABELS,
  RELATIONSHIP_LABELS,
} from '@/lib/labels';
import type { GuardianLinkPatient, PaymentRequestPatient, PaymentRequestStatus } from '@/lib/types';
import {
  ConfirmModal,
  ErrorAlert,
  PaymentStatusBadge,
  SkeletonCards,
  SuccessAlert,
} from './ui';

/** One plain sentence under the status badge — the badge alone is jargon. */
const STATUS_EXPLAINER: Record<PaymentRequestStatus, string> = {
  brouillon: 'Le centre de santé prépare cette demande.',
  envoyee: 'Cette demande attend un paiement.',
  payee: 'Un proche a payé cette demande.',
  soin_confirme: 'Le centre de santé a confirmé le soin.',
  cloturee: 'Cette demande est terminée.',
  litige: 'Un problème a été signalé. Le centre de santé l’examine.',
};

export function PatientPaiementDetail({ requestId }: { requestId: number }) {
  const [request, setRequest] = useState<PaymentRequestPatient | null>(null);
  const [guardians, setGuardians] = useState<GuardianLinkPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [success, setSuccess] = useState('');

  // Modals — only one open at a time.
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLinkId, setShareLinkId] = useState<number | ''>('');
  const [ackOpen, setAckOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeFieldError, setDisputeFieldError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  // Bring the success banner into view when it appears (it sits at the top).
  const successRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (success) successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [success]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([getPaymentRequest(requestId), listAllGuardians()])
      .then(([req, links]) => {
        setRequest(req);
        setGuardians(links);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(err);
        setLoading(false);
      });
  }, [requestId]);

  useEffect(load, [load]);

  const activeLinks = useMemo(
    () => guardians.filter((l) => l.status === 'actif'),
    [guardians],
  );
  const shareableLinks = useMemo(
    () => activeLinks.filter((l) => !(request?.shared_with_links ?? []).includes(l.id)),
    [activeLinks, request],
  );
  const sharedNames = useMemo(() => {
    if (!request) return [];
    return request.shared_with_links.map((id) => {
      const link = guardians.find((l) => l.id === id);
      return link ? link.guardian_name : 'Un proche';
    });
  }, [request, guardians]);

  async function share() {
    if (shareLinkId === '') return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await sharePaymentRequest(requestId, shareLinkId);
      setRequest(updated);
      setShareOpen(false);
      setShareLinkId('');
      const link = guardians.find((l) => l.id === shareLinkId);
      setSuccess(
        link
          ? `C'est fait. ${link.guardian_name} peut maintenant voir cette demande et la payer.`
          : 'La demande a été partagée.',
      );
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await acknowledgePaymentRequest(requestId);
      setRequest(updated);
      setAckOpen(false);
      setSuccess('Merci. Votre confirmation a bien été enregistrée.');
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function dispute() {
    const reason = disputeReason.trim();
    if (!reason) {
      setDisputeFieldError('Expliquez le problème en quelques mots.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const updated = await disputePaymentRequest(requestId, reason);
      setRequest(updated);
      setDisputeOpen(false);
      setDisputeReason('');
      setSuccess('Votre signalement a été envoyé au centre de santé.');
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <SkeletonCards count={3} />;
  if (loadError != null || !request)
    return (
      <div className="pat-stack">
        <Link href="/patient/paiements" className="ax-link">← Mes paiements</Link>
        <ErrorAlert error={loadError ?? new Error()} onRetry={load} />
      </div>
    );

  const canShare = request.status === 'envoyee';
  const canAcknowledge =
    (request.status === 'payee' ||
      request.status === 'soin_confirme' ||
      request.status === 'cloturee') &&
    request.patient_acknowledged_at === null;
  const canDispute = request.status === 'envoyee' || request.status === 'payee';

  return (
    <div className="pat-stack">
      <Link href="/patient/paiements" className="ax-link">← Mes paiements</Link>

      {success && (
        <div ref={successRef}>
          <SuccessAlert message={success} />
        </div>
      )}

      {/* the request itself : full lines, the patient's right. */}
      <section className="ax-card" role="region" aria-label="Détail de la demande">
        <div className="ax-card__body pat-gate__body">
          <div className="pat-row" style={{ minHeight: 0 }}>
            <div className="pat-row__main">
              <span className="pat-row__title">{request.center_name}</span>
              <span className="pat-row__meta">{formatDate(request.created_at)}</span>
            </div>
            <PaymentStatusBadge status={request.status} />
          </div>
          <p className="pat-gate__meta">
            {/* The REAL payment date (webhook) replaces the generic sentence. */}
            {request.status === 'payee' && request.paid_at
              ? `Payée par un proche le ${formatDate(request.paid_at)}.`
              : STATUS_EXPLAINER[request.status]}
          </p>
          <ul className="pat-lines">
            {request.lines.map((line) => (
              <li key={line.id}>
                <span className="pat-line__label">
                  <span className="pat-line__name">{line.label}</span>
                  <span className="pat-line__cat">
                    {GENERIC_CATEGORY_LABELS[line.generic_category]}
                  </span>
                </span>
                <span className="pat-amount">{formatKmf(line.amount_kmf)}</span>
              </li>
            ))}
          </ul>
          <div className="pat-total">
            <span>Total</span>
            <span className="pat-amount">{formatKmf(request.total_kmf)}</span>
          </div>
        </div>
      </section>

      {/* sharing */}
      <section className="ax-card" role="region" aria-label="Partage">
        <div className="ax-card__body pat-gate__body">
          <h3 className="pat-row__title" style={{ margin: 0 }}>Partagée avec</h3>
          {sharedNames.length > 0 ? (
            <ul className="pat-lines">
              {sharedNames.map((name, i) => (
                <li key={`${name}-${i}`}>
                  <span className="pat-line__label">
                    <span className="pat-line__name">{name}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pat-gate__meta">
              Cette demande n&rsquo;est partagée avec personne pour le moment.
            </p>
          )}
          {canShare &&
            (activeLinks.length === 0 ? (
              <>
                <p className="pat-gate__meta">
                  Un tuteur est un proche qui peut payer vos soins pour vous. Vous n&rsquo;en avez
                  pas encore.
                </p>
                <Link href="/patient/tuteurs" className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block">
                  Ajouter un tuteur
                </Link>
              </>
            ) : shareableLinks.length > 0 ? (
              <button
                type="button"
                className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
                onClick={() => {
                  setActionError(null);
                  setShareLinkId(shareableLinks.length === 1 ? shareableLinks[0].id : '');
                  setShareOpen(true);
                }}
              >
                Partager avec un tuteur
              </button>
            ) : (
              <p className="pat-gate__meta">Tous vos tuteurs voient déjà cette demande.</p>
            ))}
        </div>
      </section>

      {/* care confirmation */}
      {canAcknowledge && (
        <section className="ax-card" role="region" aria-label="Confirmer le soin">
          <div className="ax-card__body pat-gate__body">
            <h3 className="pat-row__title" style={{ margin: 0 }}>Avez-vous bien reçu ce soin&nbsp;?</h3>
            <p className="pat-gate__meta">
              Cela confirme au proche qui a payé que le soin a bien eu lieu.
            </p>
            <button
              type="button"
              className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
              onClick={() => {
                setActionError(null);
                setAckOpen(true);
              }}
            >
              Oui, j&rsquo;ai reçu ce soin
            </button>
          </div>
        </section>
      )}

      {request.patient_acknowledged_at !== null && (
        <SuccessAlert
          message={`Vous avez confirmé avoir reçu ce soin le ${formatDate(request.patient_acknowledged_at)}.`}
        />
      )}

      {actionError != null && !shareOpen && !ackOpen && !disputeOpen && (
        <ErrorAlert error={actionError} />
      )}

      {/* problem report — present but quiet. */}
      {canDispute && (
        <button
          type="button"
          className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block"
          onClick={() => {
            setActionError(null);
            setDisputeFieldError('');
            setDisputeOpen(true);
          }}
        >
          Signaler un problème
        </button>
      )}

      {/* share modal */}
      <ConfirmModal
        open={shareOpen}
        title="Partager cette demande ?"
        message="Votre proche verra le montant à payer. Il ne verra pas votre dossier médical."
        confirmLabel="Partager"
        busy={busy}
        error={actionError}
        onConfirm={() => void share()}
        onClose={() => setShareOpen(false)}
      >
        <div className="ax-field">
          <label className="ax-label" htmlFor="pd-share-link">Choisissez le proche</label>
          <select
            id="pd-share-link"
            className="ax-select ax-select--lg"
            data-autofocus=""
            value={shareLinkId}
            onChange={(e) => setShareLinkId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Choisir…</option>
            {shareableLinks.map((link) => (
              <option key={link.id} value={link.id}>
                {link.guardian_name} — {RELATIONSHIP_LABELS[link.relationship]}
              </option>
            ))}
          </select>
        </div>
      </ConfirmModal>

      {/* acknowledge modal */}
      <ConfirmModal
        open={ackOpen}
        title="Vous avez bien reçu ce soin ?"
        message="Cela confirme au proche qui a payé que le soin a bien eu lieu."
        confirmLabel="Oui, je confirme"
        busy={busy}
        error={actionError}
        onConfirm={() => void acknowledge()}
        onClose={() => setAckOpen(false)}
      />

      {/* dispute modal */}
      <ConfirmModal
        open={disputeOpen}
        title="Signaler un problème"
        message="Expliquez ce qui ne va pas. Le centre de santé lira votre message."
        confirmLabel="Envoyer le signalement"
        busy={busy}
        error={actionError}
        onConfirm={() => void dispute()}
        onClose={() => setDisputeOpen(false)}
      >
        <div className="ax-field">
          <label className="ax-label" htmlFor="pd-dispute-reason">Votre message</label>
          <textarea
            id="pd-dispute-reason"
            className={`ax-textarea${disputeFieldError ? ' is-invalid' : ''}`}
            data-autofocus=""
            rows={4}
            value={disputeReason}
            onChange={(e) => {
              setDisputeReason(e.target.value);
              if (disputeFieldError) setDisputeFieldError('');
            }}
            aria-invalid={disputeFieldError ? 'true' : 'false'}
            aria-describedby="pd-dispute-msg"
          />
          {disputeFieldError && (
            <p id="pd-dispute-msg" className="ax-field__message ax-field__message--error">
              {disputeFieldError}
            </p>
          )}
        </div>
      </ConfirmModal>
    </div>
  );
}

export default PatientPaiementDetail;
