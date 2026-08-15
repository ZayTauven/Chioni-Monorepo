'use client';
/*
 * Chioni — /centre : le tableau de bord piloté (vague 3).
 *
 * Données 100 % réelles, jamais inventées :
 * - Bloc ACTIVITÉ (tout staff) : stats /stats/activity/ sur 30 jours (série
 *   complète zéro-remplie) + la file du jour (/appointments/, défaut aujourd'hui).
 * - Bloc FINANCES (rôles BILLING uniquement — le composant n'est PAS monté
 *   pour les autres, symétrie du 403 backend) : /stats/finances/ sur 30 jours,
 *   recettes par méthode, facturé vs encaissé (l'info de pilotage n° 1),
 *   impayés (photo à l'instant T) et contre-passations à part.
 * - Carte LITIGES (S1 : lecture BILLING seule — le motif libre ne s'affiche
 *   plus à tout staff) : même règle de montage conditionnel que les finances.
 * Les graphiques passent par le wrapper ApexCharts du template (pattern du
 * dashboard Healthcare de Vireo : sparklines KPI, area accent, légende à
 * pastilles, cv() pour les couleurs — ordre des séries fixe par entité).
 */
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { ApexChart } from '@/components/charts/ApexChart';
import { cv } from '@/components/charts/vizTokens';
import { useCenter } from '@/context/CenterContext';
import {
  getActivityStats,
  getCenter,
  getFinanceStats,
  getSubscription,
  listAppointments,
  listDisputes,
  listPaymentRequests,
} from '@/lib/endpoints/centers';
import {
  APPOINTMENT_STATUS_LABELS,
  CASH_METHOD_LABELS,
  DISPUTE_STATUS_LABELS,
  KYC_BANNER_LEAD,
  KYC_BANNER_TITLE,
  KYC_CLOSED_RAIL,
  KYC_STILL_WORKS,
  PAYMENT_REQUEST_STATUS_LABELS,
  SUBSCRIPTION_BANNER_LEAD,
  SUBSCRIPTION_BANNER_TITLE,
  SUBSCRIPTION_FROZEN_CLOSED,
  SUBSCRIPTION_STATS_FROZEN_HINT,
  SUBSCRIPTION_STATS_FROZEN_SHORT,
  SUBSCRIPTION_STATS_FROZEN_TITLE,
  SUBSCRIPTION_STILL_WORKS,
  SUBSCRIPTION_TERMINATED_DATA,
  SUBSCRIPTION_UNPAID_NOTHING_CLOSED,
  formatDate,
  formatKmf,
  formatPct,
  formatShortDate,
  formatTime,
} from '@/lib/labels';
import type { ActivityStats, SubscriptionStatus } from '@/lib/types';
import type { ApiError } from '@/lib/api';
import {
  APPOINTMENT_TONES,
  AvatarChip,
  BILLING_ROLES,
  CardSkeleton,
  DISPUTE_TONES,
  ErrorAlert,
  EmptyState,
  IconChevronRight,
  PAGE_SIZE,
  PAYMENT_REQUEST_TONES,
  StatusBadge,
  hasRole,
  useAsync,
} from './shared';

/**
 * Un centre GELÉ perd ses graphiques : les deux `stats/*` répondent 400 avec
 * le message complet du backend (vigilance ADR 0018 lot 1). Le rendre en
 * alerte ROUGE laisserait croire à une panne, alors que la file du jour, les
 * dossiers et la caisse fonctionnent. On met donc une explication calme à la
 * place des cartes.
 *
 * Pourquoi le 400 suffit à conclure : le dashboard appelle ces deux endpoints
 * SANS paramètre — leurs autres 400 (fenêtre invalide) sont hors d'atteinte
 * ici. Et le texte affiché reste celui du backend, jamais une supposition :
 * si un autre 400 apparaissait un jour, c'est SA phrase qui s'afficherait.
 */
function StatsUnavailable({
  error,
  onRetry,
  compact = false,
}: {
  error: ApiError;
  onRetry: () => void;
  /**
   * Bloc SECONDAIRE (compteurs à côté d'un graphique déjà expliqué).
   *
   * Revue UX care S5 : un centre gelé recevait quatre fois le même paragraphe
   * de trois phrases — deux graphiques et deux compteurs. Répétée quatre fois,
   * une mauvaise nouvelle devient un mur, et le lecteur cesse de la lire.
   * L'explication complète reste sur le graphique de chaque bloc ; les
   * compteurs se contentent d'une ligne calme.
   */
  compact?: boolean;
}) {
  if (error.status !== 400) return <ErrorAlert error={error} onRetry={onRetry} />;
  if (compact) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.7 }}>
        {SUBSCRIPTION_STATS_FROZEN_SHORT}
      </p>
    );
  }
  return (
    <div className="ax-alert ax-alert--info" role="status">
      <div className="ax-alert__content">
        <p className="ax-alert__title">{SUBSCRIPTION_STATS_FROZEN_TITLE}</p>
        {error.messages.map((m) => (
          <p key={m} className="ax-alert__message">
            {m}
          </p>
        ))}
        <p className="ax-alert__message">{SUBSCRIPTION_STATS_FROZEN_HINT}</p>
      </div>
    </div>
  );
}

/* ── KPI icons (Tabler outline, même contrat que le template) ── */

const KPI_ICONS = {
  appointments: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></svg>
  ),
  encounters: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" /><path d="M8 15a6 6 0 1 0 12 0v-3" /><path d="M11 3v2" /><path d="M6 3v2" /><path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /></svg>
  ),
  patients: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
  ),
};

/** Pastille de légende (pattern Healthcare du template). */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
      <i style={{ width: 9, height: 9, borderRadius: 3, background: color, display: 'inline-block' }} />
      <small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>{label}</small>
    </span>
  );
}

/* ── bloc activité (tout staff) ── */

function todayAppointments(stats: ActivityStats) {
  const last = stats.days[stats.days.length - 1];
  return last?.appointments ?? { prevu: 0, arrive: 0, honore: 0, manque: 0, annule: 0 };
}

function ActivityBlock() {
  const { centerId } = useCenter();
  const stats = useAsync(() => getActivityStats(centerId), [centerId]);
  const queue = useAsync(() => listAppointments(centerId, { page: 1 }), [centerId]);

  const days = stats.data?.days ?? [];
  const categories = days.map((d) => formatShortDate(d.date));
  const today = stats.data ? todayAppointments(stats.data) : null;
  const todayTotal = today
    ? today.prevu + today.arrive + today.honore + today.manque + today.annule
    : null;
  const queueRows = (queue.data?.results ?? []).slice(0, 6);

  const kpis = [
    {
      key: 'appointments',
      label: "Rendez-vous aujourd'hui",
      icon: KPI_ICONS.appointments,
      c: 'c1',
      value: todayTotal !== null ? String(todayTotal) : null,
      caption: today
        ? `${today.honore} ${APPOINTMENT_STATUS_LABELS.honore.toLowerCase()}${today.honore > 1 ? 's' : ''} · ${today.manque} ${APPOINTMENT_STATUS_LABELS.manque.toLowerCase()}${today.manque > 1 ? 's' : ''}`
        : null,
      spark: days.map((d) => d.appointments.prevu + d.appointments.arrive + d.appointments.honore + d.appointments.manque + d.appointments.annule),
      color: '--ax-accent',
      href: '/centre/rendez-vous',
    },
    {
      key: 'encounters',
      label: 'Consultations (30 j)',
      icon: KPI_ICONS.encounters,
      c: 'c2',
      value: stats.data ? String(stats.data.totals.encounters) : null,
      caption: null,
      spark: days.map((d) => d.encounters),
      color: '--ax-viz-cyan',
      href: '/centre/consultations',
    },
    {
      key: 'patients',
      label: 'Nouveaux patients (30 j)',
      icon: KPI_ICONS.patients,
      c: 'c3',
      value: stats.data ? String(stats.data.totals.new_patients) : null,
      caption: null,
      spark: days.map((d) => d.new_patients),
      color: '--ax-viz-violet',
      href: '/centre/patients',
    },
    {
      key: 'attendance',
      label: 'Taux de présence (30 j)',
      icon: KPI_ICONS.attendance,
      c: 'c4',
      value: stats.data ? formatPct(stats.data.totals.attendance_rate_pct) : null,
      caption: 'honorés / (honorés + manqués)',
      spark: null,
      color: '--ax-viz-emerald',
      href: '/centre/rendez-vous',
    },
  ] as const;

  return (
    <>
      {kpis.map((k) => (
        <Link key={k.key} href={k.href} className="ax-card ax-kpi ax-col--3 ax-card--interactive" style={{ textDecoration: 'none' }} aria-label={k.label}>
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className={`ax-kpi__icon ax-kpi__icon--${k.c}`}>{k.icon}</span>
            </div>
            <div className="ax-kpi__label">{k.label}</div>
            {stats.loading ? (
              <span className="ax-skeleton ax-skeleton--line ax-skeleton--shimmer" style={{ height: 28, width: 64, display: 'inline-block' }} aria-hidden="true" />
            ) : stats.error ? (
              // Un gel d'abonnement n'est pas une panne : le chiffre manque,
              // il ne s'alarme pas en rouge sur les quatre cartes à la fois.
              <div
                className="ax-kpi__caption"
                style={{ color: stats.error.status === 400 ? 'var(--ax-text-muted)' : 'var(--ax-danger-700)' }}
              >
                Indisponible
              </div>
            ) : (
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num">{k.value ?? '—'}</div>
                {k.spark && k.spark.some((v) => v > 0) && (
                  <ApexChart
                    className="ax-kpi__spark"
                    type="line"
                    sparkline
                    tooltip={false}
                    height={40}
                    color={k.color}
                    series={[{ name: k.label, data: k.spark }]}
                    style={{ minHeight: 40 }}
                  />
                )}
              </div>
            )}
            {k.caption && !stats.loading && !stats.error && (
              <div className="ax-kpi__caption" style={{ color: 'var(--ax-text-subtle)' }}>{k.caption}</div>
            )}
          </div>
        </Link>
      ))}

      {/* File du jour condensée */}
      <section className="ax-card ax-col--4" role="region" aria-label="File du jour">
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <h2 className="ax-card__title">File du jour</h2>
            <p className="ax-card__subtitle">Les premiers rendez-vous d&apos;aujourd&apos;hui, dans l&apos;ordre des heures</p>
          </div>
          <Link className="ax-btn ax-btn--link" href="/centre/rendez-vous">Ouvrir l&apos;agenda</Link>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          {queue.loading ? (
            <CardSkeleton lines={5} />
          ) : queue.error ? (
            <ErrorAlert error={queue.error} onRetry={queue.reload} />
          ) : queueRows.length === 0 ? (
            <EmptyState
              title="Aucun rendez-vous ce jour"
              message="Créez les rendez-vous du jour depuis l'agenda — la file s'affichera ici."
            />
          ) : (
            <ul className="ax-list ax-list--compact">
              {queueRows.map((a) => (
                <li key={a.id} className="ax-list__row">
                  <span className="ax-list__leading">
                    <AvatarChip name={a.patient_name || `Patient n° ${a.patient}`} seed={a.patient} />
                  </span>
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {a.patient_name || `Patient n° ${a.patient}`}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{formatTime(a.scheduled_at)}</b>
                      {a.practitioner_name ? ` · ${a.practitioner_name}` : ' · Avec le centre'}
                    </span>
                  </span>
                  <span className="ax-list__trailing">
                    <StatusBadge tone={APPOINTMENT_TONES[a.status]} label={APPOINTMENT_STATUS_LABELS[a.status]} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Activité sur 30 jours */}
      <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Activité sur 30 jours">
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">Activité</span>
            <h2 className="ax-card__title">30 derniers jours</h2>
            <p className="ax-card__subtitle">Consultations et nouveaux patients par jour</p>
          </div>
          <div className="ax-card__actions">
            <LegendDot color="var(--ax-accent)" label="Consultations" />
            <LegendDot color="var(--ax-viz-cyan)" label="Nouveaux patients" />
          </div>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          {stats.loading ? (
            <CardSkeleton lines={6} />
          ) : stats.error ? (
            <StatsUnavailable error={stats.error} onRetry={stats.reload} />
          ) : (
            <ApexChart
              type="area"
              height={280}
              legend="none"
              accent
              ariaLabel="Courbes des consultations et des nouveaux patients par jour sur 30 jours"
              series={[
                { name: 'Consultations', data: days.map((d) => d.encounters) },
                { name: 'Nouveaux patients', data: days.map((d) => d.new_patients) },
              ]}
              apex={{
                xaxis: { categories, tickAmount: 6, labels: { rotate: 0, hideOverlappingLabels: true } },
                yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) } },
              }}
            />
          )}
        </div>
      </section>
    </>
  );
}

/* ── bloc finances (rôles BILLING uniquement — jamais monté sinon) ── */

function FinanceBlock() {
  const { centerId } = useCenter();
  const stats = useAsync(() => getFinanceStats(centerId), [centerId]);

  const days = stats.data?.days ?? [];
  const categories = days.map((d) => formatShortDate(d.date));
  const t = stats.data?.totals;
  const invoicedTotal = stats.data ? Number.parseFloat(stats.data.invoiced.total_kmf) : 0;
  const collected = stats.data ? Number.parseFloat(stats.data.collected_kmf) : 0;
  // KMF has no decimals — round so a float subtraction never shows ghost cents.
  const gap = Math.round(invoicedTotal - collected);

  return (
    <>
      <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Recettes sur 30 jours">
        <div className="ax-card__header">
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">Finances</span>
            <h2 className="ax-card__title">Recettes des 30 derniers jours</h2>
            <p className="ax-card__subtitle">
              Encaissements non contre-passés, par jour et par méthode
            </p>
          </div>
          <div className="ax-card__actions">
            <LegendDot color="var(--ax-viz-cyan)" label={CASH_METHOD_LABELS.especes} />
            <LegendDot color="var(--ax-viz-violet)" label={CASH_METHOD_LABELS.mobile_money} />
            <LegendDot color="var(--ax-accent)" label={CASH_METHOD_LABELS.pont_confiance} />
          </div>
        </div>
        <div className="ax-card__body" style={{ paddingTop: 0 }}>
          {stats.loading ? (
            <CardSkeleton lines={6} />
          ) : stats.error ? (
            <StatsUnavailable error={stats.error} onRetry={stats.reload} />
          ) : (
            <ApexChart
              type="bar"
              height={280}
              legend="none"
              stacked
              ariaLabel="Colonnes empilées des recettes par jour : espèces, mobile money, Pont de Confiance"
              series={[
                { name: CASH_METHOD_LABELS.especes, data: days.map((d) => Number.parseFloat(d.especes_kmf)) },
                { name: CASH_METHOD_LABELS.mobile_money, data: days.map((d) => Number.parseFloat(d.mobile_money_kmf)) },
                { name: CASH_METHOD_LABELS.pont_confiance, data: days.map((d) => Number.parseFloat(d.pont_confiance_kmf)) },
              ]}
              apex={{
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-accent')],
                xaxis: { categories, tickAmount: 6, labels: { rotate: 0, hideOverlappingLabels: true } },
                yaxis: { labels: { formatter: (v: number) => `${Math.round(v / 1000)} k` } },
                tooltip: { y: { formatter: (v: number) => formatKmf(String(v)) } },
              }}
            />
          )}
        </div>
      </section>

      <div className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
        <section className="ax-card" role="region" aria-label="Facturé et encaissé sur 30 jours">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Facturé vs encaissé (30 j)</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {stats.loading ? (
              <CardSkeleton lines={4} />
            ) : stats.error ? (
              <StatsUnavailable error={stats.error} onRetry={stats.reload} compact />
            ) : stats.data && t ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                    Facturé ({stats.data.invoiced.count} facture{stats.data.invoiced.count > 1 ? 's' : ''})
                  </span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>
                    {formatKmf(stats.data.invoiced.total_kmf)}
                  </b>
                </div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Encaissé</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>
                    {formatKmf(stats.data.collected_kmf)}
                  </b>
                </div>
                <hr className="ax-divider" aria-hidden="true" style={{ margin: 0 }} />
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Écart</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: gap > 0 ? 'var(--ax-danger-700)' : 'var(--ax-success-700)' }}>
                    {formatKmf(String(gap))}
                  </b>
                </div>
                {stats.data.reversals.count > 0 && (
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                    {stats.data.reversals.count} contre-passation{stats.data.reversals.count > 1 ? 's' : ''} sur la
                    période ({formatKmf(stats.data.reversals.total_kmf)}) — affichées à part, jamais soustraites en
                    silence.
                  </p>
                )}
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <span>{CASH_METHOD_LABELS.especes} : <b className="ax-num">{formatKmf(t.especes_kmf)}</b></span>
                </div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <span>{CASH_METHOD_LABELS.mobile_money} : <b className="ax-num">{formatKmf(t.mobile_money_kmf)}</b></span>
                </div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <span>{CASH_METHOD_LABELS.pont_confiance} : <b className="ax-num">{formatKmf(t.pont_confiance_kmf)}</b></span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="ax-card" role="region" aria-label="Impayés">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Impayés</h2>
              <p className="ax-card__subtitle">Factures émises à solde restant — photo à l&apos;instant</p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/centre/impayes">Tout voir</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {stats.loading ? (
              <CardSkeleton lines={2} />
            ) : stats.error ? (
              <StatsUnavailable error={stats.error} onRetry={stats.reload} compact />
            ) : stats.data ? (
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="ax-kpi__value ax-num">{stats.data.unpaid.count}</span>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', color: stats.data.unpaid.count > 0 ? 'var(--ax-danger-700)' : 'var(--ax-text-strong)' }}>
                  {formatKmf(stats.data.unpaid.total_kmf)}
                </b>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}

/* ── carte litiges (rôles BILLING uniquement — le motif libre ne s'affiche
      plus à tout staff ; le composant n'est PAS monté sinon, symétrie du 403
      backend, même pattern que le bloc finances) ── */

function DisputesCard() {
  const { centerId } = useCenter();
  const disputes = useAsync(() => listDisputes(centerId, 1), [centerId]);
  const openDisputes = (disputes.data?.results ?? []).filter((d) => d.status === 'ouvert');
  const disputesPartial = (disputes.data?.count ?? 0) > PAGE_SIZE;

  return (
    <section className="ax-card ax-col--6" role="region" aria-label="Litiges ouverts">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <h2 className="ax-card__title">Litiges ouverts</h2>
          <p className="ax-card__subtitle">
            {disputesPartial
              ? 'Litiges ouverts parmi les plus récents (première page) — la liste complète est sur la page Litiges.'
              : 'Contestations en attente de résolution'}
          </p>
        </div>
        <Link className="ax-btn ax-btn--link" href="/centre/litiges">Tout voir</Link>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        {disputes.loading ? (
          <CardSkeleton lines={3} />
        ) : disputes.error ? (
          <ErrorAlert error={disputes.error} onRetry={disputes.reload} />
        ) : openDisputes.length === 0 ? (
          <EmptyState
            title="Aucun litige ouvert"
            message={
              disputesPartial
                ? 'Aucun litige ouvert sur la première page — vérifiez la page Litiges pour l’historique complet.'
                : 'Aucune contestation en cours. C’est bon signe.'
            }
          />
        ) : (
          <ul className="ax-list ax-list--compact">
            {openDisputes.map((d) => (
              <li key={d.id} className="ax-list__row">
                <span className="ax-list__content">
                  <Link href="/centre/litiges" className="ax-link ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                    Litige n° {d.id} — demande n° {d.payment_request}
                  </Link>
                  <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                    Ouvert le {formatDate(d.created_at)}
                  </span>
                </span>
                <span className="ax-list__trailing" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                  <StatusBadge tone={DISPUTE_TONES[d.status]} label={DISPUTE_STATUS_LABELS[d.status]} />
                  <IconChevronRight className="" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── screen ── */

/* ── bandeau d'abonnement (directeur seul — l'API l'est aussi) ─────────────
   Deux axes, deux bandeaux : le KYC gouverne le rail diaspora (ADR 0017),
   l'abonnement gouverne l'administratif (ADR 0018). Les fondre laisserait
   croire qu'une suspension commerciale ferme le Pont de Confiance — c'est
   exactement l'inverse de la décision produit. ────────────────────────────── */

/** Le ton suit l'effet RÉEL : `impaye` informe, le gel avertit. */
const SUBSCRIPTION_BANNER_TONE: Record<SubscriptionStatus, 'info' | 'warning'> = {
  essai: 'info',
  actif: 'info',
  impaye: 'info',
  suspendu: 'warning',
  resilie: 'warning',
};

function SubscriptionBanner({ centerId }: { centerId: number }) {
  // 404 = pas de contrat : état normal, aucun bandeau. Toute autre erreur est
  // silencieuse ici — le tableau de bord d'un centre n'est pas l'endroit où
  // apprendre qu'une lecture d'abonnement a échoué.
  const subscription = useAsync(() => getSubscription(centerId), [centerId]);
  const data = subscription.data;
  if (!data || data.status === 'essai' || data.status === 'actif') return null;

  return (
    <div
      className={`ax-alert ax-alert--${SUBSCRIPTION_BANNER_TONE[data.status]}`}
      role="status"
      style={{ marginBottom: 'var(--ax-space-5)' }}
    >
      <div className="ax-alert__content">
        <p className="ax-alert__title">{SUBSCRIPTION_BANNER_TITLE[data.status]}</p>
        <p className="ax-alert__message">{SUBSCRIPTION_BANNER_LEAD[data.status]}</p>
        {/* CE QUI CONTINUE en premier, toujours : un directeur qui lit
            « suspendu » doit savoir dans la même seconde qu'il peut encore
            soigner, inscrire, facturer et encaisser. */}
        <p className="ax-alert__message">{SUBSCRIPTION_STILL_WORKS}</p>
        <p className="ax-alert__message">
          {data.is_frozen ? SUBSCRIPTION_FROZEN_CLOSED : SUBSCRIPTION_UNPAID_NOTHING_CLOSED}
        </p>
        {data.status === 'resilie' && (
          <p className="ax-alert__message">{SUBSCRIPTION_TERMINATED_DATA}</p>
        )}
        <p className="ax-alert__message">
          <Link href="/centre/abonnement" className="ax-link">
            Voir mon abonnement et mes factures
          </Link>
        </p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { centerId, center, roles } = useCenter();
  const billing = hasRole(roles, BILLING_ROLES);
  const isDirector = hasRole(roles, ['directeur']);

  const centerDetail = useAsync(() => getCenter(centerId), [centerId]);
  const requests = useAsync(() => listPaymentRequests(centerId, 1), [centerId]);

  const latestRequests = (requests.data?.results ?? []).slice(0, 5);

  return (
    <>
      <PageHead title={center.name} subtitle="Vue d'ensemble de l'activité du centre." />

      {/* S4 (ADR 0017, arbitrage PO n° 1) — le bandeau dit d'abord CE QUI
          CONTINUE, ensuite ce qui est fermé. Un centre suspendu soigne,
          facture et encaisse : laisser croire l'inverse le renverrait au
          papier, ce que la suspension ne doit jamais faire. */}
      {/* Ton par statut : « en attente » est l'état NORMAL d'un centre qui
          vient d'ouvrir — un bandeau d'avertissement jaune permanent lui
          apprendrait à ignorer les bandeaux. Le jaune est réservé à la
          suspension, qui appelle une action. */}
      {/* S5 — l'abonnement : bandeau DIRECTEUR SEUL, comme l'API. Le composant
          n'est pas monté pour les autres rôles (fetch compris), symétrie du
          403 backend et du bloc finances. */}
      {isDirector && <SubscriptionBanner centerId={centerId} />}

      {centerDetail.data && centerDetail.data.kyc_status !== 'actif' && (
        <div
          className={`ax-alert ax-alert--${centerDetail.data.kyc_status === 'suspendu' ? 'warning' : 'info'}`}
          role="status"
          style={{ marginBottom: 'var(--ax-space-5)' }}
        >
          <div className="ax-alert__content">
            <p className="ax-alert__title">{KYC_BANNER_TITLE[centerDetail.data.kyc_status]}</p>
            <p className="ax-alert__message">{KYC_BANNER_LEAD[centerDetail.data.kyc_status]}</p>
            <p className="ax-alert__message">{KYC_STILL_WORKS}</p>
            <p className="ax-alert__message">{KYC_CLOSED_RAIL}</p>
            {hasRole(roles, ['directeur']) && (
              <p className="ax-alert__message">
                <Link href="/centre/parametres" className="ax-link">
                  Voir le détail et déposer vos pièces justificatives
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="ax-dash-grid">
        {/* Bloc activité — tout staff */}
        <ActivityBlock />

        {/* Bloc finances — rôles BILLING seulement (jamais monté sinon) */}
        {billing && <FinanceBlock />}

        {/* Dernières demandes de paiement (pleine largeur quand la carte
            litiges, réservée aux rôles BILLING, n'est pas montée) */}
        <section className={`ax-card ${billing ? 'ax-col--6' : 'ax-col--12'}`} role="region" aria-label="Dernières demandes de paiement">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Dernières demandes de paiement</h2>
              <p className="ax-card__subtitle">Pont de Confiance — les plus récentes</p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/centre/demandes">Tout voir</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {requests.loading ? (
              <CardSkeleton lines={5} />
            ) : requests.error ? (
              <ErrorAlert error={requests.error} onRetry={requests.reload} />
            ) : latestRequests.length === 0 ? (
              <EmptyState
                title="Aucune demande pour l'instant"
                message="Créez une facture depuis une consultation, puis ouvrez une demande de paiement pour la partager avec les proches du patient."
              />
            ) : (
              <ul className="ax-list ax-list--compact">
                {latestRequests.map((r) => (
                  <li key={r.id} className="ax-list__row">
                    <span className="ax-list__content">
                      <Link href={`/centre/demandes/${r.id}`} className="ax-link ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                        Demande n° {r.id}
                      </Link>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                        {formatDate(r.created_at)} · {formatKmf(r.total_kmf)}
                      </span>
                    </span>
                    <span className="ax-list__trailing">
                      <StatusBadge tone={PAYMENT_REQUEST_TONES[r.status]} label={PAYMENT_REQUEST_STATUS_LABELS[r.status]} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Litiges ouverts — rôles BILLING seulement (jamais monté sinon) */}
        {billing && <DisputesCard />}
      </div>
    </>
  );
}

export default Dashboard;
