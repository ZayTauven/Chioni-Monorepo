'use client';
/*
 * Vireo Next.js — LMS & Courses dashboard (dashboards/lms).
 *
 * Faithful re-expression of src/html/dashboards/lms.html: KPI sparklines, an
 * Enrollments+Revenue mixed chart, a Students-by-category donut, continue-
 * learning progress rows, two radial gauges, upcoming classes, top courses
 * table, top instructors and recent enrollments. Charts go through <ApexChart>.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const FALLBACK: Record<string, string> = {
  '--ax-accent': '#2BB6A3', '--ax-viz-cyan': '#38BDF8', '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6', '--ax-viz-amber': '#FBBF24', '--ax-viz-emerald': '#34D399',
  '--ax-warning-500': '#F59E0B', '--ax-text-strong': '#E8EEF6', '--ax-fill-hover': 'rgba(255,255,255,.06)',
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
const ICON_USER_SM = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
);
const STAR = (
  <svg className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
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
  { region: 'Total Students 18,420, up 7.3%', c: 'c1', delta: '7.3%', label: 'Total Students', value: '18,420', color: '--ax-accent', spark: [7, 10, 9, 16, 18, 22, 26, 29],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" /></svg> },
  { region: 'Active Courses 142, up 3.0%', c: 'c2', delta: '3.0%', label: 'Active Courses', value: '142', color: '--ax-viz-cyan', spark: [10, 13, 12, 18, 16, 21, 20, 25],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg> },
  { region: 'Completion Rate 64%, up 2.1%', c: 'c3', delta: '2.1%', label: 'Completion Rate', value: '64%', color: '--ax-viz-violet', spark: [12, 15, 13, 20, 17, 23, 20, 26],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M13 17.5v4.5l2 -1.5l2 1.5v-4.5" /><path d="M10 19h-5a2 2 0 0 1 -2 -2v-10c0 -1.1 .9 -2 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -1 1.73" /><path d="M6 9l12 0" /><path d="M6 12l3 0" /><path d="M6 15l2 0" /></svg> },
  { region: 'Course Revenue $58,900, up 9.0%', c: 'c4', delta: '9.0%', label: 'Course Revenue', value: '$58,900', color: '--ax-viz-amber', spark: [8, 11, 10, 16, 18, 21, 25, 29],
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg> },
];

const CAT = [
  { c: '#38BDF8', label: 'Development', n: '38%' },
  { c: '#A78BFA', label: 'Design', n: '24%' },
  { c: '#F472B6', label: 'Business', n: '21%' },
  { c: '#FBBF24', label: 'Marketing', n: '17%' },
];

const COURSES = [
  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', name: 'Advanced React Patterns', sub: 'Daniel Cho', lessons: '28 of 34 lessons · Daniel Cho', pct: 82, fill: 'var(--ax-accent)',
    icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg> },
  { grad: 'linear-gradient(135deg,#F472B6,#FBBF24)', name: 'UI Design Foundations', lessons: '14 of 23 lessons · Mira Aoki', pct: 61, fill: 'var(--ax-viz-pink)',
    icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 9l18 0" /></svg> },
  { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', name: 'Data Analytics with Python', lessons: '18 of 40 lessons · Priya Nair', pct: 45, fill: 'var(--ax-viz-emerald)',
    icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg> },
  { grad: 'linear-gradient(135deg,#FBBF24,#FB7185)', name: 'Product Management 101', lessons: '7 of 25 lessons · Tomás Herrera', pct: 28, fill: 'var(--ax-viz-amber)',
    icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /></svg> },
];

const CLASSES = [
  { time: '10:00', ampm: 'AM', accent: true, title: 'Live Q&A · React Patterns', sub: 'Daniel Cho · 184 attending', badge: 'Today', badgeTone: 'success', dot: true },
  { time: '2:30', ampm: 'PM', title: 'Design Critique Workshop', sub: 'Mira Aoki · 96 attending', badge: 'Today', badgeTone: 'neutral' },
  { time: '11:00', ampm: 'AM', title: 'Python Data Lab', sub: 'Priya Nair · 142 enrolled', badge: 'Tomorrow', badgeTone: 'neutral' },
  { time: '4:00', ampm: 'PM', title: 'PM Career AMA', sub: 'Tomás Herrera · 210 enrolled', badge: 'Fri', badgeTone: 'neutral', last: true },
];

const TOP_COURSES = [
  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', name: 'Advanced React Patterns', author: 'Daniel Cho', students: '4,210', rating: '4.9', comp: '82%', compColor: 'var(--ax-viz-emerald)', rev: '$18,420' },
  { grad: 'linear-gradient(135deg,#F472B6,#FBBF24)', name: 'UI Design Foundations', author: 'Mira Aoki', students: '3,684', rating: '4.8', comp: '74%', compColor: 'var(--ax-viz-emerald)', rev: '$14,210' },
  { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', name: 'Data Analytics with Python', author: 'Priya Nair', students: '3,102', rating: '4.7', comp: '58%', compColor: 'var(--ax-viz-amber)', rev: '$11,840' },
  { grad: 'linear-gradient(135deg,#FBBF24,#FB7185)', name: 'Product Management 101', author: 'Tomás Herrera', students: '2,540', rating: '4.6', comp: '41%', compColor: 'var(--ax-viz-red)', rev: '$8,420' },
];

const INSTRUCTORS = [
  { rank: '1', rankColor: 'var(--ax-warning-500)', grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', name: 'Daniel Cho', sub: '8 courses · 4.9 avg', n: '6,210' },
  { rank: '2', rankColor: 'var(--ax-text-muted)', grad: 'linear-gradient(135deg,#F472B6,#FBBF24)', name: 'Mira Aoki', sub: '6 courses · 4.8 avg', n: '5,184' },
  { rank: '3', rankColor: 'var(--ax-text-subtle)', grad: 'linear-gradient(135deg,#34D399,#38BDF8)', name: 'Priya Nair', sub: '5 courses · 4.7 avg', n: '4,096' },
  { rank: '4', rankColor: 'var(--ax-text-subtle)', grad: 'linear-gradient(135deg,#FBBF24,#FB7185)', name: 'Tomás Herrera', sub: '4 courses · 4.6 avg', n: '3,402' },
];

const ENROLLMENTS = [
  { c: '#38BDF8', name: 'Ava Sutton', course: 'Advanced React Patterns', date: 'Jun 12', amt: '$89', status: 'Paid', tone: 'success' },
  { c: '#A78BFA', name: 'Henry Whitlock', course: 'UI Design Foundations', date: 'Jun 12', amt: '$69', status: 'Paid', tone: 'success' },
  { c: '#FBBF24', name: 'Camila Rossi', course: 'Data Analytics with Python', date: 'Jun 11', amt: '$129', status: 'Pending', tone: 'warning' },
  { c: '#34D399', name: 'Marcus Lee', course: 'Product Management 101', date: 'Jun 10', amt: '$59', status: 'Paid', tone: 'success' },
  { c: '#FB7185', name: 'Hana Suzuki', course: 'Advanced React Patterns', date: 'Jun 9', amt: '$89', status: 'Refunded', tone: 'danger' },
];

export function Lms() {
  return (
    <>
      <PageHead
        title="LMS & Courses"
        subtitle="18,420 students learning across 142 active courses."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">{ICON_CAL}<span className="ax-btn__label">This term</span>{ICON_CHEV}</button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg>
              <span className="ax-btn__label">Library</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Create Course</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {KPIS.map((k) => (
          <div key={k.label} className="ax-card ax-kpi" role="region" aria-label={k.region}>
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

        {/* HERO: Enrollments & Revenue (8) */}
        <section className="ax-card ax-card--chart ax-col-hero" role="region" aria-label="Enrollments and revenue">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Growth</span>
              <h2 className="ax-card__title">Enrollments &amp; Revenue</h2>
              <p className="ax-card__subtitle">New enrollments vs. course revenue</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Weekly</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">Monthly</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">Yearly</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Enrollments</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-amber)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Revenue ($K)</small></span>
            </div>
            <ApexChart
              type="line"
              height={300}
              legend="none"
              accent
              ariaLabel="Mixed chart of monthly enrollments columns with revenue line"
              series={[
                { name: 'Enrollments', type: 'column', data: [820, 940, 880, 1120, 1240, 1180, 1380, 1290, 1460, 1520, 1610, 1740] },
                { name: 'Revenue ($K)', type: 'line', data: [32, 38, 35, 44, 48, 46, 52, 49, 55, 58, 61, 66] },
              ]}
              apex={{
                colors: [cv('--ax-accent'), cv('--ax-viz-amber')],
                stroke: { width: [0, 3], curve: 'smooth' },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } },
                yaxis: [
                  { labels: { formatter: (v: number) => String(Math.round(v)) } },
                  { opposite: true, labels: { formatter: (v: number) => '$' + Math.round(v) + 'K' } },
                ],
              }}
            />
          </div>
        </section>

        {/* Students by Category (4) */}
        <section className="ax-card ax-col-side" role="region" aria-label="Students by category">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Students by Category</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Category options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut chart of students by category"
              series={[38, 24, 21, 17]}
              apex={{
                labels: ['Development', 'Design', 'Business', 'Marketing'],
                colors: [cv('--ax-viz-cyan'), cv('--ax-viz-violet'), cv('--ax-viz-pink'), cv('--ax-viz-amber')],
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Students', formatter: () => '18.4K' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {CAT.map((d) => (
                <li key={d.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: d.c, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{d.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{d.n}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Continue Learning (8) */}
        <section className="ax-card ax-col-wide" role="region" aria-label="Continue learning">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Continue Learning</h2>
              <p className="ax-card__subtitle">In-progress courses across your cohort</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">All courses</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {COURSES.map((c) => (
              <div key={c.name} className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: c.grad, color: '#fff' }}>{c.icon}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{c.name}</div><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{c.pct}%</b></div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', margin: '2px 0 6px' }}>{c.lessons}</div>
                  <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${c.pct}%`, background: c.fill }} /></div></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Performance rings (4) */}
        <section className="ax-card ax-col-narrow" role="region" aria-label="Completion and instructor rating">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Performance</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <ApexChart
                type="radialBar"
                height={160}
                legend="none"
                accent
                ariaLabel="Radial gauge of overall completion rate at 64%"
                series={[64]}
                apex={{
                  colors: [cv('--ax-accent')],
                  plotOptions: { radialBar: { hollow: { size: '58%' }, track: { background: cv('--ax-fill-hover') }, dataLabels: { name: { show: false }, value: { offsetY: 6, color: cv('--ax-text-strong'), fontSize: '20px', fontFamily: 'var(--ax-font-mono)', fontWeight: 700, formatter: (v: number) => v + '%' } } } },
                  fill: { type: 'solid' },
                }}
              />
              <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Avg completion</small>
            </div>
            <div style={{ textAlign: 'center' }}>
              <ApexChart
                type="radialBar"
                height={160}
                legend="none"
                ariaLabel="Radial gauge of average instructor rating at 4.7 out of 5"
                series={[94]}
                apex={{
                  colors: [cv('--ax-warning-500')],
                  plotOptions: { radialBar: { hollow: { size: '58%' }, track: { background: cv('--ax-fill-hover') }, dataLabels: { name: { show: false }, value: { offsetY: 6, color: cv('--ax-text-strong'), fontSize: '20px', fontFamily: 'var(--ax-font-mono)', fontWeight: 700, formatter: () => '4.7' } } } },
                  fill: { type: 'solid' },
                }}
              />
              <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Instructor rating</small>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="ax-divider" />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-3)' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Avg. watch time</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>42 min</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Certificates issued</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>2,318</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Active this week</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>9,640</b></div>
            </div>
          </div>
        </section>

        {/* Upcoming Classes (4) */}
        <section className="ax-card ax-col-third" role="region" aria-label="Upcoming live classes">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Upcoming Classes</h2></div>
            <a className="ax-btn ax-btn--link" href="#">Calendar</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {CLASSES.map((cl) => (
              <div key={cl.title} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', paddingBottom: cl.last ? undefined : 'var(--ax-space-3)', borderBottom: cl.last ? undefined : '1px solid var(--ax-border)' }}>
                <div style={{ textAlign: 'center', minWidth: 54 }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 700, color: cl.accent ? 'var(--ax-accent)' : 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)' }}>{cl.time}</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{cl.ampm}</div></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{cl.title}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{cl.sub}</div></div>
                <span className={`ax-badge ax-badge--soft ax-badge--${cl.badgeTone} ax-badge--pill`}>{cl.dot && <span className="ax-badge__dot" />}{cl.badge}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top Courses (8) */}
        <section className="ax-card ax-col-wide" role="region" aria-label="Top courses">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Top Courses</h2>
              <p className="ax-card__subtitle">By enrollments &amp; revenue this term</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Course</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Students</th>
                  <th className="ax-table__th" scope="col">Rating</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Completion</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {TOP_COURSES.map((c) => (
                  <tr key={c.name} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: c.grad }} /><div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{c.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.author}</div></div></div></td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{c.students}</td>
                    <td className="ax-table__td"><span className="ax-rating ax-rating--sm" role="img" aria-label={`Rated ${c.rating} of 5`}>{STAR}<span className="ax-rating__value ax-num">{c.rating}</span></span></td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: c.compColor }}>{c.comp}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{c.rev}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Instructors (4) */}
        <section className="ax-card ax-col-third" role="region" aria-label="Top instructors">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Top Instructors</h2></div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {INSTRUCTORS.map((ins) => (
              <div key={ins.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: ins.rankColor, width: 18, textAlign: 'center' }}>{ins.rank}</b>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: ins.grad }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{ins.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{ins.sub}</div></div>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{ins.n}</b>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Enrollments (8) */}
        <section className="ax-card ax-col-wide" role="region" aria-label="Recent enrollments">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Enrollments</h2>
              <p className="ax-card__subtitle">Latest students &amp; payments</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Student</th>
                  <th className="ax-table__th" scope="col">Course</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {ENROLLMENTS.map((e) => (
                  <tr key={e.name} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${e.c} 18%,transparent)`, color: e.c }}>{ICON_USER_SM}</span><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{e.name}</div></div></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{e.course}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{e.date}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{e.amt}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${e.tone} ax-badge--pill`}><span className="ax-badge__dot" />{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{GRID_STYLE}</style>
    </>
  );
}

export default Lms;
