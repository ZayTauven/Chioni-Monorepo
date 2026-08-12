'use client';
/*
 * Vireo Next.js — Tasks app (apps/tasks).
 * Faithful re-expression of src/html/apps/tasks.html: filterable, grouped task
 * table with search, status/priority selects, filter chips, bulk-select bar.
 * Alpine axTasks() → React useState; DOM classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Who { i: string; n: string; c: string }
interface Task {
  id: number; group: string; title: string; project: string; status: string;
  priority: string; due: string; updated: string; subtasks: string; who: Who | null;
}

const GROUPS = [
  { id: 'overdue', title: 'Overdue', color: 'var(--ax-danger-500)' },
  { id: 'today', title: 'Due today', color: 'var(--ax-accent)' },
  { id: 'later', title: 'Upcoming', color: 'var(--ax-viz-cyan)' },
  { id: 'completed', title: 'Completed', color: 'var(--ax-viz-emerald)' },
];

const TASKS: Task[] = [
  { id: 1, group: 'overdue', title: 'Fix payment webhook retry loop', project: 'Billing service', status: 'blocked', priority: 'urgent', due: 'Jun 24', updated: '2h ago', subtasks: '1/3', who: { i: 'DC', n: 'Daniel Cho', c: 'var(--ax-viz-emerald)' } },
  { id: 2, group: 'overdue', title: 'Migrate logging to OpenTelemetry', project: 'Platform', status: 'progress', priority: 'high', due: 'Jun 25', updated: '1d ago', subtasks: '', who: { i: 'TR', n: 'Tom Reyes', c: 'var(--ax-viz-violet)' } },
  { id: 3, group: 'overdue', title: 'Update privacy policy copy', project: 'Legal', status: 'todo', priority: 'normal', due: 'Jun 26', updated: '3d ago', subtasks: '', who: null },
  { id: 4, group: 'today', title: 'Review Q3 roadmap deck', project: 'Strategy', status: 'progress', priority: 'high', due: 'Today', updated: '25m ago', subtasks: '2/4', who: { i: 'MO', n: 'Maya Okonkwo', c: 'var(--ax-viz-cyan)' } },
  { id: 5, group: 'today', title: 'Ship onboarding A/B test', project: 'Growth', status: 'progress', priority: 'urgent', due: 'Today', updated: '1h ago', subtasks: '', who: { i: 'PN', n: 'Priya Nair', c: 'var(--ax-viz-amber)' } },
  { id: 6, group: 'today', title: 'Approve new icon set', project: 'Design system', status: 'todo', priority: 'normal', due: 'Today', updated: '4h ago', subtasks: '', who: { i: 'LB', n: 'Lena Brandt', c: 'var(--ax-viz-pink)' } },
  { id: 7, group: 'later', title: 'Draft API v2 deprecation notice', project: 'Developer rel', status: 'todo', priority: 'normal', due: 'Jul 3', updated: '2d ago', subtasks: '0/5', who: { i: 'TR', n: 'Tom Reyes', c: 'var(--ax-viz-violet)' } },
  { id: 8, group: 'later', title: 'Refactor settings store', project: 'Mobile app', status: 'todo', priority: 'low', due: 'Jul 8', updated: '5d ago', subtasks: '', who: { i: 'MO', n: 'Maya Okonkwo', c: 'var(--ax-viz-cyan)' } },
  { id: 9, group: 'later', title: 'Plan team offsite agenda', project: 'People ops', status: 'todo', priority: 'low', due: 'Jul 15', updated: '1w ago', subtasks: '', who: null },
  { id: 10, group: 'completed', title: 'Localize checkout for FR & DE', project: 'Internationalization', status: 'done', priority: 'normal', due: 'Jun 20', updated: '3d ago', subtasks: '6/6', who: { i: 'PN', n: 'Priya Nair', c: 'var(--ax-viz-amber)' } },
  { id: 11, group: 'completed', title: 'Rotate production API keys', project: 'Security', status: 'done', priority: 'high', due: 'Jun 19', updated: '4d ago', subtasks: '', who: { i: 'DC', n: 'Daniel Cho', c: 'var(--ax-viz-emerald)' } },
];

const statusLabel = (s: string) => (({ todo: 'To Do', progress: 'In Progress', blocked: 'Blocked', done: 'Done' }) as Record<string, string>)[s];
const statusTone = (s: string) => (({ todo: 'ax-badge--neutral', progress: 'ax-badge--info', blocked: 'ax-badge--danger', done: 'ax-badge--success' }) as Record<string, string>)[s];
const priorityColor = (p: string) => (({ urgent: 'var(--ax-danger-500)', high: 'var(--ax-warning-500)', normal: 'var(--ax-text-muted)', low: 'var(--ax-text-subtle)' }) as Record<string, string>)[p];
const dueStyle = (t: Task): React.CSSProperties => {
  if (t.group === 'overdue') return { color: 'var(--ax-danger-500)' };
  if (t.due === 'Today') return { color: 'var(--ax-accent)', fontWeight: 600 };
  return { color: 'var(--ax-text-muted)' };
};

export function Tasks() {
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fPriority, setFPriority] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const match = (t: Task) => {
    const term = q.trim().toLowerCase();
    if (term && !(t.title.toLowerCase().includes(term) || t.project.toLowerCase().includes(term))) return false;
    if (fStatus && t.status !== fStatus) return false;
    if (fPriority && t.priority !== fPriority) return false;
    return true;
  };
  const visible = (g: string) => TASKS.filter((t) => t.group === g && match(t));
  const shownCount = () => TASKS.filter((t) => match(t)).length;
  const allShown = () => TASKS.filter((t) => match(t)).map((t) => t.id);
  const allShownSelected = () => { const a = allShown(); return a.length > 0 && a.every((id) => selected.includes(id)); };
  const toggleAll = (on: boolean) => setSelected(on ? allShown() : []);
  const toggleOne = (id: number, on: boolean) => setSelected((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  return (
    <>
      <PageHead
        title="Tasks"
        subtitle="All work across projects — 42 open, 3 overdue."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New task</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Task list">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flex: '1 1 300px' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search tasks" />
              </div>
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter by status" style={{ minWidth: 130 }}>
                <option value="">All statuses</option>
                <option value="todo">To Do</option>
                <option value="progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
              <select className="ax-select ax-select--sm" value={fPriority} onChange={(e) => setFPriority(e.target.value)} aria-label="Filter by priority" style={{ minWidth: 130 }}>
                <option value="">All priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4 -4l4 4m-4 -4v14" /><path d="M21 15l-4 4l-4 -4m4 4v-14" /></svg>
                Sort
              </button>
            </div>
          </div>

          {(fStatus || fPriority) && (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: '0 var(--ax-space-5) var(--ax-space-3)', flexWrap: 'wrap' }}>
              {fStatus && (
                <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill">Status: <span style={{ textTransform: 'capitalize' }}>{fStatus}</span><button type="button" className="ax-badge__remove" aria-label="Clear status filter" onClick={() => setFStatus('')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
              )}
              {fPriority && (
                <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill">Priority: <span style={{ textTransform: 'capitalize' }}>{fPriority}</span><button type="button" className="ax-badge__remove" aria-label="Clear priority filter" onClick={() => setFPriority('')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
              )}
              <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => { setFStatus(''); setFPriority(''); }}>Clear all</button>
            </div>
          )}

          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: '0 var(--ax-space-5) var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Assign</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Set status</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Set priority</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Delete</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 38 }}>
                    <input type="checkbox" className="ax-checkbox" aria-label="Select all" checked={allShownSelected()} onChange={(e) => toggleAll(e.target.checked)} />
                  </th>
                  <th className="ax-table__th" scope="col">Task</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th" scope="col">Priority</th>
                  <th className="ax-table__th" scope="col">Assignee</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Due</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Updated</th>
                  <th className="ax-table__th" scope="col" style={{ width: 44 }}></th>
                </tr>
              </thead>

              {GROUPS.map((group) => {
                const rows = visible(group.id);
                if (!rows.length) return null;
                return (
                  <tbody key={group.id}>
                    <tr>
                      <td className="ax-table__td" colSpan={8} style={{ background: 'var(--ax-surface-subtle)' }}>
                        <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                          <i style={{ width: 9, height: 9, borderRadius: 3, background: group.color }} />
                          <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{group.title}</b>
                          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{rows.length}</span>
                        </span>
                      </td>
                    </tr>
                    {rows.map((t) => {
                      const isSel = selected.includes(t.id);
                      return (
                        <tr key={t.id} className={`ax-table__row${isSel ? ' is-selected' : ''}`} style={isSel ? { background: 'var(--ax-accent-wash)' } : undefined}>
                          <td className="ax-table__td">
                            <input type="checkbox" className="ax-checkbox" checked={isSel} onChange={(e) => toggleOne(t.id, e.target.checked)} aria-label={`Select ${t.title}`} />
                          </td>
                          <td className="ax-table__td">
                            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                              <input type="checkbox" className="ax-checkbox" defaultChecked={t.status === 'done'} aria-label={`Mark ${t.title} done`} />
                              <div style={{ minWidth: 0 }}>
                                <div style={t.status === 'done' ? { fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' } : { fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{t.title}</div>
                                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                                  <span>{t.project}</span>
                                  {t.subtasks && (
                                    <span className="ax-cluster ax-num" style={{ gap: 3, fontFamily: 'var(--ax-font-mono)' }}>
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></svg>
                                      <span>{t.subtasks}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="ax-table__td">
                            <span className={`ax-badge ax-badge--soft ax-badge--pill ${statusTone(t.status)}`}>
                              <span className="ax-badge__dot" /><span>{statusLabel(t.status)}</span>
                            </span>
                          </td>
                          <td className="ax-table__td">
                            <span className="ax-cluster" style={{ gap: 6, color: priorityColor(t.priority) }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15 }}><path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9" /><path d="M5 21v-7" /></svg>
                              <span style={{ fontSize: 'var(--ax-text-sm)', textTransform: 'capitalize' }}>{t.priority}</span>
                            </span>
                          </td>
                          <td className="ax-table__td">
                            {t.who ? (
                              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                                <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${t.who.c} 20%,transparent)`, color: t.who.c, fontWeight: 600, fontSize: 'var(--ax-text-2xs)' }}>{t.who.i}</span>
                                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{t.who.n}</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--ax-text-subtle)' }}>—</span>
                            )}
                          </td>
                          <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', ...dueStyle(t) }}>
                            <span>{t.due || '—'}</span>
                          </td>
                          <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{t.updated}</td>
                          <td className="ax-table__td">
                            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Actions for ${t.title}`}>
                              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>

          <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Showing <span>{shownCount()}</span> of 11 tasks</span>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous page" disabled><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">1</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next page"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Tasks;
