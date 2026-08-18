'use client';
/*
 * Chioni — patient-space UI primitives (owned by the patient feature).
 *
 * Local re-expressions of Vireo patterns (ax-modal, ax-alert, ax-skeleton,
 * ax-badge) tuned for Mariama: one clear message at a time, block buttons
 * ≥48px, short French sentences, no jargon. The Modal mirrors the template's
 * ui/_uikit Modal (portal + focus trap + Escape) — copied here because
 * src/components/** is out of this feature's write scope.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { ApiError } from '@/lib/api';
import {
  ENCOUNTER_STATUS_LABELS,
  GUARDIAN_LINK_STATUS_LABELS,
  PR_STATUS_PATIENT,
  PRESCRIPTION_STATUS_LABELS,
  STAY_STATUS_PATIENT,
} from '@/lib/labels';
import type {
  EncounterStatus,
  GuardianLinkStatus,
  PaymentRequestStatus,
  PrescriptionStatus,
  StayStatus,
} from '@/lib/types';

/* ── error normalisation for display ── */

const NETWORK_MESSAGE =
  'Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.';

/** Human-readable messages out of any thrown value (ApiError or network). */
export function errorMessages(err: unknown): string[] {
  if (err instanceof ApiError) {
    const msgs = [...err.messages];
    for (const list of Object.values(err.fieldErrors)) msgs.push(...list);
    return msgs.length > 0 ? msgs : [`La requête a échoué (code ${err.status}).`];
  }
  return [NETWORK_MESSAGE];
}

/* ── alerts ── */

const ALERT_ICON = (
  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
);

const CHECK_ICON = (
  <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
);

/** Failure alert with plain words and an optional big retry button. */
export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const messages = errorMessages(error);
  return (
    <div role="alert" className="ax-alert ax-alert--danger">
      {ALERT_ICON}
      <div className="ax-alert__content">
        {messages.map((msg) => (
          <p key={msg} className="ax-alert__message">{msg}</p>
        ))}
        {onRetry && (
          <div className="ax-alert__actions">
            <button type="button" className="ax-btn ax-btn--sm ax-btn--outline" onClick={onRetry}>
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Quiet confirmation banner after a successful action. */
export function SuccessAlert({ message }: { message: string }) {
  return (
    <div role="status" className="ax-alert ax-alert--success">
      {CHECK_ICON}
      <div className="ax-alert__content">
        <p className="ax-alert__message">{message}</p>
      </div>
    </div>
  );
}

/* ── loading & empty states ── */

/** Card-shaped skeletons while a list loads.
 *  SV — le squelette S'ANNONCE (dette a11y S5) : région `status` polie avec
 *  un libellé masqué, les lignes décoratives restant hors de l'arbre. */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">Chargement en cours…</span>
      <div className="pat-stack" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <section key={i} className="ax-card">
            <div className="ax-card__body pat-skeleton-body">
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '55%' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '85%' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '40%' }} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Kind empty state: says what the screen will hold, offers one action at most. */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="ax-card" role="region" aria-label={title}>
      <div className="ax-card__body pat-empty">
        {/* SV — un `p` stylé et non un `h3` : l'état vide se pose parfois
            directement sous le titre de page, sans niveau intermédiaire. */}
        <p className="pat-empty__title">{title}</p>
        <p className="pat-empty__message">{message}</p>
        {action}
      </div>
    </section>
  );
}

/** « Voir plus » — friendlier than numbered pagination. */
export function LoadMoreButton({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      className={`ax-btn ax-btn--secondary ax-btn--lg ax-btn--block${loading ? ' is-loading' : ''}`}
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
    >
      <span className="ax-btn__spinner" aria-hidden="true"></span>
      <span className="ax-btn__label">Voir plus</span>
    </button>
  );
}

/* ── status badges (French, tones mapped locally) ── */

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <span className={`ax-badge ax-badge--soft ax-badge--${tone}`}>{label}</span>;
}

const PAYMENT_TONES: Record<PaymentRequestStatus, BadgeTone> = {
  brouillon: 'neutral',
  envoyee: 'info',
  payee: 'success',
  soin_confirme: 'success',
  cloturee: 'neutral',
  litige: 'warning',
};

export function PaymentStatusBadge({ status }: { status: PaymentRequestStatus }) {
  return <Badge tone={PAYMENT_TONES[status]} label={PR_STATUS_PATIENT[status]} />;
}

const LINK_TONES: Record<GuardianLinkStatus, BadgeTone> = {
  invitation_envoyee: 'info',
  attente_confirmation_titulaire: 'warning',
  actif: 'success',
  revoque: 'neutral',
};

export function GuardianLinkStatusBadge({ status }: { status: GuardianLinkStatus }) {
  return <Badge tone={LINK_TONES[status]} label={GUARDIAN_LINK_STATUS_LABELS[status]} />;
}

const ENCOUNTER_TONES: Record<EncounterStatus, BadgeTone> = {
  en_cours: 'info',
  terminee: 'success',
  annulee: 'neutral',
};

export function EncounterStatusBadge({ status }: { status: EncounterStatus }) {
  return <Badge tone={ENCOUNTER_TONES[status]} label={ENCOUNTER_STATUS_LABELS[status]} />;
}

const PRESCRIPTION_TONES: Record<PrescriptionStatus, BadgeTone> = {
  emise: 'info',
  delivree: 'success',
};

export function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  return <Badge tone={PRESCRIPTION_TONES[status]} label={PRESCRIPTION_STATUS_LABELS[status]} />;
}

/**
 * S6 — l'état d'une hospitalisation, dit à la personne.
 *
 * `annule` est NEUTRE et jamais `danger` : un séjour annulé est presque
 * toujours une correction de saisie du centre, pas un échec du patient — même
 * arbitrage que « Manqué » sur un rendez-vous, qui n'est pas rouge non plus.
 */
const STAY_TONES: Record<StayStatus, BadgeTone> = {
  en_cours: 'info',
  sortie: 'success',
  annule: 'neutral',
};

export function StayStatusBadge({ status }: { status: StayStatus }) {
  return <Badge tone={STAY_TONES[status]} label={STAY_STATUS_PATIENT[status]} />;
}

/* ── modal (portal + focus trap + Escape, per the Vireo contract) ── */

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  describedBy,
  alertdialog = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  alertdialog?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useFocusTrap(dialogRef, open);
  /*
   * Le focus va à `[data-autofocus]` quand la modale en désigne un — sinon
   * `useFocusTrap` prend le PREMIER élément focalisable, c'est-à-dire le
   * bouton d'action. Une personne au clavier ou au lecteur d'écran arrivait
   * donc sur « Envoyer », jamais sur la sortie. Même contrat que la Modal du
   * socle centre (patron de l'archivage S3).
   */
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;
    /*
     * `focus()` fait DÉFILER son conteneur pour montrer l'élément visé. La
     * sortie sûre étant la dernière du dialogue, toute modale plus haute que
     * l'écran s'ouvrait déjà défilée tout en bas : on y lisait la fin d'une
     * liste et deux boutons, jamais la première phrase (« votre demande sera
     * examinée… »). Le cas n'est pas rare — la demande de suppression de
     * compte fait le double d'un écran d'Android d'entrée de gamme.
     *
     * `preventScroll` + remise à zéro du corps : le focus RESTE sur la sortie
     * (durcissement guardian, il ne bouge pas), et le texte se lit par le
     * début. Les boutons, eux, restent visibles grâce à la barre collante
     * (`.pat-confirm__actions`, patient.css) — sans elle, le focus initial
     * serait hors de vue, ce qui est un défaut d'accessibilité en soi.
     */
    node.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    node.querySelectorAll<HTMLElement>('.ax-modal__body').forEach((body) => {
      body.scrollTop = 0;
    });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;
  return createPortal(
    <div
      className="ax-modal ax-modal--centered"
      role={alertdialog ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      <div className="ax-modal__backdrop" onClick={onClose} />
      <div ref={dialogRef} className="ax-modal__dialog ax-modal__dialog--sm">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * One-decision confirmation dialog. `message` MUST state the consequence in
 * one sentence (« Ce refus est définitif. »). Buttons are stacked and
 * full-width — big targets first, escape route below.
 *
 * Focus lands on the ESCAPE route (`data-autofocus` on « Annuler »), never on
 * the action: a dialog that opens with the consequential button focused turns
 * a stray Enter into a decision. A `children` form field may claim the focus
 * back by carrying `data-autofocus` itself — it comes first in the DOM, and
 * the Modal keeps the first match.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Annuler',
  danger = false,
  busy = false,
  error,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional extra content (a form field) between message and buttons. */
  children?: ReactNode;
}) {
  const titleId = 'pat-confirm-title';
  const descId = 'pat-confirm-desc';
  /*
   * L'échec est écrit EN HAUT du dialogue, sous le titre — et le geste, lui,
   * se fait en bas. Dans une modale qui défile, la personne cliquait
   * « Envoyer », rien ne semblait bouger, et l'explication l'attendait hors
   * de vue. On ramène donc le corps à son début quand une erreur arrive : le
   * message est lu, et les boutons restent là (barre collante).
   */
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error != null) bodyRef.current?.scrollTo({ top: 0 });
  }, [error]);
  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      alertdialog
      labelledBy={titleId}
      describedBy={descId}
    >
      <div className="ax-modal__body pat-confirm" ref={bodyRef}>
        <span className={`ax-modal__status ax-modal__status--${danger ? 'danger' : 'info'}`}>
          {danger ? (
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16v.01" /><path d="M5 19h14a2 2 0 0 0 1.84 -2.75l-7.1 -12.25a2 2 0 0 0 -3.5 0l-7.1 12.25a2 2 0 0 0 1.75 2.75" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
          )}
        </span>
        <h2 className="ax-modal__title" id={titleId}>{title}</h2>
        <p id={descId} className="pat-confirm__message">{message}</p>
        {error != null && <ErrorAlert error={error} />}
        {children}
        <div className="pat-confirm__actions">
          <button
            type="button"
            className={`ax-btn ax-btn--lg ax-btn--block ${danger ? 'ax-btn--danger' : 'ax-btn--primary'}${busy ? ' is-loading' : ''}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
          >
            <span className="ax-btn__spinner" aria-hidden="true"></span>
            <span className="ax-btn__label">{confirmLabel}</span>
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--lg ax-btn--block"
            onClick={onClose}
            disabled={busy}
            data-autofocus=""
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
