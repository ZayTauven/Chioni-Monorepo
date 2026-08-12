'use client';
/*
 * Vireo Next.js — CRM / Deals Pipeline (route "crm/deals").
 *
 * Faithful re-expression of src/html/crm/deals.html: the CRM sub-nav, a search +
 * owner filter + board/list segment, a drag-and-drop Kanban pipeline (5 stages +
 * a closed-this-quarter rail) and a slide-in deal drawer with stage stepper,
 * key contacts, next steps, activity and footer actions. The Alpine x-data
 * (axDeals) + page-specific .ax-pl-* styles are ported to React; classes + ARIA
 * match the reference 1:1. Drag-and-drop uses native HTML5 DnD.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const V = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)',
};

interface Column { id: string; title: string; color: string; prob: number; }
const COLUMNS: Column[] = [
  { id: 'lead', title: 'Lead', color: 'var(--ax-text-subtle)', prob: 10 },
  { id: 'qualified', title: 'Qualified', color: V.cyan, prob: 30 },
  { id: 'proposal', title: 'Proposal', color: V.violet, prob: 55 },
  { id: 'negotiation', title: 'Negotiation', color: V.amber, prob: 75 },
  { id: 'closing', title: 'Closing', color: V.emerald, prob: 90 },
];

interface Card {
  id: number; col: string; title: string; company: string; coMark: string; coC: string;
  value: number; close: string; overdue: boolean; hot: boolean; tasks: string; notes: number;
  who: { i: string; n: string; c: string };
  coName?: string;
}
const ITEMS: Card[] = [
  { id: 1, col: 'lead', title: 'Northwind — Platform expansion', company: 'Northwind Labs', coMark: 'NW', coC: V.cyan, value: 124000, close: 'Aug 14', overdue: false, hot: false, tasks: '0/3', notes: 1, who: { i: 'ML', n: 'Maya Lindqvist', c: V.emerald } },
  { id: 2, col: 'lead', title: 'Meadow Foods — POS rollout', company: 'Meadow Foods', coMark: 'MF', coC: V.amber, value: 48000, close: 'Sep 02', overdue: false, hot: false, tasks: '', notes: 0, who: { i: 'DO', n: 'Devon Okafor', c: V.cyan } },
  { id: 3, col: 'lead', title: 'Pulse Media — Retainer renewal', company: 'Pulse Media', coMark: 'PM', coC: V.violet, value: 36000, close: 'Aug 20', overdue: false, hot: false, tasks: '1/2', notes: 2, who: { i: 'AS', n: 'Ava Sutton', c: V.emerald } },
  { id: 4, col: 'qualified', title: 'Brightline — Risk suite', company: 'Brightline Capital', coMark: 'BC', coC: V.violet, value: 186000, close: 'Jul 30', overdue: false, hot: true, tasks: '2/4', notes: 5, who: { i: 'TH', n: 'Tomás Herrera', c: V.violet } },
  { id: 5, col: 'qualified', title: 'Clearbox — Seat upgrade', company: 'Clearbox', coMark: 'CB', coC: V.cyan, value: 74000, close: 'Aug 08', overdue: false, hot: false, tasks: '1/3', notes: 1, who: { i: 'TH', n: 'Tomás Herrera', c: V.violet } },
  { id: 6, col: 'qualified', title: 'Harbor — Logistics module', company: 'Harbor Freight Co', coMark: 'HF', coC: V.amber, value: 98000, close: 'Sep 10', overdue: false, hot: false, tasks: '', notes: 0, who: { i: 'DO', n: 'Devon Okafor', c: V.cyan } },
  { id: 7, col: 'proposal', title: 'Meridian — EHR integration', company: 'Meridian Health', coMark: 'MH', coC: V.pink, value: 241000, close: 'Jul 24', overdue: false, hot: true, tasks: '3/5', notes: 8, who: { i: 'ML', n: 'Maya Lindqvist', c: V.emerald } },
  { id: 8, col: 'proposal', title: 'Loop — Fleet analytics', company: 'Loop Robotics', coMark: 'LR', coC: V.cyan, value: 132000, close: 'Aug 03', overdue: false, hot: false, tasks: '2/4', notes: 3, who: { i: 'TH', n: 'Tomás Herrera', c: V.violet } },
  { id: 9, col: 'negotiation', title: 'Ridgeline — Grid monitoring', company: 'Ridgeline Energy', coMark: 'RE', coC: V.pink, value: 206000, close: 'Jul 18', overdue: true, hot: true, tasks: '4/5', notes: 6, who: { i: 'ML', n: 'Maya Lindqvist', c: V.emerald } },
  { id: 10, col: 'negotiation', title: 'Postoak — Claims automation', company: 'Postoak Insurance', coMark: 'PI', coC: V.emerald, value: 158000, close: 'Jul 27', overdue: false, hot: false, tasks: '3/4', notes: 4, who: { i: 'AS', n: 'Ava Sutton', c: V.emerald } },
  { id: 11, col: 'closing', title: 'Crate & Co — Annual contract', company: 'Crate & Co', coMark: 'CC', coC: V.amber, value: 128400, close: 'Jul 12', overdue: false, hot: false, tasks: '5/5', notes: 2, who: { i: 'AS', n: 'Ava Sutton', c: V.emerald } },
  { id: 12, col: 'closing', title: 'Studioform — Brand system', company: 'Studioform', coMark: 'SF', coC: V.emerald, value: 64000, close: 'Jul 09', overdue: false, hot: false, tasks: '4/4', notes: 1, who: { i: 'DO', n: 'Devon Okafor', c: V.cyan } },
];

const money = (v: number) => {
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 2) + 'M';
  return v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K' : '$' + v;
};

const PL_STYLES = `
.ax-drawer-scrim { position:fixed; inset:0; z-index:120; display:flex; justify-content:flex-end; background:var(--ax-backdrop); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); }
.ax-pl-col { flex:0 0 300px; width:300px; display:flex; flex-direction:column; background:var(--ax-surface-subtle); border:1px solid var(--ax-border); border-radius:var(--ax-radius-lg); padding:var(--ax-space-3); transition:background var(--ax-motion-fast) var(--ax-ease-standard), box-shadow var(--ax-motion-fast) var(--ax-ease-standard); }
.ax-pl-col--over { background:var(--ax-accent-wash); box-shadow:inset 0 0 0 2px var(--ax-accent); }
.ax-pl-col__body { display:flex; flex-direction:column; gap:var(--ax-space-3); min-height:40px; }
.ax-pl-card { position:relative; display:flex; flex-direction:column; gap:var(--ax-space-2); padding:var(--ax-space-3); background:var(--ax-surface-solid); border:1px solid var(--ax-border); border-radius:var(--ax-radius-md); box-shadow:var(--ax-shadow-sm); cursor:grab; text-align:left; transition:box-shadow var(--ax-motion-fast) var(--ax-ease-standard), transform var(--ax-motion-fast) var(--ax-ease-standard); }
.ax-pl-card:hover { box-shadow:var(--ax-shadow-md); }
.ax-pl-card:focus-visible { outline:none; box-shadow:0 0 0 2px var(--ax-canvas), 0 0 0 4px var(--ax-focus-ring); }
.ax-pl-card:active { cursor:grabbing; }
.ax-pl-card--ghost { opacity:.4; }
.ax-pl-card__title { color:var(--ax-text-strong); font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); line-height:1.4; }
.ax-pl-add { display:inline-flex; align-items:center; gap:var(--ax-space-2); width:100%; padding:var(--ax-space-2) var(--ax-space-3); font-size:var(--ax-text-sm); color:var(--ax-text-muted); background:transparent; border:1px dashed var(--ax-border-strong); border-radius:var(--ax-radius-md); cursor:pointer; transition:color var(--ax-motion-fast), background var(--ax-motion-fast); }
.ax-pl-add:hover { color:var(--ax-accent); background:var(--ax-fill-hover); }
.ax-slide-in { animation:axSlideIn .18s var(--ax-ease-standard); }
@keyframes axSlideIn { from { transform:translateX(24px); opacity:0; } to { transform:translateX(0); opacity:1; } }
@media (prefers-reduced-motion: reduce){ .ax-pl-card, .ax-slide-in { transition:none; animation:none; } }
`;

export function Deals() {
  const [items, setItems] = useState<Card[]>(ITEMS);
  const [q, setQ] = useState('');
  const [fOwner, setFOwner] = useState('');
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<Partial<Card>>({});

  const cards = (colId: string) => {
    const t = q.trim().toLowerCase();
    return items.filter((c) => c.col === colId && (!fOwner || c.who.n === fOwner) && (!t || c.title.toLowerCase().includes(t) || c.company.toLowerCase().includes(t)));
  };
  const colTotal = (colId: string) => cards(colId).reduce((s, c) => s + c.value, 0);
  const totalOpen = useMemo(() => items.reduce((s, c) => s + c.value, 0), [items]);

  const dragStart = (id: number) => setDraggingId(id);
  const dragEnd = () => { setDraggingId(null); setDragOverCol(null); };
  const drop = (colId: string) => {
    if (draggingId !== null) setItems((is) => is.map((i) => (i.id === draggingId ? { ...i, col: colId } : i)));
    dragEnd();
  };
  const moveActive = (colId: string) => {
    setActive((a) => ({ ...a, col: colId }));
    if (active.id != null) setItems((is) => is.map((i) => (i.id === active.id ? { ...i, col: colId } : i)));
  };
  const winActive = () => { if (active.id != null) setItems((is) => is.filter((x) => x.id !== active.id)); setDrawerOpen(false); };
  const openEdit = (card: Card) => { setActive(card); setDrawerOpen(true); };
  const openNew = (colId: string) => { setActive({ col: colId, title: 'New deal', company: '—', value: 0, close: '', who: { n: 'Unassigned', i: '?', c: 'var(--ax-text-subtle)' } }); setDrawerOpen(true); };

  const activeColTitle = (COLUMNS.find((c) => c.id === active.col) || ({} as Column)).title;

  return (
    <>
      <style>{PL_STYLES}</style>
      <PageHead
        title="Deals Pipeline"
        subtitle={(<><span className="ax-num">{items.length}</span> open deals · <span className="ax-num">{money(totalOpen)}</span> weighted value · Q3 close target <span className="ax-num">$1.2M</span>.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227" /></svg>
              <span className="ax-btn__label">Filter</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => openNew('lead')}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New deal</span>
            </button>
          </>
        }
      />

      {/* CRM SUB-NAV */}
      <nav className="ax-tabs ax-tabs--pill" aria-label="CRM sections" style={{ marginBottom: 'var(--ax-space-5)' }}>
        <div className="ax-tabs__list" role="tablist">
          <Link className="ax-tabs__tab" role="tab" href="/crm/contacts">Contacts</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/companies">Companies</Link>
          <Link className="ax-tabs__tab is-active" role="tab" aria-selected="true" aria-current="page" href="/crm/deals">Deals</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/leads">Leads</Link>
        </div>
      </nav>

      {/* TOOLBAR */}
      <div className="ax-cluster" style={{ marginBottom: 'var(--ax-space-5)', gap: 'var(--ax-space-3)' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340, minWidth: 200 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
          <input type="search" className="ax-input" placeholder="Search deals or companies…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search deals" />
        </div>
        <select className="ax-select ax-select--sm" value={fOwner} onChange={(e) => setFOwner(e.target.value)} aria-label="Filter by owner" style={{ flex: '0 0 auto', width: 'auto', minWidth: 160, maxWidth: 220 }}>
          <option value="">All owners</option>
          <option>Maya Lindqvist</option>
          <option>Tomás Herrera</option>
          <option>Ava Sutton</option>
          <option>Devon Okafor</option>
        </select>
        <div className="ax-segment" role="radiogroup" aria-label="Pipeline view" style={{ marginInlineStart: 'auto' }}>
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

      {/* PIPELINE BOARD */}
      <div style={{ display: 'flex', gap: 'var(--ax-space-5)', overflowX: 'auto', paddingBottom: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            className={`ax-pl-col${dragOverCol === col.id ? ' ax-pl-col--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={() => { if (dragOverCol === col.id) setDragOverCol(null); }}
            onDrop={() => drop(col.id)}
            role="region"
            aria-label={col.title + ' stage'}
          >
            {/* column header */}
            <div style={{ padding: 'var(--ax-space-1) var(--ax-space-1) var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <i style={{ width: 9, height: 9, borderRadius: 3, background: col.color }} />
                  <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{col.title}</b>
                  <span className="ax-badge ax-badge--neutral ax-badge--pill ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{cards(col.id).length}</span>
                </div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={'Add deal to ' + col.title} onClick={() => openNew(col.id)}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                </button>
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>{money(colTotal(col.id))}</span>
                <span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{col.prob + '% prob'}</span>
              </div>
              <div className="ax-progress ax-progress--xs" style={{ marginTop: 6 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${col.prob}%`, background: col.color }} /></div></div>
            </div>

            {/* cards */}
            <div className="ax-pl-col__body">
              {cards(col.id).map((card) => (
                <article
                  key={card.id}
                  className={`ax-pl-card${draggingId === card.id ? ' ax-pl-card--ghost' : ''}`}
                  draggable
                  onDragStart={() => dragStart(card.id)}
                  onDragEnd={dragEnd}
                  onClick={() => openEdit(card)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') openEdit(card); }}
                  role="button"
                  aria-label={card.title + ', ' + money(card.value)}
                >
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                    <p className="ax-pl-card__title">{card.title}</p>
                    {card.hot && <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--sm ax-badge--pill" style={{ flex: '0 0 auto' }} title="High priority">Hot</span>}
                  </div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${card.coC} 18%,transparent)`, color: card.coC, fontWeight: 700, fontSize: 'var(--ax-text-2xs)' }}>{card.coMark}</span>
                    <span className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>{card.company}</span>
                  </div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)' }}>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{money(card.value)}</span>
                    <span className="ax-cluster ax-num" style={{ gap: 4, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: card.overdue ? 'var(--ax-danger-500)' : 'var(--ax-text-subtle)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M16 3l0 4" /><path d="M8 3l0 4" /><path d="M4 11l16 0" /></svg>
                      <span>{card.close}</span>
                    </span>
                  </div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)', paddingTop: 6, borderTop: '1px solid var(--ax-border)' }}>
                    <div className="ax-cluster" style={{ gap: 6, flexWrap: 'nowrap', color: 'var(--ax-text-subtle)' }}>
                      {card.tasks && (
                        <span className="ax-cluster ax-num" style={{ gap: 3, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></svg>
                          <span>{card.tasks}</span>
                        </span>
                      )}
                      {!!card.notes && (
                        <span className="ax-cluster ax-num" style={{ gap: 3, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg>
                          <span>{card.notes}</span>
                        </span>
                      )}
                    </div>
                    <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${card.who.c} 20%,transparent)`, color: card.who.c, fontWeight: 600, fontSize: 'var(--ax-text-2xs)' }} title={card.who.n}>{card.who.i}</span>
                  </div>
                </article>
              ))}

              <button type="button" className="ax-pl-add" onClick={() => openNew(col.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                Add deal
              </button>
            </div>
          </section>
        ))}

        {/* won / lost summary rail */}
        <section className="ax-pl-col" role="region" aria-label="Closed this quarter" style={{ flex: '0 0 260px', width: 260 }}>
          <div style={{ padding: 'var(--ax-space-1) var(--ax-space-1) var(--ax-space-3)' }}>
            <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Closed · Q3</b>
          </div>
          <div className="ax-pl-col__body">
            <div className="ax-card" style={{ margin: 0, borderColor: 'color-mix(in oklab,var(--ax-success-500) 30%,var(--ax-border))' }}>
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-success-500) 18%,transparent)', color: 'var(--ax-success-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Won</div><b className="ax-num" style={{ color: 'var(--ax-success-500)', fontSize: 'var(--ax-text-lg)' }}>$842K</b></div>
                </div>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>14 deals · 64% win rate</span>
              </div>
            </div>
            <div className="ax-card" style={{ margin: 0 }}>
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-danger-500) 18%,transparent)', color: 'var(--ax-danger-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></span>
                  <div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Lost</div><b className="ax-num" style={{ color: 'var(--ax-danger-500)', fontSize: 'var(--ax-text-lg)' }}>$214K</b></div>
                </div>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>8 deals · top reason: price</span>
              </div>
            </div>
            <div className="ax-card" style={{ margin: 0 }}>
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Forecast vs target</span>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '70%', background: 'var(--ax-accent)' }} /></div></div>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>$842K of $1.2M committed</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* DEAL DRAWER */}
      {drawerOpen && (
        <div className="ax-drawer-scrim" onClick={() => setDrawerOpen(false)}>
          <div className="ax-card ax-slide-in" role="dialog" aria-modal="true" aria-label="Deal detail" onClick={(e) => e.stopPropagation()} style={{ width: 'min(540px,100%)', height: '100%', borderRadius: 0, overflow: 'auto' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">{activeColTitle + ' · ' + (active.coName || active.company)}</span>
                <h2 className="ax-card__title">{active.title}</h2>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close" onClick={() => setDrawerOpen(false)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
              {/* value + meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Deal value</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)' }}>{money(active.value || 0)}</b></div>
                <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Expected close</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-lg)' }}>{active.close || '—'}</b></div>
              </div>

              {/* stage stepper */}
              <div>
                <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-3)' }}>Stage</small>
                <div className="ax-cluster" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {COLUMNS.map((c) => (
                    <button key={c.id} type="button" className={`ax-badge ax-badge--pill ax-badge--sm ${active.col === c.id ? 'ax-badge--accent' : 'ax-badge--soft ax-badge--neutral'}`} onClick={() => moveActive(c.id)} style={{ cursor: 'pointer' }}><span>{c.title}</span></button>
                  ))}
                </div>
              </div>

              {/* key people */}
              <div>
                <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-3)' }}>Key contacts</small>
                <ul className="ax-list ax-list--compact">
                  <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                    <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)', fontWeight: 700, fontSize: 10 }}>ML</span></span>
                    <span className="ax-list__content"><span className="ax-list__title">Maya Lindqvist</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Economic buyer · CFO</span></span>
                    <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--sm">Champion</span></span>
                  </li>
                  <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                    <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', fontWeight: 700, fontSize: 10 }}>TH</span></span>
                    <span className="ax-list__content"><span className="ax-list__title">Tomás Herrera</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Technical evaluator</span></span>
                    <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">Influencer</span></span>
                  </li>
                </ul>
              </div>

              {/* next steps */}
              <div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                  <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Next steps</small>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>2/4</span>
                </div>
                <ul className="ax-list ax-list--compact">
                  <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" defaultChecked /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>Send pricing proposal</span></span></li>
                  <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" defaultChecked /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>Loop in procurement</span></span></li>
                  <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)' }}>Security review call</span></span></li>
                  <li className="ax-list__row" style={{ border: 0, paddingInline: 0 }}><span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" /></span><span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-regular)' }}>Redline contract</span></span></li>
                </ul>
              </div>

              {/* activity */}
              <div>
                <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-3)' }}>Activity</small>
                <ul className="ax-timeline">
                  <li className="ax-timeline__item ax-timeline__item--success">
                    <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Ava Sutton</b> moved deal to <span style={{ color: 'var(--ax-accent)' }}>Proposal</span></p><span className="ax-timeline__time">3h ago</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Discovery call · 32 min with <b style={{ color: 'var(--ax-text-strong)' }}>Maya</b></p><span className="ax-timeline__time">Yesterday</span></div>
                  </li>
                </ul>
                <div style={{ marginTop: 'var(--ax-space-3)' }}>
                  <textarea className="ax-textarea" rows={2} placeholder="Log a note or next step…" aria-label="Add note" />
                </div>
              </div>
            </div>
            <div className="ax-card__footer" style={{ display: 'flex', gap: 'var(--ax-space-3)', justifyContent: 'space-between' }}>
              <button type="button" className="ax-btn ax-btn--soft-success" onClick={winActive}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
                <span className="ax-btn__label">Mark won</span>
              </button>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setDrawerOpen(false)}>Close</button>
                <button type="button" className="ax-btn ax-btn--primary" onClick={() => setDrawerOpen(false)}>Save deal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Deals;
