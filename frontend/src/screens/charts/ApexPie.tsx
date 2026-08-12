'use client';
/*
 * Vireo Next.js — Pie & Donut Charts (charts/apex-pie). Faithful port of
 * src/html/charts/apex-pie.html: donut-with-centre-total hero (Chart/Table tabs +
 * legend list), basic pie, semi-circle gradient donut, gradient pie, monochrome
 * donut + guidance rail.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv, cvAll } from '../../components/charts/vizTokens';

const SERIES_TOKENS = ['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber', '--ax-viz-emerald'];
const LEGEND = [
  ['var(--ax-accent)', 'Lighting', '$386K'],
  ['var(--ax-viz-cyan)', 'Desk', '$290K'],
  ['var(--ax-viz-violet)', 'Drinkware', '$218K'],
  ['var(--ax-viz-pink)', 'Storage', '$133K'],
  ['var(--ax-viz-amber)', 'Stationery', '$109K'],
  ['var(--ax-viz-emerald)', 'Tech', '$72K'],
] as const;
const TABLE = [['Lighting', '$386K', '32%'], ['Desk', '$290K', '24%'], ['Drinkware', '$218K', '18%'], ['Storage', '$133K', '11%'], ['Stationery', '$109K', '9%'], ['Tech', '$72K', '6%']] as const;

export function ApexPie() {
  const [tab, setTab] = useState<'chart' | 'table'>('chart');
  return (
    <>
      <PageHead
        title="Pie & Donut Charts"
        subtitle="ApexCharts circular family — basic pie, donut with a centre total, gradient, semi-circle and monochrome variants."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="https://apexcharts.com/docs/chart-types/pie-donut/" target="_blank" rel="noopener">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 12v-7a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-5" /><path d="M3 16h5v5" /><path d="M3 21l5 -5" /></svg>
              <span className="ax-btn__label">Docs</span>
            </a>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export all</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3.2a9 9 0 1 0 10.8 10.8a1 1 0 0 0 -1 -1h-6.8a2 2 0 0 1 -2 -2v-7a.9 .9 0 0 0 -1 -.8" /><path d="M15 3.5a9 9 0 0 1 5.5 5.5h-4.5a1 1 0 0 1 -1 -1v-4.5" /></svg>
              <span className="ax-btn__label">New chart</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* DONUT WITH CENTRE TOTAL hero */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Donut chart of revenue by product category">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Donut · centre total</span>
              <h2 className="ax-card__title">Revenue by Category</h2>
              <p className="ax-card__subtitle">Six categories with the headline total in the ring</p>
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
              <div className="ax-grid" style={{ gridTemplateColumns: '1.1fr 1fr', gap: 'var(--ax-space-5)', alignItems: 'center' }}>
                <ApexChart type="donut" height={300} legend="none" ariaLabel="Donut chart of revenue by category, total $1.21M"
                  series={[386, 290, 218, 133, 109, 72]}
                  apex={{
                    labels: ['Lighting', 'Desk', 'Drinkware', 'Storage', 'Stationery', 'Tech'],
                    colors: cvAll(SERIES_TOKENS),
                    stroke: { width: 0 },
                    plotOptions: { pie: { donut: { size: '70%', labels: { show: true, name: { fontFamily: cv('--ax-font-sans') }, value: { fontFamily: cv('--ax-font-mono'), fontWeight: 600, formatter: (v: string) => '$' + v + 'K' }, total: { show: true, label: 'Total', fontFamily: cv('--ax-font-sans'), formatter: () => '$1.21M' } } } } },
                    tooltip: { y: { formatter: (v: number) => '$' + v + 'K' } },
                  }} />
                <ul className="ax-list ax-list--compact">
                  {LEGEND.map(([color, label, val], i) => (
                    <li key={label} className="ax-list__row" style={{ paddingInline: 0, ...(i === LEGEND.length - 1 ? { borderBottom: 0 } : {}) }}>
                      <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: color, display: 'inline-block' }} /></span>
                      <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{label}</span></span>
                      <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{val}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tab === 'table' && (
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--compact">
                  <caption className="ax-visually-hidden">Revenue by product category</caption>
                  <thead className="ax-table__head"><tr><th className="ax-table__th" scope="col">Category</th><th className="ax-table__th ax-table__th--num" scope="col">Revenue</th><th className="ax-table__th ax-table__th--num" scope="col">Share</th></tr></thead>
                  <tbody>{TABLE.map(([cat, rev, share]) => (<tr key={cat} className="ax-table__row"><td className="ax-table__td">{cat}</td><td className="ax-table__td ax-table__td--num">{rev}</td><td className="ax-table__td ax-table__td--num">{share}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* BASIC PIE */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Basic pie chart of traffic sources">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Basic pie</span>
              <h2 className="ax-card__title">Traffic Sources</h2>
              <p className="ax-card__subtitle">Share of sessions</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="pie" height={300} legend="none" ariaLabel="Pie chart of traffic sources: direct, organic, referral, social, email, paid"
              series={[38, 27, 14, 9, 7, 5]}
              apex={{ labels: ['Direct', 'Organic', 'Referral', 'Social', 'Email', 'Paid'], colors: cvAll(SERIES_TOKENS), stroke: { width: 0 }, tooltip: { y: { formatter: (v: number) => v + '%' } } }} />
          </div>
        </section>

        {/* SEMI-CIRCLE GRADIENT DONUT */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Semi-circle donut of storage usage">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Semi-circle · gradient</span>
              <h2 className="ax-card__title">Storage Used</h2>
              <p className="ax-card__subtitle">180° gauge-style donut</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="donut" height={240} legend="none" ariaLabel="Semi-circle donut of storage usage by type"
              series={[196, 92, 60, 164]}
              apex={{
                labels: ['Media', 'Documents', 'Backups', 'Free'],
                colors: [cv('--ax-accent'), cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-border')],
                stroke: { width: 0 },
                fill: { type: 'gradient', gradient: { shade: 'dark', shadeIntensity: 0.4, opacityFrom: 1, opacityTo: 0.9 } },
                plotOptions: { pie: { startAngle: -90, endAngle: 90, offsetY: 10, donut: { size: '68%', labels: { show: true, name: { offsetY: -8, fontFamily: cv('--ax-font-sans') }, value: { offsetY: -2, fontFamily: cv('--ax-font-mono'), fontWeight: 600, formatter: (v: string) => v + ' GB' }, total: { show: true, label: 'Used', fontFamily: cv('--ax-font-sans'), formatter: () => '348 GB' } } } } },
                tooltip: { y: { formatter: (v: number) => v + ' GB' } },
              }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Used of 512 GB</span>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>348 GB</b>
            </div>
          </div>
        </section>

        {/* GRADIENT PIE */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Gradient pie chart of plan distribution">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Gradient fill</span>
              <h2 className="ax-card__title">Plan Mix</h2>
              <p className="ax-card__subtitle">Accounts by tier</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="pie" height={300} legend="none" ariaLabel="Gradient pie chart of accounts by plan tier"
              series={[1840, 980, 540, 220]}
              apex={{ labels: ['Starter', 'Pro', 'Team', 'Enterprise'], colors: [cv('--ax-accent'), cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink')], stroke: { width: 0 }, fill: { type: 'gradient', gradient: { shade: 'dark', shadeIntensity: 0.45, opacityFrom: 1, opacityTo: 0.88 } }, tooltip: { y: { formatter: (v: number) => v.toLocaleString() + ' accounts' } } }} />
          </div>
        </section>

        {/* MONOCHROME DONUT */}
        <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Monochrome donut of device breakdown">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Monochrome</span>
              <h2 className="ax-card__title">Sessions by Device</h2>
              <p className="ax-card__subtitle">Single-hue accent ramp</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="donut" height={230} legend="none" ariaLabel="Monochrome donut of sessions by device"
              series={[58, 34, 8]}
              apex={{
                labels: ['Desktop', 'Mobile', 'Tablet'],
                colors: [cv('--ax-accent'), 'color-mix(in oklab, ' + cv('--ax-accent') + ' 62%, transparent)', 'color-mix(in oklab, ' + cv('--ax-accent') + ' 32%, transparent)'],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, name: { fontFamily: cv('--ax-font-sans') }, value: { fontFamily: cv('--ax-font-mono'), fontWeight: 600, formatter: (v: string) => v + '%' }, total: { show: true, label: 'Sessions', fontFamily: cv('--ax-font-sans'), formatter: () => '54.2K' } } } } },
                tooltip: { y: { formatter: (v: number) => v + '%' } },
              }} />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {([['var(--ax-accent)', 'Desktop', '58%'], ['color-mix(in oklab,var(--ax-accent) 62%,transparent)', 'Mobile', '34%'], ['color-mix(in oklab,var(--ax-accent) 32%,transparent)', 'Tablet', '8%']] as const).map(([color, label, pct]) => (
                <li key={label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* NOTES rail */}
        <section className="ax-card ax-col--4" role="region" aria-label="Pie chart guidance">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Pie vs. donut</h2>
              <p className="ax-card__subtitle">Quick guidance</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v5m4 4h5" /><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Keep slices few</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Five or six categories max — more and the eye gives up.</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Donut for a headline</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>The hole is prime space for the total or a KPI.</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M14 4m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /><path d="M4 14m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg></span>
              <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Monochrome for ranked parts</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>An accent ramp reads order without six hues.</div></div>
            </div>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-1) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Largest category</span>
              <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">Lighting · 32%</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default ApexPie;
