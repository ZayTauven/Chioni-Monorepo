/*
 * Vireo Next.js — UI · Ribbons (route "ui/ribbons").
 *
 * Faithful re-expression of src/html/ui/ribbons.html: corner (45°) ribbons in
 * four tones, edge/flag tabs, floating pill ribbons and ribbons layered over
 * gradient media tiles. Fully static — no interactivity, so a server component.
 * DOM structure, .ax-ribbon classes, ARIA and demo copy match the reference 1:1.
 */
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const STAR = (
  <svg className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" /></svg>
);

export function Ribbons() {
  return (
    <>
      <PageHead
        title="Ribbons"
        subtitle="Corner banners, edge flags and pill tags — pinned to any glass card."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/badges">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7a2.2 2.2 0 0 0 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1a2.2 2.2 0 0 0 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" /></svg>
            <span className="ax-btn__label">Badges</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Corner ribbons */}
        <section className="ax-card ax-col--12" role="region" aria-label="Corner ribbons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">45° banner</span>
              <h2 className="ax-card__title">Corner Ribbons</h2>
              <p className="ax-card__subtitle">Diagonal banners pinned to the top-start or top-end of a card, in any tone.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 'var(--ax-space-5)' }}>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-end">Featured</span>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Brass Task Light</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Lighting · Aperture Goods</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>$182.00</div>
                </div>
              </article>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-end ax-ribbon--success">In stock</span>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Matte Ceramic Mug</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Drinkware · 312 on hand</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>$24.00</div>
                </div>
              </article>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-start ax-ribbon--danger">Sold out</span>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Linen Pinboard</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Storage · backorder</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>$58.00</div>
                </div>
              </article>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-start ax-ribbon--warning">Low stock</span>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Walnut Monitor Riser</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Desk · 41 left</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>$96.00</div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Edge / flag ribbons */}
        <section className="ax-card ax-col--6" role="region" aria-label="Edge and flag ribbons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Inset tab</span>
              <h2 className="ax-card__title">Edge &amp; Flag</h2>
              <p className="ax-card__subtitle">A flat tab notched into the leading edge.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-5)' }}>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden', minHeight: 118 }}>
              <span className="ax-ribbon ax-ribbon--edge">New</span>
              <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-8)' }}>
                <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Stoneware Carafe</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Just landed</div>
              </div>
            </article>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden', minHeight: 118 }}>
              <span className="ax-ribbon ax-ribbon--edge ax-ribbon--success">−20%</span>
              <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-8)' }}>
                <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Oak Pen Tray</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Summer sale</div>
              </div>
            </article>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden', minHeight: 118 }}>
              <span className="ax-ribbon ax-ribbon--flag ax-ribbon--warning">Beta</span>
              <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-8)' }}>
                <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Insights API</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Preview release</div>
              </div>
            </article>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden', minHeight: 118 }}>
              <span className="ax-ribbon ax-ribbon--flag ax-ribbon--danger">Hot</span>
              <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-8)' }}>
                <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Grid Notebook A5</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Best seller</div>
              </div>
            </article>
          </div>
        </section>

        {/* Pill ribbons */}
        <section className="ax-card ax-col--6" role="region" aria-label="Pill ribbons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Floating tag</span>
              <h2 className="ax-card__title">Pill Ribbons</h2>
              <p className="ax-card__subtitle">A rounded chip floated into the top-end corner.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
              <span className="ax-ribbon ax-ribbon--pill">Pro</span>
              <div className="ax-card__body">
                <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Team plan</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Up to 25 seats</div>
                  </div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>$49<small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-sans)' }}>/mo</small></div>
                </div>
              </div>
            </article>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
              <span className="ax-ribbon ax-ribbon--pill ax-ribbon--success">Recommended</span>
              <div className="ax-card__body">
                <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Business plan</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>SSO + audit log</div>
                  </div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>$99<small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-sans)' }}>/mo</small></div>
                </div>
              </div>
            </article>
            <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
              <span className="ax-ribbon ax-ribbon--pill ax-ribbon--warning">Trial ends soon</span>
              <div className="ax-card__body">
                <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <div>
                    <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Enterprise</div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>3 days remaining</div>
                  </div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)' }}>Custom</div>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* On media */}
        <section className="ax-card ax-col--12" role="region" aria-label="Ribbons over media">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Over Media Tiles</h2>
              <p className="ax-card__subtitle">Ribbons layer cleanly above an image or gradient thumbnail.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 'var(--ax-space-5)' }}>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-end">Editor&rsquo;s pick</span>
                <div style={{ height: 120, background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-cyan) 60%,transparent),color-mix(in oklab,var(--ax-viz-violet) 55%,transparent))', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.85 }}><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg>
                </div>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Aurora wallpaper pack</div>
                  <div className="ax-rating ax-rating--sm" role="img" aria-label="4.8 out of 5" style={{ marginTop: 6 }}>
                    {STAR}{STAR}{STAR}{STAR}
                    <svg className="ax-rating__star ax-rating__star--half" viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor' }}><path d="M12 1a.993 .993 0 0 1 .823 .443l.067 .116l2.852 5.781l6.38 .925c.741 .108 1.08 .94 .703 1.526l-.07 .095l-.078 .086l-4.624 4.499l1.09 6.355a1.001 1.001 0 0 1 -1.249 1.135l-.101 -.035l-.101 -.046l-5.693 -3l-5.706 3c-.105 .055 -.212 .09 -.32 .106l-.106 .01a1.003 1.003 0 0 1 -1.038 -1.06l.013 -.11l1.09 -6.355l-4.623 -4.5a1.001 1.001 0 0 1 .328 -1.647l.113 -.036l.114 -.023l6.379 -.925l2.853 -5.78a.968 .968 0 0 1 .904 -.56zm0 3.274v12.476a1 1 0 0 1 .239 .029l.115 .036l.112 .05l4.363 2.299l-.836 -4.873a1 1 0 0 1 .136 -.696l.07 -.099l.082 -.09l3.546 -3.453l-4.891 -.708a1 1 0 0 1 -.62 -.344l-.073 -.097l-.06 -.106l-2.183 -4.424z" /></svg>
                    <span className="ax-rating__value ax-num">4.8</span>
                  </div>
                </div>
              </article>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--pill ax-ribbon--success">Free</span>
                <div style={{ height: 120, background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-emerald) 55%,transparent),color-mix(in oklab,var(--ax-viz-cyan) 50%,transparent))', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.85 }}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg>
                </div>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Starter template</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>MIT licensed</div>
                </div>
              </article>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-start ax-ribbon--warning">Updated</span>
                <div style={{ height: 120, background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-amber) 55%,transparent),color-mix(in oklab,var(--ax-viz-pink) 50%,transparent))', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.85 }}><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
                </div>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Changelog digest</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>v2.4 just shipped</div>
                </div>
              </article>
              <article className="ax-card ax-card--compact" style={{ position: 'relative', overflow: 'hidden' }}>
                <span className="ax-ribbon ax-ribbon--corner ax-ribbon--top-end ax-ribbon--danger">−40%</span>
                <div style={{ height: 120, background: 'linear-gradient(135deg,color-mix(in oklab,var(--ax-viz-pink) 55%,transparent),color-mix(in oklab,var(--ax-viz-violet) 50%,transparent))', display: 'grid', placeItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width={40} height={40} fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.85 }}><path d="M9 14l6 -6" /><path d="M9.5 8.5m-.5 0a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" /><path d="M14.5 13.5m-.5 0a.5 .5 0 1 0 1 0a.5 .5 0 1 0 -1 0" /><path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7a2.2 2.2 0 0 0 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1a2.2 2.2 0 0 0 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" /></svg>
                </div>
                <div className="ax-card__body">
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Pro upgrade</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Annual offer</div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Ribbons;
