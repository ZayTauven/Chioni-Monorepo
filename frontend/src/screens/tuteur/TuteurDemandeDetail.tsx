'use client';
/*
 * Chioni — /tuteur/demandes/[id] (detail + the payment flow).
 *
 * The money path follows the API contract to the letter:
 *   GET quote/  → show the frozen-rate quote (full transparency)
 *   POST pay/   → EMPTY body (no amount ever leaves the client)
 *   201 intent "en_cours" → honest waiting screen, poll GET /{id}/ every 4 s
 *   status "payee" (webhook-driven server side) → success screen.
 * After ~60 s without change the polling STOPS and we tell the user the
 * truth: the payment is not lost, the state lives on the server.
 *
 * Privacy invariant (ADR 0005): lines are generic category + amount only —
 * the shape has no label and the screen never tries to show one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ApiError } from '@/lib/api';
import {
  dispute,
  getPaymentRequest,
  getQuote,
  isNoActiveLinkError,
  pay,
} from '@/lib/endpoints/guardian';
import {
  GENERIC_CATEGORY_LABELS,
  formatDate,
  formatEur,
  formatKmf,
  formatRate,
} from '@/lib/labels';
import type { PaymentIntent, PaymentRequestGuardian, Quote } from '@/lib/types';
import {
  DisputeModal,
  EmptyState,
  ErrorAlert,
  HEART_ICON,
  LoadingCard,
  PrStatusBadge,
  PrivacyNote,
  SHIELD_ICON,
  protegeName,
  toDisplayError,
} from './common';

const POLL_INTERVAL_MS = 4000;
const POLL_PATIENCE_MS = 60000;

/* An intent was created client-side less than 15 min ago: warn before letting
   the same request be paid a second time (the backend has its own guard). */
const INTENT_GUARD_MS = 15 * 60 * 1000;

function intentMarkerKey(requestId: number): string {
  return `chioni:intent-${requestId}`;
}

function readIntentGuard(requestId: number): boolean {
  try {
    const raw = sessionStorage.getItem(intentMarkerKey(requestId));
    const at = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(at) && Date.now() - at < INTENT_GUARD_MS;
  } catch {
    return false;
  }
}

type PayPhase =
  | { kind: 'view' }
  | { kind: 'quote'; quote: Quote }
  | { kind: 'waiting'; quote: Quote; intent: PaymentIntent; slow: boolean }
  | { kind: 'paid'; quote: Quote; intent: PaymentIntent };

/** Soften the KYC service error into the product's own words.
    Backend source: « Ce centre ne peut pas encore encaisser de paiements :
    sa vérification (KYC) n'est pas active. » (trustbridge/services.py). */
function mapPayError(e: unknown): ApiError {
  const err = toDisplayError(e);
  if (
    err.status === 400 &&
    err.messages.some((m) => {
      const lower = m.toLowerCase();
      return lower.includes('encaisser') || lower.includes('kyc');
    })
  ) {
    return new ApiError(err.status, [
      'Ce centre ne peut pas encore recevoir de paiements — vérification en cours par Chioni. Votre argent n’a pas été débité.',
    ]);
  }
  return err;
}

/* ── status timeline (InvoiceDetails pattern, guardian wording) ── */

const STEP_ORDER = ['envoyee', 'payee', 'soin_confirme', 'cloturee'] as const;

function StatusTimeline({ request }: { request: PaymentRequestGuardian }) {
  const litige = request.status === 'litige';
  const reached = litige ? 0 : STEP_ORDER.indexOf(request.status as (typeof STEP_ORDER)[number]);

  const steps: Array<{ done: string; pending: string; time?: string }> = [
    {
      done: 'Demande envoyée par le centre',
      pending: 'Demande envoyée par le centre',
      time: formatDate(request.created_at),
    },
    {
      done: 'Paiement reçu par le centre',
      pending: 'En attente de votre paiement',
      // The REAL payment date, set server-side by the cash-in webhook.
      time: request.paid_at ? `Payée le ${formatDate(request.paid_at)}` : undefined,
    },
    { done: 'Soin confirmé par le centre', pending: 'Confirmation du soin par le centre' },
    { done: 'Terminée — reçu disponible', pending: 'Clôture et reçu officiel' },
  ];

  return (
    <ul className="ax-timeline">
      {steps.map((step, i) => {
        if (litige && i > 0) return null;
        const isDone = i <= reached;
        const isCurrent = !litige && i === reached + 1;
        const cls = isDone
          ? 'ax-timeline__item ax-timeline__item--success'
          : isCurrent
            ? 'ax-timeline__item is-current'
            : 'ax-timeline__item ax-timeline__item--pending';
        return (
          <li key={step.pending} className={cls}>
            <span className="ax-timeline__marker">
              {isDone ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
              )}
            </span>
            <div className="ax-timeline__content">
              <p className="ax-timeline__title">{isDone ? step.done : step.pending}</p>
              {step.time && isDone && <span className="ax-timeline__time">{step.time}</span>}
            </div>
          </li>
        );
      })}
      {litige && (
        <li className="ax-timeline__item ax-timeline__item--danger">
          <span className="ax-timeline__marker">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg>
          </span>
          <div className="ax-timeline__content">
            <p className="ax-timeline__title">Litige en cours — le centre examine le signalement</p>
          </div>
        </li>
      )}
    </ul>
  );
}

/* ── screen ── */

export function TuteurDemandeDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const validId = Number.isInteger(id) && id > 0;

  const [request, setRequest] = useState<PaymentRequestGuardian | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  /** S1 : 403 « aucun lien actif » = l'état « aucun protégé », pas une erreur. */
  const [noActiveLink, setNoActiveLink] = useState(false);

  const [phase, setPhase] = useState<PayPhase>({ kind: 'view' });
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeError, setDisputeError] = useState<ApiError | null>(null);
  const [disputeSent, setDisputeSent] = useState(false);
  // The reason lives HERE so closing the modal never loses what was typed.
  const [disputeReason, setDisputeReason] = useState('');

  // True while a recent intent may still be confirming server-side.
  const [intentGuard, setIntentGuard] = useState(false);

  const load = useCallback(async () => {
    if (!validId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNoActiveLink(false);
    try {
      setRequest(await getPaymentRequest(id));
      setIntentGuard(readIntentGuard(id));
    } catch (e) {
      if (isNoActiveLinkError(e)) {
        // Tuteur sans lien actif (profil neuf ou entièrement révoqué) : le
        // même état vide bienveillant que les listes — il n'a rien fait de mal.
        setNoActiveLink(true);
      } else {
        setError(toDisplayError(e));
      }
    } finally {
      setLoading(false);
    }
  }, [id, validId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* — polling while waiting for the PSP webhook — */
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (phase.kind !== 'waiting' || phase.slow) return;

    const check = async () => {
      try {
        const fresh = await getPaymentRequest(id);
        const current = phaseRef.current;
        if (current.kind !== 'waiting') return;
        if (fresh.status !== 'envoyee') {
          setRequest(fresh);
          if (fresh.status === 'payee' || fresh.status === 'soin_confirme' || fresh.status === 'cloturee') {
            setPhase({ kind: 'paid', quote: current.quote, intent: current.intent });
          } else {
            setPhase({ kind: 'view' });
          }
        }
      } catch {
        /* transient network error mid-payment: keep polling quietly */
      }
    };

    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    const patience = window.setTimeout(() => {
      const current = phaseRef.current;
      if (current.kind === 'waiting') setPhase({ ...current, slow: true });
    }, POLL_PATIENCE_MS);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(patience);
    };
  }, [phase, id]);

  /* — actions — */

  const openQuote = async () => {
    setActionBusy(true);
    setActionError(null);
    try {
      const quote = await getQuote(id);
      setPhase({ kind: 'quote', quote });
    } catch (e) {
      setActionError(mapPayError(e));
      // The status may have moved (e.g. paid by someone else) — refresh.
      void load();
    } finally {
      setActionBusy(false);
    }
  };

  const confirmPay = async () => {
    if (phase.kind !== 'quote') return;
    setActionBusy(true);
    setActionError(null);
    try {
      const intent = await pay(id); // empty body BY DESIGN
      // Marker: warn this browser against paying the same request twice.
      try {
        sessionStorage.setItem(intentMarkerKey(id), String(Date.now()));
      } catch {
        /* ignore */
      }
      setIntentGuard(true);
      setPhase({ kind: 'waiting', quote: phase.quote, intent, slow: false });
    } catch (e) {
      setActionError(mapPayError(e));
      void load();
    } finally {
      setActionBusy(false);
    }
  };

  const manualCheck = async () => {
    if (phase.kind !== 'waiting') return;
    setActionBusy(true);
    try {
      const fresh = await getPaymentRequest(id);
      setRequest(fresh);
      if (fresh.status === 'payee' || fresh.status === 'soin_confirme' || fresh.status === 'cloturee') {
        setPhase({ kind: 'paid', quote: phase.quote, intent: phase.intent });
      } else if (fresh.status !== 'envoyee') {
        // e.g. a dispute opened meanwhile — back to the detail view.
        setPhase({ kind: 'view' });
      }
    } catch (e) {
      setActionError(toDisplayError(e));
    } finally {
      setActionBusy(false);
    }
  };

  const sendDispute = async (reason: string) => {
    setDisputeBusy(true);
    setDisputeError(null);
    try {
      const fresh = await dispute(id, reason);
      setRequest(fresh);
      setDisputeOpen(false);
      setDisputeSent(true);
      setDisputeReason('');
      setPhase({ kind: 'view' });
    } catch (e) {
      setDisputeError(toDisplayError(e));
    } finally {
      setDisputeBusy(false);
    }
  };

  /* — money rows of the quote (shared by quote and waiting screens) — */
  const quoteRows = useMemo(() => {
    if (phase.kind !== 'quote' && phase.kind !== 'waiting') return null;
    const q = phase.quote;
    // Fee percentage COMPUTED from the quote (stays true if the rate changes).
    const feesPct = (() => {
      const amount = Number.parseFloat(q.amount_eur);
      const fees = Number.parseFloat(q.fees_eur);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(fees)) return null;
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format((fees / amount) * 100);
    })();
    return (
      <>
        <div className="tuteur-money-card__kmf">
          <span className="tuteur-money-card__kmf-label">Le centre recevra</span>
          <span className="tuteur-money-card__kmf-amount ax-num">{formatKmf(q.amount_kmf)}</span>
        </div>
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">Taux appliqué</span>
          <span className="tuteur-money-row__value ax-num">{formatRate(q.exchange_rate)}</span>
        </div>
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">Soins (en euros)</span>
          <span className="tuteur-money-row__value ax-num">{formatEur(q.amount_eur)}</span>
        </div>
        <div className="tuteur-money-row">
          <span className="tuteur-money-row__label">
            {feesPct ? `Frais de service (${feesPct} %)` : 'Frais de service'}
          </span>
          <span className="tuteur-money-row__value ax-num">{formatEur(q.fees_eur)}</span>
        </div>
        <hr className="ax-divider" aria-hidden="true" />
        <div className="tuteur-money-row tuteur-money-row--total">
          <span className="tuteur-money-row__label">Vous payez</span>
          <span className="tuteur-money-row__value ax-num">{formatEur(q.total_eur)}</span>
        </div>
      </>
    );
  }, [phase]);

  /* ── render ── */

  if (!validId) {
    return (
      <div className="tuteur-screen">
        <ErrorAlert error={new ApiError(404, ['Cette demande est introuvable.'])} />
        <Link className="ax-link" href="/tuteur/demandes">← Toutes les demandes</Link>
      </div>
    );
  }

  if (loading) return <LoadingCard />;

  if (noActiveLink) {
    return (
      <div className="tuteur-screen">
        <EmptyState
          icon={HEART_ICON}
          title="Aucun protégé pour le moment"
          text="Acceptez une invitation ou ajoutez un proche : les demandes de paiement de ses soins apparaîtront ici."
        >
          <p style={{ margin: 'var(--ax-space-3) 0 0' }}>
            <Link className="ax-btn ax-btn--secondary" href="/tuteur/proteges">
              <span className="ax-btn__label">Ajouter un proche</span>
            </Link>
          </p>
        </EmptyState>
        <Link className="ax-link" href="/tuteur/demandes">← Toutes les demandes</Link>
      </div>
    );
  }

  if (error || !request) {
    const err =
      error && error.status === 404
        ? new ApiError(404, ['Cette demande est introuvable ou ne vous a pas été partagée.'])
        : (error ?? new ApiError(0, ['Une erreur est survenue.']));
    return (
      <div className="tuteur-screen">
        <ErrorAlert error={err} onRetry={err.status === 404 ? undefined : () => void load()} />
        <Link className="ax-link" href="/tuteur/demandes">← Toutes les demandes</Link>
      </div>
    );
  }

  const name = protegeName(request.patient);

  /* — quote screen (one action: pay) — */
  if (phase.kind === 'quote') {
    return (
      <div className="tuteur-screen">
        <div className="tuteur-money-card" role="region" aria-label="Devis de paiement">
          <div className="tuteur-money-card__head">
            <span className="tuteur-money-card__label">Votre devis</span>
            <span className="tuteur-money-card__number">{request.center_name}</span>
          </div>
          <hr className="ax-divider" aria-hidden="true" />
          {quoteRows}
          <p className="tuteur-money-card__trust">
            <span className="tuteur-money-card__trust-icon" aria-hidden="true">{SHIELD_ICON}</span>
            <span>
              Le taux est figé maintenant&nbsp;: ce montant ne bougera plus. Le centre reçoit
              100&nbsp;% de la somme en francs comoriens — vous payez le centre de santé, jamais un
              intermédiaire.
            </span>
          </p>
        </div>
        {actionError && <ErrorAlert error={actionError} />}
        <button
          type="button"
          className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
          disabled={actionBusy}
          onClick={() => void confirmPay()}
        >
          <span className="ax-btn__label">
            {actionBusy ? 'Un instant…' : `Payer ${formatEur(phase.quote.total_eur)}`}
          </span>
        </button>
        <button
          type="button"
          className="ax-btn ax-btn--ghost ax-btn--block"
          disabled={actionBusy}
          onClick={() => setPhase({ kind: 'view' })}
        >
          <span className="ax-btn__label">Revenir sans payer</span>
        </button>
      </div>
    );
  }

  /* — waiting screen (honest, webhook-driven) — */
  if (phase.kind === 'waiting') {
    return (
      <div className="tuteur-screen">
        <div className="tuteur-wait" role="status" aria-live="polite">
          {!phase.slow && (
            <span className="ax-spinner ax-spinner--lg" aria-hidden="true">
              <span className="ax-spinner__glyph"></span>
            </span>
          )}
          <h2 className="tuteur-wait__title">
            {phase.slow ? 'La confirmation prend plus de temps que prévu' : 'Paiement en cours'}
          </h2>
          <p className="tuteur-wait__text">
            {phase.slow
              ? 'Si votre banque a refusé le paiement, rien n’a été débité. Sinon, la confirmation arrivera — votre paiement n’est pas perdu. Vous pouvez revenir plus tard.'
              : 'Votre paiement est en cours de confirmation par le prestataire de paiement. Vous pouvez rester sur cette page.'}
          </p>
          {phase.slow && (
            <button
              type="button"
              className="ax-btn ax-btn--secondary"
              disabled={actionBusy}
              onClick={() => void manualCheck()}
            >
              <span className="ax-btn__label">{actionBusy ? 'Vérification…' : 'Vérifier maintenant'}</span>
            </button>
          )}
        </div>
        <div className="tuteur-money-card" role="region" aria-label="Récapitulatif du paiement">
          {quoteRows}
        </div>
        {actionError && <ErrorAlert error={actionError} />}
      </div>
    );
  }

  /* — success screen — */
  if (phase.kind === 'paid') {
    return (
      <div className="tuteur-screen">
        <div className="tuteur-money-card" role="region" aria-label="Paiement confirmé">
          <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill" style={{ alignSelf: 'flex-start' }}>
            <span className="ax-badge__dot" />Paiement confirmé
          </span>
          <div className="tuteur-money-card__kmf">
            <span className="tuteur-money-card__kmf-label">Le centre a reçu</span>
            <span className="tuteur-money-card__kmf-amount ax-num">
              {formatKmf(phase.intent.amount_kmf)}
            </span>
          </div>
          <p style={{ margin: 0, textAlign: 'center', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
            pour les soins de <b style={{ color: 'var(--ax-text-strong)' }}>{name}</b> à{' '}
            {request.center_name}.
          </p>
          <div className="tuteur-money-row">
            <span className="tuteur-money-row__label">Vous avez payé</span>
            <span className="tuteur-money-row__value ax-num">{formatEur(phase.intent.amount_eur)}</span>
          </div>
          <div className="tuteur-money-row">
            <span className="tuteur-money-row__label">dont frais de service</span>
            <span className="tuteur-money-row__value ax-num">{formatEur(phase.quote.fees_eur)}</span>
          </div>
          <div className="tuteur-money-row">
            <span className="tuteur-money-row__label">Taux appliqué</span>
            <span className="tuteur-money-row__value ax-num">{formatRate(phase.intent.exchange_rate)}</span>
          </div>
          <p className="tuteur-money-card__note">
            Votre reçu officiel apparaîtra dans l&rsquo;onglet Reçus dès que le centre aura confirmé
            le soin et clôturé la demande.
          </p>
        </div>
        <Link className="ax-btn ax-btn--primary ax-btn--block" href="/tuteur/recus">
          <span className="ax-btn__label">Voir mes reçus</span>
        </Link>
        <button
          type="button"
          className="ax-btn ax-btn--ghost ax-btn--block"
          onClick={() => setPhase({ kind: 'view' })}
        >
          <span className="ax-btn__label">Revenir à la demande</span>
        </button>
      </div>
    );
  }

  /* — default view — */
  return (
    <div className="tuteur-screen">
      <Link className="ax-link" href="/tuteur/demandes" style={{ fontSize: 'var(--ax-text-sm)' }}>
        ← Toutes les demandes
      </Link>

      {disputeSent && (
        <div className="ax-alert ax-alert--info" role="status">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0 }}>
              Signalement envoyé. Le centre va l&rsquo;examiner — la demande est en litige le temps
              de l&rsquo;éclaircir.
            </p>
          </div>
        </div>
      )}

      <section className="ax-card" style={{ margin: 0 }} aria-label="Demande de paiement">
        <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
          <div className="tuteur-pr-card__top" style={{ marginBlockEnd: 0 }}>
            <span className="tuteur-pr-card__who">
              <span className="tuteur-pr-card__name">{name}</span>
              <span className="tuteur-pr-card__center">{request.center_name}</span>
            </span>
            <span className="tuteur-pr-card__amount ax-num">{formatKmf(request.total_kmf)}</span>
          </div>
          <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)' }}>
            <PrStatusBadge status={request.status} />
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              {formatDate(request.created_at)}
            </span>
          </div>
        </div>
      </section>

      <section className="ax-card" style={{ margin: 0 }} aria-label="Détail des montants">
        <div className="ax-card__header">
          <div className="ax-card__titles"><h2 className="ax-card__title">Détail</h2></div>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
          {request.lines.map((line, i) => (
            <div key={i} className="tuteur-money-row">
              <span className="tuteur-money-row__label">
                {GENERIC_CATEGORY_LABELS[line.generic_category]}
              </span>
              <span className="tuteur-money-row__value ax-num">{formatKmf(line.amount_kmf)}</span>
            </div>
          ))}
          <hr className="ax-divider" aria-hidden="true" />
          <div className="tuteur-money-row tuteur-money-row--total">
            <span className="tuteur-money-row__label">Total</span>
            <span className="tuteur-money-row__value ax-num">{formatKmf(request.total_kmf)}</span>
          </div>
          <PrivacyNote />
        </div>
      </section>

      <section className="ax-card" style={{ margin: 0 }} aria-label="Suivi de la demande">
        <div className="ax-card__header">
          <div className="ax-card__titles"><h2 className="ax-card__title">Suivi</h2></div>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          <StatusTimeline request={request} />
        </div>
      </section>

      {actionError && <ErrorAlert error={actionError} />}

      {request.status === 'envoyee' &&
        (intentGuard ? (
          <>
            <div className="ax-alert ax-alert--warning" role="status">
              <div className="ax-alert__content">
                <p className="ax-alert__message" style={{ margin: 0 }}>
                  Un paiement est peut-être déjà en cours pour cette demande. Attendez quelques
                  minutes ou vérifiez vos reçus.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--lg ax-btn--block"
              disabled={actionBusy}
              onClick={() => void load()}
            >
              <span className="ax-btn__label">Vérifier maintenant</span>
            </button>
            <button
              type="button"
              className="ax-btn ax-btn--link"
              style={{ alignSelf: 'center', fontSize: 'var(--ax-text-sm)' }}
              disabled={actionBusy}
              onClick={() => void openQuote()}
            >
              <span>Payer quand même</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ax-btn ax-btn--primary ax-btn--lg ax-btn--block"
            disabled={actionBusy}
            onClick={() => void openQuote()}
          >
            <span className="ax-btn__label">
              {actionBusy ? 'Préparation du devis…' : 'Voir le devis et payer'}
            </span>
          </button>
        ))}

      {request.status === 'cloturee' && (
        <Link className="ax-btn ax-btn--secondary ax-btn--block" href="/tuteur/recus">
          <span className="ax-btn__label">Voir mes reçus</span>
        </Link>
      )}

      {(request.status === 'envoyee' || request.status === 'payee') && (
        <button
          type="button"
          className="ax-btn ax-btn--ghost ax-btn--block"
          onClick={() => {
            setDisputeError(null);
            setDisputeOpen(true);
          }}
        >
          <span className="ax-btn__label">Signaler un problème</span>
        </button>
      )}

      {request.status === 'envoyee' && (
        <p className="tuteur-money-card__note ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, color: 'var(--ax-accent)' }}>{SHIELD_ICON}</span>
          <span>
            Vous payez le centre de santé, jamais un intermédiaire. Le montant en euros et le taux
            de change vous seront montrés avant toute confirmation.
          </span>
        </p>
      )}

      {disputeOpen && (
        <DisputeModal
          onClose={() => setDisputeOpen(false)}
          onSubmit={(reason) => void sendDispute(reason)}
          submitting={disputeBusy}
          error={disputeError}
          reason={disputeReason}
          onReasonChange={setDisputeReason}
        />
      )}
    </div>
  );
}

export default TuteurDemandeDetail;
