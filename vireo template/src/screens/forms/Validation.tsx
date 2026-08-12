'use client';
/*
 * Vireo Next.js — Forms / Validation (route "forms/validation").
 *
 * Faithful re-expression of src/html/forms/validation.html: a static state
 * reference card (rest/valid/invalid/disabled) and a live demo form that validates
 * on submit then re-validates on input, with an accessible error summary and a
 * simulated submit. The Alpine signupForm() factory is ported to React state; rules,
 * messages, ARIA and classes match the reference 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

type FieldKey = 'name' | 'email' | 'pass' | 'plan' | 'terms';
interface FieldState { id: string; value: string | boolean; error: string; touched: boolean; }

const RULES: Record<FieldKey, (v: string | boolean) => string> = {
  name: (v) => !String(v).trim() ? 'Enter your full name.' : (String(v).trim().length < 2 ? 'Name is too short.' : ''),
  email: (v) => !String(v).trim() ? 'Enter your work email.' : (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? 'Enter a valid email address.' : ''),
  pass: (v) => !v ? 'Choose a password.' : (String(v).length < 8 ? 'Use at least 8 characters.' : (!/\d/.test(String(v)) ? 'Include at least one number.' : '')),
  plan: (v) => !v ? 'Choose a plan to continue.' : '',
  terms: (v) => !v ? 'You must accept the terms.' : '',
};

const initialFields = (): Record<FieldKey, FieldState> => ({
  name: { id: 'vd-name', value: '', error: '', touched: false },
  email: { id: 'vd-email', value: '', error: '', touched: false },
  pass: { id: 'vd-pass', value: '', error: '', touched: false },
  plan: { id: 'vd-plan', value: '', error: '', touched: false },
  terms: { id: 'vd-terms', value: false, error: '', touched: false },
});

export function Validation() {
  const [fields, setFields] = useState<Record<FieldKey, FieldState>>(initialFields);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const errorCount = (Object.keys(fields) as FieldKey[]).filter((k) => fields[k].error).length;
  const summaryVisible = attempted && errorCount > 0;

  const setField = (k: FieldKey, patch: Partial<FieldState>) =>
    setFields((f) => ({ ...f, [k]: { ...f[k], ...patch } }));

  const revalidate = (k: FieldKey, value: string | boolean) => {
    setFields((f) => {
      const touched = f[k].touched;
      const error = (attempted || touched) ? RULES[k](value) : f[k].error;
      return { ...f, [k]: { ...f[k], value, error } };
    });
  };
  const touch = (k: FieldKey) => setFields((f) => ({ ...f, [k]: { ...f[k], touched: true, error: RULES[k](f[k].value) } }));
  const focusField = (k: FieldKey) => document.getElementById(fields[k].id)?.focus();

  const submit = () => {
    setAttempted(true);
    let count = 0;
    setFields((f) => {
      const next = { ...f };
      (Object.keys(next) as FieldKey[]).forEach((k) => {
        const error = RULES[k](next[k].value);
        if (error) count++;
        next[k] = { ...next[k], touched: true, error };
      });
      return next;
    });
    if (count > 0) {
      setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setDone(true); }, 1100);
  };

  const reset = () => {
    setDone(false); setAttempted(false); setSubmitting(false);
    setFields(initialFields());
  };

  const fieldClass = (k: FieldKey) => fields[k].error ? 'is-invalid' : (fields[k].touched && !fields[k].error ? 'is-valid' : '');

  return (
    <>
      <PageHead
        title="Form Validation"
        subtitle="Live valid &amp; invalid states, accessible error messaging, and a working submit demo."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/forms/layouts">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
            <span className="ax-btn__label">Layouts</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Static state reference */}
        <section className="ax-card ax-col--5" role="region" aria-label="Validation state reference">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Reference</span>
              <h2 className="ax-card__title">Field States</h2>
              <p className="ax-card__subtitle">Rest, valid, invalid &amp; disabled — side by side.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="vs-rest">Rest</label>
              <input id="vs-rest" type="text" className="ax-input" placeholder="you@company.com" />
              <span className="ax-field__message ax-help">We'll never share your address.</span>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="vs-valid">Valid</label>
              <div className="ax-field__control">
                <input id="vs-valid" type="text" className="ax-input is-valid ax-input--with-trailing" defaultValue="amelia.hart@northwind.io" aria-describedby="vs-valid-msg" />
                <span className="ax-field__affix ax-field__affix--trailing" aria-hidden="true" style={{ color: 'var(--ax-success-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg></span>
              </div>
              <span id="vs-valid-msg" className="ax-field__message ax-field__message--success">Looks good — this email is available.</span>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="vs-invalid">Invalid</label>
              <div className="ax-field__control">
                <input id="vs-invalid" type="text" className="ax-input is-invalid ax-input--with-trailing" defaultValue="amelia.hart@" aria-invalid="true" aria-describedby="vs-invalid-msg" />
                <span className="ax-field__affix ax-field__affix--trailing" aria-hidden="true" style={{ color: 'var(--ax-danger-500)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg></span>
              </div>
              <span id="vs-invalid-msg" className="ax-field__message ax-field__message--error" role="alert">Enter a complete email address, e.g. name@company.com.</span>
            </div>
            <div className="ax-field" style={{ opacity: 0.6 }}>
              <label className="ax-label" htmlFor="vs-disabled" style={{ color: 'var(--ax-text-muted)' }}>Disabled</label>
              <input id="vs-disabled" type="text" className="ax-input" defaultValue="locked@company.com" disabled />
              <span className="ax-field__message ax-help">Managed by your administrator.</span>
            </div>
          </div>
        </section>

        {/* Live demo form */}
        <section className="ax-card ax-col--7" role="region" aria-label="Live validation demo">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Live demo</span>
              <h2 className="ax-card__title">Create your account</h2>
              <p className="ax-card__subtitle">Validates on submit, then re-validates on input. Try submitting empty.</p>
            </div>
          </div>
          <div className="ax-card__body">
            {done ? (
              <div className="ax-alert ax-alert--success" role="status">
                <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" /></svg></span>
                <div className="ax-alert__content"><p className="ax-alert__title">Account created</p><p className="ax-alert__message">A confirmation link is on its way to <b>{String(fields.email.value)}</b>.</p></div>
                <div className="ax-alert__actions"><button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={reset}><span className="ax-btn__label">Start over</span></button></div>
              </div>
            ) : (
              <form className="ax-flex" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate style={{ flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                {summaryVisible && (
                  <div ref={summaryRef} tabIndex={-1} role="alert"
                    style={{ padding: 'var(--ax-space-4)', background: 'color-mix(in oklab,var(--ax-danger-500) 10%,transparent)', border: '1px solid color-mix(in oklab,var(--ax-danger-500) 35%,transparent)', borderRadius: 'var(--ax-radius-md)' }}>
                    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', color: 'var(--ax-danger-500)', fontWeight: 'var(--ax-weight-semibold)', fontSize: 'var(--ax-text-sm)' }}>
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                      <span>{'There ' + (errorCount === 1 ? 'is 1 problem' : 'are ' + errorCount + ' problems') + ' with this form'}</span>
                    </div>
                    <ul style={{ margin: 'var(--ax-space-2) 0 0', paddingInlineStart: 'var(--ax-space-6)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-danger-500)' }}>
                      {(Object.keys(fields) as FieldKey[]).map((k) => fields[k].error ? (
                        <li key={k}><a href={'#' + fields[k].id} onClick={(e) => { e.preventDefault(); focusField(k); }} style={{ color: 'inherit', textDecoration: 'underline' }}>{fields[k].error}</a></li>
                      ) : null)}
                    </ul>
                  </div>
                )}

                {/* name */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="vd-name">Full name <span className="ax-field__required" aria-hidden="true">*</span></label>
                  <input id="vd-name" type="text" className={`ax-input ${fieldClass('name')}`.trim()} value={String(fields.name.value)}
                    aria-invalid={fields.name.error ? 'true' : 'false'} aria-describedby="vd-name-msg"
                    onChange={(e) => revalidate('name', e.target.value)} onBlur={() => touch('name')} placeholder="Amelia Hart" />
                  <span id="vd-name-msg" className={`ax-field__message ${fields.name.error ? 'ax-field__message--error' : 'ax-help'}`}>{fields.name.error || 'Your name as it should appear on invoices.'}</span>
                </div>

                {/* email */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="vd-email">Work email <span className="ax-field__required" aria-hidden="true">*</span></label>
                  <div className="ax-field__control">
                    <input id="vd-email" type="email" className={`ax-input ax-input--with-trailing ${fieldClass('email')}`.trim()} value={String(fields.email.value)}
                      aria-invalid={fields.email.error ? 'true' : 'false'} aria-describedby="vd-email-msg"
                      onChange={(e) => revalidate('email', e.target.value)} onBlur={() => touch('email')} placeholder="you@company.com" />
                    {fields.email.touched && (
                      <span className="ax-field__affix ax-field__affix--trailing" aria-hidden="true" style={{ color: fields.email.error ? 'var(--ax-danger-500)' : 'var(--ax-success-500)' }}>
                        {fields.email.error
                          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5l10 -10" /></svg>}
                      </span>
                    )}
                  </div>
                  <span id="vd-email-msg" className={`ax-field__message ${fields.email.error ? 'ax-field__message--error' : 'ax-help'}`}>{fields.email.error || 'We send the confirmation link here.'}</span>
                </div>

                {/* password */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="vd-pass">Password <span className="ax-field__required" aria-hidden="true">*</span></label>
                  <input id="vd-pass" type="password" className={`ax-input ${fieldClass('pass')}`.trim()} value={String(fields.pass.value)}
                    aria-invalid={fields.pass.error ? 'true' : 'false'} aria-describedby="vd-pass-msg"
                    onChange={(e) => revalidate('pass', e.target.value)} onBlur={() => touch('pass')} placeholder="At least 8 characters" />
                  <span id="vd-pass-msg" className={`ax-field__message ${fields.pass.error ? 'ax-field__message--error' : 'ax-help'}`}>{fields.pass.error || 'Minimum 8 characters with one number.'}</span>
                </div>

                {/* plan select */}
                <div className="ax-field">
                  <label className="ax-label" htmlFor="vd-plan">Plan <span className="ax-field__required" aria-hidden="true">*</span></label>
                  <select id="vd-plan" className={`ax-select ${fieldClass('plan')}`.trim()} value={String(fields.plan.value)}
                    aria-invalid={fields.plan.error ? 'true' : 'false'} aria-describedby="vd-plan-msg"
                    onChange={(e) => { revalidate('plan', e.target.value); touch('plan'); }}>
                    <option value="">Select a plan…</option>
                    <option value="starter">Starter — $29/mo</option>
                    <option value="growth">Growth — $79/mo</option>
                    <option value="scale">Scale — $199/mo</option>
                  </select>
                  <span id="vd-plan-msg" className={`ax-field__message ${fields.plan.error ? 'ax-field__message--error' : 'ax-help'}`}>{fields.plan.error || 'Change or cancel any time.'}</span>
                </div>

                {/* terms */}
                <div className="ax-field">
                  <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'flex-start', minHeight: 'auto' }}>
                    <input type="checkbox" className={`ax-checkbox ${fields.terms.error ? 'is-invalid' : ''}`.trim()} checked={Boolean(fields.terms.value)}
                      onChange={(e) => { revalidate('terms', e.target.checked); touch('terms'); }} style={{ marginTop: 2 }}
                      aria-invalid={fields.terms.error ? 'true' : 'false'} aria-describedby="vd-terms-msg" />
                    <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>I agree to the <a className="ax-link" href="#">Terms</a> and <a className="ax-link" href="#">Privacy Policy</a>.</span>
                  </label>
                  {fields.terms.error && <span id="vd-terms-msg" className="ax-field__message ax-field__message--error">{fields.terms.error}</span>}
                </div>

                <div className="ax-cluster" style={{ justifyContent: 'flex-end', gap: 'var(--ax-space-3)' }}>
                  <button type="reset" className="ax-btn ax-btn--ghost" onClick={reset}><span className="ax-btn__label">Reset</span></button>
                  <button type="submit" className="ax-btn ax-btn--primary" disabled={submitting} aria-busy={submitting}>
                    {submitting && <span className="ax-spinner ax-spinner--xs" aria-hidden="true" />}
                    <span className="ax-btn__label">{submitting ? 'Creating…' : 'Create account'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

export default Validation;
