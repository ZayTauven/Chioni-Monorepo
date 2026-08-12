'use client';
/*
 * Vireo Next.js — Line Icons (icons/line). Faithful port of
 * src/html/icons/line.html: Feather-style hairline outline gallery + usage note.
 */
import { PageHead } from '../../components/shell/PageHead';
import { IconGallery, type IconDef } from '../../components/icons/IconGallery';
import icons from '../../data/icons/line.json';

export function Line() {
  return (
    <>
      <PageHead
        title="Line Icons"
        subtitle="A lighter, Feather-style outline aesthetic — 1.5px hairline strokes with round caps. Click any tile to copy its name."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/icons/tabler">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg>
              <span className="ax-btn__label">Tabler set</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/icons/solid">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.979 -1.404a6 6 0 0 1 3.124 10.236l-.18 .185l-7.5 7.428l-7.5 -7.428a6 6 0 0 1 2.018 -10.43z" /></svg>
              <span className="ax-btn__label">Solid set</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        <IconGallery icons={icons as IconDef[]} mode="line" ariaLabel="Line icon gallery" searchLabel="Search line icons" />

        <section className="ax-card ax-col--12" role="region" aria-label="Usage">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
            <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: '0 0 auto' }}>
              <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
            </span>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Lighter weight, same grid</h3>
              <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>The line set is the same 24×24 geometry rendered at a slimmer <code className="ax-code">stroke-width:1.5</code> for a calmer, editorial feel — ideal for dense lists, table rows and inline labels. Still <code className="ax-code">currentColor</code>, still fully themeable.</p>
              <pre className="ax-code" style={{ display: 'block', padding: 'var(--ax-space-3) var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', overflowX: 'auto', fontSize: 'var(--ax-text-xs)', margin: 0, color: 'var(--ax-text)' }}>&lt;svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;1.5&quot;&gt;…&lt;/svg&gt;</pre>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Line;
