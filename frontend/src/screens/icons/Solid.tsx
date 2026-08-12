'use client';
/*
 * Vireo Next.js — Solid Icons (icons/solid). Faithful port of
 * src/html/icons/solid.html: filled-glyph gallery + "when to reach for solid" note.
 */
import { PageHead } from '../../components/shell/PageHead';
import { IconGallery, type IconDef } from '../../components/icons/IconGallery';
import icons from '../../data/icons/solid.json';

export function Solid() {
  return (
    <>
      <PageHead
        title="Solid Icons"
        subtitle="Heavier filled glyphs for emphasis — toolbars, active states, status chips and tab bars. Click any tile to copy its name."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/icons/line">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
              <span className="ax-btn__label">Line set</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/icons/brands">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10a10 10 0 0 0 -10 -10zm0 5a3 3 0 1 1 -3 3a3 3 0 0 1 3 -3z" /></svg>
              <span className="ax-btn__label">Brand set</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        <IconGallery icons={icons as IconDef[]} mode="solid" ariaLabel="Solid icon gallery" searchLabel="Search solid icons" />

        <section className="ax-card ax-col--12" role="region" aria-label="Usage">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
            <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', flex: '0 0 auto' }}>
              <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>
            </span>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>When to reach for solid</h3>
              <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Filled glyphs use <code className="ax-code">fill=&quot;currentColor&quot;</code> with no stroke — they read louder at small sizes, so use them for the <em>active</em> tab, the selected nav item, a status chip or a rating star. Pair the outline twin for the resting state and the filled one for selected.</p>
              <pre className="ax-code" style={{ display: 'block', padding: 'var(--ax-space-3) var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', overflowX: 'auto', fontSize: 'var(--ax-text-xs)', margin: 0, color: 'var(--ax-text)' }}>&lt;svg viewBox=&quot;0 0 24 24&quot; fill=&quot;currentColor&quot;&gt;…&lt;/svg&gt;</pre>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Solid;
