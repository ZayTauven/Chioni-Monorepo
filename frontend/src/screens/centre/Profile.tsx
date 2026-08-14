'use client';
/*
 * Chioni — /centre/profil : « Mon profil » (visualisation).
 *
 * Adapté de l'écran « Profile » de Vireo (src/screens/pages/Profile.tsx) :
 * on garde l'en-tête d'identité (bandeau de couverture + avatar ceinturé) et
 * la structure rail gauche / colonne principale. Tout le reste du gabarit
 * (stats de posts, skills, connexions, composer, timeline fictive) est écarté :
 * AUCUNE donnée inventée — l'écran ne montre que ce que /auth/me/ porte
 * réellement : photo, nom, téléphone, casquettes par centre.
 *
 * La modification (photo, prénom/nom) vit sur /centre/profil/parametres.
 */
import Link from 'next/link';
import { PageHead } from '@/components/shell/PageHead';
import { Icon } from '@/components/ui/Icon';
import { spacesOf, useAuth } from '@/context/AuthContext';
import { STAFF_ROLE_LABELS } from '@/lib/labels';
import type { StaffMembership } from '@/lib/types';
import { IconEdit, initialsOf } from './shared';

/** Memberships grouped by center — a directeur-médecin shows ONE row for his
 *  center with BOTH role badges (multi-roles S2). */
function groupByCenter(memberships: StaffMembership[]) {
  const groups: Array<{ center: StaffMembership['center']; roles: StaffMembership['role'][] }> = [];
  for (const m of memberships) {
    const existing = groups.find((g) => g.center.id === m.center.id);
    if (existing) {
      if (!existing.roles.includes(m.role)) existing.roles.push(m.role);
    } else {
      groups.push({ center: m.center, roles: [m.role] });
    }
  }
  return groups;
}

export function Profile() {
  const { me } = useAuth();

  const displayName =
    me && (me.first_name || me.last_name)
      ? `${me.first_name} ${me.last_name}`.trim()
      : (me?.phone ?? '');
  const centers = groupByCenter(me?.staff_memberships ?? []);
  const multiSpace = spacesOf(me).length > 1;

  return (
    <>
      <PageHead
        title="Mon profil"
        subtitle="Votre photo, votre nom d'affichage et vos casquettes."
        actions={
          <Link href="/centre/profil/parametres" className="ax-btn ax-btn--primary">
            <IconEdit />
            <span className="ax-btn__label">Modifier mon profil</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* EN-TÊTE D'IDENTITÉ — bandeau + avatar ceinturé (asset Vireo Profile) */}
        <section className="ax-card ax-col--12" role="region" aria-label="Identité" style={{ overflow: 'hidden' }}>
          <div
            aria-hidden="true"
            style={{
              height: 120,
              background:
                'radial-gradient(120% 160% at 12% 0%, color-mix(in oklab,var(--ax-accent) 42%,transparent), transparent 60%), radial-gradient(90% 140% at 88% 10%, color-mix(in oklab,var(--ax-viz-violet) 34%,transparent), transparent 58%), linear-gradient(120deg, var(--ax-surface-subtle), var(--ax-surface-raised))',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(var(--ax-border) 1px,transparent 1px),linear-gradient(90deg,var(--ax-border) 1px,transparent 1px)',
                backgroundSize: '34px 34px',
                opacity: 0.4,
              }}
            />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div
              className="ax-cluster"
              style={{ gap: 'var(--ax-space-5)', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -44, position: 'relative' }}
            >
              {me?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
                <img
                  src={me.avatar}
                  alt={`Photo de profil de ${displayName}`}
                  width={88}
                  height={88}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    boxShadow: '0 0 0 4px var(--ax-surface-raised),0 0 0 6px var(--ax-accent)',
                  }}
                />
              ) : (
                <span
                  className="ax-avatar ax-avatar--2xl ax-avatar--ringed"
                  aria-hidden="true"
                  style={{
                    boxShadow: '0 0 0 4px var(--ax-surface-raised),0 0 0 6px var(--ax-accent)',
                    background: 'color-mix(in oklab,var(--ax-accent) 16%,var(--ax-surface-solid))',
                    color: 'var(--ax-accent)',
                  }}
                >
                  <span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-2xl)' }}>
                    {initialsOf(displayName)}
                  </span>
                </span>
              )}
              <div style={{ flex: '1 1 240px', minWidth: 0, paddingBottom: 'var(--ax-space-2)' }}>
                <h2
                  style={{
                    fontFamily: 'var(--ax-font-display)',
                    fontSize: 'var(--ax-text-xl)',
                    fontWeight: 700,
                    color: 'var(--ax-text-strong)',
                    lineHeight: 1.2,
                  }}
                >
                  {displayName || 'Mon compte'}
                </h2>
                <div
                  className="ax-num"
                  style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 2 }}
                >
                  {me?.phone}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CASQUETTES PAR CENTRE */}
        <section className="ax-card ax-col--7" role="region" aria-label="Mes casquettes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Mes casquettes</h3>
              <p className="ax-card__subtitle">Vos rôles actifs, centre par centre.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              {centers.map((g) => (
                <li key={g.center.id} className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading">
                    {g.center.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- API media URL, no Next loader configured
                      <img
                        src={g.center.logo}
                        alt=""
                        width={32}
                        height={32}
                        style={{ width: 32, height: 32, borderRadius: 'var(--ax-radius-sm)', objectFit: 'cover' }}
                      />
                    ) : (
                      <Icon
                        name="building-hospital"
                        className="ax-icon"
                        style={{ inlineSize: 22, blockSize: 22, color: 'var(--ax-text-subtle)' }}
                      />
                    )}
                  </span>
                  <span className="ax-list__content">
                    <span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>
                      {g.center.name}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                      {g.center.city}
                    </span>
                  </span>
                  <span className="ax-list__trailing" style={{ display: 'flex', gap: 'var(--ax-space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {g.roles.map((r) => (
                      <span key={r} className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">
                        {STAFF_ROLE_LABELS[r]}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            {(me?.patient_profile || me?.guardian_profile) && (
              <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                Vous avez aussi
                {me?.patient_profile ? ' un espace patient' : ''}
                {me?.patient_profile && me?.guardian_profile ? ' et' : ''}
                {me?.guardian_profile ? ' un espace tuteur' : ''}
                {multiSpace ? (
                  <>
                    {' — '}
                    <Link href="/espaces" className="ax-link">changer d&rsquo;espace</Link>.
                  </>
                ) : (
                  '.'
                )}
              </p>
            )}
          </div>
        </section>

        {/* CONNEXION */}
        <section className="ax-card ax-col--5" role="region" aria-label="Connexion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h3 className="ax-card__title">Connexion</h3>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-field">
              <span className="ax-label">Téléphone</span>
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)' }}>
                {me?.phone}
              </span>
              <span className="ax-field__message">
                Votre numéro est votre identifiant de connexion — il ne se modifie pas depuis l&rsquo;application.
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
              Votre photo et votre nom d&rsquo;affichage sont communs à toutes vos casquettes.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default Profile;
