/*
 * Vireo React — focus trap for dialogs/offcanvas (mirrors core/focus-trap.js).
 * Traps Tab within the container while active, restores focus on close, and
 * focuses the first focusable on open. Portable.
 */
import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // SV — `preventScroll` : le focus d'ouverture ne doit jamais faire
    // défiler un dialogue plus haut que l'écran (il s'ouvrait déjà défilé
    // vers le bas). Les modales remettent ensuite leur corps à zéro.
    const first = focusables()[0];
    if (first) first.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [ref, active]);
}
