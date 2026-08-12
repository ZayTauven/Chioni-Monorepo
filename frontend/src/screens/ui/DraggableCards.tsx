'use client';
/*
 * Vireo Next.js — UI · Draggable Cards (route "ui/draggable-cards").
 *
 * Faithful re-expression of src/html/ui/draggable-cards.html: a 4-column
 * drag-and-drop board (move cards within a column or across columns, drop
 * targets glow with the accent, add-card + reset). The page-local Alpine
 * axBoard() component (columns/lists/drag state, onStart/onDrop/reset/addCard)
 * is re-implemented with React state and the native HTML Drag-and-Drop API.
 * DOM classes / ARIA / copy / seed data match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Column { key: string; title: string; tone: string; }
interface Card {
  id: number; ref: string; tag: string; tagTone: string;
  title: string; desc: string; initials: string; avTone: string; due: string;
}
type Lists = Record<string, Card[]>;

const COLUMNS: Column[] = [
  { key: 'backlog', title: 'Backlog', tone: 'var(--ax-viz-violet)' },
  { key: 'progress', title: 'In progress', tone: 'var(--ax-viz-cyan)' },
  { key: 'review', title: 'In review', tone: 'var(--ax-viz-amber)' },
  { key: 'done', title: 'Done', tone: 'var(--ax-viz-emerald)' },
];

const SEED_LISTS: Lists = {
  backlog: [
    { id: 1, ref: 'TSK-241', tag: 'Feature', tagTone: 'accent', title: 'Add coverflow effect to Swiper', desc: 'Stacked-cards transition driven by CSS transforms and Alpine state.', initials: 'LB', avTone: 'var(--ax-viz-violet)', due: 'Jul 4' },
    { id: 2, ref: 'TSK-238', tag: 'Design', tagTone: 'info', title: 'Empty-state illustrations', desc: 'Cohesive set for tables, search and inbox zero.', initials: 'LB', avTone: 'var(--ax-viz-pink)', due: 'Jul 6' },
    { id: 3, ref: 'TSK-235', tag: 'Chore', tagTone: 'warning', title: 'Audit dark-mode chart legends', desc: 'Verify legend contrast across all 12 accents.', initials: 'PN', avTone: 'var(--ax-viz-cyan)', due: 'Jul 9' },
  ],
  progress: [
    { id: 4, ref: 'TSK-230', tag: 'Feature', tagTone: 'accent', title: 'Customizer accent presets', desc: 'Wire the 12 Aurora presets to the live ChangeBus.', initials: 'DO', avTone: 'var(--ax-viz-emerald)', due: 'Jun 30' },
    { id: 5, ref: 'TSK-229', tag: 'Bug', tagTone: 'danger', title: 'Editable table validation', desc: 'Block save on invalid cells; scroll first error into view.', initials: 'MR', avTone: 'var(--ax-viz-violet)', due: 'Jun 29' },
  ],
  review: [
    { id: 6, ref: 'TSK-224', tag: 'Feature', tagTone: 'accent', title: 'Vector map region select', desc: 'Click-to-select with accent fill and mono tooltip.', initials: 'DO', avTone: 'var(--ax-viz-cyan)', due: 'Jun 28' },
  ],
  done: [
    { id: 7, ref: 'TSK-218', tag: 'Feature', tagTone: 'success', title: 'Sales dashboard flagship', desc: 'Hero area chart, balance plate and recent activity feed.', initials: 'AS', avTone: 'var(--ax-viz-emerald)', due: 'Jun 24' },
    { id: 8, ref: 'TSK-214', tag: 'Chore', tagTone: 'success', title: 'Token-only colour pass', desc: 'Replace every literal colour with a role token.', initials: 'JF', avTone: 'var(--ax-viz-amber)', due: 'Jun 22' },
  ],
};

const clone = (l: Lists): Lists => JSON.parse(JSON.stringify(l));

const GRIP = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
);

export function DraggableCards() {
  const [lists, setLists] = useState<Lists>(() => clone(SEED_LISTS));
  const [drag, setDrag] = useState<{ col: string | null; idx: number | null }>({ col: null, idx: null });
  const [overCol, setOverCol] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [nextId, setNextId] = useState(100);

  const clear = () => { setDrag({ col: null, idx: null }); setOverCol(null); setOverIdx(null); };

  const onStart = (col: string, idx: number, e: React.DragEvent) => {
    setDrag({ col, idx });
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', `${col}:${idx}`); } catch { /* noop */ }
    }
  };
  const onColOver = (col: string) => { setOverCol(col); setOverIdx(lists[col].length); };
  const onCardOver = (col: string, idx: number) => { setOverCol(col); setOverIdx(idx); };
  const onDrop = (col: string, idx: number) => {
    if (drag.col === null || drag.idx === null) { clear(); return; }
    setLists((cur) => {
      const nextLists = clone(cur);
      const card = nextLists[drag.col as string].splice(drag.idx as number, 1)[0];
      let target = idx;
      if (drag.col === col && (drag.idx as number) < idx) target = idx - 1;
      if (target < 0) target = 0;
      if (target > nextLists[col].length) target = nextLists[col].length;
      nextLists[col].splice(target, 0, card);
      return nextLists;
    });
    clear();
  };
  const addCard = (col: string) => {
    setLists((cur) => {
      const nextLists = clone(cur);
      nextLists[col].unshift({ id: nextId, ref: `TSK-${300 + nextId}`, tag: 'New', tagTone: 'accent', title: 'New card', desc: 'Drag me to another column or reorder within this one.', initials: 'AX', avTone: 'var(--ax-accent)', due: 'Soon' });
      return nextLists;
    });
    setNextId((n) => n + 1);
  };
  const reset = () => { setLists(clone(SEED_LISTS)); clear(); };

  return (
    <>
      <PageHead
        title="Draggable Cards"
        subtitle="A drag-and-drop board — move cards within a column or across columns. Drop targets glow with the accent. Pure Alpine."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={reset}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
              <span className="ax-btn__label">Reset board</span>
            </button>
            <Link className="ax-btn ax-btn--secondary" href="/ui/sortable">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 0" /><path d="M9 12l6 0" /><path d="M9 18l6 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
              <span className="ax-btn__label">Sortable lists</span>
            </Link>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--ax-space-5)', alignItems: 'start' }}>
        {COLUMNS.map((col) => (
          <section
            key={col.key}
            className="ax-card"
            role="region"
            aria-label={`${col.title} column`}
            onDragOver={(e) => { e.preventDefault(); onColOver(col.key); }}
            onDrop={(e) => { e.preventDefault(); onDrop(col.key, lists[col.key].length); }}
          >
            <div className="ax-card__header">
              <div className="ax-card__titles" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: col.tone }} aria-hidden="true" />
                <h2 className="ax-card__title" style={{ margin: 0 }}>{col.title}</h2>
                <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">{lists[col.key].length}</span>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => addCard(col.key)} aria-label={`Add card to ${col.title}`}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              </button>
            </div>
            <div
              className="ax-card__body"
              style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', minHeight: '120px', borderRadius: 'var(--ax-radius-md)', transition: 'background var(--ax-motion-fast)', background: overCol === col.key && drag.col !== null ? 'var(--ax-accent-wash)' : 'transparent' }}
            >
              {lists[col.key].map((card, idx) => {
                const isDragged = drag.col === col.key && drag.idx === idx;
                const isOver = overCol === col.key && overIdx === idx && !isDragged;
                return (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={(e) => onStart(col.key, idx, e)}
                    onDragEnd={clear}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onCardOver(col.key, idx); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(col.key, idx); }}
                    tabIndex={0}
                    role="article"
                    aria-label={`${card.title}, ${col.title}, card ${idx + 1} of ${lists[col.key].length}`}
                    style={{ position: 'relative', padding: 'var(--ax-space-4)', background: 'var(--ax-surface-solid)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: isOver ? '0 0 0 2px var(--ax-accent)' : 'var(--ax-shadow-sm)', cursor: 'grab', transition: 'opacity var(--ax-motion-fast),box-shadow var(--ax-motion-fast),transform var(--ax-motion-fast)', opacity: isDragged ? 0.4 : 1 }}
                  >
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                      <span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--${card.tagTone}`}>{card.tag}</span>
                      <span style={{ color: 'var(--ax-text-subtle)', display: 'inline-flex', cursor: 'grab' }} aria-hidden="true">{GRIP}</span>
                    </div>
                    <h3 style={{ margin: '0 0 var(--ax-space-1)', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', lineHeight: 1.4 }}>{card.title}</h3>
                    <p style={{ margin: '0 0 var(--ax-space-3)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>{card.desc}</p>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <span className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${card.avTone} 18%,transparent)`, color: card.avTone }}>{card.initials}</span>
                        <span className="ax-num" style={{ fontSize: 'var(--ax-text-2xs)', fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)' }}>{card.ref}</span>
                      </span>
                      <span className="ax-cluster" style={{ gap: '4px', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>
                        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
                        <span>{card.due}</span>
                      </span>
                    </div>
                  </article>
                );
              })}
              {lists[col.key].length === 0 && (
                <p style={{ margin: 'auto 0', textAlign: 'center', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', paddingBlock: 'var(--ax-space-5)' }}>Drop a card here</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default DraggableCards;
