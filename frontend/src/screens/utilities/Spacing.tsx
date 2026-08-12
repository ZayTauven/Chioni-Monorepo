'use client';
/*
 * Vireo Next.js — Utilities · Spacing scale.
 * 1:1 re-expression of src/html/utilities/spacing.html: the 4px-based --ax-space-N
 * ruler (click a row to copy), a nesting padding demo, gap tokens, .ax-stack
 * vertical rhythm and a snap-to-the-scale info alert.
 */
import { PageHead } from '../../components/shell/PageHead';
import { useCopyFlash } from './utilShared';

const SCALE: [number, string, string][] = [
  [1, '4px', 'icon ↔ label, chip inner'],
  [2, '8px', 'cluster gap, badge pad'],
  [3, '12px', 'list-row gap, control pad'],
  [4, '16px', 'card sub-stacks, mobile gutter'],
  [5, '20px', 'section blocks'],
  [6, '24px', 'card padding · grid gutter'],
  [8, '32px', 'card → card vertical'],
  [10, '40px', 'page-section breaks'],
  [12, '48px', 'footer height'],
  [16, '64px', 'hero whitespace'],
  [20, '80px', 'empty-state padding'],
];
const GAPS: [string, string][] = [['--ax-space-2', '8'], ['--ax-space-3', '12'], ['--ax-space-4', '16'], ['--ax-space-6', '24']];

export function Spacing() {
  const { flash, copy } = useCopyFlash();
  return (
    <>
      <PageHead
        title="Spacing scale"
        subtitle="A single 4px-based rhythm — --ax-space-1 through --ax-space-20 — drives every gap, pad and margin."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/colors">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /><path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
              <span className="ax-btn__label">Color tokens</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/utilities/borders">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1 -2 2h-2" /><path d="M8 20h-2a2 2 0 0 1 -2 -2v-2" /><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /></svg>
              <span className="ax-btn__label">Borders & radius</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* The ruler */}
        <section className="ax-card ax-col--8" role="region" aria-label="Spacing scale ruler">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">--ax-space-N</span>
              <h2 className="ax-card__title">The scale</h2>
              <p className="ax-card__subtitle">Geometric-ish steps tuned for dense admin UIs. Click any row to copy its token.</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">base · 4px</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
            {SCALE.map((s) => {
              const token = `--ax-space-${s[0]}`;
              return (
                <button key={s[0]} type="button" onClick={() => copy(token)} className="ax-cluster"
                  style={{ width: '100%', flexWrap: 'nowrap', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-3)', border: '1px solid transparent', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer', textAlign: 'start' }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--ax-fill-hover)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  aria-label={`Copy ${token}`}>
                  <code className="ax-num" style={{ flex: '0 0 92px', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>{flash === token ? 'Copied!' : token}</code>
                  <span className="ax-num" style={{ flex: '0 0 44px', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textAlign: 'end' }}>{s[1]}</span>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', height: 14, borderRadius: 'var(--ax-radius-xs)', background: 'var(--ax-accent)', opacity: 0.85, width: `var(${token})` }} />
                  <span className="ax-truncate" style={{ flex: '1 1 auto', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s[2]}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Padding tokens live demo */}
        <section className="ax-card ax-col--4" role="region" aria-label="Padding nesting demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Nesting</span>
              <h2 className="ax-card__title">Padding in practice</h2>
              <p className="ax-card__subtitle">How the steps nest in a real card.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-6)' }}>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-3)' }}>padding: --ax-space-6</span>
              <div style={{ border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', background: 'var(--ax-surface-subtle)' }}>
                <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-3)' }}>padding: --ax-space-4</span>
                <div style={{ border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-sm)', padding: 'var(--ax-space-2)', background: 'var(--ax-accent-wash)' }}>
                  <span className="ax-eyebrow" style={{ color: 'var(--ax-accent)' }}>padding: --ax-space-2</span>
                </div>
              </div>
            </div>
            <p style={{ margin: 'var(--ax-space-4) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Step down one notch per nesting level — 6 → 4 → 2 — to keep visual rhythm tight without re-tuning per component.</p>
          </div>
        </section>

        {/* Gap demo */}
        <section className="ax-card ax-col--6" role="region" aria-label="Gap utility demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Flex / grid gap</span>
              <h2 className="ax-card__title">Gaps you can feel</h2>
              <p className="ax-card__subtitle">Same six tiles, four different gap tokens.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            {GAPS.map((g) => (
              <div key={g[0]}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                  <code className="ax-code">{`gap: var(${g[0]})`}</code>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{g[1]}px</span>
                </div>
                <div style={{ display: 'flex', gap: `var(${g[0]})` }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <i key={i} aria-hidden="true" style={{ flex: 1, height: 24, borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-accent)', opacity: 0.8 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stack rhythm */}
        <section className="ax-card ax-col--6" role="region" aria-label="Vertical stack rhythm">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-stack</span>
              <h2 className="ax-card__title">Vertical rhythm</h2>
              <p className="ax-card__subtitle"><code className="ax-code">.ax-stack</code> flows children with a token gap — override via <code className="ax-code">--ax-gap</code>.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-stack" style={{ '--ax-gap': 'var(--ax-space-2)' } as React.CSSProperties}>
              <span className="ax-eyebrow">--ax-gap: --ax-space-2 (tight)</span>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 14, borderRadius: 'var(--ax-radius-xs)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)' }} />)}
            </div>
            <hr className="ax-divider" />
            <div className="ax-stack" style={{ '--ax-gap': 'var(--ax-space-6)' } as React.CSSProperties}>
              <span className="ax-eyebrow">--ax-gap: --ax-space-6 (roomy)</span>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 14, borderRadius: 'var(--ax-radius-xs)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-border)' }} />)}
            </div>
          </div>
        </section>

        <section className="ax-col--12">
          <div className="ax-alert ax-alert--info ax-alert--accent-edge">
            <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
            <div className="ax-alert__content">
              <p className="ax-alert__title">Snap to the scale</p>
              <p className="ax-alert__message">Reach for a <code className="ax-code">--ax-space-N</code> token before a raw px value. Card padding is <code className="ax-code">--ax-space-6</code>, the grid gutter is <code className="ax-code">--ax-space-6</code> (16 below 768px), and card-to-card stacking is <code className="ax-code">--ax-space-8</code>.</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Spacing;
