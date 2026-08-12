'use client';
/*
 * Vireo Next.js — NFT Marketplace dashboard (route "dashboards/nft").
 *
 * Faithful re-expression of src/html/dashboards/nft.html: 4 KPI cards, a Volume
 * & Floor Trend mixed chart, a Sales by Category donut, a Live Auctions tile
 * grid, a Trending Collections table, a Top Creators rail and a full-width
 * Recent Activity table. Bespoke grid-column classes + inline <style> replicated
 * verbatim. Charts via <ApexChart>; DOM/classes/copy/ARIA match the reference.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const TOK_FALLBACK: Record<string, string> = {
  '--ax-accent': '#2DD4BF',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
};
function tokenColors(tokens: string[]): string[] {
  if (typeof document === 'undefined') return tokens.map((t) => TOK_FALLBACK[t] || '#38BDF8');
  const cs = getComputedStyle(document.documentElement);
  return tokens.map((t) => cs.getPropertyValue(t).trim() || TOK_FALLBACK[t] || '#38BDF8');
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const CLOCK = (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
);

const AUCTIONS = [
  { grad: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-violet) 60%,transparent), color-mix(in oklab,var(--ax-viz-cyan) 55%,transparent))', tick: '00:42:18', name: 'Neon Drifter #218', by: 'by Vortex Labs', bid: '3.8 ETH' },
  { grad: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-pink) 60%,transparent), color-mix(in oklab,var(--ax-viz-amber) 55%,transparent))', tick: '01:14:05', name: 'Pastel Voyage #07', by: 'by Mira Aoki', bid: '2.1 ETH' },
  { grad: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-emerald) 60%,transparent), color-mix(in oklab,var(--ax-viz-cyan) 55%,transparent))', tick: '00:09:51', name: 'Glyph Engine #44', by: 'by Helio Studio', bid: '5.4 ETH' },
  { grad: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-amber) 60%,transparent), color-mix(in oklab,var(--ax-viz-pink) 55%,transparent))', tick: '02:31:40', name: 'Iron Bloom #99', by: 'by Kojima.eth', bid: '1.7 ETH' },
];

export function Nft() {
  return (
    <>
      <PageHead
        title="NFT Marketplace"
        subtitle="Trading volume climbed 14% this week across 5,210 owners."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
              <span className="ax-btn__label">Last 7 days</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14c0 1.657 2.686 3 6 3s6 -1.343 6 -3s-2.686 -3 -6 -3s-6 1.343 -6 3" /><path d="M9 14v4c0 1.656 2.686 3 6 3s6 -1.344 6 -3v-4" /><path d="M3 6c0 1.072 1.144 2.062 3 2.598s4.144 .536 6 0s3 -1.526 3 -2.598s-1.144 -2.062 -3 -2.598s-4.144 -.536 -6 0s-3 1.526 -3 2.598" /><path d="M3 6v10c0 .888 .772 1.45 2 2" /></svg>
              <span className="ax-btn__label">My Wallet</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /><path d="M10 12l-2 -2.2l.6 -1" /></svg>
              <span className="ax-btn__label">Create NFT</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid ax-nft-grid">
        {/* KPI ROW */}
        <div className="ax-card ax-kpi" role="region" aria-label="Total Volume 1,284 ETH, up 14.0%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}14.0%</span>
            </div>
            <div className="ax-kpi__label">Total Volume</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">1,284 ETH</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [6, 10, 8, 16, 19, 23, 27, 30] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi" role="region" aria-label="Floor Price 2.4 ETH, up 3.2%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /><path d="M10 12l-2 -2.2l.6 -1" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}3.2%</span>
            </div>
            <div className="ax-kpi__label">Floor Price</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">2.4 ETH</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-cyan" series={[{ name: 'Trend', data: [10, 13, 12, 18, 16, 21, 20, 25] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi" role="region" aria-label="Items Sold in 24 hours 318, up 6.1%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" /><path d="M9 9l6 6" /><path d="M15 9l-6 6" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}6.1%</span>
            </div>
            <div className="ax-kpi__label">Items Sold (24h)</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">318</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-violet" series={[{ name: 'Trend', data: [12, 15, 13, 20, 17, 23, 20, 26] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi" role="region" aria-label="Owners 5,210, up 1.0%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 10h2a2 2 0 0 1 2 2v1" /><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M3 13v-1a2 2 0 0 1 2 -2h2" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}1.0%</span>
            </div>
            <div className="ax-kpi__label">Unique Owners</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">5,210</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-amber" series={[{ name: 'Trend', data: [14, 16, 15, 18, 17, 21, 20, 23] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* HERO: Volume & Floor Trend */}
        <section className="ax-card ax-card--chart ax-col-hero" role="region" aria-label="Volume and floor trend">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Marketplace</span>
              <h2 className="ax-card__title">Volume &amp; Floor Trend</h2>
              <p className="ax-card__subtitle">Daily volume (ETH) vs. floor price</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">7D</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">30D</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">90D</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Volume (ETH)</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-viz-violet)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Floor (ETH)</small></span>
            </div>
            <ApexChart
              type="line"
              height={300}
              legend="none"
              accent
              ariaLabel="Mixed chart of daily volume columns with floor price line"
              series={[
                { name: 'Volume (ETH)', type: 'column', data: [142, 168, 131, 196, 184, 221, 208, 245, 232, 268] },
                { name: 'Floor (ETH)', type: 'line', data: [1.8, 1.9, 1.85, 2.0, 2.1, 2.05, 2.2, 2.3, 2.35, 2.4] },
              ]}
              apex={{
                colors: tokenColors(['--ax-accent', '--ax-viz-violet']),
                stroke: { width: [0, 3], curve: 'smooth' },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } },
                yaxis: [
                  { labels: { formatter: (v: number) => String(Math.round(v)) } },
                  { opposite: true, labels: { formatter: (v: number) => v.toFixed(1) } },
                ],
              }}
            />
          </div>
        </section>

        {/* Sales by Category donut */}
        <section className="ax-card ax-col-side" role="region" aria-label="Sales by category">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Sales by Category</h2></div>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Category options">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={220}
              legend="none"
              ariaLabel="Donut chart of sales by category: art 42%, collectibles 26%, gaming 20%, music 12%"
              series={[42, 26, 20, 12]}
              apex={{
                labels: ['Art', 'Collectibles', 'Gaming', 'Music'],
                colors: tokenColors(['--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Sales', formatter: () => '1,284' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'Art', color: '#38BDF8', pct: '42%' },
                { label: 'Collectibles', color: '#A78BFA', pct: '26%' },
                { label: 'Gaming', color: '#F472B6', pct: '20%' },
                { label: 'Music', color: '#FBBF24', pct: '12%' },
              ].map((c) => (
                <li key={c.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{c.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{c.pct}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Live Auctions */}
        <section className="ax-card ax-col-full" role="region" aria-label="Live auctions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Live Auctions</h2>
              <p className="ax-card__subtitle">Ending soon — current highest bids</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">Browse all</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 'var(--ax-space-4)' }}>
            {AUCTIONS.map((a) => (
              <article key={a.name} className="ax-card ax-card--interactive" style={{ overflow: 'hidden' }}>
                <div style={{ aspectRatio: '1/1', background: a.grad, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 'var(--ax-space-3)' }}>
                  <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-3)', left: 'var(--ax-space-3)' }}><span className="ax-badge__dot" />Live</span>
                  <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{CLOCK}<span>{a.tick}</span></span>
                </div>
                <div className="ax-card__body" style={{ padding: 'var(--ax-space-3)' }}>
                  <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{a.name}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-2)' }}>{a.by}</div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Current bid</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)' }}>{a.bid}</b></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Trending Collections */}
        <section className="ax-card ax-col-wide" role="region" aria-label="Trending collections">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Trending Collections</h2>
              <p className="ax-card__subtitle">Ranked by 24h volume</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">#</th>
                  <th className="ax-table__th" scope="col">Collection</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Floor</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Volume</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">24h</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { rank: '1', grad: 'linear-gradient(135deg,#A78BFA,#38BDF8)', name: 'Aurora Genesis', items: '10,000 items', floor: '4.20 ETH', vol: '812 ETH', chg: '+22.4%', chgColor: 'var(--ax-viz-emerald)' },
                  { rank: '2', grad: 'linear-gradient(135deg,#F472B6,#FBBF24)', name: 'Pixel Nomads', items: '6,000 items', floor: '1.85 ETH', vol: '540 ETH', chg: '+11.7%', chgColor: 'var(--ax-viz-emerald)' },
                  { rank: '3', grad: 'linear-gradient(135deg,#34D399,#38BDF8)', name: 'Chrome Spirits', items: '8,888 items', floor: '2.40 ETH', vol: '428 ETH', chg: '−4.1%', chgColor: 'var(--ax-viz-red)' },
                  { rank: '4', grad: 'linear-gradient(135deg,#FBBF24,#FB7185)', name: 'Solar Beasts', items: '4,200 items', floor: '0.92 ETH', vol: '316 ETH', chg: '+8.9%', chgColor: 'var(--ax-viz-emerald)' },
                  { rank: '5', grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', name: 'Echo Wardens', items: '3,333 items', floor: '1.10 ETH', vol: '204 ETH', chg: '+3.5%', chgColor: 'var(--ax-viz-emerald)' },
                ].map((r) => (
                  <tr key={r.rank} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)' }}>{r.rank}</td>
                    <td className="ax-table__td">
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                        <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: r.grad }} />
                        <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.items}</div></div>
                      </div>
                    </td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{r.floor}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{r.vol}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: r.chgColor }}>{r.chg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Top Creators */}
        <section className="ax-card ax-col-narrow" role="region" aria-label="Top creators">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Top Creators</h2></div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            {[
              { rank: '1', rankColor: 'var(--ax-warning-500)', grad: 'linear-gradient(135deg,#A78BFA,#F472B6)', name: 'Vortex Labs', handle: '@vortex', eth: '312 ETH' },
              { rank: '2', rankColor: 'var(--ax-text-muted)', grad: 'linear-gradient(135deg,#34D399,#38BDF8)', name: 'Mira Aoki', handle: '@miraink', eth: '248 ETH' },
              { rank: '3', rankColor: 'var(--ax-text-subtle)', grad: 'linear-gradient(135deg,#FBBF24,#FB7185)', name: 'Helio Studio', handle: '@helio', eth: '196 ETH' },
              { rank: '4', rankColor: 'var(--ax-text-subtle)', grad: 'linear-gradient(135deg,#38BDF8,#34D399)', name: 'Kojima.eth', handle: '@kojima', eth: '154 ETH' },
              { rank: '5', rankColor: 'var(--ax-text-subtle)', grad: 'linear-gradient(135deg,#F472B6,#A78BFA)', name: 'Nova Reyes', handle: '@novart', eth: '121 ETH' },
            ].map((c) => (
              <div key={c.rank} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: c.rankColor, width: 18, textAlign: 'center' }}>{c.rank}</b>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: c.grad }} />
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{c.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.handle}</div></div>
                <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{c.eth}</b>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="ax-card ax-col-full" role="region" aria-label="Recent activity">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Activity</h2>
              <p className="ax-card__subtitle">Latest sales, bids &amp; transfers</p>
            </div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Item</th>
                  <th className="ax-table__th" scope="col">Event</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Price</th>
                  <th className="ax-table__th" scope="col">From → To</th>
                  <th className="ax-table__th" scope="col">Time</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { grad: 'linear-gradient(135deg,#A78BFA,#38BDF8)', item: 'Aurora Genesis #1822', event: 'Sale', tone: 'success', price: '4.20 ETH', priceColor: 'var(--ax-text-strong)', fromto: '0x8a2f → 0x14bd', time: '2m ago' },
                  { grad: 'linear-gradient(135deg,#F472B6,#FBBF24)', item: 'Pixel Nomads #441', event: 'Bid', tone: 'info', price: '2.05 ETH', priceColor: 'var(--ax-text-strong)', fromto: '0x77c1 → —', time: '6m ago' },
                  { grad: 'linear-gradient(135deg,#34D399,#38BDF8)', item: 'Chrome Spirits #309', event: 'Transfer', tone: 'neutral', price: '—', priceColor: 'var(--ax-text-subtle)', fromto: '0x2def → 0x9a01', time: '14m ago' },
                  { grad: 'linear-gradient(135deg,#FBBF24,#FB7185)', item: 'Solar Beasts #88', event: 'Sale', tone: 'success', price: '0.95 ETH', priceColor: 'var(--ax-text-strong)', fromto: '0x55ab → 0xc3f2', time: '23m ago' },
                  { grad: 'linear-gradient(135deg,#38BDF8,#A78BFA)', item: 'Echo Wardens #1201', event: 'List', tone: 'warning', price: '1.20 ETH', priceColor: 'var(--ax-text-strong)', fromto: '0xb0de → —', time: '38m ago' },
                ].map((r) => (
                  <tr key={r.item} className="ax-table__row">
                    <td className="ax-table__td"><div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: r.grad }} /><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.item}</div></div></td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${r.tone} ax-badge--pill`}>{r.event}</span></td>
                    {r.price === '—'
                      ? <td className="ax-table__td ax-table__td--num" style={{ color: r.priceColor }}>{r.price}</td>
                      : <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: r.priceColor }}>{r.price}</td>}
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{r.fromto}</td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-subtle)' }}>{r.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{`
        .ax-nft-grid > * { grid-column: 1 / -1; }
        @media (min-width: 768px) {
          .ax-nft-grid > .ax-kpi { grid-column: span 6; }
        }
        @media (min-width: 1200px) {
          .ax-nft-grid > .ax-kpi { grid-column: span 3; }
          .ax-nft-grid > .ax-col-full { grid-column: span 12; }
          .ax-nft-grid > .ax-col-hero { grid-column: span 8; }
          .ax-nft-grid > .ax-col-side { grid-column: span 4; }
          .ax-nft-grid > .ax-col-wide { grid-column: span 8; }
          .ax-nft-grid > .ax-col-narrow { grid-column: span 4; }
        }
      `}</style>
    </>
  );
}

export default Nft;
