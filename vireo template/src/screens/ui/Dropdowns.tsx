'use client';
/*
 * Vireo Next.js — UI · Dropdowns (route "ui/dropdowns").
 *
 * Faithful re-expression of src/html/ui/dropdowns.html: placement variants
 * (down/up/end/start), a rich action menu (icons + shortcuts + danger row),
 * a grouped profile menu (header block + section labels + dividers), and
 * checkable menus (single-choice radio, multi-toggle checkbox) plus a split
 * button. The Alpine axDropdown() open/toggle/close + click-outside/Escape is
 * re-implemented with a small React <Dropdown> wrapper (useClickOutside).
 * DOM classes / ARIA / copy match the reference 1:1.
 */
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { PageHead } from '../../components/shell/PageHead';
import { useClickOutside } from '../../hooks/useClickOutside';

/* A single ax-dropdown: owns open state + outside/Escape close, mirrors axDropdown(). */
function Dropdown({
  trigger,
  children,
  className = 'ax-dropdown',
  style,
  menuStyle,
}: {
  trigger: (o: { open: boolean; toggle: () => void }) => ReactNode;
  children: (o: { close: () => void }) => ReactNode;
  className?: string;
  style?: React.CSSProperties;
  menuStyle: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useClickOutside(ref, open, close);
  return (
    <div className={className} ref={ref} style={style}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className="ax-menu" role="menu" style={menuStyle}>
          {children({ close })}
        </div>
      )}
    </div>
  );
}

const CHEV_DOWN = <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>;
const CHECK = <svg className="ax-menu__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>;

/* ───────────────────────── Directions ───────────────────────── */
function Directions() {
  const basic = (
    <>
      <button className="ax-menu__item" role="menuitem">Overview</button>
      <button className="ax-menu__item" role="menuitem">Reports</button>
      <button className="ax-menu__item" role="menuitem">Settings</button>
    </>
  );
  return (
    <div className="ax-card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-4)', alignItems: 'flex-start', minHeight: '220px' }}>
      {/* Down */}
      <Dropdown menuStyle={{ insetBlockStart: 'calc(100% + 6px)', insetInlineStart: 0 }} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--secondary" onClick={toggle} aria-expanded={open}>
          <span className="ax-btn__label">Down</span>
          {CHEV_DOWN}
        </button>
      )}>{() => basic}</Dropdown>
      {/* Up */}
      <Dropdown style={{ alignSelf: 'flex-end' }} className="ax-dropdown" menuStyle={{ insetBlockEnd: 'calc(100% + 6px)', insetInlineStart: 0 }} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--secondary" onClick={toggle} aria-expanded={open}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6 -6l6 6" /></svg>
          <span className="ax-btn__label">Up</span>
        </button>
      )}>{() => basic}</Dropdown>
      {/* End */}
      <Dropdown menuStyle={{ insetBlockStart: 0, insetInlineStart: 'calc(100% + 6px)' }} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--secondary" onClick={toggle} aria-expanded={open}>
          <span className="ax-btn__label">End</span>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6l-6 6" /></svg>
        </button>
      )}>{() => basic}</Dropdown>
      {/* Start */}
      <Dropdown style={{ marginInlineStart: 'auto' }} menuStyle={{ insetBlockStart: 0, insetInlineEnd: 'calc(100% + 6px)' }} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--secondary" onClick={toggle} aria-expanded={open}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6l6 6" /></svg>
          <span className="ax-btn__label">Start</span>
        </button>
      )}>{() => basic}</Dropdown>
    </div>
  );
}

/* ───────────────────────── Icons + shortcuts + danger ───────────────────────── */
function RichMenu() {
  return (
    <div className="ax-card__body" style={{ minHeight: '264px' }}>
      <Dropdown menuStyle={{ insetBlockStart: 'calc(100% + 6px)', insetInlineStart: 0, minWidth: '248px' }} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--primary" onClick={toggle} aria-expanded={open}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
          <span className="ax-btn__label">Create</span>
          {CHEV_DOWN}
        </button>
      )}>{() => (
        <>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /></svg>
            New report <span className="ax-menu__shortcut">⌘N</span>
          </button>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12a9 9 0 0 1 9 -9" /><path d="M14 21a9 9 0 0 0 5 -8" /></svg>
            New invoice <span className="ax-menu__shortcut">⌘I</span>
          </button>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 11h6m-3 -3v6" /></svg>
            Invite member <span className="ax-menu__shortcut">⌘U</span>
          </button>
          <hr className="ax-menu__divider" />
          <button className="ax-menu__item ax-menu__item--danger" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
            Delete workspace
          </button>
        </>
      )}</Dropdown>
    </div>
  );
}

/* ───────────────────────── Headers & sections (profile) ───────────────────────── */
function ProfileMenu() {
  return (
    <div className="ax-card__body" style={{ minHeight: '492px' }}>
      <Dropdown menuStyle={{ insetBlockStart: 'calc(100% + 6px)', insetInlineStart: 0, minWidth: '260px' }} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--ghost" onClick={toggle} aria-expanded={open} style={{ gap: 'var(--ax-space-3)', paddingInlineStart: '6px' }}>
          <span className="ax-avatar ax-avatar--sm" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>AS</span>
          <span className="ax-btn__label">Ava Sutton</span>
          {CHEV_DOWN}
        </button>
      )}>{() => (
        <>
          {/* header block */}
          <div style={{ display: 'flex', gap: 'var(--ax-space-3)', alignItems: 'center', padding: 'var(--ax-space-2) var(--ax-space-3) var(--ax-space-3)' }}>
            <span className="ax-avatar ax-avatar--md" style={{ background: 'var(--ax-accent-wash)', color: 'var(--ax-accent)' }}>AS</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 'var(--ax-weight-medium)', color: 'var(--ax-text-strong)' }}>Ava Sutton</div>
              <div className="ax-text-truncate" style={{ fontSize: 'var(--ax-text-xs)', color: 'var(--ax-text-subtle)' }}>ava.sutton@northwindlabs.app</div>
            </div>
          </div>
          <hr className="ax-menu__divider" />
          <div className="ax-menu__section-label" role="presentation">Account</div>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></svg>
            Your profile
          </button>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" /><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></svg>
            Settings <span className="ax-menu__shortcut">⌘,</span>
          </button>
          <hr className="ax-menu__divider" />
          <div className="ax-menu__section-label" role="presentation">Workspace</div>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21l18 0" /><path d="M5 21v-14l8 -4v18" /><path d="M19 21v-10l-6 -4" /></svg>
            Northwind Labs
          </button>
          <button className="ax-menu__item" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 17l3 -3l-3 -3" /></svg>
            Billing &amp; plan
          </button>
          <hr className="ax-menu__divider" />
          <button className="ax-menu__item ax-menu__item--danger" role="menuitem">
            <svg className="ax-menu__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" /><path d="M9 12h12l-3 -3" /><path d="M18 15l3 -3" /></svg>
            Sign out
          </button>
        </>
      )}</Dropdown>
    </div>
  );
}

/* ───────────────────────── Checkable + split button ───────────────────────── */
function Checkable() {
  const [sort, setSort] = useState('recent');
  const [cols, setCols] = useState({ customer: true, date: true, amount: true, status: false });
  const menuStyle: React.CSSProperties = { insetBlockStart: 'calc(100% + 6px)', insetInlineStart: 0 };
  return (
    <div className="ax-card__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-4)', alignItems: 'flex-start', minHeight: '240px' }}>
      {/* Checkable sort menu */}
      <Dropdown menuStyle={menuStyle} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--secondary" onClick={toggle} aria-expanded={open}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l4 -4l4 4m-4 -4v14" /><path d="M21 15l-4 4l-4 -4m4 4v-14" /></svg>
          <span className="ax-btn__label">Sort: <span style={{ textTransform: 'capitalize' }}>{sort}</span></span>
        </button>
      )}>{({ close }) => (
        <>
          <div className="ax-menu__section-label" role="presentation">Sort by</div>
          {([['recent', 'Most recent'], ['value', 'Highest value'], ['name', 'Name (A–Z)']] as const).map(([v, label]) => (
            <button key={v} className={`ax-menu__item${sort === v ? ' is-selected' : ''}`} role="menuitemradio" aria-checked={sort === v} onClick={() => { setSort(v); close(); }}>
              {label}{CHECK}
            </button>
          ))}
        </>
      )}</Dropdown>

      {/* Multi-toggle columns menu */}
      <Dropdown menuStyle={menuStyle} trigger={({ open, toggle }) => (
        <button type="button" className="ax-btn ax-btn--secondary" onClick={toggle} aria-expanded={open}>
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h6v6h-6z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6h-6z" /><path d="M14 14h6v6h-6z" /></svg>
          <span className="ax-btn__label">Columns</span>
        </button>
      )}>{() => (
        <>
          <div className="ax-menu__section-label" role="presentation">Visible columns</div>
          {([['customer', 'Customer'], ['date', 'Date'], ['amount', 'Amount'], ['status', 'Status']] as const).map(([k, label]) => (
            <button key={k} className={`ax-menu__item${cols[k] ? ' is-selected' : ''}`} role="menuitemcheckbox" aria-checked={cols[k]} onClick={(e) => { e.stopPropagation(); setCols((c) => ({ ...c, [k]: !c[k] })); }}>
              {label}{CHECK}
            </button>
          ))}
        </>
      )}</Dropdown>

      {/* Split button */}
      <Dropdown className="ax-btn-group ax-btn-group--split" style={{ position: 'relative' }} menuStyle={{ insetBlockStart: 'calc(100% + 6px)', insetInlineEnd: 0 }} trigger={({ open, toggle }) => (
        <>
          <button type="button" className="ax-btn ax-btn--primary">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21v-16a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M9 13l2 2l4 -4" /></svg>
            <span className="ax-btn__label">Save</span>
          </button>
          <button type="button" className="ax-btn ax-btn--primary ax-btn-group__caret ax-btn--icon" onClick={toggle} aria-expanded={open} aria-label="More save options">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6l6 -6" /></svg>
          </button>
        </>
      )}>{() => (
        <>
          <button className="ax-menu__item" role="menuitem">Save</button>
          <button className="ax-menu__item" role="menuitem">Save &amp; new</button>
          <button className="ax-menu__item" role="menuitem">Save as draft</button>
          <button className="ax-menu__item" role="menuitem">Save as template</button>
        </>
      )}</Dropdown>
    </div>
  );
}

export function Dropdowns() {
  return (
    <>
      <PageHead
        title="Dropdowns"
        subtitle="Glass overlay menus — every direction, with icons, shortcuts, headers, dividers and checkable items."
        actions={
          <Link className="ax-btn ax-btn--secondary ax-btn--pill" href="/ui/modals">
            <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M4 9h16" /></svg>
            <span className="ax-btn__label">Modals</span>
          </Link>
        }
      />

      <div className="ax-dash-grid">
        <section className="ax-card ax-col--6" role="region" aria-label="Dropdown directions">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Placement</span>
              <h2 className="ax-card__title">Directions</h2>
              <p className="ax-card__subtitle">Down (default), up, end and start. Click a trigger to open.</p>
            </div>
          </div>
          <Directions />
        </section>

        <section className="ax-card ax-col--6" role="region" aria-label="Dropdown with icons and shortcuts">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Rich items</span>
              <h2 className="ax-card__title">Icons, shortcuts &amp; danger</h2>
              <p className="ax-card__subtitle">A full action menu with leading icons, key hints and a destructive row.</p>
            </div>
          </div>
          <RichMenu />
        </section>

        <section className="ax-card ax-col--6" role="region" aria-label="Dropdown with headers and sections">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Grouped</span>
              <h2 className="ax-card__title">Headers &amp; sections</h2>
              <p className="ax-card__subtitle">A profile menu with a header block, section labels and dividers.</p>
            </div>
          </div>
          <ProfileMenu />
        </section>

        <section className="ax-card ax-col--6" role="region" aria-label="Checkable dropdown and split button">
          <div className="ax-card__header">
            <div className="ax-card__titles">
              <span className="ax-card__eyebrow">Selection</span>
              <h2 className="ax-card__title">Checkable items &amp; split button</h2>
              <p className="ax-card__subtitle">Single-choice filter and a split CTA with its own caret menu.</p>
            </div>
          </div>
          <Checkable />
        </section>
      </div>
    </>
  );
}

export default Dropdowns;
