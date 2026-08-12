'use client';
/*
 * Vireo Next.js — page loader (1:1 with partials/loader.html).
 *
 * Full-screen overlay shown on first boot, hidden once the app mounts. The
 * customizer "Page loader" toggle writes data-ax-loader="off" which the shared
 * CSS uses to suppress it. Reuses the .ax-spinner component (no bespoke CSS).
 */
import { useEffect, useState } from 'react';

export function Loader() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Respect the loader toggle: remove immediately when off.
    if (document.documentElement.getAttribute('data-ax-loader') === 'off') {
      setRemoved(true);
      return;
    }
    const t = setTimeout(() => setHidden(true), 200);
    const r = setTimeout(() => setRemoved(true), 800);
    return () => {
      clearTimeout(t);
      clearTimeout(r);
    };
  }, []);

  if (removed) return null;
  return (
    <div
      className={`ax-loader${hidden ? ' is-hidden' : ''}`}
      data-ax-loader-el
      role="status"
      aria-live="polite"
      aria-label="Loading"
      aria-hidden={hidden}
    >
      <span className="ax-spinner ax-spinner--lg" aria-hidden="true">
        <span className="ax-spinner__glyph"></span>
      </span>
    </div>
  );
}

export default Loader;
