'use client';
/*
 * Vireo Next.js — UI · Cards (route "ui/cards").
 *
 * Faithful re-expression of src/html/ui/cards.html: stat cards (KPI sparklines
 * via <ApexChart>), a chart card + accent-edge card, media cards (product /
 * article / profile), interactive selectable plan tiles and a collapsible card.
 * Alpine x-data (range/plan/open) → React state; charts go through <ApexChart>.
 * DOM classes / ARIA / copy match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const ARROW_UP = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>;
const ARROW_DN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;

interface Stat { region: string; cls: string; icon: React.ReactNode; up: boolean; delta: string; label: string; value: string; color: string; spark: number[]; }
const STATS: Stat[] = [
  { region: 'Total Revenue $748.2K, up 12.4%', cls: 'c1', up: true, delta: '12.4%', label: 'Total Revenue', value: '$748.2K', color: '--ax-accent', spark: [6, 9, 8, 16, 19, 23, 28, 30], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg> },
  { region: 'Orders 1,248, up 8.1%', cls: 'c2', up: true, delta: '8.1%', label: 'Orders', value: '1,248', color: '--ax-viz-cyan', spark: [8, 12, 11, 17, 16, 22, 25, 29], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg> },
  { region: 'Average order value $59.95, up 2.6%', cls: 'c3', up: true, delta: '2.6%', label: 'Avg. order value', value: '$59.95', color: '--ax-viz-violet', spark: [12, 13, 15, 14, 18, 20, 22, 25], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg> },
  { region: 'Customers 3,920, down 3.1%', cls: 'c4', up: false, delta: '3.1%', label: 'Customers', value: '3,920', color: '--ax-viz-amber', spark: [26, 23, 22, 18, 16, 13, 10, 7], icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg> },
];

function ChartRange() {
  const [r, setR] = useState('12m');
  return (
    <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
      {(['3m', '6m', '12m'] as const).map((k) => (
        <button key={k} type="button" className={`ax-btn ax-btn--sm${r === k ? ' is-selected' : ''}`} role="radio" aria-checked={r === k} onClick={() => setR(k)}>{k.toUpperCase()}</button>
      ))}
    </div>
  );
}

function PlanTiles() {
  const [plan, setPlan] = useState('scale');
  return (
    <div className="ax-col--8">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-5)' }}>
        <button type="button" className={`ax-card ax-card--interactive${plan === 'starter' ? ' is-selected' : ''}`} onClick={() => setPlan('starter')} aria-pressed={plan === 'starter'} style={{ textAlign: 'start', alignItems: 'stretch' }}>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3l8 -8" /><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9" /></svg></span>
              {plan === 'starter' && <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--ax-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
            </div>
            <h3 style={{ margin: 'var(--ax-space-2) 0 0', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Starter</h3>
            <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$0<span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', fontFamily: 'var(--ax-font-sans)', fontWeight: 'var(--ax-weight-regular)' }}>/mo</span></div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Up to 3 seats and 10K API calls. Community support.</p>
          </div>
        </button>
        <button type="button" className={`ax-card ax-card--interactive${plan === 'scale' ? ' is-selected' : ''}`} onClick={() => setPlan('scale')} aria-pressed={plan === 'scale'} style={{ textAlign: 'start', alignItems: 'stretch' }}>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" /></svg></span>
              {plan === 'scale' && <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--ax-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}><h3 style={{ margin: 0, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Scale</h3><span className="ax-badge ax-badge--soft ax-badge--accent">Popular</span></div>
            <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$49<span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', fontFamily: 'var(--ax-font-sans)', fontWeight: 'var(--ax-weight-regular)' }}>/mo</span></div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Up to 25 seats and 1M API calls. Priority support &amp; SSO.</p>
          </div>
        </button>
      </div>
      <p style={{ margin: 'var(--ax-space-3) 0 0', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Selected plan: <b style={{ color: 'var(--ax-text-strong)', textTransform: 'capitalize' }}>{plan}</b></p>
    </div>
  );
}

function Collapsible() {
  const [open, setOpen] = useState(true);
  return (
    <section className="ax-card ax-col--4" role="region" aria-label="Order summary, collapsible">
      <div className="ax-card__header">
        <div className="ax-card__titles">
          <span className="ax-card__eyebrow">Order #10482</span>
          <h2 className="ax-card__title">Order summary</h2>
        </div>
        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="card-collapse-body" aria-label={open ? 'Collapse order summary' : 'Expand order summary'}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transition: 'transform var(--ax-motion-base) var(--ax-ease-standard)', ...(open ? {} : { transform: 'rotate(-90deg)' }) }}><path d="M6 9l6 6l6 -6" /></svg>
        </button>
      </div>
      {open && (
        <div className="ax-card__body ax-flex" id="card-collapse-body" style={{ paddingTop: 0, flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
          <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Matte Ceramic Mug × 2</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$48.00</span></div>
          <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Aperture Desk Lamp × 1</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$129.00</span></div>
          <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Grid Notebook A5 × 1</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$16.00</span></div>
          <hr className="ax-divider" />
          <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Total</span><span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$193.00</span></div>
        </div>
      )}
    </section>
  );
}

const SECTION_H: React.CSSProperties = { margin: 0, fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' };
const SECTION_P: React.CSSProperties = { margin: '4px 0 0', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' };

export function Cards() {
  return (
    <>
      <PageHead
        title="Cards"
        subtitle="The glass surface in every dress — stat, chart, media, accent-edge, interactive and collapsible."
        actions={
          <>
            <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/list-group">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
              <span className="ax-btn__label">List groups</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">New card</span></button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* STAT CARDS */}
        <div className="ax-col--12" style={{ marginBlockStart: 'var(--ax-space-2)' }}>
          <span className="ax-card__eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-1)' }}>Variant 01</span>
          <h2 style={SECTION_H}>Stat cards</h2>
          <p style={SECTION_P}>KPI tiles with a coloured glyph, signed delta and an inline sparkline.</p>
        </div>

        {STATS.map((s) => (
          <div key={s.label} className="ax-card ax-kpi ax-col--3" role="region" aria-label={s.region}>
            <div className="ax-card__body">
              <div className="ax-kpi__top">
                <span className={`ax-kpi__icon ax-kpi__icon--${s.cls}`}>{s.icon}</span>
                <span className={`ax-kpi__delta ax-kpi__delta--${s.up ? 'up' : 'down'}`}>{s.up ? ARROW_UP : ARROW_DN}{s.delta}</span>
              </div>
              <div className="ax-kpi__label">{s.label}</div>
              <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div className="ax-kpi__value ax-num">{s.value}</div>
                <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color={s.color} series={[{ name: 'Trend', data: s.spark }]} style={{ minHeight: 40 }} />
              </div>
            </div>
          </div>
        ))}

        {/* CHART CARD + ACCENT-EDGE */}
        <div className="ax-col--12" style={{ marginBlockStart: 'var(--ax-space-4)' }}>
          <span className="ax-card__eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-1)' }}>Variant 02 &amp; 03</span>
          <h2 style={SECTION_H}>Chart card &amp; accent-edge card</h2>
          <p style={SECTION_P}>A card built around a chart, beside a card flagged with the accent rail for emphasis.</p>
        </div>

        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Revenue trend chart card">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Performance</span>
              <h2 className="ax-card__title">Revenue Trend</h2>
              <p className="ax-card__subtitle">Net revenue, last 12 months</p>
            </div>
            <div className="ax-card__actions"><ChartRange /></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart type="area" height={280} legend="none" accent ariaLabel="Area chart of monthly revenue over the last 12 months, headline $748.2K" series={[{ name: 'Revenue', data: [42100, 48300, 45200, 53400, 57100, 55600, 62400, 60200, 68900, 72300, 70100, 74820] }]} />
          </div>
          <div className="ax-card__footer">
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Peak month: <b style={{ color: 'var(--ax-text-strong)' }}>June</b> at <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>$74.8K</span></span>
            <a className="ax-link" href="#" style={{ marginInlineStart: 'auto' }}>Full report →</a>
          </div>
        </section>

        <section className="ax-card ax-card--accent-edge ax-col--4" role="region" aria-label="Plan usage">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Plan</span>
              <h2 className="ax-card__title">Scale — usage</h2>
              <p className="ax-card__subtitle">Renews Jul 1, 2026</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Active</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>API calls</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>812K / 1M</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '81%' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Seats</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>18 / 25</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '72%', background: 'var(--ax-viz-cyan)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Storage</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>44 / 50 GB</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '88%', background: 'var(--ax-warning-500)' }} /></div></div>
            </div>
          </div>
          <div className="ax-card__footer">
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--block"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8l0 4l2 2" /></svg><span className="ax-btn__label">Manage subscription</span></button>
          </div>
        </section>

        {/* MEDIA CARDS */}
        <div className="ax-col--12" style={{ marginBlockStart: 'var(--ax-space-4)' }}>
          <span className="ax-card__eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-1)' }}>Variant 04</span>
          <h2 style={SECTION_H}>Media cards</h2>
          <p style={SECTION_P}>A visual banner above the body — product, article and profile flavours.</p>
        </div>

        {/* Product media card */}
        <section className="ax-card ax-card--media ax-col--4" role="region" aria-label="Brass Task Light product card">
          <div className="ax-card__media">
            <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '16/10', borderRadius: 0, background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-amber) 26%,var(--ax-surface)),color-mix(in oklab,var(--ax-viz-pink) 22%,var(--ax-surface)))', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" width={56} height={56} fill="none" stroke="var(--ax-text-strong)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.85 }}><path d="M8 9h8v10a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1z" /><path d="M9 6a3 3 0 0 1 6 0" /><path d="M8 9l8 0" /></svg>
            </div>
            <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineStart: 'var(--ax-space-3)' }}>Bestseller</span>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Lighting · APG-0008</span>
              <span className="ax-cluster" style={{ gap: 3, color: 'var(--ax-viz-amber)', fontSize: 'var(--ax-text-xs)' }}><svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>4.9</b></span>
            </div>
            <h3 style={{ margin: 0, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Brass Task Light</h3>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Warm dimmable desk lamp with a machined brass arm and weighted base.</p>
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-2)' }}>
              <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>$182.00</span>
              <button type="button" className="ax-btn ax-btn--primary ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M15 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg><span className="ax-btn__label">Add</span></button>
            </div>
          </div>
        </section>

        {/* Article media card */}
        <section className="ax-card ax-card--media ax-col--4" role="region" aria-label="Article — designing for dark mode">
          <div className="ax-card__media">
            <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '16/10', borderRadius: 0, background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-violet) 30%,var(--ax-surface)),color-mix(in oklab,var(--ax-viz-cyan) 22%,var(--ax-surface)))', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" width={56} height={56} fill="none" stroke="var(--ax-text-strong)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.85 }}><path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" /><path d="M3 6l0 13" /><path d="M12 6l0 13" /><path d="M21 6l0 13" /></svg>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--info">Design</span>
              <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>6 min read</span>
            </div>
            <h3 style={{ margin: 0, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Designing trustworthy dark interfaces</h3>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Contrast, elevation and the quiet art of making a glass surface readable after dark.</p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--sm" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>LB</span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Lena Brandt</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 9, 2026</div>
              </div>
              <a className="ax-link" href="#">Read →</a>
            </div>
          </div>
        </section>

        {/* Profile media card */}
        <section className="ax-card ax-card--media ax-col--4" role="region" aria-label="Team member profile card">
          <div className="ax-card__media">
            <div className="ax-ratio" style={{ ['--ax-ratio' as string]: '16/7', borderRadius: 0, background: 'var(--ax-gradient-plate)' }} />
            <span className="ax-avatar ax-avatar--xl ax-avatar--ringed" style={{ position: 'absolute', insetBlockEnd: -28, insetInlineStart: 'var(--ax-space-6)', background: 'var(--ax-surface-solid)', color: 'var(--ax-viz-cyan)', fontWeight: 'var(--ax-weight-semibold)' }}>MR</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 36, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Marcus Reyes</h3>
              <span className="ax-badge ax-badge--soft ax-badge--success"><span className="ax-badge__dot" />Online</span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Engineering Manager · Northwind Labs</p>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginTop: 'var(--ax-space-4)' }}>
              <div><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>142</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Reviews</div></div>
              <div><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>38</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Projects</div></div>
              <div><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>4.9</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Rating</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-4)' }}>
              <button type="button" className="ax-btn ax-btn--primary ax-btn--sm" style={{ flex: 1 }}>Message</button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" style={{ flex: 1 }}>Profile</button>
            </div>
          </div>
        </section>

        {/* INTERACTIVE + COLLAPSIBLE */}
        <div className="ax-col--12" style={{ marginBlockStart: 'var(--ax-space-4)' }}>
          <span className="ax-card__eyebrow" style={{ display: 'block', marginBottom: 'var(--ax-space-1)' }}>Variant 05 &amp; 06</span>
          <h2 style={SECTION_H}>Interactive &amp; collapsible cards</h2>
          <p style={SECTION_P}>Selectable tiles that lift on hover, and a card whose body folds away.</p>
        </div>

        <PlanTiles />
        <Collapsible />
      </div>
    </>
  );
}

export default Cards;
