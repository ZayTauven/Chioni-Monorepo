'use client';
/*
 * Vireo React — Profile Settings (route "pages/profile-settings").
 *
 * Faithful re-expression of src/html/pages/profile-settings.html: a vertical tab
 * rail (Account / Security / Notifications / Billing), each panel of fields, a
 * live password-strength meter, an active-sessions list with revoke, and a
 * sticky save bar driven by dirty/saved state. Alpine x-data ported to React.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

type Tab = 'account' | 'security' | 'notifications' | 'billing';

interface Session { id: number; dev: string; meta: string; cur: boolean; when: string; }

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'account', label: 'Account', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg> },
  { key: 'security', label: 'Security', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /><path d="M11 11a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M12 12l0 2.5" /></svg> },
  { key: 'notifications', label: 'Notifications', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg> },
  { key: 'billing', label: 'Billing', icon: <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /><path d="M7 15l.01 0" /><path d="M11 15l2 0" /></svg> },
];

const NOTIF_ROWS = [
  { title: 'New comment', sub: 'When someone replies to you', email: true, push: true, app: true },
  { title: 'Mentions', sub: "When you're @mentioned", email: true, push: true, app: true },
  { title: 'Weekly digest', sub: 'Summary of your activity', email: true, push: false, app: false },
  { title: 'Billing & receipts', sub: 'Invoices and payment alerts', email: true, push: false, app: true },
  { title: 'Security alerts', sub: 'New sign-ins and changes', email: true, push: true, app: true },
];

const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

export function ProfileSettings() {
  const [tab, setTab] = useState<Tab>('account');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState('');
  const [sessions, setSessions] = useState<Session[]>([
    { id: 1, dev: 'MacBook Pro · Lisbon', meta: 'Chrome 126 · 84.91.12.4', cur: true, when: 'Active now' },
    { id: 2, dev: 'iPhone 15 · Lisbon', meta: 'Safari · Mobile', cur: false, when: '3 hours ago' },
    { id: 3, dev: 'Windows PC · Madrid', meta: 'Edge 126 · 88.4.220.9', cur: false, when: 'Yesterday' },
  ]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touch = () => setDirty(true);
  const save = () => {
    setSaved(true);
    setDirty(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2200);
  };

  const score = (() => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();

  const barClass = (weakAt: number) =>
    `ax-strength__bar${score >= weakAt ? ' is-weak' : ''}${score >= 3 ? ' is-medium' : ''}${score >= 4 ? ' is-strong' : ''}`;

  return (
    <>
      <PageHead
        title="Profile Settings"
        subtitle="Manage your account, security, notifications and billing."
        actions={
          dirty ? (
            <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-warning-500)', fontSize: 'var(--ax-text-xs)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-warning-500)' }} />Unsaved changes
            </span>
          ) : undefined
        }
      />

      <div className="ax-dash-grid">
        {/* LEFT TAB RAIL */}
        <nav className="ax-card ax-col--3" role="region" aria-label="Settings sections" style={{ alignSelf: 'start' }}>
          <div className="ax-card__body" style={{ padding: 'var(--ax-space-3)' }}>
            <div role="tablist" aria-orientation="vertical" aria-label="Settings" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TABS.map((t) => (
                <button key={t.key} type="button" role="tab" className={`ax-btn ax-btn--ghost ax-btn--block${tab === t.key ? ' is-selected' : ''}`} style={{ justifyContent: 'flex-start' }} aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                  {t.icon}
                  <span className="ax-btn__label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* RIGHT PANELS */}
        <div className="ax-col--9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>

          {/* ACCOUNT */}
          {tab === 'account' && (
            <div role="tabpanel" aria-label="Account settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
              <section className="ax-card" role="region" aria-label="Profile photo">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Profile photo</h2><p className="ax-card__subtitle">PNG or JPG, up to 2 MB. Square works best.</p></div></div>
                <div className="ax-card__body" style={{ paddingTop: 0 }}>
                  <div className="ax-cluster" style={{ gap: 'var(--ax-space-5)' }}>
                    <span className="ax-avatar ax-avatar--xl ax-avatar--ringed" style={{ background: 'color-mix(in oklab,var(--ax-accent) 16%,transparent)', color: 'var(--ax-accent)' }}><span className="ax-avatar__initials" style={{ fontSize: 'var(--ax-text-lg)' }}>MA</span></span>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                      <button type="button" className="ax-btn ax-btn--secondary" onClick={touch}><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Upload new</span></button>
                      <button type="button" className="ax-btn ax-btn--ghost" onClick={touch}>Remove</button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="ax-card" role="region" aria-label="Personal information">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Personal information</h2></div></div>
                <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-first">First name</label><input id="ps-first" type="text" className="ax-input" defaultValue="Maya" onInput={touch} /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-last">Last name</label><input id="ps-last" type="text" className="ax-input" defaultValue="Albright" onInput={touch} /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-user">Username</label><input id="ps-user" type="text" className="ax-input" defaultValue="maya.albright" onInput={touch} /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-email">Email</label><input id="ps-email" type="email" className="ax-input" defaultValue="maya.albright@northwind.io" onInput={touch} /><span className="ax-help">Changing your email requires re-verification.</span></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-phone">Phone</label><input id="ps-phone" type="tel" className="ax-input ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }} defaultValue="+351 912 044 318" onInput={touch} /></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-tz">Timezone</label><select id="ps-tz" className="ax-select" onChange={touch}><option>(GMT+00:00) Lisbon</option><option>(GMT+01:00) Berlin</option><option>(GMT-05:00) New York</option><option>(GMT+05:30) Mumbai</option></select></div>
                  <div className="ax-field" style={{ gridColumn: '1 / -1' }}><label className="ax-label" htmlFor="ps-bio">Bio</label><textarea id="ps-bio" className="ax-textarea" rows={3} onInput={touch} defaultValue="Designer focused on data-dense interfaces and design systems." /><span className="ax-help">Brief description for your profile. Max 160 characters.</span></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-lang">Language</label><select id="ps-lang" className="ax-select" onChange={touch}><option>English (US)</option><option>Português</option><option>Español</option><option>Deutsch</option></select></div>
                </div>
              </section>
            </div>
          )}

          {/* SECURITY */}
          {tab === 'security' && (
            <div role="tabpanel" aria-label="Security settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
              <section className="ax-card" role="region" aria-label="Change password">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Change password</h2><p className="ax-card__subtitle">Use at least 8 characters with a mix of letters, numbers and symbols.</p></div></div>
                <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)', maxWidth: 480 }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-cur">Current password</label><input id="ps-cur" type="password" className="ax-input" autoComplete="current-password" onInput={touch} /></div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="ps-new">New password</label>
                    <input id="ps-new" type="password" className="ax-input" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); touch(); }} />
                    <div className="ax-strength" aria-hidden="true">
                      <div className="ax-strength__bars">
                        <span className={barClass(1)} />
                        <span className={barClass(2)} />
                        <span className={`ax-strength__bar${score >= 3 ? ' is-medium' : ''}${score >= 4 ? ' is-strong' : ''}`} />
                        <span className={`ax-strength__bar${score >= 4 ? ' is-strong' : ''}`} />
                      </div>
                      <span className="ax-strength__label">{STRENGTH[score]}</span>
                    </div>
                  </div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-conf">Confirm new password</label><input id="ps-conf" type="password" className="ax-input" autoComplete="new-password" onInput={touch} /></div>
                </div>
              </section>

              <section className="ax-card" role="region" aria-label="Two-factor authentication">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Two-factor authentication</h2></div></div>
                <div className="ax-card__body" style={{ paddingTop: 0 }}>
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 'var(--ax-space-4)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Authenticator app</span><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Enabled</span></div>
                      <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Codes are generated by your authenticator app. Recovery codes were last viewed Jun 02.</p>
                    </div>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', flexShrink: 0 }}>
                      <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Recovery codes</button>
                      <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm">Manage</button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="ax-card" role="region" aria-label="Active sessions">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Active sessions</h2></div>
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setSessions((s) => s.filter((x) => x.cur))}>Revoke all others</button>
                </div>
                <div className="ax-card__body" style={{ paddingTop: 0 }}>
                  <ul className="ax-list">
                    {sessions.map((s) => (
                      <li key={s.id} className="ax-list__row" style={{ paddingInline: 0 }}>
                        <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'var(--ax-surface-subtle)', color: 'var(--ax-text-muted)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z" /><path d="M7 20h10" /><path d="M9 16v4" /><path d="M15 16v4" /></svg></span></span>
                        <span className="ax-list__content"><span className="ax-list__title">{s.dev}</span><span className="ax-list__meta ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{s.meta}</span></span>
                        <span className="ax-list__trailing" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}>
                          {s.cur && <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill">This device</span>}
                          <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{s.when}</span>
                          {!s.cur && <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setSessions((cur) => cur.filter((x) => x.id !== s.id))}>Revoke</button>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {tab === 'notifications' && (
            <div role="tabpanel" aria-label="Notification settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
              <section className="ax-card" role="region" aria-label="Notification channels">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Notification channels</h2><p className="ax-card__subtitle">Choose how you want to be notified for each event.</p></div></div>
                <div className="ax-table-wrap">
                  <table className="ax-table">
                    <thead className="ax-table__head">
                      <tr>
                        <th className="ax-table__th" scope="col">Event</th>
                        <th className="ax-table__th" scope="col" style={{ textAlign: 'center' }}>Email</th>
                        <th className="ax-table__th" scope="col" style={{ textAlign: 'center' }}>Push</th>
                        <th className="ax-table__th" scope="col" style={{ textAlign: 'center' }}>In-app</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NOTIF_ROWS.map((r) => (
                        <tr key={r.title} className="ax-table__row">
                          <td className="ax-table__td"><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>{r.title}</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{r.sub}</div></td>
                          <td className="ax-table__td" style={{ textAlign: 'center' }}><input type="checkbox" className="ax-switch" aria-label={`Email — ${r.title}`} defaultChecked={r.email} onChange={touch} /></td>
                          <td className="ax-table__td" style={{ textAlign: 'center' }}><input type="checkbox" className="ax-switch" aria-label={`Push — ${r.title}`} defaultChecked={r.push} onChange={touch} /></td>
                          <td className="ax-table__td" style={{ textAlign: 'center' }}><input type="checkbox" className="ax-switch" aria-label={`In-app — ${r.title}`} defaultChecked={r.app} onChange={touch} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ax-card" role="region" aria-label="Delivery preferences">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Delivery preferences</h2></div></div>
                <div className="ax-card__body" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-digest">Digest frequency</label><select id="ps-digest" className="ax-select" defaultValue="Weekly" onChange={touch}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Off</option></select></div>
                  <div className="ax-field"><label className="ax-label" htmlFor="ps-quiet">Quiet hours</label><select id="ps-quiet" className="ax-select" defaultValue="22:00 – 07:00" onChange={touch}><option>Off</option><option>22:00 – 07:00</option><option>20:00 – 08:00</option></select></div>
                  <div className="ax-cluster" style={{ gridColumn: '1 / -1', justifyContent: 'space-between', paddingTop: 'var(--ax-space-2)', borderTop: '1px solid var(--ax-border)' }}>
                    <div><div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Mute all notifications</div><div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Temporarily pause every channel</div></div>
                    <input type="checkbox" className="ax-switch" aria-label="Mute all notifications" onChange={touch} />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* BILLING */}
          {tab === 'billing' && (
            <div role="tabpanel" aria-label="Billing settings" className="ax-stack" style={{ ['--ax-gap' as string]: 'var(--ax-space-6)' }}>
              <section className="ax-card ax-card--accent-edge" role="region" aria-label="Current plan">
                <div className="ax-card__body">
                  <div className="ax-cluster" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--ax-space-4)' }}>
                    <div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}><span className="ax-card__eyebrow">Current plan</span><span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Active</span></div>
                      <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', alignItems: 'baseline', marginTop: 6 }}><b style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-xl)', color: 'var(--ax-text-strong)' }}>Pro</b><span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-muted)' }}>$48/mo</span></div>
                      <p style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>Renews <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Jul 14, 2026</span> · 8 seats included</p>
                    </div>
                    <Link className="ax-btn ax-btn--primary" href="/pages/billing">
                      <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>
                      <span className="ax-btn__label">Manage billing</span>
                    </Link>
                  </div>
                </div>
              </section>

              <section className="ax-card" role="region" aria-label="Payment methods">
                <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Payment methods</h2></div>
                  <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg><span className="ax-btn__label">Add card</span></button>
                </div>
                <div className="ax-card__body" style={{ paddingTop: 0 }}>
                  <ul className="ax-list">
                    <li className="ax-list__row" style={{ paddingInline: 0 }}>
                      <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-cyan) 16%,transparent)', color: 'var(--ax-viz-cyan)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg></span></span>
                      <span className="ax-list__content"><span className="ax-list__title">Visa ending <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>4921</span></span><span className="ax-list__meta ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Expires 08/27</span></span>
                      <span className="ax-list__trailing" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}><span className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill">Default</span><button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Card options"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg></button></span>
                    </li>
                    <li className="ax-list__row" style={{ paddingInline: 0 }}>
                      <span className="ax-list__leading"><span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-amber) 16%,transparent)', color: 'var(--ax-viz-amber)' }}><svg className="ax-avatar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8" /><path d="M3 10l18 0" /></svg></span></span>
                      <span className="ax-list__content"><span className="ax-list__title">Mastercard ending <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>7045</span></span><span className="ax-list__meta ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>Expires 02/26</span></span>
                      <span className="ax-list__trailing" style={{ display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)' }}><button type="button" className="ax-btn ax-btn--ghost ax-btn--sm">Set default</button><button type="button" className="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" aria-label="Card options"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /></svg></button></span>
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          )}

          {/* STICKY ACTION BAR */}
          <div style={{ position: 'sticky', bottom: 'var(--ax-space-4)', zIndex: 5 }}>
            <div className="ax-card" style={{ padding: 'var(--ax-space-3) var(--ax-space-4)', boxShadow: 'var(--ax-shadow-md)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>
                  {saved
                    ? <span className="ax-cluster" style={{ gap: 6, color: 'var(--ax-success-500)' }}><svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>All changes saved</span>
                    : dirty
                      ? <span>You have unsaved changes in this section.</span>
                      : <span>Everything is up to date.</span>}
                </span>
                <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
                  <button type="button" className="ax-btn ax-btn--ghost" disabled={!dirty} onClick={() => setDirty(false)}>Discard</button>
                  <button type="button" className="ax-btn ax-btn--primary" disabled={!dirty} onClick={save}>Save changes</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default ProfileSettings;
