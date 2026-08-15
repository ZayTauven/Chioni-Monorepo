'use client';
/*
 * Chioni — la feuille de présence (S7, ADR 0020 décision 3). DIRECTEUR SEUL.
 *
 * On numérise un registre PAPIER : une grille personnes × jours, une note par
 * journée, tenue par le responsable. Ce que l'écran ne construit pas, et ne
 * construira pas sans un arbitrage explicite : **aucune heure d'arrivée,
 * aucune heure de départ, aucune position**. Le modèle n'a pas ces champs ;
 * l'écran ne réserve donc aucune colonne pour eux (patron `Inpatient.tsx`).
 *
 * Assets Vireo repris et adaptés :
 * - `tables/DataTables.tsx` : le tableau dense (`ax-table--hover`, en-tête
 *   collant, barre d'outils au-dessus, pied de récapitulatif) — la première
 *   colonne devient une colonne GELÉE (nom de la personne) parce qu'une
 *   grille de 7 jours défile horizontalement sur un écran de centre ;
 * - `dashboards/Hr.tsx` : la sémantique de couleur des états de journée,
 *   reprise en tokens `--ax-*` mais **sans son rouge d'absence** (voir
 *   `ATTENDANCE_TONES` dans shared.tsx : une absence n'est pas un incident).
 *
 * Saisie : la cellule est un `<select>` natif. Ce n'est pas un pis-aller —
 * c'est ce qui rend la grille utilisable au clavier sans une ligne de code
 * (Tab entre les cellules, flèches pour changer la valeur, tout est annoncé
 * par un lecteur d'écran), et c'est aussi la cible tactile la plus fiable sur
 * un Android d'entrée de gamme. Chaque changement part immédiatement en
 * UPSERT : 201 à la création, 200 à la correction, jamais de doublon.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCenter } from '@/context/CenterContext';
import { listAttendance, listEmployments, recordAttendance } from '@/lib/endpoints/hrm';
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_UNSET_OPTION,
  HRM_ATTENDANCE_BULK_PARTIAL,
  HRM_ATTENDANCE_FILL_ACTION,
  HRM_ATTENDANCE_FILL_HINT,
  HRM_ATTENDANCE_FUTURE_HINT,
  HRM_ATTENDANCE_INTENT,
  HRM_ATTENDANCE_NO_CLOCK,
  HRM_ATTENDANCE_UPSERT_HINT,
  HRM_NO_EMPLOYMENT_DIRECTOR,
  HRM_NO_EMPLOYMENT_TITLE,
  WEEKDAY_SHORT_NAMES,
  formatWeekdayDate,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { AttendanceStatus, Employment } from '@/lib/types';
import type { ApiError } from '@/lib/api';
import {
  AvatarChip,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  IconCheck,
  TableSkeleton,
  toApiError,
  useAsync,
} from './shared';

/* ── fenêtre : une semaine, du lundi au dimanche ── */

const DAYS_IN_WINDOW = 7;

/** Lundi de la semaine contenant `isoDate` (semaine française). */
function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return shiftIsoDate(isoDate, -((d.getDay() + 6) % 7));
}

function weekDays(monday: string): string[] {
  return Array.from({ length: DAYS_IN_WINDOW }, (_, i) => shiftIsoDate(monday, i));
}

/**
 * Plafond de chargement : 10 pages de 20 lignes. Une semaine de 7 jours pour
 * ~28 personnes tient dedans ; au-delà, la grille le DIT plutôt que d'afficher
 * des cases vides qui feraient croire à des journées non notées.
 */
const SHEET_MAX_PAGES = 10;

const cellKey = (employment: number, date: string) => `${employment}:${date}`;

/* ── une personne est-elle employée ce jour-là ? ── */

function withinEmployment(employment: Employment, date: string): boolean {
  if (date < employment.hired_at) return false;
  if (employment.ended_at !== null && date > employment.ended_at) return false;
  return true;
}

/* ── écran ── */

export function HrAttendanceSheet() {
  const { centerId } = useCenter();
  const today = todayIsoDate();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [includeEnded, setIncludeEnded] = useState(false);

  const days = useMemo(() => weekDays(monday), [monday]);
  const from = days[0];
  const to = days[days.length - 1];

  const employments = useAsync(
    () => listEmployments(centerId, includeEnded ? {} : { running: true }),
    [centerId, includeEnded],
  );

  /* La feuille de la semaine, pages enchaînées jusqu'à épuisement ou plafond. */
  const sheet = useAsync<{ cells: Map<string, AttendanceStatus>; truncated: boolean }>(
    async () => {
      const cells = new Map<string, AttendanceStatus>();
      let page = 1;
      for (;;) {
        const chunk = await listAttendance(centerId, { from, to, page });
        for (const row of chunk.results) {
          cells.set(cellKey(row.employment, row.date), row.status);
        }
        if (!chunk.next) return { cells, truncated: false };
        if (page >= SHEET_MAX_PAGES) return { cells, truncated: true };
        page += 1;
      }
    },
    [centerId, from, to],
  );

  /* État local de saisie : la carte du serveur, patchée sur place à chaque
     enregistrement. Recharger la semaine entière après chaque clic ferait
     clignoter la grille et coûterait un aller-retour par case. */
  const [edits, setEdits] = useState<Map<string, AttendanceStatus>>(new Map());
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [bulkDay, setBulkDay] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkPartial, setBulkPartial] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    setEdits(new Map());
    setError(null);
    setBulkPartial(false);
    setNotice(null);
  }, [centerId, from]);

  const statusAt = (employmentId: number, date: string): AttendanceStatus | '' => {
    const key = cellKey(employmentId, date);
    return edits.get(key) ?? sheet.data?.cells.get(key) ?? '';
  };

  const write = useCallback(
    async (
      center: number,
      employmentId: number,
      date: string,
      status: AttendanceStatus,
    ) => {
      const key = cellKey(employmentId, date);
      setSavingKey(key);
      setError(null);
      try {
        const saved = await recordAttendance(center, {
          employment: employmentId,
          date,
          status,
        });
        setEdits((prev) => new Map(prev).set(key, saved.status));
      } catch (err) {
        /* Refus du backend (journée future, hors période d'emploi, gel de
           l'abonnement) : la case REVIENT à sa valeur d'avant et le message
           complet du serveur s'affiche tel quel. Laisser la case au nouvel état
           ferait croire à une note enregistrée qui n'existe pas. */
        setEdits((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        setError(toApiError(err));
      } finally {
        setSavingKey(null);
      }
    },
    [],
  );

  /**
   * **Une case, une file.** Les écritures d'une MÊME journée sont chaînées ;
   * celles de cases différentes partent en parallèle, comme avant.
   *
   * Sans ça : le responsable choisit « Présent », la requête part (le débit
   * comorien la fait durer), il se ravise une seconde plus tard et choisit
   * « Repos ». Deux requêtes volent alors sur la même (personne, date) et
   * **rien ne garantit leur ordre d'arrivée** — le verrou du backend sérialise
   * les transactions, pas les paquets HTTP. La journée pouvait rester stockée
   * sur « Présent » pendant que la grille, elle, affichait « Repos » : un
   * registre du personnel qui ment sur ce qu'il contient, et une personne
   * comptée absente un jour où sa direction l'avait notée présente. La chaîne
   * garantit que la dernière valeur CHOISIE est la dernière ÉCRITE, et que la
   * grille reflète la dernière réponse — donc la base.
   *
   * `savingKey` ne peut pas jouer ce rôle : il ne verrouille rien (désactiver
   * un `<select>` qui a le focus renverrait le focus au document, voir plus
   * bas), et deux écritures peuvent parfaitement se croiser sans lui.
   */
  const chains = useRef(new Map<string, Promise<void>>());

  const commit = useCallback(
    (employmentId: number, date: string, status: AttendanceStatus): Promise<void> => {
      const key = cellKey(employmentId, date);
      const previous = chains.current.get(key) ?? Promise.resolve();
      const run = previous.then(() => write(centerId, employmentId, date, status));
      chains.current.set(key, run);
      return run;
    },
    [centerId, write],
  );

  /**
   * **Enregistrement différé de 350 ms, vidé au premier départ du champ.**
   *
   * Un `<select>` fermé change de valeur à CHAQUE flèche du clavier, et émet
   * un `change` à chaque fois : passer de « Présent » à « Jour férié » au
   * clavier partait en quatre requêtes, dont trois notaient une journée que
   * personne n'avait voulu noter — quatre lignes d'audit, et surtout quatre
   * écritures concurrentes dont **rien ne garantissait l'ordre d'arrivée**.
   * La journée pouvait rester stockée sur une valeur intermédiaire.
   *
   * La grille reste instantanée (l'état local part tout de suite), seule la
   * requête attend ; et comme un clic ailleurs déclenche d'abord le `blur`,
   * la file est vide avant tout changement de semaine.
   */
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queued = useRef(new Map<string, AttendanceStatus>());

  const flush = useCallback(
    (employmentId: number, date: string) => {
      const key = cellKey(employmentId, date);
      const timer = timers.current.get(key);
      if (timer === undefined) return;
      clearTimeout(timer);
      timers.current.delete(key);
      const status = queued.current.get(key);
      queued.current.delete(key);
      if (status !== undefined) void commit(employmentId, date, status);
    },
    [commit],
  );

  const queueSave = (employmentId: number, date: string, status: AttendanceStatus) => {
    const key = cellKey(employmentId, date);
    setEdits((prev) => new Map(prev).set(key, status));
    setError(null);
    const existing = timers.current.get(key);
    if (existing !== undefined) clearTimeout(existing);
    queued.current.set(key, status);
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        queued.current.delete(key);
        void commit(employmentId, date, status);
      }, 350),
    );
  };

  /*
   * Une note en attente n'est jamais perdue : au démontage — ou au changement
   * de centre actif, dont c'est aussi la cleanup — on l'envoie.
   *
   * `centerId` est ici celui de l'effet qui se démonte, donc le centre où la
   * saisie a eu lieu : la note ne peut pas atterrir dans le centre suivant.
   * Et elle passe par la MÊME file que les écritures vivantes (`pending`),
   * sans quoi elle doublerait une requête encore en vol sur la même case.
   */
  useEffect(() => {
    const pendingTimers = timers.current;
    const pendingStatuses = queued.current;
    const pendingChains = chains.current;
    return () => {
      for (const timer of pendingTimers.values()) clearTimeout(timer);
      pendingTimers.clear();
      for (const [key, status] of pendingStatuses) {
        const [employmentId, date] = key.split(':');
        const previous = pendingChains.get(key) ?? Promise.resolve();
        void previous
          .then(() =>
            recordAttendance(centerId, {
              employment: Number.parseInt(employmentId, 10),
              date,
              status,
            }),
          )
          .catch(() => undefined);
      }
      pendingStatuses.clear();
      pendingChains.clear();
    };
  }, [centerId]);

  /**
   * « Tous présents » : note `present` sur les cases ENCORE VIDES de la
   * colonne, jamais sur celles déjà notées. La correction d'une note reste un
   * geste individuel et délibéré — un bouton qui réécrirait la colonne entière
   * effacerait une absence enregistrée en un clic.
   */
  const fillDay = async (date: string, rows: Employment[]) => {
    const targets = rows.filter(
      (row) =>
        withinEmployment(row, date) &&
        (edits.get(cellKey(row.id, date)) ?? sheet.data?.cells.get(cellKey(row.id, date)) ?? '') ===
          '',
    );
    setError(null);
    setBulkPartial(false);
    /* Colonne déjà complète : un clic sans effet visible se lit comme une
       panne. On le DIT, au lieu de laisser douter. */
    if (targets.length === 0) {
      setNotice(`${formatWeekdayDate(date)} est déjà entièrement notée : rien à compléter.`);
      return;
    }
    setNotice(null);
    setBulkDay(date);
    setBulkProgress({ done: 0, total: targets.length });
    const patched = new Map(edits);
    let done = 0;
    for (const row of targets) {
      try {
        const saved = await recordAttendance(centerId, {
          employment: row.id,
          date,
          status: 'present',
        });
        patched.set(cellKey(row.id, date), saved.status);
        done += 1;
        setBulkProgress({ done, total: targets.length });
      } catch (err) {
        setError(toApiError(err));
        /* Ce qui est passé reste passé : on le DIT, plutôt que de laisser
           deviner l'état de la colonne après un refus. */
        setBulkPartial(done > 0);
        break;
      }
    }
    setEdits(patched);
    setBulkDay(null);
    setBulkProgress(null);
  };

  const rows = employments.data ?? [];
  const loading = employments.loading || sheet.loading;
  const isCurrentWeek = monday === mondayOf(today);

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

  return (
    <section className="ax-card ax-col--12" role="region" aria-label="Feuille de présence">
      <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Feuille de présence</h2>
          <p className="ax-card__subtitle">{HRM_ATTENDANCE_INTENT}</p>
        </div>
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
            onClick={() => setMonday((m) => shiftIsoDate(m, -7))}
            aria-label="Semaine précédente"
          >
            {chevron('M15 6l-6 6l6 6')}
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              className="ax-btn ax-btn--secondary ax-btn--sm"
              onClick={() => setMonday(mondayOf(today))}
            >
              Cette semaine
            </button>
          )}
          <button
            type="button"
            className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm"
            onClick={() => setMonday((m) => shiftIsoDate(m, 7))}
            aria-label="Semaine suivante"
          >
            {chevron('M9 6l6 6l-6 6')}
          </button>
        </div>
      </div>

      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        <div
          className="ax-cluster"
          style={{
            justifyContent: 'space-between',
            gap: 'var(--ax-space-3)',
            flexWrap: 'wrap',
            marginBottom: 'var(--ax-space-3)',
          }}
        >
          <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
            Semaine du {formatWeekdayDate(from)} au {formatWeekdayDate(to)}
          </span>
          <label
            className="ax-cluster"
            style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              className="ax-checkbox"
              checked={includeEnded}
              onChange={(e) => setIncludeEnded(e.target.checked)}
            />
            <span style={{ color: 'var(--ax-text-muted)' }}>
              Afficher aussi les personnes parties
            </span>
          </label>
        </div>

        {/* La consigne est écrite, pas seulement infobullée : un `title` ne
            s'ouvre jamais au doigt sur un Android, et « Tous présents » est le
            seul bouton de l'écran qui écrit plusieurs lignes d'un coup.

            Quatre phrases enchaînées faisaient un pavé gris qu'on saute : la
            liste les sépare, et la ligne qui compte — celle du bouton de
            saisie groupée — est la dernière, donc la plus près de la grille. */}
        <ul
          style={{
            margin: '0 0 var(--ax-space-4)',
            paddingInlineStart: '1.1em',
            fontSize: 'var(--ax-text-sm)',
            color: 'var(--ax-text-muted)',
            lineHeight: 1.7,
          }}
        >
          <li>{HRM_ATTENDANCE_NO_CLOCK}</li>
          <li>{HRM_ATTENDANCE_UPSERT_HINT}</li>
          <li>{HRM_ATTENDANCE_FUTURE_HINT}</li>
          <li>
            <b style={{ fontWeight: 'var(--ax-weight-medium)' }}>
              « {HRM_ATTENDANCE_FILL_ACTION} »
            </b>{' '}
            : {HRM_ATTENDANCE_FILL_HINT}
          </li>
        </ul>

        {/* Le refus du serveur, rendu tel quel et RELIÉ au geste : la case est
            déjà revenue à sa valeur d'avant. */}
        {notice && (
          <div className="ax-alert ax-alert--info" role="status" style={{ marginBottom: 'var(--ax-space-4)' }}>
            <div className="ax-alert__content">
              <p className="ax-alert__message">{notice}</p>
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 'var(--ax-space-4)' }}>
            <ErrorAlert error={error} />
            {bulkPartial && (
              <p
                style={{
                  margin: 'var(--ax-space-2) 0 0',
                  fontSize: 'var(--ax-text-sm)',
                  color: 'var(--ax-text-muted)',
                  lineHeight: 1.7,
                }}
              >
                {HRM_ATTENDANCE_BULK_PARTIAL}
              </p>
            )}
          </div>
        )}

        {sheet.data?.truncated && (
          <div className="ax-alert ax-alert--info" role="status" style={{ marginBottom: 'var(--ax-space-4)' }}>
            <div className="ax-alert__content">
              <p className="ax-alert__message">
                Semaine très fournie : toutes les journées déjà notées n&rsquo;ont pas pu être
                chargées. Une case vide ne veut donc pas forcément dire « pas encore notée » —
                affichez moins de personnes ou consultez une semaine plus courte pour être sûr.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={5} cols={8} />
        ) : employments.error ? (
          <ErrorAlert error={employments.error} onRetry={employments.reload} />
        ) : sheet.error ? (
          <ErrorAlert error={sheet.error} onRetry={sheet.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title={HRM_NO_EMPLOYMENT_TITLE} message={HRM_NO_EMPLOYMENT_DIRECTOR} />
        ) : (
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover ax-sheet">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th ax-sheet__name" scope="col">
                    Personne
                  </th>
                  {days.map((day, i) => {
                    const future = day > today;
                    return (
                      <th
                        key={day}
                        className="ax-table__th"
                        scope="col"
                        style={{ textAlign: 'center', minWidth: 128 }}
                      >
                        {/* Les colonnes à venir étaient en `--ax-text-subtle`,
                            le seul token du design system encore sous AA : la
                            date d'une colonne PORTE du sens, elle ne peut pas
                            être le texte le plus pâle de l'écran. Le « à
                            venir » écrit dit ce que la couleur disait mal. */}
                        <span style={{ display: 'block', color: 'var(--ax-text-muted)' }}>
                          {WEEKDAY_SHORT_NAMES[i]} {day.slice(8)}
                        </span>
                        {future ? (
                          <span
                            style={{
                              display: 'block',
                              marginTop: 2,
                              fontSize: 'var(--ax-text-2xs)',
                              fontWeight: 400,
                              color: 'var(--ax-text-muted)',
                            }}
                          >
                            à venir
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="ax-btn ax-btn--ghost ax-btn--sm"
                            onClick={() => void fillDay(day, rows)}
                            disabled={bulkDay !== null}
                            title={HRM_ATTENDANCE_FILL_HINT}
                            aria-label={`${HRM_ATTENDANCE_FILL_ACTION} — ${formatWeekdayDate(day)}. ${HRM_ATTENDANCE_FILL_HINT}`}
                            style={{ marginTop: 2, fontWeight: 400 }}
                          >
                            <IconCheck />
                            <span className="ax-btn__label">
                              {bulkDay === day
                                ? bulkProgress
                                  ? `${bulkProgress.done}/${bulkProgress.total}…`
                                  : 'En cours…'
                                : HRM_ATTENDANCE_FILL_ACTION}
                            </span>
                          </button>
                        )}
                      </th>
                    );
                  })}
                  <th className="ax-table__th ax-table__th--num" scope="col">
                    Noté
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  /* Le dénominateur ne compte que les journées NOTABLES : une
                     personne embauchée le mercredi affichait « 3/7 », soit un
                     retard de saisie qui n'existait pas. Une feuille complète
                     doit pouvoir afficher « 3/3 » — sans quoi le compteur
                     devient un reproche permanent. */
                  const notable = days.filter((d) => withinEmployment(row, d) && d <= today);
                  const noted = notable.filter((d) => statusAt(row.id, d) !== '').length;
                  return (
                    <tr key={row.id} className="ax-table__row">
                      <td className="ax-table__td ax-sheet__name">
                        <div
                          className="ax-cluster"
                          style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}
                        >
                          <AvatarChip name={row.user_display_name} seed={row.user} />
                          <span style={{ minWidth: 0 }}>
                            <span
                              className="ax-truncate"
                              style={{
                                display: 'block',
                                fontWeight: 500,
                                color: 'var(--ax-text-strong)',
                              }}
                            >
                              {row.user_display_name}
                            </span>
                            <span
                              className="ax-truncate"
                              style={{
                                display: 'block',
                                fontSize: 'var(--ax-text-xs)',
                                color: 'var(--ax-text-muted)',
                              }}
                            >
                              {row.job_title_name ?? 'Fonction non précisée'}
                            </span>
                          </span>
                        </div>
                      </td>
                      {days.map((day) => {
                        const key = cellKey(row.id, day);
                        const value = statusAt(row.id, day);
                        const employed = withinEmployment(row, day);
                        /* `savingKey` ne désactive PLUS la cellule : désactiver
                           un `<select>` qui a le focus renvoie le focus au
                           document, et la personne qui saisissait au clavier
                           repartait du haut de la page à chaque case. La
                           requête est un upsert idempotent — rien n'oblige à
                           verrouiller pendant qu'elle vole. */
                        const disabled = day > today || !employed || bulkDay !== null;
                        return (
                          <td
                            key={day}
                            className="ax-table__td"
                            style={{ textAlign: 'center', padding: 'var(--ax-space-2)' }}
                          >
                            {employed ? (
                              <select
                                className="ax-select ax-select--sm"
                                value={value}
                                disabled={disabled}
                                aria-busy={savingKey === key}
                                onChange={(e) =>
                                  queueSave(row.id, day, e.target.value as AttendanceStatus)
                                }
                                /* Quitter la case envoie tout de suite : au
                                   clavier, Tab enregistre — pas d'attente. */
                                onBlur={() => flush(row.id, day)}
                                aria-label={`${row.user_display_name} — ${formatWeekdayDate(day)}`}
                              >
                                {/* Désactivée : le backend n'a pas de geste
                                    « effacer une journée », et proposer une
                                    sortie qui n'existe pas serait un mensonge.
                                    Elle reste dans la liste pour pouvoir
                                    AFFICHER l'état « pas encore noté ». */}
                                <option value="" disabled>
                                  {ATTENDANCE_UNSET_OPTION}
                                </option>
                                {ATTENDANCE_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {ATTENDANCE_STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                style={{
                                  fontSize: 'var(--ax-text-xs)',
                                  color: 'var(--ax-text-muted)',
                                }}
                              >
                                Hors emploi
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="ax-table__td ax-table__td--num ax-num">
                        {noted}/{notable.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {employments.loading && rows.length === 0 && <CardSkeleton lines={2} />}
      </div>
    </section>
  );
}

export default HrAttendanceSheet;
