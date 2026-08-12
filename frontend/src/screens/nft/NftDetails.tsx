'use client';
/*
 * Vireo Next.js — NFT · Item details.
 * Faithful re-expression of src/html/nft/nft-details.html: media plate, a tabbed
 * info panel (description / properties / history / offers), a summary card, and
 * an accent-edge bid panel with a live countdown timer, price-history area chart
 * (ApexChart) and bid validation. The Alpine axNftDetails()/axBidPanel() stores
 * are rebuilt as React state + a tick effect. Classes / ARIA match 1:1.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const TRAITS = [
  { k: 'Background', v: 'Bone', rarity: '12%' },
  { k: 'Palette', v: 'Verdigris', rarity: '8%' },
  { k: 'Density', v: 'Sparse', rarity: '21%' },
  { k: 'Seed', v: 'A-0001', rarity: '1%' },
  { k: 'Motion', v: 'Still', rarity: '64%' },
  { k: 'Edition', v: 'Genesis', rarity: '1%' },
];
const OFFERS = [
  { id: 1, eth: 2.25, diff: -6, from: '0x77c1…9e02', expires: 'in 2 days' },
  { id: 2, eth: 2.10, diff: -13, from: '0x2def…aa10', expires: 'in 5 hours' },
  { id: 3, eth: 2.05, diff: -15, from: '0xb0de…3c44', expires: 'in 1 day' },
  { id: 4, eth: 1.90, diff: -21, from: '0x55ab…77f1', expires: 'in 3 days' },
  { id: 5, eth: 1.80, diff: -25, from: '0x9a01…0b2e', expires: 'in 6 hours' },
];
const HISTORY = [
  { id: 1, kind: 'bid', label: 'Bid placed', price: '2.40 ETH', who: '0x14bd…77a9', time: '8m ago', color: 'var(--ax-viz-violet)', icon: <><path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" /><path d="M6 9l4 4" /><path d="M13 10l-4 -4" /><path d="M3 21h7" /></> },
  { id: 2, kind: 'bid', label: 'Bid placed', price: '2.20 ETH', who: '0x77c1…9e02', time: '42m ago', color: 'var(--ax-viz-violet)', icon: <><path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" /><path d="M6 9l4 4" /><path d="M13 10l-4 -4" /><path d="M3 21h7" /></> },
  { id: 3, kind: 'list', label: 'Listed for auction', price: '2.00 ETH', who: 'Mira Aoki', time: '2d ago', color: 'var(--ax-viz-amber)', icon: <><path d="M9 12l2 2l4 -4" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></> },
  { id: 4, kind: 'sale', label: 'Sold', price: '1.65 ETH', who: '0x8a2f…14bd', time: '3w ago', color: 'var(--ax-viz-emerald)', icon: <><path d="M5 12l5 5l10 -10" /></> },
  { id: 5, kind: 'mint', label: 'Minted', price: '', who: 'Mira Aoki', time: 'Jun 14, 2026', color: 'var(--ax-viz-cyan)', icon: <><path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /></> },
];

const VERIFIED_BADGE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ax-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Verified collection" style={{ width: 15, height: 15 }}><path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7c.412 .41 .97 .64 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1c0 .58 .23 1.138 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" /><path d="M9 12l2 2l4 -4" /></svg>
);

const pad = (x: number) => String(x).padStart(2, '0');
const fmtClock = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

function BidPanel() {
  const inc = 0.05;
  const [current, setCurrent] = useState(2.40);
  const [bids, setBids] = useState(12);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState(false);
  const [remain, setRemain] = useState(6 * 3600 + 12 * 60 + 40);

  useEffect(() => {
    const t = setInterval(() => setRemain((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const ended = remain <= 0;
  const urgent = remain > 0 && remain < 600;
  const clock = ended ? '00:00:00' : fmtClock(remain);

  const placeBid = () => {
    const v = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
    const min = current + inc;
    if (isNaN(v)) { setError('Enter a bid amount in ETH.'); setPlaced(false); return; }
    if (v < min) { setError('Bid must be at least ' + min.toFixed(2) + ' ETH.'); setPlaced(false); return; }
    setError(''); setCurrent(v); setBids((b) => b + 1); setPlaced(true); setAmount('');
  };

  return (
    <section className="ax-card ax-card--accent-edge" role="region" aria-label="Purchase">
      <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--ax-space-3) var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)' }}>
          <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>Auction ends in</span>
          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-md)', color: urgent ? 'var(--ax-warning-500)' : 'var(--ax-text-strong)' }}>{ended ? 'Ended' : clock}</span>
        </div>

        <div>
          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Current bid</div>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'baseline' }}>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)' }}>{current.toFixed(2)} ETH</span>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>${(current * 2380).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>{bids} bids · min next {(current + inc).toFixed(2)} ETH</div>
        </div>

        <div>
          <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-1)' }}>
            <span className="ax-label" style={{ margin: 0 }}>Price history</span>
            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)' }}>+18% / 30d</span>
          </div>
          <ApexChart
            type="area"
            height={150}
            legend="none"
            accent
            ariaLabel="Line chart of price history over the last 30 days"
            series={[{ name: 'Price (ETH)', data: [1.65, 1.7, 1.62, 1.78, 1.85, 1.8, 1.95, 2.05, 2.0, 2.2, 2.3, 2.4] }]}
            apex={{
              stroke: { width: 2.5, curve: 'smooth' },
              xaxis: { labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
              yaxis: { show: false },
              grid: { show: false, padding: { left: 0, right: 0, top: 0, bottom: 0 } },
              tooltip: { y: { formatter: (v: number) => v.toFixed(2) + ' ETH' } },
            }}
          />
        </div>

        {!ended && (
          <form className="ax-flex" onSubmit={(e) => { e.preventDefault(); placeBid(); }} style={{ flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-field" style={{ margin: 0 }}>
              <label className="ax-label" htmlFor="bid-amount">Your bid</label>
              <div className="ax-input-group" style={error ? { borderColor: 'var(--ax-danger-500)' } : undefined}>
                <input id="bid-amount" type="text" className="ax-input ax-num" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} placeholder="0.00" style={{ border: 0, background: 'transparent', fontFamily: 'var(--ax-font-mono)' }} />
                <span className="ax-input-group__addon" style={{ color: 'var(--ax-text-muted)', fontWeight: 'var(--ax-weight-medium)' }}>ETH</span>
              </div>
              {error && <span className="ax-flex" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-danger-500)', alignItems: 'center', gap: 4, marginTop: 4 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg><span>{error}</span></span>}
              {placed && <span className="ax-flex" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)', alignItems: 'center', gap: 4, marginTop: 4 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 13, height: 13 }}><path d="M5 12l5 5l10 -10" /></svg>Bid placed — you&apos;re the top bidder.</span>}
            </div>
            <button type="submit" className="ax-btn ax-btn--primary ax-btn--block">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" /><path d="M6 9l4 4" /><path d="M13 10l-4 -4" /><path d="M3 21h7" /><path d="M6.793 15.793l-3.586 -3.586a1 1 0 0 1 0 -1.414l2.293 -2.293l.5 .5l3 -3l-.5 -.5l2.293 -2.293a1 1 0 0 1 1.414 0l3.586 3.586a1 1 0 0 1 0 1.414l-2.293 2.293l-.5 -.5l-3 3l.5 .5l-2.293 2.293a1 1 0 0 1 -1.414 0" /></svg>
              <span className="ax-btn__label">Place bid</span>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">Buy now for <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', marginInlineStart: 4 }}>6.50 ETH</span></button>
          </form>
        )}
        {ended && <div className="ax-alert ax-alert--info ax-alert--inline"><div className="ax-alert__content"><div className="ax-alert__message">This auction has ended. Bidding is closed.</div></div></div>}
      </div>
    </section>
  );
}

export function NftDetails() {
  const [fav, setFav] = useState(false);
  const [tab, setTab] = useState<'desc' | 'props' | 'history' | 'offers'>('desc');

  return (
    <>
      <PageHead
        title="Quiet Forms #001"
        subtitle={(<>Quiet Forms collection · Token <span className="ax-num">#001</span> · Minted on Ethereum, Jun 14, 2026.</>) as unknown as string}
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/nft/marketplace">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Back to market</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Share item">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M8.7 10.7l6.6 -3.4" /><path d="M8.7 13.3l6.6 3.4" /><path d="M14 5.5a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M14 18.5a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-pressed={fav} onClick={() => setFav((f) => !f)} aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}>
              <svg viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 18, height: 18, ...(fav ? { color: 'var(--ax-accent)' } : {}) }}><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid" style={{ alignItems: 'start' }}>
        {/* LEFT: MEDIA + TABS */}
        <div className="ax-col--7" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Artwork">
            <div className="ax-card__body">
              <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--ax-radius-lg)', overflow: 'hidden', border: '1px solid var(--ax-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, color-mix(in oklab,var(--ax-viz-violet) 78%,var(--ax-surface-solid)), color-mix(in oklab,var(--ax-viz-cyan) 58%,var(--ax-surface-solid)))' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 84, height: 84 }}><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" style={{ position: 'absolute', top: 12, insetInlineEnd: 12, backdropFilter: 'blur(6px)' }} aria-label="Open full screen">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 4l4 0l0 4" /><path d="M14 10l6 -6" /><path d="M8 20l-4 0l0 -4" /><path d="M4 20l6 -6" /></svg>
                </button>
                <span className="ax-cluster" style={{ position: 'absolute', bottom: 12, insetInlineStart: 12, gap: 'var(--ax-space-2)' }}>
                  <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--pill" style={{ backdropFilter: 'blur(6px)' }}><svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /></svg>2400 × 2400</span>
                  <span className="ax-num ax-badge ax-badge--neutral ax-badge--soft ax-badge--pill" style={{ fontFamily: 'var(--ax-font-mono)', backdropFilter: 'blur(6px)' }}><svg viewBox="0 0 24 24" fill={fav ? 'var(--ax-accent)' : 'none'} stroke={fav ? 'var(--ax-accent)' : 'currentColor'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 12, height: 12 }}><path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" /></svg><span>{fav ? 185 : 184}</span></span>
                </span>
              </div>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Item information">
            <div className="ax-card__body">
              <div className="ax-tabs">
                <div className="ax-tabs__list" role="tablist" aria-label="Item details">
                  <button type="button" className={`ax-tabs__tab${tab === 'desc' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'desc'} onClick={() => setTab('desc')}>Description</button>
                  <button type="button" className={`ax-tabs__tab${tab === 'props' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'props'} onClick={() => setTab('props')}>Properties</button>
                  <button type="button" className={`ax-tabs__tab${tab === 'history' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>History</button>
                  <button type="button" className={`ax-tabs__tab${tab === 'offers' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'offers'} onClick={() => setTab('offers')}>Offers <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--sm ax-tabs__badge ax-num">5</span></button>
                </div>

                {tab === 'desc' && (
                  <div className="ax-tabs__panel" role="tabpanel">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7 }}>
                      <p>Quiet Forms #001 is the genesis piece of a 144-edition generative series exploring restraint — soft gradients resolved from a single seed, each frame deterministic and on-chain. The palette is drawn from a fixed verdigris-to-cyan ramp; no two seeds repeat.</p>
                      <p>Holding this token grants access to the Quiet Forms drop list and a high-resolution render licensed for personal display. The artwork is stored on IPFS with the contract pinning a permanent backup.</p>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--pill">Generative</span>
                        <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--pill">On-chain</span>
                        <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--pill">1 of 144</span>
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'props' && (
                  <div className="ax-tabs__panel" role="tabpanel">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 'var(--ax-space-3)' }}>
                      {TRAITS.map((t) => (
                        <div key={t.k} style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3)', textAlign: 'center', background: 'var(--ax-surface-subtle)' }}>
                          <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-medium)' }}>{t.k}</div>
                          <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginTop: 3 }}>{t.v}</div>
                          <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>{t.rarity + ' have this'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'history' && (
                  <div className="ax-tabs__panel" role="tabpanel">
                    <ul className="ax-timeline">
                      {HISTORY.map((e) => (
                        <li key={e.id} className={`ax-timeline__item${e.kind === 'sale' ? ' ax-timeline__item--success' : ''}`}>
                          <span className="ax-timeline__marker" style={{ color: e.color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{e.icon}</svg></span>
                          <div className="ax-timeline__content">
                            <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>{e.label}</b> {e.price && <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{e.price}</span>} {e.who && <span style={{ color: 'var(--ax-text-muted)' }}>· {e.who}</span>}</p>
                            <span className="ax-timeline__time">{e.time}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tab === 'offers' && (
                  <div className="ax-tabs__panel" role="tabpanel">
                    <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-5))' }}>
                      <table className="ax-table ax-table--hover">
                        <thead className="ax-table__head">
                          <tr>
                            <th className="ax-table__th ax-table__th--num" scope="col">Price</th>
                            <th className="ax-table__th ax-table__th--num" scope="col">USD</th>
                            <th className="ax-table__th" scope="col">Floor diff</th>
                            <th className="ax-table__th" scope="col">From</th>
                            <th className="ax-table__th" scope="col">Expires</th>
                          </tr>
                        </thead>
                        <tbody>
                          {OFFERS.map((o) => (
                            <tr key={o.id} className="ax-table__row">
                              <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{o.eth.toFixed(2)} ETH</td>
                              <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>${(o.eth * 2380).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                              <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: o.diff < 0 ? 'var(--ax-viz-red)' : 'var(--ax-viz-emerald)' }}>{(o.diff > 0 ? '+' : '') + o.diff + '%'}</td>
                              <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{o.from}</td>
                              <td className="ax-table__td" style={{ color: 'var(--ax-text-subtle)' }}>{o.expires}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <aside className="ax-col--5" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Item summary">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <Link href="/nft/marketplace" className="ax-link" style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)' }}>Quiet Forms</Link>
                {VERIFIED_BADGE}
              </div>
              <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', lineHeight: 1.2 }}>Quiet Forms #001</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                  <span className="ax-avatar ax-avatar--sm" style={{ background: 'linear-gradient(135deg,var(--ax-viz-violet),var(--ax-viz-pink))', flex: 'none' }} aria-hidden="true" />
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)' }}>Creator</div><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Mira Aoki</div></div>
                </div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                  <span className="ax-avatar ax-avatar--sm" style={{ background: 'linear-gradient(135deg,var(--ax-viz-cyan),var(--ax-viz-emerald))', flex: 'none' }} aria-hidden="true" />
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)' }}>Owner</div><div className="ax-text-truncate ax-num" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)', fontFamily: 'var(--ax-font-mono)' }}>0x8a2f…14bd</div></div>
                </div>
              </div>
            </div>
          </section>

          <BidPanel />

          <section className="ax-card" role="region" aria-label="Item details">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Details</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-list ax-list--compact">
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Contract</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text)' }}>0x4e91…a07c</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Token ID</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text)' }}>1</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Token standard</span></span><span className="ax-list__trailing" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>ERC-721</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Chain</span></span><span className="ax-list__trailing" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Ethereum</span></li>
                <li className="ax-list__row" style={{ paddingInline: 0, borderBottom: 0 }}><span className="ax-list__content"><span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Creator royalty</span></span><span className="ax-list__trailing ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>5%</span></li>
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default NftDetails;
