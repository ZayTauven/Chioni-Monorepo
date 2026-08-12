'use client';
/*
 * Vireo Next.js — Social Media dashboard (dashboards/social).
 *
 * Faithful re-expression of src/html/dashboards/social.html: KPI row, an
 * audience-growth area chart, engagement-by-platform bars, an engagement-types
 * donut, a sentiment semi-gauge (radialBar), a scheduled-posts timeline, a top-
 * posts table and a recent-mentions timeline. Charts via <ApexChart>; shared
 * ax-col--N grid utilities.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const FALLBACK: Record<string, string> = {
  '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA', '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24', '--ax-viz-emerald': '#34D399', '--ax-text-strong': '#E8EEF6',
  '--ax-text-muted': '#9FB0C3', '--ax-surface-subtle': 'rgba(255,255,255,.04)',
};
function cv(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || '#38BDF8';
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);

const KPIS = [
  { region: 'Total Followers 482K, up 3.8%', c: 'c1', delta: '3.8%', label: 'Total Followers', value: '482K', color: '--ax-accent', spark: [7, 9, 10, 14, 16, 20, 24, 28],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg> },
  { region: 'Engagement Rate 4.6%, up 0.5%', c: 'c2', delta: '0.5%', label: 'Engagement Rate', value: '4.6%', color: '--ax-viz-cyan', spark: [10, 12, 11, 15, 17, 18, 21, 23],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg> },
  { region: 'Impressions this month 2.4M, up 12.0%', c: 'c3', delta: '12.0%', label: 'Impressions (30D)', value: '2.4M', color: '--ax-viz-violet', spark: [6, 10, 9, 16, 18, 23, 26, 30],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg> },
  { region: 'New Followers this month 18.2K, up 6.0%', c: 'c4', delta: '6.0%', label: 'New Followers (30D)', value: '18.2K', color: '--ax-viz-amber', spark: [9, 11, 10, 16, 15, 21, 23, 26],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /><path d="M19 16v6" /><path d="M16 19h6" /></svg> },
];

const PLATFORMS = [
  { label: 'Instagram', pct: '38%', w: 38, color: 'var(--ax-accent)' },
  { label: 'TikTok', pct: '27%', w: 27, color: 'var(--ax-viz-cyan)' },
  { label: 'X / Twitter', pct: '16%', w: 16, color: 'var(--ax-viz-violet)' },
  { label: 'LinkedIn', pct: '12%', w: 12, color: 'var(--ax-viz-pink)' },
  { label: 'Facebook', pct: '7%', w: 7, color: 'var(--ax-viz-amber)' },
];

const ENGAGE = [
  { c: 'var(--ax-viz-cyan)', label: 'Likes', n: '684K' },
  { c: 'var(--ax-viz-violet)', label: 'Comments', n: '142K' },
  { c: 'var(--ax-viz-pink)', label: 'Shares', n: '96K' },
  { c: 'var(--ax-viz-amber)', label: 'Saves', n: '58K' },
];

const SCHEDULED = [
  { date: 'Today', accent: true, title: 'Summer collection teaser', sub: 'Instagram · Reel · 18:00' },
  { date: 'Jun 28', accent: false, title: 'Behind-the-scenes thread', sub: 'X · Thread · 12:30' },
  { date: 'Jun 29', accent: false, title: 'Customer spotlight', sub: 'TikTok · Video · 09:00' },
  { date: 'Jul 1', accent: false, title: 'Q3 hiring announcement', sub: 'LinkedIn · Article · 10:00' },
];

const IG_ICON = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M4 4m0 3a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3z" /><path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5" /><path d="M14 14l1 -1a3 5 0 0 1 3 0l2 2" /></svg>;
const IG2_ICON = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M4 4m0 3a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v10a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3z" /><path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5" /></svg>;
const PLAY_ICON = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg>;
const MSG_ICON = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M9 18l-1 3l3 -2h6a2 2 0 0 0 2 -2v-9a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h3" /></svg>;
const SEARCH_ICON = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 11m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0" /><path d="M16 19h6" /><path d="M19 16v6" /><path d="M21 21l-2 -2" /></svg>;

const POSTS = [
  { c: 'var(--ax-viz-pink)', icon: IG_ICON, title: 'Sunset launch carousel', platform: 'Instagram', platColor: 'var(--ax-accent)', reach: '412K', eng: '48.2K', rate: '11.7%', rateColor: 'var(--ax-viz-emerald)' },
  { c: 'var(--ax-viz-cyan)', icon: PLAY_ICON, title: 'Studio process timelapse', platform: 'TikTok', platColor: 'var(--ax-viz-cyan)', reach: '368K', eng: '39.6K', rate: '10.8%', rateColor: 'var(--ax-viz-emerald)' },
  { c: 'var(--ax-viz-violet)', icon: MSG_ICON, title: 'Why we rebuilt our app', platform: 'X', platColor: 'var(--ax-viz-violet)', reach: '214K', eng: '19.1K', rate: '8.9%', rateColor: 'var(--ax-text)' },
  { c: 'var(--ax-viz-amber)', icon: SEARCH_ICON, title: 'Hiring: 4 open roles', platform: 'LinkedIn', platColor: 'var(--ax-viz-amber)', reach: '98K', eng: '7.4K', rate: '7.6%', rateColor: 'var(--ax-text)' },
  { c: 'var(--ax-viz-emerald)', icon: IG2_ICON, title: 'Customer reviews roundup', platform: 'Instagram', platColor: 'var(--ax-accent)', reach: '76K', eng: '5.1K', rate: '6.7%', rateColor: 'var(--ax-text)' },
];

export function Social() {
  return (
    <>
      <PageHead
        title="Social Media"
        subtitle="Audience growth and engagement across 5 connected channels."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
              <span className="ax-btn__label">Last 30 days</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Create Post</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {KPIS.map((k) => (
          <div key={k.label} className="ax-card ax-kpi ax-col--3" role="region" aria-label={k.region}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${k.c}`}>{k.icon}</span>
                <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}{k.delta}</span>
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num">{k.value}</div>
                <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color={k.color} series={[{ name: 'Trend', data: k.spark }]} style={{ minHeight: 40 }} />
              </div>
            </div>
          </div>
        ))}

        {/* HERO: Audience Growth (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Audience growth">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Reach</span>
              <h2 className="ax-card__title">Audience Growth</h2>
              <p className="ax-card__subtitle">Reach &amp; impressions over the last 12 weeks</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Reach</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Impressions</small></span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="area"
              height={310}
              legend="none"
              accent
              ariaLabel="Area chart of reach and impressions over twelve weeks"
              series={[
                { name: 'Reach', data: [182, 210, 198, 240, 232, 268, 254, 290, 278, 312, 330, 358] },
                { name: 'Impressions', data: [420, 468, 452, 520, 498, 560, 540, 600, 584, 648, 690, 742] },
              ]}
            />
          </div>
        </section>

        {/* By Platform (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Engagement by platform">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">By Platform</h2>
              <p className="ax-card__subtitle">Share of engagement</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {PLATFORMS.map((p) => (
              <div key={p.label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{p.label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{p.pct}</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${p.w}%`, background: p.color }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* Engagement Types donut (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Engagement types">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Engagement Types</h2>
              <p className="ax-card__subtitle">Last 30 days</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut: Likes, Comments, Shares, Saves"
              series={[684, 142, 96, 58]}
              apex={{
                labels: ['Likes', 'Comments', 'Shares', 'Saves'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600, formatter: (v: string) => (Number(v) / 1000).toFixed(0) + 'K' }, total: { show: true, label: 'Total', formatter: () => '980K' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {ENGAGE.map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.c, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Audience Sentiment semi-gauge (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Audience sentiment">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Audience Sentiment</h2>
              <p className="ax-card__subtitle">Mentions analysis</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="radialBar"
              height={230}
              legend="none"
              ariaLabel="Semi-gauge: 72% positive sentiment"
              series={[72]}
              apex={{
                labels: ['Positive'],
                colors: [cv('--ax-viz-emerald')],
                plotOptions: { radialBar: { startAngle: -90, endAngle: 90, hollow: { size: '58%' }, track: { background: cv('--ax-surface-subtle'), startAngle: -90, endAngle: 90 }, dataLabels: { name: { offsetY: -6, color: cv('--ax-text-muted'), fontSize: '13px' }, value: { offsetY: -38, fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: '28px', color: cv('--ax-text-strong') } } } },
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', textAlign: 'center', marginTop: 'var(--ax-space-2)' }}>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Positive</small><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-md)' }}>72%</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Neutral</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>21%</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Negative</small><b className="ax-num" style={{ color: 'var(--ax-danger-500)', fontSize: 'var(--ax-text-md)' }}>7%</b></div>
            </div>
          </div>
        </section>

        {/* Scheduled Posts (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Scheduled posts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Scheduled Posts</h2>
              <p className="ax-card__subtitle">Next up in queue</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Queue</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {SCHEDULED.map((s) => (
              <div key={s.title} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: s.accent ? 'var(--ax-accent)' : 'var(--ax-text-muted)', minWidth: 54, fontWeight: 600 }}>{s.date}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0, borderLeft: '2px solid var(--ax-border)', paddingLeft: 'var(--ax-space-3)' }}>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{s.title}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top Posts (8) */}
        <section className="ax-card ax-col--8" role="region" aria-label="Top performing posts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Top Posts</h2>
              <p className="ax-card__subtitle">Best performers this month</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Post</th>
                  <th className="ax-table__th" scope="col">Platform</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Reach</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Engagement</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Rate</th>
                </tr>
              </thead>
              <tbody>
                {POSTS.map((p) => (
                  <tr key={p.title} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.c} 18%,transparent)`, color: p.c }}>{p.icon}</span><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', maxWidth: 240 }}>{p.title}</div></div></td>
                    <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: p.platColor }}>{p.platform}</span></td>
                    <td className="ax-table__td ax-table__td--num">{p.reach}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{p.eng}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: p.rateColor }}>{p.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Mentions (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Recent mentions">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Recent Mentions</h2></div>
            <a className="ax-btn ax-btn--link" href="#">Inbox</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-timeline">
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 9l-2 2" /><path d="M9 9l.01 0" /><path d="M15 9l.01 0" /><path d="M8 13a4 4 0 1 0 8 0" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>@maria.codes</b> &quot;Obsessed with the new packaging 😍&quot;</p><span className="ax-timeline__time">6m ago · Instagram</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M9 18l-1 3l3 -2h6a2 2 0 0 0 2 -2v-9a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h3" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>@devon_b</b> asked about restock dates</p><span className="ax-timeline__time">22m ago · X</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>@studioline</b> reshared your launch reel</p><span className="ax-timeline__time">48m ago · Instagram</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-danger-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>@jordan.k</b> reported a shipping delay</p><span className="ax-timeline__time">1h ago · Facebook</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>@techweekly</b> tagged you in a roundup</p><span className="ax-timeline__time">3h ago · LinkedIn</span></div>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Social;
