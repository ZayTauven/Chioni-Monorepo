'use client';
/*
 * Vireo Next.js — Ecommerce / Customers (route "ecommerce/customers").
 *
 * Faithful re-expression of src/html/ecommerce/customers.html: a 4-KPI strip over
 * a searchable, segment/location-filtered, sortable customer table with
 * bulk-select, a per-row actions menu (fixed-positioned, anchored to its trigger),
 * status pills, empty state and pagination. The Alpine x-data (axCustomers) +
 * teleported menu are ported to React state; classes + ARIA match the reference 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Customer {
  id: number; name: string; email: string; initials: string; orders: number; spent: number;
  ltv: number; lastOrder: string; city: string; cc: string; country: string; status: string;
}

const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Camila Rossi', email: 'camila.rossi@outlook.com', initials: 'CR', orders: 42, spent: 8914.5, ltv: 11480, lastOrder: 'Jun 24, 2026', city: 'São Paulo', cc: 'BR', country: 'Brazil', status: 'VIP' },
  { id: 2, name: 'Henry Whitlock', email: 'h.whitlock@fastmail.com', initials: 'HW', orders: 18, spent: 3240.0, ltv: 4120, lastOrder: 'Jun 27, 2026', city: 'Manchester', cc: 'UK', country: 'United Kingdom', status: 'Active' },
  { id: 3, name: 'Amelia Hart', email: 'amelia.hart@gmail.com', initials: 'AH', orders: 12, spent: 2186.75, ltv: 2980, lastOrder: 'Jun 27, 2026', city: 'Portland', cc: 'US', country: 'United States', status: 'Active' },
  { id: 4, name: 'Marcus Lindqvist', email: 'm.lindqvist@telia.se', initials: 'ML', orders: 27, spent: 5602.3, ltv: 7240, lastOrder: 'Jun 18, 2026', city: 'Stockholm', cc: 'SE', country: 'Sweden', status: 'VIP' },
  { id: 5, name: 'Priya Nair', email: 'priya.nair@proton.me', initials: 'PN', orders: 9, spent: 1148.0, ltv: 1560, lastOrder: 'Jun 25, 2026', city: 'Austin', cc: 'US', country: 'United States', status: 'Active' },
  { id: 6, name: 'Lena Brandt', email: 'lena.brandt@web.de', initials: 'LB', orders: 2, spent: 264.4, ltv: 310, lastOrder: 'Jun 24, 2026', city: 'Berlin', cc: 'DE', country: 'Germany', status: 'New' },
  { id: 7, name: 'Daniel Cho', email: 'daniel.cho@kakao.com', initials: 'DC', orders: 1, spent: 74.0, ltv: 74, lastOrder: 'Jun 26, 2026', city: 'Seoul', cc: 'KR', country: 'South Korea', status: 'New' },
  { id: 8, name: 'Tomás Herrera', email: 't.herrera@gmail.com', initials: 'TH', orders: 21, spent: 4318.9, ltv: 5680, lastOrder: 'Jun 25, 2026', city: 'Madrid', cc: 'ES', country: 'Spain', status: 'Active' },
  { id: 9, name: 'Ava Sutton', email: 'ava.sutton@icloud.com', initials: 'AS', orders: 6, spent: 912.2, ltv: 1180, lastOrder: 'Jun 23, 2026', city: 'London', cc: 'UK', country: 'United Kingdom', status: 'Active' },
  { id: 10, name: 'Devon Okafor', email: 'devon.okafor@gmail.com', initials: 'DO', orders: 0, spent: 0, ltv: 0, lastOrder: '—', city: 'Lagos', cc: 'NG', country: 'Nigeria', status: 'Blocked' },
  { id: 11, name: 'Sofia Marchetti', email: 's.marchetti@libero.it', initials: 'SM', orders: 33, spent: 6740.0, ltv: 8910, lastOrder: 'Jun 22, 2026', city: 'Milan', cc: 'IT', country: 'Italy', status: 'VIP' },
  { id: 12, name: 'Noah Bergström', email: 'noah.berg@hotmail.com', initials: 'NB', orders: 4, spent: 498.5, ltv: 640, lastOrder: 'Jun 22, 2026', city: 'Oslo', cc: 'NO', country: 'Norway', status: 'Active' },
];

const money = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_PILL: Record<string, { variant: string; path: string }> = {
  VIP: { variant: 'accent', path: 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z' },
  Active: { variant: 'success', path: 'M5 12l5 5l10 -10' },
  New: { variant: 'info', path: 'M12 5l0 14M5 12l14 0' },
  Blocked: { variant: 'danger', path: 'M5.7 5.7l12.6 12.6M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18' },
};

function StatusPill({ status }: { status: string }): ReactElement {
  const m = STATUS_PILL[status] || STATUS_PILL.Active;
  return (
    <span className={`ax-badge ax-badge--soft ax-badge--${m.variant} ax-badge--pill`}>
      <span className="ax-badge__dot" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 12, height: 12 }}><path d={m.path} /></svg>{status}
    </span>
  );
}

export function Customers() {
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [sort, setSort] = useState('spend-desc');
  const [selected, setSelected] = useState<number[]>([]);
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    let r = CUSTOMERS.filter((c) => {
      const term = q.trim().toLowerCase();
      if (term && !(c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term))) return false;
      if (fStatus && c.status !== fStatus) return false;
      if (fLocation && c.country !== fLocation) return false;
      return true;
    });
    const by: Record<string, (a: Customer, b: Customer) => number> = {
      'spend-desc': (a, b) => b.spent - a.spent,
      'spend-asc': (a, b) => a.spent - b.spent,
      'orders-desc': (a, b) => b.orders - a.orders,
      recent: (a, b) => b.id - a.id,
      az: (a, b) => a.name.localeCompare(b.name),
    };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [q, fStatus, fLocation, sort]);

  const allSelected = () => { const ids = filtered.map((c) => c.id); return ids.length > 0 && ids.every((id) => selected.includes(id)); };
  const toggleAll = (on: boolean) => setSelected(on ? filtered.map((c) => c.id) : []);
  const toggleSel = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleMenu = (id: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu?.id === id) { setMenu(null); return; }
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const de = document.documentElement, vw = de.clientWidth;
    const rtl = de.getAttribute('dir') === 'rtl';
    setMenu({ id, x: Math.max(8, rtl ? b.left : vw - b.right), y: b.bottom + 4 });
  };

  return (
    <>
      <PageHead
        title="Customers"
        subtitle={(<><span className="ax-num">5,914</span> customers — <span className="ax-num">312</span> new this month, <span className="ax-num">48</span> VIP.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add customer</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI STRIP */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total customers 5,914, up 6.2%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>6.2%</span>
            </div>
            <div className="ax-kpi__label">Total customers</div>
            <div className="ax-kpi__value ax-num">5,914</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="New in last 30 days 312, up 11.8%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h3.5" /><path d="M16 19h6" /><path d="M19 16v6" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>11.8%</span>
            </div>
            <div className="ax-kpi__label">New · 30 days</div>
            <div className="ax-kpi__value ax-num">312</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Returning rate 64.5%, up 3.4%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>3.4%</span>
            </div>
            <div className="ax-kpi__label">Returning rate</div>
            <div className="ax-kpi__value ax-num">64.5%</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Average lifetime value $1,284, down 1.1%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>1.1%</span>
            </div>
            <div className="ax-kpi__label">Avg. lifetime value</div>
            <div className="ax-kpi__value ax-num">$1,284</div>
          </div>
        </div>

        {/* CUSTOMERS TABLE */}
        <section className="ax-card ax-col--12" role="region" aria-label="Customers">
          {/* toolbar */}
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search customers" />
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter by status" style={{ minWidth: 130 }}>
                <option value="">All segments</option>
                <option value="VIP">VIP</option>
                <option value="Active">Active</option>
                <option value="New">New</option>
                <option value="Blocked">Blocked</option>
              </select>
              <select className="ax-select ax-select--sm" value={fLocation} onChange={(e) => setFLocation(e.target.value)} aria-label="Filter by location" style={{ minWidth: 140 }}>
                <option value="">All locations</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Brazil">Brazil</option>
                <option value="Germany">Germany</option>
                <option value="Sweden">Sweden</option>
              </select>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort customers" style={{ minWidth: 150 }}>
                <option value="spend-desc">Top spenders</option>
                <option value="spend-asc">Lowest spend</option>
                <option value="orders-desc">Most orders</option>
                <option value="recent">Most recent order</option>
                <option value="az">Name: A–Z</option>
              </select>
            </div>
          </div>

          {/* bulk bar */}
          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: '0 var(--ax-space-5) var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)', flexWrap: 'wrap' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.859 6h-2.834a2.025 2.025 0 0 0 -2.025 2.025v.142c0 .538 .214 1.054 .595 1.435l6.354 6.354a2.025 2.025 0 0 0 2.864 0l3.842 -3.842a2.025 2.025 0 0 0 0 -2.864l-6.354 -6.354" /><path d="M7 10h-.01" /></svg>
                <span className="ax-btn__label">Tag</span>
              </button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 7l9 6l9 -6" /></svg>
                <span className="ax-btn__label">Email</span>
              </button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Export</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Block</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          {/* table */}
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all customers" checked={allSelected()} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Orders</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total spent</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">LTV</th>
                  <th className="ax-table__th" scope="col">Last order</th>
                  <th className="ax-table__th" scope="col">Location</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th" scope="col" style={{ width: 44 }}><span className="ax-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="ax-table__row" style={selected.includes(c.id) ? { background: 'var(--ax-accent-wash)' } : undefined}>
                    <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(c.id)} onChange={() => toggleSel(c.id)} aria-label={'Select ' + c.name} /></td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--md" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)', flex: 'none' }}><span className="ax-avatar__initials">{c.initials}</span></span>
                        <div style={{ minWidth: 0 }}>
                          <Link href="/ecommerce/customer-details" className="ax-text-truncate" style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{c.name}</Link>
                          <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{c.orders}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{money(c.spent)}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{money(c.ltv)}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>{c.lastOrder}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>{c.city + ', ' + c.cc}</td>
                    <td className="ax-table__td"><StatusPill status={c.status} /></td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={(e) => toggleMenu(c.id, e)} aria-label={'Actions for ' + c.name} aria-expanded={menu?.id === c.id} aria-haspopup="menu">
                        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* empty state */}
          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No customers match your search</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try a different segment, location, or search term.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setFStatus(''); setFLocation(''); }}>Clear filters</button>
            </div>
          )}

          {/* footer / pagination */}
          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{filtered.length}</span> of <span>{CUSTOMERS.length}</span> on this page · 5,914 total</span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled aria-disabled="true" aria-label="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                  <li><a href="#" className="ax-pagination__page">2</a></li>
                  <li><a href="#" className="ax-pagination__page">3</a></li>
                  <li><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a href="#" className="ax-pagination__page">237</a></li>
                </ul>
                <button type="button" className="ax-pagination__next" aria-label="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>

      {/* ROW ACTIONS MENU — fixed-positioned, anchored to the open trigger */}
      {menu !== null && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'transparent', border: 0, cursor: 'default' }} onClick={() => setMenu(null)} />
          <div className="ax-menu" role="menu" style={{ position: 'fixed', top: menu.y, insetInlineEnd: menu.x, zIndex: 60, minWidth: 170 }}>
            <Link href="/ecommerce/customer-details" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg></span>View profile</Link>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 7l9 6l9 -6" /></svg></span>Email</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.859 6h-2.834a2.025 2.025 0 0 0 -2.025 2.025v.142c0 .538 .214 1.054 .595 1.435l6.354 6.354a2.025 2.025 0 0 0 2.864 0l3.842 -3.842a2.025 2.025 0 0 0 0 -2.864l-6.354 -6.354" /><path d="M7 10h-.01" /></svg></span>Add tag</button>
            <div className="ax-menu__divider" role="separator" />
            <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.7 5.7l12.6 12.6" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg></span>Block customer</button>
          </div>
        </>
      )}
    </>
  );
}

export default Customers;
