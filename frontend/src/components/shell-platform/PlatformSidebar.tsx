'use client';
/*
 * Chioni — sidebar of the PLATEFORME space (S4, ADR 0017).
 *
 * Same Vireo DOM contract as the centre sidebar (.ax-sidebar → brand →
 * role="tree" nav with section headings and .ax-nav__item leaves), driven by
 * the PLATFORM manifest. Deliberately SOBER, and each removal is a decision:
 *
 * - no menu filter: three entries do not need a search box;
 * - no CenterIdentity: the operator is not a tenant — CenterContext is NEVER
 *   mounted in this space (invariant of the sprint);
 * - the operator's ROLE is shown under the brand instead, because it governs
 *   everything he can do (`support` reads, `admin` writes).
 *
 * Active-entry rule: exact slug match, plus a prefix match so a center detail
 * (`/plateforme/centres/12`) keeps « Centres » lit.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { PLATFORM_ROLE_LABELS } from '@/lib/labels';
import {
  hrefForSlug,
  platformGroupsInSection,
  platformNodeVisible,
  platformSectionLabel,
  platformSections,
  platformSlugFromPath,
} from '@/lib/platform-manifest';

/** « Centres » (slug `plateforme`) also owns `/plateforme/centres/…`. */
function isActive(slug: string, current: string): boolean {
  if (slug === current) return true;
  if (slug === 'plateforme') return current.startsWith('plateforme/centres');
  return current.startsWith(`${slug}/`);
}

export function PlatformSidebar() {
  const current = platformSlugFromPath(usePathname() || '/');
  const { me } = useAuth();
  const role = me?.platform_staff?.role;

  return (
    <aside className="ax-sidebar" role="navigation" aria-label="Navigation de la plateforme">
      <div className="ax-sidebar__brand">
        <Link className="ax-sidebar__logo" href="/plateforme" aria-label="Accueil plateforme Chioni">
          <span className="ax-sidebar__mark" aria-hidden="true">
            <svg className="ax-icon" viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmkplat" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmkplat)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
          </span>
          <span className="ax-sidebar__wordmark">CHIONI</span>
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--ax-space-2)',
          padding: 'var(--ax-space-2) var(--ax-space-4)',
          minWidth: 0,
        }}
      >
        <Icon
          name="lock"
          className="ax-icon"
          style={{ inlineSize: 20, blockSize: 20, color: 'var(--ax-text-subtle)', flex: '0 0 auto' }}
        />
        <span
          style={{
            fontSize: 'var(--ax-text-xs)',
            color: 'var(--ax-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {role ? `Plateforme · ${PLATFORM_ROLE_LABELS[role]}` : 'Plateforme'}
        </span>
      </div>

      <nav className="ax-sidebar__nav" role="tree" aria-label="Menu de la plateforme">
        {platformSections()
          // Une rubrique dont toutes les entrées sont gatées ne laisse pas un
          // titre orphelin dans le menu.
          .filter((section) =>
            platformGroupsInSection(section).some(
              (node) => node.inMenu && platformNodeVisible(node.id, role ?? null),
            ),
          )
          .map((section) => (
          <div key={section}>
            <p className="ax-sidebar__section" role="presentation">
              {platformSectionLabel(section)}
            </p>
            {platformGroupsInSection(section)
              .filter((node) => node.inMenu && platformNodeVisible(node.id, role ?? null))
              .map((node) => {
                const active = isActive(node.slug, current);
                const cls = ['ax-nav__item', 'ax-nav__item--parent'];
                if (active) cls.push('ax-nav__item--active', 'is-active');
                return (
                  <Link
                    key={node.id}
                    className={cls.join(' ')}
                    role="treeitem"
                    aria-level={1}
                    aria-current={active ? 'page' : undefined}
                    href={hrefForSlug(node.slug)}
                  >
                    <Icon name={node.icon} className="ax-nav__icon" />
                    <span className="ax-nav__label">{node.title}</span>
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default PlatformSidebar;
