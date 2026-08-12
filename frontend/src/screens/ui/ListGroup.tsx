'use client';
/*
 * Vireo Next.js — UI · List Groups (route "ui/list-group").
 *
 * Faithful re-expression of src/html/ui/list-group.html: bordered list with
 * badges, count-badge inbox folders, flush grouped directory, an actionable
 * task list (Alpine tasks[] → useState, checkbox + remove) and a selectable
 * currency list (roving single-select). DOM classes / ARIA / copy match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const TRASH = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
);

interface Task { id: number; t: string; m: string; done: boolean; }
const INITIAL_TASKS: Task[] = [
  { id: 1, t: 'Review empty-state illustrations', m: 'Design · Lena Brandt', done: true },
  { id: 2, t: 'Ship invoice export to CSV', m: 'Finance · Jonas Falk', done: false },
  { id: 3, t: 'Patch sidebar focus trap', m: 'Engineering · Devon Okafor', done: false },
  { id: 4, t: 'Draft Q3 customer digest', m: 'Marketing · Hana Yılmaz', done: false },
];

const CURRENCIES = [
  { code: 'USD', viz: 'emerald', sym: '$', name: 'US Dollar', sub: 'USD · Primary', total: '$48,210.00' },
  { code: 'GBP', viz: 'cyan', sym: '£', name: 'British Pound', sub: 'GBP · Secondary', total: '£21,540.00' },
  { code: 'EUR', viz: 'violet', sym: '€', name: 'Euro', sub: 'EUR · Secondary', total: '€33,120.00' },
  { code: 'AUD', viz: 'amber', sym: 'A$', name: 'Australian Dollar', sub: 'AUD · Secondary', total: 'A$15,980.00' },
];

export function ListGroup() {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [sel, setSel] = useState('USD');
  const toggle = (id: number) => setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: number) => setTasks((cur) => cur.filter((t) => t.id !== id));
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <>
      <PageHead
        title="List Groups"
        subtitle="Hairline-separated rows — bordered, flush, with badges, linked and actionable with controls."
        actions={
          <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/pagination">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h6" /><path d="M14 6h6" /><path d="M4 12h6" /><path d="M14 12h6" /><path d="M4 18h6" /><path d="M14 18h6" /></svg>
            <span className="ax-btn__label">Pagination</span>
          </a>
        }
      />

      <div className="ax-dash-grid">
        {/* BORDERED + WITH BADGES */}
        <section className="ax-card ax-col--6" role="region" aria-label="Bordered list with badges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Bordered · badges</span>
              <h2 className="ax-card__title">Project statuses</h2>
              <p className="ax-card__subtitle">Trailing badges carry the state of each row.</p>
            </div>
          </div>
          <ul className="ax-list" style={{ borderTop: '1px solid var(--ax-border)' }}>
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}>BR</span></span>
              <span className="ax-list__content"><span className="ax-list__title">Brightway Retail rollout</span><span className="ax-list__meta">Due in 4 days · Marcus Reyes</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success"><span className="ax-badge__dot" />On track</span></span>
            </li>
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}>CC</span></span>
              <span className="ax-list__content"><span className="ax-list__title">Cedar &amp; Co. onboarding</span><span className="ax-list__meta">Due tomorrow · Lena Brandt</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--warning"><span className="ax-badge__dot" />At risk</span></span>
            </li>
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}>MH</span></span>
              <span className="ax-list__content"><span className="ax-list__title">Meridian Health migration</span><span className="ax-list__meta">Overdue 2 days · Devon Okafor</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--danger"><span className="ax-badge__dot" />Blocked</span></span>
            </li>
            <li className="ax-list__row">
              <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}>TS</span></span>
              <span className="ax-list__content"><span className="ax-list__title">Tidepool Studios refresh</span><span className="ax-list__meta">Shipped Jun 8 · Hana Yılmaz</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--neutral">Done</span></span>
            </li>
          </ul>
        </section>

        {/* WITH COUNT BADGES */}
        <section className="ax-card ax-col--6" role="region" aria-label="List with count badges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Count badges · linked</span>
              <h2 className="ax-card__title">Inbox folders</h2>
              <p className="ax-card__subtitle">Linked rows highlight on hover; counts sit in pill badges.</p>
            </div>
          </div>
          <ul className="ax-list ax-list--linked" style={{ borderTop: '1px solid var(--ax-border)' }}>
            <li><a className="ax-list__row is-active" href="#" aria-current="page">
              <span className="ax-list__leading" style={{ color: 'var(--ax-accent)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-accent)' }}>Inbox</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill ax-num">24</span></span>
            </a></li>
            <li><a className="ax-list__row" href="#">
              <span className="ax-list__leading"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9 6l9 -6l-9 -6z" /><path d="M21 9v6a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-6" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title">Starred</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num">6</span></span>
            </a></li>
            <li><a className="ax-list__row" href="#">
              <span className="ax-list__leading"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7l9 6l9 -6" /><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2 -2v-10" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title">Sent</span></span>
            </a></li>
            <li><a className="ax-list__row" href="#">
              <span className="ax-list__leading"><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title">Drafts</span></span>
              <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num">2</span></span>
            </a></li>
            <li><a className="ax-list__row" href="#">
              <span className="ax-list__leading" style={{ color: 'var(--ax-danger-500)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title">Trash</span></span>
            </a></li>
          </ul>
        </section>

        {/* FLUSH + GROUPED */}
        <section className="ax-card ax-col--6" role="region" aria-label="Flush grouped list">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Flush · grouped</span>
              <h2 className="ax-card__title">Team directory</h2>
              <p className="ax-card__subtitle">Section labels separate the roster; rows run edge to edge.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingBlock: 0 }}>
            <ul className="ax-list">
              <li className="ax-list__group-label" role="presentation" style={{ paddingInline: 0 }}>Leadership</li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>AS</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Ava Sutton</span><span className="ax-list__meta">Operations Lead</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success"><span className="ax-badge__dot" />Online</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}>TH</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Tomás Herrera</span><span className="ax-list__meta">Sales Director</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--danger"><span className="ax-badge__dot" />Busy</span></span>
              </li>
              <li className="ax-list__group-label" role="presentation" style={{ paddingInline: 0 }}>Engineering</li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}>MR</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Marcus Reyes</span><span className="ax-list__meta">Engineering Manager</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success"><span className="ax-badge__dot" />Online</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}>DO</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Devon Okafor</span><span className="ax-list__meta">Backend Engineer</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--warning"><span className="ax-badge__dot" />Away</span></span>
              </li>
            </ul>
          </div>
        </section>

        {/* ACTIONABLE */}
        <section className="ax-card ax-col--6" role="region" aria-label="Actionable task list">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Actionable · controls</span>
              <h2 className="ax-card__title">Today's tasks</h2>
              <p className="ax-card__subtitle"><span className="ax-num">{doneCount}</span> of <span className="ax-num">{tasks.length}</span> complete</p>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add</span>
            </button>
          </div>
          <ul className="ax-list ax-list--actionable" style={{ borderTop: '1px solid var(--ax-border)' }}>
            {tasks.map((task) => (
              <li key={task.id} className="ax-list__row">
                <span className="ax-list__leading">
                  <input type="checkbox" className="ax-checkbox" checked={task.done} onChange={() => toggle(task.id)} aria-label={`Mark ${task.t} complete`} />
                </span>
                <span className="ax-list__content">
                  <span className="ax-list__title" style={task.done ? { textDecoration: 'line-through', color: 'var(--ax-text-subtle)' } : undefined}>{task.t}</span>
                  <span className="ax-list__meta">{task.m}</span>
                </span>
                <span className="ax-list__trailing">
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Edit ${task.t}`}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>
                  </button>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => remove(task.id)} aria-label={`Remove ${task.t}`}>
                    {TRASH}
                  </button>
                </span>
              </li>
            ))}
            {tasks.length === 0 && (
              <li className="ax-list__row" style={{ justifyContent: 'center', color: 'var(--ax-text-subtle)' }}>All clear — no tasks left.</li>
            )}
          </ul>
        </section>

        {/* SELECTABLE */}
        <section className="ax-card ax-col--12" role="region" aria-label="Selectable currency list">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Selectable · trailing meta</span>
              <h2 className="ax-card__title">Account balances</h2>
              <p className="ax-card__subtitle">Click a row to select it; the active currency is accent-washed.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--selectable" style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden' }}>
              {CURRENCIES.map((c) => (
                <li
                  key={c.code}
                  className={`ax-list__row${sel === c.code ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-selected={sel === c.code}
                  onClick={() => setSel(c.code)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setSel(c.code); } else if (e.key === ' ') { e.preventDefault(); setSel(c.code); } }}
                >
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,var(--ax-viz-${c.viz}) 18%,transparent)`, color: `var(--ax-viz-${c.viz})`, fontFamily: 'var(--ax-font-mono)' }}>{c.sym}</span></span>
                  <span className="ax-list__content"><span className="ax-list__title">{c.name}</span><span className="ax-list__meta">{c.sub}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{c.total}</span>
                </li>
              ))}
            </ul>
            <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Selected: <b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>{sel}</b></p>
          </div>
        </section>
      </div>
    </>
  );
}

export default ListGroup;
