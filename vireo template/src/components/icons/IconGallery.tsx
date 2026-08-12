'use client';
/*
 * Vireo Next.js — icon gallery (port of the reference `iconGallery()` Alpine
 * component used by icons/tabler|line|solid|brands). Search + variant toggle
 * (Tabler outline↔filled) + size/color preview + click-to-copy toast. Icons are
 * inline SVG on a 24×24 grid using currentColor; paths come from the shared
 * src/data/icons/*.json data files. Page-local styles (.ax-icongrid/.ax-icontile/
 * .ax-copytoast) are inlined verbatim from the reference (role-token last-resort).
 */
import { useEffect, useRef, useState } from 'react';

export interface IconDef {
  n: string;
  c: string;
  k?: string;
  o?: string;
  f?: string;
}

export interface IconGalleryProps {
  icons: IconDef[];
  /** 'tabler' shows the outline↔filled toggle; 'solid' defaults to filled. */
  mode: 'tabler' | 'line' | 'solid' | 'brands';
  ariaLabel: string;
  searchLabel: string;
}

export function IconGallery({ icons, mode, ariaLabel, searchLabel }: IconGalleryProps) {
  const [variant, setVariant] = useState<'outline' | 'filled'>(mode === 'solid' ? 'filled' : 'outline');
  const [size, setSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [color, setColor] = useState<'text' | 'accent' | 'success' | 'danger'>('text');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const term = q.trim().toLowerCase();
  const filtered = !term
    ? icons
    : icons.filter(
        (i) =>
          i.n.toLowerCase().includes(term) ||
          (i.k && i.k.toLowerCase().includes(term)) ||
          (i.c && i.c.toLowerCase().includes(term)),
      );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = (name: string) => {
    try { navigator.clipboard?.writeText(name); } catch { /* noop */ }
    setCopied(name);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <section className="ax-card ax-col--12" role="region" aria-label={ariaLabel}>
        <div className="ax-card__header" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-3)' }}>
          <div className="ax-card__titles">
            <span className="ax-card__eyebrow">{mode === 'brands' ? 'Brand set' : mode === 'solid' ? 'Filled set' : 'System set'}</span>
            <h2 className="ax-card__title">Browse the set</h2>
            <p className="ax-card__subtitle">
              <span className="ax-num">{filtered.length}</span> of <span className="ax-num">{icons.length}</span> shown
              {mode === 'tabler' ? ' · toggle outline ↔ filled' : null}
            </p>
          </div>
          <div className="ax-card__actions" style={{ flexWrap: 'wrap', gap: 'var(--ax-space-2)' }}>
            {mode === 'tabler' && (
              <div className="ax-segment" role="group" aria-label="Icon style">
                <button type="button" className="ax-segment__option" aria-pressed={variant === 'outline'} onClick={() => setVariant('outline')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /></svg>Outline
                </button>
                <button type="button" className="ax-segment__option" aria-pressed={variant === 'filled'} onClick={() => setVariant('filled')}>
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 2a3 3 0 0 1 3 3v14a3 3 0 0 1 -3 3h-14a3 3 0 0 1 -3 -3v-14a3 3 0 0 1 3 -3h14z" /></svg>Filled
                </button>
              </div>
            )}
            <div className="ax-segment" role="group" aria-label="Preview size">
              <button type="button" className="ax-segment__option" aria-pressed={size === 'sm'} onClick={() => setSize('sm')}>SM</button>
              <button type="button" className="ax-segment__option" aria-pressed={size === 'md'} onClick={() => setSize('md')}>MD</button>
              <button type="button" className="ax-segment__option" aria-pressed={size === 'lg'} onClick={() => setSize('lg')}>LG</button>
            </div>
            <div className="ax-segment" role="group" aria-label="Preview color">
              <button type="button" className="ax-segment__option" aria-pressed={color === 'text'} onClick={() => setColor('text')} aria-label="Text color"><span style={{ fontWeight: 600 }}>A</span></button>
              <button type="button" className="ax-segment__option" aria-pressed={color === 'accent'} onClick={() => setColor('accent')} aria-label="Accent color"><span style={{ fontWeight: 600, color: 'var(--ax-accent)' }}>A</span></button>
              <button type="button" className="ax-segment__option" aria-pressed={color === 'success'} onClick={() => setColor('success')} aria-label="Success color"><span style={{ fontWeight: 600, color: 'var(--ax-success-500)' }}>A</span></button>
              <button type="button" className="ax-segment__option" aria-pressed={color === 'danger'} onClick={() => setColor('danger')} aria-label="Danger color"><span style={{ fontWeight: 600, color: 'var(--ax-danger-500)' }}>A</span></button>
            </div>
            <div style={{ position: 'relative', minWidth: 220 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', width: 'var(--ax-icon-sm)', height: 'var(--ax-icon-sm)', color: 'var(--ax-text-subtle)', pointerEvents: 'none' }}><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
              <input type="search" className="ax-input ax-input--sm" placeholder="Search icons…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={searchLabel} style={{ paddingInlineStart: 36, width: '100%' }} />
            </div>
          </div>
        </div>

        <div className="ax-card__body">
          {filtered.length > 0 && (
            <div className="ax-icongrid">
              {filtered.map((ic) => {
                const filled = variant === 'filled' && !!ic.f;
                const markup = filled ? ic.f! : (ic.o ?? ic.f ?? '');
                return (
                  <button key={ic.n} type="button" className="ax-icontile" title={ic.n} onClick={() => copy(ic.n)} aria-label={`Copy icon name ${ic.n}`}>
                    <span className={`ax-icontile__glyph is-${size} is-${color}`}>
                      <svg viewBox="0 0 24 24" fill={filled || mode === 'solid' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
                    </span>
                    <span className="ax-icontile__name ax-truncate">{ic.n}</span>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--ax-space-9) var(--ax-space-4)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 48, height: 48, color: 'var(--ax-text-subtle)', marginBottom: 'var(--ax-space-3)' }}><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /><path d="M7 10l6 0" /></svg>
              <p style={{ fontSize: 'var(--ax-text-md)', fontWeight: 'var(--ax-weight-semibold)', color: 'var(--ax-text-strong)', margin: 0 }}>No icons match &quot;<span>{q}</span>&quot;</p>
              <p style={{ fontSize: 'var(--ax-text-sm)', color: 'var(--ax-text-muted)', margin: '4px 0 var(--ax-space-4)' }}>Try a different name, tag or keyword.</p>
              <button type="button" className="ax-btn ax-btn--secondary ax-btn--sm" onClick={() => setQ('')}>Clear search</button>
            </div>
          )}
        </div>
      </section>

      {copied && (
        <div className="ax-copytoast" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10" /></svg>
          <span>Copied <code className="ax-code" style={{ background: 'transparent', padding: 0, color: 'var(--ax-accent)' }}>{copied}</code></span>
        </div>
      )}

      <style>{`
        .ax-icongrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:var(--ax-space-2);}
        .ax-icontile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--ax-space-2);padding:var(--ax-space-4) var(--ax-space-2);min-width:0;color:var(--ax-text-muted);background:var(--ax-surface-subtle);border:1px solid var(--ax-border);border-radius:var(--ax-radius-md);cursor:pointer;transition:color var(--ax-motion-fast) var(--ax-ease-standard),background var(--ax-motion-fast) var(--ax-ease-standard),border-color var(--ax-motion-fast) var(--ax-ease-standard),transform var(--ax-motion-fast) var(--ax-ease-standard);}
        .ax-icontile:hover{color:var(--ax-accent);background:var(--ax-accent-wash);border-color:var(--ax-border-strong);transform:translateY(-2px);}
        .ax-icontile:focus-visible{outline:2px solid var(--ax-accent);outline-offset:2px;}
        .ax-icontile__glyph{display:grid;place-items:center;height:32px;}
        .ax-icontile__glyph svg{width:24px;height:24px;}
        .ax-icontile__glyph.is-sm svg{width:18px;height:18px;}
        .ax-icontile__glyph.is-md svg{width:24px;height:24px;}
        .ax-icontile__glyph.is-lg svg{width:32px;height:32px;}
        .ax-icontile__glyph.is-accent{color:var(--ax-accent);}
        .ax-icontile__glyph.is-success{color:var(--ax-success-500);}
        .ax-icontile__glyph.is-danger{color:var(--ax-danger-500);}
        .ax-icontile:hover .ax-icontile__glyph.is-text{color:var(--ax-accent);}
        .ax-icontile__name{font-size:var(--ax-text-2xs);color:var(--ax-text-subtle);text-align:center;max-width:100%;}
        .ax-copytoast{position:fixed;inset-block-end:var(--ax-space-6);inset-inline:0;margin-inline:auto;width:max-content;max-width:90vw;z-index:var(--ax-z-toast,80);display:flex;align-items:center;gap:var(--ax-space-2);padding:var(--ax-space-3) var(--ax-space-5);color:var(--ax-text-strong);background:var(--ax-surface-overlay);border:1px solid var(--ax-border);border-radius:var(--ax-radius-pill);box-shadow:var(--ax-shadow-lg);-webkit-backdrop-filter:blur(18px) saturate(1.1);backdrop-filter:blur(18px) saturate(1.1);font-size:var(--ax-text-sm);font-weight:var(--ax-weight-medium);}
        .ax-copytoast svg{width:var(--ax-icon-sm);height:var(--ax-icon-sm);color:var(--ax-success-500);}
      `}</style>
    </>
  );
}

export default IconGallery;
