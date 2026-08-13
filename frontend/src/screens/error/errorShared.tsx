'use client';
/*
 * Vireo Next.js — shared helpers for the STANDALONE error pages (401/403/404/500/503).
 *
 * 1:1 re-expression of src/html/error/*.html. Each error screen is a full-viewport
 * standalone page (no app shell): the fixed top-right off-app tools (theme toggle
 * ghost icon-btn + "Back to dashboard" link), a brand lockup, a thin-line
 * illustration, the code + title + body, page-specific actions and helper links.
 *
 * Adapted from the React edition (editions/react/src/pages/error/errorShared.tsx);
 * the only differences are next/link (Link `href` not `to`) and the 'use client'
 * boundary (these use hooks). Like the Next (bare) auth wrapper, the page loader +
 * ambient glow are rendered ONCE by app/(bare)/layout.tsx, so StatusStandalone does
 * NOT repeat them (unlike the React wrapper which owns them) — avoids a double
 * loader/ambient.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

const MOON_BTN = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>
);
const ARROW_BACK = (
  <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
);

/** Fixed top-right off-app tools: theme toggle + back-to-dashboard link. */
export function StatusTools() {
  const toggle = () => {
    const html = document.documentElement;
    html.setAttribute('data-ax-theme', html.getAttribute('data-ax-theme') === 'dark' ? 'light' : 'dark');
  };
  return (
    <div style={{ position: 'fixed', top: 'var(--ax-space-5)', right: 'var(--ax-space-6)', zIndex: 5, display: 'flex', gap: 'var(--ax-space-2)', alignItems: 'center' }}>
      <button type="button" className="ax-btn ax-btn--ghost ax-btn--icon" aria-label="Basculer le mode sombre" onClick={toggle}>
        {MOON_BTN}
      </button>
      <Link className="ax-btn ax-btn--ghost ax-btn--sm" href="/">
        {ARROW_BACK}
        <span className="ax-btn__label">Retour à l&rsquo;accueil</span>
      </Link>
    </div>
  );
}

const HEX_LOGO = (
  <svg viewBox="0 0 32 32" width={24} height={24} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="axmk0" x1={4} y1={4} x2={28} y2={28} gradientUnits="userSpaceOnUse"><stop stopColor="#2BC4B0" /><stop offset="0.55" stopColor="#1E9E96" /><stop offset="1" stopColor="#6D5CF0" /></linearGradient></defs><path d="M4 4 H16 A12 12 0 0 1 28 16 V28 A0 0 0 0 1 28 28 H16 A12 12 0 0 1 4 16 V4 Z" fill="url(#axmk0)" stroke="none" /><circle cx="20.5" cy="11.5" r="2.6" fill="#0A0C11" fillOpacity="0.92" stroke="none" /></svg>
);

/** Centered brand lockup (links home). */
export function StatusBrand() {
  return (
    <Link href="/" aria-label="Accueil Chioni" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-3)', textDecoration: 'none' }}>
      <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 40, height: 40, borderRadius: 'var(--ax-radius-md)', background: 'var(--ax-gradient-accent)', color: 'var(--ax-on-accent)', boxShadow: '0 8px 22px -8px rgba(var(--ax-accent-rgb),.7)' }}>
        {HEX_LOGO}
      </span>
      <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-lg)', color: 'var(--ax-text-strong)', letterSpacing: '.01em' }}>Chioni</span>
    </Link>
  );
}

/**
 * Standalone status-page wrapper: sets <body class="ax-standalone"> while mounted
 * (the reference puts that class on <body>), then renders the fixed off-app tools
 * and the centered <main> content. The loader + ambient glow come from the (bare)
 * route-group layout.
 */
export function StatusStandalone({ maxWidth = 520, children }: { maxWidth?: number; children: ReactNode }) {
  useEffect(() => {
    const b = document.body;
    const had = b.className;
    b.classList.add('ax-standalone');
    return () => {
      b.className = had;
    };
  }, []);
  return (
    <>
      <StatusTools />
      <main className="ax-center" id="ax-main" style={{ position: 'relative', zIndex: 1, width: '100%', padding: 'var(--ax-space-6)' }}>
        <div style={{ width: '100%', maxWidth, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--ax-space-6)' }}>
          <StatusBrand />
          {children}
        </div>
      </main>
    </>
  );
}

/** Shared code + title + body block. */
export function StatusHeading({ code, title, body, bodyMaxCh = 42 }: { code: string; title: string; body: ReactNode; bodyMaxCh?: number }) {
  return (
    <div>
      <h1 style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--ax-space-2)' }}>
        <span className="ax-num" style={{ fontFamily: 'var(--ax-font-mono)', fontWeight: 600, fontSize: 'var(--ax-text-4xl)', lineHeight: 1, color: 'var(--ax-text-strong)', letterSpacing: '.04em' }}>{code}</span>
        <span style={{ fontFamily: 'var(--ax-font-display)', fontWeight: 600, fontSize: 'var(--ax-text-2xl)', color: 'var(--ax-text-strong)' }}>{title}</span>
      </h1>
      <p style={{ margin: 'var(--ax-space-4) auto 0', maxWidth: `${bodyMaxCh}ch`, fontSize: 'var(--ax-text-md)', color: 'var(--ax-text-muted)', lineHeight: 1.55 }}>
        {body}
      </p>
    </div>
  );
}

/* Copy-on-click reference-id pill used by 500/503. */
export function ReferenceId({ refId }: { refId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(refId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <>
      <span>Référence</span>
      <button type="button" onClick={copy} className="ax-num"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--ax-space-2)', fontFamily: 'var(--ax-font-mono)', fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text)', background: 'var(--ax-surface-subtle)', border: '1px solid var(--ax-border)', borderRadius: 'var(--ax-radius-sm)', padding: '4px var(--ax-space-3)', cursor: 'pointer' }}
        aria-label={copied ? 'Référence copiée' : `Copier la référence ${refId}`}>
        <span>{refId}</span>
        {!copied
          ? <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" /></svg>
          : <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="var(--ax-success-500)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>}
      </button>
      {copied && <span aria-live="polite" style={{ color: 'var(--ax-success-500)' }}>Copié</span>}
    </>
  );
}

/* shared thin-line illustration ring wrapper. */
export function StatusIllustration({ bg, children }: { bg?: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 160, height: 160, borderRadius: '50%', background: bg ?? 'radial-gradient(circle at 50% 40%, var(--ax-accent-wash), transparent 70%)' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px dashed var(--ax-border-strong)' }} />
      {children}
    </div>
  );
}
