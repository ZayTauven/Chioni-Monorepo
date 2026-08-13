'use client';
/*
 * Chioni — shared building blocks of the guardian space.
 *
 * Wording note: the guardian-facing payment-request status labels live in
 * src/lib/labels.ts (PR_STATUS_TUTEUR / PR_STATUS_TUTEUR_SHORT) — they speak
 * from the guardian's point of view and are centralised there with every
 * other reader-facing string (single shikomori extraction point).
 *
 * Privacy invariant (ADR 0005): nothing in this space ever shows an act
 * label, a diagnosis or a reason — generic categories and amounts only.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { ApiError } from '@/lib/api';
import { PR_STATUS_TUTEUR, PR_STATUS_TUTEUR_SHORT, formatWait } from '@/lib/labels';
import type { PaymentRequestStatus, ProtegePatient } from '@/lib/types';

/* ── guardian-facing wording ── */

const STATUS_TONE: Record<PaymentRequestStatus, string> = {
  brouillon: 'neutral',
  envoyee: 'warning',
  payee: 'info',
  soin_confirme: 'success',
  cloturee: 'success',
  litige: 'danger',
};

export function PrStatusBadge({
  status,
  short = false,
}: {
  status: PaymentRequestStatus;
  short?: boolean;
}) {
  const label = (short ? PR_STATUS_TUTEUR_SHORT : PR_STATUS_TUTEUR)[status];
  return (
    <span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--${STATUS_TONE[status]}`}>
      <span className="ax-badge__dot" />
      {label}
    </span>
  );
}

/* ── small helpers ── */

export function protegeName(p: ProtegePatient): string {
  return `${p.first_name} ${p.last_name}`.trim() || 'Votre proche';
}

export function protegeInitials(p: ProtegePatient): string {
  const a = p.first_name.trim().charAt(0);
  const b = p.last_name.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

/** Normalise any thrown value into an ApiError for display. */
export function toDisplayError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError(0, ['Connexion impossible. Vérifiez votre réseau et réessayez.']);
}

/* ── async list with "Voir plus" (contract: PageNumberPagination, 20/page) ── */

export interface PagedList<T> {
  items: T[];
  count: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
}

interface PageShape<T> {
  count: number;
  next: string | null;
  results: T[];
}

export function usePagedList<T>(fetchPage: (page: number) => Promise<PageShape<T>>): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const pageRef = useRef(1);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPage(1);
      pageRef.current = 1;
      setItems(data.results);
      setCount(data.count);
      setHasMore(data.next !== null);
    } catch (e) {
      setError(toDisplayError(e));
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const next = pageRef.current + 1;
      const data = await fetchPage(next);
      pageRef.current = next;
      setItems((prev) => [...prev, ...data.results]);
      setCount(data.count);
      setHasMore(data.next !== null);
    } catch (e) {
      setError(toDisplayError(e));
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, count, hasMore, loading, loadingMore, error, reload, loadMore };
}

/* ── stateless UI blocks ── */

export function LoadingCard({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div
      className="ax-center"
      style={{ padding: 'var(--ax-space-7) var(--ax-space-4)' }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <span className="ax-spinner ax-spinner--md" aria-hidden="true">
        <span className="ax-spinner__glyph"></span>
      </span>
    </div>
  );
}

export function ErrorAlert({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  // 429 comes back in English from DRF — replace it with our own words.
  const messages =
    error.status === 429
      ? [
          error.retryAfterSeconds
            ? `Trop d’essais rapprochés. Pour protéger votre compte, réessayez dans ${formatWait(error.retryAfterSeconds)}.`
            : 'Trop d’essais rapprochés. Patientez un moment avant de réessayer.',
        ]
      : error.messages.length > 0
        ? error.messages
        : ['Une erreur est survenue. Réessayez.'];
  return (
    <div className="ax-alert ax-alert--danger" role="alert">
      <div className="ax-alert__content">
        {messages.map((m) => (
          <p key={m} className="ax-alert__message" style={{ margin: 0 }}>
            {m}
          </p>
        ))}
      </div>
      {onRetry && (
        <div className="ax-alert__actions">
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={onRetry}>
            <span className="ax-btn__label">Réessayer</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="tuteur-empty" role="status">
      {icon && (
        <span className="tuteur-empty__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="tuteur-empty__title">{title}</p>
      {text && <p className="tuteur-empty__text">{text}</p>}
      {children}
    </div>
  );
}

/**
 * The discreet privacy disclosure. Shown next to every list of payment lines:
 * the guardian never sees medical detail, and this is presented as the
 * patient's dignity — not as a technical limitation.
 */
export function PrivacyNote() {
  return (
    <details className="tuteur-privacy">
      <summary>Pourquoi je ne vois pas le détail médical&nbsp;?</summary>
      <div className="tuteur-privacy__panel">
        Le dossier médical de votre proche reste privé. Il peut choisir de vous en partager
        davantage depuis son espace.
      </div>
    </details>
  );
}

/* ── modal (ax-modal DOM contract : portal + focus trap + Escape,
      same contract as the patient space's Modal) ── */

export function Modal({
  title,
  onClose,
  children,
  footer,
  labelledById,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledById?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const autoId = useId();
  const titleId = labelledById ?? `tuteur-modal-title-${autoId}`;

  useEffect(() => setMounted(true), []);
  // Initial focus, Tab trapping and focus restoration on close.
  useFocusTrap(dialogRef, mounted);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="ax-modal ax-modal--centered" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ax-modal__backdrop" onClick={onClose} aria-hidden="true"></div>
      <div ref={dialogRef} className="ax-modal__dialog ax-modal__dialog--sm">
        <div className="ax-modal__header">
          <h2 className="ax-modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="ax-modal__close" aria-label="Fermer" onClick={onClose}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6l-12 12" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="ax-modal__body">{children}</div>
        {footer && <div className="ax-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ── decline-invitation modal (shared by TuteurHome and TuteurProteges).
      Declining is DEFINITIVE backend-side (the link becomes `revoque`) —
      the modal says so plainly, and says the guardian owes no explanation. ── */

export function DeclineInvitationModal({
  patientName,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  patientName: string;
  busy: boolean;
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Refuser cette invitation ?" onClose={onClose}>
      <div className="ax-stack" style={{ gap: 'var(--ax-space-4)' }}>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
          Ce refus est définitif : le lien avec{' '}
          <b style={{ color: 'var(--ax-text-strong)' }}>{patientName}</b> ne pourra pas être
          rétabli. Vous n&rsquo;avez pas à vous justifier.
        </p>
        {error && <ErrorAlert error={error} />}
        <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}>
          <button type="button" className="ax-btn ax-btn--ghost" disabled={busy} onClick={onClose}>
            <span className="ax-btn__label">Revenir</span>
          </button>
          <button type="button" className="ax-btn ax-btn--danger" disabled={busy} onClick={onConfirm}>
            <span className="ax-btn__label">{busy ? 'Refus…' : 'Refuser définitivement'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── dispute modal (shared by detail screen; reason is REQUIRED).
      The reason state lives in the PARENT screen so an accidental close
      (backdrop, Escape) never loses what the user typed. ── */

export function DisputeModal({
  onClose,
  onSubmit,
  submitting,
  error,
  reason,
  onReasonChange,
}: {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  submitting: boolean;
  error: ApiError | null;
  reason: string;
  onReasonChange: (reason: string) => void;
}) {
  const trimmed = reason.trim();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || submitting) return;
    onSubmit(trimmed);
  };

  return (
    <Modal title="Signaler un problème" onClose={onClose}>
      <form onSubmit={handleSubmit} className="ax-stack" style={{ gap: 'var(--ax-space-4)' }}>
        <div className="ax-alert ax-alert--warning" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ margin: 0 }}>
              Le centre verra votre signalement. Décrivez le problème simplement&nbsp;: la demande
              sera mise en attente le temps de l&rsquo;examiner.
            </p>
          </div>
        </div>
        <div className="ax-field">
          <label className="ax-field__label" htmlFor="tuteur-dispute-reason">
            Quel est le problème&nbsp;? <span className="ax-field__required">*</span>
          </label>
          <textarea
            id="tuteur-dispute-reason"
            className="ax-textarea"
            rows={4}
            required
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Expliquez avec vos mots ce qui ne va pas."
          />
        </div>
        {error && <ErrorAlert error={error} />}
        <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose}>
            <span className="ax-btn__label">Annuler</span>
          </button>
          <button
            type="submit"
            className="ax-btn ax-btn--danger"
            disabled={!trimmed || submitting}
          >
            <span className="ax-btn__label">
              {submitting ? 'Envoi…' : 'Envoyer le signalement'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── shared inline icons (Tabler outline, currentColor) ── */

export const SHIELD_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={22}
    height={22}
    aria-hidden="true"
  >
    <path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" />
    <path d="M15 19l2 2l4 -4" />
  </svg>
);

export const RECEIPT_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={22}
    height={22}
    aria-hidden="true"
  >
    <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
    <path d="M9 7l6 0" />
    <path d="M9 11l6 0" />
    <path d="M13 15l2 0" />
  </svg>
);

export const HEART_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={22}
    height={22}
    aria-hidden="true"
  >
    <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
  </svg>
);

export const INVOICE_ICON = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={22}
    height={22}
    aria-hidden="true"
  >
    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
    <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
    <path d="M9 7l1 0" />
    <path d="M9 13l6 0" />
    <path d="M13 17l2 0" />
  </svg>
);
