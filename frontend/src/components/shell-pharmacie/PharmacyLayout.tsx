'use client';
/*
 * Chioni — chrome du 5ᵉ espace : l'officine (S9, ADR 0022 décision 10).
 *
 * ─── Pourquoi CE socle-là, et pas le shell de la plateforme ────────────────
 *
 * L'ADR demande « un chrome sobre dérivé de l'espace plateforme, mobile-first ».
 * Les deux moitiés de la phrase tirent dans des directions opposées : le shell
 * plateforme est le `.ax-layout` de Vireo — sidebar latérale permanente +
 * barre supérieure — c'est-à-dire un **poste de travail de bureau**, ce qu'un
 * back-office EST et ce qu'une officine comorienne n'a pas. La pharmacienne
 * répond depuis un téléphone, debout, au comptoir, entre deux clients.
 *
 * On garde donc de la plateforme **ses règles** (les cinq qui la rendent
 * sobre) et de `shell-lite` **sa forme** (celle qui tient dans une main) :
 *
 *   - de l'espace plateforme : pas de palette ⌘K, pas de customizer, pas de
 *     notifications, pas de plein écran, **`CenterContext` JAMAIS monté** — une
 *     officine n'est pas un tenant, et rien sous ce layout ne doit appeler
 *     `useCenter()` ; la navigation vient d'un **manifeste dédié** (le 3ᵉ), pas
 *     d'entrées ajoutées à celui du centre ;
 *   - de `shell-lite` : le `.ax-lite` mobile-first déjà éprouvé par les espaces
 *     patient et tuteur — colonne centrée à 640 px, barre d'onglets basse à
 *     cibles ≥ 44 px, en-tête collant de 56 px, pages légères. Rien de neuf
 *     n'est inventé : c'est le seul chrome hors Vireo autorisé (ADR 0011), et
 *     il est réutilisé tel quel plutôt que dupliqué.
 *
 * Ce qui est ajouté, et une seule chose l'est : **le bandeau d'identité** —
 * le nom de l'officine, sa commune, son ÉTAT, et le sélecteur quand la
 * personne en tient deux. Il vient de `/auth/me/` (`PharmacyContext`), donc
 * **avant le moindre fetch** : dès la première frame, une officine « en
 * attente » lit son état au lieu de découvrir une boîte vide qui ressemble à
 * une panne.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dropdown } from '../ui/Dropdown';
import { Icon } from '../ui/Icon';
import { spacesOf, useAuth } from '@/context/AuthContext';
import { usePharmacy } from '@/context/PharmacyContext';
import { ISLAND_LABELS, PHARMACY_STATUS_LABELS } from '@/lib/labels';
import { hrefForSlug, pharmacySlugFromPath, pharmacyTabs } from '@/lib/pharmacy-manifest';
import type { PharmacyStatus } from '@/lib/types';

const HEX_LOGO = (
  <svg viewBox="0 0 32 32" width={20} height={20} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmkpharma" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmkpharma)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

/**
 * Le ton de l'état d'une officine.
 *
 * **Aucun `danger`, et surtout pas sur `en_attente`** : « en attente de
 * validation » est l'état ORDINAIRE du premier jour — le peindre en rouge
 * accueillerait une nouvelle inscrite par une alarme. `warning` dit ce qu'il
 * faut : quelque chose attend un geste (celui de Chioni, en l'occurrence).
 * `suspendue` est un `neutral` plutôt qu'un `danger` : la sanction se lit dans
 * le bandeau, en toutes lettres et avec son motif, pas dans une couleur qui
 * accompagnerait la personne sur chacun de ses écrans.
 */
export const PHARMACY_STATUS_TONES: Record<PharmacyStatus, string> = {
  en_attente: 'warning',
  validee: 'success',
  suspendue: 'neutral',
};

/** Longest-prefix match, comme LiteLayout : `/pharmacie/demandes/12` allume « Demandes ». */
function isActiveTab(slug: string, current: string): boolean {
  if (slug === current) return true;
  if (slug === 'pharmacie') return current.startsWith('pharmacie/demandes');
  return current.startsWith(`${slug}/`);
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

export function PharmacyLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const current = pharmacySlugFromPath(pathname);
  const { me, signOut } = useAuth();
  const { pharmacy, pharmacies, switchPharmacy } = usePharmacy();
  const { theme, toggle } = useResolvedTheme();

  const tabs = pharmacyTabs();
  const activeTab = tabs.find((tab) => isActiveTab(tab.slug, current));
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
        <Link href="/pharmacie" className="ax-lite__brand" aria-label="Accueil de mon officine">
          <span className="ax-lite__brand-mark" aria-hidden="true">{HEX_LOGO}</span>
          <span className="ax-lite__brand-name">Chioni</span>
        </Link>

        <h1 className="ax-lite__title">{activeTab?.title ?? 'Mon officine'}</h1>

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

      {/* ── bandeau d'identité : qui je suis, où, et dans quel état ──
          L'état vient de /auth/me/ : il est juste dès la première frame, sans
          attendre un fetch. Le bandeau ne PORTE PAS le motif d'une suspension
          (il est long, et il n'a pas sa place au-dessus de chaque écran) : le
          bandeau explicatif complet vit sur la boîte de réception et sur la
          fiche, avec le texte de Chioni en entier. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--ax-space-3)',
          flexWrap: 'wrap',
          padding: 'var(--ax-space-2) var(--ax-space-4)',
          background: 'var(--ax-surface-subtle)',
          borderBlockEnd: '1px solid var(--ax-border)',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontWeight: 'var(--ax-weight-semibold)',
              color: 'var(--ax-text-strong)',
              fontSize: 'var(--ax-text-sm)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {pharmacy.name}
          </span>
          <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
            {pharmacy.city ? `${pharmacy.city} · ` : ''}
            {ISLAND_LABELS[pharmacy.island]}
          </span>
        </div>

        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', alignItems: 'center' }}>
          <span
            className={`ax-badge ax-badge--soft ax-badge--${PHARMACY_STATUS_TONES[pharmacy.status]} ax-badge--pill`}
          >
            <span className="ax-badge__dot" />
            {PHARMACY_STATUS_LABELS[pharmacy.status]}
          </span>

          {/* Une même personne peut tenir deux officines : le sélecteur
              n'apparaît QUE dans ce cas, et il est un `select` natif — sur un
              Android d'entrée de gamme, c'est le composant le plus fiable et
              le plus léger qui soit. */}
          {pharmacies.length > 1 && (
            <>
              <label className="visually-hidden" htmlFor="pharmacy-switch">
                Changer d&rsquo;officine
              </label>
              <select
                id="pharmacy-switch"
                className="ax-select ax-select--sm"
                value={pharmacy.id}
                onChange={(e) => switchPharmacy(Number.parseInt(e.target.value, 10))}
              >
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      <main className="ax-lite__main" id="ax-main">
        {children}
      </main>

      <nav className="ax-lite__tabbar" aria-label="Navigation de l'officine">
        <div className="ax-lite__tabbar-inner">
          {tabs.map((tab) => {
            const active = isActiveTab(tab.slug, current);
            return (
              <Link
                key={tab.id}
                href={hrefForSlug(tab.slug)}
                className="ax-lite__tab"
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={tab.icon} className="ax-icon" />
                <span className="ax-lite__tab-label">{tab.title}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default PharmacyLayout;
