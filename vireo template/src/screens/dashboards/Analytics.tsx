'use client';
/*
 * Vireo Next.js — Analytics dashboard (route "dashboards/analytics").
 *
 * Faithful re-expression of src/html/dashboards/analytics.html: 4 KPI cards with
 * sparklines, an Audience Overview mixed chart, conversion funnel, two channel/
 * device donuts, a real-time "Right Now" panel, a Top Pages table and a Top
 * Referrers + Recent Events column. Charts go through <ApexChart>; DOM classes,
 * copy and ARIA match the reference 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const VIZ_FALLBACK: Record<string, string> = {
  '--ax-accent': '#2DD4BF',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
};
function tokenColors(tokens: string[]): string[] {
  if (typeof document === 'undefined') return tokens.map((t) => VIZ_FALLBACK[t] || '#38BDF8');
  const cs = getComputedStyle(document.documentElement);
  return tokens.map((t) => cs.getPropertyValue(t).trim() || VIZ_FALLBACK[t] || '#38BDF8');
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);

export function Analytics() {
  return (
    <>
      <PageHead
        title="Analytics"
        subtitle="Audience, acquisition & behaviour — last 30 days vs. prior period."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></svg>
              <span className="ax-btn__label">Last 30 days</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Refresh dashboard">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M12 17v-6" /><path d="M9.5 14.5l2.5 2.5l2.5 -2.5" /></svg>
              <span className="ax-btn__label">Export report</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Sessions 128,400, up 8.7%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M3.6 9h16.8" /><path d="M3.6 15h16.8" /><path d="M11.5 3a17 17 0 0 0 0 18" /><path d="M12.5 3a17 17 0 0 1 0 18" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}8.7%</span>
            </div>
            <div className="ax-kpi__label">Sessions</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">128,400</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [7, 10, 9, 17, 20, 22, 27, 30] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Unique Visitors 74,210, up 5.3%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}5.3%</span>
            </div>
            <div className="ax-kpi__label">Unique Visitors</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">74,210</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-cyan" series={[{ name: 'Trend', data: [9, 12, 11, 16, 18, 21, 24, 28] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Bounce Rate 41.2 percent, down 2.1 percent which is an improvement">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_DN}2.1%</span>
            </div>
            <div className="ax-kpi__label">Bounce Rate</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">41.2%</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-emerald" series={[{ name: 'Trend', data: [26, 23, 24, 20, 18, 15, 12, 8] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Average Session Duration 3 minutes 12 seconds, up 0.4%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}0.4%</span>
            </div>
            <div className="ax-kpi__label">Avg. Session Duration</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">3m 12s</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-amber" series={[{ name: 'Trend', data: [14, 16, 13, 19, 17, 21, 19, 22] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* HERO: Audience Overview (mixed) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Audience overview">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Acquisition</span>
              <h2 className="ax-card__title">Audience Overview</h2>
              <p className="ax-card__subtitle">Sessions trend with new vs. returning visitors</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Week</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">Month</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Year</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Sessions</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>New visitors</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Returning</small></span>
            </div>
            <ApexChart
              type="line"
              height={320}
              legend="none"
              ariaLabel="Mixed chart of sessions area with new and returning visitor columns by month"
              series={[
                { name: 'Sessions', type: 'line', data: [9200, 10400, 9800, 11200, 12600, 11900, 13400, 14100, 13700, 15200, 16100, 17400] },
                { name: 'New visitors', type: 'column', data: [4100, 4600, 4300, 5000, 5600, 5200, 5900, 6300, 6000, 6700, 7100, 7600] },
                { name: 'Returning', type: 'column', data: [3200, 3500, 3400, 3900, 4100, 4000, 4400, 4700, 4500, 4900, 5200, 5500] },
              ]}
              apex={{
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet']),
                stroke: { width: [2.5, 0, 0], curve: 'smooth' },
                fill: { type: ['solid', 'solid', 'solid'], opacity: [1, 1, 1] },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } },
                xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
              }}
            />
          </div>
        </section>

        {/* Conversion Funnel */}
        <section className="ax-card ax-col--4" role="region" aria-label="Conversion funnel">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Conversion Funnel</h2>
              <p className="ax-card__subtitle">Visit → Paid this period</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Visited</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>128,400</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '100%', background: 'var(--ax-accent)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Signed up</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>38,520 <small style={{ color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>· 30.0%</small></b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '30%', background: 'var(--ax-viz-cyan)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Activated</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>14,124 <small style={{ color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>· 11.0%</small></b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '11%', background: 'var(--ax-viz-violet)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Paid</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>3,648 <small style={{ color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>· 2.84%</small></b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '6%', background: 'var(--ax-viz-pink)' }} /></div></div>
            </div>
            <div className="ax-divider" style={{ margin: 'var(--ax-space-1) 0' }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Visit-to-paid conversion</span>
              <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />2.84%</span>
            </div>
          </div>
        </section>

        {/* Traffic Channels donut */}
        <section className="ax-card ax-col--4" role="region" aria-label="Traffic channels">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Traffic Channels</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Traffic channel options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={230}
              legend="none"
              ariaLabel="Donut chart of traffic channels: organic 42%, direct 24%, social 16%, referral 11%, paid 7%"
              series={[42, 24, 16, 11, 7]}
              apex={{
                labels: ['Organic', 'Direct', 'Social', 'Referral', 'Paid'],
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Sessions', formatter: () => '128.4K' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'Organic search', color: 'var(--ax-accent)', pct: '42%' },
                { label: 'Direct', color: 'var(--ax-viz-cyan)', pct: '24%' },
                { label: 'Social', color: 'var(--ax-viz-violet)', pct: '16%' },
                { label: 'Referral', color: 'var(--ax-viz-pink)', pct: '11%' },
                { label: 'Paid', color: 'var(--ax-viz-amber)', pct: '7%' },
              ].map((c) => (
                <li key={c.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{c.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{c.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sessions by Device donut */}
        <section className="ax-card ax-col--4" role="region" aria-label="Sessions by device">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Sessions by Device</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={230}
              legend="none"
              ariaLabel="Donut chart of sessions by device: desktop 56%, mobile 37%, tablet 7%"
              series={[56, 37, 7]}
              apex={{
                labels: ['Desktop', 'Mobile', 'Tablet'],
                colors: tokenColors(['--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Sessions', formatter: () => '128.4K' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'Desktop', color: 'var(--ax-viz-cyan)', pct: '56%' },
                { label: 'Mobile', color: 'var(--ax-viz-violet)', pct: '37%' },
                { label: 'Tablet', color: 'var(--ax-viz-pink)', pct: '7%' },
              ].map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Right Now + Goal completions */}
        <section className="ax-card ax-col--4" role="region" aria-label="Real-time active users and goal completions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Right Now</h2>
              <p className="ax-card__subtitle">Active users on site</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Live</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, lineHeight: 1, color: 'var(--ax-text-strong)', transition: 'opacity var(--ax-motion-base)' }}>1,284</div>
            <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={44} color="--ax-accent" series={[{ name: 'Active users', data: [10, 18, 14, 26, 20, 30, 24, 34, 28, 36, 30, 38, 32] }]} style={{ minHeight: 44, margin: 'var(--ax-space-3) 0 var(--ax-space-4)' }} />
            <div className="ax-divider" style={{ marginBottom: 'var(--ax-space-4)' }} />
            <span className="ax-card__eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-3)' }}>Goal Completions</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Newsletter signups</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>82%</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '82%', background: 'var(--ax-accent)' }} /></div></div>
              </div>
              <div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Demo requests</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>64%</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '64%', background: 'var(--ax-viz-cyan)' }} /></div></div>
              </div>
              <div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Checkout reached</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>47%</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '47%', background: 'var(--ax-viz-violet)' }} /></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* Top Pages table */}
        <section className="ax-card ax-col--8" role="region" aria-label="Top pages">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Top Pages</h2>
              <p className="ax-card__subtitle">Most-viewed pages this period</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Page</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Pageviews</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Avg. time</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Bounce</th>
                  <th className="ax-table__th" scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { path: '/', sub: 'Homepage', views: '41,820', time: '1m 48s', bounce: '38.4%', pct: '100%', color: 'var(--ax-accent)' },
                  { path: '/pricing', sub: 'Plans & pricing', views: '28,640', time: '2m 36s', bounce: '29.7%', pct: '68%', color: 'var(--ax-viz-cyan)' },
                  { path: '/blog/scaling-aurora', sub: 'Article', views: '19,210', time: '4m 02s', bounce: '22.1%', pct: '46%', color: 'var(--ax-viz-violet)' },
                  { path: '/signup', sub: 'Registration', views: '15,008', time: '3m 19s', bounce: '18.6%', pct: '36%', color: 'var(--ax-viz-pink)' },
                  { path: '/docs/api', sub: 'Documentation', views: '11,742', time: '5m 51s', bounce: '14.2%', pct: '28%', color: 'var(--ax-viz-amber)' },
                ].map((r) => (
                  <tr key={r.path} className="ax-table__row">
                    <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.path}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.sub}</div></td>
                    <td className="ax-table__td ax-table__td--num">{r.views}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-muted)' }}>{r.time}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-muted)' }}>{r.bounce}</td>
                    <td className="ax-table__td"><div className="ax-progress ax-progress--sm" style={{ minWidth: 120 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: r.pct, background: r.color }} /></div></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Referrers + Recent Events */}
        <section className="ax-card ax-col--4" role="region" aria-label="Top referrers">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Top Referrers</h2></div>
            <a className="ax-btn ax-btn--link" href="#">All</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>google.com</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Search</div></div>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>31,204</b>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M9 18l-1 3l-3 -3a9 8 0 1 1 7 0" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>reddit.com</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Community</div></div>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>8,940</b>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 4.01c-1 .49 -1.98 .689 -3 .99c-1.121 -1.265 -2.783 -1.335 -4.38 -.737s-2.643 2.06 -2.62 3.737v1c-3.245 .083 -6.135 -1.395 -8 -4c0 0 -4.182 7.433 4 11c-1.872 1.247 -3.739 2.088 -6 2c3.308 1.803 6.913 2.423 10.034 1.517c3.58 -1.04 6.522 -3.723 7.651 -7.742a13.84 13.84 0 0 0 .497 -3.753c0 -.249 1.51 -2.772 1.818 -4.013z" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>x.com</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Social</div></div>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>6,512</b>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M8 11l0 5" /><path d="M8 8l0 .01" /><path d="M12 16l0 -5" /><path d="M16 16v-3a2 2 0 0 0 -4 0" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>linkedin.com</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Professional</div></div>
              <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>4,108</b>
            </div>
          </div>
          <div className="ax-card__header" style={{ borderTop: '1px solid var(--ax-border)' }}>
            <div className="ax-card__titles"><h2 className="ax-card__title">Recent Events</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-timeline">
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title">Conversion spike on <span style={{ color: 'var(--ax-accent)' }}>/pricing</span></p><span className="ax-timeline__time">6m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title">Goal <b style={{ color: 'var(--ax-text-strong)' }}>Demo request</b> completed 41×</p><span className="ax-timeline__time">24m ago</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title">Bounce rate alert on <b style={{ color: 'var(--ax-text-strong)' }}>/checkout</b></p><span className="ax-timeline__time">1h ago</span></div>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Analytics;
