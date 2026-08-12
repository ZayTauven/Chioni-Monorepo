'use client';
/*
 * Vireo Next.js — Chart.js Gallery (charts/chartjs). Faithful port of
 * src/html/charts/chartjs.html: line/bar/radar/doughnut/polar/pie/mixed/bubble
 * proving cross-library palette parity. The reference renders every chart via the
 * shared Apex wrapper (no real Chart.js runtime), so each maps to <ApexChart>.
 * A pill-tab filter (All/Cartesian/Radial/Mixed) shows/hides cards.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { cv } from '../../components/charts/vizTokens';

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
type Tab = 'all' | 'cartesian' | 'radial' | 'mixed';

export function ChartJs() {
  const [tab, setTab] = useState<Tab>('all');
  const show = (groups: Tab[]) => groups.includes(tab);

  return (
    <>
      <PageHead
        title="Chart.js Gallery"
        subtitle="Line, bar, radar & doughnut — the same Aurora palette & chrome, proving cross-library parity."
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
        <div className="ax-col--12">
          <div className="ax-tabs ax-tabs--pill" role="tablist" aria-label="Filter chart types">
            <div className="ax-tabs__list">
              {(['all', 'cartesian', 'radial', 'mixed'] as Tab[]).map((t) => (
                <button key={t} type="button" className={`ax-tabs__tab${tab === t ? ' is-active' : ''}`} aria-selected={tab === t} onClick={() => setTab(t)} role="tab">{t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Line */}
        {show(['all', 'cartesian']) && (
          <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Revenue line chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Line</span>
                <h2 className="ax-card__title">Revenue vs. Target</h2>
                <p className="ax-card__subtitle">Monthly · Jul 2025 – Jun 2026</p>
              </div>
              <div className="ax-card__actions">
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Revenue</small></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Target</small></span>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="line" height={320} legend="none" accent ariaLabel="Line chart of monthly revenue versus target"
                series={[{ name: 'Revenue', data: [42, 48, 45, 53, 57, 55, 62, 60, 68, 72, 70, 74] }, { name: 'Target', data: [45, 48, 50, 52, 55, 57, 60, 62, 65, 68, 70, 72] }]}
                apex={{ colors: [cv('--ax-accent'), cv('--ax-viz-cyan')], stroke: { width: [2.5, 2], curve: 'smooth', dashArray: [0, 5] }, markers: { size: 0, hover: { size: 5 } }, xaxis: { categories: MONTHS }, yaxis: { labels: { formatter: (v: number) => '$' + v + 'K' } } }} />
            </div>
          </section>
        )}

        {/* Doughnut */}
        {show(['all', 'radial']) && (
          <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Category doughnut chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Doughnut</span>
                <h2 className="ax-card__title">Category Split</h2>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="donut" height={320} legend="bottom" ariaLabel="Doughnut chart of revenue by product category"
                series={[32, 24, 18, 11, 9, 6]}
                apex={{ labels: ['Lighting', 'Desk', 'Drinkware', 'Storage', 'Stationery', 'Tech'], colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4'), cv('--ax-chart-5'), cv('--ax-chart-6')], stroke: { width: 0 }, plotOptions: { pie: { donut: { size: '68%', labels: { show: true, name: { fontFamily: cv('--ax-font-sans') }, value: { fontFamily: cv('--ax-font-mono'), fontWeight: 600, formatter: (v: string): string => v + '%' }, total: { show: true, label: 'Categories', formatter: () => '6' } } } } } }} />
            </div>
          </section>
        )}

        {/* Horizontal bar */}
        {show(['all', 'cartesian']) && (
          <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Horizontal bar chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Bar</span>
                <h2 className="ax-card__title">Orders by Channel</h2>
                <p className="ax-card__subtitle">Last quarter</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="bar" height={300} legend="none" ariaLabel="Horizontal bar chart of orders by channel"
                series={[{ name: 'Orders', data: [486, 372, 214, 158, 96] }]}
                apex={{ plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '60%', distributed: true } }, colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4'), cv('--ax-chart-5')], xaxis: { categories: ['Organic', 'Direct', 'Referral', 'Social', 'Email'] } }} />
            </div>
          </section>
        )}

        {/* Stacked column */}
        {show(['all', 'cartesian']) && (
          <section className="ax-card ax-card--chart ax-col--6" role="region" aria-label="Stacked column chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Stacked column</span>
                <h2 className="ax-card__title">New vs. Returning</h2>
                <p className="ax-card__subtitle">Visitors per month</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="bar" height={300} legend="bottom" stacked ariaLabel="Stacked column chart of new versus returning visitors"
                series={[{ name: 'New', data: [41, 46, 43, 50, 56, 52] }, { name: 'Returning', data: [32, 35, 34, 39, 41, 40] }]}
                apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2')], plotOptions: { bar: { columnWidth: '52%', borderRadius: 4 } }, xaxis: { categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] } }} />
            </div>
          </section>
        )}

        {/* Radar */}
        {show(['all', 'radial']) && (
          <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Radar chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Radar</span>
                <h2 className="ax-card__title">Team Skills</h2>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="radar" height={320} legend="bottom" ariaLabel="Radar chart comparing two team members across six skills"
                series={[{ name: 'Marcus', data: [85, 72, 90, 65, 78, 88] }, { name: 'Priya', data: [70, 88, 75, 92, 84, 66] }]}
                apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2')], stroke: { width: 2 }, fill: { opacity: 0.14 }, markers: { size: 3 }, xaxis: { categories: ['Code', 'Design', 'Data', 'Comms', 'Ops', 'QA'] } }} />
            </div>
          </section>
        )}

        {/* Polar area */}
        {show(['all', 'radial']) && (
          <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Polar area chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Polar area</span>
                <h2 className="ax-card__title">Support Load</h2>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="polarArea" height={320} legend="bottom" ariaLabel="Polar area chart of support load by team"
                series={[14, 23, 11, 17, 9]}
                apex={{ labels: ['Billing', 'Bugs', 'How-to', 'Feature', 'Account'], colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4'), cv('--ax-chart-5')], stroke: { width: 1, colors: [cv('--ax-border')] }, fill: { opacity: 0.78 }, yaxis: { show: false } }} />
            </div>
          </section>
        )}

        {/* Pie */}
        {show(['all', 'radial']) && (
          <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Pie chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Pie</span>
                <h2 className="ax-card__title">Traffic Sources</h2>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="pie" height={320} legend="bottom" ariaLabel="Pie chart of traffic sources"
                series={[38, 27, 14, 9, 7, 5]}
                apex={{ labels: ['Direct', 'Organic', 'Referral', 'Social', 'Email', 'Paid'], colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4'), cv('--ax-chart-5'), cv('--ax-chart-6')], stroke: { width: 0 } }} />
            </div>
          </section>
        )}

        {/* Mixed */}
        {show(['all', 'mixed']) && (
          <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Mixed bar and line chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Mixed</span>
                <h2 className="ax-card__title">Sessions &amp; Conversion</h2>
                <p className="ax-card__subtitle">Columns = sessions · line = conversion %</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="line" height={320} legend="bottom" ariaLabel="Mixed chart of sessions columns and conversion-rate line"
                series={[{ name: 'Sessions', type: 'column', data: [9.2, 10.4, 9.8, 11.2, 12.6, 11.9, 13.4, 14.1, 13.7, 15.2, 16.1, 17.4] }, { name: 'Conversion %', type: 'line', data: [2.1, 2.3, 2.2, 2.5, 2.6, 2.4, 2.8, 3.0, 2.9, 3.2, 3.4, 3.6] }]}
                apex={{ colors: [cv('--ax-viz-cyan'), cv('--ax-accent')], stroke: { width: [0, 2.8], curve: 'smooth' }, plotOptions: { bar: { columnWidth: '48%', borderRadius: 4 } }, xaxis: { categories: MONTHS }, yaxis: [{ labels: { formatter: (v: number) => v + 'K' } }, { opposite: true, labels: { formatter: (v: number) => v.toFixed(1) + '%' } }] }} />
            </div>
          </section>
        )}

        {/* Bubble */}
        {show(['all', 'mixed']) && (
          <section className="ax-card ax-card--chart ax-col--4" role="region" aria-label="Bubble chart">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">Bubble</span>
                <h2 className="ax-card__title">Campaigns</h2>
                <p className="ax-card__subtitle">Spend × reach × ROAS</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ApexChart type="bubble" height={300} legend="none" ariaLabel="Bubble chart of campaign spend, reach and ROAS"
                series={[{ name: 'Pulse', data: [[40, 28, 14]] }, { name: 'Beacon', data: [[62, 44, 22]] }, { name: 'Halo', data: [[78, 60, 9]] }, { name: 'Drift', data: [[55, 36, 17]] }]}
                apex={{ colors: [cv('--ax-chart-1'), cv('--ax-chart-2'), cv('--ax-chart-3'), cv('--ax-chart-4')], fill: { opacity: 0.7 }, xaxis: { tickAmount: 5, labels: { formatter: (v: string) => '$' + Math.round(Number(v)) + 'K' } }, yaxis: { max: 70, labels: { formatter: (v: number) => Math.round(v) + 'K' } } }} />
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export default ChartJs;
