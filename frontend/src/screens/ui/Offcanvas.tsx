'use client';
/*
 * Vireo Next.js — UI · Offcanvas (route "ui/offcanvas").
 *
 * Faithful re-expression of src/html/ui/offcanvas.html: slide-in drawers from
 * every edge (start filters, end cart, top notifications, bottom share) plus
 * width variants (sm/lg) and a settings drawer. Each Alpine axOffcanvas(edge)
 * becomes a useState-driven <Offcanvas> from _uikit (teleported to body,
 * focus-trapped, Escape/backdrop close). $toast → useToast(). DOM classes /
 * ARIA / copy match the reference 1:1.
 */
import { useId, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { Offcanvas, ToastProvider, useToast } from './_uikit';

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);

function StartDrawer() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <div>
      <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setOpen(true)}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
        <span className="ax-btn__label">From start</span>
      </button>
      <Offcanvas open={open} onClose={() => setOpen(false)} edge="start" labelledBy={titleId}>
        <div className="ax-offcanvas__header">
          <h2 className="ax-offcanvas__title" id={titleId}>Filters</h2>
          <button type="button" className="ax-offcanvas__close" onClick={() => setOpen(false)} aria-label="Close filters">{CLOSE_ICON}</button>
        </div>
        <div className="ax-offcanvas__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          <div className="ax-field">
            <span className="ax-label">Status</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="checkbox" className="ax-checkbox" defaultChecked /> Delivered</label>
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="checkbox" className="ax-checkbox" defaultChecked /> Shipped</label>
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="checkbox" className="ax-checkbox" /> Pending</label>
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><input type="checkbox" className="ax-checkbox" /> Cancelled</label>
            </div>
          </div>
          <hr className="ax-divider" />
          <div className="ax-field">
            <label className="ax-label" htmlFor="oc-min">Minimum total</label>
            <input id="oc-min" type="text" className="ax-input ax-num" defaultValue="$0" style={{ fontFamily: 'var(--ax-font-mono)' }} />
          </div>
          <div className="ax-field">
            <label className="ax-label" htmlFor="oc-seg">Segment</label>
            <select id="oc-seg" className="ax-select"><option>All segments</option><option>VIP</option><option>Returning</option><option>New</option></select>
          </div>
        </div>
        <div className="ax-offcanvas__footer" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setOpen(false)}>Reset</button>
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => { setOpen(false); toast({ msg: 'Filters applied', ttl: 2500 }); }}>Apply filters</button>
        </div>
      </Offcanvas>
    </div>
  );
}

function CartDrawer() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <div>
      <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setOpen(true)}>
        <span className="ax-btn__label">From end</span>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
      </button>
      <Offcanvas open={open} onClose={() => setOpen(false)} edge="end" labelledBy={titleId}>
        <div className="ax-offcanvas__header">
          <h2 className="ax-offcanvas__title" id={titleId}>Your cart <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill ax-num" style={{ marginInlineStart: 6 }}>4</span></h2>
          <button type="button" className="ax-offcanvas__close" onClick={() => setOpen(false)} aria-label="Close cart">{CLOSE_ICON}</button>
        </div>
        <div className="ax-offcanvas__body" style={{ padding: 0 }}>
          <ul className="ax-list">
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg></span></span>
              <span className="ax-list__content"><span className="ax-list__title">Matte Ceramic Mug</span><span className="ax-list__meta">Qty 2</span></span>
              <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$48.00</span>
            </li>
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span></span>
              <span className="ax-list__content"><span className="ax-list__title">Grid Notebook A5</span><span className="ax-list__meta">Qty 1</span></span>
              <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$16.00</span>
            </li>
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg></span></span>
              <span className="ax-list__content"><span className="ax-list__title">Aperture Desk Lamp</span><span className="ax-list__meta">Qty 1</span></span>
              <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$129.00</span>
            </li>
          </ul>
        </div>
        <div className="ax-offcanvas__footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 'var(--ax-space-3)' }}>
          <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', color: 'var(--ax-text-strong)' }}>$193.00</b></div>
          <button type="button" className="ax-btn ax-btn--primary ax-btn--block" onClick={() => { setOpen(false); toast({ msg: 'Proceeding to checkout', ttl: 2500 }); }}>Checkout</button>
        </div>
      </Offcanvas>
    </div>
  );
}

function TopDrawer() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <div>
      <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setOpen(true)}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
        <span className="ax-btn__label">From top</span>
      </button>
      <Offcanvas open={open} onClose={() => setOpen(false)} edge="top" labelledBy={titleId}>
        <div className="ax-offcanvas__header">
          <h2 className="ax-offcanvas__title" id={titleId}>Notifications</h2>
          <button type="button" className="ax-offcanvas__close" onClick={() => setOpen(false)} aria-label="Close notifications">{CLOSE_ICON}</button>
        </div>
        <div className="ax-offcanvas__body">
          <ul className="ax-timeline">
            <li className="ax-timeline__item ax-timeline__item--success">
              <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
              <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Tomás Herrera</b> moved deal &ldquo;Brightway Retail&rdquo; to Negotiation</p><span className="ax-timeline__time">12m ago</span></div>
            </li>
            <li className="ax-timeline__item">
              <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg></span>
              <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Lena Brandt</b> mentioned you in &ldquo;Design review&rdquo;</p><span className="ax-timeline__time">1h ago</span></div>
            </li>
            <li className="ax-timeline__item">
              <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
              <div className="ax-timeline__content"><p className="ax-timeline__title">Order <span style={{ color: 'var(--ax-accent)' }}>#10482</span> has shipped</p><span className="ax-timeline__time">2h ago</span></div>
            </li>
          </ul>
        </div>
        <div className="ax-offcanvas__footer"><button type="button" className="ax-btn ax-btn--ghost" onClick={() => { setOpen(false); toast({ msg: 'All marked as read', ttl: 2500 }); }}>Mark all read</button><button type="button" className="ax-btn ax-btn--secondary" onClick={() => setOpen(false)}>Close</button></div>
      </Offcanvas>
    </div>
  );
}

function BottomDrawer() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <div>
      <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setOpen(true)}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
        <span className="ax-btn__label">From bottom</span>
      </button>
      <Offcanvas open={open} onClose={() => setOpen(false)} edge="bottom" labelledBy={titleId}>
        <div className="ax-offcanvas__header">
          <h2 className="ax-offcanvas__title" id={titleId}>Share report</h2>
          <button type="button" className="ax-offcanvas__close" onClick={() => setOpen(false)} aria-label="Close share sheet">{CLOSE_ICON}</button>
        </div>
        <div className="ax-offcanvas__body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 'var(--ax-space-3)' }}>
            <button type="button" className="ax-btn ax-btn--secondary" style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-5)', gap: 'var(--ax-space-2)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg><span className="ax-btn__label">Email</span></button>
            <button type="button" className="ax-btn ax-btn--secondary" style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-5)', gap: 'var(--ax-space-2)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /><path d="M18 6m-2 0a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M18 18m-2 0a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M6 12m-2 0a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /></svg><span className="ax-btn__label">Share link</span></button>
            <button type="button" className="ax-btn ax-btn--secondary" style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-5)', gap: 'var(--ax-space-2)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Download</span></button>
            <button type="button" className="ax-btn ax-btn--secondary" style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-5)', gap: 'var(--ax-space-2)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20 4l-12 12" /><path d="M14 4h6v6" /></svg><span className="ax-btn__label">Open in new tab</span></button>
          </div>
          <div className="ax-field" style={{ marginTop: 'var(--ax-space-5)' }}>
            <label className="ax-label" htmlFor="oc-link">Shareable link</label>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
              <input id="oc-link" type="text" className="ax-input" readOnly value="https://app.vireo.io/r/748-2k-jun" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)' }} />
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => toast({ msg: 'Link copied', ttl: 2000 })}>Copy</button>
            </div>
          </div>
        </div>
      </Offcanvas>
    </div>
  );
}

function SimpleDrawer({ label, size, titleText, body }: {
  label: string; size?: 'sm' | 'lg'; titleText: string; body: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <div>
      <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" onClick={() => setOpen(true)}>{label}</button>
      <Offcanvas open={open} onClose={() => setOpen(false)} edge="end" size={size} labelledBy={titleId}>
        <div className="ax-offcanvas__header"><h2 className="ax-offcanvas__title" id={titleId}>{titleText}</h2><button type="button" className="ax-offcanvas__close" onClick={() => setOpen(false)} aria-label="Close">{CLOSE_ICON}</button></div>
        <div className="ax-offcanvas__body"><p style={{ margin: 0, color: 'var(--ax-text-muted)' }}>{body}</p></div>
      </Offcanvas>
    </div>
  );
}

function SettingsDrawer() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <div>
      <button type="button" className="ax-btn ax-btn--primary ax-btn--block" onClick={() => setOpen(true)}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
        <span className="ax-btn__label">Settings panel</span>
      </button>
      <Offcanvas open={open} onClose={() => setOpen(false)} edge="end" labelledBy={titleId}>
        <div className="ax-offcanvas__header"><h2 className="ax-offcanvas__title" id={titleId}>Notification settings</h2><button type="button" className="ax-offcanvas__close" onClick={() => setOpen(false)} aria-label="Close settings">{CLOSE_ICON}</button></div>
        <div className="ax-offcanvas__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
          <label className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3) 0', cursor: 'pointer' }}><span><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Email digests</span><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>A weekly summary every Monday</span></span><input type="checkbox" className="ax-switch" defaultChecked /></label>
          <hr className="ax-divider" />
          <label className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3) 0', cursor: 'pointer' }}><span><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Deal updates</span><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>When a deal changes stage</span></span><input type="checkbox" className="ax-switch" defaultChecked /></label>
          <hr className="ax-divider" />
          <label className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3) 0', cursor: 'pointer' }}><span><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Mentions</span><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>When someone @mentions you</span></span><input type="checkbox" className="ax-switch" /></label>
        </div>
        <div className="ax-offcanvas__footer"><button type="button" className="ax-btn ax-btn--ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="ax-btn ax-btn--primary" onClick={() => { setOpen(false); toast({ msg: 'Preferences saved', ttl: 2500 }); }}>Save</button></div>
      </Offcanvas>
    </div>
  );
}

function OffcanvasInner() {
  return (
    <>
      <PageHead
        title="Offcanvas"
        subtitle="Slide-in drawers from any edge — filters, cart, notifications, settings and command bars."
        actions={
          <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/modals">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M4 9h16" /></svg>
            <span className="ax-btn__label">Modals</span>
          </a>
        }
      />

      <div className="ax-dash-grid">
        {/* EDGES */}
        <section className="ax-card ax-col--8" role="region" aria-label="Offcanvas edges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Placement</span>
              <h2 className="ax-card__title">Drawer from any edge</h2>
              <p className="ax-card__subtitle">Start, end, top and bottom — each with header, scrolling body and footer.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <StartDrawer />
            <CartDrawer />
            <TopDrawer />
            <BottomDrawer />
          </div>
        </section>

        {/* SIZES + SETTINGS DRAWER */}
        <section className="ax-card ax-col--4" role="region" aria-label="Offcanvas sizes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Sizing</span>
              <h2 className="ax-card__title">Drawer widths</h2>
              <p className="ax-card__subtitle">Compact, default and wide end-drawers.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
            <SimpleDrawer label="Compact (320px)" size="sm" titleText="Quick view" body="A narrow 320px rail — for previews, quick edits and contextual help." />
            <SimpleDrawer label="Wide (540px)" size="lg" titleText="Order detail" body="A roomy 540px panel — fits a detail record, an editor or a multi-field form without feeling cramped." />
            <SettingsDrawer />
          </div>
        </section>
      </div>
    </>
  );
}

export function Offcanvas_() {
  return (
    <ToastProvider>
      <OffcanvasInner />
    </ToastProvider>
  );
}

export { Offcanvas_ as Offcanvas };
export default Offcanvas_;
