'use client';
/*
 * Vireo React — Events (route "pages/events").
 *
 * Faithful re-expression of src/html/pages/events.html (+ its inline axEvents()
 * store): a featured next-up event, a toolbar (search / time filter / card-list
 * view toggle), category chips, card + list views with persistent RSVP state
 * (ax:events:rsvp:* localStorage), a mini July-2026 calendar, an RSVP summary,
 * and a create-event modal with a simulated submit. Ported to React state 1:1.
 */
import { useMemo, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

type Rsvp = '' | 'going' | 'maybe' | 'no';
interface AxEvent { id: string; day: string; month: string; title: string; time: string; location: string; online: boolean; category: string; attendees: number; hostInitials: string; tint: string; when: 'upcoming' | 'past'; }

const TAG_CLASS: Record<string, string> = { Product: 'ax-badge--accent', Engineering: 'ax-badge--info', Design: 'ax-badge--success', Community: 'ax-badge--warning' };

const EVENTS: AxEvent[] = [
  { id: 'e1', day: '02', month: 'Jul', title: 'Aurora 2.4 Launch Webinar', time: '15:00 – 16:00', location: 'Online · Zoom', online: true, category: 'Product', attendees: 214, hostInitials: 'ML', tint: 'var(--ax-viz-cyan)', when: 'upcoming' },
  { id: 'e2', day: '05', month: 'Jul', title: 'Design Systems Critique', time: '11:00 – 12:30', location: 'Studio B, London', online: false, category: 'Design', attendees: 18, hostInitials: 'DO', tint: 'var(--ax-viz-violet)', when: 'upcoming' },
  { id: 'e3', day: '09', month: 'Jul', title: 'Performance Engineering AMA', time: '17:00 – 18:00', location: 'Online · Meet', online: true, category: 'Engineering', attendees: 96, hostInitials: 'PN', tint: 'var(--ax-viz-emerald)', when: 'upcoming' },
  { id: 'e4', day: '12', month: 'Jul', title: 'Community Meetup — Berlin', time: '19:00 – 22:00', location: 'Factory Berlin', online: false, category: 'Community', attendees: 140, hostInitials: 'TH', tint: 'var(--ax-viz-amber)', when: 'upcoming' },
  { id: 'e5', day: '18', month: 'Jul', title: 'Accessibility Workshop', time: '14:00 – 16:00', location: 'Online · Zoom', online: true, category: 'Design', attendees: 54, hostInitials: 'LB', tint: 'var(--ax-viz-pink)', when: 'upcoming' },
  { id: 'e6', day: '21', month: 'Jun', title: 'Q2 Roadmap Review', time: '10:00 – 11:00', location: 'HQ · Room 4', online: false, category: 'Product', attendees: 32, hostInitials: 'HW', tint: 'var(--ax-viz-cyan)', when: 'past' },
  { id: 'e7', day: '14', month: 'Jun', title: 'Charts Deep-Dive', time: '16:00 – 17:00', location: 'Online · Meet', online: true, category: 'Engineering', attendees: 72, hostInitials: 'AS', tint: 'var(--ax-viz-emerald)', when: 'past' },
];

const CATEGORIES = ['All', 'Product', 'Engineering', 'Design', 'Community'];

function loadRsvp(): Record<string, Rsvp> {
  const saved: Record<string, Rsvp> = {};
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('ax:events:rsvp:')) saved[k.replace('ax:events:rsvp:', '')] = localStorage.getItem(k) as Rsvp;
    });
  } catch { /* ignore */ }
  return saved;
}

const ICON_ONLINE = <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4" /><path d="M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /></svg>;
const ICON_PIN = <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg>;

interface Cell { key: string; day: number | ''; event: boolean; today: boolean; }
function buildCalendar(): Cell[] {
  const eventDays: Record<number, boolean> = { 2: true, 5: true, 9: true, 12: true, 18: true, 21: true };
  const firstDow = 2; // Jul 1 2026 is a Wednesday -> index 2 (Mon=0)
  const cells: Cell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ key: 'b' + i, day: '', event: false, today: false });
  for (let d = 1; d <= 31; d++) cells.push({ key: 'd' + d, day: d, event: !!eventDays[d], today: d === 2 });
  return cells;
}

export function Events() {
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [cat, setCat] = useState('All');
  const [search, setSearch] = useState('');
  const [rsvp, setRsvp] = useState<Record<string, Rsvp>>(loadRsvp);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '', category: 'Product' });

  const calendar = useMemo(buildCalendar, []);
  const featuredRsvp = rsvp['e1'] || '';

  const shown = useMemo(
    () => EVENTS.filter(
      (e) => (filter === 'all' || e.when === filter)
        && (cat === 'All' || e.category === cat)
        && (!search.trim() || e.title.toLowerCase().includes(search.toLowerCase()))
    ),
    [filter, cat, search]
  );

  const counts = useMemo(() => {
    const v = Object.values(rsvp);
    return { going: v.filter((x) => x === 'going').length, maybe: v.filter((x) => x === 'maybe').length, no: v.filter((x) => x === 'no').length };
  }, [rsvp]);

  const rsvpBump = (id: string) => (rsvp[id] === 'going' ? 1 : 0);

  const setEventRsvp = (id: string, v: Rsvp) => {
    setRsvp((cur) => {
      const next: Rsvp = cur[id] === v ? '' : v;
      const out = { ...cur, [id]: next };
      try {
        if (next) localStorage.setItem('ax:events:rsvp:' + id, next);
        else localStorage.removeItem('ax:events:rsvp:' + id);
      } catch { /* ignore */ }
      return out;
    });
  };
  const setFeatured = (v: Rsvp) => setEventRsvp('e1', v);

  const clearFilters = () => { setFilter('all'); setCat('All'); setSearch(''); };

  const createEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setTimeout(() => {
      setCreating(false);
      setCreated(true);
      setTimeout(() => {
        setCreateOpen(false);
        setCreated(false);
        setForm({ title: '', date: '', time: '', location: '', category: 'Product' });
      }, 1400);
    }, 700);
  };

  return (
    <>
      <PageHead
        title="Events"
        subtitle="Workshops, releases and team meetups — RSVP and add them to your calendar."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
              <span className="ax-btn__label">Subscribe</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setCreateOpen(true)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Create event</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Featured next-up event */}
        <section className="ax-card ax-card--accent-edge ax-col--12" role="region" aria-label="Next up event">
          <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 92, height: 92, borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 12px 26px -12px rgba(var(--ax-accent-rgb),.7)' }}>
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, lineHeight: 1 }}>02</span>
              <span style={{ fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.08em', opacity: 0.9 }}>Jul</span>
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-2)' }}>
                <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Next up</span>
                <span className="ax-badge ax-badge--outline ax-badge--sm">Product</span>
              </div>
              <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Aurora 2.4 Launch Webinar</h2>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', flexWrap: 'wrap' }}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v5l3 3" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg><span className="ax-num">15:00 – 16:00 BST</span></span>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4" /><path d="M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /></svg>Online · Zoom</span>
              </div>
            </div>
            <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', alignItems: 'flex-end' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <div className="ax-avatar-group">
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">ML</span></span>
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">DO</span></span>
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle ax-avatar__overflow">+212</span>
                </div>
              </div>
              <div className="ax-segment" role="radiogroup" aria-label="RSVP to Aurora 2.4 Launch Webinar">
                <button type="button" className={`ax-segment__option${featuredRsvp === 'going' ? ' is-active' : ''}`} aria-checked={featuredRsvp === 'going'} role="radio" onClick={() => setFeatured('going')} aria-label="RSVP Going to Aurora 2.4 Launch Webinar">Going</button>
                <button type="button" className={`ax-segment__option${featuredRsvp === 'maybe' ? ' is-active' : ''}`} aria-checked={featuredRsvp === 'maybe'} role="radio" onClick={() => setFeatured('maybe')} aria-label="RSVP Maybe to Aurora 2.4 Launch Webinar">Maybe</button>
                <button type="button" className={`ax-segment__option${featuredRsvp === 'no' ? ' is-active' : ''}`} aria-checked={featuredRsvp === 'no'} role="radio" onClick={() => setFeatured('no')} aria-label="RSVP Can't go to Aurora 2.4 Launch Webinar">Can't go</button>
              </div>
            </div>
          </div>
        </section>

        {/* Events list column */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* Toolbar */}
          <section className="ax-card" role="region" aria-label="Event filters">
            <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <form role="search" className="ax-input-group" aria-label="Search events" style={{ flex: '1 1 220px', height: 38, minWidth: 180 }} onSubmit={(e) => e.preventDefault()}>
                <span className="ax-input-group__addon" aria-hidden="true"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
                <input type="search" className="ax-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events…" aria-label="Search events" autoComplete="off" />
              </form>
              <div className="ax-segment" role="radiogroup" aria-label="Time filter">
                <button type="button" className={`ax-segment__option${filter === 'upcoming' ? ' is-active' : ''}`} aria-checked={filter === 'upcoming'} role="radio" onClick={() => setFilter('upcoming')}>Upcoming</button>
                <button type="button" className={`ax-segment__option${filter === 'past' ? ' is-active' : ''}`} aria-checked={filter === 'past'} role="radio" onClick={() => setFilter('past')}>Past</button>
                <button type="button" className={`ax-segment__option${filter === 'all' ? ' is-active' : ''}`} aria-checked={filter === 'all'} role="radio" onClick={() => setFilter('all')}>All</button>
              </div>
              <div className="ax-segment" role="radiogroup" aria-label="View mode">
                <button type="button" className={`ax-segment__option${view === 'cards' ? ' is-active' : ''}`} aria-checked={view === 'cards'} role="radio" onClick={() => setView('cards')} aria-label="Card view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg></button>
                <button type="button" className={`ax-segment__option${view === 'list' ? ' is-active' : ''}`} aria-checked={view === 'list'} role="radio" onClick={() => setView('list')} aria-label="List view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M5 6v.01" /><path d="M5 12v.01" /><path d="M5 18v.01" /></svg></button>
              </div>
            </div>
          </section>

          {/* Category chips */}
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }} role="group" aria-label="Category filter">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`ax-badge ax-badge--filter ax-badge--pill${cat === c ? ' is-selected' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>

          {/* CARD VIEW */}
          {view === 'cards' && (
            <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 'var(--ax-space-5)' }}>
              {shown.map((e) => (
                <article key={e.id} className="ax-card ax-card--interactive" role="region" aria-label={e.title} style={{ margin: 0 }}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', height: '100%' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: 'var(--ax-radius-md)', border: '1px solid var(--ax-border)', background: 'var(--ax-surface-subtle)' }}>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 700, lineHeight: 1, color: 'var(--ax-text-strong)' }}>{e.day}</span>
                        <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)' }}>{e.month}</span>
                      </div>
                      <span className={`ax-badge ax-badge--soft ax-badge--pill ${TAG_CLASS[e.category]}`}>{e.category}</span>
                    </div>
                    <div style={{ flex: '1 1 auto' }}>
                      <h3 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', lineHeight: 1.3 }}>{e.title}</h3>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v5l3 3" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg><span className="ax-num">{e.time}</span></div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', marginTop: 4, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                        {e.online ? ICON_ONLINE : ICON_PIN}
                        <span>{e.location}</span>
                      </div>
                    </div>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="ax-cluster" style={{ gap: 'var(--ax-space-1)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg><span className="ax-num">{e.attendees + rsvpBump(e.id)}</span> going</span>
                      <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: `color-mix(in oklab,${e.tint} 18%,transparent)`, color: e.tint }}><span className="ax-avatar__initials">{e.hostInitials}</span></span>
                    </div>
                    <div className="ax-segment" role="radiogroup" aria-label={`RSVP to ${e.title}`} style={{ width: '100%' }}>
                      <button type="button" className={`ax-segment__option${rsvp[e.id] === 'going' ? ' is-active' : ''}`} style={{ flex: 1 }} aria-checked={rsvp[e.id] === 'going'} role="radio" onClick={() => setEventRsvp(e.id, 'going')} aria-label={`RSVP Going to ${e.title}`}>Going</button>
                      <button type="button" className={`ax-segment__option${rsvp[e.id] === 'maybe' ? ' is-active' : ''}`} style={{ flex: 1 }} aria-checked={rsvp[e.id] === 'maybe'} role="radio" onClick={() => setEventRsvp(e.id, 'maybe')} aria-label={`RSVP Maybe to ${e.title}`}>Maybe</button>
                      <button type="button" className={`ax-segment__option${rsvp[e.id] === 'no' ? ' is-active' : ''}`} style={{ flex: 1 }} aria-checked={rsvp[e.id] === 'no'} role="radio" onClick={() => setEventRsvp(e.id, 'no')} aria-label={`RSVP Can't go to ${e.title}`}>Can't</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <section className="ax-card" role="region" aria-label="Events list">
              <div className="ax-table-wrap">
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col">Date</th>
                      <th className="ax-table__th" scope="col">Event</th>
                      <th className="ax-table__th" scope="col">Location</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Going</th>
                      <th className="ax-table__th" scope="col">RSVP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((e) => (
                      <tr key={'r' + e.id} className="ax-table__row">
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--ax-text-strong)' }}>{e.day}</b> <span>{e.month}</span></td>
                        <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{e.title}</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{e.time}</div></td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{e.location}</td>
                        <td className="ax-table__td ax-table__td--num ax-num">{e.attendees + rsvpBump(e.id)}</td>
                        <td className="ax-table__td">
                          <div className="ax-segment" role="radiogroup" aria-label={`RSVP to ${e.title}`}>
                            <button type="button" className={`ax-segment__option${rsvp[e.id] === 'going' ? ' is-active' : ''}`} aria-checked={rsvp[e.id] === 'going'} role="radio" onClick={() => setEventRsvp(e.id, 'going')} aria-label="Going">Going</button>
                            <button type="button" className={`ax-segment__option${rsvp[e.id] === 'maybe' ? ' is-active' : ''}`} aria-checked={rsvp[e.id] === 'maybe'} role="radio" onClick={() => setEventRsvp(e.id, 'maybe')} aria-label="Maybe">Maybe</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* filtered-empty */}
          {shown.length === 0 && (
            <section className="ax-card" role="region" aria-label="No events">
              <div className="ax-card__body" style={{ paddingBlock: 'var(--ax-space-9)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-4)' }}>
                <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, var(--ax-accent-wash), transparent 70%)' }}><svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M10 16l4 0" stroke="var(--ax-accent)" /></svg></span>
                <div><h3 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)' }}>No events match these filters</h3><p style={{ margin: 'var(--ax-space-2) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Try a different category or time range.</p></div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={clearFilters}><span className="ax-btn__label">Clear filters</span></button>
              </div>
            </section>
          )}
        </div>

        {/* Calendar mini + this week rail */}
        <div className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Mini calendar — July 2026">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">July 2026</h2></div>
              <div className="ax-card__actions">
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Previous month"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Next month"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={'dh' + i} style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-semibold)', paddingBlock: 4 }}>{d}</span>
                ))}
                {calendar.map((cell) => {
                  const tone: React.CSSProperties = cell.today
                    ? { background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', fontWeight: 600 }
                    : cell.event
                      ? { background: 'transparent', color: 'var(--ax-text-strong)', fontWeight: 600 }
                      : { background: 'transparent', color: 'var(--ax-text-muted)' };
                  return (
                    <button key={cell.key} type="button" className="ax-num" disabled={!cell.day}
                      style={{ aspectRatio: '1', display: 'grid', placeItems: 'center', border: 0, borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-xs)', position: 'relative', ...tone }}
                      aria-label={cell.day ? `July ${cell.day}${cell.event ? ', has events' : ''}` : 'empty'}>
                      <span>{cell.day}</span>
                      {cell.event && !cell.today && <span style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', background: 'var(--ax-accent)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="RSVP summary">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Your RSVPs</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-viz-emerald)' }}>{counts.going}</div><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Going</small></div>
              <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-viz-amber)' }}>{counts.maybe}</div><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Maybe</small></div>
              <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-subtle)' }}>{counts.no}</div><small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Declined</small></div>
            </div>
          </section>
        </div>
      </div>

      {/* CREATE EVENT MODAL */}
      {createOpen && (
        <div className="ax-modal ax-modal--centered" onKeyDown={(e) => { if (e.key === 'Escape') setCreateOpen(false); }} style={{ zIndex: 60 }}>
          <div className="ax-modal__backdrop" onClick={() => setCreateOpen(false)} />
          <div className="ax-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ev-modal-title">
            <div className="ax-modal__header">
              <h2 className="ax-modal__title" id="ev-modal-title">Create event</h2>
              <button type="button" className="ax-modal__close" onClick={() => setCreateOpen(false)} aria-label="Close dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={createEvent}>
              <div className="ax-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {created && (
                  <div className="ax-alert ax-alert--success" role="status" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                    <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
                    <div className="ax-alert__content"><p className="ax-alert__message">Event created — invitations sent to your team.</p></div>
                  </div>
                )}
                <div className="ax-field"><label className="ax-label" htmlFor="ev-title">Title</label><input id="ev-title" className="ax-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Design critique" required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ev-date">Date</label><input id="ev-date" type="date" className="ax-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ev-time">Start</label><input id="ev-time" type="time" className="ax-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></div>
                </div>
                <div className="ax-field"><label className="ax-label" htmlFor="ev-loc">Location</label><input id="ev-loc" className="ax-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Online or a place" /></div>
                <div className="ax-field"><label className="ax-label" htmlFor="ev-cat">Category</label>
                  <select id="ev-cat" className="ax-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Product</option><option>Engineering</option><option>Design</option><option>Community</option></select>
                </div>
              </div>
              <div className="ax-modal__footer">
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setCreateOpen(false)}><span className="ax-btn__label">Cancel</span></button>
                <button type="submit" className={`ax-btn ax-btn--primary${creating ? ' is-loading' : ''}`} aria-busy={creating}><span className="ax-btn__spinner" aria-hidden="true" /><span className="ax-btn__label">Create event</span></button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Events;
