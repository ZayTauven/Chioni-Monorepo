'use client';
/*
 * Vireo Next.js — UI · Skeletons (route "ui/skeletons").
 *
 * Faithful re-expression of src/html/ui/skeletons.html: primitive shapes
 * (line/circle/rect, shimmer + pulse), plus card / KPI / avatar-list / table /
 * profile skeleton scopes that swap to real content. The reference's "Show
 * loaded" button flips every [data-skeleton-scope]'s data-loading; here a single
 * `loading` state drives the same attribute, and the page-local CSS (which swaps
 * [data-skel] ⇄ [data-real]) is reproduced verbatim. DOM/classes/ARIA match 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const SKEL_CSS = `
[data-skeleton-scope][data-loading="false"] [data-skel] { display:none !important; }
[data-skeleton-scope][data-loading="false"] [data-real] { display:revert !important; }
[data-skeleton-scope][data-loading="false"] [data-real][hidden] { display:revert !important; }
[data-skeleton-scope][data-loading="true"]  [data-real] { display:none !important; }
`;

export function Skeletons() {
  const [loading, setLoading] = useState(true);
  const dl = loading ? 'true' : 'false';
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SKEL_CSS }} />
      <PageHead
        title="Skeletons"
        subtitle="Loading placeholders that mirror the exact shape of the content they replace — cards, lists, tables, avatars and media."
        actions={
          <>
            <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/spinners">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /></svg>
              <span className="ax-btn__label">Spinners</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => setLoading((v) => !v)} aria-pressed={loading}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
              <span className="ax-btn__label">{loading ? 'Show loaded' : 'Show loading'}</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* PRIMITIVES */}
        <section className="ax-card ax-col--12" role="region" aria-label="Skeleton primitives">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Primitives</span>
              <h2 className="ax-card__title">Shapes &amp; animations</h2>
              <p className="ax-card__subtitle">Line, circle and rectangle blocks — animated with a shimmer sweep or a pulse fade.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 'var(--ax-space-6)' }} aria-busy="true" aria-label="Skeleton shape examples">
            <div>
              <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-3)' }}>Lines</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '100%' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '85%' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '60%' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-3)' }}>Circle</div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', alignItems: 'center' }}>
                <div className="ax-skeleton ax-skeleton--circle" style={{ width: 32, height: 32 }} />
                <div className="ax-skeleton ax-skeleton--circle" style={{ width: 44, height: 44 }} />
                <div className="ax-skeleton ax-skeleton--circle" style={{ width: 60, height: 60 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-3)' }}>Rectangle</div>
              <div className="ax-skeleton ax-skeleton--rect" style={{ width: '100%', height: 88 }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-3)' }}>Pulse fade</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <div className="ax-skeleton ax-skeleton--pulse ax-skeleton--line" style={{ width: '100%' }} />
                <div className="ax-skeleton ax-skeleton--pulse ax-skeleton--line" style={{ width: '72%' }} />
                <div className="ax-skeleton ax-skeleton--pulse ax-skeleton--rect" style={{ width: '100%', height: 40 }} />
              </div>
            </div>
          </div>
        </section>

        {/* CARD SKELETON */}
        <section className="ax-card ax-col--4" role="region" aria-label="Card skeleton" data-skeleton-scope data-loading={dl}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Media card</span>
              <h2 className="ax-card__title">Article card</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div data-skel style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} aria-busy="true" aria-label="Loading article">
              <div className="ax-skeleton ax-skeleton--rect" style={{ width: '100%', height: 148 }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '30%', height: '0.6em' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '90%', height: '1.1em' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '100%' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '80%' }} />
              </div>
              <div className="ax-skeleton-row" style={{ marginTop: 'var(--ax-space-2)' }}>
                <div className="ax-skeleton ax-skeleton--circle" style={{ width: 28, height: 28, flex: '0 0 auto' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '40%' }} />
              </div>
            </div>
            <div data-real hidden style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-ratio" style={{ '--ax-ratio': '16/9', borderRadius: 'var(--ax-radius-md)', background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-violet) 30%,var(--ax-surface)),color-mix(in oklab,var(--ax-viz-cyan) 24%,var(--ax-surface)))' } as React.CSSProperties} />
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ alignSelf: 'flex-start' }}>Product</span>
              <h3 style={{ margin: 0, fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Aurora 3.0 ships twelve accents</h3>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>A live customizer, 200+ pages and a data-viz palette that re-themes in 200ms.</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', marginTop: 'var(--ax-space-1)' }}>
                <span className="ax-avatar ax-avatar--xs" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}>LB</span>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Lena Brandt · 4 min read</span>
              </div>
            </div>
          </div>
        </section>

        {/* STAT / KPI SKELETON */}
        <section className="ax-card ax-col--4" role="region" aria-label="KPI skeletons" data-skeleton-scope data-loading={dl}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Stat blocks</span>
              <h2 className="ax-card__title">KPI placeholders</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div data-skel style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }} aria-busy="true" aria-label="Loading metrics">
              <div className="ax-skeleton-stat">
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <div className="ax-skeleton ax-skeleton--rect" style={{ width: 40, height: 40, borderRadius: 'var(--ax-radius-md)' }} />
                  <div className="ax-skeleton ax-skeleton--line" style={{ width: 48, height: '1.2em' }} />
                </div>
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '55%' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '75%', height: '1.6em' }} />
              </div>
              <div className="ax-divider" />
              <div className="ax-skeleton-stat">
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <div className="ax-skeleton ax-skeleton--rect" style={{ width: 40, height: 40, borderRadius: 'var(--ax-radius-md)' }} />
                  <div className="ax-skeleton ax-skeleton--line" style={{ width: 48, height: '1.2em' }} />
                </div>
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '60%' }} />
                <div className="ax-skeleton ax-skeleton--line" style={{ width: '70%', height: '1.6em' }} />
              </div>
            </div>
            <div data-real hidden style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div>
                <div className="ax-kpi__top">
                  <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
                  <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>12.4%</span>
                </div>
                <div className="ax-kpi__label">Total Revenue</div>
                <div className="ax-kpi__value ax-num">$748.2K</div>
              </div>
              <div className="ax-divider" />
              <div>
                <div className="ax-kpi__top">
                  <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
                  <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>8.1%</span>
                </div>
                <div className="ax-kpi__label">Orders</div>
                <div className="ax-kpi__value ax-num">1,248</div>
              </div>
            </div>
          </div>
        </section>

        {/* AVATAR / LIST SKELETON */}
        <section className="ax-card ax-col--4" role="region" aria-label="Avatar list skeleton" data-skeleton-scope data-loading={dl}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Avatars &amp; list</span>
              <h2 className="ax-card__title">Team members</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div data-skel style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} aria-busy="true" aria-label="Loading team">
              {['50%|70%', '60%|45%', '55%|65%'].map((w, i) => {
                const [a, b] = w.split('|');
                return (
                  <div key={i} className="ax-skeleton-row">
                    <div className="ax-skeleton ax-skeleton--circle" style={{ width: 40, height: 40, flex: '0 0 auto' }} />
                    <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                      <div className="ax-skeleton ax-skeleton--line" style={{ width: a }} />
                      <div className="ax-skeleton ax-skeleton--line" style={{ width: b }} />
                    </div>
                    <div className="ax-skeleton ax-skeleton--rect" style={{ width: 54, height: 22, borderRadius: 'var(--ax-radius-pill)', flex: '0 0 auto' }} />
                  </div>
                );
              })}
            </div>
            <ul data-real hidden className="ax-list ax-list--compact" style={{ margin: 0 }}>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}>AS</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Ava Sutton</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Operations Lead</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Online</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}>DO</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Devon Okafor</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Backend Engineer</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Online</span></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}>LB</span></span>
                <span className="ax-list__content"><span className="ax-list__title">Lena Brandt</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Product Designer</span></span>
                <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><span className="ax-badge__dot" />Away</span></span>
              </li>
            </ul>
          </div>
        </section>

        {/* TABLE SKELETON */}
        <section className="ax-card ax-col--8" role="region" aria-label="Table skeleton" data-skeleton-scope data-loading={dl}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Data table</span>
              <h2 className="ax-card__title">Recent orders</h2>
              <p className="ax-card__subtitle">The header stays put; rows shimmer until the data arrives.</p>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Order</th>
                  <th className="ax-table__th" scope="col">Customer</th>
                  <th className="ax-table__th" scope="col">Status</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                </tr>
              </thead>
              <tbody data-skel aria-busy="true">
                {[120, 140, 100, 130, 110].map((w, i) => (
                  <tr key={i} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-skeleton ax-skeleton--line" style={{ width: 72 }} /></td>
                    <td className="ax-table__td"><div className="ax-skeleton-row"><div className="ax-skeleton ax-skeleton--circle" style={{ width: 28, height: 28, flex: '0 0 auto' }} /><div className="ax-skeleton ax-skeleton--line" style={{ width: w }} /></div></td>
                    <td className="ax-table__td"><div className="ax-skeleton ax-skeleton--rect" style={{ width: 78, height: 22, borderRadius: 'var(--ax-radius-pill)' }} /></td>
                    <td className="ax-table__td ax-table__td--num"><div className="ax-skeleton ax-skeleton--line" style={{ width: 64, marginInlineStart: 'auto' }} /></td>
                  </tr>
                ))}
              </tbody>
              <tbody data-real hidden>
                <tr className="ax-table__row"><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10482</td><td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-pink) 18%,transparent)', color: 'var(--ax-viz-pink)' }}>CR</span><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Camila Rossi</span></div></td><td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--info ax-badge--pill"><span className="ax-badge__dot" />Shipped</span></td><td className="ax-table__td ax-table__td--num">$312.00</td></tr>
                <tr className="ax-table__row"><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10481</td><td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}>HW</span><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Henry Whitlock</span></div></td><td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill"><span className="ax-badge__dot" />Processing</span></td><td className="ax-table__td ax-table__td--num">$129.00</td></tr>
                <tr className="ax-table__row"><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10480</td><td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}>AB</span><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Aisha Bello</span></div></td><td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Delivered</span></td><td className="ax-table__td ax-table__td--num">$80.00</td></tr>
                <tr className="ax-table__row"><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10479</td><td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}>EL</span><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Erik Lindqvist</span></div></td><td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Delivered</span></td><td className="ax-table__td ax-table__td--num">$1,544.00</td></tr>
                <tr className="ax-table__row"><td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>#10477</td><td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}>OP</span><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Olivia Penrose</span></div></td><td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Delivered</span></td><td className="ax-table__td ax-table__td--num">$200.00</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* PROFILE / DETAIL SKELETON */}
        <section className="ax-card ax-col--4" role="region" aria-label="Profile skeleton" data-skeleton-scope data-loading={dl}>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Profile</span>
              <h2 className="ax-card__title">User detail</h2>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div data-skel style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-4)', textAlign: 'center' }} aria-busy="true" aria-label="Loading profile">
              <div className="ax-skeleton ax-skeleton--circle" style={{ width: 72, height: 72 }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '55%', height: '1.1em' }} />
              <div className="ax-skeleton ax-skeleton--line" style={{ width: '38%' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', width: '100%', marginTop: 'var(--ax-space-2)' }}>
                <div className="ax-skeleton ax-skeleton--rect" style={{ height: 52 }} />
                <div className="ax-skeleton ax-skeleton--rect" style={{ height: 52 }} />
                <div className="ax-skeleton ax-skeleton--rect" style={{ height: 52 }} />
              </div>
              <div className="ax-skeleton ax-skeleton--rect" style={{ width: '100%', height: 38, borderRadius: 'var(--ax-radius-md)', marginTop: 'var(--ax-space-2)' }} />
            </div>
            <div data-real hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <span className="ax-avatar ax-avatar--xl" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}>PN</span>
              <div><div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Priya Nair</div><div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Data Analyst</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', width: '100%', marginTop: 'var(--ax-space-1)' }}>
                <div style={{ padding: 'var(--ax-space-3)', background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)' }}><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>128</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>Reports</div></div>
                <div style={{ padding: 'var(--ax-space-3)', background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)' }}><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>42</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>Boards</div></div>
                <div style={{ padding: 'var(--ax-space-3)', background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-md)' }}><div className="ax-num" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>9</div><div style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>Teams</div></div>
              </div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block ax-btn--sm" style={{ marginTop: 'var(--ax-space-2)' }}><span className="ax-btn__label">View profile</span></button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Skeletons;
