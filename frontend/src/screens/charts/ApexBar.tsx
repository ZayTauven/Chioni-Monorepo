'use client';
/*
 * Vireo Next.js — Bar & Column Charts (charts/apex-bar). Faithful port of
 * src/html/charts/apex-bar.html: basic column hero (Chart/Table tabs), horizontal
 * bar, grouped, stacked, data-labelled and negative-variance columns via <ApexChart>.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const DOTS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
);
const ORDERS = [['Jan', '820'], ['Feb', '910'], ['Mar', '880'], ['Apr', '1,010'], ['May', '1,120'], ['Jun', '1,248']] as const;

export function ApexBar() {
  const [tab, setTab] = useState<'chart' | 'table'>('chart');
  return (
    <>
      <PageHead
        title="Bar & Column Charts"
        subtitle="ApexCharts bar family — basic columns, grouped, stacked, horizontal and data-labelled variants with 4px corner radius."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="https://apexcharts.com/docs/chart-types/bar-chart/" target="_blank" rel="noopener">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5" /><path d="M3 16h5v5" /><path d="M3 21l5 -5" /></svg>
              <span className="ax-btn__label">Docs</span>
            </a>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export all</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" /><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" /><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" /><path d="M4 20h14" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* BASIC COLUMN hero */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Basic column chart of orders by month">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Basic · vertical column</span>
              <h2 className="ax-card__title">Orders by Month</h2>
              <p className="ax-card__subtitle">Single-series columns with a 4px top radius</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="tablist" aria-label="View mode">
                <button type="button" className={`ax-btn ax-btn--sm${tab === 'chart' ? ' is-selected' : ''}`} onClick={() => setTab('chart')} aria-selected={tab === 'chart'} role="tab">Chart</button>
                <button type="button" className={`ax-btn ax-btn--sm${tab === 'table' ? ' is-selected' : ''}`} onClick={() => setTab('table')} aria-selected={tab === 'table'} role="tab">Table</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {tab === 'chart' && (
              <ApexChart type="bar" height={330} legend="none" accent ariaLabel="Column chart of orders by month, peak 1,248 in June"
                series={[{ name: 'Orders', data: [820, 910, 880, 1010, 1120, 1248] }]}
                apex={{ plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '48%' } }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] } }} />
            )}
            {tab === 'table' && (
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--compact">
                  <caption className="ax-visually-hidden">Orders by month, January to June</caption>
                  <thead className="ax-table__head"><tr><th className="ax-table__th" scope="col">Month</th><th className="ax-table__th ax-table__th--num" scope="col">Orders</th></tr></thead>
                  <tbody>{ORDERS.map(([m, v]) => (<tr key={m} className="ax-table__row"><td className="ax-table__td">{m}</td><td className="ax-table__td ax-table__td--num">{v}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* HORIZONTAL BAR */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Horizontal bar chart of top selling products">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Horizontal</span>
              <h2 className="ax-card__title">Top Products</h2>
              <p className="ax-card__subtitle">Units sold, ranked</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="bar" height={300} legend="none" ariaLabel="Horizontal bar chart of top selling products by units sold"
              series={[{ name: 'Units', data: [540, 331, 298, 241, 212] }]}
              apex={{ colors: [cv('--ax-viz-cyan')], plotOptions: { bar: { horizontal: true, borderRadius: 4, borderRadiusApplication: 'end', barHeight: '58%', distributed: false } }, xaxis: { categories: ['Matte Mug', 'Grid Notebook', 'Desk Lamp', 'Laptop Sleeve', 'Brass Light'] } }} />
          </div>
        </section>

        {/* GROUPED COLUMN */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Grouped column chart of revenue versus target">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Grouped</span>
              <h2 className="ax-card__title">Revenue vs. Target</h2>
              <p className="ax-card__subtitle">Side-by-side columns per quarter</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Actual</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Target</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="bar" height={300} legend="none" ariaLabel="Grouped column chart comparing actual revenue against target by quarter"
              series={[{ name: 'Actual', data: [142, 168, 191, 214] }, { name: 'Target', data: [150, 160, 185, 205] }]}
              apex={{ colors: [cv('--ax-accent'), cv('--ax-viz-cyan')], plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '62%' } }, xaxis: { categories: ['Q1', 'Q2', 'Q3', 'Q4'] }, yaxis: { labels: { formatter: (v: number) => '$' + v + 'K' } } }} />
          </div>
        </section>

        {/* STACKED COLUMN */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Stacked column chart of order status by month">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Stacked</span>
              <h2 className="ax-card__title">Order Status</h2>
              <p className="ax-card__subtitle">Delivered, shipped and processing per month</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-emerald)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Delivered</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Shipped</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-amber)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Processing</small></span>
            </div>
            <ApexChart type="bar" height={300} legend="none" stacked ariaLabel="Stacked column chart of order status counts by month"
              series={[{ name: 'Delivered', data: [320, 360, 340, 410, 460, 520] }, { name: 'Shipped', data: [140, 160, 150, 180, 210, 240] }, { name: 'Processing', data: [80, 90, 100, 110, 130, 150] }]}
              apex={{ colors: [cv('--ax-viz-emerald'), cv('--ax-viz-cyan'), cv('--ax-viz-amber')], plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'last', columnWidth: '52%' } }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] } }} />
          </div>
        </section>

        {/* COLUMN WITH DATA LABELS */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Column chart with data labels for revenue by category">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">With data labels</span>
              <h2 className="ax-card__title">Revenue by Category</h2>
              <p className="ax-card__subtitle">Values printed on each column for quick scanning</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Category revenue options">{DOTS}</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="bar" height={320} legend="none" ariaLabel="Column chart with data labels of revenue by product category"
              series={[{ name: 'Revenue', data: [238, 184, 142, 96, 71, 48] }]}
              apex={{
                colors: [cv('--ax-viz-violet')],
                plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '50%', distributed: false, dataLabels: { position: 'top' } } },
                dataLabels: { enabled: true, formatter: (v: number) => '$' + v + 'K', offsetY: -18, style: { fontSize: '11px', fontFamily: cv('--ax-font-mono'), colors: [cv('--ax-text-muted')] } },
                xaxis: { categories: ['Lighting', 'Desk', 'Drinkware', 'Storage', 'Stationery', 'Tech'] },
                yaxis: { labels: { formatter: (v: number) => '$' + v + 'K' } },
              }} />
          </div>
        </section>

        {/* NEGATIVE COLUMN */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Column chart with positive and negative budget variance">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Negative values</span>
              <h2 className="ax-card__title">Budget Variance</h2>
              <p className="ax-card__subtitle">Over and under per team</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="bar" height={280} legend="none" ariaLabel="Column chart of budget variance, positive above and negative below the baseline"
              series={[{ name: 'Variance', data: [4.2, -1.8, 2.6, -3.1, 1.4, -0.9] }]}
              apex={{
                colors: [cv('--ax-viz-cyan')],
                plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '54%', colors: { ranges: [{ from: -100, to: 0, color: cv('--ax-danger-500') }, { from: 0, to: 100, color: cv('--ax-success-500') }] } } },
                xaxis: { categories: ['Eng', 'Sales', 'Ops', 'Mktg', 'CS', 'Fin'] },
                yaxis: { labels: { formatter: (v: number) => (v > 0 ? '+' : '') + v + 'K' } },
                annotations: { yaxis: [{ y: 0, borderColor: cv('--ax-border-strong'), strokeDashArray: 4 }] },
                tooltip: { y: { formatter: (v: number) => (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toFixed(1) + 'K' } },
              }} />
          </div>
        </section>
      </div>
    </>
  );
}

export default ApexBar;
