'use client';
/*
 * Vireo Next.js — NFT · Live Auction.
 * Faithful re-expression of src/html/nft/live-auction.html: a filter bar (All /
 * Live / Ending soon / Ended chips with live counts + sort), and a grid of
 * auction cards whose countdowns tick down live (a 1s interval decrements each
 * card's remaining seconds). Colors escalate as the timer nears zero. The Alpine
 * axAuctions() store is rebuilt as React state. Classes / ARIA match 1:1.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };

interface Auction { id: number; title: string; creator: string; verified: boolean; bid: number; bids: number; remain: number; angle: number; c1: string; c2: string; }
const SEED: Auction[] = [
  { id: 1, title: 'Neon Drifter #218', creator: 'Vortex Labs', verified: true, bid: 3.80, bids: 24, remain: 2538, angle: 135, c1: C.violet, c2: C.cyan },
  { id: 2, title: 'Soft Static #03', creator: 'Mira Aoki', verified: true, bid: 0.85, bids: 9, remain: 182, angle: 150, c1: C.emerald, c2: C.violet },
  { id: 3, title: 'Pastel Voyage #07', creator: 'Mira Aoki', verified: true, bid: 2.10, bids: 14, remain: 4445, angle: 160, c1: C.pink, c2: C.amber },
  { id: 4, title: 'Glyph Engine #44', creator: 'Helio Studio', verified: true, bid: 5.40, bids: 31, remain: 551, angle: 140, c1: C.emerald, c2: C.cyan },
  { id: 5, title: 'Iron Bloom #99', creator: 'Kojima.eth', verified: false, bid: 1.70, bids: 7, remain: 9100, angle: 125, c1: C.amber, c2: C.pink },
  { id: 6, title: 'Marble Ghost #56', creator: 'Helio Studio', verified: true, bid: 6.80, bids: 42, remain: 3320, angle: 128, c1: C.violet, c2: C.emerald },
  { id: 7, title: 'Bone Field #102', creator: 'Nova Reyes', verified: true, bid: 1.10, bids: 5, remain: 74, angle: 155, c1: C.cyan, c2: C.pink },
  { id: 8, title: 'Chrome Spirit #44', creator: 'Nova Reyes', verified: true, bid: 2.40, bids: 18, remain: 0, angle: 130, c1: C.cyan, c2: C.violet },
  { id: 9, title: 'Solar Beast #088', creator: 'Kojima.eth', verified: false, bid: 0.92, bids: 11, remain: 0, angle: 165, c1: C.amber, c2: C.violet },
  { id: 10, title: 'Echo Warden #1201', creator: 'Vortex Labs', verified: true, bid: 1.20, bids: 6, remain: 6240, angle: 145, c1: C.pink, c2: C.cyan },
];

const VERIFIED_BADGE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--ax-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-label="Verified" style={{ width: 14, height: 14, flex: 'none' }}><path d="M5 7.2a2.2 2.2 0 0 1 2.2 -2.2h1a2.2 2.2 0 0 0 1.55 -.64l.7 -.7a2.2 2.2 0 0 1 3.12 0l.7 .7c.412 .41 .97 .64 1.55 .64h1a2.2 2.2 0 0 1 2.2 2.2v1c0 .58 .23 1.138 .64 1.55l.7 .7a2.2 2.2 0 0 1 0 3.12l-.7 .7a2.2 2.2 0 0 0 -.64 1.55v1a2.2 2.2 0 0 1 -2.2 2.2h-1a2.2 2.2 0 0 0 -1.55 .64l-.7 .7a2.2 2.2 0 0 1 -3.12 0l-.7 -.7a2.2 2.2 0 0 0 -1.55 -.64h-1a2.2 2.2 0 0 1 -2.2 -2.2v-1a2.2 2.2 0 0 0 -.64 -1.55l-.7 -.7a2.2 2.2 0 0 1 0 -3.12l.7 -.7a2.2 2.2 0 0 0 .64 -1.55v-1" /><path d="M9 12l2 2l4 -4" /></svg>
);

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export function LiveAuction() {
  const [auctions, setAuctions] = useState<Auction[]>(SEED);
  const [filter, setFilter] = useState<'all' | 'live' | 'ending' | 'ended'>('all');
  const [sort, setSort] = useState('ending');

  useEffect(() => {
    const t = setInterval(() => setAuctions((list) => list.map((a) => (a.remain > 0 ? { ...a, remain: a.remain - 1 } : a))), 1000);
    return () => clearInterval(t);
  }, []);

  const tabs = [
    { id: 'all' as const, label: 'All', count: auctions.length },
    { id: 'live' as const, label: 'Live', count: auctions.filter((a) => a.remain > 600).length },
    { id: 'ending' as const, label: 'Ending soon', count: auctions.filter((a) => a.remain > 0 && a.remain <= 600).length },
    { id: 'ended' as const, label: 'Ended', count: auctions.filter((a) => a.remain <= 0).length },
  ];

  const liveCount = auctions.filter((a) => a.remain > 0).length;
  const endingCount = auctions.filter((a) => a.remain > 0 && a.remain <= 3600).length;

  const filtered = useMemo(() => {
    let r = auctions.filter((a) => {
      if (filter === 'live') return a.remain > 600;
      if (filter === 'ending') return a.remain > 0 && a.remain <= 600;
      if (filter === 'ended') return a.remain <= 0;
      return true;
    });
    const by: Record<string, (a: Auction, b: Auction) => number> = {
      ending: (a, b) => ((a.remain <= 0 ? 1 : 0) - (b.remain <= 0 ? 1 : 0)) || a.remain - b.remain,
      bid: (a, b) => b.bid - a.bid,
      bids: (a, b) => b.bids - a.bids,
    };
    if (by[sort]) r = [...r].sort(by[sort]);
    return r;
  }, [auctions, filter, sort]);

  return (
    <>
      <PageHead
        title="Live Auction"
        subtitle={(<><span className="ax-num">{liveCount}</span> auctions live now · <span className="ax-num">{endingCount}</span> ending within the hour.</>) as unknown as string}
        actions={
          <>
            <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ alignSelf: 'center' }}><span className="ax-badge__dot" />Live updating</span>
            <Link className="ax-btn ax-btn--primary" href="/nft/create-nft">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" /><path d="M6 9l4 4" /><path d="M13 10l-4 -4" /><path d="M3 21h7" /><path d="M6.793 15.793l-3.586 -3.586a1 1 0 0 1 0 -1.414l2.293 -2.293l.5 .5l3 -3l-.5 -.5l2.293 -2.293a1 1 0 0 1 1.414 0l3.586 3.586a1 1 0 0 1 0 1.414l-2.293 2.293l-.5 -.5l-3 3l.5 .5l-2.293 2.293a1 1 0 0 1 -1.414 0" /></svg>
              <span className="ax-btn__label">Start auction</span>
            </Link>
          </>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Auction filters">
          <div className="ax-card__body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)' }}>
              {tabs.map((t) => (
                <button key={t.id} type="button" className={`ax-badge ax-badge--pill ${filter === t.id ? 'ax-badge--accent ax-badge--solid' : 'ax-badge--neutral ax-badge--soft'}`} style={{ cursor: 'pointer', border: 0 }} onClick={() => setFilter(t.id)} aria-pressed={filter === t.id}>
                  <span>{t.label}</span>
                  <span className="ax-num" style={{ marginInlineStart: 5, opacity: 0.85 }}>{t.count}</span>
                </button>
              ))}
            </div>
            <span style={{ flex: '1 1 auto' }} />
            <select className="ax-select ax-select--sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort auctions" style={{ minWidth: 160 }}>
              <option value="ending">Ending soonest</option>
              <option value="bid">Highest bid</option>
              <option value="bids">Most bids</option>
            </select>
          </div>
        </section>

        <div className="ax-col--12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(264px,1fr))', gap: 'var(--ax-space-5)' }}>
          {filtered.map((a) => {
            const ended = a.remain <= 0;
            const countdownColor = ended ? '#fff' : a.remain < 300 ? 'color-mix(in oklab,var(--ax-danger-500),white 32%)' : a.remain < 600 ? 'color-mix(in oklab,var(--ax-warning-500),white 32%)' : '#fff';
            return (
              <article key={a.id} className="ax-card ax-card--interactive" style={{ margin: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...(ended ? { opacity: 0.82 } : {}) }}>
                <div style={{ position: 'relative', aspectRatio: '4/3', background: `linear-gradient(${a.angle}deg, color-mix(in oklab,${a.c1} 76%,var(--ax-surface-solid)), color-mix(in oklab,${a.c2} 58%,var(--ax-surface-solid)))` }}>
                  {!ended && <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineStart: 'var(--ax-space-3)' }}><span className="ax-badge__dot" />Live</span>}
                  {ended && <span className="ax-badge ax-badge--solid ax-badge--neutral ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineStart: 'var(--ax-space-3)' }}>Ended</span>}
                  <span className="ax-num" style={{ position: 'absolute', top: 'var(--ax-space-3)', insetInlineEnd: 'var(--ax-space-3)', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-semibold)', padding: '4px 9px', borderRadius: 'var(--ax-radius-pill)', backdropFilter: 'blur(6px)', background: 'rgba(8,10,15,.5)', color: countdownColor }}>
                    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
                    <span>{ended ? 'Closed' : fmt(a.remain)}</span>
                  </span>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 52, height: 52 }}><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>
                  </span>
                </div>
                <div className="ax-card__body" style={{ padding: 'var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', flex: '1 1 auto' }}>
                  <div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                      <span className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', flex: '1 1 auto', minWidth: 0 }}>{a.title}</span>
                      {a.verified && VERIFIED_BADGE}
                    </div>
                    <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>by {a.creator}</div>
                  </div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)' }}>{ended ? 'Sold for' : 'Current bid'}</div>
                      <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>{a.bid.toFixed(2)} ETH</div>
                    </div>
                    <div className="ax-cluster" style={{ gap: 5, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 14, height: 14 }}><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
                      <span className="ax-num">{a.bids}</span>
                    </div>
                  </div>
                  <button type="button" className={`ax-btn ax-btn--block ${ended ? 'ax-btn--secondary' : 'ax-btn--primary'}`} disabled={ended}>{ended ? 'Auction ended' : 'Place bid'}</button>
                </div>
              </article>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="ax-col--12" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
            <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 28, height: 28 }}><path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" /><path d="M6 9l4 4" /><path d="M13 10l-4 -4" /><path d="M3 21h7" /></svg></span>
            <h3 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', marginBottom: 'var(--ax-space-2)' }}>No auctions here</h3>
            <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Nothing matches this filter right now. Check back soon.</p>
          </div>
        )}
      </div>
    </>
  );
}

export default LiveAuction;
