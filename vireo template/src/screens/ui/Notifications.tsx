'use client';
/*
 * Vireo Next.js — UI · Notifications (route "ui/notifications").
 *
 * Faithful re-expression of src/html/ui/notifications.html: the bell header
 * dropdown panel (tab + unread state → useState), the typed item vocabulary,
 * actionable accept/dismiss rows with an all-caught-up empty state, and inline
 * banners. Alpine $toast → useToast(). DOM classes / ARIA / copy match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ToastProvider, useToast } from './_uikit';

const X = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);

function HeaderPanel() {
  const [tab, setTab] = useState<'all' | 'unread' | 'mentions'>('all');
  const [unread, setUnread] = useState(2);
  return (
    <section className="ax-card ax-col--5" role="region" aria-label="Header notification panel">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Overlay</span>
          <h2 className="ax-card__title">Header panel</h2>
          <p className="ax-card__subtitle">The bell dropdown — header, tabs, list &amp; footer in one glass menu.</p>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        <div className="ax-dropdown ax-notif__menu" style={{ position: 'static', inlineSize: '100%', maxInlineSize: 'none', maxBlockSize: 'none', boxShadow: 'var(--ax-shadow-md)' }}>
          {/* panel header */}
          <div className="ax-cluster ax-cluster--between" style={{ padding: 'var(--ax-space-3) var(--ax-space-3) var(--ax-space-1)', flexWrap: 'nowrap' }}>
            <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Notifications {unread > 0 && <span className="ax-badge ax-badge--soft ax-badge--accent ax-num">{unread}</span>}</b>
            <button type="button" className="ax-notif__mark-all" onClick={() => setUnread(0)}>Mark all read</button>
          </div>
          {/* tabs */}
          <div className="ax-notif__tabs">
            <button type="button" className={`ax-notif__tab${tab === 'all' ? ' is-active' : ''}`} onClick={() => setTab('all')}>All</button>
            <button type="button" className={`ax-notif__tab${tab === 'unread' ? ' is-active' : ''}`} onClick={() => setTab('unread')}>Unread</button>
            <button type="button" className={`ax-notif__tab${tab === 'mentions' ? ' is-active' : ''}`} onClick={() => setTab('mentions')}>Mentions</button>
          </div>
          {/* list */}
          <ul className="ax-notif__list" style={{ padding: '0 var(--ax-space-2) var(--ax-space-2)' }}>
            {tab !== 'mentions' && (
              <li className="ax-notif__row is-unread">
                <span className="ax-notif__chip" style={{ color: 'var(--ax-viz-violet)', background: 'color-mix(in oklab,var(--ax-viz-violet) 16%,transparent)' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" /><path d="M9 10h.01" /><path d="M12 10h.01" /><path d="M15 10h.01" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Tomás Herrera</span><span className="ax-notif__text">Moved deal &ldquo;Brightway Retail&rdquo; to Negotiation</span><span className="ax-notif__time">12m ago</span></span>
                <span className="ax-notif__dot" style={{ background: 'var(--ax-accent)' }} />
              </li>
            )}
            <li className="ax-notif__row is-unread">
              <span className="ax-notif__chip" style={{ color: 'var(--ax-viz-cyan)', background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg></span>
              <span className="ax-notif__body"><span className="ax-notif__title">Lena Brandt</span><span className="ax-notif__text">Mentioned you in &ldquo;Design review&rdquo;</span><span className="ax-notif__time">1h ago</span></span>
              <span className="ax-notif__dot" style={{ background: 'var(--ax-accent)' }} />
            </li>
            {tab === 'all' && (
              <li className="ax-notif__row">
                <span className="ax-notif__chip ax-notif__chip--success"><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7h13l-1.5 9a2 2 0 0 1 -2 1.5h-6a2 2 0 0 1 -2 -1.5z" /><path d="M9 11v-5a3 3 0 0 1 6 0v5" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Order #10482</span><span className="ax-notif__text">Has shipped to Camila Rossi</span><span className="ax-notif__time">2h ago</span></span>
              </li>
            )}
            {tab === 'all' && (
              <li className="ax-notif__row">
                <span className="ax-notif__chip" style={{ color: 'var(--ax-text-subtle)' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Northwind Pulse</span><span className="ax-notif__text">Your weekly digest is ready</span><span className="ax-notif__time">1d ago</span></span>
              </li>
            )}
          </ul>
          {/* footer */}
          <div style={{ padding: 'var(--ax-space-1) var(--ax-space-2)', borderBlockStart: '1px solid var(--ax-border)' }}>
            <a className="ax-btn ax-btn--ghost ax-btn--block ax-btn--sm" href="/pages/notifications"><span className="ax-btn__label">View all notifications</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Actionable() {
  const toast = useToast();
  const [items, setItems] = useState<number[]>([1, 2]);
  const handle = (i: number, act: string) => {
    setItems((cur) => cur.filter((x) => x !== i));
    toast(act);
  };
  return (
    <section className="ax-card ax-col--6" role="region" aria-label="Actionable notifications">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Interactive</span>
          <h2 className="ax-card__title">With actions</h2>
          <p className="ax-card__subtitle">Inline accept / dismiss without leaving the panel.</p>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--ax-space-6) 0', color: 'var(--ax-text-subtle)' }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 'var(--ax-space-2)' }}><path d="M5 12l5 5l10 -10" /></svg>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)' }}>You&rsquo;re all caught up.</p>
          </div>
        )}
        {items.includes(1) && (
          <div className="ax-notif__row" style={{ background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)', alignItems: 'center' }}>
            <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">DO</span></span>
            <span className="ax-notif__body"><span className="ax-notif__title">Workspace invite</span><span className="ax-notif__text">Devon Okafor invited you to &ldquo;Q3 Planning&rdquo;</span></span>
            <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
              <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={() => handle(1, 'Invite accepted')}><span className="ax-btn__label">Accept</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => handle(1, 'Invite declined')}><span className="ax-btn__label">Decline</span></button>
            </span>
          </div>
        )}
        {items.includes(2) && (
          <div className="ax-notif__row" style={{ background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)', alignItems: 'center' }}>
            <span className="ax-notif__chip" style={{ color: 'var(--ax-viz-amber)', background: 'color-mix(in oklab,var(--ax-viz-amber) 16%,transparent)' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg></span>
            <span className="ax-notif__body"><span className="ax-notif__title">Review requested</span><span className="ax-notif__text">Hana Yılmaz needs sign-off on the June campaign</span></span>
            <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => handle(2, 'Opened for review')}><span className="ax-btn__label">Review</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Dismiss" onClick={() => handle(2, 'Dismissed')}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function Banners() {
  const [open, setOpen] = useState(true);
  return (
    <section className="ax-card ax-col--6" role="region" aria-label="Notification banners and states">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Inline</span>
          <h2 className="ax-card__title">Banners</h2>
          <p className="ax-card__subtitle">Page-level notices that aren&rsquo;t toasts — persistent and dismissible.</p>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
        {open && (
          <div className="ax-alert ax-alert--accent ax-alert--accent-edge">
            <span className="ax-alert__icon"><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg></span>
            <div className="ax-alert__content"><p className="ax-alert__title">New analytics are live</p><p className="ax-alert__message">Cohort retention has landed on the reports page.</p></div>
            <button type="button" className="ax-alert__dismiss" onClick={() => setOpen(false)} aria-label="Dismiss banner">{X}</button>
          </div>
        )}
        <div className="ax-alert ax-alert--warning ax-alert--accent-edge">
          <span className="ax-alert__icon"><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">Card expiring soon</p><p className="ax-alert__message">Visa ending 7045 expires next month. Update it to avoid interruptions.</p>
            <div className="ax-alert__actions"><button type="button" className="ax-btn ax-btn--warning ax-btn--sm ax-btn--solid"><span className="ax-btn__label">Update card</span></button></div>
          </div>
        </div>
        <div className="ax-alert ax-alert--neutral" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="ax-alert__content" style={{ textAlign: 'center' }}>
            <p className="ax-alert__message" style={{ margin: 0 }}>No new system notifications.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function NotificationsInner() {
  const toast = useToast();
  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="The notification panel & item vocabulary — typed icon chips, unread rows, actionable items and a header dropdown. Distinct from transient toasts."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/pages/notifications">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /><path d="M2 12l5 5m5 -5l5 -5" /></svg>
              <span className="ax-btn__label">Full inbox</span>
            </a>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => toast({ msg: 'Push notification sent', tone: 'success' })}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
              <span className="ax-btn__label">Send test push</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <HeaderPanel />

        {/* Item types */}
        <section className="ax-card ax-col--7" role="region" aria-label="Notification item types">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Anatomy</span>
              <h2 className="ax-card__title">Item types</h2>
              <p className="ax-card__subtitle">Each type pairs a tinted icon chip with a title, body &amp; timestamp.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-notif__list" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li className="ax-notif__row">
                <span className="ax-notif__chip" style={{ color: 'var(--ax-viz-cyan)', background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Message <span className="ax-badge ax-badge--soft ax-badge--info" style={{ marginInlineStart: 4 }}>Message</span></span><span className="ax-notif__text">Marcus Reyes sent you a note about the deploy window</span><span className="ax-notif__time">9:42 AM</span></span>
              </li>
              <li className="ax-notif__row">
                <span className="ax-notif__chip ax-notif__chip--success"><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Payment received <span className="ax-badge ax-badge--soft ax-badge--success" style={{ marginInlineStart: 4 }}>Billing</span></span><span className="ax-notif__text"><span className="ax-num">$312.00</span> from Camila Rossi cleared via Stripe</span><span className="ax-notif__time">8:15 AM</span></span>
              </li>
              <li className="ax-notif__row">
                <span className="ax-notif__chip ax-notif__chip--warning"><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Low stock <span className="ax-badge ax-badge--soft ax-badge--warning" style={{ marginInlineStart: 4 }}>Inventory</span></span><span className="ax-notif__text">Brass Task Light is down to <span className="ax-num">22</span> units</span><span className="ax-notif__time">Yesterday</span></span>
              </li>
              <li className="ax-notif__row">
                <span className="ax-notif__chip" style={{ color: 'var(--ax-danger-500)', background: 'var(--ax-danger-50)' }}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Payment failed <span className="ax-badge ax-badge--soft ax-badge--danger" style={{ marginInlineStart: 4 }}>Alert</span></span><span className="ax-notif__text">Card charge for Daniel Cho was declined</span><span className="ax-notif__time">2d ago</span></span>
              </li>
              <li className="ax-notif__row">
                <span className="ax-notif__chip" style={{ overflow: 'hidden', background: 'transparent' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><span className="ax-avatar__initials">PN</span></span></span>
                <span className="ax-notif__body"><span className="ax-notif__title">Priya Nair <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ marginInlineStart: 4 }}>Mention</span></span><span className="ax-notif__text">Mentioned you in <span style={{ color: 'var(--ax-accent)' }}>#analytics</span></span><span className="ax-notif__time">3d ago</span></span>
              </li>
            </ul>
          </div>
        </section>

        <Actionable />
        <Banners />
      </div>
    </>
  );
}

export function Notifications() {
  return (
    <ToastProvider>
      <NotificationsInner />
    </ToastProvider>
  );
}

export default Notifications;
