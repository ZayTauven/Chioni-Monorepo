'use client';
/*
 * Vireo Next.js — Command palette (⌘K), native re-implementation of
 * core/command-palette.js. Builds searchable rows from the nav-manifest, groups
 * them by section, supports ↑/↓/Enter and Escape, and navigates via the router.
 * Renders the reference #ax-command / .ax-command__* DOM contract.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { manifest, hrefForSlug, type NavNode } from '../../lib/manifest';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCenter } from '@/context/CenterContext';
import { navNodeVisible } from './Sidebar';
import type { StaffRole } from '@/lib/types';

interface Row {
  node: NavNode;
  crumb: string;
}

function buildRows(roles: readonly StaffRole[]): Row[] {
  const rows: Row[] = [];
  for (const n of manifest.nodes) {
    if (n.alias) continue; // canonical entries only
    // Skip pure group containers (nodes whose children carry the real pages);
    // Chioni's flat manifest has none, so every top-level node is a page.
    if (manifest.childrenOf(n.id).length > 0) continue;
    // Role-gated entries (S1) follow the sidebar's visibility rule
    // (multi-roles S2: every hat counts, gating only ever widens).
    if (!navNodeVisible(n.id, roles)) continue;
    const trail = manifest.trail(n).slice(0, -1).map((t) => t.title);
    rows.push({ node: n, crumb: trail.join(' › ') });
  }
  return rows;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { roles } = useCenter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const allRows = useMemo(() => buildRows(roles), [roles]);
  useFocusTrap(panelRef, open);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return allRows.slice(0, 12);
    return allRows
      .filter(
        (r) =>
          r.node.title.toLowerCase().includes(query) ||
          (r.node.keywords || []).some((k) => k.toLowerCase().includes(query)),
      )
      .slice(0, 30);
  }, [q, allRows]);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      // focus after mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open) return null;

  const go = (row: Row) => {
    onClose();
    router.push(hrefForSlug(manifest.resolve(row.node)!.slug));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div id="ax-command" className="ax-command is-open" onKeyDown={onKey}>
      <button
        type="button"
        className="ax-command__backdrop"
        aria-label="Fermer la recherche"
        onClick={onClose}
      />
      <div className="ax-command__panel" role="dialog" aria-modal="true" aria-label="Search" ref={panelRef}>
        <div className="ax-command__input">
          <svg
            className="ax-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={24}
            height={24}
            aria-hidden="true"
          >
            <path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
            <path d="M21 21l-6 -6" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher une page…"
            aria-label="Rechercher"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ax-command__results" role="listbox">
          {results.length === 0 && <p className="ax-command__empty">Aucun résultat.</p>}
          {results.map((row, i) => (
            <button
              key={row.node.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`ax-command__row${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(row)}
            >
              <span className="ax-command__row-title">{row.node.title}</span>
              {row.crumb && <span className="ax-command__crumb">{row.crumb}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
