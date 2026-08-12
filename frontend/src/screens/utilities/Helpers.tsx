/*
 * Vireo Next.js — Utilities · Helper utilities.
 * 1:1 re-expression of src/html/utilities/helpers.html: single-line .ax-truncate,
 * multi-line .ax-clamp-N, tabular .ax-num numerics, .visually-hidden + .ax-skeleton
 * a11y/loading helpers and inline typography helpers (.ax-code/.ax-kbd/.ax-mark/
 * .ax-link/.ax-eyebrow/.ax-display). Static — stays a server component.
 */
import { PageHead } from '../../components/shell/PageHead';

const NUM_ROWS: [string, string, string][] = [
  ['USD', '$48,210.00', '+$62,400'],
  ['GBP', '£21,540.00', '+£27,100'],
  ['EUR', '€33,120.00', '+€40,800'],
  ['AUD', 'A$15,980.00', '+A$19,400'],
];

export function Helpers() {
  return (
    <>
      <PageHead
        title="Helper utilities"
        subtitle="Token-driven micro-helpers Tailwind doesn't cleanly cover — truncate, clamp, tabular numerics, dividers, skeletons & screen-reader text."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/flex-grid">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
              <span className="ax-btn__label">Flex & grid</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/utilities/position">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" /><path d="M14.5 5.5l4 4" /><path d="M12 8l-5 -5l-4 4l5 5" /><path d="M7 8l-1.5 1.5" /><path d="M16 12l5 5l-4 4l-5 -5" /><path d="M16 17l-1.5 1.5" /></svg>
              <span className="ax-btn__label">Positioning</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Truncate */}
        <section className="ax-card ax-col--6" role="region" aria-label="Truncate helper">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-truncate</span>
              <h2 className="ax-card__title">Single-line truncate</h2>
              <p className="ax-card__subtitle">Clips overflowing text to one line with an ellipsis. Hover for the full <code className="ax-code">title</code>.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>LB</span>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <div className="ax-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }} title="Refactor the Aperture Goods checkout flow to support multi-currency and saved carts">Refactor the Aperture Goods checkout flow to support multi-currency and saved carts</div>
                <div className="ax-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} title="lena.brandt@northwindlabs.app · Updated 18 minutes ago">lena.brandt@northwindlabs.app · Updated 18 minutes ago</div>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Open task">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Wrap the flexible child in a <code className="ax-code">min-width:0</code> column so the ellipsis kicks in inside flex rows.</p>
          </div>
        </section>

        {/* Clamp */}
        <section className="ax-card ax-col--6" role="region" aria-label="Line clamp helper">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-clamp-2 · .ax-clamp-3</span>
              <h2 className="ax-card__title">Multi-line clamp</h2>
              <p className="ax-card__subtitle">Caps a block to N lines — ideal for card descriptions & feed previews.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-clamp-2</span>
              <p className="ax-clamp-2" style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>The Brass Task Light pairs a machined aluminium arm with a dimmable warm-white head, drawing just 6 watts at full output. It ships flat-packed and assembles without tools in under a minute.</p>
            </div>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-clamp-3</span>
              <p className="ax-clamp-3" style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Northwind Labs ships the Aperture Goods range from a single fulfilment hub in Lisbon, reaching most of Europe within two business days. Orders over $80 qualify for free carbon-neutral delivery, and every parcel uses recycled, plastic-free packaging sourced from certified suppliers.</p>
            </div>
          </div>
        </section>

        {/* Numerics */}
        <section className="ax-card ax-col--6" role="region" aria-label="Tabular numerics helper">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-num · .ax-mono</span>
              <h2 className="ax-card__title">Tabular numerics</h2>
              <p className="ax-card__subtitle">Locks digit widths so figures align in columns and never jitter as they tick.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Currency</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Balance</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Income</th>
                  </tr>
                </thead>
                <tbody>
                  {NUM_ROWS.map((r) => (
                    <tr key={r[0]} className="ax-table__row">
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>{r[0]}</td>
                      <td className="ax-table__td ax-table__td--num">{r[1]}</td>
                      <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-viz-emerald)' }}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-4)' }}>
              <span><span className="ax-eyebrow" style={{ display: 'block' }}>Default digits</span><span style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-muted)' }}>1111.99</span></span>
              <span className="ax-divider ax-divider--vertical" style={{ height: 34 }} />
              <span><span className="ax-eyebrow" style={{ display: 'block' }}>.ax-num</span><span className="ax-num" style={{ fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>1111.99</span></span>
            </div>
          </div>
        </section>

        {/* Visually hidden + skeleton */}
        <section className="ax-card ax-col--6" role="region" aria-label="Accessibility and loading helpers">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.visually-hidden · .ax-skeleton</span>
              <h2 className="ax-card__title">A11y & loading</h2>
              <p className="ax-card__subtitle">Screen-reader-only text and reduced-motion-safe placeholders.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.visually-hidden</span>
              <button type="button" className="ax-btn ax-btn--secondary">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                <span className="visually-hidden">Download the Q2 revenue report as CSV</span>
                <span className="ax-btn__label" aria-hidden="true">Export</span>
              </button>
              <p style={{ margin: 'var(--ax-space-2) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>The button reads as "Export" but announces the full action to screen readers.</p>
            </div>
            <hr className="ax-divider" />
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-3)' }}>.ax-skeleton (honours prefers-reduced-motion)</span>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--ax-radius-pill)', flex: '0 0 auto' }} />
                <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  <span className="ax-skeleton" style={{ width: '60%', height: 12 }} />
                  <span className="ax-skeleton" style={{ width: '90%', height: 10 }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Inline typography */}
        <section className="ax-card ax-col--12" role="region" aria-label="Inline typography helpers">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">.ax-code · .ax-kbd · .ax-mark · .ax-link · .ax-eyebrow</span>
              <h2 className="ax-card__title">Inline typography</h2>
              <p className="ax-card__subtitle">Small text-level helpers that compose anywhere in body copy.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Run <code className="ax-code">npm run build</code> then deploy the <code className="ax-code">dist/</code> folder.</p>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Press <kbd className="ax-kbd">⌘</kbd> <kbd className="ax-kbd">K</kbd> to open the command palette, or <kbd className="ax-kbd">Esc</kbd> to dismiss it.</p>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Found <mark className="ax-mark">3 matches</mark> for "checkout" across the codebase.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>See the <a className="ax-link" href="#">migration guide</a> for breaking changes in v2.</p>
              <div><span className="ax-eyebrow">Section eyebrow</span><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Uppercase label above a heading</div></div>
              <p className="ax-display" style={{ margin: 0, fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>.ax-display — Space Grotesk headline</p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Helpers;
