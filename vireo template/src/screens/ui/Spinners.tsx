/*
 * Vireo Next.js — UI · Spinners & Loaders (route "ui/spinners").
 *
 * Faithful re-expression of src/html/ui/spinners.html: ring spinner sizes/colors,
 * three-dot and equalizer-bar loaders, in-button busy states, and skeleton
 * placeholders. The reference ships a page-local <style> for the dot/bar keyframes
 * (geometry + motion only; colour is inline role tokens on each <i>) — reproduced
 * here verbatim. Fully static, so a server component. DOM/classes/ARIA match 1:1.
 */
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const SPINNER_CSS = `
.ax-dots { display:inline-flex; align-items:center; gap:7px; }
.ax-dots > i { width:9px; height:9px; border-radius:50%; display:inline-block; animation:ax-dot-pulse 1.2s var(--ax-ease-standard) infinite; }
.ax-dots > i:nth-child(2) { animation-delay:.16s; }
.ax-dots > i:nth-child(3) { animation-delay:.32s; }
.ax-dots--lg > i { width:13px; height:13px; gap:9px; }
@keyframes ax-dot-pulse { 0%,80%,100% { transform:scale(.55); opacity:.5; } 40% { transform:scale(1); opacity:1; } }
.ax-bars { display:inline-flex; align-items:flex-end; gap:5px; height:34px; }
.ax-bars > i { width:6px; height:100%; border-radius:var(--ax-radius-xs); transform-origin:bottom; animation:ax-bar-stretch 1s var(--ax-ease-standard) infinite; }
.ax-bars > i:nth-child(2) { animation-delay:.1s; }
.ax-bars > i:nth-child(3) { animation-delay:.2s; }
.ax-bars > i:nth-child(4) { animation-delay:.3s; }
.ax-bars > i:nth-child(5) { animation-delay:.4s; }
@keyframes ax-bar-stretch { 0%,100% { transform:scaleY(.35); } 50% { transform:scaleY(1); } }
@media (prefers-reduced-motion: reduce) {
  .ax-dots > i, .ax-bars > i { animation-duration:0s; }
  .ax-dots > i { transform:scale(.85); opacity:.85; }
  .ax-bars > i { transform:scaleY(.7); }
}
`;

function SizeCue({ size }: { size: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <span className={`ax-spinner ax-spinner--${size}`} role="status" aria-label="Loading"><span className="ax-spinner__glyph" /></span>
      <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-3)' }}>{size}</div>
    </div>
  );
}

export function Spinners() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPINNER_CSS }} />
      <PageHead
        title="Spinners & Loaders"
        subtitle="Ring spinners, dot and bar loaders, in-button states and skeleton placeholders."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/progress">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v0a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z" /><path d="M5 12m0 1a1 1 0 0 1 1 -1h8a1 1 0 0 1 1 1v0a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1z" /></svg>
            <span className="ax-btn__label">Progress</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Ring sizes */}
        <section className="ax-card ax-col--6" role="region" aria-label="Spinner sizes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Ring</span>
              <h2 className="ax-card__title">Sizes</h2>
              <p className="ax-card__subtitle">From a 12px inline cue to a 40px page spinner.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 'var(--ax-space-5)', paddingBlock: 'var(--ax-space-6)' }}>
            <SizeCue size="xs" /><SizeCue size="sm" /><SizeCue size="md" /><SizeCue size="lg" />
          </div>
        </section>

        {/* Colors */}
        <section className="ax-card ax-col--6" role="region" aria-label="Spinner colors">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Tone</span>
              <h2 className="ax-card__title">Colors</h2>
              <p className="ax-card__subtitle">The glyph inherits <code className="ax-code">currentColor</code>, so any role token works.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: 'var(--ax-space-5)', paddingBlock: 'var(--ax-space-6)' }}>
            <span className="ax-spinner ax-spinner--lg" role="status" aria-label="Loading"><span className="ax-spinner__glyph" /></span>
            <span className="ax-spinner ax-spinner--lg" style={{ color: 'var(--ax-success-500)' }} role="status" aria-label="Loading"><span className="ax-spinner__glyph" /></span>
            <span className="ax-spinner ax-spinner--lg" style={{ color: 'var(--ax-warning-500)' }} role="status" aria-label="Loading"><span className="ax-spinner__glyph" /></span>
            <span className="ax-spinner ax-spinner--lg" style={{ color: 'var(--ax-danger-500)' }} role="status" aria-label="Loading"><span className="ax-spinner__glyph" /></span>
            <span className="ax-spinner ax-spinner--lg" style={{ color: 'var(--ax-viz-violet)' }} role="status" aria-label="Loading"><span className="ax-spinner__glyph" /></span>
          </div>
        </section>

        {/* Dots */}
        <section className="ax-card ax-col--4" role="region" aria-label="Dot loaders">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Bounce</span>
              <h2 className="ax-card__title">Dots</h2>
              <p className="ax-card__subtitle">A three-dot pulse.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', alignItems: 'center', paddingBlock: 'var(--ax-space-5)' }}>
            <span className="ax-dots" role="status" aria-label="Loading">
              <i style={{ background: 'var(--ax-accent)' }} /><i style={{ background: 'var(--ax-accent)' }} /><i style={{ background: 'var(--ax-accent)' }} />
            </span>
            <span className="ax-dots ax-dots--lg" role="status" aria-label="Loading">
              <i style={{ background: 'var(--ax-viz-cyan)' }} /><i style={{ background: 'var(--ax-viz-violet)' }} /><i style={{ background: 'var(--ax-viz-pink)' }} />
            </span>
          </div>
        </section>

        {/* Bars */}
        <section className="ax-card ax-col--4" role="region" aria-label="Bar loaders">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Equalizer</span>
              <h2 className="ax-card__title">Bars</h2>
              <p className="ax-card__subtitle">Five staggered columns.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', alignItems: 'center', paddingBlock: 'var(--ax-space-5)' }}>
            <span className="ax-bars" role="status" aria-label="Loading">
              <i style={{ background: 'var(--ax-accent)' }} /><i style={{ background: 'var(--ax-accent)' }} /><i style={{ background: 'var(--ax-accent)' }} /><i style={{ background: 'var(--ax-accent)' }} /><i style={{ background: 'var(--ax-accent)' }} />
            </span>
            <span className="ax-bars" role="status" aria-label="Loading">
              <i style={{ background: 'var(--ax-viz-cyan)' }} /><i style={{ background: 'var(--ax-viz-violet)' }} /><i style={{ background: 'var(--ax-viz-pink)' }} /><i style={{ background: 'var(--ax-viz-amber)' }} /><i style={{ background: 'var(--ax-viz-emerald)' }} />
            </span>
          </div>
        </section>

        {/* In context */}
        <section className="ax-card ax-col--4" role="region" aria-label="Loaders in context">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Buttons</h2>
              <p className="ax-card__subtitle">Inline busy states.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', alignItems: 'flex-start' }}>
            <button type="button" className="ax-btn ax-btn--primary" aria-busy="true" disabled>
              <span className="ax-spinner ax-spinner--sm ax-spinner--inline" style={{ color: 'currentColor' }} aria-hidden="true"><span className="ax-spinner__glyph" /></span>
              <span className="ax-btn__label">Saving…</span>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary" aria-busy="true" disabled>
              <span className="ax-spinner ax-spinner--sm ax-spinner--inline" aria-hidden="true"><span className="ax-spinner__glyph" /></span>
              <span className="ax-btn__label">Syncing</span>
            </button>
            <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
              <span className="ax-spinner ax-spinner--sm" aria-hidden="true"><span className="ax-spinner__glyph" /></span> Fetching latest activity…
            </span>
          </div>
        </section>

        {/* Skeletons */}
        <section className="ax-card ax-col--8" role="region" aria-label="Skeleton placeholders">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Loading state</span>
              <h2 className="ax-card__title">Skeletons</h2>
              <p className="ax-card__subtitle">Shimmer placeholders that mirror the content they replace.</p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/ui/skeletons">All skeletons</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }} aria-busy="true" aria-label="Loading content">
            <div className="ax-skeleton-row">
              <div className="ax-skeleton ax-skeleton--circle" style={{ width: 44, height: 44, flex: '0 0 auto' }} />
              <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '40%' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '65%' }} />
              </div>
              <div className="ax-skeleton ax-skeleton--rect" style={{ width: 72, height: 28, flex: '0 0 auto' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '100%' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '92%' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '78%' }} />
            </div>
            <div className="ax-skeleton ax-skeleton--rect" style={{ width: '100%', height: 140 }} />
          </div>
        </section>

        {/* Card skeleton */}
        <section className="ax-card ax-col--4" role="region" aria-label="Stat skeleton">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variants</span>
              <h2 className="ax-card__title">Shimmer · Pulse</h2>
              <p className="ax-card__subtitle">Two animation styles.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }} aria-busy="true" aria-label="Loading stat">
            <div className="ax-skeleton-stat">
              <div className="ax-skeleton ax-skeleton--rect" style={{ width: 36, height: 36, borderRadius: 'var(--ax-radius-md)' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '50%' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '70%', height: '1.2em' }} />
            </div>
            <div className="ax-divider" />
            <div className="ax-skeleton-row">
              <div className="ax-skeleton ax-skeleton--pulse ax-skeleton--circle" style={{ width: 32, height: 32, flex: '0 0 auto' }} />
              <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <div className="ax-skeleton ax-skeleton--pulse ax-skeleton--line" style={{ width: '60%' }} />
                <div className="ax-skeleton ax-skeleton--pulse ax-skeleton--line" style={{ width: '40%' }} />
              </div>
            </div>
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Pulse opacity loop above, shimmer sweep elsewhere.</span>
          </div>
        </section>
      </div>
    </>
  );
}

export default Spinners;
