'use client';
/*
 * Vireo React — Leaflet Maps (maps/leaflet).
 *
 * Faithful re-expression of src/html/maps/leaflet.html + src/js/pages/maps-leaflet.js.
 * Renders a REAL Leaflet tile map (CARTO / OpenTopoMap basemaps, no API key) with
 * branch markers, themed popups, a GeoJSON-style region overlay and a density
 * layer. Leaflet is lazy-imported inside an effect (the documented plugin-wrapper
 * pattern); the surrounding controls/cards are React state that drive the map, and
 * marker clicks push the active branch back. Re-themes on ax:change. DOM/classes
 * /ARIA match the reference 1:1.
 */
import { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line import/no-unresolved
import 'leaflet/dist/leaflet.css';
import '../../styles/leaflet-theme.css';
import { PageHead } from '../../components/shell/PageHead';

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

interface Branch { id: string; name: string; region: string; staff: number; rev: string; c: string; ll: [number, number] }
const BRANCHES: Branch[] = [
  { id: 'br-1', name: 'Lisbon Studio', region: 'EMEA', staff: 18, rev: '€142K', c: '--ax-accent', ll: [38.7223, -9.1393] },
  { id: 'br-2', name: 'Leeds Distribution', region: 'EMEA', staff: 34, rev: '£98K', c: '--ax-viz-cyan', ll: [53.8008, -1.5491] },
  { id: 'br-3', name: 'Malmö Wholesale', region: 'EMEA', staff: 12, rev: 'kr 88K', c: '--ax-viz-violet', ll: [55.6050, 13.0038] },
  { id: 'br-4', name: 'Milan Showroom', region: 'EMEA', staff: 9, rev: '€76K', c: '--ax-viz-amber', ll: [45.4642, 9.1900] },
  { id: 'br-5', name: 'Bristol Pop-up', region: 'EMEA', staff: 6, rev: '£41K', c: '--ax-viz-emerald', ll: [51.4545, -2.5879] },
  { id: 'br-6', name: 'Marseille Depot', region: 'EMEA', staff: 14, rev: '€63K', c: '--ax-viz-pink', ll: [43.2965, 5.3698] },
];

const TILES: Record<string, { url: string; attr: string; sub: string; max: number }> = {
  positron: { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap · © CARTO', sub: 'abcd', max: 20 },
  dark: { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap · © CARTO', sub: 'abcd', max: 20 },
  voyager: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '© OpenStreetMap · © CARTO', sub: 'abcd', max: 20 },
  terrain: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap · © OpenTopoMap (CC-BY-SA)', sub: 'abc', max: 17 },
};

const REGION_RINGS: [number, number][][] = [
  [[51.0, -4.6], [54.0, -1.0], [53.2, 7.0], [49.0, 8.6], [46.2, 6.2], [48.6, -1.8]],
  [[44.0, 3.0], [46.5, 7.5], [45.0, 12.5], [41.5, 9.0], [42.5, 1.5]],
];

const LAYERS = [
  { k: 'positron', name: 'Positron', sub: 'Neutral light' },
  { k: 'dark', name: 'Dark Matter', sub: 'Warm graphite' },
  { k: 'voyager', name: 'Voyager', sub: 'Soft colour' },
  { k: 'terrain', name: 'Terrain', sub: 'Topographic' },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function markerIcon(L: any, branch: Branch, active: boolean) {
  const color = cssVar(branch.c) || '#1E856C';
  const d = active ? 20 : 14;
  return L.divIcon({
    className: 'ax-leaflet-pin',
    html: `<span style="display:block;width:${d}px;height:${d}px;border-radius:50%;background:${color};border:3px solid ${cssVar('--ax-surface-solid') || '#fff'};box-shadow:var(--ax-shadow-md);transition:.15s;"></span>`,
    iconSize: [d, d], iconAnchor: [d / 2, d / 2],
  });
}
function popupHtml(b: Branch) {
  return `
    <div style="min-width:188px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${cssVar(b.c)};flex:none;"></span>
        <b style="color:var(--ax-text-strong);font-size:var(--ax-text-sm);">${b.name}</b>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:12px;">
        <span style="font-size:var(--ax-text-xs);color:var(--ax-text-muted);">${b.region} · ${b.staff} staff</span>
        <b style="font-size:var(--ax-text-xs);color:var(--ax-text-strong);font-family:var(--ax-font-mono);">${b.rev}</b>
      </div>
    </div>`;
}

export function Leaflet() {
  const [layer, setLayer] = useState('positron');
  const [showRegions, setShowRegions] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHeat, setShowHeat] = useState(false);
  const [active, setActive] = useState('br-1');

  const mapEl = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    map: any; markers: Record<string, any>; tileLayer: any; regionLayer: any; heatLayer: any; L: any;
  }>({ map: null, markers: {}, tileLayer: null, regionLayer: null, heatLayer: null, L: null });

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    if (!mapEl.current) return;
    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      if (cancelled || !mapEl.current || ctx.current.map) return;
      const map = L.map(mapEl.current, { zoomControl: false, attributionControl: true, center: [48.5, 4.0], zoom: 5, scrollWheelZoom: false });
      map.attributionControl.setPrefix('');
      ctx.current.L = L;
      ctx.current.map = map;
      const t = TILES.positron;
      ctx.current.tileLayer = L.tileLayer(t.url, { attribution: t.attr, subdomains: t.sub, maxZoom: t.max }).addTo(map);
      BRANCHES.forEach((b) => {
        const m = L.marker(b.ll, { icon: markerIcon(L, b, b.id === 'br-1') }).addTo(map);
        m.bindPopup(popupHtml(b), { closeButton: false, className: 'ax-leaflet-popup' });
        m.on('click', () => setActive(b.id));
        ctx.current.markers[b.id] = m;
      });
      addRegions();
      setTimeout(() => map.invalidateSize(), 60);
    });
    return () => {
      cancelled = true;
      if (ctx.current.map) { ctx.current.map.remove(); ctx.current.map = null; ctx.current.markers = {}; ctx.current.tileLayer = null; ctx.current.regionLayer = null; ctx.current.heatLayer = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addRegions() {
    const { L, map } = ctx.current;
    if (!L || !map || ctx.current.regionLayer) return;
    ctx.current.regionLayer = L.layerGroup(REGION_RINGS.map((ring) => L.polygon(ring, { color: cssVar('--ax-accent'), weight: 1.5, fillColor: cssVar('--ax-accent'), fillOpacity: 0.18 }))).addTo(map);
  }
  function removeRegions() {
    const { map } = ctx.current;
    if (ctx.current.regionLayer) { map.removeLayer(ctx.current.regionLayer); ctx.current.regionLayer = null; }
  }
  function addHeat() {
    const { L, map } = ctx.current;
    if (!L || !map || ctx.current.heatLayer) return;
    ctx.current.heatLayer = L.layerGroup(BRANCHES.map((b) => L.circle(b.ll, { radius: 90000 + b.staff * 4000, stroke: false, fillColor: cssVar('--ax-viz-pink'), fillOpacity: 0.16 }))).addTo(map);
  }
  function removeHeat() {
    const { map } = ctx.current;
    if (ctx.current.heatLayer) { map.removeLayer(ctx.current.heatLayer); ctx.current.heatLayer = null; }
  }
  function refreshMarkers() {
    const { L, markers } = ctx.current;
    if (!L) return;
    BRANCHES.forEach((b) => markers[b.id]?.setIcon(markerIcon(L, b, b.id === active)));
  }

  // Layer switch.
  useEffect(() => {
    const { L, map } = ctx.current;
    if (!L || !map) return;
    if (ctx.current.tileLayer) map.removeLayer(ctx.current.tileLayer);
    const t = TILES[layer] || TILES.positron;
    ctx.current.tileLayer = L.tileLayer(t.url, { attribution: t.attr, subdomains: t.sub, maxZoom: t.max }).addTo(map);
  }, [layer]);

  // Active branch → pan + popup + refresh icons.
  useEffect(() => {
    const { map, markers } = ctx.current;
    if (!map) return;
    refreshMarkers();
    const m = markers[active];
    if (m && showMarkers) { map.panTo(m.getLatLng()); m.openPopup(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Overlay toggles.
  useEffect(() => {
    const { map, markers } = ctx.current;
    if (!map) return;
    BRANCHES.forEach((b) => { if (markers[b.id]) (showMarkers ? markers[b.id].addTo(map) : map.removeLayer(markers[b.id])); });
  }, [showMarkers]);
  useEffect(() => { if (!ctx.current.map) return; if (showRegions) addRegions(); else removeRegions(); }, [showRegions]);
  useEffect(() => { if (!ctx.current.map) return; if (showHeat) addHeat(); else removeHeat(); }, [showHeat]);

  // Re-theme on ax:change.
  useEffect(() => {
    const onChange = () => {
      refreshMarkers();
      if (ctx.current.regionLayer) { removeRegions(); addRegions(); }
      if (ctx.current.heatLayer) { removeHeat(); addHeat(); }
    };
    document.addEventListener('ax:change', onChange);
    return () => document.removeEventListener('ax:change', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHead
        title="Leaflet Maps"
        subtitle="Open tile maps with switchable layers, GeoJSON region overlays, accent markers and Aurora-styled popups."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l-8 4l8 4l8 -4l-8 -4" /><path d="M4 12l8 4l8 -4" /><path d="M4 16l8 4l8 -4" /></svg>
              <span className="ax-btn__label">Manage layers</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add marker</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* LAYER CONTROLS RAIL */}
        <section className="ax-card ax-col--4" role="region" aria-label="Map layer controls">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Layers</span>
              <h2 className="ax-card__title">Layer controls</h2>
              <p className="ax-card__subtitle">Base map &amp; overlays</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-2)' }}>Base layer</div>
              <div style={{ display: 'grid', gap: 'var(--ax-space-2)' }}>
                {LAYERS.map((t) => (
                  <label key={t.k} className={`ax-cluster${layer === t.k ? ' is-selected' : ''}`} style={{ gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', cursor: 'pointer', flexWrap: 'nowrap', ...(layer === t.k ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : {}) }}>
                    <input type="radio" name="lf-layer" className="ax-radio" value={t.k} checked={layer === t.k} onChange={() => setLayer(t.k)} aria-label={t.name} />
                    <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{t.name}</span>
                      <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{t.sub}</span>
                    </span>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)' }}>
                      <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l-8 4l8 4l8 -4l-8 -4" /><path d="M4 12l8 4l8 -4" /></svg>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="ax-divider" />

            <div>
              <div style={{ fontSize: 'var(--ax-text-xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-2)' }}>Overlays</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <label className="ax-cluster" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 11, height: 11, borderRadius: 3, background: 'color-mix(in oklab,var(--ax-accent) 45%,transparent)' }} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>GeoJSON regions</span></span>
                  <input type="checkbox" className="ax-switch" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} aria-label="Toggle GeoJSON region overlay" />
                </label>
                <label className="ax-cluster" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--ax-accent)' }} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Branch markers</span></span>
                  <input type="checkbox" className="ax-switch" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} aria-label="Toggle branch markers" />
                </label>
                <label className="ax-cluster" style={{ justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 11, height: 11, borderRadius: '50%', background: 'radial-gradient(circle,var(--ax-viz-pink),transparent 70%)' }} /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Density heat</span></span>
                  <input type="checkbox" className="ax-switch" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} aria-label="Toggle density heatmap" />
                </label>
              </div>
            </div>

            <div className="ax-divider" />

            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Region opacity</span>
                <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">40%</span>
              </div>
              <input type="range" className="ax-range--native" min={0} max={100} defaultValue={40} aria-label="Region fill opacity" style={{ width: '100%' }} />
            </div>
          </div>
        </section>

        {/* MAP CANVAS (hero) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Leaflet map of European branches" style={{ overflow: 'hidden' }}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">European branches</h2>
              <p className="ax-card__subtitle">Base layer: <b style={{ color: 'var(--ax-text-strong)' }}>{layer.charAt(0).toUpperCase() + layer.slice(1)}</b> · 6 markers</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-badge ax-badge--soft ax-badge--pill"><span className="ax-badge__dot" style={{ background: 'var(--ax-viz-emerald)' }} />OpenStreetMap</span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ position: 'relative', height: 460, borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', border: '1px solid var(--ax-border)' }}>
              <div ref={mapEl} aria-label="Leaflet map of Western Europe with branch markers and region overlays" style={{ position: 'absolute', inset: 0, height: '100%', background: 'var(--ax-surface-subtle)' }} />
              <div style={{ position: 'absolute', left: 'var(--ax-space-4)', top: 'var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 6, zIndex: 500 }}>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--sm" aria-label="Zoom in" style={{ backdropFilter: 'blur(12px)' }} onClick={() => ctx.current.map?.zoomIn()}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                </button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--sm" aria-label="Zoom out" style={{ backdropFilter: 'blur(12px)' }} onClick={() => ctx.current.map?.zoomOut()}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /></svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* LOCATION CARDS */}
        {BRANCHES.map((b) => (
          <section key={b.id} className={`ax-card ax-card--interactive ax-col--4${active === b.id ? ' is-selected' : ''}`} role="region" onClick={() => setActive(b.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setActive(b.id); }} aria-label={`${b.name} branch card`} style={{ cursor: 'pointer' }}>
            <div className="ax-card__body">
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab, var(${b.c}) 18%, transparent)`, color: `var(${b.c})` }}>
                  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg>
                </span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <div className="ax-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{b.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{b.region + ' region'}</div>
                </div>
                <span className="ax-badge ax-badge--soft ax-badge--pill ax-num">{b.rev}</span>
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-4)', paddingTop: 'var(--ax-space-3)', borderTop: '1px solid var(--ax-border)' }}>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Headcount</span>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{b.staff}</b>
              </div>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default Leaflet;
