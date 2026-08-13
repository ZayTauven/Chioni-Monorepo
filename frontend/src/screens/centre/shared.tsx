'use client';
/*
 * Chioni — shared primitives of the CENTRE space screens.
 *
 * Everything here builds on the Vireo ax-* design system (components.css) and
 * the central API client. No screen of src/screens/centre/ talks to fetch()
 * directly: data flows through useAsync + the endpoints of lib/endpoints/centers.ts,
 * errors are ApiError normalised by the client.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCenter } from '@/context/CenterContext';
import { ApiError } from '@/lib/api';
import { getPatient } from '@/lib/endpoints/centers';
import type {
  ClaimStatus,
  DisputeStatus,
  EncounterStatus,
  InvoiceStatus,
  KycStatus,
  PaymentRequestStatus,
  StaffRole,
} from '@/lib/types';

/* ── constants ── */

/** DRF PageNumberPagination — 20 items per page (api-contract.md). */
export const PAGE_SIZE = 20;

/* ── roles (mirror of backend trustbridge/medical views) ── */

export const BILLING_ROLES: StaffRole[] = ['directeur', 'secretaire', 'caissier'];
export const CLINICAL_ROLES: StaffRole[] = ['medecin', 'infirmier', 'sage_femme'];
export const PRESCRIBER_ROLES: StaffRole[] = ['medecin', 'sage_femme'];
export const PRESCRIPTION_READ_ROLES: StaffRole[] = [...CLINICAL_ROLES, 'pharmacien'];
export const CARE_CONFIRM_ROLES: StaffRole[] = ['directeur', 'medecin', 'infirmier', 'sage_femme', 'pharmacien'];
export const TARIFF_WRITE_ROLES: StaffRole[] = ['directeur', 'caissier'];

export function hasRole(role: StaffRole, allowed: StaffRole[]): boolean {
  return allowed.includes(role);
}

/* ── async data hook ── */

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  return new ApiError(0, ['Connexion impossible. Vérifiez votre réseau puis réessayez.']);
}

/**
 * Run an async fetcher tied to `deps`; cancelled on unmount / deps change.
 * `reload()` re-runs with the same deps (after a mutation).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setError(toApiError(err));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** Debounce a changing value (search inputs → server `?q=`). */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/* ── patient-name cache (staff serializers carry patient ids only) ── */

const patientNameCache = new Map<string, string>();

/**
 * Resolve patient display names for a set of ids (one fetch per unknown id,
 * cached for the session). Honest data — every name comes from
 * GET /centers/{c}/patients/{id}/ ; unresolved ids show as « Patient n° X ».
 */
export function usePatientNames(centerId: number, ids: number[]): Record<number, string> {
  const [names, setNames] = useState<Record<number, string>>({});
  const key = ids.slice().sort((a, b) => a - b).join(',');

  useEffect(() => {
    let cancelled = false;
    const wanted = key ? key.split(',').map(Number) : [];
    const resolved: Record<number, string> = {};
    const missing: number[] = [];
    for (const id of wanted) {
      const cached = patientNameCache.get(`${centerId}:${id}`);
      if (cached) resolved[id] = cached;
      else missing.push(id);
    }
    setNames(resolved);
    if (missing.length === 0) return;
    Promise.allSettled(
      missing.map(async (id) => {
        const patient = await getPatient(centerId, id);
        const name = `${patient.first_name} ${patient.last_name}`.trim() || `Patient n° ${id}`;
        patientNameCache.set(`${centerId}:${id}`, name);
        return [id, name] as const;
      }),
    ).then((settled) => {
      if (cancelled) return;
      setNames((prev) => {
        const next = { ...prev };
        for (const item of settled) {
          if (item.status === 'fulfilled') next[item.value[0]] = item.value[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [centerId, key]);

  return names;
}

export function patientLabel(names: Record<number, string>, id: number): string {
  return names[id] ?? `Patient n° ${id}`;
}

/* ── status → tone maps ── */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export const PAYMENT_REQUEST_TONES: Record<PaymentRequestStatus, BadgeTone> = {
  brouillon: 'neutral',
  envoyee: 'info',
  payee: 'success',
  soin_confirme: 'accent',
  cloturee: 'neutral',
  litige: 'danger',
};

export const INVOICE_TONES: Record<InvoiceStatus, BadgeTone> = {
  brouillon: 'neutral',
  emise: 'info',
  payee: 'success',
  annulee: 'danger',
};

export const ENCOUNTER_TONES: Record<EncounterStatus, BadgeTone> = {
  en_cours: 'info',
  terminee: 'success',
  annulee: 'neutral',
};

export const CLAIM_TONES: Record<ClaimStatus, BadgeTone> = {
  non_revendique: 'neutral',
  invite: 'warning',
  actif: 'success',
};

export const KYC_TONES: Record<KycStatus, BadgeTone> = {
  en_attente: 'warning',
  actif: 'success',
  suspendu: 'danger',
};

export const DISPUTE_TONES: Record<DisputeStatus, BadgeTone> = {
  ouvert: 'danger',
  resolu: 'success',
};

export function StatusBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <span className={`ax-badge ax-badge--soft ax-badge--${tone} ax-badge--pill`}>
      <span className="ax-badge__dot" />
      {label}
    </span>
  );
}

/* ── icons (Tabler outlines, same stroke contract as Vireo screens) ── */

interface IconProps {
  className?: string;
}

function icon(paths: ReactNode) {
  return function Icon({ className = 'ax-btn__icon' }: IconProps) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

export const IconPlus = icon(<><path d="M12 5l0 14" /><path d="M5 12l14 0" /></>);
export const IconSearch = icon(<><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></>);
export const IconClose = icon(<><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></>);
export const IconChevronRight = icon(<path d="M9 6l6 6l-6 6" />);
export const IconArrowLeft = icon(<><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></>);
export const IconEdit = icon(<><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></>);
export const IconCheck = icon(<path d="M5 12l5 5l10 -10" />);
export const IconSend = icon(<><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></>);
export const IconMerge = icon(<><path d="M7 7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M7 9v6" /><path d="M9 7.5l6 3" /><path d="M9 16.5l6 -3" /></>);
export const IconRefresh = icon(<><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></>);
export const IconReceipt = icon(<path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />);
export const IconAlertTriangle = icon(<><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.871l-8.106 -13.534a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></>);
export const IconStethoscope = icon(<><path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" /><path d="M8 15a6 6 0 1 0 12 0v-3" /><path d="M11 3v2" /><path d="M6 3v2" /><path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></>);
export const IconUserOff = icon(<><path d="M8.18 8.189a4.01 4.01 0 0 0 2.616 2.627m3.507 -.545a4 4 0 1 0 -5.59 -5.552" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4c.412 0 .81 .062 1.183 .178m2.633 2.618c.12 .38 .184 .785 .184 1.204v2" /><path d="M3 3l18 18" /></>);

/* ── error rendering ── */

/**
 * 404 companion: the resource may be invisible because the caller's accesses
 * changed (revoked membership, switched center). Re-fetch /auth/me/ and, if
 * the active center is no longer among the memberships, leave for /espaces.
 */
function RefreshAccessButton() {
  const { refreshMe } = useAuth();
  const { centerId } = useCenter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const fresh = await refreshMe();
      if (!fresh.staff_memberships.some((m) => m.center.id === centerId)) {
        router.replace('/espaces');
        return;
      }
    } catch {
      /* session-level failures are handled by the auth guard */
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      className="ax-btn ax-btn--secondary ax-btn--sm"
      onClick={() => void onClick()}
      disabled={busy}
    >
      <IconRefresh />
      <span className="ax-btn__label">{busy ? 'Vérification…' : 'Actualiser mes accès'}</span>
    </button>
  );
}

/** Card-level error: global messages of an ApiError in a danger alert. */
export function ErrorAlert({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const messages =
    error.messages.length > 0
      ? error.messages
      : ['Une erreur est survenue. Réessayez dans un instant.'];
  return (
    <div className="ax-alert ax-alert--danger" role="alert">
      <span className="ax-alert__icon">
        <IconAlertTriangle className="" />
      </span>
      <div className="ax-alert__content">
        {messages.map((m) => (
          <p key={m} className="ax-alert__message">
            {m}
          </p>
        ))}
        {error.status === 403 && (
          <p className="ax-alert__message">Votre rôle dans ce centre ne permet pas cette action.</p>
        )}
        {error.status === 404 && (
          <div className="ax-alert__actions" style={{ marginTop: 'var(--ax-space-2)' }}>
            <RefreshAccessButton />
          </div>
        )}
      </div>
      {onRetry && (
        <div className="ax-alert__actions">
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={onRetry}>
            <IconRefresh />
            <span className="ax-btn__label">Réessayer</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Field-level serializer error, rendered under its input. */
export function FieldError({ error, field }: { error: ApiError | null; field: string }) {
  const messages = error?.fieldErrors[field];
  if (!messages || messages.length === 0) return null;
  return <span className="ax-field__message ax-field__message--error">{messages.join(' ')}</span>;
}

/* ── loading / empty states ── */

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)' }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 'var(--ax-space-4)' }}>
          {Array.from({ length: cols }, (_, c) => (
            <span key={c} className="ax-skeleton ax-skeleton--line ax-skeleton--shimmer" style={{ height: 14 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)' }}>
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="ax-skeleton ax-skeleton--line ax-skeleton--shimmer"
          style={{ height: 14, width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

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
    <div style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)' }}>
      <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: action ? 'var(--ax-space-4)' : 0 }}>
        {message}
      </p>
      {action}
    </div>
  );
}

/* ── server-side pagination (DRF ?page=) ── */

function pageList(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | '…'> = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p += 1) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

export function Pagination({
  count,
  page,
  onPage,
}: {
  count: number;
  page: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(count, page * PAGE_SIZE);
  return (
    <div
      className="ax-card__footer"
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}
    >
      <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
        {start}–{end} sur {count}
      </span>
      <nav className="ax-pagination" aria-label="Pagination">
        <button
          type="button"
          className="ax-pagination__prev"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          aria-label="Page précédente"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
        </button>
        <ul className="ax-pagination__pages">
          {pageList(page, totalPages).map((p, i) => (
            <li key={`${p}-${i}`}>
              {p === '…' ? (
                <span className="ax-pagination__ellipsis">…</span>
              ) : (
                <button
                  type="button"
                  className={`ax-pagination__page${page === p ? ' is-active' : ''}`}
                  aria-current={page === p ? 'page' : undefined}
                  onClick={() => onPage(p)}
                >
                  {p}
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="ax-pagination__next"
          disabled={page === totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Page suivante"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
        </button>
      </nav>
    </div>
  );
}

/* ── modal (Contacts pattern: backdrop + centered card) ── */

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 520,
  labelledById,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  labelledById?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div>
      <div
        className="ax-backdrop"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.4)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labelledById ? undefined : title}
        aria-labelledby={labelledById}
        style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-4)', pointerEvents: 'none' }}
      >
        <div
          className="ax-card"
          onClick={(e) => e.stopPropagation()}
          style={{ width: `min(${width}px,100%)`, maxHeight: '90vh', overflow: 'auto', pointerEvents: 'auto' }}
        >
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title" id={labelledById}>
                {title}
              </h2>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={onClose} aria-label="Fermer">
              <IconClose />
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {children}
          </div>
          {footer && (
            <div
              className="ax-card__footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── small display helpers ── */

/** Detail row: label above value — used by every detail screen. */
export function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}
      >
        {label}
      </div>
      <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{children}</div>
    </div>
  );
}

/** Initials for an avatar chip. */
export function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

const AVATAR_COLORS = ['var(--ax-viz-cyan)', 'var(--ax-viz-violet)', 'var(--ax-viz-pink)', 'var(--ax-viz-amber)', 'var(--ax-viz-emerald)'];

export function avatarColor(seed: number | string): string {
  const n = typeof seed === 'number' ? seed : seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(n) % AVATAR_COLORS.length];
}

export function AvatarChip({ name, seed, size = 'sm' }: { name: string; seed: number | string; size?: 'sm' | 'md' }) {
  const color = avatarColor(seed);
  return (
    <span
      className={`ax-avatar ax-avatar--${size === 'sm' ? 'sm' : 'md'} ax-avatar--squircle`}
      style={{ background: `color-mix(in oklab,${color} 18%,transparent)`, color, fontWeight: 600, flex: '0 0 auto' }}
    >
      {initialsOf(name)}
    </span>
  );
}
