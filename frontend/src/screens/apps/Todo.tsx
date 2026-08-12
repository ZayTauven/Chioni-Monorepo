'use client';
/*
 * Vireo Next.js — To-Do app (apps/todo).
 * Faithful re-expression of src/html/apps/todo.html: smart-views rail + lists +
 * progress, task list with add/complete/important/delete and filter segment.
 * Alpine axTodo() → React useState; DOM classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Task {
  id: number; title: string; list: string; done: boolean; important: boolean;
  due: string; today?: boolean; overdue?: boolean; subtasks: string;
}

const VIEWS = [
  { id: 'today', label: 'Today', color: 'var(--ax-accent)', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /><path d="M8 15h2v2h-2l0 -2" /></svg>
  ) },
  { id: 'upcoming', label: 'Upcoming', color: 'var(--ax-viz-cyan)', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
  ) },
  { id: 'important', label: 'Important', color: 'var(--ax-warning-500)', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
  ) },
  { id: 'completed', label: 'Completed', color: 'var(--ax-viz-emerald)', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
  ) },
];

const LISTS = [
  { id: 'work', label: 'Work', color: 'var(--ax-viz-violet)' },
  { id: 'personal', label: 'Personal', color: 'var(--ax-viz-cyan)' },
  { id: 'shopping', label: 'Shopping', color: 'var(--ax-viz-pink)' },
];

const SEED: Task[] = [
  { id: 1, title: 'Reply to investor update thread', list: 'work', done: false, important: true, due: 'Today', today: true, subtasks: '' },
  { id: 2, title: 'Finalize Q3 OKRs draft', list: 'work', done: false, important: false, due: 'Today', today: true, subtasks: '1/3' },
  { id: 3, title: 'Book flights for the offsite', list: 'personal', done: false, important: false, due: 'Jun 26', overdue: true, subtasks: '' },
  { id: 4, title: 'Renew gym membership', list: 'personal', done: false, important: false, due: 'Jul 1', subtasks: '' },
  { id: 5, title: 'Pick up dry cleaning', list: 'shopping', done: true, important: false, due: '', subtasks: '' },
  { id: 6, title: 'Buy oat milk and coffee beans', list: 'shopping', done: false, important: false, due: 'Today', today: true, subtasks: '' },
  { id: 7, title: 'Review pull request #482', list: 'work', done: false, important: true, due: 'Jun 28', subtasks: '' },
  { id: 8, title: 'Schedule dentist appointment', list: 'personal', done: true, important: false, due: '', subtasks: '' },
  { id: 9, title: 'Outline blog post on Aurora design', list: 'work', done: false, important: false, due: 'Jul 4', subtasks: '0/4' },
];

export function Todo() {
  const [items, setItems] = useState<Task[]>(SEED);
  const [view, setView] = useState('today');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [draft, setDraft] = useState('');
  const [nextId, setNextId] = useState(100);

  const inView = (t: Task) => {
    if (view === 'today') return t.today || t.overdue;
    if (view === 'upcoming') return !t.today && !t.overdue && !t.done && t.due;
    if (view === 'important') return t.important;
    if (view === 'completed') return t.done;
    return t.list === view;
  };
  const shown = () => items.filter((t) => inView(t) && (filter === 'all' || (filter === 'done' ? t.done : !t.done)));
  const countFor = (id: string) => {
    const f = (fn: (t: Task) => boolean) => items.filter(fn).length;
    if (id === 'today') return f((t) => (!!t.today || !!t.overdue) && !t.done);
    if (id === 'upcoming') return f((t) => !t.today && !t.overdue && !t.done && !!t.due);
    if (id === 'important') return f((t) => t.important && !t.done);
    if (id === 'completed') return f((t) => t.done);
    return f((t) => t.list === id && !t.done);
  };
  const activeInView = () => items.filter((t) => inView(t) && !t.done).length;
  const activeCount = () => items.filter((t) => !t.done).length;
  const doneCount = () => items.filter((t) => t.done).length;
  const pct = () => (items.length ? Math.round((doneCount() / items.length) * 100) : 0);
  const listLabel = (id: string) => LISTS.find((x) => x.id === id)?.label ?? id;
  const listColor = (id: string) => LISTS.find((x) => x.id === id)?.color ?? 'var(--ax-text-subtle)';
  const viewLabel = () => (VIEWS.find((x) => x.id === view) || LISTS.find((x) => x.id === view))?.label ?? '';

  const add = () => {
    const v = draft.trim(); if (!v) return;
    const list = LISTS.find((l) => l.id === view) ? view : 'work';
    setItems((prev) => [{ id: nextId, title: v, list, done: false, important: view === 'important', due: view === 'today' ? 'Today' : '', today: view === 'today', subtasks: '' }, ...prev]);
    setNextId((n) => n + 1);
    setDraft('');
  };
  const toggleDone = (id: number) => setItems((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const toggleImportant = (id: number) => setItems((p) => p.map((t) => (t.id === id ? { ...t, important: !t.important } : t)));
  const remove = (id: number) => setItems((p) => p.filter((t) => t.id !== id));

  const list = shown();

  return (
    <>
      <PageHead
        title="To-Do"
        subtitle={`Stay on top of today — ${activeCount()} tasks left, ${doneCount()} done.`}
        actions={
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4 -4l4 4m-4 -4v14" /><path d="M21 15l-4 4l-4 -4m4 4v-14" /></svg>
            <span className="ax-btn__label">Sort</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        <aside className="ax-card ax-col--3" role="region" aria-label="Lists and views">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <ul className="ax-list ax-list--compact">
              {VIEWS.map((v) => (
                <li key={v.id} className={`ax-list__row${view === v.id ? ' is-selected' : ''}`} onClick={() => setView(v.id)} style={{ cursor: 'pointer', border: 0, borderRadius: 'var(--ax-radius-md)', paddingInline: 'var(--ax-space-3)' }} aria-selected={view === v.id}>
                  <span className="ax-list__leading" style={{ color: v.color }}>{v.icon}</span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{v.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{countFor(v.id)}</span>
                </li>
              ))}
            </ul>

            <hr style={{ margin: 0, border: 0, borderTop: '1px solid var(--ax-border)' }} />

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase' }}>My lists</small>
              </div>
              <ul className="ax-list ax-list--compact">
                {LISTS.map((l) => (
                  <li key={l.id} className={`ax-list__row${view === l.id ? ' is-selected' : ''}`} onClick={() => setView(l.id)} style={{ cursor: 'pointer', border: 0, borderRadius: 'var(--ax-radius-md)', paddingInline: 'var(--ax-space-3)' }} aria-selected={view === l.id}>
                    <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} /></span>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{l.label}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{countFor(l.id)}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start', marginTop: 'var(--ax-space-2)', color: 'var(--ax-text-muted)' }}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">New list</span>
              </button>
            </div>

            <hr style={{ margin: 0, border: 0, borderTop: '1px solid var(--ax-border)' }} />

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Today&apos;s progress</small>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{pct()}%</b>
              </div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${pct()}%` }} /></div></div>
            </div>
          </div>
        </aside>

        <section className="ax-card ax-col--9" role="region" aria-label="Task list">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">{viewLabel()}</h2>
              <p className="ax-card__subtitle"><span className="ax-num">{activeInView()}</span> remaining</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-segment" role="radiogroup" aria-label="Filter tasks">
                {(['all', 'active', 'done'] as const).map((f) => (
                  <button key={f} type="button" className={`ax-segment__option${filter === f ? ' is-active' : ''}`} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Done'}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ position: 'relative', marginBottom: 'var(--ax-space-4)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-accent)' }}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <input type="text" className="ax-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task and press Enter…" style={{ paddingInlineStart: 38 }} aria-label="Add a task" />
            </form>

            {!list.length && (
              <div style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)' }}>
                <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', margin: '0 auto var(--ax-space-4)' }}>
                  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                </span>
                <p style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>All clear here</p>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Add a task above to get started.</p>
              </div>
            )}

            {!!list.length && (
              <ul className="ax-list">
                {list.map((t) => (
                  <li key={t.id} className="ax-list__row ax-todo-row" style={t.done ? { opacity: 0.62 } : undefined}>
                    <span className="ax-list__leading">
                      <input type="checkbox" className="ax-checkbox" checked={t.done} onChange={() => toggleDone(t.id)} aria-label={`Complete ${t.title}`} />
                    </span>
                    <span className="ax-list__content">
                      <span className="ax-list__title" style={t.done ? { color: 'var(--ax-text-subtle)', textDecoration: 'line-through', fontWeight: 'var(--ax-weight-regular)' } : undefined}>{t.title}</span>
                      <span className="ax-list__meta ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)' }}>
                        <span className="ax-cluster" style={{ gap: 4 }}><i style={{ width: 7, height: 7, borderRadius: 2, background: listColor(t.list) }} /><span>{listLabel(t.list)}</span></span>
                        {t.due && (
                          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: t.overdue ? 'var(--ax-danger-500)' : t.today ? 'var(--ax-accent)' : 'var(--ax-text-subtle)' }}>{t.due}</span>
                        )}
                        {t.subtasks && (
                          <span className="ax-num ax-cluster" style={{ gap: 3, fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></svg>
                            <span>{t.subtasks}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="ax-list__trailing">
                      <button type="button" className="ax-icon-btn" style={{ color: t.important ? 'var(--ax-warning-500)' : 'var(--ax-text-subtle)' }} onClick={() => toggleImportant(t.id)} aria-label={t.important ? 'Remove from Important' : 'Mark Important'} aria-pressed={t.important}>
                        <svg viewBox="0 0 24 24" fill={t.important ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
                      </button>
                      <button type="button" className="ax-icon-btn" style={{ color: 'var(--ax-text-subtle)' }} onClick={() => remove(t.id)} aria-label={`Delete ${t.title}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 17, height: 17 }}><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <style>{`
        .ax-todo-row { transition:opacity var(--ax-motion-base) var(--ax-ease-standard); }
        .ax-todo-row .ax-list__trailing .ax-icon-btn { opacity:0; }
        .ax-todo-row:hover .ax-list__trailing .ax-icon-btn,
        .ax-todo-row .ax-list__trailing .ax-icon-btn[aria-pressed="true"] { opacity:1; }
        .ax-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:0; background:transparent; border-radius:var(--ax-radius-sm); cursor:pointer; transition:background var(--ax-motion-fast), opacity var(--ax-motion-fast); }
        .ax-icon-btn:hover { background:var(--ax-fill-hover); }
        .ax-icon-btn:focus-visible { outline:none; opacity:1; box-shadow:0 0 0 2px var(--ax-canvas), 0 0 0 4px var(--ax-focus-ring); }
        @media (prefers-reduced-motion: reduce){ .ax-todo-row { transition:none; } }
      `}</style>
    </>
  );
}

export default Todo;
