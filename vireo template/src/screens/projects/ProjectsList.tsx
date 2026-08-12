'use client';
/*
 * Vireo Next.js — Projects / List (route "projects/list").
 *
 * Faithful re-expression of src/html/projects/list.html: a search + status filter
 * pills + sort + card/list segment toolbar, a card grid with SVG progress rings,
 * status badges, member avatar stacks, and an equivalent list/table view, plus an
 * empty state. The Alpine x-data (axProjectsList) is ported to React state;
 * classes + ARIA match the reference 1:1.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', accent: 'var(--ax-accent)',
};

const ICON: Record<string, string[]> = {
  design: ['M3 21v-4a4 4 0 1 1 4 4h-4', 'M21 3a16 16 0 0 0 -12.8 10.2', 'M21 3a16 16 0 0 1 -10.2 12.8', 'M10.6 9a9 9 0 0 1 4.4 4.4'],
  code: ['M7 8l-4 4l4 4', 'M17 8l4 4l-4 4', 'M14 4l-4 16'],
  data: ['M4 6c0 1.657 3.582 3 8 3s8 -1.343 8 -3s-3.582 -3 -8 -3s-8 1.343 -8 3', 'M4 6v6c0 1.657 3.582 3 8 3s8 -1.343 8 -3v-6', 'M4 12v6c0 1.657 3.582 3 8 3s8 -1.343 8 -3v-6'],
  card: ['M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M3 10l18 0', 'M7 15l.01 0', 'M11 15l2 0'],
  megaphone: ['M3 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M9 8h2l8 -3v15l-8 -3h-2', 'M19 5a4 4 0 0 1 0 6'],
};

interface Member { i: string; c: string; }
interface Project {
  id: number; name: string; category: string; team: string; lead: string; desc: string;
  progress: number; status: string; statusName: string; statusBadge: string; due: string;
  tasksDone: number; tasksTotal: number; c: string; icon: string; members: Member[]; extra: number; _due: number;
}
const PROJECTS: Project[] = [
  { id: 1, name: 'Aurora Redesign', category: 'Design', team: 'Design', lead: 'Lena Brandt', desc: 'Rebuild the component library on the role-token foundation and ship dark mode plus 12 accents.', progress: 74, status: 'ontrack', statusName: 'On track', statusBadge: 'ax-badge--success', due: 'Jul 18', tasksDone: 38, tasksTotal: 52, c: C.accent, icon: 'design', members: [{ i: 'LB', c: C.accent }, { i: 'DO', c: C.cyan }, { i: 'PN', c: C.pink }], extra: 3, _due: 18 },
  { id: 2, name: 'Mobile App v3', category: 'Engineering', team: 'Engineering', lead: 'Devon Okafor', desc: 'Full React Native rebuild with offline-first sync and a redesigned onboarding flow.', progress: 48, status: 'ontrack', statusName: 'On track', statusBadge: 'ax-badge--success', due: 'Aug 12', tasksDone: 61, tasksTotal: 128, c: C.cyan, icon: 'code', members: [{ i: 'DO', c: C.cyan }, { i: 'TH', c: C.violet }], extra: 5, _due: 43 },
  { id: 3, name: 'Billing Migration', category: 'Platform', team: 'Platform', lead: 'Tomás Herrera', desc: 'Move billing from Stripe to an in-house ledger without a single missed invoice.', progress: 28, status: 'atrisk', statusName: 'At risk', statusBadge: 'ax-badge--warning', due: 'Jul 28', tasksDone: 22, tasksTotal: 96, c: C.violet, icon: 'card', members: [{ i: 'TH', c: C.violet }, { i: 'MR', c: C.amber }], extra: 2, _due: 28 },
  { id: 4, name: 'Data Warehouse', category: 'Analytics', team: 'Analytics', lead: 'Priya Nair', desc: 'Stand up a Snowflake pipeline feeding the new analytics dashboards in near-real-time.', progress: 12, status: 'delayed', statusName: 'Delayed', statusBadge: 'ax-badge--danger', due: 'Sep 02', tasksDone: 9, tasksTotal: 74, c: C.pink, icon: 'data', members: [{ i: 'PN', c: C.pink }], extra: 3, _due: 64 },
  { id: 5, name: 'Brand Refresh', category: 'Marketing', team: 'Marketing', lead: 'Ava Sutton', desc: 'New logo, typography and a refreshed set of brand guidelines for launch.', progress: 100, status: 'done', statusName: 'Done', statusBadge: 'ax-badge--info', due: 'Jun 10', tasksDone: 44, tasksTotal: 44, c: C.amber, icon: 'megaphone', members: [{ i: 'AS', c: C.amber }, { i: 'LB', c: C.accent }], extra: 1, _due: -18 },
  { id: 6, name: 'Search Revamp', category: 'Engineering', team: 'Engineering', lead: 'Devon Okafor', desc: 'Replace the legacy search with a typo-tolerant, sub-50ms index across all entities.', progress: 56, status: 'ontrack', statusName: 'On track', statusBadge: 'ax-badge--success', due: 'Aug 04', tasksDone: 34, tasksTotal: 60, c: C.emerald, icon: 'code', members: [{ i: 'DO', c: C.cyan }, { i: 'TH', c: C.violet }, { i: 'MR', c: C.amber }], extra: 2, _due: 35 },
  { id: 7, name: 'Onboarding Flow', category: 'Product', team: 'Product', lead: 'Priya Nair', desc: 'Cut time-to-value from 11 minutes to under 3 with a guided, skippable setup.', progress: 33, status: 'atrisk', statusName: 'At risk', statusBadge: 'ax-badge--warning', due: 'Jul 22', tasksDone: 14, tasksTotal: 42, c: C.cyan, icon: 'design', members: [{ i: 'PN', c: C.pink }, { i: 'AS', c: C.amber }], extra: 1, _due: 22 },
  { id: 8, name: 'Pricing Page', category: 'Growth', team: 'Growth', lead: 'Marcus Reid', desc: 'Rebuild the pricing page around buyer outcomes and add a transparent calculator.', progress: 88, status: 'ontrack', statusName: 'On track', statusBadge: 'ax-badge--success', due: 'Jul 02', tasksDone: 29, tasksTotal: 33, c: C.violet, icon: 'megaphone', members: [{ i: 'MR', c: C.amber }, { i: 'LB', c: C.accent }], extra: 0, _due: 2 },
];

const STATUS_FILTERS = [
  { id: 'all', name: 'All', count: 42 },
  { id: 'ontrack', name: 'On track', count: 24 },
  { id: 'atrisk', name: 'At risk', count: 9 },
  { id: 'delayed', name: 'Delayed', count: 5 },
  { id: 'done', name: 'Done', count: 4 },
];

const RING = 97.4;

export function ProjectsList() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('progress');
  const [view, setView] = useState<'cards' | 'list'>('cards');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const r = PROJECTS.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (term && !(p.name.toLowerCase().includes(term) || p.lead.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))) return false;
      return true;
    });
    const by: Record<string, (a: Project, b: Project) => number> = {
      progress: (a, b) => b.progress - a.progress,
      due: (a, b) => a._due - b._due,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...r].sort(by[sort] || by.progress);
  }, [q, status, sort]);

  return (
    <>
      <PageHead
        title="Projects"
        subtitle={(<><span className="ax-num">42</span> active · <span className="ax-num">9</span> at risk · <span className="ax-num">81%</span> avg. team utilization.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/projects/create">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New project</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* TOOLBAR */}
        <section className="ax-card ax-col--12" role="region" aria-label="Filters">
          <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 17, height: 17, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input" placeholder="Search projects, leads…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 35 }} aria-label="Search projects" />
            </div>
            {/* status filter pills */}
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map((s) => (
                <button key={s.id} type="button" className={`ax-btn ax-btn--sm ax-btn--pill ${status === s.id ? 'ax-btn--primary' : 'ax-btn--secondary'}`} onClick={() => setStatus(s.id)}>
                  <span className="ax-btn__label">{s.name}</span>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', opacity: 0.7, marginInlineStart: 4 }}>{s.count}</span>
                </button>
              ))}
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginInlineStart: 'auto' }}>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort projects" style={{ minWidth: 140 }}>
                <option value="progress">Most progress</option>
                <option value="due">Due soonest</option>
                <option value="name">Name A–Z</option>
              </select>
              <div className="ax-segment" role="group" aria-label="View mode">
                <button type="button" className="ax-segment__option" aria-pressed={view === 'cards'} onClick={() => setView('cards')} aria-label="Card view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg></button>
                <button type="button" className="ax-segment__option" aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="List view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
              </div>
            </div>
          </div>
        </section>

        {/* CARDS VIEW */}
        {view === 'cards' && (
          <div className="ax-col--12">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 'var(--ax-space-6)' }}>
              {filtered.map((p) => (
                <article key={p.id} className="ax-card ax-card--interactive" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', flex: '1 1 auto' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.c} 18%,transparent)`, color: p.c, flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[p.icon].map((d, i) => <path key={i} d={d} />)}</svg></span>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <Link href="/projects/overview" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 600, color: 'var(--ax-text-strong)', textDecoration: 'none', lineHeight: 1.25 }}>{p.name}</Link>
                        <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.team + ' · ' + p.category}</div>
                      </div>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={'Actions for ' + p.name}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                    </div>
                    <p className="ax-clamp-2" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.55, flex: '1 1 auto' }}>{p.desc}</p>
                    {/* progress ring + status */}
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', justifyContent: 'space-between' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                        <div style={{ position: 'relative', width: 52, height: 52, flex: 'none' }}>
                          <svg viewBox="0 0 36 36" width={52} height={52} aria-hidden="true">
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--ax-surface-subtle)" strokeWidth={3.4} />
                            <circle cx="18" cy="18" r="15.5" fill="none" stroke={p.c} strokeWidth={3.4} strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING - (RING * p.progress) / 100} transform="rotate(-90 18 18)" />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{p.progress + '%'}</b></div>
                        </div>
                        <div>
                          <span className={`ax-badge ax-badge--soft ax-badge--pill ${p.statusBadge}`}><span className="ax-badge__dot" /><span>{p.statusName}</span></span>
                          <div className="ax-cluster" style={{ gap: 4, marginTop: 6, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}><svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{'Due ' + p.due}</span></div>
                        </div>
                      </div>
                    </div>
                    {/* footer: avatars + tasks */}
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', paddingTop: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {p.members.map((m, mi) => (
                          <span key={mi} className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${m.c} 22%,transparent)`, color: m.c, fontWeight: 600, border: '2px solid var(--ax-surface)', marginInlineStart: mi > 0 ? -8 : undefined }}>{m.i}</span>
                        ))}
                        {p.extra > 0 && <span className="ax-avatar ax-avatar--xs" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)', fontWeight: 600, border: '2px solid var(--ax-surface)', marginInlineStart: -8 }}>{'+' + p.extra}</span>}
                      </div>
                      <span className="ax-cluster" style={{ gap: 4, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{p.tasksDone + '/' + p.tasksTotal}</span></span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <section className="ax-card ax-col--12" role="region" aria-label="Projects list">
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Project</th>
                    <th className="ax-table__th" scope="col">Lead</th>
                    <th className="ax-table__th" scope="col">Progress</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Tasks</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Due</th>
                    <th className="ax-table__th" scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.c} 18%,transparent)`, color: p.c }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[p.icon].map((d, i) => <path key={i} d={d} />)}</svg></span>
                          <div style={{ minWidth: 0 }}><Link href="/projects/overview" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{p.name}</Link><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.category}</div></div>
                        </div>
                      </td>
                      <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${p.c} 22%,transparent)`, color: p.c, fontWeight: 600 }}>{p.members[0].i}</span><span style={{ color: 'var(--ax-text-muted)' }}>{p.lead}</span></div></td>
                      <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><div className="ax-progress ax-progress--sm" style={{ minWidth: 96 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${p.progress}%`, background: p.c }} /></div></div><span className="ax-num" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{p.progress + '%'}</span></div></td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{p.tasksDone + ' / ' + p.tasksTotal}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{p.due}</td>
                      <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--pill ${p.statusBadge}`}><span className="ax-badge__dot" /><span>{p.statusName}</span></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* empty state */}
        {!filtered.length && (
          <div className="ax-col--12" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
            <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 7a2 2 0 0 1 2 -2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /></svg></span>
            <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No projects match</h3>
            <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Adjust your search or status filter.</p>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setStatus('all'); }}>Clear filters</button>
          </div>
        )}
      </div>
    </>
  );
}

export default ProjectsList;
