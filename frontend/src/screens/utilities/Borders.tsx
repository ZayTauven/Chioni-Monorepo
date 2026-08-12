'use client';
/*
 * Vireo Next.js — Utilities · Borders & radius.
 * 1:1 re-expression of src/html/utilities/borders.html: the six-step radius scale,
 * stroke width/color tokens, border styles, divider helpers and composed edge
 * treatments. Token tiles copy their var to the clipboard (useCopyFlash).
 */
import { PageHead } from '../../components/shell/PageHead';
import { useCopyFlash } from './utilShared';

const RADII: [string, string, string, string][] = [
  ['--ax-radius-xs', 'xs', '8px', 'badges · checkboxes'],
  ['--ax-radius-sm', 'sm', '12px', 'small controls'],
  ['--ax-radius-md', 'md', '14px', 'buttons · inputs'],
  ['--ax-radius-lg', 'lg', '18px', 'media · plates'],
  ['--ax-radius-xl', 'xl', '24px', 'cards'],
  ['--ax-radius-pill', 'pill', '999px', 'pills · avatars'],
];
const STYLES: [string, string][] = [['solid', 'Structure'], ['dashed', 'Dropzone'], ['dotted', 'Hint']];

export function Borders() {
  const { flash, copy } = useCopyFlash();
  return (
    <>
      <PageHead
        title="Borders & radius"
        subtitle="Hairline strokes, the six-step radius scale and divider helpers — the geometry that gives Aurora its soft-glass edges."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/spacing">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3l4 4l-14 14l-4 -4l14 -14" /><path d="M16 7l-1.5 -1.5" /><path d="M13 10l-1.5 -1.5" /><path d="M10 13l-1.5 -1.5" /><path d="M7 16l-1.5 -1.5" /></svg>
              <span className="ax-btn__label">Spacing scale</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/utilities/flex-grid">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
              <span className="ax-btn__label">Flex & grid</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Radius scale */}
        <section className="ax-card ax-col--7" role="region" aria-label="Radius scale">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">--ax-radius-*</span>
              <h2 className="ax-card__title">Radius scale</h2>
              <p className="ax-card__subtitle">From crisp checkboxes to fully-round pills. Click a tile to copy its token.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
            {RADII.map((r) => (
              <button key={r[0]} type="button" onClick={() => copy(r[0])}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', alignItems: 'center', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer' }}
                aria-label={`Copy ${r[0]}`}>
                <span aria-hidden="true" style={{ width: '100%', height: 54, background: 'var(--ax-accent-wash)', border: '1.5px solid var(--ax-accent)', borderRadius: `var(${r[0]})` }} />
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{r[1]}</b>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{r[2]}</span>
                </span>
                <span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textAlign: 'center' }}>{flash === r[0] ? 'Copied!' : r[3]}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Border widths & color */}
        <section className="ax-card ax-col--5" role="region" aria-label="Border widths and colors">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Stroke</span>
              <h2 className="ax-card__title">Width & color</h2>
              <p className="ax-card__subtitle">Two stroke tokens cover 99% of cases.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <button type="button" onClick={() => copy('--ax-border')} className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'start' }} aria-label="Copy --ax-border">
                <span><b style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>1px hairline</b><span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>default card & control edge</span></span>
                <code className="ax-code" style={{ background: 'transparent', padding: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)' }}>{flash === '--ax-border' ? 'Copied!' : '--ax-border'}</code>
              </button>
              <button type="button" onClick={() => copy('--ax-border-strong')} className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'start' }} aria-label="Copy --ax-border-strong">
                <span><b style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>1px strong</b><span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>dividers, focus, header rule</span></span>
                <code className="ax-code" style={{ background: 'transparent', padding: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)' }}>{flash === '--ax-border-strong' ? 'Copied!' : '--ax-border-strong'}</code>
              </button>
            </div>
            <hr className="ax-divider" />
            <span className="ax-eyebrow">Visible widths</span>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              {[1, 1.5, 2, 3].map((w) => (
                <span key={w} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <i aria-hidden="true" style={{ width: 54, height: 40, borderRadius: 'var(--ax-radius-sm)', border: `${w}px solid var(--ax-accent)` }} />
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{w}px</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Border styles */}
        <section className="ax-card ax-col--6" role="region" aria-label="Border styles">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">CSS</span>
              <h2 className="ax-card__title">Border styles</h2>
              <p className="ax-card__subtitle">Solid for structure; dashed for drop-zones & placeholders.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
            {STYLES.map((st) => (
              <div key={st[0]} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
                <span aria-hidden="true" style={{ width: '100%', height: 64, borderRadius: 'var(--ax-radius-md)', border: `2px ${st[0]} var(--ax-border-strong)`, display: 'grid', placeItems: 'center', color: 'var(--ax-text-subtle)' }}>
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                </span>
                <code className="ax-code">{st[0]}</code>
                <span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{st[1]}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Dividers */}
        <section className="ax-card ax-col--6" role="region" aria-label="Divider helpers">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-divider</span>
              <h2 className="ax-card__title">Dividers</h2>
              <p className="ax-card__subtitle">Hairline separators in three flavors.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-divider</span>
              <hr className="ax-divider" />
            </div>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-divider--strong</span>
              <hr className="ax-divider ax-divider--strong" />
            </div>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-divider--vertical</span>
              <div className="ax-cluster" style={{ height: 48, gap: 'var(--ax-space-4)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Drafts</span>
                <span className="ax-divider ax-divider--vertical" />
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Scheduled</span>
                <span className="ax-divider ax-divider--vertical" />
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Published</span>
              </div>
            </div>
          </div>
        </section>

        {/* Composed edges */}
        <section className="ax-card ax-col--12" role="region" aria-label="Composed edge treatments">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Edge treatments in the wild</h2>
              <p className="ax-card__subtitle">How radius + stroke + glass highlight combine on real surfaces.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
            <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-xl)', padding: 'var(--ax-space-5)', background: 'var(--ax-surface-subtle)', boxShadow: 'inset 0 1px 0 var(--ax-glass-hi)' }}>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Card · xl</span>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>24px radius + hairline + top glass highlight.</p>
            </div>
            <div className="ax-card--accent-edge" style={{ position: 'relative', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Accent edge</span>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Left accent bar marks the active item.</p>
            </div>
            <div style={{ border: '2px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', color: 'var(--ax-text-subtle)' }}>
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 18v-6" /><path d="M9 15l3 -3l3 3" /><path d="M4 15v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /></svg>
              <span style={{ fontSize: 'var(--ax-text-xs)' }}>Drop files</span>
            </div>
            <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-pill)', padding: 'var(--ax-space-3) var(--ax-space-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--ax-space-2)', background: 'var(--ax-surface-subtle)' }}>
              <span className="ax-badge__dot" style={{ background: 'var(--ax-success-500)' }} />
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Pill · 999px</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Borders;
