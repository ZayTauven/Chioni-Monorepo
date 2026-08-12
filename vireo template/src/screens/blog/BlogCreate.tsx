'use client';
/*
 * Vireo Next.js — Blog / Create (route "blog/create").
 *
 * Faithful re-expression of src/html/blog/create.html: the new-post editor —
 * title/slug/excerpt, cover dropzone, a formatting-toolbar body textarea, an
 * SEO search+social preview, a right rail (publish status radios, organize:
 * category/author/tags token input, a live publish checklist) and a sticky
 * action bar. The Alpine axPostForm() state is ported to React; classes +
 * ARIA match 1:1.
 */
import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Status { id: string; name: string; desc: string; c: string }
const STATUSES: Status[] = [
  { id: 'draft', name: 'Draft', desc: 'Only visible to your team', c: 'var(--ax-text-subtle)' },
  { id: 'published', name: 'Published', desc: 'Live on the blog immediately', c: 'var(--ax-viz-emerald)' },
  { id: 'scheduled', name: 'Scheduled', desc: 'Goes live at a set time', c: 'var(--ax-viz-amber)' },
];

interface Form {
  title: string; slug: string; excerpt: string; alt: string; body: string;
  metaTitle: string; metaDesc: string;
  status: string; scheduleDate: string; featured: boolean; comments: boolean;
  category: string; author: string; tags: string[];
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function BlogCreate() {
  const [saved, setSaved] = useState(false);
  const [savedKind, setSavedKind] = useState('');
  const [dragover, setDragover] = useState(false);
  const [cover, setCover] = useState(false);
  const [form, setForm] = useState<Form>({
    title: '', slug: '', excerpt: '', alt: '', body: '',
    metaTitle: '', metaDesc: '',
    status: 'draft', scheduleDate: '', featured: false, comments: true,
    category: '', author: 'devon', tags: [],
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const wordCount = () => { const t = form.body.trim(); return t ? t.split(/\s+/).length : 0; };
  const readTime = () => Math.max(1, Math.round(wordCount() / 200));

  const checklist: { label: string; done: () => boolean }[] = [
    { label: 'Title is set', done: () => form.title.trim().length > 3 },
    { label: 'Excerpt written', done: () => form.excerpt.trim().length > 10 },
    { label: 'Cover image added', done: () => cover },
    { label: 'Category selected', done: () => !!form.category },
    { label: 'At least one tag', done: () => form.tags.length > 0 },
    { label: 'Body has content', done: () => wordCount() > 20 },
  ];

  const addTag = (e: KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const v = target.value.trim().replace(/,$/, '');
    if (v && !form.tags.includes(v)) set('tags', [...form.tags, v]);
    target.value = '';
  };

  const save = (kind: string) => {
    setSavedKind(kind);
    setSaved(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save('publish'); }}>
      <PageHead
        title="New Post"
        subtitle="Write your article, set a cover & category, then publish to the blog."
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/blog/list">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Back to blog</span>
          </Link>
        }
      />

      {/* save success alert */}
      {saved && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-6)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">{savedKind === 'draft' ? 'Saved as draft' : 'Post published'}</p><p className="ax-alert__message">{savedKind === 'draft' ? 'Your draft is saved. Publish when it\'s ready.' : 'Your article is now live on the blog.'}</p></div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSaved(false)} aria-label="Dismiss"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}

      <div className="ax-dash-grid" style={{ paddingBottom: 96 }}>
        {/* LEFT COLUMN (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* TITLE & SLUG */}
          <section className="ax-card" role="region" aria-label="Title">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-title">Title <span className="ax-field__required">*</span></label>
                <input id="b-title" type="text" className="ax-input ax-input--lg" placeholder="A clear, compelling headline" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))} maxLength={120} style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 600 }} />
                <span className="ax-help"><span className="ax-num">{form.title.length}</span> / 120 — strong titles are specific and promise a payoff.</span>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-slug">URL slug</label>
                <div className="ax-input-group">
                  <span className="ax-input-group__addon" style={{ color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>/blog/</span>
                  <input id="b-slug" type="text" className="ax-input ax-num" value={form.slug} onChange={(e) => set('slug', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} placeholder="your-post-slug" />
                </div>
                <span className="ax-help">Auto-generated from the title — edit for a custom link.</span>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-excerpt">Excerpt</label>
                <textarea id="b-excerpt" className="ax-textarea" rows={2} placeholder="A one-or-two-line summary shown on cards, search and social previews." value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} maxLength={180} style={{ minHeight: 64 }} />
                <span className="ax-help"><span className="ax-num">{form.excerpt.length}</span> / 180 characters</span>
              </div>
            </div>
          </section>

          {/* COVER IMAGE */}
          <section className="ax-card" role="region" aria-label="Cover image">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Cover image</h2><p className="ax-card__subtitle">Shown at the top of the article and on listing cards.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {/* empty: dropzone */}
              {!cover && (
                <div className={`ax-dropzone ${dragover ? 'is-dragover' : ''}`}>
                  <label className="ax-dropzone__area" htmlFor="b-cover" onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={(e) => { e.preventDefault(); setDragover(false); setCover(true); }} style={{ cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                    <div><b style={{ color: 'var(--ax-text)' }}>Click to upload</b> or drag &amp; drop</div>
                    <small style={{ color: 'var(--ax-text-subtle)' }}>PNG, JPG or WEBP up to 5 MB · 16:9 recommended</small>
                    <input id="b-cover" type="file" accept="image/*" className="ax-visually-hidden" onChange={() => setCover(true)} />
                  </label>
                </div>
              )}
              {/* filled: preview */}
              {cover && (
                <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', border: '1px solid var(--ax-border)', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-violet) 50%,var(--ax-accent)),color-mix(in oklab,var(--ax-viz-cyan) 55%,transparent))' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', opacity: 0.8 }}><svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg></div>
                  <div className="ax-cluster" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineEnd: 'var(--ax-space-3)', gap: 'var(--ax-space-2)' }}>
                    <button type="button" className="ax-btn ax-btn--sm" onClick={() => setCover(true)} style={{ background: 'color-mix(in oklab,var(--ax-canvas) 60%,transparent)', color: 'var(--ax-text-strong)', border: 0, backdropFilter: 'blur(6px)' }}><span className="ax-btn__label">Replace</span></button>
                    <button type="button" className="ax-btn ax-btn--icon ax-btn--sm" onClick={() => setCover(false)} aria-label="Remove cover" style={{ background: 'color-mix(in oklab,var(--ax-canvas) 60%,transparent)', color: 'var(--ax-text-strong)', border: 0, backdropFilter: 'blur(6px)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                  </div>
                </div>
              )}
              <div className="ax-field" style={{ marginTop: 'var(--ax-space-4)', marginBottom: 0 }}>
                <label className="ax-label" htmlFor="b-alt">Alt text</label>
                <input id="b-alt" type="text" className="ax-input" placeholder="Describe the image for screen readers" value={form.alt} onChange={(e) => set('alt', e.target.value)} />
              </div>
            </div>
          </section>

          {/* BODY EDITOR */}
          <section className="ax-card" role="region" aria-label="Article body">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Body</h2><p className="ax-card__subtitle">The full article. Use the toolbar to format.</p></div><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span>{wordCount()}</span> words · <span>{readTime()}</span> min read</span></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {/* toolbar */}
              <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', gap: 2, padding: 6, border: '1px solid var(--ax-border)', borderBottom: 0, borderRadius: 'var(--ax-radius-sm) var(--ax-radius-sm) 0 0', background: 'var(--ax-surface-subtle)', flexWrap: 'wrap' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" aria-label="Heading"><span className="ax-btn__label" style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 700 }}>H</span></button>
                <span style={{ width: 1, background: 'var(--ax-border)', margin: '2px 4px' }} />
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bold"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Italic"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Inline code"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg></button>
                <span style={{ width: 1, background: 'var(--ax-border)', margin: '2px 4px' }} />
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bulleted list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Quote"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert image"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg></button>
              </div>
              <textarea id="b-body" className="ax-textarea" rows={14} placeholder="Start writing your story… A strong opening earns the next paragraph — lead with the payoff, then explain how you got there." value={form.body} onChange={(e) => set('body', e.target.value)} style={{ borderRadius: '0 0 var(--ax-radius-sm) var(--ax-radius-sm)', minHeight: 340, lineHeight: 1.7 }} />
            </div>
          </section>

          {/* SEO */}
          <section className="ax-card" role="region" aria-label="Search engine listing">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Search &amp; social preview</h2><p className="ax-card__subtitle">How this post appears in search results and shares.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{'vireo.blog › blog › ' + (form.slug || 'your-post-slug')}</span>
                <div style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-medium)', marginTop: 4 }}>{form.metaTitle || form.title || 'Your post title'}</div>
                <div style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.4, marginTop: 2 }}>{form.metaDesc || form.excerpt || 'Your meta description appears here. Aim for 120–155 characters.'}</div>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-metatitle">Meta title</label>
                <input id="b-metatitle" type="text" className="ax-input" placeholder="Defaults to the post title" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} maxLength={70} />
                <span className="ax-help"><span className="ax-num" style={form.metaTitle.length > 60 ? { color: 'var(--ax-warning-500)' } : undefined}>{form.metaTitle.length}</span> / 70</span>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-metadesc">Meta description</label>
                <textarea id="b-metadesc" className="ax-textarea" rows={2} placeholder="A concise summary for search engines" value={form.metaDesc} onChange={(e) => set('metaDesc', e.target.value)} maxLength={160} style={{ minHeight: 64 }} />
                <span className="ax-help"><span className="ax-num" style={form.metaDesc.length > 155 ? { color: 'var(--ax-warning-500)' } : undefined}>{form.metaDesc.length}</span> / 160</span>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT RAIL (4) */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* PUBLISH */}
          <section className="ax-card" role="region" aria-label="Publish">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Publish</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {STATUSES.map((s) => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1.5px solid', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(form.status === s.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : { borderColor: 'var(--ax-border)', background: 'var(--ax-surface)' }) }}>
                  <input type="radio" name="b-status" className="ax-radio" value={s.id} checked={form.status === s.id} onChange={() => set('status', s.id)} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: s.c }} />
                  <span style={{ flex: '1 1 auto' }}><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{s.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.desc}</span></span>
                </label>
              ))}
              {form.status === 'scheduled' && (
                <div className="ax-field" style={{ margin: 'var(--ax-space-1) 0 0' }}>
                  <label className="ax-label" htmlFor="b-schedule">Publish date</label>
                  <input id="b-schedule" type="datetime-local" className="ax-input ax-num" value={form.scheduleDate} onChange={(e) => set('scheduleDate', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} />
                </div>
              )}
              <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)', margin: 'var(--ax-space-1) 0' }} />
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Feature on homepage</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Pins this post to the top of the blog.</span></span>
              </label>
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={form.comments} onChange={(e) => set('comments', e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Allow comments</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Readers can respond below the article.</span></span>
              </label>
            </div>
          </section>

          {/* ORGANIZE */}
          <section className="ax-card" role="region" aria-label="Organize">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Organize</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-category">Category <span className="ax-field__required">*</span></label>
                <select id="b-category" className="ax-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">Select a category</option>
                  <option value="eng">Engineering</option>
                  <option value="design">Design</option>
                  <option value="product">Product</option>
                  <option value="growth">Growth</option>
                  <option value="culture">Culture</option>
                </select>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-author">Author</label>
                <select id="b-author" className="ax-select" value={form.author} onChange={(e) => set('author', e.target.value)}>
                  <option value="devon">Devon Okafor</option>
                  <option value="lena">Lena Brandt</option>
                  <option value="priya">Priya Nair</option>
                  <option value="marcus">Marcus Reid</option>
                  <option value="ava">Ava Sutton</option>
                </select>
              </div>
              {/* tags token input */}
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="b-tags">Tags</label>
                <div className="ax-tags">
                  {form.tags.map((t, ti) => (
                    <span key={ti} className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill" style={{ gap: 4 }}><span>{t}</span><button type="button" onClick={() => set('tags', form.tags.filter((_, i) => i !== ti))} aria-label={'Remove tag ' + t} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
                  ))}
                  <input id="b-tags" type="text" className="ax-tags__input" placeholder="Add a tag…" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(e); } }} />
                </div>
                <span className="ax-help">Press Enter or comma to add. Helps readers discover this post.</span>
              </div>
            </div>
          </section>

          {/* CHECKLIST */}
          <section className="ax-card" role="region" aria-label="Publish checklist">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Ready to publish?</h2></div></div>
            <ul className="ax-list ax-list--compact" style={{ padding: '0 var(--ax-space-4) var(--ax-space-4)' }}>
              {checklist.map((c) => {
                const done = c.done();
                return (
                  <li key={c.label} className="ax-list__row" style={{ border: 0 }}>
                    <span className="ax-list__leading">
                      {done
                        ? <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-viz-emerald)' }}><path d="M5 12l5 5l10 -10" /></svg>
                        : <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-text-subtle)' }}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /></svg>}
                    </span>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontSize: 'var(--ax-text-sm)', color: done ? 'var(--ax-text)' : 'var(--ax-text-muted)' }}>{c.label}</span></span>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {/* STICKY ACTION BAR */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 5, margin: '0 calc(-1 * var(--ax-space-6))', padding: 'var(--ax-space-4) var(--ax-space-6)', background: 'var(--ax-surface)', backdropFilter: 'blur(18px) saturate(1.1)', borderTop: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow-sm)' }}>
        <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
          <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-text-subtle)' }}><path d="M12 7a5 5 0 1 0 5 5" /><path d="M13 3.055a9 9 0 1 0 7.941 7.945" /><path d="M15 6v3h3l3 -3h-3v-3z" /><path d="M15 9l-3 3" /></svg>
            <span>Draft autosaved · just now</span>
          </span>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
              <span className="ax-btn__label">Preview</span>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={() => save('draft')}>Save draft</button>
            <button type="submit" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
              <span className="ax-btn__label">Publish post</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default BlogCreate;
