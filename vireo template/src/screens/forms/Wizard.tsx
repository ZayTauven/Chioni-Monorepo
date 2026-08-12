'use client';
/*
 * Vireo Next.js — Forms / Wizard (route "forms/wizard").
 *
 * Faithful re-expression of src/html/forms/wizard.html: a 4-step onboarding flow
 * (Account · Workspace · Preferences · Review) with a circular stepper header,
 * per-step validation + accessible error summary, a help/progress side rail, a
 * sticky action row, and a success state. The Alpine axWizard() factory is ported
 * to React state; rules, messages, ARIA and classes match the reference 1:1.
 */
import { useRef, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const ic = (path: ReactElement): ReactElement => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

interface Step { id: string; label: string; sub: string; hint: string; icon: ReactElement; helpTitle: string; help: string; }
const STEPS: Step[] = [
  { id: 'account', label: 'Account', sub: 'Tell us who you are.', hint: 'Your details', icon: ic(<><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></>), helpTitle: 'About your account', help: 'We use your work email to send the workspace invite and important security notices. Your password is hashed and never stored in plain text.' },
  { id: 'workspace', label: 'Workspace', sub: 'Set up your team space.', hint: 'Team setup', icon: ic(<><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /><path d="M9 9l0 .01" /><path d="M9 12l0 .01" /><path d="M9 15l0 .01" /></>), helpTitle: 'Naming your workspace', help: 'The workspace name appears across the app and in invites. The URL slug is generated automatically and can be changed later in settings.' },
  { id: 'prefs', label: 'Preferences', sub: 'Choose how you want to work.', hint: 'Fine-tune', icon: ic(<><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></>), helpTitle: 'Final touches', help: 'Set your timezone so reminders fire at the right moment, and pick which notifications matter to you. Everything here is editable later.' },
  { id: 'review', label: 'Review', sub: 'Double-check before we create everything.', hint: 'Confirm', icon: ic(<><path d="M9 12l2 2l4 -4" /><path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" /></>), helpTitle: 'Ready to launch', help: 'Review your selections and create the workspace. We will provision it instantly and email an invite to your team.' },
];

interface Use { id: string; label: string; desc: string; }
const USES: Use[] = [
  { id: 'product', label: 'Product', desc: 'Roadmaps & specs' },
  { id: 'eng', label: 'Engineering', desc: 'Issues & sprints' },
  { id: 'design', label: 'Design', desc: 'Files & reviews' },
  { id: 'ops', label: 'Operations', desc: 'Docs & workflows' },
];

interface Notif { id: string; title: string; desc: string; on: boolean; }
const INITIAL_NOTIFS: Notif[] = [
  { id: 'mentions', title: 'Mentions', desc: 'When someone @mentions you.', on: true },
  { id: 'assigned', title: 'Assignments', desc: 'When work is assigned to you.', on: true },
  { id: 'digest', title: 'Weekly digest', desc: 'A Monday summary by email.', on: false },
];

interface Form {
  first: string; last: string; email: string; pass: string;
  workspace: string; teamSize: string; use: string; tz: string; terms: boolean;
}
const INITIAL_FORM: Form = { first: 'Maya', last: 'Chen', email: '', pass: '', workspace: 'Acme Studio', teamSize: '2–10 people', use: 'product', tz: '(GMT-08:00) Pacific Time', terms: false };

type Errors = Partial<Record<'first' | 'last' | 'email' | 'pass' | 'workspace' | 'terms', string>>;

const CHECK = <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>;

export function Wizard() {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<Form>(INITIAL_FORM);
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const [errors, setErrors] = useState<Errors>({});
  const errSummaryRef = useRef<HTMLDivElement>(null);

  const errorList = Object.values(errors).filter(Boolean) as string[];

  const setF = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const slug = () => (form.workspace || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';

  const computeErrors = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (!form.first.trim()) e.first = 'First name is required.';
      if (!form.last.trim()) e.last = 'Last name is required.';
      if (!form.email.trim()) e.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
      if (!form.pass) e.pass = 'Password is required.';
      else if (form.pass.length < 8) e.pass = 'Use at least 8 characters.';
    }
    if (s === 1) { if (!form.workspace.trim()) e.workspace = 'Workspace name is required.'; }
    if (s === 2) { if (!form.terms) e.terms = 'You must accept the terms to continue.'; }
    return e;
  };

  const validate = (s: number): boolean => {
    const e = computeErrors(s);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    const e = computeErrors(step);
    setErrors(e);
    if (Object.keys(e).length) { setTimeout(() => errSummaryRef.current?.focus(), 0); return; }
    if (step < STEPS.length - 1) {
      const ns = step + 1;
      setStep(ns); setMaxReached((m) => Math.max(m, ns)); setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const prev = () => {
    if (step > 0) { setErrors({}); setStep((s) => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const goTo = (i: number) => {
    if (i < step) { setErrors({}); setStep(i); }
    else if (i <= maxReached) { if (validate(step)) { setStep(i); setErrors({}); } }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = () => {
    if (!validate(step)) return;
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 900);
  };
  const reset = () => { setSubmitted(false); setStep(0); setMaxReached(0); setErrors({}); };

  const completion = Math.round((step) / (STEPS.length - 1) * 100);

  return (
    <>
      <PageHead
        title="Form wizard"
        subtitle="A multi-step onboarding flow — validated per step, with a review summary before submit."
        actions={
          <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>{`Step ${step + 1} of ${STEPS.length}`}</span>
        }
      />

      {/* success state */}
      {submitted && (
        <div className="ax-dash-grid">
          <section className="ax-card ax-col--12" role="region" aria-label="Submission complete">
            <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--ax-space-4)', padding: 'var(--ax-space-10) var(--ax-space-6)' }}>
              <span className="ax-center" style={{ width: 72, height: 72, borderRadius: '50%', background: 'color-mix(in oklab,var(--ax-viz-emerald) 18%,transparent)', color: 'var(--ax-viz-emerald)' }}>
                <svg viewBox="0 0 24 24" width={34} height={34} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              </span>
              <h2 className="ax-display" style={{ fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)', margin: 0 }}>Workspace created</h2>
              <p style={{ margin: 0, maxWidth: '40ch', color: 'var(--ax-text-muted)' }}>We&apos;ve set up <b style={{ color: 'var(--ax-text-strong)' }}>{form.workspace || 'your workspace'}</b> and emailed an invite to <b style={{ color: 'var(--ax-text-strong)' }}>{form.email || 'your team'}</b>. You&apos;re all set.</p>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-2)' }}>
                <button type="button" className="ax-btn ax-btn--secondary" onClick={reset}>Start over</button>
                <Link className="ax-btn ax-btn--primary" href="/"><span className="ax-btn__label">Go to dashboard</span></Link>
              </div>
            </div>
          </section>
        </div>
      )}

      {!submitted && (
        <div className="ax-dash-grid">

          {/* ───── STEPPER HEADER ───── */}
          <div className="ax-card ax-col--12" role="region" aria-label="Wizard progress">
            <div className="ax-card__body" style={{ padding: 'var(--ax-space-5) var(--ax-space-6)' }}>
              <ol style={{ display: 'flex', alignItems: 'flex-start', gap: 0, listStyle: 'none', margin: 0, padding: 0 }} aria-label="Onboarding steps">
                {STEPS.map((s, i) => (
                  <li key={s.id} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 0 }}>
                    {i > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 18, height: 2, insetInlineEnd: '50%', width: '100%', background: i <= step ? 'var(--ax-accent)' : 'var(--ax-border)' }} />}
                    <button type="button" onClick={() => goTo(i)} disabled={i > maxReached}
                      aria-current={i === step ? 'step' : 'false'} aria-label={`Step ${i + 1}: ${s.label}`}
                      style={{
                        position: 'relative', zIndex: 1, width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center',
                        fontFamily: 'var(--ax-font-mono)', fontWeight: 600, fontSize: 'var(--ax-text-sm)', border: '2px solid',
                        transition: 'all var(--ax-motion-fast) var(--ax-ease-standard)',
                        ...(i < step
                          ? { background: 'var(--ax-accent)', borderColor: 'var(--ax-accent)', color: 'var(--ax-on-accent)', cursor: 'pointer' }
                          : i === step
                            ? { background: 'var(--ax-surface-solid)', borderColor: 'var(--ax-accent)', color: 'var(--ax-accent)', boxShadow: '0 0 0 4px var(--ax-accent-wash)' }
                            : { background: 'var(--ax-surface-solid)', borderColor: 'var(--ax-border-strong)', color: 'var(--ax-text-subtle)', cursor: 'default' }),
                      }}>
                      {i < step ? CHECK : (i === step ? s.icon : (i + 1))}
                    </button>
                    <span style={{ marginTop: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', textAlign: 'center', fontWeight: 'var(--ax-weight-medium)', color: i === step ? 'var(--ax-text-strong)' : i < step ? 'var(--ax-text)' : 'var(--ax-text-subtle)' }}>{s.label}</span>
                    <span className="ax-step-hint" style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', textAlign: 'center' }}>{s.hint}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* ───── PANEL ───── */}
          <section className="ax-card ax-col--8" role="region" aria-label={STEPS[step].label} style={{ minHeight: 380 }}>
            <div className="ax-card__header">
              <div className="ax-card__titles">
                <span className="ax-card__eyebrow">{`Step ${step + 1} of ${STEPS.length}`}</span>
                <h2 className="ax-card__title">{STEPS[step].label}</h2>
                <p className="ax-card__subtitle">{STEPS[step].sub}</p>
              </div>
            </div>
            <div className="ax-card__body" style={{ paddingTop: 0 }}>

              {/* error summary */}
              {errorList.length > 0 && (
                <div className="ax-alert ax-alert--danger" role="alert" tabIndex={-1} ref={errSummaryRef} style={{ marginBottom: 'var(--ax-space-5)' }}>
                  <span className="ax-alert__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0" /></svg></span>
                  <div className="ax-alert__content">
                    <div className="ax-alert__title">{`Please fix ${errorList.length} field${errorList.length === 1 ? '' : 's'} to continue`}</div>
                    <ul className="ax-alert__message" style={{ margin: '4px 0 0', paddingInlineStart: '1.1em' }}>{errorList.map((e) => <li key={e}>{e}</li>)}</ul>
                  </div>
                </div>
              )}

              {/* ░░ STEP 1 · ACCOUNT ░░ */}
              {step === 0 && (
                <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-5)' }}>
                    <div className="ax-field">
                      <label className="ax-label" htmlFor="w-first">First name <span className="ax-field__required">*</span></label>
                      <input id="w-first" type="text" className={`ax-input ${errors.first ? 'is-invalid' : ''}`} value={form.first} onChange={(e) => setF('first', e.target.value)} aria-invalid={!!errors.first} autoComplete="given-name" />
                      {errors.first && <span className="ax-field__message ax-error">{errors.first}</span>}
                    </div>
                    <div className="ax-field">
                      <label className="ax-label" htmlFor="w-last">Last name <span className="ax-field__required">*</span></label>
                      <input id="w-last" type="text" className={`ax-input ${errors.last ? 'is-invalid' : ''}`} value={form.last} onChange={(e) => setF('last', e.target.value)} aria-invalid={!!errors.last} autoComplete="family-name" />
                      {errors.last && <span className="ax-field__message ax-error">{errors.last}</span>}
                    </div>
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="w-email">Work email <span className="ax-field__required">*</span></label>
                    <div className="ax-field__control">
                      <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
                      <input id="w-email" type="email" className={`ax-input ax-input--with-leading-icon ${errors.email ? 'is-invalid' : ''}`} value={form.email} onChange={(e) => setF('email', e.target.value)} aria-invalid={!!errors.email} placeholder="you@company.com" autoComplete="email" />
                    </div>
                    {errors.email && <span className="ax-field__message ax-error">{errors.email}</span>}
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="w-pass">Password <span className="ax-field__required">*</span></label>
                    <input id="w-pass" type="password" className={`ax-input ${errors.pass ? 'is-invalid' : ''}`} value={form.pass} onChange={(e) => setF('pass', e.target.value)} aria-invalid={!!errors.pass} autoComplete="new-password" />
                    <span className={`ax-field__message ${errors.pass ? 'ax-error' : ''}`} style={errors.pass ? undefined : { color: 'var(--ax-text-subtle)' }}>{errors.pass || 'At least 8 characters.'}</span>
                  </div>
                </div>
              )}

              {/* ░░ STEP 2 · WORKSPACE ░░ */}
              {step === 1 && (
                <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="w-name">Workspace name <span className="ax-field__required">*</span></label>
                    <input id="w-name" type="text" className={`ax-input ${errors.workspace ? 'is-invalid' : ''}`} value={form.workspace} onChange={(e) => setF('workspace', e.target.value)} aria-invalid={!!errors.workspace} placeholder="Acme Studio" />
                    {errors.workspace && <span className="ax-field__message ax-error">{errors.workspace}</span>}
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="w-url">Workspace URL</label>
                    <div className="ax-input-group">
                      <span className="ax-input-group__addon">vireo.app/</span>
                      <input id="w-url" type="text" className="ax-input ax-mono" value={slug()} readOnly aria-label="Workspace URL slug" />
                    </div>
                    <span className="ax-help">Generated from the workspace name.</span>
                  </div>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="w-size">Team size</label>
                    <select id="w-size" className="ax-select" value={form.teamSize} onChange={(e) => setF('teamSize', e.target.value)}>
                      <option>Just me</option><option>2–10 people</option><option>11–50 people</option><option>51–200 people</option><option>200+ people</option>
                    </select>
                  </div>
                  <div className="ax-field">
                    <span className="ax-label">Primary use</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3)', marginTop: 'var(--ax-space-1)' }}>
                      {USES.map((u) => (
                        <label key={u.id} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', border: '1.5px solid', borderRadius: 'var(--ax-radius-md)', transition: 'border-color var(--ax-motion-fast) var(--ax-ease-standard)', ...(form.use === u.id ? { borderColor: 'var(--ax-accent)', background: 'var(--ax-accent-wash)' } : { borderColor: 'var(--ax-border)' }) }}>
                          <input type="radio" className="ax-radio" name="use" value={u.id} checked={form.use === u.id} onChange={() => setF('use', u.id)} />
                          <span style={{ display: 'flex', flexDirection: 'column' }}><b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>{u.label}</b><span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{u.desc}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ░░ STEP 3 · PREFERENCES ░░ */}
              {step === 2 && (
                <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                  <div className="ax-field">
                    <label className="ax-label" htmlFor="w-tz">Timezone</label>
                    <select id="w-tz" className="ax-select" value={form.tz} onChange={(e) => setF('tz', e.target.value)}>
                      <option>(GMT-08:00) Pacific Time</option><option>(GMT-05:00) Eastern Time</option><option>(GMT+00:00) London</option><option>(GMT+01:00) Berlin</option><option>(GMT+05:30) India</option><option>(GMT+09:00) Tokyo</option>
                    </select>
                  </div>
                  <div>
                    <span className="ax-label" style={{ display: 'block', marginBottom: 'var(--ax-space-3)' }}>Notifications</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-1)' }}>
                      {notifs.map((n) => (
                        <label key={n.id} className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-4)', cursor: 'pointer', padding: 'var(--ax-space-3) 0', borderBottom: '1px solid var(--ax-border)' }}>
                          <span><span style={{ display: 'block', fontWeight: 500, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{n.title}</span><span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>{n.desc}</span></span>
                          <input type="checkbox" className="ax-switch" role="switch" checked={n.on} onChange={() => setNotifs((list) => list.map((x) => x.id === n.id ? { ...x, on: !x.on } : x))} aria-label={n.title} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="ax-check" style={{ alignItems: 'flex-start' }}>
                    <input type="checkbox" className={`ax-checkbox ${errors.terms ? 'is-invalid' : ''}`} checked={form.terms} onChange={(e) => setF('terms', e.target.checked)} aria-invalid={!!errors.terms} style={{ marginTop: 2 }} />
                    <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>I agree to the <Link className="ax-link" href="/pages/terms">Terms of Service</Link> and <Link className="ax-link" href="/pages/privacy">Privacy Policy</Link>. <span className="ax-field__required">*</span></span>
                  </label>
                  {errors.terms && <span className="ax-field__message ax-error" style={{ marginTop: -12 }}>{errors.terms}</span>}
                </div>
              )}

              {/* ░░ STEP 4 · REVIEW ░░ */}
              {step === 3 && (
                <div className="ax-flex" style={{ flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
                  <p style={{ margin: 0, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Confirm your details below. Use the <b style={{ color: 'var(--ax-text)' }}>Edit</b> links to jump back to any section.</p>
                  {/* account */}
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-subtle)' }}>
                      <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Account</b>
                      <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(0)}>Edit</button>
                    </div>
                    <dl style={{ margin: 0, padding: 'var(--ax-space-4)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--ax-space-2) var(--ax-space-5)', fontSize: 'var(--ax-text-sm)' }}>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Name</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{(form.first + ' ' + form.last).trim() || '—'}</dd>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Email</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{form.email || '—'}</dd>
                    </dl>
                  </div>
                  {/* workspace */}
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-subtle)' }}>
                      <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Workspace</b>
                      <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(1)}>Edit</button>
                    </div>
                    <dl style={{ margin: 0, padding: 'var(--ax-space-4)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--ax-space-2) var(--ax-space-5)', fontSize: 'var(--ax-text-sm)' }}>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Name</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{form.workspace || '—'}</dd>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>URL</dt><dd style={{ margin: 0 }} className="ax-mono">{'vireo.app/' + slug()}</dd>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Team size</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{form.teamSize}</dd>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Primary use</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{(USES.find((u) => u.id === form.use) || { label: '—' }).label || '—'}</dd>
                    </dl>
                  </div>
                  {/* prefs */}
                  <div style={{ border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', overflow: 'hidden' }}>
                    <div className="ax-cluster" style={{ justifyContent: 'space-between', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-subtle)' }}>
                      <b style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Preferences</b>
                      <button type="button" className="ax-btn ax-btn--link ax-btn--sm" onClick={() => goTo(2)}>Edit</button>
                    </div>
                    <dl style={{ margin: 0, padding: 'var(--ax-space-4)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--ax-space-2) var(--ax-space-5)', fontSize: 'var(--ax-text-sm)' }}>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Timezone</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{form.tz}</dd>
                      <dt style={{ color: 'var(--ax-text-subtle)' }}>Notifications</dt><dd style={{ margin: 0, color: 'var(--ax-text-strong)' }}>{notifs.filter((n) => n.on).map((n) => n.title).join(', ') || 'None'}</dd>
                    </dl>
                  </div>
                </div>
              )}

            </div>

            {/* sticky action row */}
            <div className="ax-card__footer" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--ax-border)' }}>
              {step > 0 ? (
                <button type="button" className="ax-btn ax-btn--ghost" onClick={prev}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
                  <span className="ax-btn__label">Back</span>
                </button>
              ) : <span />}
              {step < STEPS.length - 1 && (
                <button type="button" className="ax-btn ax-btn--primary" onClick={next}>
                  <span className="ax-btn__label">Continue</span>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
                </button>
              )}
              {step === STEPS.length - 1 && (
                <button type="button" className="ax-btn ax-btn--primary" onClick={submit} aria-busy={submitting}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
                  <span className="ax-btn__label">{submitting ? 'Creating…' : 'Create workspace'}</span>
                </button>
              )}
            </div>
          </section>

          {/* ───── HELP RAIL ───── */}
          <aside className="ax-col--4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <section className="ax-card" role="region" aria-label="Why we ask">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">{STEPS[step].helpTitle}</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0 }}>
                <p style={{ margin: 0, color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', lineHeight: 1.6 }}>{STEPS[step].help}</p>
              </div>
            </section>
            <section className="ax-card" role="region" aria-label="Your progress">
              <div className="ax-card__header"><div className="ax-card__titles"><h2 className="ax-card__title">Progress</h2></div></div>
              <div className="ax-card__body" style={{ paddingTop: 0 }}>
                <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-2)' }}>
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Completion</span>
                  <b className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', color: 'var(--ax-text-strong)' }}>{completion + '%'}</b>
                </div>
                <div className="ax-progress ax-progress--sm"><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: completion + '%' }} /></div></div>
                <ul style={{ listStyle: 'none', margin: 'var(--ax-space-4) 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                  {STEPS.map((s, i) => (
                    <li key={s.id} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-sm)', color: i <= step ? 'var(--ax-text)' : 'var(--ax-text-subtle)' }}>
                      <span className="ax-center" style={{ width: 18, height: 18, borderRadius: '50%', flex: '0 0 auto', ...(i < step ? { background: 'var(--ax-accent)', color: 'var(--ax-on-accent)' } : i === step ? { border: '2px solid var(--ax-accent)' } : { border: '1.5px solid var(--ax-border-strong)' }) }}>
                        {i < step && <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
                      </span>
                      <span>{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </aside>

        </div>
      )}

      <style>{`@media (min-width:992px){ .ax-step-hint{ display:block !important; } } .ax-step-hint{ display:none; }`}</style>
    </>
  );
}

export default Wizard;
