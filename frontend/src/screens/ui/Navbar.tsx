'use client';
/*
 * Vireo Next.js — UI · Navbar (route "ui/navbar").
 *
 * Faithful re-expression of src/html/ui/navbar.html: an application brand bar,
 * a section-tabs rail (Alpine tab state → useState), a pill filter nav, a
 * marketing site header and an editor toolbar (Save fires a toast). All built
 * on the glass .ax-topnav rail. DOM classes / ARIA / copy match the reference.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ToastProvider, useToast } from './_uikit';

const TOPNAV_BASE: React.CSSProperties = { position: 'static', borderRadius: 'var(--ax-radius-md)', border: '1px solid var(--ax-border)', blockSize: 'auto' };

function NavbarInner() {
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [seg, setSeg] = useState('all');

  return (
    <>
      <PageHead
        title="Navbar"
        subtitle="Top-navigation patterns composed from the glass .ax-topnav rail — brand bars, section tabs, marketing headers & toolbars."
        actions={
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
            <span className="ax-btn__label">Layout presets</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {/* App brand bar */}
        <section className="ax-card ax-col--12" role="region" aria-label="Application brand bar navbar">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Application</span>
              <h2 className="ax-card__title">Brand bar</h2>
              <p className="ax-card__subtitle">Logo + primary nav + search + actions — the standard product header.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-topnav" aria-label="Brand bar example" style={{ ...TOPNAV_BASE, padding: 'var(--ax-space-3) var(--ax-space-4)', flexWrap: 'wrap' }}>
              <a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none', color: 'var(--ax-text-strong)', flexWrap: 'nowrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)' }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9l-8 4.5l-8 -4.5v-9z" /><path d="M12 12l8 -4.5" /><path d="M12 12v9" /><path d="M12 12l-8 -4.5" /></svg>
                </span>
                <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)' }}>Vireo</b>
              </a>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', marginInlineStart: 'var(--ax-space-4)', flexWrap: 'nowrap' }}>
                <a href="#" className="ax-btn ax-btn--ghost ax-btn--sm" aria-current="page" style={{ color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' }}><span className="ax-btn__label">Dashboard</span></a>
                <a href="#" className="ax-btn ax-btn--ghost ax-btn--sm"><span className="ax-btn__label">Orders</span></a>
                <a href="#" className="ax-btn ax-btn--ghost ax-btn--sm"><span className="ax-btn__label">Products</span></a>
                <a href="#" className="ax-btn ax-btn--ghost ax-btn--sm"><span className="ax-btn__label">Customers</span></a>
              </div>
              <span className="ax-spacer" />
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)', padding: '6px var(--ax-space-3)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-pill)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                  <span>Search</span><kbd className="ax-kbd">⌘K</kbd>
                </div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Notifications" style={{ position: 'relative' }}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
                  <span className="ax-badge ax-badge--solid ax-badge--danger ax-badge--count" style={{ position: 'absolute', top: -2, insetInlineEnd: -2 }}>2</span>
                </button>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">AS</span></span>
              </div>
            </nav>
          </div>
        </section>

        {/* Section tabs nav */}
        <section className="ax-card ax-col--6" role="region" aria-label="Section tabs navbar">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Sub-navigation</span>
              <h2 className="ax-card__title">Section tabs</h2>
              <p className="ax-card__subtitle">A secondary tab rail for switching views within a page.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-topnav" aria-label="Section tabs example" style={{ ...TOPNAV_BASE, padding: 'var(--ax-space-2) var(--ax-space-3)', gap: 'var(--ax-space-1)' }}>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={tab === 'overview' ? { color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : undefined} aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => setTab('overview')}><span className="ax-btn__label">Overview</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={tab === 'analytics' ? { color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : undefined} aria-current={tab === 'analytics' ? 'page' : undefined} onClick={() => setTab('analytics')}><span className="ax-btn__label">Analytics</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={tab === 'reports' ? { color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : undefined} aria-current={tab === 'reports' ? 'page' : undefined} onClick={() => setTab('reports')}><span className="ax-btn__label">Reports</span><span className="ax-badge ax-badge--soft ax-badge--accent ax-num" style={{ marginInlineStart: 6 }}>3</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={tab === 'settings' ? { color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : undefined} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}><span className="ax-btn__label">Settings</span></button>
            </nav>
            <div style={{ marginTop: 'var(--ax-space-4)', padding: 'var(--ax-space-4)', background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              Active panel: <b style={{ color: 'var(--ax-text-strong)', textTransform: 'capitalize' }}>{tab}</b>
            </div>
          </div>
        </section>

        {/* Pill nav */}
        <section className="ax-card ax-col--6" role="region" aria-label="Pill navigation">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Filter</span>
              <h2 className="ax-card__title">Pill nav</h2>
              <p className="ax-card__subtitle">Rounded, washed-accent active state for filter rails.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-tabs ax-tabs--pill">
              <div className="ax-tabs__list" role="tablist" aria-label="Pill nav example">
                <button type="button" className={`ax-tabs__tab${seg === 'all' ? ' is-active' : ''}`} role="tab" aria-selected={seg === 'all'} onClick={() => setSeg('all')}>All<span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral ax-num">128</span></button>
                <button type="button" className={`ax-tabs__tab${seg === 'active' ? ' is-active' : ''}`} role="tab" aria-selected={seg === 'active'} onClick={() => setSeg('active')}>Active</button>
                <button type="button" className={`ax-tabs__tab${seg === 'draft' ? ' is-active' : ''}`} role="tab" aria-selected={seg === 'draft'} onClick={() => setSeg('draft')}>Draft</button>
                <button type="button" className={`ax-tabs__tab${seg === 'archived' ? ' is-active' : ''}`} role="tab" aria-selected={seg === 'archived'} onClick={() => setSeg('archived')}>Archived</button>
              </div>
            </div>
          </div>
        </section>

        {/* Marketing header */}
        <section className="ax-card ax-col--12" role="region" aria-label="Marketing site header navbar">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Marketing</span>
              <h2 className="ax-card__title">Site header</h2>
              <p className="ax-card__subtitle">A public landing-page header with centered links and a clear CTA.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-topnav" aria-label="Marketing header example" style={{ ...TOPNAV_BASE, padding: 'var(--ax-space-3) var(--ax-space-5)', flexWrap: 'wrap' }}>
              <a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-2)', textDecoration: 'none', color: 'var(--ax-text-strong)', flexWrap: 'nowrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)' }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5v9l-8 4.5l-8 -4.5v-9z" /></svg>
                </span>
                <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)' }}>Vireo</b>
              </a>
              <span className="ax-spacer" />
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginInline: 'auto', flexWrap: 'nowrap' }}>
                <a className="ax-link" href="#" style={{ color: 'var(--ax-text)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' }}>Features</a>
                <a className="ax-link" href="#" style={{ color: 'var(--ax-text)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' }}>Pricing</a>
                <a className="ax-link" href="#" style={{ color: 'var(--ax-text)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' }}>Docs</a>
                <a className="ax-link" href="#" style={{ color: 'var(--ax-text)', textDecoration: 'none', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' }}>Changelog</a>
              </div>
              <span className="ax-spacer" />
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                <a href="#" className="ax-btn ax-btn--ghost ax-btn--sm"><span className="ax-btn__label">Sign in</span></a>
                <a href="#" className="ax-btn ax-btn--primary ax-btn--sm"><span className="ax-btn__label">Start free trial</span></a>
              </div>
            </nav>
          </div>
        </section>

        {/* Toolbar nav */}
        <section className="ax-card ax-col--12" role="region" aria-label="Editor toolbar navbar">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Workspace</span>
              <h2 className="ax-card__title">Editor toolbar</h2>
              <p className="ax-card__subtitle">A document/editor bar — title, dividers, grouped tools &amp; a save action.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <nav className="ax-topnav" aria-label="Editor toolbar example" style={{ ...TOPNAV_BASE, padding: 'var(--ax-space-2) var(--ax-space-4)', flexWrap: 'wrap' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap', minWidth: 0 }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Back"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg></button>
                <span className="ax-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Q3 Revenue Report</span>
                <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill">Draft</span>
              </div>
              <span className="ax-divider ax-divider--vertical" style={{ blockSize: 24, marginInline: 'var(--ax-space-2)' }} />
              <div className="ax-cluster" style={{ gap: 2, flexWrap: 'nowrap' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bold"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Italic"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bulleted list" aria-pressed="true" style={{ color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
              </div>
              <span className="ax-spacer" />
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="ax-avatar ax-avatar--xs ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">PN</span></span>
                  <span className="ax-avatar ax-avatar--xs ax-avatar--ringed" style={{ marginInlineStart: -7, background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><span className="ax-avatar__initials">LB</span></span>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm"><span className="ax-btn__label">Preview</span></button>
                <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={() => toast({ msg: 'Report saved', tone: 'success' })}><span className="ax-btn__label">Save</span></button>
              </div>
            </nav>
          </div>
        </section>
      </div>
    </>
  );
}

export function Navbar() {
  return (
    <ToastProvider>
      <NavbarInner />
    </ToastProvider>
  );
}

export default Navbar;
