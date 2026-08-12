'use client';
/*
 * Vireo Next.js — UI · Accordions (route "ui/accordions").
 *
 * Faithful re-expression of src/html/ui/accordions.html: single-open, multi-open,
 * bordered, flush and icon-led accordions. The Alpine x-data open/toggle logic is
 * re-implemented with React state; "Expand all" maps to the @ax-open-all event.
 * DOM classes / ARIA / copy match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const CHEV = (
  <svg className="ax-accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);

function Single() {
  const [open, setOpen] = useState<number | null>(1);
  const items = [
    { id: 1, q: 'What is included in the Vireo license?', a: <>A single regular license covers one end product. It bundles all 9 framework editions, lifetime updates and 6 months of support, extendable to 12.</> },
    { id: 2, q: 'Can I use it for a client project?', a: <>Yes. Build one client dashboard per license; the client may be charged once for the finished product. For SaaS that end users pay to access, an extended license applies.</> },
    { id: 3, q: 'Which build tools do I need?', a: <>Node 20+ and a package manager. The HTML edition runs on Vite with Tailwind v4 and Alpine — <code className="ax-code">npm install</code> then <code className="ax-code">npm run dev</code>.</> },
  ];
  return (
    <div className="ax-accordion">
      {items.map((it) => (
        <div key={it.id} className="ax-accordion__item">
          <button type="button" className="ax-accordion__header" aria-expanded={open === it.id} onClick={() => setOpen(open === it.id ? null : it.id)} aria-controls={`sa-${it.id}`}>
            <span className="ax-accordion__title">{it.q}</span>
            {CHEV}
          </button>
          {open === it.id && <div className="ax-accordion__panel" id={`sa-${it.id}`}>{it.a}</div>}
        </div>
      ))}
    </div>
  );
}

function Multi() {
  const [open, setOpen] = useState({ ship: true, returns: false, tax: false });
  const items = [
    { key: 'ship' as const, id: 'ma-1', q: 'Shipping & delivery', a: 'Orders ship within 2 business days. Standard delivery is 3–5 days; express is next-day for orders placed before 2pm.' },
    { key: 'returns' as const, id: 'ma-2', q: 'Returns & refunds', a: 'Unused items can be returned within 30 days for a full refund. Refunds settle to the original payment method within 5 business days.' },
    { key: 'tax' as const, id: 'ma-3', q: 'Tax & invoicing', a: 'VAT is added at checkout where applicable. A tax invoice is emailed with every order and is available under Billing → Invoices.' },
  ];
  return (
    <div className="ax-accordion">
      {items.map((it) => (
        <div key={it.id} className="ax-accordion__item">
          <button type="button" className="ax-accordion__header" aria-expanded={open[it.key]} onClick={() => setOpen({ ...open, [it.key]: !open[it.key] })} aria-controls={it.id}>
            <span className="ax-accordion__title">{it.q}</span>
            {CHEV}
          </button>
          {open[it.key] && <div className="ax-accordion__panel" id={it.id}>{it.a}</div>}
        </div>
      ))}
    </div>
  );
}

function Bordered() {
  const [open, setOpen] = useState<number | null>(1);
  const items = [
    { id: 1, q: 'Connect your data source', a: 'Link a warehouse, a REST endpoint or upload a CSV. Vireo maps columns automatically and previews the first rows before import.' },
    { id: 2, q: 'Build your first dashboard', a: 'Drag KPI cards, charts and tables onto the grid. Every widget rethemes with your accent and respects the 12-column layout.' },
    { id: 3, q: 'Invite your team', a: 'Send invites by email and assign roles — Owner, Admin or Member. Pending invites expire after 7 days and can be resent at any time.' },
  ];
  return (
    <div className="ax-accordion ax-accordion--bordered">
      {items.map((it) => (
        <div key={it.id} className="ax-accordion__item">
          <button type="button" className="ax-accordion__header" aria-expanded={open === it.id} onClick={() => setOpen(open === it.id ? null : it.id)} aria-controls={`ba-${it.id}`}>
            <span className="ax-accordion__title">{it.q}</span>
            {CHEV}
          </button>
          {open === it.id && <div className="ax-accordion__panel" id={`ba-${it.id}`}>{it.a}</div>}
        </div>
      ))}
    </div>
  );
}

function Flush() {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    { id: 1, q: 'Notifications', a: 'Choose which events email you and which only appear in the bell. Critical alerts can never be muted.' },
    { id: 2, q: 'Security', a: "Manage two-factor authentication, active sessions and trusted devices. Revoke any session you don't recognise." },
    { id: 3, q: 'API & webhooks', a: 'Generate scoped API keys and register webhook endpoints. Each delivery is retried up to 5 times with exponential backoff.' },
  ];
  return (
    <div className="ax-accordion">
      {items.map((it) => (
        <div key={it.id} className="ax-accordion__item">
          <button type="button" className="ax-accordion__header" aria-expanded={open === it.id} onClick={() => setOpen(open === it.id ? null : it.id)} aria-controls={`fa-${it.id}`}>
            <span className="ax-accordion__title">{it.q}</span>
            {CHEV}
          </button>
          {open === it.id && <div className="ax-accordion__panel" id={`fa-${it.id}`}>{it.a}</div>}
        </div>
      ))}
    </div>
  );
}

function IconLed({ openSignal }: { openSignal: number }) {
  const [open, setOpen] = useState({ plan: true, usage: false, alerts: false });
  // "Expand all" pushes a signal — open everything when it changes.
  const [seen, setSeen] = useState(0);
  if (openSignal !== seen) {
    setSeen(openSignal);
    if (openSignal > 0) setOpen({ plan: true, usage: true, alerts: true });
  }
  return (
    <div className="ax-accordion ax-accordion--bordered">
      <div className="ax-accordion__item">
        <button type="button" className="ax-accordion__header" aria-expanded={open.plan} onClick={() => setOpen({ ...open, plan: !open.plan })} aria-controls="ia-1" style={{ gap: 'var(--ax-space-4)' }}>
          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }} aria-hidden="true">
            <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M5 21l-1 -7l16 0l-1 7z" /><path d="M5 11l-2 -6l5 3l4 -5l4 5l5 -3l-2 6" /></svg>
          </span>
          <span className="ax-accordion__title" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'var(--ax-text-strong)' }}>Plan &amp; billing</span>
            <span style={{ fontWeight: 'var(--ax-weight-regular)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Team plan · renews Jul 1</span>
          </span>
          <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-badge--sm">Active</span>
          {CHEV}
        </button>
        {open.plan && <div className="ax-accordion__panel" id="ia-1">Your team is on the annual plan at $23 / seat / month with 9 active seats. Add or remove seats at any time; changes are prorated to the next invoice.</div>}
      </div>
      <div className="ax-accordion__item">
        <button type="button" className="ax-accordion__header" aria-expanded={open.usage} onClick={() => setOpen({ ...open, usage: !open.usage })} aria-controls="ia-2" style={{ gap: 'var(--ax-space-4)' }}>
          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)', color: 'var(--ax-viz-cyan)' }} aria-hidden="true">
            <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19l16 0" /><path d="M4 15l4 -6l4 2l4 -5l4 4" /></svg>
          </span>
          <span className="ax-accordion__title" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'var(--ax-text-strong)' }}>Usage this month</span>
            <span style={{ fontWeight: 'var(--ax-weight-regular)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>72% of API quota used</span>
          </span>
          <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill ax-badge--sm">Watch</span>
          {CHEV}
        </button>
        {open.usage && (
          <div className="ax-accordion__panel" id="ia-2">
            You&apos;ve made 1.44M of your 2M monthly API calls. At the current rate you&apos;ll reach the limit around Jun 27 — upgrade or buy a top-up to avoid throttling.
            <div className="ax-progress ax-progress--sm" style={{ marginTop: 'var(--ax-space-3)', maxWidth: 320 }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '72%', background: 'var(--ax-viz-amber)' }} /></div></div>
          </div>
        )}
      </div>
      <div className="ax-accordion__item">
        <button type="button" className="ax-accordion__header" aria-expanded={open.alerts} onClick={() => setOpen({ ...open, alerts: !open.alerts })} aria-controls="ia-3" style={{ gap: 'var(--ax-space-4)' }}>
          <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 16%,transparent)', color: 'var(--ax-viz-violet)' }} aria-hidden="true">
            <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
          </span>
          <span className="ax-accordion__title" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: 'var(--ax-text-strong)' }}>Alert rules</span>
            <span style={{ fontWeight: 'var(--ax-weight-regular)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>4 rules · 1 muted</span>
          </span>
          <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill ax-badge--sm">4</span>
          {CHEV}
        </button>
        {open.alerts && <div className="ax-accordion__panel" id="ia-3">Alerts fire when revenue drops more than 10% day-over-day, a payment fails, stock falls below threshold, or a deploy fails. Delivery goes to the bell and #ops in Slack.</div>}
      </div>
    </div>
  );
}

export function Accordions() {
  const [openAll, setOpenAll] = useState(0);
  return (
    <>
      <PageHead
        title="Accordions"
        subtitle="Collapsible panels — single-open, multi-open, bordered, flush and icon-led, all driven by Alpine with proper aria state."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/pages/faq">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4" /><path d="M12 19l0 .01" /></svg>
            <span className="ax-btn__label">FAQ page</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Single-open */}
        <section className="ax-card ax-col--6" role="region" aria-label="Single-open accordion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Default</span>
              <h2 className="ax-card__title">Single-open</h2>
              <p className="ax-card__subtitle">Opening one panel closes the others.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}><Single /></div>
        </section>

        {/* Multi-open */}
        <section className="ax-card ax-col--6" role="region" aria-label="Multi-open accordion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Independent</span>
              <h2 className="ax-card__title">Multi-open</h2>
              <p className="ax-card__subtitle">Each panel toggles on its own.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}><Multi /></div>
        </section>

        {/* Bordered */}
        <section className="ax-card ax-col--6" role="region" aria-label="Bordered accordion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Bordered</h2>
              <p className="ax-card__subtitle">Each item is a separate boxed card.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}><Bordered /></div>
        </section>

        {/* Flush */}
        <section className="ax-card ax-col--6" role="region" aria-label="Flush accordion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Flush</h2>
              <p className="ax-card__subtitle">No outer chrome — hairline dividers only, for sidebars &amp; settings.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ padding: 0 }}><Flush /></div>
        </section>

        {/* With icons */}
        <section className="ax-card ax-col--12" role="region" aria-label="Icon-led accordion">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Rich</span>
              <h2 className="ax-card__title">With icons &amp; meta</h2>
              <p className="ax-card__subtitle">A leading tile, a supporting badge, and the chevron — the most detailed variant.</p>
            </div>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setOpenAll((n) => n + 1)}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
              <span className="ax-btn__label">Expand all</span>
            </button>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}><IconLed openSignal={openAll} /></div>
        </section>
      </div>
    </>
  );
}

export default Accordions;
