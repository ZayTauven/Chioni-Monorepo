/*
 * Vireo Next.js — breadcrumb (manifest-driven, mirrors core/nav.js §6).
 *
 * Resolves the current route slug to its manifest node, then renders Home →
 * ancestor trail → current page, using the .ax-breadcrumb DOM contract. The
 * final crumb is the page title (non-link, aria-current="page"). Pure render
 * from a `slug` prop — no hooks — so it works in any (client) parent.
 */
import Link from 'next/link';
import { manifest, hrefForSlug, type NavNode } from '../../lib/manifest';

const SEP = (
  <li className="ax-breadcrumb__sep" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6l-6 6" />
    </svg>
  </li>
);

export function Breadcrumb({ slug }: { slug: string }) {
  const node = manifest.bySlug.get(slug);
  const trail: NavNode[] = node ? manifest.trail(node) : [];

  return (
    <nav className="ax-breadcrumb" data-ax-breadcrumb aria-label="Breadcrumb">
      <ol className="ax-breadcrumb__list">
        <li className="ax-breadcrumb__item">
          <Link href="/" aria-label="Home" className="ax-breadcrumb__home-link">
            <svg className="ax-breadcrumb__home ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l-2 0l9 -9l9 9l-2 0" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
            </svg>
          </Link>
        </li>
        {trail.map((n, i) => {
          const last = i === trail.length - 1;
          const resolved = manifest.resolve(n)!;
          return (
            <span key={n.id} style={{ display: 'contents' }}>
              {SEP}
              <li className="ax-breadcrumb__item">
                {last ? (
                  <span aria-current="page">{n.title}</span>
                ) : (
                  <Link href={hrefForSlug(resolved.slug)}>{n.title}</Link>
                )}
              </li>
            </span>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
