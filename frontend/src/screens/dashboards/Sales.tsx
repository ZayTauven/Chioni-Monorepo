'use client';
/*
 * Vireo Next.js — Sales dashboard (route "/").
 *
 * Faithful re-expression of src/html/dashboards/sales.html: 4 KPI cards with
 * spark lines, the Sales Statistics area chart + Total Balance gradient plate,
 * a Session-by-device donut, top products, traffic source bars, a recent
 * transactions table and an activity timeline. Charts go through <ApexChart>
 * (effect-guarded, token-themed). DOM classes match the reference 1:1.
 *
 * Client component: it reads live --ax-* tokens for the donut palette and
 * mounts imperative ApexCharts, both browser-only.
 */
import type { ReactElement } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

/* Resolve --ax-viz-* tokens to concrete hex for ApexCharts. SSR-safe: on the
   server (no `document`) it returns canonical Aurora fallbacks, then the chart's
   own live re-theme (ax:change) repaints with the real tokens after hydration. */
const VIZ_FALLBACK: Record<string, string> = {
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
};
function vizColors(tokens: string[]): string[] {
  if (typeof document === 'undefined') return tokens.map((t) => VIZ_FALLBACK[t] || '#38BDF8');
  const cs = getComputedStyle(document.documentElement);
  return tokens.map((t) => cs.getPropertyValue(t).trim() || VIZ_FALLBACK[t] || '#38BDF8');
}

const ICON_CAL = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></svg>
);
const ICON_CHEV = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);
const ICON_EXPORT = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
);
const ICON_PLUS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
);
const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);
const PRODUCT_ICON = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg>
);

interface Kpi {
  icon: string;
  iconClass: string;
  delta: string;
  up: boolean;
  label: string;
  value: string;
  color: string;
  spark: number[];
  region: string;
}
const KPIS: Kpi[] = [
  { iconClass: 'c1', up: true, delta: '12.4%', label: 'Total Revenue', value: '$748.2K', color: '--ax-accent', spark: [6, 9, 8, 16, 19, 23, 28, 30], region: 'Total Revenue $748.2K, up 12.4%', icon: 'rev' },
  { iconClass: 'c2', up: false, delta: '3.1%', label: 'Total Customers', value: '3,920', color: '--ax-viz-cyan', spark: [26, 23, 22, 18, 16, 13, 10, 7], region: 'Total Customers 3,920, down 3.1%', icon: 'cust' },
  { iconClass: 'c3', up: true, delta: '2.0%', label: 'Total Products', value: '1,204', color: '--ax-viz-violet', spark: [10, 15, 13, 20, 17, 24, 21, 27], region: 'Total Products 1,204, up 2.0%', icon: 'prod' },
  { iconClass: 'c4', up: false, delta: '3.2%', label: 'Total Transactions', value: '9,812', color: '--ax-viz-amber', spark: [25, 22, 24, 19, 21, 15, 17, 11], region: 'Total Transactions 9,812, down 3.2%', icon: 'txn' },
];

const KPI_ICONS: Record<string, ReactElement> = {
  rev: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg>,
  cust: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>,
  prod: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /><path d="M16 5.25l-8 4.5" /></svg>,
  txn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2" /></svg>,
};

const PRODUCTS = [
  { color: '#38BDF8', name: 'Brass Task Light', cat: 'Lighting · 412 sold', pct: 92, price: '$182' },
  { color: '#A78BFA', name: 'Aperture Desk Lamp', cat: 'Lighting · 356 sold', pct: 78, price: '$129' },
  { color: '#F472B6', name: 'Matte Ceramic Mug', cat: 'Drinkware · 298 sold', pct: 64, price: '$24' },
  { color: '#FBBF24', name: 'Walnut Monitor Riser', cat: 'Desk · 241 sold', pct: 52, price: '$96' },
];

const TRAFFIC = [
  { label: 'Direct', pct: 38, color: 'var(--ax-accent)' },
  { label: 'Organic search', pct: 27, color: 'var(--ax-viz-cyan)' },
  { label: 'Referral', pct: 14, color: 'var(--ax-viz-violet)' },
  { label: 'Social', pct: 9, color: 'var(--ax-viz-pink)' },
  { label: 'Email', pct: 7, color: 'var(--ax-viz-amber)' },
  { label: 'Paid', pct: 5, color: 'var(--ax-viz-emerald)' },
];

const DEVICES = [
  { label: 'Desktop', pct: '58%', color: '#38BDF8' },
  { label: 'Mobile', pct: '34%', color: '#A78BFA' },
  { label: 'Tablet', pct: '8%', color: '#F472B6' },
];

export function Sales() {
  return (
    <>
      <PageHead
        title="Sales"
        subtitle="Here's how revenue is tracking — Jul 2025 to Jun 2026."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              {ICON_CAL}
              <span className="ax-btn__label">Last 30 days</span>
              {ICON_CHEV}
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              {ICON_EXPORT}
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              {ICON_PLUS}
              <span className="ax-btn__label">New report</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        {KPIS.map((k) => (
          <div key={k.label} className="ax-card ax-kpi ax-col--3" role="region" aria-label={k.region}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${k.iconClass}`}>{KPI_ICONS[k.icon]}</span>
                <span className={`ax-kpi__delta ax-kpi__delta--${k.up ? 'up' : 'down'}`}>
                  {k.up ? ARROW_UP : ARROW_DN}
                  {k.delta}
                </span>
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num">{k.value}</div>
                <ApexChart
                  className="ax-kpi__spark"
                  type="line"
                  sparkline
                  tooltip={false}
                  height={40}
                  color={k.color}
                  series={[{ name: 'Trend', data: k.spark }]}
                  style={{ minHeight: 40 }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* HERO: Sales Statistics (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Sales Statistics">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Performance</span>
              <h2 className="ax-card__title">Sales Statistics</h2>
              <p className="ax-card__subtitle">Monthly revenue vs. previous period</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Week</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">Month</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Year</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>This period</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Previous period</small></span>
            </div>
            <ApexChart
              type="area"
              height={320}
              legend="none"
              accent
              ariaLabel="Area chart of monthly revenue versus the previous period"
              series={[
                { name: 'This period', data: [42100, 48300, 45200, 53400, 57100, 55600, 62400, 60200, 68900, 72300, 70100, 74820] },
                { name: 'Previous period', data: [38400, 41200, 43800, 47100, 50600, 53200, 54900, 58300, 61400, 64800, 67200, 69500] },
              ]}
              apex={{ xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] } }}
            />
          </div>
        </section>

        {/* Total Balance (4) */}
        <section className="ax-card ax-card--balance ax-col--4" role="region" aria-label="Total Balance">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Total Balance</h2></div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Currency">
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">USD</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">GBP</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">EUR</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', background: 'var(--ax-gradient-plate)', boxShadow: 'var(--ax-shadow-md)', color: '#fff', minHeight: 172, display: 'flex', flexDirection: 'column' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.18)', filter: 'blur(6px)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', bottom: -50, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', position: 'relative' }}>
                <b style={{ fontFamily: 'var(--ax-font-display)', letterSpacing: '.02em', color: 'inherit' }}>Vireo</b>
                <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.9 }}><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2" /></svg>
              </div>
              <div style={{ marginTop: 'auto', position: 'relative' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85 }}>Available balance</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>$48,210.00</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', letterSpacing: '.12em', opacity: 0.92, marginTop: 'var(--ax-space-3)' }}>4921&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;7045</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--solid ax-btn--block">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                <span className="ax-btn__label">Send</span>
              </button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M18 13l-6 6" /><path d="M6 13l6 6" /></svg>
                <span className="ax-btn__label">Request</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Income</small><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-md)' }}>+$12,480</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Spend</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>$5,210</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Saved</small><b className="ax-num" style={{ color: 'var(--ax-viz-cyan)', fontSize: 'var(--ax-text-md)' }}>$7,270</b></div>
            </div>
          </div>
        </section>

        {/* SECONDARY: Device donut (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Session by device">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Session By Device</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Device session options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={230}
              legend="none"
              ariaLabel="Donut chart of sessions by device: desktop 58%, mobile 34%, tablet 8%"
              series={[58, 34, 8]}
              apex={{
                labels: ['Desktop', 'Mobile', 'Tablet'],
                colors: vizColors(['--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink']),
                stroke: { width: 0 },
                plotOptions: {
                  pie: {
                    donut: {
                      size: '72%',
                      labels: {
                        show: true,
                        value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 },
                        total: { show: true, label: 'Sessions', formatter: () => '54.2K' },
                      },
                    },
                  },
                },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {DEVICES.map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Top Selling Products (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Top selling products">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Top Selling Products</h2></div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {PRODUCTS.map((p) => (
              <div key={p.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.color} 18%,transparent)`, color: p.color }}>{PRODUCT_ICON}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.cat}</div>
                  <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${p.pct}%` }} /></div></div>
                </div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{p.price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Traffic Source (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Traffic source">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Traffic Source</h2></div>
            <a className="ax-btn ax-btn--link" href="#">Report</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {TRAFFIC.map((t) => (
              <div key={t.label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{t.label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{t.pct}%</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${t.pct}%`, background: t.color }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM: Recent Transactions (8) */}
        <section className="ax-card ax-col--8" role="region" aria-label="Recent transactions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Transactions</h2>
              <p className="ax-card__subtitle">Latest payments &amp; payouts</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Merchant</th>
                  <th className="ax-table__th" scope="col">Category</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <TxnRow color="#34D399" name="Camila Rossi" sub="Stripe" cat="Order payment" date="Jun 12" amount="+$312.00" amountColor="var(--ax-viz-emerald)" status="Completed" tone="success" />
                <TxnRow color="#A78BFA" name="Linear" sub="Subscription" cat="Software" date="Jun 11" amount="−$84.00" amountColor="var(--ax-text)" status="Completed" tone="success" />
                <TxnRow color="#34D399" name="Henry Whitlock" sub="Stripe" cat="Order payment" date="Jun 12" amount="+$129.00" amountColor="var(--ax-viz-emerald)" status="Completed" tone="success" />
                <TxnRow color="#FB7185" name="Payroll — June" sub="Gusto" cat="Payroll" date="Jun 10" amount="−$18,400.00" amountColor="var(--ax-text)" status="Completed" tone="success" />
                <TxnRow color="#FBBF24" name="Pulse Ads" sub="Google Ads" cat="Marketing" date="Jun 12" amount="−$640.00" amountColor="var(--ax-text)" status="Pending" tone="warning" />
                <TxnRow color="#FB7185" name="Daniel Cho" sub="Stripe" cat="Order payment" date="Jun 9" amount="+$24.00" amountColor="var(--ax-text)" status="Failed" tone="danger" />
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Activity (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Recent activity">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Recent Activity</h2></div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-timeline">
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Devon Okafor</b> closed task <span style={{ color: 'var(--ax-accent)' }}>TSK-241</span></p><span className="ax-timeline__time">8m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Lena Brandt</b> uploaded empty-state illustrations</p><span className="ax-timeline__time">18m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M4 18l10 -10l3 3l-10 10l-3 0l0 -3" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Tomás Herrera</b> moved deal to <span style={{ color: 'var(--ax-text)' }}>Negotiation</span></p><span className="ax-timeline__time">12m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 13l2 2l4 -4" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya Nair</b> exported the weekly report</p><span className="ax-timeline__time">1h ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-pink)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14l1 0a2 2 0 0 1 2 2a1 1 0 0 0 1 1h1a2 2 0 0 0 2 -2v-1a2 2 0 0 1 2 -2h1" /><path d="M5 8a4 4 0 0 1 4 -4h6a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-6a4 4 0 0 1 -4 -4z" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Ava Sutton</b> created invoice <span style={{ color: 'var(--ax-accent)' }}>INV-2025-0118</span></p><span className="ax-timeline__time">1d ago</span></div>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

function TxnRow({
  color, name, sub, cat, date, amount, amountColor, status, tone,
}: {
  color: string; name: string; sub: string; cat: string; date: string;
  amount: string; amountColor: string; status: string; tone: string;
}) {
  return (
    <tr className="ax-table__row">
      <td className="ax-table__td">
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${color} 18%,transparent)`, color }}>
            <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg>
          </span>
          <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{sub}</div></div>
        </div>
      </td>
      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{cat}</td>
      <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{date}</td>
      <td className="ax-table__td ax-table__td--num" style={{ color: amountColor }}>{amount}</td>
      <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${tone} ax-badge--pill`}><span className="ax-badge__dot" />{status}</span></td>
    </tr>
  );
}

export default Sales;
