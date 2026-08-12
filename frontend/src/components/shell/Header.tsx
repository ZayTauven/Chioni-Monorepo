'use client';
/*
 * Vireo Next.js — Header (top bar).
 *
 * Faithful re-expression of partials/header.html: sidebar toggle, ⌘K command
 * search, language menu, fullscreen, light/dark quick-toggle, app grid, cart,
 * notifications, profile, and the customizer trigger. Dropdowns use the native
 * <Dropdown> primitive (Alpine axDropdown re-implementation). Same DOM classes
 * and ARIA as the reference so pixels match.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dropdown } from '../ui/Dropdown';
import { useCustomizer } from '../../context/CustomizerContext';

const ICON = {
  burger: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
  ),
  search: (
    <svg className="ax-icon ax-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
  ),
  apps: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
  ),
  cart: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304" /><path d="M9 11v-5a3 3 0 0 1 6 0v5" /></svg>
  ),
  bell: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
  ),
  cog: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M6 4v4" /><path d="M6 12v8" /><path d="M10 16a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M12 4v10" /><path d="M12 18v2" /><path d="M16 7a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M18 4v1" /><path d="M18 9v11" /></svg>
  ),
  check: (
    <svg className="ax-dropdown__check ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
  ),
};

const LANGS: Array<[string, string]> = [
  ['EN', 'English'],
  ['ES', 'Español'],
  ['FR', 'Français'],
  ['AR', 'العربية'],
  ['DE', 'Deutsch'],
  ['ZH', '中文'],
  ['IT', 'Italiano'],
  ['RU', 'Русский'],
];

export function Header({
  onCommand,
  onCustomizer,
}: {
  onCommand: () => void;
  onCustomizer: () => void;
}) {
  const c = useCustomizer();
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <header className="ax-header" role="banner">
      {/* 1 · SIDEBAR TOGGLE */}
      <button
        type="button"
        className="ax-nav-toggle ax-icon-btn"
        onClick={c.toggleCollapsed}
        aria-label="Toggle menu"
        aria-expanded={!c.collapsed}
      >
        {ICON.burger}
      </button>

      {/* 2 · COMMAND SEARCH (⌘K) */}
      <button
        type="button"
        className="ax-search"
        onClick={onCommand}
        aria-haspopup="dialog"
        aria-controls="ax-command"
        aria-label="Search or jump to"
      >
        {ICON.search}
        <span className="ax-search__placeholder">Search or jump to…</span>
        <kbd className="ax-search__keycap">⌘K</kbd>
      </button>

      <span className="ax-header__spacer"></span>

      {/* 4 · LANGUAGE */}
      <Dropdown
        className="ax-lang"
        panelClassName="ax-dropdown ax-lang__menu"
        trigger={({ open, triggerProps }) => (
          <button
            type="button"
            className="ax-icon-btn ax-lang__trigger"
            aria-label="Change language"
            {...triggerProps}
            aria-expanded={open}
          >
            <span className="ax-lang__code">{c.lang}</span>
          </button>
        )}
      >
        {LANGS.map(([code, name]) => (
          <button
            key={code}
            type="button"
            className={`ax-dropdown__item${c.lang === code ? ' is-active' : ''}`}
            role="menuitemradio"
            aria-checked={c.lang === code}
            onClick={() => c.setLang(code)}
          >
            <span className="ax-lang__code">{code}</span>
            <span className="ax-lang__name">{name}</span>
            {c.lang === code && ICON.check}
          </button>
        ))}
      </Dropdown>

      {/* 5 · FULLSCREEN */}
      <button
        type="button"
        className="ax-fullscreen ax-icon-btn"
        onClick={toggleFullscreen}
        aria-pressed={full}
        aria-label="Toggle fullscreen"
      >
        {!full ? (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" /></svg>
        ) : (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M15 19v-2a2 2 0 0 1 2 -2h2" /><path d="M15 5v2a2 2 0 0 0 2 2h2" /><path d="M5 15h2a2 2 0 0 1 2 2v2" /><path d="M5 9h2a2 2 0 0 0 2 -2v-2" /></svg>
        )}
      </button>

      {/* 6 · LIGHT/DARK QUICK-TOGGLE */}
      <button
        type="button"
        className="ax-theme-toggle ax-icon-btn"
        data-ax-toggle="theme"
        onClick={c.toggleTheme}
        aria-pressed={c.themeResolved === 'dark'}
        aria-label="Toggle dark mode"
      >
        {c.themeResolved === 'dark' ? (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
        ) : (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
        )}
      </button>

      {/* 7 · APP-GRID */}
      <Dropdown
        className="ax-apps"
        panelClassName="ax-dropdown ax-apps__menu"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-icon-btn ax-apps__trigger" aria-label="Open apps" {...triggerProps} aria-expanded={open}>
            {ICON.apps}
          </button>
        )}
      >
        <p className="ax-dropdown__head">Quick apps</p>
        <div className="ax-apps__grid">
          <AppTile to="/apps/email" label="Email" />
          <AppTile to="/apps/chat" label="Chat" />
          <AppTile to="/apps/calendar" label="Calendar" />
          <AppTile to="/apps/kanban" label="Kanban" />
          <AppTile to="/apps/file-manager" label="Files" />
          <AppTile to="/apps/contacts" label="Contacts" />
          <AppTile to="/ecommerce/invoices" label="Invoices" />
          <AppTile to="/apps/notes" label="Notes" />
        </div>
        <Link className="ax-dropdown__foot" href="/widgets">View all apps</Link>
      </Dropdown>

      {/* 8 · CART */}
      <Dropdown
        className="ax-cart"
        panelClassName="ax-dropdown ax-cart__menu"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-icon-btn ax-cart__trigger" aria-label="Shopping cart, 3 items" {...triggerProps} aria-expanded={open}>
            {ICON.cart}
            <span className="ax-badge-count" aria-hidden="true">3</span>
          </button>
        )}
      >
        <div className="ax-dropdown__head ax-cart__head"><span>Cart</span><span className="ax-cart__count">3 items</span></div>
        <ul className="ax-cart__list" role="presentation">
          <CartRow seed="ax-prod-1" name="Aurora Wireless Buds" qty="1 × $129.00" />
          <CartRow seed="ax-prod-2" name="Verdigris Mechanical Keyboard" qty="1 × $189.00" />
          <CartRow seed="ax-prod-3" name="Glass Desk Mat — XL" qty="2 × $34.00" />
        </ul>
        <div className="ax-cart__subtotal"><span>Subtotal</span><span className="ax-mono">$386.00</span></div>
        <div className="ax-cart__actions">
          <Link className="ax-btn ax-btn--ghost ax-btn--sm" href="/ecommerce/cart">View cart</Link>
          <Link className="ax-btn ax-btn--accent ax-btn--sm" href="/ecommerce/checkout">Checkout</Link>
        </div>
      </Dropdown>

      {/* 9 · NOTIFICATIONS */}
      <Dropdown
        className="ax-notif"
        panelClassName="ax-dropdown ax-notif__menu"
        panelRole="dialog"
        panelAriaLabel="Notifications"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-icon-btn ax-notif__trigger" aria-label="Notifications, 2 unread" {...triggerProps} aria-haspopup="dialog" aria-expanded={open}>
            {ICON.bell}
            <span className="ax-badge-count ax-badge-count--dot" aria-hidden="true">2</span>
          </button>
        )}
      >
        <div className="ax-dropdown__head ax-notif__head">
          <span>Notifications</span>
          <button type="button" className="ax-notif__mark-all">Mark all read</button>
        </div>
        <ul className="ax-notif__list" role="presentation">
          <li className="ax-notif__row is-unread">
            <span className="ax-notif__chip"><img className="ax-avatar" src="https://i.pravatar.cc/64?img=32" alt="" width={34} height={34} /></span>
            <span className="ax-notif__body"><b className="ax-notif__title">Mara Chen mentioned you</b><span className="ax-notif__text">“Can you review the Q3 revenue figures before the sync?”</span><time className="ax-notif__time ax-mono">2m ago</time></span>
            <span className="ax-notif__dot" aria-label="Unread"></span>
          </li>
          <li className="ax-notif__row is-unread">
            <span className="ax-notif__chip ax-notif__chip--success">{ICON.check}</span>
            <span className="ax-notif__body"><b className="ax-notif__title">Payment received</b><span className="ax-notif__text">Invoice #INV-2049 was paid — $1,280.00.</span><time className="ax-notif__time ax-mono">1h ago</time></span>
            <span className="ax-notif__dot" aria-label="Unread"></span>
          </li>
          <li className="ax-notif__row">
            <span className="ax-notif__chip"><img className="ax-avatar" src="https://i.pravatar.cc/64?img=15" alt="" width={34} height={34} /></span>
            <span className="ax-notif__body"><b className="ax-notif__title">New follower</b><span className="ax-notif__text">Devin Park started following your store.</span><time className="ax-notif__time ax-mono">5h ago</time></span>
          </li>
        </ul>
        <Link className="ax-dropdown__foot" href="/pages/notifications">View all notifications</Link>
      </Dropdown>

      {/* 10 · PROFILE */}
      <Dropdown
        className="ax-profile"
        panelClassName="ax-dropdown ax-profile__menu"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-profile__trigger" aria-label="Account menu" {...triggerProps} aria-expanded={open}>
            <img className="ax-avatar ax-profile__avatar" src="https://i.pravatar.cc/64?img=12" alt="Jacob Gerrald" width={32} height={32} />
          </button>
        )}
      >
        <div className="ax-profile__card">
          <img className="ax-avatar" src="https://i.pravatar.cc/80?img=12" alt="" width={40} height={40} />
          <span className="ax-profile__card-meta"><b>Jacob Gerrald</b><small>jacob@vireo.io</small></span>
        </div>
        <Link className="ax-dropdown__item" role="menuitem" href="/pages/profile">View Profile</Link>
        <Link className="ax-dropdown__item" role="menuitem" href="/pages/profile-settings">Account Settings</Link>
        <Link className="ax-dropdown__item" role="menuitem" href="/pages/support">Support</Link>
        <Link className="ax-dropdown__item" role="menuitem" href="/pages/activity-log">Activity Log</Link>
        <div className="ax-dropdown__divider" role="separator"></div>
        <Link className="ax-dropdown__item ax-dropdown__item--danger" role="menuitem" href="/pages/logout">Log Out</Link>
      </Dropdown>

      {/* 11 · CUSTOMIZER TRIGGER */}
      <button
        type="button"
        className="ax-cog ax-icon-btn"
        data-ax-toggle="customizer"
        onClick={onCustomizer}
        aria-haspopup="dialog"
        aria-controls="ax-customizer"
        aria-label="Open theme customizer"
      >
        {ICON.cog}
      </button>
    </header>
  );
}

function AppTile({ to, label }: { to: string; label: string }) {
  return (
    <Link className="ax-apps__tile" role="menuitem" href={to}>
      <span className="ax-apps__tile-icon">
        <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg>
      </span>
      <span className="ax-apps__tile-label">{label}</span>
    </Link>
  );
}

function CartRow({ seed, name, qty }: { seed: string; name: string; qty: string }) {
  return (
    <li className="ax-cart__row">
      <img className="ax-cart__thumb" src={`https://picsum.photos/seed/${seed}/80`} alt="" width={40} height={40} />
      <span className="ax-cart__meta"><b className="ax-cart__name">{name}</b><span className="ax-cart__qty ax-mono">{qty}</span></span>
      <button type="button" className="ax-cart__remove" aria-label="Remove item">
        <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
      </button>
    </li>
  );
}

export default Header;
