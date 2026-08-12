'use client';
/*
 * Vireo Next.js — Recruitment / Jobs dashboard (route "dashboards/jobs").
 *
 * Faithful re-expression of src/html/dashboards/jobs.html: 4 KPI cards, a Hiring
 * Funnel horizontal bar, a Source of Hire donut, an Applications Trend area, an
 * Openings by Department bar, a Quarterly Hiring Target radial gauge, a Recent
 * Applicants table, an Interviews Today agenda and a full-width Open
 * Requisitions table. Charts via <ApexChart>; DOM/classes/copy/ARIA match 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const TOK_FALLBACK: Record<string, string> = {
  '--ax-accent': '#2DD4BF',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
  '--ax-viz-emerald': '#34D399',
  '--ax-on-accent': '#04201D',
  '--ax-surface-subtle': '#1E293B',
  '--ax-text-muted': '#94A3B8',
  '--ax-text-strong': '#F1F5F9',
};
function tok(name: string): string {
  if (typeof document === 'undefined') return TOK_FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || TOK_FALLBACK[name] || '#38BDF8';
}
function tokenColors(tokens: string[]): string[] {
  return tokens.map(tok);
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);

export function Jobs() {
  return (
    <>
      <PageHead
        title="Recruitment"
        subtitle="Hiring pipeline health across 12 active requisitions — June 2026."
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
              <span className="ax-btn__label">Post Job</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Open Positions 58, up 4.0%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9" /><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" /><path d="M12 12l0 .01" /><path d="M3 13a20 20 0 0 0 18 0" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}4.0%</span>
            </div>
            <div className="ax-kpi__label">Open Positions</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">58</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [8, 10, 9, 15, 16, 20, 23, 26] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Applications this month 2,940, up 11.0%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}11.0%</span>
            </div>
            <div className="ax-kpi__label">Applications (30D)</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">2,940</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-cyan" series={[{ name: 'Trend', data: [6, 10, 9, 16, 18, 22, 27, 30] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Time to hire 24 days, down 8.0% which is good">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12l3 2" /><path d="M12 7v5" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_DN}8.0%</span>
            </div>
            <div className="ax-kpi__label">Time to Hire</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">24 <small style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', fontWeight: 500 }}>days</small></div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-violet" series={[{ name: 'Trend', data: [26, 23, 24, 20, 18, 15, 12, 8] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Offer acceptance 78%, up 2.5%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /><path d="M15 19l2 2l4 -4" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}2.5%</span>
            </div>
            <div className="ax-kpi__label">Offer Acceptance</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">78%</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-amber" series={[{ name: 'Trend', data: [12, 14, 13, 17, 18, 21, 23, 25] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* HERO: Hiring Funnel */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Hiring funnel">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pipeline</span>
              <h2 className="ax-card__title">Hiring Funnel</h2>
              <p className="ax-card__subtitle">Candidate stages across all open requisitions</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">7D</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">30D</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">QTD</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={330}
              legend="none"
              accent
              ariaLabel="Funnel: Applied 2940, Screened 1180, Interview 460, Offer 96, Hired 72"
              series={[{ name: 'Candidates', data: [2940, 1180, 460, 96, 72] }]}
              apex={{
                plotOptions: { bar: { horizontal: true, borderRadius: 6, barHeight: '62%', distributed: true } },
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-amber', '--ax-viz-emerald']),
                xaxis: { categories: ['Applied', 'Screened', 'Interview', 'Offer', 'Hired'] },
                dataLabels: { enabled: true, textAnchor: 'start', offsetX: 4, style: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, formatter: (v: number) => v.toLocaleString() },
                tooltip: { y: { formatter: (v: number) => v.toLocaleString() + ' candidates' } },
              }}
            />
          </div>
        </section>

        {/* Source of Hire donut */}
        <section className="ax-card ax-col--4" role="region" aria-label="Source of hire">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Source of Hire</h2>
              <p className="ax-card__subtitle">Where candidates come from</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Source options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut: Job boards 42%, Referrals 28%, Agency 18%, Direct 12%"
              series={[42, 28, 18, 12]}
              apex={{
                labels: ['Job boards', 'Referrals', 'Agency', 'Direct'],
                colors: tokenColors(['--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Hires', formatter: () => '72' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'Job boards', color: 'var(--ax-viz-cyan)', pct: '42%' },
                { label: 'Referrals', color: 'var(--ax-viz-violet)', pct: '28%' },
                { label: 'Agency', color: 'var(--ax-viz-pink)', pct: '18%' },
                { label: 'Direct apply', color: 'var(--ax-viz-amber)', pct: '12%' },
              ].map((s) => (
                <li key={s.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{s.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{s.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Applications Trend */}
        <section className="ax-card ax-col--4" role="region" aria-label="Applications trend">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Applications Trend</h2>
              <p className="ax-card__subtitle">New applications per week</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'baseline', marginBottom: 'var(--ax-space-2)' }}>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>2,940</div>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}11.0%</span>
            </div>
            <ApexChart
              type="area"
              height={150}
              legend="none"
              accent
              ariaLabel="Area chart of weekly applications trending up"
              series={[{ name: 'Applications', data: [480, 520, 610, 580, 690, 720, 810, 940] }]}
            />
          </div>
        </section>

        {/* Openings by Department */}
        <section className="ax-card ax-col--4" role="region" aria-label="Openings by department">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Openings by Department</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={230}
              legend="none"
              accent
              ariaLabel="Horizontal bar: Engineering 18, Sales 12, Design 9, Marketing 8, Support 6, Ops 5"
              series={[{ name: 'Openings', data: [18, 12, 9, 8, 6, 5] }]}
              apex={{
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '56%' } },
                xaxis: { categories: ['Engineering', 'Sales', 'Design', 'Marketing', 'Support', 'Ops'] },
                dataLabels: { enabled: true, offsetX: 14, style: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600, colors: [tok('--ax-on-accent')] } },
              }}
            />
          </div>
        </section>

        {/* Quarterly Hiring Target */}
        <section className="ax-card ax-col--4" role="region" aria-label="Hiring target">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Quarterly Hiring Target</h2>
              <p className="ax-card__subtitle">72 of 90 hires · Q2 FY26</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="radialBar"
              height={230}
              accent
              ariaLabel="Radial gauge: 80% of hiring target reached"
              series={[80]}
              apex={{
                labels: ['Target'],
                plotOptions: {
                  radialBar: {
                    hollow: { size: '62%' },
                    track: { background: tok('--ax-surface-subtle') },
                    dataLabels: {
                      name: { offsetY: 22, color: tok('--ax-text-muted'), fontSize: '13px' },
                      value: { offsetY: -14, fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: '28px', color: tok('--ax-text-strong') },
                    },
                  },
                },
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)', textAlign: 'center', marginTop: 'var(--ax-space-2)' }}>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Hired</small><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-md)' }}>72</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Remaining</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>18</b></div>
            </div>
          </div>
        </section>

        {/* Recent Applicants table */}
        <section className="ax-card ax-col--8" role="region" aria-label="Recent applicants">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Applicants</h2>
              <p className="ax-card__subtitle">Latest candidates across all roles</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Candidate</th>
                  <th className="ax-table__th" scope="col">Role</th>
                  <th className="ax-table__th" scope="col">Stage</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Match</th>
                  <th className="ax-table__th" scope="col">Applied</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { initials: 'EM', color: 'var(--ax-viz-cyan)', name: 'Elena Mwangi', email: 'elena.m@mail.com', role: 'Senior Frontend Engineer', stage: 'Interview', tone: 'info', match: '94%', matchColor: 'var(--ax-viz-emerald)', applied: 'Jun 24' },
                  { initials: 'RC', color: 'var(--ax-viz-violet)', name: 'Rohan Chatterjee', email: 'rohan.c@mail.com', role: 'Product Designer', stage: 'Offer', tone: 'success', match: '91%', matchColor: 'var(--ax-viz-emerald)', applied: 'Jun 23' },
                  { initials: 'SD', color: 'var(--ax-viz-pink)', name: 'Sofia Delgado', email: 'sofia.d@mail.com', role: 'Account Executive', stage: 'Screened', tone: 'muted', match: '82%', matchColor: 'var(--ax-text)', applied: 'Jun 23' },
                  { initials: 'TN', color: 'var(--ax-viz-amber)', name: 'Theo Nakamura', email: 'theo.n@mail.com', role: 'DevOps Engineer', stage: 'Interview', tone: 'info', match: '79%', matchColor: 'var(--ax-text)', applied: 'Jun 22' },
                  { initials: 'AB', color: 'var(--ax-viz-emerald)', name: 'Amara Boateng', email: 'amara.b@mail.com', role: 'Marketing Manager', stage: 'Screened', tone: 'muted', match: '76%', matchColor: 'var(--ax-text)', applied: 'Jun 21' },
                  { initials: 'LH', color: 'var(--ax-viz-cyan)', name: 'Liam Hartley', email: 'liam.h@mail.com', role: 'Data Analyst', stage: 'Rejected', tone: 'danger', match: '61%', matchColor: 'var(--ax-text-muted)', applied: 'Jun 20' },
                ].map((c) => (
                  <tr key={c.email} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.color} 18%,transparent)`, color: c.color, fontWeight: 600 }}>{c.initials}</span><div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{c.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.email}</div></div></div></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{c.role}</td>
                    <td className="ax-table__td">
                      {c.tone === 'muted'
                        ? <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-text-muted)' }}>{c.stage}</span>
                        : <span className={`ax-badge ax-badge--soft ax-badge--${c.tone} ax-badge--pill`}>{c.stage}</span>}
                    </td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: c.matchColor }}>{c.match}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{c.applied}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Interviews Today */}
        <section className="ax-card ax-col--4" role="region" aria-label="Interviews today">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Interviews Today</h2>
              <p className="ax-card__subtitle">Thu, Jun 27</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Calendar</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {[
              { time: '09:30', timeColor: 'var(--ax-accent)', name: 'Elena Mwangi', meta: 'Sr. Frontend · with Priya N. · Room 4' },
              { time: '11:00', timeColor: 'var(--ax-accent)', name: 'Theo Nakamura', meta: 'DevOps · with Marcus W. · Zoom' },
              { time: '14:15', timeColor: 'var(--ax-accent)', name: 'Sofia Delgado', meta: 'Account Exec · with Dana R. · Room 2' },
              { time: '16:00', timeColor: 'var(--ax-text-muted)', name: 'Amara Boateng', meta: 'Marketing Mgr · with Leo F. · Room 1' },
            ].map((iv) => (
              <div key={iv.time} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: iv.timeColor, minWidth: 48, fontWeight: 600 }}>{iv.time}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0, borderLeft: '2px solid var(--ax-border)', paddingLeft: 'var(--ax-space-3)' }}>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{iv.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{iv.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open Requisitions table */}
        <section className="ax-card ax-col--12" role="region" aria-label="Open jobs">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Open Requisitions</h2>
              <p className="ax-card__subtitle">Active job postings and applicant volume</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Manage jobs</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Title</th>
                  <th className="ax-table__th" scope="col">Department</th>
                  <th className="ax-table__th" scope="col">Location</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Applicants</th>
                  <th className="ax-table__th" scope="col">Posted</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { title: 'Senior Frontend Engineer', dept: 'Engineering', loc: 'Remote · EU', apps: '214', posted: 'Jun 8', status: 'Active', tone: 'success' },
                  { title: 'Product Designer', dept: 'Design', loc: 'London, UK', apps: '168', posted: 'Jun 11', status: 'Active', tone: 'success' },
                  { title: 'Account Executive', dept: 'Sales', loc: 'New York, US', apps: '142', posted: 'Jun 14', status: 'Screening', tone: 'warning' },
                  { title: 'DevOps Engineer', dept: 'Engineering', loc: 'Remote · Global', apps: '97', posted: 'Jun 16', status: 'Active', tone: 'success' },
                  { title: 'Customer Success Lead', dept: 'Support', loc: 'Berlin, DE', apps: '61', posted: 'Jun 19', status: 'Draft', tone: 'muted' },
                ].map((j) => (
                  <tr key={j.title} className="ax-table__row">
                    <td className="ax-table__td" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{j.title}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{j.dept}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{j.loc}</td>
                    <td className="ax-table__td ax-table__td--num">{j.apps}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{j.posted}</td>
                    <td className="ax-table__td">
                      {j.tone === 'muted'
                        ? <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-text-muted)' }}><span className="ax-badge__dot" />{j.status}</span>
                        : <span className={`ax-badge ax-badge--soft ax-badge--${j.tone} ax-badge--pill`}><span className="ax-badge__dot" />{j.status}</span>}
                    </td>
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

export default Jobs;
