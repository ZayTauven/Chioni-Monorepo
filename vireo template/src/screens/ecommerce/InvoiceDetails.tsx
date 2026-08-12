'use client';
/*
 * Vireo Next.js — Ecommerce / Invoice details (route "ecommerce/invoice-details").
 *
 * Faithful re-expression of src/html/ecommerce/invoice-details.html: a printable
 * invoice paper (parties, meta strip, line items, totals, notes) with a right
 * rail (payment card + status timeline), an overdue/paid banner, and header
 * print/download/send/edit actions. The Alpine x-data (status unpaid|paid|draft,
 * send animation) is ported to React state; the print stylesheet is inlined.
 * Classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

export function InvoiceDetails() {
  const [status, setStatus] = useState<'unpaid' | 'paid' | 'draft'>('unpaid');
  const [sent, setSent] = useState(false);

  const paid = () => setStatus('paid');
  const doSend = () => { setSent(true); if (status === 'draft') setStatus('unpaid'); setTimeout(() => setSent(false), 2400); };

  return (
    <>
      <PageHead
        title={(
          <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>#INV-2026-0140</span>
            {status === 'unpaid' && <span className="ax-badge ax-badge--soft ax-badge--info ax-badge--pill"><span className="ax-badge__dot" />Unpaid</span>}
            {status === 'paid' && <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Paid</span>}
            {status === 'draft' && <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill"><span className="ax-badge__dot" />Draft</span>}
          </span>
        ) as unknown as string}
        subtitle={(<>Issued <span className="ax-num">Jun 18, 2026</span> to Clayhouse Ceramics · due <span className="ax-num">Jun 25, 2026</span>.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={() => window.print()}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" /><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" /><path d="M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z" /></svg>
              <span className="ax-btn__label">Print</span>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Download</span>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={doSend}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
              <span className="ax-btn__label">{sent ? 'Sent ✓' : 'Send'}</span>
            </button>
            {status !== 'paid' && (
              <Link className="ax-btn ax-btn--primary" href="/ecommerce/create-invoice">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3z" /><path d="M16 5l3 3" /></svg>
                <span className="ax-btn__label">Edit</span>
              </Link>
            )}
          </>
        }
      />

      {/* overdue / paid banner */}
      {status === 'unpaid' && (
        <div className="ax-alert ax-alert--danger ax-print-hide" role="alert" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg></span>
          <div className="ax-alert__content" style={{ flex: '1 1 auto' }}><p className="ax-alert__title">This invoice is 3 days overdue</p><p className="ax-alert__message">Balance of <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>$3,180.00</span> is past its due date of Jun 25, 2026.</p></div>
          <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={paid}>Mark as paid</button>
        </div>
      )}
      {status === 'paid' && (
        <div className="ax-alert ax-alert--success ax-print-hide" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">Invoice paid in full</p><p className="ax-alert__message">Balance due is now <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>$0.00</span>.</p></div>
        </div>
      )}

      {/* CONTENT GRID */}
      <div className="ax-dash-grid">
        {/* INVOICE PAPER (8) */}
        <article className="ax-card ax-col--8 ax-invoice-paper" role="region" aria-label="Invoice document">
          <div className="ax-card__body" style={{ padding: 'var(--ax-space-8)' }}>
            {/* paper head */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--ax-space-6)', flexWrap: 'wrap', marginBottom: 'var(--ax-space-8)' }}>
              <div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                  <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M9 8l1 0" /><path d="M9 12l1 0" /><path d="M9 16l1 0" /><path d="M14 8l1 0" /><path d="M14 12l1 0" /><path d="M14 16l1 0" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /></svg></span>
                  <div>
                    <div style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', letterSpacing: '.01em' }}>Vireo Inc.</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Marketplace operations</div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Invoice</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)' }}>#INV-2026-0140</div>
              </div>
            </div>

            {/* from / to / meta */}
            <div className="ax-inv-parties" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-6)', marginBottom: 'var(--ax-space-7)' }}>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Billed from</div>
                <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Vireo Inc.</div>
                <address style={{ fontStyle: 'normal', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7, marginTop: 4 }}>
                  400 Market Street, Suite 1100<br />San Francisco · CA · <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>94111</span><br />United States<br />VAT <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>US-8841-2207</span>
                </address>
              </div>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Billed to</div>
                <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Clayhouse Ceramics</div>
                <address style={{ fontStyle: 'normal', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7, marginTop: 4 }}>
                  Attn: Mei-Ling Chen<br />88 Kiln Road, Unit 4<br />Portland · OR · <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>97209</span><br />United States<br /><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>billing@clayhouse.io</span>
                </address>
              </div>
            </div>

            {/* meta strip */}
            <div className="ax-inv-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-4)', background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)', marginBottom: 'var(--ax-space-6)' }}>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginBottom: 2 }}>Issue date</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>Jun 18, 2026</div></div>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginBottom: 2 }}>Due date</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>Jun 25, 2026</div></div>
              <div><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginBottom: 2 }}>Payment terms</div><div style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>Net 7</div></div>
            </div>

            {/* line items */}
            <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-2))' }}>
              <table className="ax-table">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Description</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Qty</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Unit price</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Tax</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <LineRow desc="Glazed stoneware mug — assorted" sub="SKU CLH-MUG-12 · wholesale pack of 12" qty="40" unit="$42.00" tax="8%" amount="$1,680.00" />
                  <LineRow desc="Matte carafe — 1.2L" sub="SKU CLH-CAR-12 · slate finish" qty="18" unit="$52.00" tax="8%" amount="$936.00" />
                  <LineRow desc="Hand-thrown serving bowl" sub="SKU CLH-BWL-09 · large" qty="9" unit="$48.00" tax="8%" amount="$432.00" />
                  <LineRow desc="Marketplace listing fee" sub="Quarterly · Q2 2026" qty="1" unit="$120.00" tax="—" amount="$120.00" />
                </tbody>
              </table>
            </div>

            {/* totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--ax-space-5)' }}>
              <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$3,168.00</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Discount <span className="ax-badge ax-badge--success ax-badge--soft ax-badge--sm" style={{ borderRadius: 'var(--ax-radius-xs)' }}>EARLY5</span></span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>−$158.40</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax (8%)</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$240.77</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>Free</span></div>
                <hr className="ax-divider" style={{ margin: 'var(--ax-space-2) 0' }} />
                <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Total</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>$3,490.37</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-sm)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Amount paid</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{status === 'paid' ? '−$3,490.37' : '−$310.37'}</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline', padding: 'var(--ax-space-2) var(--ax-space-3)', background: 'var(--ax-accent-wash)', borderRadius: 'var(--ax-radius-sm)' }}><span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Balance due</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-md)', color: status === 'paid' ? 'var(--ax-viz-emerald)' : 'var(--ax-accent)' }}>{status === 'paid' ? '$0.00' : '$3,180.00'}</span></div>
              </div>
            </div>

            <hr className="ax-divider" style={{ margin: 'var(--ax-space-6) 0' }} />

            {/* notes / terms */}
            <div className="ax-inv-parties" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-6)' }}>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Notes</div>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>Thanks for your continued partnership. A 5% early-payment discount was applied. Items ship from the Portland warehouse within 3 business days.</p>
              </div>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Payment details</div>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>Bank: First Republic<br />Account <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>•••• 7045</span><br />Routing <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>021-000-021</span><br />Or pay online via the link in your email.</p>
              </div>
            </div>
          </div>
        </article>

        {/* RIGHT RAIL (4) */}
        <aside className="ax-col--4 ax-print-hide" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0, alignSelf: 'start' }}>
          {/* pay / summary card */}
          <section className="ax-card" role="region" aria-label="Payment status">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Payment</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div style={{ textAlign: 'center', padding: 'var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: status === 'paid' ? 'color-mix(in oklab,var(--ax-success-500) 12%,transparent)' : 'var(--ax-surface-subtle)' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', marginBottom: 4 }}>{status === 'paid' ? 'Paid in full' : 'Balance due'}</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: status === 'paid' ? 'var(--ax-viz-emerald)' : 'var(--ax-text-strong)' }}>{status === 'paid' ? '$0.00' : '$3,180.00'}</div>
                {status === 'unpaid' && <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-danger-500)', marginTop: 4 }}>3 days overdue</div>}
              </div>
              {status !== 'paid' && (
                <button type="button" className="ax-btn ax-btn--primary ax-btn--block" onClick={paid}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg>
                  <span className="ax-btn__label">Mark as paid</span>
                </button>
              )}
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" onClick={doSend}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg>
                <span className="ax-btn__label">{sent ? 'Sent ✓' : 'Send reminder'}</span>
              </button>
              <Link className="ax-link" href="/ecommerce/invoices" style={{ textAlign: 'center', fontSize: 'var(--ax-text-sm)' }}>← Back to invoices</Link>
            </div>
          </section>

          {/* status timeline */}
          <section className="ax-card" role="region" aria-label="Invoice timeline">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Timeline</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-timeline">
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title">Invoice <b style={{ color: 'var(--ax-text-strong)' }}>issued</b></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 18 · 09:14</span></div>
                </li>
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Sent</b> to billing@clayhouse.io</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 18 · 09:15</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Viewed</b> by client</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 19 · 14:02</span></div>
                </li>
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M12 5a3 3 0 0 1 3 3v1a3 3 0 0 1 -6 0v-1a3 3 0 0 1 3 -3" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Partial payment</b> received — <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>$310.37</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 22 · 11:40</span></div>
                </li>
                {status === 'unpaid' && (
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-danger-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title" style={{ color: 'var(--ax-danger-500)', fontWeight: 'var(--ax-weight-medium)' }}>Now overdue</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 26 · 00:00</span></div>
                  </li>
                )}
                {status === 'paid' && (
                  <li className="ax-timeline__item ax-timeline__item--success">
                    <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Paid in full</b></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Just now</span></div>
                  </li>
                )}
              </ul>
            </div>
          </section>
        </aside>
      </div>

      {/* responsive + print */}
      <style>{`
        @media (max-width: 640px) {
          .ax-inv-parties, .ax-inv-meta { grid-template-columns: 1fr !important; }
        }
        @media print {
          .ax-print-hide, .ax-ambient, .ax-sidebar, .ax-header, .ax-footer, .ax-customizer { display: none !important; }
          .ax-shell, .ax-main, .ax-layout { margin: 0 !important; padding: 0 !important; }
          .ax-invoice-paper { box-shadow: none !important; border: none !important; }
          .ax-dash-grid { display: block !important; }
        }
      `}</style>
    </>
  );
}

function LineRow({ desc, sub, qty, unit, tax, amount }: { desc: string; sub: string; qty: string; unit: string; tax: string; amount: string }) {
  return (
    <tr className="ax-table__row">
      <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{desc}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{sub}</div></td>
      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{qty}</td>
      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{unit}</td>
      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)' }}>{tax}</td>
      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{amount}</td>
    </tr>
  );
}

export default InvoiceDetails;
