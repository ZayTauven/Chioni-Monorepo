'use client';
/*
 * Vireo Next.js — Utilities · Positioning.
 * 1:1 re-expression of src/html/utilities/position.html: absolute overlays
 * (corner badge + avatar status dot), an inset+transform dead-center media overlay,
 * sticky scroll-box section headers, a fixed toast & FAB demo and a z-index ladder.
 * The fixed toast is teleported to <body> via createPortal (Alpine x-teleport).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PageHead } from '../../components/shell/PageHead';

const STICKY_GROUPS: [string, string[]][] = [
  ['A', ['Aisha Bello', 'Ava Sutton', 'Aperture Goods']],
  ['B', ['Brightway Retail', 'Brass Task Light']],
  ['C', ['Camila Rossi', 'Cedar & Co.', 'Cork Desk Mat']],
  ['D', ['Daniel Cho', 'Devon Okafor']],
  ['E', ['Erik Lindqvist']],
];
const ZLADDER: [string, number, string][] = [
  ['base', 0, '--ax-viz-cyan'],
  ['card', 1, '--ax-viz-violet'],
  ['popover', 2, '--ax-viz-pink'],
  ['toast', 3, '--ax-accent'],
];

export function Position() {
  const [fixedOpen, setFixedOpen] = useState(false);
  const showToast = () => {
    setFixedOpen(true);
    setTimeout(() => setFixedOpen(false), 3200);
  };

  return (
    <>
      <PageHead
        title="Positioning"
        subtitle="Relative, absolute, sticky & fixed — composed with role tokens so overlays read in light and dark alike."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/helpers">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" /><path d="M14.5 5.5l4 4" /><path d="M12 8l-5 -5l-4 4l5 5" /><path d="M7 8l-1.5 1.5" /><path d="M16 12l5 5l-4 4l-5 -5" /><path d="M16 17l-1.5 1.5" /></svg>
              <span className="ax-btn__label">Helpers</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/utilities/breakpoints">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" /></svg>
              <span className="ax-btn__label">Breakpoints</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Absolute */}
        <section className="ax-card ax-col--6" role="region" aria-label="Absolute positioning demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">position: absolute</span>
              <h2 className="ax-card__title">Absolute overlays</h2>
              <p className="ax-card__subtitle">A relatively-positioned parent anchors badges, ribbons & status dots.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
            <div style={{ position: 'relative', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', background: 'var(--ax-surface-subtle)', minHeight: 104 }}>
              <span style={{ position: 'absolute', top: 'var(--ax-space-3)', right: 'var(--ax-space-3)' }} className="ax-badge ax-badge--solid ax-badge--danger ax-badge--pill">−40%</span>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 6 }}>top / right</span>
              <b style={{ color: 'var(--ax-text-strong)' }}>Aperture Desk Lamp</b>
              <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', marginTop: 4 }}>$129.00</div>
            </div>
            <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', background: 'var(--ax-surface-subtle)', minHeight: 104, display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
              <span style={{ position: 'relative' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>AS</span>
                <i aria-hidden="true" style={{ position: 'absolute', bottom: -2, right: -2, width: 13, height: 13, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-success-500)', border: '2px solid var(--ax-surface-solid)' }} />
              </span>
              <div>
                <b style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Ava Sutton</b>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-success-500)' }}>Online</span>
              </div>
            </div>
          </div>
        </section>

        {/* Centered absolute */}
        <section className="ax-card ax-col--6" role="region" aria-label="Centered absolute overlay demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">inset + transform</span>
              <h2 className="ax-card__title">Dead-center overlay</h2>
              <p className="ax-card__subtitle">A media frame with a centered play affordance and a top ribbon.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ position: 'relative', borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', height: 140, background: 'linear-gradient(135deg,var(--ax-accent),var(--ax-viz-violet))' }}>
              <span style={{ position: 'absolute', top: 0, left: 0, padding: '6px 14px', background: 'var(--ax-surface-overlay)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-2xs)', fontWeight: 'var(--ax-weight-semibold)', borderBottomRightRadius: 'var(--ax-radius-md)' }}>FEATURED</span>
              <button type="button" aria-label="Play overview video"
                style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 54, height: 54, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border-strong)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ax-text-strong)', boxShadow: 'var(--ax-shadow-md)' }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" stroke="none" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5 .86l11 -6.86a1 1 0 0 0 0 -1.72l-11 -6.86a1 1 0 0 0 -1.5 .86z" /></svg>
              </button>
              <span style={{ position: 'absolute', bottom: 'var(--ax-space-3)', left: 'var(--ax-space-4)', color: '#fff', fontWeight: 'var(--ax-weight-semibold)' }}>Vireo in 90 seconds</span>
            </div>
          </div>
        </section>

        {/* Sticky */}
        <section className="ax-card ax-col--6" role="region" aria-label="Sticky positioning demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">position: sticky</span>
              <h2 className="ax-card__title">Sticky section headers</h2>
              <p className="ax-card__subtitle">Scroll this list — each group label pins to the top of its scroll box.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-scroll" style={{ height: 240, border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
              {STICKY_GROUPS.map((grp) => (
                <div key={grp[0]}>
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px var(--ax-space-4)', background: 'var(--ax-surface-subtle)', borderBottom: '1px solid var(--ax-border)', backdropFilter: 'blur(6px)' }}>
                    <span className="ax-eyebrow">{grp[0]}</span>
                  </div>
                  {grp[1].map((row) => (
                    <div key={row} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)' }}>
                      <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', fontSize: 'var(--ax-text-2xs)' }}>{row.split(' ').map((wd) => wd[0]).join('').slice(0, 2)}</span>
                      <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>{row}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fixed (simulated) */}
        <section className="ax-card ax-col--6" role="region" aria-label="Fixed positioning demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">position: fixed</span>
              <h2 className="ax-card__title">Fixed toast & FAB</h2>
              <p className="ax-card__subtitle">Pinned to the viewport, above all content. Trigger the live examples.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Fixed elements ignore scroll and sit relative to the viewport — used for toasts, FABs and the mobile sidebar overlay.</p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--primary" onClick={showToast}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
                <span className="ax-btn__label">Show fixed toast</span>
              </button>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Appears bottom-right for ~3s.</span>
            </div>
            <div style={{ border: '1px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', position: 'relative', minHeight: 72 }}>
              <span className="ax-eyebrow" style={{ display: 'block', marginBottom: 6 }}>FAB pattern</span>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>A floating action button anchors to a corner — shown here within the card via <code className="ax-code">absolute</code>, fixed in production.</span>
              <span aria-hidden="true" style={{ position: 'absolute', bottom: 'var(--ax-space-3)', right: 'var(--ax-space-3)', width: 44, height: 44, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', display: 'grid', placeItems: 'center', boxShadow: 'var(--ax-shadow-md)' }}>
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              </span>
            </div>
          </div>
        </section>

        {/* z-index ladder */}
        <section className="ax-card ax-col--12" role="region" aria-label="Stacking context demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">z-index</span>
              <h2 className="ax-card__title">Stacking order</h2>
              <p className="ax-card__subtitle">Overlapping layers prove the painting order — later siblings with higher z sit on top.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ position: 'relative', height: 120 }}>
              {ZLADDER.map((z, i) => (
                <div key={z[0]} style={{ position: 'absolute', top: i * 14, left: i * 64, zIndex: z[1], width: 150, height: 84, borderRadius: 'var(--ax-radius-lg)', background: `var(${z[2]})`, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'var(--ax-space-4)', boxShadow: 'var(--ax-shadow-md)' }}>
                  <b style={{ textTransform: 'capitalize' }}>{z[0]}</b>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', opacity: 0.9 }}>{`z-index: ${z[1]}`}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* the actual fixed toast, teleported to body */}
      {fixedOpen && createPortal(
        <div role="status" aria-live="polite"
          style={{ position: 'fixed', bottom: 'var(--ax-space-6)', right: 'var(--ax-space-6)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-md)', backdropFilter: 'blur(12px)', maxWidth: 320 }}>
          <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-success-50)', color: 'var(--ax-success-500)', flex: '0 0 auto' }}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Fixed to the viewport</b>
            <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Scroll — this toast stays put.</span>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default Position;
