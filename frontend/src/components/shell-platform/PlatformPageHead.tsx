'use client';
/*
 * Chioni — page head of the PLATEFORME space (.ax-page-head contract of
 * Vireo, breadcrumb resolved against the PLATFORM manifest).
 *
 * Detail routes (`/plateforme/centres/12`) have no manifest node: the caller
 * passes an explicit `trail` rather than letting the breadcrumb invent one.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  hrefForSlug,
  platformManifest,
  platformSlugFromPath,
} from '@/lib/platform-manifest';

const SEP = (
  <li className="ax-breadcrumb__sep" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6l-6 6" />
    </svg>
  </li>
);

export interface Crumb {
  label: string;
  href?: string;
}

export function PlatformPageHead({
  title,
  subtitle,
  actions,
  trail,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Explicit crumbs for routes with no manifest node (detail pages). */
  trail?: Crumb[];
}) {
  const slug = platformSlugFromPath(usePathname() || '/');
  const node = platformManifest.bySlug.get(slug);
  const crumbs: Crumb[] =
    trail ?? (node ? [{ label: node.title, href: hrefForSlug(node.slug) }] : []);

  return (
    <div className="ax-page-head">
      <div className="ax-page-head__row">
        <div>
          <nav className="ax-breadcrumb" aria-label="Fil d'Ariane">
            <ol className="ax-breadcrumb__list">
              <li className="ax-breadcrumb__item">
                <Link href="/plateforme" aria-label="Accueil de la plateforme" className="ax-breadcrumb__home-link">
                  <svg className="ax-breadcrumb__home ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l-2 0l9 -9l9 9l-2 0" />
                    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
                  </svg>
                </Link>
              </li>
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${i}`} style={{ display: 'contents' }}>
                    {SEP}
                    <li className="ax-breadcrumb__item">
                      {last || !crumb.href ? (
                        <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>
                      ) : (
                        <Link href={crumb.href}>{crumb.label}</Link>
                      )}
                    </li>
                  </span>
                );
              })}
            </ol>
          </nav>
          <h1 className="ax-page-head__title">{title}</h1>
          {subtitle && <p className="ax-page-head__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ax-page-head__actions">{actions}</div>}
      </div>
    </div>
  );
}

export default PlatformPageHead;
