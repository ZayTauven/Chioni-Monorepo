'use client';
/*
 * Vireo Next.js — Ecommerce / Sellers (route "ecommerce/sellers").
 *
 * Faithful re-expression of src/html/ecommerce/sellers.html: a 4-KPI strip over a
 * searchable, status/category-filtered, sortable vendor directory rendered as a
 * grid of store cards (with inline approve/reject for pending, reinstate for
 * suspended) or a table, with a status-tab bar, bulk-select, persisted view mode,
 * empty state and pagination. The Alpine x-data (axSellers) is ported to React
 * state; classes + ARIA match the reference 1:1.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Seller {
  id: number; store: string; owner: string; initials: string; category: string; rating: number;
  reviews: number; products: number; revenue: number; orders: number; joined: string; status: string; color: string;
}

const C = {
  cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)',
  amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', red: 'var(--ax-viz-red)', accent: 'var(--ax-accent)',
};

const STATUS_TABS = [
  { id: '', label: 'All', count: 128 },
  { id: 'active', label: 'Active', count: 119 },
  { id: 'pending', label: 'Pending', count: 6 },
  { id: 'suspended', label: 'Suspended', count: 3 },
];

const SELLERS: Seller[] = [
  { id: 1, store: 'Lumière Studio', owner: 'Élise Moreau', initials: 'LS', category: 'Lighting', rating: 4.9, reviews: 1204, products: 86, revenue: 412800, orders: 5240, joined: 'Mar 2021', status: 'active', color: C.accent },
  { id: 2, store: 'Northwind Furniture', owner: 'Henrik Sørensen', initials: 'NF', category: 'Furniture', rating: 4.8, reviews: 864, products: 142, revenue: 689400, orders: 3180, joined: 'Jan 2020', status: 'active', color: C.cyan },
  { id: 3, store: 'Clayhouse Ceramics', owner: 'Mei-Ling Chen', initials: 'CC', category: 'Drinkware', rating: 4.7, reviews: 2341, products: 54, revenue: 248600, orders: 8120, joined: 'Sep 2021', status: 'active', color: C.pink },
  { id: 4, store: 'Paperleaf Goods', owner: 'Tobias Werner', initials: 'PG', category: 'Stationery', rating: 4.6, reviews: 712, products: 118, revenue: 156200, orders: 4660, joined: 'Nov 2022', status: 'active', color: C.violet },
  { id: 5, store: 'Voltic Supply Co.', owner: 'Aisha Karim', initials: 'VS', category: 'Tech', rating: 4.5, reviews: 489, products: 73, revenue: 298100, orders: 2210, joined: 'Feb 2023', status: 'active', color: C.amber },
  { id: 6, store: 'Flaxen Textiles', owner: 'Mateo Rossi', initials: 'FT', category: 'Textiles', rating: 4.4, reviews: 356, products: 64, revenue: 132400, orders: 1880, joined: 'Jun 2026', status: 'pending', color: C.emerald },
  { id: 7, store: 'Brassworks Atelier', owner: 'Priya Nair', initials: 'BA', category: 'Lighting', rating: 4.8, reviews: 903, products: 41, revenue: 184700, orders: 2940, joined: 'Apr 2022', status: 'active', color: C.cyan },
  { id: 8, store: 'Tundra Outdoors', owner: 'Lars Eklund', initials: 'TO', category: 'Furniture', rating: 3.9, reviews: 124, products: 29, revenue: 42300, orders: 610, joined: 'Jun 2026', status: 'pending', color: C.violet },
  { id: 9, store: 'Driftwood Decor', owner: 'Camila Rossi', initials: 'DD', category: 'Furniture', rating: 4.2, reviews: 267, products: 88, revenue: 97800, orders: 1340, joined: 'Aug 2023', status: 'suspended', color: C.red },
  { id: 10, store: 'Inkwell Press', owner: 'Devon Okafor', initials: 'IP', category: 'Stationery', rating: 4.7, reviews: 1502, products: 96, revenue: 211900, orders: 6080, joined: 'Dec 2020', status: 'active', color: C.pink },
  { id: 11, store: 'Copperline Mugs', owner: 'Yuki Tanaka', initials: 'CM', category: 'Drinkware', rating: 4.3, reviews: 198, products: 33, revenue: 58600, orders: 980, joined: 'May 2024', status: 'inactive', color: C.amber },
  { id: 12, store: 'Slate & Pine', owner: 'Marta Alvarez', initials: 'SP', category: 'Furniture', rating: 4.6, reviews: 641, products: 107, revenue: 374500, orders: 2760, joined: 'Oct 2021', status: 'active', color: C.emerald },
];

const money = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = (n: number) => (n >= 1000000 ? '$' + (n / 1000000).toFixed(2) + 'M' : n >= 1000 ? '$' + Math.round(n / 1000) + 'K' : '$' + n);

const STATUS_PILL: Record<string, { cls: string; label: string; path: string }> = {
  active: { cls: 'ax-badge--success', label: 'Active', path: 'M5 12l5 5l10 -10' },
  pending: { cls: 'ax-badge--warning', label: 'Pending', path: 'M12 7v5l3 3M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' },
  suspended: { cls: 'ax-badge--danger', label: 'Suspended', path: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M5.7 5.7l12.6 12.6' },
  inactive: { cls: 'ax-badge--neutral', label: 'Inactive', path: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M9 10l.01 0M15 10l.01 0M9.5 15.05a3.5 3.5 0 0 1 5 0' },
};

function StatusPill({ status }: { status: string }): ReactElement {
  const m = STATUS_PILL[status] || STATUS_PILL.inactive;
  return (
    <span className={`ax-badge ax-badge--soft ${m.cls} ax-badge--pill`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d={m.path} /></svg>{m.label}
    </span>
  );
}

const STAR = (full: boolean) => (
  <svg className={`ax-rating__star${full ? ' ax-rating__star--full' : ''}`} viewBox="0 0 24 24" fill={full ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" /></svg>
);

export function Sellers() {
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [sort, setSort] = useState('top');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    try { const v = localStorage.getItem('ax:ecom:sellers:view'); if (v === 'grid' || v === 'table') setView(v); } catch { /* ignore */ }
  }, []);
  const setViewPersist = (v: 'grid' | 'table') => { setView(v); try { localStorage.setItem('ax:ecom:sellers:view', v); } catch { /* ignore */ } };

  const filtered = useMemo(() => {
    let r = SELLERS.filter((s) => {
      const term = q.trim().toLowerCase();
      if (term && !(s.store.toLowerCase().includes(term) || s.owner.toLowerCase().includes(term))) return false;
      if (fStatus && s.status !== fStatus) return false;
      if (fCategory && s.category !== fCategory) return false;
      return true;
    });
    const by: Record<string, (a: Seller, b: Seller) => number> = {
      top: (a, b) => b.rating - a.rating,
      revenue: (a, b) => b.revenue - a.revenue,
      products: (a, b) => b.products - a.products,
      orders: (a, b) => b.orders - a.orders,
      az: (a, b) => a.store.localeCompare(b.store),
      newest: (a, b) => b.id - a.id,
    };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [q, fStatus, fCategory, sort]);

  const allSelected = () => { const ids = filtered.map((s) => s.id); return ids.length > 0 && ids.every((id) => selected.includes(id)); };
  const toggleAll = (on: boolean) => setSelected(on ? filtered.map((s) => s.id) : []);
  const toggleSel = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHead
        title="Sellers"
        subtitle={(<><span className="ax-num">128</span> vendors on the marketplace — <span className="ax-num">6</span> pending approval, <span className="ax-num">3</span> suspended.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add seller</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI STRIP */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total sellers 128, up 4.8%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4" /><path d="M5 21l0 -10.15" /><path d="M19 21l0 -10.15" /><path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>4.8%</span>
            </div>
            <div className="ax-kpi__label">Total sellers</div>
            <div className="ax-kpi__value ax-num">128</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Active sellers 119">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>2.1%</span>
            </div>
            <div className="ax-kpi__label">Active</div>
            <div className="ax-kpi__value ax-num">119</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Average rating 4.6 out of 5">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>0.2</span>
            </div>
            <div className="ax-kpi__label">Avg. rating</div>
            <div className="ax-kpi__value ax-num">4.6</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total revenue $2.41M, up 11.3%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>11.3%</span>
            </div>
            <div className="ax-kpi__label">Total revenue</div>
            <div className="ax-kpi__value ax-num">$2.41M</div>
          </div>
        </div>

        {/* MAIN PANEL */}
        <section className="ax-card ax-col--12" role="region" aria-label="Seller directory">
          {/* toolbar */}
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input" placeholder="Search store or owner…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search sellers" />
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter by status" style={{ minWidth: 130 }}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
              <select className="ax-select ax-select--sm" value={fCategory} onChange={(e) => setFCategory(e.target.value)} aria-label="Filter by category" style={{ minWidth: 140 }}>
                <option value="">All categories</option>
                <option value="Lighting">Lighting</option>
                <option value="Furniture">Furniture</option>
                <option value="Drinkware">Drinkware</option>
                <option value="Stationery">Stationery</option>
                <option value="Tech">Tech</option>
                <option value="Textiles">Textiles</option>
              </select>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort sellers" style={{ minWidth: 150 }}>
                <option value="top">Top-rated</option>
                <option value="revenue">Most revenue</option>
                <option value="products">Most products</option>
                <option value="orders">Most orders</option>
                <option value="newest">Newest</option>
                <option value="az">Name: A–Z</option>
              </select>
              <div className="ax-segment" role="group" aria-label="View mode">
                <button type="button" className="ax-segment__option" aria-pressed={view === 'grid'} onClick={() => setViewPersist('grid')} aria-label="Grid view">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
                </button>
                <button type="button" className="ax-segment__option" aria-pressed={view === 'table'} onClick={() => setViewPersist('table')} aria-label="Table view">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* status tabs */}
          <div className="ax-card__body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', borderBottom: '1px solid var(--ax-border)', flexWrap: 'wrap' }}>
              {STATUS_TABS.map((t) => (
                <button key={t.id} type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setFStatus(t.id)}
                  style={fStatus === t.id ? { boxShadow: 'inset 0 -2px 0 var(--ax-accent)', color: 'var(--ax-accent)', borderRadius: 0 } : { borderRadius: 0 }}>
                  <span>{t.label}</span>
                  <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm ax-num" style={{ marginInlineStart: 6 }}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* bulk bar */}
          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: 'var(--ax-space-4) var(--ax-space-5) 0', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)', flexWrap: 'wrap' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Approve</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Suspend</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Tag</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Export</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          <div className="ax-card__body">
            {/* GRID VIEW */}
            {view === 'grid' && (
              <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 'var(--ax-space-4)' }}>
                {filtered.map((s) => (
                  <article key={s.id} className="ax-card ax-card--interactive" style={{ margin: 0, ...(selected.includes(s.id) ? { borderColor: 'var(--ax-accent)', boxShadow: '0 0 0 1px var(--ax-accent)' } : s.status === 'suspended' ? { opacity: 0.72 } : {}) }}>
                    <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                      {/* header: logo + select */}
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                        <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ flex: 'none', background: `color-mix(in oklab,${s.color} 18%,var(--ax-surface-subtle))`, color: s.color }}><span className="ax-avatar__initials">{s.initials}</span></span>
                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                          <Link href="/ecommerce/customer-details" className="ax-text-truncate" style={{ display: 'block', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', textDecoration: 'none', fontSize: 'var(--ax-text-md)', lineHeight: 1.3 }}>{s.store}</Link>
                          <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 1 }}>by <span>{s.owner}</span> · <span>{s.category}</span></div>
                        </div>
                        <input type="checkbox" className="ax-checkbox" checked={selected.includes(s.id)} onChange={() => toggleSel(s.id)} aria-label={'Select ' + s.store} />
                      </div>

                      {/* rating */}
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <span className="ax-rating ax-rating--sm" aria-label={s.rating + ' out of 5'}>{[1, 2, 3, 4, 5].map((st) => <span key={st}>{STAR(st <= Math.round(s.rating))}</span>)}</span>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-semibold)' }}>{s.rating.toFixed(1)}</span>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{'(' + s.reviews + ')'}</span>
                      </div>

                      {/* 3 stat cells */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)', borderBottom: '1px solid var(--ax-border)', padding: 'var(--ax-space-3) 0' }}>
                        <div style={{ textAlign: 'center' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{s.products}</div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Products</div></div>
                        <div style={{ textAlign: 'center', borderInline: '1px solid var(--ax-border)' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{moneyShort(s.revenue)}</div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Revenue</div></div>
                        <div style={{ textAlign: 'center' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{s.orders.toLocaleString('en-US')}</div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Orders</div></div>
                      </div>

                      {/* status + actions */}
                      <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                        <StatusPill status={s.status} />
                        {s.status === 'pending' && (
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                            <button type="button" className="ax-btn ax-btn--soft-success ax-btn--sm">Approve</button>
                            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Reject</button>
                          </div>
                        )}
                        {s.status === 'suspended' && (
                          <button type="button" className="ax-btn ax-btn--soft-warning ax-btn--sm">Reinstate</button>
                        )}
                        {(s.status === 'active' || s.status === 'inactive') && (
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}>
                            <Link href="/ecommerce/customer-details" className="ax-btn ax-btn--secondary ax-btn--sm">View store</Link>
                            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={'More actions for ' + s.store}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* TABLE VIEW */}
            {view === 'table' && (
              <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-5))' }}>
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all" checked={allSelected()} onChange={(e) => toggleAll(e.target.checked)} /></th>
                      <th className="ax-table__th" scope="col">Seller</th>
                      <th className="ax-table__th" scope="col">Rating</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Products</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Revenue</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Orders</th>
                      <th className="ax-table__th" scope="col">Joined</th>
                      <th className="ax-table__th" scope="col">Status</th>
                      <th className="ax-table__th" scope="col" style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="ax-table__row" style={selected.includes(s.id) ? { background: 'var(--ax-accent-wash)' } : s.status === 'suspended' ? { opacity: 0.7 } : undefined}>
                        <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(s.id)} onChange={() => toggleSel(s.id)} aria-label={'Select ' + s.store} /></td>
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${s.color} 18%,transparent)`, color: s.color }}><span className="ax-avatar__initials">{s.initials}</span></span>
                            <div style={{ minWidth: 0 }}>
                              <Link href="/ecommerce/customer-details" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{s.store}</Link>
                              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>by <span>{s.owner}</span> · <span>{s.category}</span></div>
                            </div>
                          </div>
                        </td>
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                            <span className="ax-rating ax-rating--sm" aria-label={s.rating + ' out of 5'}>{[1, 2, 3, 4, 5].map((st) => <span key={st}>{STAR(st <= Math.round(s.rating))}</span>)}</span>
                            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>{s.rating.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{s.products}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{money(s.revenue)}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{s.orders.toLocaleString('en-US')}</td>
                        <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{s.joined}</td>
                        <td className="ax-table__td"><StatusPill status={s.status} /></td>
                        <td className="ax-table__td">
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={'Actions for ' + s.store}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* empty state */}
            {!filtered.length && (
              <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 21l18 0" /><path d="M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4" /><path d="M5 21l0 -10.15" /><path d="M19 21l0 -10.15" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No sellers found</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Adjust your search or filters to see more vendors.</p>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setFStatus(''); setFCategory(''); }}>Clear filters</button>
              </div>
            )}
          </div>

          {/* footer / pagination */}
          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{filtered.length}</span> of 128 sellers</span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled aria-disabled="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                  <li><a href="#" className="ax-pagination__page">2</a></li>
                  <li><a href="#" className="ax-pagination__page">3</a></li>
                  <li><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a href="#" className="ax-pagination__page">9</a></li>
                </ul>
                <button type="button" className="ax-pagination__next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default Sellers;
