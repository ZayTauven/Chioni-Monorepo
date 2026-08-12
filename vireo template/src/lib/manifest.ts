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
interface RawManifest {
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

function index(data: RawManifest): ManifestIndex {
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

export const manifest: ManifestIndex = index(raw as RawManifest);

/** Ordered, deduped list of section names for the top-level groups. */
export function sections(): string[] {
  const seen: string[] = [];
  for (const n of manifest.childrenOf('__root__')) {
    if (n.section && !seen.includes(n.section)) seen.push(n.section);
  }
  return seen;
}

/** Top-level group nodes for a given section, order-sorted. */
export function groupsInSection(section: string): NavNode[] {
  return manifest.childrenOf('__root__').filter((n) => n.section === section);
}

/**
 * Normalise a router path to a manifest slug. The React edition routes by slug
 * (e.g. "/dashboards/sales"), and "/" maps to the Sales dashboard default.
 */
export function slugFromPath(pathname: string): string {
  let p = (pathname || '/').replace(/\/+$/, '').replace(/^\/+/, '');
  if (!p || p === 'index') return 'dashboards/sales';
  return p;
}

/** Build a router href for a slug. */
export function hrefForSlug(slug: string): string {
  return '/' + slug;
}
