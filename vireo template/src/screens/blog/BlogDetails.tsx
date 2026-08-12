'use client';
/*
 * Vireo Next.js — Blog / Details (route "blog/blog-details").
 *
 * Faithful re-expression of src/html/blog/blog-details.html: a hero cover, the
 * long-form article body (callout, code block with copy, blockquote, tags),
 * an author bio, a comments thread with a post form, and a right rail
 * (engagement stats, table of contents, related posts, newsletter). The Alpine
 * axBlogPost() state is ported to React; classes + ARIA match 1:1.
 */
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)',
  violet: 'var(--ax-viz-violet)',
  pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)',
  emerald: 'var(--ax-viz-emerald)',
};

interface Comment { id: number; name: string; initials: string; color: string; time: string; body: string; likes: number; liked: boolean }

const INITIAL_COMMENTS: Comment[] = [
  { id: 1, name: 'Priya Nair', initials: 'PN', color: C.emerald, time: '2h ago', body: 'This mirrors our migration almost exactly. The hardest part was getting buy-in to ban raw hex in code review — once linting enforced it, the rest followed naturally.', likes: 24, liked: false },
  { id: 2, name: 'Marcus Reid', initials: 'MR', color: C.amber, time: '5h ago', body: 'Curious how you handle one-off marketing pages that genuinely need a bespoke colour. Do you allow an escape hatch or push everything through the role layer?', likes: 11, liked: false },
  { id: 3, name: 'Lena Brandt', initials: 'LB', color: C.violet, time: '1d ago', body: 'The three-layer one-way dependency is the whole game. We added a build check that fails if components.css references a primitive directly. Zero regressions since.', likes: 38, liked: true },
];

export function BlogDetails() {
  const [bookmarked, setBookmarked] = useState(false);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const [cid, setCid] = useState(100);
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);

  const copy = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const postComment = () => {
    const v = draft.trim();
    if (!v) return;
    const next = cid + 1;
    setCid(next);
    setComments((cs) => [{ id: next, name: 'You', initials: 'You', color: 'var(--ax-accent)', time: 'just now', body: v, likes: 0, liked: false }, ...cs]);
    setDraft('');
  };
  const toggleCommentLike = (id: number) => setComments((cs) => cs.map((c) => (c.id === id ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } : c)));

  return (
    <>
      <PageHead
        title="Designing a token-driven theming engine"
        subtitle={(<>Engineering · Published <span className="ax-num">Jun 26, 2026</span> · <span className="ax-num">9</span> min read.</>) as unknown as string}
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/blog/list">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">All posts</span>
            </Link>
            <button type="button" className={`ax-btn ax-btn--secondary ${bookmarked ? 'ax-btn--soft-success' : ''}`} onClick={() => setBookmarked((b) => !b)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" /></svg>
              <span className="ax-btn__label">{bookmarked ? 'Saved' : 'Save'}</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/blog/create">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>
              <span className="ax-btn__label">Edit</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* ARTICLE (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* HERO COVER */}
          <section className="ax-card" role="region" aria-label="Cover image" style={{ overflow: 'hidden' }}>
            <div style={{ position: 'relative', aspectRatio: '21/9', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-violet) 45%,var(--ax-accent)),color-mix(in oklab,var(--ax-viz-cyan) 55%,transparent))' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: -50, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.16)', filter: 'blur(10px)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', bottom: -70, left: 30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', opacity: 0.85 }}>
                <svg viewBox="0 0 24 24" width={72} height={72} fill="none" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg>
              </div>
              <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-4)', insetInlineStart: 'var(--ax-space-4)' }}>Engineering</span>
            </div>
          </section>

          {/* ARTICLE BODY */}
          <article className="ax-card" role="region" aria-label="Article body">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', fontSize: 'var(--ax-text-md)', lineHeight: 1.78, color: 'var(--ax-text)' }}>
              <p style={{ fontSize: 'var(--ax-text-lg)', lineHeight: 1.7, color: 'var(--ax-text-strong)' }}>Eighteen months ago our front-end carried <b>fourteen</b> hand-maintained colour stylesheets — one per theme, plus a fork for dark mode. Every brand tweak meant a fourteen-file pull request. Today a single CSS variable swap retheme the entire product. This is how we got there.</p>

              <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.25, marginTop: 'var(--ax-space-2)' }}>The problem with literal colours</h2>
              <p>The original system hard-coded hex values directly in components. A button knew it was <code className="ax-code">#3B82F6</code>. When design shipped a new accent, we hunted those literals across the codebase. Dark mode doubled the surface area, and contrast bugs slipped through on every release.</p>
              <p>The fix was a layer of <b>role tokens</b>: semantic names like <code className="ax-code">--surface</code>, <code className="ax-code">--text-muted</code> and <code className="ax-code">--accent</code> that point at raw stops. Components reference roles only — never stops — so swapping the underlying palette retheme everything at once.</p>

              {/* callout */}
              <div className="ax-alert ax-alert--accent ax-alert--accent-edge" role="note" style={{ margin: 0 }}>
                <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9h.01" /><path d="M11 12h1v4h1" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__title">Rule of thumb</p><p className="ax-alert__message">If a component references a raw hex value, it can only ever look right in one theme. Role tokens are the contract that makes light, dark and twelve accents work for free.</p></div>
              </div>

              <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.25, marginTop: 'var(--ax-space-2)' }}>Three layers, one direction</h2>
              <p>We settled on a strict one-way dependency: primitives feed roles, roles feed components. Nothing reaches back up the chain.</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', listStyle: 'none', padding: 0, margin: 0 }}>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-accent)' }} /><span><b style={{ color: 'var(--ax-text-strong)' }}>Primitives</b> — the raw scale (<code className="ax-code">--blue-500</code>, <code className="ax-code">--gray-100</code>). Never referenced by components.</span></li>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-viz-cyan)' }} /><span><b style={{ color: 'var(--ax-text-strong)' }}>Roles</b> — semantic aliases that resolve per theme (<code className="ax-code">--surface</code>, <code className="ax-code">--accent</code>).</span></li>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 8, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-viz-violet)' }} /><span><b style={{ color: 'var(--ax-text-strong)' }}>Components</b> — consume roles exclusively. One stylesheet, every theme.</span></li>
              </ul>

              {/* code block */}
              <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-surface)' }}>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>tokens.css</span>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={copy} aria-label="Copy code">
                    {!copied && <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>}
                    {copied && <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-viz-emerald)' }}><path d="M5 12l5 5l10 -10" /></svg>}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 'var(--ax-space-4)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', lineHeight: 1.7, color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-text-subtle)' }}>{'/* role layer — resolves per theme */'}</span>{'\n'}<span style={{ color: 'var(--ax-viz-violet)' }}>:root</span>{' {\n  '}<span style={{ color: 'var(--ax-viz-cyan)' }}>--surface</span>{': '}<span style={{ color: 'var(--ax-viz-emerald)' }}>var(--gray-50)</span>{';\n  '}<span style={{ color: 'var(--ax-viz-cyan)' }}>--text-strong</span>{': '}<span style={{ color: 'var(--ax-viz-emerald)' }}>var(--gray-900)</span>{';\n  '}<span style={{ color: 'var(--ax-viz-cyan)' }}>--accent</span>{': '}<span style={{ color: 'var(--ax-viz-emerald)' }}>var(--brand-500)</span>{';\n}\n'}<span style={{ color: 'var(--ax-viz-violet)' }}>{'[data-theme='}<span style={{ color: 'var(--ax-viz-amber)' }}>{'"dark"'}</span>{']'}</span>{' {\n  '}<span style={{ color: 'var(--ax-viz-cyan)' }}>--surface</span>{': '}<span style={{ color: 'var(--ax-viz-emerald)' }}>var(--gray-900)</span>{';\n  '}<span style={{ color: 'var(--ax-viz-cyan)' }}>--text-strong</span>{': '}<span style={{ color: 'var(--ax-viz-emerald)' }}>var(--gray-50)</span>{';\n}'}</pre>
              </div>

              <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.25, marginTop: 'var(--ax-space-2)' }}>What we measured afterward</h2>
              <p>The migration paid for itself within a quarter. A new accent now ships in minutes, dark mode is guaranteed-correct by construction, and our contrast regressions dropped to zero because the role layer enforces accessible pairings centrally.</p>
              <blockquote style={{ margin: 0, padding: 'var(--ax-space-4) var(--ax-space-5)', borderInlineStart: '3px solid var(--ax-accent)', background: 'var(--ax-accent-wash)', borderRadius: '0 var(--ax-radius-md) var(--ax-radius-md) 0', fontStyle: 'italic', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)', lineHeight: 1.6 }}>&quot;The best theming system is the one your team forgets exists — it just works in every mode, every time.&quot;</blockquote>
              <p>If you are still maintaining per-theme stylesheets, the cost is compounding quietly. A role layer is a weekend of disciplined renaming followed by years of dividends.</p>

              {/* tags */}
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap', paddingTop: 'var(--ax-space-4)', borderTop: '1px solid var(--ax-border)' }}>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.05em', marginInlineEnd: 'var(--ax-space-1)' }}>Tags</span>
                {['Design Tokens', 'CSS Variables', 'Dark Mode', 'Accessibility', 'Theming'].map((t) => (
                  <Link key={t} href="/blog/list" className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)', textDecoration: 'none' }}>{t}</Link>
                ))}
              </div>
            </div>
          </article>

          {/* AUTHOR BIO */}
          <section className="ax-card ax-card--accent-edge" role="region" aria-label="About the author">
            <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 22%,transparent)', color: 'var(--ax-viz-cyan)', fontWeight: 600, flex: 'none', fontSize: 'var(--ax-text-lg)' }}>DO</span>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600, color: 'var(--ax-text-strong)' }}>Devon Okafor</h3>
                  <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Staff Engineer</span>
                </div>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.65, marginTop: 'var(--ax-space-2)' }}>Devon leads the design-systems guild and has spent the last decade making front-ends boringly reliable. Writes about CSS architecture, performance and the unglamorous work that keeps products fast.</p>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-3)' }}>
                  <button type="button" className={`ax-btn ax-btn--secondary ax-btn--sm ${following ? 'ax-btn--soft-success' : ''}`} onClick={() => setFollowing((f) => !f)}><span className="ax-btn__label">{following ? 'Following' : 'Follow'}</span></button>
                  <a href="#" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Devon on the web"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M3.6 9h16.8" /><path d="M3.6 15h16.8" /><path d="M11.5 3a17 17 0 0 0 0 18" /><path d="M12.5 3a17 17 0 0 1 0 18" /></svg></a>
                </div>
              </div>
            </div>
          </section>

          {/* COMMENTS */}
          <section className="ax-card" role="region" aria-label="Comments">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Comments</h2><p className="ax-card__subtitle"><span className="ax-num">{comments.length}</span> responses</p></div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              {/* new comment */}
              <form onSubmit={(e) => { e.preventDefault(); postComment(); }} style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', fontWeight: 600, flex: 'none' }}>You</span>
                <div style={{ flex: '1 1 auto' }}>
                  <textarea className="ax-textarea" rows={2} placeholder="Add to the discussion…" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 64 }} />
                  <div className="ax-cluster" style={{ justifyContent: 'flex-end', marginTop: 'var(--ax-space-2)' }}>
                    <button type="submit" className="ax-btn ax-btn--primary ax-btn--sm" disabled={!draft.trim()}><span className="ax-btn__label">Post comment</span></button>
                  </div>
                </div>
              </form>
              <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
              {/* comment list */}
              {comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
                  <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${c.color} 22%,transparent)`, color: c.color, fontWeight: 600, flex: 'none' }}>{c.initials}</span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{c.name}</span>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.time}</span>
                    </div>
                    <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6, marginTop: 4 }}>{c.body}</p>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 6 }}>
                      <button type="button" className="ax-cluster" onClick={() => toggleCommentLike(c.id)} style={{ gap: 5, background: 'none', border: 0, cursor: 'pointer', fontSize: 'var(--ax-text-xs)', color: c.liked ? 'var(--ax-accent)' : 'var(--ax-text-subtle)' }}>
                        <svg viewBox="0 0 24 24" width={15} height={15} fill={c.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1zm5 -7.5a2.5 2.5 0 0 1 5 0c0 .57 -.09 1.11 -.26 1.62l-.24 .88h3.5a2 2 0 0 1 2 2l-2 6.5a2 2 0 0 1 -2 1.5h-7a1 1 0 0 1 -1 -1v-8c.97 -2.16 2.69 -3.5 4.25 -5z" /></svg>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{c.likes}</span>
                      </button>
                      <button type="button" style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RAIL (4) */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* ENGAGEMENT */}
          <section className="ax-card" role="region" aria-label="Article engagement">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
                <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>12.4K</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Reads</div></div>
                <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>486</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Likes</div></div>
                <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>38</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Replies</div></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                <button type="button" className={`ax-btn ax-btn--secondary ax-btn--block ${liked ? 'ax-btn--soft-success' : ''}`} onClick={() => setLiked((l) => !l)}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1zm5 -7.5a2.5 2.5 0 0 1 5 0c0 .57 -.09 1.11 -.26 1.62l-.24 .88h3.5a2 2 0 0 1 2 2l-2 6.5a2 2 0 0 1 -2 1.5h-7a1 1 0 0 1 -1 -1v-8c.97 -2.16 2.69 -3.5 4.25 -5z" /></svg>
                  <span className="ax-btn__label">{liked ? 'Liked' : 'Like'}</span>
                </button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /><path d="M15 7a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M15 17a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
                  <span className="ax-btn__label">Share</span>
                </button>
              </div>
            </div>
          </section>

          {/* TABLE OF CONTENTS */}
          <section className="ax-card" role="region" aria-label="In this article">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">In this article</h2></div></div>
            <ul className="ax-list ax-list--compact" style={{ padding: '0 var(--ax-space-4) var(--ax-space-4)' }}>
              <li className="ax-list__row" style={{ border: 0 }}><a href="#" className="ax-list__content" style={{ textDecoration: 'none', color: 'var(--ax-accent)' }}><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>The problem with literal colours</span></a></li>
              <li className="ax-list__row" style={{ border: 0 }}><a href="#" className="ax-list__content" style={{ textDecoration: 'none', color: 'var(--ax-text-muted)' }}><span className="ax-list__title">Three layers, one direction</span></a></li>
              <li className="ax-list__row" style={{ border: 0 }}><a href="#" className="ax-list__content" style={{ textDecoration: 'none', color: 'var(--ax-text-muted)' }}><span className="ax-list__title">What we measured afterward</span></a></li>
            </ul>
          </section>

          {/* RELATED POSTS */}
          <section className="ax-card" role="region" aria-label="Related posts">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Related posts</h2></div><Link className="ax-btn ax-btn--link" href="/blog/list">More</Link></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <Link href="/blog/blog-details" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', textDecoration: 'none' }}>
                <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 'var(--ax-radius-md)', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-violet) 55%,transparent),color-mix(in oklab,var(--ax-viz-pink) 45%,transparent))', display: 'grid', placeItems: 'center', color: '#fff' }}><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21v-4a4 4 0 1 1 4 4h-4" /><path d="M21 3a16 16 0 0 0 -12.8 10.2" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-clamp-2" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', lineHeight: 1.35 }}>The quiet craft of empty states</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 22 · 5 min</span></span>
              </Link>
              <Link href="/blog/blog-details" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', textDecoration: 'none' }}>
                <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 'var(--ax-radius-md)', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-cyan) 55%,transparent),color-mix(in oklab,var(--ax-viz-emerald) 45%,transparent))', display: 'grid', placeItems: 'center', color: '#fff' }}><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-clamp-2" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', lineHeight: 1.35 }}>Caching at the edge without losing your mind</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 08 · 9 min</span></span>
              </Link>
              <Link href="/blog/blog-details" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', textDecoration: 'none' }}>
                <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 'var(--ax-radius-md)', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-amber) 55%,transparent),color-mix(in oklab,var(--ax-viz-pink) 45%,transparent))', display: 'grid', placeItems: 'center', color: '#fff' }}><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-clamp-2" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', lineHeight: 1.35 }}>Pricing pages that respect the reader</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 05 · 5 min</span></span>
              </Link>
            </div>
          </section>

          {/* NEWSLETTER */}
          <section className="ax-card" role="region" aria-label="Newsletter">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', margin: '0 auto' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg></span>
              <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 600, color: 'var(--ax-text-strong)' }}>The weekly digest</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.55 }}>One thoughtful engineering essay every Friday. No spam, unsubscribe anytime.</p>
              {!subscribed && (
                <form className="ax-flex" onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} style={{ flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <input type="email" className="ax-input" placeholder="you@example.com" required aria-label="Email address" />
                  <button type="submit" className="ax-btn ax-btn--primary ax-btn--block"><span className="ax-btn__label">Subscribe</span></button>
                </form>
              )}
              {subscribed && (
                <div className="ax-cluster" style={{ justifyContent: 'center', gap: 6, color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg><b>You&apos;re subscribed!</b></div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default BlogDetails;
