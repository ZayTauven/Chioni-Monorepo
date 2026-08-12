'use client';
/*
 * Vireo Next.js — Utilities · Color tokens.
 * 1:1 re-expression of src/html/utilities/colors.html: surfaces & borders, text
 * emphasis steps, the status palette (50/200/500), the constant data-viz palette,
 * the live-derived accent ramp and a "never hard-code a hex" guidance alert. Every
 * swatch copies its CSS var (useCopyFlash). The page-head "Copy --ax-accent" button
 * has its own local copied flag, matching the reference.
 */
import { useState, type ReactElement } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { useCopyFlash } from './utilShared';

const SURFACES: [string, string, string][] = [
  ['--ax-canvas', 'Canvas', 'page background'],
  ['--ax-surface', 'Surface', 'glass card'],
  ['--ax-surface-subtle', 'Subtle', 'table header / wells'],
  ['--ax-surface-raised', 'Raised', 'header / sidebar'],
  ['--ax-surface-overlay', 'Overlay', 'popover / modal'],
  ['--ax-surface-solid', 'Solid', 'opaque fallback'],
  ['--ax-border', 'Border', '1px hairline'],
  ['--ax-border-strong', 'Border strong', 'dividers / focus'],
];
const TEXTS: [string, string, string, number][] = [
  ['--ax-text-strong', 'Text strong', 'Headings & key figures', 700],
  ['--ax-text', 'Text', 'Default body copy', 500],
  ['--ax-text-muted', 'Text muted', 'Secondary & captions', 500],
  ['--ax-text-subtle', 'Text subtle', 'Tertiary, idle icons', 500],
  ['--ax-text-disabled', 'Text disabled', 'Inert controls', 500],
];
const STATUS_ICONS: Record<string, ReactElement> = {
  check: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>,
  alert: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M3.5 17.5l7 -12a1.7 1.7 0 0 1 3 0l7 12a1.7 1.7 0 0 1 -1.5 2.5h-14a1.7 1.7 0 0 1 -1.5 -2.5" /></svg>,
  x: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>,
  info: <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>,
};
const STATUS: [string, string, string, string][] = [
  ['Success', '--ax-success', 'check', 'Paid · Active · Up'],
  ['Warning', '--ax-warning', 'alert', 'Pending · Low stock'],
  ['Danger', '--ax-danger', 'x', 'Failed · Overdue · Down'],
  ['Info', '--ax-info', 'info', 'Note · Tip · Neutral'],
];
const VIZ: [string, string, string][] = [
  ['--ax-viz-cyan', 'Cyan', 'Series 1 / primary'],
  ['--ax-viz-violet', 'Violet', 'Series 2'],
  ['--ax-viz-pink', 'Pink', 'Series 3'],
  ['--ax-viz-amber', 'Amber', 'Series 4'],
  ['--ax-viz-emerald', 'Emerald', 'Series 5'],
  ['--ax-viz-red', 'Red / rose', 'Series 6 / loss'],
];
const RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

function CopyAccentButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="ax-btn ax-btn--primary"
      onClick={() => { navigator.clipboard?.writeText('var(--ax-accent)'); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
      <span className="ax-btn__label">{copied ? 'Copied!' : 'Copy --ax-accent'}</span>
    </button>
  );
}

export function Colors() {
  const { flash, copy } = useCopyFlash();
  return (
    <>
      <PageHead
        title="Color tokens"
        subtitle="Every surface, text, status & data-viz color is a role token — light, dark and all 12 accents retheme for free."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/utilities/spacing">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3l4 4l-14 14l-4 -4l14 -14" /><path d="M16 7l-1.5 -1.5" /><path d="M13 10l-1.5 -1.5" /><path d="M10 13l-1.5 -1.5" /><path d="M7 16l-1.5 -1.5" /></svg>
              <span className="ax-btn__label">Spacing scale</span>
            </a>
            <CopyAccentButton />
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Surfaces & borders */}
        <section className="ax-card ax-col--6" role="region" aria-label="Surface and border tokens">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Foundation</span>
              <h2 className="ax-card__title">Surfaces & borders</h2>
              <p className="ax-card__subtitle">The glass-stack the whole UI is layered on. Click a chip to copy its var.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-3)' }}>
            {SURFACES.map((t) => (
              <button key={t[0]} type="button" className="ax-cluster" onClick={() => copy(t[0])}
                style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', textAlign: 'start', padding: 'var(--ax-space-2)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer', width: '100%' }}
                aria-label={`Copy ${t[0]}`}>
                <span aria-hidden="true" style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 'var(--ax-radius-sm)', border: '1px solid var(--ax-border-strong)', background: `var(${t[0]})` }} />
                <span style={{ minWidth: 0 }}>
                  <span className="ax-truncate" style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{t[1]}</span>
                  <code className="ax-code" style={{ background: 'transparent', padding: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{flash === t[0] ? 'Copied!' : t[0]}</code>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Text scale */}
        <section className="ax-card ax-col--6" role="region" aria-label="Text color tokens">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Foundation</span>
              <h2 className="ax-card__title">Text colors</h2>
              <p className="ax-card__subtitle">Five emphasis steps, each AA-legible on every surface.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            {TEXTS.map((t) => (
              <button key={t[0]} type="button" className="ax-cluster" onClick={() => copy(t[0])}
                style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'start' }}
                aria-label={`Copy ${t[0]}`}>
                <span style={{ fontSize: 'var(--ax-text-md)', fontWeight: t[3], color: `var(${t[0]})` }}>{t[1]}</span>
                <span style={{ textAlign: 'end', minWidth: 0 }}>
                  <span className="ax-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{t[2]}</span>
                  <code className="ax-code" style={{ background: 'transparent', padding: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)' }}>{flash === t[0] ? 'Copied!' : t[0]}</code>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Status palette */}
        <section className="ax-card ax-col--12" role="region" aria-label="Status color tokens">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Semantic</span>
              <h2 className="ax-card__title">Status palette</h2>
              <p className="ax-card__subtitle">Success, warning, danger & info — each ships a 50 wash, 200 mid & 500 solid for tints, fills and badges.</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Color never the only signal — pair with ▲▼ & glyphs</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
            {STATUS.map((g) => (
              <div key={g[0]} style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)', background: `var(${g[1]}-50)` }}>
                  <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 'var(--ax-radius-md)', background: `var(${g[1]}-500)`, color: '#fff' }}>
                    {STATUS_ICONS[g[2]]}
                  </span>
                  <b style={{ color: `var(${g[1]}-500)`, fontWeight: 'var(--ax-weight-semibold)' }}>{g[0]}</b>
                </div>
                <div style={{ display: 'flex' }}>
                  {['-50', '-200', '-500'].map((suf) => (
                    <button key={suf} type="button" onClick={() => copy(g[1] + suf)} style={{ flex: 1, height: 36, border: 0, cursor: 'pointer', background: `var(${g[1]}${suf})` }} aria-label={`Copy ${g[1]}${suf}`} />
                  ))}
                </div>
                <p style={{ margin: 0, padding: 'var(--ax-space-3) var(--ax-space-4)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{g[3]}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data-viz palette */}
        <section className="ax-card ax-col--7" role="region" aria-label="Data visualization palette">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Constant across all 12 accents</span>
              <h2 className="ax-card__title">Data-viz palette</h2>
              <p className="ax-card__subtitle">The six categorical chart colors stay fixed so series keep their identity when the accent changes.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {VIZ.map((v) => (
              <button key={v[0]} type="button" className="ax-cluster" onClick={() => copy(v[0])}
                style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'transparent', cursor: 'pointer', width: '100%', textAlign: 'start' }}
                aria-label={`Copy ${v[0]}`}>
                <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                  <span aria-hidden="true" style={{ flex: '0 0 auto', width: 46, height: 26, borderRadius: 'var(--ax-radius-sm)', background: `var(${v[0]})`, boxShadow: '0 0 0 1px var(--ax-border-strong) inset' }} />
                  <b style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)', fontSize: 'var(--ax-text-sm)' }}>{v[1]}</b>
                </span>
                <span style={{ textAlign: 'end' }}>
                  <span style={{ display: 'block', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{v[2]}</span>
                  <code className="ax-code" style={{ background: 'transparent', padding: 0, fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-muted)' }}>{flash === v[0] ? 'Copied!' : v[0]}</code>
                </span>
              </button>
            ))}
            <div aria-hidden="true" style={{ display: 'flex', height: 10, borderRadius: 'var(--ax-radius-pill)', overflow: 'hidden', marginTop: 'var(--ax-space-2)' }}>
              {VIZ.map((v) => <i key={v[0]} style={{ flex: 1, background: `var(${v[0]})` }} />)}
            </div>
          </div>
        </section>

        {/* Accent ramp */}
        <section className="ax-card ax-col--5" role="region" aria-label="Accent ramp">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Theme-aware</span>
              <h2 className="ax-card__title">Accent ramp</h2>
              <p className="ax-card__subtitle">Switch presets in the customizer — this whole ramp re-derives live.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', border: '1px solid var(--ax-border)' }}>
              {RAMP.map((n) => {
                const token = `--ax-accent-${n}`;
                return (
                  <button key={n} type="button" onClick={() => copy(token)} className="ax-cluster"
                    style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-2)', height: 34, padding: '0 var(--ax-space-4)', border: 0, cursor: 'pointer', textAlign: 'start', background: `var(--ax-accent-${n})`, color: n >= 400 ? '#fff' : 'var(--ax-text-strong)' }}
                    aria-label={`Copy ${token}`}>
                    <span style={{ fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-medium)' }}>{`accent-${n}`}</span>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', opacity: 0.85 }}>{flash === token ? 'Copied!' : n}</span>
                  </button>
                );
              })}
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
              <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill">--ax-accent</span>
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ background: 'var(--ax-accent-wash)' }}>--ax-accent-wash</span>
              <span className="ax-badge ax-badge--outline ax-badge--pill" style={{ color: 'var(--ax-link)' }}>--ax-link</span>
            </div>
          </div>
        </section>

        {/* Usage note */}
        <section className="ax-card ax-col--12" role="region" aria-label="Token usage guidance">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-alert ax-alert--accent ax-alert--accent-edge">
              <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /><path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
              <div className="ax-alert__content">
                <p className="ax-alert__title">Never hard-code a hex</p>
                <p className="ax-alert__message">Reference a role token — <code className="ax-code">color:var(--ax-text-muted)</code>, <code className="ax-code">background:var(--ax-surface)</code>, <code className="ax-code">border-color:var(--ax-border)</code>. That single rule is what makes light, dark and all 12 accent presets work with zero per-component overrides.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Colors;
