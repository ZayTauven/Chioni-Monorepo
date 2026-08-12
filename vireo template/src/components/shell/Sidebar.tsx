'use client';
/*
 * Vireo Next.js — Sidebar (manifest-driven nav tree).
 *
 * Renders the reference .ax-sidebar DOM contract from nav-manifest.json:
 * brand → menu filter → role="tree" nav with section headers, L1 parent groups
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
      role="treeitem"
      aria-level={level}
      aria-current={isActive ? 'page' : undefined}
      href={hrefForSlug(resolved.slug)}
      tabIndex={isActive ? 0 : -1}
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
        role="treeitem"
        aria-level={level}
        aria-expanded={isOpen}
        data-ax-group={node.id}
        onClick={() => setOpen((o) => !o)}
        tabIndex={containsActive ? 0 : -1}
      >
        {level === 1 && <Icon name={node.icon} className="ax-nav__icon" />}
        <span className="ax-nav__label">{node.title}</span>
        <Badge badge={node.badge} />
        {CARET}
      </button>
      <div
        className="ax-nav__children"
        role="group"
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

export function Sidebar() {
  const activeSlug = slugFromPath(usePathname() || '/');
  const [filter, setFilter] = useState('');

  return (
    <aside className="ax-sidebar" role="navigation" aria-label="Primary">
      {/* ===== BRAND ===== */}
      <div className="ax-sidebar__brand">
        <Link className="ax-sidebar__logo" href="/" aria-label="Vireo home">
          <span className="ax-sidebar__mark" aria-hidden="true">
            <svg className="ax-icon" viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
          </span>
          <span className="ax-sidebar__wordmark">VIREO</span>
        </Link>
      </div>

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
          placeholder="Filter menu…"
          aria-label="Filter menu"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
        />
        {filter && (
          <button
            type="button"
            className="ax-sidebar__filter-clear"
            onClick={() => setFilter('')}
            aria-label="Clear filter"
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
      <nav className="ax-sidebar__nav" role="tree" aria-label="Main menu">
        {sections().map((section) => (
          <div key={section}>
            <p className="ax-sidebar__section" role="presentation">
              {sectionLabel(section)}
            </p>
            {groupsInSection(section)
              .filter((g) => g.inMenu)
              .map((g) => (
                <Group
                  key={g.id}
                  node={g}
                  level={1}
                  activeSlug={activeSlug}
                  filter={filter.trim().toLowerCase()}
                />
              ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/* ── helpers ── */
function sectionLabel(s: string): string {
  // Manifest sections are upper-case; reference renders them title-ish.
  const map: Record<string, string> = {
    MAIN: 'Main',
    APPLICATIONS: 'Applications',
    MODULES: 'Modules',
    PAGES: 'Pages',
    'UI & FORMS': 'UI & Forms',
    DOCS: 'Docs',
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
