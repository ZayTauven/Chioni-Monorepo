'use client';
/*
 * Vireo Next.js — UI · Images (route "ui/images").
 *
 * Faithful re-expression of src/html/ui/images.html: rounding scale, aspect
 * ratios, a selectable thumbnail strip (Alpine `active` state → useState),
 * object-fit, figure + caption, and avatar crops. DOM classes / ARIA / copy /
 * inline data-URI sources match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const ROUNDING = [
  { grad: 'linear-gradient(135deg,var(--ax-viz-cyan),var(--ax-viz-violet))', radius: '0', label: 'Square' },
  { grad: 'linear-gradient(135deg,var(--ax-viz-violet),var(--ax-viz-pink))', radius: 'var(--ax-radius-sm)', label: 'Radius sm' },
  { grad: 'linear-gradient(135deg,var(--ax-viz-pink),var(--ax-viz-amber))', radius: 'var(--ax-radius-md)', label: 'Radius md' },
  { grad: 'linear-gradient(135deg,var(--ax-viz-amber),var(--ax-viz-emerald))', radius: 'var(--ax-radius-lg)', label: 'Radius lg' },
  { grad: 'linear-gradient(135deg,var(--ax-viz-emerald),var(--ax-viz-cyan))', radius: 'var(--ax-radius-xl)', label: 'Radius xl' },
  { grad: 'linear-gradient(135deg,var(--ax-accent),var(--ax-viz-violet))', radius: '50%', label: 'Circle' },
];

const IMG_169 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2338BDF8'/%3E%3Cstop offset='1' stop-color='%23A78BFA'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='180' fill='url(%23g)'/%3E%3C/svg%3E";
const IMG_43 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='180'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23F472B6'/%3E%3Cstop offset='1' stop-color='%23FBBF24'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='240' height='180' fill='url(%23g)'/%3E%3C/svg%3E";
const IMG_11 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2334D399'/%3E%3Cstop offset='1' stop-color='%2338BDF8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23g)'/%3E%3C/svg%3E";
const IMG_34 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='240'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23A78BFA'/%3E%3Cstop offset='1' stop-color='%23F472B6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='180' height='240' fill='url(%23g)'/%3E%3C/svg%3E";
const FIT_CYAN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='320'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2338BDF8'/%3E%3Cstop offset='1' stop-color='%23A78BFA'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='320' fill='url(%23g)'/%3E%3C/svg%3E";
const FIT_PINK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='320'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23F472B6'/%3E%3Cstop offset='1' stop-color='%23FBBF24'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='320' fill='url(%23g)'/%3E%3C/svg%3E";
const FIT_EMER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='320'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2334D399'/%3E%3Cstop offset='1' stop-color='%2338BDF8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='160' height='320' fill='url(%23g)'/%3E%3C/svg%3E";

const FIGCAP: React.CSSProperties = { marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' };

const THUMB_VIZ = ['cyan', 'violet', 'pink', 'amber', 'emerald', 'cyan'];

export function Images() {
  const [active, setActive] = useState(1);
  return (
    <>
      <PageHead
        title="Images"
        subtitle="Media utilities — rounded, fixed aspect ratios, thumbnails, figure & caption, and object-fit. Frames carry the glass border so media sits cleanly on any surface."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
              <span className="ax-btn__label">Media library</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
              <span className="ax-btn__label">Upload</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Rounding */}
        <section className="ax-card ax-col--12" role="region" aria-label="Image rounding">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Corners</span>
              <h2 className="ax-card__title">Rounding</h2>
              <p className="ax-card__subtitle">Square through pill — every radius from the <code className="ax-code">--ax-radius-*</code> scale.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 'var(--ax-space-5)' }}>
            {ROUNDING.map((r) => (
              <figure key={r.label} style={{ margin: 0, textAlign: 'center' }}>
                <div style={{ aspectRatio: '1', background: r.grad, border: '1px solid var(--ax-border)', borderRadius: r.radius }} />
                <figcaption style={FIGCAP}>{r.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Aspect ratios */}
        <section className="ax-card ax-col--8" role="region" aria-label="Aspect ratios">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Framing</span>
              <h2 className="ax-card__title">Aspect ratios</h2>
              <p className="ax-card__subtitle">The <code className="ax-code">.ax-ratio</code> frame crops media to a fixed shape via <code className="ax-code">--ax-ratio</code>.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 'var(--ax-space-5)' }}>
            <figure style={{ margin: 0 }}>
              <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '16/9', border: '1px solid var(--ax-border)' }}>
                <img alt="Aperture Goods storefront banner" src={IMG_169} />
              </div>
              <figcaption style={FIGCAP}>16 : 9 — banners</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '4/3', border: '1px solid var(--ax-border)' }}>
                <img alt="Product hero, 4 by 3" src={IMG_43} />
              </div>
              <figcaption style={FIGCAP}>4 : 3 — content</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '1/1', border: '1px solid var(--ax-border)' }}>
                <img alt="Square product thumbnail" src={IMG_11} />
              </div>
              <figcaption style={FIGCAP}>1 : 1 — avatars</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '3/4', border: '1px solid var(--ax-border)' }}>
                <img alt="Portrait, 3 by 4" src={IMG_34} />
              </div>
              <figcaption style={FIGCAP}>3 : 4 — portrait</figcaption>
            </figure>
          </div>
        </section>

        {/* Thumbnails */}
        <section className="ax-card ax-col--4" role="region" aria-label="Thumbnail strip">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Gallery</span>
              <h2 className="ax-card__title">Thumbnails</h2>
              <p className="ax-card__subtitle">Selectable tiles with an active ring.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)' }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`ax-thumb${active === i ? ' is-active' : ''}`}
                  onClick={() => setActive(i)}
                  style={{ background: `linear-gradient(135deg,var(--ax-viz-${THUMB_VIZ[i - 1]}),var(--ax-accent))` }}
                  aria-pressed={active === i}
                  aria-label={`Select image ${i}`}
                />
              ))}
            </div>
            <p style={{ margin: 'var(--ax-space-4) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Selected: image <span className="ax-num">{active}</span> of 6</p>
          </div>
        </section>

        {/* Object-fit */}
        <section className="ax-card ax-col--8" role="region" aria-label="Object-fit behavior">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Sizing</span>
              <h2 className="ax-card__title">Object-fit</h2>
              <p className="ax-card__subtitle">Same source, same 4:3 frame — three fit strategies.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--ax-space-5)' }}>
            <figure style={{ margin: 0 }}>
              <div style={{ aspectRatio: '4/3', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <img alt="Cover fit demo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} src={FIT_CYAN} />
              </div>
              <figcaption style={FIGCAP}><code className="ax-code">cover</code> — fills, crops</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <div style={{ aspectRatio: '4/3', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <img alt="Contain fit demo" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} src={FIT_PINK} />
              </div>
              <figcaption style={FIGCAP}><code className="ax-code">contain</code> — fits, letterboxed</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <div style={{ aspectRatio: '4/3', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden', background: 'var(--ax-surface-subtle)' }}>
                <img alt="Fill stretch demo" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} src={FIT_EMER} />
              </div>
              <figcaption style={FIGCAP}><code className="ax-code">fill</code> — stretched</figcaption>
            </figure>
          </div>
        </section>

        {/* Figure with caption & overlay */}
        <section className="ax-card ax-col--6" role="region" aria-label="Figure with caption">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Editorial</span>
              <h2 className="ax-card__title">Figure &amp; caption</h2>
              <p className="ax-card__subtitle">A captioned figure with a gradient scrim title.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', border: '1px solid var(--ax-border)', background: 'linear-gradient(135deg,var(--ax-viz-violet),var(--ax-viz-cyan))' }}>
                <span aria-hidden="true" style={{ position: 'absolute', insetBlockEnd: 0, insetInline: 0, height: '55%', background: 'linear-gradient(to top,rgba(0,0,0,.55),transparent)' }} />
                <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', insetBlockStart: 'var(--ax-space-3)', insetInlineStart: 'var(--ax-space-3)' }}>New</span>
                <div style={{ position: 'absolute', insetBlockEnd: 'var(--ax-space-4)', insetInlineStart: 'var(--ax-space-4)', color: '#fff' }}>
                  <div style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-lg)', fontWeight: 'var(--ax-weight-bold)' }}>Brass Task Light</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.9 }}>Lighting · <span className="ax-num">$182</span></div>
                </div>
              </div>
              <figcaption style={{ marginTop: 'var(--ax-space-3)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
                Our best-selling task light, photographed for the Summer &rsquo;26 lookbook.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Avatars & badge overlay */}
        <section className="ax-card ax-col--6" role="region" aria-label="Avatar images">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">People</span>
              <h2 className="ax-card__title">Avatars &amp; status</h2>
              <p className="ax-card__subtitle">Circular &amp; squircle crops with status dots and a stacked group.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', alignItems: 'flex-end' }}>
              <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">AS</span><span className="ax-avatar__status ax-avatar__status--online" /></span>
              <span className="ax-avatar ax-avatar--md" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">MR</span></span>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}><span className="ax-avatar__initials">LB</span></span>
              <span className="ax-avatar ax-avatar--xl ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><span className="ax-avatar__initials">DO</span></span>
            </div>
            <div className="ax-divider" />
            <div>
              <div className="ax-eyebrow" style={{ marginBottom: 'var(--ax-space-3)' }}>Stacked group</div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="ax-avatar ax-avatar--md ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><span className="ax-avatar__initials">AS</span></span>
                <span className="ax-avatar ax-avatar--md ax-avatar--ringed" style={{ marginInlineStart: -10, background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">MR</span></span>
                <span className="ax-avatar ax-avatar--md ax-avatar--ringed" style={{ marginInlineStart: -10, background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><span className="ax-avatar__initials">PN</span></span>
                <span className="ax-avatar ax-avatar--md ax-avatar--ringed" style={{ marginInlineStart: -10, background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>+5</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Images;
