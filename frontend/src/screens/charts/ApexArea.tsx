'use client';
/*
 * Vireo Next.js — Area Charts (charts/apex-area). Faithful port of
 * src/html/charts/apex-area.html: basic single-tint hero (Chart/Table tabs),
 * usage rail, gradient, spline, stacked and negative area variants — all via
 * <ApexChart> on the live Aurora palette.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const REV = [42100, 48300, 45200, 53400, 57100, 55600, 62400, 60200, 68900, 72300, 70100, 74820];
const REV_LABELS = ['$42,100', '$48,300', '$45,200', '$53,400', '$57,100', '$55,600', '$62,400', '$60,200', '$68,900', '$72,300', '$70,100', '$74,820'];

const DOTS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
);

export function ApexArea() {
  const [tab, setTab] = useState<'chart' | 'table'>('chart');
  return (
    <>
      <PageHead
        title="Area Charts"
        subtitle="ApexCharts area family — basic, gradient, stacked, spline and negative variants, all on the live Aurora palette."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="https://apexcharts.com/docs/chart-types/area-chart/" target="_blank" rel="noopener">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5" /><path d="M3 16h5v5" /><path d="M3 21l5 -5" /></svg>
              <span className="ax-btn__label">Docs</span>
            </a>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export all</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19l4 -6l4 2l4 -5l4 4l0 5l-16 0" /><path d="M4 12l3 -4l4 2l5 -6l4 4" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* BASIC AREA hero */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Basic area chart of monthly revenue">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Basic · single tint</span>
              <h2 className="ax-card__title">Monthly Revenue</h2>
              <p className="ax-card__subtitle">12-month trend with a flat 12% area fill on the accent colour</p>
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
              <ApexChart type="area" height={330} legend="none" accent ariaLabel="Area chart of monthly revenue, headline $748.2K, up 12.4%"
                series={[{ name: 'Revenue', data: REV }]} apex={{ xaxis: { categories: MONTHS } }} />
            )}
            {tab === 'table' && (
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--compact">
                  <caption className="ax-visually-hidden">Monthly revenue, Jul to Jun</caption>
                  <thead className="ax-table__head"><tr><th className="ax-table__th" scope="col">Month</th><th className="ax-table__th ax-table__th--num" scope="col">Revenue</th></tr></thead>
                  <tbody>
                    {MONTHS.map((m, i) => (<tr key={m} className="ax-table__row"><td className="ax-table__td">{m}</td><td className="ax-table__td ax-table__td--num">{REV_LABELS[i]}</td></tr>))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* AT-A-GLANCE rail */}
        <section className="ax-card ax-col--4" role="region" aria-label="Area chart usage notes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">When to use area</h2>
              <p className="ax-card__subtitle">Quick reference</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19l4 -6l4 2l4 -5l4 4l0 5l-16 0" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Show volume over time</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>The filled area emphasises the magnitude of a single trending metric.</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M20 18v3" /><path d="M16 16v5" /><path d="M12 13v8" /><path d="M8 16v5" /><path d="M4 18v3" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Stack parts of a whole</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Stacked areas read composition without losing the total.</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12c.5 -1.5 2 -4 4 -4c3 0 3 6 6 6c2 0 3.5 -2.5 4 -4" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Smooth the noise</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Spline curves soften jagged sampling for a calmer read.</div></div>
            </div>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-1) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Recommended fill opacity</span>
              <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">8–14%</span>
            </div>
          </div>
        </section>

        {/* GRADIENT AREA */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Gradient area chart of payouts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Gradient fill</span>
              <h2 className="ax-card__title">Payout Volume</h2>
              <p className="ax-card__subtitle">Vertical gradient fade from accent to transparent</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Payout chart options">{DOTS}</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="area" height={300} legend="none" accent ariaLabel="Gradient area chart of weekly payout volume"
              series={[{ name: 'Payouts', data: [9.8, 11.2, 10.4, 13.1, 12.6, 15.4, 14.8, 17.2, 16.9, 19.4] }]}
              apex={{
                stroke: { width: 2.5, curve: 'smooth' },
                fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.42, opacityTo: 0.02, stops: [0, 92, 100] } },
                xaxis: { categories: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'] },
                yaxis: { labels: { formatter: (v: number) => '$' + v.toFixed(1) + 'K' } },
                tooltip: { y: { formatter: (v: number) => '$' + v.toFixed(1) + 'K' } },
              }} />
          </div>
        </section>

        {/* SPLINE AREA */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Spline area chart of active subscriptions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Smooth · spline</span>
              <h2 className="ax-card__title">Active Subscriptions</h2>
              <p className="ax-card__subtitle">Two metrics, smoothed curve, soft tint</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Pro</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Team</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="area" height={300} legend="none" ariaLabel="Spline area chart of Pro versus Team subscriptions"
              series={[{ name: 'Pro', data: [1240, 1310, 1280, 1420, 1510, 1480, 1620, 1710] }, { name: 'Team', data: [620, 680, 710, 760, 840, 880, 960, 1040] }]}
              apex={{
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet')],
                stroke: { width: 2.5, curve: 'smooth' },
                fill: { type: 'solid', opacity: 0.1 },
                xaxis: { categories: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
              }} />
          </div>
        </section>

        {/* STACKED AREA */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Stacked area chart of revenue by channel">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Stacked · parts of a whole</span>
              <h2 className="ax-card__title">Revenue by Channel</h2>
              <p className="ax-card__subtitle">Direct, organic, referral and paid stacked to the monthly total</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Mode">
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">Stacked</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">100%</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Direct</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Organic</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Referral</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-pink)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Paid</small></span>
            </div>
            <ApexChart type="area" height={320} stacked legend="none" accent ariaLabel="Stacked area chart of revenue by acquisition channel"
              series={[
                { name: 'Direct', data: [16200, 18400, 17100, 20300, 22100, 21400, 24600] },
                { name: 'Organic', data: [11400, 12600, 13200, 14100, 15600, 16200, 17800] },
                { name: 'Referral', data: [5400, 6100, 5800, 6600, 7200, 7000, 7900] },
                { name: 'Paid', data: [3100, 3400, 3300, 3900, 4200, 4000, 4600] },
              ]} />
          </div>
        </section>

        {/* NEGATIVE AREA */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Area chart with negative values for net cash flow">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Negative values</span>
              <h2 className="ax-card__title">Net Cash Flow</h2>
              <p className="ax-card__subtitle">Inflow above, outflow below zero</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="area" height={260} legend="none" ariaLabel="Area chart of net cash flow crossing the zero baseline"
              series={[{ name: 'Net flow', data: [4.2, -2.1, 6.4, 3.8, -1.6, 5.1, -3.2, 7.4, 4.6] }]}
              apex={{
                colors: [cv('--ax-viz-emerald')],
                stroke: { width: 2.5, curve: 'straight' },
                fill: { type: 'solid', opacity: 0.14 },
                xaxis: { categories: ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5', 'Wk6', 'Wk7', 'Wk8', 'Wk9'] },
                yaxis: { labels: { formatter: (v: number) => (v > 0 ? '+' : '') + '$' + v.toFixed(0) + 'K' } },
                annotations: { yaxis: [{ y: 0, borderColor: cv('--ax-border-strong'), strokeDashArray: 4 }] },
                tooltip: { y: { formatter: (v: number) => (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toFixed(1) + 'K' } },
              }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-3)' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Net this quarter</span>
              <b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-md)' }}>+$18,940</b>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default ApexArea;
