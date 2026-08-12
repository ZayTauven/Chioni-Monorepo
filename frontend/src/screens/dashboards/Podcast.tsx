'use client';
/*
 * Vireo Next.js — Podcast Studio dashboard (dashboards/podcast).
 *
 * Faithful re-expression of src/html/dashboards/podcast.html: KPI row, a mixed
 * plays/subscribers chart, an interactive Now-Playing media player (Alpine →
 * React island, play/pause toggle), a listens-by-platform donut, a listener-
 * retention line, a top-episodes table, upcoming releases and a reviews grid.
 * Charts via <ApexChart>; shared ax-col--N grid utilities.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const FALLBACK: Record<string, string> = {
  '--ax-accent': '#2BB6A3', '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6', '--ax-viz-amber': '#FBBF24',
};
function cv(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || '#38BDF8';
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);

const KPIS = [
  { region: 'Total Plays 1.82M, up 9.5%', c: 'c1', delta: '9.5%', label: 'Total Plays', value: '1.82M', color: '--ax-accent', spark: [6, 10, 9, 16, 18, 22, 26, 30],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8l-13 -8" /></svg> },
  { region: 'Subscribers 64,200, up 4.2%', c: 'c2', delta: '4.2%', label: 'Subscribers', value: '64,200', color: '--ax-viz-cyan', spark: [8, 10, 9, 14, 15, 19, 22, 25],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3" /><path d="M15 15a2 2 0 0 1 2 -2h1a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2l0 -3" /><path d="M4 15v-3a8 8 0 0 1 16 0v3" /></svg> },
  { region: 'Average Listen-Through 71%, up 1.8%', c: 'c3', delta: '1.8%', label: 'Avg Listen-Through', value: '71%', color: '--ax-viz-violet', spark: [12, 13, 14, 16, 17, 18, 20, 22],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg> },
  { region: 'Revenue this month $12,400, up 7.0%', c: 'c4', delta: '7.0%', label: 'Revenue (30D)', value: '$12,400', color: '--ax-viz-amber', spark: [9, 11, 10, 15, 16, 20, 22, 26],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg> },
];

const PLATFORM = [
  { c: 'var(--ax-viz-cyan)', label: 'Spotify', n: '46%' },
  { c: 'var(--ax-viz-violet)', label: 'Apple Podcasts', n: '31%' },
  { c: 'var(--ax-viz-pink)', label: 'YouTube', n: '15%' },
  { c: 'var(--ax-viz-amber)', label: 'Web player', n: '8%' },
];

const EPISODES = [
  { rank: '1', c: 'var(--ax-viz-amber)', op: 20, weight: 700, title: 'Why Founders Burn Out', sub: 'EP 142 · with Dr. Reyes', plays: '312K', comp: '79%', compColor: 'var(--ax-viz-emerald)', dur: '48:22', date: 'May 14' },
  { rank: '2', c: 'var(--ax-text-subtle)', op: 22, weight: 700, title: 'The AI Hype Cycle, Honestly', sub: 'EP 139 · solo', plays: '284K', comp: '76%', compColor: 'var(--ax-viz-emerald)', dur: '41:09', date: 'Apr 30' },
  { rank: '3', c: 'var(--ax-viz-pink)', op: 20, weight: 700, title: 'Designing for Trust', sub: 'EP 135 · with L. Brandt', plays: '241K', comp: '72%', compColor: 'var(--ax-text)', dur: '52:47', date: 'Apr 2' },
  { rank: '4', c: 'var(--ax-viz-cyan)', op: 18, weight: 600, title: 'Remote Teams That Last', sub: 'EP 131 · with M. Whitfield', plays: '198K', comp: '68%', compColor: 'var(--ax-text)', dur: '39:55', date: 'Mar 5' },
  { rank: '5', c: 'var(--ax-viz-violet)', op: 18, weight: 600, title: 'Pricing Without Fear', sub: 'EP 128 · solo', plays: '176K', comp: '70%', compColor: 'var(--ax-text)', dur: '34:18', date: 'Feb 12' },
];

const UPCOMING = [
  { date: 'Jun 30', accent: true, title: 'EP 149 — Hiring Slow', sub: 'Editing · with R. Okafor' },
  { date: 'Jul 7', accent: false, title: 'EP 150 — Milestone Q&A', sub: 'Recording · live audience' },
  { date: 'Jul 14', accent: false, title: 'EP 151 — Open Source $', sub: 'Scheduled · with K. Devi' },
  { date: 'Jul 21', accent: false, title: 'EP 152 — Listener Mailbag', sub: 'Outlining · solo' },
];

const REVIEWS = [
  { initials: 'JD', c: 'var(--ax-viz-cyan)', name: 'jordan_d', stars: '★★★★★', text: '"Best episode on burnout I\'ve heard. The pacing is perfect and the guest was incredible."', meta: 'Apple Podcasts · 2d ago' },
  { initials: 'SP', c: 'var(--ax-viz-violet)', name: 's.peralta', stars: '★★★★☆', text: '"Great show overall — would love slightly shorter episodes for the commute, but content is gold."', meta: 'Spotify · 4d ago' },
  { initials: 'MN', c: 'var(--ax-viz-pink)', name: 'm.nakajima', stars: '★★★★★', text: '"The pricing episode changed how I run my freelance business. Practical and honest. Subscribed!"', meta: 'YouTube · 5d ago' },
];

export function Podcast() {
  return (
    <>
      <PageHead
        title="Podcast Studio"
        subtitle="Listens, subscribers and episode performance — The Signal show."
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
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Upload Episode</span>
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

        {/* HERO: Plays & Subscribers (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Plays and subscribers">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Performance</span>
              <h2 className="ax-card__title">Plays &amp; Subscribers</h2>
              <p className="ax-card__subtitle">Weekly plays vs. net new subscribers</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Plays</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Net subs</small></span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="line"
              height={310}
              legend="none"
              accent
              ariaLabel="Mixed chart: weekly plays area with net new subscriber columns"
              series={[
                { name: 'Plays', type: 'line', data: [128, 142, 136, 158, 150, 172, 166, 188, 180, 204, 196, 224] },
                { name: 'Net subs', type: 'column', data: [38, 44, 40, 52, 48, 58, 54, 64, 60, 72, 68, 82] },
              ]}
              apex={{
                colors: [cv('--ax-accent'), cv('--ax-viz-cyan')],
                stroke: { width: [3, 0], curve: 'smooth' },
                fill: { type: ['solid', 'solid'], opacity: [1, 0.85] },
                plotOptions: { bar: { columnWidth: '38%', borderRadius: 3 } },
                xaxis: { categories: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'] },
                yaxis: { labels: { formatter: (v: number) => v + 'K' } },
              }}
            />
          </div>
        </section>

        {/* Now Playing (4) */}
        <NowPlaying />

        {/* By Platform donut (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Listens by platform">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">By Platform</h2>
              <p className="ax-card__subtitle">Share of listens</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut: Spotify, Apple Podcasts, YouTube, Web"
              series={[46, 31, 15, 8]}
              apex={{
                labels: ['Spotify', 'Apple Podcasts', 'YouTube', 'Web'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Plays', formatter: () => '1.82M' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {PLATFORM.map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.c, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Listener Retention (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Listener retention">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Listener Retention</h2>
              <p className="ax-card__subtitle">Drop-off across episode 148 duration</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All episodes</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="line"
              height={290}
              legend="none"
              accent
              ariaLabel="Line chart of listener retention decreasing across episode duration"
              series={[{ name: 'Listeners', data: [100, 98, 95, 91, 88, 86, 83, 80, 78, 75, 72, 69, 66, 62, 58, 54, 49, 44] }]}
            />
          </div>
        </section>

        {/* Top Episodes (8) */}
        <section className="ax-card ax-col--8" role="region" aria-label="Top episodes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Top Episodes</h2>
              <p className="ax-card__subtitle">Most played in the last 90 days</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Episode</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Plays</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Completion</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Duration</th>
                  <th className="ax-table__th" scope="col">Released</th>
                </tr>
              </thead>
              <tbody>
                {EPISODES.map((e) => (
                  <tr key={e.title} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${e.c} ${e.op}%,transparent)`, color: e.rank === '2' ? 'var(--ax-text-muted)' : e.c, fontWeight: e.weight }}>{e.rank}</span><div><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', maxWidth: 260 }}>{e.title}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{e.sub}</div></div></div></td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{e.plays}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: e.compColor }}>{e.comp}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{e.dur}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{e.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Upcoming Releases (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Upcoming releases">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Upcoming Releases</h2>
              <p className="ax-card__subtitle">Production schedule</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Calendar</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {UPCOMING.map((u) => (
              <div key={u.title} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: u.accent ? 'var(--ax-accent)' : 'var(--ax-text-muted)', minWidth: 54, fontWeight: 600 }}>{u.date}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0, borderLeft: '2px solid var(--ax-border)', paddingLeft: 'var(--ax-space-3)' }}>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{u.title}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{u.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Reviews (12) */}
        <section className="ax-card ax-col--12" role="region" aria-label="Recent reviews">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Reviews</h2>
              <p className="ax-card__subtitle">Latest listener ratings across platforms</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All reviews</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-2)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-5)' }}>
            {REVIEWS.map((r) => (
              <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.c} 18%,transparent)`, color: r.c, fontWeight: 600 }}>{r.initials}</span><b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{r.name}</b></div>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'calc(var(--ax-text-md) * 1.25)', letterSpacing: 2, color: 'var(--ax-viz-amber)' }}>{r.stars}</span>
                </div>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: 0 }}>{r.text}</p>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.meta}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/* Now Playing — Alpine play/pause toggle re-expressed as a React island. */
function NowPlaying() {
  const [playing, setPlaying] = useState(false);
  const progress = 38;
  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Now playing">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Latest episode</span>
          <h2 className="ax-card__title">Now Playing</h2>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', aspectRatio: '16/9', background: 'var(--ax-gradient-plate)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--ax-space-4)', boxShadow: 'var(--ax-shadow-md)' }}>
          <span aria-hidden="true" style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.16)', filter: 'blur(4px)' }} />
          <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'relative', opacity: 0.95 }}><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
          <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-3)', left: 'var(--ax-space-3)', background: 'rgba(0,0,0,.32)', color: '#fff', border: 0 }}>EP 148</span>
        </div>
        <div style={{ marginBottom: 'var(--ax-space-3)' }}>
          <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>The Cost of Speed</div>
          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Maya Okonkwo &amp; guest Theo Park</div>
        </div>
        <div className="ax-progress ax-progress--sm" style={{ marginBottom: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${progress}%` }} /></div></div>
        <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-4)' }}>
          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>16:42</span>
          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>44:08</span>
        </div>
        <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-4)' }}>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Previous episode">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 5v14l-12 -7l12 -7" /><path d="M4 5l0 14" /></svg>
          </button>
          <button type="button" className="ax-btn ax-btn--primary ax-btn--icon" style={{ width: 52, height: 52, borderRadius: 'var(--ax-radius-pill)' }} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {!playing
              ? <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8l-13 -8" /></svg>
              : <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" /><path d="M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" /></svg>}
          </button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Next episode">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5v14l12 -7l-12 -7" /><path d="M20 5l0 14" /></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

export default Podcast;
