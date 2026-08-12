'use client';
/*
 * Vireo Next.js — Tabler Icons (icons/tabler). Faithful port of
 * src/html/icons/tabler.html: searchable icon gallery with outline↔filled
 * toggle, size/color preview and click-to-copy, plus the drop-in usage note.
 */
import { PageHead } from '../../components/shell/PageHead';
import { IconGallery, type IconDef } from '../../components/icons/IconGallery';
import icons from '../../data/icons/tabler.json';

const LINK_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
);
const BROWSE_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9h-6a3 3 0 0 0 0 6h6" /><path d="M12 15h6a3 3 0 0 0 0 -6h-6" /><path d="M9 12h6" /></svg>
);

export function Tabler() {
  return (
    <>
      <PageHead
        title="Tabler Icons"
        subtitle="The system icon set — 5,000+ pixel-perfect glyphs on a 24×24 grid. Click any tile to copy its name."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/icons/line">
              {LINK_ICON}
              <span className="ax-btn__label">Line set</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="https://tabler.io/icons" target="_blank" rel="noopener">
              {BROWSE_ICON}
              <span className="ax-btn__label">Browse all 5,000+</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        <IconGallery icons={icons as IconDef[]} mode="tabler" ariaLabel="Tabler icon gallery" searchLabel="Search Tabler icons" />

        <section className="ax-card ax-col--12" role="region" aria-label="Usage">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-4)', flexWrap: 'wrap' }}>
            <span className="ax-avatar ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', flex: '0 0 auto' }}>
              <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9h-6a3 3 0 0 0 0 6h6" /><path d="M12 15h6a3 3 0 0 0 0 -6h-6" /><path d="M9 12h6" /></svg>
            </span>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Drop-in usage</h3>
              <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Every glyph is inline SVG using <code className="ax-code">currentColor</code> on a 24×24 grid — size with the <code className="ax-code">--ax-icon-*</code> tokens, recolor with the surrounding text color. They retheme with light, dark and all 12 accents for free.</p>
              <pre className="ax-code" style={{ display: 'block', padding: 'var(--ax-space-3) var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', overflowX: 'auto', fontSize: 'var(--ax-text-xs)', margin: 0, color: 'var(--ax-text)' }}>&lt;svg viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;1.75&quot;&gt;…&lt;/svg&gt;</pre>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Tabler;
