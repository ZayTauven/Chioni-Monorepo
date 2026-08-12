'use client';
/*
 * Vireo Next.js — Line Charts (charts/apex-line). Faithful port of
 * src/html/charts/apex-line.html: basic-with-markers hero (Chart/Table tabs),
 * stepline, multi-series, dashed comparison, annotated line + curve cheatsheet.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const DAU = [['Mon', '8,420'], ['Tue', '9,180'], ['Wed', '8,940'], ['Thu', '10,260'], ['Fri', '11,540'], ['Sat', '9,820'], ['Sun', '8,610']] as const;

export function ApexLine() {
  const [tab, setTab] = useState<'chart' | 'table'>('chart');
  return (
    <>
      <PageHead
        title="Line Charts"
        subtitle="ApexCharts line family — basic, multi-series, dashed comparison, stepline and annotated variants on the live palette."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="https://apexcharts.com/docs/chart-types/line-chart/" target="_blank" rel="noopener">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5" /><path d="M3 16h5v5" /><path d="M3 21l5 -5" /></svg>
              <span className="ax-btn__label">Docs</span>
            </a>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export all</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19l16 0" /><path d="M4 15l4 -6l4 2l4 -5l4 4" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* BASIC LINE WITH MARKERS hero */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Basic line chart of daily active users">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Basic · with markers</span>
              <h2 className="ax-card__title">Daily Active Users</h2>
              <p className="ax-card__subtitle">Single trend with points revealed on hover</p>
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
              <ApexChart type="line" height={330} legend="none" accent ariaLabel="Line chart of daily active users across two weeks"
                series={[{ name: 'Active users', data: [8420, 9180, 8940, 10260, 11540, 9820, 8610] }]}
                apex={{ stroke: { width: 2.5, curve: 'smooth' }, markers: { size: 0, hover: { size: 6 } }, xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] } }} />
            )}
            {tab === 'table' && (
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--compact">
                  <caption className="ax-visually-hidden">Daily active users by day</caption>
                  <thead className="ax-table__head"><tr><th className="ax-table__th" scope="col">Day</th><th className="ax-table__th ax-table__th--num" scope="col">Active users</th></tr></thead>
                  <tbody>{DAU.map(([d, v]) => (<tr key={d} className="ax-table__row"><td className="ax-table__td">{d}</td><td className="ax-table__td ax-table__td--num">{v}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* STEPLINE */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Stepline chart of subscription plan changes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Stepline</span>
              <h2 className="ax-card__title">Plan Seats</h2>
              <p className="ax-card__subtitle">Discrete step changes</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={300} legend="none" ariaLabel="Stepline chart of active plan seats over time"
              series={[{ name: 'Seats', data: [40, 40, 55, 55, 55, 80, 80, 110] }]}
              apex={{ colors: [cv('--ax-viz-violet')], stroke: { width: 2.5, curve: 'stepline' }, xaxis: { categories: ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5', 'Wk6', 'Wk7', 'Wk8'] } }} />
          </div>
        </section>

        {/* MULTI-SERIES LINE */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Multi-series line chart of revenue by region">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Multi-series</span>
              <h2 className="ax-card__title">Revenue by Region</h2>
              <p className="ax-card__subtitle">Three regions tracked monthly</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Americas</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>EMEA</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>APAC</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={300} legend="none" ariaLabel="Multi-series line chart of revenue across Americas, EMEA and APAC"
              series={[{ name: 'Americas', data: [62, 68, 65, 74, 80, 78, 86] }, { name: 'EMEA', data: [41, 44, 46, 50, 54, 56, 61] }, { name: 'APAC', data: [22, 26, 28, 31, 34, 38, 43] }]}
              apex={{ colors: [cv('--ax-accent'), cv('--ax-viz-cyan'), cv('--ax-viz-violet')], stroke: { width: 2.5, curve: 'smooth' }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] }, yaxis: { labels: { formatter: (v: number) => '$' + v + 'K' } } }} />
          </div>
        </section>

        {/* DASHED COMPARISON LINE */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Dashed line chart comparing this year to last year">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Dashed comparison</span>
              <h2 className="ax-card__title">This Year vs. Last</h2>
              <p className="ax-card__subtitle">Solid current period, dashed prior period</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>2025</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'repeating-linear-gradient(90deg,var(--ax-viz-cyan) 0 4px,transparent 4px 7px)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>2024</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={300} legend="none" ariaLabel="Line chart comparing this year solid against last year dashed"
              series={[{ name: '2025', data: [42, 48, 45, 53, 57, 55, 62] }, { name: '2024', data: [38, 41, 43, 47, 50, 53, 54] }]}
              apex={{ colors: [cv('--ax-accent'), cv('--ax-viz-cyan')], stroke: { width: [2.5, 2], curve: 'smooth', dashArray: [0, 6] }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] }, yaxis: { labels: { formatter: (v: number) => '$' + v + 'K' } } }} />
          </div>
        </section>

        {/* ANNOTATED LINE */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Annotated line chart of server response time">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">With annotations</span>
              <h2 className="ax-card__title">Response Time (p95)</h2>
              <p className="ax-card__subtitle">SLA threshold and a deploy marker called out inline</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Within SLA</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={320} legend="none" accent ariaLabel="Line chart of p95 response time with an SLA threshold line and a deploy annotation"
              series={[{ name: 'p95 (ms)', data: [182, 176, 190, 168, 240, 198, 174, 162, 158, 166, 154, 149] }]}
              apex={{
                stroke: { width: 2.5, curve: 'smooth' },
                markers: { size: 0, hover: { size: 6 } },
                xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
                yaxis: { labels: { formatter: (v: number) => v + 'ms' } },
                annotations: {
                  yaxis: [{ y: 200, borderColor: cv('--ax-danger-500'), strokeDashArray: 5, label: { text: 'SLA 200ms', style: { color: cv('--ax-on-accent'), background: cv('--ax-danger-500'), fontFamily: cv('--ax-font-sans'), fontSize: '11px' } } }],
                  xaxis: [{ x: 'Nov', borderColor: cv('--ax-border-strong'), strokeDashArray: 4, label: { text: 'v4.2 deploy', orientation: 'horizontal', style: { color: cv('--ax-text'), background: cv('--ax-surface-overlay'), fontFamily: cv('--ax-font-sans'), fontSize: '11px' } } }],
                },
                tooltip: { y: { formatter: (v: number) => v + ' ms' } },
              }} />
          </div>
        </section>

        {/* REFERENCE rail */}
        <section className="ax-card ax-col--4" role="region" aria-label="Line chart guidance">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Curve cheatsheet</h2>
              <p className="ax-card__subtitle">Pick the right stroke</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              {([['smooth', 'Spline', 'Trends, sampled metrics'], ['straight', 'Linear', 'Exact point-to-point values'], ['stepline', 'Step', 'Discrete states, counts, tiers']] as const).map(([badge, title, meta]) => (
                <li key={title} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-badge ax-badge--soft ax-badge--pill ax-mono" style={{ fontSize: 'var(--ax-text-2xs)' }}>{badge}</span></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{title}</span><span className="ax-list__meta" style={{ fontSize: 'var(--ax-text-xs)' }}>{meta}</span></span>
                </li>
              ))}
            </ul>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-3) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Default stroke width</span>
              <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">2px</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default ApexLine;
