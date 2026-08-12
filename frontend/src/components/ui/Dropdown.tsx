'use client';
/*
 * Vireo Next.js — Dropdown primitive (native re-implementation of Alpine axDropdown).
 *
 * Renders the reference DOM contract: a trigger button that toggles a panel,
 * with aria-haspopup/aria-expanded/aria-controls wired, close on outside-click
 * and Escape. The panel uses the shared .ax-dropdown classes so pixels match.
 * Presentational + portable: NO router imports.
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

interface DropdownProps {
  /** Class on the wrapper (e.g. "ax-lang", "ax-apps", "ax-notif"). */
  className?: string;
  /** Render the trigger. Receives state + handlers to spread onto a <button>. */
  trigger: (args: {
    open: boolean;
    toggle: () => void;
    triggerProps: {
      'aria-haspopup': 'menu' | 'dialog';
      'aria-expanded': boolean;
      'aria-controls': string;
      onClick: () => void;
    };
  }) => ReactNode;
  /** Render the panel body (the .ax-dropdown content). */
  children: ReactNode;
  /** Class on the panel element. */
  panelClassName?: string;
  /** role of the panel: menu (default) or dialog. */
  panelRole?: 'menu' | 'dialog';
  panelAriaLabel?: string;
}

export function Dropdown({
  className,
  trigger,
  children,
  panelClassName,
  panelRole = 'menu',
  panelAriaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  useClickOutside(wrap, open, () => setOpen(false));

  const toggle = () => setOpen((o) => !o);

  return (
    <div className={className} ref={wrap}>
      {trigger({
        open,
        toggle,
        triggerProps: {
          'aria-haspopup': panelRole,
          'aria-expanded': open,
          'aria-controls': panelId,
          onClick: toggle,
        },
      })}
      {open && (
        <div
          id={panelId}
          className={panelClassName}
          role={panelRole}
          aria-label={panelAriaLabel}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
