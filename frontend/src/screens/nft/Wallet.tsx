'use client';
/*
 * Vireo Next.js — NFT · Wallet.
 * Faithful re-expression of src/html/nft/wallet.html: a connect/disconnect
 * gate, a disconnected empty state, and a connected state (balance hero with
 * token holdings, portfolio stats, and an item-collection panel with Owned /
 * Created / Favorited grids + an Activity table). Also the connect modal with
 * provider list / connecting / error states (Ledger simulates a decline). The
 * Alpine axWallet() store is rebuilt as React state. Classes / ARIA match 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const C = { cyan: 'var(--ax-viz-cyan)', violet: 'var(--ax-viz-violet)', pink: 'var(--ax-viz-pink)', amber: 'var(--ax-viz-amber)', emerald: 'var(--ax-viz-emerald)' };
const ADDR = '0x8a2f9d4e1c77b3a06f55214bd90c3e7a14bd77a9';
const ADDR_SHORT = ADDR.slice(0, 6) + '…' + ADDR.slice(-4);

interface Provider { id: string; name: string; desc: string; color: string; popular: boolean; icon: React.ReactElement; }
const PROVIDERS: Provider[] = [
  { id: 'meta', name: 'MetaMask', desc: 'Connect using the browser extension', color: C.amber, popular: true, icon: <path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5" /> },
  { id: 'wc', name: 'WalletConnect', desc: 'Scan with a mobile wallet', color: C.cyan, popular: false, icon: <><path d="M4.912 9.875c3.872 -3.581 10.304 -3.581 14.176 0l.467 .43a.483 .483 0 0 1 0 .714l-1.598 1.48a.252 .252 0 0 1 -.354 0l-.642 -.594c-2.702 -2.5 -7.086 -2.5 -9.788 0l-.688 .636a.252 .252 0 0 1 -.354 0l-1.598 -1.48a.483 .483 0 0 1 0 -.714z" /><path d="M7 13l2 2l3 -3l3 3l2 -2" /></> },
  { id: 'coin', name: 'Coinbase Wallet', desc: 'Connect with Coinbase', color: C.violet, popular: false, icon: <><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 9h6v6h-6z" /></> },
  { id: 'ledger', name: 'Ledger', desc: 'Connect a hardware wallet', color: C.emerald, popular: false, icon: <><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1" /><path d="M9 8v8" /><path d="M13 8h2v8h-2" /></> },
];

interface NftCard { id: number; title: string; collection: string; price: number; listed: boolean; angle: number; c1: string; c2: string; }
const WALLET: Record<'owned' | 'created' | 'favorited', NftCard[]> = {
  owned: [
    { id: 1, title: 'Quiet Forms #018', collection: 'Quiet Forms', price: 2.40, listed: true, angle: 135, c1: C.violet, c2: C.cyan },
    { id: 2, title: 'Porcelain #014', collection: 'Quiet Surface', price: 1.85, listed: false, angle: 120, c1: C.cyan, c2: C.emerald },
    { id: 3, title: 'Marble Ghost #56', collection: 'Chrome Spirits', price: 6.80, listed: false, angle: 128, c1: C.violet, c2: C.emerald },
    { id: 4, title: 'Solar Beast #088', collection: 'Solar Beasts', price: 0.92, listed: true, angle: 165, c1: C.amber, c2: C.pink },
    { id: 5, title: 'Glyph Engine #07', collection: 'Echo Wardens', price: 5.40, listed: false, angle: 130, c1: C.cyan, c2: C.violet },
    { id: 6, title: 'Pastel Voyage #12', collection: 'Aurora Genesis', price: 4.20, listed: false, angle: 145, c1: C.pink, c2: C.cyan },
  ],
  created: [
    { id: 1, title: 'Quiet Forms #145', collection: 'Quiet Forms', price: 2.00, listed: true, angle: 135, c1: C.violet, c2: C.cyan },
    { id: 2, title: 'Quiet Forms #144', collection: 'Quiet Forms', price: 1.90, listed: true, angle: 150, c1: C.emerald, c2: C.violet },
    { id: 3, title: 'Quiet Forms #143', collection: 'Quiet Forms', price: 1.80, listed: false, angle: 128, c1: C.cyan, c2: C.pink },
  ],
  favorited: [
    { id: 1, title: 'Neon Drifter #218', collection: 'Pixel Nomads', price: 3.80, listed: false, angle: 135, c1: C.pink, c2: C.amber },
    { id: 2, title: 'Chrome Spirit #44', collection: 'Chrome Spirits', price: 2.10, listed: false, angle: 140, c1: C.emerald, c2: C.cyan },
    { id: 3, title: 'Iron Bloom #99', collection: 'Solar Beasts', price: 1.70, listed: false, angle: 125, c1: C.amber, c2: C.violet },
    { id: 4, title: 'Bone Field #102', collection: 'Quiet Surface', price: 1.10, listed: false, angle: 155, c1: C.violet, c2: C.pink },
  ],
};
const ACTIVITY = [
  { id: 1, event: 'Purchase', badge: 'ax-badge--success', item: 'Marble Ghost #56', amount: -6.80, fromto: '0x14bd → you', date: '2h ago' },
  { id: 2, event: 'Sale', badge: 'ax-badge--info', item: 'Quiet Forms #143', amount: 1.80, fromto: 'you → 0x77c1', date: 'Yesterday' },
  { id: 3, event: 'Listing', badge: 'ax-badge--warning', item: 'Solar Beast #088', amount: 0.92, fromto: 'you → market', date: 'Jun 24' },
  { id: 4, event: 'Royalty', badge: 'ax-badge--success', item: 'Quiet Forms #144', amount: 0.095, fromto: 'resale', date: 'Jun 22' },
  { id: 5, event: 'Transfer', badge: 'ax-badge--neutral', item: 'Bone Field #102', amount: 0, fromto: '0x2def → you', date: 'Jun 20' },
];

const CONNECT_ICON = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg>;

export function Wallet() {
  const [connected, setConnected] = useState(false);
  const [modal, setModal] = useState(false);
  const [state, setState] = useState<'list' | 'connecting' | 'error'>('list');
  const [active, setActive] = useState<Provider | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'owned' | 'created' | 'favorited' | 'activity'>('owned');

  const openConnect = () => { setModal(true); setState('list'); setActive(null); };
  const closeConnect = () => { setModal(false); setState('list'); };
  const connect = (p: Provider) => {
    setActive(p); setState('connecting');
    setTimeout(() => {
      if (p.id === 'ledger') { setState('error'); }
      else { setConnected(true); setModal(false); setState('list'); }
    }, 1400);
  };
  const disconnect = () => setConnected(false);
  const copyAddr = () => { try { navigator.clipboard?.writeText(ADDR); } catch { /* noop */ } setCopied(true); setTimeout(() => setCopied(false), 2200); };

  return (
    <>
      <PageHead
        title="Wallet"
        subtitle="Your items, balance, and on-chain activity — all in one place."
        actions={
          !connected ? (
            <button type="button" className="ax-btn ax-btn--primary" onClick={openConnect}>{CONNECT_ICON}<span className="ax-btn__label">Connect wallet</span></button>
          ) : (
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill" onClick={copyAddr}>
                <span className="ax-avatar ax-avatar--xs" style={{ background: 'linear-gradient(135deg,var(--ax-viz-violet),var(--ax-viz-cyan))' }} aria-hidden="true" />
                <span className="ax-btn__label ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{ADDR_SHORT}</span>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
              </button>
              <button type="button" className="ax-btn ax-btn--ghost" onClick={disconnect}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg>
                <span className="ax-btn__label">Disconnect</span>
              </button>
            </div>
          )
        }
      />

      {copied && <div className="ax-alert ax-alert--success ax-alert--inline" role="status" style={{ marginBottom: 'var(--ax-space-5)' }}><div className="ax-alert__content"><div className="ax-alert__message">Address copied to clipboard.</div></div></div>}

      {/* DISCONNECTED STATE */}
      {!connected && (
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12" role="region" aria-label="Connect your wallet">
            <div className="ax-card__body" style={{ textAlign: 'center', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)', margin: '0 auto var(--ax-space-4)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 30, height: 30 }}><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg></span>
              <h2 style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', marginBottom: 'var(--ax-space-2)' }}>Connect a wallet to get started</h2>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', maxWidth: 440, margin: '0 auto var(--ax-space-5)' }}>Connect to view your collected items, track your balance, and manage listings. Your keys never leave your device.</p>
              <button type="button" className="ax-btn ax-btn--primary" onClick={openConnect}>{CONNECT_ICON}<span className="ax-btn__label">Connect wallet</span></button>
            </div>
          </section>
        </div>
      )}

      {/* CONNECTED STATE */}
      {connected && (
        <div className="ax-dash-grid">
          {/* balance hero */}
          <section className="ax-card ax-col--8" role="region" aria-label="Wallet balance">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-6)', background: 'var(--ax-gradient-plate)', boxShadow: 'var(--ax-shadow-md)', color: '#fff' }}>
                <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.16)', filter: 'blur(8px)' }} />
                <span aria-hidden="true" style={{ position: 'absolute', bottom: -50, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.1)' }} />
                <div className="ax-cluster" style={{ justifyContent: 'space-between', position: 'relative' }}>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', letterSpacing: '.06em', opacity: 0.92 }}>{ADDR_SHORT}</span>
                  <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.9 }}><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>
                </div>
                <div style={{ marginTop: 'var(--ax-space-5)', position: 'relative' }}>
                  <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85 }}>Total balance</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>12.84 ETH</div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', opacity: 0.9, marginTop: 2 }}>≈ $30,560.40</div>
                </div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-5)', position: 'relative' }}>
                  <button type="button" className="ax-btn ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg><span className="ax-btn__label">Send</span></button>
                  <button type="button" className="ax-btn ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M18 13l-6 6" /><path d="M6 13l6 6" /></svg><span className="ax-btn__label">Receive</span></button>
                  <button type="button" className="ax-btn ax-btn--solid"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z" /><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /></svg><span className="ax-btn__label">Buy ETH</span></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)' }}>
                <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-viz-violet)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Ethereum</span></div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginTop: 4 }}>10.42 ETH</div>
                </div>
                <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-viz-cyan)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Wrapped ETH</span></div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginTop: 4 }}>2.42 WETH</div>
                </div>
                <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ax-viz-emerald)' }} /><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>USDC</span></div>
                  <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', marginTop: 4 }}>1,240 USDC</div>
                </div>
              </div>
            </div>
          </section>

          {/* portfolio stats */}
          <section className="ax-card ax-col--4" role="region" aria-label="Portfolio">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Portfolio</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Est. NFT value</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>24.6 ETH</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Items owned</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>18</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Items created</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>7</b></div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Royalties earned</span><b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)' }}>+3.12 ETH</b></div>
              <div className="ax-divider" role="separator" style={{ height: 1, background: 'var(--ax-border)' }} />
              <div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>30-day change</span><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }}>+14.2%</b></div>
                <svg viewBox="0 0 220 40" width="100%" height={40} fill="none" preserveAspectRatio="none" style={{ color: 'var(--ax-accent)' }} aria-hidden="true"><path d="M2 34 28 30 54 31 80 24 106 26 132 18 158 20 184 12 218 6" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            </div>
          </section>

          {/* tabs + collection grid */}
          <section className="ax-card ax-col--12" role="region" aria-label="Your items">
            <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
              <div className="ax-tabs" style={{ flex: '1 1 auto' }}>
                <div className="ax-tabs__list" role="tablist" aria-label="Item collections">
                  <button type="button" className={`ax-tabs__tab${tab === 'owned' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'owned'} onClick={() => setTab('owned')}>Owned <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--sm ax-tabs__badge ax-num">18</span></button>
                  <button type="button" className={`ax-tabs__tab${tab === 'created' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'created'} onClick={() => setTab('created')}>Created <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--sm ax-tabs__badge ax-num">7</span></button>
                  <button type="button" className={`ax-tabs__tab${tab === 'favorited' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'favorited'} onClick={() => setTab('favorited')}>Favorited <span className="ax-badge ax-badge--neutral ax-badge--soft ax-badge--sm ax-tabs__badge ax-num">9</span></button>
                  <button type="button" className={`ax-tabs__tab${tab === 'activity' ? ' is-active' : ''}`} role="tab" aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>Activity</button>
                </div>
              </div>
              <select className="ax-select ax-select--sm" aria-label="Sort items" style={{ minWidth: 150 }} defaultValue="Recently added">
                <option>Recently added</option>
                <option>Price: high to low</option>
                <option>Price: low to high</option>
              </select>
            </div>

            <div className="ax-card__body">
              {(['owned', 'created', 'favorited'] as const).map((t) => (
                tab === t && (
                  <div key={t} className="ax-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 'var(--ax-space-4)' }}>
                    {WALLET[t].map((n) => (
                      <article key={n.id} className="ax-card ax-card--interactive" style={{ margin: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Link href="/nft/nft-details" style={{ aspectRatio: '1/1', display: 'block', position: 'relative', background: `linear-gradient(${n.angle}deg, color-mix(in oklab,${n.c1} 76%,var(--ax-surface-solid)), color-mix(in oklab,${n.c2} 56%,var(--ax-surface-solid)))` }} aria-label={'View ' + n.title}>
                          {n.listed && <span className="ax-badge ax-badge--success ax-badge--soft ax-badge--pill ax-badge--sm" style={{ position: 'absolute', top: 'var(--ax-space-2)', insetInlineStart: 'var(--ax-space-2)', backdropFilter: 'blur(6px)' }}>Listed</span>}
                        </Link>
                        <div className="ax-card__body" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{n.collection}</div>
                          <div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{n.title}</div>
                          <div className="ax-cluster" style={{ justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--ax-border)', marginTop: 4 }}>
                            <span style={{ fontSize: 'var(--ax-text-2xs)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--ax-text-subtle)' }}>{t === 'favorited' ? 'Price' : (n.listed ? 'Listed' : 'Floor')}</span>
                            <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{n.price.toFixed(2)} ETH</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              ))}

              {tab === 'activity' && (
                <div className="ax-table-wrap" style={{ margin: '0 calc(-1 * var(--ax-space-5))' }}>
                  <table className="ax-table ax-table--hover">
                    <thead className="ax-table__head">
                      <tr>
                        <th className="ax-table__th" scope="col">Event</th>
                        <th className="ax-table__th" scope="col">Item</th>
                        <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                        <th className="ax-table__th" scope="col">From → To</th>
                        <th className="ax-table__th" scope="col">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTIVITY.map((e) => (
                        <tr key={e.id} className="ax-table__row">
                          <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--pill ${e.badge}`}>{e.event}</span></td>
                          <td className="ax-table__td" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{e.item}</td>
                          <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: e.amount > 0 ? 'var(--ax-viz-emerald)' : 'var(--ax-text)' }}>{e.amount ? (e.amount > 0 ? '+' : '') + e.amount.toFixed(2) + ' ETH' : '—'}</td>
                          <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-xs)' }}>{e.fromto}</td>
                          <td className="ax-table__td" style={{ color: 'var(--ax-text-subtle)' }}>{e.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* CONNECT MODAL */}
      {modal && (
        <div className="ax-flex" style={{ position: 'fixed', inset: 0, zIndex: 80, alignItems: 'center', justifyContent: 'center', padding: 'var(--ax-space-5)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'color-mix(in oklab,var(--ax-canvas) 72%,transparent)', backdropFilter: 'blur(4px)' }} onClick={closeConnect} />
          <div className="ax-card" style={{ position: 'relative', width: 'min(440px,100%)', margin: 0 }} role="dialog" aria-modal="true" aria-label="Connect a wallet" onKeyDown={(e) => { if (e.key === 'Escape') closeConnect(); }}>
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Connect a wallet</h2>{state === 'list' && <p className="ax-card__subtitle">Choose how you&apos;d like to connect.</p>}</div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={closeConnect} aria-label="Close"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              {state === 'list' && (
                <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                  {PROVIDERS.map((p) => (
                    <button key={p.id} type="button" onClick={() => connect(p)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', width: '100%', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface)', cursor: 'pointer', textAlign: 'start' }}>
                      <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.color} 18%,transparent)`, color: p.color, flex: 'none' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p.icon}</svg></span>
                      <span style={{ flex: '1 1 auto', minWidth: 0 }}><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{p.name}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{p.desc}</span></span>
                      {p.popular && <span className="ax-badge ax-badge--accent ax-badge--soft ax-badge--sm ax-badge--pill">Popular</span>}
                    </button>
                  ))}
                  <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', textAlign: 'center', marginTop: 'var(--ax-space-2)' }}>By connecting you agree to the <Link href="/pages/terms" className="ax-link">terms of service</Link>.</p>
                </div>
              )}

              {state === 'connecting' && (
                <div style={{ textAlign: 'center', padding: 'var(--ax-space-6) 0' }}>
                  <span className="ax-spinner ax-spinner--lg" style={{ margin: '0 auto var(--ax-space-4)' }} role="status" aria-label="Connecting"><span className="ax-spinner__glyph" /></span>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Connecting to {active?.name}…</div>
                  <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginTop: 'var(--ax-space-2)' }}>Approve the connection request in your wallet.</p>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" style={{ marginTop: 'var(--ax-space-4)' }} onClick={() => setState('list')}>Cancel</button>
                </div>
              )}

              {state === 'error' && (
                <div style={{ textAlign: 'center', padding: 'var(--ax-space-5) 0' }}>
                  <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-danger-500) 16%,transparent)', color: 'var(--ax-danger-500)', margin: '0 auto var(--ax-space-3)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 16h.01" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg></span>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Connection declined</div>
                  <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginTop: 'var(--ax-space-2)' }}>The request was rejected in your wallet. You can try again.</p>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'center', marginTop: 'var(--ax-space-4)' }}>
                    <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setState('list')}>Back</button>
                    <button type="button" className="ax-btn ax-btn--primary" onClick={() => active && connect(active)}>Retry</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Wallet;
