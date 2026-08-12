'use client';
/*
 * Vireo Next.js — Widgets gallery (route "widgets").
 * 1:1 re-expression of src/html/widgets.html: stat cards (KPI spark, icon+delta,
 * progress-to-goal, gradient stat), chart widgets (area spark, device donut with
 * center total, orders column), list & profile widgets (profile, top products,
 * activity feed) and goals/meters (radial gauge, storage meters, rating, system
 * status). Charts go through <ApexChart>; the donut + radial gauge pass their
 * richer options (center total, gauge labels) through the apex prop.
 *
 * Client component: it mounts imperative ApexCharts and resolves live --ax-* tokens
 * for the donut/gauge options. `cv()` is SSR-safe — on the server (no `document`)
 * it returns canonical Aurora fallbacks, then the chart's own live re-theme
 * (ax:change) repaints the real tokens after hydration.
 */
import { PageHead } from '../components/shell/PageHead';
import { ApexChart } from '../components/charts/ApexChart';

const CV_FALLBACK: Record<string, string> = {
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-border': '#e5e7eb',
  '--ax-text-muted': '#64748b',
  '--ax-text-strong': '#0f172a',
  '--ax-font-sans': 'Inter, sans-serif',
  '--ax-font-mono': 'JetBrains Mono, monospace',
};
const cv = (n: string) => {
  if (typeof document === 'undefined') return CV_FALLBACK[n] || '';
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || CV_FALLBACK[n] || '';
};

const PRODUCT_ICON = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /></svg>
);
const BOTTLE_ICON = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h6" /><path d="M12 5v14" /><path d="M7 19h10" /></svg>
);
const STAR_FULL = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>;
const STAR_HALF = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>;

const TOP_PRODUCTS = [
  { color: '--ax-viz-cyan', icon: PRODUCT_ICON, name: 'Matte Ceramic Mug', cat: 'Drinkware · 540 sold', price: '$24' },
  { color: '--ax-viz-violet', icon: BOTTLE_ICON, name: 'Grid Notebook A5', cat: 'Stationery · 331 sold', price: '$16' },
  { color: '--ax-viz-amber', icon: PRODUCT_ICON, name: 'Aperture Desk Lamp', cat: 'Lighting · 212 sold', price: '$129' },
  { color: '--ax-viz-emerald', icon: PRODUCT_ICON, name: 'Felt Laptop Sleeve 14"', cat: 'Tech · 97 sold', price: '$44' },
];

const STORAGE = [
  { label: 'Documents', value: '28 GB', pct: 45, color: 'var(--ax-accent)' },
  { label: 'Media', value: '21 GB', pct: 34, color: 'var(--ax-viz-violet)' },
  { label: 'Backups', value: '13.4 GB', pct: 21, color: 'var(--ax-viz-amber)' },
];
const STATUS_ROWS: [string, string, string][] = [
  ['API', '99.98%', 'success'],
  ['Dashboard', '100%', 'success'],
  ['Webhooks', '97.2%', 'warning'],
  ['Search', '99.91%', 'success'],
];

export function Widgets() {
  return (
    <>
      <PageHead
        title="Widgets"
        subtitle="A gallery of drop-in building blocks — stat cards, mini-charts, lists, profiles, goals and feeds — all on the live Aurora palette."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></svg>
              <span className="ax-btn__label">Gallery view</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New widget</span>
            </button>
          </>
        }
      />

      {/* STAT CARDS */}
      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-4)' }}>
        <span className="ax-card__eyebrow">Stat cards</span>
        <span className="ax-badge ax-badge--soft ax-badge--pill">KPI</span>
      </div>
      <div className="ax-dash-grid" style={{ marginBottom: 'var(--ax-space-8)' }}>
        {/* 1 · KPI with spark */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Revenue $748.2K up 12.4%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>12.4%</span>
            </div>
            <div className="ax-kpi__label">Revenue</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">$748.2K</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [6, 9, 8, 16, 19, 23, 28, 30] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* 2 · KPI icon + delta */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Orders 1,248 up 8.1%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>8.1%</span>
            </div>
            <div className="ax-kpi__label">Orders</div>
            <div className="ax-kpi__value ax-num">1,248</div>
            <div className="ax-kpi__caption">vs. 1,154 last month</div>
          </div>
        </div>

        {/* 3 · KPI with progress to goal */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="New customers 3,920 at 78% of goal">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg></span>
              <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">78%</span>
            </div>
            <div className="ax-kpi__label">New customers</div>
            <div className="ax-kpi__value ax-num">3,920</div>
            <div className="ax-progress ax-progress--sm" style={{ marginTop: 'var(--ax-space-3)' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '78%' }} /></div></div>
          </div>
        </div>

        {/* 4 · Gradient accent stat */}
        <div className="ax-card ax-col--3" role="region" aria-label="Net profit $186K">
          <div className="ax-card__body" style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-gradient-plate)', color: '#fff', minHeight: 128 }}>
            <span aria-hidden="true" style={{ position: 'absolute', top: -30, right: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,.16)' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', position: 'relative' }}>
              <span style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85 }}>Net profit</span>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.9 }}><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg>
            </div>
            <div className="ax-num" style={{ position: 'relative', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, marginTop: 'var(--ax-space-3)' }}>$186K</div>
            <div className="ax-num" style={{ position: 'relative', fontSize: 'var(--ax-text-xs)', opacity: 0.92, marginTop: 2 }}>▲ 14.2% this quarter</div>
          </div>
        </div>
      </div>

      {/* CHART WIDGETS */}
      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-4)' }}>
        <span className="ax-card__eyebrow">Chart widgets</span>
        <span className="ax-badge ax-badge--soft ax-badge--pill">Live data</span>
      </div>
      <div className="ax-dash-grid" style={{ marginBottom: 'var(--ax-space-8)' }}>
        {/* area trend widget */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Sessions trend widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Sessions</h3>
              <p className="ax-card__subtitle">Last 7 days</p>
            </div>
            <span className="ax-kpi__delta ax-kpi__delta--up" style={{ fontSize: 'var(--ax-text-sm)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>6.4%</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>54.2K</div>
            <ApexChart type="area" height={120} legend="none" accent sparkline ariaLabel="Area sparkline of weekly sessions"
              series={[{ name: 'Sessions', data: [6100, 6800, 6400, 7500, 8200, 7800, 8600] }]} />
          </div>
        </section>

        {/* donut breakdown widget */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Sessions by device widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">By device</h3>
              <p className="ax-card__subtitle">Share of sessions</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Device widget options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="donut" height={200} legend="none" series={[58, 34, 8]}
              ariaLabel="Donut chart of sessions by device: desktop 58%, mobile 34%, tablet 8%"
              apex={{
                labels: ['Desktop', 'Mobile', 'Tablet'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '70%', labels: {
                  show: true,
                  name: { fontFamily: cv('--ax-font-sans') },
                  value: { fontFamily: cv('--ax-font-mono'), fontWeight: 600 },
                  total: { show: true, label: 'Sessions', formatter: () => '54.2K' },
                } } } },
              }} />
          </div>
        </section>

        {/* column widget */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Orders by month widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Orders / month</h3>
              <p className="ax-card__subtitle">Jan – Jun</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">1,248</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="bar" height={160} legend="none" accent ariaLabel="Column chart of orders per month"
              series={[{ name: 'Orders', data: [820, 910, 880, 1010, 1120, 1248] }]} />
          </div>
        </section>
      </div>

      {/* LIST & PROFILE WIDGETS */}
      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-4)' }}>
        <span className="ax-card__eyebrow">List & profile</span>
        <span className="ax-badge ax-badge--soft ax-badge--pill">People & products</span>
      </div>
      <div className="ax-dash-grid" style={{ marginBottom: 'var(--ax-space-8)' }}>
        {/* profile widget */}
        <section className="ax-card ax-col--4" role="region" aria-label="Team member profile widget">
          <div className="ax-card__body" style={{ textAlign: 'center' }}>
            <span className="ax-avatar ax-avatar--xl ax-avatar--squircle ax-avatar--ringed" style={{ marginInline: 'auto', background: 'color-mix(in oklab,var(--ax-accent) 18%,transparent)', color: 'var(--ax-accent)' }}>
              <span className="ax-avatar__initials" style={{ fontWeight: 'var(--ax-weight-semibold)' }}>AS</span>
              <span className="ax-avatar__status ax-avatar__status--online" aria-label="Online" />
            </span>
            <h3 style={{ margin: 'var(--ax-space-4) 0 0', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)' }}>Ava Sutton</h3>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Operations Lead · Northwind Labs</p>
            <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-3)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Active</span>
              <span className="ax-badge ax-badge--soft ax-badge--pill">San Francisco</span>
            </div>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-5) 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)' }}>
              <div><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)' }}>128</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Tasks</div></div>
              <div><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)' }}>24</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Projects</div></div>
              <div><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)' }}>96%</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>On time</div></div>
            </div>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block" style={{ marginTop: 'var(--ax-space-5)' }}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg>
              <span className="ax-btn__label">Message</span>
            </button>
          </div>
        </section>

        {/* top products list widget */}
        <section className="ax-card ax-col--4" role="region" aria-label="Top selling products widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Top products</h3>
              <p className="ax-card__subtitle">By units sold</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {TOP_PRODUCTS.map((p) => (
              <div key={p.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: `color-mix(in oklab,var(${p.color}) 18%,transparent)`, color: `var(${p.color})` }}>{p.icon}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div className="ax-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.cat}</div>
                </div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{p.price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* activity feed widget */}
        <section className="ax-card ax-col--4" role="region" aria-label="Recent activity widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Activity</h3>
              <p className="ax-card__subtitle">Across the workspace</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-timeline">
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Devon Okafor</b> closed <span style={{ color: 'var(--ax-accent)' }}>TSK-241</span></p><span className="ax-timeline__time">8m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M4 18l10 -10l3 3l-10 10l-3 0l0 -3" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Tomás Herrera</b> moved a deal to <span style={{ color: 'var(--ax-text)' }}>Negotiation</span></p><span className="ax-timeline__time">12m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Lena Brandt</b> uploaded illustrations</p><span className="ax-timeline__time">18m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 13l2 2l4 -4" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya Nair</b> exported the weekly report</p><span className="ax-timeline__time">1h ago</span></div>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* GOALS, RATING & MISC */}
      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-4)' }}>
        <span className="ax-card__eyebrow">Goals & meters</span>
        <span className="ax-badge ax-badge--soft ax-badge--pill">Progress</span>
      </div>
      <div className="ax-dash-grid">
        {/* radial goal widget */}
        <section className="ax-card ax-card--chart ax-col--3" role="region" aria-label="Monthly target progress widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Monthly target</h3>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, textAlign: 'center' }}>
            <ApexChart type="radialBar" height={220} legend="none" accent series={[72]}
              ariaLabel="Radial gauge showing 72% of monthly target reached"
              apex={{
                plotOptions: { radialBar: {
                  hollow: { size: '62%' },
                  track: { background: cv('--ax-border') },
                  dataLabels: {
                    name: { show: true, fontFamily: cv('--ax-font-sans'), color: cv('--ax-text-muted'), offsetY: 22, fontSize: '12px' },
                    value: { show: true, fontFamily: cv('--ax-font-mono'), color: cv('--ax-text-strong'), fontSize: '26px', fontWeight: 700, offsetY: -12, formatter: (v: number) => v + '%' },
                  },
                } },
                labels: ['Reached'],
              }} />
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$540K</b> of <span className="ax-num">$750K</span></p>
          </div>
        </section>

        {/* storage / quota meters */}
        <section className="ax-card ax-col--3" role="region" aria-label="Storage usage widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Storage</h3>
              <p className="ax-card__subtitle">62.4 GB of 100 GB</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {STORAGE.map((s) => (
              <div key={s.label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{s.label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{s.value}</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${s.pct}%`, background: s.color }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* rating / review widget */}
        <section className="ax-card ax-col--3" role="region" aria-label="Product rating widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Rating</h3>
              <p className="ax-card__subtitle">Aperture Desk Lamp</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1 }}>4.7</div>
              <div>
                <div className="ax-rating ax-rating--sm" role="img" aria-label="4.7 out of 5 stars">
                  <span className="ax-rating__star ax-rating__star--full">{STAR_FULL}</span>
                  <span className="ax-rating__star ax-rating__star--full">{STAR_FULL}</span>
                  <span className="ax-rating__star ax-rating__star--full">{STAR_FULL}</span>
                  <span className="ax-rating__star ax-rating__star--full">{STAR_FULL}</span>
                  <span className="ax-rating__star ax-rating__star--half">{STAR_HALF}</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span className="ax-num">212</span> reviews</p>
              </div>
            </div>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-4) 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['5', 72], ['4', 18], ['3', 7]].map(([n, pct]) => (
                <div key={n} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                  <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', width: 8 }}>{n}</span>
                  <div className="ax-progress ax-progress--xs" style={{ flex: 1 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${pct}%` }} /></div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* weather / status tile widget */}
        <section className="ax-card ax-col--3" role="region" aria-label="System status widget">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">System status</h3>
              <p className="ax-card__subtitle">All services</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Operational</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {STATUS_ROWS.map((r) => (
              <div key={r[0]} className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{r[0]}</span><span className={`ax-badge ax-badge--soft ax-badge--${r[2]} ax-badge--pill ax-num`}>{r[1]}</span></div>
            ))}
            <div className="ax-divider" style={{ margin: 'var(--ax-space-1) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Avg. uptime · 90 days</span><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }}>99.6%</b></div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Widgets;
