'use client';
/*
 * Chioni — /centre/litiges : contestations sur les demandes de paiement.
 *
 * Lecture : rôles BILLING seuls (S1 — le motif libre du patient/proche ne
 * s'affiche plus à tout staff ; l'API répond 403 aux soignants/pharmacien,
 * l'écran ne l'appelle pas pour eux). Résolution : DIRECTEUR uniquement, avec
 * note de résolution obligatoire ; la modal annonce le retour de la demande à
 * son statut d'avant litige (`previous_status`).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import { listDisputes, resolveDispute } from '@/lib/endpoints/centers';
import {
  DISPUTE_STATUS_LABELS,
  PAYMENT_REQUEST_STATUS_LABELS,
  formatDate,
} from '@/lib/labels';
import type { Dispute } from '@/lib/types';
import {
  BILLING_ROLES,
  DISPUTE_TONES,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconCheck,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

function ResolveModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: Dispute;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { centerId } = useCenter();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await resolveDispute(centerId, dispute.id, note.trim());
      onResolved();
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Résoudre le litige n° ${dispute.id}`}
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving || !note.trim()}
          >
            <IconCheck />
            <span className="ax-btn__label">{saving ? 'Résolution…' : 'Marquer comme résolu'}</span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}

      <div className="ax-alert ax-alert--info" role="note">
        <div className="ax-alert__content">
          <p className="ax-alert__message">
            Une fois résolu, la demande n° {dispute.payment_request} reviendra à son statut d&apos;avant litige :{' '}
            <b>{PAYMENT_REQUEST_STATUS_LABELS[dispute.previous_status]}</b>.
          </p>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>
          Motif du litige
        </div>
        <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{dispute.reason}</p>
      </div>

      <div className="ax-field">
        <label className="ax-label" htmlFor="dr-note">
          Note de résolution <span className="ax-field__required" aria-hidden="true">*</span>
        </label>
        <textarea
          id="dr-note"
          className={`ax-textarea${error?.fieldErrors.resolution_note ? ' is-invalid' : ''}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Expliquez ce qui a été vérifié et convenu — cette note engage le centre."
        />
        <FieldError error={error} field="resolution_note" />
      </div>
    </Modal>
  );
}

export function Disputes() {
  const { centerId, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  // Multi-roles S2 : un directeur-médecin garde la résolution des litiges.
  const isDirector = roles.includes('directeur');
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<Dispute | null>(null);

  const disputes = useAsync(
    () => (billing ? listDisputes(centerId, page) : Promise.resolve(null)),
    [centerId, page, billing],
  );
  const results = disputes.data?.results ?? [];

  useEffect(() => {
    setPage(1);
  }, [centerId]);

  if (!billing) {
    return (
      <>
        <PageHead title="Litiges" subtitle="Contestations sur les demandes de paiement du centre." />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <EmptyState
              title="Réservé aux rôles de facturation"
              message="Les litiges contiennent le motif exprimé librement par le patient ou son proche : ils sont accessibles au directeur, à la secrétaire et au caissier."
            />
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Litiges"
        subtitle={
          isDirector
            ? 'Contestations ouvertes par un patient ou un proche — la résolution engage le centre.'
            : 'Contestations ouvertes par un patient ou un proche — seul le directeur peut les résoudre.'
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Liste des litiges">
          {disputes.loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : disputes.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={disputes.error} onRetry={disputes.reload} />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="Aucun litige"
              message="Aucune contestation n'a été ouverte sur les demandes de paiement du centre."
            />
          ) : (
            <>
              <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Litige</th>
                      <th className="ax-table__th" scope="col">Demande</th>
                      <th className="ax-table__th" scope="col">Motif</th>
                      <th className="ax-table__th" scope="col">Reviendra à</th>
                      <th className="ax-table__th" scope="col">Statut</th>
                      <th className="ax-table__th" scope="col">Ouvert le</th>
                      {isDirector && <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((d) => (
                      <tr key={d.id} className="ax-table__row">
                        <td className="ax-table__td" style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
                          Litige n° {d.id}
                        </td>
                        <td className="ax-table__td">
                          <Link href={`/centre/demandes/${d.payment_request}`} className="ax-link">
                            Demande n° {d.payment_request}
                          </Link>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', maxWidth: 280 }}>
                          <span className="ax-truncate" style={{ display: 'block' }} title={d.reason}>{d.reason}</span>
                          {d.status === 'resolu' && d.resolution_note && (
                            <span className="ax-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} title={d.resolution_note}>
                              Résolution : {d.resolution_note}
                            </span>
                          )}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                          {PAYMENT_REQUEST_STATUS_LABELS[d.previous_status]}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge tone={DISPUTE_TONES[d.status]} label={DISPUTE_STATUS_LABELS[d.status]} />
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>
                          {formatDate(d.created_at)}
                          {d.resolved_at && (
                            <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                              Résolu le {formatDate(d.resolved_at)}
                            </span>
                          )}
                        </td>
                        {isDirector && (
                          <td className="ax-table__td" style={{ textAlign: 'end' }}>
                            {d.status === 'ouvert' && (
                              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setResolving(d)}>
                                <span className="ax-btn__label">Résoudre</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {disputes.data && <Pagination count={disputes.data.count} page={page} onPage={setPage} />}
            </>
          )}
        </section>
      </div>

      {resolving && (
        <ResolveModal
          dispute={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null);
            disputes.reload();
          }}
        />
      )}
    </>
  );
}

export default Disputes;
