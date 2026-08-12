'use client';
/*
 * Vireo Next.js — Calendar app (apps/calendar).
 * Faithful re-expression of src/html/apps/calendar.html: side rail (mini-month,
 * my-calendars, upcoming), a month grid of clickable day cells with events, an
 * agenda fallback for non-month views, and an event editor modal.
 * Alpine inline x-data → React useState; DOM classes/ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Ev { id: number | null; title: string; cat: string; start: string; end?: string; allday?: boolean; repeat?: string; location?: string; desc?: string }
interface EvShort { id: number; title: string; cat: string; start: string; end?: string; allday?: boolean; color: string; time?: string; label: string }
interface Cell { day: number; date: string; muted?: boolean; today?: boolean; events: EvShort[]; more?: string }

const EMPTY: Ev = { id: null, title: '', cat: 'work', start: '', end: '', allday: false, repeat: 'none', location: '', desc: '' };

const e = (id: number, title: string, cat: string, color: string, start: string, label: string, end?: string, allday?: boolean, time?: string): EvShort =>
  ({ id, title, cat, color, start, end, allday, label, time });

const WEEKS: Cell[][] = [
  [
    { day: 26, date: '2026-05-26', muted: true, events: [] },
    { day: 27, date: '2026-05-27', muted: true, events: [] },
    { day: 28, date: '2026-05-28', muted: true, events: [] },
    { day: 29, date: '2026-05-29', muted: true, events: [] },
    { day: 30, date: '2026-05-30', muted: true, events: [] },
    { day: 31, date: '2026-05-31', muted: true, events: [] },
    { day: 1, date: '2026-06-01', events: [e(1, 'Team standup', 'work', 'var(--ax-accent)', '2026-06-01T09:30', 'Standup', '2026-06-01T09:45', false, '09:30')] },
  ],
  [
    { day: 2, date: '2026-06-02', events: [e(2, 'Design critique', 'design', 'var(--ax-viz-violet)', '2026-06-02T14:30', 'Critique', '2026-06-02T15:30', false, '14:30')] },
    { day: 3, date: '2026-06-03', events: [] },
    { day: 4, date: '2026-06-04', events: [e(3, '1:1 with Maya', 'personal', 'var(--ax-viz-cyan)', '2026-06-04T11:00', '1:1 Maya', '2026-06-04T11:30', false, '11:00'), e(4, 'Release review', 'work', 'var(--ax-accent)', '2026-06-04T16:00', 'Release', '2026-06-04T17:00', false, '16:00')] },
    { day: 5, date: '2026-06-05', events: [] },
    { day: 6, date: '2026-06-06', events: [e(5, 'Cabin weekend', 'personal', 'var(--ax-viz-amber)', '2026-06-06', 'Cabin trip', '2026-06-07', true)] },
    { day: 7, date: '2026-06-07', events: [] },
    { day: 8, date: '2026-06-08', events: [] },
  ],
  [
    { day: 9, date: '2026-06-09', events: [e(6, 'Roadmap sync', 'work', 'var(--ax-accent)', '2026-06-09T10:00', 'Roadmap', '2026-06-09T11:00', false, '10:00')] },
    { day: 10, date: '2026-06-10', events: [] },
    { day: 11, date: '2026-06-11', events: [e(7, 'Brand workshop', 'design', 'var(--ax-viz-violet)', '2026-06-11T13:00', 'Workshop', '2026-06-11T15:00', false, '13:00')] },
    { day: 12, date: '2026-06-12', events: [e(8, 'All-hands', 'work', 'var(--ax-accent)', '2026-06-12T15:00', 'All-hands', '2026-06-12T16:00', false, '15:00')] },
    { day: 13, date: '2026-06-13', events: [] },
    { day: 14, date: '2026-06-14', events: [] },
    { day: 15, date: '2026-06-15', events: [] },
  ],
  [
    { day: 16, date: '2026-06-16', events: [e(9, 'Yearly checkup', 'personal', 'var(--ax-viz-cyan)', '2026-06-16T09:00', 'Checkup', '2026-06-16T10:00', false, '09:00')] },
    { day: 17, date: '2026-06-17', events: [] },
    { day: 18, date: '2026-06-18', more: '+2 more', events: [e(10, 'QA sign-off', 'work', 'var(--ax-accent)', '2026-06-18T11:00', 'QA sign-off', '2026-06-18T12:00', false, '11:00'), e(11, 'Icon review', 'design', 'var(--ax-viz-violet)', '2026-06-18T14:00', 'Icons', '2026-06-18T15:00', false, '14:00')] },
    { day: 19, date: '2026-06-19', events: [] },
    { day: 20, date: '2026-06-20', events: [] },
    { day: 21, date: '2026-06-21', events: [e(12, "Father's Day", 'holiday', 'var(--ax-viz-amber)', '2026-06-21', "Father's Day", undefined, true)] },
    { day: 22, date: '2026-06-22', events: [] },
  ],
  [
    { day: 23, date: '2026-06-23', events: [e(13, 'Customer call — Northwind', 'work', 'var(--ax-accent)', '2026-06-23T10:30', 'Northwind', '2026-06-23T11:00', false, '10:30')] },
    { day: 24, date: '2026-06-24', events: [] },
    { day: 25, date: '2026-06-25', events: [e(14, 'Portfolio review', 'design', 'var(--ax-viz-violet)', '2026-06-25T15:30', 'Portfolio', '2026-06-25T16:30', false, '15:30')] },
    { day: 26, date: '2026-06-26', events: [] },
    { day: 27, date: '2026-06-27', today: true, events: [e(15, 'Sprint planning', 'work', 'var(--ax-accent)', '2026-06-27T10:00', 'Sprint planning', '2026-06-27T11:00', false, '10:00'), e(16, 'Design critique', 'design', 'var(--ax-viz-violet)', '2026-06-27T14:30', 'Critique', '2026-06-27T15:30', false, '14:30')] },
    { day: 28, date: '2026-06-28', events: [e(17, 'Dentist', 'personal', 'var(--ax-viz-cyan)', '2026-06-28T09:00', 'Dentist', '2026-06-28T09:45', false, '09:00')] },
    { day: 29, date: '2026-06-29', events: [] },
  ],
  [
    { day: 30, date: '2026-06-30', events: [e(18, 'Month-end review', 'work', 'var(--ax-accent)', '2026-06-30T16:00', 'Month-end', '2026-06-30T17:00', false, '16:00')] },
    { day: 1, date: '2026-07-01', muted: true, events: [] },
    { day: 2, date: '2026-07-02', muted: true, events: [] },
    { day: 3, date: '2026-07-03', muted: true, events: [] },
    { day: 4, date: '2026-07-04', muted: true, events: [] },
    { day: 5, date: '2026-07-05', muted: true, events: [] },
    { day: 6, date: '2026-07-06', muted: true, events: [] },
  ],
];

const MINI_DAYS = [4, 12, 18, 23];

export function Calendar() {
  const [view, setView] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<Ev>(EMPTY);

  const openNew = (date?: string) => {
    const d = date || '2026-06-27';
    setEditor({ id: null, title: '', cat: 'work', start: `${d}T10:00`, end: `${d}T11:00`, allday: false, repeat: 'none', location: '', desc: '' });
    setEditorOpen(true);
  };
  const openEdit = (ev: EvShort) => {
    setEditor({ allday: false, repeat: 'none', location: '', desc: '', id: ev.id, title: ev.title, cat: ev.cat, start: ev.start, end: ev.end, ...(ev.allday ? { allday: true } : {}) });
    setEditorOpen(true);
  };
  const patch = (p: Partial<Ev>) => setEditor((prev) => ({ ...prev, ...p }));

  return (
    <>
      <PageHead
        title="Calendar"
        subtitle="June 2026 — 6 events scheduled this week across your calendars."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
              <span className="ax-btn__label">Trash</span>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => openNew()}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New event</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <aside className="ax-card ax-col--3" role="region" aria-label="Calendar navigation">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block" onClick={() => openNew()}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 21h-6.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v5" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>
              <span className="ax-btn__label">Create event</span>
            </button>

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <b style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)' }}>June 2026</b>
                <span className="ax-cluster" style={{ gap: 2 }}>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous month"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next month"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <small key={i} style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 0' }}>{d}</small>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center' }}>
                {[26, 27, 28, 29, 30, 31].map((n) => (
                  <span key={n} className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', padding: '5px 0' }}>{n}</span>
                ))}
                {Array.from({ length: 30 }, (_, idx) => idx + 1).map((n) => (
                  <button key={n} type="button" className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', padding: '5px 0', border: 0, cursor: 'pointer', borderRadius: 'var(--ax-radius-sm)', ...(n === 27 ? { background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', fontWeight: 600 } : MINI_DAYS.includes(n) ? { color: 'var(--ax-text-strong)', background: 'var(--ax-accent-wash)' } : { color: 'var(--ax-text)', background: 'transparent' }) }} onClick={() => openNew(`2026-06-${String(n).padStart(2, '0')}`)}>{n}</button>
                ))}
              </div>
            </div>

            <hr className="ax-divider" style={{ margin: 0, border: 0, borderTop: '1px solid var(--ax-border)' }} />

            <div>
              <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-3)' }}>My calendars</small>
              <ul className="ax-list ax-list--compact">
                {[
                  { name: 'Work', color: 'var(--ax-accent)', count: 12, checked: true, accent: true },
                  { name: 'Personal', color: 'var(--ax-viz-cyan)', count: 5, checked: true },
                  { name: 'Design team', color: 'var(--ax-viz-violet)', count: 8, checked: true },
                  { name: 'Holidays', color: 'var(--ax-viz-amber)', count: 3, checked: false },
                ].map((c) => (
                  <li key={c.name} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                    <span className="ax-list__leading"><input type="checkbox" className="ax-checkbox" defaultChecked={c.checked} style={c.accent ? { accentColor: 'var(--ax-accent)' } : undefined} /></span>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: c.color }} />{c.name}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <hr className="ax-divider" style={{ margin: 0, border: 0, borderTop: '1px solid var(--ax-border)' }} />

            <div>
              <small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 'var(--ax-space-3)' }}>Upcoming</small>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {[
                  { title: 'Sprint planning', when: 'Today · 10:00 AM', color: 'var(--ax-accent)' },
                  { title: 'Design critique', when: 'Today · 2:30 PM', color: 'var(--ax-viz-violet)' },
                  { title: 'Dentist appointment', when: 'Tomorrow · 9:00 AM', color: 'var(--ax-viz-cyan)' },
                ].map((u) => (
                  <div key={u.title} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <span style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: u.color, flex: '0 0 auto' }} />
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{u.title}</div>
                      <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{u.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="ax-card ax-col--9" role="region" aria-label="Month calendar">
          <div className="ax-card__header">
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 2 }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous period"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">Today</button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next period"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </span>
              <h2 className="ax-card__title" style={{ margin: 0 }}>June 2026</h2>
            </div>
            <div className="ax-card__actions">
              <div className="ax-segment" role="radiogroup" aria-label="Calendar view">
                {(['month', 'week', 'day', 'list'] as const).map((v) => (
                  <button key={v} type="button" className={`ax-segment__option${view === v ? ' is-active' : ''}`} role="radio" aria-checked={view === v} onClick={() => setView(v)}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                ))}
              </div>
            </div>
          </div>

          {view === 'month' && (
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) 0 0', overflow: 'hidden' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                  <div key={d} style={{ padding: 'var(--ax-space-2) var(--ax-space-3)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ax-text-subtle)', textAlign: 'center', background: 'var(--ax-surface-subtle)', ...(i < 6 ? { borderInlineEnd: '1px solid var(--ax-border)' } : {}) }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', borderInline: '1px solid var(--ax-border)', borderBlockEnd: '1px solid var(--ax-border)', borderRadius: '0 0 var(--ax-radius-md) var(--ax-radius-md)', overflow: 'hidden' }}>
                {WEEKS.flat().map((cell) => (
                  <button key={cell.date} type="button" className={`ax-cal-cell${cell.today ? ' ax-cal-cell--today' : ''}`} onClick={() => openNew(cell.date)}>
                    <span className={`ax-cal-cell__n ax-num${cell.muted ? ' ax-cal-cell__n--muted' : ''}${cell.today ? ' ax-cal-cell__n--today' : ''}`}>{cell.day}</span>
                    {cell.today && <span className="ax-cal-now" aria-hidden="true" />}
                    {cell.events.map((ev) => (
                      <span key={ev.id} className="ax-cal-event" style={{ ['--c' as string]: ev.color }} onClick={(evt) => { evt.stopPropagation(); openEdit(ev); }}>
                        {ev.time && <b className="ax-num">{ev.time}</b>}{ev.time ? ` ${ev.label}` : ev.label}
                      </span>
                    ))}
                    {cell.more && <span className="ax-cal-more">{cell.more}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view !== 'month' && (
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <p className="ax-card__subtitle" style={{ marginBottom: 'var(--ax-space-4)' }}>{view === 'list' ? 'Agenda — upcoming events' : `${view.charAt(0).toUpperCase() + view.slice(1)} view`}</p>
              <ul className="ax-list">
                <li className="ax-list__row">
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title">Sprint planning</span><span className="ax-list__meta">Work · Conference room B</span></span>
                  <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Today · 10:00 AM</span>
                </li>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title">Design critique</span><span className="ax-list__meta">Design team · Figjam</span></span>
                  <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Today · 2:30 PM</span>
                </li>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-cyan)' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title">Dentist appointment</span><span className="ax-list__meta">Personal · Bright Smile Clinic</span></span>
                  <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Tomorrow · 9:00 AM</span>
                </li>
                <li className="ax-list__row">
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title">Month-end review</span><span className="ax-list__meta">Work · Zoom</span></span>
                  <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Jun 30 · 4:00 PM</span>
                </li>
              </ul>
            </div>
          )}
        </section>
      </div>

      {editorOpen && (
        <div className="ax-modal-scrim" onClick={() => setEditorOpen(false)}>
          <div className="ax-card" role="dialog" aria-modal="true" aria-label="Event editor" onClick={(ev) => ev.stopPropagation()} style={{ width: 'min(520px,100%)', maxHeight: '84vh', overflow: 'auto' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">{editor.id ? 'Edit event' : 'New event'}</h2>
              </div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Close editor" onClick={() => setEditorOpen(false)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <form className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} onSubmit={(ev) => { ev.preventDefault(); setEditorOpen(false); }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ev-title">Title</label>
                <input id="ev-title" type="text" className="ax-input" value={editor.title} onChange={(ev) => patch({ title: ev.target.value })} placeholder="Add a title" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ev-cat">Calendar</label>
                  <select id="ev-cat" className="ax-select" value={editor.cat} onChange={(ev) => patch({ cat: ev.target.value })}>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="design">Design team</option>
                    <option value="holiday">Holidays</option>
                  </select>
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ev-repeat">Repeat</label>
                  <select id="ev-repeat" className="ax-select" value={editor.repeat} onChange={(ev) => patch({ repeat: ev.target.value })}>
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={!!editor.allday} onChange={(ev) => patch({ allday: ev.target.checked })} />
                <span style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)' }}>All-day event</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ev-start">Starts</label>
                  <input id="ev-start" type="datetime-local" className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} value={editor.start} onChange={(ev) => patch({ start: ev.target.value })} />
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ev-end">Ends</label>
                  <input id="ev-end" type="datetime-local" className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} value={editor.end} onChange={(ev) => patch({ end: ev.target.value })} />
                </div>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ev-loc">Location</label>
                <input id="ev-loc" type="text" className="ax-input" value={editor.location} onChange={(ev) => patch({ location: ev.target.value })} placeholder="Add a location or video link" />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ev-desc">Description</label>
                <textarea id="ev-desc" className="ax-textarea" rows={3} value={editor.desc} onChange={(ev) => patch({ desc: ev.target.value })} placeholder="Add notes, agenda or links" />
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
                {editor.id && (
                  <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setEditorOpen(false)} style={{ color: 'var(--ax-danger-500)' }}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                    <span className="ax-btn__label">Delete</span>
                  </button>
                )}
                <span style={{ flex: '1 1 auto' }} />
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setEditorOpen(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Save event</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .ax-modal-scrim { position:fixed; inset:0; z-index:120; display:flex; align-items:flex-start; justify-content:center; padding:8vh var(--ax-space-5); background:var(--ax-backdrop); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px); }
        .ax-cal-cell { position:relative; display:flex; flex-direction:column; gap:3px; align-items:stretch; text-align:left; min-height:104px; padding:var(--ax-space-2); background:var(--ax-surface-solid); border:0; border-inline-end:1px solid var(--ax-border); border-block-start:1px solid var(--ax-border); cursor:pointer; transition:background var(--ax-motion-instant) var(--ax-ease-standard); }
        .ax-cal-cell:nth-child(7n) { border-inline-end:0; }
        .ax-cal-cell:hover { background:var(--ax-fill-hover); }
        .ax-cal-cell--today { background:var(--ax-accent-wash); }
        .ax-cal-cell__n { align-self:flex-start; font-family:var(--ax-font-mono); font-size:var(--ax-text-xs); color:var(--ax-text-strong); padding:1px 2px; }
        .ax-cal-cell__n--muted { color:var(--ax-text-subtle); }
        .ax-cal-cell__n--today { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:22px; border-radius:var(--ax-radius-pill); background:var(--ax-accent); color:var(--ax-on-accent); font-weight:600; }
        .ax-cal-now { position:absolute; inset-inline:0; top:38px; height:2px; background:var(--ax-accent); }
        .ax-cal-now::before { content:""; position:absolute; inset-inline-start:0; top:-3px; width:8px; height:8px; border-radius:50%; background:var(--ax-accent); }
        .ax-cal-event { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:2px 7px; font-size:var(--ax-text-xs); color:var(--ax-text-strong); border-radius:var(--ax-radius-sm); background:color-mix(in oklab, var(--c) 16%, transparent); border-inline-start:3px solid var(--c); cursor:pointer; }
        .ax-cal-event b { font-family:var(--ax-font-mono); font-weight:600; color:var(--c); margin-inline-end:3px; }
        .ax-cal-event:hover { background:color-mix(in oklab, var(--c) 26%, transparent); }
        .ax-cal-more { font-size:var(--ax-text-2xs); color:var(--ax-text-muted); padding:1px 7px; font-weight:var(--ax-weight-medium); }
        @media (max-width:768px){ .ax-cal-cell { min-height:74px; } }
      `}</style>
    </>
  );
}

export default Calendar;
