'use client';
/*
 * Vireo Next.js — Hospital Overview dashboard (dashboards/healthcare).
 *
 * Faithful re-expression of src/html/dashboards/healthcare.html: KPI row, a
 * Patient-visits area chart, a department donut, an admissions/discharges
 * column chart, bed-occupancy/revenue progress bars, today's schedule, doctor
 * availability and a recent-appointments table. Uses the shared ax-col--N grid
 * utilities (no page-specific grid style). Charts via <ApexChart>.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const FALLBACK: Record<string, string> = {
  '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA', '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24', '--ax-viz-emerald': '#34D399',
};
function cv(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || '#38BDF8';
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);

const KPIS = [
  { region: 'Total Patients 8,940, up 3.2%', c: 'c1', delta: '3.2%', label: 'Total Patients', value: <>8,940</>, color: '--ax-accent', spark: [7, 9, 10, 14, 16, 20, 24, 27], dn: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg> },
  { region: 'Appointments Today 142, up 5.0%', c: 'c2', delta: '5.0%', label: 'Appointments Today', value: <>142</>, color: '--ax-viz-cyan', spark: [10, 12, 11, 16, 15, 20, 22, 25], dn: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /><path d="M8 15h2v2h-2l0 -2" /></svg> },
  { region: 'Average Wait Time 18 minutes, down 9.0% which is good', c: 'c3', delta: '9.0%', label: 'Avg Wait Time', value: <>18 <small style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', fontWeight: 500 }}>min</small></>, color: '--ax-viz-violet', spark: [27, 25, 26, 21, 20, 16, 13, 9], dn: true,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 12l3 2" /><path d="M12 7v5" /></svg> },
  { region: 'Bed Occupancy 82%, up 1.4%', c: 'c4', delta: '1.4%', label: 'Bed Occupancy', value: <>82%</>, color: '--ax-viz-amber', spark: [14, 15, 14, 17, 16, 18, 19, 21], dn: false,
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M22 17v-3h-20" /><path d="M2 8v9" /><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5" /></svg> },
];

const DEPTS = [
  { c: 'var(--ax-viz-cyan)', label: 'Cardiology', n: '38' },
  { c: 'var(--ax-viz-violet)', label: 'Neurology', n: '31' },
  { c: 'var(--ax-viz-pink)', label: 'Pediatrics', n: '28' },
  { c: 'var(--ax-viz-amber)', label: 'Orthopedics', n: '25' },
  { c: 'var(--ax-viz-emerald)', label: 'General', n: '20' },
];

const OCCUPANCY = [
  { label: 'ICU', pct: '94%', w: 94, color: 'var(--ax-danger-500)', valColor: 'var(--ax-danger-500)' },
  { label: 'General Medicine', pct: '86%', w: 86, color: 'var(--ax-warning-500)', valColor: 'var(--ax-text-strong)' },
  { label: 'Surgery', pct: '78%', w: 78, color: 'var(--ax-accent)', valColor: 'var(--ax-text-strong)' },
  { label: 'Pediatrics', pct: '71%', w: 71, color: 'var(--ax-viz-cyan)', valColor: 'var(--ax-text-strong)' },
  { label: 'Maternity', pct: '64%', w: 64, color: 'var(--ax-viz-emerald)', valColor: 'var(--ax-viz-emerald)' },
];

const REVENUE = [
  { label: 'Surgery', val: '$284K', w: 88, color: 'var(--ax-accent)' },
  { label: 'Diagnostics', val: '$176K', w: 62, color: 'var(--ax-viz-cyan)' },
  { label: 'Consultations', val: '$132K', w: 48, color: 'var(--ax-viz-violet)' },
  { label: 'Pharmacy', val: '$94K', w: 34, color: 'var(--ax-viz-pink)' },
  { label: 'Lab Tests', val: '$71K', w: 26, color: 'var(--ax-viz-amber)' },
];

const SCHEDULE = [
  { time: '09:00', accent: true, name: 'Marcus Reed', sub: 'Dr. Patel · Cardiology · Room 204' },
  { time: '09:45', accent: true, name: 'Ivy Tran', sub: 'Dr. Osei · Pediatrics · Room 112' },
  { time: '10:30', accent: true, name: 'George Hadley', sub: 'Dr. Klein · Neurology · Room 308' },
  { time: '11:15', accent: false, name: 'Nadia Farouk', sub: 'Dr. Lowe · Orthopedics · Room 220' },
];

const DOCTORS = [
  { initials: 'AP', c: 'var(--ax-viz-cyan)', name: 'Dr. Anita Patel', dept: 'Cardiology', status: 'Available', tone: 'success' },
  { initials: 'KO', c: 'var(--ax-viz-violet)', name: 'Dr. Kwame Osei', dept: 'Pediatrics', status: 'In consult', tone: 'warning' },
  { initials: 'HK', c: 'var(--ax-viz-pink)', name: 'Dr. Helena Klein', dept: 'Neurology', status: 'Available', tone: 'success' },
  { initials: 'DL', c: 'var(--ax-viz-amber)', name: 'Dr. Daniel Lowe', dept: 'Orthopedics', status: 'Off-duty', tone: 'off' },
];

const APPTS = [
  { initials: 'MR', c: 'var(--ax-viz-cyan)', name: 'Marcus Reed', sub: '52 · Male · #P-8841', doctor: 'Dr. Anita Patel', dept: 'Cardiology', time: '09:00', type: 'Follow-up', typeTone: 'info', status: 'Confirmed', statusTone: 'success' },
  { initials: 'IT', c: 'var(--ax-viz-pink)', name: 'Ivy Tran', sub: '7 · Female · #P-9210', doctor: 'Dr. Kwame Osei', dept: 'Pediatrics', time: '09:45', type: 'Check-up', typeTone: 'muted', status: 'Confirmed', statusTone: 'success' },
  { initials: 'GH', c: 'var(--ax-viz-violet)', name: 'George Hadley', sub: '64 · Male · #P-7702', doctor: 'Dr. Helena Klein', dept: 'Neurology', time: '10:30', type: 'Consult', typeTone: 'info', status: 'Waiting', statusTone: 'warning' },
  { initials: 'NF', c: 'var(--ax-viz-amber)', name: 'Nadia Farouk', sub: '38 · Female · #P-8033', doctor: 'Dr. Daniel Lowe', dept: 'Orthopedics', time: '11:15', type: 'X-ray', typeTone: 'muted', status: 'Confirmed', statusTone: 'success' },
  { initials: 'PL', c: 'var(--ax-viz-emerald)', name: 'Priya Lalwani', sub: '29 · Female · #P-9114', doctor: 'Dr. Anita Patel', dept: 'Cardiology', time: '13:00', type: 'ECG', typeTone: 'danger', status: 'Cancelled', statusTone: 'danger' },
];

export function Healthcare() {
  return (
    <>
      <PageHead
        title="Hospital Overview"
        subtitle="Patient flow, capacity and clinical activity — Riverside General."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
              <span className="ax-btn__label">Today</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New Appointment</span>
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
                <span className="ax-kpi__delta ax-kpi__delta--up">{k.dn ? ARROW_DN : ARROW_UP}{k.delta}</span>
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num">{k.value}</div>
                <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color={k.color} series={[{ name: 'Trend', data: k.spark }]} style={{ minHeight: 40 }} />
              </div>
            </div>
          </div>
        ))}

        {/* HERO: Patient Visits (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Patient visits">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Activity</span>
              <h2 className="ax-card__title">Patient Visits</h2>
              <p className="ax-card__subtitle">New vs. returning patients per day</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Week</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">Month</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Year</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>New patients</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Returning</small></span>
            </div>
            <ApexChart
              type="area"
              height={310}
              legend="none"
              accent
              ariaLabel="Area chart of new versus returning patient visits"
              series={[
                { name: 'New patients', data: [58, 64, 52, 71, 68, 82, 77, 90, 86, 98, 94, 112] },
                { name: 'Returning', data: [120, 128, 118, 140, 132, 150, 144, 162, 158, 170, 166, 184] },
              ]}
            />
          </div>
        </section>

        {/* By Department donut (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Appointments by department">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">By Department</h2>
              <p className="ax-card__subtitle">Today's appointments</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Department options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut: Cardiology, Neurology, Pediatrics, Orthopedics, General"
              series={[38, 31, 28, 25, 20]}
              apex={{
                labels: ['Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'General'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber'), cv('--ax-viz-emerald')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Today', formatter: () => '142' } } } } },
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

        {/* Admissions & Discharges (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Admissions versus discharges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Admissions &amp; Discharges</h2>
              <p className="ax-card__subtitle">Daily patient flow this week</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Admissions</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Discharges</small></span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={300}
              legend="none"
              ariaLabel="Column chart comparing admissions and discharges by weekday"
              series={[
                { name: 'Admissions', data: [34, 42, 38, 46, 40, 29, 24] },
                { name: 'Discharges', data: [28, 36, 40, 33, 44, 31, 26] },
              ]}
              apex={{ colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet')] }}
            />
          </div>
        </section>

        {/* Bed Occupancy (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Bed occupancy by ward">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Bed Occupancy</h2>
              <p className="ax-card__subtitle">By ward · 412 of 502 beds</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {OCCUPANCY.map((o) => (
              <div key={o.label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{o.label}</span><b className="ax-num" style={{ color: o.valColor, fontSize: 'var(--ax-text-sm)' }}>{o.pct}</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${o.w}%`, background: o.color }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* Today's Schedule (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Today's schedule">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Today's Schedule</h2>
              <p className="ax-card__subtitle">Upcoming appointments</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {SCHEDULE.map((s) => (
              <div key={s.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: s.accent ? 'var(--ax-accent)' : 'var(--ax-text-muted)', minWidth: 48, fontWeight: 600 }}>{s.time}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0, borderLeft: '2px solid var(--ax-border)', paddingLeft: 'var(--ax-space-3)' }}>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{s.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Doctor Availability (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Doctor availability">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Doctor Availability</h2>
              <p className="ax-card__subtitle">On-shift now</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              {DOCTORS.map((d) => (
                <li key={d.name} className="ax-list__row">
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${d.c} 18%,transparent)`, color: d.c, fontWeight: 600 }}>{d.initials}</span></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{d.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{d.dept}</span></span>
                  <span className="ax-list__trailing">
                    {d.tone === 'off'
                      ? <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-text-muted)' }}><span className="ax-badge__dot" />{d.status}</span>
                      : <span className={`ax-badge ax-badge--soft ax-badge--${d.tone} ax-badge--pill`}><span className="ax-badge__dot" />{d.status}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Revenue by Service (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Revenue by service">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Revenue by Service</h2>
              <p className="ax-card__subtitle">This month</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Report</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {REVENUE.map((r) => (
              <div key={r.label}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{r.label}</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{r.val}</b></div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${r.w}%`, background: r.color }} /></div></div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Appointments (12) */}
        <section className="ax-card ax-col--12" role="region" aria-label="Recent appointments">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Appointments</h2>
              <p className="ax-card__subtitle">Across all departments</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Patient</th>
                  <th className="ax-table__th" scope="col">Doctor</th>
                  <th className="ax-table__th" scope="col">Department</th>
                  <th className="ax-table__th" scope="col">Time</th>
                  <th className="ax-table__th" scope="col">Type</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {APPTS.map((a) => (
                  <tr key={a.name} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${a.c} 18%,transparent)`, color: a.c, fontWeight: 600 }}>{a.initials}</span><div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{a.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{a.sub}</div></div></div></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{a.doctor}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{a.dept}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{a.time}</td>
                    <td className="ax-table__td">{a.typeTone === 'muted' ? <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-text-muted)' }}>{a.type}</span> : <span className={`ax-badge ax-badge--soft ax-badge--${a.typeTone} ax-badge--pill`}>{a.type}</span>}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${a.statusTone} ax-badge--pill`}><span className="ax-badge__dot" />{a.status}</span></td>
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

export default Healthcare;
