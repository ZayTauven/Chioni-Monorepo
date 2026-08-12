'use client';
/*
 * Vireo Next.js — Utilities · Breakpoints.
 * 1:1 re-expression of src/html/utilities/breakpoints.html: a live tier indicator
 * that tracks window.innerWidth (resize listener), the --ax-bp-* reference table
 * with the active row highlighted, and grid-collapse demos. Ports the Alpine
 * x-data resize logic to a React effect + state.
 */
import { useEffect, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const BPS: [string, number, number, string][] = [
  ['xs', 0, 575, 'Phones'],
  ['sm', 576, 767, 'Large phones'],
  ['md', 768, 991, 'Tablets · sidebar overlays'],
  ['lg', 992, 1199, 'Small laptops'],
  ['xl', 1200, 1399, 'Desktops'],
  ['2xl', 1400, 99999, 'Wide · boxed max'],
];
const KPIS: [string, string][] = [['Revenue', '--ax-viz-cyan'], ['Orders', '--ax-viz-violet'], ['Customers', '--ax-viz-pink'], ['AOV', '--ax-viz-amber']];

export function Breakpoints() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on, { passive: true });
    return () => window.removeEventListener('resize', on);
  }, []);
  const active = BPS.find((b) => w >= b[1] && w <= b[2]) || BPS[0];

  return (
    <>
      <PageHead
        title="Breakpoints"
        subtitle="Six responsive tiers drive every layout shift. Resize the window — the live indicator tracks the active tier in real time."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/position">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 9l3 3l-3 3" /><path d="M15 12h6" /><path d="M6 9l-3 3l3 3" /><path d="M3 12h6" /><path d="M9 18l3 3l3 -3" /><path d="M12 15v6" /><path d="M15 6l-3 -3l-3 3" /><path d="M12 3v6" /></svg>
              <span className="ax-btn__label">Positioning</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/utilities/colors">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /><path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
              <span className="ax-btn__label">Color tokens</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Live indicator */}
        <section className="ax-card ax-col--5" role="region" aria-label="Live breakpoint indicator">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Live</span>
              <h2 className="ax-card__title">Active tier</h2>
              <p className="ax-card__subtitle">Drag your window edge to watch it change.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }} aria-live="polite">
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-6) var(--ax-space-4)', borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)' }}>
              <div className="ax-display" style={{ fontSize: 'var(--ax-text-3xl)', color: 'var(--ax-accent)', lineHeight: 1 }}>{active[0]}</div>
              <div style={{ marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{active[3]}</div>
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span className="ax-eyebrow">Viewport</span>
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)' }}><span>{w}</span> px</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {BPS.map((b) => (
                <div key={b[0]} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 'var(--ax-radius-sm)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', ...(active[0] === b[0] ? { background: 'var(--ax-accent)', color: 'var(--ax-on-accent)' } : { background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)' }) }}>{b[0]}</div>
              ))}
            </div>
          </div>
        </section>

        {/* Reference table */}
        <section className="ax-card ax-col--7" role="region" aria-label="Breakpoint reference table">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">--ax-bp-*</span>
              <h2 className="ax-card__title">Reference table</h2>
              <p className="ax-card__subtitle">The token, its min-width and what changes at each step. The current row is highlighted.</p>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Token</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Min</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Range</th>
                  <th className="ax-table__th" scope="col">Typical target</th>
                </tr>
              </thead>
              <tbody>
                {BPS.map((b) => {
                  const on = active[0] === b[0];
                  return (
                    <tr key={b[0]} className="ax-table__row" style={on ? { background: 'var(--ax-accent-wash)', boxShadow: 'inset 2px 0 0 var(--ax-accent)' } : undefined} aria-selected={on}>
                      <td className="ax-table__td"><code className="ax-code" style={on ? { color: 'var(--ax-accent)' } : undefined}>{`--ax-bp-${b[0]}`}</code></td>
                      <td className="ax-table__td ax-table__td--num">{b[1]}px</td>
                      <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-muted)' }}>{b[2] === 99999 ? `${b[1]}px +` : `${b[1]}–${b[2]}`}</td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{b[3]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ax-card__footer">
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Sidebar collapses to an overlay below <code className="ax-code">--ax-bp-md</code>; the boxed-max container engages at <code className="ax-code">--ax-bp-2xl</code>.</span>
          </div>
        </section>

        {/* Grid behaviour at each tier */}
        <section className="ax-card ax-col--12" role="region" aria-label="Grid collapse behaviour">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In practice</span>
              <h2 className="ax-card__title">How the grid collapses</h2>
              <p className="ax-card__subtitle">The same four-up KPI row and 8+4 hero re-flow across the tiers — resize to feel it.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                <span className="ax-eyebrow">4 × .ax-col--3 → halves (≤992) → full (≤576)</span>
              </div>
              <div className="ax-dash-grid" style={{ gap: 'var(--ax-space-3)' }}>
                {KPIS.map((k) => (
                  <div key={k[0]} className="ax-col--3" style={{ padding: 'var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)' }}>
                    <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{k[0]}</span>
                    <i aria-hidden="true" style={{ display: 'block', width: '60%', height: 10, borderRadius: 'var(--ax-radius-xs)', marginTop: 8, background: `var(${k[1]})` }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-2)' }}>.ax-col--8 + .ax-col--4 → stacked full-width (≤992)</span>
              <div className="ax-dash-grid" style={{ gap: 'var(--ax-space-3)' }}>
                <div className="ax-col--8" style={{ height: 64, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-accent-wash)', border: '1px solid var(--ax-accent)', display: 'grid', placeItems: 'center', color: 'var(--ax-accent)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>ax-col--8 · hero</div>
                <div className="ax-col--4" style={{ height: 64, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', display: 'grid', placeItems: 'center', color: 'var(--ax-text-muted)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>ax-col--4 · rail</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Breakpoints;
