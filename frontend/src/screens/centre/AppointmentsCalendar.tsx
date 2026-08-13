'use client';
/*
 * Chioni — /centre/rendez-vous : vue « Calendrier » (grille mois).
 *
 * Adaptation de l'app Calendar du template Vireo
 * (vireo template/src/screens/apps/Calendar.tsx) : grille mensuelle à
 * cellules cliquables, pastilles d'événements, navigation mois — mêmes
 * classes ax-cal-* (déplacées dans styles/centre.css), branchées sur les
 * données réelles :
 *   – GET /centers/{c}/stats/activity/?from&to : UN appel couvre toute la
 *     grille (série zéro-remplie par jour et par statut) → chaque cellule
 *     affiche ses compteurs réels ;
 *   – le détail (heure + patient) est chargé pour TOUTE la plage visible via
 *     GET /appointments/?from&to (S1 — plage max 62 jours, paginée) en
 *     enchaînant les pages jusqu'à épuisement ou plafond (voir
 *     CAL_DETAIL_MAX_PAGES). En cas de troncature ou d'erreur réseau, les
 *     jours non couverts gardent leurs compteurs stats — l'UI le dit.
 *
 * Le fichier est chargé en dynamic import depuis Appointments.tsx : la file
 * du jour (vue par défaut de la secrétaire) ne paie pas le poids de la grille.
 */
import { useMemo, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import { getActivityStats, listAppointmentsRange } from '@/lib/endpoints/centers';
import {
  APPOINTMENT_STATUS_LABELS,
  WEEKDAY_SHORT_NAMES,
  appointmentCountLabel,
  formatMonthYear,
  formatTime,
  formatWeekdayDate,
  moreAppointmentsLabel,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { Appointment, AppointmentStatus } from '@/lib/types';
import { CardSkeleton, ErrorAlert, IconPlus, useAsync } from './shared';

/* ── status → colour (same recipe as the template pills : wash + border from
      the 500 stop, small bold time inked with the 700 stop for AA) ── */

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  prevu: 'var(--ax-info-500)',
  arrive: 'var(--ax-accent)',
  honore: 'var(--ax-success-500)',
  manque: 'var(--ax-danger-500)',
  annule: 'var(--ax-text-subtle)',
};
const STATUS_INK: Record<AppointmentStatus, string> = {
  prevu: 'var(--ax-info-700)',
  arrive: 'var(--ax-accent)',
  honore: 'var(--ax-success-700)',
  manque: 'var(--ax-danger-700)',
  annule: 'var(--ax-text-muted)',
};
const STATUS_ORDER: AppointmentStatus[] = ['prevu', 'arrive', 'honore', 'manque', 'annule'];

/** Pills shown per detailed cell before the « +N autres » overflow line. */
const MAX_PILLS = 3;

/**
 * Plafond de chargement du détail : 10 pages de 20 (200 rendez-vous) par
 * grille affichée (~42 jours). Au-delà — tri chronologique oblige — seuls les
 * premiers jours ont leur détail complet ; les jours non couverts gardent
 * leurs compteurs stats et le sous-titre le dit.
 */
const CAL_DETAIL_MAX_PAGES = 10;

/* ── date grid helpers (screen-local ; ISO strings compare lexicographically) ── */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Monday of the week containing `isoDate` (fr locale — week starts Monday). */
function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return shiftIsoDate(isoDate, -((d.getDay() + 6) % 7));
}

/** "YYYY-MM" shifted by ±n months. */
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

/** Full weeks covering the month: Monday before the 1st → Sunday after the last. */
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

function totalOf(counts: Record<AppointmentStatus, number>): number {
  return STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);
}

/* ── component ── */

export function AppointmentsCalendar({
  selectedDate,
  reloadKey,
  onPickDay,
  onCreate,
}: {
  /** Shared with the « File du jour » view — picking a day updates it. */
  selectedDate: string;
  /** Bumped by the parent after a creation → the grid re-fetches. */
  reloadKey: number;
  onPickDay: (date: string) => void;
  onCreate: (date: string) => void;
}) {
  const { centerId } = useCenter();
  const [month, setMonth] = useState(() => selectedDate.slice(0, 7));
  const today = todayIsoDate();
  const grid = useMemo(() => monthGrid(month), [month]);

  /* One call for the whole grid — real per-day counts by status. */
  const stats = useAsync(
    () => getActivityStats(centerId, { from: grid.from, to: grid.to }),
    [centerId, grid.from, grid.to, reloadKey],
  );

  const counts = useMemo(() => {
    const map = new Map<string, Record<AppointmentStatus, number>>();
    for (const day of stats.data?.days ?? []) map.set(day.date, day.appointments);
    return map;
  }, [stats.data]);

  /* Detail (time + patient) for the WHOLE visible grid — the S1 range endpoint
     (?from&to, paginated, chronological). Pages are chained until exhaustion
     or CAL_DETAIL_MAX_PAGES; on truncation or mid-chain failure the possibly
     incomplete last day is dropped so a partial detail is never shown as
     complete — those days fall back on their stats counters. */
  const details = useAsync<{ byDay: Map<string, Appointment[]>; partial: boolean }>(async () => {
    const byDay = new Map<string, Appointment[]>();
    let partial = false;
    try {
      let page = 1;
      for (;;) {
        const chunk = await listAppointmentsRange(centerId, { from: grid.from, to: grid.to, page });
        for (const a of chunk.results) {
          const day = isoOf(new Date(a.scheduled_at));
          const list = byDay.get(day);
          if (list) list.push(a);
          else byDay.set(day, [a]);
        }
        if (!chunk.next) break;
        if (page >= CAL_DETAIL_MAX_PAGES) {
          partial = true;
          break;
        }
        page += 1;
      }
    } catch {
      /* Repli honnête : les jours déjà chargés gardent leur détail, les autres
         leurs compteurs stats — jamais de données inventées. */
      partial = true;
    }
    if (partial) {
      let lastDay: string | null = null;
      for (const day of byDay.keys()) if (lastDay === null || day > lastDay) lastDay = day;
      if (lastDay !== null) byDay.delete(lastDay);
    }
    return { byDay, partial };
  }, [centerId, grid.from, grid.to, reloadKey]);

  const chevron = (path: string) => (
    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
  );

  return (
    <div className="ax-dash-grid">
      <section className="ax-card ax-col--12" role="region" aria-label="Calendrier des rendez-vous">
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'center' }}>
            <span className="ax-cluster" style={{ gap: 2 }}>
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
            </span>
            <h2 className="ax-card__title" style={{ margin: 0, textTransform: 'capitalize' }}>
              {formatMonthYear(`${month}-01`)}
            </h2>
          </div>
        </div>

        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          <p className="ax-card__subtitle" style={{ margin: '0 0 var(--ax-space-3)' }}>
            {details.data?.partial
              ? 'Mois très chargé : le détail (heure et patient) est affiché pour les premiers jours ; les autres indiquent le nombre de rendez-vous par statut. Cliquez un jour pour ouvrir sa file.'
              : 'Chaque jour affiche ses rendez-vous (heure et patient). Cliquez un jour pour ouvrir sa file.'}
          </p>

          {stats.loading && !stats.data ? (
            <CardSkeleton lines={6} />
          ) : stats.error ? (
            <ErrorAlert error={stats.error} onRetry={stats.reload} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) 0 0', overflow: 'hidden' }}>
                  {WEEKDAY_SHORT_NAMES.map((d, i) => (
                    <div
                      key={d}
                      style={{ padding: 'var(--ax-space-2) var(--ax-space-3)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ax-text-subtle)', textAlign: 'center', background: 'var(--ax-surface-subtle)', ...(i < 6 ? { borderInlineEnd: '1px solid var(--ax-border)' } : {}) }}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', borderInline: '1px solid var(--ax-border)', borderBlockEnd: '1px solid var(--ax-border)', borderRadius: '0 0 var(--ax-radius-md) var(--ax-radius-md)', overflow: 'hidden' }}>
                  {grid.cells.map((cell) => {
                    const dayCounts = counts.get(cell.date);
                    const total = dayCounts ? totalOf(dayCounts) : 0;
                    const detail = details.data?.byDay.get(cell.date);
                    const shown = detail ? Math.min(detail.length, MAX_PILLS) : 0;
                    const isToday = cell.date === today;
                    const isSelected = cell.date === selectedDate;
                    return (
                      <div
                        key={cell.date}
                        className={`ax-cal-cell${isToday ? ' ax-cal-cell--today' : ''}${isSelected ? ' ax-cal-cell--selected' : ''}`}
                        onClick={() => onPickDay(cell.date)}
                      >
                        <span className="ax-cal-cell__top">
                          <button
                            type="button"
                            className={`ax-cal-cell__n ax-num${!cell.inMonth ? ' ax-cal-cell__n--muted' : ''}${isToday ? ' ax-cal-cell__n--today' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onPickDay(cell.date);
                            }}
                            aria-label={`Ouvrir la file du ${formatWeekdayDate(cell.date)}`}
                            aria-current={isSelected ? 'date' : undefined}
                          >
                            {cell.day}
                          </button>
                          <button
                            type="button"
                            className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm ax-cal-cell__add"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreate(cell.date);
                            }}
                            aria-label={`Nouveau rendez-vous le ${formatWeekdayDate(cell.date)}`}
                          >
                            <IconPlus />
                          </button>
                        </span>
                        {detail ? (
                          <>
                            {detail.slice(0, MAX_PILLS).map((a) => {
                              const name = a.patient_name || `Patient n° ${a.patient}`;
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  className="ax-cal-event"
                                  style={{ ['--c' as string]: STATUS_COLOR[a.status], ['--c-ink' as string]: STATUS_INK[a.status] }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onPickDay(cell.date);
                                  }}
                                  title={`${formatTime(a.scheduled_at)} — ${name} · ${APPOINTMENT_STATUS_LABELS[a.status]}`}
                                  aria-label={`Rendez-vous de ${name} à ${formatTime(a.scheduled_at)} (${APPOINTMENT_STATUS_LABELS[a.status]}) — ouvrir la file du ${formatWeekdayDate(cell.date)}`}
                                >
                                  <b className="ax-num">{formatTime(a.scheduled_at)}</b> {name}
                                </button>
                              );
                            })}
                            {total > shown && <span className="ax-cal-more">{moreAppointmentsLabel(total - shown)}</span>}
                          </>
                        ) : total > 0 && dayCounts ? (
                          STATUS_ORDER.filter((s) => dayCounts[s] > 0).map((s) => (
                            <span key={s} className="ax-cal-count">
                              <i style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />
                              {appointmentCountLabel(s, dayCounts[s])}
                            </span>
                          ))
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default AppointmentsCalendar;
