'use client';
/*
 * Chioni — header of the PLATEFORME space (S4, ADR 0017).
 *
 * The Vireo top bar, kept SOBER: sidebar toggle, light/dark quick-toggle and
 * the profile menu. Removed on purpose (the rich support module is S5):
 * ⌘K search (no command palette in this space), notifications, fullscreen,
 * the customizer, and — above all — the ACTIVE-CENTER selector: the operator
 * governs tenants, he does not belong to one.
 */
import Link from 'next/link';
import { Dropdown } from '../ui/Dropdown';
import { useCustomizer } from '../../context/CustomizerContext';
import { spacesOf, useAuth } from '@/context/AuthContext';
import { PLATFORM_ROLE_LABELS } from '@/lib/labels';

const ICON = {
  burger: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
  ),
  sun: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
  ),
  moon: (
    <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
  ),
};

/** Initials avatar — no external image host (page weight discipline). */
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

function ProfileAvatar({ name, src, size = 32 }: { name: string; src: string | null; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
      <img
        src={src}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ inlineSize: size, blockSize: size, borderRadius: '50%', objectFit: 'cover', display: 'inline-block' }}
      />
    );
  }
  return <InitialsAvatar name={name} size={size} />;
}

export function PlatformHeader() {
  const c = useCustomizer();
  const { me, signOut } = useAuth();

  const displayName =
    me && (me.first_name || me.last_name)
      ? `${me.first_name} ${me.last_name}`.trim()
      : (me?.phone ?? '');
  const multiSpace = spacesOf(me).length > 1;
  const role = me?.platform_staff?.role;

  return (
    <header className="ax-header" role="banner">
      <button
        type="button"
        className="ax-nav-toggle ax-icon-btn"
        onClick={c.toggleCollapsed}
        aria-label="Ouvrir ou fermer le menu"
        aria-expanded={!c.collapsed}
      >
        {ICON.burger}
      </button>

      <span className="ax-header__spacer"></span>

      <button
        type="button"
        className="ax-theme-toggle ax-icon-btn"
        data-ax-toggle="theme"
        onClick={c.toggleTheme}
        aria-pressed={c.themeResolved === 'dark'}
        aria-label="Basculer le mode sombre"
      >
        {c.themeResolved === 'dark' ? ICON.sun : ICON.moon}
      </button>

      <Dropdown
        className="ax-profile"
        panelClassName="ax-dropdown ax-profile__menu"
        trigger={({ open, triggerProps }) => (
          <button type="button" className="ax-profile__trigger" aria-label="Menu du compte" {...triggerProps} aria-expanded={open}>
            <ProfileAvatar name={displayName} src={me?.avatar ?? null} />
          </button>
        )}
      >
        <div className="ax-profile__card">
          <ProfileAvatar name={displayName} src={me?.avatar ?? null} size={40} />
          <span className="ax-profile__card-meta">
            <b>{displayName || 'Mon compte'}</b>
            <small>{role ? PLATFORM_ROLE_LABELS[role] : 'Plateforme Chioni'}</small>
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
    </header>
  );
}

export default PlatformHeader;
