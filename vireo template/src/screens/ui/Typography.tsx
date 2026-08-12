'use client';
/*
 * Vireo Next.js — UI · Typography (route "ui/typography").
 *
 * Faithful re-expression of src/html/ui/typography.html: the Aurora type scale,
 * typefaces, headings, lead/body prose, inline elements, blockquote, lists and a
 * syntax-highlighted code block. The reference's lone Alpine bit is the "Copy"
 * button ($toast); re-expressed with a tiny click handler + native clipboard.
 * DOM classes / ARIA / copy match the reference 1:1.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Breadcrumb } from '../../components/shell/Breadcrumb';
import { slugFromPath } from '../../lib/manifest';

function ScaleRow({ children, token }: { children: React.ReactNode; token: string }) {
  return (
    <div className="ax-cluster ax-cluster--between" style={{ flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
      {children}
      <code className="ax-code" style={{ flex: '0 0 auto' }}>{token}</code>
    </div>
  );
}

export function Typography() {
  const slug = slugFromPath(usePathname() || '/');
  const copy = () => {
    navigator.clipboard?.writeText("renderChart(el, 'area', series)");
  };
  return (
    <>
      <div className="ax-page-head">
        <div className="ax-page-head__row">
          <div>
            <Breadcrumb slug={slug} />
            <h1 className="ax-page-head__title">Typography</h1>
            <p className="ax-page-head__subtitle">The Aurora type system — Space Grotesk display, Inter body, JetBrains Mono numerics — sized entirely from the <code className="ax-code">--ax-text-*</code> scale.</p>
          </div>
          <div className="ax-page-head__actions">
            <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/links">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg>
              <span className="ax-btn__label">Links</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="ax-dash-grid">

        {/* Type scale */}
        <section className="ax-card ax-col--8" role="region" aria-label="Type scale">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Scale</span>
              <h2 className="ax-card__title">Type scale</h2>
              <p className="ax-card__subtitle">Nine steps from 2xs to 3xl. Token name on the right, rendered size on the left.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <ScaleRow token="--ax-text-3xl"><span style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 'var(--ax-weight-bold)', letterSpacing: '-0.02em', color: 'var(--ax-text-strong)', lineHeight: 1.05 }}>Aperture Goods</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-2xl"><span style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-bold)', letterSpacing: '-0.015em', color: 'var(--ax-text-strong)' }}>Quarterly review</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-xl"><span style={{ fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Revenue is trending up</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-lg"><span style={{ fontSize: 'var(--ax-text-lg)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Northwind Labs dashboard</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-md"><span style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-text)' }}>Body copy at the medium step</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-sm"><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Secondary &amp; supporting text</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-xs"><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Captions, meta &amp; helper lines</span></ScaleRow>
            <div className="ax-divider" />
            <ScaleRow token="--ax-text-2xs"><span style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--ax-text-subtle)' }}>Eyebrow &amp; overline labels</span></ScaleRow>
          </div>
        </section>

        {/* Font families */}
        <section className="ax-card ax-col--4" role="region" aria-label="Font families">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Families</span>
              <h2 className="ax-card__title">Typefaces</h2>
              <p className="ax-card__subtitle">Three roles, one cohesive voice.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-2)' }}>Display · Space Grotesk</div>
              <div style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)', letterSpacing: '-0.015em' }}>Ag 0123</div>
            </div>
            <div className="ax-divider" />
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-2)' }}>Sans · Inter</div>
              <div style={{ fontFamily: 'var(--ax-font-sans)', fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)' }}>Ag 0123</div>
            </div>
            <div className="ax-divider" />
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-2)' }}>Mono · JetBrains Mono</div>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)' }}>Ag 0123</div>
            </div>
          </div>
        </section>

        {/* Headings */}
        <section className="ax-card ax-col--6" role="region" aria-label="Headings">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Hierarchy</span>
              <h2 className="ax-card__title">Headings</h2>
              <p className="ax-card__subtitle">h2–h6 (the single h1 is the page title above).</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-bold)', letterSpacing: '-0.015em', color: 'var(--ax-text-strong)' }}>Heading level 2</h2>
            <h3 style={{ margin: 0, fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Heading level 3</h3>
            <h4 style={{ margin: 0, fontSize: 'var(--ax-text-lg)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Heading level 4</h4>
            <h5 style={{ margin: 0, fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Heading level 5</h5>
            <h6 style={{ margin: 0, fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-semibold)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-muted)' }}>Heading level 6</h6>
          </div>
        </section>

        {/* Lead & paragraph */}
        <section className="ax-card ax-col--6" role="region" aria-label="Lead and body paragraphs">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Prose</span>
              <h2 className="ax-card__title">Lead &amp; body</h2>
              <p className="ax-card__subtitle">An opening lead line, then default running copy.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-lg)', lineHeight: 1.5, color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>
              Vireo ships nine dashboard editions from one design system, so a Sales view feels identical whether it renders in React, Vue, or Laravel.
            </p>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-md)', lineHeight: 1.65, color: 'var(--ax-text-muted)' }}>
              Every surface resolves to a role token, which is why all twelve accent presets retheme with no extra CSS. Body copy sits at the medium step with comfortable leading; the lead line above carries slightly more weight and air to anchor the section.
            </p>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
              Small print and disclaimers settle at the subtle tier — present, but never competing for attention.
            </p>
          </div>
        </section>

        {/* Inline elements */}
        <section className="ax-card ax-col--6" role="region" aria-label="Inline elements">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Within a line</span>
              <h2 className="ax-card__title">Inline elements</h2>
              <p className="ax-card__subtitle">Emphasis, marks, code, keys &amp; small-print.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', fontSize: 'var(--ax-text-md)', lineHeight: 1.7, color: 'var(--ax-text)' }}>
            <p style={{ margin: 0 }}>You can use <strong style={{ color: 'var(--ax-text-strong)' }}>bold</strong>, <em>italic</em>, <u style={{ textUnderlineOffset: '2px' }}>underline</u> and <s style={{ color: 'var(--ax-text-subtle)' }}>strikethrough</s> for emphasis.</p>
            <p style={{ margin: 0 }}>Highlight a phrase with <mark className="ax-mark">the accent mark</mark>, or annotate with <abbr title="Average Order Value" style={{ textDecoration: 'underline dotted', textUnderlineOffset: '3px', cursor: 'help' }}>AOV</abbr>.</p>
            <p style={{ margin: 0 }}>Reference inline code like <code className="ax-code">renderChart()</code> or a keystroke: press <kbd className="ax-kbd">⌘</kbd> <kbd className="ax-kbd">K</kbd> to search.</p>
            <p style={{ margin: 0 }}>Show ledger figures in mono: <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$48,210.00</span> with a <span className="ax-num" style={{ color: 'var(--ax-viz-emerald)' }}>▲ 12.4%</span> delta.</p>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Use <sup>superscript</sup> and <sub>subscript</sub> for footnotes and formulas, and <small style={{ color: 'var(--ax-text-subtle)' }}>small text</small> for legal lines.</p>
          </div>
        </section>

        {/* Blockquote */}
        <section className="ax-card ax-col--6" role="region" aria-label="Blockquote">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Quotation</span>
              <h2 className="ax-card__title">Blockquote</h2>
              <p className="ax-card__subtitle">An accent edge, larger leading, attributed source.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <blockquote style={{ margin: 0, padding: 'var(--ax-space-2) 0 var(--ax-space-2) var(--ax-space-5)', borderInlineStart: '3px solid var(--ax-accent)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-lg)', lineHeight: 1.55, color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>
                We replaced four bespoke admin builds with Vireo and shipped the new billing flow in a single sprint — the token system did most of the work.
              </p>
              <footer style={{ marginTop: 'var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                — <cite style={{ fontStyle: 'normal', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text)' }}>Marcus Reyes</cite>, Engineering Manager at Northwind Labs
              </footer>
            </blockquote>
          </div>
        </section>

        {/* Lists */}
        <section className="ax-card ax-col--12" role="region" aria-label="Lists">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Enumeration</span>
              <h2 className="ax-card__title">Lists</h2>
              <p className="ax-card__subtitle">Unordered, ordered, description &amp; check lists.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 'var(--ax-space-6)' }}>
            {/* Unordered */}
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-3)' }}>Unordered</div>
              <ul style={{ margin: 0, paddingInlineStart: '1.2em', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>
                <li>Lazy-loaded chart plugins</li>
                <li>Twelve accent presets
                  <ul style={{ margin: 'var(--ax-space-1) 0 0', paddingInlineStart: '1.2em', color: 'var(--ax-text-muted)' }}>
                    <li>Light &amp; dark per accent</li>
                    <li>RTL mirroring</li>
                  </ul>
                </li>
                <li>Reduced-motion fallbacks</li>
              </ul>
            </div>
            {/* Ordered */}
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-3)' }}>Ordered</div>
              <ol style={{ margin: 0, paddingInlineStart: '1.3em', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>
                <li>Scaffold the app shell</li>
                <li>Drop in the flagship dashboard</li>
                <li>Wire the customizer</li>
                <li>Ship to ThemeForest</li>
              </ol>
            </div>
            {/* Description */}
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-3)' }}>Description</div>
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', fontSize: 'var(--ax-text-sm)' }}>
                <div><dt style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Revenue</dt><dd style={{ margin: '2px 0 0', color: 'var(--ax-text-muted)' }}>Gross sales before refunds.</dd></div>
                <div><dt style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>AOV</dt><dd style={{ margin: '2px 0 0', color: 'var(--ax-text-muted)' }}>Average order value, trailing 30 days.</dd></div>
                <div><dt style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Churn</dt><dd style={{ margin: '2px 0 0', color: 'var(--ax-text-muted)' }}>Share of customers lost this month.</dd></div>
              </dl>
            </div>
            {/* Checklist */}
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-3)' }}>Checklist</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>
                <li style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'flex-start' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ax-viz-emerald)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: '1px' }}><path d="M5 12l5 5l10 -10" /></svg>Dark mode verified</li>
                <li style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'flex-start' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ax-viz-emerald)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: '1px' }}><path d="M5 12l5 5l10 -10" /></svg>Keyboard navigable</li>
                <li style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'flex-start', color: 'var(--ax-text-subtle)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: '1px' }}><path d="M5 12l14 0" /></svg>RTL audit pending</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Code block */}
        <section className="ax-card ax-col--12" role="region" aria-label="Code block and preformatted text">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Monospace</span>
              <h2 className="ax-card__title">Code block</h2>
              <p className="ax-card__subtitle">Pre-formatted, scrollable, mono with a subtle surface.</p>
            </div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={copy}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
              <span className="ax-btn__label">Copy</span>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <pre style={{ margin: 0, padding: 'var(--ax-space-4) var(--ax-space-5)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7, color: 'var(--ax-text)' }} className="ax-scroll-x"><code>
              <span style={{ color: 'var(--ax-text-subtle)' }}>// Render the Aurora area chart from the shared wrapper</span>{'\n'}
              <span style={{ color: 'var(--ax-viz-violet)' }}>import</span>{' { renderChart } '}<span style={{ color: 'var(--ax-viz-violet)' }}>from</span>{' '}<span style={{ color: 'var(--ax-viz-emerald)' }}>&apos;/src/js/plugins/charts.js&apos;</span>;{'\n\n'}
              <span style={{ color: 'var(--ax-viz-violet)' }}>const</span>{' el = document.'}<span style={{ color: 'var(--ax-viz-cyan)' }}>getElementById</span>(<span style={{ color: 'var(--ax-viz-emerald)' }}>&apos;revenue&apos;</span>);{'\n'}
              <span style={{ color: 'var(--ax-viz-cyan)' }}>renderChart</span>(el, <span style={{ color: 'var(--ax-viz-emerald)' }}>&apos;area&apos;</span>, series, {'{ height: '}<span className="ax-num">320</span>{' }'});
            </code></pre>
          </div>
        </section>

      </div>
    </>
  );
}

export default Typography;
