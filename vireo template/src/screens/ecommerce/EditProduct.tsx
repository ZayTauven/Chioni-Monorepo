'use client';
/*
 * Vireo Next.js — Ecommerce / Edit product (route "ecommerce/edit-product").
 *
 * Faithful re-expression of src/html/ecommerce/edit-product.html: the product
 * editor pre-filled with the Aperture Desk Lamp — basic info, media grid with an
 * add tile, pricing with live margin, inventory, variant matrix, SEO preview and
 * a danger zone — plus a header actions menu, a status/performance/organization
 * rail, a sticky "all changes saved" bar and a delete-confirm modal. The Alpine
 * x-data (axProductForm) is ported to React state; classes + ARIA match 1:1.
 */
import { useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
const COLLECTIONS = ['New arrivals', 'Bestsellers', 'Workspace essentials', 'Gift guide', 'Clearance'];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const num = (v: string) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; };
const money = (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STAR = (
  <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" />
);

const EDITOR_TOOLBAR = (
  <div role="toolbar" aria-label="Formatting" style={{ display: 'flex', gap: 2, padding: 6, border: '1px solid var(--ax-border)', borderBottom: 0, borderRadius: 'var(--ax-radius-sm) var(--ax-radius-sm) 0 0', background: 'var(--ax-surface-subtle)', flexWrap: 'wrap' }}>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bold"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Italic"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Underline"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5v5a5 5 0 0 0 10 0v-5" /><path d="M5 21h14" /></svg></button>
    <span style={{ width: 1, background: 'var(--ax-border)', margin: '2px 4px' }} />
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bulleted list"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
  </div>
);

function buildMatrixFrom(opts: Option[], priceStr: string, sku: string, prev: MatrixRow[]): MatrixRow[] {
  const active = opts.filter((o) => o.values.length);
  if (!active.length) return [];
  let combos: string[][] = [[]];
  active.forEach((o) => { const next: string[][] = []; combos.forEach((c) => { o.values.forEach((v) => next.push([...c, v])); }); combos = next; });
  const base = num(priceStr);
  return combos.map((c, i) => { const label = c.join(' / '); const existing = prev.find((m) => m.label === label); return existing || { id: i + '-' + label, label, price: base ? base.toFixed(2) : '', sku: sku + '-' + (i + 1), qty: String(Math.floor(Math.random() * 20) + 5) }; });
}

export function EditProduct() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [savedKind, setSavedKind] = useState<'draft' | 'publish'>('publish');
  const [dragover, setDragover] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [mid, setMid] = useState(5);
  const [oid, setOid] = useState(2);

  const [form, setForm] = useState({
    title: 'Aperture Desk Lamp', handle: 'aperture-desk-lamp',
    short: 'Precision aluminium task lamp with stepless dimming and tunable white.',
    long: 'The Aperture Desk Lamp pairs a precision aluminium body with a frictionless magnetic joint, letting you angle light exactly where you need it. A stepless dimmer and tunable colour temperature take it from a crisp 4000K work light to a relaxed 2700K glow. USB-C passthrough charging is built into the weighted base.',
    price: '129.00', compareAt: '159.00', cost: '58.40', taxable: true,
    sku: 'APG-0001', barcode: '0842751093014', trackQty: true, qty: '84', threshold: '10', location: 'pdx',
    metaTitle: 'Aperture Desk Lamp — Tunable LED Task Light', metaDesc: 'A precision aluminium desk lamp with stepless dimming, a magnetic articulating arm and a warm 2700K–4000K tunable LED. Free shipping over $75.',
    status: 'active', chOnline: true, chPos: true, chSocial: false,
    category: 'Lighting › Task lamps', brand: 'Aperture Studio', vendor: 'aperture',
    collections: ['Bestsellers', 'Workspace essentials'] as string[], tags: ['lamp', 'desk', 'led', 'warm-white', 'usb-c'] as string[],
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const [media, setMedia] = useState<MediaItem[]>([
    { id: 1, c: C.cyan }, { id: 2, c: C.violet }, { id: 3, c: C.amber }, { id: 4, c: C.emerald }, { id: 5, c: C.pink },
  ]);
  const [options, setOptions] = useState<Option[]>([
    { id: 1, name: 'Finish', values: ['Graphite', 'Ivory', 'Sage'] },
    { id: 2, name: 'Reach', values: ['40 cm', '48 cm'] },
  ]);
  const [matrix, setMatrix] = useState<MatrixRow[]>(() => buildMatrixFrom([
    { id: 1, name: 'Finish', values: ['Graphite', 'Ivory', 'Sage'] },
    { id: 2, name: 'Reach', values: ['40 cm', '48 cm'] },
  ], '129.00', 'APG-0001', []));

  const syncHandle = (title: string) => setForm((f) => ({ ...f, title, handle: slugify(title) }));
  const marginPct = () => { const p = num(form.price), c = num(form.cost); if (!p || !c) return '—'; return Math.round(((p - c) / p) * 100) + '%'; };
  const profit = () => { const p = num(form.price), c = num(form.cost); if (!p || !c) return '—'; return money(p - c); };

  const addImage = () => { if (media.length < 8) { setMedia((m) => [...m, { id: mid + 1, c: PALETTE[m.length % PALETTE.length] }]); setMid((x) => x + 1); } };
  const removeImage = (i: number) => setMedia((m) => m.filter((_, idx) => idx !== i));
  const makePrimary = (i: number) => setMedia((m) => { const next = [...m]; const [it] = next.splice(i, 1); next.unshift(it); return next; });

  const addOption = () => { if (options.length < 3) { setOptions((o) => [...o, { id: oid + 1, name: '', values: [] }]); setOid((x) => x + 1); } };
  const updateOption = (oi: number, patch: Partial<Option>) => setOptions((o) => { const next = o.map((it, idx) => (idx === oi ? { ...it, ...patch } : it)); setMatrix((prev) => buildMatrixFrom(next, form.price, form.sku, prev)); return next; });
  const addOptionValue = (oi: number, v: string) => { const opt = options[oi]; updateOption(oi, { values: [...opt.values, v] }); };
  const removeOptionValue = (oi: number, vi: number) => { const opt = options[oi]; updateOption(oi, { values: opt.values.filter((_, idx) => idx !== vi) }); };
  const removeOption = (oi: number) => setOptions((o) => { const next = o.filter((_, idx) => idx !== oi); setMatrix((prev) => buildMatrixFrom(next, form.price, form.sku, prev)); return next; });
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
    <>
      <form onSubmit={(e) => { e.preventDefault(); save('publish'); }}>
        <PageHead
          title="Edit Product"
          subtitle={
            (
              <>SKU <span className="ax-num">APG-0001</span> · <span className="ax-num">84</span> in stock · Last saved <span className="ax-num">Jun 22, 2026 · 2:41 PM</span>.</>
            ) as unknown as string
          }
          actions={
            <>
              <Link className="ax-btn ax-btn--ghost" href="/ecommerce/product-details">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
                <span className="ax-btn__label">Preview</span>
              </Link>
              <div style={{ position: 'relative' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setActionsOpen(false); }}>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setActionsOpen((o) => !o)} aria-expanded={actionsOpen} aria-haspopup="true">
                  <span className="ax-btn__label">Actions</span>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                </button>
                {actionsOpen && (
                  <div style={{ position: 'absolute', insetInlineEnd: 0, top: 'calc(100% + 6px)', minWidth: 200, padding: 'var(--ax-space-2)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-overlay)', boxShadow: 'var(--ax-shadow-md)', zIndex: 10 }} role="menu">
                    <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); router.push('/ecommerce/add-product'); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--ax-space-2)', padding: '8px var(--ax-space-3)', border: 0, background: 'none', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', textAlign: 'start' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--ax-text-muted)' }}><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" /><path d="M4.012 16.737a2 2 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
                      Duplicate
                    </button>
                    <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); set('status', 'draft'); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--ax-space-2)', padding: '8px var(--ax-space-3)', border: 0, background: 'none', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', textAlign: 'start' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16, color: 'var(--ax-text-muted)' }}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10l0 4" /><path d="M15 10l0 4" /></svg>
                      Unpublish
                    </button>
                    <div style={{ height: 1, background: 'var(--ax-border)', margin: 'var(--ax-space-1) 0' }} />
                    <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); setConfirmDelete(true); }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 'var(--ax-space-2)', padding: '8px var(--ax-space-3)', border: 0, background: 'none', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-danger-500)', textAlign: 'start' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                      Delete product
                    </button>
                  </div>
                )}
              </div>
            </>
          }
        />

        {/* page-head badge: rendered separately to keep PageHead title clean */}
        {saved && (
          <div className="ax-alert ax-alert--success" role="status" style={{ marginBottom: 'var(--ax-space-6)' }}>
            <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
            <div className="ax-alert__content"><p className="ax-alert__title">{savedKind === 'draft' ? 'Saved as draft' : 'Changes saved'}</p><p className="ax-alert__message">Your edits to “Aperture Desk Lamp” have been saved.</p></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSaved(false)} aria-label="Dismiss"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
          </div>
        )}

        <div className="ax-dash-grid" style={{ paddingBottom: 96 }}>
          {/* LEFT COLUMN */}
          <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            {/* BASIC INFO */}
            <section className="ax-card" role="region" aria-label="Basic information">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Basic information</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div className="ax-field"><label className="ax-label" htmlFor="p-title">Product title <span className="ax-field__required">*</span></label><input id="p-title" type="text" className="ax-input" value={form.title} onChange={(e) => syncHandle(e.target.value)} maxLength={120} /></div>
                <div className="ax-field"><label className="ax-label" htmlFor="p-handle">URL handle</label><div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>/products/</span><input id="p-handle" type="text" className="ax-input ax-num" value={form.handle} onChange={(e) => set('handle', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div></div>
                <div className="ax-field"><label className="ax-label" htmlFor="p-short">Short description</label><input id="p-short" type="text" className="ax-input" value={form.short} onChange={(e) => set('short', e.target.value)} maxLength={160} /><span className="ax-help"><span className="ax-num">{form.short.length}</span> / 160 characters</span></div>
                <div className="ax-field"><label className="ax-label" htmlFor="p-long">Description</label>{EDITOR_TOOLBAR}<textarea id="p-long" className="ax-textarea" rows={6} value={form.long} onChange={(e) => set('long', e.target.value)} style={{ borderRadius: '0 0 var(--ax-radius-sm) var(--ax-radius-sm)', minHeight: 140 }} /></div>
              </div>
            </section>

            {/* MEDIA */}
            <section className="ax-card" role="region" aria-label="Media">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Media</h2><p className="ax-card__subtitle">First image is the primary thumbnail. Drag to reorder.</p></div><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num"><span>{media.length}</span> / 8</span></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(116px,1fr))', gap: 'var(--ax-space-3)' }}>
                  {media.map((m, i) => (
                    <div key={m.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', display: 'grid', placeItems: 'center', border: '1px solid var(--ax-border)', background: `color-mix(in oklab,${m.c} 16%,var(--ax-surface-subtle))`, ...(i === 0 ? { borderColor: 'var(--ax-accent)', boxShadow: '0 0 0 1px var(--ax-accent)' } : {}) }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30, opacity: 0.55, color: m.c }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg>
                      {i === 0 && <span className="ax-badge ax-badge--accent ax-badge--solid ax-badge--sm" style={{ position: 'absolute', top: 6, insetInlineStart: 6, borderRadius: 'var(--ax-radius-xs)' }}>Primary</span>}
                      <button type="button" className="ax-btn ax-btn--icon ax-btn--sm" onClick={() => removeImage(i)} aria-label={'Remove image ' + (i + 1)} style={{ position: 'absolute', top: 6, insetInlineEnd: 6, width: 24, height: 24, background: 'color-mix(in oklab,var(--ax-canvas) 70%,transparent)', color: 'var(--ax-text-strong)', border: 0, borderRadius: 'var(--ax-radius-xs)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                      {i !== 0 && <button type="button" onClick={() => makePrimary(i)} className="ax-btn ax-btn--sm" style={{ position: 'absolute', bottom: 6, insetInline: 6, height: 24, fontSize: 'var(--ax-text-2xs)', background: 'color-mix(in oklab,var(--ax-canvas) 70%,transparent)', color: 'var(--ax-text-strong)', border: 0, borderRadius: 'var(--ax-radius-xs)' }}>Set primary</button>}
                    </div>
                  ))}
                  <label htmlFor="p-media" onDragOver={(e) => { e.preventDefault(); setDragover(true); }} onDragLeave={() => setDragover(false)} onDrop={(e) => { e.preventDefault(); setDragover(false); addImage(); }} style={{ aspectRatio: '1/1', borderRadius: 'var(--ax-radius-md)', border: '1.5px dashed var(--ax-border-strong)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: 'var(--ax-text-muted)', ...(dragover ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : {}) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 22, height: 22 }}><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
                    <small style={{ fontSize: 'var(--ax-text-2xs)' }}>Add image</small>
                    <input id="p-media" type="file" accept="image/*" multiple className="ax-visually-hidden" onChange={addImage} />
                  </label>
                </div>
              </div>
            </section>

            {/* PRICING */}
            <section className="ax-card" role="region" aria-label="Pricing">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Pricing</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-price">Price <span className="ax-field__required">*</span></label><div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span><input id="p-price" type="text" className="ax-input ax-num" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div></div>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-compare">Compare-at price</label><div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span><input id="p-compare" type="text" className="ax-input ax-num" inputMode="decimal" value={form.compareAt} onChange={(e) => set('compareAt', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div></div>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-cost">Cost per item</label><div className="ax-input-group"><span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)' }}>$</span><input id="p-cost" type="text" className="ax-input ax-num" inputMode="decimal" value={form.cost} onChange={(e) => set('cost', e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} /></div></div>
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
              </div>
            </section>

            {/* INVENTORY */}
            <section className="ax-card" role="region" aria-label="Inventory">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Inventory</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-sku">SKU</label><input id="p-sku" type="text" className="ax-input ax-num" value={form.sku} onChange={(e) => set('sku', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)', textTransform: 'uppercase' }} /></div>
                  <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="p-barcode">Barcode</label><input id="p-barcode" type="text" className="ax-input ax-num" value={form.barcode} onChange={(e) => set('barcode', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                </div>
                <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
                  <input type="checkbox" className="ax-switch" checked={form.trackQty} onChange={(e) => set('trackQty', e.target.checked)} />
                  <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Track quantity</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Automatically decrease stock as orders come in.</span></span>
                </label>
                {form.trackQty && (
                  <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(12,1fr)', gap: 'var(--ax-space-4)' }}>
                    <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="p-qty">Available</label><input id="p-qty" type="text" className="ax-input ax-num" inputMode="numeric" value={form.qty} onChange={(e) => set('qty', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="p-threshold">Low-stock alert at</label><input id="p-threshold" type="text" className="ax-input ax-num" inputMode="numeric" value={form.threshold} onChange={(e) => set('threshold', e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
                    <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="p-location">Location</label><select id="p-location" className="ax-select" value={form.location} onChange={(e) => set('location', e.target.value)}><option value="pdx">Portland warehouse</option><option value="ber">Berlin fulfillment</option><option value="sgp">Singapore hub</option></select></div>
                  </div>
                )}
              </div>
            </section>

            {/* VARIANTS */}
            <section className="ax-card" role="region" aria-label="Variants">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Variants</h2><p className="ax-card__subtitle">Per-variant price, SKU and quantity.</p></div><button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addOption}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Add option</span></button></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {options.map((opt, oi) => (
                  <div key={opt.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 40px', gap: 'var(--ax-space-3)', alignItems: 'start' }}>
                    <div className="ax-field" style={{ margin: 0 }}><input type="text" className="ax-input" placeholder="Option name" value={opt.name} onChange={(e) => updateOption(oi, { name: e.target.value })} /></div>
                    <div className="ax-tags">
                      {opt.values.map((v, vi) => (
                        <span key={vi} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill" style={{ gap: 4 }}><span>{v}</span><button type="button" onClick={() => removeOptionValue(oi, vi)} aria-label={'Remove ' + v} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
                      ))}
                      <input type="text" className="ax-tags__input" placeholder="Add value…" onKeyDown={(e) => onOptValueKey(oi, e)} />
                    </div>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => removeOption(oi)} aria-label="Remove option"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                  </div>
                ))}
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

            {/* SEO */}
            <section className="ax-card" role="region" aria-label="Search engine listing">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Search engine listing</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div style={{ padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginBottom: 6 }}>
                    <span className="ax-avatar ax-avatar--xs ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M19.5 7a9 9 0 0 0 -7.5 -4a8.991 8.991 0 0 0 -7.484 4" /><path d="M11.5 3a16.989 16.989 0 0 0 -1.826 4" /><path d="M12.5 3a16.989 16.989 0 0 1 1.828 4" /><path d="M19.5 17a9 9 0 0 1 -7.5 4a8.991 8.991 0 0 1 -7.484 -4" /><path d="M2 10l1 4l1.5 -4l1.5 4l1 -4" /><path d="M17 10l1 4l1.5 -4l1.5 4l1 -4" /><path d="M9.5 10l1 4l1.5 -4l1.5 4l1 -4" /></svg></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{'vireo.store › products › ' + (form.handle || 'handle')}</span>
                  </div>
                  <div style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-medium)' }}>{form.metaTitle || form.title}</div>
                  <div style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.4, marginTop: 2 }}>{form.metaDesc || form.short}</div>
                </div>
                <div className="ax-field"><label className="ax-label" htmlFor="p-metatitle">Page title</label><input id="p-metatitle" type="text" className="ax-input" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} maxLength={70} /><span className="ax-help"><span className="ax-num" style={form.metaTitle.length > 60 ? { color: 'var(--ax-warning-500)' } : undefined}>{form.metaTitle.length}</span> / 70 characters</span></div>
                <div className="ax-field"><label className="ax-label" htmlFor="p-metadesc">Meta description</label><textarea id="p-metadesc" className="ax-textarea" rows={3} value={form.metaDesc} onChange={(e) => set('metaDesc', e.target.value)} maxLength={160} /><span className="ax-help"><span className="ax-num" style={form.metaDesc.length > 155 ? { color: 'var(--ax-warning-500)' } : undefined}>{form.metaDesc.length}</span> / 160 characters</span></div>
              </div>
            </section>

            {/* DANGER ZONE */}
            <section className="ax-card" role="region" aria-label="Danger zone" style={{ borderColor: 'color-mix(in oklab,var(--ax-danger-500) 35%,var(--ax-border))' }}>
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title" style={{ color: 'var(--ax-danger-500)' }}>Danger zone</h2><p className="ax-card__subtitle">Deleting a product is permanent and removes it from all channels.</p></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0 }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>This product has <b className="ax-num" style={{ color: 'var(--ax-text)' }}>412</b> lifetime sales and <b className="ax-num" style={{ color: 'var(--ax-text)' }}>128</b> reviews.</div>
                  <button type="button" className="ax-btn ax-btn--danger ax-btn--soft" onClick={() => setConfirmDelete(true)}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                    <span className="ax-btn__label">Delete product</span>
                  </button>
                </div>
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
                <div>
                  <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Sales channels</div>
                  <label className="ax-check" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" checked={form.chOnline} onChange={(e) => set('chOnline', e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Online store</span></label>
                  <label className="ax-check" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" checked={form.chPos} onChange={(e) => set('chPos', e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Point of sale</span></label>
                  <label className="ax-check" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" checked={form.chSocial} onChange={(e) => set('chSocial', e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Social &amp; marketplaces</span></label>
                </div>
              </div>
            </section>

            {/* PERFORMANCE */}
            <section className="ax-card" role="region" aria-label="Performance">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Performance</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Units sold</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>412</b></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Revenue</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$53,148</b></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Conversion</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>3.8%</b></div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Avg. rating</span><span className="ax-cluster" style={{ gap: 6 }}><span className="ax-rating ax-rating--sm" aria-label="4.7 out of 5">{[1, 2, 3, 4, 5].map((s) => (<svg key={s} className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>))}</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>4.7</b></span></div>
              </div>
            </section>

            {/* ORGANIZATION */}
            <section className="ax-card" role="region" aria-label="Organization">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Organization</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="p-category">Category <span className="ax-field__required">*</span></label><input id="p-category" type="text" className="ax-input" value={form.category} onChange={(e) => set('category', e.target.value)} /></div>
                <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="p-brand">Brand</label><input id="p-brand" type="text" className="ax-input" value={form.brand} onChange={(e) => set('brand', e.target.value)} /></div>
                <div className="ax-field" style={{ margin: 0 }}><label className="ax-label" htmlFor="p-vendor">Vendor</label><select id="p-vendor" className="ax-select" value={form.vendor} onChange={(e) => set('vendor', e.target.value)}><option value="aperture">Aperture Studio</option><option value="northpine">Northpine Goods</option><option value="mono">Mono Supply Co.</option></select></div>
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
                </div>
              </div>
            </section>
          </aside>
        </div>

        {/* STICKY ACTION BAR */}
        <div style={{ position: 'sticky', bottom: 0, zIndex: 5, margin: '0 calc(-1 * var(--ax-space-6))', padding: 'var(--ax-space-4) var(--ax-space-6)', background: 'var(--ax-surface)', backdropFilter: 'blur(18px) saturate(1.1)', borderTop: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow-sm)' }}>
          <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
            <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-viz-emerald)' }}><path d="M5 12l5 5l10 -10" /></svg>
              <span>All changes saved Jun 22, 2026 · 2:41 PM</span>
            </span>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <Link className="ax-btn ax-btn--ghost" href="/ecommerce/products">Cancel</Link>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => save('draft')}>Save as draft</button>
              <button type="submit" className="ax-btn ax-btn--primary">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14a2 2 0 1 0 0 -4a2 2 0 0 0 0 4" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
                <span className="ax-btn__label">Save changes</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* DELETE CONFIRM MODAL */}
      {confirmDelete && (
        <div className="ax-flex" style={{ position: 'fixed', inset: 0, zIndex: 'var(--ax-z-modal,80)' as unknown as number, alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-5)' }}>
          <button type="button" aria-label="Close" style={{ position: 'absolute', inset: 0, background: 'color-mix(in oklab,var(--ax-canvas) 70%,transparent)', backdropFilter: 'blur(4px)', border: 0, cursor: 'default' }} onClick={() => setConfirmDelete(false)} />
          <div className="ax-card" style={{ position: 'relative', width: 'min(440px,100%)', margin: 0 }} role="alertdialog" aria-modal="true" aria-labelledby="del-title">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', textAlign: 'center', padding: 'var(--ax-space-7) var(--ax-space-6)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-danger-500) 14%,transparent)', color: 'var(--ax-danger-500)', margin: '0 auto' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></span>
              <div>
                <h2 id="del-title" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-2)' }}>Delete this product?</h2>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>“Aperture Desk Lamp” will be permanently removed from your catalog and all sales channels. This action can't be undone.</p>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', justifyContent: 'center', marginTop: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button type="button" className="ax-btn ax-btn--danger" onClick={() => { setConfirmDelete(false); router.push('/ecommerce/products'); }}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                  <span className="ax-btn__label">Delete product</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EditProduct;
