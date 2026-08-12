'use client';
/*
 * Vireo Next.js — Jobs / Search Candidates (route "jobs/search-candidate").
 *
 * Faithful re-expression of src/html/jobs/search-candidate.html: a role/skill
 * search bar over a sticky filter rail (top skills, availability, min
 * experience + min match sliders, work-mode select, open-to-work switch) and a
 * sorted, paginated list of candidate cards with a match meter, star rating,
 * shortlist toast and an empty state. The Alpine axSearchCandidate() state is
 * ported to React.
 */
import { useMemo, useState, useRef, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };
const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);

interface Facet { id: string; label: string; count: number }
interface Person {
  id: string; name: string; title: string; initials: string; c: string; presence: string; location: string;
  mode: string; exp: number; match: number; rating: number; openToWork: boolean; avail: string;
  active: string; activeDays: number; skills: string[]; bio: string;
}

const SKILL_FACETS: Facet[] = [
  { id: 'react', label: 'React', count: 1284 },
  { id: 'figma', label: 'Figma', count: 962 },
  { id: 'python', label: 'Python', count: 874 },
  { id: 'typescript', label: 'TypeScript', count: 1042 },
  { id: 'kubernetes', label: 'Kubernetes', count: 413 },
  { id: 'sql', label: 'SQL', count: 1158 },
];
const AVAIL_FACETS: Facet[] = [
  { id: 'immediate', label: 'Immediately', count: 486 },
  { id: '2weeks', label: 'Within 2 weeks', count: 712 },
  { id: '1month', label: 'Within a month', count: 534 },
  { id: 'passive', label: 'Passive / open', count: 1290 },
];
const ROWS: Person[] = [
  { id: 'p01', name: 'Elena Mwangi', title: 'Senior Frontend Engineer', initials: 'EM', c: C.cyan, presence: 'online', location: 'Nairobi, KE · Remote', mode: 'remote', exp: 8, match: 94, rating: 4.9, openToWork: true, avail: 'immediate', active: '2h ago', activeDays: 0, skills: ['React', 'TypeScript', 'Design Systems', 'GraphQL'], bio: 'Builds accessible design-system layers for analytics products. Led the React migration for a 40-person engineering org and mentors front-end guild members.' },
  { id: 'p02', name: 'Rohan Chatterjee', title: 'Product Designer', initials: 'RC', c: C.violet, presence: 'away', location: 'Bengaluru, IN · Hybrid', mode: 'hybrid', exp: 6, match: 91, rating: 4.8, openToWork: true, avail: '2weeks', active: '1d ago', activeDays: 1, skills: ['Figma', 'Prototyping', 'UX Research', 'Design Ops'], bio: 'End-to-end product designer for B2B SaaS. Strong systems thinker who pairs research insight with crisp, shippable interfaces and a tidy Figma library.' },
  { id: 'p03', name: 'Sofia Delgado', title: 'Account Executive', initials: 'SD', c: C.pink, presence: 'offline', location: 'Madrid, ES · On-site', mode: 'onsite', exp: 5, match: 82, rating: 4.6, openToWork: false, avail: '1month', active: '3d ago', activeDays: 3, skills: ['SaaS Sales', 'Salesforce', 'Negotiation'], bio: 'Full-cycle AE with a track record of 120%+ quota attainment across mid-market fintech. Calm closer who builds genuine champion relationships.' },
  { id: 'p04', name: 'Theo Nakamura', title: 'DevOps Engineer', initials: 'TN', c: C.amber, presence: 'online', location: 'Remote · Global', mode: 'remote', exp: 9, match: 88, rating: 4.7, openToWork: true, avail: 'immediate', active: '5h ago', activeDays: 0, skills: ['Kubernetes', 'Terraform', 'AWS', 'Go'], bio: 'Keeps multi-region Kubernetes estates calm and cheap. Pragmatic about automation, allergic to snowflake infra, and a steady hand during incidents.' },
  { id: 'p05', name: 'Amara Boateng', title: 'Marketing Manager', initials: 'AB', c: C.emerald, presence: 'offline', location: 'Accra, GH · Hybrid', mode: 'hybrid', exp: 7, match: 76, rating: 4.5, openToWork: false, avail: 'passive', active: '1w ago', activeDays: 7, skills: ['Growth', 'SEO', 'Lifecycle', 'Analytics'], bio: 'Demand-gen lead fluent in attribution and lifecycle. Took a Series-A startup from 0 to a repeatable paid + content engine in eighteen months.' },
  { id: 'p06', name: 'Liam Hartley', title: 'Data Analyst', initials: 'LH', c: C.cyan, presence: 'away', location: 'Manchester, UK · Remote', mode: 'remote', exp: 4, match: 79, rating: 4.4, openToWork: true, avail: '2weeks', active: '2d ago', activeDays: 2, skills: ['SQL', 'Python', 'dbt', 'Looker'], bio: 'Turns messy product data into decisions. Owns the analytics warehouse, writes clean dbt models, and ships dashboards people actually open.' },
  { id: 'p07', name: 'Priya Nair', title: 'Staff Data Scientist', initials: 'PN', c: C.pink, presence: 'online', location: 'Remote · US', mode: 'remote', exp: 11, match: 96, rating: 5.0, openToWork: true, avail: '1month', active: '4h ago', activeDays: 0, skills: ['Python', 'ML', 'Causal Inference', 'SQL'], bio: 'Leads modelling for clinical-risk prediction. Mentors a small team, owns rigorous experiment design, and ships models that hold up in production.' },
  { id: 'p08', name: 'Marcus Whitfield', title: 'Engineering Manager', initials: 'MW', c: C.violet, presence: 'offline', location: 'Austin, US · Hybrid', mode: 'hybrid', exp: 12, match: 84, rating: 4.7, openToWork: false, avail: 'passive', active: '5d ago', activeDays: 5, skills: ['Leadership', 'Architecture', 'Hiring'], bio: 'People-first EM who still loves an architecture whiteboard. Grew two squads from four to eleven while keeping retention above 95%.' },
  { id: 'p09', name: 'Camila Rossi', title: 'Backend Engineer (Go)', initials: 'CR', c: C.amber, presence: 'online', location: 'São Paulo, BR · Remote', mode: 'remote', exp: 6, match: 89, rating: 4.8, openToWork: true, avail: 'immediate', active: '1h ago', activeDays: 0, skills: ['Go', 'PostgreSQL', 'gRPC', 'Kafka'], bio: 'Builds event-driven backends with clean APIs and thoughtful tests. Genuinely enjoys distributed-systems puzzles and pairing junior engineers up.' },
  { id: 'p10', name: 'Nadia Haddad', title: 'UX Researcher', initials: 'NH', c: C.emerald, presence: 'away', location: 'Marseille, FR · On-site', mode: 'onsite', exp: 5, match: 73, rating: 4.5, openToWork: false, avail: '1month', active: '4d ago', activeDays: 4, skills: ['Interviews', 'Synthesis', 'Surveys', 'Figma'], bio: 'Mixed-methods researcher who makes discovery legible to the whole team. Runs tight studies and turns transcripts into decisions, not decks.' },
];
const PER_PAGE = 6;
const matchColor = (m: number) => (m >= 90 ? C.emerald : m >= 80 ? C.cyan : m >= 70 ? C.amber : 'var(--ax-text-muted)');

export function SearchCandidate() {
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const [sort, setSort] = useState('match');
  const [page, setPage] = useState(1);
  const [minExp, setMinExp] = useState(0);
  const [minMatch, setMinMatch] = useState(0);
  const [fMode, setFMode] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [fSkills, setFSkills] = useState<string[]>([]);
  const [fAvail, setFAvail] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const tRef = useRef<number | undefined>(undefined);

  const reset = () => { setQ(''); setLoc(''); setMinExp(0); setMinMatch(0); setFMode(''); setOpenOnly(false); setFSkills([]); setFAvail([]); setSort('match'); setPage(1); };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase(), l = loc.trim().toLowerCase();
    let r = ROWS.filter((x) => {
      if (t && !(x.name.toLowerCase().includes(t) || x.title.toLowerCase().includes(t) || x.skills.join(' ').toLowerCase().includes(t))) return false;
      if (l && !x.location.toLowerCase().includes(l)) return false;
      if (fMode && x.mode !== fMode) return false;
      if (openOnly && !x.openToWork) return false;
      if (minExp > 0 && x.exp < minExp) return false;
      if (minMatch > 0 && x.match < minMatch) return false;
      if (fAvail.length && !fAvail.includes(x.avail)) return false;
      if (fSkills.length) { const sk = x.skills.map((s) => s.toLowerCase()); if (!fSkills.every((id) => sk.includes(id) || sk.some((s) => s.includes(id)))) return false; }
      return true;
    });
    if (sort === 'recent') return [...r].sort((a, b) => a.activeDays - b.activeDays);
    if (sort === 'experience') return [...r].sort((a, b) => b.exp - a.exp);
    if (sort === 'rating') return [...r].sort((a, b) => b.rating - a.rating);
    return [...r].sort((a, b) => b.match - a.match);
  }, [q, loc, sort, minExp, minMatch, fMode, openOnly, fSkills, fAvail]);

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
    if (minExp > 0) out.push({ k: 'exp', label: minExp + '+ yrs', clear: () => { setMinExp(0); setPage(1); } });
    if (minMatch > 0) out.push({ k: 'mm', label: '≥ ' + minMatch + '% match', clear: () => { setMinMatch(0); setPage(1); } });
    if (fMode) out.push({ k: 'mode', label: fMode.charAt(0).toUpperCase() + fMode.slice(1), clear: () => { setFMode(''); setPage(1); } });
    if (openOnly) out.push({ k: 'otw', label: 'Open to work', clear: () => { setOpenOnly(false); setPage(1); } });
    fSkills.forEach((id) => { const s = SKILL_FACETS.find((x) => x.id === id); if (s) out.push({ k: 's' + id, label: s.label, clear: () => { setFSkills((v) => v.filter((x) => x !== id)); setPage(1); } }); });
    fAvail.forEach((id) => { const a = AVAIL_FACETS.find((x) => x.id === id); if (a) out.push({ k: 'a' + id, label: a.label, clear: () => { setFAvail((v) => v.filter((x) => x !== id)); setPage(1); } }); });
    return out;
  };

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) => { set((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); setPage(1); };
  const shortlist = (p: Person) => { setToast(p.name + ' · ' + p.title); window.clearTimeout(tRef.current); tRef.current = window.setTimeout(() => setToast(''), 2600); };

  return (
    <>
      <style>{`@media (max-width: 1024px){ .ax-jobs-split{ grid-template-columns:1fr !important; } .ax-jobs-split > aside{ position:static !important; } } @media (max-width: 560px){ .ax-card--interactive .ax-cd-grid{ grid-template-columns:1fr !important; } }`}</style>
      <PageHead
        title="Search Candidates"
        subtitle={(<><span className="ax-num">8,420</span> profiles in your talent pool — <span className="ax-num">126</span> new this week, <span className="ax-num">38</span> shortlisted.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">{ICON(['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Shortlist (38)</span></button>
            <button type="button" className="ax-btn ax-btn--primary">{ICON(['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10', 'M3 7l9 6l9 -6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Bulk message</span></button>
          </>
        }
      />

      {/* SEARCH BAR */}
      <section className="ax-card" role="search" aria-label="Candidate search" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr auto', gap: 'var(--ax-space-3)', alignItems: 'end' }}>
          <div className="ax-field" style={{ margin: 0 }}>
            <label className="ax-label" htmlFor="sc-keyword">Role, skill or name</label>
            <div style={{ position: 'relative' }}>
              {ICON(['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'], { style: { position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' } })}
              <input id="sc-keyword" type="search" className="ax-input" placeholder="e.g. React, Product Designer, Maya…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 38 }} aria-label="Search candidates" />
            </div>
          </div>
          <div className="ax-field" style={{ margin: 0 }}>
            <label className="ax-label" htmlFor="sc-loc">Location</label>
            <div style={{ position: 'relative' }}>
              {ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { style: { position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' } })}
              <input id="sc-loc" type="text" className="ax-input" placeholder="City, country or Remote" value={loc} onChange={(e) => { setLoc(e.target.value); setPage(1); }} style={{ paddingInlineStart: 38 }} aria-label="Location" />
            </div>
          </div>
          <button type="button" className="ax-btn ax-btn--primary" style={{ height: 42 }} onClick={() => setPage(1)}>{ICON(['M10 5a5 5 0 1 0 0 10a5 5 0 0 0 0 -10', 'M21 21l-6 -6'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Search</span></button>
        </div>
      </section>

      <div className="ax-jobs-split" style={{ display: 'grid', gridTemplateColumns: '280px minmax(0,1fr)', gap: 'var(--ax-space-6)', alignItems: 'start' }}>
        {/* FILTERS SIDEBAR */}
        <aside className="ax-card" role="region" aria-label="Filters" style={{ position: 'sticky', top: 'var(--ax-space-4)' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Filters</h2></div>
            <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={reset}>Reset</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Top skills</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {SKILL_FACETS.map((s) => (
                  <label key={s.id} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}><input type="checkbox" className="ax-checkbox" value={s.id} checked={fSkills.includes(s.id)} onChange={() => toggle(setFSkills, s.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{s.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Availability</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {AVAIL_FACETS.map((a) => (
                  <label key={a.id} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}><input type="checkbox" className="ax-checkbox" value={a.id} checked={fAvail.includes(a.id)} onChange={() => toggle(setFAvail, a.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{a.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{a.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <legend className="ax-label" style={{ padding: 0, margin: 0 }}>Min. experience</legend>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-accent)' }}><span>{minExp}</span>+ yrs</b>
              </div>
              <input type="range" className="ax-range ax-range--native" min={0} max={15} step={1} value={minExp} onChange={(e) => { setMinExp(Number(e.target.value)); setPage(1); }} aria-label="Minimum years of experience" style={{ width: '100%' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>0</small>
                <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>15+</small>
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <legend className="ax-label" style={{ padding: 0, margin: 0 }}>Min. match score</legend>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-accent)' }}><span>{minMatch}</span>%</b>
              </div>
              <input type="range" className="ax-range ax-range--native" min={0} max={95} step={5} value={minMatch} onChange={(e) => { setMinMatch(Number(e.target.value)); setPage(1); }} aria-label="Minimum match score percent" style={{ width: '100%' }} />
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <div className="ax-field" style={{ margin: 0 }}>
              <label className="ax-label" htmlFor="sc-mode">Preferred work mode</label>
              <select id="sc-mode" className="ax-select ax-select--sm" value={fMode} onChange={(e) => { setFMode(e.target.value); setPage(1); }}>
                <option value="">Any mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
              </select>
            </div>
            <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Open to work only</span>
              <input type="checkbox" role="switch" className="ax-switch ax-switch--sm" checked={openOnly} onChange={(e) => { setOpenOnly(e.target.checked); setPage(1); }} aria-label="Open to work only" />
            </label>
          </div>
        </aside>

        {/* RESULTS COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <section className="ax-card" role="region" aria-label="Results toolbar">
            <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap', paddingBlock: 'var(--ax-space-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{filtered.length}</b> candidates match
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
                  <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort candidates" style={{ minWidth: 150 }}>
                    <option value="match">Best match</option><option value="recent">Recently active</option><option value="experience">Most experience</option><option value="rating">Top rated</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          {paged.map((p) => (
            <article key={p.id} className="ax-card ax-card--interactive" role="region" aria-label={p.name + ', ' + p.title}>
              <div className="ax-card__body ax-cd-grid" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--ax-space-5)', alignItems: 'start' }}>
                {/* left: identity + skills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', minWidth: 0 }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <span style={{ position: 'relative', flex: '0 0 auto' }}>
                      <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.c} 18%,transparent)`, color: p.c, fontWeight: 700 }}><b style={{ fontSize: 'var(--ax-text-md)' }}>{p.initials}</b></span>
                      <span className={`ax-avatar__status ax-avatar__status--${p.presence}`} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <Link href="/jobs/candidate-details" className="ax-text-truncate" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{p.name}</Link>
                        {p.openToWork && <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-badge--sm"><span className="ax-badge__dot" />Open</span>}
                      </div>
                      <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)', marginTop: 1 }}>{p.title}</div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-2)' }}>
                        <span className="ax-cluster" style={{ gap: 5, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { width: 14, height: 14 })}<span>{p.location}</span></span>
                        <span className="ax-cluster ax-num" style={{ gap: 5, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{ICON(['M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2l0 -9', 'M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2'], { width: 14, height: 14 })}<span>{p.exp + ' yrs exp'}</span></span>
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>{p.bio}</p>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                    {p.skills.map((s) => <span key={s} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{s}</span>)}
                  </div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', paddingTop: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}>
                    <div className="ax-rating ax-rating--sm" role="img" aria-label={p.rating + ' out of 5 rating'}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`ax-rating__star${n <= Math.round(p.rating) ? ' ax-rating__star--full' : ''}`}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span>
                      ))}
                      <span className="ax-rating__value ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{p.rating.toFixed(1)}</span>
                    </div>
                    <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{'Active ' + p.active}</span>
                  </div>
                </div>

                {/* right: match meter + actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--ax-space-4)', justifyContent: 'space-between', alignSelf: 'stretch', minWidth: 148 }}>
                  <div style={{ textAlign: 'end', width: '100%' }}>
                    <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, lineHeight: 1, color: matchColor(p.match) }}>{p.match + '%'}</div>
                    <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 2 }}>Match</small>
                    <div className="ax-progress ax-progress--sm" style={{ marginTop: 'var(--ax-space-2)' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${p.match}%`, background: matchColor(p.match) }} /></div></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', width: '100%' }}>
                    <button type="button" className="ax-btn ax-btn--primary ax-btn--sm ax-btn--block" onClick={() => shortlist(p)}>{ICON(['M12 5l0 14', 'M5 12l14 0'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Shortlist</span></button>
                    <Link href="/jobs/candidate-details" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--block">View profile</Link>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {!filtered.length && (
            <div className="ax-card">
              <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No candidates found</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Loosen the match threshold or remove a skill filter to widen the pool.</p>
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
            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-accent) 18%,transparent)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg></span>
            <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Added to shortlist</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{toast}</div></div>
          </div>
        </div>
      )}
    </>
  );
}

export default SearchCandidate;
