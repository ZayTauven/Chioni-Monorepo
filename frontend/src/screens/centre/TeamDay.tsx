'use client';
/*
 * Chioni — /centre/equipe : le planning collectif (S7, ADR 0020 décision 6).
 *
 * LE seul écran RH ouvert à tout le personnel actif. Il répond à une question
 * de service — « qui est là aujourd'hui ? » — et s'arrête exactement là.
 *
 * Assets Vireo repris et adaptés :
 * - `pages/Team.tsx` : la barre d'outils (recherche + filtre + compteur
 *   « N affichés » en `aria-live`), la bascule grille/liste et la grille de
 *   cartes `auto-fill,minmax(260px,1fr)`. Écartés : la modale d'invitation
 *   (l'équipe se gère dans « Personnel »), le menu « options » d'une carte
 *   (aucun geste n'existe ici) et la pastille de présence en ligne, qui est
 *   exactement le signal de surveillance que l'ADR refuse.
 * - `dashboards/Hr.tsx` : la ligne de compteurs en tête. Son KPI
 *   « Attendance Rate » est délibérément NON repris — un pourcentage de
 *   présence affiché à toute une équipe est un jugement, pas une information
 *   de service.
 *
 * L'invariant du sprint, tenu par le TYPE : `ScheduleEntry.status` est un
 * `PublicAttendanceStatus | null`, union sans `conge`. Le backend fond
 * `absent` et `conge` avant d'écrire le payload ; l'écran ne recroise JAMAIS
 * deux appels pour reconstituer le régime — ce serait contourner par l'UI ce
 * que le serveur protège.
 */
import { useMemo, useState } from 'react';
import { PageHead } from '@/components/shell/PageHead';
import { useCenter } from '@/context/CenterContext';
import { getSchedule } from '@/lib/endpoints/hrm';
import {
  ATTENDANCE_UNSET_LABEL,
  HRM_SCHEDULE_ALL_UNSET,
  HRM_SCHEDULE_EMPTY_MESSAGE,
  HRM_SCHEDULE_EMPTY_TITLE,
  HRM_SCHEDULE_NO_REGIME,
  HRM_SCHEDULE_UNSET_HINT,
  HRM_SCHEDULE_WINDOW_HINT,
  HRM_TEAM_DAY_SUBTITLE,
  HRM_TEAM_DAY_TITLE,
  PUBLIC_ATTENDANCE_LABELS,
  formatWeekdayDate,
  schedulePresentLabel,
  shiftIsoDate,
  todayIsoDate,
} from '@/lib/labels';
import type { PublicAttendanceStatus, ScheduleEntry } from '@/lib/types';
import { PublicAttendanceBadge } from './HrShared';
import {
  AvatarChip,
  CardSkeleton,
  EmptyState,
  ErrorAlert,
  IconSearch,
  useAsync,
} from './shared';

/** Les quatre statuts publics, plus la case « pas encore noté ». */
type Bucket = PublicAttendanceStatus | 'inconnu';

const BUCKETS: Bucket[] = ['present', 'absent', 'repos', 'ferie', 'inconnu'];

const BUCKET_LABELS: Record<Bucket, string> = {
  ...PUBLIC_ATTENDANCE_LABELS,
  inconnu: ATTENDANCE_UNSET_LABEL,
};

/* Les points de la ligne de compteurs. `absent` prend la couleur NEUTRE du
   texte, pas le rouge du template : la ligne se lit d'un coup d'œil sans
   qu'aucune personne n'y soit signalée comme un problème. */
const BUCKET_DOT: Record<Bucket, string> = {
  present: 'var(--ax-success-500)',
  absent: 'var(--ax-text-muted)',
  repos: 'var(--ax-viz-violet)',
  ferie: 'var(--ax-accent)',
  inconnu: 'var(--ax-border-strong)',
};

function bucketOf(entry: ScheduleEntry): Bucket {
  return entry.status ?? 'inconnu';
}

/**
 * La fenêtre de service du backend (revue guardian S7 : ±31 jours). L'écran la
 * borne LUI-MÊME plutôt que de laisser un chevron buter sur un 400 : le
 * planning répond à « qui est là aujourd'hui ? », il n'est pas un historique.
 */
const SCHEDULE_WINDOW_DAYS = 31;

/* ── carte d'une personne (grille) ── */

function PersonCard({ entry }: { entry: ScheduleEntry }) {
  return (
    /* `article` sans `role="region"` : trente personnes affichées faisaient
       trente points de repère dans le sommaire d'un lecteur d'écran, là où
       l'unique repère utile est la carte « Équipe du … ». */
    <article className="ax-card" aria-label={entry.display_name}>
      <div
        className="ax-card__body"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}
      >
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
          <AvatarChip name={entry.display_name} seed={entry.employment} size="md" />
          <span style={{ minWidth: 0 }}>
            <span
              className="ax-truncate"
              style={{
                display: 'block',
                fontWeight: 'var(--ax-weight-medium)',
                color: 'var(--ax-text-strong)',
              }}
            >
              {entry.display_name}
            </span>
            {/* La fonction est un LIBELLÉ D'ORGANISATION : elle décrit un
                poste, elle n'ouvre aucun droit et l'écran ne s'en sert pour
                gater quoi que ce soit. */}
            <span
              className="ax-truncate"
              style={{
                display: 'block',
                fontSize: 'var(--ax-text-xs)',
                color: 'var(--ax-text-muted)',
              }}
            >
              {entry.job_title ?? 'Fonction non précisée'}
            </span>
          </span>
        </div>
        <PublicAttendanceBadge status={entry.status} />
      </div>
    </article>
  );
}

/* ── écran ── */

export function TeamDay() {
  const { centerId } = useCenter();
  const today = todayIsoDate();
  const [date, setDate] = useState(today);
  const [view, setView] = useState<'grille' | 'liste'>('grille');
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<Bucket | 'tous'>('tous');

  const minDate = shiftIsoDate(today, -SCHEDULE_WINDOW_DAYS);
  const maxDate = shiftIsoDate(today, SCHEDULE_WINDOW_DAYS);

  const schedule = useAsync(() => getSchedule(centerId, date), [centerId, date]);
  /*
   * **La réponse précédente ne survit pas au changement de jour ni de centre.**
   *
   * `useAsync` conserve volontairement `data` pendant qu'il recharge : la
   * liste, elle, est derrière un squelette, mais la ligne de compteurs et le
   * « N affichés » se calculent, eux, à chaque rendu. Ils annonçaient donc les
   * absences de la veille sous la date d'aujourd'hui — et, au changement de
   * centre actif, celles de l'autre centre sous le nom du nouveau. Sur un
   * écran dont tout l'objet est de ne PAS transformer une absence en signal,
   * attribuer l'absence de quelqu'un au mauvais jour est exactement le
   * malentendu qu'il faut fermer. Tant que la réponse du jour demandé n'est
   * pas là, il n'y a rien à compter.
   */
  const entries = useMemo(
    () => (schedule.loading || schedule.error !== null ? [] : (schedule.data ?? [])),
    [schedule.loading, schedule.error, schedule.data],
  );

  const counts = useMemo(() => {
    const map: Record<Bucket, number> = {
      present: 0,
      absent: 0,
      repos: 0,
      ferie: 0,
      inconnu: 0,
    };
    for (const entry of entries) map[bucketOf(entry)] += 1;
    return map;
  }, [entries]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (bucket === 'tous' || bucketOf(entry) === bucket) &&
        (needle === '' ||
          `${entry.display_name} ${entry.job_title ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [entries, q, bucket]);

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
    <>
      <PageHead
        title={HRM_TEAM_DAY_TITLE}
        subtitle={HRM_TEAM_DAY_SUBTITLE}
        actions={
          <>
            {/* Les trois commandes sont bornées à la fenêtre de service : un
                chevron désactivé au bord dit la règle mieux qu'un 400. */}
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--icon"
              onClick={() => setDate((d) => shiftIsoDate(d, -1))}
              disabled={date <= minDate}
              aria-label="Jour précédent"
            >
              {chevron('M15 6l-6 6l6 6')}
            </button>
            <input
              type="date"
              className="ax-input"
              style={{ maxWidth: 176 }}
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => {
                const next = e.target.value;
                if (next === '') return setDate(today);
                if (next < minDate || next > maxDate) return;
                setDate(next);
              }}
              aria-label="Jour affiché"
            />
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--icon"
              onClick={() => setDate((d) => shiftIsoDate(d, 1))}
              disabled={date >= maxDate}
              aria-label="Jour suivant"
            >
              {chevron('M9 6l6 6l-6 6')}
            </button>
            {date !== today && (
              <button
                type="button"
                className="ax-btn ax-btn--secondary"
                onClick={() => setDate(today)}
              >
                <span className="ax-btn__label">Aujourd&rsquo;hui</span>
              </button>
            )}
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Ce que cet écran dit — et ce qu'il ne dira jamais. */}
        <div className="ax-col--12">
          <div className="ax-alert ax-alert--info" role="note">
            <div className="ax-alert__content">
              <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                {HRM_SCHEDULE_NO_REGIME}
              </p>
              <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                {HRM_SCHEDULE_UNSET_HINT}
              </p>
              <p className="ax-alert__message" style={{ lineHeight: 1.7 }}>
                {HRM_SCHEDULE_WINDOW_HINT}
              </p>
            </div>
          </div>
        </div>

        <section
          className="ax-card ax-col--12"
          role="region"
          aria-label={`Équipe du ${formatWeekdayDate(date)}`}
        >
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow" style={{ textTransform: 'capitalize' }}>
                {formatWeekdayDate(date)}
              </span>
              {/* Aucun dénominateur.
                  « 0 présent sur 12 » sur une journée que personne n'a encore
                  notée se lisait comme une équipe absente — et « 5 sur 12 »
                  comme un taux de présence affiché à tout le service, soit le
                  seul KPI du dashboard Vireo que cet écran refuse de reprendre.
                  On annonce des présences constatées, dégenrées, et le détail
                  complet (dont « Non renseigné ») vit dans la ligne de
                  compteurs juste dessous. */}
              <h2 className="ax-card__title">
                {schedule.loading
                  ? 'Chargement…'
                  : schedule.error
                    ? /* Sans ça, un échec de lecture s'annonçait « Personne au
                         planning » : le pire des malentendus sur cet écran. */
                      'Planning indisponible'
                    : entries.length === 0
                      ? 'Personne au planning'
                      : counts.inconnu === entries.length
                        ? HRM_SCHEDULE_ALL_UNSET
                        : schedulePresentLabel(counts.present)}
              </h2>
            </div>
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {/* Ligne de compteurs — adaptée de la ligne de KPI de `Hr.tsx`,
                sans son « Attendance Rate » : un pourcentage de présence
                affiché à toute l'équipe est un jugement, pas un service.

                Rien à compter tant que la réponse n'est pas là : un « Tous
                (0) » solitaire pendant le chargement se lirait comme une
                équipe vide, et les compteurs de la réponse PRÉCÉDENTE se
                liraient, eux, comme ceux du jour affiché. */}
            {entries.length > 0 && (
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-4)', flexWrap: 'wrap', marginBottom: 'var(--ax-space-4)' }}
              role="group"
              aria-label="Filtrer par état de la journée"
            >
              <button
                type="button"
                className={`ax-btn ax-btn--sm ax-btn--pill ${bucket === 'tous' ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
                aria-pressed={bucket === 'tous'}
                onClick={() => setBucket('tous')}
              >
                Tous ({entries.length})
              </button>
              {BUCKETS.filter((b) => counts[b] > 0).map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`ax-btn ax-btn--sm ax-btn--pill ${bucket === b ? 'ax-btn--primary' : 'ax-btn--secondary'}`}
                  aria-pressed={bucket === b}
                  onClick={() => setBucket(b)}
                >
                  <i
                    aria-hidden="true"
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: BUCKET_DOT[b],
                      display: 'inline-block',
                      marginInlineEnd: 6,
                    }}
                  />
                  {BUCKET_LABELS[b]} ({counts[b]})
                </button>
              ))}
            </div>
            )}

            {/* Barre d'outils — patron `Team.tsx` (recherche + bascule de vue). */}
            <div
              className="ax-cluster"
              style={{
                gap: 'var(--ax-space-3)',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                marginBottom: 'var(--ax-space-4)',
              }}
            >
              <div className="ax-field" style={{ marginBottom: 0, flex: '1 1 240px', maxWidth: 340 }}>
                <label className="ax-visually-hidden" htmlFor="team-q">
                  Rechercher une personne
                </label>
                <div className="ax-field__control">
                  <span className="ax-field__affix ax-field__affix--leading">
                    <IconSearch className="" />
                  </span>
                  <input
                    id="team-q"
                    type="search"
                    className="ax-input ax-input--with-leading-icon"
                    placeholder="Rechercher une personne…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                <span
                  className="ax-num"
                  style={{
                    fontFamily: 'var(--ax-font-mono)',
                    fontSize: 'var(--ax-text-xs)',
                    color: 'var(--ax-text-muted)',
                  }}
                  aria-live="polite"
                >
                  {/* Muet pendant le chargement plutôt que « 0 affichés » —
                      et surtout jamais le compte de la réponse précédente. */}
                  {entries.length > 0 ? `${shown.length} affiché${shown.length > 1 ? 's' : ''}` : ''}
                </span>
                <div className="ax-segment" role="radiogroup" aria-label="Mode d'affichage">
                  <button
                    type="button"
                    className={`ax-segment__option${view === 'grille' ? ' is-active' : ''}`}
                    role="radio"
                    aria-checked={view === 'grille'}
                    onClick={() => setView('grille')}
                  >
                    Grille
                  </button>
                  <button
                    type="button"
                    className={`ax-segment__option${view === 'liste' ? ' is-active' : ''}`}
                    role="radio"
                    aria-checked={view === 'liste'}
                    onClick={() => setView('liste')}
                  >
                    Liste
                  </button>
                </div>
              </div>
            </div>

            {schedule.loading ? (
              <CardSkeleton lines={5} />
            ) : schedule.error ? (
              <ErrorAlert error={schedule.error} onRetry={schedule.reload} />
            ) : entries.length === 0 ? (
              <EmptyState
                title={HRM_SCHEDULE_EMPTY_TITLE}
                message={HRM_SCHEDULE_EMPTY_MESSAGE}
              />
            ) : shown.length === 0 ? (
              <EmptyState
                title="Personne ne correspond"
                message="Aucune personne ne correspond à cette recherche ou à ce filtre."
              />
            ) : view === 'grille' ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
                  gap: 'var(--ax-space-4)',
                }}
              >
                {shown.map((entry) => (
                  <PersonCard key={entry.employment} entry={entry} />
                ))}
              </div>
            ) : (
              <ul className="ax-list ax-list--compact" aria-label="Équipe du jour">
                {shown.map((entry) => (
                  <li key={entry.employment} className="ax-list__row">
                    <span className="ax-list__leading">
                      <AvatarChip name={entry.display_name} seed={entry.employment} />
                    </span>
                    <span className="ax-list__content">
                      <span className="ax-list__title">{entry.display_name}</span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 'var(--ax-text-xs)',
                          color: 'var(--ax-text-muted)',
                        }}
                      >
                        {entry.job_title ?? 'Fonction non précisée'}
                      </span>
                    </span>
                    <span className="ax-list__trailing">
                      <PublicAttendanceBadge status={entry.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default TeamDay;
