'use client';
/*
 * Vireo React — FAQ (route "pages/faq").
 *
 * Faithful re-expression of src/html/pages/faq.html: searchable + category-
 * filterable accordion with live query highlighting (the Alpine `filtered`
 * getter + `mark()` highlighter), a categories rail and a contact card. DOM
 * classes / ARIA / copy match the reference 1:1.
 */
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Item { id: string; cat: string; q: string; a: string; }
const ITEMS: Item[] = [
  { id: 'a1', cat: 'account', q: 'How do I create a new workspace?', a: 'Open the workspace switcher in the top-left, choose “New workspace”, give it a name and pick a region. Your first three workspaces are free on every paid plan.' },
  { id: 'a2', cat: 'account', q: 'Can I transfer ownership of my account?', a: 'Yes. Go to Settings → Members, open the member you want to promote and select “Transfer ownership”. You’ll confirm by email — the change is instant once both parties accept.' },
  { id: 'a3', cat: 'account', q: 'How do I delete my account?', a: 'Account deletion lives under Settings → Danger zone. We keep a 14-day grace window during which you can restore everything, after which data is permanently purged.' },
  { id: 'b1', cat: 'billing', q: 'When am I charged for my subscription?', a: 'Monthly plans renew on the calendar day you subscribed; annual plans renew on the anniversary date. We email an invoice 3 days before every renewal.' },
  { id: 'b2', cat: 'billing', q: 'Can I get a refund?', a: 'We offer a no-questions-asked refund within 14 days of any new charge. Reach out from the billing page and the credit lands back on your card within 5–10 business days.' },
  { id: 'b3', cat: 'billing', q: 'Do prices include tax?', a: 'Listed prices are exclusive of VAT and sales tax. Applicable tax is calculated at checkout based on your billing address and shown on every invoice.' },
  { id: 's1', cat: 'security', q: 'Where is my data stored?', a: 'Data is stored in SOC 2 Type II certified data centers in your chosen region (US, EU or AP). It is encrypted at rest with AES-256 and in transit with TLS 1.3.' },
  { id: 's2', cat: 'security', q: 'Do you support two-factor authentication?', a: 'Yes — TOTP authenticator apps and hardware security keys (WebAuthn) are supported on all plans. Admins can enforce 2FA org-wide from Security settings.' },
  { id: 's3', cat: 'security', q: 'How do I report a vulnerability?', a: 'Email security@vireo.io or use our responsible-disclosure form. Verified reports are eligible for a bounty and we acknowledge every submission within one business day.' },
  { id: 'i1', cat: 'integrations', q: 'Which integrations are available?', a: 'Vireo connects natively with Slack, Linear, GitHub, Stripe, Google Workspace and 40+ other tools. Anything else can be wired through our REST API and webhooks.' },
  { id: 'i2', cat: 'integrations', q: 'Is there a public API?', a: 'Pro and above include a full REST API plus signed webhooks. Generate keys under Settings → Developer, and explore every endpoint in our interactive API reference.' },
];

const CATS: { key: string; label: string; tint: string; count: number; icon: ReactNode }[] = [
  { key: 'account', label: 'Account', tint: 'var(--ax-viz-cyan)', count: 3, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" /></svg> },
  { key: 'billing', label: 'Billing', tint: 'var(--ax-viz-violet)', count: 3, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg> },
  { key: 'security', label: 'Security', tint: 'var(--ax-viz-emerald)', count: 3, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 12l0 2.5" /></svg> },
  { key: 'integrations', label: 'Integrations', tint: 'var(--ax-viz-amber)', count: 2, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054" /><path d="M4 20l3.5 -3.5" /><path d="M15 4l-3.5 3.5" /><path d="M20 9l-3.5 3.5" /></svg> },
];

function highlight(text: string, term: string): ReactNode {
  const t = term.trim();
  if (!t) return text;
  const safe = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${safe})`, 'ig'));
  return parts.map((part, i) => (part.toLowerCase() === t.toLowerCase() ? <mark key={i} className="ax-mark">{part}</mark> : part));
}

export function Faq() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ITEMS.filter(
      (it) => (cat === 'all' || it.cat === cat) && (term === '' || it.q.toLowerCase().includes(term) || it.a.toLowerCase().includes(term))
    );
  }, [q, cat]);

  return (
    <>
      <PageHead
        title="Frequently asked questions"
        subtitle="Answers to the questions our customers ask most. Can't find what you need? Contact support."
        actions={
          <Link className="ax-btn ax-btn--primary" href="/pages/support">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg>
            <span className="ax-btn__label">Contact support</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* search + filters */}
        <section className="ax-card ax-col--12" role="region" aria-label="Search FAQs">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div style={{ position: 'relative', maxWidth: 560, width: '100%' }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 'var(--ax-space-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input" placeholder="Search questions…" aria-label="Search questions" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} style={{ paddingInlineStart: 'var(--ax-space-9)' }} />
            </div>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap' }} role="group" aria-label="Filter by category">
              {(['all', 'account', 'billing', 'security', 'integrations'] as const).map((c) => (
                <button key={c} type="button" className={`ax-btn ax-btn--pill ax-btn--sm ${cat === c ? 'ax-btn--primary' : 'ax-btn--secondary'}`} onClick={() => setCat(c)}>
                  {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
            <p className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)' }} aria-live="polite">{filtered.length + (filtered.length === 1 ? ' question' : ' questions')}</p>
          </div>
        </section>

        {/* accordion list */}
        <section className="ax-card ax-col--8" role="region" aria-label="Questions">
          <div className="ax-card__body">
            <div className="ax-accordion">
              {filtered.map((it) => (
                <div key={it.id} className="ax-accordion__item">
                  <button type="button" className="ax-accordion__header" aria-expanded={open === it.id} aria-controls={`panel-${it.id}`} onClick={() => setOpen(open === it.id ? null : it.id)}>
                    <span className="ax-accordion__title">{highlight(it.q, q)}</span>
                    <svg className="ax-accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                  </button>
                  {open === it.id && <div className="ax-accordion__panel" id={`panel-${it.id}`}>{it.a}</div>}
                </div>
              ))}
            </div>
            {/* empty state */}
            {filtered.length === 0 && (
              <div className="ax-flex" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-10) var(--ax-space-5)' }}>
                <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-fill-hover)', color: 'var(--ax-text-subtle)' }}>
                  <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                </span>
                <div>
                  <p style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>No matching questions</p>
                  <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 4 }}>Try a different keyword or clear your search.</p>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => { setQ(''); setCat('all'); }}>Clear search</button>
              </div>
            )}
          </div>
        </section>

        {/* categories rail + contact */}
        <div className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Browse by category">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-md)' }}>Categories</h2></div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <ul className="ax-list ax-list--compact">
                {CATS.map((c) => (
                  <li key={c.key} className="ax-list__row" style={{ cursor: 'pointer' }} onClick={() => { setCat(c.key); setQ(''); }}>
                    <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.tint} 18%,transparent)`, color: c.tint }}>{c.icon}</span></span>
                    <span className="ax-list__content"><span className="ax-list__title">{c.label}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-subtle)' }}>{c.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Contact support">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', textAlign: 'center', alignItems: 'center' }}>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>
                <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" /></svg>
              </span>
              <div>
                <p style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>Didn't find an answer?</p>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 4 }}>Our team typically replies within a few hours.</p>
              </div>
              <Link className="ax-btn ax-btn--primary ax-btn--block" href="/pages/support"><span className="ax-btn__label">Contact support</span></Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default Faq;
