'use client';
/*
 * Vireo Next.js — NFT · Marketplace.
 * Faithful re-expression of src/html/nft/marketplace.html: a sticky filter rail
 * (status chips, price range, category checkboxes, chain select, verified
 * toggle), a search/sort/density toolbar, a responsive tile grid with favorite
 * toggles + auction timers, an empty state and a load-more button. The Alpine
 * axMarketplace() store is rebuilt as React state. Page-scoped tile CSS is
 * reproduced verbatim. Classes / ARIA match the reference 1:1.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)', accent: 'var(--ax-accent)' };

const STATUSES = [
  { id: 'buy', label: 'Buy now' },
  { id: 'auction', label: 'On auction' },
  { id: 'new', label: 'New' },
];
const CATEGORIES = [
  { id: 'art', label: 'Art', count: 2840 },
  { id: 'collectibles', label: 'Collectibles', count: 1920 },
  { id: 'gaming', label: 'Gaming', count: 1460 },
  { id: 'photography', label: 'Photography', count: 980 },
  { id: 'music', label: 'Music', count: 720 },
  { id: 'generative', label: 'Generative', count: 500 },
];

interface Item {
  id: number; title: string; collection: string; creator: string; cat: string; sale: string;
  price: number; likes: number; fav: boolean; verified: boolean; chain: string; new: boolean;
  ends: string; c1: string; c2: string; angle: number; age: number;
}
const ITEMS: Item[] = [
  { id: 1, title: 'Quiet Forms #001', collection: 'Quiet Forms', creator: 'Mira Aoki', cat: 'generative', sale: 'auction', price: 2.40, likes: 184, fav: false, verified: true, chain: 'eth', new: true, ends: '06:12:40', c1: C.violet, c2: C.cyan, angle: 135, age: 1 },
  { id: 2, title: 'Porcelain #014', collection: 'Quiet Surface', creator: 'Helio Studio', cat: 'art', sale: 'buy', price: 1.85, likes: 142, fav: true, verified: true, chain: 'eth', new: false, ends: '', c1: C.cyan, c2: C.emerald, angle: 120, age: 2 },
  { id: 3, title: 'Neon Drifter #218', collection: 'Pixel Nomads', creator: 'Vortex Labs', cat: 'gaming', sale: 'auction', price: 3.80, likes: 309, fav: false, verified: true, chain: 'eth', new: false, ends: '00:42:18', c1: C.pink, c2: C.amber, angle: 150, age: 4 },
  { id: 4, title: 'Solar Beast #088', collection: 'Solar Beasts', creator: 'Kojima.eth', cat: 'collectibles', sale: 'buy', price: 0.92, likes: 96, fav: false, verified: false, chain: 'poly', new: true, ends: '', c1: C.amber, c2: C.pink, angle: 165, age: 1 },
  { id: 5, title: 'Chrome Spirit #44', collection: 'Chrome Spirits', creator: 'Nova Reyes', cat: 'art', sale: 'auction', price: 2.10, likes: 221, fav: false, verified: true, chain: 'eth', new: false, ends: '01:14:05', c1: C.emerald, c2: C.cyan, angle: 140, age: 5 },
  { id: 6, title: 'Glyph Engine #07', collection: 'Echo Wardens', creator: 'Helio Studio', cat: 'generative', sale: 'buy', price: 5.40, likes: 412, fav: true, verified: true, chain: 'eth', new: false, ends: '', c1: C.cyan, c2: C.violet, angle: 130, age: 7 },
  { id: 7, title: 'Bone Field #102', collection: 'Quiet Surface', creator: 'Mira Aoki', cat: 'photography', sale: 'buy', price: 1.10, likes: 78, fav: false, verified: true, chain: 'sol', new: false, ends: '', c1: C.violet, c2: C.pink, angle: 155, age: 6 },
  { id: 8, title: 'Iron Bloom #99', collection: 'Solar Beasts', creator: 'Kojima.eth', cat: 'collectibles', sale: 'auction', price: 1.70, likes: 133, fav: false, verified: false, chain: 'poly', new: false, ends: '02:31:40', c1: C.amber, c2: C.violet, angle: 125, age: 8 },
  { id: 9, title: 'Pastel Voyage #12', collection: 'Aurora Genesis', creator: 'Vortex Labs', cat: 'art', sale: 'buy', price: 4.20, likes: 268, fav: false, verified: true, chain: 'eth', new: true, ends: '', c1: C.pink, c2: C.cyan, angle: 145, age: 1 },
  { id: 10, title: 'Echo Warden #1201', collection: 'Echo Wardens', creator: 'Nova Reyes', cat: 'gaming', sale: 'buy', price: 1.20, likes: 54, fav: false, verified: true, chain: 'eth', new: false, ends: '', c1: C.cyan, c2: C.amber, angle: 160, age: 9 },
  { id: 11, title: 'Soft Static #03', collection: 'Quiet Forms', creator: 'Mira Aoki', cat: 'music', sale: 'auction', price: 0.85, likes: 41, fav: false, verified: true, chain: 'sol', new: false, ends: '00:08:22', c1: C.emerald, c2: C.violet, angle: 135, age: 10 },
  { id: 12, title: 'Marble Ghost #56', collection: 'Chrome Spirits', creator: 'Helio Studio', cat: 'collectibles', sale: 'buy', price: 6.80, likes: 520, fav: true, verified: true, chain: 'eth', new: false, ends: '', c1: C.violet, c2: C.emerald, angle: 128, age: 11 },
];

const TILE_CSS = `
.ax-nft-tile__cta { position:absolute; inset-inline:var(--ax-space-3); bottom:var(--ax-space-3); opacity:0; transform:translateY(6px); transition:opacity var(--ax-motion-fast) var(--ax-ease-standard), transform var(--ax-motion-fast) var(--ax-ease-standard); }
.ax-nft-tile:hover .ax-nft-tile__cta { opacity:1; transform:translateY(0); }
.ax-nft-fav { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:0; border-radius:var(--ax-radius-pill); background:rgba(8,10,15,.42); cursor:pointer; backdrop-filter:blur(6px); transition:background var(--ax-motion-fast); }
.ax-nft-fav svg { width:16px; height:16px; }
.ax-nft-fav:hover { background:rgba(8,10,15,.6); }
@media (prefers-reduced-motion: reduce){ .ax-nft-tile__cta { transition:none; } }`;

const VERIFIED_BADGE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ax-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Verified" style={{ width: 14, height: 14, flex: 'none' }}><path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7c.412 .41 .97 .64 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1c0 .58 .23 1.138 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" /><path d="M9 12l2 2l4 -4" /></svg>
);

const num = (v: string) => { const n = parseFloat(v.replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };

export function Marketplace() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [fStatus, setFStatus] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [fCats, setFCats] = useState<string[]>([]);
  const [fChain, setFChain] = useState('');
  const [fVerified, setFVerified] = useState(false);
  const [favs, setFavs] = useState<Record<number, boolean>>(() => Object.fromEntries(ITEMS.map((n) => [n.id, n.fav])));

  const resetFilters = () => { setFStatus(''); setPriceMin(''); setPriceMax(''); setFCats([]); setFChain(''); setFVerified(false); };

  const filtered = useMemo(() => {
    let r = ITEMS.filter((n) => {
      const term = q.trim().toLowerCase();
      if (term && !(n.title.toLowerCase().includes(term) || n.collection.toLowerCase().includes(term) || n.creator.toLowerCase().includes(term))) return false;
      if (fStatus === 'buy' && n.sale !== 'buy') return false;
      if (fStatus === 'auction' && n.sale !== 'auction') return false;
      if (fStatus === 'new' && !n.new) return false;
      if (fCats.length && !fCats.includes(n.cat)) return false;
      if (fChain && n.chain !== fChain) return false;
      if (fVerified && !n.verified) return false;
      const lo = num(priceMin), hi = num(priceMax);
      if (lo !== null && n.price < lo) return false;
      if (hi !== null && n.price > hi) return false;
      return true;
    });
    const by: Record<string, (a: Item, b: Item) => number> = {
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      likes: (a, b) => b.likes - a.likes,
      recent: (a, b) => a.age - b.age,
      ending: (a, b) => ((a.ends ? 1 : 2) - (b.ends ? 1 : 2)) || a.ends.localeCompare(b.ends),
    };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [q, sort, fStatus, priceMin, priceMax, fCats, fChain, fVerified]);

  const toggleCat = (id: string, checked: boolean) =>
    setFCats((c) => (checked ? [...c, id] : c.filter((x) => x !== id)));

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TILE_CSS }} />
      <PageHead
        title="Marketplace"
        subtitle={(<>Browse <span className="ax-num">8,420</span> items across <span className="ax-num">36</span> collections — floor up <span className="ax-num">6.2%</span> today.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg>
              <span className="ax-btn__label">0.000 ETH</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/nft/create-nft">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /><path d="M10 12l-2 -2.2l.6 -1" /></svg>
              <span className="ax-btn__label">Create NFT</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid" style={{ alignItems: 'start' }}>
        {/* FILTER RAIL */}
        <aside className="ax-card ax-col--3" role="region" aria-label="Filters" style={{ position: 'sticky', top: 'var(--ax-space-6)' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Filters</h2></div>
            <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={resetFilters}>Reset</button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Status</div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                {STATUSES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setFStatus(fStatus === s.id ? '' : s.id)}
                    className={`ax-badge ax-badge--pill ${fStatus === s.id ? 'ax-badge--accent ax-badge--solid' : 'ax-badge--neutral ax-badge--soft'}`}
                    style={{ cursor: 'pointer', border: 0 }} aria-pressed={fStatus === s.id}>{s.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span className="ax-label" style={{ margin: 0 }}>Price range (ETH)</span>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                <input type="text" className="ax-input ax-input--sm ax-num" inputMode="decimal" placeholder="Min" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} aria-label="Minimum price" />
                <span style={{ color: 'var(--ax-text-subtle)' }}>–</span>
                <input type="text" className="ax-input ax-input--sm ax-num" inputMode="decimal" placeholder="Max" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)' }} aria-label="Maximum price" />
              </div>
            </div>

            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Category</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                {CATEGORIES.map((c) => (
                  <label key={c.id} className="ax-check" style={{ gap: 'var(--ax-space-2)', minHeight: 30, justifyContent: 'space-between' }}>
                    <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><input type="checkbox" className="ax-checkbox" value={c.id} checked={fCats.includes(c.id)} onChange={(e) => toggleCat(c.id, e.target.checked)} /><span style={{ fontSize: 'var(--ax-text-sm)' }}>{c.label}</span></span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.count}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Chain</div>
              <select className="ax-select ax-select--sm" value={fChain} onChange={(e) => setFChain(e.target.value)} aria-label="Filter by chain">
                <option value="">All chains</option>
                <option value="eth">Ethereum</option>
                <option value="sol">Solana</option>
                <option value="poly">Polygon</option>
              </select>
            </div>

            <label className="ax-check" style={{ gap: 'var(--ax-space-3)' }}>
              <input type="checkbox" className="ax-switch" checked={fVerified} onChange={(e) => setFVerified(e.target.checked)} />
              <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>Verified only</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Hide unverified creators</span></span>
            </label>
          </div>
        </aside>

        {/* GRID */}
        <div className="ax-col--9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
          {/* toolbar */}
          <section className="ax-card" role="region" aria-label="Search and sort">
            <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input" placeholder="Search items, collections, creators…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingInlineStart: 36 }} aria-label="Search marketplace" />
              </div>
              <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort items" style={{ minWidth: 160 }}>
                <option value="recent">Recently listed</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="ending">Ending soon</option>
                <option value="likes">Most liked</option>
              </select>
              <div className="ax-segment" role="group" aria-label="Grid density">
                <button type="button" className={`ax-segment__option${density === 'comfortable' ? ' is-active' : ''}`} aria-pressed={density === 'comfortable'} onClick={() => setDensity('comfortable')} aria-label="Comfortable density">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg>
                </button>
                <button type="button" className={`ax-segment__option${density === 'compact' ? ' is-active' : ''}`} aria-pressed={density === 'compact'} onClick={() => setDensity('compact')} aria-label="Compact density">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h4v4h-4z" /><path d="M10 4h4v4h-4z" /><path d="M16 4h4v4h-4z" /><path d="M4 10h4v4h-4z" /><path d="M10 10h4v4h-4z" /><path d="M16 10h4v4h-4z" /><path d="M4 16h4v4h-4z" /><path d="M10 16h4v4h-4z" /><path d="M16 16h4v4h-4z" /></svg>
                </button>
              </div>
            </div>
          </section>

          {/* result count + active chips */}
          <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}><b style={{ color: 'var(--ax-text-strong)' }}>{filtered.length}</b> items</span>
            {(fCats.length > 0 || fStatus || fChain || fVerified) && (
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                {fCats.map((c) => (
                  <span key={c} className="ax-badge ax-badge--accent ax-badge--soft ax-badge--pill" style={{ gap: 4 }}><span>{CATEGORIES.find((x) => x.id === c)?.label}</span><button type="button" onClick={() => setFCats((p) => p.filter((x) => x !== c))} aria-label="Remove category filter" style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', display: 'inline-flex' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 11, height: 11 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
                ))}
              </div>
            )}
          </div>

          {/* TILE GRID */}
          {filtered.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${density === 'compact' ? '180px' : '230px'},1fr))`, gap: 'var(--ax-space-4)' }}>
              {filtered.map((n) => {
                const fav = favs[n.id];
                return (
                  <article key={n.id} className="ax-card ax-card--interactive ax-nft-tile" style={{ margin: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Link href="/nft/nft-details" className="ax-nft-tile__media" style={{ aspectRatio: '1/1', display: 'block', position: 'relative', background: `linear-gradient(${n.angle}deg, color-mix(in oklab,${n.c1} 78%,var(--ax-surface-solid)), color-mix(in oklab,${n.c2} 60%,var(--ax-surface-solid)))` }} aria-label={'View ' + n.title}>
                      {n.sale === 'auction' && (
                        <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--pill ax-num ax-nft-tile__timer" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineStart: 'var(--ax-space-3)', fontFamily: 'var(--ax-font-mono)', backdropFilter: 'blur(6px)' }}><svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg><span>{n.ends}</span></span>
                      )}
                      <button type="button" className={`ax-nft-fav${fav ? ' is-fav' : ''}`} onClick={(e) => { e.preventDefault(); setFavs((s) => ({ ...s, [n.id]: !s[n.id] })); }} aria-pressed={fav} aria-label={fav ? 'Unfavorite' : 'Favorite'} style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineEnd: 'var(--ax-space-3)' }}>
                        <svg viewBox="0 0 24 24" fill={fav ? 'var(--ax-accent)' : 'none'} stroke={fav ? 'var(--ax-accent)' : '#fff'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
                      </button>
                      <span className="ax-nft-tile__cta">
                        <span className="ax-btn ax-btn--primary ax-btn--sm ax-btn--block" style={{ pointerEvents: 'none' }}>{n.sale === 'auction' ? 'Place bid' : 'Buy now'}</span>
                      </span>
                    </Link>
                    <div className="ax-card__body" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)', flex: '1 1 auto' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--xs" style={{ background: `linear-gradient(135deg,${n.c1},${n.c2})`, flex: 'none' }} aria-label={'Creator ' + n.creator} />
                        <span className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', flex: '1 1 auto', minWidth: 0 }}>{n.collection}</span>
                        {n.verified && VERIFIED_BADGE}
                      </div>
                      <Link href="/nft/nft-details" className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', textDecoration: 'none' }}>{n.title}</Link>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'auto', paddingTop: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)' }}>{n.sale === 'auction' ? 'Current bid' : 'Price'}</span>
                          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{n.price.toFixed(2)} ETH</span>
                        </span>
                        <span className="ax-cluster" style={{ gap: 4, color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>
                          <svg viewBox="0 0 24 24" fill={fav ? 'var(--ax-accent)' : 'none'} stroke={fav ? 'var(--ax-accent)' : 'currentColor'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
                          <span className="ax-num">{fav ? n.likes + 1 : n.likes}</span>
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* empty state */}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg></span>
              <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>Nothing listed yet</h3>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginBottom: 'var(--ax-space-4)' }}>No items match these filters. Try widening your search or create your own.</p>
              <button type="button" className="ax-btn ax-btn--secondary" onClick={() => { resetFilters(); setQ(''); }}>Clear filters</button>
            </div>
          )}

          {/* load more */}
          {filtered.length > 0 && (
            <div className="ax-flex" style={{ justifyContent: 'center', paddingTop: 'var(--ax-space-2)' }}>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
                <span className="ax-btn__label">Load more</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Marketplace;
