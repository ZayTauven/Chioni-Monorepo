'use client';
/*
 * Chioni — /centre/ordonnances : le comptoir du pharmacien (S9, ADR 0022
 * décision 6 — dette C.1 de l'audit, ouverte depuis le premier jour et soldée).
 *
 * Jusqu'ici, le rôle `pharmacien` existait sans écran : on pouvait lire une
 * ordonnance consultation par consultation, à condition d'en connaître
 * l'identifiant. Aucune liste, aucun filtre — un métier sans poste de travail.
 *
 * ─── Deux onglets, deux gestes, une seule audience ────────────────────────
 *
 * - **Ordonnances** : ce qui reste à remettre, ce qui a été remis. Le geste
 *   est la DÉLIVRANCE, et il est **définitif** — confirmé comme une
 *   contre-passation de caisse, et sans aucun bouton pour le défaire (le
 *   backend n'en expose pas : une erreur se raconte dans le carnet, elle ne
 *   s'efface pas).
 * - **Recherches en pharmacie** : le fil des listes envoyées au réseau et ce
 *   que les officines ont répondu.
 *
 * ─── La garde de rôle, et pourquoi elle est DANS l'écran ──────────────────
 *
 * Rôles cliniques **+ pharmacien** (R-API-1). Le staff administratif —
 * secrétaire, caissier, directeur non soignant — reçoit 403 : l'écran n'est
 * donc **pas monté du tout**, fetchs compris (patron S3 des cartes cliniques).
 * L'entrée de sidebar porte la même garde ; la nav ne protège rien, elle range.
 *
 * ─── Ce que l'écran n'affiche PAS, et ce n'est pas un oubli ───────────────
 *
 * **Le nom du patient.** Le payload d'une ordonnance ne porte que l'id de sa
 * consultation — aucun nom, aucun identifiant de patient. Plutôt que de
 * fabriquer une résolution N+1 (ou pire, d'inventer un libellé), chaque ligne
 * renvoie vers SA consultation, où le dossier est affiché avec ses gardes
 * normales. Honnête, et un clic.
 *
 * Assets Vireo repris : `tables/DataTables` (tableau `ax-table--hover` à ligne
 * cliquable, déjà adapté pour la caisse, les impayés, le journal et le parc) et
 * les pastilles de filtre de `projects/ProjectsList`.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  deliverPrescription,
  listCenterAvailabilityRequests,
  listCenterPrescriptions,
} from '@/lib/endpoints/pharmacy';
import {
  ACTION_CANCEL,
  ACTION_SAVING,
  AVAILABILITY_CLOSE_REASON_LABELS,
  AVAILABILITY_COL_ITEMS,
  AVAILABILITY_COL_RESPONSES,
  AVAILABILITY_COL_SENT,
  AVAILABILITY_COL_ZONE,
  AVAILABILITY_EXPIRES_HINT,
  AVAILABILITY_FEED_EMPTY_MESSAGE,
  AVAILABILITY_FEED_EMPTY_TITLE,
  AVAILABILITY_FEED_FILTER_EMPTY_MESSAGE,
  AVAILABILITY_FEED_FILTER_EMPTY_TITLE,
  AVAILABILITY_FEED_SUBTITLE,
  AVAILABILITY_OPEN_SR,
  AVAILABILITY_SEND_ACTION,
  AVAILABILITY_STATUS_LABELS,
  COUNTER_COL_MEDICATIONS,
  COUNTER_COL_PRESCRIPTION,
  COUNTER_COL_STATUS,
  COUNTER_DELIVER_ACTION,
  COUNTER_DELIVER_CONFIRM,
  COUNTER_DELIVER_MESSAGE,
  COUNTER_DELIVER_TITLE,
  COUNTER_EMPTY_MESSAGE,
  COUNTER_EMPTY_TITLE,
  COUNTER_FILTER_ALL,
  COUNTER_FILTER_CLEAR,
  COUNTER_FILTER_DATE_LABEL,
  COUNTER_FILTER_EMPTY_MESSAGE,
  COUNTER_FILTER_EMPTY_TITLE,
  COUNTER_PENDING_EMPTY_MESSAGE,
  COUNTER_PENDING_EMPTY_TITLE,
  COUNTER_SEARCH_DISABLED_HINT,
  COUNTER_SUBTITLE,
  COUNTER_TAB_PRESCRIPTIONS,
  COUNTER_TAB_SEARCHES,
  COUNTER_TITLE,
  PRESCRIPTION_STATUS_LABELS,
  availabilityItemsLabel,
  availabilityResponsesLabel,
  availabilityZoneLabel,
  availabilitySent,
  counterDelivered,
  counterDeliveredOn,
  formatDate,
  formatDateTime,
} from '@/lib/labels';
import type { AvailabilityRequestStatus, Prescription, PrescriptionStatus } from '@/lib/types';
import { AvailabilitySendModal } from './AvailabilitySend';
import {
  EmptyState,
  ErrorAlert,
  Modal,
  PRESCRIPTION_READ_ROLES,
  Pagination,
  StatusBadge,
  TableSkeleton,
  hasRole,
  toApiError,
  useAsync,
  useScopedState,
} from './shared';

type Tab = 'ordonnances' | 'recherches';

/* ══════════════════════════════════════════════════════════════════════════
   La délivrance — geste DÉFINITIF
   ══════════════════════════════════════════════════════════════════════════ */

function DeliverModal({
  prescription,
  onClose,
  onDelivered,
}: {
  prescription: Prescription;
  onClose: () => void;
  onDelivered: (fresh: Prescription) => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const fresh = await deliverPrescription(centerId, prescription.id);
      onDelivered(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={COUNTER_DELIVER_TITLE}
      onClose={onClose}
      width={560}
      /* `busy` : le geste est irréversible — les trois sorties involontaires
         (Échap, clic sur le fond, croix) sont neutralisées le temps de
         l'appel, sinon « je ne sais pas si ça a été fait » (correctif S4). */
      busy={saving}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
            /* Le focus tombe sur la SORTIE, jamais sur l'action : une touche
               Entrée ne doit pas délivrer une ordonnance. */
            data-autofocus=""
          >
            {ACTION_CANCEL}
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--primary"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? ACTION_SAVING : COUNTER_DELIVER_CONFIRM}
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.7 }}>
        {COUNTER_DELIVER_MESSAGE}
      </p>
      <ul
        style={{
          margin: 0,
          paddingInlineStart: 'var(--ax-space-5)',
          fontSize: 'var(--ax-text-sm)',
          color: 'var(--ax-text)',
        }}
      >
        {prescription.items.map((item) => (
          <li key={item.id}>
            <b>{item.medication}</b>
            {item.dosage ? ` — ${item.dosage}` : ''}
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Onglet 1 — les ordonnances
   ══════════════════════════════════════════════════════════════════════════ */

const STATUS_PILLS: Array<PrescriptionStatus | 'toutes'> = ['toutes', 'emise', 'delivree'];

function PrescriptionsTab() {
  const { centerId } = useCenter();
  const [status, setStatus] = useState<PrescriptionStatus | 'toutes'>('emise');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [delivering, setDelivering] = useState<Prescription | null>(null);
  const [searching, setSearching] = useState<Prescription | null>(null);
  /* Patch de ligne sur place : après une délivrance, la ligne se met à jour
     sans recharger la page (patron du pointage des RDV de la vague 3).
     PORTÉE au centre actif (guardian S9) : le sélecteur de l'en-tête ne
     quitte pas la page, et ces lignes-là décrivent le parc d'ordonnances
     d'UN centre — comme le message qui les nomme. */
  const scope = String(centerId);
  const [patchedByScope, setPatched] =
    useScopedState<Record<number, Prescription>>(scope);
  const patched = patchedByScope ?? {};
  const [flash, setFlash] = useScopedState<string>(scope);

  /*
   * Les deux modales portent une ordonnance — c'est-à-dire une liste de
   * médicaments et leur posologie — appartenant au centre sous lequel elles
   * ont été ouvertes. Elles ne changent pas de tenant : elles se ferment.
   * Sans ça, la modale de diffusion (LA surface du sprint) continuait
   * d'afficher l'ordonnance d'un patient du centre PRÉCÉDENT tout en
   * annonçant les officines du nouveau.
   */
  useEffect(() => {
    setDelivering(null);
    setSearching(null);
  }, [centerId]);

  const list = useAsync(
    () =>
      listCenterPrescriptions(centerId, {
        ...(status === 'toutes' ? {} : { status }),
        ...(date ? { date } : {}),
        page,
      }),
    [centerId, status, date, page],
  );

  const rows = (list.data?.results ?? []).map((row) => patched[row.id] ?? row);
  /*
   * TROIS états vides distincts, et les confondre coûte un écran (leçon S8) :
   *
   * - `toutes` sans date → le centre n'a réellement aucune ordonnance ;
   * - `emise` seul (le filtre PAR DÉFAUT, donc serveur) → tout a été remis. Y
   *   afficher « les ordonnances de ce centre apparaissent ici » ferait
   *   conclure que rien n'a jamais été prescrit ;
   * - tout autre filtre → c'est le filtre, et le message le dit.
   */
  const filtered = status !== 'toutes' || date !== '';
  const defaultPendingView = status === 'emise' && date === '';
  const hasFilters = filtered;

  return (
    <>
      {flash && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBlockEnd: 'var(--ax-space-4)' }}>
          <div className="ax-alert__content">
            <p className="ax-alert__message">{flash}</p>
          </div>
        </div>
      )}

      <section className="ax-card ax-col--12" role="region" aria-label={COUNTER_TAB_PRESCRIPTIONS}>
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div
            className="ax-cluster"
            style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-2)' }}
              role="group"
              aria-label="Filtrer par état"
            >
              {STATUS_PILLS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`ax-btn ax-btn--sm ax-btn--pill ${status === key ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
                  aria-pressed={status === key}
                  onClick={() => {
                    setStatus(key);
                    setPage(1);
                  }}
                >
                  {key === 'toutes' ? COUNTER_FILTER_ALL : PRESCRIPTION_STATUS_LABELS[key]}
                </button>
              ))}
            </div>

            <div className="ax-field" style={{ marginBottom: 0 }}>
              <label className="ax-label" htmlFor="rx-date">
                {COUNTER_FILTER_DATE_LABEL}
              </label>
              <input
                id="rx-date"
                type="date"
                className="ax-input ax-input--sm"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {hasFilters && (
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm"
                onClick={() => {
                  setStatus('emise');
                  setDate('');
                  setPage(1);
                }}
              >
                {COUNTER_FILTER_CLEAR}
              </button>
            )}
          </div>
        </div>

        {list.loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : list.error ? (
          <div style={{ padding: 'var(--ax-space-4)' }}>
            <ErrorAlert error={list.error} onRetry={list.reload} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              defaultPendingView
                ? COUNTER_PENDING_EMPTY_TITLE
                : filtered
                  ? COUNTER_FILTER_EMPTY_TITLE
                  : COUNTER_EMPTY_TITLE
            }
            message={
              defaultPendingView
                ? COUNTER_PENDING_EMPTY_MESSAGE
                : filtered
                  ? COUNTER_FILTER_EMPTY_MESSAGE
                  : COUNTER_EMPTY_MESSAGE
            }
            action={
              defaultPendingView ? (
                <button
                  type="button"
                  className="ax-btn ax-btn--secondary"
                  onClick={() => setStatus('toutes')}
                >
                  <span className="ax-btn__label">{COUNTER_FILTER_ALL}</span>
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">{COUNTER_COL_PRESCRIPTION}</th>
                    <th className="ax-table__th" scope="col">{COUNTER_COL_MEDICATIONS}</th>
                    <th className="ax-table__th" scope="col">{COUNTER_COL_STATUS}</th>
                    <th className="ax-table__th" scope="col">
                      <span className="ax-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((rx) => (
                    <tr key={rx.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <span style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>
                          Ordonnance n° {rx.id}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--ax-text-xs)',
                            color: 'var(--ax-text-muted)',
                          }}
                        >
                          {formatDate(rx.created_at)}
                          {' · '}
                          {/* Le patient n'est PAS dans ce payload : plutôt que
                              de l'inventer, on ouvre sa consultation. */}
                          <Link href={`/centre/consultations/${rx.encounter}`} className="ax-link">
                            Voir la consultation
                          </Link>
                        </span>
                      </td>
                      <td className="ax-table__td" style={{ maxWidth: 320 }}>
                        <ul style={{ margin: 0, paddingInlineStart: 'var(--ax-space-4)', fontSize: 'var(--ax-text-sm)' }}>
                          {rx.items.map((item) => (
                            <li key={item.id}>
                              {item.medication}
                              {item.dosage && (
                                <span style={{ color: 'var(--ax-text-muted)' }}> — {item.dosage}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="ax-table__td">
                        <StatusBadge
                          /* « Remise » est un `success`, « À remettre » un
                             `info` — jamais un `warning` : une ordonnance non
                             encore servie n'est pas un problème. */
                          tone={rx.status === 'delivree' ? 'success' : 'info'}
                          label={PRESCRIPTION_STATUS_LABELS[rx.status]}
                        />
                        {rx.delivered_at && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 'var(--ax-text-xs)',
                              color: 'var(--ax-text-muted)',
                            }}
                          >
                            {counterDeliveredOn(rx.delivered_at)}
                          </span>
                        )}
                      </td>
                      <td className="ax-table__td" style={{ textAlign: 'end' }}>
                        {rx.status === 'emise' ? (
                          <div
                            className="ax-cluster"
                            style={{ gap: 'var(--ax-space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}
                          >
                            <button
                              type="button"
                              className="ax-btn ax-btn--secondary ax-btn--sm"
                              onClick={() => setSearching(rx)}
                            >
                              <span className="ax-btn__label">{AVAILABILITY_SEND_ACTION}</span>
                            </button>
                            <button
                              type="button"
                              className="ax-btn ax-btn--primary ax-btn--sm"
                              onClick={() => setDelivering(rx)}
                            >
                              <span className="ax-btn__label">{COUNTER_DELIVER_ACTION}</span>
                            </button>
                          </div>
                        ) : (
                          /* Aucun bouton « annuler la délivrance » : il
                             n'existe pas côté serveur, et l'afficher pour
                             qu'il échoue serait une promesse fausse. */
                          <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                            {COUNTER_SEARCH_DISABLED_HINT}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list.data && <Pagination count={list.data.count} page={page} onPage={setPage} />}
          </>
        )}
      </section>

      {delivering && (
        <DeliverModal
          prescription={delivering}
          onClose={() => setDelivering(null)}
          onDelivered={(fresh) => {
            setPatched({ ...patched, [fresh.id]: fresh });
            setDelivering(null);
            setFlash(counterDelivered(fresh.id));
          }}
        />
      )}
      {searching && (
        <AvailabilitySendModal
          /* La clé garantit que les cases cochées ne survivent JAMAIS d'une
             ordonnance à l'autre : l'état « tout coché » est semé au montage,
             et c'est le prescripteur qui choisit ce qui sort. */
          key={searching.id}
          prescription={searching}
          onClose={() => setSearching(null)}
          onSent={(count) => {
            setSearching(null);
            setFlash(availabilitySent(count));
          }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Onglet 2 — le fil des recherches
   ══════════════════════════════════════════════════════════════════════════ */

const FEED_PILLS: Array<AvailabilityRequestStatus | 'toutes'> = ['ouverte', 'close', 'toutes'];

function SearchesTab() {
  const { centerId } = useCenter();
  const router = useRouter();
  const [status, setStatus] = useState<AvailabilityRequestStatus | 'toutes'>('ouverte');
  const [page, setPage] = useState(1);

  const list = useAsync(
    () =>
      listCenterAvailabilityRequests(centerId, {
        ...(status === 'toutes' ? {} : { status }),
        page,
      }),
    [centerId, status, page],
  );

  const rows = list.data?.results ?? [];

  return (
    <section className="ax-card ax-col--12" role="region" aria-label={COUNTER_TAB_SEARCHES}>
      <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
        <div className="ax-card__titles">
          <h2 className="ax-card__title">{COUNTER_TAB_SEARCHES}</h2>
          <p className="ax-card__subtitle">{AVAILABILITY_FEED_SUBTITLE}</p>
        </div>
        <div
          className="ax-cluster"
          style={{ gap: 'var(--ax-space-2)' }}
          role="group"
          aria-label="Filtrer les recherches"
        >
          {FEED_PILLS.map((key) => (
            <button
              key={key}
              type="button"
              className={`ax-btn ax-btn--sm ax-btn--pill ${status === key ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
              aria-pressed={status === key}
              onClick={() => {
                setStatus(key);
                setPage(1);
              }}
            >
              {key === 'toutes' ? COUNTER_FILTER_ALL : AVAILABILITY_STATUS_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {list.loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : list.error ? (
        <div style={{ padding: 'var(--ax-space-4)' }}>
          <ErrorAlert error={list.error} onRetry={list.reload} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={status !== 'ouverte' ? AVAILABILITY_FEED_FILTER_EMPTY_TITLE : AVAILABILITY_FEED_EMPTY_TITLE}
          message={
            status !== 'ouverte'
              ? AVAILABILITY_FEED_FILTER_EMPTY_MESSAGE
              : AVAILABILITY_FEED_EMPTY_MESSAGE
          }
        />
      ) : (
        <>
          <div className="ax-table-wrap" tabIndex={0} role="region" aria-label="Tableau">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">{AVAILABILITY_COL_ZONE}</th>
                  <th className="ax-table__th" scope="col">{AVAILABILITY_COL_ITEMS}</th>
                  <th className="ax-table__th" scope="col">{AVAILABILITY_COL_RESPONSES}</th>
                  <th className="ax-table__th" scope="col">{AVAILABILITY_COL_SENT}</th>
                  <th className="ax-table__th" scope="col">
                    <span className="ax-visually-hidden">{AVAILABILITY_OPEN_SR}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr
                    key={request.id}
                    className="ax-table__row"
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/centre/ordonnances/recherches/${request.id}`)}
                  >
                    <td className="ax-table__td">
                      <Link
                        href={`/centre/ordonnances/recherches/${request.id}`}
                        className="ax-link"
                        onClick={(ev) => ev.stopPropagation()}
                        style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}
                      >
                        {availabilityZoneLabel(request.island, request.city)}
                      </Link>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--ax-text-xs)',
                          color: 'var(--ax-text-muted)',
                        }}
                      >
                        Ordonnance n° {request.prescription}
                      </span>
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {availabilityItemsLabel(request.items.length)}
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {availabilityResponsesLabel(request.response_count, request.recipient_count)}
                      {request.last_response_at && (
                        <span
                          style={{
                            display: 'block',
                            fontSize: 'var(--ax-text-xs)',
                            color: 'var(--ax-text-muted)',
                          }}
                        >
                          Dernière le {formatDateTime(request.last_response_at)}
                        </span>
                      )}
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>
                      {formatDate(request.created_at)}
                    </td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      {/* « Terminée » est NEUTRE : c'est l'issue normale au
                          bout de 48 h, pas un échec. */}
                      <StatusBadge
                        tone={request.status === 'ouverte' ? 'info' : 'neutral'}
                        label={
                          request.status === 'close' && request.close_reason
                            ? AVAILABILITY_CLOSE_REASON_LABELS[request.close_reason]
                            : AVAILABILITY_STATUS_LABELS[request.status]
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.data && <Pagination count={list.data.count} page={page} onPage={setPage} />}
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
              {AVAILABILITY_EXPIRES_HINT}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   L'écran
   ══════════════════════════════════════════════════════════════════════════ */

export function Prescriptions() {
  const { roles } = useCenter();
  const [tab, setTab] = useState<Tab>('ordonnances');

  /*
   * Garde D'ÉCRAN, en amont de tout : le staff administratif reçoit 403 sur
   * les deux onglets. On ne monte donc NI la liste, NI ses fetchs — patron S3
   * des cartes cliniques (`PatientMedicalFile`, `PatientDocuments`), où monter
   * un composant qui interroge et échoue serait à la fois inutile et bavard.
   */
  if (!hasRole(roles, PRESCRIPTION_READ_ROLES)) {
    return (
      <>
        <PageHead title={COUNTER_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div className="ax-card__body">
              <EmptyState
                title="Écran réservé aux soignants et au pharmacien"
                message="Les ordonnances relèvent du secret médical : leur lecture est réservée aux rôles soignants et au pharmacien du centre."
              />
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title={COUNTER_TITLE} subtitle={COUNTER_SUBTITLE} />

      <div className="ax-dash-grid">
        <div className="ax-col--12">
          <nav className="ax-tabs ax-tabs--pill" aria-label="Sections des ordonnances">
            <div className="ax-tabs__list">
              <button
                type="button"
                className={`ax-tabs__tab${tab === 'ordonnances' ? ' is-active' : ''}`}
                aria-pressed={tab === 'ordonnances'}
                onClick={() => setTab('ordonnances')}
              >
                {COUNTER_TAB_PRESCRIPTIONS}
              </button>
              <button
                type="button"
                className={`ax-tabs__tab${tab === 'recherches' ? ' is-active' : ''}`}
                aria-pressed={tab === 'recherches'}
                onClick={() => setTab('recherches')}
              >
                {COUNTER_TAB_SEARCHES}
              </button>
            </div>
          </nav>
        </div>

        {/* Les onglets se démontent : c'est un choix de POIDS, pas de style —
            garder les deux montés doublerait les requêtes sur une connexion
            comorienne pour un contenu qu'on ne regarde pas. */}
        {tab === 'ordonnances' ? <PrescriptionsTab /> : <SearchesTab />}
      </div>
    </>
  );
}

export default Prescriptions;
