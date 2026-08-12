'use client';
/*
 * Vireo Next.js — Projects dashboard (route "dashboards/projects").
 *
 * Faithful re-expression of src/html/dashboards/projects.html: 4 KPI cards, a
 * Task Throughput column chart, a Project Status donut, a hand-built Gantt-style
 * Project Schedule, a Team Workload horizontal bar, Project Health goals, a
 * Budget & Time panel, a Milestones timeline and a full-width Recent Projects
 * table. Charts via <ApexChart>; DOM/classes/copy/ARIA match the reference 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const VIZ_FALLBACK: Record<string, string> = {
  '--ax-accent': '#2DD4BF',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
  '--ax-viz-emerald': '#34D399',
  '--ax-viz-red': '#FB7185',
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

function GanttRow({ name, dept, left, width, doneWidth, base, baseTint, pct, pctColor }: { name: string; dept: string; left: string; width: string; doneWidth: string; base: string; baseTint: string; pct: string; pctColor?: string }) {
  return (
    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
      <div style={{ width: 136, flex: '0 0 136px' }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{dept}</div></div>
      <div style={{ flex: '1 1 auto', height: 18, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-surface-subtle)', position: 'relative' }}>
        <span style={{ position: 'absolute', left, width, top: 0, bottom: 0, borderRadius: 'var(--ax-radius-pill)', background: base }} aria-hidden="true" />
        <span style={{ position: 'absolute', left, width: doneWidth, top: 0, bottom: 0, borderRadius: 'var(--ax-radius-pill)', background: baseTint }} aria-hidden="true" />
      </div>
      <span className="ax-num" style={{ width: 42, textAlign: 'right', color: pctColor || 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{pct}</span>
    </div>
  );
}

export function Projects() {
  return (
    <>
      <PageHead
        title="Projects"
        subtitle="Delivery health, throughput & team workload — last 30 days."
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
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New project</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Active Projects 42, up 5.0%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}5.0%</span>
            </div>
            <div className="ax-kpi__label">Active Projects</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">42</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [8, 10, 9, 15, 17, 20, 24, 28] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Tasks Completed 1,860, up 9.4%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}9.4%</span>
            </div>
            <div className="ax-kpi__label">Tasks Completed (30D)</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">1,860</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-cyan" series={[{ name: 'Trend', data: [7, 10, 9, 16, 18, 22, 26, 30] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Overdue Tasks 73, down 12.0 percent which is an improvement">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_DN}12.0%</span>
            </div>
            <div className="ax-kpi__label">Overdue Tasks</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">73</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-emerald" series={[{ name: 'Trend', data: [26, 23, 24, 20, 18, 15, 12, 8] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Team Utilization 81 percent, up 2.2%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}2.2%</span>
            </div>
            <div className="ax-kpi__label">Team Utilization</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">81%</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-amber" series={[{ name: 'Trend', data: [12, 14, 12, 17, 16, 20, 19, 23] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* HERO: Task Throughput */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Task throughput">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Velocity</span>
              <h2 className="ax-card__title">Task Throughput</h2>
              <p className="ax-card__subtitle">Tasks created vs. completed per week</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">6W</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">12W</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">QTD</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Created</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Completed</small></span>
            </div>
            <ApexChart
              type="bar"
              height={320}
              legend="none"
              ariaLabel="Column chart of tasks created versus completed by week"
              series={[
                { name: 'Created', data: [180, 164, 192, 158, 176, 148, 168, 140, 156, 132, 144, 128] },
                { name: 'Completed', data: [142, 150, 166, 170, 158, 172, 180, 176, 188, 182, 196, 204] },
              ]}
              apex={{
                colors: tokenColors(['--ax-viz-cyan', '--ax-accent']),
                plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
                xaxis: { categories: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'] },
              }}
            />
          </div>
        </section>

        {/* Project Status donut */}
        <section className="ax-card ax-col--4" role="region" aria-label="Project status">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Project Status</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={230}
              legend="none"
              ariaLabel="Donut chart of project status: on-track 24, at-risk 9, delayed 5, done 4"
              series={[24, 9, 5, 4]}
              apex={{
                labels: ['On track', 'At risk', 'Delayed', 'Done'],
                colors: tokenColors(['--ax-viz-emerald', '--ax-viz-amber', '--ax-viz-red', '--ax-viz-cyan']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Projects', formatter: () => '42' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'On track', color: 'var(--ax-viz-emerald)', val: '24' },
                { label: 'At risk', color: 'var(--ax-viz-amber)', val: '9' },
                { label: 'Delayed', color: 'var(--ax-viz-red)', val: '5' },
                { label: 'Done', color: 'var(--ax-viz-cyan)', val: '4' },
              ].map((s) => (
                <li key={s.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: s.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{s.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{s.val}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Project Schedule (gantt) */}
        <section className="ax-card ax-col--8" role="region" aria-label="Project schedule">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Project Schedule</h2><p className="ax-card__subtitle">Active timelines · Q2–Q3</p></div>
            <a className="ax-btn ax-btn--link" href="#">Open timeline</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between', paddingLeft: 148, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', fontFamily: 'var(--ax-font-mono)' }}>
              <span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span>
            </div>
            <GanttRow name="Aurora Redesign" dept="Design" left="4%" width="46%" doneWidth="34%" base="var(--ax-accent)" baseTint="color-mix(in oklab,var(--ax-on-accent) 35%,var(--ax-accent))" pct="74%" />
            <GanttRow name="Mobile App v3" dept="Engineering" left="20%" width="62%" doneWidth="30%" base="var(--ax-viz-cyan)" baseTint="color-mix(in oklab,#fff 30%,var(--ax-viz-cyan))" pct="48%" />
            <GanttRow name="Billing Migration" dept="Platform" left="36%" width="50%" doneWidth="14%" base="var(--ax-viz-violet)" baseTint="color-mix(in oklab,#fff 30%,var(--ax-viz-violet))" pct="28%" />
            <GanttRow name="Data Warehouse" dept="Analytics" left="52%" width="44%" doneWidth="8%" base="var(--ax-viz-pink)" baseTint="color-mix(in oklab,#fff 30%,var(--ax-viz-pink))" pct="12%" />
            <GanttRow name="Brand Refresh" dept="Marketing" left="2%" width="30%" doneWidth="30%" base="var(--ax-viz-amber)" baseTint="color-mix(in oklab,#fff 30%,var(--ax-viz-amber))" pct="100%" pctColor="var(--ax-viz-emerald)" />
          </div>
        </section>

        {/* Team Workload */}
        <section className="ax-card ax-col--4" role="region" aria-label="Workload by member">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Team Workload</h2><p className="ax-card__subtitle">Assigned tasks per member</p></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={280}
              legend="none"
              ariaLabel="Horizontal bar chart of assigned tasks per team member"
              series={[{ name: 'Tasks', data: [34, 28, 26, 21, 17, 12] }]}
              apex={{
                plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '56%', distributed: true } },
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber', '--ax-viz-emerald']),
                xaxis: { categories: ['Lena B.', 'Devon O.', 'Tomás H.', 'Priya N.', 'Ava S.', 'Marc R.'] },
                tooltip: { y: { title: { formatter: () => 'Assigned' } } },
              }}
            />
          </div>
        </section>

        {/* Project Health */}
        <section className="ax-card ax-col--4" role="region" aria-label="Project health">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Project Health</h2><p className="ax-card__subtitle">Percent complete</p></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Aurora Redesign</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>74%</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '74%', background: 'var(--ax-accent)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Mobile App v3</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>48%</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '48%', background: 'var(--ax-viz-cyan)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Billing Migration</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>28%</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '28%', background: 'var(--ax-viz-violet)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Data Warehouse</span><b className="ax-num" style={{ color: 'var(--ax-viz-amber)', fontSize: 'var(--ax-text-sm)' }}>12% · at risk</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '12%', background: 'var(--ax-viz-amber)' }} /></div></div>
            </div>
          </div>
        </section>

        {/* Budget & Time */}
        <section className="ax-card ax-col--4" role="region" aria-label="Budget and time">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Budget &amp; Time</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Budget vs. actual</span>
                <span className="ax-num" style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>$418K / $460K</span>
              </div>
              <div style={{ display: 'flex', height: 12, borderRadius: 'var(--ax-radius-pill)', overflow: 'hidden' }}>
                <span style={{ width: '91%', background: 'var(--ax-accent)' }} aria-hidden="true" />
                <span style={{ width: '9%', background: 'var(--ax-surface-subtle)' }} aria-hidden="true" />
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span>91% spent</span><span>$42K remaining</span></div>
            </div>
            <div className="ax-divider" />
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Time tracked (30D)</span>
                <span className="ax-num" style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>3,420 h</span>
              </div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={44} color="--ax-viz-cyan" series={[{ name: 'Time tracked', data: [12, 18, 16, 24, 22, 30, 26, 34, 30, 36, 32, 40, 36] }]} style={{ minHeight: 44 }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 6, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span>Billable 81%</span><span>+184h vs. last month</span></div>
            </div>
          </div>
        </section>

        {/* Milestones */}
        <section className="ax-card ax-col--4" role="region" aria-label="Upcoming milestones">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Milestones</h2></div>
            <a className="ax-btn ax-btn--link" href="#">All</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-timeline">
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Design freeze</b> — Aurora Redesign</p><span className="ax-timeline__time">Jun 30 · 3 days</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M9 12l2 2l4 -4" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Beta release</b> — Mobile App v3</p><span className="ax-timeline__time">Jul 12 · 15 days</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Cutover</b> — Billing Migration</p><span className="ax-timeline__time">Jul 28 · at risk</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-7l-4 4v-4h-3a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Stakeholder review</b> — Data Warehouse</p><span className="ax-timeline__time">Aug 05 · 39 days</span></div>
              </li>
            </ul>
          </div>
        </section>

        {/* Recent Projects table */}
        <section className="ax-card ax-col--12" role="region" aria-label="Recent projects">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Recent Projects</h2><p className="ax-card__subtitle">Status, progress &amp; deadlines</p></div>
            <a className="ax-btn ax-btn--link" href="#">All projects</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Project</th>
                  <th className="ax-table__th" scope="col">Lead</th>
                  <th className="ax-table__th" scope="col">Progress</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Tasks</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Deadline</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { proj: 'Aurora Redesign', sub: 'Design system overhaul', initials: 'LB', lead: 'Lena Brandt', color: 'var(--ax-accent)', pct: '74%', tasks: '38 / 52', deadline: 'Jul 18', status: 'On track', tone: 'success' },
                  { proj: 'Mobile App v3', sub: 'React Native rebuild', initials: 'DO', lead: 'Devon Okafor', color: 'var(--ax-viz-cyan)', pct: '48%', tasks: '61 / 128', deadline: 'Aug 12', status: 'On track', tone: 'success' },
                  { proj: 'Billing Migration', sub: 'Stripe → in-house', initials: 'TH', lead: 'Tomás Herrera', color: 'var(--ax-viz-violet)', pct: '28%', tasks: '22 / 96', deadline: 'Jul 28', status: 'At risk', tone: 'warning' },
                  { proj: 'Data Warehouse', sub: 'Snowflake pipeline', initials: 'PN', lead: 'Priya Nair', color: 'var(--ax-viz-pink)', pct: '12%', tasks: '9 / 74', deadline: 'Sep 02', status: 'Delayed', tone: 'danger' },
                  { proj: 'Brand Refresh', sub: 'Logo & guidelines', initials: 'AS', lead: 'Ava Sutton', color: 'var(--ax-viz-amber)', pct: '100%', tasks: '44 / 44', deadline: 'Jun 10', status: 'Done', tone: 'info', fill: 'var(--ax-viz-emerald)' },
                ].map((p) => (
                  <tr key={p.proj} className="ax-table__row">
                    <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{p.proj}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.sub}</div></td>
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${p.color} 22%,transparent)`, color: p.color, fontWeight: 600 }}>{p.initials}</span><span style={{ color: 'var(--ax-text-muted)' }}>{p.lead}</span></div></td>
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><div className="ax-progress ax-progress--sm" style={{ minWidth: 96 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: p.pct, background: p.fill || p.color }} /></div></div><span className="ax-num" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{p.pct}</span></div></td>
                    <td className="ax-table__td ax-table__td--num">{p.tasks}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{p.deadline}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${p.tone} ax-badge--pill`}><span className="ax-badge__dot" />{p.status}</span></td>
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

export default Projects;
