'use client';
/*
 * Vireo Next.js — Pages / Team (route "pages/team").
 *
 * Faithful re-expression of src/html/pages/team.html: a searchable, filterable
 * member directory with grid/list views, an invite modal (with a sent alert) and
 * a filtered-empty state. The Alpine x-data (members, filters, invite/sent) is
 * ported to React state + useFocusTrap for the dialog. DOM/classes/ARIA match
 * the reference 1:1.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface Member { id: number; name: string; role: string; dept: string; init: string; tint: string; status: Status; email: string; }
type Status = 'online' | 'away' | 'busy' | 'offline';

const MEMBERS: Member[] = [
  { id: 1, name: 'Maya Albright', role: 'Owner', dept: 'Design', init: 'MA', tint: 'var(--ax-accent)', status: 'online', email: 'maya@northwind.io' },
  { id: 2, name: 'Devon Okafor', role: 'Admin', dept: 'Engineering', init: 'DK', tint: 'var(--ax-viz-cyan)', status: 'online', email: 'devon@northwind.io' },
  { id: 3, name: 'Lena Brandt', role: 'Editor', dept: 'Design', init: 'LB', tint: 'var(--ax-viz-violet)', status: 'away', email: 'lena@northwind.io' },
  { id: 4, name: 'Tomás Herrera', role: 'Admin', dept: 'Product', init: 'TH', tint: 'var(--ax-viz-amber)', status: 'online', email: 'tomas@northwind.io' },
  { id: 5, name: 'Priya Nair', role: 'Editor', dept: 'Analytics', init: 'PN', tint: 'var(--ax-viz-emerald)', status: 'busy', email: 'priya@northwind.io' },
  { id: 6, name: 'Ava Sutton', role: 'Viewer', dept: 'Product', init: 'AS', tint: 'var(--ax-viz-pink)', status: 'offline', email: 'ava@northwind.io' },
  { id: 7, name: 'Henry Whitlock', role: 'Editor', dept: 'Engineering', init: 'HW', tint: 'var(--ax-viz-cyan)', status: 'online', email: 'henry@northwind.io' },
  { id: 8, name: 'Camila Rossi', role: 'Viewer', dept: 'Analytics', init: 'CR', tint: 'var(--ax-viz-violet)', status: 'away', email: 'camila@northwind.io' },
];

const statusColor: Record<Status, string> = { online: 'var(--ax-viz-emerald)', away: 'var(--ax-viz-amber)', busy: 'var(--ax-viz-red)', offline: 'var(--ax-text-subtle)' };
const statusLabel: Record<Status, string> = { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline' };

const ICON_DOTS = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg>
);
const ICON_MSG = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" /></svg>
);

export function Team() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [dept, setDept] = useState('all');
  const [q, setQ] = useState('');
  const [invite, setInvite] = useState(false);
  const [sent, setSent] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, invite);

  // Escape closes the invite dialog (matches @keydown.escape.window).
  useEffect(() => {
    if (!invite) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInvite(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invite]);

  const filtered = useMemo(
    () => MEMBERS.filter((m) => (dept === 'all' || m.dept === dept) && (q === '' || (m.name + m.role + m.dept).toLowerCase().includes(q.toLowerCase()))),
    [dept, q],
  );

  const openInvite = () => { setInvite(true); setSent(false); };

  return (
    <>
      <PageHead
        title="Team"
        subtitle={`${MEMBERS.length} members across 4 departments.`}
        actions={
          <button type="button" className="ax-btn ax-btn--primary" onClick={openInvite}>
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M16 19h6" /><path d="M19 16v6" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4" /></svg>
            <span className="ax-btn__label">Invite member</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {/* Toolbar */}
        <section className="ax-card ax-col--12" role="region" aria-label="Team toolbar">
          <div className="ax-card__body">
            <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'wrap', flex: '1 1 auto' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180, maxWidth: 320 }}>
                  <svg style={{ position: 'absolute', left: 'var(--ax-space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--ax-text-subtle)' }} width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 0 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
                  <input type="search" className="ax-input" placeholder="Search members…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" style={{ paddingInlineStart: 'var(--ax-space-8)' }} />
                </div>
                <select className="ax-select" aria-label="Filter by department" value={dept} onChange={(e) => setDept(e.target.value)} style={{ maxWidth: 180 }}>
                  <option value="all">All departments</option>
                  <option value="Design">Design</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Analytics">Analytics</option>
                </select>
              </div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }} aria-live="polite"><span>{filtered.length}</span> shown</span>
                <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="View mode">
                  <button type="button" className={`ax-btn ax-btn--sm ax-btn--icon${view === 'grid' ? ' is-selected' : ''}`} role="radio" aria-checked={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg></button>
                  <button type="button" className={`ax-btn ax-btn--sm ax-btn--icon${view === 'list' ? ' is-selected' : ''}`} role="radio" aria-checked={view === 'list'} onClick={() => setView('list')} aria-label="List view"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg></button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GRID VIEW */}
        {view === 'grid' && (
          <div className="ax-col--12">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 'var(--ax-space-5)' }}>
              {filtered.map((m) => (
                <article key={m.id} className="ax-card ax-card--interactive" role="region" aria-label={m.name}>
                  <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className="ax-avatar ax-avatar--lg" style={{ background: `color-mix(in oklab,${m.tint} 16%,transparent)`, color: m.tint }}>
                        <span className="ax-avatar__initials">{m.init}</span>
                        <span className="ax-avatar__status" style={{ background: statusColor[m.status] }} aria-label={statusLabel[m.status]} />
                      </span>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Member options">{ICON_DOTS}</button>
                    </div>
                    <div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span style={{ fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)' }}>{m.name}</span></div>
                      <div style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{m.role + ' · ' + m.dept}</div>
                      <div className="ax-cluster" style={{ gap: 6, marginTop: 6, fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor[m.status] }} /><span>{statusLabel[m.status]}</span></div>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', marginTop: 'var(--ax-space-1)' }}>
                      <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm ax-btn--block">{ICON_MSG}<span className="ax-btn__label">Message</span></button>
                      <a className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" href={`mailto:${m.email}`} aria-label={`Email ${m.name}`}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="ax-card" style={{ marginTop: 'var(--ax-space-5)' }}>
                <div className="ax-card__body" style={{ textAlign: 'center', paddingBlock: 'var(--ax-space-8)' }}>
                  <span className="ax-avatar ax-avatar--lg" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-subtle)', marginInline: 'auto' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></span>
                  <p style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', marginTop: 'var(--ax-space-3)' }}>No team members match your filters</p>
                  <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', marginTop: 4 }}>Try a different search or department.</p>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" style={{ marginTop: 'var(--ax-space-3)' }} onClick={() => { setQ(''); setDept('all'); }}>Clear filters</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <section className="ax-card ax-col--12" role="region" aria-label="Team members list">
            <div className="ax-table-wrap">
              <table className="ax-table ax-table--hover">
                <thead className="ax-table__head">
                  <tr>
                    <th className="ax-table__th" scope="col">Member</th>
                    <th className="ax-table__th" scope="col">Role</th>
                    <th className="ax-table__th" scope="col">Department</th>
                    <th className="ax-table__th" scope="col">Status</th>
                    <th className="ax-table__th" scope="col" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="ax-table__row">
                      <td className="ax-table__td">
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                          <span className="ax-avatar ax-avatar--sm" style={{ background: `color-mix(in oklab,${m.tint} 16%,transparent)`, color: m.tint }}><span className="ax-avatar__initials">{m.init}</span></span>
                          <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{m.name}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{m.email}</div></div>
                        </div>
                      </td>
                      <td className="ax-table__td"><span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">{m.role}</span></td>
                      <td className="ax-table__td" style={{ color: 'var(--ax-text-muted)' }}>{m.dept}</td>
                      <td className="ax-table__td"><span className="ax-cluster" style={{ gap: 6, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor[m.status] }} /><span>{statusLabel[m.status]}</span></span></td>
                      <td className="ax-table__td" style={{ textAlign: 'right' }}>
                        <div className="ax-cluster" style={{ gap: 'var(--ax-space-1)', justifyContent: 'flex-end' }}>
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Message ${m.name}`}>{ICON_MSG}</button>
                          <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label={`Options for ${m.name}`}>{ICON_DOTS}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* INVITE MODAL */}
      {invite && (
        <div className="ax-grid" style={{ position: 'fixed', inset: 0, zIndex: 60, placeItems: 'center', padding: 'var(--ax-space-4)' }}>
          <div onClick={() => setInvite(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(8,10,16,.55)', backdropFilter: 'blur(2px)' }} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="inv-title" className="ax-card" style={{ position: 'relative', maxWidth: 460, width: '100%' }}>
            <div className="ax-card__header">
              <div className="ax-card__titles"><h2 className="ax-card__title" id="inv-title">Invite a team member</h2><p className="ax-card__subtitle">They&apos;ll get an email to join your workspace.</p></div>
              <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" onClick={() => setInvite(false)} aria-label="Close dialog"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
            </div>
            <form className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }} onSubmit={(e) => { e.preventDefault(); setSent(true); setTimeout(() => setInvite(false), 1200); }}>
              {sent && (
                <div className="ax-alert ax-alert--success">
                  <span className="ax-alert__icon"><svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
                  <div className="ax-alert__content"><p className="ax-alert__message">Invitation sent.</p></div>
                </div>
              )}
              <div className="ax-field"><label className="ax-label" htmlFor="inv-email">Email address</label><input id="inv-email" type="email" className="ax-input" placeholder="name@company.com" required /></div>
              <div className="ax-field"><label className="ax-label" htmlFor="inv-role">Role</label><select id="inv-role" className="ax-select"><option>Viewer</option><option>Editor</option><option>Admin</option></select><span className="ax-help">Admins can manage members and billing.</span></div>
              <div className="ax-field"><label className="ax-label" htmlFor="inv-dept">Department</label><select id="inv-dept" className="ax-select"><option>Design</option><option>Engineering</option><option>Product</option><option>Analytics</option></select></div>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', justifyContent: 'flex-end', marginTop: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setInvite(false)}>Cancel</button>
                <button type="submit" className="ax-btn ax-btn--primary">Send invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Team;
