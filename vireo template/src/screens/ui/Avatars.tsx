/*
 * Vireo Next.js — UI · Avatars (route "ui/avatars").
 *
 * Faithful re-expression of src/html/ui/avatars.html: six sizes, two shapes,
 * ring/selected states, the portrait→initials→glyph fallback chain, status
 * dots, stacks with +N overflow, and the name+role list-row pattern. Static —
 * no interactivity, so this is a server component (PageHead is its own client
 * boundary). DOM classes / ARIA / copy match the reference 1:1.
 */
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const;

export function Avatars() {
  return (
    <>
      <PageHead
        title="Avatars"
        subtitle="People & entity portraits — six sizes, two shapes, status dots, stacks & the initials-then-glyph fallback chain."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/pages/team">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 19a6 6 0 0 0 -12 0" /><path d="M16 11l2 2l4 -4" /><path d="M5 7a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
            <span className="ax-btn__label">Team</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Sizes */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatar sizes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Scale</span>
              <h2 className="ax-card__title">Sizes</h2>
              <p className="ax-card__subtitle">20 → 96px, initials scale with the diameter.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-4)', alignItems: 'flex-end' }}>
            {SIZES.map((s) => (
              <span key={s} className={`ax-avatar ax-avatar--${s}`} style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }} role="img" aria-label="Ava Sutton"><span className="ax-avatar__initials">AS</span></span>
            ))}
          </div>
        </section>

        {/* Shapes */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatar shapes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Form</span>
              <h2 className="ax-card__title">Shapes &amp; rings</h2>
              <p className="ax-card__subtitle">Circle for people, squircle for orgs; ring &amp; selected states.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-4)', alignItems: 'center' }}>
            <span className="ax-avatar ax-avatar--lg" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }} role="img" aria-label="Lena Brandt"><span className="ax-avatar__initials">LB</span></span>
            <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }} role="img" aria-label="Brightway Retail"><span className="ax-avatar__initials">BR</span></span>
            <span className="ax-avatar ax-avatar--lg ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }} role="img" aria-label="Mei Lin"><span className="ax-avatar__initials">ML</span></span>
            <span className="ax-avatar ax-avatar--lg ax-avatar--selected" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }} role="img" aria-label="Marcus Reyes, selected"><span className="ax-avatar__initials">MR</span></span>
          </div>
        </section>

        {/* Fallback chain */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatar fallback chain">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Resilience</span>
              <h2 className="ax-card__title">Fallback chain</h2>
              <p className="ax-card__subtitle">Portrait → colored initials → neutral user glyph.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" role="img" aria-label="Tomás Herrera">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ax-avatar__img" src="https://i.pravatar.cc/96?img=12" alt="" width="48" height="48" loading="lazy" />
              </span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Portrait</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }} role="img" aria-label="Priya Nair"><span className="ax-avatar__initials">PN</span></span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Initials</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" role="img" aria-label="Unknown user">
                <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
              </span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Glyph</small>
            </div>
          </div>
        </section>

        {/* Status */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatar status dots">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Presence</span>
              <h2 className="ax-card__title">Status dots</h2>
              <p className="ax-card__subtitle">Online, away, busy &amp; offline, ringed to the surface.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-6)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }} role="img" aria-label="Ava Sutton, online"><span className="ax-avatar__initials">AS</span><span className="ax-avatar__status ax-avatar__status--online" /></span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Online</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }} role="img" aria-label="Hana Yılmaz, away"><span className="ax-avatar__initials">HY</span><span className="ax-avatar__status ax-avatar__status--away" /></span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Away</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" style={{ background: 'color-mix(in oklab,var(--ax-viz-red) 18%,transparent)', color: 'var(--ax-viz-red)' }} role="img" aria-label="Tomás Herrera, busy"><span className="ax-avatar__initials">TH</span><span className="ax-avatar__status ax-avatar__status--busy" /></span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Busy</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--lg" style={{ background: 'var(--ax-fill-active)', color: 'var(--ax-text-muted)' }} role="img" aria-label="Jonas Falk, offline"><span className="ax-avatar__initials">JF</span><span className="ax-avatar__status ax-avatar__status--offline" /></span>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Offline</small>
            </div>
          </div>
        </section>

        {/* Groups / stacks */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatar groups and stacks">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Collections</span>
              <h2 className="ax-card__title">Stacks &amp; overflow</h2>
              <p className="ax-card__subtitle">Overlapping rows with a +N overflow chip.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-avatar-group" aria-label="Assigned: Ava, Marcus, Lena, Devon and 4 more">
              <span className="ax-avatar ax-avatar--md" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">AS</span></span>
              <span className="ax-avatar ax-avatar--md" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">MR</span></span>
              <span className="ax-avatar ax-avatar--md" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">LB</span></span>
              <span className="ax-avatar ax-avatar--md" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><span className="ax-avatar__initials">DO</span></span>
              <button type="button" className="ax-avatar ax-avatar--md ax-avatar__overflow" aria-label="4 more people">+4</button>
            </div>
            <div className="ax-avatar-group" aria-label="Reviewers, small">
              <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><span className="ax-avatar__initials">PN</span></span>
              <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><span className="ax-avatar__initials">HY</span></span>
              <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><span className="ax-avatar__initials">ML</span></span>
              <button type="button" className="ax-avatar ax-avatar--sm ax-avatar__overflow" aria-label="12 more people">+12</button>
            </div>
          </div>
        </section>

        {/* With name + meta */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatars with name and meta">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">With name &amp; role</h2>
              <p className="ax-card__subtitle">The list-row pattern used across the app.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--md" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">AS</span><span className="ax-avatar__status ax-avatar__status--online" /></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Ava Sutton</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Operations Lead</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-badge--sm">Owner</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--md" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">MR</span><span className="ax-avatar__status ax-avatar__status--online" /></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Marcus Reyes</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Engineering Manager</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill ax-badge--sm">Admin</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--md" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><span className="ax-avatar__initials">HY</span><span className="ax-avatar__status ax-avatar__status--away" /></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Hana Yılmaz</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Marketing Manager</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-badge--sm">Member</span></span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Avatars;
