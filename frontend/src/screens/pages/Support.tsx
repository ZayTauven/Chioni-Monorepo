'use client';
/*
 * Vireo React — Help Center / Support (route "pages/support").
 *
 * Faithful re-expression of src/html/pages/support.html: a hero search with live
 * article results, a 6-tile category grid, a popular-articles accordion, a
 * ticket form with loading→success ref state, and four contact-channel cards.
 * Alpine x-data getters / form submit ported to React state. DOM/ARIA 1:1.
 */
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

interface Article { id: number; title: string; cat: string; }
const ARTICLES: Article[] = [
  { id: 1, title: 'Setting up your first workspace', cat: 'Getting started' },
  { id: 2, title: 'Inviting and managing team members', cat: 'Account' },
  { id: 3, title: 'Understanding your invoice', cat: 'Billing' },
  { id: 4, title: 'Enabling two-factor authentication', cat: 'Security' },
  { id: 5, title: 'Connecting Slack notifications', cat: 'Integrations' },
  { id: 6, title: 'Exporting your data', cat: 'Account' },
  { id: 7, title: 'Upgrading or downgrading your plan', cat: 'Billing' },
  { id: 8, title: 'Generating API keys', cat: 'Integrations' },
];

interface Cat { label: string; desc: string; tint: string; count: number; icon: ReactNode; }
const CATS: Cat[] = [
  { label: 'Getting started', desc: 'Set up your account, create a workspace and invite your team.', tint: 'var(--ax-viz-cyan)', count: 18, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3" /><path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3" /><path d="M14 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg> },
  { label: 'Account', desc: 'Manage your profile, members, roles and workspace settings.', tint: 'var(--ax-viz-violet)', count: 24, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" /></svg> },
  { label: 'Billing', desc: 'Invoices, plans, payment methods and refunds.', tint: 'var(--ax-viz-emerald)', count: 15, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg> },
  { label: 'Security', desc: 'Two-factor auth, sessions, SSO and data protection.', tint: 'var(--ax-viz-amber)', count: 12, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M12 12l0 2.5" /></svg> },
  { label: 'Integrations', desc: 'Connect Slack, GitHub, Stripe and the REST API.', tint: 'var(--ax-viz-pink)', count: 31, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054" /><path d="M4 20l3.5 -3.5" /><path d="M15 4l-3.5 3.5" /><path d="M20 9l-3.5 3.5" /></svg> },
  { label: 'API & developers', desc: 'Authentication, webhooks, rate limits and SDKs.', tint: 'var(--ax-accent)', count: 27, icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 8l-4 4l4 4" /><path d="M17 8l4 4l-4 4" /><path d="M14 4l-4 16" /></svg> },
];

const POPULAR = [
  { q: 'How do I reset my password?', a: 'Select "Forgot password" on the sign-in screen, enter your email, and follow the secure link we send. Reset links expire after 30 minutes for your protection.' },
  { q: 'Where can I download my invoices?', a: 'Every invoice is listed under Settings → Billing → Invoice history. Use the download icon on any row to grab a PDF. Invoices are retained for 7 years.' },
  { q: 'How do I add a team member?', a: 'Open Settings → Members, click "Invite", enter their email and choose a role. They\'ll receive an invitation that\'s valid for 7 days.' },
  { q: 'Can I export my workspace data?', a: "Yes. Go to Settings → Data & privacy → Export. We'll prepare a full archive and email you a secure download link, usually within an hour." },
];

const CHANNELS: { label: string; sub: string; tint: string; icon: ReactNode }[] = [
  { label: 'Email', sub: 'support@vireo.io', tint: 'var(--ax-viz-cyan)', icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg> },
  { label: 'Live chat', sub: 'Mon–Fri, 9am–6pm', tint: 'var(--ax-viz-emerald)', icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 14l-3 -3h-7a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h9a1 1 0 0 1 1 1v10" /><path d="M14 15v2a1 1 0 0 1 -1 1h-7l-3 3v-10a1 1 0 0 1 1 -1h2" /></svg> },
  { label: 'Docs', sub: 'docs.vireo.io', tint: 'var(--ax-viz-violet)', icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12" /><path d="M19 16h-12a2 2 0 0 0 -2 2" /><path d="M9 8h6" /></svg> },
  { label: 'Community', sub: 'community.vireo.io', tint: 'var(--ax-viz-amber)', icon: <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg> },
];

export function Support() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success'>('idle');
  const [ref, setRef] = useState('');

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [] as Article[];
    return ARTICLES.filter((a) => a.title.toLowerCase().includes(t) || a.cat.toLowerCase().includes(t));
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setState('loading');
    setTimeout(() => {
      setRef('TKT-' + Math.floor(100000 + Math.random() * 900000));
      setState('success');
    }, 600);
  };

  return (
    <>
      <PageHead
        title="Help Center"
        subtitle="Search the knowledge base, browse popular topics, or reach our team directly."
        actions={
          <Link className="ax-btn ax-btn--secondary" href="/pages/faq">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 16v.01" /><path d="M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483" /></svg>
            <span className="ax-btn__label">View FAQ</span>
          </Link>
        }
      />

      {/* HERO SEARCH */}
      <div className="ax-dash-grid">
        <section className="ax-card ax-col--12" role="search" aria-label="Search help articles">
          <div className="ax-card__body" style={{ textAlign: 'center', paddingBlock: 'var(--ax-space-8)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-5)' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 600, color: 'var(--ax-text-strong)', margin: 0 }}>How can we help?</h2>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-md)', marginTop: 'var(--ax-space-2)' }}>Search 200+ articles across every Vireo feature.</p>
            </div>
            <div style={{ position: 'relative', maxWidth: 600, width: '100%' }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 'var(--ax-space-4)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input ax-input--lg" placeholder="Search for articles, e.g. “reset password”" aria-label="Search help articles" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQ(''); }} style={{ paddingInlineStart: 'var(--ax-space-10)', textAlign: 'start' }} />
            </div>
            {q.trim() !== '' && (
              <div style={{ maxWidth: 600, width: '100%', textAlign: 'start' }}>
                <p className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)', marginBottom: 'var(--ax-space-2)' }} aria-live="polite">{`${results.length} result${results.length === 1 ? '' : 's'} for '${q.trim()}'`}</p>
                {results.length > 0 ? (
                  <ul className="ax-list ax-list--compact" style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                    {results.map((a) => (
                      <li key={a.id} className="ax-list__row" style={{ cursor: 'pointer' }}>
                        <span className="ax-list__leading"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="var(--ax-text-subtle)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M9 9l1 0" /><path d="M9 13l6 0" /><path d="M9 17l6 0" /></svg></span>
                        <span className="ax-list__content"><span className="ax-list__title">{a.title}</span></span>
                        <span className="ax-list__trailing"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--sm">{a.cat}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-5)', textAlign: 'center' }}>
                    <p style={{ color: 'var(--ax-text-strong)', fontWeight: 'var(--ax-weight-medium)' }}>No articles match <span>{`'${q.trim()}'`}</span></p>
                    <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 4 }}>Try a broader term, or submit a request below.</p>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" style={{ marginTop: 'var(--ax-space-3)' }} onClick={() => setQ('')}>Clear search</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* CATEGORY GRID */}
      <div className="ax-dash-grid" style={{ marginBlockStart: 'var(--ax-space-6)' }}>
        {CATS.map((c) => (
          <section key={c.label} className="ax-card ax-col--4 ax-card--interactive" role="region" aria-label={c.label}>
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={c.tint === 'var(--ax-accent)' ? { background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' } : { background: `color-mix(in oklab,${c.tint} 18%,transparent)`, color: c.tint }}>{c.icon}</span>
              <div>
                <h3 style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>{c.label}</h3>
                <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 4 }}>{c.desc}</p>
              </div>
              <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', fontFamily: 'var(--ax-font-mono)', marginTop: 'auto' }}>{c.count} articles</span>
            </div>
          </section>
        ))}
      </div>

      {/* POPULAR + TICKET FORM */}
      <div className="ax-dash-grid" style={{ marginBlockStart: 'var(--ax-space-6)' }}>
        <section className="ax-card ax-col--7" role="region" aria-label="Popular articles">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Most read</span><h2 className="ax-card__title">Popular articles</h2></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-accordion">
              {POPULAR.map((p, i) => (
                <div key={i} className="ax-accordion__item">
                  <button type="button" className="ax-accordion__header" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                    <span className="ax-accordion__title">{p.q}</span>
                    <svg className="ax-accordion__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                  </button>
                  {open === i && <div className="ax-accordion__panel">{p.a}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="ax-card__footer"><Link className="ax-link" href="/pages/faq">Browse all articles →</Link></div>
        </section>

        {/* ticket form */}
        <section className="ax-card ax-col--5" role="region" aria-label="Submit a request">
          <div className="ax-card__header">
            <div className="ax-card__titles"><span className="ax-card__eyebrow">Still stuck?</span><h2 className="ax-card__title">Submit a request</h2><p className="ax-card__subtitle">We typically reply within a few hours.</p></div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            {state === 'success' ? (
              <div className="ax-flex" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-6) 0' }}>
                <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'var(--ax-success-50)', color: 'var(--ax-success-500)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                <div>
                  <p style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)' }}>Request submitted</p>
                  <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', marginTop: 4 }}>We've emailed you a confirmation. Your reference:</p>
                  <button type="button" className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-md)', color: 'var(--ax-accent)', background: 'var(--ax-accent-wash)', border: 0, borderRadius: 'var(--ax-radius-sm)', padding: '4px var(--ax-space-3)', marginTop: 'var(--ax-space-2)', cursor: 'pointer' }} onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(ref); }} aria-label={`Copy reference ${ref}`}>{ref}</button>
                </div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setState('idle')}>Submit another</button>
              </div>
            ) : (
              <form className="ax-flex" onSubmit={submit} style={{ flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="t-subject">Subject</label>
                  <input id="t-subject" type="text" className="ax-input" placeholder="Brief summary of your issue" required readOnly={state === 'loading'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)' }}>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="t-cat">Category</label>
                    <select id="t-cat" className="ax-select" required disabled={state === 'loading'} defaultValue="">
                      <option value="">Select…</option>
                      <option>Account</option>
                      <option>Billing</option>
                      <option>Security</option>
                      <option>Integrations</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="t-pri">Priority</label>
                    <select id="t-pri" className="ax-select" disabled={state === 'loading'} defaultValue="Normal">
                      <option>Low</option>
                      <option>Normal</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="t-desc">Description</label>
                  <textarea id="t-desc" className="ax-textarea" rows={4} placeholder="Tell us what's happening and what you've tried…" required readOnly={state === 'loading'} />
                </div>
                <div className="ax-field">
                  <span className="ax-label">Attachment</span>
                  <label htmlFor="t-file" className="ax-btn ax-btn--secondary ax-btn--block" style={{ cursor: 'pointer' }}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" /></svg>
                    <span className="ax-btn__label">Add a screenshot</span>
                  </label>
                  <input id="t-file" type="file" className="ax-visually-hidden" aria-label="Add an attachment" />
                </div>
                <button type="submit" className="ax-btn ax-btn--primary ax-btn--block" disabled={state === 'loading'} aria-busy={state === 'loading'}>
                  {state === 'loading' && <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ animation: 'ax-spin 0.7s var(--ax-ease-linear) infinite' }}><path d="M12 3a9 9 0 1 0 9 9" /></svg>}
                  <span className="ax-btn__label">{state === 'loading' ? 'Sending…' : 'Submit request'}</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* CONTACT CHANNELS */}
      <div className="ax-dash-grid" style={{ marginBlockStart: 'var(--ax-space-6)' }}>
        {CHANNELS.map((c) => (
          <section key={c.label} className="ax-card ax-col--3 ax-card--interactive" role="region" aria-label={c.label}>
            <div className="ax-card__body" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
              <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.tint} 18%,transparent)`, color: c.tint }}>{c.icon}</span>
              <p style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{c.label}</p>
              <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>{c.sub}</p>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export default Support;
