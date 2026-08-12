'use client';
/*
 * Vireo Next.js — Email compose (apps/email-compose).
 * Faithful re-expression of src/html/apps/email-compose.html: recipient chips +
 * Cc/Bcc, formatting toolbar, body, attachment dropzone with progress, autosave
 * draft, and a side rail (send-as, signature, tip). Alpine axCompose() → React.
 */
import { useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const ic = (path: ReactElement) => (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

const TOOLS = [
  { label: 'Bold', icon: ic(<><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></>) },
  { label: 'Italic', icon: ic(<><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></>) },
  { label: 'Underline', icon: ic(<><path d="M7 5v5a5 5 0 0 0 10 0v-5" /><path d="M5 19h14" /></>) },
  { label: 'Bulleted list', icon: ic(<><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></>) },
  { label: 'Numbered list', icon: ic(<><path d="M11 6h9" /><path d="M11 12h9" /><path d="M12 18h8" /><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4" /><path d="M6 10v-6l-2 2" /></>) },
  { label: 'Quote', icon: ic(<><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5" /></>) },
];

interface Recipient { name: string; email: string; initials: string; color: string }
interface AttFile { name: string; size: string; pct: number; color: string }

export function EmailCompose() {
  const router = useRouter();
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [toDraft, setToDraft] = useState('');
  const [subject, setSubject] = useState('Q3 forecast — final review before Thursday');
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [sending, setSending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [to, setTo] = useState<Recipient[]>([
    { name: 'Maya Lindqvist', email: 'maya.l@northwind.co', initials: 'ML', color: '#34D399' },
    { name: 'Tomás Herrera', email: 'tomas@brightline.io', initials: 'TH', color: '#A78BFA' },
  ]);
  const [files, setFiles] = useState<AttFile[]>([
    { name: 'Q3-Forecast-v4.xlsx', size: '248 KB', pct: 100, color: '#34D399' },
    { name: 'board-deck.pdf', size: '1.2 MB', pct: 64, color: '#FB7185' },
  ]);

  const saveDraft = () => { setSaved(true); setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); };
  const touch = () => { if (timer.current) clearTimeout(timer.current); setSaved(false); timer.current = setTimeout(saveDraft, 1200); };
  const addTo = () => {
    const v = toDraft.trim(); if (!v) return;
    const name = v.includes('@') ? v.split('@')[0] : v;
    setTo((p) => [...p, { name, email: v.includes('@') ? v : `${v}@example.com`, initials: name.slice(0, 2).toUpperCase(), color: '#38BDF8' }]);
    setToDraft(''); touch();
  };
  const send = () => { setSending(true); setTimeout(() => { setSending(false); router.push('/apps/email'); }, 900); };
  const discard = () => { setSubject(''); setBody(''); setTo([]); setFiles([]); setSaved(false); };

  return (
    <>
      <PageHead
        title="New message"
        subtitle={saved ? `Draft saved · ${savedAt}` : 'Compose a new email — drafts autosave as you type.'}
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/apps/email">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Back to inbox</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill" onClick={saveDraft}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14a2 2 0 1 0 0 -4a2 2 0 0 0 0 4" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
              <span className="ax-btn__label">Save draft</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        <form className="ax-card ax-col--8" role="region" aria-label="Compose message" onSubmit={(e) => { e.preventDefault(); send(); }} noValidate>
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Compose</span>
              <h2 className="ax-card__title">Draft a message</h2>
            </div>
            <div className="ax-card__actions">
              {saved && (
                <span className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-viz-emerald)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>Saved
                </span>
              )}
            </div>
          </div>

          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingTop: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--ax-space-3)', paddingBlock: 'var(--ax-space-3)', borderBottom: '1px solid var(--ax-border)' }}>
              <label htmlFor="to-input" className="ax-label" style={{ width: 48, paddingTop: 7, flex: '0 0 auto' }}>To</label>
              <div className="ax-tags" style={{ flex: '1 1 auto', border: 0, background: 'transparent', padding: 0, minHeight: 'auto' }}>
                {to.map((c, i) => (
                  <span key={c.email} className="ax-badge ax-badge--soft ax-badge--pill" style={{ gap: 6, paddingInlineStart: 3 }}>
                    <span className="ax-avatar ax-avatar--xs" style={{ background: `color-mix(in oklab,${c.color} 22%,transparent)`, color: c.color }}><b style={{ fontSize: 9 }}>{c.initials}</b></span>
                    <span>{c.name}</span>
                    <button type="button" className="ax-badge__remove" onClick={() => setTo((p) => p.filter((_, idx) => idx !== i))} aria-label={`Remove ${c.name}`}>
                      <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
                <input id="to-input" type="text" className="ax-tags__input" placeholder="Add recipient…" value={toDraft} onChange={(e) => setToDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTo(); } if (e.key === 'Backspace' && !toDraft) setTo((p) => p.slice(0, -1)); }} autoComplete="off" />
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', paddingTop: 4 }}>
                <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => setShowCc((v) => !v)} style={showCc ? { color: 'var(--ax-accent)' } : undefined}>Cc</button>
                <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => setShowBcc((v) => !v)} style={showBcc ? { color: 'var(--ax-accent)' } : undefined}>Bcc</button>
              </div>
            </div>

            {showCc && (
              <div className="ax-flex" style={{ alignItems: 'center', gap: 'var(--ax-space-3)', paddingBlock: 'var(--ax-space-3)', borderBottom: '1px solid var(--ax-border)' }}>
                <label htmlFor="cc-input" className="ax-label" style={{ width: 48, flex: '0 0 auto' }}>Cc</label>
                <input id="cc-input" type="text" className="ax-input" placeholder="carbon-copy@example.com" style={{ border: 0, background: 'transparent', paddingInline: 0 }} />
              </div>
            )}
            {showBcc && (
              <div className="ax-flex" style={{ alignItems: 'center', gap: 'var(--ax-space-3)', paddingBlock: 'var(--ax-space-3)', borderBottom: '1px solid var(--ax-border)' }}>
                <label htmlFor="bcc-input" className="ax-label" style={{ width: 48, flex: '0 0 auto' }}>Bcc</label>
                <input id="bcc-input" type="text" className="ax-input" placeholder="blind-copy@example.com" style={{ border: 0, background: 'transparent', paddingInline: 0 }} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', paddingBlock: 'var(--ax-space-3)', borderBottom: '1px solid var(--ax-border)' }}>
              <label htmlFor="subject" className="ax-label" style={{ width: 48, flex: '0 0 auto' }}>Subject</label>
              <input id="subject" type="text" className="ax-input" placeholder="Add a subject" value={subject} onChange={(e) => { setSubject(e.target.value); touch(); }} style={{ border: 0, background: 'transparent', paddingInline: 0, fontWeight: 500, color: 'var(--ax-text-strong)' }} />
            </div>

            <div role="toolbar" aria-label="Formatting" className="ax-cluster" style={{ gap: 2, paddingBlock: 'var(--ax-space-2)', borderBottom: '1px solid var(--ax-border)', flexWrap: 'wrap' }}>
              {TOOLS.map((b) => (
                <button key={b.label} type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={b.label}>{b.icon}</button>
              ))}
              <span className="ax-divider--vertical" aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--ax-border)', marginInline: 6 }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Insert emoji"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10l.01 0" /><path d="M15 10l.01 0" /><path d="M9.5 15a3.5 3.5 0 0 0 5 0" /></svg></button>
            </div>

            <label htmlFor="body" className="ax-visually-hidden">Message body</label>
            <textarea id="body" className="ax-textarea" value={body} onChange={(e) => { setBody(e.target.value); touch(); }} rows={11} placeholder="Write your message…" style={{ border: 0, background: 'transparent', paddingInline: 0, resize: 'vertical', minHeight: 240, lineHeight: 1.7 }} />

            <div className="ax-dropzone" style={{ marginTop: 'var(--ax-space-3)' }}>
              <label className="ax-dropzone__area" htmlFor="attach" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-5)', border: '1.5px dashed var(--ax-border-strong)', borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', textAlign: 'center', color: 'var(--ax-text-muted)' }}>
                <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-text-subtle)' }}><path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" /></svg>
                <span style={{ fontSize: 'var(--ax-text-sm)' }}><b style={{ color: 'var(--ax-accent)' }}>Click to attach</b> or drop files here</span>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Max 25 MB per file</span>
                <input id="attach" type="file" multiple className="ax-visually-hidden" />
              </label>
              <ul className="ax-dropzone__list" style={{ listStyle: 'none', margin: 'var(--ax-space-3) 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-2)' }}>
                {files.map((f, i) => (
                  <li key={f.name} className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-2) var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', background: 'var(--ax-surface-subtle)' }}>
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${f.color} 18%,transparent)`, color: f.color }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div className="ax-text-truncate" style={{ fontWeight: 500, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{f.name}</div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 3 }}>
                        <div className="ax-progress ax-progress--xs" style={{ flex: '1 1 auto' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: `${f.pct}%` }} /></div></div>
                        <span className="ax-num" style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{f.pct === 100 ? f.size : `${f.pct}%`}</span>
                      </div>
                    </div>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} aria-label={`Remove ${f.name}`}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="ax-card__footer" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
            <button type="submit" className="ax-btn ax-btn--primary" disabled={sending} aria-busy={sending}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
              <span className="ax-btn__label">{sending ? 'Sending…' : 'Send'}</span>
            </button>
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Schedule send">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
            </button>
            <span style={{ flex: '1 1 auto' }} />
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Discard draft" onClick={discard}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
            </button>
          </div>
        </form>

        <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
          <section className="ax-card" role="region" aria-label="Send options">
            <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Sending as</h2></div></div>
            <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-accent) 20%,transparent)', color: 'var(--ax-accent)' }}><b>JA</b></span>
                <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>Jawad Ahbab</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>jawad@vireo.app</div></div>
              </div>
              <div className="ax-field">
                <label className="ax-label" htmlFor="from-select">From address</label>
                <select id="from-select" className="ax-select">
                  <option>jawad@vireo.app</option>
                  <option>support@vireo.app</option>
                  <option>billing@vireo.app</option>
                </select>
              </div>
              <label className="ax-check"><input type="checkbox" className="ax-checkbox" defaultChecked /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Request read receipt</span></label>
              <label className="ax-check"><input type="checkbox" className="ax-checkbox" /><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Send a copy to myself</span></label>
            </div>
          </section>

          <section className="ax-card" role="region" aria-label="Signature">
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title">Signature</h2></div>
              <Link className="ax-btn ax-btn--link ax-btn--sm" href="/apps/email-settings">Edit</Link>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>
              <div style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', borderInlineStart: '2px solid var(--ax-accent)', background: 'var(--ax-surface-subtle)', borderRadius: 'var(--ax-radius-sm)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>
                <b style={{ color: 'var(--ax-text-strong)' }}>Jawad Ahbab</b><br />
                <span style={{ color: 'var(--ax-text-muted)' }}>Product Lead · Vireo</span><br />
                <span className="ax-num" style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>+1 (415) 555-0142 · vireo.app</span>
              </div>
            </div>
          </section>

          <section className="ax-card ax-card--accent-edge" role="region" aria-label="Tip">
            <div className="ax-card__body" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start' }}>
              <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 18%,transparent)', color: 'var(--ax-viz-cyan)', flex: '0 0 auto' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 1 6 6c0 2 -1 3.5 -2.5 5c-.5 .5 -.5 1 -.5 1.5h-6c0 -.5 0 -1 -.5 -1.5c-1.5 -1.5 -2.5 -3 -2.5 -5a6 6 0 0 1 6 -6" /><path d="M9.7 17l4.6 0" /><path d="M10 21l4 0" /></svg></span>
              <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', lineHeight: 1.6 }}>Press <kbd className="ax-kbd">⌘</kbd> <kbd className="ax-kbd">↵</kbd> to send, or <kbd className="ax-kbd">Esc</kbd> to save and close. Drafts autosave every few seconds.</p>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default EmailCompose;
