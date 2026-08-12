'use client';
/*
 * Vireo Next.js — UI · Popovers (route "ui/popovers").
 *
 * Faithful re-expression of src/html/ui/popovers.html: four positioned
 * popovers (click-toggle, outside/Escape dismiss via usePopover), click/hover/
 * focus triggers, a rich header+body+footer confirm flow and a profile
 * hover-card. DOM classes / ARIA / inline placement styles match 1:1.
 */
import { useState } from 'react';
import { PageHead } from '../../components/shell/PageHead';
import { usePopover } from './_uikit';

const PANEL_BASE: React.CSSProperties = {};

function ClickPopover({ label, btnClass, panelStyle, arrowStyle, ariaLabel, children, btnContent, expandable = true }: {
  label?: string;
  btnClass: string;
  panelStyle: React.CSSProperties;
  arrowStyle: React.CSSProperties;
  ariaLabel: string;
  children: React.ReactNode;
  btnContent?: React.ReactNode;
  expandable?: boolean;
}) {
  const { ref, open, setOpen } = usePopover();
  return (
    <div className="ax-popover" ref={ref}>
      <button type="button" className={btnClass} onClick={() => setOpen(!open)} aria-expanded={expandable ? open : undefined} aria-haspopup="dialog">
        {btnContent ?? <span className="ax-btn__label">{label}</span>}
      </button>
      {open && (
        <div className="ax-popover__panel" role="dialog" aria-label={ariaLabel} style={{ ...PANEL_BASE, ...panelStyle }}>
          <span className="ax-popover__arrow" aria-hidden="true" style={arrowStyle} />
          {children}
        </div>
      )}
    </div>
  );
}

function HoverPopover({ wrapClass, wrapStyle, ariaLabel, panelStyle, arrowStyle, trigger, panelTag = 'div', children }: {
  wrapClass: string;
  wrapStyle?: React.CSSProperties;
  ariaLabel: string;
  panelStyle: React.CSSProperties;
  arrowStyle: React.CSSProperties;
  trigger: (open: () => void, close: () => void) => React.ReactNode;
  panelTag?: 'div' | 'span';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Panel = panelTag;
  return (
    <span className={wrapClass} style={wrapStyle} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {trigger(() => setOpen(true), () => setOpen(false))}
      {open && (
        <Panel className="ax-popover__panel" role="dialog" aria-label={ariaLabel} style={panelStyle}>
          <span className="ax-popover__arrow" aria-hidden="true" style={arrowStyle} />
          {children}
        </Panel>
      )}
    </span>
  );
}

const TITLE_B: React.CSSProperties = { display: 'block', color: 'var(--ax-text-strong)', marginBottom: 4 };

export function Popovers() {
  return (
    <>
      <PageHead
        title="Popovers"
        subtitle="Glass mini-cards anchored to a trigger — four positions, click & hover, and rich content."
        actions={
          <>
            <a className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/tooltips">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>
              <span className="ax-btn__label">Tooltips</span>
            </a>
            <a className="ax-btn ax-btn--primary" href="/ui/dropdowns">
              <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
              <span className="ax-btn__label">Dropdowns</span>
            </a>
          </>
        }
      />

      <div className="ax-dash-grid">
        {/* Positions */}
        <section className="ax-card ax-col--8" role="region" aria-label="Popover positions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Placement</span>
              <h2 className="ax-card__title">Four Positions</h2>
              <p className="ax-card__subtitle">Top, bottom, start and end — each click-toggled and dismiss-on-outside.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 'var(--ax-space-6) var(--ax-space-5)', placeItems: 'center', paddingBlock: 'var(--ax-space-8)' }}>
              <ClickPopover label="Top" btnClass="ax-btn ax-btn--secondary" ariaLabel="Top popover"
                panelStyle={{ insetBlockEnd: 'calc(100% + 12px)', insetInlineStart: '50%', transform: 'translateX(-50%)', width: 240 }}
                arrowStyle={{ insetBlockEnd: -6, insetInlineStart: '50%', marginInlineStart: -5, borderBlockStart: 0, borderInlineStart: 0 }}>
                <div className="ax-popover__body"><b style={TITLE_B}>Anchored above</b>The panel grows upward and stays inside the card while the arrow tracks the trigger.</div>
              </ClickPopover>
              <ClickPopover label="Bottom" btnClass="ax-btn ax-btn--secondary" ariaLabel="Bottom popover"
                panelStyle={{ insetBlockStart: 'calc(100% + 12px)', insetInlineStart: '50%', transform: 'translateX(-50%)', width: 240 }}
                arrowStyle={{ insetBlockStart: -6, insetInlineStart: '50%', marginInlineStart: -5, borderBlockEnd: 0, borderInlineEnd: 0 }}>
                <div className="ax-popover__body"><b style={TITLE_B}>Anchored below</b>The default placement for menus and form helpers that follow a control.</div>
              </ClickPopover>
              <ClickPopover label="Start" btnClass="ax-btn ax-btn--secondary" ariaLabel="Start popover"
                panelStyle={{ insetInlineEnd: 'calc(100% + 12px)', insetBlockStart: '50%', transform: 'translateY(-50%)', width: 230 }}
                arrowStyle={{ insetInlineEnd: -6, insetBlockStart: '50%', marginBlockStart: -5, borderBlockStart: 0, borderInlineStart: 0 }}>
                <div className="ax-popover__body"><b style={TITLE_B}>Anchored to the start</b>Useful when a trigger sits near the inline-end edge of a panel.</div>
              </ClickPopover>
              <ClickPopover label="End" btnClass="ax-btn ax-btn--secondary" ariaLabel="End popover"
                panelStyle={{ insetInlineStart: 'calc(100% + 12px)', insetBlockStart: '50%', transform: 'translateY(-50%)', width: 230 }}
                arrowStyle={{ insetInlineStart: -6, insetBlockStart: '50%', marginBlockStart: -5, borderBlockEnd: 0, borderInlineEnd: 0 }}>
                <div className="ax-popover__body"><b style={TITLE_B}>Anchored to the end</b>Mirrors automatically under RTL via logical insets.</div>
              </ClickPopover>
            </div>
          </div>
        </section>

        {/* Triggers */}
        <section className="ax-card ax-col--4" role="region" aria-label="Popover triggers">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Interaction</span>
              <h2 className="ax-card__title">Triggers</h2>
              <p className="ax-card__subtitle">Click, hover and focus.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-6)', alignItems: 'flex-start' }}>
            <ClickPopover label="Click to open" btnClass="ax-btn ax-btn--primary" ariaLabel="Click popover"
              panelStyle={{ insetBlockStart: 'calc(100% + 12px)', insetInlineStart: 0, width: 240 }}
              arrowStyle={{ insetBlockStart: -6, insetInlineStart: 18, borderBlockEnd: 0, borderInlineEnd: 0 }}>
              <div className="ax-popover__body">Toggles on click and closes when you click anywhere outside or press <kbd className="ax-kbd">Esc</kbd>.</div>
            </ClickPopover>

            <HoverPopover wrapClass="ax-popover" ariaLabel="Hover popover"
              panelStyle={{ insetBlockStart: 'calc(100% + 12px)', insetInlineStart: 0, width: 240 }}
              arrowStyle={{ insetBlockStart: -6, insetInlineStart: 18, borderBlockEnd: 0, borderInlineEnd: 0 }}
              trigger={(openFn, closeFn) => (
                <button type="button" className="ax-btn ax-btn--secondary" onFocus={openFn} onBlur={closeFn}>
                  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z" /></svg>
                  <span className="ax-btn__label">Hover / focus</span>
                </button>
              )}>
              <div className="ax-popover__body">Opens on pointer hover and keyboard focus, so it works without a click.</div>
            </HoverPopover>

            <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)' }}>
              <span style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)' }}>API rate limit</span>
              <ClickPopover btnClass="ax-btn ax-btn--ghost ax-btn--icon ax-btn--sm" ariaLabel="Rate limit help"
                btnContent={<svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M12 9h.01" /><path d="M11 12h1v4h1" /></svg>}
                panelStyle={{ insetBlockStart: 'calc(100% + 12px)', insetInlineEnd: 0, width: 260 }}
                arrowStyle={{ insetBlockStart: -6, insetInlineEnd: 14, borderBlockEnd: 0, borderInlineEnd: 0 }}>
                <div className="ax-popover__body">Each workspace key allows <b className="ax-num" style={{ color: 'var(--ax-text-strong)', fontFamily: 'var(--ax-font-mono)' }}>600</b> requests per minute. Bursts above that return <code className="ax-code">429</code>.</div>
              </ClickPopover>
            </div>
          </div>
        </section>

        {/* Rich content */}
        <section className="ax-card ax-col--6" role="region" aria-label="Rich popover">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Composition</span>
              <h2 className="ax-card__title">Header, Body &amp; Footer</h2>
              <p className="ax-card__subtitle">A confirm flow built entirely from popover sub-elements.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, paddingBlockEnd: 'var(--ax-space-9)' }}>
            <DeletePopover />
          </div>
        </section>

        {/* User card popover */}
        <section className="ax-card ax-col--6" role="region" aria-label="Profile popover">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Pattern</span>
              <h2 className="ax-card__title">Profile Preview</h2>
              <p className="ax-card__subtitle">A hover-card that surfaces a teammate without leaving the page.</p>
            </div>
          </div>
          <div className="ax-card__body" style={{ paddingTop: 0, paddingBlockEnd: 'var(--ax-space-9)' }}>
            <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: '0 0 var(--ax-space-4)' }}>
              Assigned to{' '}
              <HoverPopover wrapClass="ax-popover" wrapStyle={{ verticalAlign: 'middle' }} ariaLabel="Marcus Reyes profile" panelTag="span"
                panelStyle={{ insetBlockStart: 'calc(100% + 12px)', insetInlineStart: 0, width: 280 }}
                arrowStyle={{ insetBlockStart: -6, insetInlineStart: 18, borderBlockEnd: 0, borderInlineEnd: 0 }}
                trigger={(openFn, closeFn) => (
                  <button type="button" className="ax-link" onFocus={openFn} onBlur={closeFn} style={{ fontWeight: 'var(--ax-weight-semibold)' }}>Marcus Reyes</button>
                )}>
                <span className="ax-popover__body" style={{ display: 'block' }}>
                  <span className="ax-cluster" style={{ gap: 'var(--ax-space-3)', flexWrap: 'nowrap' }}>
                    <span className="ax-avatar ax-avatar--lg ax-avatar--squircle" style={{ background: 'color-mix(in oklab,var(--ax-viz-violet) 18%,transparent)', color: 'var(--ax-viz-violet)' }}>MR</span>
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: 'block', color: 'var(--ax-text-strong)' }}>Marcus Reyes</b>
                      <small style={{ color: 'var(--ax-text-subtle)', fontSize: 'var(--ax-text-xs)' }}>Engineering Manager</small>
                    </span>
                  </span>
                  <span className="ax-divider" style={{ display: 'block', marginBlock: 'var(--ax-space-3)' }} />
                  <span className="ax-cluster" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-muted)' }}>marcus.reyes@northwindlabs.app</span>
                    <span className="ax-badge ax-badge--soft ax-badge--success ax-badge--pill"><span className="ax-badge__dot" />Online</span>
                  </span>
                </span>
              </HoverPopover>
              {' '}— review by Friday.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function DeletePopover() {
  const { ref, open, setOpen } = usePopover();
  return (
    <div className="ax-popover" ref={ref}>
      <button type="button" className="ax-btn ax-btn--danger ax-btn--primary" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
        <span className="ax-btn__label">Delete project</span>
      </button>
      {open && (
        <div className="ax-popover__panel" role="dialog" aria-label="Delete confirmation" style={{ insetBlockStart: 'calc(100% + 12px)', insetInlineStart: 0, width: 300 }}>
          <span className="ax-popover__arrow" aria-hidden="true" style={{ insetBlockStart: -6, insetInlineStart: 18, borderBlockEnd: 0, borderInlineEnd: 0 }} />
          <div className="ax-popover__header">Delete &ldquo;Aurora redesign&rdquo;?</div>
          <div className="ax-popover__body">This permanently removes the project and its <b style={{ color: 'var(--ax-text-strong)' }}>214</b> tasks. This action can&rsquo;t be undone.</div>
          <div className="ax-popover__footer">
            <button type="button" className="ax-btn ax-btn--ghost ax-btn--sm" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="ax-btn ax-btn--danger ax-btn--primary ax-btn--sm" onClick={() => setOpen(false)}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Popovers;
