'use client';
/*
 * Vireo Next.js — Sidebar (manifest-driven nav tree).
 *
 * Renders the reference .ax-sidebar DOM contract from nav-manifest.json:
 * brand → menu filter → plain <nav> with section headers, L1 parent groups
 * (collapsible) and child leaves. The active leaf (matched against the router
 * path) gets `ax-nav__item--active is-active aria-current="page"`, its ancestor
 * group opens (`is-open`, panel un-hidden), and the parent button gets
 * `ax-nav__item--trail` — exactly as core/nav.js does in the HTML edition.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  manifest,
  sections,
  groupsInSection,
  slugFromPath,
  hrefForSlug,
  type NavNode,
} from '../../lib/manifest';
import { Icon } from '../ui/Icon';
import { useCenter } from '@/context/CenterContext';
import { BILLING_ROLES, PRESCRIPTION_READ_ROLES, hasRole } from '@/screens/centre/shared';
import type { StaffRole } from '@/lib/types';

/*
 * Role-gated nav entries (S1). The manifest is role-agnostic (Vireo node
 * contract), so the masking lives at render time — same rule as the screens
 * that never mount a role-restricted block. « Litiges » carries the free-text
 * dispute reasons: BILLING roles only (backend 403 for the others).
 */
const DIRECTOR_ONLY: StaffRole[] = ['directeur'];

const NAV_ROLE_GATES: Record<string, StaffRole[]> = {
  'centre.litiges': BILLING_ROLES,
  // Journal de caisse et impayés : écrans BILLING-only (les non-BILLING ne
  // voyaient qu'un écran « réservé ») — masqués comme « Litiges ». « Factures »
  // reste visible : la lecture est ouverte à tout le staff (arbitrage C.3).
  'centre.caisse': BILLING_ROLES,
  'centre.impayes': BILLING_ROLES,
  // S4 (ADR 0017 décision 5) — le journal d'audit agrège personnel, argent et
  // litiges : DIRECTEUR SEUL, et pas « rôles BILLING ». Les cinq autres rôles
  // reçoivent un 403 côté API : l'entrée n'a aucune raison de leur apparaître.
  'centre.journal': DIRECTOR_ONLY,
  // S5 (ADR 0018 lot 1 §18) — le contrat d'abonnement porte un prix, une
  // échéance et le motif d'une sanction : `GET /centers/{c}/subscription/` est
  // DIRECTEUR SEUL. La garde frontend REFLÈTE la permission backend, sinon
  // l'écran s'afficherait pour recevoir un 403.
  //
  // « Support » n'est volontairement PAS gaté : l'ouverture d'un ticket est
  // ouverte à tout staff actif — c'est la secrétaire qui rencontre le bug.
  'centre.abonnement': DIRECTOR_ONLY,
  // S7 (ADR 0020 décision 6) — la feuille de présence, les congés, les
  // dossiers et les statistiques RH sont DIRECTEUR SEUL : il n'y a pas de
  // délégué RH en S7, et les six autres rôles reçoivent 403. L'entrée n'a
  // donc aucune raison de leur apparaître.
  //
  // « Équipe du jour » (`centre.equipe`) n'est volontairement PAS gaté, et
  // c'est une entrée SÉPARÉE plutôt qu'un onglet du registre : le planning
  // collectif est lisible de tout membre actif — savoir qui est de garde est
  // un besoin de service. En faire un onglet d'un nœud DIRECTOR_ONLY l'aurait
  // fait disparaître de la sidebar d'une infirmière ; l'inverse (un nœud
  // ouvert dont trois onglets sur quatre répondent 403) aurait été pire
  // encore. Deux portes, deux audiences, deux entrées.
  'centre.registre': DIRECTOR_ONLY,
  // S8 (ADR 0021) — « Équipements » (`centre.equipements`) n'est
  // volontairement PAS gaté, et l'absence est aussi délibérée que les
  // présences ci-dessus : la LECTURE du parc est ouverte à tout membre actif
  // (c'est l'infirmière qui a besoin de savoir si l'échographe marche), et le
  // geste central du module — signaler une panne — lui est ouvert aussi.
  // Seules l'écriture du parc et la machine à états sont directeur seul, et
  // elles sont gardées DANS l'écran, là où le backend les refuse.
  //
  // S9 (ADR 0022) — le réseau des pharmacies, et les DEUX entrées sont
  // traitées différemment parce que leurs audiences le sont :
  //
  // - « Ordonnances » (`centre.ordonnances`) porte le comptoir ET le fil des
  //   recherches : lire une ordonnance et diffuser une liste de médicaments
  //   sont réservés aux rôles cliniques + pharmacien (R-API-1). Une secrétaire
  //   ou un caissier reçoit 403 sur les deux — l'entrée n'a aucune raison de
  //   leur apparaître, et l'écran s'auto-garde en plus (fetchs compris) ;
  // - « Pharmacies » (`centre.pharmacies`) n'est volontairement PAS gaté :
  //   l'annuaire des officines validées est ouvert à tout membre actif, parce
  //   que savoir quelles pharmacies existent — et pouvoir en appeler une —
  //   n'est pas une information clinique. C'est le même arbitrage que
  //   « Équipe du jour » ouverte vs « Registre du personnel » directeur seul.
  'centre.ordonnances': PRESCRIPTION_READ_ROLES,
  // S10 (ADR 0023) — deux entrées neuves, deux traitements OPPOSÉS, et
  // l'écart est aussi délibéré que les précédents :
  //
  // - « Comptabilité » (`centre.comptabilite`) est la caisse du centre qui
  //   sort de l'application : rôles BILLING, comme « Caisse du jour » et
  //   « Impayés ». Les rôles cliniques reçoivent 403 côté API — l'entrée n'a
  //   aucune raison de leur apparaître ;
  // - « Relances » (`centre.relances`) n'est volontairement PAS gaté, parce
  //   que l'écran porte DEUX files aux audiences différentes : « à relancer »
  //   est BILLING (vue d'argent), « à recontacter » est ouvert à tout membre
  //   actif — c'est de l'exploitation, comme la file du jour, et c'est
  //   souvent l'infirmière ou la sage-femme qui rappelle quelqu'un qui n'a pas
  //   pu venir. Gater l'entrée sur BILLING supprimerait de leur sidebar la
  //   seule file qui leur est destinée ; l'écran s'auto-garde donc À
  //   L'INTÉRIEUR (l'onglet « À relancer » n'est même pas rendu pour elles).
  //   Même arbitrage que « Équipe du jour » vs « Registre du personnel ».
  'centre.comptabilite': BILLING_ROLES,
};

/** Shared with the command palette — one source of truth for nav visibility.
 *  Takes ALL the member's roles in the active center (multi-roles S2):
 *  cumulating hats only ever widens what the nav shows. */
export function navNodeVisible(nodeId: string, roles: readonly StaffRole[]): boolean {
  const allowed = NAV_ROLE_GATES[nodeId];
  return !allowed || hasRole(roles, allowed);
}

function Badge({ badge }: { badge: NavNode['badge'] }) {
  if (!badge) return null;
  if (badge.type === 'count')
    return <span className="ax-nav__badge ax-nav__badge--count">{badge.value}</span>;
  if (badge.type === 'Hot') return <span className="ax-nav__badge ax-nav__badge--hot">Hot</span>;
  if (badge.type === 'New') return <span className="ax-nav__badge ax-nav__badge--new">New</span>;
  return null;
}

const CARET = (
  <svg
    className="ax-nav__caret ax-icon--directional"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={24}
    height={24}
    aria-hidden="true"
  >
    <path d="M9 6l6 6l-6 6" />
  </svg>
);

interface LeafProps {
  node: NavNode;
  level: number;
  activeSlug: string;
  filter: string;
}

/** Top-level leaf: a childless L1 node rendered as a direct link (Chioni's
 *  centre nav is flat — no collapsible groups). */
function TopLeaf({ node, activeSlug, filter }: { node: NavNode; activeSlug: string; filter: string }) {
  const resolved = manifest.resolve(node)!;
  const isActive = resolved.slug === activeSlug;
  const hidden = filter && !matches(node, filter);
  const cls = ['ax-nav__item', 'ax-nav__item--parent'];
  if (isActive) cls.push('ax-nav__item--active', 'is-active');
  if (hidden) cls.push('is-hidden');
  return (
    <Link
      className={cls.join(' ')}
      aria-current={isActive ? 'page' : undefined}
      href={hrefForSlug(resolved.slug)}
    >
      <Icon name={node.icon} className="ax-nav__icon" />
      <span className="ax-nav__label">{node.title}</span>
      <Badge badge={node.badge} />
    </Link>
  );
}

function Leaf({ node, level, activeSlug, filter }: LeafProps) {
  const resolved = manifest.resolve(node)!;
  const isActive = resolved.slug === activeSlug;
  const hidden = filter && !matches(node, filter);
  const cls = ['ax-nav__item', 'ax-nav__item--child'];
  if (isActive) cls.push('ax-nav__item--active', 'is-active');
  if (hidden) cls.push('is-hidden');
  return (
    <Link
      className={cls.join(' ')}
      aria-current={isActive ? 'page' : undefined}
      href={hrefForSlug(resolved.slug)}
    >
      <span className="ax-nav__bar" aria-hidden="true"></span>
      <span className="ax-nav__label">{node.title}</span>
      <Badge badge={node.badge} />
    </Link>
  );
}

interface GroupProps {
  node: NavNode;
  level: number;
  activeSlug: string;
  filter: string;
}

function Group({ node, level, activeSlug, filter }: GroupProps) {
  const children = manifest.childrenOf(node.id).filter((c) => c.inMenu);
  const containsActive = useMemo(
    () => subtreeContainsSlug(node, activeSlug),
    [node, activeSlug],
  );
  const [open, setOpen] = useState(containsActive || level === 1 && node.section === 'MAIN');
  const isOpen = filter ? true : open || containsActive;
  const groupHidden = filter && !subtreeMatches(node, filter);

  const parentCls = ['ax-nav__item', 'ax-nav__item--parent'];
  if (level > 1) parentCls.push('ax-nav__item--child');
  if (containsActive) parentCls.push('ax-nav__item--trail');

  return (
    <div
      className={`ax-nav__group${isOpen ? ' is-open' : ''}${groupHidden ? ' is-hidden' : ''}`}
      data-ax-collapse
    >
      <button
        type="button"
        className={parentCls.join(' ')}
        aria-expanded={isOpen}
        data-ax-group={node.id}
        onClick={() => setOpen((o) => !o)}
      >
        {level === 1 && <Icon name={node.icon} className="ax-nav__icon" />}
        <span className="ax-nav__label">{node.title}</span>
        <Badge badge={node.badge} />
        {CARET}
      </button>
      <div
        className="ax-nav__children"
        data-ax-collapse-panel
        hidden={!isOpen}
      >
        {children.map((child) =>
          manifest.childrenOf(child.id).filter((c) => c.inMenu).length > 0 ? (
            <Group
              key={child.id}
              node={child}
              level={level + 1}
              activeSlug={activeSlug}
              filter={filter}
            />
          ) : (
            <Leaf
              key={child.id}
              node={child}
              level={level + 1}
              activeSlug={activeSlug}
              filter={filter}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Center identity under the brand — its logo when it has one (from /auth/me/). */
function CenterIdentity() {
  const { center } = useCenter();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--ax-space-2)',
        padding: 'var(--ax-space-2) var(--ax-space-4)',
        minWidth: 0,
      }}
    >
      {center.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
        <img
          src={center.logo}
          alt=""
          width={28}
          height={28}
          style={{ width: 28, height: 28, borderRadius: 'var(--ax-radius-sm)', objectFit: 'cover', flex: '0 0 auto' }}
        />
      ) : (
        <Icon name="building-hospital" className="ax-icon" style={{ inlineSize: 20, blockSize: 20, color: 'var(--ax-text-subtle)', flex: '0 0 auto' }} />
      )}
      <span
        style={{
          fontSize: 'var(--ax-text-xs)',
          color: 'var(--ax-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {center.name}
      </span>
    </div>
  );
}

export function Sidebar() {
  const activeSlug = slugFromPath(usePathname() || '/');
  const { roles } = useCenter();
  const [filter, setFilter] = useState('');

  return (
    // SV — plus de `role="tree"` : l'arbre ARIA exigeait un roving-tabindex
    // et une navigation aux flèches jamais câblés (l'ARIA impur est pire que
    // pas d'ARIA). Une <nav> de liens ordinaires dit exactement ce que c'est.
    <aside className="ax-sidebar">
      {/* ===== BRAND ===== */}
      <div className="ax-sidebar__brand">
        <Link className="ax-sidebar__logo" href="/centre" aria-label="Accueil Chioni">
          <span className="ax-sidebar__mark" aria-hidden="true">
            <svg className="ax-icon" viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
          </span>
          <span className="ax-sidebar__wordmark">CHIONI</span>
        </Link>
      </div>

      {/* ===== ACTIVE CENTER (logo + name) ===== */}
      <CenterIdentity />

      {/* ===== MENU FILTER ===== */}
      <div className="ax-sidebar__search">
        <svg
          className="ax-icon ax-sidebar__search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          width={24}
          height={24}
          aria-hidden="true"
        >
          <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
          <path d="M21 21l-6 -6" />
        </svg>
        <input
          type="search"
          className="ax-sidebar__filter"
          placeholder="Filtrer le menu…"
          aria-label="Filtrer le menu"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
        {filter && (
          <button
            type="button"
            className="ax-sidebar__filter-clear"
            onClick={() => setFilter('')}
            aria-label="Effacer le filtre"
          >
            <svg
              className="ax-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              width={24}
              height={24}
              aria-hidden="true"
            >
              <path d="M18 6l-12 12" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* ===== NAV TREE ===== */}
      <nav className="ax-sidebar__nav" aria-label="Navigation principale">
        {sections().map((section) => (
          <div key={section}>
            <p className="ax-sidebar__section">
              {sectionLabel(section)}
            </p>
            {groupsInSection(section)
              .filter((g) => g.inMenu && navNodeVisible(g.id, roles))
              .map((g) =>
                manifest.childrenOf(g.id).filter((c) => c.inMenu).length > 0 ? (
                  <Group
                    key={g.id}
                    node={g}
                    level={1}
                    activeSlug={activeSlug}
                    filter={filter.trim().toLowerCase()}
                  />
                ) : (
                  <TopLeaf
                    key={g.id}
                    node={g}
                    activeSlug={activeSlug}
                    filter={filter.trim().toLowerCase()}
                  />
                ),
              )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/* ── helpers ── */
function sectionLabel(s: string): string {
  // Manifest sections are upper-case; the sidebar renders them title-cased.
  const map: Record<string, string> = {
    'TABLEAU DE BORD': 'Tableau de bord',
    'ACTIVITÉ': 'Activité',
    'CAISSE': 'Caisse',
    'PONT DE CONFIANCE': 'Pont de Confiance',
    'GESTION': 'Gestion',
  };
  return map[s] || s;
}

function matches(node: NavNode, q: string): boolean {
  if (!q) return true;
  return (
    node.title.toLowerCase().includes(q) ||
    (node.keywords || []).some((k) => k.toLowerCase().includes(q))
  );
}
function subtreeMatches(node: NavNode, q: string): boolean {
  if (matches(node, q)) return true;
  return manifest.childrenOf(node.id).some((c) => subtreeMatches(c, q));
}
function subtreeContainsSlug(node: NavNode, slug: string): boolean {
  const kids = manifest.childrenOf(node.id);
  return kids.some((c) => {
    const r = manifest.resolve(c)!;
    if (r.slug === slug) return true;
    return subtreeContainsSlug(c, slug);
  });
}

export default Sidebar;
