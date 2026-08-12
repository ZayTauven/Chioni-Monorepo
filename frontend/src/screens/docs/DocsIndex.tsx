'use client';
/*
 * Vireo Next.js — Documentation (route "docs/index").
 * 1:1 re-expression of src/html/docs/index.html: a sticky TOC sidebar (active link
 * highlight), a doc body (getting-started hero, install terminal with copy button,
 * project structure, theming, components live example, charts live example via
 * <ApexChart>), and a rail (popular pages, FAQ accordion, help card). Alpine state
 * (active section, copied flag, accordion open) is ported to React useState.
 */
import { useState, type CSSProperties } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const TOC_LINK_BASE: CSSProperties = { gap: 'var(--ax-space-2)', padding: '6px var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' };

const GETTING_STARTED: [string, string][] = [['introduction', 'Introduction'], ['installation', 'Installation'], ['structure', 'Project structure']];
const CUSTOMIZATION: [string, string][] = [['theming', 'Theming & tokens'], ['components', 'Components'], ['charts', 'Charts']];

const FAQS: [number, string, string][] = [
  [1, 'Which frameworks are included?', 'Nine editions: HTML, React, Next, Vue, Nuxt, Angular, Laravel, Django and plain PHP — all from one design system.'],
  [2, 'Is dark mode automatic?', 'Yes. Because everything reads role tokens, dark mode is guaranteed-correct with no per-component work.'],
  [3, 'Can I use my own fonts?', 'Swap --ax-font-sans and --ax-font-display in your theme file. Type scale stays consistent.'],
];

export function DocsIndex() {
  const [active, setActive] = useState('introduction');
  const [copied, setCopied] = useState('');
  const [open, setOpen] = useState(1);

  function TocLink({ id, label }: { id: string; label: string }) {
    return (
      <a href={`#${id}`} onClick={() => setActive(id)} className="ax-cluster"
        style={{ ...TOC_LINK_BASE, ...(active === id ? { background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' } : { color: 'var(--ax-text-muted)' }) }}>
        {label}
      </a>
    );
  }

  return (
    <>
      <PageHead
        title="Documentation"
        subtitle="Everything you need to install, theme & extend Vireo. Version 1.0.0."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4l3 3" /></svg>
              <span className="ax-btn__label">Changelog</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Download v1.0.0</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* TOC SIDEBAR (3) */}
        <aside className="ax-card ax-col--3" role="navigation" aria-label="On this page" style={{ alignSelf: 'start', position: 'sticky', top: 'var(--ax-space-5)' }}>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input ax-input--sm" placeholder="Search docs…" style={{ paddingInlineStart: 34 }} aria-label="Search documentation" />
              <kbd className="ax-kbd" style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)' }}>⌘K</kbd>
            </div>
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Getting started</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {GETTING_STARTED.map(([id, label]) => <li key={id}><TocLink id={id} label={label} /></li>)}
              </ul>
            </div>
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Customization</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {CUSTOMIZATION.map(([id, label]) => <li key={id}><TocLink id={id} label={label} /></li>)}
              </ul>
            </div>
            <div className="ax-label" style={{ marginBottom: 0 }}>Resources</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '-8px 0 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <li><a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: '6px var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Changelog</a></li>
              <li><a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: '6px var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Support<svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginInlineStart: 'auto' }}><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg></a></li>
            </ul>
          </div>
        </aside>

        {/* DOC BODY (6) */}
        <div className="ax-col--6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* HERO / GETTING STARTED */}
          <section className="ax-card ax-card--accent-edge" role="region" aria-label="Getting started" id="introduction">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ alignSelf: 'flex-start' }}>Getting started</span>
              <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.2 }}>Build premium admin UIs in minutes</h2>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-md)', lineHeight: 1.7 }}>Vireo is a token-driven admin template that ships nine framework editions, light & dark themes, twelve accents and a live customizer — all from a single role-token layer. This guide gets you from zero to a running dashboard.</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', marginTop: 'var(--ax-space-1)' }}>
                <a href="#installation" onClick={() => setActive('installation')} className="ax-btn ax-btn--primary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg><span className="ax-btn__label">Quick start</span></a>
                <a href="#components" onClick={() => setActive('components')} className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Browse components</span></a>
              </div>
            </div>
          </section>

          {/* INSTALLATION */}
          <section className="ax-card" role="region" aria-label="Installation" id="installation">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 1</span><h2 className="ax-card__title">Installation</h2><p className="ax-card__subtitle">Node 18+ and a package manager are all you need.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>Clone the HTML edition, install dependencies and start the dev server. Vite watches your files and Tailwind compiles on the fly.</p>
              <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-surface)' }}>
                  <span className="ax-cluster" style={{ gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ax-danger-500)' }} /><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ax-warning-500)' }} /><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ax-success-500)' }} /></span>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => { setCopied('install'); setTimeout(() => setCopied(''), 1600); }} aria-label="Copy install commands">
                    {copied !== 'install'
                      ? <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                      : <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-viz-emerald)' }}><path d="M5 12l5 5l10 -10" /></svg>}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: 'var(--ax-space-4)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', lineHeight: 1.9, color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-text-subtle)' }}># install dependencies</span>{'\n'}<span style={{ color: 'var(--ax-viz-emerald)' }}>$</span> npm install{'\n'}<span style={{ color: 'var(--ax-text-subtle)' }}># start the dev server</span>{'\n'}<span style={{ color: 'var(--ax-viz-emerald)' }}>$</span> npm run dev{'\n'}<span style={{ color: 'var(--ax-viz-cyan)' }}>  ➜  Local:</span>   http://localhost:5173/</pre>
              </div>
              <div className="ax-alert ax-alert--info" role="note" style={{ margin: 0 }}>
                <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9h.01" /><path d="M11 12h1v4h1" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__title">Use any package manager</p><p className="ax-alert__message"><code className="ax-code">pnpm</code>, <code className="ax-code">yarn</code> and <code className="ax-code">bun</code> all work — the lockfile is the only thing that differs.</p></div>
              </div>
            </div>
          </section>

          {/* PROJECT STRUCTURE */}
          <section className="ax-card" role="region" aria-label="Project structure" id="structure">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 2</span><h2 className="ax-card__title">Project structure</h2><p className="ax-card__subtitle">Where everything lives.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <pre style={{ margin: 0, padding: 'var(--ax-space-4)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', lineHeight: 1.85, color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-viz-amber)' }}>src/</span>{'\n'}├─ <span style={{ color: 'var(--ax-viz-amber)' }}>html/</span>      <span style={{ color: 'var(--ax-text-subtle)' }}>— pages &amp; partials</span>{'\n'}├─ <span style={{ color: 'var(--ax-viz-amber)' }}>styles/</span>    <span style={{ color: 'var(--ax-text-subtle)' }}>— tokens, components, shell</span>{'\n'}│  ├─ <span style={{ color: 'var(--ax-viz-cyan)' }}>tokens/</span>  <span style={{ color: 'var(--ax-text-subtle)' }}>— the role layer (edit themes here)</span>{'\n'}│  └─ <span style={{ color: 'var(--ax-viz-cyan)' }}>components.css</span>{'\n'}└─ <span style={{ color: 'var(--ax-viz-amber)' }}>js/</span>        <span style={{ color: 'var(--ax-text-subtle)' }}>— alpine + chart wrapper</span></pre>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', listStyle: 'none', padding: 0, margin: 0 }}>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-accent)' }} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}><code className="ax-code">styles/tokens/</code> is the only place you change colours — never edit component files.</span></li>
                <li className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}><span style={{ flex: 'none', marginTop: 7, width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-viz-cyan)' }} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', lineHeight: 1.6 }}>Pages live under <code className="ax-code">html/&lt;category&gt;/&lt;slug&gt;.html</code> and pull in shared partials.</span></li>
              </ul>
            </div>
          </section>

          {/* THEMING */}
          <section className="ax-card" role="region" aria-label="Theming" id="theming">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Theming & tokens</h2><p className="ax-card__subtitle">One variable swap retheme everything.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>Components reference <b style={{ color: 'var(--ax-text-strong)' }}>role tokens</b> only. Change the accent on <code className="ax-code">:root</code> and every button, link and chart retheme at once — in light, dark, and all twelve accents.</p>
              <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-surface)' }}><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>my-theme.css</span></div>
                <pre style={{ margin: 0, padding: 'var(--ax-space-4)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', lineHeight: 1.75, color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-viz-violet)' }}>:root</span> {'{'}{'\n'}  <span style={{ color: 'var(--ax-viz-cyan)' }}>--ax-accent</span>: <span style={{ color: 'var(--ax-viz-emerald)' }}>#14b8a6</span>;       <span style={{ color: 'var(--ax-text-subtle)' }}>/* teal */</span>{'\n'}  <span style={{ color: 'var(--ax-viz-cyan)' }}>--ax-radius-md</span>: <span style={{ color: 'var(--ax-viz-emerald)' }}>12px</span>;{'\n'}{'}'}</pre>
              </div>
              <div className="ax-alert ax-alert--warning" role="note" style={{ margin: 0 }}>
                <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__title">Never hard-code colours</p><p className="ax-alert__message">Raw hex in component markup only works in one theme. Always reference a role token via <code className="ax-code">var(--ax-*)</code>.</p></div>
              </div>
            </div>
          </section>

          {/* COMPONENTS */}
          <section className="ax-card" role="region" aria-label="Components" id="components">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Components</h2><p className="ax-card__subtitle">Copy-paste building blocks.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>Compose pages from existing primitives. Here's a primary button — the icon is decorative, the label carries meaning.</p>
              <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: 'var(--ax-space-5)', display: 'grid', placeItems: 'center', background: 'var(--ax-canvas)' }}>
                  <button type="button" className="ax-btn ax-btn--primary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">New report</span></button>
                </div>
                <pre style={{ margin: 0, padding: 'var(--ax-space-4)', borderTop: '1px solid var(--ax-border)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', lineHeight: 1.7, color: 'var(--ax-text)', background: 'var(--ax-surface-subtle)' }}><span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>button</span> <span style={{ color: 'var(--ax-viz-cyan)' }}>class</span>=<span style={{ color: 'var(--ax-viz-emerald)' }}>"ax-btn ax-btn--primary"</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span>…<span style={{ color: 'var(--ax-text-subtle)' }}>&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>button</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span></pre>
              </div>
            </div>
          </section>

          {/* CHARTS */}
          <section className="ax-card" role="region" aria-label="Charts" id="charts">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Charts</h2><p className="ax-card__subtitle">Themed, dark-mode-aware, retheme on the fly.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>Charts go through one wrapper so they inherit the palette automatically. The simplest path is a declarative data attribute:</p>
              <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <pre style={{ margin: 0, padding: 'var(--ax-space-4)', overflowX: 'auto', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', lineHeight: 1.7, color: 'var(--ax-text)' }}><span style={{ color: 'var(--ax-text-subtle)' }}>&lt;</span><span style={{ color: 'var(--ax-viz-pink)' }}>div</span> <span style={{ color: 'var(--ax-viz-cyan)' }}>class</span>=<span style={{ color: 'var(--ax-viz-emerald)' }}>"ax-chart"</span> <span style={{ color: 'var(--ax-viz-cyan)' }}>data-ax-chart</span>{'\n'}     <span style={{ color: 'var(--ax-viz-cyan)' }}>data-ax-chart-type</span>=<span style={{ color: 'var(--ax-viz-emerald)' }}>"area"</span>{'\n'}     <span style={{ color: 'var(--ax-viz-cyan)' }}>data-ax-chart-series</span>=<span style={{ color: 'var(--ax-viz-emerald)' }}>'[…]'</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;&lt;/</span><span style={{ color: 'var(--ax-viz-pink)' }}>div</span><span style={{ color: 'var(--ax-text-subtle)' }}>&gt;</span></pre>
              </div>
              <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>And here it is, live:</p>
              <ApexChart className="ax-chart" type="area" height={180} legend="none" accent
                ariaLabel="Example area chart of documentation reads"
                series={[{ name: 'Reads', data: [31, 40, 28, 51, 42, 62, 69, 74] }]} />
              <div className="ax-alert ax-alert--success" role="note" style={{ margin: 0 }}>
                <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__title">It just re-themes</p><p className="ax-alert__message">Toggle dark mode or change the accent in the customizer — the chart above updates instantly, no code change required.</p></div>
              </div>
            </div>
          </section>
        </div>

        {/* RAIL (3) */}
        <aside className="ax-col--3" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* quick links */}
          <section className="ax-card" role="region" aria-label="Popular pages" style={{ alignSelf: 'start', position: 'sticky', top: 'var(--ax-space-5)' }}>
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Popular pages</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
              <a href="#theming" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-accent) 18%,transparent)', color: 'var(--ax-accent)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h1a1 1 0 0 1 1 1c0 4.97 -4.03 9 -9 9a9 9 0 0 1 0 -18" /><path d="M8.5 8.5l0 .01" /><path d="M6 12l0 .01" /><path d="M8.5 15.5l0 .01" /></svg></span>
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Theming guide</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Tokens & accents</span></span>
              </a>
              <a href="#components" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h.01" /><path d="M7 12a5 5 0 0 1 5 -5" /><path d="M12 3a9 9 0 0 1 9 9" /></svg></span>
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Component API</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Classes & modifiers</span></span>
              </a>
              <a href="#charts" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="M20 18v-13" /><path d="M16 18v-7" /><path d="M12 18v-10" /><path d="M8 18v-4" /></svg></span>
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Chart wrapper</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>renderChart() API</span></span>
              </a>
            </div>
          </section>

          {/* FAQ accordion */}
          <section className="ax-card" role="region" aria-label="Frequently asked">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Quick answers</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div className="ax-accordion">
                {FAQS.map(([n, q, a]) => (
                  <div key={n} className="ax-accordion__item">
                    <button type="button" className="ax-accordion__header" aria-expanded={open === n} onClick={() => setOpen(open === n ? 0 : n)}>
                      <span className="ax-accordion__title">{q}</span>
                      <svg className="ax-accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                    </button>
                    <div className="ax-accordion__panel" hidden={open !== n} style={{ padding: '0 var(--ax-space-4) var(--ax-space-4)' }}><p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>{a}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* help card */}
          <section className="ax-card ax-card--accent-edge" role="region" aria-label="Need help">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', margin: '0 auto' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-7l-4 4v-4h-3a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1" /></svg></span>
              <h3 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 600, color: 'var(--ax-text-strong)' }}>Still stuck?</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.55 }}>Our team replies to support tickets within one business day.</p>
              <a href="/pages/support" className="ax-btn ax-btn--primary ax-btn--block"><span className="ax-btn__label">Contact support</span></a>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default DocsIndex;
