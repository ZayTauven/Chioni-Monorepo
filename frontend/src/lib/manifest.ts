/*
 * Vireo React — nav manifest loader + index (TS port of src/js/core/manifest.js).
 *
 * The manifest is imported directly (bundled JSON) rather than fetched, so the
 * sidebar, breadcrumb, sidebar filter and command palette all share ONE indexed
 * resolution of the node tree. Drives every nav surface per BUILD-CONVENTIONS §5.
 */

import raw from '../data/nav-manifest.json';

export interface NavBadge {
  type: string;
  value?: number;
}
export interface NavNode {
  id: string;
  title: string;
  slug: string;
  icon: string;
  parent: string | null;
  section: string | null;
  order: number;
  badge: NavBadge | null;
  keywords: string[];
  inMenu: boolean;
  alias: string | null;
  external?: boolean;
}
export interface RawManifest {
  meta?: Record<string, unknown>;
  nodes?: NavNode[];
}

export interface ManifestIndex {
  meta: Record<string, unknown>;
  nodes: NavNode[];
  byId: Map<string, NavNode>;
  bySlug: Map<string, NavNode>;
  /** Direct children of a node id (or '__root__' for top-level), order-sorted. */
  childrenOf: (id: string | null) => NavNode[];
  /** Resolve the canonical node for a node that may be an alias. */
  resolve: (node: NavNode | undefined | null) => NavNode | undefined | null;
  /** Root→node ancestor chain (canonical), inclusive of the node itself. */
  trail: (node: NavNode | undefined | null) => NavNode[];
}

/**
 * Index ANY manifest that follows the Vireo node contract.
 *
 * S4 — exported so a second space can own its own manifest (the platform
 * back-office) without polluting the centre one: `nav-manifest.json` is
 * CENTRE-ONLY by its own `meta`, and the platform's four entries have no
 * business in the centre sidebar, its ⌘K palette or its breadcrumb. One
 * indexing implementation, one node contract, two data files.
 */
export function indexManifest(data: RawManifest): ManifestIndex {
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const byId = new Map<string, NavNode>();
  const bySlug = new Map<string, NavNode>();
  const children = new Map<string, NavNode[]>();

  for (const n of nodes) {
    byId.set(n.id, n);
    if (!bySlug.has(n.slug) || !n.alias) bySlug.set(n.slug, n);
    const p = n.parent || '__root__';
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n);
  }
  for (const list of children.values()) {
    list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  return {
    meta: data.meta || {},
    nodes,
    byId,
    bySlug,
    childrenOf: (id) => children.get(id || '__root__') || [],
    resolve: (node) => (node && node.alias && byId.get(node.alias)) || node,
    trail(node) {
      const out: NavNode[] = [];
      let cur: NavNode | undefined | null = node;
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        out.unshift(cur);
        cur = cur.parent ? byId.get(cur.parent) : null;
      }
      return out;
    },
  };
}

/** The CENTRE manifest — the only one the Vireo shell (sidebar, breadcrumb,
 *  ⌘K palette) reads. The platform space indexes its own (platform-manifest). */
export const manifest: ManifestIndex = indexManifest(raw as RawManifest);

/** Ordered, deduped list of section names for the top-level groups. */
export function sectionsOf(idx: ManifestIndex): string[] {
  const seen: string[] = [];
  for (const n of idx.childrenOf('__root__')) {
    if (n.section && !seen.includes(n.section)) seen.push(n.section);
  }
  return seen;
}

/** Top-level group nodes for a given section, order-sorted. */
export function groupsInSectionOf(idx: ManifestIndex, section: string): NavNode[] {
  return idx.childrenOf('__root__').filter((n) => n.section === section);
}

/** Centre-space shorthands (unchanged surface for the existing shell). */
export function sections(): string[] {
  return sectionsOf(manifest);
}

export function groupsInSection(section: string): NavNode[] {
  return groupsInSectionOf(manifest, section);
}

/**
 * Normalise a router path to a manifest slug. Chioni routes by slug with the
 * space prefix included (e.g. "/centre/patients" → "centre/patients"); the
 * empty path resolves to the centre overview (the only manifest-driven space).
 */
export function slugFromPath(pathname: string): string {
  let p = (pathname || '/').replace(/\/+$/, '').replace(/^\/+/, '');
  if (!p || p === 'index') return 'centre';
  return p;
}

/** Build a router href for a slug. */
export function hrefForSlug(slug: string): string {
  return '/' + slug;
}
