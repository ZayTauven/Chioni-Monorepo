'use client';
/*
 * Vireo Next.js — UI · Tooltips (route "ui/tooltips").
 *
 * Faithful re-expression of src/html/ui/tooltips.html: four placements, glass vs.
 * inverse variants, a shortcut-key bubble, tooltips on icon-only controls, rich
 * (title + copy) tooltips, and a native title-attribute fallback. The reference's
 * axTooltip open-state (@mouseenter/@mouseleave + @focus/@blur) is re-expressed
 * with a small <Tip> wrapper; the header "Pin for preview" toggle uses a toast.
 * DOM/classes/ARIA/inline placement styles/copy match 1:1.
 */
import { useId, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { ToastProvider, useToast } from './_uikit';

/* axTooltip re-expressed: opens on hover of the wrapper and on focus/blur of the
   trigger; the tooltip <span> mounts only while open (mirrors x-show + x-cloak). */
function Tip({
  trigger,
  tone = 'inverse',
  tipId,
  style,
  children,
  wrapStyle,
}: {
  trigger: (props: { onFocus: () => void; onBlur: () => void; describedBy: string }) => ReactNode;
  tone?: 'inverse' | 'glass';
  tipId?: string;
  style: React.CSSProperties;
  children: ReactNode;
  wrapStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const auto = useId();
  const id = tipId ?? auto;
  return (
    <div style={{ position: 'relative', ...wrapStyle }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {trigger({ onFocus: () => setOpen(true), onBlur: () => setOpen(false), describedBy: id })}
      {open && (
        <span id={id} role="tooltip" className={`ax-tooltip${tone === 'inverse' ? ' ax-tooltip--inverse' : ''}`} style={style}>
          {children}
        </span>
      )}
    </div>
  );
}

const ARROW_TOP: React.CSSProperties = { insetBlockEnd: -4, insetInlineStart: '50%', marginInlineStart: -4 };

function TooltipsInner() {
  const toast = useToast();
  const [pinned, setPinned] = useState(false);
  const placements: { label: string; style: React.CSSProperties; arrow: React.CSSProperties; text: string }[] = [
    { label: 'Top', text: 'Anchored above', style: { insetBlockEnd: 'calc(100% + 10px)', insetInlineStart: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }, arrow: ARROW_TOP },
    { label: 'Bottom', text: 'Anchored below', style: { insetBlockStart: 'calc(100% + 10px)', insetInlineStart: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }, arrow: { insetBlockStart: -4, insetInlineStart: '50%', marginInlineStart: -4 } },
    { label: 'Start', text: 'Anchored start', style: { insetInlineEnd: 'calc(100% + 10px)', insetBlockStart: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }, arrow: { insetInlineEnd: -4, insetBlockStart: '50%', marginBlockStart: -4 } },
    { label: 'End', text: 'Anchored end', style: { insetInlineStart: 'calc(100% + 10px)', insetBlockStart: '50%', transform: 'translateY(-50%)', whiteSpace: 'nowrap' }, arrow: { insetInlineStart: -4, insetBlockStart: '50%', marginBlockStart: -4 } },
  ];

  const iconBtns: { label: string; key?: string; path: ReactNode }[] = [
    { label: 'Bold', key: '⌘B', path: <><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6z" /><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7" /></> },
    { label: 'Italic', key: '⌘I', path: <><path d="M11 5l6 0" /><path d="M7 19l6 0" /><path d="M14 5l-4 14" /></> },
    { label: 'Insert link', key: '⌘K', path: <><path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" /></> },
    { label: 'Delete', path: <><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></> },
  ];

  return (
    <>
      <PageHead
        title="Tooltips"
        subtitle="Glassy hover bubbles in four placements, with inverse, rich & shortcut variants — every surface is a role token, so all 12 accents retheme for free."
        actions={
          <>
            <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/notifications">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
              <span className="ax-btn__label">Notifications</span>
            </Link>
            <button type="button" className="ax-btn ax-btn--primary" onClick={() => { const nv = !pinned; setPinned(nv); toast(nv ? 'Tooltips pinned for preview' : 'Tooltips unpinned'); }}>
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4" /><path d="M9 15l-4.5 4.5" /><path d="M14.5 4l5.5 5.5" /></svg>
              <span className="ax-btn__label">{pinned ? 'Pinned' : 'Pin for preview'}</span>
            </button>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Placements */}
        <section className="ax-card ax-col--12" role="region" aria-label="Tooltip placements">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Anchoring</span>
              <h2 className="ax-card__title">Placements</h2>
              <p className="ax-card__subtitle">Top, bottom, start &amp; end — hover or focus any trigger. The arrow always points back to its anchor.</p>
            </div>
            <span className="ax-badge ax-badge--soft ax-badge--neutral ax-badge--pill">Keyboard &amp; pointer accessible</span>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--ax-space-6)', placeItems: 'center', paddingBlock: 'var(--ax-space-6)' }}>
              {placements.map((p) => (
                <Tip key={p.label} tipId={`tt-${p.label.toLowerCase()}`} style={p.style}
                  trigger={({ onFocus, onBlur, describedBy }) => (
                    <button type="button" className="ax-btn ax-btn--secondary" onFocus={onFocus} onBlur={onBlur} aria-describedby={describedBy}>{p.label}</button>
                  )}>
                  {p.text}
                  <span className="ax-tooltip__arrow" style={p.arrow} />
                </Tip>
              ))}
            </div>
          </div>
        </section>

        {/* Variants */}
        <section className="ax-card ax-col--6" role="region" aria-label="Tooltip variants">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Surface</span>
              <h2 className="ax-card__title">Variants</h2>
              <p className="ax-card__subtitle">Default glass overlay vs. high-contrast inverse bubble.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-6)', alignItems: 'center', paddingBlock: 'var(--ax-space-6)' }}>
            <Tip tone="glass" tipId="tt-glass" style={{ insetBlockEnd: 'calc(100% + 10px)', insetInlineStart: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
              trigger={({ onFocus, onBlur, describedBy }) => <button type="button" className="ax-btn ax-btn--secondary" onFocus={onFocus} onBlur={onBlur} aria-describedby={describedBy}>Glass overlay</button>}>
              Frosted surface-overlay<span className="ax-tooltip__arrow" style={ARROW_TOP} />
            </Tip>
            <Tip tipId="tt-inv" style={{ insetBlockEnd: 'calc(100% + 10px)', insetInlineStart: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}
              trigger={({ onFocus, onBlur, describedBy }) => <button type="button" className="ax-btn ax-btn--secondary" onFocus={onFocus} onBlur={onBlur} aria-describedby={describedBy}>Inverse</button>}>
              High-contrast bubble<span className="ax-tooltip__arrow" style={ARROW_TOP} />
            </Tip>
            <Tip tipId="tt-key" style={{ insetBlockEnd: 'calc(100% + 10px)', insetInlineStart: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
              trigger={({ onFocus, onBlur, describedBy }) => <button type="button" className="ax-btn ax-btn--secondary" onFocus={onFocus} onBlur={onBlur} aria-describedby={describedBy}>With shortcut</button>}>
              Quick search<kbd className="ax-tooltip__key">⌘</kbd><kbd className="ax-tooltip__key">K</kbd><span className="ax-tooltip__arrow" style={ARROW_TOP} />
            </Tip>
          </div>
        </section>

        {/* Icon affordances */}
        <section className="ax-card ax-col--6" role="region" aria-label="Tooltips on icon affordances">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">In context</span>
              <h2 className="ax-card__title">Icon-only controls</h2>
              <p className="ax-card__subtitle">The most common use — a label for icon buttons that lack visible text.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-4)', alignItems: 'center', paddingBlock: 'var(--ax-space-6)' }}>
            {iconBtns.map((b) => (
              <Tip key={b.label} style={{ insetBlockEnd: 'calc(100% + 10px)', insetInlineStart: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
                trigger={({ onFocus, onBlur, describedBy }) => (
                  <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" onFocus={onFocus} onBlur={onBlur} aria-label={b.label === 'Delete' ? 'Delete' : b.label} aria-describedby={describedBy}>
                    <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{b.path}</svg>
                  </button>
                )}>
                {b.label === 'Delete' ? 'Move to trash' : b.label}{b.key && <kbd className="ax-tooltip__key">{b.key}</kbd>}<span className="ax-tooltip__arrow" style={ARROW_TOP} />
              </Tip>
            ))}
          </div>
        </section>

        {/* Rich tooltip */}
        <section className="ax-card ax-col--6" role="region" aria-label="Rich tooltip">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Content</span>
              <h2 className="ax-card__title">Rich tooltip</h2>
              <p className="ax-card__subtitle">A title plus a line of supporting copy — still hover/focus driven.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', gap: 'var(--ax-space-6)', flexWrap: 'wrap', alignItems: 'center', paddingBlock: 'var(--ax-space-6)' }}>
            <Tip tone="glass" tipId="tt-rich" style={{ insetInlineStart: 'calc(100% + 12px)', insetBlockStart: '50%', transform: 'translateY(-50%)', maxWidth: 220, whiteSpace: 'normal', textAlign: 'start' }}
              trigger={({ onFocus, onBlur, describedBy }) => (
                <span className="ax-avatar ax-avatar--lg" tabIndex={0} role="img" aria-label="Ava Sutton, Operations Lead" onFocus={onFocus} onBlur={onBlur} aria-describedby={describedBy} style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)', cursor: 'default' }}>
                  <span className="ax-avatar__initials">AS</span>
                  <span className="ax-avatar__status ax-avatar__status--online" />
                </span>
              )}>
              <b style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Ava Sutton</b>
              <span style={{ display: 'block', color: 'var(--ax-text-muted)', marginBlockStart: 2 }}>Operations Lead · Online now</span>
              <span className="ax-tooltip__arrow" style={{ insetInlineStart: -4, insetBlockStart: '50%', marginBlockStart: -4 }} />
            </Tip>
            <Tip tone="glass" tipId="tt-metric" style={{ insetBlockStart: 'calc(100% + 10px)', insetInlineStart: 0, maxWidth: 240, whiteSpace: 'normal', textAlign: 'start' }}
              trigger={({ onFocus, onBlur, describedBy }) => (
                <span tabIndex={0} className="ax-num" onFocus={onFocus} onBlur={onBlur} aria-describedby={describedBy} style={{ fontFamily: 'var(--ax-font-display)', fontSize: 'var(--ax-text-2xl)', fontWeight: 'var(--ax-weight-bold)', color: 'var(--ax-text-strong)', cursor: 'default', borderBlockEnd: '1px dashed var(--ax-border-strong)' }}>$748.2K</span>
              )}>
              <b style={{ display: 'block', color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>Gross revenue</b>
              <span style={{ display: 'block', color: 'var(--ax-text-muted)', marginBlockStart: 2 }}>Jul 2025 – Jun 2026 · <span className="ax-num" style={{ color: 'var(--ax-viz-emerald)' }}>▲ 12.4%</span> vs. prior period</span>
              <span className="ax-tooltip__arrow" style={{ insetBlockStart: -4, insetInlineStart: 18 }} />
            </Tip>
          </div>
        </section>

        {/* Native title fallback */}
        <section className="ax-card ax-col--6" role="region" aria-label="Native title attribute fallback">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">No-JS fallback</span>
              <h2 className="ax-card__title">Native <code className="ax-code">title</code></h2>
              <p className="ax-card__subtitle">Where a styled bubble is overkill, the browser <code className="ax-code">title</code> still works everywhere.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)', paddingBlock: 'var(--ax-space-6)' }}>
            <p style={{ color: 'var(--ax-text-muted)', fontSize: 'var(--ax-text-sm)', margin: 0 }}>
              The <a className="ax-link" href="#" title="Server-Side Rendering — HTML generated on the server per request">SSR</a> rollout
              shipped Tuesday, ahead of the <span style={{ textDecoration: 'underline dotted', textUnderlineOffset: '3px', color: 'var(--ax-text)', cursor: 'help' }} title="Originally scheduled for Friday, Jun 13">planned date</span>.
              Hover <a className="ax-link" href="#" title="Average Order Value across the trailing 30 days">AOV</a> for the metric definition.
            </p>
            <div className="ax-divider" />
            <p style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)', margin: 0 }}>
              Tip: pair the <code className="ax-code">title</code> attribute with <code className="ax-code">x-tooltip</code> to upgrade it to a styled bubble when Alpine is present.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export function Tooltips() {
  return (
    <ToastProvider>
      <TooltipsInner />
    </ToastProvider>
  );
}

export default Tooltips;
