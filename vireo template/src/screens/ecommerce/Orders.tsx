'use client';
/*
 * Vireo Next.js — Ecommerce / Orders (route "ecommerce/orders").
 *
 * Faithful re-expression of src/html/ecommerce/orders.html: a KPI strip, a
 * status-tab + filter toolbar over a searchable/sortable orders table with
 * bulk-select, payment/fulfillment/status pills, a per-row actions menu
 * (fixed-positioned to escape the table overflow clip), empty state and
 * pagination. The Alpine x-data (axOrders) is ported to React state;
 * classes + ARIA match the reference 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', red: 'var(--ax-viz-red)' };
const money = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Order { id: number; no: string; date: string; customer: string; email: string; initials: string; c: string; items: number; total: number; payment: string; fulfillment: string; status: string; }

const STATUS_TABS = [
  { id: 'all', label: 'All', count: 1284 },
  { id: 'Pending', label: 'Pending', count: 18 },
  { id: 'Processing', label: 'Processing', count: 36 },
  { id: 'Shipped', label: 'Shipped', count: 212 },
  { id: 'Delivered', label: 'Delivered', count: 984 },
  { id: 'Cancelled', label: 'Cancelled', count: 22 },
  { id: 'Refunded', label: 'Refunded', count: 12 },
];

const ORDERS: Order[] = [
  { id: 1, no: '#ORD-8042', date: 'Jun 27, 2026', customer: 'Amelia Hart', email: 'amelia.hart@gmail.com', initials: 'AH', c: C.cyan, items: 3, total: 265.97, payment: 'Paid', fulfillment: 'Unfulfilled', status: 'Processing' },
  { id: 2, no: '#ORD-8041', date: 'Jun 27, 2026', customer: 'Henry Whitlock', email: 'h.whitlock@fastmail.com', initials: 'HW', c: C.violet, items: 1, total: 129.0, payment: 'Paid', fulfillment: 'Fulfilled', status: 'Shipped' },
  { id: 3, no: '#ORD-8038', date: 'Jun 26, 2026', customer: 'Camila Rossi', email: 'camila.rossi@outlook.com', initials: 'CR', c: C.amber, items: 5, total: 486.5, payment: 'Paid', fulfillment: 'Fulfilled', status: 'Delivered' },
  { id: 4, no: '#ORD-8035', date: 'Jun 26, 2026', customer: 'Daniel Cho', email: 'daniel.cho@kakao.com', initials: 'DC', c: C.pink, items: 2, total: 74.0, payment: 'Failed', fulfillment: 'Unfulfilled', status: 'Pending' },
  { id: 5, no: '#ORD-8031', date: 'Jun 25, 2026', customer: 'Priya Nair', email: 'priya.nair@proton.me', initials: 'PN', c: C.emerald, items: 4, total: 318.75, payment: 'Partially paid', fulfillment: 'Partially fulfilled', status: 'Processing' },
  { id: 6, no: '#ORD-8029', date: 'Jun 25, 2026', customer: 'Tomás Herrera', email: 't.herrera@gmail.com', initials: 'TH', c: C.cyan, items: 1, total: 182.0, payment: 'Paid', fulfillment: 'Fulfilled', status: 'Delivered' },
  { id: 7, no: '#ORD-8024', date: 'Jun 24, 2026', customer: 'Lena Brandt', email: 'lena.brandt@web.de', initials: 'LB', c: C.violet, items: 6, total: 642.2, payment: 'Paid', fulfillment: 'Fulfilled', status: 'Shipped' },
  { id: 8, no: '#ORD-8019', date: 'Jun 24, 2026', customer: 'Marcus Lindqvist', email: 'm.lindqvist@telia.se', initials: 'ML', c: C.amber, items: 2, total: 96.0, payment: 'Refunded', fulfillment: 'Returned', status: 'Refunded' },
  { id: 9, no: '#ORD-8015', date: 'Jun 23, 2026', customer: 'Ava Sutton', email: 'ava.sutton@icloud.com', initials: 'AS', c: C.pink, items: 3, total: 228.4, payment: 'Paid', fulfillment: 'Fulfilled', status: 'Delivered' },
  { id: 10, no: '#ORD-8011', date: 'Jun 23, 2026', customer: 'Devon Okafor', email: 'devon.okafor@gmail.com', initials: 'DO', c: C.emerald, items: 1, total: 44.0, payment: 'Unpaid', fulfillment: 'Unfulfilled', status: 'Cancelled' },
  { id: 11, no: '#ORD-8006', date: 'Jun 22, 2026', customer: 'Sofia Marchetti', email: 's.marchetti@libero.it', initials: 'SM', c: C.cyan, items: 4, total: 412.9, payment: 'Paid', fulfillment: 'Fulfilled', status: 'Delivered' },
  { id: 12, no: '#ORD-8002', date: 'Jun 22, 2026', customer: 'Noah Bergström', email: 'noah.berg@hotmail.com', initials: 'NB', c: C.violet, items: 2, total: 158.0, payment: 'Paid', fulfillment: 'Partially fulfilled', status: 'Processing' },
];

const STATUS_MAP: Record<string, [string, ReactElement]> = {
  Pending: ['neutral', <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M8.5 8.5l0 .01" /><path d="M15.5 8.5l0 .01" /><path d="M8.5 15.5l0 .01" /><path d="M15.5 15.5l0 .01" /></>],
  Processing: ['info', <><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /></>],
  Shipped: ['accent', <><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8" /></>],
  Delivered: ['success', <><path d="M5 12l5 5l10 -10" /></>],
  Cancelled: ['neutral', <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M10 10l4 4m0 -4l-4 4" /></>],
  Refunded: ['danger', <><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 0 1 0 8h-1" /></>],
};
const PAY_MAP: Record<string, string> = { Paid: 'success', Unpaid: 'info', 'Partially paid': 'warning', Refunded: 'danger', Failed: 'danger' };
const FULFILL_MAP: Record<string, string> = { Fulfilled: 'success', 'Partially fulfilled': 'warning', Unfulfilled: 'neutral', Returned: 'danger' };

function StatusPill({ status }: { status: string }) {
  const [v, p] = STATUS_MAP[status] || STATUS_MAP.Pending;
  return (
    <span className={`ax-badge ax-badge--soft ax-badge--${v} ax-badge--pill`} style={{ textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 'var(--ax-text-2xs)' }}>
      <span className="ax-badge__dot" />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 12, height: 12 }}>{p}</svg>{status}
    </span>
  );
}

const KPIS = [
  { region: 'Total orders 1,284, up 8.6%', icon: 'c1', up: true, delta: '8.6%', label: 'Total orders', value: '1,284', glyph: <><path d="M6 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></> },
  { region: 'Revenue $264,910, up 12.1%', icon: 'c2', up: true, delta: '12.1%', label: 'Revenue', value: '$264,910', glyph: <><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></> },
  { region: 'Average order value $206.31, up 2.4%', icon: 'c3', up: true, delta: '2.4%', label: 'Avg. order value', value: '$206.31', glyph: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v1m0 8v1" /><path d="M14.5 9.5a2.5 2 0 0 0 -2.5 -1.5h-1a2 2 0 1 0 0 4h1a2 2 0 1 1 0 4h-1a2.5 2 0 0 1 -2.5 -1.5" /></> },
  { region: 'Fulfilled rate 94.2%, down 1.3%', icon: 'c4', up: false, delta: '1.3%', label: 'Fulfilled rate', value: '94.2%', glyph: <><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /></> },
];

export function Orders() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [fPayment, setFPayment] = useState('');
  const [fFulfill, setFFulfill] = useState('');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<number[]>([]);
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);

  const filtered = useMemo(() => {
    let r = ORDERS.filter((o) => {
      const term = q.trim().toLowerCase();
      if (term && !(o.no.toLowerCase().includes(term) || o.customer.toLowerCase().includes(term) || o.email.toLowerCase().includes(term))) return false;
      if (tab !== 'all' && o.status !== tab) return false;
      if (fPayment && o.payment !== fPayment) return false;
      if (fFulfill && o.fulfillment !== fFulfill) return false;
      return true;
    });
    const by: Record<string, (a: Order, b: Order) => number> = { oldest: (a, b) => a.id - b.id, newest: (a, b) => b.id - a.id, 'total-desc': (a, b) => b.total - a.total, 'total-asc': (a, b) => a.total - b.total };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [q, tab, fPayment, fFulfill, sort]);

  const allSelected = () => { const ids = filtered.map((o) => o.id); return ids.length > 0 && ids.every((id) => selected.includes(id)); };
  const toggleAll = (on: boolean) => setSelected(on ? filtered.map((o) => o.id) : []);
  const toggleSel = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleMenu = (id: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu?.id === id) { setMenu(null); return; }
    const b = e.currentTarget.getBoundingClientRect();
    const de = document.documentElement, vw = de.clientWidth;
    const rtl = de.getAttribute('dir') === 'rtl';
    setMenu({ id, x: Math.max(8, rtl ? b.left : vw - b.right), y: b.bottom + 4 });
  };

  return (
    <>
      <PageHead
        title="Orders"
        subtitle={
          (<><span className="ax-num">1,284</span> orders this quarter — <span className="ax-num">36</span> awaiting fulfillment, <span className="ax-num">4</span> on hold.</>) as unknown as string
        }
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Create order</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI STRIP */}
        {KPIS.map((k) => (
          <div key={k.label} className="ax-card ax-kpi ax-col--3" role="region" aria-label={k.region}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${k.icon}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{k.glyph}</svg></span>
                <span className={`ax-kpi__delta ax-kpi__delta--${k.up ? 'up' : 'down'}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={k.up ? 'M6 15l6 -6l6 6' : 'M6 9l6 6l6 -6'} /></svg>{k.delta}</span>
              </div>
              <div className="ax-kpi__label">{k.label}</div>
              <div className="ax-kpi__value ax-num">{k.value}</div>
            </div>
          </div>
        ))}

        {/* ORDERS TABLE */}
        <section className="ax-card ax-col--12" role="region" aria-label="Orders">
          <div className="ax-card__body" style={{ paddingBottom: 0, overflowX: 'auto' }}>
            <div className="ax-tabs">
              <div className="ax-tabs__list" role="tablist" aria-label="Filter orders by status">
                {STATUS_TABS.map((t) => (
                  <button key={t.id} type="button" className={`ax-tabs__tab${tab === t.id ? ' is-active' : ''}`} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setSelected([]); }} style={tab === t.id ? { boxShadow: 'inset 0 -2px 0 var(--ax-accent)' } : undefined}>
                    <span>{t.label}</span>
                    <span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral ax-num">{t.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input" placeholder="Search order # or customer…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search orders" />
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm" value={fPayment} onChange={(e) => setFPayment(e.target.value)} aria-label="Filter by payment status" style={{ minWidth: 140 }}>
                <option value="">All payments</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partially paid">Partially paid</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
              </select>
              <select className="ax-select ax-select--sm" value={fFulfill} onChange={(e) => setFFulfill(e.target.value)} aria-label="Filter by fulfillment" style={{ minWidth: 150 }}>
                <option value="">All fulfillment</option>
                <option value="Unfulfilled">Unfulfilled</option>
                <option value="Partially fulfilled">Partially fulfilled</option>
                <option value="Fulfilled">Fulfilled</option>
                <option value="Returned">Returned</option>
              </select>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort orders" style={{ minWidth: 140 }}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="total-desc">Total: high to low</option>
                <option value="total-asc">Total: low to high</option>
              </select>
            </div>
          </div>

          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: '0 var(--ax-space-5) var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)', flexWrap: 'wrap' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /></svg><span className="ax-btn__label">Mark fulfilled</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /><path d="M9 17a2 2 0 1 0 0 -4" /></svg><span className="ax-btn__label">Print</span></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Export</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Cancel</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all orders" checked={allSelected()} onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Items</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                  <th className="ax-table__th" scope="col">Payment</th>
                  <th className="ax-table__th" scope="col">Fulfillment</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th" scope="col" style={{ width: 44 }}><span className="ax-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="ax-table__row" style={selected.includes(o.id) ? { background: 'var(--ax-accent-wash)' } : undefined}>
                    <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(o.id)} onChange={() => toggleSel(o.id)} aria-label={'Select order ' + o.no} /></td>
                    <td className="ax-table__td"><Link href="/ecommerce/order-details" className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)', textDecoration: 'none' }}>{o.no}</Link></td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', whiteSpace: 'nowrap' }}>{o.date}</td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${o.c} 18%,var(--ax-surface-solid))`, color: o.c }}><span className="ax-avatar__initials">{o.initials}</span></span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{o.customer}</div>
                          <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{o.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{o.items}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{money(o.total)}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${PAY_MAP[o.payment] || 'neutral'}`} style={{ borderRadius: 'var(--ax-radius-xs)' }}>{o.payment}</span></td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${FULFILL_MAP[o.fulfillment] || 'neutral'}`} style={{ borderRadius: 'var(--ax-radius-xs)' }}>{o.fulfillment}</span></td>
                    <td className="ax-table__td"><StatusPill status={o.status} /></td>
                    <td className="ax-table__td" style={{ textAlign: 'end' }}>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={(e) => toggleMenu(o.id, e)} aria-label={'Actions for order ' + o.no} aria-expanded={menu?.id === o.id} aria-haspopup="menu">
                        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filtered.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M6 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No orders match your filters</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try a different status tab or clear your search.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { setQ(''); setFPayment(''); setFFulfill(''); setTab('all'); }}>Reset filters</button>
            </div>
          )}

          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{filtered.length}</span> of <span>{ORDERS.length}</span> orders</span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled aria-disabled="true" aria-label="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                  <li><a href="#" className="ax-pagination__page">2</a></li>
                  <li><a href="#" className="ax-pagination__page">3</a></li>
                  <li><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a href="#" className="ax-pagination__page">52</a></li>
                </ul>
                <button type="button" className="ax-pagination__next" aria-label="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>

      {/* ROW ACTIONS MENU (fixed-positioned) */}
      {menu !== null && (
        <>
          <button type="button" aria-hidden="true" tabIndex={-1} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'transparent', border: 0, cursor: 'default' }} onClick={() => setMenu(null)} />
          <div className="ax-menu" role="menu" style={{ position: 'fixed', top: menu.y, insetInlineEnd: menu.x, zIndex: 60, minWidth: 180 }}>
            <Link href="/ecommerce/order-details" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg></span>View order</Link>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>Print invoice</button>
            <button type="button" className="ax-menu__item" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8" /></svg></span>Mark fulfilled</button>
            <div className="ax-menu__divider" role="separator" />
            <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 13l3 3l3 -3" /><path d="M12 16v-6" /><path d="M4 6h16l-1 14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" /></svg></span>Refund</button>
            <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem" onClick={() => setMenu(null)}><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></span>Cancel order</button>
          </div>
        </>
      )}
    </>
  );
}

export default Orders;
