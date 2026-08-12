'use client';
/*
 * Vireo Next.js — Pages / Timeline (route "pages/timeline").
 *
 * Faithful re-expression of src/html/pages/timeline.html: a day-grouped activity
 * timeline (sticky date labels, success/pending/danger markers) with a density
 * segment toggle, a compact release-history rail and a marker-state legend.
 * Client component for the `density` toggle (the Alpine x-data is ported to
 * useState). DOM/classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const ICON_CAL = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
);
const ICON_CHEV = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);
const ICON_LOG = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 13h6" /><path d="M9 17h3" /></svg>
);

const dayHead: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) 0', background: 'var(--ax-surface)', backdropFilter: 'blur(6px)' };

export function Timeline() {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');

  return (
    <>
      <PageHead
        title="Timeline"
        subtitle="A reusable vertical chronological pattern — used in profiles, project overviews and activity logs."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">{ICON_CAL}<span className="ax-btn__label">June 2026</span>{ICON_CHEV}</button>
            <a className="ax-btn ax-btn--ghost" href="#">{ICON_LOG}<span className="ax-btn__label">View activity log</span></a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* MAIN: Project timeline */}
        <section className="ax-card ax-col--8" role="region" aria-label="Project activity timeline">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Atlas redesign · Sprint 14</span>
              <h2 className="ax-card__title">Activity Timeline</h2>
              <p className="ax-card__subtitle">Chronological feed grouped by day — newest first</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-segment" role="radiogroup" aria-label="Timeline density">
                <button type="button" className={`ax-segment__option${density === 'compact' ? ' is-active' : ''}`} aria-checked={density === 'compact'} role="radio" onClick={() => setDensity('compact')}>Compact</button>
                <button type="button" className={`ax-segment__option${density === 'comfortable' ? ' is-active' : ''}`} aria-checked={density === 'comfortable'} role="radio" onClick={() => setDensity('comfortable')}>Comfortable</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, ...(density === 'compact' ? { fontSize: 'var(--ax-text-sm)' } : {}) }}>

            {/* Day group: Today */}
            <div style={dayHead}>
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Today</span>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} className="ax-num">Fri, 27 Jun 2026</span>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
            </div>
            <ol className="ax-timeline" style={{ margin: 0, listStyle: 'none' }}>
              <li className="ax-timeline__item ax-timeline__item--success">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div className="ax-timeline__content">
                  <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Mara Lindqvist</b> merged pull request <span style={{ color: 'var(--ax-accent)' }}>#482 · Tokenize chart palette</span></p>
                  <p style={{ margin: 'var(--ax-space-1) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>14 files changed across the charts module. CI green, deployed to <span className="ax-num">staging</span>.</p>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}>
                    <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--sm">+428 −96</span>
                    <span className="ax-badge ax-badge--outline ax-badge--sm">charts</span>
                  </div>
                  <span className="ax-timeline__time ax-num">09:41</span>
                </div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg></span>
                <div className="ax-timeline__content">
                  <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Devon Okafor</b> attached <span style={{ color: 'var(--ax-text)' }}>empty-states-v3.fig</span> to the design review</p>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-2)', padding: 'var(--ax-space-2) var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', maxWidth: 340, flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                    <div style={{ minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>empty-states-v3.fig</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>2.4 MB · Figma</div></div>
                  </div>
                  <span className="ax-timeline__time ax-num">08:12</span>
                </div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M9 18l-3 3v-3h-1a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-7z" /></svg></span>
                <div className="ax-timeline__content">
                  <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya Nair</b> commented on <span style={{ color: 'var(--ax-accent)' }}>TSK-241</span></p>
                  <blockquote style={{ margin: 'var(--ax-space-2) 0 0', padding: 'var(--ax-space-2) var(--ax-space-3)', borderInlineStart: '2px solid var(--ax-border-strong)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>&quot;The spotlight cut-out feels great — can we soften the scrim by ~6% in light mode?&quot;</blockquote>
                  <span className="ax-timeline__time ax-num">07:55</span>
                </div>
              </li>
            </ol>

            {/* Day group: Yesterday */}
            <div style={{ ...dayHead, marginTop: 'var(--ax-space-4)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Yesterday</span>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} className="ax-num">Thu, 26 Jun 2026</span>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
            </div>
            <ol className="ax-timeline" style={{ margin: 0, listStyle: 'none' }}>
              <li className="ax-timeline__item ax-timeline__item--pending">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v5l3 3" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span>
                <div className="ax-timeline__content">
                  <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Release 2.4.0</b> is awaiting QA sign-off</p>
                  <p style={{ margin: 'var(--ax-space-1) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>3 of 5 checks passed · 2 in progress</p>
                  <div className="ax-progress ax-progress--sm" style={{ marginTop: 'var(--ax-space-2)', maxWidth: 280 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '60%', background: 'var(--ax-viz-amber)' }} /></div></div>
                  <span className="ax-timeline__time ax-num">18:30</span>
                </div>
              </li>
              <li className="ax-timeline__item ax-timeline__item--danger">
                <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></span>
                <div className="ax-timeline__content">
                  <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Nightly build</b> failed on <span style={{ color: 'var(--ax-text)' }}>e2e-checkout</span></p>
                  <p style={{ margin: 'var(--ax-space-1) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Timeout waiting for payment iframe — flake re-run queued.</p>
                  <span className="ax-timeline__time ax-num">02:14</span>
                </div>
              </li>
              <li className="ax-timeline__item">
                <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-pink)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg></span>
                <div className="ax-timeline__content">
                  <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Tomás Herrera</b> invited <span style={{ color: 'var(--ax-text)' }}>2 reviewers</span> to the project</p>
                  <div className="ax-avatar-group" style={{ marginTop: 'var(--ax-space-2)' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">AS</span></span>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><span className="ax-avatar__initials">LB</span></span>
                  </div>
                  <span className="ax-timeline__time ax-num">16:02</span>
                </div>
              </li>
            </ol>

            {/* end-of-feed marker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-4)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
              <span>You&apos;ve reached the start of this sprint</span>
              <hr className="ax-divider" style={{ flex: '1 1 auto' }} aria-hidden="true" />
            </div>
          </div>
          <div className="ax-card__footer">
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M5 12l7 7l7 -7" /></svg>
              <span className="ax-btn__label">Load earlier activity</span>
            </button>
          </div>
        </section>

        {/* RAIL */}
        <div className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Release history">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Release History</h2>
                <p className="ax-card__subtitle">Compact variant</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ol className="ax-timeline" style={{ margin: 0, listStyle: 'none' }}>
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker" style={{ width: 10, height: 10 }} />
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>v2.4.0</b> — Aurora charts</p><span className="ax-timeline__time ax-num">27 Jun</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ width: 10, height: 10, color: 'var(--ax-text-subtle)' }} />
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>v2.3.1</b> — Patch: focus rings</p><span className="ax-timeline__time ax-num">19 Jun</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ width: 10, height: 10, color: 'var(--ax-text-subtle)' }} />
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>v2.3.0</b> — Nested menu</p><span className="ax-timeline__time ax-num">11 Jun</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ width: 10, height: 10, color: 'var(--ax-text-subtle)' }} />
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>v2.2.0</b> — Command palette</p><span className="ax-timeline__time ax-num">02 Jun</span></div>
                </li>
              </ol>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Timeline status legend">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Marker States</h2></div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Success</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Completed step or merge</div></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v5l3 3" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Pending</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Awaiting an action</div></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-red) 18%,transparent)', color: 'var(--ax-viz-red)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Failed</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>An error or rejection</div></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--xs" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Now / Highlighted</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Accent dot for the live node</div></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default Timeline;
