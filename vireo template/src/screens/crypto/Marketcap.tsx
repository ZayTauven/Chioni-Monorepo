'use client';
/*
 * Vireo Next.js — Crypto · Marketcap.
 * Faithful re-expression of src/html/crypto/marketcap.html: global stat strip +
 * a searchable / filterable / sortable cryptocurrency prices table with inline
 * sparklines and a watchlist toggle. The Alpine axMarketcap() store is rebuilt
 * as React state. DOM classes / ARIA match the reference 1:1.
 */
import { useMemo, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { CryptoTabs } from './CryptoTabs';

const ICON_BTC = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6h8a3 3 0 0 1 0 6a3 3 0 0 1 0 6h-8" /><path d="M8 6l0 12" /><path d="M8 12l6 0" /><path d="M9 3l0 3" /><path d="M13 3l0 3" /><path d="M9 18l0 3" /><path d="M13 18l0 3" /></svg>
);
const ICON_ETH = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>
);
const ICON_SOL = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18h12l4 -4h-12l-4 4" /><path d="M8 14l-4 -4h12l4 4" /><path d="M16 10l4 -4h-12l-4 4" /></svg>
);
const ICON_GEN = (
  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /><path d="M9 9h6" /><path d="M9 15h6" /></svg>
);

const S_UP = 'M2 30 16 26 30 28 44 20 58 22 72 14 86 12 108 4';
const S_DN = 'M2 6 16 9 30 8 44 14 58 12 72 19 86 22 108 30';
const S_WV = 'M2 18 16 12 30 22 44 14 58 24 72 16 86 20 108 12';

interface Coin {
  rank: number; name: string; sym: string; color: string; icon: React.ReactElement;
  price: number; h1: number; change: number; d7: number; cap: string; vol: string; watch: boolean; spark: string;
}
const COINS: Coin[] = [
  { rank: 1, name: 'Bitcoin', sym: 'BTC', color: 'var(--ax-viz-amber)', icon: ICON_BTC, price: 67840.20, h1: 0.4, change: 2.1, d7: 6.8, cap: '$1.34T', vol: '$28.4B', watch: true, spark: S_UP },
  { rank: 2, name: 'Ethereum', sym: 'ETH', color: 'var(--ax-viz-violet)', icon: ICON_ETH, price: 3512.00, h1: 0.2, change: 3.7, d7: 9.2, cap: '$422.1B', vol: '$14.8B', watch: true, spark: S_UP },
  { rank: 3, name: 'Tether', sym: 'USDT', color: 'var(--ax-viz-cyan)', icon: ICON_GEN, price: 1.0001, h1: 0.0, change: 0.0, d7: 0.1, cap: '$112.4B', vol: '$41.2B', watch: false, spark: S_WV },
  { rank: 4, name: 'Solana', sym: 'SOL', color: 'var(--ax-viz-emerald)', icon: ICON_SOL, price: 184.20, h1: 1.1, change: 18.2, d7: 24.6, cap: '$84.9B', vol: '$6.2B', watch: true, spark: S_UP },
  { rank: 5, name: 'BNB', sym: 'BNB', color: 'var(--ax-viz-amber)', icon: ICON_GEN, price: 592.40, h1: -0.3, change: 1.4, d7: 3.1, cap: '$87.6B', vol: '$1.9B', watch: false, spark: S_WV },
  { rank: 6, name: 'XRP', sym: 'XRP', color: 'var(--ax-viz-cyan)', icon: ICON_GEN, price: 0.5240, h1: 0.6, change: -1.8, d7: -4.2, cap: '$29.1B', vol: '$1.1B', watch: false, spark: S_DN },
  { rank: 7, name: 'Cardano', sym: 'ADA', color: 'var(--ax-viz-cyan)', icon: ICON_GEN, price: 0.4520, h1: 0.3, change: 1.3, d7: 5.7, cap: '$16.0B', vol: '$0.42B', watch: false, spark: S_UP },
  { rank: 8, name: 'Avalanche', sym: 'AVAX', color: 'var(--ax-viz-pink)', icon: ICON_GEN, price: 38.10, h1: -0.8, change: -2.4, d7: -6.1, cap: '$15.2B', vol: '$0.58B', watch: false, spark: S_DN },
  { rank: 9, name: 'Dogecoin', sym: 'DOGE', color: 'var(--ax-viz-amber)', icon: ICON_GEN, price: 0.1620, h1: 0.9, change: 4.6, d7: 11.3, cap: '$23.4B', vol: '$1.4B', watch: false, spark: S_UP },
  { rank: 10, name: 'Polkadot', sym: 'DOT', color: 'var(--ax-viz-red)', icon: ICON_GEN, price: 6.940, h1: -0.2, change: -0.8, d7: 2.4, cap: '$9.8B', vol: '$0.31B', watch: true, spark: S_WV },
  { rank: 11, name: 'Chainlink', sym: 'LINK', color: 'var(--ax-viz-cyan)', icon: ICON_GEN, price: 14.820, h1: 0.7, change: 5.4, d7: 8.9, cap: '$8.7B', vol: '$0.39B', watch: false, spark: S_UP },
  { rank: 12, name: 'Polygon', sym: 'MATIC', color: 'var(--ax-viz-violet)', icon: ICON_GEN, price: 0.7280, h1: 0.4, change: 2.9, d7: 6.2, cap: '$7.1B', vol: '$0.28B', watch: false, spark: S_UP },
  { rank: 13, name: 'Litecoin', sym: 'LTC', color: 'var(--ax-viz-emerald)', icon: ICON_GEN, price: 84.10, h1: -0.5, change: -1.2, d7: -2.8, cap: '$6.3B', vol: '$0.34B', watch: false, spark: S_DN },
  { rank: 14, name: 'Shiba Inu', sym: 'SHIB', color: 'var(--ax-viz-pink)', icon: ICON_GEN, price: 0.0000241, h1: 1.4, change: 7.1, d7: 14.8, cap: '$14.2B', vol: '$0.62B', watch: false, spark: S_UP },
];

const pct = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%';
const dollar = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: v < 1 ? 4 : 2, maximumFractionDigits: v < 1 ? 4 : 2 });

export function Marketcap() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'gainers' | 'watch'>('all');
  const [sortBy, setSortBy] = useState<'price' | 'change' | 'cap'>('cap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [watch, setWatch] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COINS.map((c) => [c.sym, c.watch])),
  );

  const sort = (key: 'price' | 'change' | 'cap') => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let r = COINS.filter((c) => {
      const m = (c.name + ' ' + c.sym).toLowerCase().includes(q.toLowerCase());
      const t = tab === 'all' || (tab === 'gainers' && c.change > 0) || (tab === 'watch' && watch[c.sym]);
      return m && t;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const k = ({ price: 'price', change: 'change', cap: 'rank' } as const)[sortBy];
    r = [...r].sort((a, b) => {
      if (sortBy === 'cap') return (a.rank - b.rank) * (dir === 1 ? 1 : -1) * -1;
      return ((a[k as 'price' | 'change'] as number) - (b[k as 'price' | 'change'] as number)) * dir;
    });
    return r;
  }, [q, tab, sortBy, sortDir, watch]);

  return (
    <>
      <PageHead
        title="Marketcap"
        subtitle={(<>Live prices across <span className="ax-num">10,482</span> coins — total cap <span className="ax-num">$2.41T</span>.</>) as unknown as string}
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
              <span className="ax-btn__label">Watchlist</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6h8a3 3 0 0 1 0 6a3 3 0 0 1 0 6h-8" /><path d="M8 6l0 12" /><path d="M8 12l6 0" /><path d="M9 3l0 3" /><path d="M13 3l0 3" /><path d="M9 18l0 3" /><path d="M13 18l0 3" /></svg>
              <span className="ax-btn__label">Buy crypto</span>
            </button>
          </>
        }
      />

      <CryptoTabs active="crypto/marketcap" />

      {/* GLOBAL STAT STRIP */}
      <div className="ax-dash-grid" style={{ marginBottom: 'var(--ax-space-6)' }}>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total market cap">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12l9 -3" /><path d="M12 12v9" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>1.9%</span>
            </div>
            <div className="ax-kpi__label">Total Market Cap</div>
            <div className="ax-kpi__value ax-num">$2.41T</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="24 hour volume">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h4l3 8l4 -16l3 8h4" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>2.4%</span>
            </div>
            <div className="ax-kpi__label">24h Volume</div>
            <div className="ax-kpi__value ax-num">$94.6B</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Bitcoin dominance">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6h8a3 3 0 0 1 0 6a3 3 0 0 1 0 6h-8" /><path d="M8 6l0 12" /><path d="M8 12l6 0" /><path d="M9 3l0 3" /><path d="M13 3l0 3" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>0.3%</span>
            </div>
            <div className="ax-kpi__label">BTC Dominance</div>
            <div className="ax-kpi__value ax-num">52.4%</div>
          </div>
        </div>
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Fear and greed index">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12l3 -2" /><path d="M12 7v5" /></svg></span>
              <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>7 pts</span>
            </div>
            <div className="ax-kpi__label">Fear &amp; Greed</div>
            <div className="ax-kpi__value ax-num">68 <span style={{ fontSize: 'var(--ax-text-sm)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-viz-amber)' }}>Greed</span></div>
          </div>
        </div>
      </div>

      {/* COINS TABLE */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Cryptocurrency market table">
          <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Cryptocurrency Prices</h2>
              <p className="ax-card__subtitle ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{filtered.length} of {COINS.length} coins</p>
            </div>
            <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
              <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--ax-text-subtle)' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input ax-input--sm" placeholder="Search coin or symbol…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search coins" style={{ paddingInlineStart: 34 }} />
              </div>
              <div className="ax-segment" role="group" aria-label="Filter">
                <button type="button" className={`ax-segment__option${tab === 'all' ? ' is-active' : ''}`} aria-checked={tab === 'all'} onClick={() => setTab('all')}>All</button>
                <button type="button" className={`ax-segment__option${tab === 'gainers' ? ' is-active' : ''}`} aria-checked={tab === 'gainers'} onClick={() => setTab('gainers')}>Gainers</button>
                <button type="button" className={`ax-segment__option${tab === 'watch' ? ' is-active' : ''}`} aria-checked={tab === 'watch'} onClick={() => setTab('watch')}>Watchlist</button>
              </div>
            </div>
          </div>

          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col" style={{ width: 40 }}><span className="ax-visually">Watchlist</span></th>
                  <th className="ax-table__th ax-table__th--num" scope="col" style={{ width: 48 }}>#</th>
                  <th className="ax-table__th" scope="col">Name</th>
                  <th className="ax-table__th ax-table__th--num ax-table__th--sort" scope="col" aria-sort={sortBy === 'price' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="ax-btn ax-btn--link" onClick={() => sort('price')} style={{ color: 'inherit', font: 'inherit' }}>Price <span aria-hidden="true">{sortBy === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span></button>
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">1h</th>
                  <th className="ax-table__th ax-table__th--num ax-table__th--sort" scope="col" aria-sort={sortBy === 'change' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="ax-btn ax-btn--link" onClick={() => sort('change')} style={{ color: 'inherit', font: 'inherit' }}>24h <span aria-hidden="true">{sortBy === 'change' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span></button>
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">7d</th>
                  <th className="ax-table__th ax-table__th--num ax-table__th--sort" scope="col" aria-sort={sortBy === 'cap' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="ax-btn ax-btn--link" onClick={() => sort('cap')} style={{ color: 'inherit', font: 'inherit' }}>Market Cap <span aria-hidden="true">{sortBy === 'cap' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span></button>
                  </th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Volume (24h)</th>
                  <th className="ax-table__th" scope="col" style={{ width: 130 }}>Last 7 days</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const w = watch[c.sym];
                  return (
                    <tr key={c.sym} className="ax-table__row">
                      <td className="ax-table__td">
                        <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setWatch((s) => ({ ...s, [c.sym]: !s[c.sym] }))} aria-label={(w ? 'Remove ' : 'Add ') + c.name + ' to watchlist'} aria-pressed={w}>
                          <svg viewBox="0 0 24 24" width={17} height={17} fill={w ? 'var(--ax-viz-amber)' : 'none'} stroke={w ? 'var(--ax-viz-amber)' : 'currentColor'} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                        </button>
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-subtle)' }}>{c.rank}</td>
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.color} 18%,transparent)`, color: c.color }}>{c.icon}</span>
                          <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{c.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{c.sym}</div></div>
                        </div>
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{dollar(c.price)}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ color: c.h1 >= 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }}>{pct(c.h1)}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ color: c.change >= 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }}>{pct(c.change)}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ color: c.d7 >= 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }}>{pct(c.d7)}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{c.cap}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{c.vol}</td>
                      <td className="ax-table__td">
                        <svg viewBox="0 0 110 34" width={110} height={34} fill="none" preserveAspectRatio="none" style={{ color: c.d7 >= 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-viz-red)' }} aria-hidden="true">
                          <path d={c.spark} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ax-card__footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
            <span className="ax-pagination__summary ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }}>Showing {filtered.length} of {COINS.length} coins</span>
            <nav className="ax-pagination" aria-label="Pagination">
              <button type="button" className="ax-pagination__prev" disabled aria-disabled="true" aria-label="Previous page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
              <ul className="ax-pagination__pages">
                <li><a href="#" className="ax-pagination__page is-active" aria-current="page">1</a></li>
                <li><a href="#" className="ax-pagination__page">2</a></li>
                <li><a href="#" className="ax-pagination__page">3</a></li>
                <li><span className="ax-pagination__ellipsis">…</span></li>
                <li><a href="#" className="ax-pagination__page">87</a></li>
              </ul>
              <button type="button" className="ax-pagination__next" aria-label="Next page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
            </nav>
          </div>
        </section>
      </div>
    </>
  );
}

export default Marketcap;
