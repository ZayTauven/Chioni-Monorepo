'use client';
/*
 * Vireo Next.js — Blog / List (route "blog/list").
 *
 * Faithful re-expression of src/html/blog/list.html: a featured hero post,
 * a search + category-pill + sort toolbar, an auto-fill grid of post cards
 * (bookmark toggle, gradient covers), an empty state and pagination. The
 * Alpine axBlogList() state is ported to React; classes + ARIA match 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)',
  violet: 'var(--ax-viz-violet)',
  pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)',
  emerald: 'var(--ax-viz-emerald)',
};

const ICON = (paths: string[], extra?: Record<string, unknown>): ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...extra}>{paths.map((d, i) => <path key={i} d={d} />)}</svg>
);

const I: Record<string, string[]> = {
  code: ['M7 8l-4 4l4 4', 'M17 8l4 4l-4 4', 'M14 4l-4 16'],
  design: ['M3 21v-4a4 4 0 1 1 4 4h-4', 'M21 3a16 16 0 0 0 -12.8 10.2', 'M21 3a16 16 0 0 1 -10.2 12.8', 'M10.6 9a9 9 0 0 1 4.4 4.4'],
  product: ['M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5', 'M12 12l8 -4.5', 'M12 12l0 9', 'M12 12l-8 -4.5'],
  growth: ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
  culture: ['M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75'],
};

interface Category { id: string; name: string }
interface Post {
  id: number; title: string; cat: string; excerpt: string; author: string; authorInitials: string;
  date: string; read: number; views: string; c: string; c2: string; icon: string[]; bookmarked: boolean; _o: number;
}

const CATEGORIES: Category[] = [
  { id: 'all', name: 'All' },
  { id: 'eng', name: 'Engineering' },
  { id: 'design', name: 'Design' },
  { id: 'product', name: 'Product' },
  { id: 'growth', name: 'Growth' },
  { id: 'culture', name: 'Culture' },
];

const POSTS: Post[] = [
  { id: 1, title: 'Composable charts: one wrapper, every Apex chart type', cat: 'eng', excerpt: 'We wrapped ApexCharts behind a single renderChart() so every dashboard inherits the palette, dark mode and live re-theming.', author: 'Devon Okafor', authorInitials: 'DO', date: 'Jun 24', read: 7, views: '3.1K', c: C.cyan, c2: C.violet, icon: I.code, bookmarked: false, _o: 0 },
  { id: 2, title: 'The quiet craft of empty states', cat: 'design', excerpt: 'A good empty state does three jobs: orient, reassure and invite the next action. Here is the system we settled on.', author: 'Lena Brandt', authorInitials: 'LB', date: 'Jun 22', read: 5, views: '4.6K', c: C.violet, c2: C.pink, icon: I.design, bookmarked: true, _o: 1 },
  { id: 3, title: 'Shipping a roadmap your customers can actually read', cat: 'product', excerpt: 'Public roadmaps fail when they read like a backlog. We rebuilt ours around outcomes, not tickets.', author: 'Priya Nair', authorInitials: 'PN', date: 'Jun 19', read: 6, views: '2.4K', c: C.emerald, c2: C.cyan, icon: I.product, bookmarked: false, _o: 2 },
  { id: 4, title: 'From 0 to 10K signups: the channels that actually worked', cat: 'growth', excerpt: 'Six months, eleven experiments, two channels that mattered. A candid breakdown of what moved the needle.', author: 'Marcus Reid', authorInitials: 'MR', date: 'Jun 17', read: 8, views: '6.2K', c: C.amber, c2: C.pink, icon: I.growth, bookmarked: false, _o: 3 },
  { id: 5, title: 'How we run async design critique across 18 time zones', cat: 'culture', excerpt: 'Live critique does not scale when your team never overlaps. Our async ritual keeps craft high without the calendar tax.', author: 'Ava Sutton', authorInitials: 'AS', date: 'Jun 14', read: 4, views: '1.9K', c: C.pink, c2: C.violet, icon: I.culture, bookmarked: false, _o: 4 },
  { id: 6, title: 'Type scale, line height & the math behind comfortable reading', cat: 'design', excerpt: 'A modular scale is only half the story. The other half is rhythm — and rhythm is where most systems quietly fall apart.', author: 'Lena Brandt', authorInitials: 'LB', date: 'Jun 11', read: 6, views: '3.8K', c: C.violet, c2: C.cyan, icon: I.design, bookmarked: false, _o: 5 },
  { id: 7, title: 'Caching at the edge without losing your mind', cat: 'eng', excerpt: 'Stale-while-revalidate, cache tags and a tiny invalidation contract that kept our P95 under 80ms during launch week.', author: 'Tomás Herrera', authorInitials: 'TH', date: 'Jun 08', read: 9, views: '2.7K', c: C.cyan, c2: C.emerald, icon: I.code, bookmarked: false, _o: 6 },
  { id: 8, title: 'Pricing pages that respect the reader', cat: 'growth', excerpt: 'Most pricing pages optimise for the seller. We tried optimising for the buyer instead — and conversion went up.', author: 'Marcus Reid', authorInitials: 'MR', date: 'Jun 05', read: 5, views: '4.1K', c: C.amber, c2: C.violet, icon: I.growth, bookmarked: false, _o: 7 },
  { id: 9, title: 'What a healthy on-call rotation actually looks like', cat: 'culture', excerpt: 'Burnout hides in the gaps between incidents. Here is how we made on-call sustainable — and even a little boring.', author: 'Devon Okafor', authorInitials: 'DO', date: 'Jun 02', read: 7, views: '1.6K', c: C.emerald, c2: C.cyan, icon: I.culture, bookmarked: false, _o: 8 },
];

const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name || id;
const num = (v: string) => parseFloat(String(v).replace(/[^0-9.]/g, '')) * (String(v).includes('K') ? 1000 : 1);

export function BlogList() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [sort, setSort] = useState('newest');
  const [bookmarks, setBookmarks] = useState<Record<number, boolean>>(() => Object.fromEntries(POSTS.map((p) => [p.id, p.bookmarked])));

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const r = POSTS.filter((p) => {
      if (cat !== 'all' && p.cat !== cat) return false;
      if (term && !(p.title.toLowerCase().includes(term) || p.author.toLowerCase().includes(term) || catName(p.cat).toLowerCase().includes(term))) return false;
      return true;
    });
    const by: Record<string, (a: Post, b: Post) => number> = {
      popular: (a, b) => num(b.views) - num(a.views),
      title: (a, b) => a.title.localeCompare(b.title),
      newest: (a, b) => a._o - b._o,
    };
    return [...r].sort(by[sort] || by.newest);
  }, [q, cat, sort]);

  return (
    <>
      <PageHead
        title="Blog"
        subtitle={(<><span className="ax-num">128</span> published articles · <span className="ax-num">6</span> drafts · <span className="ax-num">42.8K</span> reads this month.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              {ICON(['M3 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z', 'M3 14m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z', 'M14 4m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z', 'M14 14m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z'], { className: 'ax-btn__icon' })}
              <span className="ax-btn__label">Manage tags</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/blog/create">
              {ICON(['M12 5l0 14', 'M5 12l14 0'], { className: 'ax-btn__icon' })}
              <span className="ax-btn__label">New post</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* FEATURED POST (12) */}
        <section className="ax-card ax-card--interactive ax-col--12" role="region" aria-label="Featured article">
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 0 }} className="ax-blog-feature">
            <div style={{ position: 'relative', minHeight: 280, overflow: 'hidden', borderRadius: 'var(--ax-radius-lg) 0 0 var(--ax-radius-lg)', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-violet) 40%,var(--ax-accent)),color-mix(in oklab,var(--ax-viz-cyan) 55%,transparent))' }} className="ax-blog-feature__cover">
              <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.16)', filter: 'blur(8px)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', bottom: -60, left: 20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', opacity: 0.85 }}>
                <svg viewBox="0 0 24 24" width={64} height={64} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg>
              </div>
              <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-4)', insetInlineStart: 'var(--ax-space-4)' }}>Featured</span>
            </div>
            <div style={{ padding: 'var(--ax-space-6)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <span className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Engineering</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 26, 2026 · 9 min read</span>
              </div>
              <Link href="/blog/blog-details" style={{ textDecoration: 'none' }}>
                <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.18 }}>Designing a token-driven theming engine that ships dark mode for free</h2>
              </Link>
              <p className="ax-clamp-2" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.65 }}>How we collapsed 14 hand-maintained color stylesheets into a single role-token layer — and why every new accent now themes the whole product with one CSS variable swap.</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-2)' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 22%,transparent)', color: 'var(--ax-viz-cyan)', fontWeight: 600 }}>LB</span>
                <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Lena Brandt</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Principal Designer</div></div>
                <Link href="/blog/blog-details" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--pill" style={{ marginInlineStart: 'auto' }}>Read article</Link>
              </div>
            </div>
          </div>
        </section>

        {/* TOOLBAR (12) */}
        <div className="ax-col--12">
          <div className="ax-card" style={{ margin: 0 }}>
            <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                {ICON(['M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'], { style: { position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: 'var(--ax-text-subtle)' } })}
                <input type="search" className="ax-input" placeholder="Search articles, authors, tags…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 35 }} aria-label="Search articles" />
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" className={`ax-btn ax-btn--sm ax-btn--pill ${cat === c.id ? 'ax-btn--primary' : 'ax-btn--secondary'}`} onClick={() => setCat(c.id)}>
                    <span className="ax-btn__label">{c.name}</span>
                  </button>
                ))}
              </div>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort articles" style={{ minWidth: 140, marginInlineStart: 'auto' }}>
                <option value="newest">Newest</option>
                <option value="popular">Most read</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* POST CARDS GRID (12 → auto-fill) */}
        <div className="ax-col--12">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 'var(--ax-space-6)' }}>
            {filtered.map((p) => (
              <article key={p.id} className="ax-card ax-card--interactive" style={{ margin: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Link href="/blog/blog-details" style={{ display: 'block', position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: `linear-gradient(135deg,color-mix(in oklab,${p.c} 55%,transparent),color-mix(in oklab,${p.c2} 45%,transparent))` }}>
                  <span aria-hidden="true" style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }} />
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', opacity: 0.85 }}>
                    <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p.icon.map((d, i) => <path key={i} d={d} />)}</svg>
                  </span>
                  <span className="ax-badge ax-badge--solid ax-badge--accent" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineStart: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-xs)' }}>{catName(p.cat)}</span>
                  <button type="button" className="ax-btn ax-btn--icon ax-btn--sm" onClick={(e) => { e.preventDefault(); setBookmarks((s) => ({ ...s, [p.id]: !s[p.id] })); }} aria-label={(bookmarks[p.id] ? 'Remove bookmark from ' : 'Bookmark ') + p.title} style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineEnd: 'var(--ax-space-3)', width: 30, height: 30, background: 'color-mix(in oklab,var(--ax-canvas) 55%,transparent)', border: 0, borderRadius: 'var(--ax-radius-sm)', backdropFilter: 'blur(6px)', color: bookmarks[p.id] ? 'var(--ax-accent)' : '#fff' }}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={bookmarks[p.id] ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg>
                  </button>
                </Link>
                <div style={{ padding: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', flex: '1 1 auto' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{p.date}</span>
                    <span>·</span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{p.read + ' min read'}</span>
                  </div>
                  <Link href="/blog/blog-details" style={{ textDecoration: 'none' }}>
                    <h3 className="ax-clamp-2" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 600, color: 'var(--ax-text-strong)', lineHeight: 1.3 }}>{p.title}</h3>
                  </Link>
                  <p className="ax-clamp-2" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6, flex: '1 1 auto' }}>{p.excerpt}</p>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', paddingTop: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}>
                    <span className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${p.c} 22%,transparent)`, color: p.c, fontWeight: 600 }}>{p.authorInitials}</span>
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>{p.author}</span>
                    <span className="ax-cluster" style={{ gap: 4, marginInlineStart: 'auto', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{p.views}</span>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* empty state */}
          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No articles found</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try a different search term or category.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setCat('all'); }}>Clear filters</button>
            </div>
          )}
        </div>

        {/* PAGINATION (12) */}
        {!!filtered.length && (
          <div className="ax-col--12">
            <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{filtered.length}</span> of 128 articles</span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled aria-disabled="true">{ICON(['M15 6l-6 6l6 6'])}</button>
                <ul className="ax-pagination__pages">
                  <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                  <li><a href="#" className="ax-pagination__page">2</a></li>
                  <li><a href="#" className="ax-pagination__page">3</a></li>
                  <li><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a href="#" className="ax-pagination__page">11</a></li>
                </ul>
                <button type="button" className="ax-pagination__next">{ICON(['M9 6l6 6l-6 6'])}</button>
              </nav>
            </div>
          </div>
        )}
      </div>

      <style>{`@media (max-width: 820px){ .ax-blog-feature{ grid-template-columns:1fr !important; } .ax-blog-feature__cover{ border-radius:var(--ax-radius-lg) var(--ax-radius-lg) 0 0 !important; min-height:200px !important; } }`}</style>
    </>
  );
}

export default BlogList;
