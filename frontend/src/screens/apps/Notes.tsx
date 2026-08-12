'use client';
/*
 * Vireo Next.js — Notes app (apps/notes).
 * Faithful re-expression of src/html/apps/notes.html: notebooks rail, searchable
 * note list, and an editor with pin/favorite/trash + autosave footer.
 * Alpine axNotes() → React useState; DOM classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Tag { t: string; c: string }
interface Note {
  id: number; title: string; book: string; pinned: boolean; fav: boolean;
  trashed: boolean; updated: string; snippet: string; tags: Tag[]; body: string;
}

const BOOKS = [
  { id: 'personal', label: 'Personal', color: 'var(--ax-viz-cyan)' },
  { id: 'work', label: 'Work', color: 'var(--ax-viz-violet)' },
  { id: 'ideas', label: 'Ideas', color: 'var(--ax-accent)' },
  { id: 'reading', label: 'Reading list', color: 'var(--ax-viz-pink)' },
];

const SEED: Note[] = [
  { id: 1, title: 'Aurora design language — principles', book: 'work', pinned: true, fav: true, trashed: false, updated: '2h ago', snippet: 'Glassy surfaces, one rationed expressive moment, data-viz palette stays constant across all 12 accents…', tags: [{ t: 'research', c: 'var(--ax-viz-violet)' }], body: 'Aurora keeps the spec architecture but swaps in a dark glassy-glow visual language.\n\nKey rules:\n- Glass cards at 24px radius with an inset top highlight\n- Accent is the only themed color; data-viz hexes are constant\n- Motion is restrained; the drag lift is the one expressive moment\n- Both light and dark must read correctly from tokens alone' },
  { id: 2, title: 'Q3 planning — open questions', book: 'work', pinned: true, fav: false, trashed: false, updated: '5h ago', snippet: 'Headcount for the platform team, whether to ship offline mode in v2.0 or v2.1, pricing experiment scope…', tags: [{ t: 'todo', c: 'var(--ax-viz-amber)' }], body: 'Open questions to resolve before the planning offsite:\n\n1. Platform team headcount — 2 or 3 hires?\n2. Offline mode: v2.0 stretch or v2.1 commit?\n3. Pricing experiment: how big a cohort?\n4. Do we sunset the legacy API in Q3 or Q4?' },
  { id: 3, title: 'Books to read this summer', book: 'reading', pinned: false, fav: true, trashed: false, updated: '1d ago', snippet: 'A Pattern Language, The Timeless Way of Building, Thinking in Systems, Shape Up, The Design of Everyday Things…', tags: [{ t: 'idea', c: 'var(--ax-viz-cyan)' }], body: 'Summer reading list:\n\n- A Pattern Language — Alexander\n- The Timeless Way of Building — Alexander\n- Thinking in Systems — Meadows\n- Shape Up — Singer\n- The Design of Everyday Things — Norman' },
  { id: 4, title: 'Onboarding flow rewrite notes', book: 'work', pinned: false, fav: false, trashed: false, updated: '2d ago', snippet: 'Cut steps from 5 to 3, defer profile photo to later, add a skip on every step, instrument drop-off…', tags: [{ t: 'draft', c: 'var(--ax-viz-pink)' }], body: 'Rewrite goals:\n- Reduce from 5 steps to 3\n- Defer profile photo until first real use\n- Skip available on every step\n- Instrument drop-off between every transition\n- A/B test against current flow for two weeks' },
  { id: 5, title: 'Cabin trip packing list', book: 'personal', pinned: false, fav: false, trashed: false, updated: '3d ago', snippet: 'Hiking boots, rain shell, headlamp, French press, board games, the good coffee, first-aid kit…', tags: [{ t: 'todo', c: 'var(--ax-viz-amber)' }], body: 'Packing for the cabin weekend:\n- Hiking boots + wool socks\n- Rain shell\n- Headlamp + spare batteries\n- French press + the good coffee\n- Board games\n- First-aid kit' },
  { id: 6, title: 'Idea: weekly design digest', book: 'ideas', pinned: false, fav: false, trashed: false, updated: '4d ago', snippet: 'A short internal newsletter: one pattern we shipped, one we are exploring, one external thing worth a look…', tags: [{ t: 'idea', c: 'var(--ax-viz-cyan)' }], body: 'A short Friday digest for the design team:\n1. One pattern we shipped this week\n2. One we are exploring\n3. One external thing worth a look\n\nKeep it under a 3-minute read.' },
  { id: 7, title: 'Meeting — Northwind kickoff', book: 'work', pinned: false, fav: false, trashed: false, updated: '5d ago', snippet: 'Scope confirmed for phase 1, weekly check-ins on Tuesdays, shared Figma, security review before launch…', tags: [{ t: 'research', c: 'var(--ax-viz-violet)' }], body: 'Northwind kickoff notes:\n- Phase 1 scope confirmed (dashboard + reports)\n- Weekly check-ins, Tuesdays 10am\n- Shared Figma + staging access granted\n- Security review must complete before launch' },
  { id: 8, title: 'Old draft — archived', book: 'ideas', pinned: false, fav: false, trashed: true, updated: '2w ago', snippet: 'Superseded by the Aurora direction doc. Kept for reference only.', tags: [], body: 'Superseded by the Aurora direction doc.' },
];

const bookLabel = (id: string) => BOOKS.find((x) => x.id === id)?.label ?? id;
const bookColor = (id: string) => BOOKS.find((x) => x.id === id)?.color ?? 'var(--ax-text-subtle)';

export function Notes() {
  const [notes, setNotes] = useState<Note[]>(SEED);
  const [scope, setScope] = useState('all');
  const [q, setQ] = useState('');
  const [nextId, setNextId] = useState(100);
  const [activeId, setActiveId] = useState<number | null>(1);

  const listed = () => {
    const t = q.trim().toLowerCase();
    let list = notes.filter((n) => {
      if (scope === 'trash') return n.trashed;
      if (n.trashed) return false;
      if (scope === 'fav') return n.fav;
      if (scope === 'all') return true;
      return n.book === scope;
    });
    if (t) list = list.filter((n) => n.title.toLowerCase().includes(t) || n.snippet.toLowerCase().includes(t));
    return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  };

  const shown = listed();
  const active = notes.find((n) => n.id === activeId && shown.some((s) => s.id === n.id)) ?? null;

  const patch = (id: number, p: Partial<Note>) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...p } : n)));
  const newNote = () => {
    const n: Note = { id: nextId, title: 'Untitled note', book: BOOKS.find((b) => b.id === scope) ? scope : 'personal', pinned: false, fav: false, trashed: false, updated: 'just now', snippet: '', tags: [], body: '' };
    setNotes((prev) => [n, ...prev]);
    setNextId((x) => x + 1);
    setScope('all');
    setActiveId(n.id);
  };
  const togglePin = (n: Note) => patch(n.id, { pinned: !n.pinned });
  const trash = (n: Note) => { patch(n.id, { trashed: true }); setActiveId(null); };

  return (
    <>
      <PageHead
        title="Notes"
        subtitle="Capture ideas and meeting notes — 24 notes across 4 notebooks."
        actions={
          <button type="button" className="ax-btn ax-btn--primary" onClick={newNote}>
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
            <span className="ax-btn__label">New note</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        <aside className="ax-card ax-col--3" role="region" aria-label="Notebooks">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <ul className="ax-list ax-list--compact">
              <li className={`ax-list__row${scope === 'all' ? ' is-selected' : ''}`} onClick={() => setScope('all')} style={{ cursor: 'pointer', border: 0, borderRadius: 'var(--ax-radius-md)', paddingInline: 'var(--ax-space-3)' }} aria-selected={scope === 'all'}>
                <span className="ax-list__leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14" /><path d="M9 7l6 0" /><path d="M9 11l6 0" /><path d="M9 15l4 0" /></svg></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>All notes</span></span>
                <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{notes.filter((n) => !n.trashed).length}</span>
              </li>
              <li className={`ax-list__row${scope === 'fav' ? ' is-selected' : ''}`} onClick={() => setScope('fav')} style={{ cursor: 'pointer', border: 0, borderRadius: 'var(--ax-radius-md)', paddingInline: 'var(--ax-space-3)' }} aria-selected={scope === 'fav'}>
                <span className="ax-list__leading" style={{ color: 'var(--ax-warning-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Favorites</span></span>
                <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{notes.filter((n) => n.fav && !n.trashed).length}</span>
              </li>
              <li className={`ax-list__row${scope === 'trash' ? ' is-selected' : ''}`} onClick={() => setScope('trash')} style={{ cursor: 'pointer', border: 0, borderRadius: 'var(--ax-radius-md)', paddingInline: 'var(--ax-space-3)' }} aria-selected={scope === 'trash'}>
                <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Trash</span></span>
                <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{notes.filter((n) => n.trashed).length}</span>
              </li>
            </ul>

            <hr style={{ margin: 0, border: 0, borderTop: '1px solid var(--ax-border)' }} />

            <div>
              <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-2)' }}>Notebooks</small>
              <ul className="ax-list ax-list--compact">
                {BOOKS.map((b) => (
                  <li key={b.id} className={`ax-list__row${scope === b.id ? ' is-selected' : ''}`} onClick={() => setScope(b.id)} style={{ cursor: 'pointer', border: 0, borderRadius: 'var(--ax-radius-md)', paddingInline: 'var(--ax-space-3)' }} aria-selected={scope === b.id}>
                    <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: b.color }} /></span>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{b.label}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{notes.filter((n) => n.book === b.id && !n.trashed).length}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start', marginTop: 'var(--ax-space-2)', color: 'var(--ax-text-muted)' }}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">New notebook</span>
              </button>
            </div>

            <hr style={{ margin: 0, border: 0, borderTop: '1px solid var(--ax-border)' }} />

            <div>
              <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-2)' }}>Tags</small>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-viz-cyan)', background: 'color-mix(in oklab,var(--ax-viz-cyan) 15%,transparent)' }}><span className="ax-badge__dot" />idea</span>
                <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-viz-violet)', background: 'color-mix(in oklab,var(--ax-viz-violet) 15%,transparent)' }}><span className="ax-badge__dot" />research</span>
                <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-viz-pink)', background: 'color-mix(in oklab,var(--ax-viz-pink) 15%,transparent)' }}><span className="ax-badge__dot" />draft</span>
                <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: 'var(--ax-viz-amber)', background: 'color-mix(in oklab,var(--ax-viz-amber) 15%,transparent)' }}><span className="ax-badge__dot" />todo</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="ax-card ax-col--3" role="region" aria-label="Note list" style={{ padding: 0 }}>
          <div className="ax-card__header" style={{ paddingBottom: 'var(--ax-space-3)' }}>
            <div style={{ position: 'relative', flex: '1 1 auto' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input ax-input--sm" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 34 }} aria-label="Search notes" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '72vh', overflow: 'auto' }}>
            {shown.map((n) => (
              <button key={n.id} type="button" className={`ax-note-card${active && active.id === n.id ? ' ax-note-card--active' : ''}`} onClick={() => setActiveId(n.id)}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)' }}>
                  <span className="ax-note-card__title">{n.title}</span>
                  {n.pinned && <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: 14, height: 14, color: 'var(--ax-accent)', flex: '0 0 auto' }}><path d="M15.113 3.21l.094 .083l5.5 5.5a1 1 0 0 1 -1.175 1.59l-3.172 3.171l-1.424 3.797a1 1 0 0 1 -.158 .277l-.07 .08l-1.5 1.5a1 1 0 0 1 -1.32 .082l-.095 -.083l-2.793 -2.792l-3.793 3.792a1 1 0 0 1 -1.497 -1.32l.083 -.094l3.792 -3.793l-2.792 -2.793a1 1 0 0 1 -.083 -1.32l.083 -.094l1.5 -1.5a1 1 0 0 1 .258 -.187l.098 -.042l3.796 -1.425l3.171 -3.17a1 1 0 0 1 1.497 -1.26z" /></svg>}
                </div>
                <p className="ax-note-card__snippet">{n.snippet}</p>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-2)' }}>
                  <span className="ax-cluster" style={{ gap: 4 }}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: bookColor(n.book) }} />
                    <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)' }}>{bookLabel(n.book)}</small>
                  </span>
                  <small className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{n.updated}</small>
                </div>
              </button>
            ))}
            {!shown.length && <div style={{ textAlign: 'center', padding: 'var(--ax-space-8) var(--ax-space-4)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>No notes here yet.</div>}
          </div>
        </section>

        <section className="ax-card ax-col--6" role="region" aria-label="Note editor">
          {active ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="ax-card__header" style={{ borderBottom: '1px solid var(--ax-border)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bold" style={{ fontWeight: 700 }}>B</button>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Italic" style={{ fontStyle: 'italic', fontFamily: 'var(--ax-font-display)' }}>I</button>
                  <span style={{ width: 1, height: 18, background: 'var(--ax-border)' }} />
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bulleted list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Checklist"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.615 20h-2.615a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8" /><path d="M14 19l2 2l4 -4" /><path d="M9 8h4" /><path d="M9 12h2" /></svg></button>
                  <span style={{ width: 1, height: 18, background: 'var(--ax-border)' }} />
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
                </div>
                <div className="ax-card__actions">
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={active.pinned ? 'Unpin note' : 'Pin note'} aria-pressed={active.pinned} onClick={() => togglePin(active)} style={active.pinned ? { color: 'var(--ax-accent)' } : undefined}>
                    <svg viewBox="0 0 24 24" fill={active.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4" /><path d="M9 15l-4.5 4.5" /><path d="M14.5 4l5.5 5.5" /></svg>
                  </button>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={active.fav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={active.fav} onClick={() => patch(active.id, { fav: !active.fav })} style={active.fav ? { color: 'var(--ax-warning-500)' } : undefined}>
                    <svg viewBox="0 0 24 24" fill={active.fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18 }}><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
                  </button>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Delete note" style={{ color: 'var(--ax-danger-500)' }} onClick={() => trash(active)}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                  </button>
                </div>
              </div>

              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', flex: '1 1 auto' }}>
                <input type="text" value={active.title} onChange={(e) => patch(active.id, { title: e.target.value })} style={{ border: 0, background: 'transparent', outline: 'none', color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, letterSpacing: '-.01em' }} aria-label="Note title" />
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }}>
                  <span className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: bookColor(active.book), background: `color-mix(in oklab,${bookColor(active.book)} 15%,transparent)` }}>
                    <span className="ax-badge__dot" /><span>{bookLabel(active.book)}</span>
                  </span>
                  {active.tags.map((tag) => (
                    <span key={tag.t} className="ax-badge ax-badge--soft ax-badge--pill" style={{ color: tag.c, background: `color-mix(in oklab,${tag.c} 15%,transparent)` }}><span className="ax-badge__dot" /><span>{tag.t}</span></span>
                  ))}
                  <button type="button" className="ax-badge ax-badge--outline ax-badge--pill ax-badge--neutral" style={{ cursor: 'pointer' }}>
                    <svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>Tag
                  </button>
                </div>
                <textarea value={active.body} onChange={(e) => patch(active.id, { body: e.target.value })} style={{ flex: '1 1 auto', minHeight: 280, border: 0, background: 'transparent', outline: 'none', resize: 'none', color: 'var(--ax-text)', fontSize: 'var(--ax-text-md)', lineHeight: 1.7 }} aria-label="Note body" />
              </div>

              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="ax-cluster ax-num" style={{ gap: 6, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-viz-emerald)' }} />
                  Saved · edited <span>{active.updated}</span>
                </span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{active.body.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>
          ) : (
            <div className="ax-card__body ax-flex" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', marginBottom: 'var(--ax-space-4)' }}>
                <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14" /><path d="M9 7l6 0" /><path d="M9 11l6 0" /><path d="M9 15l4 0" /></svg>
              </span>
              <p style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>Select a note to read</p>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Or create a new one to start writing.</p>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .ax-note-card { display:flex; flex-direction:column; gap:6px; width:100%; text-align:left; padding:var(--ax-space-3) var(--ax-space-5); background:transparent; border:0; border-bottom:1px solid var(--ax-border); cursor:pointer; transition:background var(--ax-motion-instant) var(--ax-ease-standard); }
        .ax-note-card:hover { background:var(--ax-fill-hover); }
        .ax-note-card--active { background:var(--ax-accent-wash); box-shadow:inset 2px 0 0 var(--ax-accent); }
        .ax-note-card__title { font-weight:var(--ax-weight-semibold); color:var(--ax-text-strong); font-size:var(--ax-text-sm); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ax-note-card__snippet { color:var(--ax-text-muted); font-size:var(--ax-text-xs); line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      `}</style>
    </>
  );
}

export default Notes;
