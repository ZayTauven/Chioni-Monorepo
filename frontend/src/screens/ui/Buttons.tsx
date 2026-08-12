'use client';
/*
 * Vireo Next.js — UI · Buttons (route "ui/buttons").
 *
 * Faithful re-expression of src/html/ui/buttons.html: variants, pills, semantic
 * tones, sizes, icon buttons, the loading state (Alpine saving toggle → React
 * state), block/disabled and the full variant × tone matrix. DOM classes /
 * ARIA / copy match the reference 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const PLUS = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>;
const ROW: React.CSSProperties = { paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', alignItems: 'center' };

function LoadingSection() {
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = () => {
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaving(false), 2200);
  };
  return (
    <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', alignItems: 'center' }}>
        <button type="button" className="ax-btn ax-btn--primary is-loading">
          <span className="ax-btn__spinner" aria-hidden="true" />
          <span className="ax-btn__label">Saving…</span>
        </button>
        <button type="button" className="ax-btn ax-btn--secondary is-loading">
          <span className="ax-btn__spinner" aria-hidden="true" />
          <span className="ax-btn__label">Loading</span>
        </button>
        <button type="button" className="ax-btn ax-btn--solid ax-btn--icon is-loading" aria-label="Syncing">
          <span className="ax-btn__spinner" aria-hidden="true" />
        </button>
      </div>
      <button type="button" className={`ax-btn ax-btn--primary ax-btn--block${saving ? ' is-loading' : ''}`} onClick={save} aria-busy={saving}>
        <span className="ax-btn__spinner" aria-hidden="true" />
        {!saving && <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>}
        <span className="ax-btn__label">{saving ? 'Saving changes…' : 'Click to save'}</span>
      </button>
    </div>
  );
}

const MATRIX: { variant: string; cls: string }[] = [
  { variant: 'Primary', cls: 'ax-btn--primary' },
  { variant: 'Solid', cls: 'ax-btn--solid' },
  { variant: 'Secondary', cls: 'ax-btn--secondary' },
  { variant: 'Ghost', cls: 'ax-btn--ghost' },
];
const TONES = ['', 'ax-btn--success', 'ax-btn--warning', 'ax-btn--danger', 'ax-btn--info'];

export function Buttons() {
  return (
    <>
      <PageHead
        title="Buttons"
        subtitle="The full action vocabulary — variants, tones, sizes, icon, loading, block & disabled. Every fill is a role token, so all 12 accents retheme for free."
        actions={
          <>
            <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/button-group">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></svg>
              <span className="ax-btn__label">Button groups</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary">{PLUS}<span className="ax-btn__label">Primary action</span></button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Variants */}
        <section className="ax-card ax-col--6" role="region" aria-label="Button variants">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Hierarchy</span>
              <h2 className="ax-card__title">Variants</h2>
              <p className="ax-card__subtitle">One primary per view; secondary, tonal &amp; ghost carry the rest.</p>
            </div>
          </div>
          <div className="ax-card__body" style={ROW}>
            <button type="button" className="ax-btn ax-btn--primary"><span className="ax-btn__label">Primary</span></button>
            <button type="button" className="ax-btn ax-btn--solid"><span className="ax-btn__label">Solid</span></button>
            <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Secondary</span></button>
            <button type="button" className="ax-btn ax-btn--tonal"><span className="ax-btn__label">Tonal</span></button>
            <button type="button" className="ax-btn ax-btn--ghost"><span className="ax-btn__label">Ghost</span></button>
            <button type="button" className="ax-btn ax-btn--link"><span className="ax-btn__label">Link</span></button>
          </div>
        </section>

        {/* Pills */}
        <section className="ax-card ax-col--6" role="region" aria-label="Pill buttons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Shape</span>
              <h2 className="ax-card__title">Pill buttons</h2>
              <p className="ax-card__subtitle">Fully-rounded variant for filter bars &amp; toolbars.</p>
            </div>
          </div>
          <div className="ax-card__body" style={ROW}>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--pill"><span className="ax-btn__label">Primary</span></button>
            <button type="button" className="ax-btn ax-btn--solid ax-btn--pill"><span className="ax-btn__label">Solid</span></button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill"><span className="ax-btn__label">Secondary</span></button>
            <button type="button" className="ax-btn ax-btn--tonal ax-btn--pill"><span className="ax-btn__label">Tonal</span></button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 5.5l9 9" /><path d="M4 7v-3h3" /><path d="M9 20h-5v-5" /><path d="M16 4h4v4" /><path d="M14.5 14.5l5.5 5.5" /></svg>
              <span className="ax-btn__label">Reset</span>
            </button>
          </div>
        </section>

        {/* Semantic tones */}
        <section className="ax-card ax-col--12" role="region" aria-label="Semantic tone buttons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Semantic</span>
              <h2 className="ax-card__title">Tones</h2>
              <p className="ax-card__subtitle">Status-bound actions — solid for confirm flows, soft for low-stakes inline use.</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Pair color with a glyph — never color alone</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', alignItems: 'center' }}>
              <button type="button" className="ax-btn ax-btn--success ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg><span className="ax-btn__label">Approve</span></button>
              <button type="button" className="ax-btn ax-btn--warning ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg><span className="ax-btn__label">Flag review</span></button>
              <button type="button" className="ax-btn ax-btn--danger ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg><span className="ax-btn__label">Delete</span></button>
              <button type="button" className="ax-btn ax-btn--info ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg><span className="ax-btn__label">Details</span></button>
              <button type="button" className="ax-btn ax-btn--neutral ax-btn--solid"><span className="ax-btn__label">Neutral</span></button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', alignItems: 'center' }}>
              <button type="button" className="ax-btn ax-btn--soft-success"><span className="ax-btn__label">Soft success</span></button>
              <button type="button" className="ax-btn ax-btn--soft-warning"><span className="ax-btn__label">Soft warning</span></button>
              <button type="button" className="ax-btn ax-btn--soft-danger"><span className="ax-btn__label">Soft danger</span></button>
              <button type="button" className="ax-btn ax-btn--soft-info"><span className="ax-btn__label">Soft info</span></button>
              <button type="button" className="ax-btn ax-btn--success ax-btn--secondary"><span className="ax-btn__label">Success outline</span></button>
              <button type="button" className="ax-btn ax-btn--danger ax-btn--ghost"><span className="ax-btn__label">Danger ghost</span></button>
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="ax-card ax-col--6" role="region" aria-label="Button sizes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Density</span>
              <h2 className="ax-card__title">Sizes</h2>
              <p className="ax-card__subtitle">32 / 38 / 44px control heights for compact rows up to hero CTAs.</p>
            </div>
          </div>
          <div className="ax-card__body" style={ROW}>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--sm">{PLUS}<span className="ax-btn__label">Small</span></button>
            <button type="button" className="ax-btn ax-btn--primary">{PLUS}<span className="ax-btn__label">Default</span></button>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--lg">{PLUS}<span className="ax-btn__label">Large</span></button>
          </div>
        </section>

        {/* With icons */}
        <section className="ax-card ax-col--6" role="region" aria-label="Buttons with icons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Affordance</span>
              <h2 className="ax-card__title">Leading &amp; trailing icons</h2>
              <p className="ax-card__subtitle">16px Tabler glyphs, optical gap, decorative &amp; aria-hidden.</p>
            </div>
          </div>
          <div className="ax-card__body" style={ROW}>
            <button type="button" className="ax-btn ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Export CSV</span></button>
            <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Continue</span><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg></button>
            <button type="button" className="ax-btn ax-btn--tonal"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg><span className="ax-btn__label">Mark done</span><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg></button>
          </div>
        </section>

        {/* Icon-only */}
        <section className="ax-card ax-col--6" role="region" aria-label="Icon-only buttons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Compact</span>
              <h2 className="ax-card__title">Icon-only</h2>
              <p className="ax-card__subtitle">Square hit-target; each carries an <code className="ax-code">aria-label</code>.</p>
            </div>
          </div>
          <div className="ax-card__body" style={ROW}>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--icon" aria-label="Add item">{PLUS}</button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Edit"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" /><path d="M16 5l3 3" /></svg></button>
            <button type="button" className="ax-btn ax-btn--tonal ax-btn--icon" aria-label="Share"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M18 6a3 3 0 1 0 0 -.001" /><path d="M18 18a3 3 0 1 0 0 .001" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /></svg></button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="More options"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg></button>
            <button type="button" className="ax-btn ax-btn--danger ax-btn--ghost ax-btn--icon" aria-label="Delete"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--pill" aria-label="Favorite"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></button>
          </div>
        </section>

        {/* Loading */}
        <section className="ax-card ax-col--6" role="region" aria-label="Loading buttons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Async</span>
              <h2 className="ax-card__title">Loading state</h2>
              <p className="ax-card__subtitle">Spinner replaces the label, width preserved, clicks blocked.</p>
            </div>
          </div>
          <LoadingSection />
        </section>

        {/* Block / disabled */}
        <section className="ax-card ax-col--6" role="region" aria-label="Block and disabled buttons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Layout &amp; states</span>
              <h2 className="ax-card__title">Block &amp; disabled</h2>
              <p className="ax-card__subtitle">Full-width for forms; disabled removes glow &amp; blocks pointer.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 12l2 2l4 -4" /><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg><span className="ax-btn__label">Confirm &amp; continue</span></button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block"><span className="ax-btn__label">Save draft</span></button>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', alignItems: 'center', marginTop: 'var(--ax-space-1)' }}>
              <button type="button" className="ax-btn ax-btn--primary" disabled><span className="ax-btn__label">Disabled</span></button>
              <button type="button" className="ax-btn ax-btn--secondary" disabled><span className="ax-btn__label">Disabled</span></button>
              <button type="button" className="ax-btn ax-btn--ghost" aria-disabled="true"><span className="ax-btn__label">Inert</span></button>
              <button type="button" className="ax-btn ax-btn--icon ax-btn--secondary" disabled aria-label="Locked"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" /><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M8 11v-4a4 4 0 1 1 8 0v4" /></svg></button>
            </div>
          </div>
        </section>

        {/* Full matrix */}
        <section className="ax-card ax-col--12" role="region" aria-label="Button variant and tone matrix">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Reference</span>
              <h2 className="ax-card__title">Variant × tone matrix</h2>
              <p className="ax-card__subtitle">How every variant resolves against the accent and each semantic tone.</p>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table" style={{ minWidth: 680 }}>
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Variant</th>
                  <th className="ax-table__th" scope="col">Accent</th>
                  <th className="ax-table__th" scope="col">Success</th>
                  <th className="ax-table__th" scope="col">Warning</th>
                  <th className="ax-table__th" scope="col">Danger</th>
                  <th className="ax-table__th" scope="col">Info</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((m) => (
                  <tr key={m.variant} className="ax-table__row">
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{m.variant}</td>
                    {TONES.map((t, ti) => (
                      <td key={ti} className="ax-table__td"><button type="button" className={`ax-btn ${m.cls}${t ? ` ${t}` : ''} ax-btn--sm`}><span className="ax-btn__label">Action</span></button></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default Buttons;
