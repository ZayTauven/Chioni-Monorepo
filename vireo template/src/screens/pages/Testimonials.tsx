'use client';
/*
 * Vireo Next.js — Pages / Testimonials (route "pages/testimonials").
 *
 * Faithful re-expression of src/html/pages/testimonials.html: a featured quote,
 * role filter chips (all/founder/engineer/designer/pm), a masonry wall of rated
 * testimonial cards and a logo strip. The Alpine `{ filter }` x-data is ported to
 * useState; the masonry CSS is inlined via a scoped <style>. DOM/classes/ARIA
 * match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const QUOTE_ICON = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /></svg>
);
const STAR_PATH = 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';

function Stars({ value, sm }: { value: number; sm?: boolean }) {
  return (
    <span className={`ax-rating${sm ? ' ax-rating--sm' : ''}`} aria-label={`Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= value ? (
          <svg key={i} className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d={STAR_PATH} /></svg>
        ) : (
          <svg key={i} className="ax-rating__star" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d={STAR_PATH} /></svg>
        ),
      )}
    </span>
  );
}

type Filter = 'all' | 'founder' | 'engineer' | 'designer' | 'pm';
interface Quote { role: Filter; rating: number; init: string; tint: string; name: string; title: string; text: string; }

const QUOTES: Quote[] = [
  { role: 'engineer', rating: 5, init: 'MB', tint: 'var(--ax-viz-cyan)', name: 'Marcus Bell', title: 'Staff Engineer · Quanta', text: "The component library is genuinely the best I've used. Tokens are clean, dark mode just works, and the charts re-theme with the accent automatically. Saved us weeks." },
  { role: 'founder', rating: 5, init: 'PA', tint: 'var(--ax-viz-pink)', name: 'Priya Anand', title: 'Co-founder & CEO · Cadence', text: 'We launched our SaaS admin on Vireo and closed our first enterprise deal partly because the product looked so polished in the demo. It punches way above a template.' },
  { role: 'designer', rating: 4, init: 'TR', tint: 'var(--ax-viz-amber)', name: 'Tom Riley', title: 'Lead Product Designer · Vellum', text: "As a designer I'm picky about spacing and type. Vireo is the first template where I didn't immediately want to rip out the styles. The Aurora glass is tasteful." },
  { role: 'pm', rating: 5, init: 'SC', tint: 'var(--ax-viz-emerald)', name: 'Sofia Castellano', title: 'Group PM · Helio', text: 'Onboarding new PMs is so much faster now — every internal tool shares the same Vireo shell, so people already know where everything lives.' },
  { role: 'engineer', rating: 5, init: 'DO', tint: 'var(--ax-viz-cyan)', name: 'Daniel Okonkwo', title: 'Frontend Lead · Brightside', text: "The Vite + Tailwind v4 setup is exactly how I'd build it myself. No fighting the framework. I added a custom dashboard in an afternoon and it felt native." },
  { role: 'founder', rating: 5, init: 'HL', tint: 'var(--ax-viz-violet)', name: 'Hannah Lindqvist', title: 'Founder · Tideway', text: "Support has been outstanding — a real engineer answered my edge-case question within hours with a working snippet. That's rare for a one-time purchase." },
  { role: 'designer', rating: 5, init: 'KW', tint: 'var(--ax-viz-pink)', name: 'Kenji Watanabe', title: 'Design Systems · Pace', text: '12 accent presets and they all stay accessible. I switched our brand to teal in one click and every chart, badge and button followed. Honestly delightful.' },
  { role: 'pm', rating: 4, init: 'GM', tint: 'var(--ax-viz-amber)', name: 'Grace Mwangi', title: 'Senior PM · Loftworks', text: 'The breadth is impressive — 17 dashboards, e-commerce, CRM, all consistent. We picked the analytics dashboard as our starting point and barely changed a thing.' },
];

const CHIPS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'founder', label: 'Founders' },
  { id: 'engineer', label: 'Engineers' },
  { id: 'designer', label: 'Designers' },
  { id: 'pm', label: 'Product' },
];

const LOGOS: { name: string; path: React.ReactNode }[] = [
  { name: 'Northwind', path: <path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9z" /> },
  { name: 'Cadence', path: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 3v18" /></> },
  { name: 'Vellum', path: <><path d="M4 4l16 0l0 16l-16 0z" /><path d="M9 9l6 6" /></> },
  { name: 'Helio', path: <path d="M12 3l9 17l-18 0z" /> },
  { name: 'Tideway', path: <><path d="M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M12 5v14" /></> },
  { name: 'Brightside', path: <><path d="M4 7l8 -4l8 4l-8 4z" /><path d="M4 7v10l8 4l8 -4v-10" /></> },
];

export function Testimonials() {
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <>
      <PageHead
        title="Testimonials"
        subtitle="What product teams, founders and engineers say about building on Vireo."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary" href="#"><span className="ax-btn__label">See pricing</span></a>
            <button type="button" className="ax-btn ax-btn--primary">{QUOTE_ICON}<span className="ax-btn__label">Share your story</span></button>
          </>
        }
      />

      {/* Featured quote */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12 ax-card--accent-edge" role="region" aria-label="Featured testimonial">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', padding: 'var(--ax-space-8)' }}>
            <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="var(--ax-accent)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.9 }}><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /></svg>
            <blockquote style={{ margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', lineHeight: 1.5, color: 'var(--ax-text-strong)', fontWeight: 500, maxWidth: '60ch' }}>
              Vireo replaced three separate tools for us. The Aurora design system meant we shipped a fully branded admin in a weekend, not a quarter — and our customers actually compliment the dashboards now.
            </blockquote>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
              <span className="ax-avatar ax-avatar--lg ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 22%,transparent)', color: 'var(--ax-viz-violet)' }}><span className="ax-avatar__initials">EM</span></span>
              <div style={{ flex: '1 1 auto' }}>
                <p style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Elena Márquez</p>
                <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>VP Engineering · Northwind Labs</p>
              </div>
              <Stars value={5} />
            </div>
          </div>
        </section>
      </div>

      {/* Filter chips */}
      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap', marginBlock: 'var(--ax-space-6) var(--ax-space-5)' }} role="group" aria-label="Filter testimonials by role">
        {CHIPS.map((c) => (
          <button key={c.id} type="button" className={`ax-btn ax-btn--pill ax-btn--sm ${filter === c.id ? 'ax-btn--primary' : 'ax-btn--secondary'}`} onClick={() => setFilter(c.id)}>{c.label}</button>
        ))}
      </div>

      {/* Masonry wall */}
      <div className="ax-masonry">
        {QUOTES.map((q) => (
          (filter === 'all' || filter === q.role) && (
            <article key={q.name} className="ax-card" role="region" aria-label={`Testimonial from ${q.name}`}>
              <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <Stars value={q.rating} sm />
                <p style={{ color: 'var(--ax-text)', lineHeight: 1.65, fontSize: 'var(--ax-text-md)' }}>{q.text}</p>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'center' }}>
                  <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${q.tint} 22%,transparent)`, color: q.tint }}><span className="ax-avatar__initials">{q.init}</span></span>
                  <div><p style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{q.name}</p><p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{q.title}</p></div>
                </div>
              </div>
            </article>
          )
        ))}
      </div>

      {/* Logo strip */}
      <div className="ax-dash-grid" style={{ marginBlockStart: 'var(--ax-space-8)' }}>
        <section className="ax-card ax-col--12" role="region" aria-label="Companies building on Vireo">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-5)', paddingBlock: 'var(--ax-space-7)' }}>
            <p className="ax-eyebrow" style={{ textAlign: 'center' }}>Trusted by teams at</p>
            <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-8)', flexWrap: 'wrap', color: 'var(--ax-text-subtle)' }}>
              {LOGOS.map((l) => (
                <span key={l.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontWeight: 700, fontSize: 'var(--ax-text-lg)' }}>
                  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{l.path}</svg>{l.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .ax-masonry { column-count: 1; column-gap: var(--ax-space-6); }
        .ax-masonry > .ax-card { break-inside: avoid; margin-bottom: var(--ax-space-6); display: inline-block; width: 100%; }
        @media (min-width: 768px)  { .ax-masonry { column-count: 2; } }
        @media (min-width: 1200px) { .ax-masonry { column-count: 3; } }
      `}</style>
    </>
  );
}

export default Testimonials;
