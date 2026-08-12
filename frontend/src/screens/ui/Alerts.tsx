'use client';
/*
 * Vireo Next.js — UI · Alerts (route "ui/alerts").
 *
 * Faithful re-expression of src/html/ui/alerts.html: soft, solid, accent-edge,
 * inline and interactive (actions + dismissible) alerts. The Alpine alerts{}
 * state + @ax-restore-alerts event become React state; "Restore dismissed" in
 * the page-head resets it. DOM classes / ARIA / copy match the reference 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';

const I_INFO = <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>;
const I_SUCCESS = <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg>;
const I_SUCCESS_CHECK = <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>;
const I_WARNING = <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" /></svg>;
const I_DANGER = <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>;
const X_CLOSE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>;

export function Alerts() {
  const FRESH = { invite: true, sync: true, update: true };
  const [alerts, setAlerts] = useState(FRESH);
  const allDismissed = !alerts.invite && !alerts.sync && !alerts.update;

  return (
    <>
      <PageHead
        title="Alerts"
        subtitle="Inline status messaging — info, success, warning & danger, in soft & solid fills, with icons, actions & dismissal."
        actions={
          <button type="button" className="ax-btn ax-btn--primary" onClick={() => setAlerts(FRESH)}>
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>
            <span className="ax-btn__label">Restore dismissed</span>
          </button>
        }
      />

      <div className="ax-dash-grid">
        {/* Soft */}
        <section className="ax-card ax-col--6" role="region" aria-label="Soft tone alerts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Tones</span>
              <h2 className="ax-card__title">Soft alerts</h2>
              <p className="ax-card__subtitle">Tinted background, semantic icon, default emphasis.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-alert ax-alert--info" role="status">{I_INFO}<div className="ax-alert__content"><p className="ax-alert__title">Scheduled maintenance</p><p className="ax-alert__message">Vireo will be briefly unavailable on Jun 15, 02:00–02:30 UTC for a database upgrade.</p></div></div>
            <div className="ax-alert ax-alert--success" role="status">{I_SUCCESS}<div className="ax-alert__content"><p className="ax-alert__title">Payment received</p><p className="ax-alert__message">Order #10482 from Camila Rossi was paid — $312.00 settled via Stripe.</p></div></div>
            <div className="ax-alert ax-alert--warning" role="alert">{I_WARNING}<div className="ax-alert__content"><p className="ax-alert__title">Low stock</p><p className="ax-alert__message">Brass Task Light has 22 units left — below your reorder threshold of 30.</p></div></div>
            <div className="ax-alert ax-alert--danger" role="alert">{I_DANGER}<div className="ax-alert__content"><p className="ax-alert__title">Charge failed</p><p className="ax-alert__message">Daniel Cho&apos;s card was declined for order #10478. The order is on hold.</p></div></div>
          </div>
        </section>

        {/* Solid */}
        <section className="ax-card ax-col--6" role="region" aria-label="Solid tone alerts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Emphasis</span>
              <h2 className="ax-card__title">Solid alerts</h2>
              <p className="ax-card__subtitle">High-contrast banners for moments that must not be missed.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-alert ax-alert--info ax-alert--solid" role="status">{I_INFO}<div className="ax-alert__content"><p className="ax-alert__title">New feature</p><p className="ax-alert__message">The Pulse weekly digest is now available in your reports.</p></div></div>
            <div className="ax-alert ax-alert--success ax-alert--solid" role="status">{I_SUCCESS_CHECK}<div className="ax-alert__content"><p className="ax-alert__title">Deploy succeeded</p><p className="ax-alert__message">Release v2.4.0 shipped to production with zero failed checks.</p></div></div>
            <div className="ax-alert ax-alert--warning ax-alert--solid" role="alert">{I_WARNING}<div className="ax-alert__content"><p className="ax-alert__title">Trial ending soon</p><p className="ax-alert__message">Your team trial ends in 3 days. Add billing to keep your data.</p></div></div>
            <div className="ax-alert ax-alert--danger ax-alert--solid" role="alert">{I_DANGER}<div className="ax-alert__content"><p className="ax-alert__title">Service degraded</p><p className="ax-alert__message">Webhook delivery is delayed. Our team is investigating.</p></div></div>
          </div>
        </section>

        {/* Accent edge */}
        <section className="ax-card ax-col--6" role="region" aria-label="Accent edge alerts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Variant</span>
              <h2 className="ax-card__title">Accent edge</h2>
              <p className="ax-card__subtitle">A left rail in the tone color, for calmer notices.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-alert ax-alert--accent ax-alert--accent-edge" role="status">
              <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" /><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" /><path d="M9.7 17l4.6 0" /></svg>
              <div className="ax-alert__content"><p className="ax-alert__title">Tip</p><p className="ax-alert__message">Press <kbd className="ax-kbd">⌘</kbd> <kbd className="ax-kbd">K</kbd> anywhere to open the command palette.</p></div>
            </div>
            <div className="ax-alert ax-alert--success ax-alert--accent-edge" role="status">{I_SUCCESS}<div className="ax-alert__content"><p className="ax-alert__title">Profile complete</p><p className="ax-alert__message">All onboarding steps are done — you&apos;re ready to invite your team.</p></div></div>
            <div className="ax-alert ax-alert--warning ax-alert--accent-edge" role="alert">{I_WARNING}<div className="ax-alert__content"><p className="ax-alert__title">Verify your email</p><p className="ax-alert__message">We sent a link to ava.sutton@northwindlabs.app — confirm to enable exports.</p></div></div>
          </div>
        </section>

        {/* Inline */}
        <section className="ax-card ax-col--6" role="region" aria-label="Inline alerts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Compact</span>
              <h2 className="ax-card__title">Inline alerts</h2>
              <p className="ax-card__subtitle">Single-line variant for forms &amp; field validation.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            <div className="ax-alert ax-alert--success ax-alert--inline" role="status">{I_SUCCESS_CHECK}<div className="ax-alert__content"><span style={{ color: 'var(--ax-text)' }}>Username is available.</span></div></div>
            <div className="ax-alert ax-alert--danger ax-alert--inline" role="alert"><svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg><div className="ax-alert__content"><span style={{ color: 'var(--ax-text)' }}>Password must be at least 8 characters.</span></div></div>
            <div className="ax-alert ax-alert--warning ax-alert--inline" role="alert">{I_WARNING}<div className="ax-alert__content"><span style={{ color: 'var(--ax-text)' }}>This handle is close to one already in use.</span></div></div>
            <div className="ax-alert ax-alert--neutral ax-alert--inline" role="status">{I_INFO}<div className="ax-alert__content"><span style={{ color: 'var(--ax-text)' }}>Changes are saved automatically.</span></div></div>
          </div>
        </section>

        {/* With actions + dismissible */}
        <section className="ax-card ax-col--12" role="region" aria-label="Alerts with actions and dismissal">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Interactive</span>
              <h2 className="ax-card__title">Actions &amp; dismissible</h2>
              <p className="ax-card__subtitle">Buttons inside the body; the close control removes the alert. Use &ldquo;Restore dismissed&rdquo; above to bring them back.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
            {alerts.invite && (
              <div className="ax-alert ax-alert--accent" role="status">
                <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 11h6" /><path d="M19 8v6" /></svg>
                <div className="ax-alert__content">
                  <p className="ax-alert__title">3 invitations are waiting</p>
                  <p className="ax-alert__message">Marcus, Lena and Devon haven&apos;t accepted their workspace invites yet.</p>
                  <div className="ax-alert__actions">
                    <button type="button" className="ax-btn ax-btn--solid ax-btn--sm" onClick={() => setAlerts((a) => ({ ...a, invite: false }))}><span className="ax-btn__label">Resend all</span></button>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setAlerts((a) => ({ ...a, invite: false }))}><span className="ax-btn__label">Dismiss</span></button>
                  </div>
                </div>
                <button type="button" className="ax-alert__dismiss" onClick={() => setAlerts((a) => ({ ...a, invite: false }))} aria-label="Dismiss invitations alert">{X_CLOSE}</button>
              </div>
            )}
            {alerts.sync && (
              <div className="ax-alert ax-alert--warning" role="alert">
                {I_WARNING}
                <div className="ax-alert__content">
                  <p className="ax-alert__title">Sync paused</p>
                  <p className="ax-alert__message">Your accounting integration disconnected 2 hours ago. Reconnect to resume nightly syncs.</p>
                  <div className="ax-alert__actions">
                    <button type="button" className="ax-btn ax-btn--warning ax-btn--solid ax-btn--sm" onClick={() => setAlerts((a) => ({ ...a, sync: false }))}><span className="ax-btn__label">Reconnect</span></button>
                    <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setAlerts((a) => ({ ...a, sync: false }))}><span className="ax-btn__label">Not now</span></button>
                  </div>
                </div>
                <button type="button" className="ax-alert__dismiss" onClick={() => setAlerts((a) => ({ ...a, sync: false }))} aria-label="Dismiss sync alert">{X_CLOSE}</button>
              </div>
            )}
            {alerts.update && (
              <div className="ax-alert ax-alert--info" role="status">
                <svg className="ax-alert__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /></svg>
                <div className="ax-alert__content">
                  <p className="ax-alert__title">Update available — v2.5</p>
                  <p className="ax-alert__message">A new release adds saved views and bulk tagging. Reload to apply.</p>
                  <div className="ax-alert__actions">
                    <button type="button" className="ax-btn ax-btn--info ax-btn--solid ax-btn--sm" onClick={() => setAlerts((a) => ({ ...a, update: false }))}><span className="ax-btn__label">Reload now</span></button>
                    <a className="ax-btn ax-btn--link ax-btn--sm" href="#"><span className="ax-btn__label">View changelog</span></a>
                  </div>
                </div>
                <button type="button" className="ax-alert__dismiss" onClick={() => setAlerts((a) => ({ ...a, update: false }))} aria-label="Dismiss update alert">{X_CLOSE}</button>
              </div>
            )}
            {allDismissed && <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)', textAlign: 'center', padding: 'var(--ax-space-4)' }}>All alerts dismissed. Use &ldquo;Restore dismissed&rdquo; in the header to bring them back.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

export default Alerts;
