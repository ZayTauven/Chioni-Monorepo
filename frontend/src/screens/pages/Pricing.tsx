'use client';
/*
 * Vireo React — Pricing (route "pages/pricing").
 *
 * Faithful re-expression of src/html/pages/pricing.html: monthly/annual billing
 * toggle that re-prices the Pro & Business tiers, four tier cards, a side-by-side
 * comparison table and a pricing FAQ accordion. Alpine `annual`/`open` ported to
 * React state. DOM classes / ARIA / copy match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const CHECK = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-success-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 1 }}><path d="M5 12l5 5l10 -10" /></svg>
);
const CROSS = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 1 }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);
const liBase: React.CSSProperties = { gap: 'var(--ax-space-3)', flexWrap: 'nowrap', alignItems: 'flex-start', fontSize: 'var(--ax-text-sm)' };

function Feature({ children, on = true, muted = false }: { children: React.ReactNode; on?: boolean; muted?: boolean }) {
  return (
    <li className="ax-cluster" style={{ ...liBase, color: muted ? 'var(--ax-text-subtle)' : 'var(--ax-text)' }}>
      {on ? CHECK : CROSS}<span>{children}</span>
    </li>
  );
}

const TICK = (color: string) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M5 12l5 5l10 -10" /></svg>
);
const NIX = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-text-subtle)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle' }}><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);

const PFAQ = [
  { q: 'Can I change plans later?', a: 'Yes — upgrade or downgrade anytime from your billing page. Upgrades are prorated instantly; downgrades take effect at the next renewal.' },
  { q: 'Is there a free trial?', a: "Every paid plan includes a 14-day free trial — no credit card required. You'll only be billed if you choose to continue." },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit cards via Stripe. Business and Enterprise plans can also pay by invoice and bank transfer.' },
  { q: 'Do you offer discounts for nonprofits?', a: 'Yes. Registered nonprofits and accredited students get 40% off any annual plan — reach out to sales with your documentation.' },
];

export function Pricing() {
  const [annual, setAnnual] = useState(true);
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      <PageHead
        title="Pricing"
        subtitle="Simple, transparent plans that scale with your team — switch or cancel anytime."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg>
              <span className="ax-btn__label">Talk to sales</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3" /><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3" /><path d="M14 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
              <span className="ax-btn__label">Start free trial</span>
            </button>
          </>
        }
      />

      {/* BILLING TOGGLE */}
      <div className="ax-cluster" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--ax-space-4)', marginBlockEnd: 'var(--ax-space-8)', flexWrap: 'wrap' }}>
        <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Billing period">
          <button type="button" className={`ax-btn ax-btn--sm${!annual ? ' is-selected' : ''}`} role="radio" aria-checked={!annual} onClick={() => setAnnual(false)}>Monthly</button>
          <button type="button" className={`ax-btn ax-btn--sm${annual ? ' is-selected' : ''}`} role="radio" aria-checked={annual} onClick={() => setAnnual(true)}>Annual</button>
        </div>
        {annual && (
          <span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">
            <svg className="ax-badge__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
            Save 20% billed yearly
          </span>
        )}
      </div>

      {/* TIER CARDS */}
      <div className="ax-dash-grid" style={{ marginBlockEnd: 'var(--ax-space-8)' }}>
        {/* Starter */}
        <section className="ax-card ax-col--3" role="region" aria-label="Starter plan">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', height: '100%' }}>
            <div>
              <h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-md)' }}>Starter</h2>
              <p className="ax-card__subtitle" style={{ marginTop: 4 }}>For individuals exploring Vireo.</p>
            </div>
            <div>
              <div className="ax-cluster" style={{ alignItems: 'baseline', gap: 'var(--ax-space-1)' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1 }}>$0</span>
                <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>/mo</span>
              </div>
              <p style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginTop: 6, minHeight: 16 }}>Free forever — no card required</p>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block"><span className="ax-btn__label">Get started</span></button>
            <ul className="ax-list ax-list--compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <Feature>1 workspace</Feature>
              <Feature>Up to 3 team members</Feature>
              <Feature>5 dashboards</Feature>
              <Feature>Community support</Feature>
              <Feature on={false} muted>API access</Feature>
            </ul>
          </div>
        </section>

        {/* Pro — most popular */}
        <section className="ax-card ax-col--3 ax-card--accent-edge" role="region" aria-label="Pro plan, most popular" style={{ position: 'relative' }}>
          <span className="ax-badge ax-badge--solid ax-badge--accent ax-badge--pill" style={{ position: 'absolute', top: 'var(--ax-space-4)', insetInlineEnd: 'var(--ax-space-4)' }}>Most popular</span>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', height: '100%' }}>
            <div>
              <h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-md)', color: 'var(--ax-accent)' }}>Pro</h2>
              <p className="ax-card__subtitle" style={{ marginTop: 4 }}>For growing product teams.</p>
            </div>
            <div>
              <div className="ax-cluster" style={{ alignItems: 'baseline', gap: 'var(--ax-space-1)' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1, minWidth: 78, display: 'inline-block' }}>{annual ? '$24' : '$29'}</span>
                <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>/mo</span>
              </div>
              <p className="ax-num" style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginTop: 6, minHeight: 16, fontFamily: 'var(--ax-font-mono)' }}>{annual ? '$288 billed annually' : 'billed monthly'}</p>
            </div>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block"><span className="ax-btn__label">Start 14-day trial</span></button>
            <ul className="ax-list ax-list--compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <Feature>3 workspaces</Feature>
              <Feature>Up to 25 team members</Feature>
              <Feature>Unlimited dashboards</Feature>
              <Feature>Full API &amp; webhooks</Feature>
              <Feature>Priority email support</Feature>
            </ul>
          </div>
        </section>

        {/* Business */}
        <section className="ax-card ax-col--3" role="region" aria-label="Business plan">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', height: '100%' }}>
            <div>
              <h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-md)' }}>Business</h2>
              <p className="ax-card__subtitle" style={{ marginTop: 4 }}>For scaling organizations.</p>
            </div>
            <div>
              <div className="ax-cluster" style={{ alignItems: 'baseline', gap: 'var(--ax-space-1)' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1, minWidth: 78, display: 'inline-block' }}>{annual ? '$64' : '$79'}</span>
                <span style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)' }}>/mo</span>
              </div>
              <p className="ax-num" style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginTop: 6, minHeight: 16, fontFamily: 'var(--ax-font-mono)' }}>{annual ? '$768 billed annually' : 'billed monthly'}</p>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block"><span className="ax-btn__label">Start 14-day trial</span></button>
            <ul className="ax-list ax-list--compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <Feature>Everything in Pro, plus:</Feature>
              <Feature>Unlimited members</Feature>
              <Feature>SSO &amp; SAML</Feature>
              <Feature>Advanced audit logs</Feature>
              <Feature>24/7 priority support</Feature>
            </ul>
          </div>
        </section>

        {/* Enterprise */}
        <section className="ax-card ax-col--3" role="region" aria-label="Enterprise plan">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', height: '100%' }}>
            <div>
              <h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-md)' }}>Enterprise</h2>
              <p className="ax-card__subtitle" style={{ marginTop: 4 }}>For regulated, large-scale teams.</p>
            </div>
            <div>
              <div className="ax-cluster" style={{ alignItems: 'baseline', gap: 'var(--ax-space-1)' }}>
                <span style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 700, color: 'var(--ax-text-strong)', lineHeight: 1 }}>Custom</span>
              </div>
              <p style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', marginTop: 6, minHeight: 16 }}>Tailored to your requirements</p>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--block"><span className="ax-btn__label">Contact sales</span></button>
            <ul className="ax-list ax-list--compact" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <Feature>Everything in Business</Feature>
              <Feature>Dedicated CSM</Feature>
              <Feature>99.99% uptime SLA</Feature>
              <Feature>On-prem &amp; private cloud</Feature>
              <Feature>Custom contract &amp; DPA</Feature>
            </ul>
          </div>
        </section>
      </div>

      {/* COMPARISON TABLE */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="region" aria-label="Plan comparison">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Compare</span>
              <h2 className="ax-card__title">All features, side by side</h2>
              <p className="ax-card__subtitle">Every plan includes SSL, daily backups, and the Aurora design system.</p>
            </div>
          </div>
          <div className="ax-table-wrap">
            <table className="ax-table ax-table--hover">
              <thead className="ax-table__head">
                <tr>
                  <th className="ax-table__th" scope="col">Feature</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Starter</th>
                  <th className="ax-table__th ax-table__th--num" scope="col" style={{ color: 'var(--ax-accent)' }}>Pro</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Business</th>
                  <th className="ax-table__th ax-table__th--num" scope="col">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Team members</td>
                  <td className="ax-table__td ax-table__td--num ax-num">3</td>
                  <td className="ax-table__td ax-table__td--num ax-num">25</td>
                  <td className="ax-table__td ax-table__td--num">Unlimited</td>
                  <td className="ax-table__td ax-table__td--num">Unlimited</td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Dashboards</td>
                  <td className="ax-table__td ax-table__td--num ax-num">5</td>
                  <td className="ax-table__td ax-table__td--num">Unlimited</td>
                  <td className="ax-table__td ax-table__td--num">Unlimited</td>
                  <td className="ax-table__td ax-table__td--num">Unlimited</td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Data retention</td>
                  <td className="ax-table__td ax-table__td--num ax-num">30 days</td>
                  <td className="ax-table__td ax-table__td--num ax-num">1 year</td>
                  <td className="ax-table__td ax-table__td--num ax-num">3 years</td>
                  <td className="ax-table__td ax-table__td--num">Custom</td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>API access &amp; webhooks</td>
                  <td className="ax-table__td ax-table__td--num">{NIX}</td>
                  <td className="ax-table__td ax-table__td--num">{TICK('var(--ax-success-500)')}</td>
                  <td className="ax-table__td ax-table__td--num">{TICK('var(--ax-success-500)')}</td>
                  <td className="ax-table__td ax-table__td--num">{TICK('var(--ax-success-500)')}</td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>SSO &amp; SAML</td>
                  <td className="ax-table__td ax-table__td--num">{NIX}</td>
                  <td className="ax-table__td ax-table__td--num">{NIX}</td>
                  <td className="ax-table__td ax-table__td--num">{TICK('var(--ax-success-500)')}</td>
                  <td className="ax-table__td ax-table__td--num">{TICK('var(--ax-success-500)')}</td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Support</td>
                  <td className="ax-table__td ax-table__td--num">Community</td>
                  <td className="ax-table__td ax-table__td--num">Priority email</td>
                  <td className="ax-table__td ax-table__td--num">24/7</td>
                  <td className="ax-table__td ax-table__td--num">Dedicated CSM</td>
                </tr>
                <tr className="ax-table__row">
                  <td className="ax-table__td" style={{ color: 'var(--ax-text-strong)' }}>Uptime SLA</td>
                  <td className="ax-table__td ax-table__td--num">—</td>
                  <td className="ax-table__td ax-table__td--num ax-num">99.9%</td>
                  <td className="ax-table__td ax-table__td--num ax-num">99.95%</td>
                  <td className="ax-table__td ax-table__td--num ax-num">99.99%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* FAQ STRIP */}
      <div className="ax-dash-grid" style={{ marginBlockStart: 'var(--ax-space-6)' }}>
        <section className="ax-card ax-col--8" role="region" aria-label="Pricing FAQ">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Questions</span>
              <h2 className="ax-card__title">Pricing FAQ</h2>
            </div>
            <Link className="ax-btn ax-btn--link" href="/pages/faq">All FAQs →</Link>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-accordion">
              {PFAQ.map((f, i) => (
                <div key={i} className="ax-accordion__item">
                  <button type="button" className="ax-accordion__header" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    <span className="ax-accordion__title">{f.q}</span>
                    <svg className="ax-accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                  </button>
                  {open === i && <div className="ax-accordion__panel">{f.a}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* contact rail */}
        <section className="ax-card ax-col--4" role="region" aria-label="Still deciding">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', height: '100%' }}>
            <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>
              <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10" /><path d="M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2" /></svg>
            </span>
            <div>
              <h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-md)' }}>Still deciding?</h2>
              <p className="ax-card__subtitle" style={{ marginTop: 6 }}>Book a 30-minute walkthrough with our team and we'll help you pick the right plan.</p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--primary ax-btn--block"><span className="ax-btn__label">Book a demo</span></button>
              <Link className="ax-btn ax-btn--ghost ax-btn--block" href="/pages/support"><span className="ax-btn__label">Visit help center</span></Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Pricing;
