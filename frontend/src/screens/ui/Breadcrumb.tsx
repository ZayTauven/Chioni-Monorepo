'use client';
/*
 * Vireo Next.js — UI · Breadcrumb (route "ui/breadcrumb").
 *
 * Faithful re-expression of src/html/ui/breadcrumb.html: chevron & slash
 * separators, home glyph, per-step icons and a truncated/collapsed-overflow
 * trail whose middle folds into an Alpine-style menu (re-implemented with React
 * state + useClickOutside). DOM classes / ARIA / copy match the reference 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { useClickOutside } from '../../hooks/useClickOutside';

const CHEV = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6l-6 6" /></svg>;
const SLASH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 5l-10 14" /></svg>;
const HOME = <svg className="ax-breadcrumb__home" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 8.71l-5.333 -4.148a2.666 2.666 0 0 0 -3.274 0l-5.334 4.148a2.665 2.665 0 0 0 -1.029 2.105v7.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7.2c0 -.823 -.38 -1.6 -1.03 -2.105" /><path d="M16 15c-2.21 1.333 -5.792 1.333 -8 0" /></svg>;

function Overflow() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLLIElement>(null);
  useClickOutside(wrap, open, () => setOpen(false));
  return (
    <li className="ax-breadcrumb__item" style={{ position: 'relative' }} ref={wrap}>
      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Show hidden path" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
      </button>
      {open && (
        <div className="ax-flex" style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInlineStart: 0, minWidth: 200, zIndex: 20, padding: 'var(--ax-space-2)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-lg)', flexDirection: 'column', gap: 2 }}>
          <a className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} href="#"><span className="ax-btn__label">Workspaces</span></a>
          <a className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} href="#"><span className="ax-btn__label">Northwind Labs</span></a>
          <a className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} href="#"><span className="ax-btn__label">Engineering</span></a>
          <a className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} href="#"><span className="ax-btn__label">Platform team</span></a>
        </div>
      )}
    </li>
  );
}

export function Breadcrumb() {
  return (
    <>
      <PageHead
        title="Breadcrumb"
        subtitle="Wayfinding trails — chevron & slash separators, leading icons, the home glyph, and a truncated overflow variant."
      />

      <div className="ax-dash-grid">
        {/* Chevron (default) */}
        <section className="ax-card ax-col--6" role="region" aria-label="Chevron separator breadcrumb">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Default</span>
              <h2 className="ax-card__title">Chevron separators</h2>
              <p className="ax-card__subtitle">The standard trail used across Vireo.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-breadcrumb" aria-label="Breadcrumb">
              <ol className="ax-breadcrumb__list">
                <li className="ax-breadcrumb__item"><Link href="/">Dashboard</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><Link href="/ecommerce/products">Catalog</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><span aria-current="page">Brass Task Light</span></li>
              </ol>
            </nav>
          </div>
        </section>

        {/* Slash */}
        <section className="ax-card ax-col--6" role="region" aria-label="Slash separator breadcrumb">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Slash separators</h2>
              <p className="ax-card__subtitle">A lighter divider for file-path style trails.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-breadcrumb" aria-label="Breadcrumb">
              <ol className="ax-breadcrumb__list">
                <li className="ax-breadcrumb__item"><Link href="/apps/file-manager">Files</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{SLASH}</li>
                <li className="ax-breadcrumb__item"><a href="#">Brand assets</a></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{SLASH}</li>
                <li className="ax-breadcrumb__item"><a href="#">2026</a></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{SLASH}</li>
                <li className="ax-breadcrumb__item"><span aria-current="page">launch-deck.pdf</span></li>
              </ol>
            </nav>
          </div>
        </section>

        {/* Home glyph */}
        <section className="ax-card ax-col--6" role="region" aria-label="Breadcrumb with home glyph">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Affordance</span>
              <h2 className="ax-card__title">Home glyph start</h2>
              <p className="ax-card__subtitle">An icon root keeps deep trails compact.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-breadcrumb" aria-label="Breadcrumb">
              <ol className="ax-breadcrumb__list">
                <li className="ax-breadcrumb__item"><Link href="/" aria-label="Home">{HOME}</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><Link href="/ecommerce/orders">Orders</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><span aria-current="page">#10482</span></li>
              </ol>
            </nav>
          </div>
        </section>

        {/* With leading icons */}
        <section className="ax-card ax-col--6" role="region" aria-label="Breadcrumb with leading icons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Affordance</span>
              <h2 className="ax-card__title">Per-step icons</h2>
              <p className="ax-card__subtitle">Each crumb carries a glyph for faster scanning.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-breadcrumb" aria-label="Breadcrumb">
              <ol className="ax-breadcrumb__list">
                <li className="ax-breadcrumb__item"><Link href="/">
                  <svg style={{ width: 'var(--ax-icon-xs)', height: 'var(--ax-icon-xs)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v8h-6z" /><path d="M4 16h6v4h-6z" /><path d="M14 12h6v8h-6z" /><path d="M14 4h6v4h-6z" /></svg>Dashboard</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><a href="#">
                  <svg style={{ width: 'var(--ax-icon-xs)', height: 'var(--ax-icon-xs)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>Customers</a></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><span aria-current="page">
                  <svg style={{ width: 'var(--ax-icon-xs)', height: 'var(--ax-icon-xs)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>Camila Rossi</span></li>
              </ol>
            </nav>
          </div>
        </section>

        {/* Truncated / collapsed overflow */}
        <section className="ax-card ax-col--12" role="region" aria-label="Truncated breadcrumb">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Long trails</span>
              <h2 className="ax-card__title">Truncated overflow</h2>
              <p className="ax-card__subtitle">Deep hierarchies collapse the middle into a menu; the last crumb truncates with ellipsis.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            {/* collapsed middle */}
            <nav className="ax-breadcrumb" aria-label="Breadcrumb">
              <ol className="ax-breadcrumb__list">
                <li className="ax-breadcrumb__item"><Link href="/" aria-label="Home">{HOME}</Link></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <Overflow />
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item"><a href="#">Sprint 24</a></li>
                <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                <li className="ax-breadcrumb__item" style={{ maxWidth: 220 }}><span aria-current="page" className="ax-truncate" style={{ display: 'block', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>TSK-241 · Migrate webhook delivery to the new retry queue</span></li>
              </ol>
            </nav>

            {/* responsive / wrapping demo */}
            <div style={{ maxWidth: 360, border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3)', background: 'var(--ax-surface-subtle)' }}>
              <small style={{ display: 'block', marginBottom: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Constrained width — the trail wraps cleanly</small>
              <nav className="ax-breadcrumb" aria-label="Breadcrumb">
                <ol className="ax-breadcrumb__list">
                  <li className="ax-breadcrumb__item"><a href="#">Settings</a></li>
                  <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                  <li className="ax-breadcrumb__item"><a href="#">Billing</a></li>
                  <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                  <li className="ax-breadcrumb__item"><a href="#">Invoices</a></li>
                  <li className="ax-breadcrumb__sep" aria-hidden="true">{CHEV}</li>
                  <li className="ax-breadcrumb__item"><span aria-current="page">INV-2025-0118</span></li>
                </ol>
              </nav>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Breadcrumb;
