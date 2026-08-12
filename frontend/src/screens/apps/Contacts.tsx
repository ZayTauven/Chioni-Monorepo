'use client';
/*
 * Vireo Next.js — Contacts app (apps/contacts).
 * Faithful re-expression of src/html/apps/contacts.html: toolbar (search/group/
 * sort/view), grid + list views, a contact detail drawer, and an add-contact
 * modal with validation. Alpine axContacts() → React useState; DOM/ARIA match 1:1.
 */
import { useEffect, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Contact {
  id: number; name: string; role: string; company: string; initials: string;
  color: string; presence: string; tag: string; groupColor: string; email: string;
  phone: string; location: string; fav: boolean; tags: string[]; notes: string;
}
interface Form { name: string; role: string; company: string; email: string; phone: string; tag: string }

const SEED: Contact[] = [
  { id: 1, name: 'Maya Lindqvist', role: 'CFO', company: 'Northwind', initials: 'ML', color: '#34D399', presence: 'online', tag: 'Clients', groupColor: '#38BDF8', email: 'maya.l@northwind.co', phone: '+1 (415) 555-0188', location: 'San Francisco, CA', fav: true, tags: ['Decision maker', 'Finance', 'VIP'], notes: 'Primary finance contact on the Q3 retainer. Prefers morning calls (PT).' },
  { id: 2, name: 'Devon Okafor', role: 'Engineering Lead', company: 'Vireo', initials: 'DO', color: '#38BDF8', presence: 'online', tag: 'Team', groupColor: '#34D399', email: 'devon@vireo.app', phone: '+1 (628) 555-0143', location: 'Remote · Lagos', fav: false, tags: ['Frontend', 'On-call'], notes: 'Owns the design-system migration. Reach via chat for anything urgent.' },
  { id: 3, name: 'Tomás Herrera', role: 'Account Director', company: 'Brightline', initials: 'TH', color: '#A78BFA', presence: 'away', tag: 'Clients', groupColor: '#38BDF8', email: 'tomas@brightline.io', phone: '+34 612 55 01 77', location: 'Madrid, ES', fav: true, tags: ['Contract', 'Renewal Q3'], notes: 'Negotiating the SLA window. Follow up Friday on section 4.2.' },
  { id: 4, name: 'Priya Nair', role: 'Data Analyst', company: 'Vireo', initials: 'PN', color: '#FBBF24', presence: 'away', tag: 'Team', groupColor: '#34D399', email: 'priya@vireo.app', phone: '+91 98765 43210', location: 'Bengaluru, IN', fav: false, tags: ['Analytics', 'Reporting'], notes: 'Sends the weekly digest every Monday at 8 AM.' },
  { id: 5, name: 'Lena Brandt', role: 'Brand Designer', company: 'Studioform', initials: 'LB', color: '#F472B6', presence: 'offline', tag: 'Vendors', groupColor: '#FBBF24', email: 'lena@studioform.de', phone: '+49 30 5550 0199', location: 'Berlin, DE', fav: false, tags: ['Illustration', 'Contract'], notes: 'Delivering empty-state illustrations. Invoices via Receipts label.' },
  { id: 6, name: 'Daniel Cho', role: 'Product Manager', company: 'Loop', initials: 'DC', color: '#FB7185', presence: 'offline', tag: 'Clients', groupColor: '#38BDF8', email: 'daniel@loop.com', phone: '+1 (212) 555-0166', location: 'New York, NY', fav: false, tags: ['Roadmap'], notes: 'Casual contact — usually catches up over lunch.' },
  { id: 7, name: 'Ava Sutton', role: 'Marketing Lead', company: 'Vireo', initials: 'AS', color: '#34D399', presence: 'online', tag: 'Team', groupColor: '#34D399', email: 'ava@vireo.app', phone: '+1 (310) 555-0120', location: 'Los Angeles, CA', fav: true, tags: ['Campaigns', 'Email'], notes: 'Owns the launch campaign going live at noon.' },
  { id: 8, name: 'Henry Whitlock', role: 'Procurement', company: 'Crate & Co', initials: 'HW', color: '#38BDF8', presence: 'offline', tag: 'Vendors', groupColor: '#FBBF24', email: 'henry@crateco.com', phone: '+44 20 7946 0102', location: 'London, UK', fav: false, tags: ['Hardware', 'Supplier'], notes: 'Supplies office hardware. Net-30 terms.' },
];

const GROUPS = ['All', 'Team', 'Clients', 'Vendors', 'Favorites'];
const EMPTY_FORM: Form = { name: '', role: '', company: '', email: '', phone: '', tag: 'Team' };

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>(SEED);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [group, setGroup] = useState('All');
  const [sort, setSort] = useState('name');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const filtered = (() => {
    let list = [...contacts];
    if (group === 'Favorites') list = list.filter((c) => c.fav);
    else if (group !== 'All') list = list.filter((c) => c.tag === group);
    if (q.trim()) { const s = q.toLowerCase(); list = list.filter((c) => (c.name + c.company + c.email).toLowerCase().includes(s)); }
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'company') list.sort((a, b) => a.company.localeCompare(b.company));
    if (sort === 'recent') list.sort((a, b) => b.id - a.id);
    return list;
  })();
  const active = detail ? contacts.find((c) => c.id === detail) ?? null : null;
  const toggleFav = (id: number) => setContacts((p) => p.map((c) => (c.id === id ? { ...c, fav: !c.fav } : c)));

  const saveContact = () => {
    const errs: { name?: string; email?: string } = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!form.email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const colors = ['#34D399', '#38BDF8', '#A78BFA', '#F472B6', '#FBBF24', '#FB7185'];
    const gc = form.tag === 'Team' ? '#34D399' : form.tag === 'Vendors' ? '#FBBF24' : '#38BDF8';
    const newContact: Contact = {
      id: Date.now(), name: form.name, role: form.role || '—', company: form.company || '—',
      initials: form.name.trim().split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
      color: colors[Math.floor(Math.random() * colors.length)], presence: 'offline',
      tag: form.tag, groupColor: gc, email: form.email, phone: form.phone || '—',
      location: '—', fav: false, tags: [form.tag], notes: 'Newly added contact.',
    };
    setContacts((p) => [newContact, ...p]);
    setAddOpen(false);
    setForm(EMPTY_FORM);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDetail(null);
      setAddOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <PageHead
        title="Contacts"
        subtitle={`${contacts.length} people across teams, clients and vendors.`}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setAddOpen(true)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add contact</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <div className="ax-card ax-col--12 ax-card--compact" role="region" aria-label="Contacts toolbar">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
            <div className="ax-field__control" style={{ flex: '1 1 280px', minWidth: 200 }}>
              <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
              <input type="search" className="ax-input ax-input--sm ax-input--with-leading-icon" placeholder="Search by name, company or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
            </div>
            <div className="ax-segment" role="tablist" aria-label="Filter by group">
              {GROUPS.map((g) => (
                <button key={g} type="button" role="tab" className="ax-segment__option" aria-checked={group === g} onClick={() => setGroup(g)}>{g}</button>
              ))}
            </div>
            <span style={{ flex: '1 1 auto' }} />
            <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort contacts" style={{ width: 150 }}>
              <option value="name">Name A–Z</option>
              <option value="company">Company</option>
              <option value="recent">Recently added</option>
            </select>
            <div className="ax-segment" role="group" aria-label="View mode">
              <button type="button" className="ax-segment__option ax-btn--icon" aria-checked={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view"><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg></button>
              <button type="button" className="ax-segment__option ax-btn--icon" aria-checked={view === 'list'} onClick={() => setView('list')} aria-label="List view"><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
            </div>
          </div>
        </div>

        {view === 'grid' && (
          <div className="ax-col--12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(248px,1fr))', gap: 'var(--ax-space-6)' }}>
            {filtered.map((c) => (
              <article key={c.id} className={`ax-card ax-card--interactive${detail === c.id ? ' is-selected' : ''}`} onClick={() => setDetail(c.id)} style={{ cursor: 'pointer', textAlign: 'center' }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setDetail(c.id); }} aria-label={`Open ${c.name}`}>
                <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-3)', position: 'relative' }}>
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleFav(c.id); }} className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={c.fav ? 'Unfavorite' : 'Favorite'} aria-pressed={c.fav} style={{ position: 'absolute', top: 0, insetInlineEnd: 0, ...(c.fav ? { color: 'var(--ax-viz-amber)' } : {}) }}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={c.fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                  </button>
                  <span style={{ position: 'relative' }}>
                    <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.color} 18%,transparent)`, color: c.color }}><b style={{ fontSize: 'var(--ax-text-lg)' }}>{c.initials}</b></span>
                    <span className={`ax-avatar__status ax-avatar__status--${c.presence}`} style={{ insetBlockEnd: 2, insetInlineEnd: 2, boxShadow: '0 0 0 2px var(--ax-surface-solid)' }} />
                  </span>
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="ax-text-truncate" style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>{c.name}</div>
                    <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.role} · {c.company}</div>
                  </div>
                  <span className="ax-badge ax-badge--soft ax-badge--sm ax-badge--pill" style={{ color: c.groupColor }}><span className="ax-badge__dot" style={{ background: c.groupColor }} /><span>{c.tag}</span></span>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-1)' }}>
                    <a className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} aria-label="Email"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></a>
                    <a className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} aria-label="Call"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></a>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" onClick={(e) => { e.stopPropagation(); setDetail(c.id); }} aria-label="View details"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {view === 'list' && (
          <section className="ax-card ax-col--12" role="region" aria-label="Contacts list">
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Name</th>
                    <th className="ax-table__th" scope="col">Company</th>
                    <th className="ax-table__th" scope="col">Email</th>
                    <th className="ax-table__th" scope="col">Phone</th>
                    <th className="ax-table__th" scope="col">Group</th>
                    <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={`ax-table__row${detail === c.id ? ' is-selected' : ''}`} onClick={() => setDetail(c.id)} style={{ cursor: 'pointer' }}>
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span style={{ position: 'relative', flex: '0 0 auto' }}>
                            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.color} 18%,transparent)`, color: c.color }}><b style={{ fontSize: 10 }}>{c.initials}</b></span>
                            <span className={`ax-avatar__status ax-avatar__status--${c.presence}`} />
                          </span>
                          <div style={{ minWidth: 0 }}><div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>{c.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.role}</div></div>
                        </div>
                      </td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{c.company}</td>
                      <td className="ax-table__td"><a className="ax-link ax-num" href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>{c.email}</a></td>
                      <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{c.phone}</td>
                      <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--sm ax-badge--pill" style={{ color: c.groupColor }}><span className="ax-badge__dot" style={{ background: c.groupColor }} /><span>{c.tag}</span></span></td>
                      <td className="ax-table__td" style={{ textAlign: 'end' }}>
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={(e) => { e.stopPropagation(); toggleFav(c.id); }} style={c.fav ? { color: 'var(--ax-viz-amber)' } : undefined} aria-label={c.fav ? 'Unfavorite' : 'Favorite'}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill={c.fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {filtered.length === 0 && <p className="ax-col--12" style={{ textAlign: 'center', color: 'var(--ax-text-subtle)', padding: 'var(--ax-space-10)' }}>No contacts match your search.</p>}
      </div>

      {detail && active && (
        <div>
          <div className="ax-backdrop" onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.4)' }} />
          <aside role="dialog" aria-modal="true" aria-label={active.name} className="ax-scroll-y ax-drawer-enter" style={{ position: 'fixed', insetBlock: 0, insetInlineEnd: 0, width: 'min(420px,100vw)', zIndex: 51, background: 'var(--ax-surface-solid)', borderInlineStart: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow-lg)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: 'var(--ax-space-4) var(--ax-space-5)', borderBottom: '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <b style={{ color: 'var(--ax-text-strong)' }}>Contact details</b>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setDetail(null)} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>

              <div style={{ padding: 'var(--ax-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)', textAlign: 'center' }}>
                  <span style={{ position: 'relative' }}>
                    <span className="ax-avatar ax-avatar--2xl ax-avatar--squircle" style={{ background: `color-mix(in oklab,${active.color} 18%,transparent)`, color: active.color }}><b style={{ fontSize: 'var(--ax-text-2xl)' }}>{active.initials}</b></span>
                    <span className={`ax-avatar__status ax-avatar__status--${active.presence}`} style={{ insetBlockEnd: 6, insetInlineEnd: 6, boxShadow: '0 0 0 2px var(--ax-surface-solid)' }} />
                  </span>
                  <div><div style={{ fontWeight: 700, fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}>{active.name}</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{active.role} · {active.company}</div></div>
                  <span className="ax-badge ax-badge--soft ax-badge--sm ax-badge--pill" style={{ color: active.groupColor }}><span className="ax-badge__dot" style={{ background: active.groupColor }} /><span>{active.tag}</span></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--ax-space-2)' }}>
                  <a className="ax-btn ax-btn--secondary ax-btn--sm" href={`mailto:${active.email}`} style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-3) 0', gap: 4 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg><span style={{ fontSize: 'var(--ax-text-2xs)' }}>Email</span></a>
                  <a className="ax-btn ax-btn--secondary ax-btn--sm" href={`tel:${active.phone}`} style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-3) 0', gap: 4 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg><span style={{ fontSize: 'var(--ax-text-2xs)' }}>Call</span></a>
                  <a className="ax-btn ax-btn--secondary ax-btn--sm" href="/apps/chat" style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-3) 0', gap: 4 }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg><span style={{ fontSize: 'var(--ax-text-2xs)' }}>Chat</span></a>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => toggleFav(active.id)} style={{ flexDirection: 'column', height: 'auto', padding: 'var(--ax-space-3) 0', gap: 4, ...(active.fav ? { color: 'var(--ax-viz-amber)' } : {}) }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill={active.fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg><span style={{ fontSize: 'var(--ax-text-2xs)' }}>Favorite</span></button>
                </div>

                <hr className="ax-divider" />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-fill-hover)', color: 'var(--ax-text-muted)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Email</div><a className="ax-link ax-num" href={`mailto:${active.email}`} style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)' }}>{active.email}</a></div>
                  </div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-fill-hover)', color: 'var(--ax-text-muted)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Phone</div><a className="ax-link ax-num" href={`tel:${active.phone}`} style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)' }}>{active.phone}</a></div>
                  </div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-fill-hover)', color: 'var(--ax-text-muted)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg></span>
                    <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Location</div><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{active.location}</span></div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 'var(--ax-space-2)' }}>Tags</div>
                  <div className="ax-cluster" style={{ gap: 6 }}>
                    {active.tags.map((t) => (
                      <span key={t} className="ax-badge ax-badge--soft ax-badge--sm" style={{ borderRadius: 'var(--ax-radius-xs)' }}>{t}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 'var(--ax-space-2)' }}>Notes</div>
                  <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>{active.notes}</p>
                </div>

                <hr className="ax-divider" />

                <div>
                  <div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 'var(--ax-space-3)' }}>Recent activity</div>
                  <ul className="ax-timeline">
                    <li className="ax-timeline__item ax-timeline__item--success"><span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span><div className="ax-timeline__content"><p className="ax-timeline__title">Replied to your email</p><span className="ax-timeline__time">2h ago</span></div></li>
                    <li className="ax-timeline__item"><span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span><div className="ax-timeline__content"><p className="ax-timeline__title">Call · 14 min</p><span className="ax-timeline__time">Yesterday</span></div></li>
                    <li className="ax-timeline__item"><span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg></span><div className="ax-timeline__content"><p className="ax-timeline__title">Added to <span style={{ color: 'var(--ax-text)' }}>Q3 retainer</span></p><span className="ax-timeline__time">Apr 22</span></div></li>
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: 'auto', padding: 'var(--ax-space-4) var(--ax-space-6)', borderTop: '1px solid var(--ax-border)', display: 'flex', gap: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--block"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg><span className="ax-btn__label">Edit</span></button>
                <button type="button" className="ax-btn ax-btn--soft-danger ax-btn--icon" aria-label="Delete contact"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {addOpen && (
        <div>
          <div className="ax-backdrop" onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.4)' }} />
          <div role="dialog" aria-modal="true" aria-label="Add contact" style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-4)' }}>
            <form className="ax-card" onSubmit={(e) => { e.preventDefault(); saveContact(); }} onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Add contact</h2></div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setAddOpen(false)} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="nc-name">Full name <span className="ax-field__required" aria-hidden="true">*</span></label>
                  <input id="nc-name" type="text" className={`ax-input${errors.name ? ' is-invalid' : ''}`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-invalid={errors.name ? 'true' : 'false'} placeholder="Jane Cooper" />
                  {errors.name && <span className="ax-field__message ax-field__message--error">{errors.name}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="nc-role">Role</label><input id="nc-role" type="text" className="ax-input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Designer" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="nc-company">Company</label><input id="nc-company" type="text" className="ax-input" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Acme Inc." /></div>
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="nc-email">Email <span className="ax-field__required" aria-hidden="true">*</span></label>
                  <input id="nc-email" type="email" className={`ax-input${errors.email ? ' is-invalid' : ''}`} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} aria-invalid={errors.email ? 'true' : 'false'} placeholder="jane@acme.com" />
                  {errors.email && <span className="ax-field__message ax-field__message--error">{errors.email}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="nc-phone">Phone</label><input id="nc-phone" type="tel" className="ax-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="nc-group">Group</label><select id="nc-group" className="ax-select" value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}><option>Team</option><option>Clients</option><option>Vendors</option></select></div>
                </div>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Save contact</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .ax-drawer-enter { animation: ax-drawer-in var(--ax-motion-base) var(--ax-ease-standard); }
        @keyframes ax-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { .ax-drawer-enter { animation: none; } }
      `}</style>
    </>
  );
}

export default Contacts;
