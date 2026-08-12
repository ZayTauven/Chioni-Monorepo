'use client';
/*
 * Vireo Next.js — Crypto · Wallet.
 * Faithful re-expression of src/html/crypto/wallet.html: gradient balance plate
 * with a send/receive switcher (copy + send confirmations), an allocation donut
 * (ApexChart), a holdings table, and a recent-transactions table. The Alpine
 * send/receive/copy state is rebuilt as React state; the page-scoped grid CSS is
 * reproduced verbatim. Classes / ARIA match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';
import { CryptoTabs } from './CryptoTabs';

const GRID_CSS = `
.ax-w-grid > * { grid-column: 1 / -1; }
@media (min-width: 768px) { .ax-w-grid > .ax-col-side { grid-column: 1 / -1; } }
@media (min-width: 1200px) {
  .ax-w-grid > .ax-col-side { grid-column: span 5; }
  .ax-w-grid > .ax-col-hero { grid-column: span 7; }
  .ax-w-grid > .ax-col-full { grid-column: span 12; }
}`;

const ALLOC = [
  { label: 'Bitcoin', pct: '46%', color: 'var(--ax-viz-amber)' },
  { label: 'Ethereum', pct: '28%', color: 'var(--ax-viz-violet)' },
  { label: 'Solana', pct: '16%', color: 'var(--ax-viz-emerald)' },
  { label: 'Tether', pct: '7%', color: 'var(--ax-viz-cyan)' },
  { label: 'Avalanche', pct: '3%', color: 'var(--ax-viz-pink)' },
];

const ICON_BTC = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6h8a3 3 0 0 1 0 6a3 3 0 0 1 0 6h-8" /><path d="M8 6l0 12" /><path d="M8 12l6 0" /><path d="M9 3l0 3" /><path d="M13 3l0 3" /><path d="M9 18l0 3" /><path d="M13 18l0 3" /></svg>;
const ICON_ETH = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>;
const ICON_SOL = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18h12l4 -4h-12l-4 4" /><path d="M8 14l-4 -4h12l4 4" /><path d="M16 10l4 -4h-12l-4 4" /></svg>;
const ICON_USDT = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /><path d="M9 9h6" /><path d="M9 15h6" /></svg>;
const ICON_AVAX = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 12l9 -3" /></svg>;

const HOLDINGS = [
  { name: 'Bitcoin', sym: 'BTC', color: 'var(--ax-viz-amber)', icon: ICON_BTC, bal: '0.586', price: '$67,840', chg: '+2.1%', chgColor: 'var(--ax-viz-emerald)', value: '$39,754' },
  { name: 'Ethereum', sym: 'ETH', color: 'var(--ax-viz-violet)', icon: ICON_ETH, bal: '6.892', price: '$3,512', chg: '+3.7%', chgColor: 'var(--ax-viz-emerald)', value: '$24,205' },
  { name: 'Solana', sym: 'SOL', color: 'var(--ax-viz-emerald)', icon: ICON_SOL, bal: '74.50', price: '$184.20', chg: '+18.2%', chgColor: 'var(--ax-viz-emerald)', value: '$13,723' },
  { name: 'Tether', sym: 'USDT', color: 'var(--ax-viz-cyan)', icon: ICON_USDT, bal: '5,988', price: '$1.00', chg: '0.0%', chgColor: 'var(--ax-text-subtle)', value: '$5,988' },
  { name: 'Avalanche', sym: 'AVAX', color: 'var(--ax-viz-pink)', icon: ICON_AVAX, bal: '68.30', price: '$38.10', chg: '−2.4%', chgColor: 'var(--ax-viz-red)', value: '$2,602' },
];

const RECV_ICON = <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M18 11l-6 6" /><path d="M6 11l6 6" /></svg>;
const SEND_ICON = <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>;
const BUY_ICON = <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9 -6l9 6v9a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /></svg>;
const STAKE_ICON = <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /></svg>;
const SELL_ICON = <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 7l4 0l0 -4" /><path d="M20 7l-8 8l-4 -4l-5 5" /></svg>;

const TXNS = [
  { type: 'Receive', tBadge: 'success', icon: RECV_ICON, asset: 'Bitcoin · BTC', amount: '+0.0240', amountColor: 'var(--ax-viz-emerald)', value: '$1,628.16', date: 'Jun 27 · 06:10', status: 'Completed', sBadge: 'success' },
  { type: 'Send', tBadge: 'danger', icon: SEND_ICON, asset: 'Ethereum · ETH', amount: '−1.2000', amountColor: 'var(--ax-text)', value: '$4,214.40', date: 'Jun 26 · 19:42', status: 'Completed', sBadge: 'success' },
  { type: 'Buy', tBadge: 'info', icon: BUY_ICON, asset: 'Solana · SOL', amount: '+12.500', amountColor: 'var(--ax-viz-emerald)', value: '$2,302.50', date: 'Jun 26 · 11:08', status: 'Completed', sBadge: 'success' },
  { type: 'Stake', tBadge: 'warning', icon: STAKE_ICON, asset: 'Ethereum · ETH', amount: '−2.0000', amountColor: 'var(--ax-text)', value: '$7,024.00', date: 'Jun 25 · 09:30', status: 'Pending', sBadge: 'warning' },
  { type: 'Sell', tBadge: 'danger', icon: SELL_ICON, asset: 'Avalanche · AVAX', amount: '−20.000', amountColor: 'var(--ax-text)', value: '$762.00', date: 'Jun 24 · 15:55', status: 'Completed', sBadge: 'success' },
  { type: 'Receive', tBadge: 'success', icon: RECV_ICON, asset: 'Tether · USDT', amount: '+1,500.00', amountColor: 'var(--ax-viz-emerald)', value: '$1,500.00', date: 'Jun 23 · 08:02', status: 'Failed', sBadge: 'danger' },
];

export function Wallet() {
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GRID_CSS }} />
      <PageHead
        title="Wallet"
        subtitle="Main wallet · up 4.8% in the last 24 hours."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v3l1.5 1.5" /><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /></svg>
              <span className="ax-btn__label">Activity</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add funds</span>
            </button>
          </>
        }
      />

      <CryptoTabs active="crypto/wallet" />

      <div className="ax-dash-grid ax-w-grid">
        {/* BALANCE PLATE + SEND/RECEIVE */}
        <section className="ax-card ax-card--balance ax-col-side" role="region" aria-label="Total balance">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Main wallet</span>
              <h2 className="ax-card__title">Total Balance</h2>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Currency">
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">USD</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">BTC</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            {/* gradient plate */}
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', background: 'var(--ax-gradient-plate)', boxShadow: 'var(--ax-shadow-md)', color: '#fff', minHeight: 184, display: 'flex', flexDirection: 'column' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,.18)', filter: 'blur(6px)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', bottom: -50, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', position: 'relative' }}>
                <b style={{ fontFamily: 'var(--ax-font-display)', letterSpacing: '.02em', color: 'inherit' }}>Vireo Wallet</b>
                <span className="ax-badge ax-badge--pill" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: 0 }}><span className="ax-badge__dot" style={{ background: '#fff' }} />Secured</span>
              </div>
              <div style={{ marginTop: 'auto', position: 'relative' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85 }}>Total value</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>$86,420.55</div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', fontWeight: 600 }}>+$3,940.18 (4.8%)</span>
                  <span style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.8 }}>24h</span>
                </div>
              </div>
            </div>

            {/* balance split */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Available</small><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>$78,432</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Staked</small><b className="ax-num" style={{ color: 'var(--ax-viz-violet)', fontSize: 'var(--ax-text-md)' }}>$5,988</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>In orders</small><b className="ax-num" style={{ color: 'var(--ax-viz-amber)', fontSize: 'var(--ax-text-md)' }}>$2,000</b></div>
            </div>

            {/* send / receive switcher */}
            <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Transfer mode" style={{ width: '100%' }}>
              <button type="button" className={`ax-btn ax-btn--sm ax-btn--block${tab === 'send' ? ' is-selected' : ''}`} role="radio" aria-checked={tab === 'send'} onClick={() => setTab('send')}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                <span className="ax-btn__label">Send</span>
              </button>
              <button type="button" className={`ax-btn ax-btn--sm ax-btn--block${tab === 'receive' ? ' is-selected' : ''}`} role="radio" aria-checked={tab === 'receive'} onClick={() => setTab('receive')}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M18 11l-6 6" /><path d="M6 11l6 6" /></svg>
                <span className="ax-btn__label">Receive</span>
              </button>
            </div>

            {/* SEND panel */}
            {tab === 'send' && (
              <form className="ax-flex" onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="w-asset">Asset</label>
                  <select className="ax-select" id="w-asset" defaultValue="BTC">
                    <option value="BTC">Bitcoin · BTC — 0.586 available</option>
                    <option value="ETH">Ethereum · ETH — 6.892 available</option>
                    <option value="SOL">Solana · SOL — 74.50 available</option>
                  </select>
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="w-addr">Recipient address</label>
                  <input className="ax-input ax-num" id="w-addr" type="text" style={{ fontFamily: 'var(--ax-font-mono)' }} placeholder="bc1q…" defaultValue="bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" />
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="w-amt">Amount</label>
                  <input className="ax-input ax-num" id="w-amt" type="text" inputMode="decimal" defaultValue="0.0250" />
                  <span className="ax-help">Network fee: <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>0.00012 BTC</span> · ~$8.14</span>
                </div>
                <button type="submit" className="ax-btn ax-btn--primary ax-btn--block">
                  <span className="ax-btn__label">Review &amp; send</span>
                </button>
                {sent && <p className="ax-note" style={{ margin: 0, color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }} role="status">Transfer queued — broadcasting to the network.</p>}
              </form>
            )}

            {/* RECEIVE panel */}
            {tab === 'receive' && (
              <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-4)', alignItems: 'center', textAlign: 'center' }}>
                <div aria-hidden="true" style={{ width: 148, height: 148, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(7,1fr)', gap: 3, padding: 14 }}>
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: '1/3', gridRow: '1/3', borderRadius: 3 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: '6/8', gridRow: '1/3', borderRadius: 3 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 4, gridRow: 2 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 3, gridRow: 3 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 5, gridRow: 3 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: '1/3', gridRow: '6/8', borderRadius: 3 }} />
                  <i style={{ background: 'var(--ax-accent)', gridColumn: 4, gridRow: 4 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 6, gridRow: 5 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 5, gridRow: 6 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 7, gridRow: 6 }} />
                  <i style={{ background: 'var(--ax-text-strong)', gridColumn: 6, gridRow: 7 }} />
                </div>
                <div className="ax-field" style={{ width: '100%', textAlign: 'start' }}>
                  <label className="ax-label" htmlFor="w-recv">Your BTC address</label>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                    <input className="ax-input ax-num" id="w-recv" type="text" readOnly style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)' }} value="bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" />
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Copy address" onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
                      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" /><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" /></svg>
                    </button>
                  </div>
                  {copied && <span className="ax-help" style={{ color: 'var(--ax-viz-emerald)' }} role="status">Address copied to clipboard.</span>}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: allocation donut + holdings */}
        <div className="ax-col-hero" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* Allocation donut */}
          <section className="ax-card" role="region" aria-label="Holdings allocation">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Allocation</h2>
                <p className="ax-card__subtitle">Split across 5 assets</p>
              </div>
              <div className="ax-card__actions">
                <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Range">
                  <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">7D</button>
                  <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">30D</button>
                  <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">1Y</button>
                </div>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(0,1.2fr)', gap: 'var(--ax-space-5)', alignItems: 'center' }}>
              <ApexChart
                type="donut"
                height={220}
                legend="none"
                ariaLabel="Donut chart of wallet allocation: Bitcoin 46%, Ethereum 28%, Solana 16%, Tether 7%, Avalanche 3%"
                series={[46, 28, 16, 7, 3]}
                apex={{
                  labels: ['Bitcoin', 'Ethereum', 'Solana', 'Tether', 'Avalanche'],
                  colors: ['#FBBF24', '#A78BFA', '#34D399', '#38BDF8', '#F472B6'],
                  stroke: { width: 0 },
                  plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Total', formatter: () => '$86.4K' } } } } },
                }}
              />
              <ul className="ax-list ax-list--compact" style={{ margin: 0 }}>
                {ALLOC.map((a) => (
                  <li key={a.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                    <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: a.color, display: 'inline-block' }} /></span>
                    <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{a.label}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}>{a.pct}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Holdings table */}
          <section className="ax-card" role="region" aria-label="Asset holdings">
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <h2 className="ax-card__title">Holdings</h2>
                <p className="ax-card__subtitle">Balances &amp; 24h movement</p>
              </div>
              <a className="ax-btn ax-btn--link" href="/crypto/marketcap">Explore market</a>
            </div>
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Asset</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Balance</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Price</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">24h</th>
                    <th className="ax-table__th ax-table__th--num" scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {HOLDINGS.map((h) => (
                    <tr key={h.sym} className="ax-table__row">
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${h.color} 18%,transparent)`, color: h.color }}>{h.icon}</span>
                          <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{h.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{h.sym}</div></div>
                        </div>
                      </td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{h.bal}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>{h.price}</td>
                      <td className="ax-table__td ax-table__td--num" style={{ color: h.chgColor }}>{h.chg}</td>
                      <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>{h.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RECENT TRANSACTIONS */}
        <section className="ax-card ax-col-full" role="region" aria-label="Recent transactions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <h2 className="ax-card__title">Recent Transactions</h2>
              <p className="ax-card__subtitle">Last 6 wallet movements</p>
            </div>
            <a className="ax-btn ax-btn--link" href="/crypto/transactions">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Type</th>
                  <th className="ax-table__th" scope="col">Asset</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Value</th>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {TXNS.map((t, i) => (
                  <tr key={i} className="ax-table__row">
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${t.tBadge} ax-badge--pill`}>{t.icon}{t.type}</span></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text)' }}>{t.asset}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: t.amountColor }}>{t.amount}</td>
                    <td className="ax-table__td ax-table__td--num ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{t.value}</td>
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{t.date}</td>
                    <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${t.sBadge} ax-badge--pill`}><span className="ax-badge__dot" />{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default Wallet;
