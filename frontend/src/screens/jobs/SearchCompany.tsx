'use client';
/*
 * Vireo Next.js — Jobs / Search Companies (route "jobs/search-company").
 *
 * Faithful re-expression of src/html/jobs/search-company.html: a keyword/HQ
 * search bar over a sticky filter rail (industry, company size, min open-roles
 * slider, min rating radios, remote-first switch) and grid/list views of
 * company-result cards with follow toggles, active filter chips, an empty
 * state and pagination. The Alpine axSearchCompany() state is ported to React.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };
const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);
const GLOBE = ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'];
const VERIFIED = ['M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3', 'M9 12l2 2l4 -4'];

interface Industry { id: string; label: string; count: number }
interface Size { id: string; label: string; count: number }
interface Co {
  id: string; name: string; mark: string; c: string; verified: boolean; domain: string; industry: string;
  size: number; sizeLabel: string; sizeBand: string; hq: string; remote: boolean; rating: number;
  openings: number; following: boolean; tagline: string;
}

const INDUSTRIES: Industry[] = [
  { id: 'SaaS', label: 'SaaS', count: 74 },
  { id: 'Fintech', label: 'Fintech', count: 58 },
  { id: 'E-commerce', label: 'E-commerce', count: 46 },
  { id: 'Healthcare', label: 'Healthcare', count: 39 },
  { id: 'Manufacturing', label: 'Manufacturing', count: 31 },
  { id: 'Agency', label: 'Agency', count: 28 },
];
const SIZES: Size[] = [
  { id: 'startup', label: '1–50', count: 96 },
  { id: 'mid', label: '51–250', count: 118 },
  { id: 'large', label: '251–1,000', count: 64 },
  { id: 'enterprise', label: '1,000+', count: 34 },
];
const ROWS: Co[] = [
  { id: 'co01', name: 'Northwind Labs', mark: 'NW', c: C.cyan, verified: true, domain: 'northwind.io', industry: 'SaaS', size: 240, sizeLabel: '240', sizeBand: 'mid', hq: 'Berlin, DE', remote: true, rating: 4.7, openings: 18, following: true, tagline: 'Analytics platform helping product teams ship with confidence. Backed by a strong design-system culture and a remote-first team across the EU.' },
  { id: 'co02', name: 'Brightline Capital', mark: 'BC', c: C.amber, verified: true, domain: 'brightline.co', industry: 'Fintech', size: 118, sizeLabel: '118', sizeBand: 'mid', hq: 'New York, US', remote: false, rating: 4.4, openings: 9, following: false, tagline: 'Mid-market lending infrastructure with a sharp go-to-market team. Hiring across sales, risk, and platform engineering this quarter.' },
  { id: 'co03', name: 'Crate & Co', mark: 'CC', c: C.violet, verified: false, domain: 'crateco.com', industry: 'E-commerce', size: 64, sizeLabel: '64', sizeBand: 'mid', hq: 'Amsterdam, NL', remote: false, rating: 4.2, openings: 5, following: false, tagline: 'Modern homewares brand with a beloved checkout experience. Small, design-led team that ships fast and obsesses over the unboxing moment.' },
  { id: 'co04', name: 'Meridian Health', mark: 'MH', c: C.pink, verified: true, domain: 'meridianhealth.org', industry: 'Healthcare', size: 512, sizeLabel: '512', sizeBand: 'large', hq: 'Remote · US', remote: true, rating: 4.6, openings: 24, following: true, tagline: 'Clinical-risk prediction at scale. Mission-driven org pairing rigorous data science with a genuinely supportive engineering culture.' },
  { id: 'co05', name: 'Loop Robotics', mark: 'LR', c: C.emerald, verified: true, domain: 'looprobotics.com', industry: 'Manufacturing', size: 340, sizeLabel: '340', sizeBand: 'large', hq: 'Tokyo, JP', remote: false, rating: 4.5, openings: 12, following: false, tagline: 'Warehouse automation hardware + software. Tight-knit robotics team solving gnarly real-world problems with elegant control systems.' },
  { id: 'co06', name: 'Studioform', mark: 'SF', c: C.violet, verified: false, domain: 'studioform.de', industry: 'Agency', size: 28, sizeLabel: '28', sizeBand: 'startup', hq: 'Munich, DE', remote: true, rating: 4.8, openings: 4, following: false, tagline: 'Boutique product design studio for ambitious B2B founders. Senior team, no juniors, every project shipped is portfolio-grade.' },
  { id: 'co07', name: 'Clearbox', mark: 'CB', c: C.cyan, verified: true, domain: 'clearbox.app', industry: 'SaaS', size: 92, sizeLabel: '92', sizeBand: 'mid', hq: 'Remote · EU', remote: true, rating: 4.6, openings: 16, following: false, tagline: 'Event-driven automation engine for ops teams. Engineering-first culture with thoughtful APIs and an unusually low meeting load.' },
  { id: 'co08', name: 'Ridgeline Energy', mark: 'RE', c: C.pink, verified: true, domain: 'ridgeline.energy', industry: 'Manufacturing', size: 780, sizeLabel: '780', sizeBand: 'large', hq: 'Austin, US', remote: false, rating: 4.3, openings: 31, following: false, tagline: 'Grid-optimisation software for renewable operators. Scaling fast — building out product, platform, and data teams across three offices.' },
  { id: 'co09', name: 'Pulse Media', mark: 'PM', c: C.amber, verified: false, domain: 'pulse.media', industry: 'Agency', size: 46, sizeLabel: '46', sizeBand: 'startup', hq: 'London, UK', remote: true, rating: 4.1, openings: 3, following: false, tagline: 'Performance marketing collective for DTC brands. Lean, senior, and data-obsessed with a transparent, async-first way of working.' },
  { id: 'co10', name: 'Harbor Freight Co', mark: 'HF', c: C.emerald, verified: true, domain: 'harborfreight.co', industry: 'E-commerce', size: 156, sizeLabel: '156', sizeBand: 'mid', hq: 'Remote · UK', remote: true, rating: 4.4, openings: 8, following: false, tagline: 'B2B marketplace for industrial supplies. Profitable, calm, and quietly excellent — a place engineers tend to stay for years.' },
  { id: 'co11', name: 'Postoak Insurance', mark: 'PI', c: C.violet, verified: true, domain: 'postoak.com', industry: 'Fintech', size: 430, sizeLabel: '430', sizeBand: 'large', hq: 'Chicago, US', remote: false, rating: 4.0, openings: 14, following: false, tagline: 'Digital-first commercial insurance. Modernising a century-old industry with clean software and a refreshingly human claims experience.' },
  { id: 'co12', name: 'Meadow Foods', mark: 'MF', c: C.cyan, verified: false, domain: 'meadowfoods.co', industry: 'E-commerce', size: 210, sizeLabel: '210', sizeBand: 'mid', hq: 'Dublin, IE', remote: false, rating: 4.2, openings: 6, following: false, tagline: 'Sustainable grocery brand with a loyal subscriber base. Values-led team scaling supply chain, growth, and a small but mighty product crew.' },
];
const PER_PAGE = 6;

export function SearchCompany() {
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const [sort, setSort] = useState('openings');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [minOpen, setMinOpen] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [fIndustry, setFIndustry] = useState<string[]>([]);
  const [fSize, setFSize] = useState<string[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>(() => Object.fromEntries(ROWS.map((r) => [r.id, r.following])));

  const reset = () => { setQ(''); setLoc(''); setMinOpen(0); setMinRating(0); setRemoteOnly(false); setFIndustry([]); setFSize([]); setSort('openings'); setPage(1); };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase(), l = loc.trim().toLowerCase();
    let r = ROWS.filter((x) => {
      if (t && !(x.name.toLowerCase().includes(t) || x.industry.toLowerCase().includes(t) || x.tagline.toLowerCase().includes(t) || x.domain.toLowerCase().includes(t))) return false;
      if (l && !x.hq.toLowerCase().includes(l)) return false;
      if (fIndustry.length && !fIndustry.includes(x.industry)) return false;
      if (fSize.length && !fSize.includes(x.sizeBand)) return false;
      if (minOpen > 0 && x.openings < minOpen) return false;
      if (minRating > 0 && x.rating < minRating) return false;
      if (remoteOnly && !x.remote) return false;
      return true;
    });
    if (sort === 'rating') return [...r].sort((a, b) => b.rating - a.rating);
    if (sort === 'size') return [...r].sort((a, b) => b.size - a.size);
    if (sort === 'name') return [...r].sort((a, b) => a.name.localeCompare(b.name));
    return [...r].sort((a, b) => b.openings - a.openings);
  }, [q, loc, sort, minOpen, minRating, remoteOnly, fIndustry, fSize]);

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
    if (minOpen > 0) out.push({ k: 'op', label: minOpen + '+ roles', clear: () => { setMinOpen(0); setPage(1); } });
    if (minRating > 0) out.push({ k: 'rt', label: minRating.toFixed(1) + '★ & up', clear: () => { setMinRating(0); setPage(1); } });
    if (remoteOnly) out.push({ k: 'rm', label: 'Remote-first', clear: () => { setRemoteOnly(false); setPage(1); } });
    fIndustry.forEach((id) => out.push({ k: 'i' + id, label: id, clear: () => { setFIndustry((s) => s.filter((x) => x !== id)); setPage(1); } }));
    fSize.forEach((id) => { const s = SIZES.find((x) => x.id === id); if (s) out.push({ k: 'z' + id, label: s.label, clear: () => { setFSize((v) => v.filter((x) => x !== id)); setPage(1); } }); });
    return out;
  };

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) => { set((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); setPage(1); };

  return (
    <>
      <style>{`@media (max-width: 1024px){ .ax-jobs-split{ grid-template-columns:1fr !important; } .ax-jobs-split > aside{ position:static !important; } }`}</style>
      <PageHead
        title="Search Companies"
        subtitle={(<><span className="ax-num">312</span> companies hiring now — <span className="ax-num">1,284</span> open roles across <span className="ax-num">38</span> industries.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">{ICON(['M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Followed (12)</span></button>
            <button type="button" className="ax-btn ax-btn--primary">{ICON(['M10 5a5 5 0 1 0 0 10a5 5 0 0 0 0 -10', 'M21 21l-6 -6', 'M5 10h10'], { className: 'ax-btn__icon' })}<span className="ax-btn__label">Create alert</span></button>
          </>
        }
      />

      {/* SEARCH BAR */}
      <section className="ax-card" role="search" aria-label="Company search" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr auto', gap: 'var(--ax-space-3)', alignItems: 'end' }}>
          <div className="ax-field" style={{ margin: 0 }}>
            <label className="ax-label" htmlFor="sco-keyword">Company or keyword</label>
            <div style={{ position: 'relative' }}>
              {ICON(['M3 21l18 0', 'M5 21v-14l8 -4v18', 'M19 21v-10l-6 -4', 'M9 9l0 .01', 'M9 12l0 .01', 'M9 15l0 .01', 'M9 18l0 .01'], { style: { position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' } })}
              <input id="sco-keyword" type="search" className="ax-input" placeholder="e.g. Northwind Labs, fintech, design…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 38 }} aria-label="Search companies" />
            </div>
          </div>
          <div className="ax-field" style={{ margin: 0 }}>
            <label className="ax-label" htmlFor="sco-loc">Headquarters</label>
            <div style={{ position: 'relative' }}>
              {ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { style: { position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' } })}
              <input id="sco-loc" type="text" className="ax-input" placeholder="City, country or Remote-first" value={loc} onChange={(e) => { setLoc(e.target.value); setPage(1); }} style={{ paddingInlineStart: 38 }} aria-label="Headquarters location" />
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
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Industry</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {INDUSTRIES.map((ind) => (
                  <label key={ind.id} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}><input type="checkbox" className="ax-checkbox" value={ind.id} checked={fIndustry.includes(ind.id)} onChange={() => toggle(setFIndustry, ind.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{ind.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{ind.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Company size</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {SIZES.map((s) => (
                  <label key={s.id} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}><input type="checkbox" className="ax-checkbox" value={s.id} checked={fSize.includes(s.id)} onChange={() => toggle(setFSize, s.id)} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{s.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <legend className="ax-label" style={{ padding: 0, margin: 0 }}>Min. open roles</legend>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-accent)' }}><span>{minOpen}</span>+</b>
              </div>
              <input type="range" className="ax-range ax-range--native" min={0} max={40} step={2} value={minOpen} onChange={(e) => { setMinOpen(Number(e.target.value)); setPage(1); }} aria-label="Minimum number of open roles" style={{ width: '100%' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>0</small>
                <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>40+</small>
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="ax-label" style={{ marginBottom: 'var(--ax-space-3)', padding: 0 }}>Min. rating</legend>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {[0, 3, 3.5, 4, 4.5].map((r) => (
                  <label key={r} className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto', cursor: 'pointer' }}>
                    <input type="radio" name="sco-rating" className="ax-radio" value={r} checked={minRating === r} onChange={() => { setMinRating(r); setPage(1); }} /><span className="ax-num" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{r === 0 ? 'Any rating' : r.toFixed(1) + '★ & up'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', justifyContent: 'space-between', minHeight: 'auto', cursor: 'pointer' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Remote-first only</span>
              <input type="checkbox" role="switch" className="ax-switch ax-switch--sm" checked={remoteOnly} onChange={(e) => { setRemoteOnly(e.target.checked); setPage(1); }} aria-label="Remote-first only" />
            </label>
          </div>
        </aside>

        {/* RESULTS COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <section className="ax-card" role="region" aria-label="Results toolbar">
            <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap', paddingBlock: 'var(--ax-space-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{filtered.length}</b> companies match
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
                  <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort companies" style={{ minWidth: 150 }}>
                    <option value="openings">Most open roles</option><option value="rating">Top rated</option><option value="size">Largest</option><option value="name">Name A–Z</option>
                  </select>
                </label>
                <div className="ax-segment" role="group" aria-label="View mode">
                  <button type="button" className={`ax-segment__option ax-btn--icon${view === 'grid' ? ' is-active' : ''}`} aria-checked={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view">{ICON(['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M14 14h6v6h-6z'], { width: 16, height: 16 })}</button>
                  <button type="button" className={`ax-segment__option ax-btn--icon${view === 'list' ? ' is-active' : ''}`} aria-checked={view === 'list'} onClick={() => setView('list')} aria-label="List view">{ICON(['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'], { width: 16, height: 16 })}</button>
                </div>
              </div>
            </div>
          </section>

          {/* GRID VIEW */}
          {view === 'grid' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 'var(--ax-space-5)' }}>
              {paged.map((co) => (
                <article key={co.id} className="ax-card ax-card--interactive" style={{ margin: 0 }} role="region" aria-label={co.name}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', minWidth: 0 }}>
                        <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${co.c} 18%,transparent)`, color: co.c, fontWeight: 700, flex: '0 0 auto' }}><b style={{ fontSize: 'var(--ax-text-md)' }}>{co.mark}</b></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ax-cluster" style={{ gap: 6 }}>
                            <a href="#" className="ax-text-truncate" style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{co.name}</a>
                            {co.verified && <span style={{ color: 'var(--ax-viz-cyan)', display: 'inline-flex' }} title="Verified">{ICON(VERIFIED, { width: 14, height: 14 })}</span>}
                          </div>
                          <div className="ax-num ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }}>{co.domain}</div>
                        </div>
                      </div>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setFollowing((s) => ({ ...s, [co.id]: !s[co.id] }))} aria-pressed={following[co.id]} aria-label={following[co.id] ? 'Unfollow' : 'Follow'} style={following[co.id] ? { color: 'var(--ax-accent)' } : undefined}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill={following[co.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg></button>
                    </div>
                    <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>{co.tagline}</p>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{co.industry}</span>
                      <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{co.sizeLabel + ' staff'}</span>
                      {co.remote && <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">Remote-first</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--ax-space-3)', paddingTop: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}>
                      <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Open</small><b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-md)' }}>{co.openings}</b></div>
                      <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Rating</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}><span>{co.rating.toFixed(1)}</span><span style={{ color: 'var(--ax-viz-amber)', fontSize: 'var(--ax-text-sm)' }}> ★</span></b></div>
                      <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>HQ</small><b className="ax-text-truncate" style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-semibold)' }}>{co.hq}</b></div>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <Link href="/jobs/search-jobs" className="ax-btn ax-btn--primary ax-btn--sm" style={{ flex: '1 1 auto' }}>View <span>{co.openings}</span> roles</Link>
                      <a href="#" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" aria-label="Company website">{ICON(GLOBE, { className: 'ax-btn__icon' })}</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              {paged.map((co) => (
                <article key={co.id} className="ax-card ax-card--interactive" role="region" aria-label={co.name}>
                  <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
                    <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${co.c} 18%,transparent)`, color: co.c, fontWeight: 700, flex: '0 0 auto' }}><b style={{ fontSize: 'var(--ax-text-md)' }}>{co.mark}</b></span>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <div className="ax-cluster" style={{ gap: 6 }}>
                        <a href="#" className="ax-text-truncate" style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{co.name}</a>
                        {co.verified && <span style={{ color: 'var(--ax-viz-cyan)', display: 'inline-flex' }} title="Verified">{ICON(VERIFIED, { width: 14, height: 14 })}</span>}
                      </div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 2 }}>
                        <span className="ax-cluster" style={{ gap: 5, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{ICON(['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0'], { width: 13, height: 13 })}<span>{co.hq}</span></span>
                        <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{co.industry}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 64 }}><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Staff</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{co.sizeLabel}</b></div>
                    <div style={{ textAlign: 'center', minWidth: 64 }}><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Rating</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}><span>{co.rating.toFixed(1)}</span><span style={{ color: 'var(--ax-viz-amber)' }}> ★</span></b></div>
                    <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill"><span className="ax-num">{co.openings}</span>&nbsp;open</span>
                    <Link href="/jobs/search-jobs" className="ax-btn ax-btn--secondary ax-btn--sm">View roles</Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!filtered.length && (
            <div className="ax-card">
              <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No companies found</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try a different industry or lower the minimum open-roles threshold.</p>
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
    </>
  );
}

export default SearchCompany;
