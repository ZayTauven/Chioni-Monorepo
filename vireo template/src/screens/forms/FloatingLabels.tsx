'use client';
/*
 * Vireo Next.js — Forms / Floating labels (route "forms/floating-labels").
 *
 * Faithful re-expression of src/html/forms/floating-labels.html: the label-as-
 * placeholder pattern (pure CSS via the page-local recipe carried verbatim in the
 * inline <style>), with text/email/password, leading-icon, select/textarea,
 * valid/invalid states, and a compact sign-in demo (Alpine `show`/`sent` → React
 * state). DOM classes + ARIA match the reference 1:1.
 */
import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const EyeOpen = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
);
const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
);

const RECIPE = `
.ax-float { position: relative; }
.ax-float__input::placeholder { color: transparent; }
.ax-float__label {
  position: absolute;
  inset-inline-start: var(--ax-space-3);
  top: 50%;
  transform: translateY(-50%);
  margin: 0;
  padding-inline: 4px;
  font-size: var(--ax-text-sm);
  color: var(--ax-text-subtle);
  background: var(--ax-surface-solid);
  border-radius: var(--ax-radius-xs);
  pointer-events: none;
  transition:
    top var(--ax-motion-fast) var(--ax-ease-standard),
    font-size var(--ax-motion-fast) var(--ax-ease-standard),
    color var(--ax-motion-fast) var(--ax-ease-standard);
}
.ax-float--icon .ax-float__label { inset-inline-start: var(--ax-space-8); }
.ax-float--area .ax-float__label { top: calc(var(--ax-space-3) + 9px); transform: none; }
.ax-float__input:focus + .ax-float__label,
.ax-float__input:not(:placeholder-shown) + .ax-float__label,
.ax-float--select .ax-float__label,
.ax-float--area .ax-float__input:focus + .ax-float__label,
.ax-float--area .ax-float__input:not(:placeholder-shown) + .ax-float__label {
  top: 0;
  font-size: var(--ax-text-2xs);
  color: var(--ax-text-muted);
}
.ax-float--icon .ax-float__input:focus + .ax-float__label,
.ax-float--icon .ax-float__input:not(:placeholder-shown) + .ax-float__label {
  inset-inline-start: var(--ax-space-3);
}
.ax-float__input:focus + .ax-float__label { color: var(--ax-accent); }
.ax-float__input.is-invalid + .ax-float__label { color: var(--ax-danger-500); }
.ax-float__input.is-valid + .ax-float__label { color: var(--ax-success-500); }
@media (prefers-reduced-motion: reduce) {
  .ax-float__label { transition: none; }
}
`;

export function FloatingLabels() {
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHead
        title="Floating Labels"
        subtitle="The label is the placeholder — it travels to the top edge on focus or fill, pure CSS."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/forms/elements">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Standard labels</span>
          </Link>
        }
      />

      <style>{RECIPE}</style>

      <div className="ax-dash-grid">
        {/* Basic floating inputs */}
        <section className="ax-card ax-col--6" role="region" aria-label="Floating label inputs">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Inputs</span>
              <h2 className="ax-card__title">Text &amp; Email</h2>
              <p className="ax-card__subtitle">One empty (label rests inside), one pre-filled (label floated).</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div className="ax-float">
              <input id="fl-name" type="text" className="ax-input ax-float__input" placeholder=" " />
              <label className="ax-float__label" htmlFor="fl-name">Full name</label>
            </div>
            <div className="ax-float">
              <input id="fl-email" type="email" className="ax-input ax-float__input" placeholder=" " defaultValue="camila@northwind.io" />
              <label className="ax-float__label" htmlFor="fl-email">Email address</label>
            </div>
            <div className="ax-float">
              <input id="fl-pass" type={show ? 'text' : 'password'} className="ax-input ax-float__input ax-input--with-trailing" placeholder=" " defaultValue="aurora-glass" />
              <label className="ax-float__label" htmlFor="fl-pass">Password</label>
              <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} style={{ top: '50%', transform: 'translateY(-50%)' }}>
                {show ? EyeOff : EyeOpen}
              </button>
            </div>
          </div>
        </section>

        {/* Leading-icon floating inputs */}
        <section className="ax-card ax-col--6" role="region" aria-label="Floating labels with leading icons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Inputs</span>
              <h2 className="ax-card__title">With Leading Icons</h2>
              <p className="ax-card__subtitle">The icon offsets the label's rest position.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div className="ax-float ax-float--icon">
              <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true" style={{ top: '50%', transform: 'translateY(-50%)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg></span>
              <input id="fl-company" type="text" className="ax-input ax-float__input ax-input--with-leading-icon" placeholder=" " />
              <label className="ax-float__label ax-float__label--icon" htmlFor="fl-company">Company name</label>
            </div>
            <div className="ax-float ax-float--icon">
              <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true" style={{ top: '50%', transform: 'translateY(-50%)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" /></svg></span>
              <input id="fl-phone" type="tel" className="ax-input ax-float__input ax-input--with-leading-icon ax-num" placeholder=" " defaultValue="(503) 555-0148" style={{ fontFamily: 'var(--ax-font-mono)' }} />
              <label className="ax-float__label ax-float__label--icon" htmlFor="fl-phone">Phone number</label>
            </div>
            <div className="ax-float ax-float--icon">
              <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true" style={{ top: '50%', transform: 'translateY(-50%)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2l4 -4" /><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></svg></span>
              <input id="fl-vat" type="text" className="ax-input ax-float__input ax-input--with-leading-icon ax-num" placeholder=" " style={{ fontFamily: 'var(--ax-font-mono)' }} />
              <label className="ax-float__label ax-float__label--icon" htmlFor="fl-vat">VAT / Tax ID</label>
            </div>
          </div>
        </section>

        {/* Select & textarea */}
        <section className="ax-card ax-col--6" role="region" aria-label="Floating label select and textarea">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Other controls</span>
              <h2 className="ax-card__title">Select &amp; Textarea</h2>
              <p className="ax-card__subtitle">Selects float permanently; textarea pins the label to the top.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div className="ax-float ax-float--select">
              <select id="fl-plan" className="ax-select ax-float__input" defaultValue="">
                <option value=""></option>
                <option>Starter</option><option>Growth</option><option>Scale</option>
              </select>
              <label className="ax-float__label" htmlFor="fl-plan">Subscription plan</label>
            </div>
            <div className="ax-float ax-float--select">
              <select id="fl-country2" className="ax-select ax-float__input" defaultValue="">
                <option value=""></option>
                <option>United States</option><option>United Kingdom</option><option>Germany</option>
              </select>
              <label className="ax-float__label" htmlFor="fl-country2">Country</label>
            </div>
            <div className="ax-float ax-float--area">
              <textarea id="fl-msg" className="ax-textarea ax-float__input" rows={3} placeholder=" " />
              <label className="ax-float__label" htmlFor="fl-msg">Message</label>
            </div>
          </div>
        </section>

        {/* Validation states */}
        <section className="ax-card ax-col--6" role="region" aria-label="Floating labels with validation">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">States</span>
              <h2 className="ax-card__title">Valid &amp; Invalid</h2>
              <p className="ax-card__subtitle">Floating labels carry the same status colors.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div>
              <div className="ax-float">
                <input id="fl-ok" type="text" className="ax-input ax-float__input is-valid" placeholder=" " defaultValue="northwind-labs" aria-describedby="fl-ok-msg" />
                <label className="ax-float__label" htmlFor="fl-ok">Workspace handle</label>
              </div>
              <span id="fl-ok-msg" className="ax-field__message ax-field__message--success" style={{ display: 'block', marginTop: 'var(--ax-space-2)' }}>vireo.app/northwind-labs is available.</span>
            </div>
            <div>
              <div className="ax-float">
                <input id="fl-bad" type="email" className="ax-input ax-float__input is-invalid" placeholder=" " defaultValue="amelia.hart@" aria-invalid="true" aria-describedby="fl-bad-msg" />
                <label className="ax-float__label" htmlFor="fl-bad">Email address</label>
              </div>
              <span id="fl-bad-msg" className="ax-field__message ax-field__message--error" role="alert" style={{ display: 'block', marginTop: 'var(--ax-space-2)' }}>Enter a complete email address.</span>
            </div>
            <div style={{ opacity: 0.6 }}>
              <div className="ax-float">
                <input id="fl-dis" type="text" className="ax-input ax-float__input" placeholder=" " defaultValue="Managed by Okta" disabled />
                <label className="ax-float__label" htmlFor="fl-dis">Identity provider</label>
              </div>
            </div>
          </div>
        </section>

        {/* Compact sign-in demo */}
        <section className="ax-card ax-col--12 ax-card--accent-edge" role="region" aria-label="Floating label form in context">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Compact Sign-in</h2>
              <p className="ax-card__subtitle">Floating labels keep dense forms tidy. Submit is simulated.</p>
            </div>
          </div>
          <div className="ax-card__body">
            {sent ? (
              <div className="ax-alert ax-alert--success" role="status" style={{ maxWidth: 560 }}>
                <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__title">Signed in</p><p className="ax-alert__message">Welcome back — redirecting to your dashboard.</p></div>
                <div className="ax-alert__actions"><button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setSent(false)}><span className="ax-btn__label">Reset</span></button></div>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} style={{ maxWidth: 560 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-float" style={{ gridColumn: 'span 2' }}>
                    <input id="si-email" type="email" className="ax-input ax-float__input" placeholder=" " autoComplete="email" />
                    <label className="ax-float__label" htmlFor="si-email">Work email</label>
                  </div>
                  <div className="ax-float">
                    <input id="si-pass" type="password" className="ax-input ax-float__input" placeholder=" " autoComplete="current-password" />
                    <label className="ax-float__label" htmlFor="si-pass">Password</label>
                  </div>
                  <div className="ax-float ax-float--select">
                    <select id="si-team" className="ax-select ax-float__input" defaultValue=""><option value=""></option><option>Northwind Labs</option><option>Acme Inc.</option></select>
                    <label className="ax-float__label" htmlFor="si-team">Team</label>
                  </div>
                </div>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginTop: 'var(--ax-space-5)' }}>
                  <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center', minHeight: 'auto' }}>
                    <input type="checkbox" className="ax-checkbox" defaultChecked />
                    <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Keep me signed in</span>
                  </label>
                  <button type="submit" className="ax-btn ax-btn--primary"><span className="ax-btn__label">Sign in</span></button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default FloatingLabels;
