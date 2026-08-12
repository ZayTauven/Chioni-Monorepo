'use client';
/*
 * Vireo Next.js — Ecommerce / Checkout (route "ecommerce/checkout").
 *
 * Faithful re-expression of src/html/ecommerce/checkout.html: a 4-step wizard
 * (contact & address, shipping method, payment, review) driven by a clickable
 * stepper, with a sticky order-summary rail (line items, promo, live totals).
 * The Alpine x-data (axCheckout) — step nav, method selection, coupon, totals —
 * is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHead } from '../../components/shell/PageHead';

const C2 = 'var(--ax-viz-cyan)', C3 = 'var(--ax-viz-violet)', C4 = 'var(--ax-viz-amber)';
const money = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STEPS = [
  { id: 'addr', label: 'Address' },
  { id: 'ship', label: 'Shipping' },
  { id: 'pay', label: 'Payment' },
  { id: 'review', label: 'Review' },
];
const SAVED_ADDRESSES = [
  { id: 'home', name: 'Amelia Hart', tag: 'Default', lines: '1820 NW Glisan St, Apt 4B · Portland, OR 97201' },
  { id: 'work', name: 'Amelia Hart', tag: 'Work', lines: '500 SW Broadway, Ste 900 · Portland, OR 97205' },
];

interface ShipMethod { id: string; name: string; eta: string; price: number; c: string; icon: ReactElement; }
const SHIP_METHODS: ShipMethod[] = [
  { id: 'standard', name: 'Standard', eta: '5–7 business days', price: 0, c: 'var(--ax-viz-emerald)', icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-11a1 1 0 0 1 1 -1h9v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /></svg> },
  { id: 'express', name: 'Express', eta: '2–3 business days', price: 12.0, c: C2, icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" /></svg> },
  { id: 'priority', name: 'Priority overnight', eta: 'Next business day by 12 PM', price: 24.5, c: C4, icon: <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg> },
];

interface PayMethod { id: string; name: string; icon: ReactElement; }
const PAY_METHODS: PayMethod[] = [
  { id: 'card', name: 'Card', icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg> },
  { id: 'paypal', name: 'PayPal', icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13l2.5 0c2.5 0 5 -2.5 5 -5c0 -3 -1.9 -4 -3.5 -4l-5.5 0l-2.5 16l3.5 0l.5 -3" /><path d="M19 9c1 .5 1.5 1.5 1.5 3c0 3 -2.5 5 -5 5l-2.5 0l-.5 3" /></svg> },
  { id: 'bank', name: 'Bank', icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M3 10l18 0" /><path d="M5 6l7 -3l7 3" /><path d="M4 10l0 11" /><path d="M20 10l0 11" /><path d="M8 14l0 3" /><path d="M12 14l0 3" /><path d="M16 14l0 3" /></svg> },
  { id: 'cod', name: 'Cash', icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 6 0v-12a3 3 0 0 0 -3 -3" /><path d="M12 3a12 12 0 0 0 8 3" /></svg> },
];

const ITEMS = [
  { id: 1, name: 'Aperture Desk Lamp', variant: 'Brass / Warm white', qty: 1, price: 129.0, c: C2 },
  { id: 2, name: 'Matte Ceramic Mug', variant: 'Slate · 12 oz', qty: 2, price: 24.0, c: C3 },
  { id: 3, name: 'Walnut Monitor Riser', variant: 'Walnut / Large', qty: 1, price: 96.0, c: C4 },
];

const PRODUCT_AV = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg>
);

export function Checkout() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [mode, setMode] = useState<'guest' | 'account'>('guest');
  const [savedAddr, setSavedAddr] = useState('home');
  const [shipDifferent, setShipDifferent] = useState(false);
  const [shipping, setShipping] = useState('standard');
  const [payment, setPayment] = useState('card');
  const [terms, setTerms] = useState(false);
  const [payError] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [discount, setDiscount] = useState(0);

  const subtotal = () => ITEMS.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = () => subtotal() * discount;
  const shipCost = () => (subtotal() - discountAmt() > 75 && shipping === 'standard' ? 0 : SHIP_METHODS.find((m) => m.id === shipping)?.price || 0);
  const tax = () => (subtotal() - discountAmt()) * 0.0825;
  const total = () => subtotal() - discountAmt() + shipCost() + tax();
  const currentShip = () => SHIP_METHODS.find((m) => m.id === shipping)!;
  const currentPay = () => PAY_METHODS.find((m) => m.id === payment)!;

  const next = () => { if (step < 3) { const ns = step + 1; setStep(ns); setMaxReached((m) => Math.max(m, ns)); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const prev = () => { if (step > 0) { setStep(step - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const goTo = (i: number) => { if (i <= maxReached) { setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const applyCoupon = () => { const c = coupon.trim().toUpperCase(); if (c === 'WELCOME10') { setDiscount(0.1); setCouponMsg('WELCOME10 applied — 10% off'); } else if (c === 'SAVE20') { setDiscount(0.2); setCouponMsg('SAVE20 applied — 20% off'); } else if (c) { setDiscount(0); setCouponMsg('That code isn’t valid'); } };
  const placeOrder = () => router.push('/ecommerce/order-success');

  return (
    <>
      <PageHead
        title="Checkout"
        subtitle={
          (<>Secure checkout — <span className="ax-num">3</span> items in your bag, ships from Portland, OR.</>) as unknown as string
        }
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/ecommerce/cart">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
            <span className="ax-btn__label">Back to cart</span>
          </Link>
        }
      />

      {/* STEPPER */}
      <div className="ax-card ax-col--12" role="region" aria-label="Checkout progress" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card__body" style={{ padding: 'var(--ax-space-5) var(--ax-space-6)' }}>
          <ol style={{ display: 'flex', alignItems: 'flex-start', gap: 0, listStyle: 'none', margin: 0, padding: 0 }} aria-label="Checkout steps">
            {STEPS.map((s, i) => (
              <li key={s.id} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 0 }}>
                {i > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 18, height: 2, insetInlineEnd: '50%', width: '100%', background: i <= step ? 'var(--ax-accent)' : 'var(--ax-border)' }} />}
                <button type="button" onClick={() => goTo(i)} disabled={i > maxReached} aria-current={i === step ? 'step' : 'false'} aria-label={'Step ' + (i + 1) + ': ' + s.label}
                  style={{ position: 'relative', zIndex: 1, width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontFamily: 'var(--ax-font-mono)', fontWeight: 600, fontSize: 'var(--ax-text-sm)', border: '2px solid', transition: 'all var(--ax-motion-fast) var(--ax-ease-standard)', ...(i < step ? { background: 'var(--ax-accent)', borderColor: 'var(--ax-accent)', color: 'var(--ax-on-accent)', cursor: 'pointer' } : i === step ? { background: 'var(--ax-surface-solid)', borderColor: 'var(--ax-accent)', color: 'var(--ax-accent)', boxShadow: '0 0 0 4px var(--ax-accent-wash)' } : { background: 'var(--ax-surface-solid)', borderColor: 'var(--ax-border-strong)', color: 'var(--ax-text-subtle)', cursor: 'default' }) }}>
                  {i < step ? <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg> : <span>{i + 1}</span>}
                </button>
                <span style={{ marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', textAlign: 'center', fontWeight: 'var(--ax-weight-medium)', color: i === step ? 'var(--ax-text-strong)' : i < step ? 'var(--ax-text)' : 'var(--ax-text-subtle)' }}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="ax-dash-grid">
        {/* LEFT: STEP PANELS */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* STEP 1 · ADDRESS */}
          {step === 0 && (
            <section className="ax-card" role="region" aria-label="Shipping address">
              <div className="ax-card__header">
                <div className="ax-card__titles"><span className="ax-card__eyebrow">Step 1 of 4</span><h2 className="ax-card__title">Contact &amp; address</h2><p className="ax-card__subtitle">Where should we ship your order?</p></div>
                <div className="ax-card__actions">
                  <div className="ax-segment" role="radiogroup" aria-label="Checkout type">
                    <button type="button" className={`ax-segment__option${mode === 'guest' ? ' is-active' : ''}`} onClick={() => setMode('guest')} aria-checked={mode === 'guest'} role="radio">Guest</button>
                    <button type="button" className={`ax-segment__option${mode === 'account' ? ' is-active' : ''}`} onClick={() => setMode('account')} aria-checked={mode === 'account'} role="radio">Account</button>
                  </div>
                </div>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="co-email">Email address <span className="ax-field__required">*</span></label>
                  <input id="co-email" type="email" className="ax-input" defaultValue="amelia.hart@gmail.com" autoComplete="email" />
                  <span className="ax-help">Order confirmation &amp; tracking will be sent here.</span>
                </div>

                <div>
                  <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Saved addresses</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                    {SAVED_ADDRESSES.map((a) => (
                      <label key={a.id} style={{ position: 'relative', display: 'block', cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', border: '1.5px solid', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(savedAddr === a.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : { borderColor: 'var(--ax-border)', background: 'var(--ax-surface)' }) }}>
                        <input type="radio" name="saved-addr" className="ax-radio" value={a.id} checked={savedAddr === a.id} onChange={() => setSavedAddr(a.id)} style={{ position: 'absolute', insetInlineEnd: 'var(--ax-space-3)', top: 'var(--ax-space-3)' }} />
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 'var(--ax-space-1)' }}>
                          <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{a.name}</b>
                          {a.tag && <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm ax-badge--pill">{a.tag}</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', lineHeight: 1.5 }}>{a.lines}</p>
                      </label>
                    ))}
                    <button type="button" onClick={() => setSavedAddr('new')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--ax-space-2)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', border: '1.5px dashed var(--ax-border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--ax-text-muted)', minHeight: 84, ...(savedAddr === 'new' ? { borderColor: 'var(--ax-accent)', color: 'var(--ax-accent)' } : {}) }}>
                      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                      <span style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-medium)' }}>Use a new address</span>
                    </button>
                  </div>
                </div>

                {savedAddr === 'new' && (
                  <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                    <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="co-name">Full name <span className="ax-field__required">*</span></label><input id="co-name" type="text" className="ax-input" placeholder="Amelia Hart" autoComplete="name" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="co-line1">Address line 1 <span className="ax-field__required">*</span></label><input id="co-line1" type="text" className="ax-input" placeholder="Street address" autoComplete="address-line1" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="co-line2">Address line 2</label><input id="co-line2" type="text" className="ax-input" placeholder="Apartment, suite, etc. (optional)" autoComplete="address-line2" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="co-city">City <span className="ax-field__required">*</span></label><input id="co-city" type="text" className="ax-input" placeholder="City" autoComplete="address-level2" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 3' }}><label className="ax-label" htmlFor="co-state">State <span className="ax-field__required">*</span></label><input id="co-state" type="text" className="ax-input" placeholder="OR" autoComplete="address-level1" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 3' }}><label className="ax-label" htmlFor="co-zip">ZIP <span className="ax-field__required">*</span></label><input id="co-zip" type="text" className="ax-input ax-num" placeholder="97201" inputMode="numeric" autoComplete="postal-code" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="co-phone">Phone</label><input id="co-phone" type="tel" className="ax-input" placeholder="(555) 000-0000" autoComplete="tel" /></div>
                  </div>
                )}

                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
                  <input type="checkbox" className="ax-checkbox" checked={shipDifferent} onChange={(e) => setShipDifferent(e.target.checked)} />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Billing address is different from shipping</span>
                </label>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="ax-btn ax-btn--primary" onClick={next}><span className="ax-btn__label">Continue to shipping</span><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </div>
            </section>
          )}

          {/* STEP 2 · SHIPPING */}
          {step === 1 && (
            <section className="ax-card" role="region" aria-label="Shipping method">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 2 of 4</span><h2 className="ax-card__title">Shipping method</h2><p className="ax-card__subtitle">Delivering to Portland, OR 97201.</p></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {SHIP_METHODS.map((m) => (
                  <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-4)', cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', border: '1.5px solid', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(shipping === m.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : { borderColor: 'var(--ax-border)', background: 'var(--ax-surface)' }) }}>
                    <input type="radio" name="ship-method" className="ax-radio" value={m.id} checked={shipping === m.id} onChange={() => setShipping(m.id)} />
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--ax-radius-md)', display: 'grid', placeItems: 'center', flex: 'none', background: `color-mix(in oklab,${m.c} 16%,transparent)`, color: m.c }}>{m.icon}</span>
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{m.name}</span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>{m.eta}</span>
                    </span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: m.price === 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-text-strong)' }}>{m.price === 0 ? 'Free' : money(m.price)}</span>
                  </label>
                ))}
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                  <span>Free standard shipping on orders over $75.00.</span>
                </div>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={prev}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg><span className="ax-btn__label">Back</span></button>
                <button type="button" className="ax-btn ax-btn--primary" onClick={next}><span className="ax-btn__label">Continue to payment</span><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </div>
            </section>
          )}

          {/* STEP 3 · PAYMENT */}
          {step === 2 && (
            <section className="ax-card" role="region" aria-label="Payment">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 3 of 4</span><h2 className="ax-card__title">Payment</h2><p className="ax-card__subtitle">All transactions are secured &amp; encrypted.</p></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                {payError && (
                  <div className="ax-alert ax-alert--danger" role="alert">
                    <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></span>
                    <div className="ax-alert__content"><p className="ax-alert__title">Card declined</p><p className="ax-alert__message">Check the number or try another payment method.</p></div>
                  </div>
                )}

                <div role="radiogroup" aria-label="Payment method" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--ax-space-3)' }}>
                  {PAY_METHODS.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={payment === p.id} onClick={() => setPayment(p.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3)', borderRadius: 'var(--ax-radius-md)', border: '1.5px solid', cursor: 'pointer', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(payment === p.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' } : { borderColor: 'var(--ax-border)', background: 'var(--ax-surface)', color: 'var(--ax-text-muted)' }) }}>
                      {p.icon}
                      <span style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-medium)' }}>{p.name}</span>
                    </button>
                  ))}
                </div>

                {payment === 'card' && (
                  <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                    <div className="ax-field" style={{ gridColumn: 'span 12' }}>
                      <label className="ax-label" htmlFor="cc-num">Card number <span className="ax-field__required">*</span></label>
                      <div className="ax-input-group">
                        <input id="cc-num" type="text" className="ax-input ax-num" placeholder="4242 4242 4242 4242" inputMode="numeric" maxLength={19} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)', letterSpacing: '.08em' }} />
                        <span className="ax-input-group__addon" aria-hidden="true" style={{ paddingInline: 'var(--ax-space-3)', color: 'var(--ax-text-muted)' }}><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg></span>
                      </div>
                    </div>
                    <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="cc-name">Name on card <span className="ax-field__required">*</span></label><input id="cc-name" type="text" className="ax-input" placeholder="Amelia Hart" autoComplete="cc-name" /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 3' }}><label className="ax-label" htmlFor="cc-exp">Expiry <span className="ax-field__required">*</span></label><input id="cc-exp" type="text" className="ax-input ax-num" placeholder="MM / YY" inputMode="numeric" maxLength={7} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 3' }}><label className="ax-label" htmlFor="cc-cvc">CVC <span className="ax-field__required">*</span></label><input id="cc-cvc" type="text" className="ax-input ax-num" placeholder="123" inputMode="numeric" maxLength={4} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                  </div>
                )}

                {payment === 'paypal' && <div className="ax-alert ax-alert--info ax-alert--inline" role="status"><span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg></span><div className="ax-alert__content"><p className="ax-alert__message">You'll be redirected to PayPal to complete payment securely after placing your order.</p></div></div>}
                {payment === 'bank' && <div className="ax-alert ax-alert--info ax-alert--inline" role="status"><span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg></span><div className="ax-alert__content"><p className="ax-alert__message">Transfer details will appear on the confirmation page. Order ships once payment clears.</p></div></div>}
                {payment === 'cod' && <div className="ax-alert ax-alert--info ax-alert--inline" role="status"><span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg></span><div className="ax-alert__content"><p className="ax-alert__message">Pay the courier in cash on delivery. A $3.00 handling fee applies for COD.</p></div></div>}

                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
                  <input type="checkbox" className="ax-checkbox" defaultChecked />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Billing address same as shipping</span>
                </label>

                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
                  <span>Secured by 256-bit TLS encryption. We never store your CVC.</span>
                </div>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={prev}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg><span className="ax-btn__label">Back</span></button>
                <button type="button" className="ax-btn ax-btn--primary" onClick={next}><span className="ax-btn__label">Review order</span><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </div>
            </section>
          )}

          {/* STEP 4 · REVIEW */}
          {step === 3 && (
            <section className="ax-card" role="region" aria-label="Review order">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 4 of 4</span><h2 className="ax-card__title">Review &amp; place order</h2><p className="ax-card__subtitle">Confirm everything looks right before you pay.</p></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                  <div><div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Contact</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>amelia.hart@gmail.com</div></div>
                  <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(0)}>Edit</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                  <div><div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Ship to</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Amelia Hart</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>1820 NW Glisan St, Apt 4B · Portland, OR 97201 · United States</div></div>
                  <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(0)}>Edit</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                  <div><div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Shipping</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{currentShip().name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>{currentShip().eta}</div></div>
                  <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(1)}>Edit</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                  <div><div className="ax-card__eyebrow" style={{ marginBottom: 'var(--ax-space-1)' }}>Payment</div><div className="ax-cluster ax-num" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}><span>{payment === 'card' ? 'Visa •••• 4242' : currentPay().name}</span></div></div>
                  <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(2)}>Edit</button>
                </div>

                <hr className="ax-divider" />

                <ul className="ax-list ax-list--compact">
                  {ITEMS.map((it) => (
                    <li key={it.id} className="ax-list__row">
                      <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${it.c} 16%,transparent)`, color: it.c }}>{PRODUCT_AV}</span></span>
                      <span className="ax-list__content"><span className="ax-list__title">{it.name}</span><span className="ax-list__meta">{it.variant + ' · Qty ' + it.qty}</span></span>
                      <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{money(it.price * it.qty)}</span>
                    </li>
                  ))}
                </ul>

                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'flex-start', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                  <input type="checkbox" className="ax-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ marginTop: 2 }} />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>I agree to the <a href="#" className="ax-link">Terms of Service</a> and <a href="#" className="ax-link">Refund Policy</a>.</span>
                </label>
              </div>
              <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={prev}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg><span className="ax-btn__label">Back</span></button>
                <button type="button" className="ax-btn ax-btn--primary" disabled={!terms} onClick={placeOrder}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg>
                  <span className="ax-btn__label">Place order · <span className="ax-num">{money(total())}</span></span>
                </button>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: ORDER SUMMARY RAIL */}
        <aside className="ax-col--4">
          <section className="ax-card" role="region" aria-label="Order summary" style={{ position: 'sticky', top: 'var(--ax-space-6)' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Order summary</h2></div>
              <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num"><span>{ITEMS.length}</span> items</span>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <ul className="ax-list ax-list--compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {ITEMS.map((it) => (
                  <li key={it.id} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span style={{ position: 'relative', flex: 'none' }}>
                      <span className="ax-avatar ax-avatar--squircle" style={{ background: `color-mix(in oklab,${it.c} 16%,transparent)`, color: it.c }}>{PRODUCT_AV}</span>
                      <span className="ax-num" style={{ position: 'absolute', top: -6, insetInlineEnd: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: 'var(--ax-text-strong)', color: 'var(--ax-canvas)', fontSize: 'var(--ax-text-2xs)', fontFamily: 'var(--ax-font-mono)', display: 'grid', placeItems: 'center' }}>{it.qty}</span>
                    </span>
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{it.name}</span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{it.variant}</span>
                    </span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{money(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>

              <div className="ax-input-group">
                <input type="text" className="ax-input" placeholder="Promo code" value={coupon} onChange={(e) => setCoupon(e.target.value)} style={{ border: 0, background: 'transparent' }} aria-label="Promo code" />
                <button type="button" className="ax-input-group__addon ax-btn ax-btn--ghost ax-btn--sm" onClick={applyCoupon} style={{ borderRadius: 0 }}>Apply</button>
              </div>
              {couponMsg && <p className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', margin: 0, color: discount > 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-danger-500)' }}>{couponMsg}</p>}

              <hr className="ax-divider" style={{ margin: 0 }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(subtotal())}</span></div>
                {discount > 0 && <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Discount</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>{'−' + money(discountAmt())}</span></div>}
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>(est.)</span></span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: shipCost() === 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-text)' }}>{shipCost() === 0 ? 'Free' : money(shipCost())}</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>(est.)</span></span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(tax())}</span></div>
              </div>
              <hr className="ax-divider" style={{ margin: 0 }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Total</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{money(total())}</span>
              </div>

              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-1)' }}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M9 12l2 2l4 -4" /></svg>
                <span>30-day money-back guarantee</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default Checkout;
