'use client';
/*
 * Vireo Next.js — UI · Tour & Coachmarks (route "ui/tour").
 *
 * Faithful re-expression of src/html/ui/tour.html: a spotlighted walkthrough that
 * dims the page and anchors a coachmark popover to each real [data-tour] element,
 * with progress dots, keyboard nav (←/→/Enter/Esc), a skip path and a completion
 * toast. The Alpine axUiTour() (spot/card geometry from getBoundingClientRect,
 * scrollIntoView, position on scroll/resize) is re-expressed with React state +
 * effects; reduced-motion honoured. DOM/classes/ARIA/copy match 1:1. The step-4
 * chart renders through <ApexChart>.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

interface Step { sel: string; title: string; body: string; }
const STEPS: Step[] = [
  { sel: '[data-tour="intro"]', title: 'Welcome aboard', body: 'This quick tour highlights the key surfaces of your workspace. It takes about thirty seconds.' },
  { sel: '[data-tour="search"]', title: 'Search everything', body: 'Press ⌘K from anywhere to jump to reports, people or orders. Try a name or a metric.' },
  { sel: '[data-tour="kpi"]', title: 'Your headline metrics', body: 'KPI cards summarise revenue, orders and customers at a glance. Each delta shows the trend versus last period.' },
  { sel: '[data-tour="chart"]', title: 'Track the trend', body: 'The revenue chart re-themes with your accent and works in light or dark. Hover any point for the exact figure.' },
  { sel: '[data-tour="checklist"]', title: 'Finish your setup', body: 'Complete these onboarding steps to unlock the full workspace. You can return here any time.' },
  { sel: '[data-tour="cta"]', title: 'Take the next step', body: "Connect a data source to populate your first live report. That's it — you're ready to go." },
];

const prefersReduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function Tour() {
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const [index, setIndex] = useState(0);
  const [seenCount, setSeenCount] = useState(0);
  const [spot, setSpot] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [card, setCard] = useState({ top: 0, left: 0 });
  const doneTimer = useRef<number | null>(null);

  const position = useCallback((idx: number) => {
    const el = document.querySelector(STEPS[idx].sel);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: prefersReduced() ? 'auto' : 'smooth' });
    const pad = 8;
    const r = el.getBoundingClientRect();
    setSpot({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    let top = r.bottom + 14;
    let left = r.left;
    const cardW = 320, cardH = 240;
    if (top + cardH > window.innerHeight) top = Math.max(16, r.top - cardH - 14);
    if (left + cardW > window.innerWidth) left = window.innerWidth - cardW - 16;
    setCard({ top: Math.max(16, top), left: Math.max(16, left) });
    setSeenCount((c) => Math.max(c, idx + 1));
  }, []);

  const start = () => { setIndex(0); setDone(false); setActive(true); requestAnimationFrame(() => position(0)); };
  const skip = useCallback(() => setActive(false), []);
  const finish = useCallback(() => {
    setActive(false); setDone(true);
    doneTimer.current = window.setTimeout(() => setDone(false), 4500);
  }, []);
  const next = useCallback(() => setIndex((i) => { if (i < STEPS.length - 1) { const ni = i + 1; requestAnimationFrame(() => position(ni)); return ni; } finish(); return i; }), [position, finish]);
  const prev = useCallback(() => setIndex((i) => { if (i > 0) { const pi = i - 1; requestAnimationFrame(() => position(pi)); return pi; } return i; }), [position]);

  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current); }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Enter') { e.preventDefault(); next(); }
    };
    const onMove = () => position(index);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [active, index, next, prev, skip, position]);

  return (
    <>
      <PageHead
        title="Tour & Coachmarks"
        subtitle="A spotlighted walkthrough that dims the page and anchors a coachmark to each real element — with progress, keyboard nav and a skip path."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={() => { if (active) skip(); }} disabled={active}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              <span className="ax-btn__label">{seenCount} of {STEPS.length} viewed</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" onClick={start}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg>
              <span className="ax-btn__label">Start tour</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* intro */}
        <section className="ax-card ax-col--4" data-tour="intro" role="region" aria-label="About the tour">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Walkthrough</span>
              <h2 className="ax-card__title">How it works</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <ul className="ax-list ax-list--compact" style={{ margin: 0 }}>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v.01" /><path d="M11 12h1v4h1" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title">A scrim dims everything</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>except the current target.</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title">Arrow keys move</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Esc skips, Enter advances.</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title">Honours reduced-motion</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>scroll &amp; fades stay instant.</span></span>
              </li>
            </ul>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block ax-btn--sm" onClick={start}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg>
              <span className="ax-btn__label">Take the tour</span>
            </button>
          </div>
        </section>

        {/* search */}
        <section className="ax-card ax-col--8" data-tour="search" role="region" aria-label="Global search">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Step 2</span>
              <h2 className="ax-card__title">Find anything, fast</h2>
              <p className="ax-card__subtitle">Search across reports, people, orders and settings.</p>
            </div>
            <div className="ax-card__actions">
              <span className="ax-kbd">⌘</span><span className="ax-kbd">K</span>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="tour-search">Search</label>
              <div style={{ position: 'relative' }}>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetBlockStart: '50%', insetInlineStart: 'var(--ax-space-3)', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input id="tour-search" type="search" className="ax-input" placeholder="Try “June revenue” or “Ava Sutton”…" style={{ paddingInlineStart: 'var(--ax-space-9)' }} autoComplete="off" />
              </div>
              <span className="ax-help">Results are scoped to your workspace.</span>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div className="ax-card ax-kpi" data-tour="kpi" role="region" aria-label="Total revenue">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>12.4%</span>
            </div>
            <div className="ax-kpi__label">Total Revenue</div>
            <div className="ax-kpi__value ax-num">$748.2K</div>
          </div>
        </div>
        <div className="ax-card ax-kpi" role="region" aria-label="Orders">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>8.1%</span>
            </div>
            <div className="ax-kpi__label">Orders</div>
            <div className="ax-kpi__value ax-num">1,248</div>
          </div>
        </div>
        <div className="ax-card ax-kpi" role="region" aria-label="Customers">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>3.1%</span>
            </div>
            <div className="ax-kpi__label">Customers</div>
            <div className="ax-kpi__value ax-num">3,920</div>
          </div>
        </div>

        {/* chart */}
        <section className="ax-card ax-card--chart ax-col--8" data-tour="chart" role="region" aria-label="Revenue trend">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Step 4</span>
              <h2 className="ax-card__title">Revenue trend</h2>
              <p className="ax-card__subtitle">Twelve months, re-themes with your accent</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="area" height={260} legend="none" accent ariaLabel="Area chart of monthly revenue" series={[{ name: 'Revenue', data: [42100, 48300, 45200, 53400, 57100, 55600, 62400, 60200, 68900, 72300, 70100, 74820] }]} />
          </div>
        </section>

        {/* checklist + CTA */}
        <section className="ax-card ax-col--4" data-tour="checklist" role="region" aria-label="Setup checklist">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Step 5</span>
              <h2 className="ax-card__title">Finish setup</h2>
              <p className="ax-card__subtitle"><span className="ax-num">2</span> of <span className="ax-num">4</span> done</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-progress ax-progress--sm" style={{ marginBottom: 'var(--ax-space-4)' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '50%' }} /></div></div>
            <ul className="ax-list ax-list--compact" style={{ margin: 0 }}>
              <li className="ax-list__row"><span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span></span><span className="ax-list__content"><span className="ax-list__title" style={{ textDecoration: 'line-through', color: 'var(--ax-text-muted)' }}>Create your workspace</span></span></li>
              <li className="ax-list__row"><span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span></span><span className="ax-list__content"><span className="ax-list__title" style={{ textDecoration: 'line-through', color: 'var(--ax-text-muted)' }}>Invite a teammate</span></span></li>
              <li className="ax-list__row"><span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /></svg></span></span><span className="ax-list__content"><span className="ax-list__title">Connect a data source</span></span></li>
              <li className="ax-list__row"><span className="ax-list__leading"><span className="ax-avatar ax-avatar--xs" style={{ background: 'var(--ax-fill-hover)', color: 'var(--ax-text-subtle)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span></span><span className="ax-list__content"><span className="ax-list__title">Publish your first report</span></span></li>
            </ul>
          </div>
          <div className="ax-card__footer" data-tour="cta">
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Connect a source</span></button>
          </div>
        </section>
      </div>

      {/* TOUR OVERLAY */}
      {active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80 }}>
          <div aria-hidden="true" style={{ position: 'absolute', borderRadius: 'var(--ax-radius-lg)', transition: 'all var(--ax-motion-base) var(--ax-ease-standard)', boxShadow: '0 0 0 9999px rgba(8,10,16,.62), 0 0 0 2px rgba(var(--ax-accent-rgb),.9)', top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />

          <div className="ax-popover" role="dialog" aria-modal="true" aria-labelledby="ui-tour-step-title" aria-live="polite"
            style={{ position: 'absolute', width: 320, maxWidth: 'calc(100vw - 32px)', transition: 'top var(--ax-motion-base) var(--ax-ease-standard), left var(--ax-motion-base) var(--ax-ease-standard)', top: card.top, left: card.left }}>
            <div className="ax-popover__panel" style={{ position: 'relative', left: 'auto', top: 'auto', width: '100%' }}>
              <div className="ax-popover__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ax-border)' }}>
                <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill ax-num"><span>{index + 1}</span> of <span>{STEPS.length}</span></span>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={skip} aria-label="Skip tour"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-popover__body">
                <h3 id="ui-tour-step-title" style={{ margin: '0 0 var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{STEPS[index].title}</h3>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>{STEPS[index].body}</p>
                <div className="ax-cluster" style={{ gap: 6, marginTop: 'var(--ax-space-4)' }} aria-hidden="true">
                  {STEPS.map((_s, di) => (
                    <span key={di} style={{ height: 7, transition: 'all var(--ax-motion-fast)', ...(di === index ? { background: 'var(--ax-accent)', width: 18, borderRadius: 'var(--ax-radius-pill)' } : { background: 'var(--ax-border-strong)', width: 7, borderRadius: '50%' }) }} />
                  ))}
                </div>
              </div>
              <div className="ax-popover__footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={skip}><span className="ax-btn__label">Skip</span></button>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={prev} disabled={index === 0}><span className="ax-btn__label">Back</span></button>
                  <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" onClick={next}><span className="ax-btn__label">{index === STEPS.length - 1 ? 'Done' : 'Next'}</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* completion toast */}
      {done && (
        <div className="ax-toast ax-toast--success" role="status" style={{ position: 'fixed', insetBlockEnd: 'var(--ax-space-6)', insetInlineEnd: 'var(--ax-space-6)', zIndex: 90, maxWidth: 340 }}>
          <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="var(--ax-success-500)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
          <div className="ax-toast__content"><p className="ax-toast__title">You&rsquo;re all set</p><p className="ax-toast__message">Tour complete — explore your dashboard.</p></div>
          <button type="button" className="ax-toast__dismiss" onClick={() => setDone(false)} aria-label="Dismiss" style={{ opacity: 1 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}
    </>
  );
}

export default Tour;
