/*
 * Vireo React — color utilities for the custom-accent picker.
 * Direct TS port of src/js/core/color.js. Pure functions: hex parsing, sRGB
 * luminance, lighten/darken, and the deterministic 50→900 ramp + Layer-2 accent
 * aliases the token system consumes.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** "#1E856C" | "1E856C" | "#abc" → {r,g,b} (0-255) or null. */
export function parseHex(hex: unknown): RGB | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: RGB): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** Relative sRGB luminance (0-1), used to pick on-accent ink. */
export function luminance({ r, g, b }: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Contrast-correct text colour to sit on top of a given fill. */
export function onColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return '#FFFFFF';
  return luminance(rgb) > 0.62 ? '#1F1602' : '#FFFFFF';
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

export function lighten(rgb: RGB, t: number): RGB {
  return mix(rgb, WHITE, t);
}
export function darken(rgb: RGB, t: number): RGB {
  return mix(rgb, BLACK, t);
}

/** "30, 133, 108" channel string for rgba() glow/wash derivations. */
export function rgbString(hex: string): string {
  const rgb = parseHex(hex);
  return rgb ? `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}` : '0, 0, 0';
}

/** Derive the full accent ramp + Layer-2 aliases for a custom hex. */
export function deriveRamp(hex: string): Record<string, string> {
  const base = parseHex(hex);
  if (!base) return {};
  const stops: Record<string, string> = {
    '--ax-accent-50': toHex(lighten(base, 0.92)),
    '--ax-accent-100': toHex(lighten(base, 0.84)),
    '--ax-accent-150': toHex(lighten(base, 0.76)),
    '--ax-accent-200': toHex(lighten(base, 0.68)),
    '--ax-accent-300': toHex(lighten(base, 0.5)),
    '--ax-accent-400': toHex(lighten(base, 0.25)),
    '--ax-accent-500': toHex(base),
    '--ax-accent-600': toHex(darken(base, 0.16)),
    '--ax-accent-700': toHex(darken(base, 0.32)),
    '--ax-accent-800': toHex(darken(base, 0.48)),
    '--ax-accent-900': toHex(darken(base, 0.62)),
  };
  return {
    ...stops,
    '--ax-accent': toHex(base),
    '--ax-accent-hover': toHex(lighten(base, 0.14)),
    '--ax-accent-rgb': rgbString(hex),
    '--ax-on-accent': onColor(hex),
    '--ax-chart-1': toHex(base),
  };
}
