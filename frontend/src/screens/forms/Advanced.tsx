'use client';
/*
 * Vireo Next.js — Forms / Advanced controls (route "forms/advanced").
 *
 * Faithful re-expression of src/html/forms/advanced.html: tag/chip inputs (labels +
 * email chips with validity), single & multi comboboxes, an autocomplete typeahead,
 * a live password-strength meter, single/stepped/dual range sliders, an interactive
 * star rating, and a toggle grid — plus a save toast. The axAdvancedForms() Alpine
 * factory is ported to React state; classes + ARIA match the reference 1:1.
 */
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { useClickOutside } from '../../hooks/useClickOutside';

const okEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const X = (w = 13) => (
  <svg viewBox="0 0 24 24" width={w} height={w} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);
const Caret = (
  <svg className="ax-combobox__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
);

const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'Brazil', 'India', 'Singapore', 'Netherlands', 'Sweden'];
const STACK_GROUPS = [
  { label: 'Frontend', items: ['React', 'Vue', 'Svelte', 'Alpine.js', 'Tailwind CSS'] },
  { label: 'Backend', items: ['Node.js', 'Laravel', 'Django', 'Go', 'Rails'] },
  { label: 'Data', items: ['PostgreSQL', 'MySQL', 'Redis', 'MongoDB'] },
];
const PEOPLE = [
  { name: 'Maya Chen', role: 'Design lead', initials: 'MC', c: 'var(--ax-viz-cyan)' },
  { name: 'Devon Okafor', role: 'Engineering manager', initials: 'DO', c: 'var(--ax-viz-violet)' },
  { name: 'Priya Nair', role: 'Product designer', initials: 'PN', c: 'var(--ax-viz-pink)' },
  { name: 'Tomás Herrera', role: 'Frontend engineer', initials: 'TH', c: 'var(--ax-viz-amber)' },
  { name: 'Lena Brandt', role: 'Design engineer', initials: 'LB', c: 'var(--ax-viz-emerald)' },
];

const EyeOpen = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
);
const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
);
const Star = (
  <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" />
);
const StarFull = (
  <svg className="ax-rating__star ax-rating__star--full" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{Star}</svg>
);

const SWITCHES = [
  { id: 'email-digest', title: 'Weekly email digest', desc: 'A Monday-morning summary of activity.', on: true },
  { id: 'push', title: 'Push notifications', desc: 'Alerts on mentions and assignments.', on: true },
  { id: 'auto-save', title: 'Auto-save drafts', desc: 'Persist changes every few seconds.', on: true },
  { id: '2fa', title: 'Two-factor authentication', desc: 'Require a code at sign-in.', on: false },
  { id: 'beta', title: 'Beta features', desc: 'Opt into experimental UI early.', on: false },
  { id: 'analytics', title: 'Usage analytics', desc: 'Share anonymized product metrics.', on: true },
];

const DUAL_STYLE = `
.ax-range-dual::-webkit-slider-thumb { pointer-events:auto; }
.ax-range-dual::-moz-range-thumb { pointer-events:auto; }
@media (max-width:768px){ .ax-advanced-toggles{ grid-template-columns:1fr !important; } }
`;

export function Advanced() {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  // tags
  const [tags, setTags] = useState(['Frontend', 'Design system', 'High priority']);
  const [tagDraft, setTagDraft] = useState('');
  const tagFieldRef = useRef<HTMLInputElement>(null);
  const commitTag = () => { const v = tagDraft.trim().replace(/,$/, ''); if (v && !tags.includes(v)) setTags((t) => [...t, v]); setTagDraft(''); };
  const addTag = (v: string) => setTags((t) => t.includes(v) ? t : [...t, v]);
  const removeTag = (i: number) => setTags((t) => t.filter((_, idx) => idx !== i));

  // email chips
  const [emails, setEmails] = useState([{ value: 'maya.chen@vireo.app', valid: true }, { value: 'devon.okafor@vireo.app', valid: true }]);
  const [emailDraft, setEmailDraft] = useState('');
  const emailFieldRef = useRef<HTMLInputElement>(null);
  const commitEmail = () => { const v = emailDraft.trim().replace(/,$/, ''); if (v) setEmails((e) => [...e, { value: v, valid: okEmail(v) }]); setEmailDraft(''); };
  const removeEmail = (i: number) => setEmails((e) => e.filter((_, idx) => idx !== i));

  // single combobox
  const [cbxOpen, setCbxOpen] = useState(false);
  const [cbxSearch, setCbxSearch] = useState('');
  const [country, setCountry] = useState('United States');
  const cbxRef = useRef<HTMLDivElement>(null);
  useClickOutside(cbxRef, cbxOpen, () => setCbxOpen(false));
  const filteredCountries = COUNTRIES.filter((c) => c.toLowerCase().includes(cbxSearch.toLowerCase()));

  // multi combobox
  const [stackOpen, setStackOpen] = useState(false);
  const [stackSearch, setStackSearch] = useState('');
  const [stack, setStack] = useState(['React', 'Tailwind CSS', 'PostgreSQL']);
  const stackRef = useRef<HTMLDivElement>(null);
  useClickOutside(stackRef, stackOpen, () => setStackOpen(false));
  const filteredStack = STACK_GROUPS.map((g) => ({ label: g.label, items: g.items.filter((o) => o.toLowerCase().includes(stackSearch.toLowerCase())) })).filter((g) => g.items.length);
  const toggleStack = (o: string) => setStack((s) => s.includes(o) ? s.filter((x) => x !== o) : [...s, o]);

  // autocomplete
  const [acOpen, setAcOpen] = useState(false);
  const [acQuery, setAcQuery] = useState('');
  const acRef = useRef<HTMLDivElement>(null);
  useClickOutside(acRef, acOpen, () => setAcOpen(false));
  const filteredPeople = useMemo(() => {
    const q = acQuery.toLowerCase().trim();
    if (!q) return PEOPLE;
    return PEOPLE.filter((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q));
  }, [acQuery]);

  // password
  const [pw, setPw] = useState('');
  const [pwShown, setPwShown] = useState(false);
  const pwCriteria = [
    { label: '8+ characters', test: pw.length >= 8 },
    { label: 'Upper & lower', test: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: 'A number', test: /\d/.test(pw) },
    { label: 'A symbol', test: /[^A-Za-z0-9]/.test(pw) },
  ];
  const pwScore = pwCriteria.filter((c) => c.test).length;
  const pwLabel = ['Enter a password', 'Weak password', 'Fair password', 'Good password', 'Strong password'][pwScore];
  const pwBarClass = (i: number) => { if (i >= pwScore) return ''; if (pwScore <= 1) return 'is-weak'; if (pwScore <= 3) return 'is-medium'; return 'is-strong'; };

  // ranges
  const [vol, setVol] = useState(65);
  const [teamSize, setTeamSize] = useState(20);
  const [priceMin, setPriceMin] = useState(80);
  const [priceMax, setPriceMax] = useState(340);

  // rating
  const [rating, setRating] = useState(4);
  const [ratingHover, setRatingHover] = useState(0);

  // switches
  const [switches, setSwitches] = useState(SWITCHES);
  const setSwitch = (i: number, on: boolean) => setSwitches((s) => s.map((sw, idx) => idx === i ? { ...sw, on } : sw));

  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); setToast(true); setTimeout(() => setToast(false), 2600); }, 650); };

  const ratingLabel = ['Tap to rate', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][ratingHover || rating];

  return (
    <>
      <PageHead
        title="Advanced controls"
        subtitle="Sliders, toggles, tag inputs, comboboxes and rating widgets — the richer end of the form kit."
        actions={
          <>
            <Link className="ax-btn ax-btn--ghost" href="/forms/elements">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
              <span className="ax-btn__label">Basic elements</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary" onClick={save} aria-busy={saving}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
              <span className="ax-btn__label">{saving ? 'Saving…' : 'Save preferences'}</span>
            </button>
          </>
        }
      />

      <style>{DUAL_STYLE}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60 }}>
          <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', padding: 'var(--ax-space-3) var(--ax-space-4)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-lg)' }}>
            <span style={{ color: 'var(--ax-viz-emerald)' }}><svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg></span>
            <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-strong)' }}>Preferences saved</span>
          </div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="ax-dash-grid">
        {/* TAGS / CHIPS INPUT */}
        <section className="ax-card ax-col--6" role="region" aria-label="Tags input">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Tokenized input</span>
              <h2 className="ax-card__title">Tags &amp; chips</h2>
              <p className="ax-card__subtitle">Enter, comma or Tab commits · Backspace removes the last chip.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="tag-input">Project labels</label>
              <div className="ax-tags" onClick={() => tagFieldRef.current?.focus()}>
                {tags.map((t, i) => (
                  <span key={t} className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ gap: 6 }}>
                    <span>{t}</span>
                    <button type="button" onClick={() => removeTag(i)} aria-label={'Remove ' + t} style={{ display: 'inline-flex', background: 'none', border: 0, color: 'inherit', cursor: 'pointer', opacity: 0.8 }}>{X()}</button>
                  </span>
                ))}
                <input id="tag-input" ref={tagFieldRef} type="text" className="ax-tags__input" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitTag(); }
                    else if (e.key === ',') { e.preventDefault(); commitTag(); }
                    else if (e.key === 'Tab' && tagDraft.trim()) { e.preventDefault(); commitTag(); }
                    else if (e.key === 'Backspace' && !tagDraft && tags.length) removeTag(tags.length - 1);
                  }}
                  placeholder="Add a label…" aria-label="Add a label" />
              </div>
              <span className="ax-help">Suggested: <button type="button" className="ax-link" onClick={() => addTag('Frontend')}>Frontend</button> · <button type="button" className="ax-link" onClick={() => addTag('Urgent')}>Urgent</button> · <button type="button" className="ax-link" onClick={() => addTag('Q3')}>Q3</button></span>
            </div>

            <div className="ax-field">
              <label className="ax-label" htmlFor="email-tags">Invite collaborators</label>
              <div className="ax-tags" onClick={() => emailFieldRef.current?.focus()}>
                {emails.map((m, i) => (
                  <span key={m.value} className={`ax-badge ax-badge--soft ax-badge--pill ${m.valid ? 'ax-badge--neutral' : 'ax-badge--danger'}`} style={{ gap: 6 }}>
                    {!m.valid && <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0" /></svg>}
                    <span>{m.value}</span>
                    <button type="button" onClick={() => removeEmail(i)} aria-label={'Remove ' + m.value} style={{ display: 'inline-flex', background: 'none', border: 0, color: 'inherit', cursor: 'pointer', opacity: 0.8 }}>{X()}</button>
                  </span>
                ))}
                <input id="email-tags" ref={emailFieldRef} type="text" className="ax-tags__input" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); commitEmail(); } else if (e.key === ',') { e.preventDefault(); commitEmail(); } }}
                  placeholder="name@company.com" inputMode="email" aria-label="Invite by email" />
              </div>
              {emails.some((m) => !m.valid) && <span className="ax-field__message ax-error">One or more addresses look invalid — they're flagged in red.</span>}
            </div>
          </div>
        </section>

        {/* COMBOBOX / ENHANCED SELECT */}
        <section className="ax-card ax-col--6" role="region" aria-label="Enhanced select">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Searchable</span>
              <h2 className="ax-card__title">Combobox</h2>
              <p className="ax-card__subtitle">Type to filter · single &amp; multi-select with grouped options.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
            <div className="ax-field">
              <label className="ax-label" id="cbx-country-lbl">Country</label>
              <div className="ax-combobox" ref={cbxRef}>
                <button type="button" className="ax-combobox__trigger" aria-expanded={cbxOpen} aria-haspopup="listbox" aria-labelledby="cbx-country-lbl" onClick={() => setCbxOpen((o) => !o)}>
                  <span className="ax-combobox__value" style={!country ? { color: 'var(--ax-text-disabled)' } : undefined}>{country || 'Select a country…'}</span>
                  {Caret}
                </button>
                {cbxOpen && (
                  <div className="ax-combobox__panel" role="listbox" aria-label="Countries">
                    <input type="text" className="ax-combobox__search" value={cbxSearch} onChange={(e) => setCbxSearch(e.target.value)} placeholder="Search countries…" aria-label="Search countries" onClick={(e) => e.stopPropagation()} />
                    {filteredCountries.map((c) => (
                      <button key={c} type="button" className="ax-combobox__option" role="option" aria-selected={country === c} onClick={() => { setCountry(c); setCbxOpen(false); setCbxSearch(''); }}>
                        <span>{c}</span>
                        {country === c && <svg style={{ marginInlineStart: 'auto' }} viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
                      </button>
                    ))}
                    {!filteredCountries.length && <div className="ax-combobox__empty">No matches found</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="ax-field">
              <label className="ax-label" id="cbx-stack-lbl">Tech stack <span style={{ color: 'var(--ax-text-subtle)', fontWeight: 400 }}>({stack.length})</span></label>
              <div className="ax-combobox" ref={stackRef}>
                <button type="button" className="ax-combobox__trigger" aria-expanded={stackOpen} aria-haspopup="listbox" aria-labelledby="cbx-stack-lbl" onClick={() => setStackOpen((o) => !o)} style={{ flexWrap: 'wrap', minHeight: 42, paddingBlock: 5 }}>
                  {stack.length > 0 && (
                    <span className="ax-combobox__chips">
                      {stack.map((s, i) => (
                        <span key={s} className="ax-badge ax-badge--soft ax-badge--accent ax-badge--pill" style={{ gap: 5 }} onClick={(e) => e.stopPropagation()}>
                          <span>{s}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setStack((st) => st.filter((_, idx) => idx !== i)); }} aria-label={'Remove ' + s} style={{ display: 'inline-flex', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}>{X(12)}</button>
                        </span>
                      ))}
                    </span>
                  )}
                  {!stack.length && <span className="ax-combobox__value" style={{ color: 'var(--ax-text-disabled)' }}>Pick frameworks &amp; tools…</span>}
                  <svg className="ax-combobox__caret" style={{ marginInlineStart: 'auto' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
                </button>
                {stackOpen && (
                  <div className="ax-combobox__panel" role="listbox" aria-multiselectable="true" aria-label="Tech stack">
                    <input type="text" className="ax-combobox__search" value={stackSearch} onChange={(e) => setStackSearch(e.target.value)} placeholder="Search…" aria-label="Search stack" onClick={(e) => e.stopPropagation()} />
                    {filteredStack.map((group) => (
                      <div key={group.label}>
                        <div className="ax-combobox__group-label">{group.label}</div>
                        {group.items.map((o) => (
                          <button key={o} type="button" className="ax-combobox__option" role="option" aria-selected={stack.includes(o)} onClick={() => toggleStack(o)}>
                            <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: 5, border: '1.5px solid', alignItems: 'center', justifyContent: 'center', ...(stack.includes(o) ? { background: 'var(--ax-accent)', borderColor: 'var(--ax-accent)', color: 'var(--ax-on-accent)' } : { borderColor: 'var(--ax-border-strong)' }) }}>
                              {stack.includes(o) && <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
                            </span>
                            <span>{o}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                    {!filteredStack.length && <div className="ax-combobox__empty">No matches found</div>}
                  </div>
                )}
              </div>
              <span className="ax-help">Grouped by category · selected items show as chips above.</span>
            </div>
          </div>
        </section>

        {/* AUTOCOMPLETE */}
        <section className="ax-card ax-col--6" role="region" aria-label="Autocomplete">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Typeahead</span>
              <h2 className="ax-card__title">Autocomplete</h2>
              <p className="ax-card__subtitle">Live suggestions as you type · arrow keys to navigate.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="ac-input">Assign to teammate</label>
              <div className="ax-combobox" ref={acRef}>
                <div className="ax-field__control">
                  <span className="ax-field__affix ax-field__affix--leading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg></span>
                  <input id="ac-input" type="text" className="ax-input ax-input--with-leading-icon" role="combobox" aria-autocomplete="list" aria-expanded={acOpen} aria-controls="ac-list"
                    value={acQuery} onFocus={() => setAcOpen(true)} onChange={(e) => { setAcQuery(e.target.value); setAcOpen(true); }} placeholder="Type a name…" autoComplete="off" />
                </div>
                {acOpen && filteredPeople.length > 0 && (
                  <div id="ac-list" className="ax-combobox__panel" role="listbox">
                    {filteredPeople.map((p) => (
                      <button key={p.name} type="button" className="ax-combobox__option" role="option" onClick={() => { setAcQuery(p.name); setAcOpen(false); }}>
                        <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${p.c} 18%,transparent)`, color: p.c }}><b style={{ fontSize: 11 }}>{p.initials}</b></span>
                        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}><span style={{ color: 'var(--ax-text-strong)', fontWeight: 500 }}>{p.name}</span><span style={{ fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)' }}>{p.role}</span></span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="ax-help">Searches name and role. Try "design" or "eng".</span>
            </div>
          </div>
        </section>

        {/* PASSWORD STRENGTH */}
        <section className="ax-card ax-col--6" role="region" aria-label="Password strength">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Validated</span>
              <h2 className="ax-card__title">Password strength</h2>
              <p className="ax-card__subtitle">Live meter with a criteria checklist.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div className="ax-field">
              <label className="ax-label" htmlFor="pw-input">New password</label>
              <div className="ax-field__control">
                <input type={pwShown ? 'text' : 'password'} id="pw-input" className="ax-input ax-input--with-trailing" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••" autoComplete="new-password" />
                <button type="button" className="ax-field__affix ax-field__affix--trailing ax-field__affix--button" onClick={() => setPwShown((s) => !s)} aria-label={pwShown ? 'Hide password' : 'Show password'}>{pwShown ? EyeOff : EyeOpen}</button>
              </div>
              <div className="ax-strength" style={{ marginTop: 'var(--ax-space-3)' }}>
                <div className="ax-strength__bars" role="meter" aria-valuenow={pwScore} aria-valuemin={0} aria-valuemax={4} aria-label="Password strength">
                  {[0, 1, 2, 3].map((i) => <span key={i} className={`ax-strength__bar ${pwBarClass(i)}`.trim()} />)}
                </div>
                <span className="ax-strength__label">{pwLabel}</span>
              </div>
              <ul style={{ listStyle: 'none', margin: 'var(--ax-space-3) 0 0', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-2)' }}>
                {pwCriteria.map((c) => (
                  <li key={c.label} className="ax-cluster" style={{ gap: 'var(--ax-space-2)', fontSize: 'var(--ax-text-xs)', color: c.test ? 'var(--ax-success-500)' : 'var(--ax-text-subtle)' }}>
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={c.test ? 'M5 12l5 5l10 -10' : 'M9 12h6'} /></svg>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* RANGE SLIDERS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Range sliders">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Numeric</span>
              <h2 className="ax-card__title">Range sliders</h2>
              <p className="ax-card__subtitle">Single, dual and stepped — all values tabular.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div className="ax-field">
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <label className="ax-label" htmlFor="vol">Notification volume</label>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}>{vol}%</b>
              </div>
              <input id="vol" type="range" className="ax-range--native" min={0} max={100} value={vol} onChange={(e) => setVol(Number(e.target.value))} style={{ width: '100%' }} aria-label="Notification volume" />
            </div>
            <div className="ax-field">
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <label className="ax-label" htmlFor="team-size">Team size</label>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}>{teamSize} seats</b>
              </div>
              <input id="team-size" type="range" className="ax-range--native" min={5} max={50} step={5} value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} style={{ width: '100%' }} aria-label="Team size" />
              <div className="ax-cluster" style={{ justifyContent: 'space-between', fontSize: 'var(--ax-text-2xs)', color: 'var(--ax-text-subtle)', marginTop: 4 }}><span>5</span><span>25</span><span>50</span></div>
            </div>
            <div className="ax-field">
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <label className="ax-label">Price range</label>
                <b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}>${priceMin} – ${priceMax}</b>
              </div>
              <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
                <div className="ax-range__track" style={{ width: '100%' }}>
                  <div className="ax-range__fill" style={{ insetInlineStart: `${priceMin / 500 * 100}%`, width: `${(priceMax - priceMin) / 500 * 100}%` }} />
                </div>
                <input type="range" min={0} max={500} step={10} value={priceMin} onChange={(e) => { const v = Number(e.target.value); setPriceMin(Math.min(v, priceMax)); }} aria-label="Minimum price" style={{ position: 'absolute', width: '100%', background: 'transparent', pointerEvents: 'none', WebkitAppearance: 'none', appearance: 'none' }} className="ax-range--native ax-range-dual" />
                <input type="range" min={0} max={500} step={10} value={priceMax} onChange={(e) => { const v = Number(e.target.value); setPriceMax(Math.max(v, priceMin)); }} aria-label="Maximum price" style={{ position: 'absolute', width: '100%', background: 'transparent', pointerEvents: 'none', WebkitAppearance: 'none', appearance: 'none' }} className="ax-range--native ax-range-dual" />
              </div>
            </div>
          </div>
        </section>

        {/* RATINGS */}
        <section className="ax-card ax-col--6" role="region" aria-label="Ratings">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Feedback</span>
              <h2 className="ax-card__title">Interactive rating</h2>
              <p className="ax-card__subtitle">Click or use arrow keys to set a star value.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)' }}>
            <div className="ax-field">
              <label className="ax-label">How was your experience?</label>
              <div className="ax-rating ax-rating--input ax-rating--lg" role="radiogroup" aria-label="Star rating" onMouseLeave={() => setRatingHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={n + ' star' + (n > 1 ? 's' : '')}
                    onClick={() => setRating(n)} onMouseEnter={() => setRatingHover(n)}
                    onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); setRating((r) => Math.min(5, r + 1)); } else if (e.key === 'ArrowLeft') { e.preventDefault(); setRating((r) => Math.max(1, r - 1)); } }}
                    style={{ background: 'none', border: 0, padding: 2, cursor: 'pointer' }}>
                    <svg className={`ax-rating__star ${(ratingHover || rating) >= n ? 'is-selected' : ''}`.trim()} viewBox="0 0 24 24" fill={(ratingHover || rating) >= n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Star}</svg>
                  </button>
                ))}
                <span className="ax-rating__value">{ratingLabel}</span>
              </div>
            </div>
            <hr className="ax-divider" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }}>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Aperture Desk Lamp</span>
                <span className="ax-rating ax-rating--sm" aria-label="4.5 out of 5">
                  {StarFull}{StarFull}{StarFull}{StarFull}
                  <svg className="ax-rating__star ax-rating__star--half" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path d="M12 1l3.09 6.26l6.91 1l-5 4.87l1.18 6.88l-6.18 -3.25v-15.76" fill="currentColor" stroke="none" /><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z" /></svg>
                  <span className="ax-rating__value ax-num">4.5</span>
                </span>
              </div>
              <div className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)' }}>Matte Ceramic Mug</span>
                <span className="ax-rating ax-rating--sm" aria-label="4 out of 5">
                  {StarFull}{StarFull}{StarFull}{StarFull}
                  <svg className="ax-rating__star" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Star}</svg>
                  <span className="ax-rating__value ax-num">4.0</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* TOGGLES / SWITCHES */}
        <section className="ax-card ax-col--12" role="region" aria-label="Toggles and switches">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Settings</span>
              <h2 className="ax-card__title">Toggles &amp; switches</h2>
              <p className="ax-card__subtitle">Boolean preferences with descriptive helper rows.</p>
            </div>
          </div>
          <div className="ax-card__body ax-advanced-toggles" style={{ paddingTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ax-space-3) var(--ax-space-8)' }}>
            {switches.map((s, i) => (
              <label key={s.id} className="ax-cluster" style={{ justifyContent: 'space-between', gap: 'var(--ax-space-4)', cursor: 'pointer', padding: 'var(--ax-space-3) 0', borderBottom: '1px solid var(--ax-border)' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 500, color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{s.title}</span>
                  <span style={{ display: 'block', fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)', marginTop: 2 }}>{s.desc}</span>
                </span>
                <input type="checkbox" className="ax-switch" role="switch" checked={s.on} onChange={(e) => setSwitch(i, e.target.checked)} aria-label={s.title} />
              </label>
            ))}
          </div>
        </section>
      </form>
    </>
  );
}

export default Advanced;
