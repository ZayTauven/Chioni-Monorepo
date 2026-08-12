'use client';
/*
 * Vireo Next.js — page head (breadcrumb + title + subtitle + actions).
 * Mirrors the .ax-page-head block at the top of every reference page. The
 * breadcrumb resolves from the current route via next/navigation usePathname().
 */
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { Breadcrumb } from './Breadcrumb';
import { slugFromPath } from '../../lib/manifest';

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const slug = slugFromPath(usePathname() || '/');
  return (
    <div className="ax-page-head">
      <div className="ax-page-head__row">
        <div>
          <Breadcrumb slug={slug} />
          <h1 className="ax-page-head__title">{title}</h1>
          {subtitle && <p className="ax-page-head__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="ax-page-head__actions">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHead;
