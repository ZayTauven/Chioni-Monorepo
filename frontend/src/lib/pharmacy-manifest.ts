/*
 * Chioni — nav manifest of the PHARMACIE space (S9, ADR 0022 décision 10).
 *
 * Le TROISIÈME manifeste du dépôt, et le choix se documente comme celui de S4 :
 * `nav-manifest.json` se déclare CENTRE-ONLY dans son propre `meta` et
 * alimente trois surfaces qui vivent toutes dans le shell du centre (sidebar,
 * fil d'Ariane, palette ⌘K). Y ajouter « Demandes » ou « Ma fiche » aurait fait
 * fuiter les entrées d'un acteur HORS TENANT dans la palette d'un directeur —
 * et forcé un filtre d'espace dans chacune de ces surfaces. Le CONTRAT de nœud
 * est partagé (mêmes types TS, même `indexManifest`), seules les DONNÉES
 * diffèrent.
 *
 * **Aucune garde de rôle, et il ne faut pas en ajouter** : une officine n'a pas
 * de hiérarchie (ADR 0022 §12) — tout membre actif répond aux demandes, dépose
 * les pièces et inscrit un collègue. C'est la seule des trois espaces
 * professionnels sans `*_NAV_ROLE_GATES`, et c'est une décision de produit, pas
 * un oubli.
 */

import raw from '../data/pharmacy-nav-manifest.json';
import {
  groupsInSectionOf,
  hrefForSlug,
  indexManifest,
  sectionsOf,
  type ManifestIndex,
  type NavNode,
  type RawManifest,
} from './manifest';

export const pharmacyManifest: ManifestIndex = indexManifest(raw as RawManifest);

export function pharmacySections(): string[] {
  return sectionsOf(pharmacyManifest);
}

export function pharmacyGroupsInSection(section: string): NavNode[] {
  return groupsInSectionOf(pharmacyManifest, section);
}

/** Les entrées de la barre d'onglets basse, dans l'ordre du manifeste. */
export function pharmacyTabs(): NavNode[] {
  return pharmacySections().flatMap((section) =>
    pharmacyGroupsInSection(section).filter((node) => node.inMenu),
  );
}

/**
 * Normalise a router path to a pharmacy slug. Detail routes
 * (`/pharmacie/demandes/12`) resolve to no node on purpose: the tab bar
 * highlights « Demandes » through its own prefix rule, and the screen renders
 * the trail it can honestly resolve.
 */
export function pharmacySlugFromPath(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '').replace(/^\/+/, '');
  return p || 'pharmacie';
}

export { hrefForSlug };
