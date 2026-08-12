'use client';
/*
 * Vireo Next.js — Ecommerce / Shopping cart (route "ecommerce/cart").
 *
 * Faithful re-expression of src/html/ecommerce/cart.html: editable line items
 * with qty steppers, save-for-later, remove-with-undo and out-of-stock blocker,
 * a sticky order-summary rail (free-shipping progress, promo code, live totals,
 * trust + payment marks) and a "you may also like" rail. The Alpine x-data
 * (axCart) is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', red: 'var(--ax-viz-red)' };
const money = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface CartItem { id: number; name: string; variant: string; sku: string; qty: number; price: number; stock: number; c: string; }
interface SavedItem { id: number; name: string; variant: string; price: number; c: string; }

const PIC = (w: number, color: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: w, height: w, opacity: 0.6, color }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg>
);
const STAR = (<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" />);

const INITIAL_ITEMS: CartItem[] = [
  { id: 1, name: 'Aperture Desk Lamp', variant: 'Graphite / 48 cm', sku: 'APG-0001', qty: 1, price: 129.0, stock: 84, c: C.cyan },
  { id: 2, name: 'Matte Ceramic Mug', variant: 'Slate · 12 oz', sku: 'APG-0003', qty: 2, price: 24.0, stock: 312, c: C.pink },
  { id: 3, name: 'Walnut Monitor Riser', variant: 'Walnut / Large', sku: 'APG-0004', qty: 1, price: 96.0, stock: 41, c: C.amber },
  { id: 4, name: 'Anodized Bottle 750ml', variant: 'Forest green', sku: 'APG-0011', qty: 3, price: 34.0, stock: 3, c: C.emerald },
];
const INITIAL_SAVED: SavedItem[] = [
  { id: 101, name: 'Brass Task Light', variant: 'Brass / Warm white', price: 182.0, c: C.violet },
  { id: 102, name: 'Felt Laptop Sleeve 14"', variant: 'Charcoal', price: 44.0, c: C.cyan },
];
const RELATED = [
  { id: 201, name: 'Grid Notebook A5', category: 'Stationery', price: 16.0, rating: 4.7, c: C.red },
  { id: 202, name: 'Oak Pen Tray', category: 'Decor', price: 28.0, rating: 4.6, c: C.amber },
  { id: 203, name: 'Leather Cable Wrap', category: 'Tech', price: 18.0, rating: 4.4, c: C.cyan },
  { id: 204, name: 'Cork Desk Mat', category: 'Desk', price: 38.0, rating: 4.3, c: C.violet },
  { id: 205, name: 'Stoneware Carafe', category: 'Drinkware', price: 52.0, rating: 4.5, c: C.pink },
];

export function Cart() {
  const [items, setItems] = useState<CartItem[]>(INITIAL_ITEMS);
  const [saved, setSaved] = useState<SavedItem[]>(INITIAL_SAVED);
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [undo, setUndo] = useState<{ show: boolean; item: CartItem | null; index: number; name: string }>({ show: false, item: null, index: 0, name: '' });
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subtotal = () => items.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = () => subtotal() * discount;
  const shipCost = () => { if (!items.length) return 0; return subtotal() - discountAmt() >= 75 ? 0 : 6.0; };
  const tax = () => (subtotal() - discountAmt()) * 0.0825;
  const total = () => Math.max(0, subtotal() - discountAmt() + shipCost() + tax());
  const hasBlocker = () => items.some((i) => i.stock === 0);

  const patchItem = (idx: number, patch: Partial<CartItem>) => setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const inc = (idx: number) => { const it = items[idx]; if (it.qty < it.stock) patchItem(idx, { qty: it.qty + 1 }); };
  const dec = (idx: number) => { const it = items[idx]; if (it.qty > 1) patchItem(idx, { qty: it.qty - 1 }); };
  const setQty = (idx: number, val: string) => { const it = items[idx]; let n = parseInt(val, 10); if (isNaN(n) || n < 1) n = 1; if (n > it.stock) n = it.stock || 1; patchItem(idx, { qty: n }); };

  const remove = (idx: number) => {
    const it = items[idx];
    setUndo({ show: true, item: { ...it }, index: idx, name: it.name });
    setItems((arr) => arr.filter((_, i) => i !== idx));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo((u) => ({ ...u, show: false })), 5000);
  };
  const restore = () => { if (undo.item) { const it = undo.item; const at = undo.index; setItems((arr) => { const next = [...arr]; next.splice(at, 0, it); return next; }); } setUndo((u) => ({ ...u, show: false })); if (undoTimer.current) clearTimeout(undoTimer.current); };
  const clearAll = () => { setItems([]); setUndo((u) => ({ ...u, show: false })); };
  const saveForLater = (idx: number) => { const it = items[idx]; setItems((arr) => arr.filter((_, i) => i !== idx)); setSaved((s) => [{ id: it.id, name: it.name, variant: it.variant, price: it.price, c: it.c }, ...s]); };
  const moveToCart = (idx: number) => { const it = saved[idx]; setSaved((s) => s.filter((_, i) => i !== idx)); setItems((arr) => [...arr, { id: it.id, name: it.name, variant: it.variant, sku: 'APG-' + String(it.id).padStart(4, '0'), qty: 1, price: it.price, stock: 50, c: it.c }]); };

  const applyCoupon = () => {
    const c = coupon.trim().toUpperCase();
    if (!c) { setCouponMsg(''); return; }
    if (c === 'WELCOME10') { setDiscount(0.1); setAppliedCode('WELCOME10'); setCouponMsg('WELCOME10 applied — 10% off your order.'); }
    else if (c === 'SAVE20') { setDiscount(0.2); setAppliedCode('SAVE20'); setCouponMsg('SAVE20 applied — 20% off your order.'); }
    else if (c === 'FREESHIP') { setDiscount(0); setAppliedCode('FREESHIP'); setCouponMsg('FREESHIP applied — free standard shipping.'); }
    else { setDiscount(0); setAppliedCode(''); setCouponMsg('“' + c + '” isn’t a valid promo code.'); }
  };

  const checkoutBlocked = !items.length || hasBlocker();

  return (
    <>
      <PageHead
        title="Shopping Cart"
        subtitle={
          (
            <><span className="ax-num">{items.length}</span> {items.length === 1 ? 'item' : 'items'} in your bag — free shipping unlocks at <span className="ax-num">$75.00</span>.</>
          ) as unknown as string
        }
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/ecommerce/products">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Continue shopping</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* LEFT: LINE ITEMS */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {undo.show && (
            <div className="ax-alert ax-alert--neutral ax-flex" role="status" style={{ alignItems: 'center', gap: 'var(--ax-space-3)' }}>
              <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg></span>
              <div className="ax-alert__content" style={{ flex: '1 1 auto' }}><p className="ax-alert__message"><b>{undo.name}</b> removed from cart.</p></div>
              <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={restore}>Undo</button>
            </div>
          )}

          {hasBlocker() && (
            <div className="ax-alert ax-alert--danger" role="alert">
              <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></span>
              <div className="ax-alert__content"><p className="ax-alert__title">An item is out of stock</p><p className="ax-alert__message">Remove the flagged item below to continue to checkout.</p></div>
            </div>
          )}

          {!!items.length && (
            <section className="ax-card" role="region" aria-label="Cart items">
              <div className="ax-card__header">
                <div className="ax-card__titles"><h2 className="ax-card__title">Your items</h2><p className="ax-card__subtitle">Prices and totals update as you change quantities.</p></div>
                <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={clearAll}>Clear cart</button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {items.map((it, idx) => (
                  <div key={it.id} style={{ display: 'flex', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-4) 0', borderTop: idx === 0 ? 0 : '1px solid var(--ax-border)' }}>
                    <Link href="/ecommerce/product-details" style={{ flex: 'none', width: 88, height: 88, borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', display: 'grid', placeItems: 'center', textDecoration: 'none', background: `color-mix(in oklab,${it.c} 16%,var(--ax-surface-subtle))` }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 34, height: 34, opacity: 0.6, color: it.c }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                    </Link>
                    <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <Link href="/ecommerce/product-details" className="ax-text-truncate" style={{ display: 'block', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', textDecoration: 'none', lineHeight: 1.3 }}>{it.name}</Link>
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>{it.variant}</div>
                          <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>{it.sku}</div>
                        </div>
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => remove(idx)} aria-label={'Remove ' + it.name}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                      </div>

                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        {it.stock === 0 && <span className="ax-badge ax-badge--danger ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 12, height: 12 }}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M5.7 5.7l12.6 12.6" /></svg>Out of stock</span>}
                        {it.stock > 0 && it.qty >= it.stock && <span className="ax-badge ax-badge--warning ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 12, height: 12 }}><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg>Only <span className="ax-num">{it.stock}</span> available</span>}
                      </div>

                      <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--ax-space-3)', marginTop: 'auto', flexWrap: 'wrap' }}>
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)' }}>
                          <div className="ax-cluster" style={{ gap: 0, flexWrap: 'nowrap', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', overflow: 'hidden', ...(it.stock === 0 ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}>
                            <button type="button" onClick={() => dec(idx)} disabled={it.qty <= 1} style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', background: 'var(--ax-surface)', border: 0, cursor: 'pointer', color: 'var(--ax-text)' }} aria-label={'Decrease quantity of ' + it.name}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15 }}><path d="M5 12l14 0" /></svg></button>
                            <input type="text" className="ax-num" inputMode="numeric" value={it.qty} onChange={(e) => setQty(idx, e.target.value)} style={{ width: 44, height: 34, textAlign: 'center', border: 0, borderInline: '1px solid var(--ax-border)', background: 'var(--ax-surface)', fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }} aria-label={'Quantity of ' + it.name} />
                            <button type="button" onClick={() => inc(idx)} disabled={it.qty >= it.stock} style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', background: 'var(--ax-surface)', border: 0, cursor: 'pointer', color: 'var(--ax-text)' }} aria-label={'Increase quantity of ' + it.name}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15 }}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg></button>
                          </div>
                          <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => saveForLater(idx)}>
                            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21l-1 -1c-3 -3 -7 -5 -7 -10a4 4 0 0 1 8 -1a4 4 0 0 1 8 1c0 5 -4 7 -7 10z" /></svg>
                            Save for later
                          </button>
                        </div>
                        <div style={{ textAlign: 'end' }}>
                          <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>{money(it.price * it.qty)}</div>
                          <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{money(it.price) + ' each'}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!items.length && (
            <section className="ax-card" role="region" aria-label="Empty cart">
              <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30 }}><path d="M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>Your cart is empty</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)', maxWidth: 340, marginInline: 'auto' }}>Looks like you haven't added anything yet. Browse the catalog to find something you'll love.</p>
                <Link className="ax-btn ax-btn--primary" href="/ecommerce/products">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" transform="rotate(180 12 12)" /><path d="M4 7a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-3a2 2 0 0 0 0 -4z" /></svg>
                  <span className="ax-btn__label">Browse products</span>
                </Link>
              </div>
            </section>
          )}

          {!!saved.length && (
            <section className="ax-card" role="region" aria-label="Saved for later">
              <div className="ax-card__header">
                <div className="ax-card__titles"><h2 className="ax-card__title">Saved for later</h2></div>
                <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num"><span>{saved.length}</span></span>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {saved.map((it, idx) => (
                  <div key={it.id} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span style={{ flex: 'none', width: 48, height: 48, borderRadius: 'var(--ax-radius-sm)', overflow: 'hidden', display: 'grid', placeItems: 'center', background: `color-mix(in oklab,${it.c} 16%,var(--ax-surface-subtle))` }}>{PIC(22, it.c)}</span>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{it.name}</div>
                      <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{it.variant}</div>
                    </div>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{money(it.price)}</span>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => moveToCart(idx)}>Move to cart</button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: ORDER SUMMARY */}
        <aside className="ax-col--4">
          <section className="ax-card" role="region" aria-label="Order summary" style={{ position: 'sticky', top: 'var(--ax-space-6)' }}>
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Order summary</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              {!!items.length && (
                <div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--ax-text-xs)' }}>
                    {shipCost() === 0 ? <span style={{ color: 'var(--ax-text-muted)' }}>You've unlocked free shipping! 🎉</span> : <span style={{ color: 'var(--ax-text-muted)' }}><span className="ax-num">{money(75 - subtotal())}</span> away from free shipping</span>}
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)' }}>{Math.min(100, Math.round((subtotal() / 75) * 100)) + '%'}</span>
                  </div>
                  <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${Math.min(100, (subtotal() / 75) * 100)}%`, background: 'var(--ax-accent)' }} /></div></div>
                </div>
              )}

              <div>
                <label className="ax-label" htmlFor="cart-coupon" style={{ marginBottom: 'var(--ax-space-2)' }}>Promo code</label>
                <div className="ax-input-group">
                  <input id="cart-coupon" type="text" className="ax-input" placeholder="e.g. WELCOME10" value={coupon} onChange={(e) => setCoupon(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} style={{ border: 0, background: 'transparent', textTransform: 'uppercase' }} />
                  <button type="button" className="ax-input-group__addon ax-btn ax-btn--ghost ax-btn--sm" onClick={applyCoupon} style={{ borderRadius: 0 }}>Apply</button>
                </div>
                {couponMsg && <p className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', margin: '6px 0 0', color: discount > 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-danger-500)' }}>{couponMsg}</p>}
              </div>

              <hr className="ax-divider" style={{ margin: 0 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(subtotal())}</span></div>
                {discount > 0 && <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}><span className="ax-badge ax-badge--success ax-badge--soft ax-badge--sm" style={{ borderRadius: 'var(--ax-radius-xs)' }}>{appliedCode}</span> Discount</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>{'−' + money(discountAmt())}</span></div>}
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>(est.)</span></span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: shipCost() === 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-text)' }}>{shipCost() === 0 ? 'Free' : money(shipCost())}</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>(est.)</span></span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(tax())}</span></div>
              </div>

              <hr className="ax-divider" style={{ margin: 0 }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Total</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{money(total())}</span>
              </div>

              <Link href="/ecommerce/checkout" className={`ax-btn ax-btn--primary ax-btn--block${checkoutBlocked ? ' is-disabled' : ''}`} aria-disabled={checkoutBlocked} tabIndex={checkoutBlocked ? -1 : 0} style={checkoutBlocked ? { pointerEvents: 'none', opacity: 0.5 } : undefined}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
                <span className="ax-btn__label">Checkout · <span className="ax-num">{money(total())}</span></span>
              </Link>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg><span>Secure checkout · 256-bit encryption</span></div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg><span>30-day money-back guarantee</span></div>
              </div>

              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center', opacity: 0.6 }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Visa"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Mastercard"><path d="M7 12a5 5 0 1 0 10 0a5 5 0 0 0 -10 0" /><path d="M12 7.5a5 5 0 0 1 0 9" /></svg>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-label="PayPal"><path d="M10 13l2.5 0c2.5 0 5 -2.5 5 -5c0 -3 -1.9 -4 -3.5 -4l-5.5 0l-2.5 16l3.5 0l.5 -3" /></svg>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-label="Apple Pay"><path d="M12 7c1 -2 2.5 -2.5 4 -2.5c.5 2 -.5 3.5 -1.5 4.5" /><path d="M14 9c1.5 0 3 1 3 3.5c0 2.5 -2 5.5 -3.5 5.5c-1 0 -1.5 -.5 -2.5 -.5s-1.5 .5 -2.5 .5c-1.5 0 -3.5 -3 -3.5 -5.5c0 -2.5 1.5 -3.5 3 -3.5c1 0 1.5 .5 2.5 .5s1.5 -.5 2.5 -.5" /></svg>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* RELATED RAIL */}
      {(items.length || saved.length) ? (
        <div className="ax-dash-grid" style={{ marginTop: 'var(--ax-space-6)' }}>
          <section className="ax-card ax-col--12" role="region" aria-label="You may also like">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">You may also like</h2></div>
              <Link className="ax-btn ax-btn--link" href="/ecommerce/products">View all</Link>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 'var(--ax-space-4)' }}>
                {RELATED.map((r) => (
                  <article key={r.id} className="ax-card ax-card--interactive" style={{ margin: 0 }}>
                    <Link href="/ecommerce/product-details" style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ aspectRatio: '1/1', borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) 0 0', overflow: 'hidden', display: 'grid', placeItems: 'center', background: `color-mix(in oklab,${r.c} 16%,var(--ax-surface-subtle))` }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 42, height: 42, opacity: 0.55, color: r.c }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg>
                      </div>
                      <div style={{ padding: 'var(--ax-space-4)' }}>
                        <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>{r.category}</div>
                        <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginTop: 2 }}>{r.name}</div>
                        <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
                          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{money(r.price)}</span>
                          <span className="ax-rating ax-rating--sm" aria-label={r.rating + ' out of 5'}>{[1, 2, 3, 4, 5].map((s) => (<svg key={s} className={`ax-rating__star${s <= Math.round(r.rating) ? ' ax-rating__star--full' : ''}`} viewBox="0 0 24 24" fill={s <= Math.round(r.rating) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>))}</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default Cart;
