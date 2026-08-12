'use client';
/*
 * Vireo React — Activity Log (route "pages/activity-log").
 *
 * Faithful re-expression of src/html/pages/activity-log.html: a filter bar with
 * search, date/actor selects and event-type chips, plus a Today / Yesterday /
 * Earlier audit timeline with two expandable diff entries. Alpine `type`/`q`/
 * `chips`/`open` ported to React state. DOM classes / ARIA / copy match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

type EventType = 'all' | 'auth' | 'settings' | 'billing' | 'security' | 'data';

const TYPE_CHIPS: { key: EventType; label: string }[] = [
  { key: 'all', label: 'All events' },
  { key: 'auth', label: 'Sign-in' },
  { key: 'settings', label: 'Settings' },
  { key: 'billing', label: 'Billing' },
  { key: 'security', label: 'Security' },
  { key: 'data', label: 'Data' },
];

const CHEV = (open: boolean) => (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={open ? { transform: 'rotate(180deg)' } : undefined}><path d="M6 9l6 6l6 -6" /></svg>
);
const SECTION_HEAD: React.CSSProperties = { fontSize: 'var(--ax-text-xs)', fontWeight: 'var(--ax-weight-semibold)', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ax-text-subtle)' };
const TIME: React.CSSProperties = { fontFamily: 'var(--ax-font-mono)' };

export function ActivityLog() {
  const [type, setType] = useState<EventType>('all');
  const [q, setQ] = useState('');
  const [chips, setChips] = useState<{ k: string; label: string }[]>([
    { k: 'range', label: 'Last 30 days' },
    { k: 'actor', label: 'All actors' },
  ]);
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);

  const show = (...ts: EventType[]) => ts.includes(type);

  return (
    <>
      <PageHead
        title="Activity Log"
        subtitle="A complete audit trail of account and workspace events."
        actions={
          <button type="button" className="ax-btn ax-btn--ghost">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg>
            <span className="ax-btn__label">Export CSV</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {/* FILTER BAR */}
        <section className="ax-card ax-col--12" role="region" aria-label="Filters">
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                <svg style={{ position: 'absolute', left: 'var(--ax-space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--ax-text-subtle)' }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 0 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                <input type="search" className="ax-input" placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" style={{ paddingInlineStart: 'var(--ax-space-8)' }} />
              </div>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /></svg>
                <span className="ax-btn__label">Last 30 days</span>
                <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
              </button>
              <select className="ax-select" aria-label="Filter by actor" style={{ maxWidth: 180 }}><option>All actors</option><option>Maya Albright</option><option>Devon Okafor</option><option>System</option></select>
            </div>
            {/* event-type multi-select as filter chips */}
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }} role="group" aria-label="Event types">
              {TYPE_CHIPS.map((c) => (
                <button key={c.key} type="button" className={`ax-badge ax-badge--filter ax-badge--pill${type === c.key ? ' is-selected' : ''}`} aria-pressed={type === c.key} onClick={() => setType(c.key)}>{c.label}</button>
              ))}
            </div>
            {/* active filter chips + clear */}
            {(chips.length > 0 || type !== 'all') && (
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Active:</span>
                {chips.map((c) => (
                  <span key={c.k} className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">{c.label}<button type="button" className="ax-badge__remove" aria-label={`Remove ${c.label}`} onClick={() => setChips((cs) => cs.filter((x) => x.k !== c.k))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button></span>
                ))}
                <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => { setChips([]); setType('all'); setQ(''); }}>Clear all</button>
              </div>
            )}
          </div>
        </section>

        {/* TIMELINE FEED */}
        <section className="ax-card ax-col--12" role="region" aria-label="Activity feed">
          <div className="ax-card__body" style={{ paddingTop: 'var(--ax-space-5)' }}>

            {/* TODAY */}
            <div style={{ ...SECTION_HEAD, marginBottom: 'var(--ax-space-3)' }}>Today · Jun 27</div>
            <ol className="ax-timeline" style={{ listStyle: 'none' }}>
              {show('all', 'security') && (
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-warning-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M12 12l0 2.5" /></svg></span>
                  <div className="ax-timeline__content">
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Maya Albright</b> changed a member role <span className="ax-badge ax-badge--soft ax-badge--warning ax-badge--pill">Security</span></p>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-expanded={open1} aria-controls="diff-1" onClick={() => setOpen1((o) => !o)} aria-label="Toggle details">{CHEV(open1)}</button>
                    </div>
                    <span className="ax-timeline__time ax-num" style={TIME}>11:24 · 84.91.12.4 · macOS</span>
                    {open1 && (
                      <div id="diff-1" style={{ marginTop: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', overflow: 'hidden' }}>
                        <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-3)', background: 'var(--ax-surface-subtle)', fontSize: 'var(--ax-text-xs)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Member</span><span style={{ color: 'var(--ax-text)' }}>Henry Whitlock</span></div>
                        <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-3)', fontSize: 'var(--ax-text-xs)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Role</span><span className="ax-num" style={TIME}><span style={{ color: 'var(--ax-danger-500)', textDecoration: 'line-through' }}>Editor</span> → <span style={{ color: 'var(--ax-success-500)' }}>Admin</span></span></div>
                      </div>
                    )}
                  </div>
                </li>
              )}
              {show('all', 'billing') && (
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Maya Albright</b> added a payment method <span style={{ color: 'var(--ax-text)' }}>Visa ••4921</span> <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Billing</span></p><span className="ax-timeline__time ax-num" style={TIME}>10:08 · 84.91.12.4</span></div>
                </li>
              )}
              {show('all', 'settings') && (
                <li className="ax-timeline__item ax-timeline__item--success">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Devon Okafor</b> enabled <span style={{ color: 'var(--ax-text)' }}>weekly digest</span> emails <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Settings</span></p><span className="ax-timeline__time ax-num" style={TIME}>09:31 · 88.22.4.10</span></div>
                </li>
              )}
            </ol>

            {/* YESTERDAY */}
            <div style={{ ...SECTION_HEAD, margin: 'var(--ax-space-5) 0 var(--ax-space-3)' }}>Yesterday · Jun 26</div>
            <ol className="ax-timeline" style={{ listStyle: 'none' }}>
              {show('all', 'auth') && (
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Maya Albright</b> signed in from <span style={{ color: 'var(--ax-text)' }}>Lisbon, Portugal</span> <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Sign-in</span></p><span className="ax-timeline__time ax-num" style={TIME}>18:47 · Chrome 126 · 84.91.12.4</span></div>
                </li>
              )}
              {show('all', 'settings') && (
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg></span>
                  <div className="ax-timeline__content">
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Maya Albright</b> updated workspace name <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Settings</span></p>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-expanded={open2} aria-controls="diff-2" onClick={() => setOpen2((o) => !o)} aria-label="Toggle details">{CHEV(open2)}</button>
                    </div>
                    <span className="ax-timeline__time ax-num" style={TIME}>16:02 · 84.91.12.4</span>
                    {open2 && (
                      <div id="diff-2" style={{ marginTop: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', overflow: 'hidden' }}>
                        <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-2) var(--ax-space-3)', fontSize: 'var(--ax-text-xs)' }}><span style={{ color: 'var(--ax-text-muted)' }}>Workspace</span><span className="ax-num" style={TIME}><span style={{ color: 'var(--ax-danger-500)', textDecoration: 'line-through' }}>Northwind</span> → <span style={{ color: 'var(--ax-success-500)' }}>Northwind Studio</span></span></div>
                      </div>
                    )}
                  </div>
                </li>
              )}
              {show('all', 'auth', 'security') && (
                <li className="ax-timeline__item ax-timeline__item--danger">
                  <span className="ax-timeline__marker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title">Failed sign-in attempt for <b style={{ color: 'var(--ax-text-strong)' }}>maya.albright</b> <span className="ax-badge ax-badge--soft ax-badge--danger ax-badge--pill">Security</span></p><span className="ax-timeline__time ax-num" style={TIME}>03:11 · 45.12.88.201 · unknown</span></div>
                </li>
              )}
            </ol>

            {/* EARLIER */}
            <div style={{ ...SECTION_HEAD, margin: 'var(--ax-space-5) 0 var(--ax-space-3)' }}>Earlier · Jun 24</div>
            <ol className="ax-timeline" style={{ listStyle: 'none' }}>
              {show('all', 'data') && (
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 13l2 2l4 -4" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title"><b style={{ color: 'var(--ax-text-strong)' }}>Priya Nair</b> exported <span style={{ color: 'var(--ax-text)' }}>Q2 analytics report</span> <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Data</span></p><span className="ax-timeline__time ax-num" style={TIME}>Jun 24 · 14:20</span></div>
                </li>
              )}
              {show('all', 'billing') && (
                <li className="ax-timeline__item">
                  <span className="ax-timeline__marker" style={{ color: 'var(--ax-viz-amber)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" /><path d="M12 3v3m0 12v3" /></svg></span>
                  <div className="ax-timeline__content"><p className="ax-timeline__title">Invoice <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-accent)' }}>INV-2026-0614</span> was paid · <b className="ax-num" style={TIME}>$48.00</b> <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Billing</span></p><span className="ax-timeline__time ax-num" style={TIME}>Jun 24 · 09:00</span></div>
                </li>
              )}
            </ol>

            {/* load more */}
            <div className="ax-cluster" style={{ justifyContent: 'center', marginTop: 'var(--ax-space-5)' }}>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--pill">Load older events</button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default ActivityLog;
