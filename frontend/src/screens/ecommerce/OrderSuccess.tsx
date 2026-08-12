'use client';
/*
 * Vireo Next.js — Ecommerce / Order success (route "ecommerce/order-success").
 *
 * Faithful re-expression of src/html/ecommerce/order-success.html: a confirmation
 * hero (success check, copyable order number, track/receipt CTAs, delivery strip),
 * an order-summary rail and a "what happens next" grid. The Alpine x-data
 * (axSuccess) copy-order behaviour is ported to React state; classes match 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const PRODUCT_AV = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg>
);

const SUMMARY = [
  { c: 'var(--ax-viz-cyan)', name: 'Aperture Desk Lamp', sub: 'Brass · Qty 1', price: '$129.00' },
  { c: 'var(--ax-viz-violet)', name: 'Matte Ceramic Mug', sub: 'Slate · Qty 2', price: '$48.00' },
  { c: 'var(--ax-viz-amber)', name: 'Walnut Monitor Riser', sub: 'Large · Qty 1', price: '$96.00' },
];

export function OrderSuccess() {
  const orderNo = '#ORD-2026-4815';
  const [copied, setCopied] = useState(false);
  const copyOrder = () => { navigator.clipboard?.writeText(orderNo); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  return (
    <>
      <PageHead
        title="Order confirmed"
        subtitle="Thank you, Amelia — a receipt is on its way to your inbox."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ecommerce/products">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304" /><path d="M9 11v-5a3 3 0 0 1 6 0v5" /></svg>
            <span className="ax-btn__label">Continue shopping</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* CONFIRMATION HERO */}
        <section className="ax-card ax-col--8" role="region" aria-label="Order confirmation">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--ax-space-9) var(--ax-space-6) var(--ax-space-7)' }}>
            <span aria-hidden="true" style={{ position: 'relative', width: 96, height: 96, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-success-500) 16%,transparent)', marginBottom: 'var(--ax-space-5)' }}>
              <span style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid color-mix(in oklab,var(--ax-success-500) 28%,transparent)' }} />
              <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="var(--ax-success-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>
            </span>
            <h2 style={{ margin: '0 0 var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>Your order is placed!</h2>
            <p style={{ margin: '0 0 var(--ax-space-5)', maxWidth: '42ch', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>We've received your order and will email you a confirmation shortly. You can track its progress any time from your orders.</p>

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', marginBottom: 'var(--ax-space-6)' }}>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Order</span>
              <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-strong)', letterSpacing: '.02em' }}>{orderNo}</b>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={copyOrder} aria-label={copied ? 'Copied' : 'Copy order number'}>
                {!copied ? <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg> : <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="var(--ax-success-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
              </button>
            </div>

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="ax-btn ax-btn--primary" href="/ecommerce/order-details">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /></svg>
                <span className="ax-btn__label">Track order</span>
              </Link>
              <a className="ax-btn ax-btn--secondary" href="#">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2m4 -14h6m-6 4h6m-2 4h2" /></svg>
                <span className="ax-btn__label">View receipt</span>
              </a>
            </div>
          </div>

          <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--ax-space-6)', flexWrap: 'wrap', padding: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /></svg></span>
              <div style={{ textAlign: 'start' }}><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Estimated delivery</div><b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Jul 2 – Jul 4, 2026</b></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <span style={{ width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg></span>
              <div style={{ textAlign: 'start' }}><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Shipping to</div><b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Portland, OR 97201</b></div>
            </div>
          </div>
        </section>

        {/* ORDER SUMMARY RAIL */}
        <aside className="ax-col--4">
          <section className="ax-card" role="region" aria-label="Order summary">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Order summary</h2><p className="ax-card__subtitle">Placed Jun 27, 2026 · 2:41 PM</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <ul className="ax-list ax-list--compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {SUMMARY.map((it) => (
                  <li key={it.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--squircle" style={{ background: `color-mix(in oklab,${it.c} 16%,transparent)`, color: it.c }}>{PRODUCT_AV}</span>
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}><span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{it.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{it.sub}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{it.price}</span>
                  </li>
                ))}
              </ul>
              <hr className="ax-divider" style={{ margin: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$273.00</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Discount (WELCOME10)</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>−$27.30</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>Free</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$20.27</span></div>
              </div>
              <hr className="ax-divider" style={{ margin: 0 }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Total paid</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>$265.97</span>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-surface-subtle)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>
                <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Paid with Visa •••• 4242</span>
              </div>
            </div>
          </section>
        </aside>

        {/* WHAT'S NEXT */}
        <section className="ax-card ax-col--12" role="region" aria-label="What happens next">
          <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">What happens next</h2></div></div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 'var(--ax-radius-md)', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
              <div><b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Confirmation email</b><p style={{ margin: '2px 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>Sent to amelia.hart@gmail.com with your receipt and order details.</p></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 'var(--ax-radius-md)', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-viz-violet) 16%,transparent)', color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /></svg></span>
              <div><b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Order processing</b><p style={{ margin: '2px 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>We're packing your items. You'll get a notice when they leave the warehouse.</p></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 'var(--ax-radius-md)', display: 'grid', placeItems: 'center', background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /></svg></span>
              <div><b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Shipment &amp; tracking</b><p style={{ margin: '2px 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>A tracking link arrives once your parcel is on its way to Portland.</p></div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default OrderSuccess;
