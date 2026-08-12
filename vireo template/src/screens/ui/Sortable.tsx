'use client';
/*
 * Vireo Next.js — UI · Sortable (route "ui/sortable").
 *
 * Faithful re-expression of src/html/ui/sortable.html: a reorderable task list
 * (drag by handle OR arrow-key move + reset), a two-column "move between lists"
 * board, and a reorderable image grid. Pure drag — no drag library (matches the
 * reference note). The Alpine axSortable()/axBoards() helpers are re-expressed as
 * React state hooks. DOM/classes/ARIA/copy/order-string match 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const GRIP = (size: number, stroke = 'currentColor') => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
);
const RESET_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
);

interface TaskItem { id: number; title: string; meta: string; tone: string; }
const TASKS: TaskItem[] = [
  { id: 1, title: 'Connect a data source', meta: 'Setup · due today', tone: 'var(--ax-viz-cyan)' },
  { id: 2, title: 'Invite the design team', meta: 'People · 3 pending', tone: 'var(--ax-viz-violet)' },
  { id: 3, title: 'Publish the weekly report', meta: 'Reports · draft', tone: 'var(--ax-viz-emerald)' },
  { id: 4, title: 'Review churn-risk accounts', meta: 'CRM · 4 flagged', tone: 'var(--ax-viz-amber)' },
  { id: 5, title: 'Approve June payroll', meta: 'Finance · $18.4K', tone: 'var(--ax-viz-pink)' },
];

interface Tile { id: number; n: string; m: string; c1: string; c2: string; }
const TILES: Tile[] = [
  { id: 1, n: 'Aperture Desk Lamp', m: 'Lighting', c1: 'var(--ax-viz-amber)', c2: 'var(--ax-viz-pink)' },
  { id: 2, n: 'Walnut Monitor Riser', m: 'Desk', c1: 'var(--ax-viz-emerald)', c2: 'var(--ax-viz-cyan)' },
  { id: 3, n: 'Matte Ceramic Mug', m: 'Drinkware', c1: 'var(--ax-viz-violet)', c2: 'var(--ax-viz-cyan)' },
  { id: 4, n: 'Brass Task Light', m: 'Lighting', c1: 'var(--ax-viz-cyan)', c2: 'var(--ax-viz-violet)' },
  { id: 5, n: 'Grid Notebook A5', m: 'Stationery', c1: 'var(--ax-viz-pink)', c2: 'var(--ax-viz-amber)' },
  { id: 6, n: 'Stoneware Carafe', m: 'Drinkware', c1: 'var(--ax-viz-emerald)', c2: 'var(--ax-viz-amber)' },
  { id: 7, n: 'Oak Pen Tray', m: 'Decor', c1: 'var(--ax-viz-violet)', c2: 'var(--ax-viz-pink)' },
  { id: 8, n: 'Felt Laptop Sleeve', m: 'Tech', c1: 'var(--ax-viz-cyan)', c2: 'var(--ax-viz-emerald)' },
];

/* axSortable(): items + drag/keyboard reorder + reset. */
function useSortable<T extends { id: number }>(initial: T[]) {
  const original = useRef(initial);
  const [items, setItems] = useState<T[]>(initial);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  const onDragEnd = () => { setDragIndex(null); setOverIndex(null); };
  const onDragStart = (idx: number, e: React.DragEvent) => {
    setDragIndex(idx);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* noop */ } }
  };
  const move = (from: number, to: number) => setItems((cur) => { const c = [...cur]; const [m] = c.splice(from, 1); c.splice(to, 0, m); return c; });
  const onDrop = (idx: number) => { if (dragIndex === null || dragIndex === idx) { onDragEnd(); return; } move(dragIndex, idx); onDragEnd(); };
  const focusAt = (i: number) => { const els = rootRef.current?.querySelectorAll<HTMLElement>('[draggable="true"]'); els?.[i]?.focus(); };
  const moveUp = (idx: number) => { if (idx > 0) { move(idx, idx - 1); requestAnimationFrame(() => focusAt(idx - 1)); } };
  const moveDown = (idx: number) => { setItems((cur) => { if (idx < cur.length - 1) { const c = [...cur]; const [m] = c.splice(idx, 1); c.splice(idx + 1, 0, m); requestAnimationFrame(() => focusAt(idx + 1)); return c; } return cur; }); };
  const reset = () => setItems(original.current);

  return { items, dragIndex, overIndex, setOverIndex, onDragStart, onDragOver: setOverIndex, onDrop, onDragEnd, moveUp, moveDown, reset, rootRef };
}

interface Card { id: number; title: string; }
type Lists = Record<'backlog' | 'active', Card[]>;

export function Sortable() {
  const list = useSortable<TaskItem>(TASKS);
  const grid = useSortable<Tile>(TILES);

  const [lists, setLists] = useState<Lists>({
    backlog: [
      { id: 11, title: 'Dark-mode chart audit' },
      { id: 12, title: 'Empty-state illustrations' },
      { id: 13, title: 'Export to CSV polish' },
    ],
    active: [
      { id: 21, title: 'Customizer accent presets' },
      { id: 22, title: 'Editable table validation' },
    ],
  });
  const [from, setFrom] = useState<{ col: keyof Lists | null; idx: number | null }>({ col: null, idx: null });
  const [overCol, setOverCol] = useState<keyof Lists | null>(null);
  const boardStart = (col: keyof Lists, idx: number, e: React.DragEvent) => {
    setFrom({ col, idx });
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', `${col}:${idx}`); } catch { /* noop */ } }
  };
  const boardEnd = () => { setFrom({ col: null, idx: null }); setOverCol(null); };
  const boardDrop = (col: keyof Lists) => {
    if (from.col === null || from.idx === null) { setOverCol(null); return; }
    setLists((cur) => {
      const next: Lists = { backlog: [...cur.backlog], active: [...cur.active] };
      const card = next[from.col as keyof Lists].splice(from.idx as number, 1)[0];
      next[col].push(card);
      return next;
    });
    boardEnd();
  };

  return (
    <>
      <PageHead
        title="Sortable"
        subtitle="Reorderable lists and grids — grab a handle and drag, or move with the keyboard. Pure Alpine, no drag library."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/draggable-cards">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2z" /><path d="M14 4m0 2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2z" /><path d="M4 14m0 2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2z" /></svg>
            <span className="ax-btn__label">Draggable cards</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Sortable list */}
        <section className="ax-card ax-col--6" role="region" aria-label="Sortable task list" ref={list.rootRef as React.RefObject<HTMLElement>}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">List · vertical</span>
              <h2 className="ax-card__title">Reorder tasks</h2>
              <p className="ax-card__subtitle">Drag by the handle, or focus a row and press the arrow keys.</p>
            </div>
            <div className="ax-card__actions">
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={list.reset}>{RESET_ICON}<span className="ax-btn__label">Reset</span></button>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }} aria-label="Task list, sortable">
              {list.items.map((item, idx) => {
                const dim = list.dragIndex === idx;
                const over = list.overIndex === idx && list.dragIndex !== null && list.dragIndex !== idx;
                return (
                  <li key={item.id} draggable="true"
                    onDragStart={(e) => list.onDragStart(idx, e)} onDragEnd={list.onDragEnd}
                    onDragOver={(e) => { e.preventDefault(); list.onDragOver(idx); }} onDrop={(e) => { e.preventDefault(); list.onDrop(idx); }}
                    tabIndex={0} role="button"
                    aria-label={`Reorder ${item.title}. Position ${idx + 1} of ${list.items.length}`}
                    onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); list.moveUp(idx); } else if (e.key === 'ArrowDown') { e.preventDefault(); list.moveDown(idx); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-subtle)', border: `1px solid ${over ? 'var(--ax-accent)' : 'var(--ax-border)'}`, borderRadius: 'var(--ax-radius-md)', transition: 'opacity var(--ax-motion-fast),box-shadow var(--ax-motion-fast),border-color var(--ax-motion-fast)', cursor: 'default', opacity: dim ? 0.45 : 1, boxShadow: over ? 'inset 0 0 0 2px var(--ax-accent)' : 'none' }}>
                    <span style={{ cursor: 'grab', color: 'var(--ax-text-subtle)', display: 'inline-flex', flex: '0 0 auto' }} aria-hidden="true">{GRIP(18)}</span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', width: '1.4em', textAlign: 'center', flex: '0 0 auto' }}>{idx + 1}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 3, flex: '0 0 auto', background: item.tone }} />
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <span className="ax-text-truncate" style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{item.title}</span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{item.meta}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="ax-card__footer">
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Order: <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{list.items.map((i) => i.id).join(' · ')}</span></span>
          </div>
        </section>

        {/* Two-column boards */}
        <section className="ax-card ax-col--6" role="region" aria-label="Move items between lists">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">List · across columns</span>
              <h2 className="ax-card__title">Move between lists</h2>
              <p className="ax-card__subtitle">Drag a card from one column into the other.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
            {(['backlog', 'active'] as const).map((col) => (
              <div key={col} onDragOver={(e) => { e.preventDefault(); setOverCol(col); }} onDrop={(e) => { e.preventDefault(); boardDrop(col); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', minHeight: 180, transition: 'background var(--ax-motion-fast),box-shadow var(--ax-motion-fast)', background: overCol === col ? 'var(--ax-accent-wash)' : 'var(--ax-surface-subtle)', boxShadow: overCol === col ? 'inset 0 0 0 1.5px var(--ax-accent)' : 'inset 0 0 0 1px var(--ax-border)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>{col === 'backlog' ? 'Backlog' : 'In progress'}</span>
                  <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">{lists[col].length}</span>
                </div>
                {lists[col].map((card, idx) => {
                  const dim = from.col === col && from.idx === idx;
                  return (
                    <div key={card.id} draggable="true" onDragStart={(e) => boardStart(col, idx, e)} onDragEnd={boardEnd}
                      style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3)', background: 'var(--ax-surface-solid)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', boxShadow: 'var(--ax-shadow-sm)', cursor: 'grab', transition: 'opacity var(--ax-motion-fast)', opacity: dim ? 0.4 : 1 }}>
                      {GRIP(15, 'var(--ax-text-subtle)')}
                      <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{card.title}</span>
                    </div>
                  );
                })}
                {lists[col].length === 0 && <p style={{ margin: 'auto 0', textAlign: 'center', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Drop a card here</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Sortable grid */}
        <section className="ax-card ax-col--12" role="region" aria-label="Sortable image grid" ref={grid.rootRef as React.RefObject<HTMLElement>}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Grid · 2D</span>
              <h2 className="ax-card__title">Reorder gallery</h2>
              <p className="ax-card__subtitle">Drag any tile to a new spot — the grid reflows around it.</p>
            </div>
            <div className="ax-card__actions">
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={grid.reset}>{RESET_ICON}<span className="ax-btn__label">Reset</span></button>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 'var(--ax-space-4)' }}>
              {grid.items.map((item, idx) => {
                const dim = grid.dragIndex === idx;
                const over = grid.overIndex === idx && grid.dragIndex !== null && grid.dragIndex !== idx;
                return (
                  <figure key={item.id} draggable="true"
                    onDragStart={(e) => grid.onDragStart(idx, e)} onDragEnd={grid.onDragEnd}
                    onDragOver={(e) => { e.preventDefault(); grid.onDragOver(idx); }} onDrop={(e) => { e.preventDefault(); grid.onDrop(idx); }}
                    aria-label={`${item.n}, position ${idx + 1}`}
                    style={{ margin: 0, borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', border: '1px solid var(--ax-border)', background: 'var(--ax-surface-subtle)', cursor: 'grab', transition: 'opacity var(--ax-motion-fast),box-shadow var(--ax-motion-fast),transform var(--ax-motion-fast)', opacity: dim ? 0.4 : 1, boxShadow: over ? '0 0 0 2px var(--ax-accent)' : 'none', transform: over ? 'scale(1.02)' : 'scale(1)' }}>
                    <div className="ax-ratio" style={{ '--ax-ratio': '4/3', position: 'relative', background: `linear-gradient(135deg,color-mix(in oklab,${item.c1} 32%,var(--ax-surface)),color-mix(in oklab,${item.c2} 24%,var(--ax-surface)))` } as React.CSSProperties}>
                      <span style={{ position: 'absolute', insetBlockStart: 'var(--ax-space-2)', insetInlineEnd: 'var(--ax-space-2)', width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-surface-overlay)', color: 'var(--ax-text-subtle)', boxShadow: 'var(--ax-shadow-sm)' }} aria-hidden="true">{GRIP(15)}</span>
                    </div>
                    <figcaption style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                      <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{item.n}</div>
                      <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{item.m}</div>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Sortable;
