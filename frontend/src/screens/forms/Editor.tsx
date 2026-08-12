'use client';
/*
 * Vireo Next.js — Forms / Editors (route "forms/editor").
 *
 * Faithful re-expression of src/html/forms/editor.html: a WYSIWYG rich-text
 * chrome (toolbar + contenteditable article body), an editor side rail
 * (document meta + statistics), and a CodeMirror-style source view with a
 * line-number gutter and an HTML/Markdown segment toggle. The Alpine axEditor()
 * factory (publish toast, inline-format toggles, language switch) is ported to
 * React state; classes + ARIA match the reference 1:1.
 */
import { useState, type ReactElement } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const ICON_SAVE = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M9 17l0 .01" /><path d="M9 13l6 0" /></svg>
);
const ICON_SEND = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
);

interface InlineBtn { k: string; label: string; icon: ReactElement; }
const INLINE_BTNS: InlineBtn[] = [
  { k: 'bold', label: 'Bold', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6l0 -7" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg> },
  { k: 'italic', label: 'Italic', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg> },
  { k: 'underline', label: 'Underline', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5v5a5 5 0 0 0 10 0v-5" /><path d="M5 19h14" /></svg> },
  { k: 'strike', label: 'Strikethrough', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M16 6.5a4 2 0 0 0 -4 -1.5h-1a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-1.5a4 2 0 0 1 -4 -1.5" /></svg> },
];

export function Editor() {
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState(false);
  const [lang, setLang] = useState<'html' | 'md'>('html');
  const [active, setActive] = useState<Record<string, boolean>>({ bold: false, italic: false, underline: false, strike: false });

  const publish = () => {
    setPublishing(true);
    setTimeout(() => {
      setPublishing(false);
      setToast(true);
      setTimeout(() => setToast(false), 2600);
    }, 700);
  };

  return (
    <>
      <PageHead
        title="Editors"
        subtitle="Rich-text and code editing surfaces — WYSIWYG chrome, Markdown and a syntax-highlighted source view."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              {ICON_SAVE}
              <span className="ax-btn__label">Save draft</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={publish} aria-busy={publishing}>
              {ICON_SEND}
              <span className="ax-btn__label">{publishing ? 'Publishing…' : 'Publish'}</span>
            </button>
          </>
        }
      />

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60 }}>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-lg)' }}>
            <span style={{ color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Article published</span>
          </div>
        </div>
      )}

      <div className="ax-dash-grid">

        {/* ───── RICH TEXT EDITOR (Quill chrome) ───── */}
        <section className="ax-card ax-col--8" role="region" aria-label="Rich text editor">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">WYSIWYG</span>
              <h2 className="ax-card__title">Article body</h2>
              <p className="ax-card__subtitle">Format with the toolbar — output is sanitized HTML.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>248 words · ~1 min read</span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {/* toolbar */}
            <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, padding: 'var(--ax-space-2)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderBottom: 0, borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) 0 0' }}>
              {/* block style select */}
              <select className="ax-select ax-select--sm" aria-label="Block style" style={{ width: 'auto', minWidth: 130, marginInlineEnd: 'var(--ax-space-1)' }} defaultValue="Paragraph">
                <option>Paragraph</option><option>Heading 1</option><option>Heading 2</option><option>Heading 3</option><option>Quote</option><option>Code block</option>
              </select>
              <span className="ax-divider ax-divider--vertical" style={{ height: 22, marginInline: 'var(--ax-space-1)' }} />
              {/* inline format toggles */}
              {INLINE_BTNS.map((b) => (
                <button key={b.k} type="button" className={`ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm ${active[b.k] ? 'is-selected' : ''}`} aria-pressed={!!active[b.k]} aria-label={b.label} onClick={() => setActive((a) => ({ ...a, [b.k]: !a[b.k] }))}>
                  {b.icon}
                </button>
              ))}
              <span className="ax-divider ax-divider--vertical" style={{ height: 22, marginInline: 'var(--ax-space-1)' }} />
              {/* lists */}
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bulleted list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Numbered list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 6h9" /><path d="M11 12h9" /><path d="M12 18h8" /><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4" /><path d="M6 10v-6l-2 2" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Checklist"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 6l9 0" /><path d="M11 12l9 0" /><path d="M11 18l9 0" /><path d="M3 6l2 2l3 -3" /></svg></button>
              <span className="ax-divider ax-divider--vertical" style={{ height: 22, marginInline: 'var(--ax-space-1)' }} />
              {/* block inserts */}
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Quote"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15h15" /><path d="M21 19h-15" /><path d="M15 11h6" /><path d="M21 7h-6" /><path d="M9 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2" /><path d="M3 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert image"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Inline code"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg></button>
              <span className="ax-spacer" />
              {/* color swatches */}
              <div className="ax-cluster" style={{ gap: 4, marginInlineEnd: 'var(--ax-space-1)' }}>
                <button type="button" aria-label="Text color accent" style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--ax-border-strong)', background: 'var(--ax-accent)', cursor: 'pointer' }} />
                <button type="button" aria-label="Text color cyan" style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--ax-border-strong)', background: 'var(--ax-viz-cyan)', cursor: 'pointer' }} />
                <button type="button" aria-label="Text color pink" style={{ width: 18, height: 18, borderRadius: 5, border: '1px solid var(--ax-border-strong)', background: 'var(--ax-viz-pink)', cursor: 'pointer' }} />
              </div>
              <span className="ax-divider ax-divider--vertical" style={{ height: 22, marginInline: 'var(--ax-space-1)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Undo"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Redo"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 14l4 -4l-4 -4" /><path d="M19 10h-11a4 4 0 1 0 0 8h1" /></svg></button>
            </div>
            {/* editable surface (contenteditable demo content) */}
            <div contentEditable spellCheck={false} role="textbox" aria-multiline="true" aria-label="Article body" suppressContentEditableWarning
                 style={{ minHeight: 360, padding: 'var(--ax-space-6)', background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: '0 0 var(--ax-radius-md) var(--ax-radius-md)', color: 'var(--ax-text)', lineHeight: 1.7, fontSize: 'var(--ax-text-md)', outline: 'none' }}>
              <h2 style={{ fontFamily: 'var(--ax-font-display)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-xl)', margin: '0 0 .5em' }}>Designing for both light and dark</h2>
              <p style={{ margin: '0 0 1em' }}>A resilient interface earns its <strong style={{ color: 'var(--ax-text-strong)' }}>contrast</strong> from role tokens, not hard-coded hex. When every color resolves through a semantic variable, flipping the theme becomes a one-attribute change — and the same markup carries <em>twelve</em> accent presets for free.</p>
              <blockquote style={{ margin: '0 0 1em', padding: 'var(--ax-space-2) var(--ax-space-5)', borderInlineStart: '2px solid var(--ax-accent)', color: 'var(--ax-text-muted)', fontStyle: 'italic' }}>&quot;The fastest way to ship a dark mode is to never write a literal color in the first place.&quot;</blockquote>
              <p style={{ margin: '0 0 1em' }}>Use <code className="ax-code">var(--ax-surface)</code> for panels and <code className="ax-code">var(--ax-text-muted)</code> for supporting copy. The glass surfaces below blur whatever sits behind them, so the canvas tint reads through.</p>
              <ul style={{ margin: 0, paddingInlineStart: '1.25em', color: 'var(--ax-text)' }}>
                <li>Surfaces and borders read on both <code className="ax-code">#F6F8FC</code> and <code className="ax-code">#0A0C11</code>.</li>
                <li>Numerics stay tabular for clean column alignment.</li>
                <li>Decorative icons are hidden from assistive tech.</li>
              </ul>
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              <span className="ax-cluster" style={{ gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-viz-emerald)' }} />Autosaved 12s ago</span>
              <span>Sanitized HTML · paste cleaned automatically</span>
            </div>
          </div>
        </section>

        {/* ───── EDITOR SIDE RAIL ───── */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* meta */}
          <section className="ax-card" role="region" aria-label="Article meta">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Document</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ed-title">Title</label>
                <input id="ed-title" type="text" className="ax-input" defaultValue="Designing for both light and dark" />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ed-slug">Slug</label>
                <div className="ax-input-group">
                  <span className="ax-input-group__addon">/blog/</span>
                  <input id="ed-slug" type="text" className="ax-input" defaultValue="designing-for-light-and-dark" />
                </div>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ed-excerpt">Excerpt</label>
                <textarea id="ed-excerpt" className="ax-textarea" rows={3} maxLength={160} defaultValue="A field guide to token-driven theming that ships dark mode and twelve accents from a single source of truth." />
                <span className="ax-help">Used for previews &amp; meta description · 119 / 160</span>
              </div>
            </div>
          </section>
          {/* counters */}
          <section className="ax-card" role="region" aria-label="Document statistics">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Statistics</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>Words</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>248</div></div>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>Characters</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>1,486</div></div>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>Read time</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>1m</div></div>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>Headings</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>1</div></div>
            </div>
          </section>
        </aside>

        {/* ───── SOURCE / CODE VIEW (CodeMirror chrome) ───── */}
        <section className="ax-card ax-col--12" role="region" aria-label="Source editor">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">CodeMirror</span>
              <h2 className="ax-card__title">Source view</h2>
              <p className="ax-card__subtitle">Edit the underlying markup directly with syntax highlighting.</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-segment" role="tablist" aria-label="Source language">
                <button type="button" className={`ax-segment__option ${lang === 'html' ? 'is-active' : ''}`} onClick={() => setLang('html')} aria-selected={lang === 'html'} role="tab">HTML</button>
                <button type="button" className={`ax-segment__option ${lang === 'md' ? 'is-active' : ''}`} onClick={() => setLang('md')} aria-selected={lang === 'md'} role="tab">Markdown</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {/* code surface with gutter */}
            <div style={{ display: 'flex', background: 'var(--ax-surface-solid)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>
              {/* line-number gutter */}
              <div aria-hidden="true" style={{ flex: '0 0 auto', padding: 'var(--ax-space-4) var(--ax-space-3)', textAlign: 'end', color: 'var(--ax-text-subtle)', background: 'var(--ax-surface-subtle)', borderInlineEnd: '1px solid var(--ax-border)', userSelect: 'none' }}>
                {Array.from({ length: lang === 'html' ? 9 : 7 }, (_, i) => i + 1).map((n) => <div key={n}>{n}</div>)}
              </div>
              {/* code */}
              <div className="ax-scroll-x" style={{ flex: '1 1 auto', padding: 'var(--ax-space-4) var(--ax-space-4)', overflowX: 'auto' }}>
                {lang === 'html' && (
                  <pre style={{ margin: 0, whiteSpace: 'pre', color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>article</span> <span style={{ color: 'var(--ax-viz-amber)' }}>class</span><span style={{ color: 'var(--ax-text-subtle)' }}>=</span><span style={{ color: 'var(--ax-viz-emerald)' }}>&quot;post&quot;</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>{'\n'}  <span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>h2</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>Designing for both light and dark<span style={{ color: 'var(--ax-text-subtle)' }}>&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>h2</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>{'\n'}  <span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>p</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>A resilient interface earns its <span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>strong</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>contrast<span style={{ color: 'var(--ax-text-subtle)' }}>&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>strong</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>{'\n'}  from role tokens, not hard-coded hex.<span style={{ color: 'var(--ax-text-subtle)' }}>&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>p</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>{'\n'}  <span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>blockquote</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>{'\n'}    The fastest way to ship dark mode is to never{'\n'}    write a literal color in the first place.{'\n'}  <span style={{ color: 'var(--ax-text-subtle)' }}>&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>blockquote</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>{'\n'}<span style={{ color: 'var(--ax-text-subtle)' }}>&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>article</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span></pre>
                )}
                {lang === 'md' && (
                  <pre style={{ margin: 0, whiteSpace: 'pre', color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-viz-cyan)' }}>## </span><span style={{ color: 'var(--ax-text-strong)' }}>Designing for both light and dark</span>{'\n\n'}A resilient interface earns its <span style={{ color: 'var(--ax-viz-amber)' }}>**contrast**</span> from{'\n'}role tokens, not hard-coded hex.{'\n\n'}<span style={{ color: 'var(--ax-viz-cyan)' }}>&gt; </span>The fastest way to ship dark mode is to never{'\n'}<span style={{ color: 'var(--ax-viz-cyan)' }}>&gt; </span>write a literal color in the first place.</pre>
                )}
              </div>
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              <span className="ax-mono">Ln 3, Col 18 · spaces: 2</span>
              <span className="ax-mono">{lang === 'html' ? 'text/html · UTF-8' : 'text/markdown · UTF-8'}</span>
            </div>
          </div>
        </section>

      </div>
    </>
  );
}

export default Editor;
