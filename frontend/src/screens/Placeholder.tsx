'use client';
/*
 * Vireo Next.js — generic placeholder for routes not yet ported.
 *
 * The Phase A foundation ships ONE real page (Sales). Every other manifest slug
 * resolves to this starter shell so the sidebar, breadcrumb and command palette
 * all navigate correctly. Page-porting agents replace these with real screens
 * (see CONVENTIONS.md → "Add one page").
 */
import { usePathname } from 'next/navigation';
import { PageHead } from '../components/shell/PageHead';
import { manifest, slugFromPath } from '../lib/manifest';

export function Placeholder() {
  const slug = slugFromPath(usePathname() || '/');
  const node = manifest.bySlug.get(slug);
  const title = node?.title ?? 'Page';

  return (
    <>
      <PageHead title={title} subtitle="Starter page — content not yet ported in this edition." />
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label={title}>
          <div className="ax-card__body">
            <div className="ax-empty" style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)' }}>
              <h2 className="ax-card__title" style={{ marginBottom: 'var(--ax-space-2)' }}>{title}</h2>
              <p style={{ color: 'var(--ax-text-muted)' }}>
                This route is wired and the shell renders — port the real content here.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Placeholder;
