'use client';
/*
 * Chioni — « Mon dossier dans ce centre » (S7, ADR 0020 décision 6).
 *
 * La carte que TOUT membre du personnel voit sur son propre profil : son
 * emploi, ses journées, ses congés. Elle vit à côté de la carte « Mes
 * données » (RGPD, S4) parce que c'est le même geste — une personne qui
 * regarde ce que le produit sait d'elle — et elle obéit à la même règle :
 *
 * **rien ici n'est gelé par l'abonnement.** Ni la lecture, ni la demande de
 * congé, ni son retrait, ni le dépôt d'un justificatif. Une personne n'est
 * jamais prise en otage par la facture impayée de son employeur (arbitrage PO
 * n° 3) : aucun bouton de cette carte ne se grise sur un état d'abonnement, et
 * la phrase le dit à voix haute plutôt que de le laisser deviner.
 *
 * **404 = état NORMAL** : personne n'a de dossier avant que la direction ne
 * l'ouvre. On rend un état vide honnête, jamais une erreur rouge.
 *
 * Asset Vireo : `forms/Pickers.tsx` — sa « Date Range » donne la forme du
 * champ de plage (deux bornes dans un même bloc, avec un résumé lu sous le
 * champ : « du … au … · N journées »). Son popover de calendrier maison n'est
 * PAS repris : sur un Android d'entrée de gamme, le sélecteur natif de
 * `<input type="date">` est plus fiable au pouce, gratuit au clavier et pèse
 * zéro kilo-octet. C'est la lecture — deux bornes, un résumé — qu'on
 * réutilise, pas le widget.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import {
  archiveMyLeaveDocument,
  cancelMyLeave,
  getMyEmployment,
  listMyAttendance,
  listMyLeaves,
  requestMyLeave,
  uploadMyLeaveDocument,
} from '@/lib/endpoints/hrm';
import {
  HRM_LEAVE_CANCEL_SCOPE,
  HRM_LEAVE_DOCUMENT_ARCHIVE_CONFIRM,
  HRM_LEAVE_DOCUMENT_ARCHIVE_WARNING,
  HRM_LEAVE_DOCUMENT_HINT,
  HRM_LEAVE_NO_REASON,
  HRM_ME_ALWAYS_OPEN,
  HRM_ME_ATTENDANCE_EMPTY,
  HRM_ME_ATTENDANCE_HINT,
  HRM_ME_ATTENDANCE_TITLE,
  HRM_ME_ENDED_LABEL,
  HRM_ME_HIRED_LABEL,
  HRM_ME_LEAVES_EMPTY,
  HRM_ME_LEAVES_TITLE,
  HRM_ME_NONE_MESSAGE,
  HRM_ME_NONE_TITLE,
  HRM_ME_REFUSED_NO_REASON,
  HRM_ME_REQUEST_LEAVE,
  HRM_ME_TITLE,
  LEAVE_TYPES,
  LEAVE_TYPE_LABELS,
  formatDate,
  formatWeekdayDate,
  leaveDaysLabel,
  leaveRangeLabel,
  shiftIsoDate,
  todayIsoDate,
  uploadThrottled,
} from '@/lib/labels';
import { ApiError } from '@/lib/api';
import type { LeaveType, MyLeaveRequest } from '@/lib/types';
import { AttendanceBadge, LeaveDocumentList, LeaveStatusBadge } from './HrShared';
import {
  CardSkeleton,
  DetailItem,
  ErrorAlert,
  FieldError,
  IconArchive,
  IconPaperclip,
  IconPlus,
  Modal,
  toApiError,
  useAsync,
} from './shared';

/** 429 du scope `uploads` (20/h) : remplacer le message anglais de DRF. */
function toUploadError(err: unknown): ApiError {
  const e = toApiError(err);
  if (e.status === 429) return new ApiError(429, [uploadThrottled(e.retryAfterSeconds)]);
  return e;
}

/** Nombre de journées civiles couvertes, bornes comprises (affichage seul). */
function dayCount(start: string, end: string): number {
  if (start === '' || end === '' || end < start) return 0;
  const from = new Date(`${start}T12:00:00`).getTime();
  const to = new Date(`${end}T12:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000) + 1;
}

/** Plafond du backend (une plage non bornée empoisonnerait les chevauchements). */
const MAX_LEAVE_DAYS = 366;

/* ── demander un congé ── */

function RequestLeaveModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /**
   * `close` dit si la modale doit disparaître. Elle NE doit pas disparaître
   * quand la demande est passée mais que le justificatif a échoué : le
   * message qui explique ce qui manque vit dans cette modale, et le fermer
   * revenait à ne rien dire du tout (revue UX care S7).
   */
  onCreated: (close: boolean) => void;
}) {
  const { centerId } = useCenter();
  const today = todayIsoDate();
  const [type, setType] = useState<LeaveType>('annuel');
  const [start, setStart] = useState(shiftIsoDate(today, 1));
  const [end, setEnd] = useState(shiftIsoDate(today, 1));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const days = dayCount(start, end);
  const tooLong = days > MAX_LEAVE_DAYS;
  /* La demande est PASSÉE : plus aucun bouton d'envoi, sans quoi un second
     clic déposerait une deuxième demande sur les mêmes dates. */
  const created = uploadWarning !== null;
  const warningRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (created) warningRef.current?.focus();
  }, [created]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setUploadWarning(null);
    try {
      const leave = await requestMyLeave(centerId, {
        leave_type: type,
        start_date: start,
        /* Une plage d'un seul jour est la norme (« je suis à un enterrement
           demain ») : la borne de fin se cale sur celle de début si la
           personne n'y a pas touché. */
        end_date: end < start ? start : end,
      });
      if (file) {
        try {
          await uploadMyLeaveDocument(centerId, leave.id, file);
        } catch (err) {
          /* La demande EXISTE : la perdre parce que la photo n'est pas passée
             serait le pire des deux mondes. On la garde, on dit exactement ce
             qui manque — et on GARDE la modale ouverte pour que ce soit lu. */
          const e = toUploadError(err);
          setUploadWarning(
            `Votre demande de congé est bien enregistrée. En revanche, le justificatif n’a pas pu être envoyé : ${e.messages.join(' ')} Vous pouvez le joindre plus tard depuis « Mes congés », avec le bouton « Joindre ».`,
          );
          setBusy(false);
          onCreated(false);
          return;
        }
      }
      onCreated(true);
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={HRM_ME_REQUEST_LEAVE}
      onClose={onClose}
      busy={busy}
      width={520}
      footer={
        created ? (
          <button type="button" className="ax-btn ax-btn--primary" onClick={onClose}>
            <span className="ax-btn__label">J’ai compris</span>
          </button>
        ) : (
          <>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
              Annuler
            </button>
            <button
              type="submit"
              form="leave-form"
              className="ax-btn ax-btn--primary"
              disabled={busy || start === '' || days === 0 || tooLong}
            >
              {busy ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          </>
        )
      }
    >
      {uploadWarning && (
        /* Le focus va sur le MESSAGE, pas sur le bouton qui ferme : le piège
           de focus corrigé en S4 (une touche Entrée déposait une demande
           d'effacement) vaut aussi ici, et la personne doit lire avant de
           pouvoir valider. */
        <div
          ref={warningRef}
          tabIndex={-1}
          className="ax-alert ax-alert--warning"
          role="alert"
          style={{ outline: 'none' }}
        >
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
              {uploadWarning}
            </p>
          </div>
        </div>
      )}

      {!created && (
      <form
        id="leave-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <div className="ax-field">
          <label className="ax-label" htmlFor="leave-type">
            Type de congé{' '}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="leave-type"
            className="ax-select"
            value={type}
            onChange={(e) => setType(e.target.value as LeaveType)}
            data-autofocus=""
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {LEAVE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {/* AUCUN champ « précisez » — et l'écran dit pourquoi, plutôt que de
              laisser chercher où écrire le motif. */}
          <span className="ax-field__message" style={{ lineHeight: 1.7 }}>
            {HRM_LEAVE_NO_REASON}
          </span>
          <FieldError error={error} field="leave_type" />
        </div>

        {/* Plage — forme reprise de la « Date Range » de Vireo, bornes natives. */}
        <div className="ax-field">
          <span className="ax-label">
            Du … au …{' '}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--ax-space-3)',
            }}
          >
            <div>
              <label className="ax-visually-hidden" htmlFor="leave-start">
                Premier jour
              </label>
              <input
                id="leave-start"
                type="date"
                className={`ax-input${error?.fieldErrors.start_date ? ' is-invalid' : ''}`}
                value={start}
                /* Horizon de saisie : le backend n'en pose aucun (vigilance
                   consignée en revue guardian S7), et une faute de frappe sur
                   l'année — « 2926 » — déposerait une demande qui ne se
                   corrige pas, seulement se retire. Deux ans suffisent
                   largement à poser des congés à l'avance. */
                max={shiftIsoDate(today, 730)}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (end < e.target.value) setEnd(e.target.value);
                }}
                required
              />
            </div>
            <div>
              <label className="ax-visually-hidden" htmlFor="leave-end">
                Dernier jour
              </label>
              <input
                id="leave-end"
                type="date"
                className={`ax-input${error?.fieldErrors.end_date ? ' is-invalid' : ''}`}
                value={end}
                min={start || undefined}
                max={shiftIsoDate(today, 730)}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <span className="ax-field__message" role="status">
            {tooLong
              ? `Une demande couvre au maximum ${MAX_LEAVE_DAYS} journées. Vérifiez les dates, ou déposez plusieurs demandes.`
              : days > 0
                ? `${leaveRangeLabel(start, end < start ? start : end)} · ${leaveDaysLabel(days)}`
                : 'Choisissez le premier et le dernier jour de votre absence.'}
          </span>
          <FieldError error={error} field="start_date" />
          <FieldError error={error} field="end_date" />
        </div>

        <div className="ax-field">
          <label className="ax-label" htmlFor="leave-file">
            Justificatif (facultatif)
          </label>
          <input
            id="leave-file"
            type="file"
            className="ax-input"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="ax-field__message" style={{ lineHeight: 1.7 }}>
            {HRM_LEAVE_DOCUMENT_HINT}
          </span>
        </div>
      </form>
      )}
    </Modal>
  );
}

/* ── retirer une demande ── */

function CancelLeaveModal({
  leave,
  onClose,
  onCancelled,
}: {
  leave: MyLeaveRequest;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const { centerId } = useCenter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelMyLeave(centerId, leave.id);
      onCancelled();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Retirer ma demande"
      onClose={onClose}
      busy={busy}
      width={460}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Garder ma demande
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--secondary"
            onClick={() => void submit()}
            disabled={busy}
          >
            <span className="ax-btn__label">{busy ? 'Retrait…' : 'Retirer'}</span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
        {LEAVE_TYPE_LABELS[leave.leave_type]} · {leaveRangeLabel(leave.start_date, leave.end_date)}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 'var(--ax-text-sm)',
          color: 'var(--ax-text-muted)',
          lineHeight: 1.7,
        }}
      >
        Votre demande ne sera plus soumise à la direction. Vous pourrez en déposer une nouvelle
        quand vous voudrez.
      </p>
    </Modal>
  );
}

/* ── justificatifs d'une demande ── */

function MyDocumentsModal({
  leave,
  onClose,
  onChanged,
}: {
  leave: MyLeaveRequest;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { centerId } = useCenter();
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [archiving, setArchiving] = useState<number | null>(null);
  /** Le retrait est DÉFINITIF : on demande confirmation sur place, sans
      empiler une modale par-dessus la modale (illisible sur un téléphone). */
  const [confirming, setConfirming] = useState<number | null>(null);

  const upload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadMyLeaveDocument(centerId, leave.id, file);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      setError(toUploadError(err));
    } finally {
      setBusy(false);
    }
  };

  const archive = async (documentId: number) => {
    setArchiving(documentId);
    setError(null);
    try {
      await archiveMyLeaveDocument(centerId, leave.id, documentId);
      setConfirming(null);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setArchiving(null);
    }
  };

  return (
    <Modal
      title="Mes justificatifs"
      onClose={onClose}
      /* Le retrait d'une pièce est irréversible : la modale ne se quitte pas
         en vol (patron du socle, revue guardian frontend S4). */
      busy={busy || archiving !== null}
      width={520}
      footer={
        <button
          type="button"
          className="ax-btn ax-btn--secondary"
          onClick={onClose}
          disabled={busy || archiving !== null}
        >
          Fermer
        </button>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        {LEAVE_TYPE_LABELS[leave.leave_type]} · {leaveRangeLabel(leave.start_date, leave.end_date)}
      </p>

      <LeaveDocumentList
        centerId={centerId}
        leaveId={leave.id}
        scope="me"
        reloadKey={reloadKey}
        actions={(doc) =>
          doc.archived_at !== null ? null : confirming === doc.id ? (
            /* Deux boutons libellés, la conséquence écrite juste au-dessus de
               la liste : un `title` ne s'ouvre jamais au doigt sur Android. */
            <>
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm"
                onClick={() => setConfirming(null)}
                disabled={archiving === doc.id}
              >
                <span className="ax-btn__label">Garder</span>
              </button>
              <button
                type="button"
                className="ax-btn ax-btn--secondary ax-btn--sm"
                onClick={() => void archive(doc.id)}
                disabled={archiving === doc.id}
              >
                <IconArchive />
                <span className="ax-btn__label">
                  {archiving === doc.id ? 'Retrait…' : HRM_LEAVE_DOCUMENT_ARCHIVE_CONFIRM}
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--sm"
              onClick={() => setConfirming(doc.id)}
              disabled={archiving !== null}
            >
              <IconArchive />
              <span className="ax-btn__label">Retirer</span>
            </button>
          )
        }
      />

      {/* La conséquence, ÉCRITE — pas seulement infobullée. */}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--ax-text-xs)',
          color: 'var(--ax-text-muted)',
          lineHeight: 1.7,
        }}
      >
        {HRM_LEAVE_DOCUMENT_ARCHIVE_WARNING}
      </p>

      <div className="ax-field" style={{ marginBottom: 0 }}>
        <label className="ax-label" htmlFor="my-doc-file">
          Ajouter une photo
        </label>
        <input
          id="my-doc-file"
          type="file"
          className="ax-input"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        <span className="ax-field__message" style={{ lineHeight: 1.7 }}>
          {HRM_LEAVE_DOCUMENT_HINT}
        </span>
      </div>
    </Modal>
  );
}

/* ── la carte ── */

export function MyHrCard() {
  const { centerId } = useCenter();
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState<MyLeaveRequest | null>(null);
  const [docsFor, setDocsFor] = useState<MyLeaveRequest | null>(null);

  const employment = useAsync(() => getMyEmployment(centerId), [centerId]);
  /*
   * **Le dossier est lié à SON centre, jamais au dernier chargé.**
   *
   * `useAsync` conserve `data` pendant qu'il recharge : au changement de
   * centre actif, la carte rendait pendant un rendu complet le nom du centre
   * PRÉCÉDENT, sa date d'embauche, son service, sa fonction et la liste de ses
   * congés — types compris — sous l'en-tête du nouveau. Ce sont les données de
   * la même personne (aucune fuite vers un tiers), mais l'ADR 0020 pose un
   * cloisonnement ABSOLU par centre : deux dossiers du même humain sont
   * étanches, et l'écran ne doit pas donner à lire l'un pour l'autre. On lie
   * donc la donnée à l'id de route — `MyEmployment.center` est là pour ça.
   */
  const raw = employment.data;
  const me = raw !== null && raw.center === centerId ? raw : null;
  const staleCenter = raw !== null && me === null && employment.error === null;
  const hasFile = me !== null && employment.error === null;

  const leaves = useAsync(
    () => (hasFile ? listMyLeaves(centerId) : Promise.resolve(null)),
    [centerId, hasFile],
  );
  const attendance = useAsync(
    () => (hasFile ? listMyAttendance(centerId) : Promise.resolve(null)),
    [centerId, hasFile],
  );

  const recentDays = useMemo(
    () => (attendance.data?.results ?? []).slice(0, 10),
    [attendance.data],
  );

  /* `staleCenter` : la seule réponse en mémoire vient d'un AUTRE centre —
     on attend celle du centre actif plutôt que de montrer l'autre dossier. */
  if (employment.loading || staleCenter) {
    return (
      <section className="ax-card" role="region" aria-label={HRM_ME_TITLE}>
        <CardSkeleton lines={4} />
      </section>
    );
  }

  /* Le 404 n'est PAS une erreur : personne n'a de dossier avant que la
     direction ne l'ouvre. Toute autre erreur, elle, se dit. */
  if (employment.error?.status === 404 || me === null) {
    return (
      <section className="ax-card" role="region" aria-label={HRM_ME_TITLE}>
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title">{HRM_ME_TITLE}</h2>
          </div>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          {employment.error && employment.error.status !== 404 ? (
            <ErrorAlert error={employment.error} onRetry={employment.reload} />
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontWeight: 'var(--ax-weight-medium)',
                  color: 'var(--ax-text-strong)',
                }}
              >
                {HRM_ME_NONE_TITLE}
              </p>
              <p
                style={{
                  margin: 'var(--ax-space-2) 0 0',
                  fontSize: 'var(--ax-text-sm)',
                  color: 'var(--ax-text-muted)',
                  lineHeight: 1.7,
                }}
              >
                {HRM_ME_NONE_MESSAGE}
              </p>
            </>
          )}
        </div>
      </section>
    );
  }

  const myLeaves = leaves.data ?? [];

  return (
    <>
      <section className="ax-card" role="region" aria-label={HRM_ME_TITLE}>
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-card__titles">
            <h2 className="ax-card__title">{HRM_ME_TITLE}</h2>
            <p className="ax-card__subtitle">{me.center_name}</p>
          </div>
          <button
            type="button"
            className="ax-btn ax-btn--primary ax-btn--sm"
            onClick={() => setRequesting(true)}
          >
            <IconPlus />
            <span className="ax-btn__label">{HRM_ME_REQUEST_LEAVE}</span>
          </button>
        </div>

        <div
          className="ax-card__body"
          style={{
            paddingTop: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ax-space-5)',
          }}
        >
          {/* L'emploi */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 'var(--ax-space-4)',
            }}
          >
            <DetailItem label={HRM_ME_HIRED_LABEL}>{formatDate(me.hired_at)}</DetailItem>
            <DetailItem label="Service">{me.department_name ?? 'Non précisé'}</DetailItem>
            <DetailItem label="Fonction">{me.job_title_name ?? 'Non précisée'}</DetailItem>
            {me.ended_at !== null && (
              <DetailItem label={HRM_ME_ENDED_LABEL}>{formatDate(me.ended_at)}</DetailItem>
            )}
          </div>

          {/* Un ENGAGEMENT produit (arbitrage PO n° 3) : il se lit, il ne se
              devine pas. Il était en `--ax-text-xs` au milieu de trois autres
              blocs gris — remonté à la taille du corps secondaire. */}
          <p
            style={{
              margin: 0,
              fontSize: 'var(--ax-text-sm)',
              color: 'var(--ax-text-muted)',
              lineHeight: 1.7,
            }}
          >
            {HRM_ME_ALWAYS_OPEN}
          </p>

          {/* Mes congés */}
          <div>
            <h3
              style={{
                margin: '0 0 var(--ax-space-3)',
                fontSize: 'var(--ax-text-sm)',
                color: 'var(--ax-text-strong)',
              }}
            >
              {HRM_ME_LEAVES_TITLE}
            </h3>
            {leaves.loading ? (
              <CardSkeleton lines={2} />
            ) : leaves.error ? (
              <ErrorAlert error={leaves.error} onRetry={leaves.reload} />
            ) : myLeaves.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                {HRM_ME_LEAVES_EMPTY}
              </p>
            ) : (
              <ul className="ax-list ax-list--compact" aria-label={HRM_ME_LEAVES_TITLE}>
                {myLeaves.map((leave) => (
                  <li key={leave.id} className="ax-list__row">
                    <span className="ax-list__content">
                      <span className="ax-list__title">{LEAVE_TYPE_LABELS[leave.leave_type]}</span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--ax-text-xs)',
                          color: 'var(--ax-text-muted)',
                        }}
                      >
                        {leaveRangeLabel(leave.start_date, leave.end_date)} ·{' '}
                        {leaveDaysLabel(leave.days)}
                        {leave.decided_at !== null &&
                          ` · ${leave.status === 'approuve' ? 'approuvée' : leave.status === 'refuse' ? 'refusée' : 'décidée'} le ${formatDate(leave.decided_at)}`}
                      </span>
                      {/* Un refus, dit avec tact et sans mensonge : le backend
                          ne porte AUCUN motif (décision 4), donc l'écran n'en
                          invente pas — et ne laisse pas croire qu'il en existe
                          un caché ailleurs dans l'application. */}
                      {leave.status === 'refuse' && (
                        <span
                          style={{
                            display: 'block',
                            marginTop: 'var(--ax-space-1)',
                            fontSize: 'var(--ax-text-xs)',
                            color: 'var(--ax-text-muted)',
                            lineHeight: 1.7,
                          }}
                        >
                          {HRM_ME_REFUSED_NO_REASON}
                        </span>
                      )}
                    </span>
                    <span
                      className="ax-list__trailing"
                      style={{
                        display: 'flex',
                        gap: 'var(--ax-space-2)',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <LeaveStatusBadge status={leave.status} />
                      <button
                        type="button"
                        className="ax-btn ax-btn--ghost ax-btn--sm"
                        onClick={() => setDocsFor(leave)}
                      >
                        <IconPaperclip />
                        <span className="ax-btn__label">
                          {leave.has_document ? 'Justificatifs' : 'Joindre'}
                        </span>
                      </button>
                      {/* Seule une demande EN ATTENTE se retire : les trois
                          autres états sont terminaux côté serveur, et un
                          bouton qui recevrait « Transition impossible »
                          apprendrait à s'en méfier. */}
                      {leave.status === 'demande' && (
                        <button
                          type="button"
                          className="ax-btn ax-btn--ghost ax-btn--sm"
                          onClick={() => setCancelling(leave)}
                        >
                          <span className="ax-btn__label">Retirer</span>
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p
              style={{
                margin: 'var(--ax-space-2) 0 0',
                fontSize: 'var(--ax-text-xs)',
                color: 'var(--ax-text-muted)',
                lineHeight: 1.7,
              }}
            >
              {HRM_LEAVE_CANCEL_SCOPE}
            </p>
          </div>

          {/* Mes journées */}
          <div>
            <h3
              style={{
                margin: '0 0 var(--ax-space-3)',
                fontSize: 'var(--ax-text-sm)',
                color: 'var(--ax-text-strong)',
              }}
            >
              {HRM_ME_ATTENDANCE_TITLE}
            </h3>
            {attendance.loading ? (
              <CardSkeleton lines={2} />
            ) : attendance.error ? (
              <ErrorAlert error={attendance.error} onRetry={attendance.reload} />
            ) : recentDays.length === 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                {HRM_ME_ATTENDANCE_EMPTY}
              </p>
            ) : (
              <>
                {/* Qui tient la feuille, et quoi faire si une journée est
                    fausse — la liste arrivait nue, sans recours indiqué. */}
                <p
                  style={{
                    margin: '0 0 var(--ax-space-3)',
                    fontSize: 'var(--ax-text-xs)',
                    color: 'var(--ax-text-muted)',
                    lineHeight: 1.7,
                  }}
                >
                  {HRM_ME_ATTENDANCE_HINT}
                </p>
                <ul className="ax-list ax-list--compact" aria-label={HRM_ME_ATTENDANCE_TITLE}>
                  {recentDays.map((day) => (
                    <li key={day.id} className="ax-list__row">
                      <span
                        className="ax-list__content"
                        style={{ textTransform: 'capitalize', color: 'var(--ax-text)' }}
                      >
                        {formatWeekdayDate(day.date)}
                      </span>
                      <span className="ax-list__trailing">
                        <AttendanceBadge status={day.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      {requesting && (
        <RequestLeaveModal
          onClose={() => setRequesting(false)}
          onCreated={(close) => {
            /* `close === false` : la demande est passée, le justificatif non.
               La modale RESTE pour porter le message ; la liste se recharge
               quand même derrière. */
            if (close) setRequesting(false);
            leaves.reload();
          }}
        />
      )}

      {cancelling && (
        <CancelLeaveModal
          leave={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            setCancelling(null);
            leaves.reload();
          }}
        />
      )}

      {docsFor && (
        <MyDocumentsModal
          leave={docsFor}
          onClose={() => setDocsFor(null)}
          onChanged={() => leaves.reload()}
        />
      )}
    </>
  );
}

export default MyHrCard;
