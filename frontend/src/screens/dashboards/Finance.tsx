'use client';
/*
 * Vireo Next.js — Finance & Banking dashboard (route "dashboards/finance").
 *
 * Faithful re-expression of src/html/dashboards/finance.html: 4 KPI cards, an
 * Income vs. Expenses mixed/diverging chart, a Total Balance gradient plate, a
 * Spending by Category donut, an Accounts list, Budget Utilization envelopes, a
 * Recent Transactions table and an Upcoming Bills column. Charts via
 * <ApexChart>; DOM/classes/copy/ARIA match the reference 1:1.
 */
import { PageHead } from '../../components/shell/PageHead';
import { ApexChart } from '../../components/charts/ApexChart';

const VIZ_FALLBACK: Record<string, string> = {
  '--ax-accent': '#2DD4BF',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
  '--ax-success-500': '#22C55E',
  '--ax-danger-500': '#EF4444',
};
function tokenColors(tokens: string[]): string[] {
  if (typeof document === 'undefined') return tokens.map((t) => VIZ_FALLBACK[t] || '#38BDF8');
  const cs = getComputedStyle(document.documentElement);
  return tokens.map((t) => cs.getPropertyValue(t).trim() || VIZ_FALLBACK[t] || '#38BDF8');
}

const ARROW_UP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);
const ARROW_DN = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
);

export function Finance() {
  return (
    <>
      <PageHead
        title="Finance & Banking"
        subtitle="Balances, cash flow & budgets — last 30 days."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M11 15h1" /><path d="M12 15v3" /></svg>
              <span className="ax-btn__label">Last 30 days</span>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Refresh dashboard">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Add transaction</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* KPI ROW */}
        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Total Balance $312,540, up 3.1%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9 -6l9 6" /><path d="M4 10v10h16v-10" /><path d="M9 20v-6h6v6" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}3.1%</span>
            </div>
            <div className="ax-kpi__label">Total Balance</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">$312,540</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-accent" series={[{ name: 'Trend', data: [8, 10, 9, 14, 16, 20, 23, 27] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Monthly Income $48,200, up 4.0%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l9 -10" /><path d="M12 5v6" /><path d="M9 8l3 3l3 -3" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}4.0%</span>
            </div>
            <div className="ax-kpi__label">Monthly Income</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">$48,200</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-emerald" series={[{ name: 'Trend', data: [7, 10, 9, 16, 18, 22, 25, 29] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Monthly Expenses $31,760, up 6.7 percent which is unfavourable">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c3">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 -5l9 10" /><path d="M12 19v-6" /><path d="M9 16l3 3l3 -3" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--down">{ARROW_DN}6.7%</span>
            </div>
            <div className="ax-kpi__label">Monthly Expenses</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">$31,760</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-red" series={[{ name: 'Trend', data: [12, 14, 12, 17, 16, 21, 20, 25] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        <div className="ax-card ax-kpi ax-col--3" role="region" aria-label="Net Savings Rate 34 percent, up 1.5%">
          <div className="ax-card__body">
            <div className="ax-kpi__top">
              <span className="ax-kpi__icon ax-kpi__icon--c4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a4 4 0 0 1 4 -4h7l6 6v6a4 4 0 0 1 -4 4h-1" /><path d="M12 15m-3 0a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M5 13h2" /></svg>
              </span>
              <span className="ax-kpi__delta ax-kpi__delta--up">{ARROW_UP}1.5%</span>
            </div>
            <div className="ax-kpi__label">Net Savings Rate</div>
            <div className="ax-kpi__meta" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div className="ax-kpi__value ax-num">34%</div>
              <ApexChart className="ax-kpi__spark" type="line" sparkline tooltip={false} height={40} color="--ax-viz-amber" series={[{ name: 'Trend', data: [10, 12, 11, 16, 15, 20, 19, 23] }]} style={{ minHeight: 40 }} />
            </div>
          </div>
        </div>

        {/* HERO: Income vs Expenses (mixed) */}
        <section className="ax-card ax-card--chart ax-col--8" role="region" aria-label="Cash flow">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Cash flow</span>
              <h2 className="ax-card__title">Income vs. Expenses</h2>
              <p className="ax-card__subtitle">Monthly inflow, outflow &amp; net position</p>
            </div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">6M</button>
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">12M</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">YTD</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)', marginBlockEnd: 'var(--ax-space-3)' }}>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-success-500)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Income</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-danger-500)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Expenses</small></span>
              <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--ax-accent)' }} /><small style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Net</small></span>
            </div>
            <ApexChart
              type="line"
              height={320}
              legend="none"
              ariaLabel="Mixed chart of income columns up, expenses columns down, and net cash line"
              series={[
                { name: 'Income', type: 'column', data: [38, 40, 39, 43, 45, 42, 46, 47, 45, 48, 47, 48.2] },
                { name: 'Expenses', type: 'column', data: [-26, -28, -27, -29, -31, -30, -32, -33, -31, -32, -33, -31.76] },
                { name: 'Net', type: 'line', data: [12, 12, 12, 14, 14, 12, 14, 14, 14, 16, 14, 16.44] },
              ]}
              apex={{
                colors: tokenColors(['--ax-success-500', '--ax-danger-500', '--ax-accent']),
                stroke: { width: [0, 0, 2.5], curve: 'smooth' },
                plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } },
                yaxis: { labels: { formatter: (v: number) => '$' + Math.abs(v).toFixed(0) + 'K' } },
                xaxis: { categories: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
              }}
            />
          </div>
        </section>

        {/* Total Balance plate */}
        <section className="ax-card ax-card--balance ax-col--4" role="region" aria-label="Total balance">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Total Balance</h2></div>
            <div className="ax-card__actions">
              <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Currency">
                <button type="button" className="ax-btn ax-btn--sm is-selected" role="radio" aria-checked="true">USD</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">GBP</button>
                <button type="button" className="ax-btn ax-btn--sm" role="radio" aria-checked="false">EUR</button>
              </div>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--ax-radius-lg)', padding: 'var(--ax-space-5)', background: 'var(--ax-gradient-plate)', boxShadow: 'var(--ax-shadow-md)', color: '#fff', minHeight: 172, display: 'flex', flexDirection: 'column' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.18)', filter: 'blur(6px)' }} />
              <span aria-hidden="true" style={{ position: 'absolute', bottom: -50, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.12)' }} />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', position: 'relative' }}>
                <b style={{ fontFamily: 'var(--ax-font-display)', letterSpacing: '.02em', color: 'inherit' }}>Vireo · Operating</b>
                <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.9 }}><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2" /></svg>
              </div>
              <div style={{ marginTop: 'auto', position: 'relative' }}>
                <div style={{ fontSize: 'var(--ax-text-xs)', opacity: 0.85 }}>Available balance</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-.01em' }}>$312,540.00</div>
                <div className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', letterSpacing: '.12em', opacity: 0.92, marginTop: 'var(--ax-space-3)' }}>4921&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;7045</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--solid ax-btn--block">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
                <span className="ax-btn__label">Transfer</span>
              </button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--block">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M18 13l-6 6" /><path d="M6 13l6 6" /></svg>
                <span className="ax-btn__label">Deposit</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--ax-space-3)', textAlign: 'center' }}>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Income</small><b className="ax-num" style={{ color: 'var(--ax-viz-emerald)', fontSize: 'var(--ax-text-md)' }}>+$48,200</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Expenses</small><b className="ax-num" style={{ color: 'var(--ax-viz-red)', fontSize: 'var(--ax-text-md)' }}>−$31,760</b></div>
              <div><small style={{ display: 'block', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginBottom: 2 }}>Saved</small><b className="ax-num" style={{ color: 'var(--ax-viz-cyan)', fontSize: 'var(--ax-text-md)' }}>$16,440</b></div>
            </div>
          </div>
        </section>

        {/* Spending by Category donut */}
        <section className="ax-card ax-col--4" role="region" aria-label="Spending by category">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Spending by Category</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ApexChart
              type="donut"
              height={230}
              legend="none"
              ariaLabel="Donut chart of spending: payroll 44%, software 18%, marketing 15%, office 13%, other 10%"
              series={[44, 18, 15, 13, 10]}
              apex={{
                labels: ['Payroll', 'Software', 'Marketing', 'Office', 'Other'],
                colors: tokenColors(['--ax-accent', '--ax-viz-cyan', '--ax-viz-violet', '--ax-viz-pink', '--ax-viz-amber']),
                stroke: { width: 0 },
                plotOptions: { pie: { donut: { size: '72%', labels: { show: true, value: { fontFamily: 'var(--ax-font-mono)', fontWeight: 600 }, total: { show: true, label: 'Spent', formatter: () => '$31.8K' } } } } },
              }}
            />
            <ul className="ax-list ax-list--compact" style={{ marginTop: 'var(--ax-space-2)' }}>
              {[
                { label: 'Payroll', color: 'var(--ax-accent)', val: '$13,974' },
                { label: 'Software', color: 'var(--ax-viz-cyan)', val: '$5,717' },
                { label: 'Marketing', color: 'var(--ax-viz-violet)', val: '$4,764' },
                { label: 'Office', color: 'var(--ax-viz-pink)', val: '$4,129' },
                { label: 'Other', color: 'var(--ax-viz-amber)', val: '$3,176' },
              ].map((c) => (
                <li key={c.label} className="ax-list__row" style={{ border: 0, paddingInline: 0 }}>
                  <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: c.color, display: 'inline-block' }} /></span>
                  <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>{c.label}</span></span>
                  <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-strong)' }}>{c.val}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Accounts */}
        <section className="ax-card ax-col--4" role="region" aria-label="Accounts">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Accounts</h2></div>
            <a className="ax-btn ax-btn--link" href="#">Manage</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-accent) 18%,transparent)', color: 'var(--ax-accent)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10h18" /><path d="M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Operating Checking</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>•••• 7045</div></div>
              <div style={{ textAlign: 'right' }}><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$184,210</b><div className="ax-kpi__delta ax-kpi__delta--up" style={{ justifyContent: 'flex-end' }}>{ARROW_UP}2.4%</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a4 4 0 0 1 4 -4h7l6 6v6a4 4 0 0 1 -4 4h-1" /><path d="M12 15m-3 0a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>High-Yield Savings</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>•••• 2208</div></div>
              <div style={{ textAlign: 'right' }}><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$96,400</b><div className="ax-kpi__delta ax-kpi__delta--up" style={{ justifyContent: 'flex-end' }}>{ARROW_UP}4.0%</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Corporate Card</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>•••• 3391</div></div>
              <div style={{ textAlign: 'right' }}><b className="ax-num" style={{ color: 'var(--ax-viz-red)' }}>−$8,420</b><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>due Jun 28</div></div>
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
              <span className="ax-avatar ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 18%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" /><path d="M20 12v4h-4a2 2 0 0 1 0 -4z" /></svg></span>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Tax Reserve</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>•••• 0117</div></div>
              <div style={{ textAlign: 'right' }}><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$40,350</b><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>locked</div></div>
            </div>
          </div>
        </section>

        {/* Budget Utilization */}
        <section className="ax-card ax-col--4" role="region" aria-label="Budget utilization">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Budget Utilization</h2><p className="ax-card__subtitle">June envelopes</p></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Payroll</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>$13.9K / $15K</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '93%', background: 'var(--ax-accent)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Software</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>$5.7K / $6K</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '95%', background: 'var(--ax-viz-cyan)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Marketing</span><b className="ax-num" style={{ color: 'var(--ax-viz-red)', fontSize: 'var(--ax-text-sm)' }}>$4.8K / $4K</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '100%', background: 'var(--ax-danger-500)' }} /></div></div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Office</span><b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>$4.1K / $5K</b></div>
              <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '82%', background: 'var(--ax-viz-violet)' }} /></div></div>
            </div>
            <div className="ax-alert ax-alert--danger" role="status">
              <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" /><path d="M12 16h.01" /></svg>
              <div className="ax-alert__content"><p className="ax-alert__message">Marketing is 19% over budget.</p></div>
            </div>
          </div>
        </section>

        {/* Recent Transactions table */}
        <section className="ax-card ax-col--8" role="region" aria-label="Recent transactions">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Recent Transactions</h2><p className="ax-card__subtitle">Latest movements across accounts</p></div>
            <a className="ax-btn ax-btn--link" href="#">View all</a>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Date</th>
                  <th className="ax-table__th" scope="col">Payee</th>
                  <th className="ax-table__th" scope="col">Category</th>
                  <th className="ax-table__th" scope="col">Account</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: 'Jun 12', payee: 'Stripe Payout', cat: 'Revenue', acct: 'Checking •7045', amount: '+$18,420.00', color: 'var(--ax-viz-emerald)' },
                  { date: 'Jun 11', payee: 'Gusto Payroll', cat: 'Payroll', acct: 'Checking •7045', amount: '−$13,974.00', color: 'var(--ax-text)' },
                  { date: 'Jun 11', payee: 'AWS', cat: 'Software', acct: 'Card •3391', amount: '−$2,840.00', color: 'var(--ax-text)' },
                  { date: 'Jun 10', payee: 'Pulse Ads', cat: 'Marketing', acct: 'Card •3391', amount: '−$1,640.00', color: 'var(--ax-text)' },
                  { date: 'Jun 09', payee: 'Acme Co Invoice', cat: 'Revenue', acct: 'Checking •7045', amount: '+$9,200.00', color: 'var(--ax-viz-emerald)' },
                  { date: 'Jun 08', payee: 'WeWork', cat: 'Office', acct: 'Checking •7045', amount: '−$4,129.00', color: 'var(--ax-text)' },
                ].map((t, i) => (
                  <tr key={i} className="ax-table__row">
                    <td className="ax-table__td ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>{t.date}</td>
                    <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{t.payee}</div></td>
                    <td className="ax-table__td"><span className="ax-badge ax-badge--soft">{t.cat}</span></td>
                    <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{t.acct}</td>
                    <td className="ax-table__td ax-table__td--num" style={{ color: t.color }}>{t.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Upcoming Bills */}
        <section className="ax-card ax-col--4" role="region" aria-label="Upcoming bills">
          <div className="ax-card__header">
            <div className="ax-card__titles"><h2 className="ax-card__title">Upcoming Bills</h2></div>
            <a className="ax-btn ax-btn--link" href="#">Schedule</a>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <ul className="ax-list ax-list--compact">
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-danger-500) 18%,transparent)', color: 'var(--ax-danger-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Corporate Card</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Due Jun 28</span></span>
                <span className="ax-list__trailing"><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$8,420</b><div><span className="ax-badge ax-badge--soft ax-badge--danger">2 days</span></div></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-warning-500) 18%,transparent)', color: 'var(--ax-warning-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Office Lease</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Due Jul 01</span></span>
                <span className="ax-list__trailing"><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$4,129</b><div><span className="ax-badge ax-badge--soft ax-badge--warning">5 days</span></div></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4.5 0" /><path d="M3 6l9 0" /><path d="M14 6l6 0l0 13l-6 0z" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>SaaS Stack</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Due Jul 05</span></span>
                <span className="ax-list__trailing"><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$2,840</b><div><span className="ax-badge ax-badge--soft">9 days</span></div></span>
              </li>
              <li className="ax-list__row" style={{ paddingInline: 0 }}>
                <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14c0 1.657 2.686 3 6 3s6 -1.343 6 -3s-2.686 -3 -6 -3s-6 1.343 -6 3" /><path d="M9 14v4c0 1.656 2.686 3 6 3s6 -1.344 6 -3v-4" /><path d="M3 6c0 1.072 1.144 2.062 3 2.598s4.144 .536 6 0s3 -1.526 3 -2.598s-1.144 -2.062 -3 -2.598s-4.144 -.536 -6 0s-3 1.526 -3 2.598" /><path d="M3 6v10c0 .888 .772 1.45 2 2" /></svg></span></span>
                <span className="ax-list__content"><span className="ax-list__title" style={{ fontWeight: 'var(--ax-weight-medium)' }}>Quarterly Tax</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Due Jul 15</span></span>
                <span className="ax-list__trailing"><b className="ax-num" style={{ color: 'var(--ax-text-strong)' }}>$22,100</b><div><span className="ax-badge ax-badge--soft">19 days</span></div></span>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Finance;
