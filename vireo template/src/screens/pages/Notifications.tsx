'use client';
/*
 * Vireo React — Notifications (route "pages/notifications").
 *
 * Faithful re-expression of src/html/pages/notifications.html: filter tabs
 * (All / Unread / Mentions / System), a "mark all as read" action with an undo
 * alert, and grouped Today / Yesterday / Earlier rows whose unread styling and
 * dot toggle with the `unread` counter. Alpine state ported to React. DOM 1:1.
 */
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

type Filter = 'all' | 'unread' | 'mentions' | 'system';

const DISMISS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);

export function Notifications() {
  const [filter, setFilter] = useState<Filter>('all');
  const [unread, setUnread] = useState(4);
  const [cleared, setCleared] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markAll = () => {
    setUnread(0);
    setCleared(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCleared(false), 3000);
  };

  const unreadStyle: React.CSSProperties = unread > 0
    ? { borderInlineStart: '2px solid var(--ax-accent)', background: 'var(--ax-accent-wash)', paddingInlineStart: 'var(--ax-space-3)' }
    : { paddingInline: 0 };
  const dot = unread > 0 ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-accent)' }} aria-label="Unread" /> : null;

  const show = (...fs: Filter[]) => fs.includes(filter);

  const trailing = (time: string, extra?: ReactNode) => (
    <span className="ax-list__trailing" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
      {extra}
      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{time}</span>
      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Dismiss notification">{DISMISS}</button>
    </span>
  );

  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Everything that needs your attention, in one place."
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/pages/profile-settings">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
              <span className="ax-btn__label">Settings</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary" onClick={markAll} disabled={unread === 0}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 12l5 5l10 -10" /><path d="M2 12l5 5m5 -5l5 -5" /></svg>
              <span className="ax-btn__label">Mark all as read</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Notifications list">
          <div className="ax-card__header">
            <div className="ax-card__titles" style={{ flex: '1 1 auto' }}>
              <div className="ax-tabs">
                <div className="ax-tabs__list" role="tablist" aria-label="Filter notifications">
                  <button type="button" className="ax-tabs__tab" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>All<span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral ax-num">9</span></button>
                  <button type="button" className="ax-tabs__tab" role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>Unread<span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--accent ax-num">{unread}</span></button>
                  <button type="button" className="ax-tabs__tab" role="tab" aria-selected={filter === 'mentions'} onClick={() => setFilter('mentions')}>Mentions<span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral ax-num">2</span></button>
                  <button type="button" className="ax-tabs__tab" role="tab" aria-selected={filter === 'system'} onClick={() => setFilter('system')}>System<span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral ax-num">3</span></button>
                </div>
              </div>
            </div>
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0 }} aria-live="polite">
            {/* undo toast */}
            {cleared && (
              <div className="ax-alert ax-alert--success" style={{ marginBottom: 'var(--ax-space-4)' }}>
                <span className="ax-alert__icon"><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__message">All notifications marked as read.</p></div>
                <div className="ax-alert__actions"><button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => { setUnread(4); setCleared(false); }}>Undo</button></div>
              </div>
            )}

            {/* TODAY */}
            <div style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-semibold)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', padding: 'var(--ax-space-2) 0', position: 'sticky', top: 0, background: 'var(--ax-surface-raised)', zIndex: 1 }}>Today</div>
            <ul className="ax-list">
              {show('all', 'unread', 'mentions') && (
                <li className="ax-list__row" style={unreadStyle}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">TH</span></span></span>
                  <span className="ax-list__content"><span className="ax-list__title"><b style={{ color: 'var(--ax-text-strong)' }}>Tomás Herrera</b> mentioned you in <span style={{ color: 'var(--ax-accent)' }}>#design-systems</span></span><span className="ax-list__meta">"can you review the new density tokens before standup? @maya"</span></span>
                  {trailing('9:42 AM', dot)}
                </li>
              )}
              {show('all', 'unread') && (
                <li className="ax-list__row" style={unreadStyle}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span></span>
                  <span className="ax-list__content"><span className="ax-list__title">Payment of <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>$312.00</b> received from Camila Rossi</span><span className="ax-list__meta">Order #4821 · Stripe</span></span>
                  {trailing('8:15 AM', dot)}
                </li>
              )}
              {show('all') && (
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">DK</span></span></span>
                  <span className="ax-list__content"><span className="ax-list__title"><b style={{ color: 'var(--ax-text-strong)' }}>Devon Okafor</b> assigned you to <span style={{ color: 'var(--ax-text)' }}>TSK-318</span></span><span className="ax-list__meta">Fix focus ring on segmented control</span></span>
                  {trailing('7:50 AM')}
                </li>
              )}
            </ul>

            {/* YESTERDAY */}
            <div style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-semibold)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', padding: 'var(--ax-space-2) 0', marginTop: 'var(--ax-space-3)', position: 'sticky', top: 0, background: 'var(--ax-surface-raised)', zIndex: 1 }}>Yesterday</div>
            <ul className="ax-list">
              {show('all', 'unread', 'system') && (
                <li className="ax-list__row" style={unreadStyle}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-warning-500) 18%,transparent)', color: 'var(--ax-warning-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg></span></span>
                  <span className="ax-list__content"><span className="ax-list__title"><b style={{ color: 'var(--ax-text-strong)' }}>New sign-in</b> from Madrid, Spain <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill">Security</span></span><span className="ax-list__meta ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Edge 126 · 88.4.220.9</span></span>
                  <span className="ax-list__trailing ax-flex" style={{ alignItems: 'center', gap: 'var(--ax-space-3)' }}>{dot}<span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>6:30 PM</span><button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Dismiss notification">{DISMISS}</button></span>
                </li>
              )}
              {show('all', 'mentions') && (
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><span className="ax-avatar__initials">AS</span></span></span>
                  <span className="ax-list__content"><span className="ax-list__title"><b style={{ color: 'var(--ax-text-strong)' }}>Ava Sutton</b> replied to your comment on <span style={{ color: 'var(--ax-accent)' }}>Sidebar density</span></span><span className="ax-list__meta">"agreed — let's ship the tighter spec @maya"</span></span>
                  {trailing('2:18 PM')}
                </li>
              )}
              {show('all', 'system') && (
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /></svg></span></span>
                  <span className="ax-list__content"><span className="ax-list__title">Your weekly digest is ready <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">System</span></span><span className="ax-list__meta">14 updates across 3 projects</span></span>
                  {trailing('9:00 AM')}
                </li>
              )}
            </ul>

            {/* EARLIER */}
            <div style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-semibold)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', padding: 'var(--ax-space-2) 0', marginTop: 'var(--ax-space-3)', position: 'sticky', top: 0, background: 'var(--ax-surface-raised)', zIndex: 1 }}>Earlier</div>
            <ul className="ax-list">
              {show('all', 'system') && (
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg></span></span>
                  <span className="ax-list__content"><span className="ax-list__title">Your card ending <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>7045</span> expires next month <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill">Billing</span></span><span className="ax-list__meta">Update it to avoid interruption</span></span>
                  {trailing('Jun 22')}
                </li>
              )}
              {show('all') && (
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><span className="ax-avatar__initials">PN</span></span></span>
                  <span className="ax-list__content"><span className="ax-list__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya Nair</b> shared the Q2 report with you</span><span className="ax-list__meta">Quarterly metrics · 18 pages</span></span>
                  {trailing('Jun 21')}
                </li>
              )}
            </ul>

            {/* caught up marker */}
            <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-5) 0 var(--ax-space-2)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              You're all caught up
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Notifications;
