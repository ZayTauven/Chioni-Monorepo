'use client';
/*
 * Vireo Next.js — Jobs / Search Jobs (route "jobs/search-jobs").
 *
 * Faithful re-expression of src/html/jobs/search-jobs.html: a keyword/location
 * search bar over a sticky filter rail (employment type, work mode, salary
 * slider, experience radios, posted-within) and a sorted, paginated list of
 * job-result cards with active filter chips, save toggles, an apply toast and
 * an empty state. The Alpine axSearchJobs() state is ported to React.
 */
import { useMemo, useState, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };
const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);

interface TypeFacet { id: string; label: string; count: number }
interface Mode { id: string; label: string; count: number }
interface Row {
  id: string; title: string; company: string; mark: string; c: string; verified: boolean;
  location: string; mode: string; type: string; typeLabel: string; level: string; salaryMin: number;
  salary: string; summary: string; skills: string[]; posted: string; postedDays: number;
  applicants: number; urgent: boolean; saved: boolean;
}

const TYPES: TypeFacet[] = [
  { id: 'full', label: 'Full-time', count: 842 },
  { id: 'contract', label: 'Contract', count: 214 },
  { id: 'part', label: 'Part-time', count: 128 },
  { id: 'intern', label: 'Internship', count: 64 },
  { id: 'freelance', label: 'Freelance', count: 36 },
];
const MODES: Mode[] = [
  { id: 'remote', label: 'Remote', count: 512 },
  { id: 'hybrid', label: 'Hybrid', count: 438 },
  { id: 'onsite', label: 'On-site', count: 334 },
];
const LEVELS = ['Any level', 'Junior', 'Mid-level', 'Senior', 'Lead / Staff'];
const ROWS: Row[] = [
  { id: 'j01', title: 'Senior Frontend Engineer', company: 'Northwind Labs', mark: 'NW', c: C.cyan, verified: true, location: 'Remote · EU', mode: 'remote', type: 'full', typeLabel: 'Full-time', level: 'Senior', salaryMin: 120, salary: '$120K – $150K', summary: 'Own the design-system layer of our analytics platform. You will ship accessible React + TypeScript UI and partner closely with product design on the Aurora refresh.', skills: ['React', 'TypeScript', 'Design Systems', 'GraphQL'], posted: '2 days ago', postedDays: 2, applicants: 48, urgent: false, saved: false },
  { id: 'j02', title: 'Product Designer', company: 'Studioform', mark: 'SF', c: C.violet, verified: true, location: 'London, UK · Hybrid', mode: 'hybrid', type: 'full', typeLabel: 'Full-time', level: 'Mid-level', salaryMin: 78, salary: '£62K – £78K', summary: 'Shape end-to-end flows for a B2B SaaS suite. Strong systems thinking, comfortable in Figma, and able to move from research insight to shipped pixels.', skills: ['Figma', 'Prototyping', 'UX Research', 'Design Ops'], posted: '5 hours ago', postedDays: 0, applicants: 21, urgent: true, saved: true },
  { id: 'j03', title: 'DevOps Engineer', company: 'Loop Robotics', mark: 'LR', c: C.emerald, verified: false, location: 'Remote · Global', mode: 'remote', type: 'contract', typeLabel: 'Contract', level: 'Senior', salaryMin: 140, salary: '$140K – $170K', summary: 'Run our multi-region Kubernetes estate and tighten the deploy pipeline. We value pragmatic automation, clean Terraform, and calm incident response.', skills: ['Kubernetes', 'Terraform', 'AWS', 'Go'], posted: '1 day ago', postedDays: 1, applicants: 33, urgent: false, saved: false },
  { id: 'j04', title: 'Account Executive', company: 'Brightline Capital', mark: 'BC', c: C.amber, verified: true, location: 'New York, US · On-site', mode: 'onsite', type: 'full', typeLabel: 'Full-time', level: 'Mid-level', salaryMin: 95, salary: '$95K + commission', summary: 'Drive net-new revenue across mid-market fintech accounts. You will own the full cycle from discovery to close, backed by a strong SDR pod.', skills: ['SaaS Sales', 'Salesforce', 'Negotiation'], posted: '3 days ago', postedDays: 3, applicants: 64, urgent: false, saved: false },
  { id: 'j05', title: 'Staff Data Scientist', company: 'Meridian Health', mark: 'MH', c: C.pink, verified: true, location: 'Remote · US', mode: 'remote', type: 'full', typeLabel: 'Full-time', level: 'Lead / Staff', salaryMin: 185, salary: '$185K – $220K', summary: 'Lead modelling for clinical-risk prediction. You will mentor a small team, own experiment design, and translate ambiguous problems into shipped models.', skills: ['Python', 'ML', 'Causal Inference', 'SQL'], posted: '6 hours ago', postedDays: 0, applicants: 12, urgent: true, saved: false },
  { id: 'j06', title: 'Marketing Manager', company: 'Pulse Media', mark: 'PM', c: C.violet, verified: false, location: 'Berlin, DE · Hybrid', mode: 'hybrid', type: 'full', typeLabel: 'Full-time', level: 'Mid-level', salaryMin: 64, salary: '€58K – €72K', summary: 'Own demand generation across paid, lifecycle, and content. Data-driven, fluent in attribution, and excited to build a category-defining brand voice.', skills: ['Growth', 'SEO', 'Lifecycle', 'Analytics'], posted: '4 days ago', postedDays: 4, applicants: 41, urgent: false, saved: false },
  { id: 'j07', title: 'Backend Engineer (Go)', company: 'Clearbox', mark: 'CB', c: C.cyan, verified: true, location: 'Remote · EU', mode: 'remote', type: 'full', typeLabel: 'Full-time', level: 'Mid-level', salaryMin: 90, salary: '$90K – $115K', summary: 'Build the event-driven core of our automation engine. Clean APIs, thoughtful tests, and an appetite for distributed-systems problems.', skills: ['Go', 'PostgreSQL', 'gRPC', 'Kafka'], posted: '2 days ago', postedDays: 2, applicants: 29, urgent: false, saved: false },
  { id: 'j08', title: 'UX Research Intern', company: 'Crate & Co', mark: 'CC', c: C.amber, verified: false, location: 'Amsterdam, NL · On-site', mode: 'onsite', type: 'intern', typeLabel: 'Internship', level: 'Junior', salaryMin: 42, salary: '€2,400 / mo', summary: 'Support discovery research for our checkout team — recruiting, moderating sessions, and synthesising findings into crisp, actionable insight.', skills: ['Interviews', 'Synthesis', 'Figma'], posted: '1 week ago', postedDays: 7, applicants: 88, urgent: false, saved: false },
  { id: 'j09', title: 'Engineering Manager', company: 'Ridgeline Energy', mark: 'RE', c: C.pink, verified: true, location: 'Remote · US', mode: 'remote', type: 'full', typeLabel: 'Full-time', level: 'Lead / Staff', salaryMin: 200, salary: '$200K – $240K', summary: 'Grow and steward two product squads building grid-optimisation software. People-first leader who still loves architecture conversations.', skills: ['Leadership', 'Architecture', 'Hiring'], posted: '3 days ago', postedDays: 3, applicants: 18, urgent: false, saved: true },
  { id: 'j10', title: 'Customer Success Lead', company: 'Harbor Freight Co', mark: 'HF', c: C.emerald, verified: false, location: 'Remote · UK', mode: 'remote', type: 'contract', typeLabel: 'Contract', level: 'Senior', salaryMin: 85, salary: '£70K – £85K', summary: 'Own retention and expansion for our top-tier accounts. Build playbooks, run QBRs, and be the trusted voice of the customer internally.', skills: ['CS Strategy', 'Onboarding', 'Renewals'], posted: '5 days ago', postedDays: 5, applicants: 52, urgent: false, saved: false },
];
const PER_PAGE = 6;

export function SearchJobs() {
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const [sort, setSort] = useState('relevance');
  const [page, setPage] = useState(1);
  const [salaryK, setSalaryK] = useState(40);
  const [fLevel, setFLevel] = useState('');
  const [fPosted, setFPosted] = useState('');
  const [fType, setFType] = useState<string[]>([]);
  const [fMode, setFMode] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState<Record<string, boolean>>(() => Object.fromEntries(ROWS.map((r) => [r.id, r.saved])));
  const tRef = useRef<number | undefined>(undefined);

  const reset = () => { setQ(''); setLoc(''); setSalaryK(40); setFLevel(''); setFPosted(''); setFType([]); setFMode([]); setSort('relevance'); setPage(1); };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase(), l = loc.trim().toLowerCase();
    let r = ROWS.filter((x) => {
      if (t && !(x.title.toLowerCase().includes(t) || x.company.toLowerCase().includes(t) || x.skills.join(' ').toLowerCase().includes(t))) return false;
      if (l && !x.location.toLowerCase().includes(l)) return false;
      if (fType.length && !fType.includes(x.type)) return false;
      if (fMode.length && !fMode.includes(x.mode)) return false;
      if (salaryK > 40 && x.salaryMin < salaryK) return false;
      if (fLevel && fLevel !== 'Any level' && x.level !== fLevel) return false;
      if (fPosted && x.postedDays > Number(fPosted)) return false;
      return true;
    });
    if (sort === 'recent') return [...r].sort((a, b) => a.postedDays - b.postedDays);
    if (sort === 'salary') return [...r].sort((a, b) => b.salaryMin - a.salaryMin);
    if (sort === 'applicants') return [...r].sort((a, b) => a.applicants - b.applicants);
    return r;
  }, [q, loc, sort, salaryK, fLevel, fPosted, fType, fMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const rangeStart = filtered.length ? (safePage - 1) * PER_PAGE + 1 : 0;
  const rangeEnd = Math.min(safePage * PER_PAGE, filtered.length);
  const pageList = (): (number | '…')[] => {
    const tp = totalPages, p = safePage, out: (number | '…')[] = [];
    if (tp <= 7) { for (let i = 1; i <= tp; i++) out.push(i); return out; }
    out.push(1); if (p > 3) out.push('…');
    for (let i = Math.max(2, p - 1); i <= Math.min(tp - 1, p + 1); i++) out.push(i);
    if (p < tp - 2) out.push('…'); out.push(tp); return out;
  };

  interface Chip { k: string; label: string; clear: () => void }
  const activeChips = (): Chip[] => {
    const out: Chip[] = [];
    if (salaryK > 40) out.push({ k: 'sal', label: '$' + salaryK + 'K+', clear: () => { setSalaryK(40); setPage(1); } });
    if (fLevel && fLevel !== 'Any level') out.push({ k: 'lvl', label: fLevel, clear: () => { setFLevel(''); setPage(1); } });
    fType.forEach((id) => { const t = TYPES.find((x) => x.id === id); if (t) out.push({ k: 't' + id, label: t.label, clear: () => { setFType((s) => s.filter((x) => x !== id)); setPage(1); } }); });
    fMode.forEach((id) => { const m = MODES.find((x) => x.id === id); if (m) out.push({ k: 'm' + id, label: m.label, clear: () => { setFMode((s) => s.filter((x) => x !== id)); setPage(1); } }); });
    if (fPosted) out.push({ k: 'pp', label: '≤ ' + fPosted + 'd', clear: () => { setFPosted(''); setPage(1); } });
    return out;
  };

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) => { set((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); setPage(1); };
  const apply = (j: Row) => { setToast(j.title + ' · ' + j.company); window.clearTimeout(tRef.current); tRef.current = window.setTimeout(() => setToast(''), 2600); };

  return (
    <>
      <style>{`@media (max-width: 1024px){ .ax-jobs-split{ grid-template-columns:1fr !important; } .ax-jobs-split > aside{ position:static !important; } }`}</style>
      <PageHead
        title="Search Jobs"
        subtitle={(<><span className="ax-num">1,284</span> open roles across <span className="ax-num">312</span> companies — updated <span className="ax-num">14m</span> ago.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">{ICON(['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Saved jobs</span></button>
            <button type="button" className="ax-btn ax-btn--primary">{ICON(['M10 5a5 5 0 1 0 0 10a5 5 0 0 0 0 -10', 'M21 21l-6 -6', 'M5 10h10'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Create job alert</span></button>
          </>
        }
      />

      {/* SEARCH BAR */}
      <section className="ax-card" role="search" aria-label="Job search" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr auto', gap: 'var(--ax-space-3)', alignItems: 'end' }}>
          <div className="ax-field" style={{ margin: 0 }}>
            <label className="ax-label" htmlFor="sj-keyword">Job title, skill or company</label>
            <div style={{ position: 'relative' }}>
              {ICON(['M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2', 'M12 12l0 .01', 'M3 13a20 20 0 0 0 18 0'], { style: { position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' } })}
              <input id="sj-keyword" type="search" className="ax-input" placeholder="e.g. Senior Frontend Engineer, React, Figma…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 38 }} aria-label="Search keyword" />
            </div>
          </div>
          <div className="ax-field" style={{ margin: 0 }}>
            <label className="ax-label" htmlFor="sj-loc">Location</label>
            <div style={{ position: 'relative' }}>
              {ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { style: { position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' } })}
              <input id="sj-loc" type="text" className="ax-input" placeholder="City, country or Remote" value={loc} onChange={(e) => { setLoc(e.target.value); setPage(1); }} style={{ paddingInlineStart: 38 }} aria-label="Location" />
            </div>
          </div>
          <button type="button" className="ax-btn ax-btn--primary" style={{ height: 42 }} onClick={() => setPage(1)}>{ICON(['M10 5a5 5 0 1 0 0 10a5 5 0 0 0 0 -10', 'M21 21l-6 -6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Search</span></button>
        </div>
      </section>

      {/* FILTERS RAIL + RESULTS */}
      <div className="ax-jobs-split" style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 'var(--ax-space-6)', alignItems: 'start' }}>
        {/* FILTERS SIDEBAR */}
        <aside className="ax-card" role="region" aria-label="Filters" style={{ position: 'sticky', top: 'var(--ax-space-4)' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Filters</h2></div>
            <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={reset}>Reset</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Employment type</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {TYPES.map((t) => (
                  <label key={t.id} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}><input type="checkbox" className="ax-checkbox" value={t.id} checked={fType.includes(t.id)} onChange={() => toggle(setFType, t.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{t.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{t.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Work mode</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {MODES.map((m) => (
                  <label key={m.id} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}><input type="checkbox" className="ax-checkbox" value={m.id} checked={fMode.includes(m.id)} onChange={() => toggle(setFMode, m.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{m.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{m.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <legend className="ax-label" style={{ padding: 0, margin: 0 }}>Min. salary</legend>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-accent)' }}>$<span>{salaryK}</span>K</b>
              </div>
              <input type="range" className="ax-range ax-range--native" min={40} max={240} step={10} value={salaryK} onChange={(e) => { setSalaryK(Number(e.target.value)); setPage(1); }} aria-label="Minimum salary in thousands" style={{ width: '100%' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>$40K</small>
                <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>$240K+</small>
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Experience level</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {LEVELS.map((lv) => (
                  <label key={lv} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto', cursor: 'pointer' }}>
                    <input type="radio" name="sj-level" className="ax-radio" value={lv} checked={fLevel === lv} onChange={() => { setFLevel(lv); setPage(1); }} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{lv}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <div className="ax-field" style={{ margin: 0 }}>
              <label className="ax-label" htmlFor="sj-posted">Posted within</label>
              <select id="sj-posted" className="ax-select ax-select--sm" value={fPosted} onChange={(e) => { setFPosted(e.target.value); setPage(1); }}>
                <option value="">Any time</option><option value="1">Last 24 hours</option><option value="3">Last 3 days</option><option value="7">Last week</option><option value="30">Last month</option>
              </select>
            </div>
          </div>
        </aside>

        {/* RESULTS COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <section className="ax-card" role="region" aria-label="Results toolbar">
            <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap', paddingBlock: 'var(--ax-space-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{filtered.length}</b> jobs match
                {activeChips().length > 0 && ' ·'}
                {activeChips().map((c) => (
                  <span key={c.k} className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill ax-badge--sm" style={{ marginInlineStart: 6 }}>
                    <span>{c.label}</span>
                    <button type="button" onClick={c.clear} aria-label="Remove filter" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex', padding: 0, marginInlineStart: 4 }}><svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                  </span>
                ))}
              </p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Sort
                  <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort jobs" style={{ minWidth: 150 }}>
                    <option value="relevance">Most relevant</option><option value="recent">Newest first</option><option value="salary">Highest salary</option><option value="applicants">Fewest applicants</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          {paged.map((j) => (
            <article key={j.id} className="ax-card ax-card--interactive" role="region" aria-label={j.title + ' at ' + j.company}>
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${j.c} 18%,transparent)`, color: j.c, fontWeight: 700, flex: '0 0 auto' }}><b style={{ fontSize: 'var(--ax-text-md)' }}>{j.mark}</b></span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <Link href="/jobs/job-details" className="ax-text-truncate" style={{ display: 'block', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{j.title}</Link>
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 2 }}>
                          <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>{j.company}</span>
                          {j.verified && <span style={{ color: 'var(--ax-viz-cyan)', display: 'inline-flex' }} title="Verified employer">{ICON(['M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3', 'M9 12l2 2l4 -4'], { width: 15, height: 15 })}</span>}
                        </div>
                      </div>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSaved((s) => ({ ...s, [j.id]: !s[j.id] }))} aria-pressed={saved[j.id]} aria-label={saved[j.id] ? 'Remove from saved' : 'Save job'} style={saved[j.id] ? { color: 'var(--ax-accent)' } : undefined}>
                        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={saved[j.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg>
                      </button>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-3)', rowGap: 'var(--ax-space-2)' }}>
                      <span className="ax-cluster" style={{ gap: 6, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { width: 15, height: 15 })}<span>{j.location}</span></span>
                      <span className="ax-cluster" style={{ gap: 6, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{ICON(['M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2'], { width: 15, height: 15 })}<span>{j.typeLabel}</span></span>
                      <span className="ax-cluster ax-num" style={{ gap: 6, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>{ICON(['M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2', 'M12 3v3m0 12v3'], { width: 15, height: 15 })}<span>{j.salary}</span></span>
                    </div>
                    <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>{j.summary}</p>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-4)' }}>
                      {j.skills.map((s) => <span key={s} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{s}</span>)}
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'space-between', marginTop: 'var(--ax-space-4)', paddingTop: 'var(--ax-space-4)', borderTop: '1px solid var(--ax-border)', flexWrap: 'wrap' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                        <span className="ax-cluster ax-num" style={{ gap: 6, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{ICON(['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 7v5l3 3'], { width: 14, height: 14 })}<span>{j.posted}</span></span>
                        <span className="ax-cluster ax-num" style={{ gap: 6, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{ICON(['M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1', 'M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M17 10h2a2 2 0 0 1 2 2v1', 'M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0', 'M3 13v-1a2 2 0 0 1 2 -2h2'], { width: 14, height: 14 })}<span>{j.applicants + ' applicants'}</span></span>
                        {j.urgent && <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill ax-badge--sm"><span className="ax-badge__dot" />Urgent</span>}
                      </div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <Link href="/jobs/job-details" className="ax-btn ax-btn--secondary ax-btn--sm">View</Link>
                        <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={() => apply(j)}>Apply now</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {!filtered.length && (
            <div className="ax-card">
              <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9" /><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No jobs found</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try widening your filters or broadening the search location.</p>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={reset}>Clear all filters</button>
              </div>
            </div>
          )}

          {!!filtered.length && (
            <div className="ax-card">
              <div className="ax-card__body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)', paddingBlock: 'var(--ax-space-4)' }}>
                <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{rangeStart}</span>–<span>{rangeEnd}</span> of <span>{filtered.length}</span></span>
                <nav className="ax-pagination" aria-label="Pagination">
                  <button type="button" className="ax-pagination__prev" disabled={safePage === 1} aria-disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))} aria-label="Previous page">{ICON(['M15 6l-6 6l6 6'])}</button>
                  <ul className="ax-pagination__pages">
                    {pageList().map((p, i) => <li key={i}>{p === '…' ? <span className="ax-pagination__ellipsis">…</span> : <button type="button" className={`ax-pagination__page${safePage === p ? ' is-active' : ''}`} aria-current={safePage === p ? 'page' : undefined} onClick={() => setPage(p)}>{p}</button>}</li>)}
                  </ul>
                  <button type="button" className="ax-pagination__next" disabled={safePage === totalPages} aria-disabled={safePage === totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))} aria-label="Next page">{ICON(['M9 6l6 6l-6 6'])}</button>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', insetBlockEnd: 'var(--ax-space-6)', insetInlineEnd: 'var(--ax-space-6)', zIndex: 60 }}>
          <div className="ax-card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', boxShadow: 'var(--ax-shadow-md)' }}>
            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M5 12l5 5l10 -10" /></svg></span>
            <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Application started</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{toast}</div></div>
          </div>
        </div>
      )}
    </>
  );
}

export default SearchJobs;
