'use client';
/*
 * Vireo Next.js — Sparklines (charts/sparklines). Faithful port of
 * src/html/charts/sparklines.html: hero KPI tiles, compact metric tiles, variant
 * showcase (line/area/bar/win-loss), currency strips and per-product table-cell
 * sparklines — all axis-free <ApexChart sparkline> instances.
 */
import type { ApexOptions } from 'apexcharts';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

function Spark({ type, data, color, h = 56, fillOpacity, ariaLabel, apexExtra }: { type: 'line' | 'area' | 'bar'; data: number[]; color: string; h?: number; fillOpacity?: number; ariaLabel?: string; apexExtra?: ApexOptions }) {
  const apex: ApexOptions = { colors: [color], stroke: { width: type === 'bar' ? 0 : 2, curve: 'smooth', lineCap: 'round' } };
  if (type === 'area') apex.fill = { type: 'gradient', gradient: { opacityFrom: fillOpacity ?? 0.35, opacityTo: 0.02 } };
  if (type === 'bar') apex.plotOptions = { bar: { columnWidth: '60%', borderRadius: 1 } };
  return <ApexChart type={type} height={h} sparkline legend="none" ariaLabel={ariaLabel} series={[{ name: 'v', data }]} apex={{ ...apex, ...apexExtra }} />;
}

const ARROW_UP = <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>;
const ARROW_DN = <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;

const HERO = [
  { label: 'Revenue', value: '$748.2K', up: true, delta: '12.4%', id: 'sp-rev', data: [42, 48, 45, 53, 57, 55, 62, 60, 68, 72, 70, 76], color: '--ax-accent', region: 'Revenue $748.2K up 12.4%' },
  { label: 'Orders', value: '1,248', up: true, delta: '8.1%', id: 'sp-ord', data: [80, 92, 88, 101, 96, 110, 118, 124], color: '--ax-viz-cyan', region: 'Orders 1,248 up 8.1%' },
  { label: 'Customers', value: '3,920', up: false, delta: '3.1%', id: 'sp-cus', data: [60, 58, 55, 57, 54, 52, 50, 49], color: '--ax-danger-500', region: 'Customers 3,920 down 3.1%' },
  { label: 'Avg. order value', value: '$59.95', up: true, delta: '2.6%', id: 'sp-aov', data: [54, 55, 56, 55, 57, 58, 59, 60], color: '--ax-success-500', region: 'Average order value $59.95 up 2.6%' },
];
const COMPACT = [
  { label: 'Sessions', value: '54.2K', data: [38, 42, 40, 46, 48, 52, 54], color: '--ax-viz-cyan', region: 'Sessions 54.2K' },
  { label: 'Bounce', value: '38%', data: [44, 42, 43, 41, 40, 39, 38], color: '--ax-success-500', region: 'Bounce rate 38%' },
  { label: 'Signups', value: '312', data: [18, 22, 20, 26, 28, 30, 31], color: '--ax-viz-violet', region: 'Signups 312' },
  { label: 'Tickets', value: '47', data: [62, 58, 55, 51, 49, 48, 47], color: '--ax-success-500', region: 'Tickets 47' },
  { label: 'Refunds', value: '1.2%', data: [2.1, 1.9, 2.0, 1.6, 1.4, 1.3, 1.2], color: '--ax-success-500', region: 'Refunds 1.2%' },
  { label: 'Uptime', value: '99.9%', data: [99.6, 99.7, 99.5, 99.8, 99.9, 99.9, 99.9], color: '--ax-viz-emerald', region: 'Uptime 99.9%' },
];
const CURRENCY = [
  { code: 'USD', data: [40, 42, 41, 44, 46, 45, 47, 48], color: '--ax-success-500', amount: '$48.2K', region: 'USD balance sparkline' },
  { code: 'GBP', data: [24, 23, 22, 23, 22, 21.8, 21.6, 21.5], color: '--ax-danger-500', amount: '£21.5K', region: 'GBP balance sparkline' },
  { code: 'EUR', data: [28, 30, 29, 31, 32, 32.5, 33, 33.1], color: '--ax-viz-cyan', amount: '€33.1K', region: 'EUR balance sparkline' },
  { code: 'AUD', data: [14, 14.5, 15, 14.8, 15.4, 15.7, 15.9, 16.0], color: '--ax-viz-violet', amount: 'A$16.0K', region: 'AUD balance sparkline' },
];
const CELLS = [
  { name: 'Matte Ceramic Mug', cat: 'Drinkware', data: [30, 34, 32, 38, 41, 39, 44, 46, 43, 48, 52, 54], color: '--ax-success-500', units: '540', delta: '+18%', tone: 'success', label: 'Mug units trend' },
  { name: 'Grid Notebook A5', cat: 'Stationery', data: [24, 26, 25, 28, 27, 30, 29, 31, 30, 32, 33, 33], color: '--ax-success-500', units: '331', delta: '+9%', tone: 'success', label: 'Notebook units trend' },
  { name: 'Aperture Desk Lamp', cat: 'Lighting', data: [26, 25, 24, 23, 24, 22, 23, 21, 22, 21, 21, 21], color: '--ax-danger-500', units: '212', delta: '−4%', tone: 'danger', label: 'Lamp units trend' },
  { name: 'Felt Laptop Sleeve 14"', cat: 'Tech accessories', data: [8, 9, 8, 9, 10, 9, 10, 9, 10, 9, 9.5, 9.7], color: '--ax-success-500', units: '97', delta: '+6%', tone: 'success', label: 'Sleeve units trend' },
  { name: 'Brass Task Light', cat: 'Lighting', data: [11, 12, 13, 12, 13, 14, 13, 15, 14, 15, 15.5, 15.6], color: '--ax-success-500', units: '156', delta: '+12%', tone: 'success', label: 'Task light units trend' },
];

export function Sparklines() {
  return (
    <>
      <PageHead
        title="Sparklines"
        subtitle="Dense KPI tiles, win/loss strips & table-cell trends — all axis-free, all retheme live."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
              <span className="ax-btn__label">Last 7 days</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add tile</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* ROW 1: hero KPI tiles */}
        {HERO.map((k) => (
          <div key={k.id} className="ax-card ax-col--3" role="region" aria-label={k.region}>
            <div className="ax-card__body">
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>{k.label}</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.1, marginTop: 2 }}>{k.value}</div>
                </div>
                <span className={`ax-badge ax-badge--soft ${k.up ? 'ax-badge--success' : 'ax-badge--danger'} ax-badge--pill`}>{k.up ? ARROW_UP : ARROW_DN}{k.delta}</span>
              </div>
              <div style={{ marginTop: 'var(--ax-space-3)' }}><Spark type="area" data={k.data} color={cv(k.color)} h={64} ariaLabel={`${k.label} trend sparkline, ${k.up ? 'upward' : 'downward'}`} /></div>
            </div>
          </div>
        ))}

        {/* ROW 2: compact metric tiles */}
        {COMPACT.map((m) => (
          <div key={m.label} className="ax-card ax-card--compact ax-col--2" role="region" aria-label={m.region}>
            <div className="ax-card__body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>{m.label}</div>
              <div className="ax-num" style={{ fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: '2px 0 6px' }}>{m.value}</div>
              <Spark type="line" data={m.data} color={cv(m.color)} h={40} />
            </div>
          </div>
        ))}

        {/* ROW 3: variant showcase */}
        <section className="ax-card ax-col--3" role="region" aria-label="Line sparkline variant">
          <div className="ax-card__body">
            <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ marginBottom: 'var(--ax-space-3)' }}>Line</span>
            <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>CPU load · last 24h</div>
            <div className="ax-num" style={{ fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>62%</div>
            <div style={{ marginTop: 'var(--ax-space-3)' }}><Spark type="line" data={[48, 55, 51, 60, 58, 65, 62, 70, 66, 72]} color={cv('--ax-accent')} ariaLabel="Line sparkline of CPU load" /></div>
          </div>
        </section>
        <section className="ax-card ax-col--3" role="region" aria-label="Area sparkline variant">
          <div className="ax-card__body">
            <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ marginBottom: 'var(--ax-space-3)' }}>Area</span>
            <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>Memory · last 24h</div>
            <div className="ax-num" style={{ fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>7.4&nbsp;GB</div>
            <div style={{ marginTop: 'var(--ax-space-3)' }}><Spark type="area" data={[5.2, 5.8, 6.1, 5.9, 6.6, 7.0, 6.8, 7.2, 7.1, 7.4]} color={cv('--ax-viz-violet')} ariaLabel="Area sparkline of memory usage" /></div>
          </div>
        </section>
        <section className="ax-card ax-col--3" role="region" aria-label="Bar sparkline variant">
          <div className="ax-card__body">
            <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ marginBottom: 'var(--ax-space-3)' }}>Bar</span>
            <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>Deploys · last 14d</div>
            <div className="ax-num" style={{ fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>128</div>
            <div style={{ marginTop: 'var(--ax-space-3)' }}><Spark type="bar" data={[6, 9, 7, 11, 8, 12, 10, 14, 9, 13, 11, 15, 12, 16]} color={cv('--ax-viz-cyan')} ariaLabel="Bar sparkline of deploy counts" /></div>
          </div>
        </section>
        <section className="ax-card ax-col--3" role="region" aria-label="Win-loss sparkline variant">
          <div className="ax-card__body">
            <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ marginBottom: 'var(--ax-space-3)' }}>Win / loss</span>
            <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginBottom: 'var(--ax-space-2)' }}>SLA met · last 16d</div>
            <div className="ax-num" style={{ fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>13&nbsp;<span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)', fontWeight: 500 }}>/ 16</span></div>
            <div style={{ marginTop: 'var(--ax-space-3)' }}>
              <ApexChart type="bar" height={56} sparkline legend="none" ariaLabel="Win-loss sparkline of SLA results"
                series={[{ name: 'SLA', data: [1, 1, -1, 1, 1, 1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1] }]}
                apex={{ plotOptions: { bar: { columnWidth: '52%', borderRadius: 1, colors: { ranges: [{ from: -1, to: 0, color: cv('--ax-danger-500') }, { from: 0.0001, to: 1, color: cv('--ax-success-500') }] } } }, yaxis: { show: false } }} />
            </div>
          </div>
        </section>

        {/* ROW 4: currency strip */}
        <section className="ax-card ax-col--4" role="region" aria-label="Currency balances with sparklines">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Balances</h2>
              <p className="ax-card__subtitle">By currency · 30-day trend</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {CURRENCY.map((c) => (
              <div key={c.code} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <b className="ax-num" style={{ width: 34, color: 'var(--ax-text-strong)' }}>{c.code}</b>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><Spark type="area" data={c.data} color={cv(c.color)} h={36} fillOpacity={0.3} ariaLabel={c.region} /></div>
                <span className="ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}>{c.amount}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ROW 4: per-product table sparks */}
        <section className="ax-card ax-col--8" role="region" aria-label="Per-product performance table with cell sparklines">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Product Performance</h2>
              <p className="ax-card__subtitle">Units sold · 12-week table-cell sparklines</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Product</th>
                  <th className="ax-table__th" scope="col">Category</th>
                  <th className="ax-table__th" scope="col">12-week trend</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Units</th>
                  <th className="ax-table__th" scope="col">Δ</th>
                </tr>
              </thead>
              <tbody>
                {CELLS.map((c) => (
                  <tr key={c.name} className="ax-table__row">
                    <td className="ax-table__td" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{c.name}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{c.cat}</td>
                    <td className="ax-table__td"><div style={{ width: 140 }}><Spark type="line" data={c.data} color={cv(c.color)} h={32} ariaLabel={c.label} /></div></td>
                    <td className="ax-table__td ax-table__td--num">{c.units}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${c.tone} ax-badge--pill`}>{c.delta}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default Sparklines;
