'use client';
/*
 * Vireo Next.js — eCommerce dashboard (route "dashboards/ecommerce").
 *
 * Faithful re-expression of src/html/dashboards/ecommerce.html: 4 KPI cards, a
 * Revenue & Orders mixed chart, Sales by Category donut, Sales by Channel bars,
 * Inventory Status, Top Products, a Recent Orders table and a Low-Stock + Top
 * Customers column. Charts via <ApexChart>; DOM/classes/copy/ARIA match 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const VIZ_FALLBACK: Record<string, string> = {
  '--ax-accent': '#2DD4BF',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
};
function tokenColors(tokens: string[]): string[] {
  if (typeof document === 'undefined') return tokens.map((t) => VIZ_FALLBACK[t] || '#38BDF8');
  const cs = getComputedStyle(document.documentElement);
  return tokens.map((t) => cs.getPropertyValue(t).trim() || VIZ_FALLBACK[t] || '#38BDF8');
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);
const WARN_ICON = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
);

export function Ecommerce() {
  return (
    <>
      <PageHead
        title="eCommerce"
        subtitle="Store performance, orders & merchandising — last 30 days."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></svg>
              <span className="ax-btn__label">Last 30 days</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Refresh dashboard">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add product</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total Sales $142,800, up 9.8%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}9.8%</span>
            </div>
            <div className="ax-kpi__label">Total Sales</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">$142,800</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [6, 10, 9, 16, 19, 23, 27, 30] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Orders 4,612, up 4.5%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}4.5%</span>
            </div>
            <div className="ax-kpi__label">Orders</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">4,612</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-cyan" series={[{ name: 'Trend', data: [8, 11, 10, 15, 17, 20, 23, 27] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Average Order Value $30.96, up 1.2%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}1.2%</span>
            </div>
            <div className="ax-kpi__label">Avg. Order Value</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">$30.96</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-violet" series={[{ name: 'Trend', data: [13, 15, 12, 18, 16, 21, 19, 23] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Cart Abandonment 68.4 percent, down 1.8 percent which is an improvement">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19m0 1a1 1 0 0 0 1 1h.01" /><path d="M6 5h14l-2 7h-12" /><path d="M3 3h2l.5 2" /><path d="M17 17h-11v-4" /><path d="M9 17m-1 0a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M16 17m-1 0a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_DN}1.8%</span>
            </div>
            <div className="ax-kpi__label">Cart Abandonment</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">68.4%</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-emerald" series={[{ name: 'Trend', data: [25, 22, 23, 20, 18, 16, 12, 9] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* HERO: Revenue & Orders (mixed) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Revenue and orders">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Performance</span>
              <h2 className="ax-card__title">Revenue &amp; Orders</h2>
              <p className="ax-card__subtitle">Monthly revenue against order volume</p>
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
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Revenue</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Orders</small></span>
            </div>
            <ApexChart
              type="line"
              height={320}
              legend="none"
              ariaLabel="Mixed chart of monthly revenue area and order volume columns"
              series={[
                { name: 'Revenue', type: 'line', data: [82000, 91000, 88000, 99000, 108000, 104000, 118000, 124000, 121000, 132000, 138000, 142800] },
                { name: 'Orders', type: 'column', data: [2900, 3200, 3100, 3500, 3800, 3700, 4100, 4300, 4200, 4500, 4600, 4612] },
              ]}
              apex={{
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan']),
                stroke: { width: [2.5, 0], curve: 'smooth' },
                fill: { type: ['solid', 'solid'], opacity: [1, 1] },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '46%' } },
                yaxis: [
                  { labels: { formatter: (v: number) => '$' + (v / 1000).toFixed(0) + 'K' } },
                  { opposite: true, labels: { formatter: (v: number) => (v / 1000).toFixed(1) + 'K' } },
                ],
                xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
              }}
            />
          </div>
        </section>

        {/* Sales by Category donut */}
        <section className="ax-card ax-col--4" role="region" aria-label="Sales by category">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Sales by Category</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={230}
              legend="none"
              ariaLabel="Donut chart of sales by category: apparel 34%, electronics 27%, home 21%, beauty 12%, other 6%"
              series={[34, 27, 21, 12, 6]}
              apex={{
                labels: ['Apparel', 'Electronics', 'Home', 'Beauty', 'Other'],
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Net sales', formatter: () => '$142.8K' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'Apparel', color: 'var(--ax-accent)', val: '$48.6K' },
                { label: 'Electronics', color: 'var(--ax-viz-cyan)', val: '$38.5K' },
                { label: 'Home & Living', color: 'var(--ax-viz-violet)', val: '$30.0K' },
                { label: 'Beauty', color: 'var(--ax-viz-pink)', val: '$17.1K' },
                { label: 'Other', color: 'var(--ax-viz-amber)', val: '$8.6K' },
              ].map((c) => (
                <li key={c.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{c.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{c.val}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sales by Channel */}
        <section className="ax-card ax-col--4" role="region" aria-label="Sales by channel">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Sales by Channel</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {[
              { label: 'Web store', val: '$71.4K · 50%', pct: '50%', color: 'var(--ax-accent)' },
              { label: 'Mobile app', val: '$38.6K · 27%', pct: '27%', color: 'var(--ax-viz-cyan)' },
              { label: 'Marketplace', val: '$22.8K · 16%', pct: '16%', color: 'var(--ax-viz-violet)' },
              { label: 'POS / in-store', val: '$10.0K · 7%', pct: '7%', color: 'var(--ax-viz-pink)' },
            ].map((c) => (
              <div key={c.label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{c.label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{c.val}</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: c.pct, background: c.color }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* Inventory Status */}
        <section className="ax-card ax-col--4" role="region" aria-label="Inventory status">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Inventory Status</h2><p className="ax-card__subtitle">3,210 SKUs tracked</p></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', height: 14, borderRadius: 'var(--ax-radius-pill)', overflow: 'hidden', marginBottom: 'var(--ax-space-4)' }}>
              <span style={{ width: '78%', background: 'var(--ax-viz-emerald)' }} aria-hidden="true" />
              <span style={{ width: '15%', background: 'var(--ax-viz-amber)' }} aria-hidden="true" />
              <span style={{ width: '7%', background: 'var(--ax-viz-red)' }} aria-hidden="true" />
            </div>
            <ul className="ax-list ax-list--compact">
              {[
                { label: 'In stock', color: 'var(--ax-viz-emerald)', val: '2,504' },
                { label: 'Low stock', color: 'var(--ax-viz-amber)', val: '481' },
                { label: 'Out of stock', color: 'var(--ax-viz-red)', val: '225' },
              ].map((s) => (
                <li key={s.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{s.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{s.val}</span>
                </li>
              ))}
            </ul>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-3) 0' }} />
            <div className="ax-alert ax-alert--warning" role="status">
              <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
              <div className="ax-alert__content"><p className="ax-alert__message">14 SKUs below reorder threshold.</p></div>
            </div>
          </div>
        </section>

        {/* Top Products */}
        <section className="ax-card ax-col--4" role="region" aria-label="Top products">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Top Products</h2></div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4.5 0" /><path d="M3 6l9 0" /><path d="M3 12l9 0" /><path d="M14 6l6 0l0 13l-6 0z" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Aurora Wireless Buds</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Electronics · 1,204 sold</div>
                <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '94%' }} /></div></div>
              </div>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$129</div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M2 8l10 6l10 -6" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Linen Oversized Tee</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Apparel · 982 sold</div>
                <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '77%' }} /></div></div>
              </div>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$42</div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l-4 4l4 4" /><path d="M5 15h11a4 4 0 0 0 0 -8h-1" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Hydra Glow Serum</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Beauty · 854 sold</div>
                <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '66%' }} /></div></div>
              </div>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$38</div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 11v4" /><path d="M15 11v4" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Matte Ceramic Planter</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Home · 611 sold</div>
                <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '48%' }} /></div></div>
              </div>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$28</div>
            </div>
          </div>
        </section>

        {/* Recent Orders table */}
        <section className="ax-card ax-col--8" role="region" aria-label="Recent orders">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Orders</h2>
              <p className="ax-card__subtitle">Latest store orders</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All orders</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: '#AX-10428', cust: 'Camila Rossi', items: '3 items', date: 'Jun 12', total: '$312.00', status: 'Delivered', tone: 'success' },
                  { id: '#AX-10427', cust: 'Henry Whitlock', items: '1 item', date: 'Jun 12', total: '$129.00', status: 'Shipped', tone: 'info' },
                  { id: '#AX-10426', cust: 'Aiko Tanaka', items: '5 items', date: 'Jun 11', total: '$486.40', status: 'Processing', tone: 'warning' },
                  { id: '#AX-10425', cust: 'Mateo Alvarez', items: '2 items', date: 'Jun 11', total: '$84.00', status: 'Delivered', tone: 'success' },
                  { id: '#AX-10424', cust: 'Sofia Lindqvist', items: '4 items', date: 'Jun 10', total: '$218.50', status: 'Refunded', tone: 'danger' },
                  { id: '#AX-10423', cust: 'Daniel Cho', items: '1 item', date: 'Jun 10', total: '$38.00', status: 'Delivered', tone: 'success' },
                ].map((o) => (
                  <tr key={o.id} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{o.id}</td>
                    <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{o.cust}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{o.items}</div></td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{o.date}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{o.total}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${o.tone} ax-badge--pill`}><span className="ax-badge__dot" />{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Low-Stock Alerts + Top Customers */}
        <section className="ax-card ax-col--4" role="region" aria-label="Low stock alerts">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Low-Stock Alerts</h2></div>
            <a className="ax-btn ax-btn--link" href="#">Restock</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-warning-500) 20%,transparent)', color: 'var(--ax-warning-500)' }}>{WARN_ICON}</span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Hydra Glow Serum</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>SKU BTY-2210</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--warning">8 left</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-danger-500) 20%,transparent)', color: 'var(--ax-danger-500)' }}>{WARN_ICON}</span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Aurora Wireless Buds</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>SKU ELC-0042</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--danger">2 left</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-warning-500) 20%,transparent)', color: 'var(--ax-warning-500)' }}>{WARN_ICON}</span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Linen Oversized Tee — M</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>SKU APP-1180</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--warning">11 left</span></span>
              </li>
            </ul>
            <div className="ax-card__header" style={{ borderTop: '1px solid var(--ax-border)' }}>
              <div className="ax-card__titles"><h2 className="ax-card__title">Top Customers</h2></div>
            </div>
            <ul className="ax-list ax-list--compact">
              {[
                { initials: 'CR', name: 'Camila Rossi', orders: '28 orders', total: '$4,210', color: 'var(--ax-accent)' },
                { initials: 'AT', name: 'Aiko Tanaka', orders: '22 orders', total: '$3,684', color: 'var(--ax-viz-cyan)' },
                { initials: 'SL', name: 'Sofia Lindqvist', orders: '19 orders', total: '$2,940', color: 'var(--ax-viz-violet)' },
              ].map((c) => (
                <li key={c.initials} className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${c.color} 22%,transparent)`, color: c.color, fontWeight: 600 }}>{c.initials}</span></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{c.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.orders}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{c.total}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Ecommerce;
