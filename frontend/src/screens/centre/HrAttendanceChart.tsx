'use client';
/*
 * Chioni — ce que dit la feuille sur les 30 derniers jours (S7).
 *
 * Asset Vireo : « Attendance Overview » du dashboard `dashboards/Hr.tsx`
 * (l. 209-243) — colonnes empilées par jour, légende à pastilles au-dessus du
 * graphique. Trois adaptations, toutes de fond :
 *
 * 1. la série « Remote » du template disparaît (elle n'existe pas dans un
 *    centre de santé comorien) et cède la place à « Repos » et « Jour férié »,
 *    qui sont les deux vrais statuts du registre ;
 * 2. **le rouge d'« Absent » disparaît** : dans le template, l'absence est
 *    peinte en `--ax-viz-red`, soit la couleur d'une alerte. Une absence n'est
 *    pas un incident, et un graphique lu chaque matin par une direction
 *    apprend très vite à voir du rouge là où il y a un deuil ou un enfant
 *    malade. Elle prend une teinte neutre, lisible sans être accusatrice ;
 * 3. **aucun taux de présence** n'est calculé nulle part. Le KPI
 *    « Attendance Rate » du template est le seul de sa ligne qu'on ne reprend
 *    pas : un pourcentage affiché à côté d'un nom est un jugement, et
 *    l'endpoint de statistiques du sprint sert à savoir ce qui reste À NOTER,
 *    pas à évaluer quelqu'un.
 *
 * Chargé en `dynamic()` depuis le registre : les trois autres onglets ne
 * paient pas le poids d'ApexCharts.
 */
import { ApexChart } from '@/components/charts/ApexChart';
import { cv } from '@/components/charts/vizTokens';
import { useCenter } from '@/context/CenterContext';
import { getAttendanceStats } from '@/lib/endpoints/hrm';
import {
  ATTENDANCE_STATUS_LABELS,
  HRM_STATS_EMPTY,
  HRM_STATS_NO_RANKING,
  HRM_STATS_SUBTITLE,
  HRM_STATS_TITLE,
  formatShortDate,
} from '@/lib/labels';
import { CardSkeleton, ErrorAlert, useAsync } from './shared';

export function HrAttendanceChart() {
  const { centerId } = useCenter();
  const stats = useAsync(() => getAttendanceStats(centerId), [centerId]);

  const days = stats.data?.days ?? [];
  const totals = stats.data?.totals;
  const noted = totals ? totals.total : 0;

  return (
    <section
      className="ax-card ax-card--chart ax-col--12"
      role="region"
      aria-label="Journées notées sur 30 jours"
    >
      <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
        <div className="ax-card__titles">
          <h2 className="ax-card__title">{HRM_STATS_TITLE}</h2>
          <p className="ax-card__subtitle">{HRM_STATS_SUBTITLE}</p>
        </div>
        {totals && (
          <span
            className="ax-num"
            style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}
          >
            {noted} journée{noted > 1 ? 's' : ''} notée{noted > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {stats.loading ? (
          <CardSkeleton lines={5} />
        ) : stats.error ? (
          <ErrorAlert error={stats.error} onRetry={stats.reload} />
        ) : noted === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            {HRM_STATS_EMPTY}
          </p>
        ) : (
          <>
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-4)', marginBlockEnd: 'var(--ax-space-3)', flexWrap: 'wrap' }}
            >
              {(
                [
                  ['present', 'var(--ax-viz-emerald)'],
                  ['absent', 'var(--ax-text-muted)'],
                  ['conge', 'var(--ax-viz-cyan)'],
                  ['repos', 'var(--ax-viz-violet)'],
                  ['ferie', 'var(--ax-viz-amber)'],
                ] as const
              ).map(([key, color]) => (
                <span key={key} className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <i
                    aria-hidden="true"
                    style={{ width: 9, height: 9, borderRadius: 3, background: color }}
                  />
                  <small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                    {ATTENDANCE_STATUS_LABELS[key]}
                  </small>
                </span>
              ))}
            </div>
            <ApexChart
              type="bar"
              height={260}
              legend="none"
              stacked
              ariaLabel="Colonnes empilées des journées notées par jour et par état"
              series={[
                { name: ATTENDANCE_STATUS_LABELS.present, data: days.map((d) => d.present) },
                { name: ATTENDANCE_STATUS_LABELS.absent, data: days.map((d) => d.absent) },
                { name: ATTENDANCE_STATUS_LABELS.conge, data: days.map((d) => d.conge) },
                { name: ATTENDANCE_STATUS_LABELS.repos, data: days.map((d) => d.repos) },
                { name: ATTENDANCE_STATUS_LABELS.ferie, data: days.map((d) => d.ferie) },
              ]}
              apex={{
                colors: [
                  cv('--ax-viz-emerald'),
                  cv('--ax-text-muted'),
                  cv('--ax-viz-cyan'),
                  cv('--ax-viz-violet'),
                  cv('--ax-viz-amber'),
                ],
                plotOptions: { bar: { borderRadius: 3, columnWidth: '58%' } },
                xaxis: { categories: days.map((d) => formatShortDate(d.date)) },
              }}
            />
            {/* L'endpoint renvoie AUSSI `by_employment` — un décompte par
                personne — et cet écran ne le dessine pas. Le dire engage la
                direction qui lit ce graphique chaque matin, pas seulement le
                code qui l'a écrit. */}
            <p
              style={{
                margin: 'var(--ax-space-3) 0 0',
                fontSize: 'var(--ax-text-xs)',
                color: 'var(--ax-text-muted)',
                lineHeight: 1.7,
              }}
            >
              {HRM_STATS_NO_RANKING}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default HrAttendanceChart;
