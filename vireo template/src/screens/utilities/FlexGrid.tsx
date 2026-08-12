/*
 * Vireo Next.js — Utilities · Flex & grid.
 * 1:1 re-expression of src/html/utilities/flex-grid.html: the 12-column span
 * reference, the .ax-cluster inline helper (+ --between / .ax-spacer), the .ax-stack
 * column helper, a justify-content distribution matrix and an auto-fit card grid.
 * Static (no hooks/browser API) — stays a server component; PageHead is its own
 * client boundary.
 */
import { PageHead } from '../../components/shell/PageHead';

const SPAN_ROWS: number[][] = [[12], [6, 6], [8, 4], [4, 4, 4], [3, 3, 3, 3], [5, 7], [2, 2, 2, 2, 2, 2]];
const JUSTIFY = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const METRICS: [string, string, string][] = [
  ['Revenue', '$748K', '--ax-viz-cyan'],
  ['Orders', '1,248', '--ax-viz-violet'],
  ['AOV', '$59.95', '--ax-viz-pink'],
  ['Refunds', '3.1%', '--ax-viz-amber'],
  ['Sessions', '54.2K', '--ax-viz-emerald'],
  ['Bounce', '38%', '--ax-accent'],
];

export function FlexGrid() {
  return (
    <>
      <PageHead
        title="Flex & grid"
        subtitle="The 12-column .ax-dash-grid plus .ax-cluster / .ax-stack flex helpers — the only layout primitives you need."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/borders">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1 -2 2h-2" /><path d="M8 20h-2a2 2 0 0 1 -2 -2v-2" /><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /></svg>
              <span className="ax-btn__label">Borders</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/utilities/helpers">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" /><path d="M14.5 5.5l4 4" /><path d="M12 8l-5 -5l-4 4l5 5" /><path d="M7 8l-1.5 1.5" /><path d="M16 12l5 5l-4 4l-5 -5" /><path d="M16 17l-1.5 1.5" /></svg>
              <span className="ax-btn__label">Helpers</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* 12-col reference */}
        <section className="ax-card ax-col--12" role="region" aria-label="Twelve column grid spans">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-dash-grid · .ax-col--N</span>
              <h2 className="ax-card__title">12-column spans</h2>
              <p className="ax-card__subtitle">Every span that adds to 12. Auto-stacks to halves at 992px and full-width at 576px.</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">gutter · --ax-space-6</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            {SPAN_ROWS.map((row) => (
              <div key={row.join('-')} className="ax-dash-grid" style={{ gap: 'var(--ax-space-2)' }}>
                {row.map((n, idx) => (
                  <div key={idx} className={`ax-col--${n}`} style={{ display: 'grid', placeItems: 'center', height: 42, borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', color: 'var(--ax-accent)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                    <span>{`ax-col--${n}`}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="ax-card__footer">
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Resize the window to watch each row collapse responsively — no per-row media queries needed.</span>
          </div>
        </section>

        {/* Cluster */}
        <section className="ax-card ax-col--6" role="region" aria-label="Cluster flex helper">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-cluster</span>
              <h2 className="ax-card__title">Inline cluster</h2>
              <p className="ax-card__subtitle">Horizontal, wrapping, vertically-centered flow with a token gap. The workhorse of toolbars & meta rows.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ padding: 'var(--ax-space-3)', border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Design</span>
              {['Engineering', 'Product', 'Marketing', 'Finance', 'Operations'].map((t) => (
                <span key={t} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">{t}</span>
              ))}
            </div>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-cluster--between + .ax-spacer</span>
              <div className="ax-cluster ax-cluster--between" style={{ padding: 'var(--ax-space-3)', border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)' }}>
                <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Q2 report</b>
                <span className="ax-spacer" />
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><span className="ax-btn__label">Edit</span></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm"><span className="ax-btn__label">Share</span></button>
              </div>
            </div>
          </div>
        </section>

        {/* Stack */}
        <section className="ax-card ax-col--6" role="region" aria-label="Stack flex helper">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-stack</span>
              <h2 className="ax-card__title">Vertical stack</h2>
              <p className="ax-card__subtitle">Column flow with a consistent gap — perfect for form fields and list bodies.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-stack" style={{ '--ax-gap': 'var(--ax-space-3)' } as React.CSSProperties}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Two-factor auth</span>
                <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />On</span>
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Email digest</span>
                <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Weekly</span>
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Session timeout</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>30 min</span>
              </div>
            </div>
          </div>
        </section>

        {/* Flex alignment matrix */}
        <section className="ax-card ax-col--7" role="region" aria-label="Flex alignment examples">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">justify-content</span>
              <h2 className="ax-card__title">Distribution</h2>
              <p className="ax-card__subtitle">Common flex justifications, composed inline with role tokens.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {JUSTIFY.map((j) => (
              <div key={j}>
                <code className="ax-code" style={{ fontSize: 'var(--ax-text-2xs)' }}>{`justify-content: ${j}`}</code>
                <div style={{ display: 'flex', justifyContent: j, gap: 'var(--ax-space-2)', marginTop: 6, padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-surface-subtle)' }}>
                  <i aria-hidden="true" style={{ width: 30, height: 22, borderRadius: 6, background: 'var(--ax-accent)', opacity: 0.85 }} />
                  <i aria-hidden="true" style={{ width: 30, height: 22, borderRadius: 6, background: 'var(--ax-viz-cyan)', opacity: 0.85 }} />
                  <i aria-hidden="true" style={{ width: 30, height: 22, borderRadius: 6, background: 'var(--ax-viz-violet)', opacity: 0.85 }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Auto-fit grid */}
        <section className="ax-card ax-col--5" role="region" aria-label="Responsive auto-fit grid">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">auto-fit · minmax</span>
              <h2 className="ax-card__title">Card auto-grid</h2>
              <p className="ax-card__subtitle">Tiles reflow by available width with no breakpoints.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 'var(--ax-space-3)' }}>
              {METRICS.map((m) => (
                <div key={m[0]} style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                  <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{m[0]}</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-md)', color: `var(${m[2]})` }}>{m[1]}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default FlexGrid;
