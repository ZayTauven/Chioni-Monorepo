'use client';
/*
 * Vireo Next.js — Ecommerce / Products (route "ecommerce/products").
 *
 * Faithful re-expression of src/html/ecommerce/products.html: a sticky filter
 * rail (category tree, price range, availability, rating) over a searchable,
 * sortable product catalogue rendered as a grid or list with bulk-select,
 * active-filter chips, empty state and pagination. The Alpine x-data
 * (axProducts) is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Category { id: string; name: string; count: number; }
interface Product {
  id: number; name: string; cat: string; category: string; price: number; compareAt: number;
  discount: number; stock: number; sales: number; rating: number; reviews: number; sku: string;
  color: string; ribbon: string; new: boolean;
}

const CATEGORIES: Category[] = [
  { id: 'lighting', name: 'Lighting', count: 34 },
  { id: 'desk', name: 'Desk', count: 52 },
  { id: 'drinkware', name: 'Drinkware', count: 28 },
  { id: 'storage', name: 'Storage', count: 19 },
  { id: 'stationery', name: 'Stationery', count: 46 },
  { id: 'tech', name: 'Tech accessories', count: 38 },
  { id: 'decor', name: 'Decor', count: 31 },
];

const PRODUCTS: Product[] = [
  { id: 1, name: 'Aperture Desk Lamp', cat: 'lighting', category: 'Lighting', price: 129, compareAt: 159, discount: 19, stock: 84, sales: 412, rating: 4.7, reviews: 128, sku: 'APG-0001', color: '#38BDF8', ribbon: '', new: true },
  { id: 2, name: 'Brass Task Light', cat: 'lighting', category: 'Lighting', price: 182, compareAt: 0, discount: 0, stock: 22, sales: 356, rating: 4.9, reviews: 204, sku: 'APG-0008', color: '#A78BFA', ribbon: 'Bestseller', new: false },
  { id: 3, name: 'Matte Ceramic Mug', cat: 'drinkware', category: 'Drinkware', price: 24, compareAt: 0, discount: 0, stock: 312, sales: 298, rating: 4.8, reviews: 341, sku: 'APG-0003', color: '#F472B6', ribbon: '', new: false },
  { id: 4, name: 'Walnut Monitor Riser', cat: 'desk', category: 'Desk', price: 96, compareAt: 120, discount: 20, stock: 41, sales: 241, rating: 4.6, reviews: 96, sku: 'APG-0004', color: '#FBBF24', ribbon: '', new: false },
  { id: 5, name: 'Felt Laptop Sleeve 14"', cat: 'tech', category: 'Tech accessories', price: 44, compareAt: 0, discount: 0, stock: 158, sales: 187, rating: 4.5, reviews: 73, sku: 'APG-0005', color: '#34D399', ribbon: 'New', new: true },
  { id: 6, name: 'Grid Notebook A5', cat: 'stationery', category: 'Stationery', price: 16, compareAt: 0, discount: 0, stock: 540, sales: 622, rating: 4.7, reviews: 415, sku: 'APG-0006', color: '#FB7185', ribbon: 'Bestseller', new: false },
  { id: 7, name: 'Cork Desk Mat', cat: 'desk', category: 'Desk', price: 38, compareAt: 0, discount: 0, stock: 0, sales: 142, rating: 4.3, reviews: 54, sku: 'APG-0007', color: '#38BDF8', ribbon: '', new: false },
  { id: 8, name: 'Stoneware Carafe', cat: 'drinkware', category: 'Drinkware', price: 52, compareAt: 64, discount: 19, stock: 120, sales: 176, rating: 4.5, reviews: 88, sku: 'APG-0009', color: '#F472B6', ribbon: '', new: false },
  { id: 9, name: 'Linen Pinboard', cat: 'storage', category: 'Storage', price: 58, compareAt: 0, discount: 0, stock: 0, sales: 91, rating: 4.4, reviews: 37, sku: 'APG-0002', color: '#A78BFA', ribbon: '', new: false },
  { id: 10, name: 'Oak Pen Tray', cat: 'decor', category: 'Decor', price: 28, compareAt: 35, discount: 20, stock: 204, sales: 133, rating: 4.6, reviews: 61, sku: 'APG-0010', color: '#FBBF24', ribbon: '', new: false },
  { id: 11, name: 'Anodized Bottle 750ml', cat: 'drinkware', category: 'Drinkware', price: 34, compareAt: 0, discount: 0, stock: 9, sales: 209, rating: 4.6, reviews: 112, sku: 'APG-0011', color: '#34D399', ribbon: '', new: false },
  { id: 12, name: 'Leather Cable Wrap', cat: 'tech', category: 'Tech accessories', price: 18, compareAt: 0, discount: 0, stock: 330, sales: 158, rating: 4.4, reviews: 45, sku: 'APG-0012', color: '#FB7185', ribbon: '', new: false },
];

const money = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STAR = (
  <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245" />
);
const X_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);
const PRODUCT_GLYPH = (
  <><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></>
);

function StockBadge({ stock }: { stock: number }): ReactElement {
  if (stock === 0) {
    return (
      <span className="ax-badge ax-badge--danger ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M5.7 5.7l12.6 12.6" /></svg>Out of stock
      </span>
    );
  }
  if (stock <= 10) {
    return (
      <span className="ax-badge ax-badge--warning ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg>{stock} left
      </span>
    );
  }
  return (
    <span className="ax-badge ax-badge--success ax-badge--soft" style={{ borderRadius: 'var(--ax-radius-xs)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M5 12l5 5l10 -10" /></svg>In stock
    </span>
  );
}

export function Products() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('featured');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<number[]>([]);
  const [fCategory, setFCategory] = useState('');
  const [fMaxPrice, setFMaxPrice] = useState(250);
  const [fInStock, setFInStock] = useState(false);
  const [fLowStock, setFLowStock] = useState(false);
  const [fOnSale, setFOnSale] = useState(false);
  const [fRating, setFRating] = useState(0);

  const filtersActive = !!fCategory || fInStock || fLowStock || fOnSale || !!fRating || fMaxPrice < 250;
  const categoryName = (id: string) => CATEGORIES.find((x) => x.id === id)?.name ?? '';
  const resetFilters = () => { setFCategory(''); setFMaxPrice(250); setFInStock(false); setFLowStock(false); setFOnSale(false); setFRating(0); };

  const filtered = useMemo(() => {
    let r = PRODUCTS.filter((p) => {
      const term = q.trim().toLowerCase();
      if (term && !(p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))) return false;
      if (fCategory && p.cat !== fCategory) return false;
      if (p.price > fMaxPrice) return false;
      if (fInStock && p.stock === 0) return false;
      if (fLowStock && !(p.stock > 0 && p.stock <= 10)) return false;
      if (fOnSale && !p.compareAt) return false;
      if (fRating && p.rating < fRating) return false;
      return true;
    });
    const by: Record<string, (a: Product, b: Product) => number> = {
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      best: (a, b) => b.sales - a.sales,
      rating: (a, b) => b.rating - a.rating,
      az: (a, b) => a.name.localeCompare(b.name),
      newest: (a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0),
    };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [q, sort, fCategory, fMaxPrice, fInStock, fLowStock, fOnSale, fRating]);

  const allSelected = () => { const ids = filtered.map((p) => p.id); return ids.length > 0 && ids.every((id) => selected.includes(id)); };
  const toggleAll = (on: boolean) => setSelected(on ? filtered.map((p) => p.id) : []);
  const toggleSel = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHead
        title="Products"
        subtitle={
          (
            <>
              <span className="ax-num">248</span> products in catalog — <span className="ax-num">12</span> low on stock, <span className="ax-num">2</span> out of stock.
            </>
          ) as unknown as string
        }
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Export</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/ecommerce/add-product">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add product</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* FILTER RAIL */}
        <aside className="ax-card ax-col--3" role="region" aria-label="Filters" style={{ alignSelf: 'start', position: 'sticky', top: 'var(--ax-space-5)' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Filters</h2></div>
            {filtersActive && <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={resetFilters}>Clear all</button>}
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Category</div>
              <ul className="ax-list ax-list--compact" style={{ gap: 2 }}>
                {CATEGORIES.map((c) => (
                  <li key={c.id} className="ax-list__row" style={{ border: 0, padding: '6px var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', ...(fCategory === c.id ? { background: 'var(--ax-accent-wash)' } : {}) }} onClick={() => setFCategory(fCategory === c.id ? '' : c.id)}>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)', color: fCategory === c.id ? 'var(--ax-accent)' : 'var(--ax-text)' }}>{c.name}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <span className="ax-label">Price</span>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>$0 – ${fMaxPrice}</span>
              </div>
              <div className="ax-range">
                <div className="ax-range__track"><div className="ax-range__fill" style={{ width: `${(fMaxPrice / 250) * 100}%` }} /></div>
              </div>
              <input type="range" className="ax-range--native" min={0} max={250} step={2} value={fMaxPrice} onChange={(e) => setFMaxPrice(Number(e.target.value))} style={{ width: '100%', marginTop: 'var(--ax-space-3)' }} aria-label="Maximum price" />
            </div>

            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />

            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Availability</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <label className="ax-check"><input type="checkbox" className="ax-checkbox" checked={fInStock} onChange={(e) => setFInStock(e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>In stock</span></label>
                <label className="ax-check"><input type="checkbox" className="ax-checkbox" checked={fLowStock} onChange={(e) => setFLowStock(e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>Low stock</span></label>
                <label className="ax-check"><input type="checkbox" className="ax-checkbox" checked={fOnSale} onChange={(e) => setFOnSale(e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>On sale</span></label>
              </div>
            </div>

            <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />

            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Rating</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                {[4, 3, 2].map((r) => (
                  <label key={r} className="ax-check" style={{ minHeight: 32 }}>
                    <input type="radio" name="rating" className="ax-radio" value={r} checked={fRating === r} onChange={() => setFRating(r)} />
                    <span className="ax-rating ax-rating--sm" aria-hidden="true">{[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} className={`ax-rating__star${s <= r ? ' ax-rating__star--full' : ''}`} viewBox="0 0 24 24" fill={s <= r ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>
                    ))}</span>
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>&amp; up</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RESULTS */}
        <section className="ax-card ax-col--9" role="region" aria-label="Product results">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search products" />
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products" style={{ minWidth: 150 }}>
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="best">Best-selling</option>
                <option value="rating">Top-rated</option>
                <option value="az">Name: A–Z</option>
              </select>
              <div className="ax-segment" role="group" aria-label="View mode">
                <button type="button" className="ax-segment__option" aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
                </button>
                <button type="button" className="ax-segment__option" aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label="List view">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* active filter chips */}
          {filtersActive && (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: '0 var(--ax-space-5) var(--ax-space-3)', flexWrap: 'wrap' }}>
              {fCategory && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill"><span>{categoryName(fCategory)}</span><button type="button" className="ax-badge__remove" aria-label="Clear category filter" onClick={() => setFCategory('')}>{X_ICON}</button></span>}
              {fInStock && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill">In stock<button type="button" className="ax-badge__remove" aria-label="Clear in stock filter" onClick={() => setFInStock(false)}>{X_ICON}</button></span>}
              {fOnSale && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill">On sale<button type="button" className="ax-badge__remove" aria-label="Clear on sale filter" onClick={() => setFOnSale(false)}>{X_ICON}</button></span>}
              {!!fRating && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill"><span className="ax-num">{fRating}</span>+ stars<button type="button" className="ax-badge__remove" aria-label="Clear rating filter" onClick={() => setFRating(0)}>{X_ICON}</button></span>}
            </div>
          )}

          {/* bulk bar */}
          {!!selected.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', margin: '0 var(--ax-space-5) var(--ax-space-3)', padding: 'var(--ax-space-2) var(--ax-space-4)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', borderRadius: 'var(--ax-radius-md)' }}>
              <b className="ax-num" style={{ color: 'var(--ax-accent)', fontSize: 'var(--ax-text-sm)' }}><span>{selected.length}</span> selected</b>
              <span style={{ width: 1, height: 18, background: 'var(--ax-border-strong)' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Set status</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Set category</button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}>Delete</button>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          )}

          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {/* GRID VIEW */}
            {view === 'grid' && (
              <div className="ax-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 'var(--ax-space-4)' }}>
                {filtered.map((p) => (
                  <article key={p.id} className="ax-card ax-card--interactive" style={{ margin: 0, ...(selected.includes(p.id) ? { borderColor: 'var(--ax-accent)', boxShadow: '0 0 0 1px var(--ax-accent)' } : {}) }}>
                    <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) 0 0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab,${p.color} 16%,var(--ax-surface-subtle))` }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 46, height: 46, opacity: 0.55, color: p.color }}>{PRODUCT_GLYPH}</svg>
                      {!!p.compareAt && <span className="ax-badge ax-badge--danger ax-badge--solid" style={{ position: 'absolute', top: 8, insetInlineStart: 8, borderRadius: 'var(--ax-radius-xs)' }}>{'-' + p.discount + '%'}</span>}
                      {p.ribbon && <span className="ax-badge ax-badge--accent ax-badge--solid" style={{ position: 'absolute', top: 8, insetInlineStart: 8, borderRadius: 'var(--ax-radius-xs)' }}>{p.ribbon}</span>}
                      <input type="checkbox" className="ax-checkbox" checked={selected.includes(p.id)} onChange={() => toggleSel(p.id)} style={{ position: 'absolute', top: 8, insetInlineEnd: 8 }} aria-label={'Select ' + p.name} />
                      {p.stock === 0 && <div className="ax-flex" style={{ position: 'absolute', inset: 0, background: 'color-mix(in oklab,var(--ax-canvas) 55%,transparent)', alignItems: 'center', justifyContent: 'center' }}><span className="ax-badge ax-badge--neutral ax-badge--soft">Out of stock</span></div>}
                    </div>
                    <div style={{ padding: 'var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', fontWeight: 'var(--ax-weight-medium)' }}>{p.category}</span>
                      <Link href="/ecommerce/product-details" className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', textDecoration: 'none', lineHeight: 1.35 }}>{p.name}</Link>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <span className="ax-rating ax-rating--sm" aria-label={p.rating + ' out of 5'}>{[1, 2, 3, 4, 5].map((s) => (
                          <svg key={s} className={`ax-rating__star${s <= Math.round(p.rating) ? ' ax-rating__star--full' : ''}`} viewBox="0 0 24 24" fill={s <= Math.round(p.rating) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">{STAR}</svg>
                        ))}</span>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{'(' + p.reviews + ')'}</span>
                      </div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 2 }}>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>{money(p.price)}</span>
                        {!!p.compareAt && <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', textDecoration: 'line-through' }}>{money(p.compareAt)}</span>}
                      </div>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
                        <StockBadge stock={p.stock} />
                        <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--sm" disabled={p.stock === 0} aria-label={'Add ' + p.name + ' to cart'}>
                          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* LIST VIEW */}
            {view === 'list' && (
              <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-5))' }}>
                <table className="ax-table ax-table--hover">
                  <thead className="ax-table__head">
                    <tr>
                      <th className="ax-table__th" scope="col" style={{ width: 38 }}><input type="checkbox" className="ax-checkbox" aria-label="Select all" checked={allSelected()} onChange={(e) => toggleAll(e.target.checked)} /></th>
                      <th className="ax-table__th" scope="col">Product</th>
                      <th className="ax-table__th" scope="col">Category</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Price</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Stock</th>
                      <th className="ax-table__th ax-table__th--num" scope="col">Sales</th>
                      <th className="ax-table__th" scope="col">Status</th>
                      <th className="ax-table__th" scope="col" style={{ width: 44 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="ax-table__row" style={selected.includes(p.id) ? { background: 'var(--ax-accent-wash)' } : undefined}>
                        <td className="ax-table__td"><input type="checkbox" className="ax-checkbox" checked={selected.includes(p.id)} onChange={() => toggleSel(p.id)} aria-label={'Select ' + p.name} /></td>
                        <td className="ax-table__td">
                          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                            <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.color} 18%,transparent)`, color: p.color }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg></span>
                            <div style={{ minWidth: 0 }}>
                              <Link href="/ecommerce/product-details" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{p.name}</Link>
                              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{p.category}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{money(p.price)}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: p.stock === 0 ? 'var(--ax-danger-500)' : p.stock <= 10 ? 'var(--ax-warning-500)' : 'var(--ax-text-muted)' }}>{p.stock}</td>
                        <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{p.sales}</td>
                        <td className="ax-table__td"><StockBadge stock={p.stock} /></td>
                        <td className="ax-table__td">
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={'Actions for ' + p.name}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* empty state */}
            {!filtered.length && (
              <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
                <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No products match your filters</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>Try widening your price range or clearing some filters.</p>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={resetFilters}>Clear all filters</button>
              </div>
            )}
          </div>

          {/* footer / pagination */}
          {!!filtered.length && (
            <div className="ax-card__footer ax-flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing <span>{filtered.length}</span> of 248 products</span>
              <nav className="ax-pagination" aria-label="Pagination">
                <button type="button" className="ax-pagination__prev" disabled aria-disabled="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
                <ul className="ax-pagination__pages">
                  <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                  <li><a href="#" className="ax-pagination__page">2</a></li>
                  <li><a href="#" className="ax-pagination__page">3</a></li>
                  <li><span className="ax-pagination__ellipsis">…</span></li>
                  <li><a href="#" className="ax-pagination__page">14</a></li>
                </ul>
                <button type="button" className="ax-pagination__next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
              </nav>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default Products;
