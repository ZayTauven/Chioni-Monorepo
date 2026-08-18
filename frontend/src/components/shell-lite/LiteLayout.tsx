'use client';
/*
 * Chioni — LiteLayout: the mobile-first chrome of the patient and guardian
 * spaces. Sober header (brand, page title, profile menu) + centred column
 * (max ~640px) + fixed bottom tab bar (4 tabs max, ≥44px touch targets).
 * Styles live in src/styles/shell-lite.css on the --ax-* tokens.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dropdown } from '../ui/Dropdown';
import { Icon } from '../ui/Icon';
import { spacesOf, useAuth } from '@/context/AuthContext';

export interface LiteTab {
  href: string;
  label: string;
  icon: string;
}

/** SV — un titre de page HORS onglets (ex. /patient/rendez-vous, qui
 *  affichait « Accueil » : le préfixe /patient gagnait le match). */
export interface LitePageTitle {
  href: string;
  label: string;
}

const HEX_LOGO = (
  <svg viewBox="0 0 32 32" width={20} height={20} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmklite" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmklite)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

/** Longest-prefix match: /patient/paiements/4 activates the Paiements tab. */
function activeTab(tabs: LiteTab[], pathname: string): LiteTab | undefined {
  let best: LiteTab | undefined;
  for (const tab of tabs) {
    const match = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    if (match && (!best || tab.href.length > best.href.length)) best = tab;
  }
  return best;
}

function useResolvedTheme(): { theme: 'light' | 'dark'; toggle: () => void } {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-ax-theme') === 'dark' ? 'dark' : 'light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-ax-theme', next);
    try {
      localStorage.setItem('ax:theme', next);
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new CustomEvent('ax:change'));
  };
  return { theme, toggle };
}

export function LiteLayout({
  tabs,
  pageTitles = [],
  children,
}: {
  tabs: LiteTab[];
  /** Titres des pages qui ne sont pas des onglets — même règle de préfixe,
   *  le plus long gagne (une page nommée bat l'onglet parent). */
  pageTitles?: LitePageTitle[];
  children: ReactNode;
}) {
  const pathname = usePathname() || '/';
  const { me, signOut } = useAuth();
  const { theme, toggle } = useResolvedTheme();
  const current = activeTab(tabs, pathname);
  const pageTitle = activeTab(
    [...tabs, ...pageTitles.map((t) => ({ ...t, icon: '' }))],
    pathname,
  )?.label;
  const multiSpace = spacesOf(me).length > 1;
  const displayName =
    me && (me.first_name || me.last_name)
      ? `${me.first_name} ${me.last_name}`.trim()
      : (me?.phone ?? '');

  return (
    <div className="ax-lite">
      <a href="#ax-main" className="visually-hidden-focusable ax-lite__skip">
        Aller au contenu
      </a>
      <header className="ax-lite__header" role="banner">
        <Link href={tabs[0]?.href ?? '/'} className="ax-lite__brand" aria-label="Accueil Chioni">
          <span className="ax-lite__brand-mark" aria-hidden="true">{HEX_LOGO}</span>
          <span className="ax-lite__brand-name">Chioni</span>
        </Link>

        <h1 className="ax-lite__title">{pageTitle ?? 'Chioni'}</h1>

        <Dropdown
          className="ax-profile"
          panelClassName="ax-dropdown ax-profile__menu"
          trigger={({ open, triggerProps }) => (
            <button type="button" className="ax-icon-btn" aria-label="Mon compte" {...triggerProps} aria-expanded={open}>
              <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={24} height={24} aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
            </button>
          )}
        >
          <div className="ax-profile__card">
            <span className="ax-profile__card-meta">
              <b>{displayName || 'Mon compte'}</b>
              <small>{me?.phone}</small>
            </span>
          </div>
          {/* Honest pattern: plain buttons/links in a disclosure panel — no
              ARIA menu composite (it would demand full arrow-key wiring). */}
          <button type="button" className="ax-dropdown__item" onClick={toggle}>
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
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

      <main className="ax-lite__main" id="ax-main">
        {children}
      </main>

      <nav className="ax-lite__tabbar" aria-label="Navigation principale">
        <div className="ax-lite__tabbar-inner">
          {tabs.map((tab) => {
            const isActive = current?.href === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="ax-lite__tab"
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon name={tab.icon} className="ax-icon" />
                <span className="ax-lite__tab-label">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default LiteLayout;
