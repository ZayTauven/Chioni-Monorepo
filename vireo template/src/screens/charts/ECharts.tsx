'use client';
/*
 * Vireo Next.js — ECharts Gallery (charts/echarts). Faithful port of
 * src/html/charts/echarts.html: gauges, force-graph (bubble), funnel (progress
 * bars), treemap, heatmap, radial and scatter — all rendered through the shared
 * Apex wrapper (the reference proves palette parity, not the ECharts runtime).
 */
import type { ApexOptions } from 'apexcharts';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const DOTS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
);

function Gauge({ id, val, color, label }: { id: string; val: number; color: string; label: string }) {
  return (
    <ApexChart type="radialBar" height={300} legend="none" ariaLabel={`Gauge showing ${label} at ${val} percent`}
      series={[val]}
      apex={{
        colors: [color],
        plotOptions: { radialBar: { startAngle: -135, endAngle: 135, hollow: { size: '60%' }, track: { background: cv('--ax-surface-subtle'), strokeWidth: '100%' }, dataLabels: { name: { offsetY: 26, color: cv('--ax-text-muted'), fontFamily: cv('--ax-font-sans'), fontSize: '13px' }, value: { offsetY: -8, color: cv('--ax-text-strong'), fontFamily: cv('--ax-font-mono'), fontSize: '28px', fontWeight: 700, formatter: (v: number) => v + '%' } } } },
        labels: [label],
        stroke: { lineCap: 'round' },
      }} />
  );
}

const FUNNEL = [
  ['Visited', '12,480', 100, '--ax-chart-1'],
  ['Signed up', '4,310', 69, '--ax-chart-2'],
  ['Activated', '2,640', 51, '--ax-chart-3'],
  ['Subscribed', '1,180', 34, '--ax-chart-4'],
  ['Renewed', '820', 23, '--ax-chart-5'],
] as const;

export function ECharts() {
  return (
    <>
      <PageHead
        title="ECharts Gallery"
        subtitle="Gauge, graph & treemap — the heavyweight visualizations, rendered in the same Aurora chrome."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M3.6 9h16.8" /><path d="M3.6 15h16.8" /><path d="M11.5 3a17 17 0 0 0 0 18" /><path d="M12.5 3a17 17 0 0 1 0 18" /></svg>
              <span className="ax-btn__label">Docs</span>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Gauges */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Server health gauge">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Gauge</span><h2 className="ax-card__title">Server Health</h2></div>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Healthy</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}><Gauge id="ec-gauge-1" val={82} color={cv('--ax-success-500')} label="Healthy" /></div>
        </section>

        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="SLA attainment gauge">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Gauge</span><h2 className="ax-card__title">SLA Attainment</h2></div>
            <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><span className="ax-badge__dot" />Watch</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}><Gauge id="ec-gauge-2" val={67} color={cv('--ax-warning-500')} label="SLA met" /></div>
        </section>

        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Multi-metric radial gauge">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Multi gauge</span><h2 className="ax-card__title">Capacity</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="radialBar" height={300} legend="none" ariaLabel="Radial gauge of CPU, memory and disk capacity"
              series={[78, 64, 41]}
              apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3')], labels: ['CPU', 'Memory', 'Disk'], plotOptions: { radialBar: { hollow: { size: '40%' }, track: { background: cv('--ax-surface-subtle') }, dataLabels: { name: { fontFamily: cv('--ax-font-sans'), color: cv('--ax-text-muted') }, value: { fontFamily: cv('--ax-font-mono'), color: cv('--ax-text-strong'), fontWeight: 600 }, total: { show: true, label: 'Avg', formatter: () => '61%' } } } }, stroke: { lineCap: 'round' } }} />
          </div>
        </section>

        {/* Graph (force) — bubble + SVG edges */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Service dependency graph">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Graph · force</span>
              <h2 className="ax-card__title">Service Dependencies</h2>
              <p className="ax-card__subtitle">Node size = traffic · edges = calls between services</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Graph options">{DOTS}</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, position: 'relative' }}>
            <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 'var(--ax-space-5) var(--ax-space-5) 0', width: 'calc(100% - var(--ax-space-5) * 2)', height: 300, pointerEvents: 'none', opacity: 0.5 }}>
              <line x1="50" y1="30" x2="22" y2="14" stroke="var(--ax-border-strong)" strokeWidth="0.5" />
              <line x1="50" y1="30" x2="80" y2="16" stroke="var(--ax-border-strong)" strokeWidth="0.5" />
              <line x1="50" y1="30" x2="26" y2="48" stroke="var(--ax-border-strong)" strokeWidth="0.5" />
              <line x1="50" y1="30" x2="78" y2="46" stroke="var(--ax-border-strong)" strokeWidth="0.5" />
              <line x1="22" y1="14" x2="26" y2="48" stroke="var(--ax-border-strong)" strokeWidth="0.5" />
              <line x1="80" y1="16" x2="78" y2="46" stroke="var(--ax-border-strong)" strokeWidth="0.5" />
            </svg>
            <div style={{ position: 'relative' }}>
              <ApexChart type="bubble" height={300} legend="bottom" ariaLabel="Network graph of service dependencies"
                series={[{ name: 'Gateway', data: [[50, 30, 40]] }, { name: 'Auth', data: [[22, 46, 22]] }, { name: 'Orders', data: [[80, 44, 28]] }, { name: 'Catalog', data: [[26, 12, 24]] }, { name: 'Payments', data: [[78, 14, 26]] }]}
                apex={{ colors: [cv('--ax-accent'), cv('--ax-chart-2'), cv('--ax-chart-1'), cv('--ax-chart-4'), cv('--ax-chart-3')], fill: { opacity: 0.82 }, dataLabels: { enabled: false }, xaxis: { min: 0, max: 100, tickAmount: 5, labels: { show: false }, axisBorder: { show: false } }, yaxis: { min: 0, max: 60, labels: { show: false } }, grid: { xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } } }} />
            </div>
          </div>
        </section>

        {/* Funnel */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Conversion funnel">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Funnel</span><h2 className="ax-card__title">Signup Funnel</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {FUNNEL.map(([label, value, pct, color]) => (
              <div key={label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{value}</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${pct}%`, background: `var(${color})` }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* Treemap */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Revenue treemap by category and product">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Treemap</span>
              <h2 className="ax-card__title">Revenue by Product</h2>
              <p className="ax-card__subtitle">Tile area = revenue share · Aperture Goods catalogue</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="treemap" height={320} legend="none" ariaLabel="Treemap of revenue by product"
              series={[{ data: [
                { x: 'Brass Task Light', y: 284 }, { x: 'Aperture Desk Lamp', y: 246 }, { x: 'Matte Ceramic Mug', y: 188 },
                { x: 'Walnut Monitor Riser', y: 164 }, { x: 'Stoneware Carafe', y: 132 }, { x: 'Felt Laptop Sleeve', y: 118 },
                { x: 'Grid Notebook A5', y: 96 }, { x: 'Oak Pen Tray', y: 74 }, { x: 'Linen Pinboard', y: 58 }, { x: 'Cork Desk Mat', y: 44 },
              ] }] as ApexOptions['series']}
              apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4'), cv('--ax-chart-5'), cv('--ax-chart-6')], plotOptions: { treemap: { distributed: true, enableShades: false } }, dataLabels: { enabled: true, style: { fontFamily: cv('--ax-font-sans'), fontSize: '12px' } }, stroke: { width: 2, colors: [cv('--ax-surface-solid')] } }} />
          </div>
        </section>

        {/* Heatmap */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Activity heatmap">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Heatmap</span>
              <h2 className="ax-card__title">Active Hours</h2>
              <p className="ax-card__subtitle">Sessions by weekday × slot</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="heatmap" height={320} legend="none" ariaLabel="Heatmap of active hours by weekday and time slot"
              series={['00–06', '06–12', '12–18', '18–24'].map((s, si) => ({
                name: s,
                data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, di) => ({ x: d, y: [[8, 42, 56, 30], [10, 46, 60, 34], [9, 44, 58, 32], [12, 50, 64, 38], [14, 52, 62, 40], [20, 30, 36, 28], [18, 24, 30, 22]][di][si] })),
              }))}
              apex={{ colors: [cv('--ax-accent')], plotOptions: { heatmap: { radius: 4, enableShades: true, shadeIntensity: 0.6 } }, stroke: { width: 2, colors: [cv('--ax-surface-solid')] }, dataLabels: { enabled: false } }} />
          </div>
        </section>

        {/* Spend mix radial */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Nested allocation radial">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Radial</span><h2 className="ax-card__title">Spend Mix</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="radialBar" height={300} legend="none" ariaLabel="Radial bar chart of spend allocation"
              series={[62, 48, 33, 21]}
              apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4')], labels: ['Product', 'Ads', 'Ops', 'R&D'], plotOptions: { radialBar: { hollow: { size: '34%' }, track: { background: cv('--ax-surface-subtle') }, dataLabels: { name: { fontFamily: cv('--ax-font-sans'), color: cv('--ax-text-muted'), fontSize: '12px' }, value: { fontFamily: cv('--ax-font-mono'), color: cv('--ax-text-strong'), fontWeight: 600 }, total: { show: true, label: 'Mix', formatter: () => '100%' } } } }, stroke: { lineCap: 'round' } }} />
          </div>
        </section>

        {/* Scatter */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Cohort scatter chart">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Scatter</span>
              <h2 className="ax-card__title">Cohort Value</h2>
              <p className="ax-card__subtitle">Tenure (weeks) × lifetime value · by segment</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="scatter" height={320} legend="bottom" ariaLabel="Scatter chart of customer cohorts by tenure and lifetime value"
              series={[
                { name: 'VIP', data: [[42, 6180], [38, 5980], [44, 4720], [40, 5240]] },
                { name: 'Returning', data: [[18, 1840], [22, 2110], [16, 1490], [26, 2870], [20, 1640]] },
                { name: 'New', data: [[2, 80], [3, 24], [4, 210], [1, 60], [5, 320]] },
              ]}
              apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3')], markers: { size: 6 }, xaxis: { tickAmount: 6, title: { text: 'Tenure (weeks)', style: { color: cv('--ax-text-subtle'), fontFamily: cv('--ax-font-sans') } }, labels: { formatter: (v: string) => String(Math.round(Number(v))) } }, yaxis: { labels: { formatter: (v: number) => '$' + (v / 1000).toFixed(1) + 'K' } } }} />
          </div>
        </section>
      </div>
    </>
  );
}

export default ECharts;
