'use client';
/*
 * Chioni — /centre/rendez-vous : l'agenda et la file du jour.
 *
 * L'OUTIL QUOTIDIEN de la secrétaire : vue « jour » (aujourd'hui par défaut),
 * navigation par date, filtres praticien/statut, création rapide et actions
 * un-clic par ligne (Arrivé / Honoré / Manqué / Annulé) selon la machine à
 * états. Un chevauchement de praticien à la création/au déplacement est un
 * AVERTISSEMENT non bloquant (« overlaps ») — le guichet décide.
 *
 * Annuaire des praticiens (S1) : GET /centers/{c}/practitioners/ — ouvert à
 * tout le staff actif, memberships cliniques actifs seulement. Un praticien
 * recruté la veille y figure (plus aucun rabattement sur les stats).
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import type { ApiError } from '@/lib/api';
import {
  cancelAppointment,
  checkInAppointment,
  createAppointment,
  honorAppointment,
  listAppointments,
  listPatients,
  listPractitioners,
  noShowAppointment,
  updateAppointment,
} from '@/lib/endpoints/centers';
import {
  APPOINTMENT_STATUS_LABELS,
  STAFF_ROLE_LABELS,
  formatDate,
  formatTime,
  formatWeekdayDate,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type {
  Appointment,
  AppointmentStatus,
  AppointmentWithOverlaps,
  Patient,
  StaffRole,
} from '@/lib/types';
import {
  APPOINTMENT_TONES,
  AvatarChip,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  FieldError,
  IconCheck,
  IconClose,
  IconEdit,
  IconPlus,
  IconSearch,
  Modal,
  Pagination,
  StatusBadge,
  TableSkeleton,
  toApiError,
  useAsync,
  useDebounced,
} from './shared';

/*
 * Vue « Calendrier » (grille mois adaptée de l'app Calendar de Vireo) —
 * chargée à la demande : la file du jour, outil quotidien de la secrétaire,
 * ne paie pas le poids de la grille.
 */
const AppointmentsCalendar = dynamic(() => import('./AppointmentsCalendar'), {
  ssr: false,
  loading: () => (
    <div className="ax-dash-grid">
      <section className="ax-card ax-col--12" role="region" aria-label="Calendrier des rendez-vous">
        <CardSkeleton lines={6} />
      </section>
    </div>
  ),
});

/* ── practitioner directory (S1 — GET /practitioners/, every active staff) ── */

interface PractitionerOption {
  /** StaffMembership id — the value of `practitioner` on an appointment. */
  id: number;
  name: string;
  role: StaffRole;
}

/** One bare, non-paginated call — active clinical memberships only. */
function usePractitioners(): { options: PractitionerOption[]; loading: boolean } {
  const { centerId } = useCenter();
  const state = useAsync(() => listPractitioners(centerId), [centerId]);
  const options = (state.data ?? []).map((p) => ({ id: p.id, name: p.display_name, role: p.role }));
  return { options, loading: state.loading };
}

/* ── date helpers (screen-local) ── */

/** ISO datetime → value of an <input type="datetime-local"> (local clock). */
function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

/**
 * Default slot for a new appointment: today → the next quarter-hour (the
 * desk usually books « maintenant ») ; any other day → 09:00.
 */
function defaultScheduledAt(date: string): string {
  if (date !== todayIsoDate()) return `${date}T09:00`;
  const next = new Date();
  next.setSeconds(0, 0);
  const rest = next.getMinutes() % 15;
  next.setMinutes(next.getMinutes() + (rest === 0 ? 15 : 15 - rest));
  return isoToLocalInput(next.toISOString());
}

/* ── overlap warning message (single wording for create + move) ── */

function overlapMessage(overlaps: number[]): string | null {
  if (overlaps.length === 0) return null;
  return overlaps.length === 1
    ? 'Attention : ce rendez-vous chevauche 1 autre rendez-vous du même praticien. Il a bien été enregistré — à vous de décider s’il faut le déplacer.'
    : `Attention : ce rendez-vous chevauche ${overlaps.length} autres rendez-vous du même praticien. Il a bien été enregistré — à vous de décider s’il faut le déplacer.`;
}

/* ── practitioner select (shared by create + edit forms) ── */

function PractitionerSelect({
  value,
  onChange,
  directory,
  idPrefix,
  error,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  directory: ReturnType<typeof usePractitioners>;
  idPrefix: string;
  error: ApiError | null;
}) {
  return (
    <div className="ax-field">
      <label className="ax-label" htmlFor={`${idPrefix}-practitioner`}>Praticien</label>
      <select
        id={`${idPrefix}-practitioner`}
        className="ax-select"
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number.parseInt(e.target.value, 10))}
      >
        <option value="">Avec le centre (sans praticien attitré)</option>
        {directory.options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {STAFF_ROLE_LABELS[p.role]}
          </option>
        ))}
      </select>
      <FieldError error={error} field="practitioner" />
    </div>
  );
}

/* ── create modal ── */

function CreateAppointmentModal({
  defaultDate,
  onClose,
  onCreated,
}: {
  defaultDate: string;
  onClose: () => void;
  onCreated: (fresh: AppointmentWithOverlaps) => void;
}) {
  const { centerId } = useCenter();
  const directory = usePractitioners();
  const [patientQ, setPatientQ] = useState('');
  const [patient, setPatient] = useState<Patient | null>(null);
  const [scheduledAt, setScheduledAt] = useState(() => defaultScheduledAt(defaultDate));
  const [duration, setDuration] = useState('20');
  const [practitioner, setPractitioner] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const debouncedQ = useDebounced(patientQ.trim());

  const candidates = useAsync(
    () => (debouncedQ ? listPatients(centerId, { q: debouncedQ, page: 1 }) : Promise.resolve(null)),
    [centerId, debouncedQ],
  );

  const submit = async () => {
    if (!patient || !scheduledAt) return;
    setSaving(true);
    setError(null);
    try {
      const fresh = await createAppointment(centerId, {
        patient: patient.id,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: Number.parseInt(duration, 10) || 20,
        practitioner,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      onCreated(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nouveau rendez-vous"
      onClose={onClose}
      width={620}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="appt-create-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !patient || !scheduledAt}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le rendez-vous'}
          </button>
        </>
      }
    >
      <form
        id="appt-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        {/* Patient picker — same pattern as the encounter creation */}
        <div className="ax-field">
          <label className="ax-label" htmlFor="appt-patient">
            Patient <span className="ax-field__required" aria-hidden="true">*</span>
          </label>
          {patient ? (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
              <AvatarChip name={`${patient.first_name} ${patient.last_name}`} seed={patient.id} />
              <span style={{ fontWeight: 500, color: 'var(--ax-text-strong)', flex: '1 1 auto' }}>
                {patient.first_name} {patient.last_name}
              </span>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setPatient(null)}>
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="ax-field__control">
                <span className="ax-field__affix ax-field__affix--leading">
                  <IconSearch className="" />
                </span>
                <input
                  id="appt-patient"
                  type="search"
                  className="ax-input ax-input--with-leading-icon"
                  placeholder="Rechercher un patient par nom ou téléphone…"
                  value={patientQ}
                  onChange={(e) => setPatientQ(e.target.value)}
                  data-autofocus=""
                />
              </div>
              {debouncedQ && candidates.loading && <CardSkeleton lines={2} />}
              {debouncedQ && !candidates.loading && (candidates.data?.results.length ?? 0) === 0 && (
                <span className="ax-field__message">
                  Aucun patient trouvé — créez d&apos;abord son dossier dans « Patients ».
                </span>
              )}
              {(candidates.data?.results.length ?? 0) > 0 && (
                <ul className="ax-list ax-list--compact" role="listbox" aria-label="Patients trouvés">
                  {candidates.data?.results.slice(0, 6).map((p) => (
                    <li key={p.id} className="ax-list__row">
                      <button
                        type="button"
                        onClick={() => setPatient(p)}
                        className="ax-btn ax-btn--ghost ax-btn--block"
                        style={{ justifyContent: 'flex-start', gap: 'var(--ax-space-3)' }}
                      >
                        <AvatarChip name={`${p.first_name} ${p.last_name}`} seed={p.id} />
                        <span className="ax-btn__label" style={{ textAlign: 'start' }}>
                          {p.first_name} {p.last_name}
                          <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontWeight: 400 }}>
                            {p.birth_date ? formatDate(p.birth_date) : 'Naissance inconnue'} · {p.phone || 'Sans téléphone'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <FieldError error={error} field="patient" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="appt-when">
              Date et heure <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="appt-when"
              type="datetime-local"
              className={`ax-input${error?.fieldErrors.scheduled_at ? ' is-invalid' : ''}`}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
            <FieldError error={error} field="scheduled_at" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="appt-duration">Durée (minutes)</label>
            <input
              id="appt-duration"
              type="number"
              min={5}
              max={480}
              step={5}
              className={`ax-input${error?.fieldErrors.duration_minutes ? ' is-invalid' : ''}`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <FieldError error={error} field="duration_minutes" />
          </div>
        </div>

        <PractitionerSelect
          value={practitioner}
          onChange={setPractitioner}
          directory={directory}
          idPrefix="appt"
          error={error}
        />

        <div className="ax-field">
          <label className="ax-label" htmlFor="appt-reason">Motif (note de guichet)</label>
          <input
            id="appt-reason"
            type="text"
            className="ax-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
            placeholder="Ex. : suivi, renouvellement, résultat d'analyse…"
          />
          <span className="ax-field__message">
            Note visible de toute l&apos;équipe — jamais de contenu médical ici.
          </span>
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── edit / move modal (statut « prévu » uniquement) ── */

function EditAppointmentModal({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSaved: (fresh: AppointmentWithOverlaps) => void;
}) {
  const { centerId } = useCenter();
  const directory = usePractitioners();
  const [scheduledAt, setScheduledAt] = useState(isoToLocalInput(appointment.scheduled_at));
  const [duration, setDuration] = useState(String(appointment.duration_minutes));
  const [practitioner, setPractitioner] = useState<number | null>(appointment.practitioner);
  const [reason, setReason] = useState(appointment.reason);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    if (!scheduledAt) return;
    setSaving(true);
    setError(null);
    try {
      const fresh = await updateAppointment(centerId, appointment.id, {
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: Number.parseInt(duration, 10) || appointment.duration_minutes,
        practitioner,
        reason: reason.trim(),
      });
      onSaved(fresh);
    } catch (err) {
      setError(toApiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Déplacer ou modifier — ${appointment.patient_name}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button
            type="submit"
            form="appt-edit-form"
            className="ax-btn ax-btn--primary"
            disabled={saving || !scheduledAt}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        id="appt-edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}

        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
          Un déplacement ré-arme le rappel SMS de la veille.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="appt-e-when">
              Date et heure <span className="ax-field__required" aria-hidden="true">*</span>
            </label>
            <input
              id="appt-e-when"
              type="datetime-local"
              className={`ax-input${error?.fieldErrors.scheduled_at ? ' is-invalid' : ''}`}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              data-autofocus=""
            />
            <FieldError error={error} field="scheduled_at" />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="appt-e-duration">Durée (minutes)</label>
            <input
              id="appt-e-duration"
              type="number"
              min={5}
              max={480}
              step={5}
              className={`ax-input${error?.fieldErrors.duration_minutes ? ' is-invalid' : ''}`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <FieldError error={error} field="duration_minutes" />
          </div>
        </div>

        <PractitionerSelect
          value={practitioner}
          onChange={setPractitioner}
          directory={directory}
          idPrefix="appt-e"
          error={error}
        />

        <div className="ax-field">
          <label className="ax-label" htmlFor="appt-e-reason">Motif (note de guichet)</label>
          <input
            id="appt-e-reason"
            type="text"
            className="ax-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={255}
          />
          <FieldError error={error} field="reason" />
        </div>
      </form>
    </Modal>
  );
}

/* ── row actions (one click each, per the state machine) ── */

type RowAction = 'check-in' | 'honor' | 'no-show' | 'cancel';

const ROW_ACTIONS: Record<AppointmentStatus, RowAction[]> = {
  prevu: ['check-in', 'no-show', 'cancel'],
  arrive: ['honor', 'cancel'],
  honore: [],
  manque: [],
  annule: [],
};

const ACTION_LABELS: Record<RowAction, string> = {
  'check-in': 'Arrivé',
  honor: 'Honoré',
  'no-show': 'Manqué',
  cancel: 'Annuler',
};

/** Accessible name per action — the visible label alone is ambiguous read out
 *  of its table row. */
function actionAria(action: RowAction, patientName: string): string {
  switch (action) {
    case 'check-in':
      return `Pointer l'arrivée de ${patientName}`;
    case 'honor':
      return `Marquer honoré le rendez-vous de ${patientName}`;
    case 'no-show':
      return `Marquer manqué le rendez-vous de ${patientName}`;
    case 'cancel':
      return `Annuler le rendez-vous de ${patientName}`;
  }
}

/** `manque` and `annule` are terminal states : one mis-click next to
 *  « Arrivé » would be irreversible, so these two (and ONLY these two —
 *  never the daily-flow check-in/honor) ask for confirmation. */
const CONFIRMED_ACTIONS: RowAction[] = ['no-show', 'cancel'];

function ConfirmRowActionModal({
  appointment,
  action,
  onConfirm,
  onClose,
}: {
  appointment: Appointment;
  action: 'no-show' | 'cancel';
  onConfirm: () => void;
  onClose: () => void;
}) {
  const name = appointment.patient_name || `Patient n° ${appointment.patient}`;
  const time = formatTime(appointment.scheduled_at);
  const isCancel = action === 'cancel';
  return (
    <Modal
      title={isCancel ? 'Annuler le rendez-vous ?' : 'Marquer le rendez-vous comme manqué ?'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} data-autofocus="">
            {isCancel ? 'Garder le rendez-vous' : 'Retour'}
          </button>
          <button type="button" className="ax-btn ax-btn--soft-danger" onClick={onConfirm}>
            <span className="ax-btn__label">{isCancel ? 'Annuler le rendez-vous' : 'Marquer manqué'}</span>
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>
        {isCancel
          ? `Le rendez-vous de ${name} (${time}) sera annulé. C'est définitif : pour reprogrammer, créez un nouveau rendez-vous.`
          : `Le rendez-vous de ${name} (${time}) sera marqué « Manqué ». Ce constat est définitif — si la personne se présente finalement, créez un nouveau rendez-vous.`}
      </p>
    </Modal>
  );
}

/* ── screen ── */

export function Appointments() {
  const { centerId } = useCenter();
  const [date, setDate] = useState(todayIsoDate());
  /** « File du jour » (pointage, vue par défaut) ou « Calendrier » (grille
   *  mois). L'état de date est PARTAGÉ : choisir un jour dans la grille
   *  ramène la file du jour sur ce jour. */
  const [mode, setMode] = useState<'jour' | 'calendrier'>('jour');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [practitionerFilter, setPractitionerFilter] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  /** Date pré-remplie du modal de création (null = fermé) — le bouton
   *  d'en-tête propose le jour affiché, la grille propose le jour cliqué. */
  const [createFor, setCreateFor] = useState<string | null>(null);
  /** Incrémenté après une création : la grille calendrier se recharge. */
  const [calReload, setCalReload] = useState(0);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [confirming, setConfirming] = useState<{ appointment: Appointment; action: 'no-show' | 'cancel' } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  /** Rows refreshed in place after a one-click action — the whole table is
   *  NOT re-fetched, so the desk keeps its scroll position and its context
   *  during the morning rush. Cleared whenever a real fetch lands. */
  const [freshRows, setFreshRows] = useState<Record<number, Appointment>>({});

  const directory = usePractitioners();

  const list = useAsync(
    () =>
      listAppointments(centerId, {
        date,
        page,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(practitionerFilter !== '' ? { practitioner: practitionerFilter } : {}),
      }),
    [centerId, date, page, statusFilter, practitionerFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [centerId, date, statusFilter, practitionerFilter]);

  useEffect(() => {
    setFreshRows({});
  }, [list.data]);

  const rows = (list.data?.results ?? []).map((a) => freshRows[a.id] ?? a);
  const isToday = date === todayIsoDate();

  const runAction = async (appointment: Appointment, action: RowAction) => {
    setBusyRow(appointment.id);
    setActionError(null);
    const fn = {
      'check-in': checkInAppointment,
      honor: honorAppointment,
      'no-show': noShowAppointment,
      cancel: cancelAppointment,
    }[action];
    try {
      const fresh = await fn(centerId, appointment.id);
      if (statusFilter) {
        // The row may leave the current filter — stay honest, re-fetch.
        list.reload();
      } else {
        setFreshRows((m) => ({ ...m, [appointment.id]: fresh }));
      }
    } catch (err) {
      setActionError(toApiError(err));
    } finally {
      setBusyRow(null);
    }
  };

  const filters = useMemo(
    () => (
      <div
        className="ax-cluster"
        style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
      >
        {/* Day navigation */}
        <div className="ax-field" style={{ marginBottom: 0 }}>
          <label className="ax-label" htmlFor="appt-date">Jour</label>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', flexWrap: 'nowrap' }}>
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon"
              onClick={() => setDate((d) => shiftIsoDate(d, -1))}
              aria-label="Jour précédent"
            >
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
            </button>
            <input
              id="appt-date"
              type="date"
              className="ax-input"
              style={{ width: 170 }}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon"
              onClick={() => setDate((d) => shiftIsoDate(d, 1))}
              aria-label="Jour suivant"
            >
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
            </button>
            {!isToday && (
              <button
                type="button"
                className="ax-btn ax-btn--ghost ax-btn--sm"
                onClick={() => setDate(todayIsoDate())}
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>
        </div>

        <div className="ax-field" style={{ marginBottom: 0 }}>
          <label className="ax-label" htmlFor="appt-f-practitioner">Praticien</label>
          <select
            id="appt-f-practitioner"
            className="ax-select"
            style={{ minWidth: 180 }}
            value={practitionerFilter === '' ? '' : String(practitionerFilter)}
            onChange={(e) =>
              setPractitionerFilter(e.target.value === '' ? '' : Number.parseInt(e.target.value, 10))
            }
          >
            <option value="">Tous les praticiens</option>
            {directory.options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {STAFF_ROLE_LABELS[p.role]}
              </option>
            ))}
          </select>
        </div>

        <div className="ax-field" style={{ marginBottom: 0 }}>
          <label className="ax-label" htmlFor="appt-f-status">Statut</label>
          <select
            id="appt-f-status"
            className="ax-select"
            style={{ minWidth: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
          >
            <option value="">Tous</option>
            {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]).map((s) => (
              <option key={s} value={s}>
                {APPOINTMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
    ),
    [date, isToday, statusFilter, practitionerFilter, directory.options],
  );

  return (
    <>
      <PageHead
        title="Rendez-vous"
        subtitle={
          mode === 'jour'
            ? `File du ${formatWeekdayDate(date)}`
            : 'Vue calendrier — cliquez un jour pour ouvrir sa file'
        }
        actions={
          <>
            <div className="ax-segment" role="radiogroup" aria-label="Mode d'affichage">
              <button
                type="button"
                className={`ax-segment__option${mode === 'jour' ? ' is-active' : ''}`}
                role="radio"
                aria-checked={mode === 'jour'}
                onClick={() => setMode('jour')}
              >
                File du jour
              </button>
              <button
                type="button"
                className={`ax-segment__option${mode === 'calendrier' ? ' is-active' : ''}`}
                role="radio"
                aria-checked={mode === 'calendrier'}
                onClick={() => setMode('calendrier')}
              >
                Calendrier
              </button>
            </div>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateFor(date)}>
              <IconPlus />
              <span className="ax-btn__label">Nouveau rendez-vous</span>
            </button>
          </>
        }
      />

      {warning && (
        <div className="ax-alert ax-alert--warning" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <div className="ax-alert__content">
            <p className="ax-alert__message">{warning}</p>
          </div>
          <div className="ax-alert__actions">
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--icon" onClick={() => setWarning(null)} aria-label="Fermer l'avertissement">
              <IconClose />
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div style={{ marginBottom: 'var(--ax-space-5)' }}>
          <ErrorAlert error={actionError} />
        </div>
      )}

      {mode === 'calendrier' && (
        <AppointmentsCalendar
          selectedDate={date}
          reloadKey={calReload}
          onPickDay={(picked) => {
            setDate(picked);
            setMode('jour');
          }}
          onCreate={(picked) => setCreateFor(picked)}
        />
      )}

      {mode === 'jour' && (
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="File du jour">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            {filters}
          </div>

          {list.loading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : list.error ? (
            <div style={{ padding: 'var(--ax-space-4)' }}>
              <ErrorAlert error={list.error} onRetry={list.reload} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="Aucun rendez-vous ce jour"
              message={
                statusFilter || practitionerFilter !== ''
                  ? 'Aucun rendez-vous ne correspond à ces filtres pour cette journée.'
                  : 'La journée est libre pour l’instant — créez le premier rendez-vous.'
              }
              action={
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setCreateFor(date)}>
                  <IconPlus />
                  <span className="ax-btn__label">Nouveau rendez-vous</span>
                </button>
              }
            />
          ) : (
            <>
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Heure</th>
                      <th className="ax-table__th" scope="col">Patient</th>
                      <th className="ax-table__th" scope="col">Praticien</th>
                      <th className="ax-table__th" scope="col">Motif</th>
                      <th className="ax-table__th" scope="col">Statut</th>
                      <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className="ax-table__row" style={a.status === 'annule' ? { opacity: 0.55 } : undefined}>
                        <td className="ax-table__td" style={{ whiteSpace: 'nowrap' }}>
                          <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>
                            {formatTime(a.scheduled_at)}
                          </b>
                          <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
                            {a.duration_minutes} min · fin {formatTime(a.end_at)}
                          </span>
                        </td>
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <AvatarChip name={a.patient_name || `Patient n° ${a.patient}`} seed={a.patient} />
                            <Link href={`/centre/patients/${a.patient}`} className="ax-link" style={{ fontWeight: 500 }}>
                              {a.patient_name || `Patient n° ${a.patient}`}
                            </Link>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: a.practitioner_name ? 'var(--ax-text)' : 'var(--ax-text-subtle)' }}>
                          {a.practitioner_name ?? 'Avec le centre'}
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.reason || '—'}
                        </td>
                        <td className="ax-table__td">
                          <StatusBadge tone={APPOINTMENT_TONES[a.status]} label={APPOINTMENT_STATUS_LABELS[a.status]} />
                        </td>
                        <td className="ax-table__td" style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            {ROW_ACTIONS[a.status].map((action) => (
                              <button
                                key={action}
                                type="button"
                                className={`ax-btn ax-btn--sm ${action === 'check-in' || action === 'honor' ? 'ax-btn--primary' : 'ax-btn--ghost'}`}
                                onClick={() =>
                                  CONFIRMED_ACTIONS.includes(action)
                                    ? setConfirming({ appointment: a, action: action as 'no-show' | 'cancel' })
                                    : void runAction(a, action)
                                }
                                disabled={busyRow === a.id}
                                aria-label={actionAria(action, a.patient_name || `Patient n° ${a.patient}`)}
                              >
                                {(action === 'check-in' || action === 'honor') && <IconCheck />}
                                <span className="ax-btn__label">{ACTION_LABELS[action]}</span>
                              </button>
                            ))}
                            {a.status === 'prevu' && (
                              <button
                                type="button"
                                className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--icon"
                                onClick={() => setEditing(a)}
                                disabled={busyRow === a.id}
                                aria-label={`Déplacer ou modifier le rendez-vous de ${a.patient_name}`}
                              >
                                <IconEdit />
                              </button>
                            )}
                          </div>
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
      </div>
      )}

      {createFor !== null && (
        <CreateAppointmentModal
          defaultDate={createFor}
          onClose={() => setCreateFor(null)}
          onCreated={(fresh) => {
            setCreateFor(null);
            setWarning(overlapMessage(fresh.overlaps));
            list.reload();
            setCalReload((k) => k + 1);
          }}
        />
      )}
      {editing && (
        <EditAppointmentModal
          appointment={editing}
          onClose={() => setEditing(null)}
          onSaved={(fresh) => {
            setEditing(null);
            setWarning(overlapMessage(fresh.overlaps));
            list.reload();
          }}
        />
      )}
      {confirming && (
        <ConfirmRowActionModal
          appointment={confirming.appointment}
          action={confirming.action}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            const c = confirming;
            setConfirming(null);
            void runAction(c.appointment, c.action);
          }}
        />
      )}
    </>
  );
}

export default Appointments;
