/*
 * Chioni — nav manifest of the PLATEFORME space (S4, ADR 0017).
 *
 * Documented choice: a SECOND manifest rather than extra nodes in the centre
 * one. `src/data/nav-manifest.json` declares itself CENTRE-ONLY in its own
 * `meta`, and it feeds three shared surfaces (sidebar, breadcrumb, ⌘K
 * palette) that all live inside the centre shell. Adding « Centres » or
 * « Demandes d'effacement » there would have leaked back-office entries into
 * a director's command palette, and forced a space filter into every one of
 * those surfaces. Instead the node CONTRACT is shared (same TS types, same
 * indexing function `indexManifest`) and only the DATA differs.
 */

import raw from '../data/platform-nav-manifest.json';
import {
  groupsInSectionOf,
  hrefForSlug,
  indexManifest,
  sectionsOf,
  type ManifestIndex,
  type NavNode,
  type RawManifest,
} from './manifest';

export const platformManifest: ManifestIndex = indexManifest(raw as RawManifest);

export function platformSections(): string[] {
  return sectionsOf(platformManifest);
}

export function platformGroupsInSection(section: string): NavNode[] {
  return groupsInSectionOf(platformManifest, section);
}

/** Section codes → sidebar headings (the manifest stores them upper-case). */
const SECTION_LABELS: Record<string, string> = {
  TENANTS: 'Centres de santé',
  EXPLOITATION: 'Exploitation',
};

export function platformSectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

/**
 * Normalise a router path to a platform slug. Detail routes
 * (`/plateforme/centres/12`) resolve to no node on purpose: the sidebar
 * highlights « Centres » through its own prefix rule, and the breadcrumb
 * renders the trail it can honestly resolve.
 */
export function platformSlugFromPath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '').replace(/^\/+/, '');
  return p || 'plateforme';
}

export { hrefForSlug };
