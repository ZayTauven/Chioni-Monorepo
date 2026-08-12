'use client';
/*
 * Vireo Next.js — Chat app (apps/chat).
 * Faithful re-expression of src/html/apps/chat.html: conversation list (search +
 * filter segment), message thread with bubbles + typing indicator + info drawer,
 * and an auto-growing composer. Alpine axChat() → React useState/useRef.
 */
import { useEffect, useRef, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

interface Msg { out: boolean; showAvatar?: boolean; read?: boolean; text: string; time: string }
interface Conv {
  id: number; name: string; initials: string; color: string; presence: string;
  group: boolean; role: string; preview: string; time: string; unread: number;
  typing: boolean; messages: Msg[];
}

const SEED: Conv[] = [
  { id: 1, name: 'Devon Okafor', initials: 'DO', color: '#34D399', presence: 'online', group: false, role: 'Engineering Lead', preview: 'Pushed the fix — can you re-run CI?', time: '9:41 AM', unread: 2, typing: false, messages: [
    { out: false, showAvatar: true, text: 'Morning! Did the deploy go through last night?', time: '9:32 AM' },
    { out: true, read: true, text: 'Yep — went out at 11pm, all green. 🎉', time: '9:34 AM' },
    { out: false, showAvatar: true, text: 'Nice. One thing — the segmented control loses its focus ring in dark mode.', time: '9:38 AM' },
    { out: true, read: true, text: 'Good catch. I\'ll patch it this morning and push to <b>#481</b>.', time: '9:39 AM' },
    { out: false, showAvatar: false, text: 'Pushed the fix — can you re-run CI?', time: '9:41 AM' },
  ] },
  { id: 2, name: 'Design Crew', initials: 'DC', color: '#A78BFA', presence: 'online', group: true, role: '5 members', preview: 'Lena: dropped the new empty states', time: '9:10 AM', unread: 1, typing: true, messages: [
    { out: false, showAvatar: true, text: 'Dropped the new empty-state illustrations in Figma.', time: '9:08 AM' },
    { out: true, read: true, text: 'These look great against the glass surfaces 👏', time: '9:10 AM' },
  ] },
  { id: 3, name: 'Priya Nair', initials: 'PN', color: '#FBBF24', presence: 'away', group: false, role: 'Data Analyst', preview: 'You: sent the weekly digest', time: 'Yes', unread: 0, typing: false, messages: [
    { out: false, showAvatar: true, text: 'Can you forward last week\'s digest?', time: 'Mon' },
    { out: true, read: true, text: 'Sent the weekly digest 📊', time: 'Mon' },
  ] },
  { id: 4, name: 'Tomás Herrera', initials: 'TH', color: '#38BDF8', presence: 'offline', group: false, role: 'Client · Brightline', preview: 'Thanks, talk Friday', time: 'Tue', unread: 0, typing: false, messages: [
    { out: false, showAvatar: true, text: 'Sent over the redlined contract.', time: 'Tue' },
    { out: true, read: true, text: 'Got it — will review and circle back.', time: 'Tue' },
    { out: false, showAvatar: false, text: 'Thanks, talk Friday 👍', time: 'Tue' },
  ] },
  { id: 5, name: 'Marketing', initials: 'Mk', color: '#F472B6', presence: 'online', group: true, role: '8 members', preview: 'Ava: campaign goes live at noon', time: 'Tue', unread: 1, typing: false, messages: [
    { out: false, showAvatar: true, text: 'Campaign goes live at noon — final assets approved.', time: 'Tue' },
  ] },
  { id: 6, name: 'Daniel Cho', initials: 'DC', color: '#FB7185', presence: 'offline', group: false, role: 'Product Manager', preview: '12:30 works for ramen 🍜', time: 'Mon', unread: 0, typing: false, messages: [
    { out: false, showAvatar: true, text: '12:30 works for ramen 🍜', time: 'Mon' },
  ] },
];

export function Chat() {
  const [conversations, setConversations] = useState<Conv[]>(SEED);
  const [active, setActive] = useState(1);
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState('');
  const [drawer, setDrawer] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const filtered = (() => {
    let list = conversations;
    if (filter === 'Unread') list = list.filter((c) => c.unread);
    if (filter === 'Groups') list = list.filter((c) => c.group);
    if (q.trim()) list = list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    return list;
  })();
  const conv = conversations.find((c) => c.id === active) || conversations[0];

  const scrollDown = () => { const s = scrollRef.current; if (s) s.scrollTop = s.scrollHeight; };
  useEffect(() => { scrollDown(); }, [active, conv.messages.length]);

  const open = (id: number) => { setActive(id); setConversations((p) => p.map((c) => (c.id === id ? { ...c, unread: 0 } : c))); };
  const sendMsg = () => {
    const t = draft.trim(); if (!t) return;
    const newMsg: Msg = { out: true, read: false, text: t.replace(/</g, '&lt;'), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setConversations((p) => p.map((c) => (c.id === active ? { ...c, messages: [...c.messages, newMsg] } : c)));
    setDraft('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setTimeout(() => {
      setConversations((p) => p.map((c) => {
        if (c.id !== active) return c;
        const msgs = [...c.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.out) msgs[msgs.length - 1] = { ...last, read: true };
        return { ...c, messages: msgs };
      }));
    }, 1200);
  };

  return (
    <div data-ax-route="apps/chat" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <PageHead
        title="Chat"
        subtitle="4 unread conversations — 7 teammates online right now."
        actions={
          <>
            <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" /></svg>
              <span className="ax-btn__label">New group</span>
            </button>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg>
              <span className="ax-btn__label">New message</span>
            </button>
          </>
        }
      />

      <div className="ax-card" role="region" aria-label="Chat workspace" style={{ flex: '1 1 auto', minHeight: 600, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '320px 1fr' }}>
        <aside aria-label="Conversations" style={{ borderInlineEnd: '1px solid var(--ax-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 'var(--ax-space-4)', borderBottom: '1px solid var(--ax-border)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-field__control">
              <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
              <input type="search" className="ax-input ax-input--sm ax-input--with-leading-icon" placeholder="Search conversations…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" />
            </div>
            <div className="ax-segment" role="tablist" aria-label="Filter conversations" style={{ width: '100%' }}>
              {['All', 'Unread', 'Groups'].map((f) => (
                <button key={f} type="button" role="tab" className="ax-segment__option" style={{ flex: '1 1 0' }} aria-checked={filter === f} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
          </div>

          <ul className="ax-scroll-y ax-list" style={{ flex: '1 1 auto', minHeight: 0, padding: 'var(--ax-space-2)', gap: 2 }}>
            {filtered.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => open(c.id)} className={`ax-list__row ax-chatrow${active === c.id ? ' is-selected' : ''}`} style={{ position: 'relative', width: '100%', textAlign: 'start', border: 0, borderRadius: 'var(--ax-radius-md)', cursor: 'pointer', gap: 'var(--ax-space-3)', alignItems: 'center', padding: 'var(--ax-space-3)' }}>
                  {active === c.id && <i aria-hidden="true" style={{ position: 'absolute', insetBlock: 6, insetInlineStart: 0, width: 2, borderRadius: 2, background: 'var(--ax-accent)' }} />}
                  <span className="ax-list__leading" style={{ position: 'relative', flex: '0 0 auto' }}>
                    <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c.color} 18%,transparent)`, color: c.color }}>
                      {!c.group ? <b>{c.initials}</b> : <svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1" /><path d="M15 5a2 2 0 1 0 0 4" /><path d="M17 10h2a2 2 0 0 1 2 2v1" /><path d="M9 5a2 2 0 1 1 0 4" /><path d="M3 13v-1a2 2 0 0 1 2 -2h2" /></svg>}
                    </span>
                    {!c.group && <span className={`ax-avatar__status ax-avatar__status--${c.presence}`} style={{ insetBlockEnd: -1, insetInlineEnd: -1, boxShadow: '0 0 0 2px var(--ax-surface)' }} />}
                  </span>
                  <span className="ax-list__content" style={{ minWidth: 0 }}>
                    <span className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-2)' }}>
                      <span className="ax-text-truncate ax-list__title" style={c.unread ? { fontWeight: 600, color: 'var(--ax-text-strong)' } : undefined}>{c.name}</span>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', flex: '0 0 auto' }}>{c.time}</span>
                    </span>
                    <span className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-2)', marginTop: 2 }}>
                      <span className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', ...(c.typing ? { color: 'var(--ax-accent)', fontStyle: 'italic' } : { color: 'var(--ax-text-subtle)' }) }}>{c.typing ? 'typing…' : c.preview}</span>
                      {!!c.unread && <span className="ax-num" style={{ flex: '0 0 auto', minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ax-accent)', color: 'var(--ax-on-accent)', borderRadius: 999, fontSize: 'var(--ax-text-2xs)', fontWeight: 600 }}>{c.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section aria-label="Conversation" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--ax-canvas)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-5)', borderBottom: '1px solid var(--ax-border)', background: 'var(--ax-surface)', minHeight: 64, flex: '0 0 auto' }}>
            <span style={{ position: 'relative', flex: '0 0 auto' }}>
              <span className="ax-avatar ax-avatar--md ax-avatar--squircle" style={{ background: `color-mix(in oklab,${conv.color} 18%,transparent)`, color: conv.color }}><b>{conv.initials}</b></span>
              <span className={`ax-avatar__status ax-avatar__status--${conv.presence}`} style={{ insetBlockEnd: -1, insetInlineEnd: -1, boxShadow: '0 0 0 2px var(--ax-surface)' }} />
            </span>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="ax-text-truncate" style={{ fontWeight: 600, color: 'var(--ax-text-strong)' }}>{conv.name}</div>
              <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{conv.presence === 'online' ? 'Active now' : conv.presence === 'away' ? 'Away' : 'Last seen 2h ago'}</div>
            </div>
            <div className="ax-cluster" style={{ gap: 2, flex: '0 0 auto', flexWrap: 'nowrap' }}>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Start voice call"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></button>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Start video call"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4" /><path d="M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8" /></svg></button>
              <button type="button" className={`ax-btn ax-btn--ghost ax-btn--icon${drawer ? ' is-selected' : ''}`} onClick={() => setDrawer((d) => !d)} aria-label="Conversation info"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg></button>
            </div>
          </div>

          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'grid', gridTemplateColumns: drawer ? '1fr 280px' : '1fr' }}>
            <div className="ax-scroll-y" ref={scrollRef} style={{ minHeight: 0, padding: 'var(--ax-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'center', margin: 'var(--ax-space-2) 0' }}>
                <span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 999, padding: '3px 12px' }}>Today</span>
              </div>

              {conv.messages.map((m, i) => (
                <div key={i} style={m.out ? { alignSelf: 'flex-end', maxWidth: '74%' } : { alignSelf: 'flex-start', maxWidth: '74%', display: 'flex', gap: 'var(--ax-space-2)' }}>
                  {!m.out && m.showAvatar && <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ flex: '0 0 auto', alignSelf: 'flex-end', background: `color-mix(in oklab,${conv.color} 18%,transparent)`, color: conv.color }}><b style={{ fontSize: 10 }}>{conv.initials}</b></span>}
                  {!m.out && !m.showAvatar && <span style={{ width: 28, flex: '0 0 auto' }} aria-hidden="true" />}
                  <div>
                    <div style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.55, position: 'relative', ...(m.out ? { background: 'var(--ax-accent-wash)', color: 'var(--ax-text-strong)', border: '1px solid color-mix(in oklab,var(--ax-accent) 28%,transparent)', borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) var(--ax-radius-xs) var(--ax-radius-md)' } : { background: 'var(--ax-surface)', color: 'var(--ax-text)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md) var(--ax-radius-md) var(--ax-radius-md) var(--ax-radius-xs)' }) }} dangerouslySetInnerHTML={{ __html: m.text }} />
                    <div className="ax-cluster" style={{ gap: 5, marginTop: 3, paddingInline: 'var(--ax-space-2)', ...(m.out ? { justifyContent: 'flex-end' } : {}) }}>
                      <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{m.time}</span>
                      {m.out && <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke={m.read ? 'var(--ax-accent)' : 'var(--ax-text-subtle)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 12l5 5l10 -10" /><path d="M2 12l5 5m5 -5l5 -5" /></svg>}
                    </div>
                  </div>
                </div>
              ))}

              {conv.presence === 'online' && (
                <div className="ax-flex" style={{ alignSelf: 'flex-start', gap: 'var(--ax-space-2)', alignItems: 'flex-end' }}>
                  <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${conv.color} 18%,transparent)`, color: conv.color }}><b style={{ fontSize: 10 }}>{conv.initials}</b></span>
                  <div style={{ background: 'var(--ax-surface)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', padding: 'var(--ax-space-3) var(--ax-space-4)', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span className="ax-chat-dot" aria-hidden="true" /><span className="ax-chat-dot" aria-hidden="true" /><span className="ax-chat-dot" aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>

            {drawer && (
              <div className="ax-scroll-y ax-flex" style={{ borderInlineStart: '1px solid var(--ax-border)', background: 'var(--ax-surface)', minHeight: 0, padding: 'var(--ax-space-5)', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
                  <span className="ax-avatar ax-avatar--xl ax-avatar--squircle" style={{ background: `color-mix(in oklab,${conv.color} 18%,transparent)`, color: conv.color }}><b style={{ fontSize: 'var(--ax-text-lg)' }}>{conv.initials}</b></span>
                  <div><b style={{ color: 'var(--ax-text-strong)' }}>{conv.name}</b><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{conv.role}</div></div>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-2)' }}>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" aria-label="Email"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></button>
                    <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--icon" aria-label="Call"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></button>
                  </div>
                </div>
                <div>
                  <p className="ax-list__group-label" style={{ padding: '0 0 var(--ax-space-2)' }}>Shared media</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {['#34D399', '#38BDF8', '#A78BFA', '#FBBF24', '#F472B6', '#FB7185'].map((g) => (
                      <span key={g} style={{ aspectRatio: '1', borderRadius: 'var(--ax-radius-md)', background: `color-mix(in oklab,${g} 22%,var(--ax-surface-subtle))` }} aria-hidden="true" />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Mute notifications</span><input type="checkbox" className="ax-switch ax-switch--sm" role="switch" aria-label="Mute notifications" /></div>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between' }}><span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Pin conversation</span><input type="checkbox" className="ax-switch ax-switch--sm" role="switch" defaultChecked aria-label="Pin conversation" /></div>
                </div>
                <button type="button" className="ax-btn ax-btn--soft-danger ax-btn--block ax-btn--sm">Block &amp; report</button>
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sendMsg(); }} style={{ flex: '0 0 auto', padding: 'var(--ax-space-3) var(--ax-space-5)', borderTop: '1px solid var(--ax-border)', background: 'var(--ax-surface)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexWrap: 'nowrap', alignItems: 'flex-end' }}>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Attach file"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" /></svg></button>
              <label htmlFor="composer" className="ax-visually-hidden">Message</label>
              <textarea id="composer" ref={taRef} rows={1} className="ax-textarea" value={draft}
                onChange={(e) => { setDraft(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                placeholder="Write a message…  (Enter to send, Shift+Enter for newline)"
                style={{ flex: '1 1 auto', minHeight: 40, maxHeight: 140, resize: 'none', lineHeight: 1.5 }} />
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Insert emoji"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10l.01 0" /><path d="M15 10l.01 0" /><path d="M9.5 15a3.5 3.5 0 0 0 5 0" /></svg></button>
              <button type="submit" className="ax-btn ax-btn--primary ax-btn--icon" disabled={!draft.trim()} aria-label="Send message">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" /></svg>
              </button>
            </div>
          </form>
        </section>
      </div>

      <style>{`
        [data-ax-route="apps/chat"] .ax-chatrow { background: transparent; }
        [data-ax-route="apps/chat"] .ax-chatrow:hover { background: var(--ax-fill-hover); }
        [data-ax-route="apps/chat"] .ax-chatrow.is-selected { background: var(--ax-accent-wash); }
        .ax-chat-dot { width:6px;height:6px;border-radius:50%;background:var(--ax-text-subtle);animation:ax-chat-bounce 1.2s infinite ease-in-out; }
        .ax-chat-dot:nth-child(2){ animation-delay:.2s; } .ax-chat-dot:nth-child(3){ animation-delay:.4s; }
        @keyframes ax-chat-bounce { 0%,60%,100%{ transform:translateY(0);opacity:.5; } 30%{ transform:translateY(-4px);opacity:1; } }
        @media (prefers-reduced-motion: reduce) { .ax-chat-dot { animation:none; } }
        @media (max-width: 992px) {
          [data-ax-route="apps/chat"] .ax-card[aria-label="Chat workspace"] { grid-template-columns: 1fr; }
          [data-ax-route="apps/chat"] aside[aria-label="Conversations"] { display: none; }
        }
      `}</style>
    </div>
  );
}

export default Chat;
