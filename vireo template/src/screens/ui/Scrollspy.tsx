'use client';
/*
 * Vireo Next.js — UI · Scrollspy (route "ui/scrollspy").
 *
 * Faithful re-expression of src/html/ui/scrollspy.html: a sticky table-of-contents
 * that tracks scroll position of a scrollable doc panel with an IntersectionObserver
 * — the active section lights up and links smooth-scroll into view. The reference's
 * Alpine init()/go() are re-expressed with a ref'd scroller + IO in useEffect; the
 * "charts" section renders an <ApexChart>. Reduced-motion honoured. DOM/classes/
 * ARIA/inline styles/copy match 1:1.
 */
import { useEffect, useRef, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const SECTIONS = ['introduction', 'installation', 'tokens', 'components', 'charts', 'accessibility'];

export function Scrollspy() {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState('introduction');

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    );
    SECTIONS.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const go = (id: string) => {
    setActive(id);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  const cap = active.charAt(0).toUpperCase() + active.slice(1);

  return (
    <>
      <PageHead
        title="Scrollspy"
        subtitle="A sticky table-of-contents that tracks scroll position with an IntersectionObserver — the active section lights up and links scroll smoothly into view."
        actions={
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
            <span className="ax-btn__label">On this page</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {/* Sticky TOC */}
        <aside className="ax-card ax-col--4" role="region" aria-label="On this page navigation" style={{ position: 'sticky', top: 'calc(var(--ax-header-h) + var(--ax-space-6))', alignSelf: 'start' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Contents</span>
              <h2 className="ax-card__title">On this page</h2>
              <p className="ax-card__subtitle">Tracks the section in view as you scroll the panel.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav aria-label="Section navigation">
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2, borderInlineStart: '2px solid var(--ax-border)' }}>
                {SECTIONS.map((id) => {
                  const on = active === id;
                  return (
                    <li key={id}>
                      <a href="#" onClick={(e) => { e.preventDefault(); go(id); }}
                        aria-current={on ? 'true' : undefined}
                        style={{
                          display: 'block', padding: 'var(--ax-space-2) var(--ax-space-3)', marginInlineStart: -2,
                          fontSize: 'var(--ax-text-sm)', textDecoration: 'none', borderRadius: '0 var(--ax-radius-sm) var(--ax-radius-sm) 0',
                          textTransform: 'capitalize', transition: 'color var(--ax-motion-fast) var(--ax-ease-standard),background var(--ax-motion-fast) var(--ax-ease-standard)',
                          ...(on
                            ? { color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)', boxShadow: 'inset 2px 0 0 var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)' }
                            : { color: 'var(--ax-text-muted)' }),
                        }}>{id}</a>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="ax-divider" style={{ marginBlock: 'var(--ax-space-4)' }} />
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
              Reading <b style={{ color: 'var(--ax-text)', textTransform: 'capitalize' }}>{active}</b> ·{' '}
              <span className="ax-num">{SECTIONS.indexOf(active) + 1}</span> of <span className="ax-num">{SECTIONS.length}</span>
            </p>
          </div>
        </aside>

        {/* Scrollable content */}
        <section className="ax-card ax-col--8" role="region" aria-label="Scrollspy content">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Documentation</span>
              <h2 className="ax-card__title">Getting started with Vireo</h2>
              <p className="ax-card__subtitle">Scroll inside this panel — the contents rail follows along.</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">{cap}</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div ref={scroller} className="ax-scroll-y" style={{ maxBlockSize: '62vh', paddingInlineEnd: 'var(--ax-space-3)' }}>
              <section id="introduction" style={{ scrollMarginTop: 'var(--ax-space-4)', paddingBlock: 'var(--ax-space-3) var(--ax-space-6)' }}>
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Introduction</h3>
                <p style={{ margin: '0 0 var(--ax-space-3)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>Vireo is a premium admin template that ships nine framework editions from one design system. Every surface is defined as a role token, so light, dark and twelve accent presets all retheme without touching component code.</p>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>This guide walks through installing the kit, the token layers, the component vocabulary, charts, and the accessibility guarantees baked in.</p>
              </section>
              <div className="ax-divider" />

              <section id="installation" style={{ scrollMarginTop: 'var(--ax-space-4)', paddingBlock: 'var(--ax-space-6)' }}>
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Installation</h3>
                <p style={{ margin: '0 0 var(--ax-space-3)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>Clone the repository and install dependencies. The HTML edition is powered by Vite, Tailwind v4 and Alpine.js.</p>
                <pre className="ax-scroll-x" style={{ margin: 0, padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', overflowX: 'auto' }}><code><span style={{ color: 'var(--ax-text-subtle)' }}># install &amp; run</span>{'\n'}npm install{'\n'}npm run dev</code></pre>
              </section>
              <div className="ax-divider" />

              <section id="tokens" style={{ scrollMarginTop: 'var(--ax-space-4)', paddingBlock: 'var(--ax-space-6)' }}>
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Tokens</h3>
                <p style={{ margin: '0 0 var(--ax-space-3)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>Three layers compose the system: raw scales, semantic role tokens, and recipe gradients. Pages only ever reference the role layer.</p>
                <ul style={{ margin: 0, paddingInlineStart: '1.2em', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>
                  <li><code className="ax-code">--ax-surface</code> — glass panel background</li>
                  <li><code className="ax-code">--ax-text-muted</code> — secondary copy</li>
                  <li><code className="ax-code">--ax-accent</code> — the live accent, one of twelve</li>
                  <li><code className="ax-code">--ax-viz-cyan</code> — constant chart color</li>
                </ul>
              </section>
              <div className="ax-divider" />

              <section id="components" style={{ scrollMarginTop: 'var(--ax-space-4)', paddingBlock: 'var(--ax-space-6)' }}>
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Components</h3>
                <p style={{ margin: '0 0 var(--ax-space-3)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>Over sixty BEM-named blocks cover buttons, cards, tables, forms, navigation and overlays. Compose pages from these primitives — never invent new classes.</p>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <button type="button" className="ax-btn ax-btn--primary ax-btn--sm"><span className="ax-btn__label">Button</span></button>
                  <span className="ax-badge ax-badge--soft ax-badge--success">Badge</span>
                  <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">AX</span></span>
                </div>
              </section>
              <div className="ax-divider" />

              <section id="charts" style={{ scrollMarginTop: 'var(--ax-space-4)', paddingBlock: 'var(--ax-space-6)' }}>
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Charts</h3>
                <p style={{ margin: '0 0 var(--ax-space-3)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>ApexCharts renders through a single wrapper that reads colors from CSS variables, so every chart re-themes live alongside the rest of the UI.</p>
                <ApexChart type="area" height={180} legend="none" accent ariaLabel="Area chart of monthly revenue trending upward" series={[{ name: 'Revenue', data: [42, 48, 45, 53, 57, 55, 62, 60, 69, 72, 70, 75] }]} />
              </section>
              <div className="ax-divider" />

              <section id="accessibility" style={{ scrollMarginTop: 'var(--ax-space-4)', paddingBlock: 'var(--ax-space-6) var(--ax-space-3)' }}>
                <h3 style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Accessibility</h3>
                <p style={{ margin: '0 0 var(--ax-space-3)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>One H1 per page, landmark regions, labelled icon buttons, visible focus rings and reduced-motion fallbacks ship by default. This scrollspy itself respects <code className="ax-code">prefers-reduced-motion</code> by switching to instant scrolling.</p>
                <div className="ax-alert ax-alert--success ax-alert--accent-edge">
                  <span className="ax-alert__icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-alert__content"><p className="ax-alert__message" style={{ margin: 0 }}>You&rsquo;ve reached the end — the last item stays active.</p></div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Scrollspy;
