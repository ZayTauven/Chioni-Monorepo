'use client';
/*
 * Vireo Next.js — Email settings (apps/email-settings).
 * Faithful re-expression of src/html/apps/email-settings.html: vertical tab rail
 * with Account / Signature / Filters / Labels / Vacation / Notifications panels,
 * a save toast. Alpine axMailSettings() → React useState; DOM/ARIA match 1:1.
 */
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const ic = (path: ReactElement) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

const TABS = [
  { id: 'account', name: 'Account', icon: ic(<><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>) },
  { id: 'signature', name: 'Signature', icon: ic(<><path d="M20 7l-3 -3l-11 11l-1 4l4 -1z" /><path d="M3 21h18" /></>) },
  { id: 'filters', name: 'Filters & rules', icon: ic(<path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345z" />) },
  { id: 'labels', name: 'Labels', icon: ic(<><path d="M7.859 6h-2.834a2 2 0 0 0 -1.985 2.265l.5 4a2 2 0 0 0 1.985 1.735h2.834" /><path d="M11 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1" /></>) },
  { id: 'vacation', name: 'Vacation responder', icon: ic(<><path d="M3 21l18 0" /><path d="M9 21v-4a3 3 0 0 1 6 0v4" /><path d="M12 4l0 5" /><path d="M5 9l14 0l-1 -3a2 2 0 0 0 -2 -1.5h-8a2 2 0 0 0 -2 1.5z" /></>) },
  { id: 'notifications', name: 'Notifications', icon: ic(<><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></>) },
];

interface Rule { when: string; match: string; action: string; enabled: boolean }
interface Lbl { name: string; color: string }
const PALETTE = ['#34D399', '#38BDF8', '#A78BFA', '#F472B6', '#FBBF24', '#FB7185'];
const NOTIFS = [
  { label: 'New mail desktop alerts', desc: 'Notify me when a new message arrives.', on: true },
  { label: 'Important only', desc: 'Limit alerts to messages marked important.', on: false },
  { label: 'Mention sounds', desc: 'Play a sound when I am @-mentioned.', on: true },
  { label: 'Daily digest', desc: 'Email me a summary at 8:00 AM.', on: true },
];

export function EmailSettings() {
  const [tab, setTab] = useState('account');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const [vacationOn, setVacationOn] = useState(true);
  const [rules, setRules] = useState<Rule[]>([
    { when: 'From', match: '@stripe.com', action: 'Apply label', enabled: true },
    { when: 'Subject', match: 'invoice', action: 'Star', enabled: true },
    { when: 'From', match: 'newsletter@', action: 'Archive', enabled: false },
  ]);
  const [labels, setLabels] = useState<Lbl[]>([
    { name: 'Finance', color: '#34D399' },
    { name: 'Clients', color: '#38BDF8' },
    { name: 'Personal', color: '#A78BFA' },
    { name: 'Receipts', color: '#FBBF24' },
  ]);

  const patchRule = (i: number, p: Partial<Rule>) => setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const patchLabel = (i: number, p: Partial<Lbl>) => setLabels((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); setToast(true); setTimeout(() => setToast(false), 3000); }, 700); };

  return (
    <>
      <PageHead
        title="Email settings"
        subtitle="Manage your account, signature, filters and away messages."
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/apps/email">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Back to inbox</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary" onClick={save} aria-busy={saving}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              <span className="ax-btn__label">{saving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </>
        }
      />

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60 }}>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-lg)' }}>
            <span style={{ color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Settings saved successfully</span>
          </div>
        </div>
      )}

      <div className="ax-dash-grid">
        <aside className="ax-col--3" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
          <div className="ax-card">
            <nav className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 'var(--ax-space-3)' }}>
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id ? 'true' : 'false'} onClick={() => setTab(t.id)} className="ax-list__row" style={{ width: '100%', border: 0, borderRadius: 'var(--ax-radius-md)', textAlign: 'start', cursor: 'pointer', ...(tab === t.id ? { background: 'var(--ax-accent-wash)', boxShadow: 'inset 2px 0 0 var(--ax-accent)' } : { background: 'transparent' }) }}>
                  <span className="ax-list__leading" style={{ color: tab === t.id ? 'var(--ax-accent)' : 'var(--ax-text-muted)' }}>{t.icon}</span>
                  <span className="ax-list__content"><span className="ax-list__title" style={tab === t.id ? { color: 'var(--ax-text-strong)', fontWeight: 600 } : undefined}>{t.name}</span></span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="ax-col--9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          {tab === 'account' && (
            <section className="ax-card" role="tabpanel" aria-label="Account">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Account</span><h2 className="ax-card__title">Profile &amp; addresses</h2><p className="ax-card__subtitle">How you appear on outgoing mail.</p></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-4)', flexWrap: 'nowrap' }}>
                  <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-accent) 20%,transparent)', color: 'var(--ax-accent)' }}><b style={{ fontSize: 'var(--ax-text-lg)' }}>JA</b></span>
                  <div>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">Change photo</button>
                    <p style={{ margin: 'var(--ax-space-2) 0 0', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>JPG or PNG, up to 2 MB.</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="display-name">Display name</label>
                    <input id="display-name" type="text" className="ax-input" defaultValue="Jawad Ahbab" />
                    <span className="ax-help">Shown to recipients in the &ldquo;From&rdquo; line.</span>
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="reply-to">Reply-to address</label>
                    <input id="reply-to" type="email" className="ax-input" defaultValue="jawad@vireo.app" />
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="default-from">Default sending address</label>
                    <select id="default-from" className="ax-select">
                      <option>jawad@vireo.app</option>
                      <option>support@vireo.app</option>
                      <option>billing@vireo.app</option>
                    </select>
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="lang">Language &amp; region</label>
                    <select id="lang" className="ax-select">
                      <option>English (United States)</option>
                      <option>English (United Kingdom)</option>
                      <option>Français</option>
                      <option>Deutsch</option>
                    </select>
                  </div>
                </div>
                <hr className="ax-divider" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)' }}>
                    <div><div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>Conversation view</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Group replies into a single thread.</div></div>
                    <input type="checkbox" className="ax-switch" role="switch" defaultChecked aria-label="Conversation view" />
                  </div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)' }}>
                    <div><div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>Show snippets</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Preview the first line beside each subject.</div></div>
                    <input type="checkbox" className="ax-switch" role="switch" defaultChecked aria-label="Show snippets" />
                  </div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)' }}>
                    <div><div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>Send &amp; archive</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Show a button to archive when you reply.</div></div>
                    <input type="checkbox" className="ax-switch" role="switch" aria-label="Send and archive" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {tab === 'signature' && (
            <section className="ax-card" role="tabpanel" aria-label="Signature">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Signature</span><h2 className="ax-card__title">Email signature</h2><p className="ax-card__subtitle">Appended to the bottom of every message you send.</p></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)' }}>
                  <div><div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>Enable signature</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Insert automatically on new emails.</div></div>
                  <input type="checkbox" className="ax-switch" role="switch" defaultChecked aria-label="Enable signature" />
                </div>
                <div>
                  <div role="toolbar" aria-label="Signature formatting" className="ax-cluster" style={{ gap: 2, padding: 'var(--ax-space-1)', border: '1px solid var(--ax-border)', borderBottom: 0, borderRadius: 'var(--ax-radius-sm) var(--ax-radius-sm) 0 0', background: 'var(--ax-surface-subtle)', flexWrap: 'wrap' }}>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Bold"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg></button>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Italic"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg></button>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
                    <span aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--ax-border)', marginInline: 6 }} />
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert image"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M4 15l4 -4a3 5 0 0 1 3 0l5 5" /><path d="M14 14l1 -1a3 5 0 0 1 3 0l2 2" /></svg></button>
                  </div>
                  <div contentEditable aria-multiline="true" aria-label="Signature content" suppressContentEditableWarning style={{ minHeight: 130, padding: 'var(--ax-space-4)', border: '1px solid var(--ax-border)', borderRadius: '0 0 var(--ax-radius-sm) var(--ax-radius-sm)', background: 'var(--ax-surface)', lineHeight: 1.6, fontSize: 'var(--ax-text-sm)', outline: 'none' }}>
                    <b style={{ color: 'var(--ax-text-strong)' }}>Jawad Ahbab</b><br />
                    <span style={{ color: 'var(--ax-text-muted)' }}>Product Lead · Vireo</span><br />
                    <span style={{ color: 'var(--ax-text-subtle)' }}>+1 (415) 555-0142 · </span><span style={{ color: 'var(--ax-accent)' }}>vireo.app</span>
                  </div>
                </div>
                <label className="ax-check"><input type="checkbox" className="ax-checkbox" defaultChecked /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Insert signature before quoted text in replies</span></label>
              </div>
            </section>
          )}

          {tab === 'filters' && (
            <section className="ax-card" role="tabpanel" aria-label="Filters">
              <div className="ax-card__header">
                <div className="ax-card__titles"><span className="ax-card__eyebrow">Rules</span><h2 className="ax-card__title">Filters &amp; rules</h2><p className="ax-card__subtitle">When a message arrives, apply these actions in order.</p></div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setRules((p) => [...p, { when: 'From', match: '', action: 'Apply label', enabled: true }])}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
                  <span className="ax-btn__label">New rule</span>
                </button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                {rules.map((r, i) => (
                  <div key={i} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'wrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)' }}>
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', width: 34 }}>If</span>
                    <select className="ax-select ax-select--sm" value={r.when} onChange={(e) => patchRule(i, { when: e.target.value })} style={{ width: 120, flex: '0 0 auto' }}><option>From</option><option>To</option><option>Subject</option><option>Has words</option></select>
                    <input type="text" className="ax-input ax-input--sm" placeholder="contains…" value={r.match} onChange={(e) => patchRule(i, { match: e.target.value })} style={{ flex: '1 1 160px', minWidth: 120 }} />
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>then</span>
                    <select className="ax-select ax-select--sm" value={r.action} onChange={(e) => patchRule(i, { action: e.target.value })} style={{ width: 150, flex: '0 0 auto' }}><option>Apply label</option><option>Archive</option><option>Mark as read</option><option>Star</option><option>Forward to…</option><option>Delete</option></select>
                    <span style={{ flex: '1 1 auto' }} />
                    <input type="checkbox" className="ax-switch ax-switch--sm" role="switch" checked={r.enabled} onChange={(e) => patchRule(i, { enabled: e.target.checked })} aria-label={`Enable rule ${i + 1}`} />
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setRules((p) => p.filter((_, idx) => idx !== i))} aria-label="Delete rule"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                  </div>
                ))}
                {rules.length === 0 && <p style={{ textAlign: 'center', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-sm)', padding: 'var(--ax-space-6)' }}>No rules yet — create one to automate your inbox.</p>}
              </div>
            </section>
          )}

          {tab === 'labels' && (
            <section className="ax-card" role="tabpanel" aria-label="Labels">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Labels</span><h2 className="ax-card__title">Labels &amp; colors</h2></div>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setLabels((p) => [...p, { name: 'New label', color: '#38BDF8' }])}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Add label</span></button>
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                {labels.map((l, i) => (
                  <div key={i} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)' }}>
                    <i style={{ width: 14, height: 14, borderRadius: 4, background: l.color, flex: '0 0 auto' }} />
                    <input type="text" className="ax-input ax-input--sm" value={l.name} onChange={(e) => patchLabel(i, { name: e.target.value })} style={{ flex: '1 1 auto' }} aria-label={`Label ${i + 1} name`} />
                    <div className="ax-cluster" style={{ gap: 5, flex: '0 0 auto' }}>
                      {PALETTE.map((c) => (
                        <button key={c} type="button" onClick={() => patchLabel(i, { color: c })} aria-label={`Set color ${c}`} aria-pressed={l.color === c} style={{ width: 18, height: 18, borderRadius: 5, background: c, border: 0, cursor: 'pointer', boxShadow: l.color === c ? `0 0 0 2px var(--ax-surface-solid),0 0 0 4px ${c}` : 'none' }} />
                      ))}
                    </div>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setLabels((p) => p.filter((_, idx) => idx !== i))} aria-label="Delete label"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg></button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'vacation' && (
            <section className="ax-card" role="tabpanel" aria-label="Vacation responder">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Away</span><h2 className="ax-card__title">Vacation responder</h2><p className="ax-card__subtitle">Auto-reply to incoming mail while you&apos;re away.</p></div>
                <input type="checkbox" className="ax-switch" role="switch" checked={vacationOn} onChange={(e) => setVacationOn(e.target.checked)} aria-label="Enable vacation responder" />
              </div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', ...(!vacationOn ? { opacity: 0.5, pointerEvents: 'none' } : {}) }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="vac-start">First day</label><input id="vac-start" type="date" className="ax-input" defaultValue="2026-07-01" /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="vac-end">Last day</label><input id="vac-end" type="date" className="ax-input" defaultValue="2026-07-14" /></div>
                </div>
                <div className="ax-field"><label className="ax-label" htmlFor="vac-subject">Subject</label><input id="vac-subject" type="text" className="ax-input" defaultValue="Out of office until July 14" /></div>
                <div className="ax-field">
                  <label className="ax-label" htmlFor="vac-msg">Message</label>
                  <textarea id="vac-msg" className="ax-textarea" rows={5} defaultValue="Thanks for your email. I'm away until July 14 with limited access to mail. For anything urgent, please reach Priya Nair at priya@vireo.app. I'll respond when I'm back." />
                </div>
                <label className="ax-check"><input type="checkbox" className="ax-checkbox" defaultChecked /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Only send to people in my contacts</span></label>
              </div>
            </section>
          )}

          {tab === 'notifications' && (
            <section className="ax-card" role="tabpanel" aria-label="Notifications">
              <div className="ax-card__header"><div className="ax-card__titles"><span className="ax-card__eyebrow">Alerts</span><h2 className="ax-card__title">Notifications</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                {NOTIFS.map((n) => (
                  <div key={n.label} className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-3)' }}>
                    <div><div style={{ fontWeight: 500, color: 'var(--ax-text-strong)' }}>{n.label}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{n.desc}</div></div>
                    <input type="checkbox" className="ax-switch" role="switch" defaultChecked={n.on} aria-label={n.label} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

export default EmailSettings;
