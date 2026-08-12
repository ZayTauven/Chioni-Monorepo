'use client';
/*
 * Vireo Next.js — HR & Payroll dashboard (dashboards/hr).
 *
 * Faithful re-expression of src/html/dashboards/hr.html: 4 KPI cards with
 * sparklines, a Headcount mixed (joiners/leavers columns + net line) chart, a
 * Department donut, a stacked Attendance chart, payroll plate, leave requests,
 * new hires table, diversity, celebrations and employee-of-month. Charts go
 * through <ApexChart>; DOM classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

/* SSR-safe --ax-* → hex (canonical Aurora fallbacks server-side; the chart's
   live ax:change re-theme repaints the real tokens after hydration). */
const FALLBACK: Record<string, string> = {
  '--ax-accent': '#2BB6A3', '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6', '--ax-viz-amber': '#FBBF24', '--ax-viz-emerald': '#34D399',
  '--ax-viz-red': '#FB7185',
};
function cv(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || '#38BDF8';
}

const ICON_CAL = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
);
const ICON_CHEV = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);
const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);
const ICON_USER_SM = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
);

const GRID_STYLE = `
  .ax-dash-grid > * { grid-column: 1 / -1; }
  @media (min-width: 768px) {
    .ax-dash-grid > .ax-kpi { grid-column: span 6; }
    .ax-dash-grid > .ax-col-third { grid-column: span 6; }
  }
  @media (min-width: 1200px) {
    .ax-dash-grid > .ax-kpi { grid-column: span 3; }
    .ax-dash-grid > .ax-col-hero { grid-column: span 8; }
    .ax-dash-grid > .ax-col-side { grid-column: span 4; }
    .ax-dash-grid > .ax-col-third { grid-column: span 4; }
    .ax-dash-grid > .ax-col-wide { grid-column: span 8; }
    .ax-dash-grid > .ax-col-narrow { grid-column: span 4; }
  }`;

const KPIS = [
  { region: 'Total Employees 1,284, up 2.4%', c: 'c1', up: true, delta: '2.4%', label: 'Total Employees', value: '1,284', color: '--ax-accent', spark: [8, 10, 12, 13, 16, 18, 21, 25],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 10h2a2 2 0 0 1 2 2v1" /><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M3 13v-1a2 2 0 0 1 2 -2h2" /></svg> },
  { region: 'Attendance Rate 96.2%, up 0.6%', c: 'c2', up: true, delta: '0.6%', label: 'Attendance Rate', value: '96.2%', color: '--ax-viz-cyan', spark: [20, 21, 19, 23, 21, 24, 22, 26],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" /><path d="M14 18a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M15 3v4" /><path d="M7 3v4" /><path d="M3 11h16" /><path d="M18 16.5v1.5l1 1" /></svg> },
  { region: 'Open Positions 58, neutral', c: 'c3', neutral: true, label: 'Open Positions', value: '58', color: '--ax-viz-violet', spark: [17, 18, 16, 19, 16, 18, 17, 19],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-12" /><path d="M8 5v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M12 12l0 .01" /><path d="M3 13a20 20 0 0 0 18 0" /></svg> },
  { region: 'Turnover Rate 7.8%, down 1.2% which is favourable', c: 'c4', up: true, downIcon: true, delta: '1.2%', label: 'Turnover Rate', value: '7.8%', color: '--ax-viz-emerald', spark: [25, 23, 24, 20, 21, 17, 18, 14],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg> },
];

const DEPTS = [
  { c: '#38BDF8', label: 'Engineering', n: '412' },
  { c: '#A78BFA', label: 'Sales', n: '286' },
  { c: '#F472B6', label: 'Support', n: '214' },
  { c: '#FBBF24', label: 'Marketing', n: '198' },
  { c: '#34D399', label: 'Operations', n: '174' },
];

const HIRES = [
  { c: '#38BDF8', name: 'Eli Whitman', email: 'eli.w@vireo.co', role: 'Frontend Engineer', dept: 'Engineering', deptTone: 'info', date: 'Jun 2', status: 'Active', statusTone: 'success' },
  { c: '#A78BFA', name: 'Sofia Marin', email: 'sofia.m@vireo.co', role: 'Account Executive', dept: 'Sales', deptTone: 'accent', date: 'Jun 5', status: 'Active', statusTone: 'success' },
  { c: '#FBBF24', name: 'Jordan Blake', email: 'jordan.b@vireo.co', role: 'Product Designer', dept: 'Design', deptTone: 'neutral', date: 'Jun 9', status: 'Onboarding', statusTone: 'warning' },
  { c: '#34D399', name: 'Hana Suzuki', email: 'hana.s@vireo.co', role: 'Support Specialist', dept: 'Support', deptTone: 'info', date: 'Jun 12', status: 'Onboarding', statusTone: 'warning' },
];

export function Hr() {
  return (
    <>
      <PageHead
        title="HR & Payroll"
        subtitle="1,284 people across 9 departments — attendance at 96.2%."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              {ICON_CAL}<span className="ax-btn__label">This month</span>{ICON_CHEV}
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Run Payroll</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M16 19h6" /><path d="M19 16v6" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /></svg>
              <span className="ax-btn__label">Add Employee</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        {KPIS.map((k) => (
          <div key={k.label} className="ax-card ax-kpi" role="region" aria-label={k.region}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${k.c}`}>{k.icon}</span>
                {k.neutral ? (
                  <span className="ax-kpi__delta" style={{ color: 'var(--ax-text-subtle)' }}>—</span>
                ) : (
                  <span className="ax-kpi__delta ax-kpi__delta--up">{k.downIcon ? ARROW_DN : ARROW_UP}{k.delta}</span>
                )}
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num">{k.value}</div>
                <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color={k.color} series={[{ name: 'Trend', data: k.spark }]} style={{ minHeight: 40 }} />
              </div>
            </div>
          </div>
        ))}

        {/* HERO: Headcount Trend (8) */}
        <section className="ax-card ax-card--chart ax-col-hero" role="region" aria-label="Headcount trend">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Workforce</span>
              <h2 className="ax-card__title">Headcount Trend</h2>
              <p className="ax-card__subtitle">Joiners vs. leavers, with net headcount</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">6M</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">12M</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">All</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-emerald)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Joiners</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-red)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Leavers</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Net headcount</small></span>
            </div>
            <ApexChart
              type="line"
              height={300}
              legend="none"
              ariaLabel="Mixed chart of monthly joiners and leavers with net headcount line"
              series={[
                { name: 'Joiners', type: 'column', data: [28, 32, 24, 38, 41, 36, 44, 39, 47, 42, 51, 48] },
                { name: 'Leavers', type: 'column', data: [14, 18, 12, 16, 19, 14, 21, 17, 18, 15, 16, 13] },
                { name: 'Net headcount', type: 'line', data: [1086, 1100, 1112, 1134, 1156, 1178, 1201, 1223, 1252, 1279, 1314, 1349] },
              ]}
              apex={{
                colors: [cv('--ax-viz-emerald'), cv('--ax-viz-red'), cv('--ax-accent')],
                stroke: { width: [0, 0, 3], curve: 'smooth' },
                plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
                yaxis: [
                  { seriesName: 'Joiners', labels: { formatter: (v: number) => String(Math.round(v)) } },
                  { seriesName: 'Joiners', show: false },
                  { opposite: true, labels: { formatter: (v: number) => (v / 1000).toFixed(2) + 'K' } },
                ],
              }}
            />
          </div>
        </section>

        {/* Department Distribution (4) */}
        <section className="ax-card ax-col-side" role="region" aria-label="Department distribution">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">By Department</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Department options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut chart of headcount by department"
              series={[412, 286, 214, 198, 174]}
              apex={{
                labels: ['Engineering', 'Sales', 'Support', 'Marketing', 'Operations'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber'), cv('--ax-viz-emerald')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'People', formatter: () => '1,284' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {DEPTS.map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.c, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Attendance Overview (8) */}
        <section className="ax-card ax-card--chart ax-col-wide" role="region" aria-label="Attendance overview">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Attendance Overview</h2>
              <p className="ax-card__subtitle">Present, remote, leave &amp; absent — this week</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-emerald)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Present</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Remote</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-amber)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Leave</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-red)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>Absent</small></span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={300}
              legend="none"
              stacked
              ariaLabel="Stacked column chart of weekly attendance breakdown"
              series={[
                { name: 'Present', data: [842, 868, 851, 879, 824] },
                { name: 'Remote', data: [312, 286, 301, 274, 332] },
                { name: 'Leave', data: [84, 72, 91, 78, 96] },
                { name: 'Absent', data: [46, 58, 41, 53, 32] },
              ]}
              apex={{
                colors: [cv('--ax-viz-emerald'), cv('--ax-viz-cyan'), cv('--ax-viz-amber'), cv('--ax-viz-red')],
                plotOptions: { bar: { borderRadius: 4, columnWidth: '46%' } },
                xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
              }}
            />
          </div>
        </section>

        {/* Payroll Summary (4) */}
        <section className="ax-card ax-col-narrow" role="region" aria-label="Payroll summary">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Payroll Summary</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', background: 'var(--ax-gradient-plate)', boxShadow: 'var(--ax-shadow-md)', color: '#fff' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.18)', filter: 'blur(6px)' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85 }}>Net pay — June run</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, lineHeight: 1.1 }}>$3,184,920</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85, marginTop: 'var(--ax-space-3)' }}>Next pay run · Jun 30, 2026</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Gross payroll</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$4,128,400</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Tax &amp; deductions</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>−$786,210</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Benefits</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>−$157,270</b></div>
              <div className="ax-divider" />
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>Net payable</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>$3,184,920</b></div>
            </div>
          </div>
        </section>

        {/* Leave Requests (4) */}
        <LeaveRequests />

        {/* New Hires (8) */}
        <section className="ax-card ax-col-wide" role="region" aria-label="Recent hires">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Hires</h2>
              <p className="ax-card__subtitle">Joined this month</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Employee</th>
                  <th className="ax-table__th" scope="col">Role</th>
                  <th className="ax-table__th" scope="col">Department</th>
                  <th className="ax-table__th" scope="col">Start date</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {HIRES.map((h) => (
                  <tr key={h.name} className="ax-table__row">
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${h.c} 18%,transparent)`, color: h.c }}>{ICON_USER_SM}</span>
                        <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{h.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{h.email}</div></div>
                      </div>
                    </td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{h.role}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${h.deptTone} ax-badge--pill`}>{h.dept}</span></td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{h.date}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${h.statusTone} ax-badge--pill`}><span className="ax-badge__dot" />{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Diversity (4) */}
        <section className="ax-card ax-col-third" role="region" aria-label="Diversity breakdown">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Diversity</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <Bar label="Women" pct="47%" w={47} color="var(--ax-viz-violet)" />
            <Bar label="Men" pct="51%" w={51} color="var(--ax-viz-cyan)" />
            <Bar label="Non-binary / other" pct="2%" w={2} color="var(--ax-viz-amber)" />
            <div className="ax-divider" />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Avg. tenure</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>3.8 yrs</b></div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Median age</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>32</b></div>
          </div>
        </section>

        {/* Celebrations (4) */}
        <section className="ax-card ax-col-third" role="region" aria-label="Birthdays and anniversaries">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Celebrations</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <Celebration c="#F472B6" name="Camila Rossi" sub="Birthday today" badge="🎂" badgeTone="accent" cake />
            <Celebration c="#FBBF24" name="Devon Okafor" sub="5 years · Jun 28" badge="5 yrs" badgeTone="warning" />
            <Celebration c="#38BDF8" name="Lena Brandt" sub="Birthday Jun 30" badge="in 3d" badgeTone="neutral" cake />
            <Celebration c="#34D399" name="Marcus Lee" sub="2 years · Jul 1" badge="2 yrs" badgeTone="warning" />
          </div>
        </section>

        {/* Employee of the Month (4) */}
        <section className="ax-card ax-card--accent-edge ax-col-third" role="region" aria-label="Employee of the month">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Recognition</span><h2 className="ax-card__title">Employee of the Month</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
            <span className="ax-avatar ax-avatar--xl ax-avatar--ringed" style={{ background: 'linear-gradient(135deg,var(--ax-accent),var(--ax-viz-violet))' }} />
            <div>
              <div style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>Devon Okafor</div>
              <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Senior Engineer · Engineering</div>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Shipped the new billing pipeline 2 weeks early and mentored 4 new hires.</p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', justifyContent: 'center', marginTop: 'var(--ax-space-2)' }}>
              <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>98%</div><small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Goals</small></div>
              <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>5.0</div><small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Peer rating</small></div>
            </div>
          </div>
        </section>
      </div>

      <style>{GRID_STYLE}</style>
    </>
  );
}

function Bar({ label, pct, w, color }: { label: string; pct: string; w: number; color: string }) {
  return (
    <div>
      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{pct}</b></div>
      <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${w}%`, background: color }} /></div></div>
    </div>
  );
}

function Celebration({ c, name, sub, badge, badgeTone, cake }: { c: string; name: string; sub: string; badge: string; badgeTone: string; cake?: boolean }) {
  return (
    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
      <span className="ax-avatar ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c} 18%,transparent)`, color: c }}>
        {cake ? (
          <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20h18v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8" /><path d="M12 4l1.5 1.6a2 2 0 1 1 -3 .1l1.5 -1.7" /></svg>
        ) : (
          <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{sub}</div></div>
      <span className={`ax-badge ax-badge--soft ax-badge--${badgeTone} ax-badge--pill`}>{badge}</span>
    </div>
  );
}

/* Leave requests — Alpine x-for+approve/reject re-expressed as a stateful client island. */
type LeaveStatus = 'pending' | 'approved' | 'rejected';
function LeaveRequests() {
  const [rows, setRows] = useState<{ n: string; r: string; d: string; c: string; s: LeaveStatus }[]>([
    { n: 'Priya Nair', r: 'Annual leave', d: 'Jul 1 – Jul 5', c: '#A78BFA', s: 'pending' },
    { n: 'Marcus Lee', r: 'Sick leave', d: 'Jun 28', c: '#34D399', s: 'pending' },
    { n: 'Ava Sutton', r: 'Work from home', d: 'Jun 27', c: '#38BDF8', s: 'approved' },
    { n: 'Tomás Herrera', r: 'Parental leave', d: 'Aug 1 – Sep 1', c: '#FBBF24', s: 'pending' },
  ]);
  const set = (i: number, s: LeaveStatus) => setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, s } : row)));
  return (
    <section className="ax-card ax-col-third" role="region" aria-label="Leave requests">
      <div className="ax-card__header">
        <div className="ax-card__titles"><h2 className="ax-card__title">Leave Requests</h2></div>
        <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill">3 pending</span>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
        {rows.map((row, i) => (
          <div key={i} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${row.c} 18%,transparent)`, color: row.c }}>{ICON_USER_SM}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{row.n}</div>
              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{row.r} · <span className="ax-num">{row.d}</span></div>
            </div>
            {row.s === 'pending' && (
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Approve request" onClick={() => set(i, 'approved')}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="var(--ax-viz-emerald)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Reject request" onClick={() => set(i, 'rejected')}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="var(--ax-viz-red)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
            )}
            {row.s === 'approved' && <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill">Approved</span>}
            {row.s === 'rejected' && <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill">Rejected</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default Hr;
