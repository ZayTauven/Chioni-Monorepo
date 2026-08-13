'use client';
/*
 * Vireo Next.js — shared auth helpers (non-route).
 *
 * The auth section is a set of STANDALONE pages (no app shell). Each page is a
 * full-viewport screen with: the page loader, ambient glow, the fixed top-right
 * off-app tools (theme + locale), and a brand mark. These bits are factored here
 * so every auth screen is a 1:1 re-expression of src/html/auth/*.html.
 *
 * Off-app tools mirror the reference axOffappTools(): toggle data-ax-theme and
 * cycle ax:lang locally (the customizer's full state isn't mounted here — these
 * pages live outside <Layout> / CustomizerProvider). Two variants exist in the
 * reference: a full "language pill + theme icon-btn" set (sign-in/up, reset,
 * two-step basic) and a compact "theme ghost icon-btn + static EN" set (create-
 * password, lock-screen, coming-soon, maintenance, *-cover).
 *
 * Adapted verbatim from the React edition (editions/react/src/pages/auth/
 * authShared.tsx); the only differences are next/link (Link `href` not `to`) and
 * the 'use client' boundary (these all use hooks).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';

const SUN = (
  <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={22} height={22} aria-hidden="true"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>
);
const MOON = (
  <svg className="ax-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width={22} height={22} aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
);
const MOON_BTN = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
);

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-ax-theme') === 'dark' ? 'dark' : 'light');
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-ax-theme', next);
    try {
      localStorage.setItem('ax:theme', next);
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new CustomEvent('ax:change'));
  };
  return { theme, toggle };
}

/** Off-app tools: theme toggle only (interface in French; shikomori = phase 2). */
export function OffappTools({ style }: { style?: CSSProperties }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="ax-cluster" style={{ gap: 'var(--ax-space-2)', ...style }}>
      <button type="button" className="ax-icon-btn" onClick={toggle} aria-pressed={theme === 'dark'} aria-label="Basculer le mode sombre">
        {theme === 'dark' ? SUN : MOON}
      </button>
    </div>
  );
}

/** Compact off-app tools: theme ghost icon-btn (cover screens). */
export function OffappToolsCompact({ style }: { style?: CSSProperties }) {
  const { toggle } = useTheme();
  return (
    <div className="ax-cluster" style={{ position: 'fixed', insetBlockStart: 'var(--ax-space-5)', insetInlineEnd: 'var(--ax-space-6)', zIndex: 5, gap: 'var(--ax-space-2)', ...style }}>
      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Basculer le mode sombre" onClick={toggle}>
        {MOON_BTN}
      </button>
    </div>
  );
}

const HEX_LOGO = (_size: number) => (
  <svg viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

/** Centered brand lockup (sign-in / verify / staff). */
export function BrandCentered({ logoSize = 42, glyph = 24, textSize = 'var(--ax-text-xl)' }: { logoSize?: number; glyph?: number; textSize?: string }) {
  return (
    <Link href="/" className="ax-center" aria-label="Accueil Chioni" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none', flexDirection: 'row', justifyContent: 'center' }}>
      <span className="ax-center" aria-hidden="true" style={{ inlineSize: logoSize, blockSize: logoSize, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>
        {HEX_LOGO(glyph)}
      </span>
      <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', fontSize: textSize, color: 'var(--ax-text-strong)', letterSpacing: '-.01em' }}>Chioni</span>
    </Link>
  );
}

/** Inline brand lockup (cover form pane). */
export function BrandInline({ logoSize = 38, glyph = 22, textSize = 'var(--ax-text-lg)' }: { logoSize?: number; glyph?: number; textSize?: string }) {
  return (
    <Link href="/" className="ax-cluster" aria-label="Accueil Chioni" style={{ gap: 'var(--ax-space-3)', textDecoration: 'none' }}>
      <span className="ax-center" aria-hidden="true" style={{ inlineSize: logoSize, blockSize: logoSize, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>
        {HEX_LOGO(glyph)}
      </span>
      <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 'var(--ax-weight-semibold)', fontSize: textSize, color: 'var(--ax-text-strong)' }}>Chioni</span>
    </Link>
  );
}

/**
 * Standalone page wrapper: sets <body class="ax-standalone"> while mounted (the
 * reference puts that class on <body>) and renders the page content. Cover pages
 * pass `cover` to skip the body class (their reference <body> uses inline
 * margin:0 instead).
 *
 * NOTE: the page loader + ambient glow are rendered ONCE by the (bare) route-group
 * layout (app/(bare)/layout.tsx), so they are deliberately NOT repeated here —
 * unlike the React edition where the wrapper owns them. This keeps the bare shell
 * single-sourced and avoids double loaders/ambients.
 */
export function AuthStandalone({ cover = false, children }: { cover?: boolean; children: ReactNode }) {
  useEffect(() => {
    const b = document.body;
    const had = b.className;
    if (cover) {
      b.style.margin = '0';
    } else {
      b.classList.add('ax-standalone');
    }
    return () => {
      b.className = had;
      b.style.margin = '';
    };
  }, [cover]);
  return <>{children}</>;
}

/* Reusable social provider buttons (Google / Apple / GitHub). */
export function SocialButtons({ verb }: { verb: 'Continue' | 'Sign up' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--ax-space-2)' }}>
      <button type="button" className="ax-btn ax-btn--secondary" aria-label={`${verb} with Google`}>
        <svg className="ax-btn__icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" /><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" /><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" /></svg>
      </button>
      <button type="button" className="ax-btn ax-btn--secondary" aria-label={`${verb} with Apple`}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" /></svg>
      </button>
      <button type="button" className="ax-btn ax-btn--secondary" aria-label={`${verb} with GitHub`}>
        <svg className="ax-btn__icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z" /></svg>
      </button>
    </div>
  );
}

/* Password reveal eye icons. */
export const EYE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>
);
export const EYE_OFF = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>
);
