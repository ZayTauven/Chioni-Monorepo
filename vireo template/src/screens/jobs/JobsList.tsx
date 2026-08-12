'use client';
/*
 * Vireo Next.js — Jobs / List (route "jobs/list").
 *
 * Faithful re-expression of src/html/jobs/list.html: a sticky filter rail
 * (keyword, location, employment-type checkboxes, department list, salary
 * range, experience radios) over a sortable results panel with card/list view
 * toggle, active filter chips, an empty state and a paginated footer. The
 * Alpine axJobsList() state is ported to React; classes + ARIA match 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface JobType { id: string; name: string; count: number }
interface Dept { id: string; name: string; count: number }
interface Level { id: string; name: string }
interface Job {
  id: number; title: string; company: string; dept: string; location: string; loc: string;
  type: string; typeBadge: string; level: string; min: number; max: number; applicants: number;
  posted: string; _o: number; saved: boolean; color: string; skills: string[];
}

const TYPES: JobType[] = [
  { id: 'full_time', name: 'Full-time', count: 31 },
  { id: 'part_time', name: 'Part-time', count: 6 },
  { id: 'contract', name: 'Contract', count: 8 },
  { id: 'internship', name: 'Internship', count: 3 },
];
const DEPARTMENTS: Dept[] = [
  { id: 'eng', name: 'Engineering', count: 18 },
  { id: 'design', name: 'Design', count: 7 },
  { id: 'product', name: 'Product', count: 5 },
  { id: 'marketing', name: 'Marketing', count: 6 },
  { id: 'sales', name: 'Sales', count: 8 },
  { id: 'ops', name: 'Operations', count: 4 },
];
const LEVELS: Level[] = [
  { id: 'junior', name: 'Junior (0–2 yrs)' },
  { id: 'mid', name: 'Mid (3–5 yrs)' },
  { id: 'senior', name: 'Senior (6–9 yrs)' },
  { id: 'lead', name: 'Lead / Staff (10+ yrs)' },
];
const JOBS: Job[] = [
  { id: 1, title: 'Senior Product Designer', company: 'Northwind Labs', dept: 'design', location: 'Remote (EU)', loc: 'remote', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'senior', min: 95, max: 120, applicants: 38, posted: '2d ago', _o: 0, saved: false, color: '#38BDF8', skills: ['Design Systems', 'Figma', 'A11y'] },
  { id: 2, title: 'Staff Frontend Engineer', company: 'Helios Cloud', dept: 'eng', location: 'Berlin, DE', loc: 'berlin', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'lead', min: 130, max: 170, applicants: 64, posted: '4d ago', _o: 1, saved: true, color: '#A78BFA', skills: ['TypeScript', 'React', 'Vite'] },
  { id: 3, title: 'Product Marketing Manager', company: 'Lumen Brands', dept: 'marketing', location: 'Austin, US', loc: 'austin', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'mid', min: 78, max: 96, applicants: 21, posted: '1w ago', _o: 2, saved: false, color: '#F472B6', skills: ['GTM', 'Positioning', 'Analytics'] },
  { id: 4, title: 'Backend Engineer (Contract)', company: 'Vela Systems', dept: 'eng', location: 'Remote (Global)', loc: 'remote', type: 'contract', typeBadge: 'ax-badge--warning', level: 'mid', min: 70, max: 90, applicants: 47, posted: '3d ago', _o: 3, saved: false, color: '#FBBF24', skills: ['Go', 'Postgres', 'gRPC'] },
  { id: 5, title: 'UX Research Lead', company: 'Northwind Labs', dept: 'design', location: 'London, UK', loc: 'london', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'lead', min: 105, max: 135, applicants: 19, posted: '5d ago', _o: 4, saved: false, color: '#34D399', skills: ['Discovery', 'Interviews', 'Synthesis'] },
  { id: 6, title: 'Account Executive', company: 'Quill & Co.', dept: 'sales', location: 'Lisbon, PT', loc: 'lisbon', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'mid', min: 60, max: 85, applicants: 33, posted: '6d ago', _o: 5, saved: false, color: '#FB7185', skills: ['SaaS', 'Pipeline', 'Negotiation'] },
  { id: 7, title: 'Design Intern — Summer', company: 'Lumen Brands', dept: 'design', location: 'Austin, US', loc: 'austin', type: 'internship', typeBadge: 'ax-badge--info', level: 'junior', min: 36, max: 42, applicants: 88, posted: '1d ago', _o: 6, saved: false, color: '#38BDF8', skills: ['Figma', 'Prototyping'] },
  { id: 8, title: 'Platform Reliability Engineer', company: 'Helios Cloud', dept: 'eng', location: 'Remote (EU)', loc: 'remote', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'senior', min: 115, max: 150, applicants: 29, posted: '2w ago', _o: 7, saved: false, color: '#A78BFA', skills: ['Kubernetes', 'Terraform', 'SLOs'] },
  { id: 9, title: 'Part-time Content Strategist', company: 'Quill & Co.', dept: 'marketing', location: 'Remote (US)', loc: 'remote', type: 'part_time', typeBadge: 'ax-badge--neutral', level: 'mid', min: 45, max: 58, applicants: 14, posted: '1w ago', _o: 8, saved: false, color: '#FBBF24', skills: ['SEO', 'Editorial'] },
  { id: 10, title: 'Senior Product Manager', company: 'Vela Systems', dept: 'product', location: 'Berlin, DE', loc: 'berlin', type: 'full_time', typeBadge: 'ax-badge--accent', level: 'senior', min: 110, max: 140, applicants: 41, posted: '3d ago', _o: 9, saved: false, color: '#34D399', skills: ['Roadmap', 'Discovery', 'Metrics'] },
];

const LOC_NAMES: Record<string, string> = { remote: 'Remote', berlin: 'Berlin, DE', london: 'London, UK', austin: 'Austin, US', lisbon: 'Lisbon, PT' };
const typeName = (id: string) => TYPES.find((t) => t.id === id)?.name || id;
const deptName = (id: string) => DEPARTMENTS.find((d) => d.id === id)?.name || id;
const levelName = (id: string) => (LEVELS.find((l) => l.id === id)?.name || id).replace(/\s*\(.*\)/, '');
const salaryRange = (j: Job) => `$${j.min}K – $${j.max}K`;

const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);
const X_PATHS = ['M18 6l-12 12', 'M6 6l12 12'];
const COMPANY_PATHS = ['M3 21l18 0', 'M9 8l1 0', 'M9 12l1 0', 'M9 16l1 0', 'M14 8l1 0', 'M14 12l1 0', 'M14 16l1 0', 'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16'];
const COMPANY_PATHS_SM = ['M3 21l18 0', 'M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16', 'M9 8l1 0', 'M9 12l1 0', 'M14 8l1 0', 'M14 12l1 0'];
const PIN_PATHS = ['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'];

export function JobsList() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('relevance');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [fLocation, setFLocation] = useState('');
  const [fTypes, setFTypes] = useState<string[]>([]);
  const [fDept, setFDept] = useState('');
  const [fMinSalary, setFMinSalary] = useState(0);
  const [fLevel, setFLevel] = useState('');
  const [saved, setSaved] = useState<Record<number, boolean>>(() => Object.fromEntries(JOBS.map((j) => [j.id, j.saved])));

  const filtersActive = !!fLocation || fTypes.length > 0 || !!fDept || fMinSalary > 0 || !!fLevel;
  const resetFilters = () => { setFLocation(''); setFTypes([]); setFDept(''); setFMinSalary(0); setFLevel(''); };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = JOBS.filter((j) => {
      if (term && !(j.title.toLowerCase().includes(term) || j.company.toLowerCase().includes(term) || j.skills.join(' ').toLowerCase().includes(term))) return false;
      if (fLocation && j.loc !== fLocation) return false;
      if (fTypes.length && !fTypes.includes(j.type)) return false;
      if (fDept && j.dept !== fDept) return false;
      if (fMinSalary && j.max < fMinSalary) return false;
      if (fLevel && j.level !== fLevel) return false;
      return true;
    });
    const by: Record<string, (a: Job, b: Job) => number> = {
      newest: (a, b) => a._o - b._o,
      salary: (a, b) => b.max - a.max,
      applicants: (a, b) => b.applicants - a.applicants,
    };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [q, sort, fLocation, fTypes, fDept, fMinSalary, fLevel]);

  const toggleType = (id: string) => setFTypes((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHead
        title="Jobs List"
        subtitle={(<><span className="ax-num">48</span> open postings · <span className="ax-num">1,284</span> applicants this month · <span className="ax-num">6</span> closing this week.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              {ICON(['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2', 'M7 11l5 5l5 -5', 'M12 4l0 12'], { className: 'ax-btn__icon' })}
              <span className="ax-btn__label">Export</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/jobs/job-post">
              {ICON(['M12 5l0 14', 'M5 12l14 0'], { className: 'ax-btn__icon' })}
              <span className="ax-btn__label">Post a job</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* FILTER RAIL (3) */}
        <aside className="ax-card ax-col--3" role="region" aria-label="Filters" style={{ alignSelf: 'start', position: 'sticky', top: 'var(--ax-space-5)' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Filters</h2></div>
            {filtersActive && <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={resetFilters}>Clear all</button>}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            {/* keyword */}
            <div className="ax-field" style={{ margin: 0 }}>
              <label className="ax-label" htmlFor="f-keyword">Keyword</label>
              <div style={{ position: 'relative' }}>
                {ICON(['M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'], { style: { position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: 'var(--ax-text-subtle)' } })}
                <input id="f-keyword" type="search" className="ax-input" placeholder="Title, skill, team…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 35 }} />
              </div>
            </div>
            {/* location */}
            <div className="ax-field" style={{ margin: 0 }}>
              <label className="ax-label" htmlFor="f-location">Location</label>
              <select id="f-location" className="ax-select" value={fLocation} onChange={(e) => setFLocation(e.target.value)}>
                <option value="">Any location</option>
                <option value="remote">Remote</option>
                <option value="berlin">Berlin, DE</option>
                <option value="london">London, UK</option>
                <option value="austin">Austin, US</option>
                <option value="lisbon">Lisbon, PT</option>
              </select>
            </div>
            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
            {/* employment type */}
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Employment type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                {TYPES.map((t) => (
                  <label key={t.id} className="ax-check"><input type="checkbox" className="ax-checkbox" value={t.id} checked={fTypes.includes(t.id)} onChange={() => toggleType(t.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', flex: '1 1 auto' }}>{t.name}</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{t.count}</span></label>
                ))}
              </div>
            </div>
            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
            {/* department */}
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Department</div>
              <ul className="ax-list ax-list--compact" style={{ gap: 2 }}>
                {DEPARTMENTS.map((d) => (
                  <li key={d.id} className="ax-list__row" style={{ border: 0, padding: '6px var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', ...(fDept === d.id ? { background: 'var(--ax-accent-wash)' } : {}) }} onClick={() => setFDept(fDept === d.id ? '' : d.id)}>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: fDept === d.id ? 'var(--ax-accent)' : 'var(--ax-text)' }}>{d.name}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
            {/* minimum salary */}
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <span className="ax-label">Min. salary</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>$<span>{fMinSalary}</span>K+</span>
              </div>
              <div className="ax-range">
                <div className="ax-range__track"><div className="ax-range__fill" style={{ width: `${(fMinSalary / 200) * 100}%` }} /></div>
              </div>
              <input type="range" className="ax-range--native" min={0} max={200} step={5} value={fMinSalary} onChange={(e) => setFMinSalary(Number(e.target.value))} style={{ width: '100%', marginTop: 'var(--ax-space-3)' }} aria-label="Minimum salary in thousands" />
            </div>
            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
            {/* experience */}
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Experience level</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                {LEVELS.map((lvl) => (
                  <label key={lvl.id} className="ax-check" style={{ minHeight: 30 }}><input type="radio" name="exp" className="ax-radio" value={lvl.id} checked={fLevel === lvl.id} onChange={() => setFLevel(lvl.id)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>{lvl.name}</span></label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RESULTS (9) */}
        <section className="ax-card ax-col--9" role="region" aria-label="Job results">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Open positions</h2>
              <p className="ax-card__subtitle"><span className="ax-num">{filtered.length}</span> of <span className="ax-num">48</span> postings match</p>
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort jobs" style={{ minWidth: 150 }}>
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="salary">Highest salary</option>
                <option value="applicants">Most applicants</option>
              </select>
              <div className="ax-segment" role="group" aria-label="View mode">
                <button type="button" className="ax-segment__option" aria-pressed={view === 'cards'} onClick={() => setView('cards')} aria-label="Card view">
                  {ICON(['M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4', 'M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4', 'M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4', 'M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4'])}
                </button>
                <button type="button" className="ax-segment__option" aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="List view">
                  {ICON(['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'])}
                </button>
              </div>
            </div>
          </div>

          {/* active filter chips */}
          {filtersActive && (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: '0 var(--ax-space-5) var(--ax-space-3)', flexWrap: 'wrap' }}>
              {fLocation && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill"><span>{LOC_NAMES[fLocation] || fLocation}</span><button type="button" className="ax-badge__remove" aria-label="Clear location filter" onClick={() => setFLocation('')}>{ICON(X_PATHS, { strokeWidth: 2 })}</button></span>}
              {fTypes.map((t) => <span key={t} className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill"><span>{typeName(t)}</span><button type="button" className="ax-badge__remove" aria-label="Clear type filter" onClick={() => setFTypes((s) => s.filter((x) => x !== t))}>{ICON(X_PATHS, { strokeWidth: 2 })}</button></span>)}
              {fDept && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill"><span>{deptName(fDept)}</span><button type="button" className="ax-badge__remove" aria-label="Clear department filter" onClick={() => setFDept('')}>{ICON(X_PATHS, { strokeWidth: 2 })}</button></span>}
              {fMinSalary > 0 && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill">$<span className="ax-num">{fMinSalary}</span>K+<button type="button" className="ax-badge__remove" aria-label="Clear salary filter" onClick={() => setFMinSalary(0)}>{ICON(X_PATHS, { strokeWidth: 2 })}</button></span>}
              {fLevel && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill"><span>{levelName(fLevel)}</span><button type="button" className="ax-badge__remove" aria-label="Clear experience filter" onClick={() => setFLevel('')}>{ICON(X_PATHS, { strokeWidth: 2 })}</button></span>}
            </div>
          )}

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {/* CARDS VIEW */}
            {view === 'cards' && (
              <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {filtered.map((j) => (
                  <article key={j.id} className="ax-card ax-card--interactive" style={{ margin: 0 }}>
                    <div style={{ padding: 'var(--ax-space-5)', display: 'flex', gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
                      <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${j.color} 18%,transparent)`, color: j.color, flex: 'none' }}>
                        <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY_PATHS.map((d, i) => <path key={i} d={d} />)}</svg>
                      </span>
                      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                        <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <Link href="/jobs/job-details" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', textDecoration: 'none', lineHeight: 1.25 }}>{j.title}</Link>
                            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 4, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                              <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text)' }}>{j.company}</span>
                              <span className="ax-cluster" style={{ gap: 4 }}>{ICON(PIN_PATHS, { width: 15, height: 15 })}<span>{j.location}</span></span>
                            </div>
                          </div>
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={(saved[j.id] ? 'Unsave ' : 'Save ') + j.title} onClick={() => setSaved((s) => ({ ...s, [j.id]: !s[j.id] }))} style={saved[j.id] ? { color: 'var(--ax-accent)' } : undefined}>
                            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={saved[j.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg>
                          </button>
                        </div>
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
                          <span className={`ax-badge ax-badge--soft ${j.typeBadge}`} style={{ borderRadius: 'var(--ax-radius-xs)' }}>{typeName(j.type)}</span>
                          <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>{levelName(j.level)}</span>
                          {j.skills.map((s) => <span key={s} className="ax-badge ax-badge--outline" style={{ borderRadius: 'var(--ax-radius-xs)' }}>{s}</span>)}
                        </div>
                      </div>
                      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--ax-space-3)', textAlign: 'end' }}>
                        <div>
                          <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>{salaryRange(j)}</div>
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>per year</div>
                        </div>
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'center' }}>
                          <span className="ax-cluster" style={{ gap: 4, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{ICON(['M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'], { width: 14, height: 14 })}<span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{j.applicants}</span></span>
                          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{j.posted}</span>
                          <Link href="/jobs/job-details" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--pill">View</Link>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
              <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-5))' }}>
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Position</th>
                      <th className="ax-table__th" scope="col">Department</th>
                      <th className="ax-table__th" scope="col">Type</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Salary</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Applicants</th>
                      <th className="ax-table__th" scope="col">Posted</th>
                      <th className="ax-table__th" scope="col" style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((j) => (
                      <tr key={j.id} className="ax-table__row">
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${j.color} 18%,transparent)`, color: j.color }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{COMPANY_PATHS_SM.map((d, i) => <path key={i} d={d} />)}</svg></span>
                            <div style={{ minWidth: 0 }}>
                              <Link href="/jobs/job-details" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{j.title}</Link>
                              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span>{j.company}</span> · <span>{j.location}</span></div>
                            </div>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{deptName(j.dept)}</td>
                        <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ${j.typeBadge}`} style={{ borderRadius: 'var(--ax-radius-xs)' }}>{typeName(j.type)}</span></td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{salaryRange(j)}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{j.applicants}</td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{j.posted}</td>
                        <td className="ax-table__td">
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={'Actions for ' + j.title}>{ICON(['M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'], { className: 'ax-btn__icon' })}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* empty state */}
            {!filtered.length && (
              <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9" /><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" /><path d="M12 12l0 .01" /><path d="M3 13a20 20 0 0 0 18 0" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No jobs match your filters</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try broadening the salary range or clearing some filters.</p>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={resetFilters}>Clear all filters</button>
              </div>
            )}
          </div>

          {/* footer / pagination */}
          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{filtered.length}</span> of 48 postings</span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled aria-disabled="true">{ICON(['M15 6l-6 6l6 6'])}</button>
                <ul className="ax-pagination__pages">
                  <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                  <li><a href="#" className="ax-pagination__page">2</a></li>
                  <li><a href="#" className="ax-pagination__page">3</a></li>
                  <li><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a href="#" className="ax-pagination__page">6</a></li>
                </ul>
                <button type="button" className="ax-pagination__next">{ICON(['M9 6l6 6l-6 6'])}</button>
              </nav>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default JobsList;
