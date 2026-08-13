'use client';
/*
 * Chioni — generic placeholder for centre-space routes not yet built.
 * Resolves its title from the nav manifest so the sidebar, breadcrumb and
 * command palette all navigate correctly; phase-2 agents replace these
 * with real screens wired to the API.
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
      <PageHead title={title} subtitle="Bientôt disponible" />
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label={title}>
          <div className="ax-card__body">
            <div className="ax-empty" style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)' }}>
              <h2 className="ax-card__title" style={{ marginBottom: 'var(--ax-space-2)' }}>{title}</h2>
              <p style={{ color: 'var(--ax-text-muted)' }}>
                Cet écran arrive bientôt. La navigation est en place — le contenu sera branché dans une prochaine étape.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Placeholder;
