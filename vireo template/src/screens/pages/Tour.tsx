'use client';
/*
 * Vireo Next.js — Pages / Tour (route "pages/tour").
 *
 * Faithful re-expression of src/html/pages/tour.html: a KPI + chart + checklist
 * page that a spotlighted, coachmark-driven product tour walks through. The
 * Alpine axTour() state machine (spotlight rect + popover positioning,
 * next/prev/skip/reset, first-run auto-start, localStorage persistence) is ported
 * to React state + effects. The revenue chart goes through <ApexChart>.
 * DOM/classes/ARIA match the reference 1:1.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

interface Step { sel: string; title: string; body: string; }
const STEPS: Step[] = [
  { sel: '[data-tour="kpi"]', title: 'Your headline metrics', body: 'These KPI cards summarise revenue, users and conversion at a glance. Each delta shows the trend versus last period.' },
  { sel: '[data-tour="chart"]', title: 'Track the trend', body: 'The revenue chart re-themes with your accent and works in light or dark. Hover any point for the exact figure.' },
  { sel: '[data-tour="checklist"]', title: 'Finish your setup', body: 'Complete these onboarding steps to unlock the full workspace. You can return here any time.' },
  { sel: '[data-tour="cta"]', title: 'Take the next step', body: "Connect a data source to populate your first live report. That's it — you're ready." },
];

const prefersReduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function Tour() {
  const [active, setActive] = useState(false);
  const [done, setDone] = useState(false);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [card, setCard] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  const position = useCallback(() => {
    const el = document.querySelector(STEPS[indexRef.current].sel) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: prefersReduced() ? 'auto' : 'smooth' });
    const pad = 8;
    const r = el.getBoundingClientRect();
    setSpot({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
    const margin = 16, gap = 14;
    const panel = cardRef.current?.querySelector('.ax-popover__panel') as HTMLElement | null;
    const measureEl = panel || cardRef.current;
    const cardW = measureEl ? measureEl.offsetWidth : 320;
    const cardH = measureEl ? measureEl.offsetHeight : 220;
    let top = r.bottom + gap;
    if (top + cardH + margin > window.innerHeight) {
      const above = r.top - cardH - gap;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - cardH - margin);
    }
    let left = r.left;
    if (left + cardW + margin > window.innerWidth) left = window.innerWidth - cardW - margin;
    setCard({ top: Math.max(margin, top), left: Math.max(margin, left) });
  }, []);

  const start = useCallback(() => {
    setIndex(0); indexRef.current = 0; setDone(false); setActive(true);
    requestAnimationFrame(() => position());
  }, [position]);

  const finish = useCallback(() => {
    setActive(false); setDone(true);
    try { localStorage.setItem('ax:tour:dashboard', 'done'); } catch { /* ignore */ }
    setTimeout(() => setDone(false), 4000);
  }, []);

  const next = useCallback(() => {
    if (indexRef.current < STEPS.length - 1) { const n = indexRef.current + 1; setIndex(n); indexRef.current = n; requestAnimationFrame(() => position()); }
    else finish();
  }, [position, finish]);

  const prev = useCallback(() => {
    if (indexRef.current > 0) { const n = indexRef.current - 1; setIndex(n); indexRef.current = n; requestAnimationFrame(() => position()); }
  }, [position]);

  const skip = useCallback(() => {
    setActive(false);
    try { localStorage.setItem('ax:tour:dashboard', 'skipped'); } catch { /* ignore */ }
  }, []);

  const reset = useCallback(() => {
    try { localStorage.removeItem('ax:tour:dashboard'); } catch { /* ignore */ }
    start();
  }, [start]);

  // First-run auto-start (never re-triggers once completed or dismissed).
  useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem('ax:tour:dashboard'); } catch { /* ignore */ }
    if (!seen) { const t = setTimeout(() => start(), 600); return () => clearTimeout(t); }
  }, [start]);

  // Keyboard + reposition listeners while active.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    const onReflow = () => position();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow);
    };
  }, [active, skip, next, prev, position]);

  return (
    <>
      <PageHead
        title="Product Tour"
        subtitle="A guided, spotlighted onboarding walkthrough — coachmarks anchor to real elements on the page."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--ghost" onClick={reset}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
              <span className="ax-btn__label">Reset tour</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary" data-tour="start" onClick={start}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z" /></svg>
              <span className="ax-btn__label">Start tour</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI — step 1 */}
        <div className="ax-card ax-kpi ax-col--3" data-tour="kpi" role="region" aria-label="Monthly revenue">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>9.2%</span>
            </div>
            <div className="ax-kpi__label">Monthly Revenue</div>
            <div className="ax-kpi__value ax-num">$92.4K</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Active users">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>4.1%</span>
            </div>
            <div className="ax-kpi__label">Active Users</div>
            <div className="ax-kpi__value ax-num">8,142</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Conversion">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>0.4%</span>
            </div>
            <div className="ax-kpi__label">Conversion</div>
            <div className="ax-kpi__value ax-num">3.18%</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Open tickets">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" /><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>12</span>
            </div>
            <div className="ax-kpi__label">Open Tickets</div>
            <div className="ax-kpi__value ax-num">37</div>
          </div>
        </div>

        {/* Chart — step 2 */}
        <section className="ax-card ax-card--chart ax-col--8" data-tour="chart" role="region" aria-label="Revenue trend">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Last 12 weeks</span>
              <h2 className="ax-card__title">Revenue Trend</h2>
              <p className="ax-card__subtitle">Your headline metric over time</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="area"
              height={280}
              legend="none"
              accent
              ariaLabel="Area chart of weekly revenue"
              series={[{ name: 'Revenue', data: [31, 38, 35, 46, 42, 55, 52, 61, 58, 67, 64, 72] }]}
            />
          </div>
        </section>

        {/* Checklist — step 3 */}
        <section className="ax-card ax-col--4" data-tour="checklist" role="region" aria-label="Setup checklist">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Setup Checklist</h2>
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

          <div className="ax-popover" ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="tour-step-title" aria-live="polite" style={{ position: 'absolute', width: 320, maxWidth: 'calc(100vw - 32px)', transition: 'top var(--ax-motion-base) var(--ax-ease-standard), left var(--ax-motion-base) var(--ax-ease-standard)', top: card.top, left: card.left }}>
            <div className="ax-popover__panel">
              <div className="ax-popover__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill ax-num"><span>{index + 1}</span> of <span>{STEPS.length}</span></span>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={skip} aria-label="Skip tour"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </div>
              <div className="ax-popover__body">
                <h3 id="tour-step-title" style={{ margin: '0 0 var(--ax-space-2)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{STEPS[index].title}</h3>
                <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>{STEPS[index].body}</p>
                <div className="ax-cluster" style={{ gap: 6, marginTop: 'var(--ax-space-4)' }} aria-hidden="true">
                  {STEPS.map((s, i) => (
                    <span key={s.sel} style={i === index ? { width: 18, height: 7, borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-accent)', transition: 'background var(--ax-motion-fast)' } : { width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-border-strong)', transition: 'background var(--ax-motion-fast)' }} />
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
        <div className="ax-toast ax-toast--success" role="status" style={{ position: 'fixed', insetBlockEnd: 'var(--ax-space-6)', insetInlineEnd: 'var(--ax-space-6)', zIndex: 90 }}>
          <svg className="ax-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
          <div className="ax-toast__content"><p className="ax-toast__title">You&apos;re all set</p><p className="ax-toast__message">Tour complete — explore your dashboard.</p></div>
          <button type="button" className="ax-toast__dismiss" onClick={() => setDone(false)} aria-label="Dismiss"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
        </div>
      )}
    </>
  );
}

export default Tour;
