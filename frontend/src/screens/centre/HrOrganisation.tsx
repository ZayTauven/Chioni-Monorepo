'use client';
/*
 * Chioni — l'organisation du centre : services, fonctions, jours fériés
 * (S7, ADR 0020 décisions 2 et 5). Lecture ouverte à tout le staff côté API,
 * ÉCRITURE réservée au directeur — et cet écran n'est monté que pour lui.
 *
 * Deux assets Vireo :
 * - le donut « By Department » de `dashboards/Hr.tsx` (l. 175-207) donne sa
 *   liste-légende `ax-list--compact` à pastille colorée : ici les services et
 *   les fonctions se lisent de la même façon. Le donut LUI-MÊME n'est pas
 *   repris : un camembert des effectifs par service est un graphique de
 *   pilotage, et le seul endpoint de statistiques RH du sprint porte sur les
 *   présences — dessiner un donut aurait demandé d'inventer ses parts ;
 * - l'app `apps/Calendar.tsx` fournit la grille mensuelle des jours fériés,
 *   dont la catégorie `holiday` existait déjà dans le template (l. 55). Le
 *   chemin était balisé par `AppointmentsCalendar.tsx` : mêmes classes
 *   `ax-cal-*` (styles/centre.css), mêmes helpers de grille.
 *
 * **Une fonction n'est pas un droit** (décision 2) : c'est la phrase que cet
 * écran doit dire le plus fort. Confondre les deux créerait un second système
 * de permissions à côté du premier — et c'est ainsi qu'un jour quelqu'un lit
 * un dossier médical parce que sa fiche de poste dit « soignant ».
 */
import { useMemo, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import {
  createDepartment,
  createHoliday,
  createJobTitle,
  deleteHoliday,
  listDepartments,
  listHolidays,
  listJobTitles,
  updateDepartment,
  updateJobTitle,
} from '@/lib/endpoints/hrm';
import {
  HRM_HOLIDAY_DELETE_WARNING,
  HRM_JOB_TITLE_NO_RIGHTS,
  HRM_NO_DEPARTMENT_MESSAGE,
  HRM_NO_HOLIDAY_MESSAGE,
  HRM_NO_JOB_TITLE_MESSAGE,
  WEEKDAY_SHORT_NAMES,
  formatDate,
  formatMonthYear,
  formatWeekdayDate,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { Holiday } from '@/lib/types';
import type { ApiError } from '@/lib/api';
import {
  CardSkeleton,
  ErrorAlert,
  FieldError,
  IconEdit,
  IconPlus,
  IconTrash,
  Modal,
  StatusBadge,
  toApiError,
  useAsync,
} from './shared';

/* ── grille du mois (helpers identiques à AppointmentsCalendar) ── */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return shiftIsoDate(isoDate, -((d.getDay() + 6) % 7));
}

function shiftMonth(ym: string, delta: number): string {
  const d = new Date(`${ym}-15T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return isoOf(d).slice(0, 7);
}

interface GridCell {
  date: string;
  day: number;
  inMonth: boolean;
}

function monthGrid(ym: string): { cells: GridCell[]; from: string; to: string } {
  const first = `${ym}-01`;
  const lastDate = new Date(`${first}T12:00:00`);
  lastDate.setMonth(lastDate.getMonth() + 1);
  lastDate.setDate(0);
  const from = mondayOf(first);
  const to = shiftIsoDate(mondayOf(isoOf(lastDate)), 6);
  const cells: GridCell[] = [];
  for (let d = from; cells.length < 42 && d <= to; d = shiftIsoDate(d, 1)) {
    cells.push({ date: d, day: Number.parseInt(d.slice(8), 10), inMonth: d.slice(0, 7) === ym });
  }
  return { cells, from, to };
}

/* ── modale « un nom » (création et renommage d'un libellé) ── */

function NameModal({
  title,
  label,
  initial = '',
  hint,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initial?: string;
  hint?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={busy}
      width={460}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="submit"
            form="org-name-form"
            className="ax-btn ax-btn--primary"
            disabled={busy || name.trim() === ''}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form
        id="org-name-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}
      >
        {error && error.messages.length > 0 && <ErrorAlert error={error} />}
        <div className="ax-field">
          <label className="ax-label" htmlFor="org-name">
            {label}{' '}
            <span className="ax-field__required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="org-name"
            type="text"
            className={`ax-input${error?.fieldErrors.name ? ' is-invalid' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            required
            autoComplete="off"
            data-autofocus=""
          />
          {hint && <span className="ax-field__message">{hint}</span>}
          <FieldError error={error} field="name" />
        </div>
      </form>
    </Modal>
  );
}

/* ── carte d'un référentiel de libellés (services / fonctions) ── */

interface LabelRow {
  id: number;
  name: string;
  is_active: boolean;
}

function LabelListCard({
  title,
  subtitle,
  addLabel,
  fieldLabel,
  emptyMessage,
  hint,
  rows,
  loading,
  error,
  onRetry,
  onCreate,
  onRename,
  onToggle,
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  fieldLabel: string;
  emptyMessage: string;
  hint?: string;
  rows: LabelRow[];
  loading: boolean;
  error: ApiError | null;
  onRetry: () => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (row: LabelRow, name: string) => Promise<void>;
  onToggle: (row: LabelRow) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<LabelRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<ApiError | null>(null);

  const toggle = async (row: LabelRow) => {
    setBusyId(row.id);
    setToggleError(null);
    try {
      await onToggle(row);
    } catch (err) {
      setToggleError(toApiError(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="ax-card ax-col--6" role="region" aria-label={title}>
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title">{title}</h2>
            <p className="ax-card__subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="ax-btn ax-btn--secondary ax-btn--sm"
            onClick={() => setAdding(true)}
          >
            <IconPlus />
            <span className="ax-btn__label">{addLabel}</span>
          </button>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          {toggleError && (
            <div style={{ marginBottom: 'var(--ax-space-3)' }}>
              <ErrorAlert error={toggleError} />
            </div>
          )}
          {loading ? (
            <CardSkeleton lines={3} />
          ) : error ? (
            <ErrorAlert error={error} onRetry={onRetry} />
          ) : rows.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--ax-text-sm)',
                color: 'var(--ax-text-muted)',
                lineHeight: 1.7,
              }}
            >
              {emptyMessage}
            </p>
          ) : (
            <ul className="ax-list ax-list--compact" aria-label={title}>
              {rows.map((row) => (
                <li key={row.id} className="ax-list__row">
                  <span className="ax-list__content">
                    <span
                      className="ax-list__title"
                      style={{ color: row.is_active ? 'var(--ax-text-strong)' : 'var(--ax-text-muted)' }}
                    >
                      {row.name}
                    </span>
                  </span>
                  <span
                    className="ax-list__trailing"
                    style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}
                  >
                    {!row.is_active && <StatusBadge tone="neutral" label="Retiré" />}
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--sm"
                      onClick={() => setRenaming(row)}
                    >
                      <IconEdit />
                      <span className="ax-btn__label">Renommer</span>
                    </button>
                    {/* On ne SUPPRIME pas un libellé : des dossiers y pendent,
                        et les faire pointer dans le vide effacerait de
                        l'histoire. On le retire de la liste des choix. */}
                    <button
                      type="button"
                      className="ax-btn ax-btn--ghost ax-btn--sm"
                      onClick={() => void toggle(row)}
                      disabled={busyId === row.id}
                    >
                      <span className="ax-btn__label">
                        {/* « … » seul n'est annoncé par aucun lecteur d'écran
                            et ne dit rien à personne. */}
                        {busyId === row.id ? 'En cours…' : row.is_active ? 'Retirer' : 'Remettre'}
                      </span>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {adding && (
        <NameModal
          title={addLabel}
          label={fieldLabel}
          hint={hint}
          onClose={() => setAdding(false)}
          onSubmit={async (name) => {
            await onCreate(name);
            setAdding(false);
          }}
        />
      )}

      {renaming && (
        <NameModal
          title={`Renommer « ${renaming.name} »`}
          label={fieldLabel}
          initial={renaming.name}
          hint={hint}
          onClose={() => setRenaming(null)}
          onSubmit={async (name) => {
            await onRename(renaming, name);
            setRenaming(null);
          }}
        />
      )}
    </>
  );
}

/* ── jours fériés ── */

function HolidayCalendar() {
  const { centerId } = useCenter();
  const today = todayIsoDate();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const grid = useMemo(() => monthGrid(month), [month]);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Holiday | null>(null);

  const holidays = useAsync(
    () => listHolidays(centerId, { from: grid.from, to: grid.to }),
    [centerId, grid.from, grid.to],
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays.data ?? []) map.set(h.date, h);
    return map;
  }, [holidays.data]);

  const chevron = (path: string) => (
    <svg
      className="ax-btn__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );

  const monthHolidays = (holidays.data ?? []).filter((h) => h.date.slice(0, 7) === month);

  return (
    <>
      <section className="ax-card ax-col--12" role="region" aria-label="Jours fériés du centre">
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-card__titles">
            <h2 className="ax-card__title">Jours fériés</h2>
            <p className="ax-card__subtitle">
              Le calendrier appartient à votre centre : une clinique peut très bien travailler un
              jour férié national.
            </p>
          </div>
          <div className="ax-cluster" style={{ gap: 2 }}>
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Mois précédent"
            >
              {chevron('M15 6l-6 6l6 6')}
            </button>
            {month !== today.slice(0, 7) && (
              <button
                type="button"
                className="ax-btn ax-btn--secondary ax-btn--sm"
                onClick={() => setMonth(today.slice(0, 7))}
              >
                Ce mois-ci
              </button>
            )}
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              aria-label="Mois suivant"
            >
              {chevron('M9 6l6 6l-6 6')}
            </button>
            <span
              className="ax-card__title"
              style={{ marginInlineStart: 'var(--ax-space-3)', textTransform: 'capitalize' }}
            >
              {formatMonthYear(`${month}-01`)}
            </span>
          </div>
        </div>

        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          {holidays.loading ? (
            <CardSkeleton lines={6} />
          ) : holidays.error ? (
            <ErrorAlert error={holidays.error} onRetry={holidays.reload} />
          ) : (
            <>
              {monthHolidays.length === 0 && (
                <p
                  style={{
                    margin: '0 0 var(--ax-space-3)',
                    fontSize: 'var(--ax-text-sm)',
                    color: 'var(--ax-text-muted)',
                    lineHeight: 1.7,
                  }}
                >
                  {HRM_NO_HOLIDAY_MESSAGE}
                </p>
              )}
              <p
                style={{
                  margin: '0 0 var(--ax-space-3)',
                  fontSize: 'var(--ax-text-xs)',
                  color: 'var(--ax-text-muted)',
                }}
              >
                Choisissez un jour dans la grille pour le déclarer férié.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 640 }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
                      border: '1px solid var(--ax-border)',
                      borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) 0 0',
                      overflow: 'hidden',
                    }}
                  >
                    {WEEKDAY_SHORT_NAMES.map((d, i) => (
                      <div
                        key={d}
                        style={{
                          padding: 'var(--ax-space-2) var(--ax-space-3)',
                          fontSize: 'var(--ax-text-2xs)',
                          fontWeight: 'var(--ax-weight-semibold)',
                          letterSpacing: '.04em',
                          textTransform: 'uppercase',
                          color: 'var(--ax-text-muted)',
                          textAlign: 'center',
                          background: 'var(--ax-surface-subtle)',
                          ...(i < 6 ? { borderInlineEnd: '1px solid var(--ax-border)' } : {}),
                        }}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
                      borderInline: '1px solid var(--ax-border)',
                      borderBlockEnd: '1px solid var(--ax-border)',
                      borderRadius: '0 0 var(--ax-radius-md) var(--ax-radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    {grid.cells.map((cell) => {
                      const holiday = byDate.get(cell.date);
                      const isToday = cell.date === today;
                      return (
                        <div
                          key={cell.date}
                          className={`ax-cal-cell${isToday ? ' ax-cal-cell--today' : ''}`}
                          style={{ minHeight: 84 }}
                        >
                          <span className="ax-cal-cell__top">
                            {/* Un jour DÉJÀ férié n'est plus une porte vers
                                « déclarer férié » : l'unicité (centre, date)
                                renvoyait un 400 pour un geste que rien ne
                                distinguait à l'œil du geste utile. */}
                            {holiday ? (
                              <span
                                className={`ax-cal-cell__n ax-num${!cell.inMonth ? ' ax-cal-cell__n--muted' : ''}${isToday ? ' ax-cal-cell__n--today' : ''}`}
                              >
                                {cell.day}
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={`ax-cal-cell__n ax-num${!cell.inMonth ? ' ax-cal-cell__n--muted' : ''}${isToday ? ' ax-cal-cell__n--today' : ''}`}
                                onClick={() => setAddingFor(cell.date)}
                                aria-label={`Déclarer férié le ${formatWeekdayDate(cell.date)}`}
                              >
                                {cell.day}
                              </button>
                            )}
                            {!holiday && (
                              <button
                                type="button"
                                className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm ax-cal-cell__add"
                                onClick={() => setAddingFor(cell.date)}
                                aria-label={`Déclarer férié le ${formatWeekdayDate(cell.date)}`}
                              >
                                <IconPlus />
                              </button>
                            )}
                          </span>
                          {holiday && (
                            <span
                              className="ax-cal-event"
                              style={{
                                ['--c' as string]: 'var(--ax-accent)',
                                ['--c-ink' as string]: 'var(--ax-accent)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span className="ax-truncate" style={{ flex: '1 1 auto' }}>
                                {holiday.name}
                              </span>
                              <button
                                type="button"
                                className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
                                onClick={() => setDeleting(holiday)}
                                aria-label={`Retirer le jour férié « ${holiday.name} »`}
                              >
                                <IconTrash />
                              </button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {addingFor && (
        <NameModal
          title={`Jour férié du ${formatWeekdayDate(addingFor)}`}
          label="Nom du jour férié"
          hint="Par exemple « Fête de l’Indépendance » ou « Aïd el-Fitr »."
          onClose={() => setAddingFor(null)}
          onSubmit={async (name) => {
            await createHoliday(centerId, { date: addingFor, name });
            setAddingFor(null);
            holidays.reload();
          }}
        />
      )}

      {deleting && (
        <DeleteHolidayModal
          holiday={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            holidays.reload();
          }}
        />
      )}
    </>
  );
}

function DeleteHolidayModal({
  holiday,
  onClose,
  onDeleted,
}: {
  holiday: Holiday;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { centerId } = useCenter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteHoliday(centerId, holiday.id);
      onDeleted();
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Retirer ce jour férié"
      onClose={onClose}
      busy={busy}
      width={460}
      footer={
        <>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            className="ax-btn ax-btn--secondary"
            onClick={() => void submit()}
            disabled={busy}
          >
            <IconTrash />
            <span className="ax-btn__label">{busy ? 'Suppression…' : 'Retirer'}</span>
          </button>
        </>
      }
    >
      {error && <ErrorAlert error={error} />}
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
        « {holiday.name} », le {formatDate(holiday.date)}.
      </p>
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
        {HRM_HOLIDAY_DELETE_WARNING}
      </p>
    </Modal>
  );
}

/* ── écran ── */

export function HrOrganisation() {
  const { centerId } = useCenter();
  const departments = useAsync(() => listDepartments(centerId), [centerId]);
  const jobTitles = useAsync(() => listJobTitles(centerId), [centerId]);

  return (
    <>
      <div className="ax-col--12">
        <div className="ax-alert ax-alert--info" role="note">
          <div className="ax-alert__content">
            <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
              {HRM_JOB_TITLE_NO_RIGHTS}
            </p>
          </div>
        </div>
      </div>

      <LabelListCard
        title="Services"
        subtitle="Les unités de votre centre — Maternité, Laboratoire, Accueil."
        addLabel="Ajouter un service"
        fieldLabel="Nom du service"
        emptyMessage={HRM_NO_DEPARTMENT_MESSAGE}
        rows={departments.data ?? []}
        loading={departments.loading}
        error={departments.error}
        onRetry={departments.reload}
        onCreate={async (name) => {
          await createDepartment(centerId, name);
          departments.reload();
        }}
        onRename={async (row, name) => {
          await updateDepartment(centerId, row.id, { name });
          departments.reload();
        }}
        onToggle={async (row) => {
          await updateDepartment(centerId, row.id, { is_active: !row.is_active });
          departments.reload();
        }}
      />

      <LabelListCard
        title="Fonctions"
        subtitle="Les intitulés de poste — ils n’ouvrent aucun droit."
        addLabel="Ajouter une fonction"
        fieldLabel="Nom de la fonction"
        emptyMessage={HRM_NO_JOB_TITLE_MESSAGE}
        hint="Un intitulé de poste. Les accès, eux, se règlent dans « Personnel »."
        rows={jobTitles.data ?? []}
        loading={jobTitles.loading}
        error={jobTitles.error}
        onRetry={jobTitles.reload}
        onCreate={async (name) => {
          await createJobTitle(centerId, name);
          jobTitles.reload();
        }}
        onRename={async (row, name) => {
          await updateJobTitle(centerId, row.id, { name });
          jobTitles.reload();
        }}
        onToggle={async (row) => {
          await updateJobTitle(centerId, row.id, { is_active: !row.is_active });
          jobTitles.reload();
        }}
      />

      <HolidayCalendar />
    </>
  );
}

export default HrOrganisation;
