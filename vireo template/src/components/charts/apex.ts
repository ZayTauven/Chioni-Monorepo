/*
 * Vireo React — ApexCharts token bridge (logic port of src/js/plugins/charts.js).
 *
 * Pure helpers shared by <ApexChart>: read the live --ax-* palette, build the
 * Aurora base option object, deep-merge, and resolve a color token to a literal.
 * Keeping this framework-free means the Next edition can reuse it untouched.
 */
import type { ApexOptions } from 'apexcharts';

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export interface Tokens {
  series: string[];
  accent: string;
  gridColor: string;
  axisText: string;
  labelText: string;
  fontSans: string;
  fontMono: string;
  dark: boolean;
  rtl: boolean;
  reduceMotion: boolean;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Read the current token palette into a plain object. */
export function readTokens(): Tokens {
  const series = [1, 2, 3, 4, 5, 6].map((i) => cssVar(`--ax-chart-${i}`)).filter(Boolean);
  return {
    series: series.length
      ? series
      : ['#38BDF8', '#A78BFA', '#F472B6', '#FBBF24', '#34D399', '#FB7185'],
    accent: cssVar('--ax-accent') || '#1E856C',
    gridColor: cssVar('--ax-border') || 'rgba(255,255,255,.07)',
    axisText: cssVar('--ax-text-subtle') || '#646E80',
    labelText: cssVar('--ax-text-muted') || '#98A2B3',
    fontSans: cssVar('--ax-font-sans') || 'Inter, system-ui, sans-serif',
    fontMono: cssVar('--ax-font-mono') || 'JetBrains Mono, ui-monospace, monospace',
    dark: document.documentElement.getAttribute('data-ax-theme') === 'dark',
    rtl: document.documentElement.getAttribute('dir') === 'rtl',
    reduceMotion: prefersReducedMotion(),
  };
}

/** token name (`--ax-viz-cyan`) | `var(--ax-viz-cyan)` | literal → concrete color. */
export function resolveColor(c?: string | null): string | null {
  if (!c) return null;
  c = String(c).trim();
  const m = c.match(/^var\((--[^)]+)\)$/);
  if (m) return cssVar(m[1]) || null;
  if (c.startsWith('--')) return cssVar(c) || null;
  return c;
}

function abbr(v: unknown): string {
  if (typeof v !== 'number') return String(v);
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(v);
}

export interface BaseOpts {
  type: string;
  height?: number;
  sparkline?: boolean;
  accent?: boolean;
  legend?: string;
  stacked?: boolean;
  tooltip?: boolean;
}

/** Base ApexCharts options built from tokens (Aurora palette/grid/axis/tooltip). */
export function apexBase(t: Tokens, o: BaseOpts): ApexOptions {
  const { type, height = 320, sparkline = false, accent = false, legend = 'bottom', stacked = false, tooltip = true } = o;
  const isLine = type === 'area' || type === 'line';
  return {
    chart: {
      type: type as ApexChart['type'],
      height,
      stacked,
      fontFamily: t.fontSans,
      foreColor: t.labelText,
      toolbar: { show: false },
      background: 'transparent',
      redrawOnParentResize: true,
      sparkline: { enabled: sparkline },
      animations: { enabled: !t.reduceMotion, speed: 280 },
    },
    colors: accent ? [t.accent, ...t.series.slice(1)] : t.series,
    grid: {
      show: !sparkline,
      borderColor: t.gridColor,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: !sparkline } },
      padding: sparkline ? { left: 0, right: 0, top: 0, bottom: 0 } : { left: 8, right: 8 },
    },
    dataLabels: { enabled: false },
    stroke: { width: isLine ? 2 : 0, curve: 'smooth', lineCap: 'round' },
    fill: { type: 'solid', opacity: type === 'area' ? 0.12 : 1 },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
    legend: {
      show: legend !== 'none' && !sparkline,
      position: (legend === 'none' ? 'bottom' : legend) as 'bottom',
      horizontalAlign: 'left',
      fontFamily: t.fontSans,
      fontSize: '13px',
      labels: { colors: t.labelText },
      markers: { size: 4 },
      itemMargin: { horizontal: 10 },
    },
    xaxis: {
      axisBorder: { show: !sparkline, color: t.gridColor },
      axisTicks: { show: false },
      labels: { style: { colors: t.axisText, fontFamily: t.fontMono, fontSize: '12px' } },
    },
    yaxis: {
      labels: {
        style: { colors: t.axisText, fontFamily: t.fontMono, fontSize: '12px' },
        formatter: (v: number) => abbr(v),
      },
    },
    tooltip: { enabled: tooltip, theme: t.dark ? 'dark' : 'light', style: { fontFamily: t.fontSans } },
    markers: { size: 0, hover: { size: 5 } },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function deepMerge<T = Record<string, unknown>>(...sources: Array<Record<string, unknown> | undefined>): T {
  const out: Record<string, unknown> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (isObject(v) && isObject(out[k])) out[k] = deepMerge(out[k] as Record<string, unknown>, v);
      else out[k] = v;
    }
  }
  return out as T;
}

// Minimal local alias to avoid importing the namespace type repeatedly.
type ApexChart = NonNullable<ApexOptions['chart']>;
