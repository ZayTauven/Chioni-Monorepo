'use client';
/*
 * Chioni — shared primitives of the PLATEFORME screens (S4, ADR 0017).
 *
 * Reuse over duplication: the Vireo-derived primitives built for the centre
 * space (useAsync, Modal with its repaired focus trap, Pagination,
 * TableSkeleton, EmptyState, StatusBadge, the Tabler icon set) are neutral —
 * they touch no context — so they are re-exported here rather than copied.
 * The screens of this space therefore import ONLY from this module, which
 * keeps one rule enforceable by reading imports: **nothing in
 * `src/screens/plateforme/` may reach for `useCenter()`** (CenterContext is
 * never mounted in this space).
 *
 * The one thing NOT reused is `ErrorAlert`: the centre version offers an
 * « Actualiser mes accès » button wired to CenterContext on a 404. Here a 404
 * means « ce centre n'existe pas », and a 403 means « cette action est
 * réservée aux administrateurs » — two different sentences, and no context.
 */
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { PLATFORM_READ_ONLY_NOTICE } from '@/lib/labels';
import type { PlatformRole } from '@/lib/types';
import { IconAlertTriangle, IconRefresh } from '@/screens/centre/shared';

export {
  AvatarChip,
  CardSkeleton,
  DetailItem,
  EmptyState,
  FieldError,
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconClose,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
  KYC_TONES,
  Modal,
  PAGE_SIZE,
  Pagination,
  SUBSCRIPTION_INVOICE_TONES,
  SUBSCRIPTION_TONES,
  SUPPORT_PRIORITY_TONES,
  SUPPORT_TONES,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  useDebounced,
  type BadgeTone,
} from '@/screens/centre/shared';

/*
 * S5 — le papier imprimable (facture / reçu), adapté de
 * `ecommerce/InvoiceDetails` du template. Neutre par construction : aucun
 * contexte, aucun appel API — il est donc réexporté ici comme les primitives
 * du socle, pour que les écrans de cet espace gardent leur règle de module
 * (n'importer QUE depuis `./shared`).
 */
export {
  DocumentPaper,
  PrintDocumentButton,
  type DocumentLine,
  type DocumentParty,
  type DocumentTotal,
} from '@/components/documents/DocumentPaper';

/**
 * The operator's role, and the single write gate of the space.
 *
 * `canWrite` follows the backend exactly: `admin` alone writes. Screens must
 * NOT MOUNT a write control for a `support` — same pattern as the centre
 * dashboard's finance block, which is never mounted (fetch included) outside
 * BILLING roles. Hiding a disabled button is not cosmetic here: a back-office
 * that offers actions it will refuse teaches its operators to distrust it.
 */
export function usePlatformRole(): { role: PlatformRole | null; canWrite: boolean } {
  const { me } = useAuth();
  const role = me?.platform_staff?.role ?? null;
  return { role, canWrite: role === 'admin' };
}

/** Quiet reminder for a `support` on a screen that carries admin actions. */
export function ReadOnlyNotice() {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 'var(--ax-text-xs)',
        /* Une consigne de RÔLE (« vous êtes en lecture seule ») explique
           pourquoi des boutons manquent : `--ax-text-muted` (AA), jamais
           `--ax-text-subtle` (4,32:1 clair, 3,55:1 sombre). */
        color: 'var(--ax-text-muted)',
      }}
    >
      {PLATFORM_READ_ONLY_NOTICE}
    </p>
  );
}

/**
 * Card-level error of the platform space. Adds the two refusals that matter
 * to an operator, in the API's own words when it gave them.
 */
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
        {error.status === 404 && (
          <p className="ax-alert__message">
            Cet élément n&apos;existe pas ou plus. Revenez à la liste pour repartir d&apos;une base
            à jour.
          </p>
        )}
        {/* Un 403 sur cet espace n'est jamais une panne : c'est un `support`
            devant une action d'`admin`. Le dire évite de faire chercher un
            bug là où il y a une règle. */}
        {error.status === 403 && (
          <p className="ax-alert__message">{PLATFORM_READ_ONLY_NOTICE}</p>
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

/** Monospaced technical reference (ids, statuses) — the operator's material. */
export function Ref({ children }: { children: ReactNode }) {
  return (
    <span
      className="ax-num"
      style={{
        fontFamily: 'var(--ax-font-mono)',
        fontSize: 'var(--ax-text-xs)',
        color: 'var(--ax-text-muted)',
      }}
    >
      {children}
    </span>
  );
}
