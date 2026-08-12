'use client';
/*
 * Vireo Next.js — Kanban board (apps/kanban).
 * Faithful re-expression of src/html/apps/kanban.html: drag-and-drop columns with
 * WIP limits, searchable cards, and a card-detail drawer (checklist + activity).
 * Alpine axKanban() → React useState + native HTML5 DnD; DOM/ARIA match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Label { t: string; c: string }
interface Who { i?: string; n: string; c?: string }
interface Card {
  id: number; key: string; col: string; cover?: string; title: string;
  labels: Label[]; due?: string; overdue?: boolean; checklist?: string;
  comments?: number; who: Who;
}

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'var(--ax-text-subtle)', wip: 0 },
  { id: 'progress', title: 'In Progress', color: 'var(--ax-viz-cyan)', wip: 4 },
  { id: 'review', title: 'Review', color: 'var(--ax-viz-violet)', wip: 3 },
  { id: 'done', title: 'Done', color: 'var(--ax-viz-emerald)', wip: 0 },
];

const SEED: Card[] = [
  { id: 1, key: 'APP-118', col: 'todo', title: 'Add biometric unlock to login', labels: [{ t: 'Auth', c: 'var(--ax-viz-violet)' }], due: 'Jul 2', overdue: false, checklist: '0/3', comments: 1, who: { i: 'MO', n: 'Maya Okonkwo', c: 'var(--ax-viz-cyan)' } },
  { id: 2, key: 'APP-121', col: 'todo', title: 'Offline mode for saved articles', labels: [{ t: 'Feature', c: 'var(--ax-viz-cyan)' }], due: '', overdue: false, checklist: '', comments: 0, who: { i: 'TR', n: 'Tom Reyes', c: 'var(--ax-viz-violet)' } },
  { id: 3, key: 'APP-124', col: 'todo', title: 'Crash on Android 13 cold start', labels: [{ t: 'Bug', c: 'var(--ax-danger-500)' }], due: 'Jun 26', overdue: true, checklist: '', comments: 4, who: { i: 'PN', n: 'Priya Nair', c: 'var(--ax-viz-amber)' } },
  { id: 4, key: 'APP-110', col: 'progress', cover: 'var(--ax-accent)', title: 'Onboarding flow — wire to auth API', labels: [{ t: 'Auth', c: 'var(--ax-viz-violet)' }, { t: 'P1', c: 'var(--ax-warning-500)' }], due: 'Jun 28', overdue: false, checklist: '3/5', comments: 6, who: { i: 'TR', n: 'Tom Reyes', c: 'var(--ax-viz-violet)' } },
  { id: 5, key: 'APP-113', col: 'progress', title: 'Push notification preferences screen', labels: [{ t: 'Feature', c: 'var(--ax-viz-cyan)' }], due: 'Jul 1', overdue: false, checklist: '2/4', comments: 2, who: { i: 'MO', n: 'Maya Okonkwo', c: 'var(--ax-viz-cyan)' } },
  { id: 6, key: 'APP-115', col: 'progress', title: 'Dark mode contrast audit', labels: [{ t: 'Design', c: 'var(--ax-viz-pink)' }], due: '', overdue: false, checklist: '', comments: 1, who: { i: 'PN', n: 'Priya Nair', c: 'var(--ax-viz-amber)' } },
  { id: 7, key: 'APP-101', col: 'review', title: 'Profile settings redesign', labels: [{ t: 'Design', c: 'var(--ax-viz-pink)' }], due: 'Jun 27', overdue: false, checklist: '4/4', comments: 3, who: { i: 'LB', n: 'Lena Brandt', c: 'var(--ax-viz-pink)' } },
  { id: 8, key: 'APP-106', col: 'review', title: 'Reduce bundle size below 4 MB', labels: [{ t: 'Perf', c: 'var(--ax-viz-amber)' }], due: '', overdue: false, checklist: '', comments: 5, who: { i: 'DC', n: 'Daniel Cho', c: 'var(--ax-viz-emerald)' } },
  { id: 9, key: 'APP-094', col: 'done', title: 'Replace deprecated map SDK', labels: [{ t: 'Tech debt', c: 'var(--ax-text-subtle)' }], due: '', overdue: false, checklist: '', comments: 0, who: { i: 'TR', n: 'Tom Reyes', c: 'var(--ax-viz-violet)' } },
  { id: 10, key: 'APP-097', col: 'done', title: 'Localize strings for FR & DE', labels: [{ t: 'i18n', c: 'var(--ax-viz-cyan)' }], due: '', overdue: false, checklist: '6/6', comments: 2, who: { i: 'PN', n: 'Priya Nair', c: 'var(--ax-viz-amber)' } },
  { id: 11, key: 'APP-099', col: 'done', title: 'Fix flaky checkout E2E test', labels: [{ t: 'Bug', c: 'var(--ax-danger-500)' }], due: '', overdue: false, checklist: '', comments: 1, who: { i: 'MO', n: 'Maya Okonkwo', c: 'var(--ax-viz-cyan)' } },
];

export function Kanban() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Card[]>(SEED);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<Card | null>(null);

  const cards = (colId: string) => {
    const t = q.trim().toLowerCase();
    return items.filter((c) => c.col === colId && (!t || c.title.toLowerCase().includes(t) || c.key.toLowerCase().includes(t)));
  };
  const dragStart = (id: number) => setDraggingId(id);
  const dragEnd = () => { setDraggingId(null); setDragOverCol(null); };
  const drop = (colId: string) => {
    setItems((prev) => prev.map((c) => (c.id === draggingId ? { ...c, col: colId } : c)));
    dragEnd();
  };
  const openEdit = (card: Card) => { setActive(card); setDrawerOpen(true); };
  const openNew = (colId: string) => { setActive({ id: -1, key: 'NEW', col: colId, title: 'New card', labels: [], who: { n: 'Unassigned' } }); setDrawerOpen(true); };

  const activeColTitle = active ? (COLUMNS.find((c) => c.id === active.col)?.title ?? '') : '';

  return (
    <>
      <PageHead
        title="Mobile App 2.0"
        subtitle="Sprint 14 board — 18 cards across 4 columns, 2 due this week."
        actions={
          <>
            <div className="ax-avatar-group" aria-label="Board members">
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 20%,transparent)', color: 'var(--ax-viz-cyan)', fontWeight: 600 }} title="Maya Okonkwo">MO</span>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 20%,transparent)', color: 'var(--ax-viz-violet)', fontWeight: 600 }} title="Tom Reyes">TR</span>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 20%,transparent)', color: 'var(--ax-viz-amber)', fontWeight: 600 }} title="Priya Nair">PN</span>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle ax-avatar__overflow" style={{ fontWeight: 600 }}>+4</span>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227" /></svg>
              <span className="ax-btn__label">Filter</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => openNew('todo')}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add card</span>
            </button>
          </>
        }
      />

      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-5)', gap: 'var(--ax-space-3)' }}>
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flex: '1 1 320px' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
            <input type="search" className="ax-input" placeholder="Search cards…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search cards" />
          </div>
        </div>
        <div className="ax-segment" role="radiogroup" aria-label="Board view">
          <button type="button" className="ax-segment__option is-active" role="radio" aria-checked="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4l6 0" /><path d="M14 4l6 0" /><path d="M4 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -8" /><path d="M14 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2" /></svg>
            Board
          </button>
          <button type="button" className="ax-segment__option" role="radio" aria-checked="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
            List
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--ax-space-5)', overflowX: 'auto', paddingBottom: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
        {COLUMNS.map((col) => {
          const list = cards(col.id);
          return (
            <section
              key={col.id}
              className={`ax-kb-col${dragOverCol === col.id ? ' ax-kb-col--over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
              onDragLeave={() => { if (dragOverCol === col.id) setDragOverCol(null); }}
              onDrop={() => drop(col.id)}
              role="region"
              aria-label={`${col.title} column`}
            >
              <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-1) var(--ax-space-1) var(--ax-space-3)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <i style={{ width: 9, height: 9, borderRadius: 3, background: col.color }} />
                  <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{col.title}</b>
                  <span className="ax-badge ax-badge--neutral ax-badge--pill ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{list.length}</span>
                  {!!col.wip && (
                    <span className={`ax-badge ax-badge--pill ax-num ${list.length >= col.wip ? 'ax-badge--danger ax-badge--soft' : 'ax-badge--warning ax-badge--soft'}`} style={{ fontFamily: 'var(--ax-font-mono)' }} title={`Work-in-progress limit ${col.wip}`}>WIP {list.length}/{col.wip}</span>
                  )}
                </div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Add card to ${col.title}`} onClick={() => openNew(col.id)}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                </button>
              </div>

              <div className="ax-kb-col__body">
                {list.map((card) => (
                  <article
                    key={card.id}
                    className={`ax-kb-card${draggingId === card.id ? ' ax-kb-card--ghost' : ''}`}
                    draggable
                    onDragStart={() => dragStart(card.id)}
                    onDragEnd={dragEnd}
                    onClick={() => openEdit(card)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') openEdit(card); }}
                    role="button"
                    aria-label={card.title}
                  >
                    {card.cover && <span className="ax-kb-card__cover" style={{ background: card.cover }} aria-hidden="true" />}
                    {!!card.labels.length && (
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', flexWrap: 'wrap' }}>
                        {card.labels.map((lb) => (
                          <span key={lb.t} className="ax-badge ax-badge--soft ax-badge--sm ax-badge--pill" style={{ color: lb.c, background: `color-mix(in oklab,${lb.c} 16%,transparent)` }}>{lb.t}</span>
                        ))}
                      </div>
                    )}
                    <p className="ax-kb-card__title">{card.title}</p>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', color: 'var(--ax-text-subtle)' }}>
                        {card.due && (
                          <span className="ax-cluster ax-num" style={{ gap: 4, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: card.overdue ? 'var(--ax-danger-500)' : 'var(--ax-text-muted)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 14, height: 14 }}><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
                            <span>{card.due}</span>
                          </span>
                        )}
                        {card.checklist && (
                          <span className="ax-cluster ax-num" style={{ gap: 4, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 14, height: 14 }}><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></svg>
                            <span>{card.checklist}</span>
                          </span>
                        )}
                        {!!card.comments && (
                          <span className="ax-cluster ax-num" style={{ gap: 4, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 14, height: 14 }}><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg>
                            <span>{card.comments}</span>
                          </span>
                        )}
                      </div>
                      <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${card.who.c} 20%,transparent)`, color: card.who.c, fontWeight: 600, fontSize: 'var(--ax-text-2xs)' }} title={card.who.n}>{card.who.i}</span>
                    </div>
                  </article>
                ))}

                <button type="button" className="ax-kb-add" onClick={() => openNew(col.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                  Add card
                </button>
              </div>
            </section>
          );
        })}

        <button type="button" className="ax-kb-addcol">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
          Add column
        </button>
      </div>

      {drawerOpen && active && (
        <div className="ax-drawer-scrim" onClick={() => setDrawerOpen(false)}>
          <div className="ax-card ax-slide-in" role="dialog" aria-modal="true" aria-label="Card detail" onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,100%)', height: '100%', borderRadius: 0, overflow: 'auto' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">{activeColTitle} · {active.key}</span>
                <h2 className="ax-card__title">{active.title}</h2>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close" onClick={() => setDrawerOpen(false)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <div className="ax-card__body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--ax-space-6)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill">
                    <svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
                    <span>{active.who.n}</span>
                  </span>
                  {active.due && (
                    <span className={`ax-badge ax-badge--soft ax-badge--pill ${active.overdue ? 'ax-badge--danger' : 'ax-badge--neutral'}`}>
                      <svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
                      <span className="ax-num">Due {active.due}</span>
                    </span>
                  )}
                  <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">3 points</span>
                </div>

                <div>
                  <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-2)' }}>Description</small>
                  <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Wire the new onboarding flow to the auth API and add inline validation for the email and OTP steps. Mirror the empty / error / success states from the design spec, and confirm the deep-link handoff works from the marketing site.</p>
                </div>

                <div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                    <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Checklist</small>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>3/5</span>
                  </div>
                  <div className="ax-progress ax-progress--sm" style={{ marginBottom: 'var(--ax-space-3)' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '60%' }} /></div></div>
                  <ul className="ax-list ax-list--compact">
                    <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" defaultChecked /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>Hook up email step to API</span></span></li>
                    <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" defaultChecked /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>OTP resend timer</span></span></li>
                    <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" defaultChecked /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>Inline validation copy</span></span></li>
                    <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)' }}>Deep-link handoff test</span></span></li>
                    <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)' }}>Empty / error states</span></span></li>
                  </ul>
                  <div style={{ position: 'relative', marginTop: 'var(--ax-space-3)' }}>
                    <input type="text" className="ax-input ax-input--sm" placeholder="Add an item…" aria-label="Add checklist item" />
                  </div>
                </div>

                <div>
                  <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-3)' }}>Activity</small>
                  <ul className="ax-timeline">
                    <li className="ax-timeline__item ax-timeline__item--success">
                      <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                      <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Tom Reyes</b> checked off OTP resend timer</p><span className="ax-timeline__time">2h ago</span></div>
                    </li>
                    <li className="ax-timeline__item">
                      <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg></span>
                      <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya Nair</b> commented &quot;Don&apos;t forget the resend rate limit.&quot;</p><span className="ax-timeline__time">5h ago</span></div>
                    </li>
                  </ul>
                  <div style={{ marginTop: 'var(--ax-space-3)' }}>
                    <textarea className="ax-textarea" rows={2} placeholder="Write a comment…" aria-label="Add comment" />
                  </div>
                </div>
              </div>
            </div>
            <div className="ax-card__footer" style={{ display: 'flex', gap: 'var(--ax-space-3)', justifyContent: 'flex-end' }}>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setDrawerOpen(false)}>Close</button>
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => setDrawerOpen(false)}>Save changes</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .ax-drawer-scrim { position:fixed; inset:0; z-index:120; display:flex; justify-content:flex-end; background:var(--ax-backdrop); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); }
        .ax-kb-col { flex:0 0 300px; width:300px; display:flex; flex-direction:column; background:var(--ax-surface-subtle); border:1px solid var(--ax-border); border-radius:var(--ax-radius-lg); padding:var(--ax-space-3); transition:background var(--ax-motion-fast) var(--ax-ease-standard), box-shadow var(--ax-motion-fast) var(--ax-ease-standard); }
        .ax-kb-col--over { background:var(--ax-accent-wash); box-shadow:inset 0 0 0 2px var(--ax-accent); }
        .ax-kb-col__body { display:flex; flex-direction:column; gap:var(--ax-space-3); min-height:40px; }
        .ax-kb-card { position:relative; display:flex; flex-direction:column; gap:var(--ax-space-2); padding:var(--ax-space-3); background:var(--ax-surface-solid); border:1px solid var(--ax-border); border-radius:var(--ax-radius-md); box-shadow:var(--ax-shadow-sm); cursor:grab; text-align:left; transition:box-shadow var(--ax-motion-fast) var(--ax-ease-standard), transform var(--ax-motion-fast) var(--ax-ease-standard); overflow:hidden; }
        .ax-kb-card:hover { box-shadow:var(--ax-shadow-md); }
        .ax-kb-card:focus-visible { outline:none; box-shadow:0 0 0 2px var(--ax-canvas), 0 0 0 4px var(--ax-focus-ring); }
        .ax-kb-card:active { cursor:grabbing; }
        .ax-kb-card--ghost { opacity:.4; }
        .ax-kb-card__cover { display:block; height:6px; margin:calc(var(--ax-space-3) * -1) calc(var(--ax-space-3) * -1) 0; }
        .ax-kb-card__title { color:var(--ax-text-strong); font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); line-height:1.4; }
        .ax-kb-add { display:inline-flex; align-items:center; gap:var(--ax-space-2); width:100%; padding:var(--ax-space-2) var(--ax-space-3); font-size:var(--ax-text-sm); color:var(--ax-text-muted); background:transparent; border:1px dashed var(--ax-border-strong); border-radius:var(--ax-radius-md); cursor:pointer; transition:color var(--ax-motion-fast), background var(--ax-motion-fast); }
        .ax-kb-add:hover { color:var(--ax-accent); background:var(--ax-fill-hover); }
        .ax-kb-addcol { flex:0 0 220px; display:inline-flex; align-items:center; justify-content:center; gap:var(--ax-space-2); align-self:stretch; min-height:120px; font-size:var(--ax-text-sm); color:var(--ax-text-muted); background:var(--ax-surface-subtle); border:1px dashed var(--ax-border-strong); border-radius:var(--ax-radius-lg); cursor:pointer; transition:color var(--ax-motion-fast), background var(--ax-motion-fast); }
        .ax-kb-addcol:hover { color:var(--ax-accent); background:var(--ax-fill-hover); }
        .ax-slide-in { animation:axSlideIn .18s var(--ax-ease-standard); }
        @keyframes axSlideIn { from { transform:translateX(24px); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @media (prefers-reduced-motion: reduce){ .ax-kb-card, .ax-slide-in { transition:none; animation:none; } }
      `}</style>
    </>
  );
}

export default Kanban;
