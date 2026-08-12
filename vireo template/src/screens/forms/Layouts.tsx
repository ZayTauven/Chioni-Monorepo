'use client';
/*
 * Vireo Next.js — Forms / Layouts (route "forms/layouts").
 *
 * Faithful re-expression of src/html/forms/layouts.html: six form arrangements —
 * vertical, horizontal, inline filter bar, 12-col grid address, fields + help rail,
 * and a card-sectioned form with a sticky action bar (the Alpine `dirty` flag is
 * ported to React state). DOM classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const labelCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 'var(--ax-space-4)', alignItems: 'center' };

export function Layouts() {
  const [dirty, setDirty] = useState(true);

  return (
    <>
      <PageHead
        title="Form Layouts"
        subtitle="Vertical, horizontal, inline, 12-col grid &amp; card-sectioned patterns — one form, six arrangements."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/forms/elements">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Elements</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Vertical */}
        <section className="ax-card ax-col--6" role="region" aria-label="Vertical layout">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern 01</span>
              <h2 className="ax-card__title">Vertical</h2>
              <p className="ax-card__subtitle">Labels above controls — the default stack.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="lv-name">Display name <span className="ax-field__required" aria-hidden="true">*</span></label>
              <input id="lv-name" type="text" className="ax-input" defaultValue="Northwind Labs" />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="lv-email">Reply-to email</label>
              <input id="lv-email" type="email" className="ax-input" defaultValue="hello@northwind.io" />
              <span className="ax-help">Bounces are routed to this inbox.</span>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="lv-bio">About</label>
              <textarea id="lv-bio" className="ax-textarea" rows={3} defaultValue="Independent product studio shipping calm software since 2019." />
            </div>
            <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}>
              <button type="button" className="ax-btn ax-btn--ghost"><span className="ax-btn__label">Cancel</span></button>
              <button type="button" className="ax-btn ax-btn--primary"><span className="ax-btn__label">Save</span></button>
            </div>
          </div>
        </section>

        {/* Horizontal */}
        <section className="ax-card ax-col--6" role="region" aria-label="Horizontal layout">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern 02</span>
              <h2 className="ax-card__title">Horizontal</h2>
              <p className="ax-card__subtitle">Label column (4/12) beside the control.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div style={labelCol}>
              <label className="ax-label" htmlFor="lh-org" style={{ textAlign: 'start' }}>Organisation</label>
              <input id="lh-org" type="text" className="ax-input" defaultValue="Acme Inc." />
            </div>
            <div style={labelCol}>
              <label className="ax-label" htmlFor="lh-role">Role</label>
              <select id="lh-role" className="ax-select" defaultValue="Administrator">
                <option>Owner</option><option>Administrator</option><option>Member</option>
              </select>
            </div>
            <div style={{ ...labelCol, alignItems: 'start' }}>
              <label className="ax-label" htmlFor="lh-seats" style={{ paddingTop: 10 }}>Seats</label>
              <div>
                <div className="ax-input-group" style={{ maxWidth: 140 }}>
                  <span className="ax-input-group__addon" aria-hidden="true">#</span>
                  <input id="lh-seats" type="text" className="ax-input ax-num" defaultValue="25" inputMode="numeric" style={{ fontFamily: 'var(--ax-font-mono)' }} />
                </div>
                <span className="ax-help" style={{ display: 'block', marginTop: 'var(--ax-space-2)' }}>17 of 25 seats are in use.</span>
              </div>
            </div>
            <div style={labelCol}>
              <span className="ax-label">SSO enforced</span>
              <input type="checkbox" role="switch" className="ax-switch" defaultChecked aria-label="SSO enforced" />
            </div>
          </div>
        </section>

        {/* Inline filter bar */}
        <section className="ax-card ax-col--12" role="region" aria-label="Inline filter layout">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern 03</span>
              <h2 className="ax-card__title">Inline</h2>
              <p className="ax-card__subtitle">Compact controls on one line — ideal for filter bars.</p>
            </div>
          </div>
          <div className="ax-card__body">
            <form className="ax-cluster" style={{ gap: 'var(--ax-space-3)', alignItems: 'flex-end' }} onSubmit={(e) => e.preventDefault()}>
              <div className="ax-field" style={{ flex: '1 1 240px', minWidth: 200 }}>
                <label className="ax-label" htmlFor="li-search">Search</label>
                <div className="ax-field__control">
                  <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
                  <input id="li-search" type="search" className="ax-input ax-input--with-leading-icon ax-input--sm" placeholder="Invoices, customers…" />
                </div>
              </div>
              <div className="ax-field" style={{ flex: '0 0 160px' }}>
                <label className="ax-label" htmlFor="li-status">Status</label>
                <select id="li-status" className="ax-select ax-select--sm"><option>All</option><option>Paid</option><option>Overdue</option><option>Draft</option></select>
              </div>
              <div className="ax-field" style={{ flex: '0 0 160px' }}>
                <label className="ax-label" htmlFor="li-range">Period</label>
                <select id="li-range" className="ax-select ax-select--sm" defaultValue="Last 30 days"><option>Last 7 days</option><option>Last 30 days</option><option>This quarter</option></select>
              </div>
              <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center', height: 32 }}>
                <input type="checkbox" className="ax-checkbox" />
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', whiteSpace: 'nowrap' }}>Only mine</span>
              </label>
              <button type="submit" className="ax-btn ax-btn--primary ax-btn--sm"><span className="ax-btn__label">Apply</span></button>
              <button type="reset" className="ax-btn ax-btn--ghost ax-btn--sm"><span className="ax-btn__label">Clear</span></button>
            </form>
          </div>
        </section>

        {/* 12-col grid */}
        <section className="ax-card ax-col--7" role="region" aria-label="Grid layout">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern 04</span>
              <h2 className="ax-card__title">12-Column Grid</h2>
              <p className="ax-card__subtitle">The canonical address form: 6+6, then 6+3+3.</p>
            </div>
          </div>
          <div className="ax-card__body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
              <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="lg-name">Full name <span className="ax-field__required" aria-hidden="true">*</span></label><input id="lg-name" type="text" className="ax-input" defaultValue="Amelia Hart" autoComplete="name" /></div>
              <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="lg-l1">Address line 1 <span className="ax-field__required" aria-hidden="true">*</span></label><input id="lg-l1" type="text" className="ax-input" defaultValue="1208 Marlowe Ave" autoComplete="address-line1" /></div>
              <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="lg-l2">Address line 2</label><input id="lg-l2" type="text" className="ax-input" placeholder="Apartment, suite, etc." autoComplete="address-line2" /></div>
              <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="lg-city">City <span className="ax-field__required" aria-hidden="true">*</span></label><input id="lg-city" type="text" className="ax-input" defaultValue="Portland" autoComplete="address-level2" /></div>
              <div className="ax-field" style={{ gridColumn: 'span 3' }}><label className="ax-label" htmlFor="lg-state">State</label><input id="lg-state" type="text" className="ax-input" defaultValue="OR" autoComplete="address-level1" /></div>
              <div className="ax-field" style={{ gridColumn: 'span 3' }}><label className="ax-label" htmlFor="lg-zip">ZIP <span className="ax-field__required" aria-hidden="true">*</span></label><input id="lg-zip" type="text" className="ax-input ax-num" defaultValue="97201" inputMode="numeric" autoComplete="postal-code" style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
              <div className="ax-field" style={{ gridColumn: 'span 8' }}><label className="ax-label" htmlFor="lg-country">Country <span className="ax-field__required" aria-hidden="true">*</span></label><select id="lg-country" className="ax-select" defaultValue="United States"><option>United States</option><option>Canada</option><option>United Kingdom</option></select></div>
              <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="lg-phone">Phone</label><input id="lg-phone" type="tel" className="ax-input ax-num" defaultValue="(503) 555-0148" autoComplete="tel" style={{ fontFamily: 'var(--ax-font-mono)' }} /></div>
            </div>
          </div>
        </section>

        {/* Fields + help rail */}
        <section className="ax-card ax-col--5" role="region" aria-label="Two-column with help rail">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern 05</span>
              <h2 className="ax-card__title">Fields + Help Rail</h2>
              <p className="ax-card__subtitle">Form on the left, contextual help docked alongside.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="lt-key">API key name</label>
              <input id="lt-key" type="text" className="ax-input" defaultValue="production-server" />
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="lt-scope">Scope</label>
              <select id="lt-scope" className="ax-select" defaultValue="Read &amp; write"><option>Read-only</option><option>Read &amp; write</option><option>Full access</option></select>
            </div>
            <div className="ax-alert ax-alert--info ax-alert--inline" role="note">
              <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg></span>
              <div className="ax-alert__content"><p className="ax-alert__message">Keys are shown once at creation. Store them in your secrets manager — we never display them again.</p></div>
            </div>
            <button type="button" className="ax-btn ax-btn--primary ax-btn--block"><span className="ax-btn__label">Generate key</span></button>
          </div>
        </section>

        {/* Sectioned */}
        <section className="ax-card ax-col--12" role="region" aria-label="Sectioned layout">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern 06</span>
              <h2 className="ax-card__title">Card-Sectioned</h2>
              <p className="ax-card__subtitle">Fieldsets separated by hairlines, with a sticky action bar.</p>
            </div>
          </div>
          <div className="ax-card__body">
            <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--ax-space-6)' }}>
              <legend style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)', padding: 0, marginBottom: 'var(--ax-space-1)' }}>Profile</legend>
              <p style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', margin: '0 0 var(--ax-space-4)' }}>Public details shown on your team page.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="ls-first">First name</label><input id="ls-first" type="text" className="ax-input" defaultValue="Tomás" /></div>
                <div className="ax-field" style={{ gridColumn: 'span 6' }}><label className="ax-label" htmlFor="ls-last">Last name</label><input id="ls-last" type="text" className="ax-input" defaultValue="Herrera" /></div>
                <div className="ax-field" style={{ gridColumn: 'span 12' }}><label className="ax-label" htmlFor="ls-title">Job title</label><input id="ls-title" type="text" className="ax-input" defaultValue="Head of Product" /></div>
              </div>
            </fieldset>
            <hr className="ax-divider" style={{ margin: '0 0 var(--ax-space-6)' }} />
            <fieldset style={{ border: 0, padding: 0, margin: '0 0 var(--ax-space-6)' }}>
              <legend style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-md)', padding: 0, marginBottom: 'var(--ax-space-1)' }}>Preferences</legend>
              <p style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', margin: '0 0 var(--ax-space-4)' }}>How the product behaves for you.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 'var(--ax-space-4)' }}>
                <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="ls-lang">Language</label><select id="ls-lang" className="ax-select"><option>English (US)</option><option>Español</option><option>Deutsch</option></select></div>
                <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="ls-week">Week starts on</label><select id="ls-week" className="ax-select" defaultValue="Monday"><option>Sunday</option><option>Monday</option></select></div>
                <div className="ax-field" style={{ gridColumn: 'span 4' }}><label className="ax-label" htmlFor="ls-fmt">Date format</label><select id="ls-fmt" className="ax-select" defaultValue="DD MMM YYYY"><option>MM/DD/YYYY</option><option>DD MMM YYYY</option><option>YYYY-MM-DD</option></select></div>
              </div>
            </fieldset>
            <div style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ax-space-3)', margin: '0 calc(-1 * var(--ax-space-6)) calc(-1 * var(--ax-space-6))', padding: 'var(--ax-space-4) var(--ax-space-6)', background: 'var(--ax-surface)', borderTop: '1px solid var(--ax-border)', boxShadow: 'var(--ax-shadow-sm)', borderRadius: '0 0 var(--ax-radius-xl) var(--ax-radius-xl)' }}>
              {dirty && <span className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}><i style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ax-warning-500)' }} />Unsaved changes</span>}
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginInlineStart: 'auto' }}>
                <button type="button" className="ax-btn ax-btn--ghost" onClick={() => setDirty(false)}><span className="ax-btn__label">Discard</span></button>
                <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Save draft</span></button>
                <button type="button" className="ax-btn ax-btn--primary" onClick={() => setDirty(false)}><span className="ax-btn__label">Save changes</span></button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default Layouts;
