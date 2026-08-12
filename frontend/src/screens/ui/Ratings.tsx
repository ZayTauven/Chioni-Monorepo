'use client';
/*
 * Vireo Next.js — UI · Ratings (route "ui/ratings").
 *
 * Faithful re-expression of src/html/ui/ratings.html: read-only scores,
 * half-steps with a review summary, three sizes, and an interactive
 * radiogroup (Alpine rating/preview state → useState; hover preview, click to
 * set, arrow-key operable). DOM classes / ARIA / copy / star paths match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const FULL_D = 'M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z';
const EMPTY_D = 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245';
const HALF_D = 'M12 1a.993 .993 0 0 1 .823 .443l.067 .116l2.852 5.781l6.38 .925c.741 .108 1.08 .94 .703 1.526l-.07 .095l-.078 .086l-4.624 4.499l1.09 6.355a1.001 1.001 0 0 1 -1.249 1.135l-.101 -.035l-.101 -.046l-5.693 -3l-5.706 3c-.105 .055 -.212 .09 -.32 .106l-.106 .01a1.003 1.003 0 0 1 -1.038 -1.06l.013 -.11l1.09 -6.355l-4.623 -4.5a1.001 1.001 0 0 1 .328 -1.647l.113 -.036l.114 -.023l6.379 -.925l2.853 -5.78a.968 .968 0 0 1 .904 -.56zm0 3.274v12.476a1 1 0 0 1 .239 .029l.115 .036l.112 .05l4.363 2.299l-.836 -4.873a1 1 0 0 1 .136 -.696l.07 -.099l.082 -.09l3.546 -3.453l-4.891 -.708a1 1 0 0 1 -.62 -.344l-.073 -.097l-.06 -.106l-2.183 -4.424z';

const FullStar = () => (
  <svg className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}><path d={FULL_D} /></svg>
);
const EmptyStar = () => (
  <svg className="ax-rating__star" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={EMPTY_D} /></svg>
);
const HalfStar = () => (
  <svg className="ax-rating__star ax-rating__star--half" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}><path d={HALF_D} /></svg>
);

const MUTED: React.CSSProperties = { fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' };
const LABELS = ['', 'Terrible', 'Poor', 'OK', 'Good', 'Excellent'];
const HISTOGRAM = [
  { star: '5', pct: 72, count: '389' },
  { star: '4', pct: 20, count: '108' },
  { star: '3', pct: 6, count: '31' },
  { star: '2', pct: 2, count: '9' },
  { star: '1', pct: 1, count: '3' },
];

function StaticRating({ full, half = false, empty, value, label, sizeClass = '' }: { full: number; half?: boolean; empty: number; value?: string; label: string; sizeClass?: string }) {
  return (
    <span className={`ax-rating${sizeClass}`} role="img" aria-label={label}>
      {Array.from({ length: full }).map((_, i) => <FullStar key={`f${i}`} />)}
      {half && <HalfStar />}
      {Array.from({ length: empty }).map((_, i) => <EmptyStar key={`e${i}`} />)}
      {value && <span className="ax-rating__value ax-num">{value}</span>}
    </span>
  );
}

export function Ratings() {
  const [rating, setRating] = useState(0);
  const [preview, setPreview] = useState(0);
  const shown = preview || rating;

  return (
    <>
      <PageHead
        title="Ratings"
        subtitle="Star ratings — read-only, interactive, half-steps and three sizes."
        actions={
          <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/ecommerce/product-details#reviews">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg>
            <span className="ax-btn__label">Reviews</span>
          </a>
        }
      />

      <div className="ax-dash-grid">
        {/* Read-only */}
        <section className="ax-card ax-col--6" role="region" aria-label="Read-only ratings">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Static</span>
              <h2 className="ax-card__title">Read-only</h2>
              <p className="ax-card__subtitle">Display a stored score with an optional numeric value.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Brass Task Light</span>
              <StaticRating full={5} empty={0} value="4.9" label="Rated 5 out of 5" />
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Aperture Desk Lamp</span>
              <StaticRating full={4} empty={1} value="4.0" label="Rated 4 out of 5" />
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Cork Desk Mat</span>
              <StaticRating full={3} empty={2} value="3.0" label="Rated 3 out of 5" />
            </div>
          </div>
        </section>

        {/* Half steps */}
        <section className="ax-card ax-col--6" role="region" aria-label="Half-step ratings">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Precision</span>
              <h2 className="ax-card__title">Half Steps</h2>
              <p className="ax-card__subtitle">A half-filled star renders fractional averages accurately.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Matte Ceramic Mug</span>
              <StaticRating full={4} half empty={0} value="4.5" label="Rated 4.5 out of 5" />
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Felt Laptop Sleeve</span>
              <StaticRating full={3} half empty={1} value="3.5" label="Rated 3.5 out of 5" />
            </div>

            <div className="ax-divider" style={{ marginBlock: 'var(--ax-space-1)' }} />
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'nowrap' }}>
              <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, lineHeight: 1, color: 'var(--ax-text-strong)' }}>4.6</div>
                <span className="ax-rating ax-rating--sm" role="img" aria-label="Average 4.6 out of 5" style={{ marginTop: 'var(--ax-space-1)' }}>
                  <FullStar /><FullStar /><FullStar /><FullStar /><HalfStar />
                </span>
              </div>
              <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                {HISTOGRAM.map((h) => (
                  <div key={h.star} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                    <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', width: '1.2ch' }}>{h.star}</small>
                    <div className="ax-progress ax-progress--xs"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${h.pct}%`, background: 'var(--ax-warning-500)' }} /></div></div>
                    <small className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)', width: '4ch', textAlign: 'end' }}>{h.count}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="ax-card ax-col--6" role="region" aria-label="Rating sizes">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Scale</span>
              <h2 className="ax-card__title">Sizes</h2>
              <p className="ax-card__subtitle">Small, default and large stars.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Small · sm</span>
              <StaticRating full={4} empty={1} label="4 out of 5" sizeClass=" ax-rating--sm" />
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Default</span>
              <StaticRating full={4} empty={1} label="4 out of 5" />
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={MUTED}>Large · lg</span>
              <StaticRating full={4} empty={1} label="4 out of 5" sizeClass=" ax-rating--lg" />
            </div>
          </div>
        </section>

        {/* Interactive */}
        <section className="ax-card ax-col--6" role="region" aria-label="Interactive rating">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Input</span>
              <h2 className="ax-card__title">Interactive</h2>
              <p className="ax-card__subtitle">Hover to preview, click to set — fully keyboard operable.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: '0 0 var(--ax-space-3)' }}>How was your experience?</p>
            <div className="ax-rating ax-rating--input ax-rating--lg" role="radiogroup" aria-label="Rate your experience" onMouseLeave={() => setPreview(0)}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = preview ? n <= preview : n <= rating;
                return (
                  <button
                    key={n}
                    type="button"
                    className={`ax-rating__star${n <= rating ? ' is-selected' : ''}${preview && n <= preview ? ' is-preview' : ''}`}
                    role="radio"
                    aria-checked={n === rating}
                    aria-label={`${n}${n === 1 ? ' star' : ' stars'}`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setPreview(n)}
                    onFocus={() => setPreview(n)}
                    onBlur={() => setPreview(0)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') { e.preventDefault(); setRating(Math.min(5, rating + 1)); }
                      else if (e.key === 'ArrowLeft') { e.preventDefault(); setRating(Math.max(1, rating - 1)); }
                    }}
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  >
                    {filled ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: '100%', height: '100%', fill: 'currentColor' }}><path d={FULL_D} /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: '100%', height: '100%' }}><path d={EMPTY_D} /></svg>
                    )}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 'var(--ax-text-sm)', minHeight: '1.4em', margin: 'var(--ax-space-4) 0 0', color: 'var(--ax-text)' }}>
              {shown ? (
                <span>You selected <b style={{ color: 'var(--ax-accent)' }}>{shown} — {LABELS[shown]}</b></span>
              ) : (
                <span style={{ color: 'var(--ax-text-subtle)' }}>Tap a star to rate.</span>
              )}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export default Ratings;
