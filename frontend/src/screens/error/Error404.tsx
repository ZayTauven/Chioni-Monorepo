'use client';
/*
 * Vireo Next.js — 404 Page not found.
 * 1:1 re-expression of src/html/error/404.html: standalone status screen with a
 * broken-link illustration, an inline search form (demo, no network — routes to
 * search-results with the query), go-home / contact-support actions and a row of
 * helpful jump links.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusStandalone, StatusHeading, StatusIllustration } from './errorShared';

export function Error404() {
  const [q, setQ] = useState('');
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/pages/search-results?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <StatusStandalone maxWidth={560}>
      <StatusIllustration>
        <svg viewBox="0 0 24 24" width={72} height={72} fill="none" stroke="var(--ax-text-muted)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 16l-4 4" /><path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5" /><path d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5" /><path d="M3 21l2.5 -2.5" /><path d="M18.5 5.5l2.5 -2.5" stroke="var(--ax-accent)" /><path d="M10 11l-2 2" stroke="var(--ax-accent)" /><path d="M13 14l-2 2" /><path d="M16 16l4 4" />
        </svg>
      </StatusIllustration>

      <StatusHeading code="404" title="Page not found"
        body="We couldn't find the page you were looking for. It may have been moved, renamed, or never existed. Try searching instead." />

      <form className="ax-input-group" role="search" aria-label="Search the workspace" style={{ width: '100%', maxWidth: 420, height: 44 }} onSubmit={submit}>
        <span className="ax-input-group__addon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
        </span>
        <input type="search" className="ax-input" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, people, files…" aria-label="Search query" autoComplete="off" />
        <button type="submit" className="ax-btn ax-btn--primary" style={{ borderRadius: 0 }}>
          <span className="ax-btn__label">Search</span>
        </button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ax-space-3)', justifyContent: 'center' }}>
        <Link className="ax-btn ax-btn--primary" href="/">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
          <span className="ax-btn__label">Go home</span>
        </Link>
        <Link className="ax-btn ax-btn--secondary" href="/pages/support">
          <svg className="ax-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 9h8" /><path d="M8 13h6" /><path d="M9 18l-3 3v-3h-1a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-7z" /></svg>
          <span className="ax-btn__label">Contact support</span>
        </Link>
      </div>

      <p style={{ margin: 0, fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-subtle)' }}>
        Or jump to{' '}
        <Link className="ax-link" href="/">Dashboard</Link> ·{' '}
        <Link className="ax-link" href="/pages/profile">Your profile</Link> ·{' '}
        <Link className="ax-link" href="/pages/faq">Help center</Link>
      </p>
    </StatusStandalone>
  );
}

export default Error404;
