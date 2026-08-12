'use client';
/*
 * Vireo Next.js — School Admin dashboard (dashboards/school).
 *
 * Faithful re-expression of src/html/dashboards/school.html: KPI row, a stacked
 * weekly-attendance chart, a students-by-grade donut, a distributed exam-scores
 * column chart, fee-collection progress, today's timetable, a notices timeline,
 * top performers and a recent-admissions table. Charts via <ApexChart>; shared
 * ax-col--N grid utilities.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const FALLBACK: Record<string, string> = {
  '--ax-accent': '#2BB6A3', '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6', '--ax-viz-amber': '#FBBF24', '--ax-viz-emerald': '#34D399',
};
function cv(name: string): string {
  if (typeof document === 'undefined') return FALLBACK[name] || '#38BDF8';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || FALLBACK[name] || '#38BDF8';
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);

const KPIS = [
  { region: 'Total Students 2,340, up 2.0%', c: 'c1', delta: '2.0%', label: 'Total Students', value: '2,340', color: '--ax-accent', spark: [7, 8, 9, 12, 13, 16, 19, 22],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></svg> },
  { region: 'Teachers 148, up 1.0%', c: 'c2', delta: '1.0%', label: 'Teachers', value: '148', color: '--ax-viz-cyan', spark: [10, 10, 11, 12, 13, 14, 15, 17],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 10h2a2 2 0 0 1 2 2v1" /><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M3 13v-1a2 2 0 0 1 2 -2h2" /></svg> },
  { region: 'Attendance Rate 94.8%, up 0.4%', c: 'c3', delta: '0.4%', label: 'Attendance Rate', value: '94.8%', color: '--ax-viz-violet', spark: [14, 15, 14, 17, 16, 19, 18, 21],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /><path d="M15 19l2 2l4 -4" /></svg> },
  { region: 'Fee Collection 88%, up 3.0%', c: 'c4', delta: '3.0%', label: 'Fee Collection', value: '88%', color: '--ax-viz-amber', spark: [8, 10, 9, 14, 15, 19, 21, 25],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg> },
];

const GRADES = [
  { c: 'var(--ax-viz-cyan)', label: 'Grade 9', n: '648' },
  { c: 'var(--ax-viz-violet)', label: 'Grade 10', n: '612' },
  { c: 'var(--ax-viz-pink)', label: 'Grade 11', n: '558' },
  { c: 'var(--ax-viz-amber)', label: 'Grade 12', n: '522' },
];

const TIMETABLE = [
  { time: '08:30', accent: true, title: 'Mathematics', sub: 'Ms. Ferreira · Room 14' },
  { time: '09:30', accent: true, title: 'Physics', sub: 'Mr. Adeyemi · Lab 2' },
  { time: '11:00', accent: true, title: 'English Literature', sub: 'Ms. Holloway · Room 9' },
  { time: '13:30', accent: false, title: 'Chemistry', sub: 'Dr. Singh · Lab 1' },
];

const PERFORMERS = [
  { rank: '1', c: 'var(--ax-viz-amber)', op: 20, weight: 700, name: 'Aisha Rahman', grade: 'Grade 12-A', gpa: '4.00' },
  { rank: '2', c: 'var(--ax-text-subtle)', op: 22, weight: 700, name: 'Noah Castellanos', grade: 'Grade 11-B', gpa: '3.98' },
  { rank: '3', c: 'var(--ax-viz-pink)', op: 20, weight: 700, name: 'Mei Lin Chow', grade: 'Grade 12-C', gpa: '3.95' },
  { rank: '4', c: 'var(--ax-viz-cyan)', op: 18, weight: 600, name: 'Oliver Tan', grade: 'Grade 10-A', gpa: '3.92' },
  { rank: '5', c: 'var(--ax-viz-violet)', op: 18, weight: 600, name: 'Sara Bianchi', grade: 'Grade 11-A', gpa: '3.90' },
];

const ADMISSIONS = [
  { initials: 'LK', c: 'var(--ax-viz-cyan)', name: 'Leah Kowalski', id: '#S-22841', grade: 'Grade 9', guardian: 'Anna Kowalski', date: 'Jun 24', fees: 'Paid', feesTone: 'success', status: 'Active', statusTone: 'success' },
  { initials: 'JM', c: 'var(--ax-viz-violet)', name: 'Jamal Mensah', id: '#S-22840', grade: 'Grade 10', guardian: 'Kofi Mensah', date: 'Jun 23', fees: 'Partial', feesTone: 'warning', status: 'Active', statusTone: 'success' },
  { initials: 'YN', c: 'var(--ax-viz-pink)', name: 'Yara Nasser', id: '#S-22839', grade: 'Grade 9', guardian: 'Layla Nasser', date: 'Jun 22', fees: 'Paid', feesTone: 'success', status: 'Active', statusTone: 'success' },
  { initials: 'DP', c: 'var(--ax-viz-amber)', name: 'Diego Paredes', id: '#S-22838', grade: 'Grade 11', guardian: 'Rosa Paredes', date: 'Jun 21', fees: 'Overdue', feesTone: 'danger', status: 'Pending', statusTone: 'warning' },
  { initials: 'HK', c: 'var(--ax-viz-emerald)', name: 'Hana Kim', id: '#S-22837', grade: 'Grade 12', guardian: 'Soo-jin Kim', date: 'Jun 20', fees: 'Paid', feesTone: 'success', status: 'Active', statusTone: 'success' },
];

export function School() {
  return (
    <>
      <PageHead
        title="School Admin"
        subtitle="Attendance, performance and fees — Greenfield Academy, term 3."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></svg>
              <span className="ax-btn__label">All grades</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add Student</span>
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

        {/* HERO: Attendance Overview (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Attendance overview">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">This week</span>
              <h2 className="ax-card__title">Attendance Overview</h2>
              <p className="ax-card__subtitle">Present, late and absent per day</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Present</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-amber)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Late</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-pink)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Absent</small></span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={310}
              legend="none"
              stacked
              accent
              ariaLabel="Stacked column chart of present, late and absent students per weekday"
              series={[
                { name: 'Present', data: [2180, 2210, 2150, 2240, 2120] },
                { name: 'Late', data: [92, 78, 110, 64, 102] },
                { name: 'Absent', data: [68, 52, 80, 36, 118] },
              ]}
              apex={{
                colors: [cv('--ax-accent'), cv('--ax-viz-amber'), cv('--ax-viz-pink')],
                plotOptions: { bar: { columnWidth: '46%', borderRadius: 4 } },
                xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
              }}
            />
          </div>
        </section>

        {/* By Grade donut (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Students by grade">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">By Grade</h2>
              <p className="ax-card__subtitle">Enrollment distribution</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut: Grade 9, Grade 10, Grade 11, Grade 12"
              series={[648, 612, 558, 522]}
              apex={{
                labels: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Students', formatter: () => '2,340' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {GRADES.map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.c, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Average Exam Scores (8) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Exam results by subject">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Average Exam Scores</h2>
              <p className="ax-card__subtitle">Mid-term results by subject (out of 100)</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Gradebook</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="bar"
              height={290}
              legend="none"
              accent
              ariaLabel="Column chart of average exam scores by subject"
              series={[{ name: 'Avg score', data: [82, 76, 88, 71, 79, 85, 68] }]}
              apex={{
                plotOptions: { bar: { columnWidth: '52%', borderRadius: 5, distributed: true } },
                colors: [cv('--ax-accent'), cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber'), cv('--ax-viz-emerald'), cv('--ax-accent')],
                xaxis: { categories: ['Math', 'Physics', 'English', 'Chem', 'Biology', 'History', 'Geo'] },
                yaxis: { max: 100 },
                tooltip: { y: { formatter: (v: number) => v + ' / 100' } },
              }}
            />
          </div>
        </section>

        {/* Fee Collection (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Fee collection status">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Fee Collection</h2>
              <p className="ax-card__subtitle">Term 3 · $1.84M billed</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Collected</span><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }}>$1.62M</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '88%', background: 'var(--ax-viz-emerald)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Pending</span><b className="ax-num" style={{ color: 'var(--ax-warning-500)', fontSize: 'var(--ax-text-sm)' }}>$148K</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '8%', background: 'var(--ax-warning-500)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Overdue</span><b className="ax-num" style={{ color: 'var(--ax-danger-500)', fontSize: 'var(--ax-text-sm)' }}>$72K</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '4%', background: 'var(--ax-danger-500)' }} /></div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)', textAlign: 'center', marginTop: 'var(--ax-space-2)', paddingTop: 'var(--ax-space-4)', borderTop: '1px solid var(--ax-border)' }}>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Paid in full</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>2,058</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Defaulters</small><b className="ax-num" style={{ color: 'var(--ax-danger-500)', fontSize: 'var(--ax-text-md)' }}>94</b></div>
            </div>
          </div>
        </section>

        {/* Today's Timetable (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Today's timetable">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Today's Timetable</h2>
              <p className="ax-card__subtitle">Grade 11-B</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Full</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {TIMETABLE.map((t) => (
              <div key={t.title} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: t.accent ? 'var(--ax-accent)' : 'var(--ax-text-muted)', minWidth: 48, fontWeight: 600 }}>{t.time}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0, borderLeft: '2px solid var(--ax-border)', paddingLeft: 'var(--ax-space-3)' }}>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{t.title}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notices (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Notices and announcements">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Notices</h2>
              <p className="ax-card__subtitle">Latest announcements</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Board</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-timeline">
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Sports Day</b> moved to Jul 4 — full schedule posted</p><span className="ax-timeline__time">2h ago · Admin</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title">Mid-term <b style={{ color: 'var(--ax-text-strong)' }}>report cards</b> available to parents</p><span className="ax-timeline__time">Yesterday · Academics</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Parent-teacher</b> meetings on Jul 9, 16:00</p><span className="ax-timeline__time">Jun 25 · Admin</span></div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 17v-13h13v13" /><path d="M9 8h13" /><path d="M5 21v-9a2 2 0 0 1 2 -2h2" /></svg></span>
                <div className="ax-timeline__content"><p className="ax-timeline__title">Library closed Jul 2 for <b style={{ color: 'var(--ax-text-strong)' }}>inventory</b></p><span className="ax-timeline__time">Jun 24 · Facilities</span></div>
              </li>
            </ul>
          </div>
        </section>

        {/* Top Performers (4) */}
        <section className="ax-card ax-col--4" role="region" aria-label="Top performers">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Top Performers</h2>
              <p className="ax-card__subtitle">By GPA · this term</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {PERFORMERS.map((p) => (
              <div key={p.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.c} ${p.op}%,transparent)`, color: p.rank === '2' ? 'var(--ax-text-muted)' : p.c, fontWeight: p.weight }}>{p.rank}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{p.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.grade}</div></div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 600, color: 'var(--ax-text-strong)' }}>{p.gpa}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Admissions (12) */}
        <section className="ax-card ax-col--12" role="region" aria-label="Recent admissions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Admissions</h2>
              <p className="ax-card__subtitle">New student enrollments</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Student</th>
                  <th className="ax-table__th" scope="col">Grade</th>
                  <th className="ax-table__th" scope="col">Guardian</th>
                  <th className="ax-table__th" scope="col">Enrolled</th>
                  <th className="ax-table__th" scope="col">Fees</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {ADMISSIONS.map((a) => (
                  <tr key={a.id} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${a.c} 18%,transparent)`, color: a.c, fontWeight: 600 }}>{a.initials}</span><div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{a.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{a.id}</div></div></div></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{a.grade}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{a.guardian}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{a.date}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${a.feesTone} ax-badge--pill`}>{a.fees}</span></td>
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

export default School;
