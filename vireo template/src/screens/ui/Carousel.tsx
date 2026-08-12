'use client';
/*
 * Vireo Next.js — UI · Carousel (route "ui/carousel").
 *
 * Faithful re-expression of src/html/ui/carousel.html: a hero carousel (arrows +
 * dots + autoplay + pause-on-hover + arrow-key nav), a fade/thumbnail product
 * gallery, and a multi-slide scroll-snap testimonial track with paging dots.
 * The Alpine x-data (i/playing/timer, slides, page/scroll) is re-implemented with
 * React state/refs; reduced-motion is respected. DOM classes / ARIA / copy match 1:1.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

/* ───────────────────────── Hero carousel ───────────────────────── */
interface Slide {
  badge: string;
  badgeClass: string;
  title: string;
  body: string;
  bg: string;
}
const HERO_SLIDES: Slide[] = [
  {
    badge: 'New release',
    badgeClass: 'ax-badge--accent',
    title: 'Vireo 3.0 is here',
    body: 'Twelve Aurora accents, a live customizer and 200+ pages — shipped.',
    bg: 'linear-gradient(120deg,color-mix(in oklab,var(--ax-viz-violet) 34%,var(--ax-surface)),color-mix(in oklab,var(--ax-viz-cyan) 26%,var(--ax-surface)))',
  },
  {
    badge: 'Workshop',
    badgeClass: 'ax-badge--warning',
    title: 'Data-viz that retheme live',
    body: 'Switch accent or mode and every chart re-colours in 200ms — no reload.',
    bg: 'linear-gradient(120deg,color-mix(in oklab,var(--ax-viz-amber) 32%,var(--ax-surface)),color-mix(in oklab,var(--ax-viz-pink) 28%,var(--ax-surface)))',
  },
  {
    badge: 'Performance',
    badgeClass: 'ax-badge--success',
    title: '98 Lighthouse, zero jank',
    body: 'Lazy-loaded plugins and token-only styling keep the bundle lean.',
    bg: 'linear-gradient(120deg,color-mix(in oklab,var(--ax-viz-emerald) 32%,var(--ax-surface)),color-mix(in oklab,var(--ax-viz-cyan) 24%,var(--ax-surface)))',
  },
];

function Hero() {
  const total = HERO_SLIDES.length;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const go = (n: number) => setI((n + total) % total);
  const next = () => setI((cur) => (cur + 1 + total) % total);
  const prev = () => setI((cur) => (cur - 1 + total) % total);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      if (playingRef.current) next();
    }, 4500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      className="ax-card ax-col--8"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured announcements"
      style={{ alignSelf: 'start' }}
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      }}
      tabIndex={0}
    >
      <div className="ax-card__media" style={{ position: 'relative' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-xl) var(--ax-radius-xl) 0 0' }}>
          {/* track */}
          <div style={{ display: 'flex', transition: 'transform var(--ax-motion-slow) var(--ax-ease-standard)', transform: `translateX(-${i * 100}%)` }}>
            {HERO_SLIDES.map((s, n) => (
              <div key={n} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${total}`} style={{ flex: '0 0 100%' }}>
                <div className="ax-ratio" style={{ '--ax-ratio': '16/7', borderRadius: 0, background: s.bg, display: 'flex', alignItems: 'flex-end' } as React.CSSProperties}>
                  <div style={{ padding: 'var(--ax-space-7)' }}>
                    <span className={`ax-badge ax-badge--solid ${s.badgeClass} ax-badge--pill`} style={{ marginBottom: 'var(--ax-space-3)' }}>{s.badge}</span>
                    <h2 style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{s.title}</h2>
                    <p style={{ margin: 'var(--ax-space-1) 0 0', color: 'var(--ax-text-muted)', maxWidth: '46ch' }}>{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* arrows */}
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" onClick={prev} aria-label="Previous slide" style={{ position: 'absolute', insetBlockStart: '50%', insetInlineStart: 'var(--ax-space-4)', transform: 'translateY(-50%)' }}>
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
          </button>
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" onClick={next} aria-label="Next slide" style={{ position: 'absolute', insetBlockStart: '50%', insetInlineEnd: 'var(--ax-space-4)', transform: 'translateY(-50%)' }}>
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
          </button>
        </div>
      </div>
      {/* dots + autoplay control */}
      <div className="ax-card__footer">
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }} role="tablist" aria-label="Choose slide">
          {HERO_SLIDES.map((_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => go(n)}
              role="tab"
              aria-selected={i === n}
              aria-label={`Go to slide ${n + 1}`}
              style={{ width: i === n ? '22px' : '8px', height: '8px', borderRadius: 'var(--ax-radius-pill)', border: 0, cursor: 'pointer', transition: 'all var(--ax-motion-base) var(--ax-ease-standard)', background: i === n ? 'var(--ax-accent)' : 'var(--ax-border-strong)' }}
            />
          ))}
        </div>
        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause autoplay' : 'Resume autoplay'} style={{ marginInlineStart: 'auto' }}>
          {playing ? (
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5v14" /><path d="M14 5v14" /></svg>
          ) : (
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg>
          )}
        </button>
        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{`${i + 1} / ${total}`}</span>
      </div>
    </section>
  );
}

/* ───────────────────────── Fade / thumbnail gallery ───────────────────────── */
interface GallerySlide { n: string; m: string; c1: string; c2: string; }
const GALLERY: GallerySlide[] = [
  { n: 'Aperture Desk Lamp', m: 'Lighting · $129', c1: 'var(--ax-viz-amber)', c2: 'var(--ax-viz-pink)' },
  { n: 'Walnut Monitor Riser', m: 'Desk · $96', c1: 'var(--ax-viz-emerald)', c2: 'var(--ax-viz-cyan)' },
  { n: 'Matte Ceramic Mug', m: 'Drinkware · $24', c1: 'var(--ax-viz-violet)', c2: 'var(--ax-viz-cyan)' },
];

function Gallery() {
  const [i, setI] = useState(0);
  return (
    <section className="ax-card ax-col--4" role="region" aria-roledescription="carousel" aria-label="Product gallery">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Fade · thumbnails</span>
          <h2 className="ax-card__title">Product gallery</h2>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
        {/* fading stage */}
        <div style={{ position: 'relative' }}>
          <div className="ax-ratio" style={{ '--ax-ratio': '4/3' } as React.CSSProperties}>
            {GALLERY.map((s, n) => (
              <div
                key={n}
                className="ax-grid"
                style={{ position: 'absolute', inset: 0, placeItems: 'center', background: `linear-gradient(135deg,color-mix(in oklab,${s.c1} 30%,var(--ax-surface)),color-mix(in oklab,${s.c2} 24%,var(--ax-surface)))`, opacity: i === n ? 1 : 0, transition: 'opacity 350ms var(--ax-ease-standard)', pointerEvents: i === n ? 'auto' : 'none' }}
              >
                <svg viewBox="0 0 24 24" width={48} height={48} fill="none" stroke="var(--ax-text-strong)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.8 }}><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M9 9a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M21 15l-5 -5l-9 9" /></svg>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{GALLERY[i].n}</div>
          <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{GALLERY[i].m}</div>
        </div>
        {/* thumbnails */}
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
          {GALLERY.map((s, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setI(n)}
              aria-label={`View ${s.n}`}
              aria-current={i === n}
              style={{ flex: 1, height: '48px', borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', background: `linear-gradient(135deg,color-mix(in oklab,${s.c1} 30%,var(--ax-surface)),color-mix(in oklab,${s.c2} 24%,var(--ax-surface)))`, border: `2px solid ${i === n ? 'var(--ax-accent)' : 'transparent'}` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Testimonial track ───────────────────────── */
interface Testimonial { rating: number; quote: string; initials: string; tone: string; name: string; role: string; }
const TESTIMONIALS: Testimonial[] = [
  { rating: 5, quote: 'We migrated our whole ops dashboard in a weekend. The customizer alone sold the team.', initials: 'AS', tone: 'var(--ax-viz-emerald)', name: 'Ava Sutton', role: 'Operations Lead' },
  { rating: 5, quote: "The dark theme is genuinely the best I've used. Charts stay legible at 2am.", initials: 'DO', tone: 'var(--ax-viz-cyan)', name: 'Devon Okafor', role: 'Backend Engineer' },
  { rating: 4, quote: 'Support replied in under an hour and the docs cover almost everything.', initials: 'PN', tone: 'var(--ax-viz-violet)', name: 'Priya Nair', role: 'Data Analyst' },
  { rating: 5, quote: 'Rolled it out to nine client portals. One codebase, nine brand accents. Done.', initials: 'TH', tone: 'var(--ax-viz-pink)', name: 'Tomás Herrera', role: 'Sales Director' },
  { rating: 5, quote: 'Accessibility is taken seriously — keyboard nav and focus states just work.', initials: 'ML', tone: 'var(--ax-viz-amber)', name: 'Mei Lin', role: 'Customer Success Lead' },
  { rating: 4, quote: 'Finance loves the invoice pages. Clean exports, mono numerals, tidy totals.', initials: 'JF', tone: 'var(--ax-viz-emerald)', name: 'Jonas Falk', role: 'Finance Manager' },
];

const STAR_FILLED = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
);
const STAR_EMPTY = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
);
function stars(rating: number): ReactElement[] {
  return Array.from({ length: 5 }, (_, n) => <span key={n}>{n < rating ? STAR_FILLED : STAR_EMPTY}</span>);
}

function Testimonials() {
  const pages = 2;
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  const scroll = (p: number) => {
    const t = trackRef.current;
    if (t) {
      const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      t.scrollTo({ left: p * t.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    }
    setPage(p);
  };

  return (
    <section className="ax-card ax-col--12" role="region" aria-roledescription="carousel" aria-label="Customer testimonials">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Multi-slide · scroll-snap</span>
          <h2 className="ax-card__title">What customers say</h2>
          <p className="ax-card__subtitle">Three cards per view, snap-scrolled</p>
        </div>
        <div className="ax-card__actions">
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--sm" onClick={() => scroll(Math.max(0, page - 1))} aria-disabled={page === 0} disabled={page === 0} aria-label="Previous testimonials">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
          </button>
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon ax-btn--sm" onClick={() => scroll(Math.min(pages - 1, page + 1))} aria-disabled={page === pages - 1} disabled={page === pages - 1} aria-label="Next testimonials">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
          </button>
        </div>
      </div>
      <div className="ax-card__body" style={{ paddingTop: 0 }}>
        <div ref={trackRef} className="ax-scroll" style={{ display: 'flex', gap: 'var(--ax-space-5)', overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 'var(--ax-space-2)' }}>
          {TESTIMONIALS.map((t, n) => (
            <figure key={n} style={{ flex: '0 0 calc(33.333% - var(--ax-space-5)*2/3)', minWidth: '240px', scrollSnapAlign: 'start', margin: 0, padding: 'var(--ax-space-5)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)' }}>
              <div className="ax-cluster" style={{ gap: '3px', color: 'var(--ax-viz-amber)', marginBottom: 'var(--ax-space-3)' }} aria-label={`Rated ${t.rating} of 5`}>
                {stars(t.rating)}
              </div>
              <blockquote style={{ margin: 0, color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>&quot;{t.quote}&quot;</blockquote>
              <figcaption className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-4)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${t.tone} 18%,transparent)`, color: t.tone }}>{t.initials}</span>
                <div>
                  <div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{t.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center', marginTop: 'var(--ax-space-4)' }} role="tablist" aria-label="Choose page">
          {Array.from({ length: pages }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => scroll(n)}
              role="tab"
              aria-selected={page === n}
              aria-label={`Page ${n + 1}`}
              style={{ width: page === n ? '22px' : '8px', height: '8px', borderRadius: 'var(--ax-radius-pill)', border: 0, cursor: 'pointer', transition: 'all var(--ax-motion-base) var(--ax-ease-standard)', background: page === n ? 'var(--ax-accent)' : 'var(--ax-border-strong)' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Carousel() {
  return (
    <>
      <PageHead
        title="Carousel"
        subtitle="Sliders the Aurora way — arrows, dots, autoplay, thumbnails and a multi-slide track."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/cards">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 14h18" /></svg>
            <span className="ax-btn__label">Cards</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        <Hero />
        <Gallery />
        <Testimonials />
      </div>
    </>
  );
}

export default Carousel;
