'use client';
/*
 * Vireo Next.js — Crypto · Buy & Sell.
 * Faithful re-expression of src/html/crypto/buy-sell.html: an instant
 * convert form (buy/sell toggle, live rate, fee summary, confirmation) plus a
 * right rail with payment-method radios, recent orders and a trust note. The
 * Alpine convert + payment-method state is rebuilt as React state. The page-
 * scoped grid CSS is reproduced verbatim. Classes / ARIA match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { CryptoTabs } from './CryptoTabs';

const PRICES: Record<string, number> = { BTC: 67840.20, ETH: 3512.00, SOL: 184.20, ADA: 0.452 };
const SYMBOLS: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', ADA: 'Cardano' };

const GRID_CSS = `
.ax-bs-grid > * { grid-column: 1 / -1; }
@media (min-width: 1024px) {
  .ax-bs-grid > .ax-col-form { grid-column: span 7; }
  .ax-bs-grid > .ax-col-rail { grid-column: span 5; }
}`;

const ICON_BTC = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6h8a3 3 0 0 1 0 6a3 3 0 0 1 0 6h-8" /><path d="M8 6l0 12" /><path d="M8 12l6 0" /><path d="M9 3l0 3" /><path d="M13 3l0 3" /></svg>;
const ICON_ETH = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 12l6 -9l6 9l-6 9l-6 -9" /><path d="M6 12l6 -3l6 3l-6 2l-6 -2" /></svg>;
const ICON_SOL = <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 18h12l4 -4h-12l-4 4" /><path d="M8 14l-4 -4h12l4 4" /><path d="M16 10l4 -4h-12l-4 4" /></svg>;

type Method = 'card' | 'bank' | 'balance';

export function BuySell() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [asset, setAsset] = useState('BTC');
  const [pay, setPay] = useState('USD');
  const [amount, setAmount] = useState('1000.00');
  const [confirmed, setConfirmed] = useState(false);
  const [method, setMethod] = useState<Method>('card');

  const rate = PRICES[asset];
  const fee = (parseFloat(amount) || 0) * 0.0049;
  const receive = ((parseFloat(amount) || 0) - fee) / rate;
  const total = ((parseFloat(amount) || 0) + 1.20).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GRID_CSS }} />
      <PageHead
        title="Buy & Sell"
        subtitle="Instantly convert between cash and crypto at live market rates."
        actions={
          <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /></svg>
            <span className="ax-btn__label">Payment methods</span>
          </button>
        }
      />

      <CryptoTabs active="crypto/buy-sell" />

      <div className="ax-dash-grid ax-bs-grid">
        {/* ORDER FORM */}
        <section className="ax-card ax-col-form" role="region" aria-label="Buy or sell crypto">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Order side" style={{ width: '100%' }}>
              <button type="button" className={`ax-btn ax-btn--block${side === 'buy' ? ' is-selected' : ''}`} role="radio" aria-checked={side === 'buy'} onClick={() => { setSide('buy'); setConfirmed(false); }}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 17l6 -6l4 4l8 -8" /><path d="M14 7l7 0l0 7" /></svg>
                <span className="ax-btn__label">Buy</span>
              </button>
              <button type="button" className={`ax-btn ax-btn--block${side === 'sell' ? ' is-selected' : ''}`} role="radio" aria-checked={side === 'sell'} onClick={() => { setSide('sell'); setConfirmed(false); }}>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7l6 6l4 -4l8 8" /><path d="M14 17l7 0l0 -7" /></svg>
                <span className="ax-btn__label">Sell</span>
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setConfirmed(true); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
              {/* amount + pay-with */}
              <div className="ax-field">
                <label className="ax-label" htmlFor="bs-amount">{side === 'buy' ? 'You pay' : 'You sell'}</label>
                <div style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'stretch' }}>
                  <div style={{ position: 'relative', flex: '1 1 auto' }}>
                    <input className="ax-input ax-input--lg ax-num" id="bs-amount" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xl)', fontWeight: 600 }} />
                  </div>
                  <label className="ax-visually" htmlFor="bs-pay">Pay with</label>
                  {side === 'buy' ? (
                    <select className="ax-select" id="bs-pay" value={pay} onChange={(e) => setPay(e.target.value)} style={{ flex: '0 0 130px', fontWeight: 'var(--ax-weight-medium)' }}>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  ) : (
                    <select className="ax-select" style={{ flex: '0 0 130px', fontWeight: 'var(--ax-weight-medium)' }} aria-label="Asset to sell" value={asset} onChange={(e) => setAsset(e.target.value)}>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                      <option value="SOL">SOL</option>
                      <option value="ADA">ADA</option>
                    </select>
                  )}
                </div>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-3)' }}>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--pill" onClick={() => setAmount('100.00')}>$100</button>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--pill" onClick={() => setAmount('500.00')}>$500</button>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--pill" onClick={() => setAmount('1000.00')}>$1,000</button>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--pill" onClick={() => setAmount('5000.00')}>$5,000</button>
                </div>
              </div>

              {/* swap glyph */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBlock: 'calc(-1 * var(--ax-space-3))', position: 'relative', zIndex: 1 }}>
                <span aria-hidden="true" style={{ display: 'inline-flex', width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--ax-radius-pill)', background: 'var(--ax-surface-raised)', border: '1px solid var(--ax-border)', color: 'var(--ax-accent)', boxShadow: 'var(--ax-shadow-sm)' }}>
                  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M7 4l0 16" /><path d="M5 8l2 -4l2 4" /><path d="M17 4l0 16" /><path d="M15 16l2 4l2 -4" /></svg>
                </span>
              </div>

              {/* receive asset */}
              <div className="ax-field">
                <label className="ax-label" htmlFor="bs-asset">{side === 'buy' ? 'You receive' : 'You get'}</label>
                <div style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'stretch' }}>
                  <div style={{ position: 'relative', flex: '1 1 auto', display: 'flex', alignItems: 'center', padding: '0 var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', minHeight: 54 }}>
                    <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xl)', fontWeight: 600, color: 'var(--ax-text-strong)' }}>{side === 'buy' ? receive.toFixed(6) : (receive * rate).toFixed(2)}</span>
                  </div>
                  {side === 'buy' ? (
                    <select className="ax-select" id="bs-asset" value={asset} onChange={(e) => setAsset(e.target.value)} style={{ flex: '0 0 168px', fontWeight: 'var(--ax-weight-medium)' }}>
                      <option value="BTC">Bitcoin · BTC</option>
                      <option value="ETH">Ethereum · ETH</option>
                      <option value="SOL">Solana · SOL</option>
                      <option value="ADA">Cardano · ADA</option>
                    </select>
                  ) : (
                    <div className="ax-flex" style={{ flex: '0 0 168px', alignItems: 'center', padding: '0 var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>USD</div>
                  )}
                </div>
              </div>

              {/* summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                    Rate
                    <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill" style={{ fontSize: 'var(--ax-text-2xs)' }}><span className="ax-badge__dot" />Live</span>
                  </span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>1 {asset} = ${rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Vireo fee (0.49%)</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>${fee.toFixed(2)}</b>
                </div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Network fee</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text)' }}>$1.20</b>
                </div>
                <div className="ax-divider" style={{ marginBlock: 'var(--ax-space-1)' }} />
                <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-semibold)' }}>Total</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>${total}</b>
                </div>
              </div>

              <button type="submit" className={`ax-btn ax-btn--block ${side === 'buy' ? 'ax-btn--primary' : 'ax-btn--danger'}`}>
                <span className="ax-btn__label">{(side === 'buy' ? 'Buy ' : 'Sell ') + SYMBOLS[asset]}</span>
              </button>

              {confirmed && (
                <div role="status" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', padding: 'var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', border: '1px solid color-mix(in oklab,var(--ax-success-500) 40%,var(--ax-border))', background: 'color-mix(in oklab,var(--ax-success-500) 8%,transparent)' }}>
                  <span style={{ color: 'var(--ax-viz-emerald)', flex: '0 0 auto' }}><svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /><path d="M9 12l2 2l4 -4" /></svg></span>
                  <div>
                    <b style={{ color: 'var(--ax-text-strong)', display: 'block' }}>Order confirmed</b>
                    <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>
                      {side === 'buy' ? 'Buying' : 'Selling'} <span className="ax-num">{side === 'buy' ? receive.toFixed(6) : amount}</span> {asset} — settling to your wallet shortly.
                    </span>
                  </div>
                </div>
              )}
            </form>
          </div>
        </section>

        {/* RIGHT RAIL */}
        <div className="ax-col-rail" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {/* pay-with method */}
          <section className="ax-card" role="region" aria-label="Payment method">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Pay With</h2></div>
              <a className="ax-btn ax-btn--link" href="#">Add new</a>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <label className={`ax-cluster${method === 'card' ? ' is-active' : ''}`} style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', ...(method === 'card' ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : {}) }}>
                <input type="radio" className="ax-radio" name="pay-method" value="card" checked={method === 'card'} onChange={() => setMethod('card')} />
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /></svg></span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Visa •••• 7045</span><span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Expires 09/27</span></span>
              </label>
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', ...(method === 'bank' ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : {}) }}>
                <input type="radio" className="ax-radio" name="pay-method" value="bank" checked={method === 'bank'} onChange={() => setMethod('bank')} />
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M3 10l18 0" /><path d="M5 6l7 -3l7 3" /><path d="M4 10l0 11" /><path d="M20 10l0 11" /><path d="M8 14l0 3" /><path d="M12 14l0 3" /><path d="M16 14l0 3" /></svg></span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Bank transfer</span><span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>1–2 business days · no fee</span></span>
              </label>
              <label className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', ...(method === 'balance' ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : {}) }}>
                <input type="radio" className="ax-radio" name="pay-method" value="balance" checked={method === 'balance'} onChange={() => setMethod('balance')} />
                <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" /></svg></span>
                <span style={{ flex: '1 1 auto', minWidth: 0 }}><span style={{ display: 'block', fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Cash balance</span><span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)' }}>$12,300.00 available</span></span>
              </label>
            </div>
          </section>

          {/* recent orders */}
          <section className="ax-card" role="region" aria-label="Recent orders">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Recent Orders</h2></div>
              <a className="ax-btn ax-btn--link" href="/crypto/transactions">All</a>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}>{ICON_BTC}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Bought BTC</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 27 · 06:10</div></div>
                <div style={{ textAlign: 'end' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>0.0250</div><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill" style={{ fontSize: 'var(--ax-text-2xs)' }}>Filled</span></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}>{ICON_ETH}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Sold ETH</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 26 · 19:42</div></div>
                <div style={{ textAlign: 'end' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>1.2000</div><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill" style={{ fontSize: 'var(--ax-text-2xs)' }}>Filled</span></div>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}>{ICON_SOL}</span>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Bought SOL</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Jun 26 · 11:08</div></div>
                <div style={{ textAlign: 'end' }}><div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>12.500</div><span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill" style={{ fontSize: 'var(--ax-text-2xs)' }}>Pending</span></div>
              </div>
            </div>
          </section>

          {/* trust note */}
          <div className="ax-note" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', padding: 'var(--ax-space-4)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)' }}>
            <span style={{ color: 'var(--ax-accent)', flex: '0 0 auto' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M9 12l2 2l4 -4" /></svg></span>
            <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Orders are protected by 256-bit encryption and processed at the live mid-market rate. Rates refresh every 15 seconds.</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default BuySell;
