'use client';
/*
 * Vireo Next.js — Email inbox (apps/email).
 * Faithful re-expression of src/html/apps/email.html: 3-pane client (folder rail
 * with storage meter, message list with bulk bar, reading pane with collapsible
 * quote + attachments). Alpine axEmail() → React useState; DOM/ARIA match 1:1.
 */
import { useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const ic = (path: ReactElement) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

interface Folder { id: string; name: string; count: number; icon: ReactElement }
const FOLDERS: Folder[] = [
  { id: 'inbox', name: 'Inbox', count: 6, icon: ic(<><path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" /><path d="M4 13h3l3 3h4l3 -3h3" /></>) },
  { id: 'starred', name: 'Starred', count: 3, icon: ic(<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />) },
  { id: 'snoozed', name: 'Snoozed', count: 1, icon: ic(<><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></>) },
  { id: 'sent', name: 'Sent', count: 0, icon: ic(<><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></>) },
  { id: 'drafts', name: 'Drafts', count: 2, icon: ic(<><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></>) },
  { id: 'archive', name: 'Archive', count: 0, icon: ic(<><path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" /><path d="M10 12l4 0" /></>) },
  { id: 'spam', name: 'Spam', count: 0, icon: ic(<><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M12 8v4" /><path d="M12 16h.01" /></>) },
  { id: 'trash', name: 'Trash', count: 0, icon: ic(<><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></>) },
];

const LABELS = [
  { name: 'Finance', color: '#34D399', count: 8 },
  { name: 'Clients', color: '#38BDF8', count: 14 },
  { name: 'Personal', color: '#A78BFA', count: 5 },
  { name: 'Receipts', color: '#FBBF24', count: 21 },
];

interface Message {
  id: number; from: string; subject: string; snippet: string; time: string;
  unread: boolean; starred: boolean; attach: boolean; tag: string; tagColor: string;
  initials: string; color: string; email: string; fullTime: string;
  participants: number; count: number; body: string;
}
const SEED: Message[] = [
  { id: 1, from: 'Maya Lindqvist', subject: 'Re: Q3 forecast — final review before Thursday', snippet: 'Thanks for the quick turnaround. I left two comments on the margin tab…', time: '9:14 AM', unread: true, starred: true, attach: true, tag: 'Finance', tagColor: '#34D399', initials: 'ML', color: '#34D399', email: 'maya.l@northwind.co', fullTime: 'Apr 25, 9:14 AM', participants: 3, count: 4, body: '<p>Thanks for the quick turnaround on this. I left two comments on the margin tab — mostly around the assumed churn rate for the enterprise segment. Otherwise the numbers line up with what finance modelled last week.</p><p>Can we lock the deck by EOD tomorrow so legal has time to review the appendix?</p><p style="margin-bottom:0;">Best,<br>Maya</p>' },
  { id: 2, from: 'GitHub', subject: '[vireo/web] 3 new pull requests need review', snippet: 'devon-okafor opened #482 · Aurora email client — three-pane layout…', time: '8:40 AM', unread: true, starred: false, attach: false, tag: 'Clients', tagColor: '#38BDF8', initials: 'GH', color: '#38BDF8', email: 'notifications@github.com', fullTime: 'Apr 25, 8:40 AM', participants: 1, count: 1, body: '<p>You have 3 pull requests awaiting review in <b>vireo/web</b>:</p><ul style="padding-inline-start:1.1rem;line-height:1.9;"><li>#482 — Aurora email client (three-pane layout)</li><li>#481 — Fix focus ring on segmented control</li><li>#479 — Dark-mode donut center label contrast</li></ul>' },
  { id: 3, from: 'Tomás Herrera', subject: 'Contract draft for the Q3 retainer', snippet: 'Attached the redlined version — the only open point is the SLA window…', time: 'Apr 24', unread: false, starred: true, attach: true, tag: 'Clients', tagColor: '#38BDF8', initials: 'TH', color: '#A78BFA', email: 'tomas@brightline.io', fullTime: 'Apr 24, 4:18 PM', participants: 2, count: 6, body: '<p>Hi — attached the redlined version of the retainer. The only open point is the SLA window in section 4.2; we proposed 8 business hours, your team had asked for 4.</p><p>Happy to jump on a call Friday to close it out.</p>' },
  { id: 4, from: 'Priya Nair', subject: 'Weekly analytics digest is ready', snippet: 'Sessions up 12.4% week over week. Mobile conversion finally crossed 3%…', time: 'Apr 24', unread: false, starred: false, attach: false, tag: '', tagColor: '', initials: 'PN', color: '#FBBF24', email: 'priya@vireo.app', fullTime: 'Apr 24, 11:02 AM', participants: 1, count: 1, body: '<p>Your weekly digest is ready. Highlights:</p><ul style="padding-inline-start:1.1rem;line-height:1.9;"><li>Sessions up <b>12.4%</b> week over week</li><li>Mobile conversion crossed <b>3%</b> for the first time</li><li>Top channel: organic search (27%)</li></ul>' },
  { id: 5, from: 'Stripe', subject: 'Your payout of $4,210.00 is on the way', snippet: 'A payout was initiated to your bank account ending in 7045…', time: 'Apr 23', unread: false, starred: false, attach: false, tag: 'Receipts', tagColor: '#FBBF24', initials: 'St', color: '#A78BFA', email: 'support@stripe.com', fullTime: 'Apr 23, 6:30 PM', participants: 1, count: 1, body: '<p>A payout of <b>$4,210.00</b> was initiated to your bank account ending in 7045. It should arrive within 1–2 business days.</p>' },
  { id: 6, from: 'Lena Brandt', subject: 'New empty-state illustrations uploaded', snippet: 'Dropped the dark + light variants into Figma — pinged you on the frame…', time: 'Apr 23', unread: false, starred: false, attach: false, tag: 'Personal', tagColor: '#A78BFA', initials: 'LB', color: '#F472B6', email: 'lena@studioform.de', fullTime: 'Apr 23, 2:11 PM', participants: 1, count: 2, body: '<p>Dropped the dark + light variants into Figma. Pinged you on the frame — let me know if the line weight reads OK against the glass surfaces.</p>' },
  { id: 7, from: 'Daniel Cho', subject: 'Lunch Thursday?', snippet: 'That new ramen place near the office opened. 12:30 work for you?', time: 'Apr 22', unread: false, starred: false, attach: false, tag: '', tagColor: '', initials: 'DC', color: '#FB7185', email: 'daniel@gmail.com', fullTime: 'Apr 22, 5:40 PM', participants: 1, count: 3, body: '<p>That new ramen place near the office finally opened. 12:30 Thursday work for you?</p>' },
];

export function Email() {
  const [messages, setMessages] = useState<Message[]>(SEED);
  const [folder, setFolder] = useState('inbox');
  const [label, setLabel] = useState('');
  const [activeId, setActiveId] = useState<number | null>(2);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const current = activeId ? messages.find((m) => m.id === activeId) ?? null : null;
  const open = (id: number) => { setActiveId(id); setQuoteOpen(false); setMessages((p) => p.map((m) => (m.id === id ? { ...m, unread: false } : m))); };
  const toggleAll = (on: boolean) => setSelected(on ? messages.map((m) => m.id) : []);
  const toggleSel = (id: number, on: boolean) => setSelected((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const toggleStar = (id: number) => setMessages((p) => p.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)));

  return (
    <div data-ax-route="apps/email" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PageHead
        title="Inbox"
        subtitle="6 unread messages across 4 mailboxes — last synced 2 minutes ago."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
              <span className="ax-btn__label">Refresh</span>
            </button>
            <Link className="ax-btn ax-btn--primary" href="/apps/email-compose">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>
              <span className="ax-btn__label">Compose</span>
            </Link>
          </>
        }
      />

      <div className="ax-card" role="region" aria-label="Email client" style={{ flex: '1 1 auto', minHeight: 600, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '240px 360px 1fr' }}>
        <aside aria-label="Mailbox folders" style={{ borderInlineEnd: '1px solid var(--ax-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 'var(--ax-space-5) var(--ax-space-5) var(--ax-space-3)' }}>
            <Link className="ax-btn ax-btn--primary ax-btn--block" href="/apps/email-compose">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
              <span className="ax-btn__label">Compose</span>
            </Link>
          </div>
          <nav className="ax-scroll-y" aria-label="Folders" style={{ flex: '1 1 auto', minHeight: 0, padding: '0 var(--ax-space-3) var(--ax-space-4)' }}>
            <ul className="ax-list ax-list--compact ax-list--selectable" style={{ gap: 2 }}>
              {FOLDERS.map((f) => (
                <li key={f.id}>
                  <button type="button" className={`ax-list__row ax-railrow${folder === f.id ? ' is-selected' : ''}`} onClick={() => setFolder(f.id)} aria-current={folder === f.id ? 'true' : 'false'} style={{ width: '100%', border: 0, borderRadius: 'var(--ax-radius-md)', textAlign: 'start', cursor: 'pointer' }}>
                    <span className="ax-list__leading" style={{ color: 'var(--ax-text-muted)' }}>{f.icon}</span>
                    <span className="ax-list__content"><span className="ax-list__title">{f.name}</span></span>
                    {!!f.count && <span className="ax-list__trailing ax-num" style={f.id === 'inbox' ? { color: 'var(--ax-accent)', fontWeight: 600 } : { color: 'var(--ax-text-subtle)' }}>{f.count}</span>}
                  </button>
                </li>
              ))}
            </ul>

            <hr className="ax-divider" style={{ margin: 'var(--ax-space-4) var(--ax-space-2)' }} />

            <p className="ax-list__group-label" style={{ paddingInline: 'var(--ax-space-3)' }}>Labels</p>
            <ul className="ax-list ax-list--compact ax-list--selectable" style={{ gap: 2 }}>
              {LABELS.map((l) => (
                <li key={l.name}>
                  <button type="button" className={`ax-list__row ax-railrow${label === l.name ? ' is-selected' : ''}`} onClick={() => setLabel(l.name)} style={{ width: '100%', border: 0, borderRadius: 'var(--ax-radius-md)', textAlign: 'start', cursor: 'pointer' }}>
                    <span className="ax-list__leading"><i style={{ width: 9, height: 9, borderRadius: 3, background: l.color, display: 'inline-block' }} /></span>
                    <span className="ax-list__content"><span className="ax-list__title">{l.name}</span></span>
                    <span className="ax-list__trailing ax-num" style={{ color: 'var(--ax-text-subtle)' }}>{l.count}</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="ax-list__row ax-railrow" style={{ width: '100%', border: 0, borderRadius: 'var(--ax-radius-md)', textAlign: 'start', cursor: 'pointer', color: 'var(--ax-text-muted)' }}>
                  <span className="ax-list__leading"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg></span>
                  <span className="ax-list__content"><span className="ax-list__title">New label</span></span>
                </button>
              </li>
            </ul>
          </nav>

          <div style={{ padding: 'var(--ax-space-4) var(--ax-space-5)', borderTop: '1px solid var(--ax-border)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <small style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Storage</small>
              <small className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>8.4 / 15 GB</small>
            </div>
            <div className="ax-progress ax-progress--xs"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '56%' }} /></div></div>
          </div>
        </aside>

        <section aria-label="Message list" style={{ borderInlineEnd: '1px solid var(--ax-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3) var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)', minHeight: 56 }}>
            {selected.length === 0 ? (
              <div className="ax-cluster" style={{ flex: '1 1 auto', gap: 'var(--ax-space-2)', flexWrap: 'nowrap' }}>
                <label className="ax-check" style={{ minHeight: 'auto' }} title="Select all">
                  <input type="checkbox" className="ax-checkbox" onChange={(e) => toggleAll(e.target.checked)} aria-label="Select all messages" />
                </label>
                <div className="ax-field__control" style={{ flex: '1 1 auto' }}>
                  <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
                  <input type="search" className="ax-input ax-input--sm ax-input--with-leading-icon" placeholder="Search mail…" aria-label="Search mail" />
                </div>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Sort messages">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4 -4l4 4m-4 -4v14" /><path d="M21 15l-4 4l-4 -4m4 4v-14" /></svg>
                </button>
              </div>
            ) : (
              <div className="ax-cluster" style={{ flex: '1 1 auto', gap: 'var(--ax-space-1)', flexWrap: 'nowrap' }}>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSelected([])} aria-label="Clear selection">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                </button>
                <b className="ax-num" style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)', marginInlineEnd: 'auto' }}>{selected.length} selected</b>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSelected([])} aria-label="Archive selected">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" /><path d="M10 12l4 0" /></svg>
                </button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSelected([])} aria-label="Delete selected">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                </button>
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setSelected([])} aria-label="Mark selected as read">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
                </button>
              </div>
            )}
          </div>

          <ul className="ax-scroll-y ax-list ax-list--selectable" style={{ flex: '1 1 auto', minHeight: 0, padding: 0 }}>
            {messages.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => open(m.id)} className={`ax-list__row ax-mailrow${activeId === m.id ? ' is-selected' : ''}`} style={{ position: 'relative', width: '100%', textAlign: 'start', display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 'var(--ax-space-3)', alignItems: 'start', padding: 'var(--ax-space-3) var(--ax-space-4)', border: 0, borderBottom: '1px solid var(--ax-border)', cursor: 'pointer' }}>
                  {activeId === m.id && <i aria-hidden="true" style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: 2, background: 'var(--ax-accent)' }} />}
                  <span onClick={(e) => e.stopPropagation()} className="ax-check" style={{ minHeight: 'auto', paddingTop: 2 }}>
                    <input type="checkbox" className="ax-checkbox" checked={selected.includes(m.id)} onChange={(e) => toggleSel(m.id, e.target.checked)} aria-label={`Select email from ${m.from}`} />
                  </span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); toggleStar(m.id); }} aria-label={m.starred ? 'Unstar' : 'Star'} aria-pressed={m.starred} style={{ border: 0, background: 'transparent', cursor: 'pointer', paddingTop: 1, lineHeight: 0, color: m.starred ? 'var(--ax-viz-amber)' : 'var(--ax-text-subtle)' }}>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill={m.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                  </button>
                  <span style={{ minWidth: 0 }}>
                    <span className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-2)' }}>
                      <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap', minWidth: 0 }}>
                        {m.unread && <i aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ax-accent)', flex: '0 0 auto' }} />}
                        <span className="ax-text-truncate" style={m.unread ? { fontWeight: 600, color: 'var(--ax-text-strong)' } : { fontWeight: 450, color: 'var(--ax-text)' }}>{m.from}</span>
                      </span>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', flex: '0 0 auto' }}>{m.time}</span>
                    </span>
                    <span className="ax-text-truncate" style={{ display: 'block', marginTop: 1, ...(m.unread ? { fontWeight: 500, color: 'var(--ax-text-strong)' } : { color: 'var(--ax-text)' }) }}>{m.subject}</span>
                    <span className="ax-text-truncate" style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{m.snippet}</span>
                    {(m.attach || m.tag) && (
                      <span className="ax-cluster" style={{ gap: 6, marginTop: 5 }}>
                        {m.tag && <span className="ax-badge ax-badge--soft ax-badge--sm" style={{ color: m.tagColor }}><span className="ax-badge__dot" style={{ background: m.tagColor }} /><span>{m.tag}</span></span>}
                        {m.attach && <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--ax-text-subtle)' }}><path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" /></svg>}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Reading pane" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!current ? (
            <div className="ax-flex" style={{ flex: '1 1 auto', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--ax-space-3)', color: 'var(--ax-text-subtle)', textAlign: 'center', padding: 'var(--ax-space-8)' }}>
              <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: 'var(--ax-fill-hover)', color: 'var(--ax-text-subtle)' }}>
                <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
              </span>
              <div><b style={{ display: 'block', color: 'var(--ax-text)', fontSize: 'var(--ax-text-md)' }}>Select a message to read</b><span style={{ fontSize: 'var(--ax-text-sm)' }}>Nothing is open — pick a conversation from the list.</span></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}>
              <div style={{ padding: 'var(--ax-space-5) var(--ax-space-6)', borderBottom: '1px solid var(--ax-border)' }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--ax-space-3)' }}>
                  <h2 className="ax-card__title" style={{ fontSize: 'var(--ax-text-lg)' }}>{current.subject}</h2>
                  <div className="ax-cluster" style={{ gap: 2, flexWrap: 'nowrap', flex: '0 0 auto' }}>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" style={current.starred ? { color: 'var(--ax-viz-amber)' } : undefined} onClick={() => toggleStar(current.id)} aria-label="Star thread">
                      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill={current.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                    </button>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Archive thread">
                      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" /><path d="M10 12l4 0" /></svg>
                    </button>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="More actions">
                      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
                    </button>
                  </div>
                </div>
                <div className="ax-cluster" style={{ gap: 6, marginTop: 'var(--ax-space-3)' }}>
                  {current.tag && <span className="ax-badge ax-badge--soft ax-badge--sm" style={{ color: current.tagColor }}><span className="ax-badge__dot" style={{ background: current.tagColor }} /><span>{current.tag}</span></span>}
                  <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{current.participants} participants · {current.count} messages</span>
                </div>
              </div>

              <div className="ax-scroll-y" style={{ flex: '1 1 auto', minHeight: 0, padding: 'var(--ax-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <button type="button" onClick={() => setQuoteOpen((o) => !o)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={quoteOpen ? { transform: 'rotate(90deg)' } : undefined}><path d="M9 6l6 6l-6 6" /></svg>
                  <span>{quoteOpen ? 'Hide earlier message' : 'Show 1 earlier message'}</span>
                </button>
                {quoteOpen && (
                  <div style={{ borderInlineStart: '2px solid var(--ax-border-strong)', paddingInlineStart: 'var(--ax-space-4)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 var(--ax-space-2)' }}><b style={{ color: 'var(--ax-text)' }}>Maya — Apr 24, 9:02 AM</b></p>
                    <p style={{ margin: 0 }}>Hey team, attaching the revised figures from finance. Let me know if the Q3 forecast needs another pass before we present on Thursday.</p>
                  </div>
                )}

                <article style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${current.color} 18%,transparent)`, color: current.color }}><b>{current.initials}</b></span>
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-2)' }}>
                        <b style={{ color: 'var(--ax-text-strong)' }}>{current.from}</b>
                        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{current.fullTime}</span>
                      </div>
                      <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>to me · {current.email}</span>
                    </div>
                  </div>
                  <div style={{ color: 'var(--ax-text)', lineHeight: 1.7, fontSize: 'var(--ax-text-sm)' }} dangerouslySetInnerHTML={{ __html: current.body }} />

                  {current.attach && (
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-surface-subtle)', minWidth: 200 }}>
                        <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                        <div style={{ minWidth: 0 }}><div className="ax-text-truncate" style={{ fontWeight: 500, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Q3-Forecast.xlsx</div><div className="ax-num" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>248 KB · Spreadsheet</div></div>
                      </div>
                    </div>
                  )}
                </article>
              </div>

              <div style={{ display: 'flex', gap: 'var(--ax-space-2)', padding: 'var(--ax-space-4) var(--ax-space-6)', borderTop: '1px solid var(--ax-border)' }}>
                <button type="button" className="ax-btn ax-btn--secondary">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 18v-6a3 3 0 0 0 -3 -3h-10l4 -4m0 8l-4 -4" /></svg>
                  <span className="ax-btn__label">Reply</span>
                </button>
                <button type="button" className="ax-btn ax-btn--ghost">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 18v-6a3 3 0 0 0 -3 -3h-5l4 -4m0 8l-4 -4" /><path d="M16 18v-6a3 3 0 0 0 -3 -3h-1" /></svg>
                  <span className="ax-btn__label">Reply all</span>
                </button>
                <button type="button" className="ax-btn ax-btn--ghost">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 18v-6a3 3 0 0 1 3 -3h10l-4 -4m0 8l4 -4" /></svg>
                  <span className="ax-btn__label">Forward</span>
                </button>
                <span style={{ flex: '1 1 auto' }} />
                <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Snooze">
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 7v5l3 3" /></svg>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <style>{`
        [data-ax-route="apps/email"] .ax-mailrow { background: transparent; }
        [data-ax-route="apps/email"] .ax-mailrow:hover { background: var(--ax-fill-hover); }
        [data-ax-route="apps/email"] .ax-mailrow.is-selected { background: var(--ax-accent-wash); }
        [data-ax-route="apps/email"] .ax-railrow { background: transparent; }
        @media (max-width: 1280px) {
          [data-ax-route="apps/email"] .ax-card[aria-label="Email client"] { grid-template-columns: 220px 1fr; }
          [data-ax-route="apps/email"] section[aria-label="Reading pane"] { display: none; }
        }
        @media (max-width: 768px) {
          [data-ax-route="apps/email"] .ax-card[aria-label="Email client"] { grid-template-columns: 1fr; }
          [data-ax-route="apps/email"] aside[aria-label="Mailbox folders"] { display: none; }
        }
      `}</style>
    </div>
  );
}

export default Email;
