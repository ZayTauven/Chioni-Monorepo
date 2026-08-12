'use client';
/*
 * Vireo Next.js — Ecommerce / Add product (route "ecommerce/add-product").
 *
 * Faithful re-expression of src/html/ecommerce/add-product.html: a 7-step
 * product builder (basic info, media dropzone, pricing with live margin, tracked
 * inventory, variant matrix, shipping, SEO preview) with a status/organization
 * rail and a sticky action bar. The Alpine x-data (axProductForm) — handle sync,
 * margin math, media tiles, option→variant matrix, tag tokens, save toast — is
 * ported to React state; classes + ARIA match the reference 1:1.
 */
import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };
const PALETTE = [C.cyan, C.violet, C.pink, C.amber, C.emerald];

interface MediaItem { id: number; c: string; }
interface Option { id: number; name: string; values: string[]; }
interface MatrixRow { id: string; label: string; price: string; sku: string; qty: string; }

const STATUSES = [
  { id: 'active', name: 'Active', desc: 'Visible & available to buy', c: 'var(--ax-viz-emerald)' },
  { id: 'draft', name: 'Draft', desc: 'Hidden from the storefront', c: 'var(--ax-text-subtle)' },
  { id: 'scheduled', name: 'Scheduled', desc: 'Publishes on a set date', c: 'var(--ax-viz-amber)' },
];
const CAT_TREE = [
  { id: 'lighting', name: 'Lighting', children: ['Task lamps', 'Floor lamps', 'Ambient'] },
  { id: 'desk', name: 'Desk', children: ['Risers', 'Mats', 'Organizers'] },
  { id: 'drinkware', name: 'Drinkware', children: ['Mugs', 'Bottles', 'Carafes'] },
  { id: 'storage', name: 'Storage', children: ['Pinboards', 'Trays', 'Boxes'] },
  { id: 'tech', name: 'Tech accessories', children: ['Sleeves', 'Cables', 'Stands'] },
];
const COLLECTIONS = ['New arrivals', 'Bestsellers', 'Workspace essentials', 'Gift guide', 'Clearance'];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const num = (v: string) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; };
const money = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EDITOR_TOOLBAR = (
  <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', gap: 2, padding: 6, border: '1px solid var(--ax-border)', borderBottom: 0, borderRadius: 'var(--ax-radius-sm) var(--ax-radius-sm) 0 0', background: 'var(--ax-surface-subtle)', flexWrap: 'wrap' }}>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bold"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Italic"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Underline"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5v5a5 5 0 0 0 10 0v-5" /><path d="M5 21h14" /></svg></button>
    <span style={{ width: 1, background: 'var(--ax-border)', margin: '2px 4px' }} />
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bulleted list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Numbered list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 6h9" /><path d="M11 12h9" /><path d="M12 18h8" /><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4" /><path d="M6 10v-6l-2 2" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
  </div>
);

export function AddProduct() {
  const [saved, setSaved] = useState(false);
  const [savedKind, setSavedKind] = useState<'draft' | 'publish'>('publish');
  const [dragover, setDragover] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mid, setMid] = useState(0);
  const [options, setOptions] = useState<Option[]>([]);
  const [oid, setOid] = useState(0);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [catOpen, setCatOpen] = useState(false);

  const [form, setForm] = useState({
    title: '', handle: '', short: '', long: '',
    price: '', compareAt: '', cost: '', taxable: true, taxClass: 'standard',
    sku: '', barcode: '', trackQty: true, qty: '', threshold: '10', location: 'pdx', continueOOS: false,
    physical: true, weight: '', dimL: '', dimW: '', dimH: '', origin: 'us', hs: '',
    metaTitle: '', metaDesc: '',
    status: 'active', scheduleDate: '', chOnline: true, chPos: false, chSocial: false,
    category: '', brand: '', vendor: '', collections: [] as string[], tags: [] as string[],
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const syncHandle = (title: string) => setForm((f) => ({ ...f, title, handle: slugify(title) }));
  const marginPct = () => { const p = num(form.price), c = num(form.cost); if (!p || !c) return '—'; return Math.round(((p - c) / p) * 100) + '%'; };
  const profit = () => { const p = num(form.price), c = num(form.cost); if (!p || !c) return '—'; return money(p - c); };

  const addImage = () => { if (media.length < 8) { setMedia((m) => [...m, { id: mid + 1, c: PALETTE[m.length % PALETTE.length] }]); setMid((x) => x + 1); } };
  const removeImage = (i: number) => setMedia((m) => m.filter((_, idx) => idx !== i));
  const makePrimary = (i: number) => setMedia((m) => { const next = [...m]; const [it] = next.splice(i, 1); next.unshift(it); return next; });

  const addOption = () => { if (options.length < 3) { setOptions((o) => [...o, { id: oid + 1, name: '', values: [] }]); setOid((x) => x + 1); } };

  const buildMatrix = (opts: Option[]) => {
    const active = opts.filter((o) => o.values.length);
    if (!active.length) { setMatrix([]); return; }
    let combos: string[][] = [[]];
    active.forEach((o) => { const next: string[][] = []; combos.forEach((c) => { o.values.forEach((v) => next.push([...c, v])); }); combos = next; });
    const base = num(form.price);
    setMatrix((prev) => combos.map((c, i) => { const label = c.join(' / '); const existing = prev.find((m) => m.label === label); return existing || { id: i + '-' + label, label, price: base ? base.toFixed(2) : '', sku: '', qty: '0' }; }));
  };

  const updateOption = (oi: number, patch: Partial<Option>) => setOptions((o) => { const next = o.map((it, idx) => (idx === oi ? { ...it, ...patch } : it)); buildMatrix(next); return next; });
  const addOptionValue = (oi: number, v: string) => { const opt = options[oi]; updateOption(oi, { values: [...opt.values, v] }); };
  const removeOptionValue = (oi: number, vi: number) => { const opt = options[oi]; updateOption(oi, { values: opt.values.filter((_, idx) => idx !== vi) }); };
  const removeOption = (oi: number) => setOptions((o) => { const next = o.filter((_, idx) => idx !== oi); buildMatrix(next); return next; });
  const updateRow = (ri: number, patch: Partial<MatrixRow>) => setMatrix((m) => m.map((r, idx) => (idx === ri ? { ...r, ...patch } : r)));

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = e.currentTarget.value.trim().replace(/,$/, '');
      if (v && !form.tags.includes(v)) set('tags', [...form.tags, v]);
      e.currentTarget.value = '';
    }
  };
  const onOptValueKey = (oi: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = e.currentTarget.value.trim();
      if (v) { addOptionValue(oi, v); e.currentTarget.value = ''; }
    }
  };

  const save = (kind: 'draft' | 'publish') => { setSavedKind(kind); setSaved(true); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => setSaved(false), 4000); };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save('publish'); }}>
      <PageHead
        title="Add Product"
        subtitle="Create a new product, set pricing & inventory, then publish to your storefront."
        actions={
          <Link className="ax-btn ax-btn--ghost" href="/ecommerce/products">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Back to products</span>
          </Link>
        }
      />

      {saved && (
        <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-6)' }}>
          <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
          <div className="ax-alert__content"><p className="ax-alert__title">{savedKind === 'draft' ? 'Saved as draft' : 'Product published'}</p><p className="ax-alert__message">{savedKind === 'draft' ? "Your changes are saved. Publish when you're ready." : 'This product is now live on your storefront.'}</p></div>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSaved(false)} aria-label="Dismiss"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}

      <div className="ax-dash-grid" style={{ paddingBottom: 96 }}>
        {/* LEFT COLUMN */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* BASIC INFO */}
          <section className="ax-card" role="region" aria-label="Basic information">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 1</span><h2 className="ax-card__title">Basic information</h2><p className="ax-card__subtitle">The essentials customers see first.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field">
                <label className="ax-label" htmlFor="p-title">Product title <span className="ax-field__required">*</span></label>
                <input id="p-title" type="text" className="ax-input" placeholder="e.g. Aperture Desk Lamp" value={form.title} onChange={(e) => syncHandle(e.target.value)} maxLength={120} />
                <span className="ax-help">Appears as the product name and the page heading.</span>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="p-handle">URL handle</label>
                <div className="ax-input-group">
                  <span className="ax-input-group__addon" style={{ color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>/products/</span>
                  <input id="p-handle" type="text" className="ax-input ax-num" value={form.handle} onChange={(e) => set('handle', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} placeholder="aperture-desk-lamp" />
                </div>
                <span className="ax-help">Auto-generated from the title — edit if you need a custom link.</span>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="p-short">Short description</label>
                <input id="p-short" type="text" className="ax-input" placeholder="One-line summary shown on cards & search" value={form.short} onChange={(e) => set('short', e.target.value)} maxLength={160} />
                <span className="ax-help"><span className="ax-num">{form.short.length}</span> / 160 characters</span>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="p-long">Description</label>
                {EDITOR_TOOLBAR}
                <textarea id="p-long" className="ax-textarea" rows={6} placeholder="Describe materials, features, what's in the box…" value={form.long} onChange={(e) => set('long', e.target.value)} style={{ borderRadius: '0 0 var(--ax-radius-sm) var(--ax-radius-sm)', minHeight: 140 }} />
              </div>
            </div>
          </section>

          {/* MEDIA */}
          <section className="ax-card" role="region" aria-label="Media">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 2</span><h2 className="ax-card__title">Media</h2><p className="ax-card__subtitle">First image is the primary thumbnail. Drag to reorder.</p></div><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num"><span>{media.length}</span> / 8</span></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className={`ax-dropzone${dragover ? ' is-dragover' : ''}`}>
                <label className="ax-dropzone__area" htmlFor="p-media" onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={(e) => { e.preventDefault(); setDragover(false); addImage(); }} style={{ cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
                  <div><b style={{ color: 'var(--ax-text)' }}>Click to upload</b> or drag &amp; drop</div>
                  <small style={{ color: 'var(--ax-text-subtle)' }}>PNG, JPG or WEBP up to 5 MB · 1:1 recommended</small>
                  <input id="p-media" type="file" accept="image/*" multiple className="ax-visually-hidden" onChange={addImage} />
                </label>
              </div>
              {!!media.length && (
                <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(116px,1fr))', gap: 'var(--ax-space-3)' }}>
                  {media.map((m, i) => (
                    <div key={m.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', display: 'grid', placeItems: 'center', border: '1px solid var(--ax-border)', background: `color-mix(in oklab,${m.c} 16%,var(--ax-surface-subtle))`, ...(i === 0 ? { borderColor: 'var(--ax-accent)', boxShadow: '0 0 0 1px var(--ax-accent)' } : {}) }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30, opacity: 0.55, color: m.c }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg>
                      {i === 0 && <span className="ax-badge ax-badge--accent ax-badge--solid ax-badge--sm" style={{ position: 'absolute', top: 6, insetInlineStart: 6, borderRadius: 'var(--ax-radius-xs)' }}>Primary</span>}
                      <button type="button" className="ax-btn ax-btn--icon ax-btn--sm" onClick={() => removeImage(i)} aria-label={'Remove image ' + (i + 1)} style={{ position: 'absolute', top: 6, insetInlineEnd: 6, width: 24, height: 24, background: 'color-mix(in oklab,var(--ax-canvas) 70%,transparent)', color: 'var(--ax-text-strong)', border: 0, borderRadius: 'var(--ax-radius-xs)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                      {i !== 0 && <button type="button" onClick={() => makePrimary(i)} className="ax-btn ax-btn--sm" style={{ position: 'absolute', bottom: 6, insetInline: 6, height: 24, fontSize: 'var(--ax-text-2xs)', background: 'color-mix(in oklab,var(--ax-canvas) 70%,transparent)', color: 'var(--ax-text-strong)', border: 0, borderRadius: 'var(--ax-radius-xs)' }}>Set primary</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* PRICING */}
          <section className="ax-card" role="region" aria-label="Pricing">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 3</span><h2 className="ax-card__title">Pricing</h2><p className="ax-card__subtitle">Set your price, comparison price and cost.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}>
                  <label className="ax-label" htmlFor="p-price">Price <span className="ax-field__required">*</span></label>
                  <div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span><input id="p-price" type="text" className="ax-input ax-num" inputMode="decimal" placeholder="0.00" value={form.price} onChange={(e) => set('price', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div>
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}>
                  <label className="ax-label" htmlFor="p-compare">Compare-at price</label>
                  <div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span><input id="p-compare" type="text" className="ax-input ax-num" inputMode="decimal" placeholder="0.00" value={form.compareAt} onChange={(e) => set('compareAt', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div>
                  <span className="ax-help">Shown struck-through to signal a sale.</span>
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}>
                  <label className="ax-label" htmlFor="p-cost">Cost per item</label>
                  <div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span><input id="p-cost" type="text" className="ax-input ax-num" inputMode="decimal" placeholder="0.00" value={form.cost} onChange={(e) => set('cost', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div>
                </div>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}>
                  <span className="ax-label">Margin</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-4)', height: 38, paddingInline: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-surface-subtle)' }}>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{marginPct()}</span>
                    <span style={{ width: 1, height: 18, background: 'var(--ax-border)' }} />
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Profit <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>{profit()}</b></span>
                  </div>
                </div>
              </div>
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={form.taxable} onChange={(e) => set('taxable', e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Charge tax on this product</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Tax is calculated at checkout based on the customer's region.</span></span>
              </label>
              {form.taxable && (
                <div className="ax-field" style={{ maxWidth: 280 }}>
                  <label className="ax-label" htmlFor="p-taxclass">Tax class</label>
                  <select id="p-taxclass" className="ax-select" value={form.taxClass} onChange={(e) => set('taxClass', e.target.value)}>
                    <option value="standard">Standard rate</option>
                    <option value="reduced">Reduced rate</option>
                    <option value="zero">Zero rate (exempt)</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* INVENTORY */}
          <section className="ax-card" role="region" aria-label="Inventory">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 4</span><h2 className="ax-card__title">Inventory</h2><p className="ax-card__subtitle">Track stock so you never oversell.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-sku">SKU (stock keeping unit)</label><input id="p-sku" type="text" className="ax-input ax-num" placeholder="APG-0001" value={form.sku} onChange={(e) => set('sku', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)', textTransform: 'uppercase' }} /></div>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-barcode">Barcode (ISBN, UPC, GTIN)</label><input id="p-barcode" type="text" className="ax-input ax-num" placeholder="0123456789012" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
              </div>
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={form.trackQty} onChange={(e) => set('trackQty', e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Track quantity</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Automatically decrease stock as orders come in.</span></span>
              </label>
              {form.trackQty && (
                <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="p-qty">Available</label><input id="p-qty" type="text" className="ax-input ax-num" inputMode="numeric" placeholder="0" value={form.qty} onChange={(e) => set('qty', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                  <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="p-threshold">Low-stock alert at</label><input id="p-threshold" type="text" className="ax-input ax-num" inputMode="numeric" placeholder="10" value={form.threshold} onChange={(e) => set('threshold', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                  <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="p-location">Location</label><select id="p-location" className="ax-select" value={form.location} onChange={(e) => set('location', e.target.value)}><option value="pdx">Portland warehouse</option><option value="ber">Berlin fulfillment</option><option value="sgp">Singapore hub</option></select></div>
                </div>
              )}
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-checkbox" checked={form.continueOOS} onChange={(e) => set('continueOOS', e.target.checked)} />
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Continue selling when out of stock</span>
              </label>
            </div>
          </section>

          {/* VARIANTS */}
          <section className="ax-card" role="region" aria-label="Variants">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 5</span><h2 className="ax-card__title">Variants</h2><p className="ax-card__subtitle">Add options like size or colour to generate a variant matrix.</p></div><button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addOption}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Add option</span></button></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              {options.map((opt, oi) => (
                <div key={opt.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', gap: 'var(--ax-space-3)', alignItems: 'start' }}>
                  <div className="ax-field" style={{ margin: 0 }}><input type="text" className="ax-input" placeholder="Option name" value={opt.name} onChange={(e) => updateOption(oi, { name: e.target.value })} /></div>
                  <div className="ax-tags">
                    {opt.values.map((v, vi) => (
                      <span key={vi} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill" style={{ gap: 4 }}><span>{v}</span><button type="button" onClick={() => removeOptionValue(oi, vi)} aria-label={'Remove ' + v} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
                    ))}
                    <input type="text" className="ax-tags__input" placeholder={opt.values.length ? 'Add value…' : 'e.g. Small, Medium, Large'} onKeyDown={(e) => onOptValueKey(oi, e)} />
                  </div>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => removeOption(oi)} aria-label="Remove option"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                </div>
              ))}
              {!options.length && <div style={{ textAlign: 'center', padding: 'var(--ax-space-6) 0', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>No options yet. Add one to sell this product in multiple variations.</div>}
              {!!matrix.length && (
                <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-5))' }}>
                  <table className="ax-table ax-table--hover">
                    <thead className="ax-table__head"><tr><th className="ax-table__th" scope="col">Variant</th><th className="ax-table__th ax-table__th--num" scope="col">Price</th><th className="ax-table__th" scope="col">SKU</th><th className="ax-table__th ax-table__th--num" scope="col">Qty</th></tr></thead>
                    <tbody>
                      {matrix.map((row, ri) => (
                        <tr key={row.id} className="ax-table__row">
                          <td className="ax-table__td" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{row.label}</td>
                          <td className="ax-table__td ax-table__td--num"><div className="ax-input-group" style={{ maxWidth: 120, marginInlineStart: 'auto' }}><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>$</span><input type="text" className="ax-input ax-num ax-input--sm" inputMode="decimal" value={row.price} onChange={(e) => updateRow(ri, { price: e.target.value })} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)', textAlign: 'right' }} aria-label={'Price for ' + row.label} /></div></td>
                          <td className="ax-table__td"><input type="text" className="ax-input ax-input--sm ax-num" value={row.sku} onChange={(e) => updateRow(ri, { sku: e.target.value })} style={{ fontFamily: 'var(--ax-font-mono)', maxWidth: 140 }} aria-label={'SKU for ' + row.label} /></td>
                          <td className="ax-table__td ax-table__td--num"><input type="text" className="ax-input ax-input--sm ax-num" inputMode="numeric" value={row.qty} onChange={(e) => updateRow(ri, { qty: e.target.value })} style={{ fontFamily: 'var(--ax-font-mono)', maxWidth: 80, textAlign: 'right' }} aria-label={'Quantity for ' + row.label} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* SHIPPING */}
          <section className="ax-card" role="region" aria-label="Shipping">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 6</span><h2 className="ax-card__title">Shipping</h2><p className="ax-card__subtitle">Used to calculate rates and customs at checkout.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                <input type="checkbox" className="ax-switch" checked={form.physical} onChange={(e) => set('physical', e.target.checked)} />
                <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>This is a physical product</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Turn off for digital downloads & services.</span></span>
              </label>
              {form.physical && (
                <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field" style={{ gridColumn: 'span 4' }}>
                    <label className="ax-label" htmlFor="p-weight">Weight</label>
                    <div className="ax-input-group"><input id="p-weight" type="text" className="ax-input ax-num" inputMode="decimal" placeholder="0.0" value={form.weight} onChange={(e) => set('weight', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>kg</span></div>
                  </div>
                  <div className="ax-field" style={{ gridColumn: 'span 8' }}>
                    <span className="ax-label">Dimensions (L × W × H, cm)</span>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                      <input type="text" className="ax-input ax-num" inputMode="decimal" placeholder="L" value={form.dimL} onChange={(e) => set('dimL', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)', textAlign: 'center' }} aria-label="Length" />
                      <span style={{ color: 'var(--ax-text-subtle)' }}>×</span>
                      <input type="text" className="ax-input ax-num" inputMode="decimal" placeholder="W" value={form.dimW} onChange={(e) => set('dimW', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)', textAlign: 'center' }} aria-label="Width" />
                      <span style={{ color: 'var(--ax-text-subtle)' }}>×</span>
                      <input type="text" className="ax-input ax-num" inputMode="decimal" placeholder="H" value={form.dimH} onChange={(e) => set('dimH', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)', textAlign: 'center' }} aria-label="Height" />
                    </div>
                  </div>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-origin">Country of origin</label><select id="p-origin" className="ax-select" value={form.origin} onChange={(e) => set('origin', e.target.value)}><option value="us">United States</option><option value="de">Germany</option><option value="jp">Japan</option><option value="cn">China</option></select></div>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-hs">HS (harmonized) code</label><input id="p-hs" type="text" className="ax-input ax-num" placeholder="9405.20" value={form.hs} onChange={(e) => set('hs', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                </div>
              )}
            </div>
          </section>

          {/* SEO */}
          <section className="ax-card" role="region" aria-label="Search engine listing">
            <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Step 7</span><h2 className="ax-card__title">Search engine listing</h2><p className="ax-card__subtitle">Control how this product appears in search results.</p></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 6 }}>
                  <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M19.5 7a9 9 0 0 0 -7.5 -4a8.991 8.991 0 0 0 -7.484 4" /><path d="M11.5 3a16.989 16.989 0 0 0 -1.826 4" /><path d="M12.5 3a16.989 16.989 0 0 1 1.828 4" /><path d="M19.5 17a9 9 0 0 1 -7.5 4a8.991 8.991 0 0 1 -7.484 -4" /><path d="M2 10l1 4l1.5 -4l1.5 4l1 -4" /><path d="M17 10l1 4l1.5 -4l1.5 4l1 -4" /><path d="M9.5 10l1 4l1.5 -4l1.5 4l1 -4" /></svg></span>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{'vireo.store › products › ' + (form.handle || 'handle')}</span>
                </div>
                <div style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-medium)' }}>{form.metaTitle || form.title || 'Product page title'}</div>
                <div style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.4, marginTop: 2 }}>{form.metaDesc || form.short || 'Your meta description preview appears here. Aim for 120–155 characters.'}</div>
              </div>
              <div className="ax-field"><label className="ax-label" htmlFor="p-metatitle">Page title</label><input id="p-metatitle" type="text" className="ax-input" placeholder="Defaults to the product title" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} maxLength={70} /><span className="ax-help"><span className="ax-num" style={form.metaTitle.length > 60 ? { color: 'var(--ax-warning-500)' } : undefined}>{form.metaTitle.length}</span> / 70 characters</span></div>
              <div className="ax-field"><label className="ax-label" htmlFor="p-metadesc">Meta description</label><textarea id="p-metadesc" className="ax-textarea" rows={3} placeholder="A concise summary for search engines" value={form.metaDesc} onChange={(e) => set('metaDesc', e.target.value)} maxLength={160} /><span className="ax-help"><span className="ax-num" style={form.metaDesc.length > 155 ? { color: 'var(--ax-warning-500)' } : undefined}>{form.metaDesc.length}</span> / 160 characters</span></div>
            </div>
          </section>
        </div>

        {/* RIGHT RAIL */}
        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* STATUS */}
          <section className="ax-card" role="region" aria-label="Status">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Status</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              {STATUSES.map((s) => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', cursor: 'pointer', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1.5px solid', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(form.status === s.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : { borderColor: 'var(--ax-border)', background: 'var(--ax-surface)' }) }}>
                  <input type="radio" name="p-status" className="ax-radio" value={s.id} checked={form.status === s.id} onChange={() => set('status', s.id)} />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: s.c }} />
                  <span style={{ flex: '1 1 auto' }}><span style={{ display: 'block', fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{s.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.desc}</span></span>
                </label>
              ))}
              {form.status === 'scheduled' && (
                <div className="ax-field" style={{ marginTop: 'var(--ax-space-1)' }}><label className="ax-label" htmlFor="p-schedule">Publish date</label><input id="p-schedule" type="date" className="ax-input ax-num" value={form.scheduleDate} onChange={(e) => set('scheduleDate', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
              )}
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Sales channels</div>
                <label className="ax-check" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" checked={form.chOnline} onChange={(e) => set('chOnline', e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Online store</span></label>
                <label className="ax-check" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" checked={form.chPos} onChange={(e) => set('chPos', e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Point of sale</span></label>
                <label className="ax-check" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" checked={form.chSocial} onChange={(e) => set('chSocial', e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Social &amp; marketplaces</span></label>
              </div>
            </div>
          </section>

          {/* ORGANIZATION */}
          <section className="ax-card" role="region" aria-label="Organization">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Organization</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div className="ax-field" style={{ margin: 0, position: 'relative' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCatOpen(false); }}>
                <label className="ax-label" htmlFor="p-cat-trigger">Category <span className="ax-field__required">*</span></label>
                <button id="p-cat-trigger" type="button" className="ax-input" onClick={() => setCatOpen((o) => !o)} aria-expanded={catOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'start', cursor: 'pointer' }}>
                  <span style={{ color: form.category ? 'var(--ax-text)' : 'var(--ax-text-subtle)' }}>{form.category || 'Select a category'}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--ax-text-subtle)' }}><path d="M6 9l6 6l6 -6" /></svg>
                </button>
                {catOpen && (
                  <div style={{ marginTop: 6, padding: 'var(--ax-space-2)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-overlay)', boxShadow: 'var(--ax-shadow-md)', maxHeight: 240, overflow: 'auto' }} role="tree">
                    {CAT_TREE.map((node) => (
                      <div key={node.id}>
                        <button type="button" role="treeitem" onClick={() => { set('category', node.name); setCatOpen(false); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 6, padding: '7px var(--ax-space-2)', border: 0, background: 'none', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', textAlign: 'start' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--ax-text-subtle)' }}><path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2" /></svg>
                          <span>{node.name}</span>
                        </button>
                        {node.children.map((child) => (
                          <button key={child} type="button" role="treeitem" onClick={() => { set('category', node.name + ' › ' + child); setCatOpen(false); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 6, padding: '6px var(--ax-space-2)', paddingInlineStart: 'var(--ax-space-7)', border: 0, background: 'none', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', textAlign: 'start' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13, color: 'var(--ax-text-subtle)' }}><path d="M9 6l6 6l-6 6" /></svg>
                            <span>{child}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="p-brand">Brand</label><input id="p-brand" type="text" className="ax-input" placeholder="e.g. Aperture Studio" value={form.brand} onChange={(e) => set('brand', e.target.value)} /></div>
              <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="p-vendor">Vendor</label><select id="p-vendor" className="ax-select" value={form.vendor} onChange={(e) => set('vendor', e.target.value)}><option value="">Select vendor</option><option value="aperture">Aperture Studio</option><option value="northpine">Northpine Goods</option><option value="mono">Mono Supply Co.</option></select></div>
              <div>
                <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Collections</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                  {COLLECTIONS.map((col) => (
                    <label key={col} className="ax-check" style={{ gap: 'var(--ax-space-2)', minHeight: 30 }}><input type="checkbox" className="ax-checkbox" checked={form.collections.includes(col)} onChange={(e) => set('collections', e.target.checked ? [...form.collections, col] : form.collections.filter((x) => x !== col))} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>{col}</span></label>
                  ))}
                </div>
              </div>
              <div className="ax-field" style={{ margin: 0 }}>
                <label className="ax-label" htmlFor="p-tags">Tags</label>
                <div className="ax-tags">
                  {form.tags.map((t, ti) => (
                    <span key={ti} className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill" style={{ gap: 4 }}><span>{t}</span><button type="button" onClick={() => set('tags', form.tags.filter((_, idx) => idx !== ti))} aria-label={'Remove tag ' + t} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
                  ))}
                  <input id="p-tags" type="text" className="ax-tags__input" placeholder="Add a tag…" onKeyDown={onTagKey} />
                </div>
                <span className="ax-help">Press Enter or comma to add. Helps customers find this product.</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* STICKY ACTION BAR */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 5, margin: '0 calc(-1 * var(--ax-space-6))', padding: 'var(--ax-space-4) var(--ax-space-6)', background: 'var(--ax-surface)', backdropFilter: 'blur(18px) saturate(1.1)', borderTop: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow-sm)' }}>
        <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
          <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-warning-500)' }}><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg>
            <span>Unsaved changes</span>
          </span>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
            <Link className="ax-btn ax-btn--ghost" href="/ecommerce/products">Cancel</Link>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={() => save('draft')}>Save as draft</button>
            <button type="submit" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14a2 2 0 1 0 0 -4a2 2 0 0 0 0 4" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
              <span className="ax-btn__label">Save product</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default AddProduct;
