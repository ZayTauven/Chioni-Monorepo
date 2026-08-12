'use client';
/*
 * Vireo React — Profile (route "pages/profile").
 *
 * Faithful re-expression of src/html/pages/profile.html: an identity header with
 * cover band + ringed avatar, a 4-stat strip, a left rail (About / Skills /
 * Connections) and a tabbed main column (Overview feed with composer / Activity
 * timeline / Projects grid). Alpine tabs + composer posted-state ported to React.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

type Tab = 'overview' | 'activity' | 'projects';

export function Profile() {
  const [tab, setTab] = useState<Tab>('overview');
  const [posted, setPosted] = useState(false);

  return (
    <>
      <PageHead
        title="Profile"
        subtitle="Public profile, activity and shared work for Maya Albright."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg>
              <span className="ax-btn__label">Message</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3z" /><path d="M16 5l3 3" /></svg>
              <span className="ax-btn__label">Edit profile</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* IDENTITY HEADER */}
        <section className="ax-card ax-col--12" role="region" aria-label="Profile header" style={{ overflow: 'hidden' }}>
          <div aria-hidden="true" style={{ height: 168, background: 'radial-gradient(120% 160% at 12% 0%, color-mix(in oklab,var(--ax-accent) 42%,transparent), transparent 60%), radial-gradient(90% 140% at 88% 10%, color-mix(in oklab,var(--ax-viz-violet) 34%,transparent), transparent 58%), linear-gradient(120deg, var(--ax-surface-subtle), var(--ax-surface-raised))', position: 'relative' }}>
            <span style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--ax-border) 1px,transparent 1px),linear-gradient(90deg,var(--ax-border) 1px,transparent 1px)', backgroundSize: '34px 34px', opacity: 0.4 }} />
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -56, position: 'relative' }}>
              <span className="ax-avatar ax-avatar--2xl ax-avatar--ringed" style={{ boxShadow: '0 0 0 4px var(--ax-surface-raised),0 0 0 6px var(--ax-accent)', background: 'color-mix(in oklab,var(--ax-accent) 16%,var(--ax-surface-solid))', color: 'var(--ax-accent)' }}>
                <span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-2xl)' }}>MA</span>
                <span className="ax-avatar__status ax-avatar__status--online" aria-hidden="true" />
              </span>
              <div style={{ flex: '1 1 240px', minWidth: 0, paddingBottom: 'var(--ax-space-2)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.2 }}>Maya Albright</h2>
                  <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Pro</span>
                </div>
                <div style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 2 }}>Principal Product Designer · Design Systems</div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <span className="ax-cluster" style={{ gap: 6 }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg>Lisbon, Portugal</span>
                  <span className="ax-cluster" style={{ gap: 6 }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>Joined Mar 2022</span>
                  <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-viz-emerald)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-viz-emerald)' }} />Available for work</span>
                </div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', paddingBottom: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="View on X / Twitter"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l11.733 16h4.267l-11.733 -16z" /><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="View on Dribbble"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M9 3.6c5 6 7 10.5 7.5 16.2" /><path d="M6.4 19c3.5 -3.5 6 -6.5 14.5 -6.4" /><path d="M3.1 10.75c5 0 9.814 -.38 15.314 -5" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M16 19h6" /><path d="M19 16v6" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /></svg><span className="ax-btn__label">Follow</span></button>
              </div>
            </div>
          </div>
        </section>

        {/* STAT STRIP */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Posts 248">
          <div className="ax-card__body">
            <div className="ax-kpi__top"><span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg></span></div>
            <div className="ax-kpi__label">Posts</div>
            <div className="ax-kpi__value ax-num">248</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Followers 12,940">
          <div className="ax-card__body">
            <div className="ax-kpi__top"><span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg></span><span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>4.2%</span></div>
            <div className="ax-kpi__label">Followers</div>
            <div className="ax-kpi__value ax-num">12,940</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Projects 36">
          <div className="ax-card__body">
            <div className="ax-kpi__top"><span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-10" /></svg></span></div>
            <div className="ax-kpi__label">Projects</div>
            <div className="ax-kpi__value ax-num">36</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Endorsements 1,102">
          <div className="ax-card__body">
            <div className="ax-kpi__top"><span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span><span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>1.8%</span></div>
            <div className="ax-kpi__label">Endorsements</div>
            <div className="ax-kpi__value ax-num">1,102</div>
          </div>
        </div>

        {/* LEFT RAIL */}
        <div className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="About">
            <div className="ax-card__header"><div className="ax-card__titles"><h3 className="ax-card__title">About</h3></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Designer focused on data-dense interfaces and design systems. I help product teams ship calm, accessible tooling — currently leading the component platform at Northwind.</p>
              <ul className="ax-list ax-list--compact">
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
                  <span className="ax-list__content"><span className="ax-list__title">maya.albright@northwind.io</span></span>
                </li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
                  <span className="ax-list__content"><span className="ax-list__title ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>+351 912 044 318</span></span>
                </li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M3.6 9h16.8" /><path d="M3.6 15h16.8" /><path d="M11.5 3a17 17 0 0 0 0 18" /><path d="M12.5 3a17 17 0 0 1 0 18" /></svg></span>
                  <span className="ax-list__content"><a className="ax-link" href="#">maya.design</a></span>
                </li>
              </ul>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Skills and tools">
            <div className="ax-card__header"><div className="ax-card__titles"><h3 className="ax-card__title">Skills &amp; Tools</h3></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                {['Design Systems', 'Figma', 'Accessibility', 'Prototyping', 'Tokens', 'CSS', 'Research', 'Motion'].map((s) => (
                  <span key={s} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">{s}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Connections">
            <div className="ax-card__header"><div className="ax-card__titles"><h3 className="ax-card__title">Connections</h3></div><a className="ax-btn ax-btn--link" href="#">View all</a></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">DK</span></span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Devon Okafor</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Staff Engineer</div></div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Following</button>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">LB</span></span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Lena Brandt</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Illustrator</div></div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">Follow</button>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><span className="ax-avatar__initials">TH</span></span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Tomás Herrera</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>PM, Platform</div></div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">Follow</button>
              </div>
            </div>
          </section>
        </div>

        {/* MAIN COLUMN: Tabs */}
        <section className="ax-card ax-col--8" role="region" aria-label="Profile content">
          <div className="ax-card__body">
            <div className="ax-tabs">
              <div className="ax-tabs__list" role="tablist" aria-label="Profile sections">
                <button type="button" className="ax-tabs__tab" role="tab" id="tab-overview" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</button>
                <button type="button" className="ax-tabs__tab" role="tab" id="tab-activity" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>Activity</button>
                <button type="button" className="ax-tabs__tab" role="tab" id="tab-projects" aria-selected={tab === 'projects'} onClick={() => setTab('projects')}>Projects<span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral">12</span></button>
              </div>

              {/* OVERVIEW */}
              {tab === 'overview' && (
                <div className="ax-tabs__panel" role="tabpanel" aria-labelledby="tab-overview">
                  <div style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', marginBottom: 'var(--ax-space-5)' }}>
                    <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">MA</span></span>
                    <div style={{ flex: '1 1 auto' }}>
                      <textarea className="ax-textarea" rows={2} placeholder="Share an update with your followers…" style={{ minHeight: 64 }} />
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
                        {posted
                          ? <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-success-500)', fontSize: 'var(--ax-text-xs)' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>Posted</span>
                          : <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Visible to followers</span>}
                        <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={() => setPosted(true)}>Post update</button>
                      </div>
                    </div>
                  </div>

                  <article style={{ padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', marginBottom: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', marginBottom: 'var(--ax-space-3)' }}>
                      <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">MA</span></span>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Maya Albright</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 24 · 09:12</div></div>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Post options"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg></button>
                    </div>
                    <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Shipped the new density tokens today — tables, lists and the side rail all read 8% tighter without losing tap targets. Before/after in the thread. 🎚️</p>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-3)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ gap: 6 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" /></svg><span className="ax-num">214</span></button>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ gap: 6 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" /></svg><span className="ax-num">38</span></button>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ gap: 6 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg>Share</button>
                    </div>
                  </article>

                  <article style={{ padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', marginBottom: 'var(--ax-space-3)' }}>
                      <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">MA</span></span>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Maya Albright</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 19 · 16:40</div></div>
                    </div>
                    <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Wrote up how we keep 12 accent themes accessible with a single role-token layer. No per-theme overrides, no hard-coded hex. Link in bio.</p>
                    <div style={{ marginTop: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', padding: 'var(--ax-space-3)', background: 'var(--ax-surface-subtle)' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Theming without overrides</div><div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>maya.design/notes/role-tokens</div></div>
                      </div>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-3)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ gap: 6 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" /></svg><span className="ax-num">96</span></button>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ gap: 6 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" /></svg><span className="ax-num">12</span></button>
                    </div>
                  </article>
                </div>
              )}

              {/* ACTIVITY */}
              {tab === 'activity' && (
                <div className="ax-tabs__panel" role="tabpanel" aria-labelledby="tab-activity">
                  <ul className="ax-timeline">
                    <li className="ax-timeline__item ax-timeline__item--success">
                      <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                      <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Merged</b> design tokens v3 into <span style={{ color: 'var(--ax-accent)' }}>main</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>2h ago</span></div>
                    </li>
                    <li className="ax-timeline__item">
                      <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg></span>
                      <div className="ax-timeline__content"><p className="ax-timeline__title">Published <span style={{ color: 'var(--ax-text)' }}>Empty-state illustration set</span> to the library</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Yesterday</span></div>
                    </li>
                    <li className="ax-timeline__item">
                      <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg></span>
                      <div className="ax-timeline__content"><p className="ax-timeline__title">Commented on <span style={{ color: 'var(--ax-text)' }}>Sidebar density review</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 24</span></div>
                    </li>
                    <li className="ax-timeline__item">
                      <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span>
                      <div className="ax-timeline__content"><p className="ax-timeline__title">Earned the <b style={{ color: 'var(--ax-text-strong)' }}>Top Contributor</b> badge</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 21</span></div>
                    </li>
                  </ul>
                </div>
              )}

              {/* PROJECTS */}
              {tab === 'projects' && (
                <div className="ax-tabs__panel" role="tabpanel" aria-labelledby="tab-projects">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 'var(--ax-space-4)' }}>
                    <article style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                      <div aria-hidden="true" style={{ height: 88, background: 'linear-gradient(120deg,color-mix(in oklab,var(--ax-accent) 32%,transparent),color-mix(in oklab,var(--ax-viz-cyan) 28%,transparent))' }} />
                      <div style={{ padding: 'var(--ax-space-3)' }}>
                        <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Aurora Design Kit</div>
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-2)' }}>Component library · 84 screens</div>
                        <div className="ax-progress ax-progress--xs"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '92%' }} /></div></div>
                      </div>
                    </article>
                    <article style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                      <div aria-hidden="true" style={{ height: 88, background: 'linear-gradient(120deg,color-mix(in oklab,var(--ax-viz-violet) 32%,transparent),color-mix(in oklab,var(--ax-viz-pink) 26%,transparent))' }} />
                      <div style={{ padding: 'var(--ax-space-3)' }}>
                        <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Settings Redesign</div>
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-2)' }}>Product · 22 screens</div>
                        <div className="ax-progress ax-progress--xs"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '64%' }} /></div></div>
                      </div>
                    </article>
                    <article style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                      <div aria-hidden="true" style={{ height: 88, background: 'linear-gradient(120deg,color-mix(in oklab,var(--ax-viz-amber) 32%,transparent),color-mix(in oklab,var(--ax-viz-emerald) 26%,transparent))' }} />
                      <div style={{ padding: 'var(--ax-space-3)' }}>
                        <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Onboarding Flow</div>
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-2)' }}>Growth · 9 screens</div>
                        <div className="ax-progress ax-progress--xs"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '38%' }} /></div></div>
                      </div>
                    </article>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Profile;
