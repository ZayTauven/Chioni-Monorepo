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
import type { PlatformRole } from './types';
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
  /* S9 — la rubrique accueille désormais les officines à côté des centres.
     « Centres de santé » aurait rangé les pharmacies sous un titre qui ne les
     nomme pas ; ce sont deux acteurs distincts (une pharmacie n'est PAS un
     centre : ni patients, ni ledger, ni abonnement — ADR 0022 décision 1), et
     le titre le dit. */
  TENANTS: 'Centres et pharmacies',
  COMMERCE: 'Abonnements',
  EXPLOITATION: 'Exploitation',
};

export function platformSectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

/**
 * Entrées de navigation gatées par RÔLE d'exploitant (S5, ADR 0018 lot 3 §17).
 *
 * Le manifeste reste role-agnostic (contrat de nœud Vireo) : le masquage vit
 * au rendu, exactement comme `NAV_ROLE_GATES` côté centre.
 *
 * Une SEULE entrée est concernée, et c'est un arbitrage backend explicite :
 * `/platform/operators/` est réservé à l'`admin` **même en LECTURE** — savoir
 * qui détient la 4ᵉ casquette relève de la gouvernance, pas de la matière de
 * support. C'est la seule lecture du back-office fermée au `support`, et un
 * lien qui mènerait droit à un 403 lui apprendrait à se méfier du menu.
 *
 * Toutes les autres entrées restent visibles : le `support` LIT partout, et
 * ce sont les commandes d'écriture — jamais montées pour lui — qui portent la
 * distinction (`usePlatformRole().canWrite`).
 */
const PLATFORM_NAV_ROLE_GATES: Record<string, PlatformRole[]> = {
  'plateforme.exploitants': ['admin'],
};

export function platformNodeVisible(nodeId: string, role: PlatformRole | null): boolean {
  const allowed = PLATFORM_NAV_ROLE_GATES[nodeId];
  if (!allowed) return true;
  return role !== null && allowed.includes(role);
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
