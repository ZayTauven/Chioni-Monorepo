'use client';
/*
 * Chioni — les congés, côté DIRECTEUR (S7, ADR 0020 décision 4).
 *
 * Asset Vireo : l'îlot `LeaveRequests()` du dashboard `dashboards/Hr.tsx`
 * (l. 390-410) — sa ligne « avatar + personne + type + plage + deux boutons
 * approuver/rejeter », ses trois états visuels (en attente / approuvé /
 * rejeté). Adapté sur trois points :
 *
 * 1. les deux boutons-icônes du template deviennent des boutons LIBELLÉS
 *    passant par une modale de confirmation : approuver ou refuser le congé de
 *    quelqu'un est un geste à conséquence, et un ✓ vert de 32 px se clique par
 *    accident ;
 * 2. **il n'y a AUCUN champ de motif de refus**, et la modale le dit — ce
 *    n'est pas un oubli, le backend n'a aucun champ pour le recevoir. Le
 *    produit ne stocke aucun texte libre sur le congé de quelqu'un, y compris
 *    écrit par le décideur : ici la personne concernée serait l'objet du
 *    texte ;
 * 3. le rouge du template disparaît des statuts (voir `LEAVE_TONES`) : un
 *    refus est une décision d'organisation, pas une anomalie — et c'est la
 *    personne concernée qui lira ce badge sur son propre écran.
 *
 * Le chevauchement de deux congés APPROUVÉS est refusé par le serveur avec un
 * message complet : on l'affiche tel quel. Deux DEMANDES qui se chevauchent
 * sont normales — l'écran ne les signale pas comme une erreur.
 */
import { useEffect, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import { approveLeave, listLeaves, refuseLeave } from '@/lib/endpoints/hrm';
import {
  HRM_LEAVE_APPROVE_WARNING,
  HRM_LEAVE_DECISION_FINAL,
  HRM_LEAVE_OVERLAP_HINT,
  HRM_LEAVE_REFUSE_WARNING,
  HRM_NO_LEAVE_DIRECTOR,
  HRM_NO_LEAVE_FILTER,
  HRM_NO_LEAVE_TITLE,
  LEAVE_STATUSES,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
  formatDate,
  leaveDaysLabel,
  leaveRangeLabel,
} from '@/lib/labels';
import type { LeaveRequest, LeaveStatus } from '@/lib/types';
import type { ApiError } from '@/lib/api';
import { LeaveDocumentList, LeaveStatusBadge } from './HrShared';
import {
  AvatarChip,
  EmptyState,
  ErrorAlert,
  IconCheck,
  IconClose,
  IconPaperclip,
  Modal,
  Pagination,
  TableSkeleton,
  toApiError,
  useAsync,
} from './shared';

/** « En attente » d'abord : c'est la seule pastille qui appelle un geste. */
const STATUS_PILLS: Array<LeaveStatus | 'tous'> = [...LEAVE_STATUSES, 'tous'];

/* ── modale de décision ── */

function DecisionModal({
  leave,
  decision,
  onClose,
  onDecided,
}: {
  leave: LeaveRequest;
  decision: 'approuve' | 'refuse';
  onClose: () => void;
  onDecided: () => void;
}) {
  const { centerId } = useCenter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const approving = decision === 'approuve';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (approving) await approveLeave(centerId, leave.id);
      else await refuseLeave(centerId, leave.id);
      onDecided();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={approving ? 'Approuver ce congé' : 'Refuser ce congé'}
      onClose={onClose}
      busy={busy}
      width={520}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Revenir
          </button>
          <button
            type="button"
            className={`ax-btn ${approving ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
            onClick={() => void submit()}
            disabled={busy}
          >
            <span className="ax-btn__label">
              {busy
                ? 'Enregistrement…'
                : approving
                  ? 'Approuver la demande'
                  : 'Refuser la demande'}
            </span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
        <span style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
          {leave.employment_display_name}
        </span>
        <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
          {LEAVE_TYPE_LABELS[leave.leave_type]} · {leaveRangeLabel(leave.start_date, leave.end_date)}
        </span>
        <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
          {leaveDaysLabel(leave.days)} · demandé le {formatDate(leave.created_at)}
        </span>
      </div>

      {leave.has_document && (
        <div className="ax-field" style={{ marginBottom: 0 }}>
          <span className="ax-label">Justificatif joint</span>
          <LeaveDocumentList centerId={centerId} leaveId={leave.id} scope="directeur" />
        </div>
      )}

      <div className="ax-alert ax-alert--info" role="note">
        <div className="ax-alert__content">
          <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
            {approving ? HRM_LEAVE_APPROVE_WARNING : HRM_LEAVE_REFUSE_WARNING}
          </p>
          <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
            {HRM_LEAVE_DECISION_FINAL}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* ── modale des justificatifs (hors décision) ── */

function DocumentsModal({ leave, onClose }: { leave: LeaveRequest; onClose: () => void }) {
  const { centerId } = useCenter();
  return (
    <Modal title="Justificatifs de la demande" onClose={onClose} width={520}>
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        {leave.employment_display_name} · {leaveRangeLabel(leave.start_date, leave.end_date)}
      </p>
      <LeaveDocumentList centerId={centerId} leaveId={leave.id} scope="directeur" />
    </Modal>
  );
}

/* ── écran ── */

export function HrLeaves() {
  const { centerId } = useCenter();
  const [status, setStatus] = useState<LeaveStatus | 'tous'>('demande');
  const [page, setPage] = useState(1);
  const [decisionFor, setDecisionFor] = useState<{
    leave: LeaveRequest;
    decision: 'approuve' | 'refuse';
  } | null>(null);
  const [docsFor, setDocsFor] = useState<LeaveRequest | null>(null);

  const leaves = useAsync(
    () => listLeaves(centerId, { page, ...(status === 'tous' ? {} : { status }) }),
    [centerId, page, status],
  );

  useEffect(() => {
    setPage(1);
  }, [centerId, status]);

  const results = leaves.data?.results ?? [];

  return (
    <>
      <section className="ax-card ax-col--12" role="region" aria-label="Demandes de congé">
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-card__titles">
            <h2 className="ax-card__title">Congés</h2>
            <p className="ax-card__subtitle">{HRM_LEAVE_OVERLAP_HINT}</p>
          </div>
          <div
            className="ax-cluster"
            style={{ gap: 'var(--ax-space-2)' }}
            role="group"
            aria-label="Filtrer par état de la demande"
          >
            {STATUS_PILLS.map((key) => (
              <button
                key={key}
                type="button"
                className={`ax-btn ax-btn--sm ax-btn--pill ${status === key ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
                aria-pressed={status === key}
                onClick={() => setStatus(key)}
              >
                {key === 'tous' ? 'Toutes' : LEAVE_STATUS_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {leaves.loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : leaves.error ? (
          <div style={{ padding: 'var(--ax-space-4)' }}>
            <ErrorAlert error={leaves.error} onRetry={leaves.reload} />
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title={HRM_NO_LEAVE_TITLE}
            message={status === 'demande' ? HRM_NO_LEAVE_DIRECTOR : HRM_NO_LEAVE_FILTER}
          />
        ) : (
          <>
            <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">
                      Personne
                    </th>
                    <th className="ax-table__th" scope="col">
                      Type
                    </th>
                    <th className="ax-table__th" scope="col">
                      Période
                    </th>
                    <th className="ax-table__th ax-table__th--num" scope="col">
                      Journées
                    </th>
                    <th className="ax-table__th" scope="col">
                      État
                    </th>
                    <th className="ax-table__th" scope="col">
                      <span className="ax-visually-hidden">Décision</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((leave) => (
                    <tr key={leave.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <div
                          className="ax-cluster"
                          style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}
                        >
                          <AvatarChip
                            name={leave.employment_display_name}
                            seed={leave.employment}
                          />
                          <span style={{ minWidth: 0 }}>
                            <span
                              className="ax-truncate"
                              style={{
                                display: 'block',
                                fontWeight: 500,
                                color: 'var(--ax-text-strong)',
                              }}
                            >
                              {leave.employment_display_name}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                fontSize: 'var(--ax-text-xs)',
                                color: 'var(--ax-text-muted)',
                              }}
                            >
                              Demandé le {formatDate(leave.created_at)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text)' }}>
                        {LEAVE_TYPE_LABELS[leave.leave_type]}
                      </td>
                      <td
                        className="ax-table__td"
                        style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}
                      >
                        {formatDate(leave.start_date)}
                        {leave.end_date !== leave.start_date && ` → ${formatDate(leave.end_date)}`}
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num">{leave.days}</td>
                      <td className="ax-table__td">
                        <div
                          className="ax-cluster"
                          style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}
                        >
                          <LeaveStatusBadge status={leave.status} />
                          {leave.decided_at !== null && (
                            <span
                              style={{
                                fontSize: 'var(--ax-text-xs)',
                                color: 'var(--ax-text-muted)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              le {formatDate(leave.decided_at)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="ax-table__td" style={{ textAlign: 'end' }}>
                        <div
                          className="ax-cluster"
                          style={{ gap: 'var(--ax-space-2)', justifyContent: 'flex-end' }}
                        >
                          {leave.has_document && (
                            <button
                              type="button"
                              className="ax-btn ax-btn--ghost ax-btn--sm"
                              onClick={() => setDocsFor(leave)}
                            >
                              <IconPaperclip />
                              <span className="ax-btn__label">Justificatif</span>
                            </button>
                          )}
                          {/* Les trois autres états sont TERMINAUX : aucun
                              geste n'est monté dessus. Un bouton qui recevrait
                              « Transition impossible » apprendrait à s'en
                              méfier. */}
                          {leave.status === 'demande' && (
                            <>
                              <button
                                type="button"
                                className="ax-btn ax-btn--secondary ax-btn--sm"
                                onClick={() => setDecisionFor({ leave, decision: 'refuse' })}
                              >
                                <IconClose />
                                <span className="ax-btn__label">Refuser</span>
                              </button>
                              <button
                                type="button"
                                className="ax-btn ax-btn--primary ax-btn--sm"
                                onClick={() => setDecisionFor({ leave, decision: 'approuve' })}
                              >
                                <IconCheck />
                                <span className="ax-btn__label">Approuver</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leaves.data && (
              <Pagination count={leaves.data.count} page={page} onPage={setPage} />
            )}
          </>
        )}
      </section>

      {decisionFor && (
        <DecisionModal
          leave={decisionFor.leave}
          decision={decisionFor.decision}
          onClose={() => setDecisionFor(null)}
          onDecided={() => {
            setDecisionFor(null);
            leaves.reload();
          }}
        />
      )}

      {docsFor && <DocumentsModal leave={docsFor} onClose={() => setDocsFor(null)} />}
    </>
  );
}

export default HrLeaves;
