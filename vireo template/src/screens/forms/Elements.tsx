'use client';
/*
 * Vireo Next.js — Forms / Elements (route "forms/elements").
 *
 * Faithful re-expression of src/html/forms/elements.html: every native control —
 * text inputs (leading icon, password reveal, read-only, disabled), number stepper,
 * addon groups, auto-grow textarea + counter, checkbox/radio (indeterminate), switches,
 * native selects, range sliders with a live bubble, and a file upload block (button +
 * dropzone + queued list). The Alpine x-data bits are ported to React state; classes +
 * ARIA match the reference 1:1.
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';

const EyeOpen = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
);
const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
);

export function Elements() {
  const [showPass, setShowPass] = useState(false);
  const [qty, setQty] = useState(12);
  const [note, setNote] = useState('Ship the Q3 release notes to the design channel before standup.');
  const [range1, setRange1] = useState(62);
  const [range2, setRange2] = useState(35);
  const [file, setFile] = useState('');
  const [over, setOver] = useState(false);
  const indetRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (indetRef.current) indetRef.current.indeterminate = true; }, []);

  return (
    <>
      <PageHead
        title="Form Elements"
        subtitle="Every native control — text, select, choice, switch, range, file — in its Aurora glass dress."
        actions={
          <>
            <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/forms/floating-labels">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3" /><path d="M6 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3" /><path d="M13 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-7" /><path d="M5 7h-1a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h1" /></svg>
              <span className="ax-btn__label">Floating labels</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 13l2 2l4 -4" /></svg>
              <span className="ax-btn__label">Save preset</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Text inputs */}
        <section className="ax-card ax-col--6" role="region" aria-label="Text inputs">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Type</span>
              <h2 className="ax-card__title">Text Inputs</h2>
              <p className="ax-card__subtitle">Plain, leading icon, trailing affordance, read-only &amp; disabled.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-name">Full name <span className="ax-field__required" aria-hidden="true">*</span></label>
              <input id="fe-name" type="text" className="ax-input" defaultValue="Camila Rossi" autoComplete="name" />
              <span className="ax-help">As it appears on your billing account.</span>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-email">Work email</label>
              <div className="ax-field__control">
                <span className="ax-field__affix ax-field__affix--leading" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg></span>
                <input id="fe-email" type="email" className="ax-input ax-input--with-leading-icon" defaultValue="camila@northwind.io" autoComplete="email" />
              </div>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-pass">Password</label>
              <div className="ax-field__control">
                <input id="fe-pass" type={showPass ? 'text' : 'password'} className="ax-input ax-input--with-trailing" defaultValue="aurora-glass-42" autoComplete="off" />
                <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                  {showPass ? EyeOff : EyeOpen}
                </button>
              </div>
              <span className="ax-help">Use 12+ characters with a symbol.</span>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-readonly">Account ID (read-only)</label>
              <input id="fe-readonly" type="text" className="ax-input ax-num" defaultValue="ACC-2025-04821" readOnly style={{ fontFamily: 'var(--ax-font-mono)', letterSpacing: '.04em' }} />
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-disabled" style={{ color: 'var(--ax-text-muted)' }}>Legacy SSO (disabled)</label>
              <input id="fe-disabled" type="text" className="ax-input" defaultValue="Managed by Okta" disabled />
            </div>
          </div>
        </section>

        {/* Number, group & textarea */}
        <section className="ax-card ax-col--6" role="region" aria-label="Number, input groups and textarea">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Type</span>
              <h2 className="ax-card__title">Number, Groups &amp; Textarea</h2>
              <p className="ax-card__subtitle">Stepper, addon groups, and an auto-grow textarea with counter.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-qty">Quantity</label>
              <div className="ax-input-group" style={{ maxWidth: 180 }}>
                <button type="button" className="ax-input-group__addon" onClick={() => setQty((q) => Math.max(0, q - 1))} aria-label="Decrease quantity" style={{ cursor: 'pointer', background: 'var(--ax-surface-subtle)' }}>−</button>
                <input id="fe-qty" type="text" className="ax-input ax-num" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} inputMode="numeric" style={{ textAlign: 'center', fontFamily: 'var(--ax-font-mono)' }} />
                <button type="button" className="ax-input-group__addon" onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity" style={{ cursor: 'pointer', background: 'var(--ax-surface-subtle)' }}>+</button>
              </div>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-amount">Budget</label>
              <div className="ax-input-group">
                <span className="ax-input-group__addon" aria-hidden="true">$</span>
                <input id="fe-amount" type="text" className="ax-input ax-num" defaultValue="4,250.00" inputMode="decimal" style={{ fontFamily: 'var(--ax-font-mono)' }} />
                <span className="ax-input-group__addon">USD</span>
              </div>
              <span className="ax-help">Monthly cap before approval is required.</span>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-handle">Workspace URL</label>
              <div className="ax-input-group">
                <span className="ax-input-group__addon">vireo.app/</span>
                <input id="fe-handle" type="text" className="ax-input" defaultValue="northwind-labs" />
              </div>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-note">Internal note</label>
              <textarea id="fe-note" className="ax-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="Add a short note…" />
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <span className="ax-help">Visible to teammates with editor access.</span>
                <span className="ax-help ax-num" style={{ fontFamily: 'var(--ax-font-mono)' }}>{note.length} / 240</span>
              </div>
            </div>
          </div>
        </section>

        {/* Checkbox & radio */}
        <section className="ax-card ax-col--4" role="region" aria-label="Checkboxes and radios">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Choice</span>
              <h2 className="ax-card__title">Checkbox &amp; Radio</h2>
              <p className="ax-card__subtitle">18px controls, indeterminate &amp; grouped.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div>
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Notifications</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto' }}>
                  <input type="checkbox" className="ax-checkbox" ref={indetRef} />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>All channels <span style={{ color: 'var(--ax-text-subtle)' }}>(mixed)</span></span>
                </label>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto', paddingInlineStart: 'var(--ax-space-5)' }}>
                  <input type="checkbox" className="ax-checkbox" defaultChecked />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Product updates</span>
                </label>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto', paddingInlineStart: 'var(--ax-space-5)' }}>
                  <input type="checkbox" className="ax-checkbox" />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Weekly digest</span>
                </label>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto', opacity: 0.55 }}>
                  <input type="checkbox" className="ax-checkbox" defaultChecked disabled />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Security alerts (locked)</span>
                </label>
              </div>
            </div>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <div role="radiogroup" aria-label="Plan">
              <div className="ax-label" style={{ marginBottom: 'var(--ax-space-3)' }}>Billing cycle</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto' }}>
                  <input type="radio" name="fe-cycle" className="ax-radio" defaultChecked />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Monthly — <span className="ax-num">$29</span>/mo</span>
                </label>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto' }}>
                  <input type="radio" name="fe-cycle" className="ax-radio" />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Annual — <span className="ax-num">$290</span>/yr <span style={{ color: 'var(--ax-viz-emerald)' }}>save 17%</span></span>
                </label>
                <label className="ax-check" style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', minHeight: 'auto', opacity: 0.55 }}>
                  <input type="radio" name="fe-cycle" className="ax-radio" disabled />
                  <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>Enterprise (contact sales)</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* Switches */}
        <section className="ax-card ax-col--4" role="region" aria-label="Switches">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Choice</span>
              <h2 className="ax-card__title">Switches</h2>
              <p className="ax-card__subtitle">role=switch, three sizes.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)' }}>
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Two-factor auth</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Require a code at sign-in.</div>
              </div>
              <input type="checkbox" role="switch" className="ax-switch ax-switch--lg" defaultChecked aria-label="Two-factor auth" />
            </div>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Desktop push</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Default size control.</div>
              </div>
              <input type="checkbox" role="switch" className="ax-switch" aria-label="Desktop push" />
            </div>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Beta features</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Small size control.</div>
              </div>
              <input type="checkbox" role="switch" className="ax-switch ax-switch--sm" defaultChecked aria-label="Beta features" />
            </div>
            <hr className="ax-divider" style={{ margin: 0 }} />
            <div className="ax-cluster" style={{ justifyContent: 'space-between', opacity: 0.55 }}>
              <div>
                <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>Maintenance mode</div>
                <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>Disabled (admin only).</div>
              </div>
              <input type="checkbox" role="switch" className="ax-switch" disabled aria-label="Maintenance mode" />
            </div>
          </div>
        </section>

        {/* Native select */}
        <section className="ax-card ax-col--4" role="region" aria-label="Native select">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Type</span>
              <h2 className="ax-card__title">Native Select</h2>
              <p className="ax-card__subtitle">Single, grouped &amp; sizes.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-country">Country</label>
              <select id="fe-country" className="ax-select" defaultValue="United States">
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Germany</option>
                <option>Japan</option>
                <option>Australia</option>
              </select>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-timezone">Timezone</label>
              <select id="fe-timezone" className="ax-select" defaultValue="Eastern (EST)">
                <optgroup label="Americas">
                  <option>Pacific (PST)</option>
                  <option>Eastern (EST)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option>London (GMT)</option>
                  <option>Berlin (CET)</option>
                </optgroup>
              </select>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-size-sm">Page size (compact)</label>
              <select id="fe-size-sm" className="ax-select ax-select--sm" defaultValue="25 rows">
                <option>10 rows</option><option>25 rows</option><option>50 rows</option>
              </select>
            </div>
            <div className="ax-field">
              <label className="ax-label" htmlFor="fe-size-lg">Density (large)</label>
              <select id="fe-size-lg" className="ax-select ax-select--lg" defaultValue="Cozy">
                <option>Comfortable</option><option>Cozy</option><option>Compact</option>
              </select>
            </div>
          </div>
        </section>

        {/* Range slider */}
        <section className="ax-card ax-col--6" role="region" aria-label="Range slider">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Type</span>
              <h2 className="ax-card__title">Range Slider</h2>
              <p className="ax-card__subtitle">Live value bubble bound with React.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <label className="ax-label" htmlFor="fe-range1">Monthly budget</label>
                <span className="ax-range__bubble ax-num">${(range1 * 50).toLocaleString()}</span>
              </div>
              <div className="ax-range">
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>$0</span>
                <input id="fe-range1" type="range" className="ax-range--native" min={0} max={100} value={range1} onChange={(e) => setRange1(Number(e.target.value))} style={{ flex: 1 }} aria-label="Monthly budget" />
                <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>$5k</span>
              </div>
            </div>
            <div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <label className="ax-label" htmlFor="fe-range2">Image quality</label>
                <span className="ax-range__bubble ax-num">{range2}%</span>
              </div>
              <input id="fe-range2" type="range" className="ax-range--native" min={0} max={100} step={5} value={range2} onChange={(e) => setRange2(Number(e.target.value))} style={{ width: '100%' }} aria-label="Image quality" />
            </div>
            <div style={{ opacity: 0.55 }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--ax-space-3)' }}>
                <label className="ax-label" htmlFor="fe-range3" style={{ color: 'var(--ax-text-muted)' }}>Volume (disabled)</label>
                <span className="ax-range__bubble ax-num">—</span>
              </div>
              <input id="fe-range3" type="range" className="ax-range--native" min={0} max={100} defaultValue={40} disabled style={{ width: '100%' }} aria-label="Volume" />
            </div>
          </div>
        </section>

        {/* File upload */}
        <section className="ax-card ax-col--6" role="region" aria-label="File upload">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Type</span>
              <h2 className="ax-card__title">File Upload</h2>
              <p className="ax-card__subtitle">Button + filename, dropzone &amp; queued list.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label">Profile photo</label>
              <div className="ax-cluster" style={{ gap: 'var(--ax-space-3)' }}>
                <label className="ax-btn ax-btn--secondary" style={{ cursor: 'pointer' }}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
                  <span className="ax-btn__label">Choose file</span>
                  <input type="file" className="ax-visually-hidden" onChange={(e) => setFile(e.target.files?.[0]?.name || '')} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>{file || 'No file selected'}</span>
              </div>
            </div>
            <div className="ax-field">
              <label className="ax-label">Attachments</label>
              <div className="ax-dropzone">
                <label className={`ax-dropzone__area${over ? ' is-dragover' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={(e) => { e.preventDefault(); setOver(false); }} onDrop={(e) => { e.preventDefault(); setOver(false); }} style={{ cursor: 'pointer' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 9l5 -5l5 5" /><path d="M12 4l0 12" /></svg>
                  <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{over ? 'Drop to upload' : 'Drag files here, or click to browse'}</div>
                  <div style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>PNG, JPG or PDF — up to 10MB each</div>
                  <input type="file" multiple className="ax-visually-hidden" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
              </div>
            </div>
            <ul className="ax-dropzone__list">
              <li className="ax-dropzone__file">
                <span aria-hidden="true" style={{ color: 'var(--ax-viz-cyan)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg></span>
                <span className="ax-dropzone__name">brand-guidelines.pdf <span className="ax-num" style={{ color: 'var(--ax-text-subtle)' }}>· 2.4 MB</span></span>
                <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Done</span>
                <button type="button" className="ax-dropzone__remove" aria-label="Remove brand-guidelines.pdf"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </li>
              <li className="ax-dropzone__file">
                <span aria-hidden="true" style={{ color: 'var(--ax-viz-violet)' }}><svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg></span>
                <span className="ax-dropzone__name">hero-mockup.png <span className="ax-num" style={{ color: 'var(--ax-text-subtle)' }}>· 6.1 MB</span></span>
                <div className="ax-progress ax-progress--xs" style={{ flex: '0 0 90px' }}><div className="ax-progress__track"><div className="ax-progress__fill" style={{ width: '68%' }} /></div></div>
                <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>68%</span>
                <button type="button" className="ax-dropzone__remove" aria-label="Cancel hero-mockup.png"><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg></button>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

export default Elements;
