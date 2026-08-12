'use client';
/*
 * Vireo Next.js — Stocks & Trading dashboard (dashboards/stocks).
 *
 * Faithful re-expression of src/html/dashboards/stocks.html: a full-width index
 * strip with sparklines, KPI row, a Portfolio-vs-S&P area chart, a sector donut,
 * an AAPL candlestick + volume pair, an interactive order ticket (Alpine →
 * React island), a holdings table and a watchlist/news rail. Charts via
 * <ApexChart>; classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const FALLBACK: Record<string, string> = {
  '--ax-accent': '#2BB6A3', '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6', '--ax-viz-amber': '#FBBF24', '--ax-viz-emerald': '#34D399',
  '--ax-success-500': '#10B981', '--ax-danger-500': '#EF4444',
};
function cv(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || '#38BDF8';
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);

const GRID_STYLE = `
  .ax-dash-grid > * { grid-column: 1 / -1; }
  @media (min-width: 768px) {
    .ax-dash-grid > .ax-kpi { grid-column: span 6; }
  }
  @media (min-width: 1200px) {
    .ax-dash-grid > .ax-kpi { grid-column: span 3; }
    .ax-dash-grid > .ax-col-full { grid-column: span 12; }
    .ax-dash-grid > .ax-col-hero { grid-column: span 8; }
    .ax-dash-grid > .ax-col-side { grid-column: span 4; }
    .ax-dash-grid > .ax-col-wide { grid-column: span 8; }
    .ax-dash-grid > .ax-col-narrow { grid-column: span 4; }
  }`;

const INDICES = [
  { name: 'S&P 500', value: '5,487.03', chg: '+0.62%', up: true, color: '--ax-viz-emerald', spark: [8, 10, 9, 15, 14, 20, 19, 25] },
  { name: 'Nasdaq', value: '17,862.30', chg: '+0.94%', up: true, color: '--ax-viz-emerald', spark: [6, 9, 8, 14, 16, 19, 21, 27] },
  { name: 'Dow Jones', value: '38,910.40', chg: '−0.18%', up: false, color: '--ax-viz-red', spark: [22, 20, 23, 18, 19, 15, 16, 12] },
  { name: 'Russell 2000', value: '2,041.88', chg: '+0.41%', up: true, color: '--ax-viz-emerald', spark: [12, 14, 13, 17, 16, 20, 18, 23] },
];

const KPIS = [
  { region: "Portfolio Value $248,300, up 1.9% today", c: 'c1', delta: '1.9%', label: 'Portfolio Value', value: '$248,300', valueColor: undefined as string | undefined, color: '--ax-accent', spark: [8, 11, 10, 16, 18, 22, 25, 29],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 9a1.5 1.5 0 0 1 1.5 -1.5h2a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 0 1.5 -1.5" /><path d="M12 6v1.5m0 9v1.5" /></svg> },
  { region: "Today's profit and loss positive $4,610, up 1.9%", c: 'c2', delta: '1.9%', label: "Today's P / L", value: '+$4,610', valueColor: 'var(--ax-viz-emerald)', color: '--ax-viz-emerald', spark: [6, 10, 8, 15, 13, 20, 18, 27],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg> },
  { region: 'Buying power $36,200, neutral', c: 'c3', neutral: true, label: 'Buying Power', value: '$36,200', valueColor: undefined, color: '--ax-viz-violet', spark: [17, 18, 16, 19, 17, 19, 18, 19],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg> },
  { region: "Day's best AAPL up 3.4%", c: 'c4', delta: '3.4%', label: "Day's Best", value: 'AAPL', valueColor: undefined, color: '--ax-viz-amber', spark: [5, 8, 7, 14, 16, 20, 24, 30],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg> },
];

const SECTORS = [
  { c: '#38BDF8', label: 'Technology', n: '38%' },
  { c: '#A78BFA', label: 'Healthcare', n: '22%' },
  { c: '#F472B6', label: 'Financials', n: '18%' },
  { c: '#FBBF24', label: 'Energy', n: '12%' },
  { c: '#34D399', label: 'Consumer', n: '10%' },
];

const HOLDINGS = [
  { sym: 'AAPL', name: 'Apple Inc.', qty: '120', avg: '$182.40', mkt: '$25,716', pl: '+$3,828', plUp: true },
  { sym: 'MSFT', name: 'Microsoft', qty: '64', avg: '$398.10', mkt: '$28,704', pl: '+$3,222', plUp: true },
  { sym: 'NVDA', name: 'NVIDIA', qty: '210', avg: '$96.20', mkt: '$25,830', pl: '+$6,628', plUp: true },
  { sym: 'TSLA', name: 'Tesla', qty: '90', avg: '$248.70', mkt: '$20,718', pl: '−$1,665', plUp: false },
  { sym: 'AMZN', name: 'Amazon', qty: '140', avg: '$172.30', mkt: '$25,564', pl: '+$1,442', plUp: true },
];

const WATCH = [
  { sym: 'GOOGL', starred: true, price: '$178.4', chg: '+1.2%', up: true, color: '--ax-viz-emerald', spark: [6, 9, 8, 13, 15, 19] },
  { sym: 'META', starred: false, price: '$502.1', chg: '−0.7%', up: false, color: '--ax-viz-red', spark: [16, 14, 15, 11, 10, 7] },
  { sym: 'AMD', starred: false, price: '$162.8', chg: '+2.6%', up: true, color: '--ax-viz-emerald', spark: [7, 10, 9, 14, 16, 20] },
  { sym: 'NFLX', starred: false, price: '$648.3', chg: '+0.9%', up: true, color: '--ax-viz-emerald', spark: [8, 10, 9, 12, 13, 16] },
];

const NEWS = [
  { title: 'Fed holds rates steady, signals one cut in Q4', meta: 'Reuters · 12m ago' },
  { title: 'Nvidia tops $3T as AI demand stays red-hot', meta: 'Bloomberg · 48m ago' },
  { title: 'Apple unveils on-device AI at WWDC keynote', meta: 'CNBC · 2h ago' },
  { title: 'Oil slips as OPEC+ weighs supply boost', meta: 'WSJ · 3h ago', last: true },
];

const OHLC: [number, number, number, number, number][] = [
  [1718150400000, 196.2, 198.4, 195.1, 197.8],
  [1718236800000, 197.8, 200.1, 197.0, 199.6],
  [1718323200000, 199.6, 201.2, 198.2, 198.9],
  [1718409600000, 198.9, 202.6, 198.5, 202.1],
  [1718496000000, 202.1, 204.8, 201.3, 204.2],
  [1718582400000, 204.2, 205.1, 202.4, 203.0],
  [1718668800000, 203.0, 206.7, 202.6, 206.2],
  [1718755200000, 206.2, 209.4, 205.8, 208.9],
  [1718841600000, 208.9, 210.2, 206.1, 207.3],
  [1718928000000, 207.3, 211.8, 207.0, 211.2],
  [1719014400000, 211.2, 213.4, 209.6, 213.1],
  [1719100800000, 213.1, 215.6, 211.9, 214.3],
];
const VOL_DATA = [22, 28, 19, 34, 31, 24, 38, 42, 29, 45, 40, 36];

export function Stocks() {
  return (
    <>
      <PageHead
        title="Stocks & Trading"
        subtitle="Markets are open — your portfolio is up 1.9% today."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
              <span className="ax-btn__label">Market open</span>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Statements</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New Order</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* INDEX STRIP */}
        <section className="ax-card ax-col-full" role="region" aria-label="Market indices">
          <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--ax-space-5)', paddingBlock: 'var(--ax-space-4)' }}>
            {INDICES.map((ix) => (
              <div key={ix.name} className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{ix.name}</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{ix.value}</div>
                  <div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: ix.up ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }}>{ix.chg}</div>
                </div>
                <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={32} color={ix.color} series={[{ name: 'Trend', data: ix.spark }]} style={{ width: 72, height: 32, flex: 'none' }} />
              </div>
            ))}
          </div>
        </section>

        {/* KPI ROW */}
        {KPIS.map((k) => (
          <div key={k.label} className="ax-card ax-kpi" role="region" aria-label={k.region}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${k.c}`}>{k.icon}</span>
                {k.neutral ? <span className="ax-kpi__delta" style={{ color: 'var(--ax-text-subtle)' }}>—</span> : <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}{k.delta}</span>}
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num" style={k.valueColor ? { color: k.valueColor } : undefined}>{k.value}</div>
                <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color={k.color} series={[{ name: 'Trend', data: k.spark }]} style={{ minHeight: 40 }} />
              </div>
            </div>
          </div>
        ))}

        {/* HERO: Portfolio vs S&P 500 (8) */}
        <section className="ax-card ax-card--chart ax-col-hero" role="region" aria-label="Portfolio performance versus benchmark">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Performance</span>
              <h2 className="ax-card__title">Portfolio vs. S&amp;P 500</h2>
              <p className="ax-card__subtitle">Indexed growth, your portfolio vs. benchmark</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Timeframe">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">1D</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">1W</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">1M</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">1Y</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>My portfolio</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>S&amp;P 500</small></span>
            </div>
            <ApexChart
              type="area"
              height={300}
              legend="none"
              accent
              ariaLabel="Area chart comparing portfolio growth against the S and P 500"
              series={[
                { name: 'My portfolio', data: [100, 101.2, 100.6, 102.4, 103.1, 102.8, 104.2, 105.6, 106.1, 107.4, 108.2, 109.1] },
                { name: 'S&P 500', data: [100, 100.6, 100.2, 101.1, 101.4, 101.0, 101.8, 102.4, 102.1, 103.0, 103.4, 103.9] },
              ]}
            />
          </div>
        </section>

        {/* Allocation by Sector (4) */}
        <section className="ax-card ax-col-side" role="region" aria-label="Allocation by sector">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Allocation by Sector</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Allocation options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut chart of allocation by sector: technology 38%, healthcare 22%, financials 18%, energy 12%, consumer 10%"
              series={[38, 22, 18, 12, 10]}
              apex={{
                labels: ['Technology', 'Healthcare', 'Financials', 'Energy', 'Consumer'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber'), cv('--ax-viz-emerald')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Sectors', formatter: () => '5' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {SECTORS.map((s) => (
                <li key={s.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: s.c, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{s.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{s.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Candlestick + Volume (8) */}
        <section className="ax-card ax-card--chart ax-col-hero" role="region" aria-label="Apple stock price chart">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">AAPL · NASDAQ</span>
              <h2 className="ax-card__title">Apple Inc.</h2>
              <p className="ax-card__subtitle">$214.30 <span style={{ color: 'var(--ax-viz-emerald)' }}>+$7.04 (3.4%)</span> today</p>
            </div>
            <div className="ax-card__actions" style={{ gap: 'var(--ax-space-2)' }}>
              <label className="ax-visually" htmlFor="stk-symbol">Symbol search</label>
              <div style={{ position: 'relative', maxWidth: 170 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input id="stk-symbol" className="ax-input ax-input--sm" type="search" placeholder="Search symbol" autoComplete="off" style={{ paddingInlineStart: 32 }} />
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="candlestick"
              height={260}
              legend="none"
              ariaLabel="Candlestick chart of Apple daily price"
              series={[{ data: OHLC.map((c) => ({ x: c[0], y: [c[1], c[2], c[3], c[4]] })) }]}
              apex={{
                plotOptions: { candlestick: { colors: { upward: cv('--ax-success-500'), downward: cv('--ax-danger-500') } } },
                xaxis: { type: 'datetime', labels: { show: false } },
                yaxis: { tooltip: { enabled: true }, labels: { formatter: (v: number) => '$' + v.toFixed(0) } },
              }}
            />
            <ApexChart
              type="bar"
              height={110}
              legend="none"
              ariaLabel="Volume bars for Apple"
              style={{ marginTop: 'calc(-1 * var(--ax-space-4))' }}
              series={[{ name: 'Volume', data: OHLC.map((c, i) => ({ x: c[0], y: VOL_DATA[i] })) }]}
              apex={{
                colors: [cv('--ax-viz-cyan')],
                plotOptions: { bar: { columnWidth: '60%', borderRadius: 2 } },
                fill: { opacity: 0.55 },
                xaxis: { type: 'datetime' },
                yaxis: { labels: { formatter: (v: number) => v + 'M' } },
                grid: { yaxis: { lines: { show: false } } },
              }}
            />
          </div>
        </section>

        {/* Order Ticket (4) */}
        <OrderTicket />

        {/* Holdings (8) */}
        <section className="ax-card ax-col-wide" role="region" aria-label="Holdings">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Holdings</h2>
              <p className="ax-card__subtitle">Positions &amp; unrealized P&amp;L</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Symbol</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Qty</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Avg cost</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Mkt value</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {HOLDINGS.map((h) => (
                  <tr key={h.sym} className="ax-table__row">
                    <td className="ax-table__td"><div><div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{h.sym}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{h.name}</div></div></td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{h.qty}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{h.avg}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{h.mkt}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: h.plUp ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }}>{h.pl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Watchlist + News rail (4) */}
        <div className="ax-col-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Watchlist">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Watchlist</h2></div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Add to watchlist">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              </button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              {WATCH.map((w) => (
                <div key={w.sym} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill={w.starred ? 'var(--ax-warning-500)' : 'none'} stroke={w.starred ? 'var(--ax-warning-500)' : 'var(--ax-text-subtle)'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
                  <div style={{ flex: 1, minWidth: 0 }}><b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{w.sym}</b></div>
                  <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={24} color={w.color} series={[{ name: 'Trend', data: w.spark }]} style={{ width: 48, height: 24, flex: 'none' }} />
                  <div style={{ textAlign: 'right' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{w.price}</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-2xs)', color: w.up ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }}>{w.chg}</div></div>
                </div>
              ))}
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Market news">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Market News</h2></div>
              <a className="ax-btn ax-btn--link" href="#">More</a>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-list ax-list--compact">
                {NEWS.map((n) => (
                  <li key={n.title} className="ax-list__row" style={{ paddingInline: 0, alignItems: 'flex-start', borderBottom: n.last ? 0 : undefined }}>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{n.title}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>{n.meta}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <style>{GRID_STYLE}</style>
    </>
  );
}

/* Order ticket — Alpine x-data form re-expressed as a React island. */
function OrderTicket() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [symbol, setSymbol] = useState('AAPL');
  const [qty, setQty] = useState('25');
  const [type, setType] = useState('market');
  const [limit, setLimit] = useState('214.00');
  const [sent, setSent] = useState(false);
  return (
    <section className="ax-card ax-col-side" role="region" aria-label="Order ticket">
      <div className="ax-card__header">
        <div className="ax-card__titles"><h2 className="ax-card__title">Order Ticket</h2></div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Order side" style={{ width: '100%', marginBottom: 'var(--ax-space-4)' }}>
          <button type="button" className={`ax-btn ax-btn--sm ax-btn--block${side === 'buy' ? ' is-selected' : ''}`} role="radio" aria-checked={side === 'buy'} onClick={() => setSide('buy')}>Buy</button>
          <button type="button" className={`ax-btn ax-btn--sm ax-btn--block${side === 'sell' ? ' is-selected' : ''}`} role="radio" aria-checked={side === 'sell'} onClick={() => setSide('sell')}>Sell</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
          <div className="ax-field">
            <label className="ax-label" htmlFor="stk-sym">Symbol</label>
            <input className="ax-input" id="stk-sym" type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="stk-qty">Quantity</label>
              <input className="ax-input ax-num" id="stk-qty" type="text" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="stk-type">Order type</label>
              <select className="ax-select" id="stk-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop">Stop</option>
              </select>
            </div>
          </div>
          {type !== 'market' && (
            <div className="ax-field">
              <label className="ax-label" htmlFor="stk-limit">Limit price</label>
              <input className="ax-input ax-num" id="stk-limit" type="text" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
          )}
          <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Est. cost</span>
            <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$5,357.50</b>
          </div>
          <button type="submit" className={`ax-btn ax-btn--primary ax-btn--block${side === 'sell' ? ' ax-btn--danger' : ''}`}>
            <span className="ax-btn__label">{side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}</span>
          </button>
          {sent && (
            <p className="ax-note" style={{ margin: 0, color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }} role="status">
              Order placed — confirmation sent to your inbox.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

export default Stocks;
