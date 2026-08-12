'use client';
/*
 * Vireo Next.js — Gallery app (apps/gallery).
 * Faithful re-expression of src/html/apps/gallery.html: album tabs, sort menu,
 * masonry/grid toggle, select mode + bulk bar, and a keyboard-driven lightbox
 * with filmstrip. Alpine axGallery() → React useState + window key effects.
 */
import { useEffect, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Img {
  id: number; title: string; album: string; dim: string; size: string;
  ratio: string; angle: number; c1: string; c2: string; fav: boolean; cat: string;
}

const TABS = [
  { id: 'all', label: 'All', count: 48 },
  { id: 'brand', label: 'Brand', count: 12 },
  { id: 'product', label: 'Product', count: 18 },
  { id: 'lifestyle', label: 'Lifestyle', count: 11 },
  { id: 'events', label: 'Events', count: 7 },
];
const SORTS = ['Newest', 'Oldest', 'Name A–Z', 'Largest'];

const SEED: Img[] = [
  { id: 1, title: 'Aurora keyboard — hero', album: 'Product', dim: '3000×2000', size: '6.7 MB', ratio: '3/2', angle: 135, c1: 'var(--ax-accent)', c2: 'var(--ax-viz-cyan)', fav: true, cat: 'product' },
  { id: 2, title: 'Studio portrait — Maya', album: 'Lifestyle', dim: '2400×3000', size: '5.1 MB', ratio: '4/5', angle: 160, c1: 'var(--ax-viz-violet)', c2: 'var(--ax-viz-pink)', fav: false, cat: 'lifestyle' },
  { id: 3, title: 'Logo lockup on slate', album: 'Brand', dim: '2000×2000', size: '1.8 MB', ratio: '1/1', angle: 120, c1: 'var(--ax-viz-cyan)', c2: 'var(--ax-accent)', fav: false, cat: 'brand' },
  { id: 4, title: 'Launch night — stage', album: 'Events', dim: '3200×1800', size: '8.2 MB', ratio: '16/9', angle: 200, c1: 'var(--ax-viz-amber)', c2: 'var(--ax-viz-pink)', fav: false, cat: 'events' },
  { id: 5, title: 'Desk lamp — top down', album: 'Product', dim: '2400×2400', size: '4.4 MB', ratio: '1/1', angle: 135, c1: 'var(--ax-viz-amber)', c2: 'var(--ax-accent)', fav: true, cat: 'product' },
  { id: 6, title: 'Brand gradient swatch', album: 'Brand', dim: '2560×1440', size: '2.2 MB', ratio: '16/9', angle: 110, c1: 'var(--ax-accent)', c2: 'var(--ax-viz-violet)', fav: false, cat: 'brand' },
  { id: 7, title: 'Ceramic mug set', album: 'Product', dim: '2800×2100', size: '5.9 MB', ratio: '4/3', angle: 150, c1: 'var(--ax-viz-pink)', c2: 'var(--ax-viz-amber)', fav: false, cat: 'product' },
  { id: 8, title: 'Team offsite — Lisbon', album: 'Events', dim: '3000×2000', size: '7.1 MB', ratio: '3/2', angle: 185, c1: 'var(--ax-viz-cyan)', c2: 'var(--ax-viz-emerald)', fav: false, cat: 'events' },
  { id: 9, title: 'Workspace flat-lay', album: 'Lifestyle', dim: '2600×2600', size: '4.8 MB', ratio: '1/1', angle: 140, c1: 'var(--ax-viz-emerald)', c2: 'var(--ax-viz-cyan)', fav: true, cat: 'lifestyle' },
  { id: 10, title: 'Monitor riser — walnut', album: 'Product', dim: '2400×3000', size: '5.5 MB', ratio: '4/5', angle: 130, c1: 'var(--ax-viz-amber)', c2: 'var(--ax-viz-violet)', fav: false, cat: 'product' },
  { id: 11, title: 'Wordmark on white', album: 'Brand', dim: '2400×1200', size: '1.1 MB', ratio: '2/1', angle: 100, c1: 'var(--ax-viz-violet)', c2: 'var(--ax-accent)', fav: false, cat: 'brand' },
  { id: 12, title: 'Coffee & notebook', album: 'Lifestyle', dim: '3000×2000', size: '6.0 MB', ratio: '3/2', angle: 170, c1: 'var(--ax-viz-pink)', c2: 'var(--ax-viz-cyan)', fav: false, cat: 'lifestyle' },
  { id: 13, title: 'Packaging unboxing', album: 'Product', dim: '2800×1575', size: '4.9 MB', ratio: '16/9', angle: 145, c1: 'var(--ax-accent)', c2: 'var(--ax-viz-amber)', fav: false, cat: 'product' },
  { id: 14, title: 'Speaker — keynote close', album: 'Events', dim: '2400×3000', size: '6.3 MB', ratio: '4/5', angle: 210, c1: 'var(--ax-viz-cyan)', c2: 'var(--ax-viz-violet)', fav: true, cat: 'events' },
  { id: 15, title: 'Color study — verdigris', album: 'Brand', dim: '2200×2200', size: '1.6 MB', ratio: '1/1', angle: 125, c1: 'var(--ax-viz-emerald)', c2: 'var(--ax-accent)', fav: false, cat: 'brand' },
  { id: 16, title: 'Morning desk light', album: 'Lifestyle', dim: '3000×1688', size: '5.2 MB', ratio: '16/9', angle: 155, c1: 'var(--ax-viz-amber)', c2: 'var(--ax-viz-pink)', fav: false, cat: 'lifestyle' },
];

export function Gallery() {
  const [layout, setLayout] = useState<'masonry' | 'grid'>('masonry');
  const [album, setAlbum] = useState('all');
  const [sortLabel, setSortLabel] = useState('Newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [images, setImages] = useState<Img[]>(SEED);
  const [lightbox, setLightbox] = useState(false);
  const [index, setIndex] = useState(0);

  const visible = album === 'all' ? images : images.filter((i) => i.cat === album);
  const current = images[index] || ({} as Img);

  const toggle = (id: number) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleFav = (id: number) => setImages((p) => p.map((i) => (i.id === id ? { ...i, fav: !i.fav } : i)));
  const open = (visIndex: number) => { const img = visible[visIndex]; setIndex(images.findIndex((x) => x.id === img.id)); setLightbox(true); };
  const next = () => setIndex((i) => (i + 1) % images.length);
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      if (!lightbox) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, images.length]);

  return (
    <>
      <PageHead
        title="Gallery"
        subtitle="Brand & product photography — 48 images, 2.1 GB across 5 albums."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill" onClick={() => { setSelectMode((m) => { if (m) setSelected([]); return !m; }); }} aria-pressed={selectMode}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg>
              <span className="ax-btn__label">{selectMode ? 'Done' : 'Select'}</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M9 15l3 -3l3 3" /><path d="M12 12l0 9" /></svg>
              <span className="ax-btn__label">Upload</span>
            </button>
          </>
        }
      />

      <div className="ax-gal-bar">
        <nav className="ax-tabs ax-tabs--pill" aria-label="Album filter" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div className="ax-tabs__list" role="tablist" style={{ flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" className={`ax-tabs__tab${album === t.id ? ' is-active' : ''}`} aria-selected={album === t.id} role="tab" onClick={() => setAlbum(t.id)}>
                <span>{t.label}</span>
                <span className="ax-badge ax-badge--neutral ax-badge--pill ax-badge--sm ax-num ax-tabs__badge">{t.count}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flex: '0 0 auto' }}>
          <div style={{ position: 'relative' }}>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill ax-btn--sm" onClick={() => setSortOpen((o) => !o)} aria-expanded={sortOpen}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4 -4l4 4m-4 -4v14" /><path d="M21 15l-4 4l-4 -4m4 4v-14" /></svg>
              <span className="ax-btn__label">{sortLabel}</span>
            </button>
            {sortOpen && (
              <div className="ax-menu" style={{ position: 'absolute', insetInlineEnd: 0, top: 'calc(100% + 6px)', zIndex: 20, minWidth: 170 }} onMouseLeave={() => setSortOpen(false)}>
                {SORTS.map((s) => (
                  <button key={s} type="button" className={`ax-menu__item${sortLabel === s ? ' is-selected' : ''}`} onClick={() => { setSortLabel(s); setSortOpen(false); }}>
                    <span className="ax-menu__check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ax-segment" role="radiogroup" aria-label="Layout">
            <button type="button" className={`ax-segment__option${layout === 'masonry' ? ' is-active' : ''}`} role="radio" aria-checked={layout === 'masonry'} onClick={() => setLayout('masonry')} aria-label="Masonry layout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v8h-6z" /><path d="M4 16h6v4h-6z" /><path d="M14 4h6v4h-6z" /><path d="M14 12h6v8h-6z" /></svg>
            </button>
            <button type="button" className={`ax-segment__option${layout === 'grid' ? ' is-active' : ''}`} role="radio" aria-checked={layout === 'grid'} onClick={() => setLayout('grid')} aria-label="Grid layout">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></svg>
            </button>
          </div>
        </div>
      </div>

      {selectMode && !!selected.length && (
        <div className="ax-card ax-flex" style={{ alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-5)', marginBottom: 'var(--ax-space-5)', background: 'var(--ax-accent-wash)' }}>
          <span className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}><span>{selected.length}</span> selected</span>
          <span className="ax-divider ax-divider--vertical" style={{ height: 18 }} role="separator" />
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Download</span></button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l14 0a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" /><path d="M11 5h2a2 2 0 0 1 2 2v2h-6v-2a2 2 0 0 1 2 -2" /></svg><span className="ax-btn__label">Add to album</span></button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ color: 'var(--ax-danger-500)' }}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg><span className="ax-btn__label">Delete</span></button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" style={{ marginInlineStart: 'auto' }} aria-label="Clear selection" onClick={() => setSelected([])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}

      <div className={layout === 'masonry' ? 'ax-gal-masonry' : 'ax-gal-grid'}>
        {visible.map((img, i) => (
          <figure key={img.id} className={`ax-gal-tile${selected.includes(img.id) ? ' is-selected' : ''}${layout === 'grid' ? ' ax-gal-tile--grid' : ''}`} style={layout === 'masonry' ? { aspectRatio: img.ratio } : undefined}>
            <button type="button" className="ax-gal-surface" style={{ background: `linear-gradient(${img.angle}deg, color-mix(in oklab,${img.c1} 80%,var(--ax-surface-solid)), color-mix(in oklab,${img.c2} 64%,var(--ax-surface-solid)))` }} onClick={() => (selectMode ? toggle(img.id) : open(i))} aria-label={selectMode ? `Select ${img.title}` : `Open ${img.title} in lightbox`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ax-gal-glyph"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
            </button>

            <figcaption className="ax-gal-cap">
              <div style={{ minWidth: 0 }}>
                <p className="ax-truncate">{img.title}</p>
                <p className="ax-num">{img.dim} · {img.size}</p>
              </div>
            </figcaption>

            {selectMode && (
              <label className="ax-gal-check" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" className="ax-checkbox" checked={selected.includes(img.id)} onChange={() => toggle(img.id)} aria-label={`Select ${img.title}`} />
              </label>
            )}

            {!selectMode && (
              <div className="ax-gal-actions">
                <button type="button" className={`ax-gal-act${img.fav ? ' is-fav' : ''}`} onClick={(e) => { e.stopPropagation(); toggleFav(img.id); }} aria-pressed={img.fav} aria-label={img.fav ? 'Remove favorite' : 'Favorite'}>
                  <svg viewBox="0 0 24 24" fill={img.fav ? 'var(--ax-warning-500)' : 'none'} stroke={img.fav ? 'var(--ax-warning-500)' : 'currentColor'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                </button>
                <button type="button" className="ax-gal-act" onClick={(e) => e.stopPropagation()} aria-label="Download">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
                </button>
                <button type="button" className="ax-gal-act" onClick={(e) => e.stopPropagation()} aria-label="More actions">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M17 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
                </button>
              </div>
            )}
          </figure>
        ))}
      </div>

      {lightbox && (
        <div className="ax-lb" role="dialog" aria-modal="true" aria-label="Image viewer">
          <div className="ax-lb__top">
            <div style={{ minWidth: 0 }}>
              <p className="ax-lb__title ax-truncate">{current.title}</p>
              <p className="ax-num ax-lb__meta"><span>{current.album}</span> · <span>{current.dim}</span> · <span>{current.size}</span></p>
            </div>
            <div className="ax-lb__tools">
              <button type="button" className={`ax-lb__tool${current.fav ? ' is-fav' : ''}`} onClick={() => toggleFav(current.id)} aria-pressed={current.fav} aria-label="Favorite">
                <svg viewBox="0 0 24 24" fill={current.fav ? 'var(--ax-warning-500)' : 'none'} stroke={current.fav ? 'var(--ax-warning-500)' : 'currentColor'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
              </button>
              <button type="button" className="ax-lb__tool" aria-label="Download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg></button>
              <button type="button" className="ax-lb__tool" aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /><path d="M14 5.5a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M14 18.5a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg></button>
              <button type="button" className="ax-lb__tool" onClick={() => setLightbox(false)} aria-label="Close viewer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
          </div>
          <div className="ax-lb__stage" onClick={(e) => { if (e.target === e.currentTarget) setLightbox(false); }}>
            <button type="button" className="ax-lb__nav ax-lb__nav--prev" onClick={prev} aria-label="Previous image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
            <figure className="ax-lb__frame" style={{ background: `linear-gradient(${current.angle}deg, color-mix(in oklab,${current.c1} 82%,#0A0C11), color-mix(in oklab,${current.c2} 66%,#0A0C11))` }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 64, height: 64 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
            </figure>
            <button type="button" className="ax-lb__nav ax-lb__nav--next" onClick={next} aria-label="Next image"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
          </div>
          <div className="ax-lb__strip">
            {images.map((img, i) => (
              <button key={img.id} type="button" className={`ax-lb__thumb${i === index ? ' is-active' : ''}`} onClick={() => setIndex(i)} aria-label={`Go to ${img.title}`} aria-current={i === index ? 'true' : 'false'} style={{ background: `linear-gradient(${img.angle}deg, color-mix(in oklab,${img.c1} 80%,#0A0C11), color-mix(in oklab,${img.c2} 64%,#0A0C11))` }} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        .ax-gal-bar { display:flex; align-items:center; gap:var(--ax-space-4); flex-wrap:wrap; margin-bottom:var(--ax-space-6); }
        .ax-gal-masonry { column-count:4; column-gap:var(--ax-space-4); }
        .ax-gal-masonry > .ax-gal-tile { break-inside:avoid; margin-bottom:var(--ax-space-4); }
        @media (max-width:1280px){ .ax-gal-masonry { column-count:3; } }
        @media (max-width:768px){ .ax-gal-masonry { column-count:2; } }
        @media (max-width:480px){ .ax-gal-masonry { column-count:1; } }
        .ax-gal-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:var(--ax-space-4); }
        .ax-gal-tile { position:relative; border-radius:var(--ax-radius-md); overflow:hidden; border:1px solid var(--ax-border); box-shadow:var(--ax-shadow-sm); transition:box-shadow var(--ax-motion-fast), transform var(--ax-motion-fast); }
        .ax-gal-tile--grid { aspect-ratio:1/1; }
        .ax-gal-tile:hover { box-shadow:var(--ax-shadow-md); }
        .ax-gal-tile.is-selected { box-shadow:0 0 0 2px var(--ax-accent); border-color:var(--ax-accent); }
        .ax-gal-surface { display:flex; align-items:center; justify-content:center; width:100%; height:100%; min-height:140px; border:0; padding:0; cursor:pointer; }
        .ax-gal-tile--grid .ax-gal-surface, .ax-gal-grid .ax-gal-surface { position:absolute; inset:0; }
        .ax-gal-glyph { width:30px; height:30px; opacity:.55; transition:opacity var(--ax-motion-fast), transform var(--ax-motion-fast); }
        .ax-gal-surface:hover .ax-gal-glyph { opacity:.85; transform:scale(1.03); }
        .ax-gal-cap { position:absolute; inset-inline:0; bottom:0; display:flex; align-items:flex-end; gap:var(--ax-space-2); padding:var(--ax-space-5) var(--ax-space-3) var(--ax-space-3); background:linear-gradient(to top, rgba(0,0,0,.62), transparent); opacity:0; transition:opacity var(--ax-motion-fast); pointer-events:none; }
        .ax-gal-tile:hover .ax-gal-cap { opacity:1; }
        .ax-gal-cap p:first-child { color:#fff; font-size:var(--ax-text-sm); font-weight:var(--ax-weight-medium); }
        .ax-gal-cap p:last-child { color:rgba(255,255,255,.72); font-size:var(--ax-text-2xs); font-family:var(--ax-font-mono); margin-top:1px; }
        .ax-gal-check { position:absolute; top:var(--ax-space-2); left:var(--ax-space-2); z-index:2; }
        .ax-gal-actions { position:absolute; top:var(--ax-space-2); right:var(--ax-space-2); z-index:2; display:flex; gap:4px; opacity:0; transition:opacity var(--ax-motion-fast); }
        .ax-gal-tile:hover .ax-gal-actions { opacity:1; }
        .ax-gal-act { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border:0; border-radius:var(--ax-radius-sm); background:rgba(0,0,0,.4); color:#fff; cursor:pointer; backdrop-filter:blur(4px); transition:background var(--ax-motion-fast); }
        .ax-gal-act svg { width:16px; height:16px; }
        .ax-gal-act:hover { background:rgba(0,0,0,.6); }
        .ax-gal-act.is-fav { background:rgba(0,0,0,.55); }
        .ax-lb { position:fixed; inset:0; z-index:80; display:flex; flex-direction:column; background:rgba(8,10,15,.92); backdrop-filter:blur(8px); }
        .ax-lb__top { display:flex; align-items:center; justify-content:space-between; gap:var(--ax-space-4); padding:var(--ax-space-4) var(--ax-space-6); }
        .ax-lb__title { color:#fff; font-size:var(--ax-text-md); font-weight:var(--ax-weight-semibold); max-width:420px; }
        .ax-lb__meta { color:rgba(255,255,255,.6); font-size:var(--ax-text-xs); font-family:var(--ax-font-mono); margin-top:2px; }
        .ax-lb__tools { display:flex; gap:var(--ax-space-2); flex:0 0 auto; }
        .ax-lb__tool { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border:0; border-radius:var(--ax-radius-md); background:rgba(255,255,255,.08); color:#fff; cursor:pointer; transition:background var(--ax-motion-fast); }
        .ax-lb__tool svg { width:20px; height:20px; }
        .ax-lb__tool:hover { background:rgba(255,255,255,.16); }
        .ax-lb__stage { flex:1 1 auto; display:flex; align-items:center; justify-content:center; gap:var(--ax-space-4); padding:0 var(--ax-space-4); min-height:0; }
        .ax-lb__nav { display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; flex:0 0 48px; border:0; border-radius:var(--ax-radius-pill); background:rgba(255,255,255,.08); color:#fff; cursor:pointer; transition:background var(--ax-motion-fast); }
        .ax-lb__nav svg { width:26px; height:26px; }
        .ax-lb__nav:hover { background:rgba(255,255,255,.18); }
        .ax-lb__frame { flex:1 1 auto; max-width:min(960px,90%); max-height:100%; aspect-ratio:3/2; display:flex; align-items:center; justify-content:center; border-radius:var(--ax-radius-md); box-shadow:0 30px 80px -20px rgba(0,0,0,.7); }
        .ax-lb__strip { display:flex; gap:var(--ax-space-2); justify-content:center; padding:var(--ax-space-4) var(--ax-space-6); overflow-x:auto; }
        .ax-lb__thumb { flex:0 0 auto; width:64px; height:44px; border:2px solid transparent; border-radius:var(--ax-radius-sm); cursor:pointer; opacity:.55; transition:opacity var(--ax-motion-fast), border-color var(--ax-motion-fast); }
        .ax-lb__thumb:hover { opacity:.85; }
        .ax-lb__thumb.is-active { opacity:1; border-color:var(--ax-accent); }
        @media (prefers-reduced-motion: reduce){ .ax-gal-tile, .ax-gal-glyph, .ax-gal-cap, .ax-gal-actions, .ax-lb__tool { transition:none; } }
      `}</style>
    </>
  );
}

export default Gallery;
