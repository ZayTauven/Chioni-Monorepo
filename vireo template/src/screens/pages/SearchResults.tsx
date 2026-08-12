'use client';
/*
 * Vireo Next.js — Pages / Search Results (route "pages/search-results").
 *
 * Faithful re-expression of src/html/pages/search-results.html: a faceted search
 * layout — type facets + date radios + tips rail, a scrollable result-category
 * tab strip, a linked result list with <mark> highlights, a no-results empty
 * state and pagination. The Alpine axSearchResults() state (query/draft/tab,
 * derived facets + visible results) is ported to React. DOM/classes/ARIA match
 * the reference 1:1.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { PageHead } from '../../components/shell/PageHead';

type RType = 'page' | 'person' | 'file' | 'project';

const TYPE_PATHS: Record<RType, ReactNode> = {
  page: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></>,
  person: <><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></>,
  file: <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /></>,
  project: <><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /></>,
};

function Glyph({ type }: { type: RType }) {
  return <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TYPE_PATHS[type]}</svg>;
}

const mark = (s: string) => s.replace(/(vireo)/gi, '<mark class="ax-mark">$1</mark>');

interface Result { id: number; type: RType; typeLabel: string; tint: string; title: string; snippet: string; path: string; when: string; }
const RESULTS: Result[] = [
  { id: 1, type: 'page', typeLabel: 'Page', tint: 'var(--ax-viz-cyan)', title: mark('Vireo — Sales dashboard'), snippet: mark('The flagship Vireo dashboard with revenue KPIs, area chart and recent transactions.'), path: 'Dashboards › Sales', when: '2h ago' },
  { id: 2, type: 'person', typeLabel: 'Person', tint: 'var(--ax-viz-violet)', title: 'Mara Lindqvist', snippet: mark('Staff engineer on the Vireo charts team · mara@vireo.io'), path: 'People › Engineering', when: 'Online' },
  { id: 3, type: 'file', typeLabel: 'File', tint: 'var(--ax-viz-pink)', title: mark('vireo-brand-guidelines.pdf'), snippet: mark('Aurora visual language — color tokens, typography and the Vireo notch mark.'), path: 'Files › Brand', when: 'Jun 24' },
  { id: 4, type: 'project', typeLabel: 'Project', tint: 'var(--ax-viz-emerald)', title: mark('Vireo 2.4 — Aurora migration'), snippet: mark('Migrate all specs to the Aurora glass language across the Vireo component kit.'), path: 'Projects › Active', when: 'Jun 22' },
  { id: 5, type: 'page', typeLabel: 'Page', tint: 'var(--ax-viz-cyan)', title: mark('Vireo pricing'), snippet: mark('Compare Starter, Pro and Business tiers for the Vireo platform.'), path: 'Pages › Pricing', when: 'Jun 19' },
  { id: 6, type: 'file', typeLabel: 'File', tint: 'var(--ax-viz-pink)', title: mark('vireo-changelog.md'), snippet: mark('Release notes for every Vireo version since 1.0.0.'), path: 'Files › Docs', when: 'Jun 18' },
  { id: 7, type: 'person', typeLabel: 'Person', tint: 'var(--ax-viz-violet)', title: 'Devon Okafor', snippet: mark('Product designer — owns the Vireo empty-state illustrations.'), path: 'People › Design', when: '2d ago' },
];

type FacetId = 'all' | RType;
interface Facet { id: FacetId; label: string; count: number; tint: string; icon: ReactNode; }

export function SearchResults() {
  const [query, setQuery] = useState('vireo');
  const [draft, setDraft] = useState('vireo');
  const [tab, setTab] = useState<FacetId>('all');

  const total = RESULTS.length;
  const facets: Facet[] = useMemo(() => {
    const c = (t: RType) => RESULTS.filter((r) => r.type === t).length;
    return [
      { id: 'all', label: 'All', count: RESULTS.length, tint: 'var(--ax-accent)', icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h12" /></svg> },
      { id: 'page', label: 'Pages', count: c('page'), tint: 'var(--ax-viz-cyan)', icon: <Glyph type="page" /> },
      { id: 'person', label: 'People', count: c('person'), tint: 'var(--ax-viz-violet)', icon: <Glyph type="person" /> },
      { id: 'file', label: 'Files', count: c('file'), tint: 'var(--ax-viz-pink)', icon: <Glyph type="file" /> },
      { id: 'project', label: 'Projects', count: c('project'), tint: 'var(--ax-viz-emerald)', icon: <Glyph type="project" /> },
    ];
  }, []);

  const visibleResults = useMemo(() => (tab === 'all' ? RESULTS : RESULTS.filter((r) => r.type === tab)), [tab]);

  return (
    <>
      <PageHead
        title={`Results for "${query}"`}
        subtitle={`${total} results across pages, people, files and projects · 0.21s`}
        actions={
          <form role="search" className="ax-input-group" aria-label="Refine search" style={{ minWidth: 300, height: 40 }} onSubmit={(e) => { e.preventDefault(); setQuery(draft.trim() || query); }}>
            <span className="ax-input-group__addon" aria-hidden="true"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
            <input type="search" className="ax-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Refine your search…" aria-label="Refine search query" autoComplete="off" />
          </form>
        }
      />

      <div className="ax-dash-grid">
        {/* Facets sidebar */}
        <aside className="ax-col--3" aria-label="Search facets" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Filter by type">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Type</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-list ax-list--compact" style={{ margin: 0 }}>
                {facets.map((f) => (
                  <li key={f.id} className="ax-list__row" style={{ cursor: 'pointer', border: 0, paddingInline: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', ...(tab === f.id ? { background: 'var(--ax-accent-wash)' } : {}) }} onClick={() => setTab(f.id)}>
                    <span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${f.tint} 18%,transparent)`, color: f.tint }}>{f.icon}</span></span>
                    <span className="ax-list__content"><span className="ax-list__title" style={tab === f.id ? { color: 'var(--ax-accent)' } : undefined}>{f.label}</span></span>
                    <span className="ax-list__trailing ax-num ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{f.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Filter by date">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Modified</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="radio" name="date" className="ax-radio" defaultChecked /><span>Any time</span></label>
              <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="radio" name="date" className="ax-radio" /><span>Past 7 days</span></label>
              <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="radio" name="date" className="ax-radio" /><span>Past 30 days</span></label>
              <label className="ax-check" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="radio" name="date" className="ax-radio" /><span>This year</span></label>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Search tips">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-accent)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9h.01" /><path d="M11 12h1v4h1" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg><b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Search tips</b></div>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>Use <code className="ax-num">type:file</code> to scope, <code className="ax-num">&quot;exact phrase&quot;</code> for phrases, and <kbd className="ax-kbd">⌘</kbd><kbd className="ax-kbd">K</kbd> from anywhere to jump.</p>
            </div>
          </section>
        </aside>

        {/* Results column */}
        <div className="ax-col--9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Search results">
            <div className="ax-card__header" style={{ paddingBottom: 0, borderBottom: 0 }}>
              <div className="ax-tabs ax-tabs--scrollable" role="tablist" aria-label="Result categories" style={{ width: '100%' }}>
                <div className="ax-tabs__list">
                  {facets.map((f) => (
                    <button key={f.id} type="button" className={`ax-tabs__tab${tab === f.id ? ' is-active' : ''}`} role="tab" aria-selected={tab === f.id} onClick={() => setTab(f.id)}>
                      <span>{f.label}</span><span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm ax-num">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="ax-card__body" role="tabpanel">
              <ul className="ax-list ax-list--linked" style={{ margin: 0 }}>
                {visibleResults.map((r) => (
                  <li key={r.id} className="ax-list__row" style={{ alignItems: 'flex-start', paddingBlock: 'var(--ax-space-3)' }}>
                    <span className="ax-list__leading"><span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.tint} 16%,transparent)`, color: r.tint }}><Glyph type={r.type} /></span></span>
                    <span className="ax-list__content" style={{ minWidth: 0 }}>
                      <a href="#" className="ax-list__title" style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)', textDecoration: 'none' }} dangerouslySetInnerHTML={{ __html: r.title }} />
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.5, marginTop: 2 }} dangerouslySetInnerHTML={{ __html: r.snippet }} />
                      <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}>
                        <span className="ax-badge ax-badge--outline ax-badge--sm">{r.typeLabel}</span>
                        <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.path}</span>
                        <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>·</span>
                        <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.when}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {visibleResults.length === 0 && (
                <div className="ax-flex" style={{ paddingBlock: 'var(--ax-space-9)', textAlign: 'center', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-4)' }}>
                  <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, var(--ax-accent-wash), transparent 70%)' }}>
                    <svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /><path d="M8 10l4 0" stroke="var(--ax-accent)" /></svg>
                  </span>
                  <div><h3 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)' }}>No results in this category</h3><p style={{ margin: 'var(--ax-space-2) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Try a different tab, check your spelling, or broaden the query.</p></div>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setTab('all')}><span className="ax-btn__label">Show all results</span></button>
                </div>
              )}
            </div>
            {visibleResults.length > 0 && (
              <div className="ax-card__footer">
                <nav className="ax-pagination" aria-label="Results pages" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <span className="ax-pagination__summary ax-num">Showing 1–<span>{visibleResults.length}</span> of <span>{total}</span></span>
                  <div className="ax-pagination__pages">
                    <button type="button" className="ax-pagination__prev ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous page" disabled><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                    <button type="button" className="ax-pagination__page is-active ax-num" aria-current="page">1</button>
                    <button type="button" className="ax-pagination__page ax-num">2</button>
                    <button type="button" className="ax-pagination__page ax-num">3</button>
                    <span className="ax-pagination__ellipsis">…</span>
                    <button type="button" className="ax-pagination__page ax-num">9</button>
                    <button type="button" className="ax-pagination__next ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next page"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
                  </div>
                </nav>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export default SearchResults;
