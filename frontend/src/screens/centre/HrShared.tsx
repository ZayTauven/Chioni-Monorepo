'use client';
/*
 * Chioni — primitives partagées du registre du personnel (S7, ADR 0020).
 *
 * Ce qui vit ici est ce que PLUSIEURS écrans RH montent : les trois badges de
 * statut, le bandeau de gel décliné au registre, et le panneau des
 * justificatifs (lu par le directeur sur la décision, écrit par la personne
 * sur son propre dossier).
 *
 * Les badges sont dans un module partagé — et non recopiés — pour une raison
 * de fond : `PublicAttendanceStatus` n'a pas de valeur `conge`, et c'est
 * TypeScript qui doit refuser qu'un écran collègue affiche un régime de congé,
 * pas la vigilance d'un relecteur.
 */
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { getSubscription } from '@/lib/endpoints/centers';
import {
  downloadLeaveDocument,
  downloadMyLeaveDocument,
  listLeaveDocuments,
  listMyLeaveDocuments,
} from '@/lib/endpoints/hrm';
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_UNSET_LABEL,
  HRM_FROZEN_CLOSED,
  HRM_FROZEN_STILL_WORKS,
  HRM_LEAVE_DOCUMENT_EMPTY,
  LEAVE_STATUS_LABELS,
  PUBLIC_ATTENDANCE_LABELS,
  SUBSCRIPTION_BANNER_LEAD,
  SUBSCRIPTION_BANNER_TITLE,
  formatDate,
  leaveDocumentLabel,
} from '@/lib/labels';
import type {
  AttendanceStatus,
  LeaveDocument,
  LeaveStatus,
  PublicAttendanceStatus,
} from '@/lib/types';
import {
  ATTENDANCE_TONES,
  CardSkeleton,
  ErrorAlert,
  IconDownload,
  LEAVE_TONES,
  PUBLIC_ATTENDANCE_TONES,
  StatusBadge,
  toApiError,
  useAsync,
} from './shared';
import type { ApiError } from '@/lib/api';

/* ── badges ─────────────────────────────────────────────────────────────── */

/** Le statut RÉEL d'une journée — feuille du directeur, dossier de la personne. */
export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  return (
    <StatusBadge tone={ATTENDANCE_TONES[status]} label={ATTENDANCE_STATUS_LABELS[status]} />
  );
}

/**
 * Le statut vu par les COLLÈGUES. Le type d'entrée interdit `conge` : un
 * écran qui tenterait de l'afficher ne compilerait pas.
 *
 * `null` ne rend PAS un badge mais un texte discret : une journée non notée
 * n'est pas un état de la personne, c'est un trou dans la feuille — lui
 * donner une pastille la ferait lire comme un cinquième statut.
 */
export function PublicAttendanceBadge({ status }: { status: PublicAttendanceStatus | null }) {
  if (status === null) {
    return (
      <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        {ATTENDANCE_UNSET_LABEL}
      </span>
    );
  }
  return (
    <StatusBadge tone={PUBLIC_ATTENDANCE_TONES[status]} label={PUBLIC_ATTENDANCE_LABELS[status]} />
  );
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <StatusBadge tone={LEAVE_TONES[status]} label={LEAVE_STATUS_LABELS[status]} />;
}

/* ── bandeau de gel ─────────────────────────────────────────────────────── */

/**
 * Le gel d'abonnement, décliné au registre.
 *
 * Deux choix assumés :
 *
 * 1. **Ce qui continue est dit AVANT ce qui est fermé** (patron S5) — et ici
 *    « ce qui continue » comprend une phrase que le bandeau générique n'a
 *    pas : chacun garde ses gestes sur son propre dossier. Un directeur qui
 *    lit « suspendu » doit savoir dans la même seconde que son équipe n'est
 *    pas privée de demander ses congés.
 * 2. **Aucun formulaire n'est grisé sur la foi de ce bandeau.** La garde est
 *    côté serveur ; l'UI informe et laisse le refus (400 complet) porter la
 *    nouvelle si le geste est tenté. Griser à partir d'une lecture qui peut
 *    échouer (le 404 « pas de contrat » est un état normal) fermerait des
 *    écrans à des centres parfaitement en règle.
 *
 * Monté par les écrans DIRECTEUR seulement : `GET /subscription/` lui est
 * réservé, et une erreur y est silencieuse — le registre du personnel n'est
 * pas l'endroit où apprendre qu'une lecture d'abonnement a échoué.
 */
export function HrFrozenBanner({ centerId }: { centerId: number }) {
  const subscription = useAsync(() => getSubscription(centerId), [centerId]);
  const data = subscription.data;
  if (!data || !data.is_frozen) return null;

  return (
    <div className="ax-alert ax-alert--warning" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
      <div className="ax-alert__content">
        <p className="ax-alert__title">{SUBSCRIPTION_BANNER_TITLE[data.status]}</p>
        <p className="ax-alert__message">{SUBSCRIPTION_BANNER_LEAD[data.status]}</p>
        <p className="ax-alert__message">{HRM_FROZEN_STILL_WORKS}</p>
        <p className="ax-alert__message">{HRM_FROZEN_CLOSED}</p>
        <p className="ax-alert__message">
          <Link href="/centre/abonnement" className="ax-link">
            Voir mon abonnement et mes factures
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ── justificatifs ──────────────────────────────────────────────────────── */

/**
 * La liste des pièces d'une demande, avec téléchargement AUTHENTIFIÉ.
 *
 * Aucune URL n'existe dans le payload (stockage privé) : le fichier passe par
 * `apiDownload` (blob), jamais par un `<img src>` ni un lien statique — patron
 * des documents patients de S3. Le nom rendu est neutre (`justificatif-{id}`),
 * volontairement : un intitulé parlant rouvrirait par la fenêtre le motif de
 * congé que le modèle ferme par la porte.
 *
 * L'erreur de téléchargement s'affiche DANS cette carte (revue UX care S3) :
 * une alerte en tête d'écran, à trois cartouches de distance du bouton, se
 * subit sans être reliée au geste.
 */
export function LeaveDocumentList({
  centerId,
  leaveId,
  scope,
  actions,
  reloadKey = 0,
}: {
  centerId: number;
  leaveId: number;
  /** `directeur` lit les pièces des congés qu'il décide ; `me`, les siennes. */
  scope: 'directeur' | 'me';
  /** Gestes propres au dossier de la personne (archivage), rendus par ligne. */
  actions?: (doc: LeaveDocument) => ReactNode;
  reloadKey?: number;
}) {
  const docs = useAsync(
    () =>
      scope === 'me'
        ? listMyLeaveDocuments(centerId, leaveId)
        : listLeaveDocuments(centerId, leaveId),
    [centerId, leaveId, scope, reloadKey],
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const download = async (doc: LeaveDocument) => {
    setBusyId(doc.id);
    setError(null);
    try {
      if (scope === 'me') await downloadMyLeaveDocument(centerId, leaveId, doc.id);
      else await downloadLeaveDocument(centerId, leaveId, doc.id);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  if (docs.loading) return <CardSkeleton lines={2} />;
  if (docs.error) return <ErrorAlert error={docs.error} onRetry={docs.reload} />;

  /*
   * **Une pièce purgée par un effacement RGPD n'est pas une panne.**
   *
   * La ligne survit, les octets sont partis, et le téléchargement rend un 404
   * portant une phrase française honnête (« son propriétaire a exercé son
   * droit à l'effacement »). `ErrorAlert` la rendait en alerte DANGER, avec un
   * triangle d'avertissement et un bouton « Actualiser mes accès » — lequel,
   * s'il est cliqué et que la casquette a bougé entre-temps, éjecte vers
   * `/espaces`. Un droit exercé s'annonce comme un fait, pas comme un incident
   * ni comme un problème de permissions : le 404 prend donc le registre
   * neutre, et tout le reste garde l'alerte rouge (elle, méritée).
   */
  const gone = error !== null && error.status === 404;

  const items = docs.data ?? [];
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        {HRM_LEAVE_DOCUMENT_EMPTY}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
      {error &&
        (gone ? (
          <div className="ax-alert ax-alert--info" role="status">
            <div className="ax-alert__content">
              {(error.messages.length > 0
                ? error.messages
                : ['Ce justificatif n’est plus disponible.']
              ).map((m) => (
                <p key={m} className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                  {m}
                </p>
              ))}
            </div>
          </div>
        ) : (
          <ErrorAlert error={error} />
        ))}
      <ul className="ax-list ax-list--compact" aria-label="Justificatifs">
        {items.map((doc) => (
          <li key={doc.id} className="ax-list__row">
            <span className="ax-list__content">
              <span className="ax-list__title">{leaveDocumentLabel(doc.id)}</span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--ax-text-xs)',
                  color: 'var(--ax-text-muted)',
                }}
              >
                {/* « retiré », jamais « archivé » : le second verbe se lit
                    « rangé, mis de côté » par quelqu'un qui n'est pas du
                    métier — soit l'inverse de ce qui s'est passé. */}
                Déposé le {formatDate(doc.created_at)}
                {doc.archived_at !== null && ` · retiré le ${formatDate(doc.archived_at)}`}
              </span>
            </span>
            <span
              className="ax-list__trailing"
              style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}
            >
              <button
                type="button"
                className="ax-btn ax-btn--secondary ax-btn--sm"
                onClick={() => void download(doc)}
                disabled={busyId === doc.id}
              >
                <IconDownload />
                <span className="ax-btn__label">
                  {busyId === doc.id ? 'Téléchargement…' : 'Télécharger'}
                </span>
              </button>
              {actions?.(doc)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
