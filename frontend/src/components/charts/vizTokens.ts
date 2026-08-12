/*
 * Vireo Next.js — SSR-safe token→literal resolver for chart pages.
 *
 * ApexCharts needs concrete color literals in options like `apex.colors`; it does
 * not resolve CSS `var(--…)`. The chart pages in the reference call
 * `getComputedStyle(...)` at render, which crashes the RSC/SSR prerender. This
 * helper returns canonical Aurora fallbacks on the server (no `document`) and the
 * real computed tokens in the browser — the <ApexChart> live re-theme on
 * `ax:change` repaints with the true tokens after hydration. Mirrors the
 * `vizColors` pattern in dashboards/Sales.tsx.
 */
const FALLBACK: Record<string, string> = {
  '--ax-accent': '#1E856C',
  '--ax-viz-cyan': '#38BDF8',
  '--ax-viz-violet': '#A78BFA',
  '--ax-viz-pink': '#F472B6',
  '--ax-viz-amber': '#FBBF24',
  '--ax-viz-emerald': '#34D399',
  '--ax-viz-red': '#FB7185',
  '--ax-chart-1': '#38BDF8',
  '--ax-chart-2': '#A78BFA',
  '--ax-chart-3': '#F472B6',
  '--ax-chart-4': '#FBBF24',
  '--ax-chart-5': '#34D399',
  '--ax-chart-6': '#FB7185',
  '--ax-success-500': '#34D399',
  '--ax-warning-500': '#FBBF24',
  '--ax-danger-500': '#FB7185',
  '--ax-border': 'rgba(148,163,184,.18)',
  '--ax-border-strong': 'rgba(148,163,184,.32)',
  '--ax-text': '#CBD5E1',
  '--ax-text-muted': '#98A2B3',
  '--ax-text-subtle': '#646E80',
  '--ax-text-strong': '#F8FAFC',
  '--ax-surface-solid': '#0F172A',
  '--ax-surface-subtle': '#111C31',
  '--ax-surface-overlay': '#1E293B',
  '--ax-on-accent': '#0B141E',
  '--ax-font-sans': 'Inter, system-ui, sans-serif',
  '--ax-font-mono': 'JetBrains Mono, ui-monospace, monospace',
};

/** Resolve one `--ax-*` token to a concrete value (SSR-safe). */
export function cv(token: string): string {
  if (typeof document === 'undefined') return FALLBACK[token] ?? '#38BDF8';
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return v || FALLBACK[token] || '#38BDF8';
}

/** Resolve a list of tokens to literals. */
export function cvAll(tokens: string[]): string[] {
  return tokens.map(cv);
}
