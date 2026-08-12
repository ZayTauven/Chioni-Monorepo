'use client';
/*
 * Vireo Next.js — Brand Icons (icons/brands). Faithful port of
 * src/html/icons/brands.html: brand-mark gallery + sign-in button + share/social
 * in-context showcases.
 */
import { PageHead } from '../../components/shell/PageHead';
import { IconGallery, type IconDef } from '../../components/icons/IconGallery';
import icons from '../../data/icons/brands.json';

export function Brands() {
  return (
    <>
      <PageHead
        title="Brand Icons"
        subtitle="Social, auth-provider and payment marks for sign-in buttons, share rows and footers. Click any tile to copy its name."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/icons/solid">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.979 -1.404a6 6 0 0 1 3.124 10.236l-.18 .185l-7.5 7.428l-7.5 -7.428a6 6 0 0 1 2.018 -10.43z" /></svg>
              <span className="ax-btn__label">Solid set</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/icons/tabler">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg>
              <span className="ax-btn__label">Tabler set</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        <IconGallery icons={icons as IconDef[]} mode="brands" ariaLabel="Brand icon gallery" searchLabel="Search brand icons" />

        {/* SIGN-IN BUTTON SHOWCASE */}
        <section className="ax-card ax-col--6" role="region" aria-label="Social sign-in example">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Sign-in buttons</h2>
              <p className="ax-card__subtitle">Brand marks paired with provider copy.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.945 11a9 9 0 1 1 -3.284 -5.997l-2.655 2.392a5.5 5.5 0 1 0 2.119 6.605h-4.125v-3h7.945" /></svg>
              <span className="ax-btn__label">Continue with Google</span>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" /></svg>
              <span className="ax-btn__label">Continue with GitHub</span>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8.286 7.008c-3.216 0 -4.286 3.23 -4.286 5.92c0 3.229 2.143 8.072 4.286 8.072c1.165 -.05 1.799 -.538 3.214 -.538c1.406 0 1.607 .538 3.214 .538s4.286 -3.229 4.286 -5.381c-.03 -.011 -2.649 -.434 -2.679 -3.23c-.02 -2.335 2.589 -3.179 2.679 -3.228c-1.096 -1.606 -3.162 -2.113 -3.75 -2.153c-1.535 -.12 -3.032 1.077 -3.75 1.077c-.729 0 -2.036 -1.077 -3.214 -1.077" /><path d="M12 4a2 2 0 0 0 2 -2a2 2 0 0 0 -2 2" /></svg>
              <span className="ax-btn__label">Continue with Apple</span>
            </button>
          </div>
        </section>

        {/* SHARE / SOCIAL ROW SHOWCASE */}
        <section className="ax-card ax-col--6" role="region" aria-label="Social share example">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Share &amp; follow</h2>
              <p className="ax-card__subtitle">Icon-only buttons for footers and toolbars.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Share on X"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16l-4.267 0" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Share on Facebook"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Share on LinkedIn"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 11v5" /><path d="M8 8v.01" /><path d="M12 16v-5" /><path d="M16 16v-3a2 2 0 1 0 -4 0" /><path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4l0 -10" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Follow on Instagram"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4l0 -8" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M16.5 7.5v.01" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Subscribe on YouTube"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8" /><path d="M10 9l5 3l-5 3l0 -6" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Join the Discord"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M14 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M15.5 17c0 1 1.5 3 2 3c1.5 0 2.833 -1.667 3.5 -3c.667 -1.667 .5 -5.833 -1.5 -11.5c-1.457 -1.015 -3 -1.34 -4.5 -1.5l-.972 1.923a11.913 11.913 0 0 0 -4.053 0l-.975 -1.923c-1.5 .16 -3.043 .485 -4.5 1.5c-2 5.667 -2.167 9.833 -1.5 11.5c.667 1.333 2 3 3.5 3c.5 0 2 -2 2 -3" /><path d="M7 16.5c3.5 1 6.5 1 10 0" /></svg></button>
            </div>
            <div className="ax-divider" />
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>We accept</span>
              <span className="ax-badge ax-badge--soft" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15l1 -6" /><path d="M3 15l1.5 -6h2.5l-1.5 6z" /><path d="M9.5 9h2.5l-1 6h-2" /><path d="M19 9h-2a1.5 1.5 0 0 0 -1.5 1.5c0 1.5 2 1.5 2 3c0 .83 -.67 1.5 -1.5 1.5h-1.5" /></svg>Visa</span>
              <span className="ax-badge ax-badge--soft" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M12 7.5a4.5 4.5 0 1 0 0 9" /><path d="M12 7.5a4.5 4.5 0 1 1 0 9" /></svg>Mastercard</span>
              <span className="ax-badge ax-badge--soft" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.453 8.056c0 -.623 .518 -.979 1.442 -.979c1.69 0 3.41 .343 4.605 .923l.5 -4c-.948 -.449 -2.82 -1 -5.5 -1c-1.895 0 -3.373 .087 -4.5 1c-1.172 .956 -2 2.33 -2 4c0 3.03 1.958 4.906 5 6c1.961 .69 3 .743 3 1.5c0 .735 -.851 1.5 -2 1.5c-1.423 0 -3.963 -.609 -5.5 -1.5l-.5 4c1.321 .734 3.474 1.5 6 1.5c2 0 3.957 -.468 5.084 -1.36c1.263 -.979 1.916 -2.268 1.916 -4.14c0 -3.096 -1.915 -4.547 -5 -5.637c-1.646 -.605 -2.544 -1.07 -2.544 -1.807" /></svg>Stripe</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Brands;
