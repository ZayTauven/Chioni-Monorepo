'use client';
/*
 * Vireo Next.js — shared UI primitives for the ui/* component-library pages.
 *
 * Native React re-implementations of the Alpine helpers used across the
 * reference ui pages (axModal, axOffcanvas, popover open-state, $toast). These
 * are NOT shell files — they live with the ui screens and are imported by the
 * Modals / Offcanvas / Popovers / Notifications / Navbar pages. They reproduce
 * the reference .ax-modal / .ax-offcanvas / .ax-popover DOM, classes and ARIA
 * 1:1; only the open/close wiring is React state instead of Alpine.
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/* ──────────────────────────────────────────────────────────────────────────
 * Toast — mirrors the reference $toast({ msg, tone, ttl }) magic.
 * A single fixed stack in a portal; auto-dismiss after ttl (default 3000ms).
 * ────────────────────────────────────────────────────────────────────────── */
interface ToastOpts {
  msg: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  ttl?: number;
}
interface ToastItem extends ToastOpts {
  id: number;
}
const ToastCtx = createContext<(o: ToastOpts | string) => void>(() => {});

const TONE_COLOR: Record<string, string> = {
  success: 'var(--ax-success-500)',
  warning: 'var(--ax-warning-500)',
  danger: 'var(--ax-danger-500)',
  info: 'var(--ax-info-500)',
  neutral: 'var(--ax-text-muted)',
};

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const push = (o: ToastOpts | string) => {
    const opts: ToastOpts = typeof o === 'string' ? { msg: o } : o;
    const id = Date.now() + Math.random();
    setItems((cur) => [...cur, { id, ...opts }]);
    window.setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), opts.ttl ?? 3000);
  };

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted &&
        createPortal(
          <div style={{ position: 'fixed', insetBlockEnd: 'var(--ax-space-6)', insetInlineEnd: 'var(--ax-space-6)', zIndex: 90, display: 'flex', flexDirection: 'column', gap: 'var(--ax-space-3)' }} role="status" aria-live="polite">
            {items.map((t) => {
              const c = TONE_COLOR[t.tone || 'neutral'];
              return (
                <div key={t.id} className="ax-card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--ax-space-3)', padding: 'var(--ax-space-3) var(--ax-space-4)', minWidth: 240, borderColor: t.tone ? `color-mix(in oklab,${c} 40%,var(--ax-border))` : 'var(--ax-border)', boxShadow: 'var(--ax-shadow-md)' }}>
                  {t.tone && (
                    <span className="ax-avatar ax-avatar--sm ax-avatar--squircle" style={{ background: `color-mix(in oklab,${c} 18%,transparent)`, color: c }}>
                      {CHECK}
                    </span>
                  )}
                  <b style={{ color: 'var(--ax-text-strong)', fontSize: 'var(--ax-text-sm)' }}>{t.msg}</b>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Modal — re-implements axModal() + .ax-modal markup (teleported to body).
 * ────────────────────────────────────────────────────────────────────────── */
export function Modal({
  open,
  onClose,
  children,
  centered = true,
  bare = false,
  alertdialog = false,
  labelledBy,
  describedBy,
  dialogClassName = '',
  dialogStyle,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  centered?: boolean;
  bare?: boolean;
  alertdialog?: boolean;
  labelledBy?: string;
  describedBy?: string;
  dialogClassName?: string;
  dialogStyle?: React.CSSProperties;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useFocusTrap(dialogRef, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className={`ax-modal${centered ? ' ax-modal--centered' : ''}`} role={alertdialog ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} style={bare ? { padding: 0 } : undefined}>
      {!bare && <div className="ax-modal__backdrop" onClick={onClose} />}
      <div ref={dialogRef} className={`ax-modal__dialog ${dialogClassName}`.trim()} style={dialogStyle}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const X_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6l-12 12" /><path d="M6 6l12 12" /></svg>
);

/* ──────────────────────────────────────────────────────────────────────────
 * Offcanvas — re-implements axOffcanvas(edge) + .ax-offcanvas markup.
 * ────────────────────────────────────────────────────────────────────────── */
type Edge = 'start' | 'end' | 'top' | 'bottom';
const TRANSFORM: Record<Edge, [string, string]> = {
  start: ['translateX(0)', 'translateX(-100%)'],
  end: ['translateX(0)', 'translateX(100%)'],
  top: ['translateY(0)', 'translateY(-100%)'],
  bottom: ['translateY(0)', 'translateY(100%)'],
};

export function Offcanvas({
  open,
  onClose,
  edge,
  size,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  edge: Edge;
  size?: 'sm' | 'lg';
  labelledBy?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useFocusTrap(panelRef, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;
  const sizeClass = size ? ` ax-offcanvas__panel--${size}` : '';
  return createPortal(
    <div className="ax-offcanvas">
      <div className="ax-offcanvas__backdrop" onClick={onClose} />
      <aside
        ref={panelRef}
        className={`ax-offcanvas__panel ax-offcanvas__panel--${edge}${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ transition: 'transform var(--ax-motion-base) var(--ax-ease-standard)', transform: TRANSFORM[edge][0] }}
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * usePopover — open state + outside-click + Escape, mirrors the Alpine
 * { open:false } @click.outside / @keydown.escape pattern on .ax-popover.
 * ────────────────────────────────────────────────────────────────────────── */
export function usePopover() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { ref, open, setOpen, id };
}
