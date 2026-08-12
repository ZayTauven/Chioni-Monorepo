'use client';
/*
 * Vireo Next.js — Ecommerce / Customer details (route "ecommerce/customer-details").
 *
 * Faithful re-expression of src/html/ecommerce/customer-details.html: a left
 * profile card (avatar, badges, contact rows, tags, message/block actions) and a
 * right column with 4 KPI tiles and a tabbed panel (Overview spend chart +
 * timeline, Orders table, Addresses, Notes with an add-note form, Activity). The
 * Alpine x-data (tab, emailed, blocked, notes) is ported to React state; the spend
 * chart goes through <ApexChart>. Classes + ARIA match the reference 1:1.
 */
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

interface Note { who: string; when: string; body: string }
const INITIAL_NOTES: Note[] = [
  { who: 'Priya Nair', when: 'Jun 18, 2026 · 10:24 AM', body: 'Requested invoice copies for orders #ORD-7588 and #ORD-7412 for accounting. Emailed PDFs.' },
  { who: 'Marcus Lindqvist', when: 'May 30, 2026 · 4:02 PM', body: 'Upgraded to VIP after 40th order. Eligible for free express shipping going forward.' },
  { who: 'Priya Nair', when: 'May 12, 2026 · 9:11 AM', body: 'Partial refund of $54.00 on #ORD-7702 — one lamp arrived with a cracked shade.' },
];

const ORDERS = [
  { no: '#ORD-7841', date: 'Jun 24, 2026', items: '3', status: 'Delivered', tone: 'success', total: '$248.00' },
  { no: '#ORD-7702', date: 'Jun 09, 2026', items: '2', status: 'Refunded', tone: 'danger', total: '$132.00' },
  { no: '#ORD-7588', date: 'May 28, 2026', items: '5', status: 'Delivered', tone: 'success', total: '$486.50' },
  { no: '#ORD-7412', date: 'May 11, 2026', items: '1', status: 'Shipped', tone: 'accent', total: '$96.00' },
  { no: '#ORD-7195', date: 'Apr 22, 2026', items: '4', status: 'On hold', tone: 'warning', total: '$318.75' },
];

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders', badge: '42' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
];

export function CustomerDetails() {
  const [tab, setTab] = useState('overview');
  const [emailed, setEmailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [draft, setDraft] = useState('');

  const doEmail = () => { setEmailed(true); setTimeout(() => setEmailed(false), 2200); };
  const addNote = (e: FormEvent) => { e.preventDefault(); if (!draft.trim()) return; setNotes((n) => [{ who: 'You', when: 'Just now', body: draft.trim() }, ...n]); setDraft(''); };

  return (
    <>
      <PageHead
        title="Camila Rossi"
        subtitle={(<>Customer since Mar 2022 · <span className="ax-num">42</span> orders · <span className="ax-num">$8,914.50</span> lifetime spend.</>) as unknown as string}
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/ecommerce/customers">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Back to customers</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--secondary" onClick={doEmail}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg>
              <span className="ax-btn__label">{emailed ? 'Email sent' : 'Email'}</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3z" /><path d="M16 5l3 3" /></svg>
              <span className="ax-btn__label">Edit customer</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* LEFT PROFILE CARD (4) */}
        <aside className="ax-card ax-col--4" role="region" aria-label="Customer profile" style={{ alignSelf: 'start' }}>
          <div className="ax-card__body" style={{ textAlign: 'center' }}>
            <span className="ax-avatar ax-avatar--2xl ax-avatar--ringed" style={{ marginInline: 'auto', boxShadow: '0 0 0 4px var(--ax-surface-raised),0 0 0 6px var(--ax-accent)', background: 'color-mix(in oklab,var(--ax-accent) 16%,var(--ax-surface-solid))', color: 'var(--ax-accent)' }}>
              <span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-2xl)' }}>CR</span>
              <span className="ax-avatar__status ax-avatar__status--online" aria-hidden="true" />
            </span>
            <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', fontWeight: 700, color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-4)', lineHeight: 1.2 }}>Camila Rossi</h2>
            <div className="ax-cluster" style={{ justifyContent: 'center', gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill"><span className="ax-badge__dot" />VIP</span>
              {!blocked && <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Active</span>}
              {blocked && <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill"><span className="ax-badge__dot" />Blocked</span>}
            </div>
            <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 'var(--ax-space-3)' }}>Repeat buyer · Lighting &amp; Home</p>
          </div>

          {/* contact rows */}
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
            <a className="ax-list__row ax-list--linked" href="mailto:camila.rossi@outlook.com" style={{ border: 0, padding: 'var(--ax-space-2) var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)', fontWeight: 'var(--ax-weight-medium)' }}>camila.rossi@outlook.com</span></span>
            </a>
            <a className="ax-list__row ax-list--linked" href="tel:+551199870212" style={{ border: 0, padding: 'var(--ax-space-2) var(--ax-space-2)', borderRadius: 'var(--ax-radius-sm)', textDecoration: 'none' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title ax-num" style={{ color: 'var(--ax-text)', fontFamily: 'var(--ax-font-mono)', fontWeight: 'var(--ax-weight-medium)' }}>+55 11 99870-0212</span></span>
            </a>
            <div className="ax-list__row" style={{ border: 0, padding: 'var(--ax-space-2) var(--ax-space-2)' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)' }}>São Paulo, Brazil</span></span>
            </div>
            <div className="ax-list__row" style={{ border: 0, padding: 'var(--ax-space-2) var(--ax-space-2)' }}>
              <span className="ax-list__leading" style={{ color: 'var(--ax-text-subtle)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg></span>
              <span className="ax-list__content"><span className="ax-list__title" style={{ color: 'var(--ax-text)' }}>Joined <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Mar 14, 2022</span></span></span>
            </div>
          </div>

          {/* tags */}
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-label" style={{ marginBottom: 'var(--ax-space-2)' }}>Tags</div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Wholesale</span>
              <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Newsletter</span>
              <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Early access</span>
              <button type="button" className="ax-badge ax-badge--outline" style={{ borderRadius: 'var(--ax-radius-xs)', cursor: 'pointer' }}>+ Add</button>
            </div>
          </div>

          {/* actions */}
          <div className="ax-card__footer" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-2)' }}>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block" onClick={doEmail}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg>
              <span className="ax-btn__label">Message</span>
            </button>
            <button type="button" className={`ax-btn ax-btn--ghost ax-btn--block ${blocked ? 'ax-btn--soft-success' : 'ax-btn--soft-danger'}`} onClick={() => setBlocked((b) => !b)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.7 5.7l12.6 12.6" /><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18" /></svg>
              <span className="ax-btn__label">{blocked ? 'Unblock' : 'Block'}</span>
            </button>
          </div>
        </aside>

        {/* RIGHT CONTENT (8) */}
        <div className="ax-col--8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', minWidth: 0 }}>
          {/* KPI TILES */}
          <div className="ax-cd-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
            <div className="ax-card ax-kpi" role="region" aria-label="Total spent $8,914.50, up 9.2%">
              <div className="ax-card__body">
                <div className="ax-kpi__top">
                  <span className="ax-kpi__icon ax-kpi__icon--c1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
                  <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>9.2%</span>
                </div>
                <div className="ax-kpi__label">Total spent</div>
                <div className="ax-kpi__value ax-num">$8,914.50</div>
              </div>
            </div>
            <div className="ax-card ax-kpi" role="region" aria-label="Orders 42">
              <div className="ax-card__body">
                <div className="ax-kpi__top">
                  <span className="ax-kpi__icon ax-kpi__icon--c2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
                </div>
                <div className="ax-kpi__label">Orders</div>
                <div className="ax-kpi__value ax-num">42</div>
              </div>
            </div>
            <div className="ax-card ax-kpi" role="region" aria-label="Average order value $212.25">
              <div className="ax-card__body">
                <div className="ax-kpi__top">
                  <span className="ax-kpi__icon ax-kpi__icon--c3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v1m0 8v1" /><path d="M14.5 9.5a2.5 2 0 0 0 -2.5 -1.5h-1a2 2 0 1 0 0 4h1a2 2 0 1 1 0 4h-1a2.5 2 0 0 1 -2.5 -1.5" /></svg></span>
                </div>
                <div className="ax-kpi__label">Avg. order</div>
                <div className="ax-kpi__value ax-num">$212.25</div>
              </div>
            </div>
            <div className="ax-card ax-kpi" role="region" aria-label="Lifetime value $11,480, up 14.1%">
              <div className="ax-card__body">
                <div className="ax-kpi__top">
                  <span className="ax-kpi__icon ax-kpi__icon--c4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg></span>
                  <span className="ax-kpi__delta ax-kpi__delta--up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>14.1%</span>
                </div>
                <div className="ax-kpi__label">Lifetime value</div>
                <div className="ax-kpi__value ax-num">$11,480</div>
              </div>
            </div>
          </div>

          {/* TABBED CONTENT */}
          <section className="ax-card" role="region" aria-label="Customer detail tabs">
            <div className="ax-card__body" style={{ paddingBottom: 0 }}>
              <div className="ax-tabs">
                <div className="ax-tabs__list" role="tablist" aria-label="Customer sections">
                  {TABS.map((t) => (
                    <button key={t.id} type="button" className={`ax-tabs__tab${tab === t.id ? ' is-active' : ''}`} role="tab" id={`cd-tab-${t.id}`} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                      {t.label}{t.badge && <span className="ax-tabs__badge ax-badge ax-badge--soft ax-badge--neutral">{t.badge}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-overview" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                  <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Spend over time</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Last 12 months</div></div>
                  <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-sm)' }}>+$1,240 vs prev. period</span>
                </div>
                <ApexChart
                  type="area"
                  height={200}
                  legend="none"
                  accent
                  ariaLabel="Area chart of monthly spend over the last twelve months"
                  series={[{ name: 'Spend', data: [420, 610, 380, 540, 720, 650, 810, 690, 920, 1040, 880, 1120] }]}
                />

                <hr className="ax-divider" style={{ marginBlock: 'var(--ax-space-5)' }} />

                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginBottom: 'var(--ax-space-4)' }}>Recent activity</div>
                <ul className="ax-timeline">
                  <li className="ax-timeline__item ax-timeline__item--success">
                    <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Order <span style={{ color: 'var(--ax-accent)' }}>#ORD-7841</span> delivered — <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>$248.00</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>2h ago</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Placed order <span style={{ color: 'var(--ax-accent)' }}>#ORD-7841</span> — 3 items</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 24</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 14c1.49 -1.46 3 -3.21 3 -5.5a5.5 5.5 0 0 0 -9.5 -3.77a5.5 5.5 0 0 0 -9.5 3.77c0 2.29 1.5 4.04 3 5.5l6.5 6.5z" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Added <span style={{ color: 'var(--ax-text)' }}>Brass Task Light</span> to wishlist</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 21</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Refund issued on <span style={{ color: 'var(--ax-accent)' }}>#ORD-7702</span> — <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-danger-500)' }}>−$54.00</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 12</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-pink)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Promoted to <b style={{ color: 'var(--ax-text-strong)' }}>VIP</b> tier</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>May 30</span></div>
                  </li>
                </ul>
              </div>
            )}

            {/* ORDERS */}
            {tab === 'orders' && (
              <div role="tabpanel" aria-labelledby="cd-tab-orders">
                <div className="ax-table-wrap">
                  <table className="ax-table ax-table--hover">
                    <thead className="ax-table__head">
                      <tr>
                        <th className="ax-table__th" scope="col">Order</th>
                        <th className="ax-table__th" scope="col">Date</th>
                        <th className="ax-table__th" scope="col">Items</th>
                        <th className="ax-table__th" scope="col">Status</th>
                        <th className="ax-table__th ax-table__th--num" scope="col">Total</th>
                        <th className="ax-table__th" scope="col"><span className="ax-visually-hidden">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ORDERS.map((o) => (
                        <tr key={o.no} className="ax-table__row">
                          <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)', fontWeight: 'var(--ax-weight-semibold)' }}>{o.no}</td>
                          <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{o.date}</td>
                          <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{o.items}</td>
                          <td className="ax-table__td"><span className={`ax-badge ax-badge--soft ax-badge--${o.tone} ax-badge--pill`}><span className="ax-badge__dot" />{o.status}</span></td>
                          <td className="ax-table__td ax-table__td--num" style={{ color: 'var(--ax-text-strong)' }}>{o.total}</td>
                          <td className="ax-table__td" style={{ textAlign: 'right' }}><Link className="ax-btn ax-btn--link ax-btn--sm" href="/ecommerce/order-details">View</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ax-card__footer"><Link className="ax-link" href="/ecommerce/orders">View all 42 orders →</Link></div>
              </div>
            )}

            {/* ADDRESSES */}
            {tab === 'addresses' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-addresses" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <div className="ax-cd-addr" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-4)' }}>
                  <article style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', position: 'relative' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                        <span className="ax-badge ax-badge--soft ax-badge--accent" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Default</span>
                        <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Shipping</span>
                      </div>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Edit shipping address"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3z" /><path d="M16 5l3 3" /></svg></button>
                    </div>
                    <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Camila Rossi</div>
                    <address style={{ fontStyle: 'normal', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7, marginTop: 4 }}>
                      Rua Augusta 1240, Apt 72<br />Consolação<br />São Paulo · SP · <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>01304-001</span><br />Brazil<br /><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>+55 11 99870-0212</span>
                    </address>
                  </article>
                  <article style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)', position: 'relative' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                      <span className="ax-badge ax-badge--soft ax-badge--neutral" style={{ borderRadius: 'var(--ax-radius-xs)' }}>Billing</span>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Edit billing address"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3z" /><path d="M16 5l3 3" /></svg></button>
                    </div>
                    <div style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Rossi Atelier Ltda.</div>
                    <address style={{ fontStyle: 'normal', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.7, marginTop: 4 }}>
                      Av. Paulista 2100, Sala 14<br />Bela Vista<br />São Paulo · SP · <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>01310-930</span><br />Brazil<br />CNPJ <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>28.114.902/0001-55</span>
                    </address>
                  </article>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill" style={{ marginTop: 'var(--ax-space-4)' }}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                  <span className="ax-btn__label">Add address</span>
                </button>
              </div>
            )}

            {/* NOTES */}
            {tab === 'notes' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-notes" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <form onSubmit={addNote} style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', marginBottom: 'var(--ax-space-5)' }}>
                  <span className="ax-avatar ax-avatar--sm" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials">YO</span></span>
                  <div style={{ flex: '1 1 auto' }}>
                    <textarea className="ax-textarea" rows={2} placeholder="Add an internal note about this customer…" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 60 }} />
                    <div className="ax-cluster" style={{ justifyContent: 'flex-end', marginTop: 'var(--ax-space-2)' }}>
                      <button type="submit" className="ax-btn ax-btn--primary ax-btn--sm" disabled={!draft.trim()}>Add note</button>
                    </div>
                  </div>
                </form>
                <ul className="ax-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  {notes.map((n, i) => (
                    <li key={i} style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-4)' }}>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{n.who}</span>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{n.when}</span>
                      </div>
                      <p style={{ color: 'var(--ax-text)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>{n.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ACTIVITY */}
            {tab === 'activity' && (
              <div className="ax-card__body" role="tabpanel" aria-labelledby="cd-tab-activity" style={{ paddingTop: 'var(--ax-space-5)' }}>
                <ul className="ax-timeline">
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a7 7 0 0 1 14 0a7 7 0 0 1 -14 0" /><path d="M12 9v3l1.5 1.5" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Signed in from <span style={{ color: 'var(--ax-text)' }}>São Paulo, BR</span> · Chrome on macOS</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Today · 08:41</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M17 17h-11v-14h-2" /><path d="M6 5l14 1l-1 7h-13" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Added <span style={{ color: 'var(--ax-text)' }}>2 items</span> to cart</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Today · 08:38</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Browsed <span style={{ color: 'var(--ax-text)' }}>Lighting</span> collection — 11 products viewed</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Yesterday · 21:14</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12a7 7 0 0 1 14 0a7 7 0 0 1 -14 0" /><path d="M12 9v3l1.5 1.5" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Signed in from <span style={{ color: 'var(--ax-text)' }}>São Paulo, BR</span> · Safari on iOS</p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 25 · 19:02</span></div>
                  </li>
                  <li className="ax-timeline__item">
                    <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" /><path d="M3 7l9 6l9 -6" /></svg></span>
                    <div className="ax-timeline__content"><p className="ax-timeline__title">Opened campaign email <span style={{ color: 'var(--ax-text)' }}>“Summer lighting — up to 30% off”</span></p><span className="ax-timeline__time ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jun 24 · 11:50</span></div>
                  </li>
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* responsive: KPI tiles + address grid collapse on small screens */}
      <style>{`
        @media (max-width: 640px) {
          .ax-cd-kpis { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .ax-cd-addr { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

export default CustomerDetails;
