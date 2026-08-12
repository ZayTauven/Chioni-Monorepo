'use client';
/*
 * Vireo Next.js — Financial Charts (charts/apex-financial). Faithful port of
 * src/html/charts/apex-financial.html: 4 ticker KPI tiles (with sparklines), a
 * candlestick + volume-brush hero, OHLC bars, a range-area forecast band, a brush
 * navigator, a boxplot and a session-tape table — all via <ApexChart>.
 */
import type { ApexOptions } from 'apexcharts';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const CANDLES = [
  { x: 'Jun 02', y: [412, 420, 408, 418] }, { x: 'Jun 03', y: [418, 426, 414, 415] },
  { x: 'Jun 04', y: [415, 430, 412, 428] }, { x: 'Jun 05', y: [428, 432, 420, 424] },
  { x: 'Jun 06', y: [424, 440, 422, 438] }, { x: 'Jun 09', y: [438, 445, 430, 433] },
  { x: 'Jun 10', y: [433, 442, 429, 440] }, { x: 'Jun 11', y: [440, 448, 436, 437] },
  { x: 'Jun 12', y: [437, 450, 433, 446] }, { x: 'Jun 13', y: [446, 452, 438, 441] },
  { x: 'Jun 16', y: [441, 449, 435, 448] }, { x: 'Jun 17', y: [448, 458, 444, 455] },
];
const VOL_Y = [1190, 1280, 1550, 1410, 1620, 1840, 1720, 1490, 1980, 1610, 1530, 2010];
const VOLUME = CANDLES.map((c, i) => ({ x: c.x, y: VOL_Y[i] }));
const DAYS = Array.from({ length: 40 }, (_, i) => new Date(2025, 4, 1 + i).getTime());
const SESSIONS_RAW = [9.2, 9.8, 10.4, 10.1, 11.2, 12.6, 11.9, 12.4, 13.1, 12.8, 13.6, 14.2, 13.9, 14.8, 15.4, 15.1, 16.0, 16.6, 16.2, 17.1, 17.6, 17.2, 18.0, 18.5, 18.1, 19.0, 19.4, 19.0, 20.1, 20.6, 20.2, 21.0, 21.4, 21.1, 22.0, 22.6, 22.1, 23.0, 23.5, 24.1];
const SESSIONS: [number, number][] = SESSIONS_RAW.map((v, i) => [DAYS[i], Math.round(v * 1000)]);
const MONTHS8 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const BAND_LO = [620, 660, 700, 690, 760, 800, 870, 940];
const BAND_HI = [720, 760, 820, 810, 900, 960, 1060, 1180];
const BAND_MID = [670, 710, 760, 750, 830, 880, 965, 1060];

const DOTS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
);
const UP = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>;
const DN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;

const TAPE = [
  ['Jun 09', '438.00', '445.00', '430.20', '433.00', 'var(--ax-viz-emerald)', '1.84M', 'danger', '−1.1%'],
  ['Jun 06', '424.00', '440.00', '422.00', '438.00', 'var(--ax-viz-emerald)', '1.62M', 'success', '+3.3%'],
  ['Jun 05', '428.00', '432.00', '420.00', '424.00', 'var(--ax-text)', '1.41M', 'danger', '−0.9%'],
  ['Jun 04', '415.00', '430.00', '412.00', '428.00', 'var(--ax-viz-emerald)', '1.55M', 'success', '+3.1%'],
  ['Jun 03', '418.00', '426.00', '414.00', '415.00', 'var(--ax-text)', '1.28M', 'danger', '−0.7%'],
  ['Jun 02', '412.00', '420.00', '408.00', '418.00', 'var(--ax-viz-emerald)', '1.19M', 'success', '+1.5%'],
] as const;

function Kpi({ cls, delta, up, label, value, valueSm, spark, color, region, icon }: { cls: string; delta: string; up: boolean; label: string; value: string; valueSm?: boolean; spark?: number[]; color?: string; region: string; icon: React.ReactNode }) {
  return (
    <div className="ax-card ax-kpi ax-col--3" role="region" aria-label={region}>
      <div className="ax-card__body">
        <div className="ax-kpi__top">
          <span className={`ax-kpi__icon ax-kpi__icon--${cls}`}>{icon}</span>
          <span className={`ax-kpi__delta ax-kpi__delta--${up ? 'up' : 'down'}`}>{up ? UP : DN}{delta}</span>
        </div>
        <div className="ax-kpi__label">{label}</div>
        <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
          <div className="ax-kpi__value ax-num" style={valueSm ? { fontSize: 'var(--ax-text-xl)' } : undefined}>{value}</div>
          {spark && color && <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color={color} series={[{ name: 'Trend', data: spark }]} style={{ minHeight: 40 }} />}
        </div>
      </div>
    </div>
  );
}

export function ApexFinancial() {
  return (
    <>
      <PageHead
        title="Financial Charts"
        subtitle="Candlestick, OHLC, range area & brush — Aperture Goods (APG) ticker, Jun 2025."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></svg>
              <span className="ax-btn__label">Jun 2025</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -3" /><path d="M6 4l0 2" /><path d="M6 11l0 9" /><path d="M10 15a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -3" /><path d="M12 4l0 10" /><path d="M12 19l0 1" /><path d="M16 6a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1l0 -4" /><path d="M18 4l0 1" /><path d="M18 11l0 9" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <Kpi cls="c1" delta="3.1%" up label="Last price (APG)" value="$438.40" spark={[8, 10, 7, 14, 16, 20, 25, 29]} color="--ax-accent" region="Last price $438.40, up 3.1%" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg>} />
        <Kpi cls="c2" delta="1.6%" up label="Day range" value="430.20–445.00" valueSm region="Day range $430.20 to $445.00" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18l5 -5l4 4l8 -8" /><path d="M16 9h5v5" /></svg>} />
        <Kpi cls="c3" delta="12.0%" up label="Volume" value="1.84M" spark={[14, 12, 18, 15, 22, 17, 24, 26]} color="--ax-viz-violet" region="Volume 1.84M shares, up 12.0%" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h4l3 8l4 -16l3 8h4" /></svg>} />
        <Kpi cls="c4" delta="0.4%" up={false} label="Market cap" value="$3.71B" spark={[26, 23, 25, 21, 22, 18, 16, 13]} color="--ax-viz-amber" region="Market cap $3.71B, down 0.4%" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /><path d="M9 9l0 0" /><path d="M9 12l0 0" /><path d="M9 15l0 0" /></svg>} />

        {/* HERO candlestick + volume brush */}
        <section className="ax-card ax-card--chart ax-col--12" role="region" aria-label="APG daily candlestick chart with volume brush">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">OHLC · Daily</span>
              <h2 className="ax-card__title">APG — Candlestick</h2>
              <p className="ax-card__subtitle">Open / high / low / close · brush the volume strip below to zoom</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-success-500)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Bullish</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-danger-500)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Bearish</small></span>
              </div>
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Interval">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">1D</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">1W</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">1M</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="candlestick" height={320} legend="none" ariaLabel="Candlestick chart of APG daily OHLC prices, last close $438.40"
              series={[{ name: 'APG', data: CANDLES }]}
              apex={{ chart: { id: 'ax-candle', toolbar: { show: false } }, plotOptions: { candlestick: { colors: { upward: cv('--ax-success-500'), downward: cv('--ax-danger-500') }, wick: { useFillColor: true } } }, xaxis: { type: 'category', tooltip: { enabled: false } }, yaxis: { tooltip: { enabled: true }, labels: { formatter: (v: number) => '$' + Math.round(v) } } }} />
            <div style={{ marginTop: 'var(--ax-space-2)' }}>
              <ApexChart type="bar" height={96} legend="none" ariaLabel="Volume brush selector for the candlestick chart"
                series={[{ name: 'Volume', data: VOLUME }]}
                apex={{ chart: { id: 'ax-candle-vol', brush: { enabled: true, target: 'ax-candle' }, selection: { enabled: true, xaxis: { min: 4, max: 11 } } }, plotOptions: { bar: { columnWidth: '60%', borderRadius: 2 } }, colors: [cv('--ax-accent')], xaxis: { type: 'category', labels: { show: false }, axisBorder: { show: false } }, yaxis: { labels: { show: false } }, grid: { yaxis: { lines: { show: false } } } } as ApexOptions} />
            </div>
          </div>
        </section>

        {/* OHLC bars */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="APG OHLC bar chart">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Bar OHLC</span>
              <h2 className="ax-card__title">OHLC Bars</h2>
              <p className="ax-card__subtitle">Classic open-high-low-close bars</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="OHLC chart options">{DOTS}</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="candlestick" height={300} legend="none" ariaLabel="OHLC bar chart of APG daily prices"
              series={[{ name: 'APG', data: CANDLES.slice(2) }]}
              apex={{ chart: { type: 'candlestick' }, plotOptions: { candlestick: { colors: { upward: cv('--ax-success-500'), downward: cv('--ax-danger-500') } } }, stroke: { width: 1 }, xaxis: { type: 'category' }, yaxis: { labels: { formatter: (v: number) => '$' + Math.round(v) } } }} />
          </div>
        </section>

        {/* Range area */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Revenue forecast range area">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Range area</span>
              <h2 className="ax-card__title">Forecast Band</h2>
              <p className="ax-card__subtitle">Revenue projection — low / mid / high envelope</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />On track</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="rangeArea" height={300} legend="none" ariaLabel="Range area chart of revenue forecast with confidence band"
              series={[
                { type: 'rangeArea', name: 'Confidence band', data: MONTHS8.map((m, i) => ({ x: m, y: [BAND_LO[i], BAND_HI[i]] })) },
                { type: 'line', name: 'Projection', data: MONTHS8.map((m, i) => ({ x: m, y: BAND_MID[i] })) },
              ] as ApexOptions['series']}
              apex={{ colors: [cv('--ax-accent'), cv('--ax-accent')], fill: { opacity: [0.16, 1] }, stroke: { width: [0, 2.5], curve: 'smooth' }, yaxis: { labels: { formatter: (v: number) => '$' + Math.round(v) + 'K' } } }} />
          </div>
        </section>

        {/* Brush navigator */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Sessions with brush navigator">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Brush + sync</span>
              <h2 className="ax-card__title">Brush Navigator</h2>
              <p className="ax-card__subtitle">Drag the lower strip to focus the detail chart above</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="area" height={260} legend="none" accent ariaLabel="Detail area chart driven by the brush navigator below"
              series={[{ name: 'Sessions', data: SESSIONS }]}
              apex={{ chart: { id: 'ax-brush-target', toolbar: { autoSelected: 'pan', show: false } }, xaxis: { type: 'datetime' }, yaxis: { labels: { formatter: (v: number) => (v / 1000).toFixed(1) + 'K' } } } as ApexOptions} />
            <div style={{ marginTop: 'var(--ax-space-2)' }}>
              <ApexChart type="area" height={90} legend="none" ariaLabel="Brush navigator selector"
                series={[{ name: 'Sessions', data: SESSIONS }]}
                apex={{ chart: { id: 'ax-brush-nav-chart', brush: { target: 'ax-brush-target', enabled: true }, selection: { enabled: true, xaxis: { min: DAYS[18], max: DAYS[34] } } }, colors: [cv('--ax-viz-cyan')], fill: { type: 'gradient', gradient: { opacityFrom: 0.32, opacityTo: 0.05 } }, xaxis: { type: 'datetime', tooltip: { enabled: false } }, yaxis: { tickAmount: 2, labels: { show: false } }, grid: { yaxis: { lines: { show: false } } } } as ApexOptions} />
            </div>
          </div>
        </section>

        {/* Boxplot */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Quarterly price spread boxplot">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Distribution</span>
              <h2 className="ax-card__title">Price Spread</h2>
              <p className="ax-card__subtitle">Quarterly box &amp; whisker</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="boxPlot" height={300} legend="none" ariaLabel="Boxplot of quarterly APG price spread"
              series={[{ type: 'boxPlot', data: [{ x: 'Q1', y: [388, 402, 414, 426, 438] }, { x: 'Q2', y: [408, 418, 430, 442, 458] }, { x: 'Q3', y: [420, 432, 444, 456, 472] }, { x: 'Q4', y: [435, 448, 460, 474, 492] }] }] as ApexOptions['series']}
              apex={{ plotOptions: { boxPlot: { colors: { upper: cv('--ax-viz-cyan'), lower: cv('--ax-accent') } } }, stroke: { colors: [cv('--ax-text-subtle')], width: 1 }, yaxis: { labels: { formatter: (v: number) => '$' + Math.round(v) } } }} />
          </div>
        </section>

        {/* Session tape table */}
        <section className="ax-card ax-col--12" role="region" aria-label="Recent OHLC session table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Session Tape</h2>
              <p className="ax-card__subtitle">Last six trading sessions · OHLC &amp; volume</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Full history</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Open</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">High</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Low</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Close</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Volume</th>
                  <th className="ax-table__th" scope="col">Trend</th>
                </tr>
              </thead>
              <tbody>
                {TAPE.map(([date, o, h, l, c, closeColor, vol, tone, pct]) => (
                  <tr key={date} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{date}</td>
                    <td className="ax-table__td ax-table__td--num">{o}</td>
                    <td className="ax-table__td ax-table__td--num">{h}</td>
                    <td className="ax-table__td ax-table__td--num">{l}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: closeColor }}>{c}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-muted)' }}>{vol}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${tone} ax-badge--pill`}><span className="ax-badge__dot" />{pct}</span></td>
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

export default ApexFinancial;
