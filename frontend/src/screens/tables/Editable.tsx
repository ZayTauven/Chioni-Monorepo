'use client';
/*
 * Vireo Next.js — Editable Table (tables/editable). Faithful port of
 * src/html/tables/editable.html: click-to-edit cells (text/number/select),
 * per-cell dirty dots, add/remove rows, unsaved-change count, save/discard.
 * Alpine `axEditable()` re-expressed with useState.
 */
import { useEffect, useRef, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Row { id: string; sku: string; name: string; category: string; price: number; stock: number; status: string; _new: boolean; }
const CATEGORIES = ['Lighting', 'Storage', 'Drinkware', 'Desk', 'Tech accessories', 'Stationery', 'Decor'];
const INITIAL: Row[] = [
  { id: 'prd_008', sku: 'APG-0008', name: 'Brass Task Light', category: 'Lighting', price: 182.0, stock: 22, status: 'active', _new: false },
  { id: 'prd_001', sku: 'APG-0001', name: 'Aperture Desk Lamp', category: 'Lighting', price: 129.0, stock: 84, status: 'active', _new: false },
  { id: 'prd_004', sku: 'APG-0004', name: 'Walnut Monitor Riser', category: 'Desk', price: 96.0, stock: 41, status: 'active', _new: false },
  { id: 'prd_009', sku: 'APG-0009', name: 'Stoneware Carafe', category: 'Drinkware', price: 52.0, stock: 120, status: 'active', _new: false },
  { id: 'prd_002', sku: 'APG-0002', name: 'Linen Pinboard', category: 'Storage', price: 58.0, stock: 0, status: 'out_of_stock', _new: false },
  { id: 'prd_005', sku: 'APG-0005', name: 'Felt Laptop Sleeve 14"', category: 'Tech accessories', price: 44.0, stock: 158, status: 'active', _new: false },
  { id: 'prd_007', sku: 'APG-0007', name: 'Cork Desk Mat', category: 'Desk', price: 38.0, stock: 0, status: 'draft', _new: false },
  { id: 'prd_003', sku: 'APG-0003', name: 'Matte Ceramic Mug', category: 'Drinkware', price: 24.0, stock: 312, status: 'active', _new: false },
];
const statusClass = (s: string) => (({ active: 'ax-badge--success', draft: 'ax-badge--neutral', out_of_stock: 'ax-badge--danger' } as Record<string, string>)[s] || 'ax-badge--neutral');
const statusLabel = (s: string) => (({ active: 'Active', draft: 'Draft', out_of_stock: 'Out of stock' } as Record<string, string>)[s] || s);
type Field = 'name' | 'category' | 'price' | 'stock' | 'status';

export function Editable() {
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [editing, setEditing] = useState<{ id: string | null; field: Field | null; value: string | number }>({ id: null, field: null, value: '' });
  const [saved, setSaved] = useState(false);
  const snapshot = useRef<Row[]>(JSON.parse(JSON.stringify(INITIAL)));
  const seq = useRef(100);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const base = () => snapshot.current;
  const isDirty = (r: Row) => {
    if (r._new) return true;
    const o = base().find((x) => x.id === r.id);
    if (!o) return true;
    return (['name', 'category', 'price', 'stock', 'status'] as Field[]).some((f) => String(o[f]) !== String(r[f]));
  };
  const dirtyCell = (r: Row, f: Field) => {
    if (r._new) return false;
    const o = base().find((x) => x.id === r.id);
    return !!o && String(o[f]) !== String(r[f]);
  };
  const dirtyCount = () => {
    let n = 0;
    const removed = base().filter((o) => !rows.find((r) => r.id === o.id)).length;
    rows.forEach((r) => { if (isDirty(r)) n++; });
    return n + removed;
  };

  useEffect(() => { editInputRef.current?.focus(); if (editInputRef.current instanceof HTMLInputElement) editInputRef.current.select(); }, [editing.id, editing.field]);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const edit = (r: Row, field: Field) => setEditing({ id: r.id, field, value: r[field] as string | number });
  const cancel = () => setEditing({ id: null, field: null, value: '' });
  const commit = (r: Row) => {
    if (editing.id !== r.id || editing.field == null) return;
    const field = editing.field;
    let v: string | number = editing.value;
    if (field === 'price') v = Math.max(0, Number(v) || 0);
    if (field === 'stock') v = Math.max(0, parseInt(String(v)) || 0);
    setRows((prev) => prev.map((x) => {
      if (x.id !== r.id) return x;
      const next = { ...x, [field]: v } as Row;
      if (field === 'stock') {
        if (v === 0 && next.status === 'active') next.status = 'out_of_stock';
        if ((v as number) > 0 && next.status === 'out_of_stock') next.status = 'active';
      }
      return next;
    }));
    cancel();
  };
  const addRow = () => {
    const n = ++seq.current;
    const r: Row = { id: 'new_' + n, sku: 'APG-' + String(1000 + n).slice(-4), name: '', category: 'Lighting', price: 0, stock: 0, status: 'draft', _new: true };
    setRows((prev) => [r, ...prev]);
    setEditing({ id: r.id, field: 'name', value: '' });
  };
  const removeRow = (r: Row) => {
    if (window.confirm('Delete "' + (r.name || 'this row') + '"? This is part of your unsaved changes.')) setRows((prev) => prev.filter((x) => x.id !== r.id));
  };
  const saveAll = () => {
    if (rows.some((r) => !String(r.name).trim())) { window.alert('Every product needs a name before saving.'); return; }
    const next = rows.map((r) => ({ ...r, _new: false }));
    setRows(next);
    snapshot.current = JSON.parse(JSON.stringify(next));
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2600);
  };
  const discard = () => {
    if (dirtyCount() && !window.confirm('Discard all unsaved changes?')) return;
    setRows(JSON.parse(JSON.stringify(base())));
    cancel();
  };

  const count = dirtyCount();
  const DirtyDot = () => <span className="ax-dirty-dot" aria-hidden="true" />;

  return (
    <>
      <PageHead
        title="Editable Table"
        subtitle="Click any cell to edit in place. Add or remove rows, track unsaved changes, then commit them all at once."
        actions={
          <>
            {count > 0 && (
              <span className={`ax-badge ax-badge--soft ${count ? 'ax-badge--warning' : 'ax-badge--neutral'}`}>
                <span className="ax-num">{count} unsaved {count === 1 ? 'change' : 'changes'}</span>
              </span>
            )}
            <button type="button" className="ax-btn ax-btn--ghost" onClick={discard} disabled={!count}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 0 1 0 8h-1" /></svg>
              <span className="ax-btn__label">Discard</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={saveAll} disabled={!count}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
              <span className="ax-btn__label">Save changes</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {saved && (
          <div className="ax-col--12 ax-flex" style={{ justifyContent: 'flex-end' }}>
            <div className="ax-alert ax-alert--success" role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              Changes saved.
            </div>
          </div>
        )}

        <section className="ax-card ax-col--12" role="region" aria-label="Editable products">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Aperture Goods — Catalog</h2>
              <p className="ax-card__subtitle">Edit price, stock, category &amp; status inline. <span className="ax-num">{rows.length}</span> products.</p>
            </div>
            <div className="ax-card__actions">
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={addRow}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                <span className="ax-btn__label">Add row</span>
              </button>
            </div>
          </div>

          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover" style={{ minWidth: 840 }}>
              <caption className="ax-visually-hidden">Editable product catalog</caption>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 120 }}>SKU</th>
                  <th className="ax-table__th" scope="col">Product name</th>
                  <th className="ax-table__th" scope="col" style={{ width: 160 }}>Category</th>
                  <th className="ax-table__th ax-table__th--num" scope="col" style={{ width: 120 }}>Price</th>
                  <th className="ax-table__th ax-table__th--num" scope="col" style={{ width: 110 }}>Stock</th>
                  <th className="ax-table__th" scope="col" style={{ width: 140 }}>Status</th>
                  <th className="ax-table__th" scope="col" style={{ width: 56 }}><span className="ax-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isEditing = (f: Field) => editing.id === r.id && editing.field === f;
                  return (
                    <tr key={r.id} className="ax-table__row" style={isDirty(r) ? { boxShadow: 'inset 2px 0 0 var(--ax-accent)', background: 'var(--ax-accent-wash)' } : undefined}>
                      <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{r.sku}</td>

                      <td className="ax-table__td" style={{ cursor: 'text' }} onClick={() => edit(r, 'name')}>
                        {isEditing('name') ? (
                          <input type="text" className="ax-input ax-input--sm" value={String(editing.value)} onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(r); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } }} onBlur={() => commit(r)} ref={(el) => { editInputRef.current = el; }} aria-label="Edit name" />
                        ) : (
                          <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.name || 'Untitled product'}{dirtyCell(r, 'name') && <DirtyDot />}</span>
                        )}
                      </td>

                      <td className="ax-table__td" style={{ cursor: 'pointer' }} onClick={() => edit(r, 'category')}>
                        {isEditing('category') ? (
                          <select className="ax-select ax-select--sm" value={String(editing.value)} onChange={(e) => { setEditing((s) => ({ ...s, value: e.target.value })); }} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }} onBlur={() => commit(r)} ref={(el) => { editInputRef.current = el; }} aria-label="Edit category">
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--ax-text)' }}>{r.category}{dirtyCell(r, 'category') && <DirtyDot />}</span>
                        )}
                      </td>

                      <td className="ax-table__td ax-table__td--num" style={{ cursor: 'text' }} onClick={() => edit(r, 'price')}>
                        {isEditing('price') ? (
                          <input type="number" step="0.01" min="0" className="ax-input ax-input--sm" style={{ textAlign: 'end' }} value={String(editing.value)} onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(r); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } }} onBlur={() => commit(r)} ref={(el) => { editInputRef.current = el; }} aria-label="Edit price" />
                        ) : (
                          <span style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>${Number(r.price).toFixed(2)}{dirtyCell(r, 'price') && <DirtyDot />}</span>
                        )}
                      </td>

                      <td className="ax-table__td ax-table__td--num" style={{ cursor: 'text' }} onClick={() => edit(r, 'stock')}>
                        {isEditing('stock') ? (
                          <input type="number" step="1" min="0" className="ax-input ax-input--sm" style={{ textAlign: 'end' }} value={String(editing.value)} onChange={(e) => setEditing((s) => ({ ...s, value: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(r); } if (e.key === 'Escape') { e.preventDefault(); cancel(); } }} onBlur={() => commit(r)} ref={(el) => { editInputRef.current = el; }} aria-label="Edit stock" />
                        ) : (
                          <span style={Number(r.stock) === 0 ? { color: 'var(--ax-danger-500)' } : { color: 'var(--ax-text)' }}>{r.stock}{dirtyCell(r, 'stock') && <DirtyDot />}</span>
                        )}
                      </td>

                      <td className="ax-table__td" style={{ cursor: 'pointer' }} onClick={() => edit(r, 'status')}>
                        {isEditing('status') ? (
                          <select className="ax-select ax-select--sm" value={String(editing.value)} onChange={(e) => { setEditing((s) => ({ ...s, value: e.target.value })); }} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } }} onBlur={() => commit(r)} ref={(el) => { editInputRef.current = el; }} aria-label="Edit status">
                            <option value="active">Active</option>
                            <option value="draft">Draft</option>
                            <option value="out_of_stock">Out of stock</option>
                          </select>
                        ) : (
                          <span><span className={`ax-badge ax-badge--soft ${statusClass(r.status)}`}>{statusLabel(r.status)}</span>{dirtyCell(r, 'status') && <DirtyDot />}</span>
                        )}
                      </td>

                      <td className="ax-table__td">
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }} onClick={() => removeRow(r)} aria-label={`Delete ${r.name || 'row'}`}>
                          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!rows.length && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>Nothing here yet</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>When there&apos;s a product, it&apos;ll show up in this table.</p>
              <button type="button" className="ax-btn ax-btn--primary" onClick={addRow}>Add the first row</button>
            </div>
          )}

          <div className="ax-card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <span className="ax-cluster ax-text-subtle" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)' }}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
              Press <kbd className="ax-kbd">Enter</kbd> to save a cell, <kbd className="ax-kbd">Esc</kbd> to cancel.
            </span>
            {count > 0 && (
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>{count} pending</span>
            )}
          </div>
        </section>
      </div>

      <style>{`.ax-dirty-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ax-accent);margin-inline-start:6px;vertical-align:middle;}`}</style>
    </>
  );
}

export default Editable;
