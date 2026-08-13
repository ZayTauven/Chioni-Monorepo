'use client';
/*
 * Chioni — centre-space header (adapted from the Vireo top bar).
 *
 * Kept from the template: sidebar toggle, ⌘K command search, fullscreen,
 * light/dark quick-toggle, notifications, customizer trigger. Removed: cart,
 * app grid, 8-language menu (French only for now, shikomori in phase 2).
 * Added: active-center selector (multi-center staff) and an auth-wired
 * profile menu (name/phone, space switcher, sign-out).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dropdown } from '../ui/Dropdown';
import { useCustomizer } from '../../context/CustomizerContext';
import { spacesOf, useAuth } from '@/context/AuthContext';
import { useCenter } from '@/context/CenterContext';
import { Icon } from '../ui/Icon';

const ICON = {
  burger: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
  ),
  search: (
    <svg className="ax-icon ax-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
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

/** Initials avatar (no external image hosts — Comoros-friendly page weight). */
function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="ax-avatar"
      aria-hidden="true"
      style={{
        inlineSize: size,
        blockSize: size,
        display: 'inline-grid',
        placeItems: 'center',
        background: 'var(--ax-accent-wash)',
        color: 'var(--ax-accent)',
        fontSize: 'var(--ax-text-xs)',
        fontWeight: 'var(--ax-weight-semibold)',
      }}
    >
      {initials || '·'}
    </span>
  );
}

export function Header({
  onCommand,
  onCustomizer,
}: {
  onCommand: () => void;
  onCustomizer: () => void;
}) {
  const c = useCustomizer();
  const { me, signOut } = useAuth();
  const { center, memberships, switchCenter } = useCenter();
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

  const displayName =
    me && (me.first_name || me.last_name)
      ? `${me.first_name} ${me.last_name}`.trim()
      : (me?.phone ?? '');
  const multiSpace = spacesOf(me).length > 1;

  return (
    <header className="ax-header" role="banner">
      {/* 1 · SIDEBAR TOGGLE */}
      <button
        type="button"
        className="ax-nav-toggle ax-icon-btn"
        onClick={c.toggleCollapsed}
        aria-label="Ouvrir ou fermer le menu"
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
        aria-label="Rechercher une page"
      >
        {ICON.search}
        <span className="ax-search__placeholder">Rechercher…</span>
        <kbd className="ax-search__keycap">⌘K</kbd>
      </button>

      <span className="ax-header__spacer"></span>

      {/* 3 · ACTIVE CENTER (selector when the user works in several centers) */}
      {memberships.length > 1 ? (
        <Dropdown
          className="ax-lang"
          panelClassName="ax-dropdown"
          trigger={({ open, triggerProps }) => (
            <button
              type="button"
              className="ax-btn ax-btn--ghost ax-btn--sm"
              aria-label={`Centre actif : ${center.name}. Changer de centre`}
              {...triggerProps}
              aria-expanded={open}
            >
              <Icon name="building-hospital" className="ax-btn__icon" />
              <span className="ax-btn__label">{center.name}</span>
            </button>
          )}
        >
          <p className="ax-dropdown__head">Mes centres</p>
          {memberships.map((m) => (
            <button
              key={m.center.id}
              type="button"
              className={`ax-dropdown__item${m.center.id === center.id ? ' is-active' : ''}`}
              aria-pressed={m.center.id === center.id}
              onClick={() => switchCenter(m.center.id)}
            >
              <span>{m.center.name}</span>
              {m.center.id === center.id && ICON.check}
            </button>
          ))}
        </Dropdown>
      ) : (
        <span
          className="ax-cluster"
          style={{ gap: 'var(--ax-space-2)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}
        >
          <Icon name="building-hospital" className="ax-icon" style={{ inlineSize: 18, blockSize: 18 }} />
          <span>{center.name}</span>
        </span>
      )}

      {/* 4 · FULLSCREEN */}
      <button
        type="button"
        className="ax-fullscreen ax-icon-btn"
        onClick={toggleFullscreen}
        aria-pressed={full}
        aria-label="Plein écran"
      >
        {!full ? (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 8v-2a2 2 0 0 1 2 -2h2" /><path d="M4 16v2a2 2 0 0 0 2 2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M16 20h2a2 2 0 0 0 2 -2v-2" /></svg>
        ) : (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M15 19v-2a2 2 0 0 1 2 -2h2" /><path d="M15 5v2a2 2 0 0 0 2 2h2" /><path d="M5 15h2a2 2 0 0 1 2 2v2" /><path d="M5 9h2a2 2 0 0 0 2 -2v-2" /></svg>
        )}
      </button>

      {/* 5 · LIGHT/DARK QUICK-TOGGLE */}
      <button
        type="button"
        className="ax-theme-toggle ax-icon-btn"
        data-ax-toggle="theme"
        onClick={c.toggleTheme}
        aria-pressed={c.themeResolved === 'dark'}
        aria-label="Basculer le mode sombre"
      >
        {c.themeResolved === 'dark' ? (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
        ) : (
          <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
        )}
      </button>

      {/* 6 · NOTIFICATIONS (static for now — no notification API yet) */}
      <Dropdown
        className="ax-notif"
        panelClassName="ax-dropdown ax-notif__menu"
        panelRole="dialog"
        panelAriaLabel="Notifications"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-icon-btn ax-notif__trigger" aria-label="Notifications" {...triggerProps} aria-haspopup="dialog" aria-expanded={open}>
            {ICON.bell}
          </button>
        )}
      >
        <div className="ax-dropdown__head ax-notif__head">
          <span>Notifications</span>
        </div>
        <ul className="ax-notif__list" role="presentation">
          <li className="ax-notif__row">
            <span className="ax-notif__chip ax-notif__chip--success">{ICON.check}</span>
            <span className="ax-notif__body">
              <b className="ax-notif__title">Bienvenue sur Chioni</b>
              <span className="ax-notif__text">Les notifications de votre centre s&rsquo;afficheront ici.</span>
            </span>
          </li>
        </ul>
      </Dropdown>

      {/* 7 · PROFILE */}
      <Dropdown
        className="ax-profile"
        panelClassName="ax-dropdown ax-profile__menu"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-profile__trigger" aria-label="Menu du compte" {...triggerProps} aria-expanded={open}>
            <InitialsAvatar name={displayName} />
          </button>
        )}
      >
        <div className="ax-profile__card">
          <InitialsAvatar name={displayName} size={40} />
          <span className="ax-profile__card-meta">
            <b>{displayName || 'Mon compte'}</b>
            <small>{me?.phone}</small>
          </span>
        </div>
        {multiSpace && (
          <Link className="ax-dropdown__item" href="/espaces">
            Changer d&rsquo;espace
          </Link>
        )}
        <div className="ax-dropdown__divider" aria-hidden="true"></div>
        <button
          type="button"
          className="ax-dropdown__item ax-dropdown__item--danger"
          onClick={() => void signOut()}
        >
          Se déconnecter
        </button>
      </Dropdown>

      {/* 8 · CUSTOMIZER TRIGGER */}
      <button
        type="button"
        className="ax-cog ax-icon-btn"
        data-ax-toggle="customizer"
        onClick={onCustomizer}
        aria-haspopup="dialog"
        aria-controls="ax-customizer"
        aria-label="Ouvrir les réglages du thème"
      >
        {ICON.cog}
      </button>
    </header>
  );
}

export default Header;
