'use client';
/*
 * Vireo Next.js — CRM / Contacts (route "crm/contacts").
 *
 * Faithful re-expression of src/html/crm/contacts.html: the CRM sub-nav over a
 * searchable, lifecycle-filtered, sortable contacts table with presence dots,
 * company chips, last-activity icons, per-row quick actions (email/call/note),
 * bulk-select, a fixed-positioned actions menu, an empty state, a paginated
 * footer with rows-per-page, and a New-contact modal. The Alpine x-data
 * (axCrmContacts) is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)',
};

const ACT_PATH: Record<string, string[]> = {
  email: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10', 'M3 7l9 6l9 -6'],
  call: ['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2'],
  meet: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  note: ['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'],
  deal: ['M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2', 'M12 3v3m0 12v3'],
};

interface Contact {
  id: string; name: string; role: string; company: string; coMark: string; coC: string;
  initials: string; c: string; presence: string; email: string; phone: string; life: string;
  lastAct: string; actIcon: string; actC: string; lastTime: string; lastDays: number;
}
const ROWS: Contact[] = [
  { id: 'c01', name: 'Maya Lindqvist', role: 'CFO', company: 'Northwind Labs', coMark: 'NW', coC: C.cyan, initials: 'ML', c: C.emerald, presence: 'online', email: 'maya.l@northwind.io', phone: '+1 (415) 555-0188', life: 'Customer', lastAct: 'Replied to email', actIcon: 'email', actC: C.emerald, lastTime: '2h', lastDays: 0 },
  { id: 'c02', name: 'Tomás Herrera', role: 'VP Sales', company: 'Brightline Capital', coMark: 'BC', coC: C.violet, initials: 'TH', c: C.violet, presence: 'away', email: 'tomas@brightline.co', phone: '+34 612 55 01 77', life: 'Opportunity', lastAct: 'Call · 14 min', actIcon: 'call', actC: C.cyan, lastTime: '5h', lastDays: 0 },
  { id: 'c03', name: 'Ava Sutton', role: 'Head of Ops', company: 'Crate & Co', coMark: 'CC', coC: C.amber, initials: 'AS', c: C.emerald, presence: 'online', email: 'ava@crateco.com', phone: '+1 (310) 555-0120', life: 'Customer', lastAct: 'Demo booked', actIcon: 'meet', actC: C.violet, lastTime: '1d', lastDays: 1 },
  { id: 'c04', name: 'Dr. Nadia Haddad', role: 'Procurement Lead', company: 'Meridian Health', coMark: 'MH', coC: C.pink, initials: 'NH', c: C.pink, presence: 'busy', email: 'n.haddad@meridianhealth.org', phone: '+33 4 91 55 02 10', life: 'Opportunity', lastAct: 'Note added', actIcon: 'note', actC: C.amber, lastTime: '1d', lastDays: 1 },
  { id: 'c05', name: 'Lena Brandt', role: 'Creative Director', company: 'Studioform', coMark: 'SF', coC: C.emerald, initials: 'LB', c: C.violet, presence: 'offline', email: 'lena@studioform.de', phone: '+49 30 5550 0199', life: 'Lead', lastAct: 'Email opened', actIcon: 'email', actC: C.emerald, lastTime: '2d', lastDays: 2 },
  { id: 'c06', name: 'Daniel Cho', role: 'Product Lead', company: 'Loop Robotics', coMark: 'LR', coC: C.cyan, initials: 'DC', c: C.cyan, presence: 'offline', email: 'daniel@looprobotics.com', phone: '+82 2 5550 0166', life: 'Customer', lastAct: 'Deal won', actIcon: 'deal', actC: C.emerald, lastTime: '3d', lastDays: 3 },
  { id: 'c07', name: 'Greta Hoffmann', role: 'Buyer', company: 'Pulse Media', coMark: 'PM', coC: C.violet, initials: 'GH', c: C.amber, presence: 'offline', email: 'greta.h@pulse.media', phone: '+49 40 5550 0144', life: 'Subscriber', lastAct: 'Form submitted', actIcon: 'note', actC: C.amber, lastTime: '4d', lastDays: 4 },
  { id: 'c08', name: 'Henry Whitlock', role: 'Procurement', company: 'Harbor Freight Co', coMark: 'HF', coC: C.amber, initials: 'HW', c: C.cyan, presence: 'offline', email: 'henry@harborfreight.co', phone: '+44 20 7946 0102', life: 'Opportunity', lastAct: 'Call · 6 min', actIcon: 'call', actC: C.cyan, lastTime: '5d', lastDays: 5 },
  { id: 'c09', name: 'Erik Lindqvist', role: 'CTO', company: 'Ridgeline Energy', coMark: 'RE', coC: C.pink, initials: 'EL', c: C.violet, presence: 'away', email: 'erik.l@ridgeline.energy', phone: '+46 40 555 0177', life: 'Lead', lastAct: 'Meeting held', actIcon: 'meet', actC: C.violet, lastTime: '6d', lastDays: 6 },
  { id: 'c10', name: 'Sofia Marchetti', role: 'Operations', company: 'Clearbox', coMark: 'CB', coC: C.cyan, initials: 'SM', c: C.emerald, presence: 'online', email: 'sofia.m@clearbox.app', phone: '+39 02 5550 0188', life: 'Customer', lastAct: 'Replied to email', actIcon: 'email', actC: C.emerald, lastTime: '8d', lastDays: 8 },
  { id: 'c11', name: 'Rahul Menon', role: 'Finance Manager', company: 'Postoak Insurance', coMark: 'PI', coC: C.emerald, initials: 'RM', c: C.amber, presence: 'offline', email: 'rahul.menon@postoak.com', phone: '+91 98765 43210', life: 'Subscriber', lastAct: 'Email opened', actIcon: 'email', actC: C.emerald, lastTime: '10d', lastDays: 10 },
  { id: 'c12', name: 'Aisha Bello', role: 'Category Buyer', company: 'Meadow Foods', coMark: 'MF', coC: C.amber, initials: 'AB', c: C.pink, presence: 'offline', email: 'aisha.bello@meadowfoods.co', phone: '+234 1 555 0143', life: 'Lead', lastAct: 'Note added', actIcon: 'note', actC: C.amber, lastTime: '12d', lastDays: 12 },
];

const lifeClass = (s: string) => ({ Customer: 'ax-badge--success', Opportunity: 'ax-badge--accent', Lead: 'ax-badge--info', Subscriber: 'ax-badge--neutral' } as Record<string, string>)[s] || 'ax-badge--neutral';

function SortGlyph({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }): ReactElement {
  if (!active) return <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.4 }}><path d="M8 9l4 -4l4 4" /><path d="M16 15l-4 4l-4 -4" /></svg>;
  return dir === 'asc'
    ? <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
    : <svg className="ax-table__sort" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;
}

export function Contacts() {
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [perPage, setPerPage] = useState(8);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'name' | 'company' | 'lastDays'>('lastDays');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = ROWS.filter((x) => {
      if (fStatus && x.life !== fStatus) return false;
      if (t && !(x.name.toLowerCase().includes(t) || x.company.toLowerCase().includes(t) || x.email.toLowerCase().includes(t))) return false;
      return true;
    });
    if (sort === 'name') return [...r].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'company') return [...r].sort((a, b) => a.company.localeCompare(b.company));
    const key = sort === 'recent' ? 'lastDays' : sortKey;
    const dir = sort === 'recent' ? 1 : (sortDir === 'asc' ? 1 : -1);
    return [...r].sort((a, b) => {
      const va = a[key as keyof Contact], vb = b[key as keyof Contact];
      return typeof va === 'number' && typeof vb === 'number' ? (va - vb) * dir : String(va).localeCompare(String(vb)) * dir;
    });
  }, [q, fStatus, sort, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);
  const rangeStart = filtered.length ? (safePage - 1) * perPage + 1 : 0;
  const rangeEnd = Math.min(safePage * perPage, filtered.length);

  const pageList = (): (number | '…')[] => {
    const tp = totalPages, p = safePage, out: (number | '…')[] = [];
    if (tp <= 7) { for (let i = 1; i <= tp; i++) out.push(i); return out; }
    out.push(1); if (p > 3) out.push('…');
    for (let i = Math.max(2, p - 1); i <= Math.min(tp - 1, p + 1); i++) out.push(i);
    if (p < tp - 2) out.push('…'); out.push(tp); return out;
  };

  const sortBy = (k: 'name' | 'company' | 'lastDays') => {
    setSort('');
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
    setPage(1);
  };
  const ariaSort = (k: string): 'ascending' | 'descending' | 'none' => (sortKey === k && !sort ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');

  const pagedIds = paged.map((r) => r.id);
  const allSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.includes(id));
  const someSelected = pagedIds.filter((id) => selected.includes(id)).length > 0 && !allSelected;
  const toggleAll = (on: boolean) => setSelected((s) => (on ? [...new Set([...s, ...pagedIds])] : s.filter((id) => !pagedIds.includes(id))));
  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleMenu = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu?.id === id) { setMenu(null); return; }
    const b = e.currentTarget.getBoundingClientRect();
    const de = document.documentElement, vw = de.clientWidth;
    const rtl = de.getAttribute('dir') === 'rtl';
    setMenu({ id, x: Math.max(8, rtl ? b.left : vw - b.right), y: b.bottom + 4 });
  };

  return (
    <>
      <PageHead
        title="Contacts"
        subtitle={(<><span className="ax-num">{ROWS.length}</span> people across <span className="ax-num">128</span> accounts — <span className="ax-num">42</span> active this week.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Import</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setAddOpen(true)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">New contact</span>
            </button>
          </>
        }
      />

      {/* CRM SUB-NAV */}
      <nav className="ax-tabs ax-tabs--pill" aria-label="CRM sections" style={{ marginBottom: 'var(--ax-space-5)' }}>
        <div className="ax-tabs__list" role="tablist">
          <Link className="ax-tabs__tab is-active" role="tab" aria-selected="true" aria-current="page" href="/crm/contacts">Contacts</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/companies">Companies</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/deals">Deals</Link>
          <Link className="ax-tabs__tab" role="tab" href="/crm/leads">Leads</Link>
        </div>
      </nav>

      {/* CONTENT */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Contacts table">
          {/* toolbar */}
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">All Contacts</h2>
              <p className="ax-card__subtitle ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>
                <span>{filtered.length}</span> of <span>{ROWS.length}</span> shown
              </p>
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input ax-input--sm" placeholder="Search name, company or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} style={{ paddingInlineStart: 34 }} aria-label="Search contacts" />
              </div>
              <select className="ax-select ax-select--sm" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }} aria-label="Filter by lifecycle" style={{ flex: '1 1 180px', minWidth: 150 }}>
                <option value="">All lifecycle</option>
                <option>Customer</option>
                <option>Opportunity</option>
                <option>Lead</option>
                <option>Subscriber</option>
              </select>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort contacts" style={{ flex: '1 1 180px', minWidth: 150 }}>
                <option value="recent">Last activity</option>
                <option value="name">Name A–Z</option>
                <option value="company">Company</option>
              </select>
            </div>
          </div>

          {/* bulk bar */}
          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: '0 var(--ax-space-5) var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)', flexWrap: 'wrap' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
                <span className="ax-btn__label">Email</span>
              </button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Add to sequence</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Add tag</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Delete</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          {/* table */}
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover" style={{ minWidth: 920 }}>
              <caption className="ax-visually-hidden">Contacts, sortable and searchable</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all rows on this page" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th className="ax-table__th ax-table__th--sortable" scope="col" aria-sort={ariaSort('name')} onClick={() => sortBy('name')}>Name <SortGlyph active={sortKey === 'name' && !sort} dir={sortDir} /></th>
                  <th className="ax-table__th ax-table__th--sortable" scope="col" aria-sort={ariaSort('company')} onClick={() => sortBy('company')}>Company <SortGlyph active={sortKey === 'company' && !sort} dir={sortDir} /></th>
                  <th className="ax-table__th" scope="col">Email</th>
                  <th className="ax-table__th" scope="col">Lifecycle</th>
                  <th className="ax-table__th ax-table__th--sortable" scope="col" aria-sort={ariaSort('lastDays')} onClick={() => sortBy('lastDays')}>Last activity <SortGlyph active={sortKey === 'lastDays' && !sort} dir={sortDir} /></th>
                  <th className="ax-table__th" scope="col" style={{ width: 120 }}>Quick actions</th>
                  <th className="ax-table__th" scope="col" style={{ width: 44 }}><span className="ax-visually-hidden">More</span></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={r.id} className="ax-table__row" style={selected.includes(r.id) ? { background: 'var(--ax-accent-wash)' } : undefined}>
                    <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} aria-label={'Select ' + r.name} /></td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span style={{ position: 'relative', flex: '0 0 auto' }}>
                          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.c} 18%,transparent)`, color: r.c, fontWeight: 700 }}><span style={{ fontSize: 10 }}>{r.initials}</span></span>
                          <span className={`ax-avatar__status ax-avatar__status--${r.presence}`} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.name}</div>
                          <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.coC} 18%,transparent)`, color: r.coC, fontWeight: 700, fontSize: 10 }}>{r.coMark}</span>
                        <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>{r.company}</span>
                      </div>
                    </td>
                    <td className="ax-table__td"><a className="ax-link ax-num" href={`mailto:${r.email}`} style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>{r.email}</a></td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--pill ax-badge--sm ${lifeClass(r.life)}`}><span className="ax-badge__dot" /><span>{r.life}</span></span></td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 6, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: r.actC, flex: '0 0 auto' }}>{(ACT_PATH[r.actIcon] || ACT_PATH.note).map((d, i) => <path key={i} d={d} />)}</svg>
                        <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{r.lastAct}</span>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{'· ' + r.lastTime}</span>
                      </div>
                    </td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <a className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" href={`mailto:${r.email}`} aria-label="Email"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></a>
                        <a className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" href={`tel:${r.phone}`} aria-label="Call"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></a>
                        <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" aria-label="Log a task"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
                      </div>
                    </td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={(e) => toggleMenu(r.id, e)} aria-expanded={menu?.id === r.id} aria-haspopup="menu" aria-label="More actions"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* empty */}
          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No contacts found</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>No people match your search and filters.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setFStatus(''); setPage(1); }}>Clear filters</button>
            </div>
          )}

          {/* footer */}
          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>
                  Showing <span>{rangeStart}</span>–<span>{rangeEnd}</span> of <span>{filtered.length}</span>
                </span>
                <label className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                  Rows
                  <select className="ax-select ax-select--sm" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} aria-label="Rows per page" style={{ minWidth: 72 }}>
                    <option value={8}>8</option>
                    <option value={16}>16</option>
                    <option value={32}>32</option>
                  </select>
                </label>
              </div>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled={safePage === 1} aria-disabled={safePage === 1} onClick={() => setPage(Math.max(1, safePage - 1))} aria-label="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  {pageList().map((p, i) => (
                    <li key={i}>
                      {p === '…' ? <span className="ax-pagination__ellipsis">…</span>
                        : <button type="button" className={`ax-pagination__page${safePage === p ? ' is-active' : ''}`} aria-current={safePage === p ? 'page' : undefined} onClick={() => setPage(p)}>{p}</button>}
                    </li>
                  ))}
                </ul>
                <button type="button" className="ax-pagination__next" disabled={safePage === totalPages} aria-disabled={safePage === totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))} aria-label="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>

      {/* ROW ACTIONS MENU */}
      {menu !== null && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'transparent', border: 0, cursor: 'default' }} onClick={() => setMenu(null)} />
          <div className="ax-menu" role="menu" style={{ position: 'fixed', top: menu.y, insetInlineEnd: menu.x, zIndex: 60, minWidth: 170 }}>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>View profile</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>Edit</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>Create deal</button>
            <div className="ax-menu__divider" role="separator" />
            <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem" onClick={() => setMenu(null)}><svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>Delete</button>
          </div>
        </>
      )}

      {/* NEW CONTACT MODAL */}
      {addOpen && (
        <div onKeyDown={(e) => { if (e.key === 'Escape') setAddOpen(false); }}>
          <button type="button" aria-hidden="true" tabIndex={-1} className="ax-backdrop" onClick={() => setAddOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.4)', border: 0 }} />
          <div className="ax-flex" role="dialog" aria-modal="true" aria-label="New contact" style={{ position: 'fixed', inset: 0, zIndex: 51, alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-4)' }}>
            <form className="ax-card" onSubmit={(e) => { e.preventDefault(); setAddOpen(false); }} onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px,100%)', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">New contact</h2></div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setAddOpen(false)} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ct-first">First name</label><input id="ct-first" type="text" className="ax-input" placeholder="Jane" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ct-last">Last name</label><input id="ct-last" type="text" className="ax-input" placeholder="Cooper" /></div>
                </div>
                <div className="ax-field"><label className="ax-label" htmlFor="ct-email">Email</label><input id="ct-email" type="email" className="ax-input" placeholder="jane@northwind.io" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ct-company">Company</label><input id="ct-company" type="text" className="ax-input" placeholder="Northwind Labs" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ct-life">Lifecycle</label><select id="ct-life" className="ax-select"><option>Subscriber</option><option>Lead</option><option>Opportunity</option><option>Customer</option></select></div>
                </div>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Create contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Contacts;
