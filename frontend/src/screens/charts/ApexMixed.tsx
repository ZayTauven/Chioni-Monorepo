'use client';
/*
 * Vireo Next.js — Mixed Charts (charts/apex-mixed). Faithful port of
 * src/html/charts/apex-mixed.html: line+column hero (Chart/Table tabs), reading
 * guidance rail, area+line, dual-axis and triple-combo charts via <ApexChart>.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const TABLE = [['Jan', '$62K', '2.4%'], ['Feb', '$60K', '2.5%'], ['Mar', '$69K', '2.7%'], ['Apr', '$72K', '2.9%'], ['May', '$70K', '3.0%'], ['Jun', '$75K', '3.2%']] as const;

export function ApexMixed() {
  const [tab, setTab] = useState<'chart' | 'table'>('chart');
  return (
    <>
      <PageHead
        title="Mixed Charts"
        subtitle="ApexCharts combo charts — line + column, area + line, and dual-axis pairings where one metric leads on the accent colour."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="https://apexcharts.com/docs/chart-types/mixed-charts/" target="_blank" rel="noopener">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5" /><path d="M3 16h5v5" /><path d="M3 21l5 -5" /></svg>
              <span className="ax-btn__label">Docs</span>
            </a>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export all</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M9 17v-5" /><path d="M13 17v-3" /><path d="M17 17v-7" /><path d="M9 9l4 -2l4 -3" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* LINE + COLUMN hero */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Combo chart of revenue columns and conversion line">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Line + column</span>
              <h2 className="ax-card__title">Revenue &amp; Conversion</h2>
              <p className="ax-card__subtitle">Monthly revenue as columns, conversion rate as the accent line</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="tablist" aria-label="View mode">
                <button type="button" className={`ax-btn ax-btn--sm${tab === 'chart' ? ' is-selected' : ''}`} onClick={() => setTab('chart')} aria-selected={tab === 'chart'} role="tab">Chart</button>
                <button type="button" className={`ax-btn ax-btn--sm${tab === 'table' ? ' is-selected' : ''}`} onClick={() => setTab('table')} aria-selected={tab === 'table'} role="tab">Table</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Revenue</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Conversion %</small></span>
            </div>
            {tab === 'chart' && (
              <ApexChart type="line" height={330} legend="none" ariaLabel="Combo chart of revenue columns and conversion rate line by month"
                series={[{ name: 'Revenue', type: 'column', data: [62, 60, 69, 72, 70, 75] }, { name: 'Conversion %', type: 'line', data: [2.4, 2.5, 2.7, 2.9, 3.0, 3.2] }]}
                apex={{ colors: [cv('--ax-viz-cyan'), cv('--ax-accent')], stroke: { width: [0, 3], curve: 'smooth' }, plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '46%' } }, markers: { size: 0, hover: { size: 6 } }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] }, yaxis: [{ labels: { formatter: (v: number) => '$' + v + 'K' } }, { opposite: true, labels: { formatter: (v: number) => v.toFixed(1) + '%' } }] }} />
            )}
            {tab === 'table' && (
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--compact">
                  <caption className="ax-visually-hidden">Revenue and conversion rate by month</caption>
                  <thead className="ax-table__head"><tr><th className="ax-table__th" scope="col">Month</th><th className="ax-table__th ax-table__th--num" scope="col">Revenue</th><th className="ax-table__th ax-table__th--num" scope="col">Conv.</th></tr></thead>
                  <tbody>{TABLE.map(([m, rev, conv]) => (<tr key={m} className="ax-table__row"><td className="ax-table__td">{m}</td><td className="ax-table__td ax-table__td--num">{rev}</td><td className="ax-table__td ax-table__td--num">{conv}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* NOTES rail */}
        <section className="ax-card ax-col--4" role="region" aria-label="Mixed chart guidance">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Reading combos</h2>
              <p className="ax-card__subtitle">Two metrics, one frame</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19l16 0" /><path d="M4 15l4 -6l4 2l4 -5l4 4" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Lead with the line</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>The accent line is the story; columns give it context.</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4v16" /><path d="M4 8h12" /><path d="M4 16h6" /><path d="M16 4l4 4l-4 4" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Use a second axis</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Different units (dollars vs. percent) need their own scale.</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M20 18l-6 -6l-4 4l-6 -6" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Keep it to two</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Three or more series in a combo gets hard to read fast.</div></div>
            </div>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-1) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Best conversion month</span>
              <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-num">Jun · 3.2%</span>
            </div>
          </div>
        </section>

        {/* AREA + LINE */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Area and line combo of traffic and signups">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Area + line</span>
              <h2 className="ax-card__title">Traffic &amp; Signups</h2>
              <p className="ax-card__subtitle">Sessions as a tinted area, signups as a line</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Sessions</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Signups</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={300} legend="none" ariaLabel="Combo chart of sessions area and signups line by month"
              series={[{ name: 'Sessions', type: 'area', data: [92, 104, 98, 112, 126, 119, 134] }, { name: 'Signups', type: 'line', data: [18, 21, 19, 24, 28, 26, 31] }]}
              apex={{ colors: [cv('--ax-viz-cyan'), cv('--ax-accent')], stroke: { width: [2, 3], curve: 'smooth' }, fill: { type: ['gradient', 'solid'], gradient: { opacityFrom: 0.3, opacityTo: 0.02, stops: [0, 95] } }, markers: { size: 0, hover: { size: 6 } }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] }, yaxis: { labels: { formatter: (v: number) => v + 'K' } } }} />
          </div>
        </section>

        {/* MULTI-AXIS */}
        <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Dual-axis combo of spend and ROAS">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Dual axis</span>
              <h2 className="ax-card__title">Ad Spend &amp; ROAS</h2>
              <p className="ax-card__subtitle">Spend in dollars (left), return on ad spend (right)</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Spend</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>ROAS</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={300} legend="none" ariaLabel="Dual-axis combo chart of ad spend columns and ROAS line"
              series={[{ name: 'Spend', type: 'column', data: [12.4, 14.1, 13.2, 16.8, 18.2, 17.6] }, { name: 'ROAS', type: 'line', data: [3.1, 3.4, 3.0, 3.8, 4.2, 4.6] }]}
              apex={{ colors: [cv('--ax-viz-violet'), cv('--ax-accent')], stroke: { width: [0, 3], curve: 'smooth' }, plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '46%' } }, markers: { size: 0, hover: { size: 6 } }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] }, yaxis: [{ title: { text: 'Spend ($K)', style: { color: cv('--ax-text-subtle'), fontFamily: cv('--ax-font-sans') } }, labels: { formatter: (v: number) => '$' + v + 'K' } }, { opposite: true, title: { text: 'ROAS', style: { color: cv('--ax-text-subtle'), fontFamily: cv('--ax-font-sans') } }, labels: { formatter: (v: number) => v.toFixed(1) + '×' } }] }} />
          </div>
        </section>

        {/* TRIPLE COMBO */}
        <section className="ax-card ax-card--chart ax-col--12" role="region" aria-label="Combo chart of inventory, sell-through and returns">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Column + column + line</span>
              <h2 className="ax-card__title">Inventory Health</h2>
              <p className="ax-card__subtitle">Stock received and sold as columns, sell-through rate as the accent line</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Received</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Sold</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Sell-through %</small></span>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="line" height={340} legend="none" ariaLabel="Combo chart of inventory received, sold and sell-through rate across twelve months"
              series={[
                { name: 'Received', type: 'column', data: [420, 380, 460, 510, 480, 540, 500, 560, 590, 620, 600, 640] },
                { name: 'Sold', type: 'column', data: [360, 340, 410, 470, 440, 500, 470, 520, 560, 590, 580, 610] },
                { name: 'Sell-through %', type: 'line', data: [86, 89, 89, 92, 92, 93, 94, 93, 95, 95, 97, 95] },
              ]}
              apex={{ colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-accent')], stroke: { width: [0, 0, 3], curve: 'smooth' }, plotOptions: { bar: { borderRadius: 4, borderRadiusApplication: 'end', columnWidth: '60%' } }, markers: { size: 0, hover: { size: 6 } }, xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] }, yaxis: [{ labels: { formatter: (v: number) => v + '' } }, { show: false }, { opposite: true, min: 80, max: 100, labels: { formatter: (v: number) => v + '%' } }] }} />
          </div>
        </section>
      </div>
    </>
  );
}

export default ApexMixed;
