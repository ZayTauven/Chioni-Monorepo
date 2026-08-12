'use client';
/*
 * Vireo Next.js — Projects / Overview (route "projects/overview").
 *
 * Faithful re-expression of src/html/projects/overview.html: a project header
 * card with avatar, status badge, meta chips, a 96px progress ring and section
 * tabs (overview/tasks/files/activity), a 4-stat row, a main column (task
 * distribution + recent tasks + files grid) and a rail (team / milestones /
 * activity timelines). The Alpine x-data ({ tab, starred }) is ported to React
 * state; classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

export function ProjectsOverview() {
  const [tab, setTab] = useState('overview');
  const [starred, setStarred] = useState(true);

  return (
    <>
      <PageHead
        title="Aurora Redesign"
        subtitle={(<>Design system overhaul · Led by Lena Brandt · Due <span className="ax-num">Jul 18, 2026</span>.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label={starred ? 'Unstar project' : 'Star project'} onClick={() => setStarred((s) => !s)} style={starred ? { color: 'var(--ax-viz-amber)' } : undefined}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-7l-4 4v-4h-3a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1" /></svg>
              <span className="ax-btn__label">Discuss</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New task</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* PROJECT HEADER CARD */}
        <section className="ax-card ax-col--12" role="region" aria-label="Project summary">
          <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="ax-avatar ax-avatar--2xl ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-accent) 20%,transparent)', color: 'var(--ax-accent)', flex: 'none' }}>
              <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30 }}><path d="M3 21v-4a4 4 0 1 1 4 4h-4" /><path d="M21 3a16 16 0 0 0 -12.8 10.2" /><path d="M21 3a16 16 0 0 1 -10.2 12.8" /><path d="M10.6 9a9 9 0 0 1 4.4 4.4" /></svg>
            </span>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>Aurora Redesign</h2>
                <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />On track</span>
              </div>
              <p className="ax-clamp-2" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.55, marginTop: 6, maxWidth: '64ch' }}>Rebuild the entire component library on the new role-token foundation, ship dark mode and 12 accents, and migrate every product surface without a visual regression.</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
                <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}><svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>Apr 02 – Jul 18</span>
                <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}><svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /></svg>Design</span>
                <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}><svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg>$460K budget</span>
              </div>
            </div>
            {/* progress ring */}
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ position: 'relative', width: 96, height: 96 }}>
                <svg viewBox="0 0 36 36" width={96} height={96} aria-hidden="true">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--ax-surface-subtle)" strokeWidth={3.2} />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--ax-accent)" strokeWidth={3.2} strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="25.3" transform="rotate(-90 18 18)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><b className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>74%</b></div>
              </div>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Complete</span>
            </div>
          </div>
          {/* tabs */}
          <div className="ax-tabs" style={{ padding: '0 var(--ax-space-5)' }}>
            <div className="ax-tabs__list" role="tablist" aria-label="Project sections">
              <button type="button" className="ax-tabs__tab" role="tab" aria-selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</button>
              <button type="button" className="ax-tabs__tab" role="tab" aria-selected={tab === 'tasks'} onClick={() => setTab('tasks')}>Tasks <span className="ax-badge ax-badge--soft ax-badge--neutral ax-tabs__badge">52</span></button>
              <button type="button" className="ax-tabs__tab" role="tab" aria-selected={tab === 'files'} onClick={() => setTab('files')}>Files <span className="ax-badge ax-badge--soft ax-badge--neutral ax-tabs__badge">14</span></button>
              <button type="button" className="ax-tabs__tab" role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>Activity</button>
            </div>
          </div>
        </section>

        {/* STAT ROW */}
        <div className="ax-card ax-col--3" role="region" aria-label="Tasks done">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg></span>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.1 }}>38 / 52</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Tasks done</div></div>
          </div>
        </div>
        <div className="ax-card ax-col--3" role="region" aria-label="Open tasks">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></span>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.1 }}>11</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Open · 3 overdue</div></div>
          </div>
        </div>
        <div className="ax-card ax-col--3" role="region" aria-label="Team members">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></span>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.1 }}>6</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Team members</div></div>
          </div>
        </div>
        <div className="ax-card ax-col--3" role="region" aria-label="Budget spent">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M5 21v-12l5 -4l5 4l0 12" /><path d="M9 21v-12h6v12" /></svg></span>
            <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1.1 }}>$340K</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>of $460K spent</div></div>
          </div>
        </div>

        {/* MAIN (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* task summary by status */}
          <section className="ax-card" role="region" aria-label="Task summary">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Tasks</h2><p className="ax-card__subtitle">Distribution across the board</p></div>
              <Link className="ax-btn ax-btn--link" href="/projects/list">Open board</Link>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ display: 'flex', height: 14, borderRadius: 'var(--ax-radius-pill)', overflow: 'hidden' }}>
                <span style={{ width: '22%', background: 'var(--ax-text-subtle)' }} aria-hidden="true" />
                <span style={{ width: '21%', background: 'var(--ax-viz-cyan)' }} aria-hidden="true" />
                <span style={{ width: '14%', background: 'var(--ax-viz-amber)' }} aria-hidden="true" />
                <span style={{ width: '43%', background: 'var(--ax-viz-emerald)' }} aria-hidden="true" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--ax-space-3)' }}>
                <div><div className="ax-cluster" style={{ gap: 6, marginBottom: 2 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ax-text-subtle)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Backlog</span></div><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>12</b></div>
                <div><div className="ax-cluster" style={{ gap: 6, marginBottom: 2 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ax-viz-cyan)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>In progress</span></div><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>11</b></div>
                <div><div className="ax-cluster" style={{ gap: 6, marginBottom: 2 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ax-viz-amber)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Review</span></div><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>7</b></div>
                <div><div className="ax-cluster" style={{ gap: 6, marginBottom: 2 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ax-viz-emerald)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Done</span></div><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>22</b></div>
              </div>
              <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
              <ul className="ax-list" style={{ margin: 0 }}>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><label className="ax-check"><input type="checkbox" className="ax-checkbox" defaultChecked aria-label="Token role layer complete" /></label></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-muted)', textDecoration: 'line-through' }}>Define role-token layer for surfaces &amp; text</span></span>
                  <span className="ax-list__trailing"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 22%,transparent)', color: 'var(--ax-viz-cyan)', fontWeight: 600 }}>DO</span></span>
                </li>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><label className="ax-check"><input type="checkbox" className="ax-checkbox" aria-label="Migrate buttons" /></label></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-strong)' }}>Migrate all button variants to the new tokens</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Due Jun 30 · <span style={{ color: 'var(--ax-viz-amber)' }}>In review</span></span></span>
                  <span className="ax-list__trailing"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-accent) 22%,transparent)', color: 'var(--ax-accent)', fontWeight: 600 }}>LB</span></span>
                </li>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><label className="ax-check"><input type="checkbox" className="ax-checkbox" aria-label="Audit contrast" /></label></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-strong)' }}>Audit WCAG contrast across all 12 accents</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-danger-500)' }}>Overdue · Jun 24</span></span>
                  <span className="ax-list__trailing"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 22%,transparent)', color: 'var(--ax-viz-pink)', fontWeight: 600 }}>PN</span></span>
                </li>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><label className="ax-check"><input type="checkbox" className="ax-checkbox" aria-label="Ship dark mode" /></label></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text-strong)' }}>Ship dark mode for the dashboard surface</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Due Jul 04 · In progress</span></span>
                  <span className="ax-list__trailing"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 22%,transparent)', color: 'var(--ax-viz-amber)', fontWeight: 600 }}>AS</span></span>
                </li>
              </ul>
            </div>
          </section>

          {/* files */}
          <section className="ax-card" role="region" aria-label="Files">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Files</h2><p className="ax-card__subtitle">14 attachments · 248 MB</p></div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Upload</span></button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 'var(--ax-space-3)' }}>
              <a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>brand-guide.pdf</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>4.2 MB</span></span>
              </a>
              <a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>tokens-spec.fig</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>18 MB</span></span>
              </a>
              <a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 16l2 -2l2 2" /><path d="M3 4h18v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 8h18" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>audit-results.xlsx</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>820 KB</span></span>
              </a>
              <a href="#" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', textDecoration: 'none' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg></span>
                <span style={{ minWidth: 0 }}><span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>tokens.css</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>36 KB</span></span>
              </a>
            </div>
          </section>
        </div>

        {/* RAIL (4) */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* team */}
          <section className="ax-card" role="region" aria-label="Team">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Team</h2></div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Add member"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg></button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 22%,transparent)', color: 'var(--ax-accent)', fontWeight: 600 }}>LB</span><div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Lena Brandt</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Project lead</div></div><span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Lead</span></div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 22%,transparent)', color: 'var(--ax-viz-cyan)', fontWeight: 600 }}>DO</span><div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Devon Okafor</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Staff engineer</div></div></div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 22%,transparent)', color: 'var(--ax-viz-pink)', fontWeight: 600 }}>PN</span><div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Priya Nair</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Accessibility</div></div></div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 22%,transparent)', color: 'var(--ax-viz-amber)', fontWeight: 600 }}>AS</span><div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Ava Sutton</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Product designer</div></div></div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 22%,transparent)', color: 'var(--ax-viz-violet)', fontWeight: 600 }}>TH</span><div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Tomás Herrera</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Frontend engineer</div></div></div>
            </div>
          </section>

          {/* milestones */}
          <section className="ax-card" role="region" aria-label="Milestones">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Milestones</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-timeline">
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Token foundation</b> shipped</p><span className="ax-timeline__time">Done · May 14</span></div>
                </li>
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Component migration</b> 70%</p><span className="ax-timeline__time">Done · Jun 20</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M9 12l2 2l4 -4" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Design freeze</b></p><span className="ax-timeline__time">Jun 30 · 3 days</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Launch</b> — all surfaces live</p><span className="ax-timeline__time">Jul 18 · 20 days</span></div>
                </li>
              </ul>
            </div>
          </section>

          {/* activity */}
          <section className="ax-card" role="region" aria-label="Activity">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Activity</h2></div><a className="ax-btn ax-btn--link" href="#">All</a></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-timeline">
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Devon</b> merged the token role layer</p><span className="ax-timeline__time">12m ago</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-7l-4 4v-4h-3a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya</b> commented on the contrast audit</p><span className="ax-timeline__time">1h ago</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Ava</b> uploaded <span style={{ color: 'var(--ax-accent)' }}>tokens-spec.fig</span></p><span className="ax-timeline__time">3h ago</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M4 18l10 -10l3 3l-10 10l-3 0l0 -3" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Lena</b> moved 4 tasks to Review</p><span className="ax-timeline__time">Yesterday</span></div>
                </li>
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default ProjectsOverview;
