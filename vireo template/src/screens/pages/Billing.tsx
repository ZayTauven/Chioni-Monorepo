'use client';
/*
 * Vireo React — Billing (route "pages/billing").
 *
 * Faithful re-expression of src/html/pages/billing.html: plan summary, usage
 * meters, dynamic payment-method list (add/remove/set-default), billing address,
 * a 6-row invoice history table, and a destructive "cancel plan" confirm dialog.
 * Alpine x-data/x-for/$dispatch behaviors ported to React state. DOM/ARIA 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Method { id: number; brand: string; last4: string; exp: string; tint: string; def: boolean; }

const ICON_CARD = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg>
);
const ICON_DL = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
);

interface Invoice { id: string; date: string; desc: string; amount: string; tone: 'success' | 'warning'; status: string; }
const INVOICES: Invoice[] = [
  { id: 'INV-2026-0614', date: 'Jun 14, 2026', desc: 'Pro plan · monthly', amount: '$48.00', tone: 'success', status: 'Paid' },
  { id: 'INV-2026-0514', date: 'May 14, 2026', desc: 'Pro plan · monthly', amount: '$48.00', tone: 'success', status: 'Paid' },
  { id: 'INV-2026-0414', date: 'Apr 14, 2026', desc: 'Pro plan + 2 seats', amount: '$72.00', tone: 'success', status: 'Paid' },
  { id: 'INV-2026-0314', date: 'Mar 14, 2026', desc: 'Pro plan · monthly', amount: '$48.00', tone: 'warning', status: 'Refunded' },
  { id: 'INV-2026-0214', date: 'Feb 14, 2026', desc: 'Pro plan · monthly', amount: '$48.00', tone: 'success', status: 'Paid' },
  { id: 'INV-2026-0114', date: 'Jan 14, 2026', desc: 'Pro plan · monthly', amount: '$48.00', tone: 'success', status: 'Paid' },
];

export function Billing() {
  const [methods, setMethods] = useState<Method[]>([
    { id: 1, brand: 'Visa', last4: '4921', exp: '08/27', tint: 'var(--ax-viz-cyan)', def: true },
    { id: 2, brand: 'Mastercard', last4: '7045', exp: '02/26', tint: 'var(--ax-viz-amber)', def: false },
  ]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const addMethod = () => setMethods((m) => [...m, { id: Date.now(), brand: 'Amex', last4: '1008', exp: '11/28', tint: 'var(--ax-viz-violet)', def: false }]);
  const setDefault = (id: number) => setMethods((m) => m.map((x) => ({ ...x, def: x.id === id })));
  const removeMethod = (id: number) => setMethods((m) => m.filter((x) => x.id !== id));

  return (
    <>
      <PageHead
        title="Billing"
        subtitle="Your plan, usage, payment methods and invoice history."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary">
              {ICON_DL}
              <span className="ax-btn__label">Download statements</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/pages/pricing">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
              <span className="ax-btn__label">Change plan</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* PLAN SUMMARY */}
        <section className="ax-card ax-card--accent-edge ax-col--8" role="region" aria-label="Current plan">
          <div className="ax-card__body">
            <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--ax-space-5)' }}>
              <div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span className="ax-card__eyebrow">Your plan</span><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Active</span></div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'baseline', marginTop: 'var(--ax-space-2)' }}>
                  <b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)', lineHeight: 1 }}>Pro</b>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-md)' }}>$48.00 / month</span>
                </div>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', marginTop: 'var(--ax-space-2)' }}>Renews on <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>Jul 14, 2026</span> · billed monthly to Visa <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>••4921</span></p>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <Link className="ax-btn ax-btn--secondary" href="/pages/pricing">Change plan</Link>
                <button type="button" className="ax-btn ax-btn--ghost" style={{ color: 'var(--ax-danger-500)' }} onClick={() => setConfirmOpen(true)}>Cancel plan</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-5)' }}>
              <div style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Next invoice</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$48.00</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jul 14, 2026</div>
              </div>
              <div style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Seats in use</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>6 / 8</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>2 seats available</div>
              </div>
              <div style={{ padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Lifetime spend</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$1,584.00</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Since Mar 2022</div>
              </div>
            </div>
          </div>
        </section>

        {/* USAGE METERS */}
        <section className="ax-card ax-col--4" role="region" aria-label="Usage this period">
          <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Usage</h2><p className="ax-card__subtitle">Current billing period</p></div></div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Seats</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>6 / 8</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '75%', background: 'var(--ax-accent)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Storage</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>182 / 200 GB</b></div>
              <div className="ax-progress ax-progress--sm ax-progress--warning"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '91%' }} /></div></div>
              <div className="ax-cluster" style={{ gap: 6, marginTop: 6, color: 'var(--ax-warning-500)', fontSize: 'var(--ax-text-xs)' }}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>Approaching limit</div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>API calls</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>412K / 1M</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '41%', background: 'var(--ax-viz-cyan)' }} /></div></div>
            </div>
          </div>
        </section>

        {/* PAYMENT METHODS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Payment methods">
          <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Payment methods</h2></div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addMethod}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add method</span>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list">
              {methods.map((m) => (
                <li key={m.id} className="ax-list__row" style={{ paddingInline: 0 }}>
                  <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${m.tint} 16%,transparent)`, color: m.tint }}>{ICON_CARD}</span></span>
                  <span className="ax-list__content"><span className="ax-list__title">{m.brand} ending <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{m.last4}</span></span><span className="ax-list__meta ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Expires {m.exp}</span></span>
                  <span className="ax-list__trailing" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                    {m.def && <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Default</span>}
                    {!m.def && <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setDefault(m.id)}>Set default</button>}
                    {!m.def && <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Remove method" onClick={() => removeMethod(m.id)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* BILLING ADDRESS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Billing details">
          <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Billing details</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Edit</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Billed to</div>
              <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Northwind Studio, Lda.</div>
              <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>Rua do Alecrim 42<br />1200-018 Lisboa<br />Portugal</div>
            </div>
            <div style={{ borderTop: '1px solid var(--ax-border)', paddingTop: 'var(--ax-space-3)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
              <div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Billing email</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>finance@northwind.io</div></div>
              <div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>VAT ID</div><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>PT 514 220 918</div></div>
            </div>
          </div>
        </section>

        {/* INVOICE HISTORY */}
        <section className="ax-card ax-col--12" role="region" aria-label="Invoice history">
          <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Invoice history</h2><p className="ax-card__subtitle">Receipts for the last 6 billing periods</p></div>
            <a className="ax-btn ax-btn--link" href="#">View all invoices</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Invoice</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th" scope="col">Description</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th" scope="col" style={{ textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => (
                  <tr key={inv.id} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{inv.id}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{inv.date}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{inv.desc}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{inv.amount}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${inv.tone} ax-badge--pill`}><span className="ax-badge__dot" />{inv.status}</span></td>
                    <td className="ax-table__td" style={{ textAlign: 'right' }}><button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" aria-label={`Download invoice ${inv.id}`}>{ICON_DL}<span className="ax-btn__label">PDF</span></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Cancel-plan confirm (destructive) */}
      {confirmOpen && (
        <div className="ax-grid" style={{ position: 'fixed', inset: 0, zIndex: 60, placeItems: 'center', padding: 'var(--ax-space-4)' }}>
          <div onClick={() => setConfirmOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,16,.55)', backdropFilter: 'blur(2px)' }} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="cx-title" className="ax-card" style={{ position: 'relative', maxWidth: 420, width: '100%' }}>
            <div className="ax-card__body" style={{ textAlign: 'center' }}>
              <span className="ax-avatar ax-avatar--lg" style={{ background: 'var(--ax-danger-50)', color: 'var(--ax-danger-500)', marginInline: 'auto' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg></span>
              <h2 id="cx-title" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>Cancel your Pro plan?</h2>
              <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginTop: 'var(--ax-space-2)' }}>You'll keep Pro features until <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jul 14, 2026</span>, then move to the Free plan. This can't be undone automatically.</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center', marginTop: 'var(--ax-space-5)' }}>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setConfirmOpen(false)}>Keep plan</button>
                <button type="button" className="ax-btn ax-btn--primary" style={{ background: 'var(--ax-danger-500)' }} onClick={() => setConfirmOpen(false)}>Cancel plan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Billing;
