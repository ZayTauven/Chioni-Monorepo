'use client';
/*
 * Vireo Next.js — UI · Badges (route "ui/badges").
 *
 * Faithful re-expression of src/html/ui/badges.html: tones × soft/solid/outline,
 * sizes & shapes, dot badges, icon badges, trend deltas, counters, removable
 * chips (Alpine chips[] → React state) and badges-in-a-table. DOM classes /
 * ARIA / copy match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const FRESH_CHIPS = ['Lighting', 'In stock', 'Under $100', 'Rating 4+', 'Aperture Goods'];
const LABEL_CSS: React.CSSProperties = { fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' };
const ROW_CSS: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)' };

export function Badges() {
  const [chips, setChips] = useState(FRESH_CHIPS);

  return (
    <>
      <PageHead
        title="Badges"
        subtitle="Status tints, counters, dots, pills & removable chips — every tone ships soft, solid & outline styles."
        actions={
          <button type="button" className="ax-btn ax-btn--primary">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 4.27c1.5 -.83 3.5 -.83 5 0l5 2.86c1.5 .83 2.5 2.5 2.5 4.27v5.73c0 1.77 -1 3.44 -2.5 4.27l-5 2.86c-1.5 .83 -3.5 .83 -5 0l-5 -2.86c-1.5 -.83 -2.5 -2.5 -2.5 -4.27v-5.73c0 -1.77 1 -3.44 2.5 -4.27z" /><path d="M9 12l2 2l4 -4" /></svg>
            <span className="ax-btn__label">Add label</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {/* Tones × styles */}
        <section className="ax-card ax-col--8" role="region" aria-label="Badge tones and styles">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Foundation</span>
              <h2 className="ax-card__title">Tones &amp; styles</h2>
              <p className="ax-card__subtitle">Six tones across soft, solid &amp; outline fills.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 'var(--ax-space-3) var(--ax-space-4)', alignItems: 'center' }}>
              <span style={LABEL_CSS}>Soft</span>
              <div style={ROW_CSS}>
                <span className="ax-badge ax-badge--soft ax-badge--accent">Accent</span>
                <span className="ax-badge ax-badge--soft ax-badge--success">Active</span>
                <span className="ax-badge ax-badge--soft ax-badge--warning">Pending</span>
                <span className="ax-badge ax-badge--soft ax-badge--danger">Overdue</span>
                <span className="ax-badge ax-badge--soft ax-badge--info">Note</span>
                <span className="ax-badge ax-badge--soft ax-badge--neutral">Draft</span>
              </div>
              <span style={LABEL_CSS}>Solid</span>
              <div style={ROW_CSS}>
                <span className="ax-badge ax-badge--solid ax-badge--accent">Accent</span>
                <span className="ax-badge ax-badge--solid ax-badge--success">Paid</span>
                <span className="ax-badge ax-badge--solid ax-badge--warning">Low stock</span>
                <span className="ax-badge ax-badge--solid ax-badge--danger">Failed</span>
                <span className="ax-badge ax-badge--solid ax-badge--info">Beta</span>
                <span className="ax-badge ax-badge--solid ax-badge--neutral">Archived</span>
              </div>
              <span style={LABEL_CSS}>Outline</span>
              <div style={ROW_CSS}>
                <span className="ax-badge ax-badge--outline ax-badge--accent">Accent</span>
                <span className="ax-badge ax-badge--outline ax-badge--success">Verified</span>
                <span className="ax-badge ax-badge--outline ax-badge--warning">Review</span>
                <span className="ax-badge ax-badge--outline ax-badge--danger">Blocked</span>
                <span className="ax-badge ax-badge--outline ax-badge--info">Info</span>
                <span className="ax-badge ax-badge--outline ax-badge--neutral">Neutral</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sizes & shapes */}
        <section className="ax-card ax-col--4" role="region" aria-label="Badge sizes and shapes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Form</span>
              <h2 className="ax-card__title">Sizes &amp; shapes</h2>
              <p className="ax-card__subtitle">Default &amp; small, square or pill.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
              <span className="ax-badge ax-badge--soft ax-badge--accent">Default</span>
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--sm">Small</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
              <span className="ax-badge ax-badge--soft ax-badge--success">Square</span>
              <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill">Pill</span>
              <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill">Pill solid</span>
            </div>
          </div>
        </section>

        {/* With dots */}
        <section className="ax-card ax-col--4" role="region" aria-label="Status dot badges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Status</span>
              <h2 className="ax-card__title">Dot badges</h2>
              <p className="ax-card__subtitle">Leading dot pairs color with a glyph-free label.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Online</span>
            <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><span className="ax-badge__dot" />Away</span>
            <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill"><span className="ax-badge__dot" />Busy</span>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill"><span className="ax-badge__dot" />Offline</span>
            <span className="ax-badge ax-badge--soft ax-badge--info ax-badge--pill"><span className="ax-badge__dot" />Syncing</span>
          </div>
        </section>

        {/* With icons */}
        <section className="ax-card ax-col--4" role="region" aria-label="Badges with icons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Affordance</span>
              <h2 className="ax-card__title">With icons</h2>
              <p className="ax-card__subtitle">Glyph reinforces the meaning of each state.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>Approved</span>
            <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 7v5l3 3" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /></svg>Pending</span>
            <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>Rejected</span>
            <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>Featured</span>
            <span className="ax-badge ax-badge--soft ax-badge--info ax-badge--pill"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9h.01" /><path d="M11 12h1v4h1" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /></svg>Info</span>
          </div>
        </section>

        {/* Trend deltas */}
        <section className="ax-card ax-col--4" role="region" aria-label="Trend delta badges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Metrics</span>
              <h2 className="ax-card__title">Trend deltas</h2>
              <p className="ax-card__subtitle">Arrow + sign so color is never the only cue.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-num"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>12.4%</span>
            <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill ax-num"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>3.1%</span>
            <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-num"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>8.1%</span>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num"><svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /></svg>0.0%</span>
          </div>
        </section>

        {/* Counters */}
        <section className="ax-card ax-col--4" role="region" aria-label="Counter badges">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Numeric</span>
              <h2 className="ax-card__title">Counters &amp; notifications</h2>
              <p className="ax-card__subtitle">Mono, tabular, on icons or text.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-5)', alignItems: 'center' }}>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Notifications, 5 unread" style={{ position: 'relative', overflow: 'visible' }}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
              <span className="ax-badge ax-badge--count ax-badge--danger" aria-hidden="true" style={{ position: 'absolute', top: -2, insetInlineEnd: -2 }}>5</span>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Cart, 4 items" style={{ position: 'relative', overflow: 'visible' }}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg>
              <span className="ax-badge ax-badge--count" aria-hidden="true" style={{ position: 'absolute', top: -2, insetInlineEnd: -2 }}>4</span>
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Inbox <span className="ax-badge ax-badge--count">128</span></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Alerts <span className="ax-badge ax-badge--count ax-badge--danger">99+</span></span>
          </div>
        </section>

        {/* Removable chips */}
        <section className="ax-card ax-col--4" role="region" aria-label="Removable chips">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Interactive</span>
              <h2 className="ax-card__title">Removable chips</h2>
              <p className="ax-card__subtitle">Active filters you can dismiss.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-2)', minHeight: 24 }}>
              {chips.map((c) => (
                <span key={c} className="ax-badge ax-badge--soft ax-badge--accent ax-badge--chip">
                  <span>{c}</span>
                  <button type="button" className="ax-badge__remove" onClick={() => setChips((cs) => cs.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
              {chips.length === 0 && <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>All filters cleared.</span>}
            </div>
            <button type="button" className="ax-btn ax-btn--link ax-btn--sm" style={{ marginTop: 'var(--ax-space-3)' }} onClick={() => setChips(FRESH_CHIPS)}><span className="ax-btn__label">Reset filters</span></button>
          </div>
        </section>

        {/* In context */}
        <section className="ax-card ax-col--12" role="region" aria-label="Badges in a table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Order status cells</h2>
              <p className="ax-card__subtitle">Badges as semantic status pills inside a real table.</p>
            </div>
            <Link className="ax-btn ax-btn--link" href="/ecommerce/orders">All orders</Link>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover" style={{ minWidth: 640 }}>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                  <th className="ax-table__th" scope="col">Payment</th>
                  <th className="ax-table__th" scope="col">Fulfilment</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ax-table__row">
                  <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10482</td>
                  <td className="ax-table__td">Camila Rossi</td>
                  <td className="ax-table__td ax-table__td--num">$312.00</td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Paid</span></td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--info ax-badge--pill"><span className="ax-badge__dot" />Shipped</span></td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10481</td>
                  <td className="ax-table__td">Henry Whitlock</td>
                  <td className="ax-table__td ax-table__td--num">$129.00</td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Paid</span></td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><span className="ax-badge__dot" />Processing</span></td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10475</td>
                  <td className="ax-table__td">Yuki Tanaka</td>
                  <td className="ax-table__td ax-table__td--num">$225.00</td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><span className="ax-badge__dot" />Pending</span></td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill"><span className="ax-badge__dot" />Unfulfilled</span></td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10473</td>
                  <td className="ax-table__td">Nadia Haddad</td>
                  <td className="ax-table__td ax-table__td--num">$238.00</td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill"><span className="ax-badge__dot" />Refunded</span></td>
                  <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill"><span className="ax-badge__dot" />Cancelled</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default Badges;
