'use client';
/*
 * Chioni — /centre/ordonnances/recherches/[id] : une recherche et ses réponses
 * (S9, ADR 0022).
 *
 * ─── La lecture qu'il faut rendre facile ──────────────────────────────────
 *
 * La question du personnel est « où est-ce que je peux envoyer le patient ? ».
 * On rend donc **une officine par carte**, avec ses lignes disponible / pas
 * disponible et son téléphone — et non une matrice médicaments × pharmacies,
 * qui serait plus dense mais illisible sur un écran de centre à trois colonnes.
 *
 * ─── Deux pièges de ton, tenus par les libellés ───────────────────────────
 *
 * - **« Pas disponible » n'est pas rouge.** C'est une information utile : elle
 *   évite un déplacement. Le rouge apprendrait à lire les réponses comme des
 *   échecs, et à ne plus les lire du tout.
 * - **Plusieurs réponses d'une même officine sont NORMALES** (le stock bouge).
 *   La plus récente fait foi, l'historique reste, et une phrase le dit : sans
 *   elle, une correction se lit comme une contradiction et on décroche le
 *   téléphone pour rien.
 *
 * Fermer une recherche est un geste ORDINAIRE et sans motif (« on a trouvé ») :
 * il est confirmé — les officines ne pourront plus répondre — mais jamais
 * peint comme une annulation.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  closeAvailabilityRequest,
  getCenterAvailabilityRequest,
} from '@/lib/endpoints/pharmacy';
import {
  ACTION_CANCEL,
  ACTION_SAVING,
  AVAILABILITY_CLOSED_FLASH,
  AVAILABILITY_CLOSE_ACTION,
  AVAILABILITY_CLOSE_CONFIRM,
  AVAILABILITY_CLOSE_MESSAGE,
  AVAILABILITY_CLOSE_REASON_LABELS,
  AVAILABILITY_CLOSE_TITLE,
  AVAILABILITY_COMMENT_LABEL,
  AVAILABILITY_DETAIL_TITLE,
  AVAILABILITY_EXPIRES_HINT,
  AVAILABILITY_LINE_AVAILABLE,
  AVAILABILITY_LINE_UNAVAILABLE,
  AVAILABILITY_MULTIPLE_RESPONSES_HINT,
  AVAILABILITY_NO_RESPONSE_MESSAGE,
  AVAILABILITY_NO_RESPONSE_TITLE,
  AVAILABILITY_PRIVACY_NOTICE,
  AVAILABILITY_RESPONSE_SUPERSEDED,
  AVAILABILITY_STATUS_LABELS,
  DIRECTORY_NO_PHONE,
  availabilityItemsLabel,
  availabilityResponsesLabel,
  availabilityZoneLabel,
  formatDateTime,
} from '@/lib/labels';
import type { AvailabilityRequestCenterDetail } from '@/lib/types';
import { COUNTER_TITLE } from '@/lib/labels';
import {
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  Modal,
  PRESCRIPTION_READ_ROLES,
  StatusBadge,
  hasRole,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

/**
 * Les identifiants des réponses DÉPASSÉES — celles d'une officine qui a
 * répondu à nouveau depuis.
 *
 * La phrase « la réponse la plus récente est la bonne » ne suffit pas quand
 * deux cartes de la même enseigne se contredisent : il faut alors comparer
 * deux horodatages pour savoir laquelle croire, et personne ne le fait au
 * milieu d'une consultation. Envoyer un patient sur un « disponible » corrigé
 * depuis lui coûte un trajet — c'est exactement ce que le module existe pour
 * lui éviter.
 *
 * La comparaison est faite sur `created_at`, **jamais sur l'ordre du serveur**
 * (le contrat ne le garantit que par convention).
 */
function supersededResponseIds(
  responses: AvailabilityRequestCenterDetail['responses'],
): Set<number> {
  const latest = new Map<number, { id: number; at: number }>();
  for (const response of responses) {
    const at = new Date(response.created_at).getTime();
    const known = latest.get(response.pharmacy.id);
    if (!known || at > known.at) latest.set(response.pharmacy.id, { id: response.id, at });
  }
  const kept = new Set([...latest.values()].map((entry) => entry.id));
  return new Set(responses.map((r) => r.id).filter((id) => !kept.has(id)));
}

function CloseModal({
  request,
  onClose,
  onClosed,
}: {
  request: AvailabilityRequestCenterDetail;
  onClose: () => void;
  onClosed: (fresh: AvailabilityRequestCenterDetail) => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await closeAvailabilityRequest(centerId, request.id);
      onClosed(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={AVAILABILITY_CLOSE_TITLE}
      onClose={onClose}
      width={520}
      busy={saving}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            data-autofocus=""
          >
            {ACTION_CANCEL}
          </button>
          {/* Pas de `ax-btn--danger` : terminer une recherche n'est ni une
              destruction ni une sanction — le centre a trouvé, c'est tout. */}
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? ACTION_SAVING : AVAILABILITY_CLOSE_CONFIRM}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
        {AVAILABILITY_CLOSE_MESSAGE}
      </p>
    </Modal>
  );
}

export function AvailabilityRequestDetail({ requestId }: { requestId: number }) {
  const { centerId, roles } = useCenter();

  /*
   * La portée de tout ce qui est gardé en mémoire ici : le centre ACTIF et
   * l'id de la route. Le sélecteur de centre de l'en-tête ne quitte pas la
   * page — sans cette portée, un soignant de deux centres qui ferme une
   * recherche puis bascule de centre gardait à l'écran **la liste de
   * médicaments et les réponses d'officines du centre PRÉCÉDENT**, sous le
   * nom du nouveau, et le 404 de la relecture restait invisible (l'état
   * optimiste, non nul, empêchait l'alerte de s'afficher). Défaut S6 rejoué
   * sur une surface clinique — corrigé au rendu, pas dans un effet.
   */
  const scope = `${centerId}:${requestId}`;
  const [patched, setPatched] =
    useScopedState<AvailabilityRequestCenterDetail>(scope);
  const [flash, setFlash] = useScopedState<string>(scope);
  const [closing, setClosing] = useState(false);

  /* La modale de fermeture, elle, est un geste EN COURS : elle ne se
     « rescope » pas, elle s'annule — sinon un clic de confirmation resté en
     attente fermerait la recherche du centre où l'on vient d'arriver. */
  useEffect(() => {
    setClosing(false);
  }, [centerId, requestId]);

  const allowed = hasRole(roles, PRESCRIPTION_READ_ROLES);

  /* Même garde que l'écran parent, et pour la même raison : le fetch n'est pas
     lancé du tout hors des rôles qui ont le droit de lire une ordonnance. */
  const state = useAsync(
    () =>
      allowed
        ? getCenterAvailabilityRequest(centerId, requestId)
        : Promise.resolve(null as AvailabilityRequestCenterDetail | null),
    [centerId, requestId, allowed],
  );

  const request = patched ?? state.data;

  if (!allowed) {
    return (
      <>
        <PageHead title={AVAILABILITY_DETAIL_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <EmptyState
                title="Écran réservé aux soignants et au pharmacien"
                message="Une recherche porte la liste des médicaments d'une ordonnance : sa lecture suit celle de l'ordonnance."
              />
            </div>
          </section>
        </div>
      </>
    );
  }

  if (state.loading && !request) {
    return (
      <>
        <PageHead title={AVAILABILITY_DETAIL_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <CardSkeleton lines={6} />
            </div>
          </section>
        </div>
      </>
    );
  }

  if (!request) {
    return (
      <>
        <PageHead title={AVAILABILITY_DETAIL_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              {state.error && <ErrorAlert error={state.error} onRetry={state.reload} />}
            </div>
          </section>
        </div>
      </>
    );
  }

  const open = request.status === 'ouverte';
  const superseded = supersededResponseIds(request.responses);

  return (
    <>
      <PageHead
        title={availabilityZoneLabel(request.island, request.city)}
        subtitle={availabilityItemsLabel(request.items.length)}
        actions={
          <>
            {/* Le fil d'Ariane du socle ne résout pas les routes de détail
                (elles n'ont pas de nœud de manifeste) : le retour est un
                bouton explicite, patron `EquipmentDetail` de S8. */}
            <Link className="ax-btn ax-btn--ghost" href="/centre/ordonnances">
              <span className="ax-btn__label">{COUNTER_TITLE}</span>
            </Link>
            {open && (
              <button
                type="button"
                className="ax-btn ax-btn--secondary"
                onClick={() => setClosing(true)}
              >
                <span className="ax-btn__label">{AVAILABILITY_CLOSE_ACTION}</span>
              </button>
            )}
          </>
        }
      />

      <div className="ax-dash-grid">
        {flash && (
          <div className="ax-col--12">
            <div className="ax-alert ax-alert--success" role="status">
              <div className="ax-alert__content">
                <p className="ax-alert__message">{flash}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── ce qui a été envoyé ── */}
        <section className="ax-card ax-col--5" role="region" aria-label="La recherche">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Ce qui a été envoyé</h2>
            </div>
            <StatusBadge
              tone={open ? 'info' : 'neutral'}
              label={
                !open && request.close_reason
                  ? AVAILABILITY_CLOSE_REASON_LABELS[request.close_reason]
                  : AVAILABILITY_STATUS_LABELS[request.status]
              }
            />
          </div>
          <div
            className="ax-card__body"
            style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 'var(--ax-space-4)',
              }}
            >
              <DetailItem label="Zone">
                {availabilityZoneLabel(request.island, request.city)}
              </DetailItem>
              <DetailItem label="Envoyée le">{formatDateTime(request.created_at)}</DetailItem>
              <DetailItem label="Destinataires">
                {availabilityResponsesLabel(request.response_count, request.recipient_count)}
              </DetailItem>
              <DetailItem label={open ? 'Ouverte jusqu’au' : 'Terminée le'}>
                {formatDateTime(open ? request.expires_at : (request.closed_at ?? request.expires_at))}
              </DetailItem>
              <DetailItem label="Ordonnance">
                <Link href="/centre/ordonnances" className="ax-link">
                  n° {request.prescription}
                </Link>
              </DetailItem>
            </div>

            <ul
              style={{
                margin: 0,
                paddingInlineStart: 'var(--ax-space-5)',
                fontSize: 'var(--ax-text-sm)',
                color: 'var(--ax-text)',
              }}
            >
              {request.items.map((item) => (
                <li key={item.id}>{item.medication}</li>
              ))}
            </ul>

            {/* Rappelé sur la fiche aussi : c'est ce que le personnel répétera
                au patient quand il demandera « ils savent que c'est moi ? ». */}
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {AVAILABILITY_PRIVACY_NOTICE}
            </p>

            {open && (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
                {AVAILABILITY_EXPIRES_HINT}
              </p>
            )}
          </div>
        </section>

        {/* ── les réponses ── */}
        <section className="ax-card ax-col--7" role="region" aria-label="Réponses des pharmacies">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Réponses des pharmacies</h2>
              <p className="ax-card__subtitle">{AVAILABILITY_MULTIPLE_RESPONSES_HINT}</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {request.responses.length === 0 ? (
              <EmptyState
                title={AVAILABILITY_NO_RESPONSE_TITLE}
                message={AVAILABILITY_NO_RESPONSE_MESSAGE}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {request.responses.map((response) => (
                  <div
                    key={response.id}
                    style={{
                      border: '1px solid var(--ax-border)',
                      borderRadius: 'var(--ax-radius-md)',
                      padding: 'var(--ax-space-4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--ax-space-2)',
                      /* Une réponse dépassée reste lisible, mais elle ne se
                         confond plus avec celle qui fait foi. */
                      opacity: superseded.has(response.id) ? 0.72 : undefined,
                    }}
                  >
                    <div
                      className="ax-cluster"
                      style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>
                          {response.pharmacy.name}
                        </b>
                        {superseded.has(response.id) && (
                          <>
                            {' '}
                            <StatusBadge
                              tone="neutral"
                              label={AVAILABILITY_RESPONSE_SUPERSEDED}
                            />
                          </>
                        )}
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--ax-text-xs)',
                            color: 'var(--ax-text-muted)',
                          }}
                        >
                          {response.pharmacy.city}
                          {response.pharmacy.address ? ` · ${response.pharmacy.address}` : ''}
                        </span>
                      </div>
                      {/* Le téléphone est LE geste utile : appelable d'un
                          clic depuis un poste, comme depuis un mobile. */}
                      {response.pharmacy.phone ? (
                        <a className="ax-btn ax-btn--secondary ax-btn--sm" href={`tel:${response.pharmacy.phone}`}>
                          <span className="ax-btn__label">{response.pharmacy.phone}</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                          {DIRECTORY_NO_PHONE}
                        </span>
                      )}
                    </div>

                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {request.items.map((item) => {
                        const line = response.lines.find((l) => l.item === item.id);
                        if (!line) return null;
                        return (
                          <li
                            key={item.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 'var(--ax-space-3)',
                              paddingBlock: 2,
                              fontSize: 'var(--ax-text-sm)',
                            }}
                          >
                            <span style={{ color: 'var(--ax-text)' }}>{item.medication}</span>
                            {/* « Pas disponible » en NEUTRE, jamais en rouge :
                                ce n'est pas un échec, c'est ce qui évite un
                                déplacement inutile. */}
                            <StatusBadge
                              tone={line.is_available ? 'success' : 'neutral'}
                              label={
                                line.is_available
                                  ? AVAILABILITY_LINE_AVAILABLE
                                  : AVAILABILITY_LINE_UNAVAILABLE
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>

                    {response.comment && (
                      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                        <b style={{ color: 'var(--ax-text-muted)', fontWeight: 'var(--ax-weight-medium)' }}>
                          {AVAILABILITY_COMMENT_LABEL} :
                        </b>{' '}
                        {response.comment}
                      </p>
                    )}

                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                      {formatDateTime(response.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {closing && (
        <CloseModal
          request={request}
          onClose={() => setClosing(false)}
          onClosed={(fresh) => {
            setPatched(fresh);
            setClosing(false);
            setFlash(AVAILABILITY_CLOSED_FLASH);
          }}
        />
      )}
    </>
  );
}

export default AvailabilityRequestDetail;
