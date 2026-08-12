'use client';
/*
 * Vireo Next.js — Ecommerce / Product details (route "ecommerce/product-details").
 *
 * Faithful re-expression of src/html/ecommerce/product-details.html: a gallery
 * with thumbnail strip, a buy box (wishlist, swatches, size pills, qty stepper,
 * add-to-cart), a tabbed info panel (description / specs / reviews) and a buyer
 * rail (shipping, related). The "write a review" modal is a native dialog. The
 * Alpine x-data is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const STAR = (
  <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" />
);
const PIC_GLYPH = (
  <><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></>
);

const money = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const THUMBS = [
  { id: 1, color: '#38BDF8', alt: 'Front view' },
  { id: 2, color: '#A78BFA', alt: 'Side profile' },
  { id: 3, color: '#FBBF24', alt: 'Base detail' },
  { id: 4, color: '#34D399', alt: 'In use on desk' },
  { id: 5, color: '#F472B6', alt: 'Packaging' },
];
const COLORS = [
  { id: 'graphite', name: 'Graphite', hex: '#52514C' },
  { id: 'ivory', name: 'Ivory', hex: '#E7E2D6' },
  { id: 'sage', name: 'Sage', hex: '#7A8B6F' },
  { id: 'cobalt', name: 'Cobalt', hex: '#3457B2' },
];
const SIZES = [
  { id: 'compact', name: '40 cm', avail: true },
  { id: 'std', name: '48 cm', avail: true },
  { id: 'tall', name: '60 cm', avail: false },
];
const DIST = [
  { star: 5, n: 96, pct: 75 },
  { star: 4, n: 21, pct: 16 },
  { star: 3, n: 7, pct: 5 },
  { star: 2, n: 3, pct: 2 },
  { star: 1, n: 1, pct: 1 },
];
const REVIEWS = [
  { id: 1, name: 'Camila Rossi', i: 'CR', c: '#34D399', verified: true, date: 'Jun 18, 2026', rating: 5, helpful: 24, body: 'Beautifully built and the magnetic arm actually holds position — no drooping after a week of heavy use. The 2700K setting is lovely for evening work.' },
  { id: 2, name: 'Henry Whitlock', i: 'HW', c: '#A78BFA', verified: true, date: 'Jun 9, 2026', rating: 4, helpful: 11, body: 'Great light quality and the USB-C passthrough is a nice touch. Knocked a star because the dimmer is touch-only and occasionally misreads a swipe.' },
  { id: 3, name: 'Priya Nair', i: 'PN', c: '#FBBF24', verified: false, date: 'May 30, 2026', rating: 5, helpful: 7, body: 'Replaced two cheaper lamps with this one. The colour rendering is noticeably better — my desk photos look true to life now.' },
];
const RELATED = [
  { id: 1, name: 'Brass Task Light', category: 'Lighting', price: 182, color: '#A78BFA' },
  { id: 2, name: 'Walnut Monitor Riser', category: 'Desk', price: 96, color: '#FBBF24' },
  { id: 3, name: 'Cork Desk Mat', category: 'Desk', price: 38, color: '#38BDF8' },
];

export function ProductDetails() {
  const [active, setActive] = useState(THUMBS[0]);
  const [wished, setWished] = useState(false);
  const [color, setColor] = useState('graphite');
  const [size, setSize] = useState('std');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [tab, setTab] = useState<'desc' | 'specs' | 'reviews'>('desc');
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <>
      <PageHead
        title="Aperture Desk Lamp"
        subtitle={
          (
            <>SKU <span className="ax-num">APG-0001</span> · Lighting · Last updated Jun 22, 2026.</>
          ) as unknown as string
        }
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/ecommerce/products">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Back to products</span>
            </Link>
            <Link className="ax-btn ax-btn--primary" href="/ecommerce/edit-product">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" /><path d="M16 5l3 3" /></svg>
              <span className="ax-btn__label">Edit product</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* GALLERY */}
        <section className="ax-card ax-col--6" role="region" aria-label="Product gallery">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab,${active.color} 16%,var(--ax-surface-subtle))` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 96, height: 96, opacity: 0.5, color: active.color }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
              <span className="ax-badge ax-badge--danger ax-badge--solid" style={{ position: 'absolute', top: 14, insetInlineStart: 14, borderRadius: 'var(--ax-radius-xs)' }}>-19%</span>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" style={{ position: 'absolute', top: 12, insetInlineEnd: 12 }} aria-label="Open in lightbox">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4l4 0l0 4" /><path d="M14 10l6 -6" /><path d="M8 20l-4 0l0 -4" /><path d="M4 20l6 -6" /></svg>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 'var(--ax-space-2)' }}>
              {THUMBS.map((t) => (
                <button key={t.id} type="button" onClick={() => setActive(t)} style={{ aspectRatio: '1/1', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', border: '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab,${t.color} 16%,var(--ax-surface-subtle))`, ...(active.id === t.id ? { borderColor: 'var(--ax-accent)', boxShadow: '0 0 0 1px var(--ax-accent)' } : {}) }} aria-label={'View ' + t.alt} aria-pressed={active.id === t.id}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 22, height: 22, opacity: 0.6, color: t.color }}>{PIC_GLYPH}</svg>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* BUY BOX */}
        <section className="ax-card ax-col--6" role="region" aria-label="Purchase">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>Aperture · Lighting</span>
                  <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', lineHeight: 1.2, marginTop: 2 }}>Aperture Desk Lamp</h2>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-pressed={wished} onClick={() => setWished(!wished)} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}>
                  <svg viewBox="0 0 24 24" fill={wished ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18, ...(wished ? { color: 'var(--ax-accent)' } : {}) }}><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
                </button>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-3)' }}>
                <span className="ax-rating" aria-label="4.7 out of 5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <svg key={s} className={`ax-rating__star${s <= 4 ? ' ax-rating__star--full' : s === 5 ? ' ax-rating__star--half' : ''}`} viewBox="0 0 24 24" fill={s <= 4 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>
                  ))}
                </span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>4.7</span>
                <a href="#reviews" className="ax-link" style={{ fontSize: 'var(--ax-text-sm)' }}>128 reviews</a>
              </div>
            </div>

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'baseline' }}>
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)' }}>$129.00</span>
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>$159.00</span>
              <span className="ax-badge ax-badge--danger ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Save $30.00</span>
            </div>

            <div>
              <span className="ax-badge ax-badge--success ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M5 12l5 5l10 -10" /></svg>In stock — <span className="ax-num">84</span> available</span>
            </div>

            <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>A precision-machined aluminium task lamp with stepless dimming, a magnetic articulating arm and a warm 2700K–4000K tunable LED. Built for focused desk work, it ships with a USB-C passthrough base.</p>

            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span className="ax-label">Finish</span>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{COLORS.find((c) => c.id === color)!.name}</span>
              </div>
              <div role="radiogroup" aria-label="Finish" className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                {COLORS.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={color === c.id} onClick={() => setColor(c.id)} aria-label={c.name} style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.hex, boxShadow: '0 0 0 1px var(--ax-border-strong)', ...(color === c.id ? { outline: '2px solid var(--ax-accent)', outlineOffset: 2 } : {}) }}>
                    {color === c.id && <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15 }}><path d="M5 12l5 5l10 -10" /></svg>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span className="ax-label">Reach</span>
              </div>
              <div role="radiogroup" aria-label="Reach" className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                {SIZES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={size === s.id} aria-disabled={!s.avail} onClick={() => s.avail && setSize(s.id)} disabled={!s.avail} style={{ minWidth: 64, padding: '8px var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', borderRadius: 'var(--ax-radius-sm)', border: '1px solid var(--ax-border)', background: 'var(--ax-surface)', ...(!s.avail ? { color: 'var(--ax-text-disabled)', textDecoration: 'line-through', cursor: 'not-allowed' } : size === s.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', cursor: 'pointer' } : { color: 'var(--ax-text)', cursor: 'pointer' }) }}>{s.name}</button>
                ))}
              </div>
            </div>

            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <div className="ax-cluster" style={{ gap: 0, flexWrap: 'nowrap', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', overflow: 'hidden' }}>
                <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ax-surface)', border: 0, cursor: 'pointer', color: 'var(--ax-text)' }} aria-label="Decrease quantity"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M5 12l14 0" /></svg></button>
                <input type="text" className="ax-num" inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/[^0-9]/g, '')) || 1)} style={{ width: 48, height: 38, textAlign: 'center', border: 0, borderInline: '1px solid var(--ax-border)', background: 'var(--ax-surface)', fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }} aria-label="Quantity" />
                <button type="button" onClick={() => setQty(Math.min(84, qty + 1))} disabled={qty >= 84} style={{ width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ax-surface)', border: 0, cursor: 'pointer', color: 'var(--ax-text)' }} aria-label="Increase quantity"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg></button>
              </div>
              <Link href="/ecommerce/cart" className="ax-btn ax-btn--primary ax-btn--block" onClick={() => setAdded(true)} style={{ flex: '1 1 auto' }}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg>
                <span className="ax-btn__label">Add to cart</span>
              </Link>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">Buy it now</button>
            {added && <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)', textAlign: 'center' }}>Added <span className="ax-num">{qty}</span> to your cart.</p>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--ax-space-3)', fontSize: 'var(--ax-text-sm)' }}>
              <div><span style={{ color: 'var(--ax-text-subtle)' }}>SKU</span> <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)', marginInlineStart: 6 }}>APG-0001</span></div>
              <div><span style={{ color: 'var(--ax-text-subtle)' }}>Category</span> <span style={{ color: 'var(--ax-text)', marginInlineStart: 6 }}>Lighting</span></div>
              <div><span style={{ color: 'var(--ax-text-subtle)' }}>Vendor</span> <span style={{ color: 'var(--ax-text)', marginInlineStart: 6 }}>Aperture Studio</span></div>
              <div><span style={{ color: 'var(--ax-text-subtle)' }}>Warranty</span> <span style={{ color: 'var(--ax-text)', marginInlineStart: 6 }}>2 years</span></div>
            </div>
          </div>
        </section>

        {/* TABS */}
        <section className="ax-card ax-col--8" role="region" aria-label="Product information">
          <div className="ax-card__body">
            <div className="ax-tabs">
              <div className="ax-tabs__list" role="tablist" aria-label="Product details">
                <button type="button" className={`ax-tabs__tab${tab === 'desc' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'desc'} onClick={() => setTab('desc')}>Description</button>
                <button type="button" className={`ax-tabs__tab${tab === 'specs' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'specs'} onClick={() => setTab('specs')}>Specifications</button>
                <button type="button" className={`ax-tabs__tab${tab === 'reviews' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'reviews'} onClick={() => setTab('reviews')}>Reviews <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--sm ax-tabs__badge ax-num">128</span></button>
              </div>

              {tab === 'desc' && (
                <div className="ax-tabs__panel" role="tabpanel">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>
                    <p>The Aperture Desk Lamp pairs a precision aluminium body with a frictionless magnetic joint, letting you angle light exactly where you need it and have it hold. A stepless dimmer and tunable colour temperature take it from a crisp 4000K work light to a relaxed 2700K glow.</p>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', paddingInlineStart: 'var(--ax-space-5)' }}>
                      <li>Stepless dimming from 1% to 100% with memory recall</li>
                      <li>Tunable white 2700K–4000K, CRI 95 for true colour</li>
                      <li>Magnetic articulating arm with 270° rotation</li>
                      <li>USB-C passthrough charging built into the base</li>
                      <li>Flicker-free driver, rated for 25,000 hours</li>
                    </ul>
                  </div>
                </div>
              )}

              {tab === 'specs' && (
                <div className="ax-tabs__panel" role="tabpanel">
                  <div className="ax-table-wrap">
                    <table className="ax-table">
                      <tbody>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)', width: '40%' }}>Material</td><td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Anodized aluminium, steel base</td></tr>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>Light source</td><td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Integrated LED, 9W</td></tr>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>Colour temperature</td><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>2700K – 4000K</td></tr>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>Brightness</td><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>600 lm</td></tr>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>Reach</td><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>48 cm</td></tr>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>Weight</td><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>1.4 kg</td></tr>
                        <tr className="ax-table__row"><td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>In the box</td><td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Lamp, USB-C cable, quick-start guide</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'reviews' && (
                <div className="ax-tabs__panel" role="tabpanel" id="reviews">
                  <div className="ax-dash-grid" style={{ gap: 'var(--ax-space-6)' }}>
                    <div className="ax-col--4">
                      <div style={{ textAlign: 'center', padding: 'var(--ax-space-4) 0' }}>
                        <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-num-kpi)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)', lineHeight: 1 }}>4.7</div>
                        <span className="ax-rating" style={{ justifyContent: 'center', marginTop: 'var(--ax-space-2)' }} aria-hidden="true">{[1, 2, 3, 4, 5].map((s) => (
                          <svg key={s} className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>
                        ))}</span>
                        <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-2)' }}>Based on <span className="ax-num">128</span> reviews</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                        {DIST.map((d) => (
                          <div key={d.star} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', width: 12 }}>{d.star}</span>
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ width: 12, height: 12, color: 'var(--ax-warning-500)' }}>{STAR}</svg>
                            <div className="ax-progress ax-progress--xs" style={{ flex: '1 1 auto' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${d.pct}%`, background: 'var(--ax-accent)' }} /></div></div>
                            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', width: 28, textAlign: 'right' }}>{d.n}</span>
                          </div>
                        ))}
                      </div>
                      <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" style={{ marginTop: 'var(--ax-space-4)' }} onClick={() => setReviewOpen(true)}>Write a review</button>
                    </div>

                    <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                      {REVIEWS.map((r) => (
                        <article key={r.id} style={{ paddingBottom: 'var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)' }}>
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', marginBottom: 'var(--ax-space-2)' }}>
                            <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${r.c} 20%,transparent)`, color: r.c, fontWeight: 600, fontSize: 'var(--ax-text-2xs)' }}>{r.i}</span>
                            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                                <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{r.name}</b>
                                {r.verified && <span className="ax-badge ax-badge--success ax-badge--soft ax-badge--sm" style={{ borderRadius: 'var(--ax-radius-xs)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}><path d="M5 12l5 5l10 -10" /></svg>Verified</span>}
                              </div>
                              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.date}</span>
                            </div>
                            <span className="ax-rating ax-rating--sm" aria-label={r.rating + ' out of 5'}>{[1, 2, 3, 4, 5].map((s) => (
                              <svg key={s} className={`ax-rating__star${s <= r.rating ? ' ax-rating__star--full' : ''}`} viewBox="0 0 24 24" fill={s <= r.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>
                            ))}</span>
                          </div>
                          <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>{r.body}</p>
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ marginTop: 'var(--ax-space-2)' }}>
                            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" /></svg>
                            Helpful (<span className="ax-num">{r.helpful}</span>)
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BUYER RAIL */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <div className="ax-card" role="region" aria-label="Shipping and returns">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Shipping &amp; returns</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-4m-1 -8h11v12m-4 0h6m4 0h2v-6h-8m0 -5h5l3 5" /><path d="M3 9l4 0" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Free shipping over $75</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Arrives in 2–4 business days</div></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>30-day returns</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>No-questions-asked refund</div></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" /><path d="M15 19l2 2l4 -4" /></svg></span>
                <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>2-year warranty</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Covers parts &amp; the driver</div></div>
              </div>
            </div>
          </div>

          <div className="ax-card" role="region" aria-label="Related products">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">You might also like</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              {RELATED.map((rp) => (
                <Link key={rp.id} href="/ecommerce/product-details" className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', textDecoration: 'none' }}>
                  <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: `color-mix(in oklab,${rp.color} 16%,var(--ax-surface-subtle))`, color: rp.color }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PIC_GLYPH}</svg></span>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{rp.name}</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{rp.category}</div>
                  </div>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{money(rp.price)}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} />}
    </>
  );
}

function ReviewModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 'var(--ax-z-modal,80)' as unknown as number, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-5)' }}>
      <button type="button" aria-label="Close" style={{ position: 'absolute', inset: 0, background: 'color-mix(in oklab,var(--ax-canvas) 70%,transparent)', backdropFilter: 'blur(4px)', border: 0, cursor: 'default' }} onClick={onClose} />
      <div className="ax-card" style={{ position: 'relative', width: 'min(480px,100%)', margin: 0 }} role="dialog" aria-modal="true" aria-label="Write a review">
        <div className="ax-card__header">
          <div className="ax-card__titles"><h2 className="ax-card__title">Write a review</h2></div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={onClose} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
        <form className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          {sent && <div className="ax-alert ax-alert--success ax-alert--inline"><div className="ax-alert__content"><div className="ax-alert__message">Thanks! Your review has been submitted for moderation.</div></div></div>}
          <div className="ax-field">
            <span className="ax-label">Your rating</span>
            <span className="ax-rating ax-rating--lg ax-rating--input" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg key={s} className={`ax-rating__star${(hover || rating) >= s ? ' is-selected' : ''}`} onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)} viewBox="0 0 24 24" fill={(hover || rating) >= s ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }} role="radio" aria-checked={rating === s} aria-label={s + ' stars'}>{STAR}</svg>
              ))}
            </span>
          </div>
          <div className="ax-field"><label className="ax-label" htmlFor="rev-title">Title</label><input id="rev-title" type="text" className="ax-input" placeholder="Sum up your experience" /></div>
          <div className="ax-field"><label className="ax-label" htmlFor="rev-body">Review</label><textarea id="rev-body" className="ax-textarea" placeholder="What did you like or dislike?" /></div>
          <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-2)' }}>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="ax-btn ax-btn--primary">Submit review</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductDetails;
