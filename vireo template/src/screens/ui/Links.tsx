'use client';
/*
 * Vireo Next.js — UI · Links (route "ui/links").
 *
 * Faithful re-expression of src/html/ui/links.html: underline variants, tones,
 * with-icon, inline & quiet, and a navigational link list. Static markup; the
 * two reference inline onmouseover/onmouseout colour swaps are ported to React
 * onMouseOver/onMouseOut handlers. DOM classes / ARIA / copy match 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';

const CHEV = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
);
const ROW_CHEV = (
  <span className="ax-list__trailing"><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></span>
);

export function Links() {
  return (
    <>
      <PageHead
        title="Links"
        subtitle="Anchor styles built on .ax-link — default, underline variants, with-icon, semantic & muted. The hover color follows the live accent."
        actions={
          <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/pages/typography">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h3l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>
            <span className="ax-btn__label">Typography</span>
          </a>
        }
      />

      <div className="ax-dash-grid">
        {/* Underline variants */}
        <section className="ax-card ax-col--6" role="region" aria-label="Underline variants">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Decoration</span>
              <h2 className="ax-card__title">Underline variants</h2>
              <p className="ax-card__subtitle">From underline-on-hover to always-on, dotted &amp; thick.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', fontSize: 'var(--ax-text-md)' }}>
            <div className="ax-cluster ax-cluster--between" style={{ flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
              <a className="ax-link" href="#">Underline on hover</a>
              <code className="ax-code" style={{ flex: '0 0 auto' }}>.ax-link</code>
            </div>
            <div className="ax-divider" />
            <div className="ax-cluster ax-cluster--between" style={{ flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
              <a className="ax-link" href="#" style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>Always underlined</a>
              <code className="ax-code" style={{ flex: '0 0 auto' }}>underline</code>
            </div>
            <div className="ax-divider" />
            <div className="ax-cluster ax-cluster--between" style={{ flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
              <a className="ax-link" href="#" style={{ textDecoration: 'underline dotted', textUnderlineOffset: '3px' }}>Dotted underline</a>
              <code className="ax-code" style={{ flex: '0 0 auto' }}>dotted</code>
            </div>
            <div className="ax-divider" />
            <div className="ax-cluster ax-cluster--between" style={{ flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
              <a className="ax-link" href="#" style={{ textDecoration: 'underline', textDecorationThickness: '2px', textUnderlineOffset: '3px' }}>Thick underline</a>
              <code className="ax-code" style={{ flex: '0 0 auto' }}>2px</code>
            </div>
            <div className="ax-divider" />
            <div className="ax-cluster ax-cluster--between" style={{ flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
              <a className="ax-link" href="#" style={{ fontWeight: 'var(--ax-weight-semibold)' }}>Semibold, no underline</a>
              <code className="ax-code" style={{ flex: '0 0 auto' }}>600</code>
            </div>
          </div>
        </section>

        {/* Tones */}
        <section className="ax-card ax-col--6" role="region" aria-label="Link tones">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Color</span>
              <h2 className="ax-card__title">Tones</h2>
              <p className="ax-card__subtitle">Accent, body, muted, semantic &amp; disabled.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3) var(--ax-space-5)', fontSize: 'var(--ax-text-md)' }}>
            <a className="ax-link" href="#">Accent link</a>
            <a href="#" style={{ color: 'var(--ax-text)', textDecoration: 'none', borderBlockEnd: '1px solid var(--ax-border-strong)' }}>Body link</a>
            <a href="#" style={{ color: 'var(--ax-text-muted)', textDecoration: 'none' }} onMouseOver={(e) => { e.currentTarget.style.textDecoration = 'underline'; }} onMouseOut={(e) => { e.currentTarget.style.textDecoration = 'none'; }}>Muted link</a>
            <a href="#" style={{ color: 'var(--ax-success-500)', textDecoration: 'none', fontWeight: 'var(--ax-weight-medium)' }}>Success</a>
            <a href="#" style={{ color: 'var(--ax-danger-500)', textDecoration: 'none', fontWeight: 'var(--ax-weight-medium)' }}>Danger</a>
            <a href="#" style={{ color: 'var(--ax-info-500)', textDecoration: 'none', fontWeight: 'var(--ax-weight-medium)' }}>Info</a>
            <span aria-disabled="true" style={{ color: 'var(--ax-text-disabled)', textDecoration: 'none', cursor: 'not-allowed', pointerEvents: 'none' }}>Disabled link</span>
          </div>
        </section>

        {/* With icons */}
        <section className="ax-card ax-col--6" role="region" aria-label="Links with icons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Affordance</span>
              <h2 className="ax-card__title">With icons</h2>
              <p className="ax-card__subtitle">Leading, trailing &amp; external — 16px glyphs aligned to the text.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', fontSize: 'var(--ax-text-md)' }}>
            <a className="ax-link" href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              Download the report
            </a>
            <a className="ax-link" href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              Continue to billing
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
            </a>
            <a className="ax-link" href="#" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              Open documentation
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
              <span className="visually-hidden">(opens in a new tab)</span>
            </a>
            <a className="ax-link" href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h6l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /></svg>
              Browse all collections
            </a>
          </div>
        </section>

        {/* Inline & quiet */}
        <section className="ax-card ax-col--6" role="region" aria-label="Inline and quiet links">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In prose</span>
              <h2 className="ax-card__title">Inline &amp; quiet</h2>
              <p className="ax-card__subtitle">How links read inside running text vs. quiet UI affordances.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-md)', lineHeight: 1.7, color: 'var(--ax-text-muted)' }}>
              Your June invoice <a className="ax-link" href="#">INV-2025-0118</a> is ready. Review the{' '}
              <a className="ax-link" href="#">line items</a> or update your{' '}
              <a className="ax-link" href="#">payment method</a> before the renewal on Jun 30.
            </p>
            <div className="ax-divider" />
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)' }}>
              <a className="ax-btn ax-btn--link" href="#">View all</a>
              <a className="ax-btn ax-btn--link" href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>See report
                {CHEV}
              </a>
              <a href="#" style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)', textDecoration: 'none' }} onMouseOver={(e) => { e.currentTarget.style.color = 'var(--ax-text)'; }} onMouseOut={(e) => { e.currentTarget.style.color = 'var(--ax-text-subtle)'; }}>Dismiss</a>
            </div>
          </div>
        </section>

        {/* Link list */}
        <section className="ax-card ax-col--12" role="region" aria-label="Navigational link list">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Navigation</span>
              <h2 className="ax-card__title">Link list</h2>
              <p className="ax-card__subtitle">Stacked actionable rows — each whole row is the link target.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--linked">
              <li><a className="ax-list__row" href="#">
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title">Recent activity</span><span className="ax-list__meta">What changed across your workspace today</span></span>
                {ROW_CHEV}
              </a></li>
              <li><a className="ax-list__row" href="#">
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title">Billing &amp; invoices</span><span className="ax-list__meta">Manage your plan, cards and receipts</span></span>
                {ROW_CHEV}
              </a></li>
              <li><a className="ax-list__row" href="#">
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title">Shipping zones</span><span className="ax-list__meta">Where Aperture Goods ships and at what rate</span></span>
                {ROW_CHEV}
              </a></li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Links;
