'use client';
/*
 * Vireo Next.js — Ecommerce / Create invoice (route "ecommerce/create-invoice").
 *
 * Faithful re-expression of src/html/ecommerce/create-invoice.html: a two-column
 * invoice builder — left form (client select + fields, details/terms, editable
 * line items, discount/shipping/notes) and a sticky right rail with a LIVE invoice
 * preview + totals card; a sticky bottom action bar (save draft / preview / save &
 * send) and a "sent" toast. All totals recompute live. The Alpine x-data
 * (axInvoiceBuilder) is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Client { id: string; name: string; email: string; address: string }
interface Line { id: number; desc: string; qty: number; price: number; tax: number }

const CLIENTS: Client[] = [
  { id: '1', name: 'Clayhouse Ceramics', email: 'billing@clayhouse.io', address: '88 Kiln Road, Unit 4\nPortland · OR · 97209 · United States' },
  { id: '2', name: 'Northwind Furniture', email: 'ap@northwind.co', address: '12 Harbor Way\nSeattle · WA · 98104 · United States' },
  { id: '3', name: 'Rossi Atelier Ltda.', email: 'finance@rossiatelier.com', address: 'Av. Paulista 2100, Sala 14\nSão Paulo · SP · 01310-930 · Brazil' },
  { id: '4', name: 'Voltic Supply Co.', email: 'accounts@voltic.co', address: '400 Circuit Ave\nAustin · TX · 78701 · United States' },
];

export function CreateInvoice() {
  const [clientId, setClientId] = useState('');
  const [sent, setSent] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [client, setClient] = useState({ name: '', email: '', address: '' });
  const [meta, setMeta] = useState({ number: '#INV-2026-0143', currency: 'USD', issued: '2026-06-28', due: '2026-07-12', terms: '14' });
  const [lines, setLines] = useState<Line[]>([
    { id: 1, desc: 'Glazed stoneware mug — wholesale pack of 12', qty: 40, price: 42.0, tax: 8 },
    { id: 2, desc: 'Matte carafe — 1.2L, slate finish', qty: 18, price: 52.0, tax: 8 },
    { id: 3, desc: 'Marketplace listing fee — Q3 2026', qty: 1, price: 120.0, tax: 0 },
  ]);
  const [adj, setAdj] = useState({ discount: 5, discountType: 'pct', shipping: 0, notes: '' });
  const seed = useRef(4);

  const money = (n: number) => {
    const s = meta.currency === 'EUR' ? '€' : meta.currency === 'GBP' ? '£' : '$';
    return s + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const applyClient = (id: string) => {
    setClientId(id);
    if (id === 'new') { setClient({ name: '', email: '', address: '' }); return; }
    const c = CLIENTS.find((x) => x.id === id);
    if (c) setClient({ name: c.name, email: c.email, address: c.address });
  };

  const applyTerms = (terms: string) => {
    const d = new Date(meta.issued + 'T00:00:00');
    const add = terms === 'receipt' ? 0 : parseInt(terms, 10);
    d.setDate(d.getDate() + add);
    setMeta((m) => ({ ...m, terms, due: d.toISOString().slice(0, 10) }));
  };

  const lineAmount = (li: Line) => (li.qty || 0) * (li.price || 0);
  const addLine = () => { seed.current += 1; setLines((l) => [...l, { id: seed.current, desc: '', qty: 1, price: 0, tax: 0 }]); };
  const removeLine = (i: number) => { if (lines.length > 1) setLines((l) => l.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, patch: Partial<Line>) => setLines((l) => l.map((li, idx) => (idx === i ? { ...li, ...patch } : li)));

  const subtotal = useMemo(() => lines.reduce((t, li) => t + lineAmount(li), 0), [lines]);
  const discountAmt = useMemo(() => (adj.discountType === 'pct' ? subtotal * ((adj.discount || 0) / 100) : adj.discount || 0), [adj.discountType, adj.discount, subtotal]);
  const taxTotal = useMemo(() => {
    const dr = subtotal > 0 ? discountAmt / subtotal : 0;
    return lines.reduce((t, li) => t + lineAmount(li) * (1 - dr) * ((li.tax || 0) / 100), 0);
  }, [lines, subtotal, discountAmt]);
  const total = Math.max(0, subtotal - discountAmt + taxTotal + (adj.shipping || 0));

  const saveDraft = () => {
    setDraftSaved(true);
    try { localStorage.setItem('ax:ecom:invoiceDraft', JSON.stringify({ client, meta, lines, adj })); } catch { /* ignore */ }
    setTimeout(() => setDraftSaved(false), 2000);
  };
  const saveSend = (e: FormEvent) => { e.preventDefault(); setSent(true); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => setSent(false), 3000); };

  return (
    <>
      <PageHead
        title="Create Invoice"
        subtitle="Build a new invoice — totals update live as you edit. Draft autosaves locally."
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/ecommerce/invoices">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Cancel</span>
          </Link>
        }
      />

      {/* sent toast */}
      {sent && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">Invoice sent</p><p className="ax-alert__message"><span className="ax-num">{meta.number}</span> was emailed to the client and marked Unpaid.</p></div>
        </div>
      )}

      {/* CONTENT GRID */}
      <form onSubmit={saveSend} className="ax-dash-grid">
        {/* LEFT FORM (7) */}
        <div className="ax-col--7" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* CLIENT */}
          <section className="ax-card" role="region" aria-label="Client">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Client</h2><p className="ax-card__subtitle">Pick an existing customer or enter a new one.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-client">Bill to</label>
                <select id="ci-client" className="ax-select" value={clientId} onChange={(e) => applyClient(e.target.value)}>
                  <option value="">Select a customer…</option>
                  {CLIENTS.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  <option value="new">+ New client</option>
                </select>
              </div>
              <div className="ax-ci-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ci-name">Name / company</label>
                  <input id="ci-name" type="text" className="ax-input" value={client.name} onChange={(e) => setClient((c) => ({ ...c, name: e.target.value }))} placeholder="Clayhouse Ceramics" />
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ci-email">Email</label>
                  <input id="ci-email" type="email" className="ax-input" value={client.email} onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))} placeholder="billing@clayhouse.io" />
                </div>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-addr">Billing address</label>
                <textarea id="ci-addr" className="ax-textarea" rows={2} value={client.address} onChange={(e) => setClient((c) => ({ ...c, address: e.target.value }))} placeholder={'88 Kiln Road, Unit 4\nPortland · OR · 97209 · United States'} />
              </div>
            </div>
          </section>

          {/* META */}
          <section className="ax-card" role="region" aria-label="Invoice details">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Details</h2></div></div>
            <div className="ax-card__body ax-ci-2col" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-number">Invoice #</label>
                <input id="ci-number" type="text" className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} value={meta.number} onChange={(e) => setMeta((m) => ({ ...m, number: e.target.value }))} />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-currency">Currency</label>
                <select id="ci-currency" className="ax-select" value={meta.currency} onChange={(e) => setMeta((m) => ({ ...m, currency: e.target.value }))}>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-issued">Issue date</label>
                <input id="ci-issued" type="date" className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} value={meta.issued} onChange={(e) => setMeta((m) => ({ ...m, issued: e.target.value }))} />
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-terms">Payment terms</label>
                <select id="ci-terms" className="ax-select" value={meta.terms} onChange={(e) => applyTerms(e.target.value)}>
                  <option value="receipt">Due on receipt</option>
                  <option value="7">Net 7</option>
                  <option value="14">Net 14</option>
                  <option value="30">Net 30</option>
                </select>
              </div>
              <div className="ax-field" style={{ gridColumn: '1 / -1' }}>
                <label className="ax-label" htmlFor="ci-due">Due date</label>
                <input id="ci-due" type="date" className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)', maxWidth: 240 }} value={meta.due} onChange={(e) => setMeta((m) => ({ ...m, due: e.target.value }))} />
              </div>
            </div>
          </section>

          {/* LINE ITEMS */}
          <section className="ax-card" role="region" aria-label="Line items">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Line items</h2><p className="ax-card__subtitle">At least one line is required.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster ax-ci-lh" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', paddingInline: 'var(--ax-space-1)' }}>
                <span className="ax-label" style={{ flex: '1 1 auto' }}>Description</span>
                <span className="ax-label" style={{ flex: 'none', width: 64, textAlign: 'right' }}>Qty</span>
                <span className="ax-label" style={{ flex: 'none', width: 96, textAlign: 'right' }}>Unit price</span>
                <span className="ax-label" style={{ flex: 'none', width: 64, textAlign: 'right' }}>Tax %</span>
                <span className="ax-label" style={{ flex: 'none', width: 96, textAlign: 'right' }}>Amount</span>
                <span style={{ flex: 'none', width: 32 }} />
              </div>
              {lines.map((li, idx) => (
                <div key={li.id} className="ax-cluster ax-ci-line" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <input type="text" className="ax-input ax-input--sm" style={{ flex: '1 1 auto', minWidth: 0 }} value={li.desc} onChange={(e) => updateLine(idx, { desc: e.target.value })} placeholder="Item or service…" aria-label={'Description for line ' + (idx + 1)} />
                  <input type="number" min={0} step={1} className="ax-input ax-input--sm ax-num" style={{ flex: 'none', width: 64, fontFamily: 'var(--ax-font-mono)', textAlign: 'right' }} value={li.qty} onChange={(e) => updateLine(idx, { qty: Number(e.target.value) })} aria-label={'Quantity for line ' + (idx + 1)} />
                  <input type="number" min={0} step={0.01} className="ax-input ax-input--sm ax-num" style={{ flex: 'none', width: 96, fontFamily: 'var(--ax-font-mono)', textAlign: 'right' }} value={li.price} onChange={(e) => updateLine(idx, { price: Number(e.target.value) })} aria-label={'Unit price for line ' + (idx + 1)} />
                  <input type="number" min={0} step={1} className="ax-input ax-input--sm ax-num" style={{ flex: 'none', width: 64, fontFamily: 'var(--ax-font-mono)', textAlign: 'right' }} value={li.tax} onChange={(e) => updateLine(idx, { tax: Number(e.target.value) })} aria-label={'Tax rate for line ' + (idx + 1)} />
                  <span className="ax-num" style={{ flex: 'none', width: 96, textAlign: 'right', fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', alignSelf: 'center' }}>{money(lineAmount(li))}</span>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" style={{ flex: 'none', alignSelf: 'center' }} onClick={() => removeLine(idx)} disabled={lines.length === 1} aria-label={'Remove line ' + (idx + 1)}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                </div>
              ))}
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill ax-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={addLine}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">Add line</span>
              </button>
            </div>
          </section>

          {/* ADJUSTMENTS */}
          <section className="ax-card" role="region" aria-label="Adjustments">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Adjustments &amp; notes</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-ci-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ci-disc">Discount</label>
                  <div className="ax-input-group">
                    <input id="ci-disc" type="number" min={0} step={0.01} className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} value={adj.discount} onChange={(e) => setAdj((a) => ({ ...a, discount: Number(e.target.value) }))} />
                    <select className="ax-input-group__addon ax-select ax-select--sm" value={adj.discountType} onChange={(e) => setAdj((a) => ({ ...a, discountType: e.target.value }))} aria-label="Discount type" style={{ borderRadius: 0, width: 64 }}>
                      <option value="amt">$</option>
                      <option value="pct">%</option>
                    </select>
                  </div>
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="ci-ship">Shipping</label>
                  <input id="ci-ship" type="number" min={0} step={0.01} className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} value={adj.shipping} onChange={(e) => setAdj((a) => ({ ...a, shipping: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="ci-notes">Notes / terms</label>
                <textarea id="ci-notes" className="ax-textarea" rows={2} value={adj.notes} onChange={(e) => setAdj((a) => ({ ...a, notes: e.target.value }))} placeholder="Thanks for your business. Payment due within terms above." />
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT: LIVE PREVIEW (5) */}
        <aside className="ax-col--5" style={{ minWidth: 0 }}>
          <div style={{ position: 'sticky', top: 'var(--ax-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            {/* live invoice paper */}
            <article className="ax-card" role="region" aria-label="Invoice preview">
              <div className="ax-card__header">
                <div className="ax-card__titles"><span className="ax-card__eyebrow">Live preview</span><h2 className="ax-card__title">Invoice</h2></div>
                <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill"><span className="ax-badge__dot" />Draft</span>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0 }}>
                <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-5)', background: 'var(--ax-surface-subtle)' }}>
                  {/* head */}
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--ax-space-4)' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" /><path d="M9 8h6M9 12h6M9 16h2" /></svg></span>
                      <b style={{ fontFamily: 'var(--ax-font-display)', color: 'var(--ax-text-strong)' }}>Vireo Inc.</b>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)' }}>{meta.number}</div>
                      <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{'Due ' + (meta.due || '—')}</div>
                    </div>
                  </div>
                  {/* to */}
                  <div style={{ marginBottom: 'var(--ax-space-4)' }}>
                    <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)', marginBottom: 2 }}>Billed to</div>
                    <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{client.name || 'Client name'}</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>{client.email || 'email@client.com'}</div>
                  </div>
                  {/* lines */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--ax-text-xs)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--ax-border)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>Item</th>
                        <th style={{ textAlign: 'right', padding: '4px 0', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '4px 0', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((li) => (
                        <tr key={li.id} style={{ borderBottom: '1px solid var(--ax-border)' }}>
                          <td style={{ padding: '6px 0', color: 'var(--ax-text)' }}>{li.desc || 'Untitled item'}</td>
                          <td className="ax-num" style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{li.qty || 0}</td>
                          <td className="ax-num" style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{money(lineAmount(li))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* totals */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'var(--ax-space-3)', fontSize: 'var(--ax-text-xs)' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(subtotal)}</span></div>
                    {discountAmt > 0 && <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Discount</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>{'−' + money(discountAmt)}</span></div>}
                    <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(taxTotal)}</span></div>
                    {adj.shipping > 0 && <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(adj.shipping)}</span></div>}
                    <hr className="ax-divider" style={{ margin: '4px 0' }} />
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ color: 'var(--ax-text-strong)' }}>Total</b><span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{money(total)}</span></div>
                  </div>
                </div>
              </div>
            </article>

            {/* live order summary card */}
            <section className="ax-card" role="region" aria-label="Totals">
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Subtotal <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>(<span>{lines.length}</span> lines)</span></span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(subtotal)}</span></div>
                {discountAmt > 0 && <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Discount</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>{'−' + money(discountAmt)}</span></div>}
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Tax</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{money(taxTotal)}</span></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ color: 'var(--ax-text-muted)' }}>Shipping</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: adj.shipping > 0 ? 'var(--ax-text)' : 'var(--ax-viz-emerald)' }}>{adj.shipping > 0 ? money(adj.shipping) : 'Free'}</span></div>
                <hr className="ax-divider" style={{ margin: 'var(--ax-space-2) 0' }} />
                <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Total due</span>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{money(total)}</span>
                </div>
              </div>
            </section>
          </div>
        </aside>

        {/* STICKY ACTION BAR (12) */}
        <div className="ax-col--12" style={{ position: 'sticky', bottom: 0, zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', flexWrap: 'wrap', padding: 'var(--ax-space-3) var(--ax-space-5)', background: 'var(--ax-surface)', backdropFilter: 'blur(18px) saturate(1.1)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', boxShadow: 'var(--ax-shadow-md)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-viz-emerald)' }}><path d="M9 12l2 2l4 -4" /><path d="M12 3a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" transform="translate(-3 0)" /></svg>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Draft saved locally</span>
            </div>
            <span style={{ flex: '1 1 auto' }} />
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginInlineEnd: 'var(--ax-space-2)' }}>Total <b style={{ color: 'var(--ax-text-strong)' }}>{money(total)}</b></span>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={saveDraft}>{draftSaved ? 'Saved ✓' : 'Save draft'}</button>
            <Link className="ax-btn ax-btn--secondary" href="/ecommerce/invoice-details">Preview</Link>
            <button type="submit" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
              <span className="ax-btn__label">Save &amp; send</span>
            </button>
          </div>
        </div>
      </form>

      <style>{`
        @media (max-width: 640px) {
          .ax-ci-2col { grid-template-columns: 1fr !important; }
          .ax-ci-lh { display: none !important; }
          .ax-ci-line { flex-wrap: wrap !important; }
          .ax-ci-line > input[type="text"] { flex: 1 1 100% !important; }
        }
      `}</style>
    </>
  );
}

export default CreateInvoice;
