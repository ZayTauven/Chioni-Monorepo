'use client';
/*
 * Vireo Next.js — Ecommerce / Order details (route "ecommerce/order-details").
 *
 * Faithful re-expression of src/html/ecommerce/order-details.html: a status
 * timeline, an items table with per-item fulfillment selection, a fulfillment/
 * shipping panel, a payment summary, an internal-notes composer, and a right
 * rail (customer, shipping/billing address, payment, tags). The Alpine x-data
 * (axOrderDetails + the notes island) is ported to React state; the header
 * "Fulfill" split-menu is a native dropdown. Classes + ARIA match 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', amber: 'var(--ax-viz-amber)', pink: 'var(--ax-viz-pink)' };
const money = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRODUCT_AV = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg>
);

interface Item { id: number; name: string; variant: string; sku: string; price: number; qty: number; c: string; refunded: boolean; }
const ITEMS: Item[] = [
  { id: 1, name: 'Aperture Desk Lamp', variant: 'Brass / Warm white', sku: 'SKU APG-0001', price: 129.0, qty: 1, c: C.cyan, refunded: false },
  { id: 2, name: 'Matte Ceramic Mug', variant: 'Slate · 12 oz', sku: 'SKU APG-0003', price: 24.0, qty: 2, c: C.violet, refunded: false },
  { id: 3, name: 'Walnut Monitor Riser', variant: 'Walnut / Large', sku: 'SKU APG-0004', price: 96.0, qty: 1, c: C.amber, refunded: false },
  { id: 4, name: 'Leather Cable Wrap', variant: 'Tan', sku: 'SKU APG-0012', price: 18.0, qty: 1, c: C.pink, refunded: true },
];

interface Note { who: string; when: string; body: string; }
const INITIAL_NOTES: Note[] = [
  { who: 'Priya Nair', when: 'Jun 27, 2026 · 4:12 PM', body: 'Customer requested gift wrapping — added a note for the packing team.' },
  { who: 'System', when: 'Jun 27, 2026 · 2:41 PM', body: 'Discount code WELCOME10 applied automatically (first order).' },
];

export function OrderDetails() {
  const [menu, setMenu] = useState(false);
  const [fulfill, setFulfill] = useState<number[]>([]);
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [draft, setDraft] = useState('');

  const allItems = () => { const ids = ITEMS.filter((i) => !i.refunded).map((i) => i.id); return ids.length > 0 && ids.every((id) => fulfill.includes(id)); };
  const toggleAllItems = (on: boolean) => setFulfill(on ? ITEMS.filter((i) => !i.refunded).map((i) => i.id) : []);
  const toggleFulfill = (id: number) => setFulfill((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const addNote = () => { if (!draft.trim()) return; setNotes((n) => [{ who: 'You', when: 'Just now', body: draft.trim() }, ...n]); setDraft(''); };

  return (
    <>
      <PageHead
        title="#ORD-8042"
        subtitle={
          (<>Placed <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 27, 2026 · 2:41 PM</span> by Amelia Hart.</>) as unknown as string
        }
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/ecommerce/orders">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Back to orders</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--secondary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /><path d="M9 17a2 2 0 1 0 0 -4" /></svg>
              <span className="ax-btn__label">Print invoice</span>
            </button>
            <div style={{ position: 'relative' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(false); }}>
              <button type="button" className="ax-btn ax-btn--primary" onClick={() => setMenu(!menu)} aria-expanded={menu}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8" /></svg>
                <span className="ax-btn__label">Fulfill</span>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
              </button>
              {menu && (
                <div className="ax-dropdown" role="menu" style={{ position: 'absolute', insetInlineEnd: 0, top: '100%', zIndex: 30, minWidth: 200 }}>
                  <button type="button" className="ax-menu__item" role="menuitem"><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>Fulfill all items</button>
                  <button type="button" className="ax-menu__item" role="menuitem"><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg></span>Fulfill selected</button>
                  <div className="ax-menu__divider" role="separator" />
                  <button type="button" className="ax-menu__item" role="menuitem"><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 7l9 6l9 -6" /></svg></span>Resend confirmation</button>
                  <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem"><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 0 1 0 8h-1" /></svg></span>Refund order</button>
                  <button type="button" className="ax-menu__item ax-menu__item--danger" role="menuitem"><span className="ax-menu__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></span>Cancel order</button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* LEFT */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* STATUS TIMELINE */}
          <section className="ax-card" role="region" aria-label="Order timeline">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Order timeline</h2><p className="ax-card__subtitle">Estimated delivery Jul 2 – Jul 4, 2026</p></div>
              <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Step 3 of 5</span>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-timeline">
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Order placed</b> — confirmation sent to amelia.hart@gmail.com</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 27, 2026 · 2:41 PM</span></div>
                </li>
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Payment confirmed</b> — Visa •••• 4242, <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>$265.97</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 27, 2026 · 2:41 PM</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-info-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Processing</b> — items being picked &amp; packed at Portland warehouse</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 27, 2026 · 4:10 PM</span></div>
                </li>
                <li className="ax-timeline__item" style={{ opacity: 0.55 }}>
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-text-subtle)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text)' }}>Shipped</b> — tracking link will appear here</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Expected Jun 28</span></div>
                </li>
                <li className="ax-timeline__item" style={{ opacity: 0.55 }}>
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-text-subtle)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text)' }}>Delivered</b> — to 1820 NW Glisan St, Portland</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Est. Jul 2 – Jul 4</span></div>
                </li>
              </ul>
            </div>
          </section>

          {/* ITEMS TABLE */}
          <section className="ax-card" role="region" aria-label="Order items">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Items</h2><p className="ax-card__subtitle"><span className="ax-num">4</span> products · <span className="ax-num">5</span> units</p></div>
              <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                <input type="checkbox" className="ax-checkbox" checked={allItems()} onChange={(e) => toggleAllItems(e.target.checked)} aria-label="Select all items for fulfillment" />
                Select all
              </label>
            </div>
            <div className="ax-table-wrap">
              <table className="ax-table">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col" style={{ width: 38 }}><span className="ax-visually-hidden">Fulfill</span></th>
                    <th className="ax-table__th" scope="col">Product</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Unit price</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Qty</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ITEMS.map((it) => (
                    <tr key={it.id} className="ax-table__row" style={it.refunded ? { opacity: 0.6 } : undefined}>
                      <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={fulfill.includes(it.id)} onChange={() => toggleFulfill(it.id)} disabled={it.refunded} aria-label={'Fulfill ' + it.name} /></td>
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${it.c} 18%,transparent)`, color: it.c }}>{PRODUCT_AV}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                              <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', ...(it.refunded ? { textDecoration: 'line-through' } : {}) }}>{it.name}</span>
                              {it.refunded && <span className="ax-badge ax-badge--soft ax-badge--danger" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Refunded</span>}
                            </div>
                            <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{it.variant}</div>
                            <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{it.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{money(it.price)}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{it.qty}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{money(it.price * it.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span className="ax-num">{fulfill.length}</span> selected for fulfillment</span>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" disabled={!fulfill.length}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8" /></svg>
                <span className="ax-btn__label">Mark selected as fulfilled</span>
              </button>
            </div>
          </section>

          {/* FULFILLMENT / SHIPPING */}
          <section className="ax-card" role="region" aria-label="Fulfillment">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Fulfillment &amp; shipping</h2></div>
              <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Unfulfilled</span>
            </div>
            <div className="ax-card__body ax-od-ship" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-5)' }}>
              <div>
                <div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Carrier</div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-accent)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8" /></svg><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>UPS Ground</span></div>
              </div>
              <div>
                <div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Tracking</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Not yet assigned</div>
              </div>
              <div>
                <div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Method</div>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Free standard (5–7 days)</div>
              </div>
            </div>
          </section>

          {/* TOTALS */}
          <section className="ax-card" role="region" aria-label="Order totals">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Payment summary</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', maxWidth: 420, marginInlineStart: 'auto' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$273.00</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Discount (WELCOME10)</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>−$27.30</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>Free</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax (8.25%)</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$20.27</span></div>
              <hr className="ax-divider" style={{ margin: 'var(--ax-space-2) 0' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Total</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>$265.97</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}><span style={{ color: 'var(--ax-viz-emerald)' }}>Amount paid</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>$265.97</span></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Balance</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>$0.00</span></div>
            </div>
          </section>

          {/* INTERNAL NOTES */}
          <section className="ax-card" role="region" aria-label="Internal notes">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Internal notes</h2><p className="ax-card__subtitle">Only visible to your team</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <form onSubmit={(e) => { e.preventDefault(); addNote(); }} style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', marginBottom: 'var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)', flex: 'none' }}><span className="ax-avatar__initials">YO</span></span>
                <div style={{ flex: '1 1 auto' }}>
                  <textarea className="ax-textarea" rows={2} placeholder="Add an internal note about this order…" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 56 }} />
                  <div className="ax-cluster" style={{ justifyContent: 'flex-end', marginTop: 'var(--ax-space-2)' }}><button type="submit" className="ax-btn ax-btn--primary ax-btn--sm" disabled={!draft.trim()}>Add note</button></div>
                </div>
              </form>
              <ul className="ax-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {notes.map((n, i) => (
                  <li key={i} style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{n.who}</span>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{n.when}</span>
                    </div>
                    <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>{n.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          <section className="ax-card" role="region" aria-label="Customer">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Customer</h2></div>
              <Link className="ax-btn ax-btn--link ax-btn--sm" href="/ecommerce/customer-details">View profile</Link>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                <span className="ax-avatar ax-avatar--lg" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,var(--ax-surface-solid))', color: 'var(--ax-viz-cyan)', flex: 'none' }}><span className="ax-avatar__initials">AH</span></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Amelia Hart</div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 2 }}><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm ax-badge--pill">Returning</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>12 orders</span></div>
                </div>
              </div>
              <hr className="ax-divider" style={{ margin: 'var(--ax-space-1) 0' }} />
              <a className="ax-list__row ax-list--linked" href="mailto:amelia.hart@gmail.com" style={{ border: 0, padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
                <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>amelia.hart@gmail.com</span></span>
              </a>
              <a className="ax-list__row ax-list--linked" href="tel:+15035550142" style={{ border: 0, padding: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
                <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
                <span className="ax-list__content"><span className="ax-list__title ax-num" style={{ color: 'var(--ax-text)', fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)' }}>+1 (503) 555-0142</span></span>
              </a>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Shipping address">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Shipping address</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginBottom: 4 }}>Amelia Hart</div>
              <address style={{ fontStyle: 'normal', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>
                1820 NW Glisan St, Apt 4B<br />Portland · OR · <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>97201</span><br />United States<br /><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>+1 (503) 555-0142</span>
              </address>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Billing address">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Billing address</h2></div><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm ax-badge--pill">Same as shipping</span></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <address style={{ fontStyle: 'normal', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>
                Amelia Hart<br />1820 NW Glisan St, Apt 4B<br />Portland · OR · <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>97201</span><br />United States
              </address>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Payment method">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Payment</h2></div><span className="ax-badge ax-badge--soft ax-badge--success" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Paid</span></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <span style={{ width: 38, height: 26, borderRadius: 'var(--ax-radius-xs)', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: 'none' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg></span>
                <div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Visa •••• 4242</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Expires 08/28</div></div>
              </div>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Tags">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Tags</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>First order</span>
                <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Gift</span>
                <button type="button" className="ax-badge ax-badge--outline" style={{ borderRadius: 'var(--ax-radius-xs)', cursor: 'pointer' }}>+ Add</button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default OrderDetails;
