'use client';
/*
 * Chioni — /centre/equipements/[id] : la fiche d'un appareil (S8, ADR 0021).
 *
 * ─── Ce que cet écran doit rendre ÉVIDENT ──────────────────────────────────
 *
 * **Signaler une panne ≠ changer l'état.** Ce sont deux gestes distincts, par
 * deux personnes potentiellement différentes ; un signalement ne change PAS
 * l'état de l'appareil. Sans quoi une infirmière croira l'avoir mis hors
 * service en le signalant, et le tensiomètre restera « en service » aux yeux
 * du centre alors que tout le monde le sait cassé.
 *
 * Trois séparations le disent, du plus visible au plus discret :
 *
 * 1. **Deux endroits différents, jamais côte à côte.** « Signaler une panne »
 *    est l'action PRIMAIRE de l'en-tête, ouverte à tout le monde ; changer
 *    l'état vit dans la carte « État de l'appareil », réservée au directeur.
 *    Aligner les trois boutons sur une même barre aurait fait croire à trois
 *    façons de faire la même chose.
 * 2. **La phrase, en tête de la modale de signalement**
 *    (`EQUIPMENT_REPORT_NOT_A_STATUS`).
 * 3. **Le message de succès NOMME l'état resté inchangé**
 *    (`equipmentReportSaved`) — « Signalement enregistré » seul aurait laissé
 *    exactement le doute qu'on vient de lever.
 *
 * ─── L'audience du fil ─────────────────────────────────────────────────────
 *
 * Tout le staff voit **le constat et sa date** ; le **directeur seul** voit
 * **qui l'a écrit**. L'écran ne réserve AUCUN emplacement pour un auteur qu'il
 * ne recevra pas, et n'invente pas d'« Anonyme » — voir `EquipmentShared.tsx`.
 *
 * ─── Gel ───────────────────────────────────────────────────────────────────
 *
 * **Rien n'est gelé ici** (décision 4) : pas de bandeau d'abonnement, pas de
 * bouton grisé sur un centre `suspendu`. *Signaler une panne doit toujours
 * passer.*
 *
 * Assets Vireo repris et adaptés : `pages/Timeline.tsx` pour le fil
 * (`ax-timeline`, marqueurs colorés), la carte de détail `ax-card` +
 * `DetailItem` du socle, et la modale du socle avec `busy` sur la réforme.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  changeEquipmentStatus,
  getEquipment,
  listEquipmentReports,
} from '@/lib/endpoints/equipment';
import {
  EQUIPMENT_CATEGORY_LABEL,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_COMMISSIONED_LABEL,
  EQUIPMENT_DETAIL_BACK,
  EQUIPMENT_EDIT_ACTION,
  EQUIPMENT_LOCATION_LABEL,
  EQUIPMENT_MARK_BROKEN,
  EQUIPMENT_MARK_IN_SERVICE,
  EQUIPMENT_NOTES_LABEL,
  EQUIPMENT_NOT_FOUND_MESSAGE,
  EQUIPMENT_NOT_FOUND_TITLE,
  EQUIPMENT_NO_COMMISSIONED,
  EQUIPMENT_NO_LOCATION,
  EQUIPMENT_NO_NOTES,
  EQUIPMENT_NO_SERIAL,
  EQUIPMENT_REPORTS_SUBTITLE,
  EQUIPMENT_REPORTS_TITLE,
  EQUIPMENT_REPORT_ACTION,
  EQUIPMENT_REPORT_APPEND_ONLY,
  EQUIPMENT_REPORT_CLOSED_REFORME,
  EQUIPMENT_RETIRE,
  EQUIPMENT_RETIRE_CONFIRM,
  EQUIPMENT_RETIRE_KEEPS,
  EQUIPMENT_RETIRE_TITLE,
  EQUIPMENT_RETIRE_WARNING,
  EQUIPMENT_RETIRED_NOTE,
  EQUIPMENT_SERIAL_LABEL,
  EQUIPMENT_SHEET_TITLE,
  EQUIPMENT_STATUS_DIRECTOR_ONLY,
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUS_REVERSIBLE,
  EQUIPMENT_STATUS_SECTION_TITLE,
  equipmentReportSaved,
  equipmentStatusChanged,
  equipmentUpdated,
  formatDate,
} from '@/lib/labels';
import type { Equipment, EquipmentStatus } from '@/lib/types';
import {
  EquipmentFormModal,
  EquipmentReportFeed,
  EquipmentReportModal,
} from './EquipmentShared';
import {
  EQUIPMENT_TONES,
  CardSkeleton,
  DetailItem,
  EmptyState,
  ErrorAlert,
  IconAlertTriangle,
  IconArchive,
  IconArrowLeft,
  IconEdit,
  IconExchange,
  IconRefresh,
  Modal,
  Pagination,
  StatusBadge,
  hasRole,
  toApiError,
  useAsync,
} from './shared';

/* ── réformer : le SEUL geste définitif du module ──────────────────────── */

function RetireModal({
  equipment,
  onClose,
  onRetired,
}: {
  equipment: Equipment;
  onClose: () => void;
  onRetired: (fresh: Equipment) => void;
}) {
  const { centerId } = useCenter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      onRetired(await changeEquipmentStatus(centerId, equipment.id, 'reforme'));
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    /* `busy` : les trois sorties involontaires (Échap, clic sur le fond, croix)
       sont neutralisées le temps de l'appel. Sur un geste irréversible, « je ne
       sais pas si ça a été fait » est le pire état possible. */
    <Modal title={EQUIPMENT_RETIRE_TITLE} onClose={onClose} busy={saving} width={520}
      footer={
        <>
          <button
            type="button"
            className="ax-btn ax-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--danger"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Réforme…' : EQUIPMENT_RETIRE_CONFIRM}
          </button>
        </>
      }
    >
      {error && error.messages.length > 0 && <ErrorAlert error={error} />}

      <div className="ax-alert ax-alert--warning" role="note">
        <div className="ax-alert__content">
          <p className="ax-alert__title">{equipment.name}</p>
          <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
            {EQUIPMENT_RETIRE_WARNING}
          </p>
        </div>
      </div>

      {/* Ce que réformer NE fait PAS : rien n'est supprimé. Le dire enlève la
          peur d'effacer une trace, qui est la vraie hésitation devant ce
          bouton. */}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--ax-text-sm)',
          color: 'var(--ax-text-muted)',
          lineHeight: 1.7,
        }}
      >
        {EQUIPMENT_RETIRE_KEEPS}
      </p>
    </Modal>
  );
}

/* ── la carte d'état : le geste du DIRECTEUR, à sa place ───────────────── */

function StatusCard({
  equipment,
  director,
  busy,
  error,
  onSetStatus,
  onRetire,
}: {
  equipment: Equipment;
  director: boolean;
  busy: boolean;
  /** Le refus vit DANS la carte qui porte le bouton, pas en tête de page. */
  error: ApiError | null;
  onSetStatus: (status: EquipmentStatus) => void;
  onRetire: () => void;
}) {
  const retired = equipment.status === 'reforme';

  return (
    <section
      className="ax-card ax-col--5"
      role="region"
      aria-label={EQUIPMENT_STATUS_SECTION_TITLE}
    >
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">{EQUIPMENT_STATUS_SECTION_TITLE}</h2>
        </div>
      </div>
      <div
        className="ax-card__body"
        style={{
          paddingTop: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ax-space-4)',
          alignItems: 'flex-start',
        }}
      >
        <StatusBadge
          tone={EQUIPMENT_TONES[equipment.status]}
          label={EQUIPMENT_STATUS_LABELS[equipment.status]}
        />

        {error && error.messages.length > 0 && (
          <div style={{ width: '100%' }}>
            <ErrorAlert error={error} />
          </div>
        )}

        {/*
          L'ordre des branches COMPTE, et il a été inversé : « réformé » se teste
          AVANT la casquette. `EQUIPMENT_STATUS_DIRECTOR_ONLY` promet « vous
          pouvez signaler une panne à tout moment » — vrai partout, SAUF sur un
          appareil réformé, où le backend refuse le signalement et où l'écran
          masque d'ailleurs le bouton. Tester le rôle en premier servait donc à
          une infirmière une phrase que la page elle-même contredisait.
        */}
        {retired ? (
          /* `EQUIPMENT_RETIRED_NOTE`, pas `EQUIPMENT_RETIRE_KEEPS` : la
             seconde est écrite pour la modale, au futur, et renvoie « dans la
             liste » — alors qu'on est en train de lire la fiche. Même
             promesse, au bon temps. */
          <p
            style={{
              margin: 0,
              fontSize: 'var(--ax-text-sm)',
              color: 'var(--ax-text-muted)',
              lineHeight: 1.7,
            }}
          >
            {EQUIPMENT_RETIRED_NOTE}
          </p>
        ) : !director ? (
          /* Dire QUI décide, sans renvoyer nulle part — et rappeler dans la
             même phrase que le geste ouvert à cette personne, lui, existe. */
          <p
            style={{
              margin: 0,
              fontSize: 'var(--ax-text-sm)',
              color: 'var(--ax-text-muted)',
              lineHeight: 1.7,
            }}
          >
            {EQUIPMENT_STATUS_DIRECTOR_ONLY}
          </p>
        ) : (
          <>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              {equipment.status === 'en_service' ? (
                <button
                  type="button"
                  className="ax-btn ax-btn--secondary"
                  onClick={() => onSetStatus('en_panne')}
                  disabled={busy}
                >
                  {/* PAS le triangle d'alerte : il est réservé à « Signaler une
                      panne ». Deux gestes distincts sous la même icône se
                      seraient lus comme deux chemins vers la même chose —
                      exactement la confusion que cet écran doit empêcher. La
                      flèche de bascule dit ce que ce bouton-ci fait : changer
                      un état. */}
                  <IconExchange />
                  <span className="ax-btn__label">{EQUIPMENT_MARK_BROKEN}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="ax-btn ax-btn--secondary"
                  onClick={() => onSetStatus('en_service')}
                  disabled={busy}
                >
                  <IconRefresh />
                  <span className="ax-btn__label">{EQUIPMENT_MARK_IN_SERVICE}</span>
                </button>
              )}
            </div>

            {/* Ce qui distingue les deux gestes de la carte : l'un se corrige,
                l'autre pas. La phrase se lit AVANT « Réformer ». */}
            <p
              style={{
                margin: 0,
                fontSize: 'var(--ax-text-xs)',
                color: 'var(--ax-text-muted)',
                lineHeight: 1.7,
              }}
            >
              {EQUIPMENT_STATUS_REVERSIBLE}
            </p>

            <hr className="ax-divider" style={{ width: '100%' }} aria-hidden="true" />

            <button
              type="button"
              className="ax-btn ax-btn--ghost"
              onClick={onRetire}
              disabled={busy}
            >
              <IconArchive />
              <span className="ax-btn__label">{EQUIPMENT_RETIRE}</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ── écran ─────────────────────────────────────────────────────────────── */

export function EquipmentDetail({ equipmentId }: { equipmentId: number }) {
  const { centerId, roles } = useCenter();
  const router = useRouter();
  const director = hasRole(roles, ['directeur']);

  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<ApiError | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [patched, setPatched] = useState<Equipment | null>(null);

  const loaded = useAsync(() => getEquipment(centerId, equipmentId), [centerId, equipmentId]);

  /* Le fil des constats — TOUT membre actif le lit. Le payload change avec la
     casquette, jamais l'appel : il n'y a qu'une route. */
  const reports = useAsync(
    () => listEquipmentReports(centerId, equipmentId, { page }),
    [centerId, equipmentId, page],
  );

  /*
   * `patched` est l'appareil RENVOYÉ par une écriture : il prime sur le fetch
   * le temps que l'écran se recharge, et il ne décrit QUE le couple (centre
   * actif, id de route) sous lequel il a été obtenu — il doit donc mourir avec
   * lui. Le sélecteur de centre de l'en-tête NE QUITTE PAS la page : sans cette
   * remise à zéro, un membre de plusieurs centres qui écrit ici puis bascule de
   * centre garderait à l'écran l'appareil du centre PRÉCÉDENT. Le message de
   * succès nomme lui aussi un parc qui n'est plus celui qu'on regarde : il
   * tombe avec. Patron S5/S6.
   */
  useEffect(() => {
    setPatched(null);
    setFlash(null);
    setStatusError(null);
    setPage(1);
  }, [centerId, equipmentId]);

  const equipment = patched ?? loaded.data;

  const applyFresh = (fresh: Equipment, message: string) => {
    setPatched(fresh);
    setFlash(message);
  };

  const setStatus = async (status: EquipmentStatus) => {
    setStatusBusy(true);
    setStatusError(null);
    try {
      applyFresh(
        await changeEquipmentStatus(centerId, equipmentId, status),
        equipmentStatusChanged(status),
      );
    } catch (err) {
      /* 400 « Transition impossible : cet équipement est « … » » — le message
         backend nomme l'état RÉEL, relu sous verrou (deux directeurs qui
         décident en même temps). Il est affiché tel quel : c'est exactement ce
         qu'il faut savoir. */
      setStatusError(toApiError(err));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loaded.loading) {
    return (
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12">
          <CardSkeleton lines={6} />
        </section>
      </div>
    );
  }

  if (loaded.error || equipment == null) {
    return (
      <>
        <PageHead title={EQUIPMENT_NOT_FOUND_TITLE} />
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12">
            <div style={{ padding: 'var(--ax-space-4)' }}>
              {loaded.error ? (
                <ErrorAlert error={loaded.error} onRetry={loaded.reload} />
              ) : (
                <EmptyState
                  title={EQUIPMENT_NOT_FOUND_TITLE}
                  message={EQUIPMENT_NOT_FOUND_MESSAGE}
                />
              )}
            </div>
          </section>
        </div>
      </>
    );
  }

  const retired = equipment.status === 'reforme';
  const rows = reports.data?.results ?? [];

  return (
    <>
      <PageHead
        title={equipment.name}
        subtitle={`${EQUIPMENT_CATEGORY_LABELS[equipment.category]} · ${equipment.location || EQUIPMENT_NO_LOCATION}`}
        actions={
          <>
            <button
              type="button"
              className="ax-btn ax-btn--ghost"
              onClick={() => router.push('/centre/equipements')}
            >
              <IconArrowLeft />
              <span className="ax-btn__label">{EQUIPMENT_DETAIL_BACK}</span>
            </button>
            {director && (
              <button
                type="button"
                className="ax-btn ax-btn--secondary"
                onClick={() => setEditOpen(true)}
              >
                <IconEdit />
                <span className="ax-btn__label">{EQUIPMENT_EDIT_ACTION}</span>
              </button>
            )}
            {/*
              LE geste central du module, en action PRIMAIRE et ouvert à TOUT
              membre actif — le directeur y a droit comme les autres. Il vit
              volontairement LOIN des boutons d'état (carte « État de
              l'appareil », plus bas) : les aligner aurait laissé croire à trois
              variantes du même geste. Sur un appareil réformé, il disparaît —
              le backend le refuse, et la carte des signalements dit pourquoi.
            */}
            {!retired && (
              <button
                type="button"
                className="ax-btn ax-btn--primary"
                onClick={() => setReportOpen(true)}
              >
                <IconAlertTriangle />
                <span className="ax-btn__label">{EQUIPMENT_REPORT_ACTION}</span>
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
                <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                  {flash}
                </p>
              </div>
            </div>
          </div>
        )}

        <StatusCard
          equipment={equipment}
          director={director}
          busy={statusBusy}
          error={statusError}
          onSetStatus={(status) => void setStatus(status)}
          onRetire={() => setRetireOpen(true)}
        />

        <section className="ax-card ax-col--7" role="region" aria-label={EQUIPMENT_SHEET_TITLE}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">{equipment.name}</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--ax-space-4)',
              }}
            >
              <DetailItem label={EQUIPMENT_CATEGORY_LABEL}>
                {EQUIPMENT_CATEGORY_LABELS[equipment.category]}
              </DetailItem>
              <DetailItem label={EQUIPMENT_LOCATION_LABEL}>
                {equipment.location || EQUIPMENT_NO_LOCATION}
              </DetailItem>
              <DetailItem label={EQUIPMENT_SERIAL_LABEL}>
                {equipment.serial_number || EQUIPMENT_NO_SERIAL}
              </DetailItem>
              <DetailItem label={EQUIPMENT_COMMISSIONED_LABEL}>
                {equipment.commissioned_on
                  ? formatDate(equipment.commissioned_on)
                  : EQUIPMENT_NO_COMMISSIONED}
              </DetailItem>
            </div>
            <div style={{ marginTop: 'var(--ax-space-4)' }}>
              <DetailItem label={EQUIPMENT_NOTES_LABEL}>
                <span style={{ whiteSpace: 'pre-wrap' }}>
                  {equipment.notes || EQUIPMENT_NO_NOTES}
                </span>
              </DetailItem>
            </div>
          </div>
        </section>

        <section
          className="ax-card ax-col--12"
          role="region"
          aria-label={EQUIPMENT_REPORTS_TITLE}
        >
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">{EQUIPMENT_REPORTS_TITLE}</h2>
              <p className="ax-card__subtitle">{EQUIPMENT_REPORTS_SUBTITLE}</p>
            </div>
          </div>

          {retired && (
            <div style={{ padding: '0 var(--ax-space-5) var(--ax-space-4)' }}>
              <div className="ax-alert ax-alert--neutral" role="note">
                <div className="ax-alert__content">
                  <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                    {EQUIPMENT_REPORT_CLOSED_REFORME}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {reports.loading ? (
              <CardSkeleton lines={4} />
            ) : reports.error ? (
              <ErrorAlert error={reports.error} onRetry={reports.reload} />
            ) : (
              <>
                <EquipmentReportFeed reports={rows} director={director} />
                {rows.length > 0 && (
                  /* Append-only, dit là où la question se pose : devant la
                     liste, pas dans une aide repliée. */
                  <p
                    style={{
                      margin: 'var(--ax-space-4) 0 0',
                      fontSize: 'var(--ax-text-xs)',
                      color: 'var(--ax-text-muted)',
                      lineHeight: 1.7,
                    }}
                  >
                    {EQUIPMENT_REPORT_APPEND_ONLY}
                  </p>
                )}
              </>
            )}
          </div>

          {reports.data && (
            <Pagination count={reports.data.count} page={page} onPage={setPage} />
          )}
        </section>
      </div>

      {editOpen && (
        <EquipmentFormModal
          equipment={equipment}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => {
            setEditOpen(false);
            applyFresh(saved, equipmentUpdated(saved.name));
          }}
        />
      )}

      {reportOpen && (
        <EquipmentReportModal
          equipmentId={equipment.id}
          onClose={() => setReportOpen(false)}
          onReported={() => {
            setReportOpen(false);
            /* Le message NOMME l'état resté inchangé : c'est là que se joue la
               distinction entre constater et décider. */
            setFlash(equipmentReportSaved(equipment.status));
            /* Retour page 1 : le nouveau constat est en tête du fil. Si on y
               est déjà, `reload` suffit — sinon le changement de `page`
               relance l'appel tout seul. */
            if (page === 1) reports.reload();
            else setPage(1);
            /* Le compteur `report_count` vit sur la LISTE, pas ici : rien à
               rafraîchir sur la fiche, l'état n'a pas bougé (et c'est le sujet). */
          }}
        />
      )}

      {retireOpen && (
        <RetireModal
          equipment={equipment}
          onClose={() => setRetireOpen(false)}
          onRetired={(fresh) => {
            setRetireOpen(false);
            applyFresh(fresh, equipmentStatusChanged(fresh.status));
          }}
        />
      )}
    </>
  );
}

export default EquipmentDetail;
