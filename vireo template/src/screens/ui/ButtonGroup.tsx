'use client';
/*
 * Vireo Next.js — UI · Button group (route "ui/button-group").
 *
 * Faithful re-expression of src/html/ui/button-group.html: joined groups,
 * vertical group, segmented radios, multi-toggle, toolbar, split buttons (with
 * a React-state menu) and a full-width segmented switch. Alpine x-data selection
 * state is re-implemented with React state. DOM classes / ARIA / copy match 1:1.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { useClickOutside } from '../../hooks/useClickOutside';

function Segmented() {
  const [range, setRange] = useState('month');
  const [view, setView] = useState('grid');
  return (
    <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', alignItems: 'flex-start' }}>
      <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Date range">
        {(['week', 'month', 'quarter', 'year'] as const).map((r) => (
          <button key={r} type="button" className={`ax-btn ax-btn--sm${range === r ? ' is-selected' : ''}`} role="radio" aria-checked={range === r} onClick={() => setRange(r)}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>
        ))}
      </div>
      <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="View mode">
        <button type="button" className={`ax-btn ax-btn--sm${view === 'grid' ? ' is-selected' : ''}`} role="radio" aria-checked={view === 'grid'} onClick={() => setView('grid')}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z" /></svg>
          <span className="ax-btn__label">Grid</span>
        </button>
        <button type="button" className={`ax-btn ax-btn--sm${view === 'list' ? ' is-selected' : ''}`} role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>
          <span className="ax-btn__label">List</span>
        </button>
        <button type="button" className={`ax-btn ax-btn--sm${view === 'board' ? ' is-selected' : ''}`} role="radio" aria-checked={view === 'board'} onClick={() => setView('board')}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M9 4v16" /><path d="M15 4v16" /></svg>
          <span className="ax-btn__label">Board</span>
        </button>
      </div>
    </div>
  );
}

function MultiToggle() {
  const [b, setB] = useState(true);
  const [i, setI] = useState(false);
  const [u, setU] = useState(false);
  const active = [b && 'Bold', i && 'Italic', u && 'Underline'].filter(Boolean).join(' · ') || 'none';
  return (
    <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', alignItems: 'flex-start' }}>
      <div className="ax-btn-group ax-btn-group--segmented" role="group" aria-label="Format text">
        <button type="button" className={`ax-btn ax-btn--sm ax-btn--icon${b ? ' is-selected' : ''}`} aria-pressed={b} onClick={() => setB(!b)} aria-label="Bold">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg>
        </button>
        <button type="button" className={`ax-btn ax-btn--sm ax-btn--icon${i ? ' is-selected' : ''}`} aria-pressed={i} onClick={() => setI(!i)} aria-label="Italic">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg>
        </button>
        <button type="button" className={`ax-btn ax-btn--sm ax-btn--icon${u ? ' is-selected' : ''}`} aria-pressed={u} onClick={() => setU(!u)} aria-label="Underline">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5v5a5 5 0 0 0 10 0v-5" /><path d="M5 19h14" /></svg>
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>
        Active: <b className="ax-num" style={{ color: 'var(--ax-accent)' }}>{active}</b>
      </p>
    </div>
  );
}

function SplitSave() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useClickOutside(wrap, open, () => setOpen(false));
  return (
    <div className="ax-btn-group ax-btn-group--split" role="group" aria-label="Save options" ref={wrap} style={{ position: 'relative' }}>
      <button type="button" className="ax-btn ax-btn--primary">
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>
        <span className="ax-btn__label">Save changes</span>
      </button>
      <button type="button" className="ax-btn ax-btn--primary ax-btn-group__caret" aria-label="More save options" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInlineStart: 0, minWidth: 200, zIndex: 20, padding: 'var(--ax-space-2)', background: 'var(--ax-surface-overlay)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-md)', boxShadow: 'var(--ax-shadow-lg)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => setOpen(false)}><span className="ax-btn__label">Save &amp; close</span></button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => setOpen(false)}><span className="ax-btn__label">Save as new version</span></button>
          <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm ax-btn--block" style={{ justifyContent: 'flex-start' }} onClick={() => setOpen(false)}><span className="ax-btn__label">Save as template</span></button>
        </div>
      )}
    </div>
  );
}

function FullWidthSwitch() {
  const [plan, setPlan] = useState('annual');
  return (
    <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-5)' }}>
      <div className="ax-btn-group ax-btn-group--segmented" role="radiogroup" aria-label="Billing period" style={{ display: 'flex', width: '100%' }}>
        <button type="button" className={`ax-btn${plan === 'monthly' ? ' is-selected' : ''}`} role="radio" style={{ flex: '1 1 0' }} aria-checked={plan === 'monthly'} onClick={() => setPlan('monthly')}>Monthly</button>
        <button type="button" className={`ax-btn${plan === 'annual' ? ' is-selected' : ''}`} role="radio" style={{ flex: '1 1 0' }} aria-checked={plan === 'annual'} onClick={() => setPlan('annual')}>
          Annual<span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill ax-badge--sm" style={{ marginInlineStart: 6 }}>−20%</span>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--ax-space-2)' }}>
        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-3xl)', fontWeight: 700, color: 'var(--ax-text-strong)' }}>{plan === 'annual' ? '$23' : '$29'}</span>
        <span style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)' }}>/ seat / month</span>
      </div>
    </div>
  );
}

export function ButtonGroup() {
  return (
    <>
      <PageHead
        title="Button group"
        subtitle="Joined actions, segmented radios, toolbars & split buttons — sharing one hairline seam with accent-wash selection."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/buttons">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
            <span className="ax-btn__label">Buttons</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        {/* Joined groups */}
        <section className="ax-card ax-col--6" role="region" aria-label="Joined button groups">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Base</span>
              <h2 className="ax-card__title">Joined groups</h2>
              <p className="ax-card__subtitle">Members share a seam; only outer corners round.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', alignItems: 'flex-start' }}>
            <div className="ax-btn-group" role="group" aria-label="Text style">
              <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Bold</span></button>
              <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Italic</span></button>
              <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">Underline</span></button>
            </div>
            <div className="ax-btn-group" role="group" aria-label="Pagination">
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Previous page"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg></button>
              <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">1</span></button>
              <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">2</span></button>
              <button type="button" className="ax-btn ax-btn--secondary"><span className="ax-btn__label">3</span></button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Next page"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg></button>
            </div>
            <div className="ax-btn-group" role="group" aria-label="Tonal cluster">
              <button type="button" className="ax-btn ax-btn--tonal"><span className="ax-btn__label">Day</span></button>
              <button type="button" className="ax-btn ax-btn--tonal"><span className="ax-btn__label">Week</span></button>
              <button type="button" className="ax-btn ax-btn--tonal"><span className="ax-btn__label">Month</span></button>
            </div>
          </div>
        </section>

        {/* Vertical */}
        <section className="ax-card ax-col--6" role="region" aria-label="Vertical button group">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Orientation</span>
              <h2 className="ax-card__title">Vertical group</h2>
              <p className="ax-card__subtitle">Stacked seam for menus &amp; side rails.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', gap: 'var(--ax-space-6)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="ax-btn-group ax-btn-group--vertical" role="group" aria-label="Account menu">
              <button type="button" className="ax-btn ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg><span className="ax-btn__label">Profile</span></button>
              <button type="button" className="ax-btn ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg><span className="ax-btn__label">Settings</span></button>
              <button type="button" className="ax-btn ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 19a6 6 0 0 0 -12 0" /><path d="M16 11l2 2l4 -4" /><path d="M5 7a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg><span className="ax-btn__label">Members</span></button>
              <button type="button" className="ax-btn ax-btn--danger ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg><span className="ax-btn__label">Sign out</span></button>
            </div>
          </div>
        </section>

        {/* Segmented radio */}
        <section className="ax-card ax-col--6" role="region" aria-label="Segmented controls">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Single-select</span>
              <h2 className="ax-card__title">Segmented</h2>
              <p className="ax-card__subtitle">Boxed track, accent-wash on the chosen segment.</p>
            </div>
          </div>
          <Segmented />
        </section>

        {/* Multi-toggle */}
        <section className="ax-card ax-col--6" role="region" aria-label="Multi-toggle group">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Multi-select</span>
              <h2 className="ax-card__title">Toggle group</h2>
              <p className="ax-card__subtitle">Independent <code className="ax-code">aria-pressed</code> toggles.</p>
            </div>
          </div>
          <MultiToggle />
        </section>

        {/* Toolbar */}
        <section className="ax-card ax-col--12" role="region" aria-label="Editor toolbar">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Composition</span>
              <h2 className="ax-card__title">Toolbar</h2>
              <p className="ax-card__subtitle">Several groups, separated by dividers, in a single control strip.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div role="toolbar" aria-label="Document toolbar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-lg)', background: 'var(--ax-surface-subtle)' }}>
              <div className="ax-btn-group" role="group" aria-label="History">
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Undo"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Redo"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 14l4 -4l-4 -4" /><path d="M19 10h-11a4 4 0 1 0 0 8h1" /></svg></button>
              </div>
              <span className="ax-divider ax-divider--vertical" style={{ height: 24 }} aria-hidden="true" />
              <div className="ax-btn-group" role="group" aria-label="Text format">
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Bold"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Italic"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Strikethrough"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M16 6.5a4 2 0 0 0 -4 -1.5h-1a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-1.5a4 2 0 0 1 -4 -1.5" /></svg></button>
              </div>
              <span className="ax-divider ax-divider--vertical" style={{ height: 24 }} aria-hidden="true" />
              <div className="ax-btn-group" role="group" aria-label="Alignment">
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Align left"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l16 0" /><path d="M4 12l10 0" /><path d="M4 18l14 0" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Align center"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l16 0" /><path d="M8 12l8 0" /><path d="M6 18l12 0" /></svg></button>
                <button type="button" className="ax-btn ax-btn--secondary ax-btn--icon" aria-label="Align right"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l16 0" /><path d="M10 12l10 0" /><path d="M6 18l14 0" /></svg></button>
              </div>
              <span className="ax-divider ax-divider--vertical" style={{ height: 24 }} aria-hidden="true" />
              <div className="ax-btn-group" role="group" aria-label="Insert">
                <button type="button" className="ax-btn ax-btn--secondary" aria-label="Insert link"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></svg><span className="ax-btn__label">Link</span></button>
                <button type="button" className="ax-btn ax-btn--secondary" aria-label="Insert image"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" /></svg><span className="ax-btn__label">Image</span></button>
              </div>
              <span style={{ flex: '1 1 auto' }} />
              <button type="button" className="ax-btn ax-btn--primary ax-btn--sm"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg><span className="ax-btn__label">Save</span></button>
            </div>
          </div>
        </section>

        {/* Split buttons */}
        <section className="ax-card ax-col--6" role="region" aria-label="Split buttons">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Primary + menu</span>
              <h2 className="ax-card__title">Split button</h2>
              <p className="ax-card__subtitle">Default action plus a caret revealing alternatives.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-4)', alignItems: 'flex-start' }}>
            <SplitSave />
            <div className="ax-btn-group ax-btn-group--split" role="group" aria-label="Export options">
              <button type="button" className="ax-btn ax-btn--secondary"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /><path d="M7 11l5 5l5 -5" /><path d="M12 4l0 12" /></svg><span className="ax-btn__label">Export PDF</span></button>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn-group__caret" aria-label="Export format options" aria-expanded="false"><svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg></button>
            </div>
          </div>
        </section>

        {/* Block / full-width */}
        <section className="ax-card ax-col--6" role="region" aria-label="Full-width segmented switch">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Layout</span>
              <h2 className="ax-card__title">Full-width switch</h2>
              <p className="ax-card__subtitle">Stretched segmented control for plan toggles &amp; tabs.</p>
            </div>
          </div>
          <FullWidthSwitch />
        </section>
      </div>
    </>
  );
}

export default ButtonGroup;
