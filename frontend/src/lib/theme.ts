/*
 * Vireo Next.js — runtime theme/customizer logic (the pure DOM+storage layer).
 *
 * Consolidates src/js/core/theme-restore.js + customizer.js. Every mutation:
 *   - sets a data-ax-* attribute on <html>,
 *   - persists/clears the matching ax: localStorage key (default removes BOTH),
 *   - dispatches `ax:change` so the chart wrapper re-themes live.
 *
 * The React <CustomizerProvider> calls these and reflects current values into
 * component state; CSS reacts purely to the <html> attributes. Never changes a
 * token value — only flips the attribute contract per BUILD-CONVENTIONS §4.
 *
 * SSR note (the ONLY divergence from the React edition): `document` does not
 * exist while Next renders on the server, so the document-element reference is
 * resolved lazily through `D` (a no-op stub on the server). Every exported
 * mutator here is only ever called from client effects / event handlers after
 * hydration, so the stub is never actually exercised — it merely keeps the
 * module import-safe in the RSC/SSR pass.
 */

import * as store from './storage';
import { deriveRamp, onColor, parseHex } from './color';

/* Lazy, SSR-safe handle to <html>. On the server `document` is undefined, so we
   hand back an inert stub whose attribute/style ops do nothing; in the browser
   it is the real documentElement. */
const SERVER_STUB = {
  getAttribute: () => null,
  setAttribute: () => {},
  removeAttribute: () => {},
  hasAttribute: () => false,
  style: { setProperty: () => {}, removeProperty: () => {} },
} as unknown as HTMLElement;
const D: HTMLElement =
  typeof document !== 'undefined' ? document.documentElement : SERVER_STUB;
const PREFIX = store.PREFIX;

/* ── attribute ↔ key ↔ default registry (BUILD-CONVENTIONS §4) ── */
export interface RegEntry {
  attr: string;
  key: string;
  def: string;
}
export const REGISTRY: Record<string, RegEntry> = {
  nav: { attr: 'data-ax-nav', key: 'ax:nav', def: 'vertical' },
  'shell-style': { attr: 'data-ax-shell-style', key: 'ax:shell-style', def: 'default' },
  'sidebar-behavior': { attr: 'data-ax-sidebar-behavior', key: 'ax:sidebar-behavior', def: 'collapsible' },
  menu: { attr: 'data-ax-menu', key: 'ax:menu', def: 'click' },
  page: { attr: 'data-ax-page', key: 'ax:page', def: 'regular' },
  width: { attr: 'data-ax-width', key: 'ax:width', def: 'fluid' },
  'header-position': { attr: 'data-ax-header-position', key: 'ax:header-position', def: 'fixed' },
  'sidebar-position': { attr: 'data-ax-sidebar-position', key: 'ax:sidebar-position', def: 'fixed' },
  'sidebar-scheme': { attr: 'data-ax-sidebar', key: 'ax:sidebar-scheme', def: 'light' },
  'header-scheme': { attr: 'data-ax-header', key: 'ax:header-scheme', def: 'light' },
  'sidebar-image': { attr: 'data-ax-sidebar-image', key: 'ax:sidebar-image', def: 'none' },
  loader: { attr: 'data-ax-loader', key: 'ax:loader', def: 'on' },
};

export interface Preset {
  value: string;
  label: string;
  base: string;
}
export const PRESETS: Preset[] = [
  { value: 'verdigris', label: 'Verdigris', base: '#1E856C' },
  { value: 'cobalt', label: 'Cobalt', base: '#2A5FCC' },
  { value: 'indigo', label: 'Indigo', base: '#4F46C9' },
  { value: 'amethyst', label: 'Amethyst', base: '#8A46B5' },
  { value: 'magenta', label: 'Magenta', base: '#C13C84' },
  { value: 'terracotta', label: 'Terracotta', base: '#C25339' },
  { value: 'amber', label: 'Amber', base: '#C1820E' },
  { value: 'olive', label: 'Olive', base: '#647F1C' },
  { value: 'forest', label: 'Forest', base: '#2C7A4B' },
  { value: 'teal', label: 'Teal', base: '#10808F' },
  { value: 'slate', label: 'Slate', base: '#4A5A6B' },
  { value: 'graphite', label: 'Graphite', base: '#52514C' },
];

const ALL_KEYS = [
  'ax:theme', 'ax:accent', 'ax:accent-custom', 'ax:bg-custom', 'ax:bg-custom-dark',
  'ax:lang', 'ax:dir', 'ax:nav', 'ax:shell-style', 'ax:sidebar-behavior', 'ax:menu', 'ax:page', 'ax:width',
  'ax:header-position', 'ax:sidebar-position', 'ax:sidebar-scheme', 'ax:header-scheme',
  'ax:sidebar-image', 'ax:loader', 'ax:collapsed', 'ax:config',
];
const ALL_ATTRS = [
  'data-ax-theme', 'data-ax-accent', 'data-ax-nav', 'data-ax-shell-style', 'data-ax-sidebar-behavior',
  'data-ax-menu', 'data-ax-page', 'data-ax-width', 'data-ax-header-position', 'data-ax-sidebar-position',
  'data-ax-sidebar', 'data-ax-header', 'data-ax-sidebar-image', 'data-ax-loader', 'data-ax-collapsed',
];
export const RECENT_SWATCH_KEY = 'ax:accent-recent';

export function emitChange(reason: string): void {
  document.dispatchEvent(new CustomEvent('ax:change', { detail: { reason } }));
}

/* ── system theme ── */
function systemDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}
export function resolveTheme(theme?: string): 'light' | 'dark' {
  const t = theme || store.get(PREFIX + 'theme') || 'system';
  return t === 'system' ? (systemDark() ? 'dark' : 'light') : (t as 'light' | 'dark');
}

/* ── generic writers ── */
/** Write attr + key; selecting the default removes BOTH. */
export function apply(attr: string, key: string, val: string, def: string): void {
  if (val === def) {
    D.removeAttribute(attr);
    store.remove(key);
  } else {
    D.setAttribute(attr, val);
    store.set(key, val);
  }
}
export function setByName(name: string, val: string): string {
  const r = REGISTRY[name];
  if (!r) return val;
  apply(r.attr, r.key, val, r.def);
  emitChange(name);
  return val;
}

/* ── theme / accent / direction ── */
export function setMode(m: string): string {
  if (m === 'system') {
    store.set('ax:theme', 'system');
    D.setAttribute('data-ax-theme', resolveTheme('system'));
    listenSystem();
  } else {
    store.set('ax:theme', m);
    D.setAttribute('data-ax-theme', m);
  }
  applyCanvas(D.getAttribute('data-ax-theme') || 'light');
  emitChange('theme');
  document.dispatchEvent(new CustomEvent('ax-theme-change', { detail: { theme: m } }));
  return m;
}
/** Header quick-toggle: flip light↔dark only (never system). */
export function quickToggleTheme(): string {
  const cur = D.getAttribute('data-ax-theme') === 'dark' ? 'dark' : 'light';
  return setMode(cur === 'dark' ? 'light' : 'dark');
}

export function setDir(d: string): string {
  if (d === 'rtl') {
    D.setAttribute('dir', 'rtl');
    store.set('ax:dir', 'rtl');
  } else {
    D.setAttribute('dir', 'ltr');
    store.remove('ax:dir');
  }
  emitChange('dir');
  return d;
}

export function setLang(code: string): string {
  const lang = (code || 'EN').toUpperCase();
  store.set('ax:lang', lang);
  D.setAttribute('lang', lang.toLowerCase());
  // AR implies rtl unless the user explicitly set a direction.
  if (!store.get('ax:dir')) D.setAttribute('dir', lang === 'AR' ? 'rtl' : 'ltr');
  emitChange('lang');
  return lang;
}

function clearCustomAccentProps(): void {
  ['--ax-accent', '--ax-on-accent', '--ax-accent-rgb', '--ax-accent-hover', '--ax-chart-1'].forEach((p) =>
    D.style.removeProperty(p),
  );
  for (let s = 50; s <= 900; s += 50) D.style.removeProperty(`--ax-accent-${s}`);
  D.style.removeProperty('--ax-accent-150');
}

export function setAccent(name: string): string {
  clearCustomAccentProps();
  store.remove('ax:accent-custom');
  if (name === 'verdigris') {
    D.removeAttribute('data-ax-accent');
    store.remove('ax:accent');
  } else {
    D.setAttribute('data-ax-accent', name);
    store.set('ax:accent', name);
  }
  emitChange('accent');
  return name;
}

export function setCustomAccent(hex: string): string | null {
  if (!parseHex(hex)) return null;
  const ramp = deriveRamp(hex);
  Object.entries(ramp).forEach(([prop, val]) => D.style.setProperty(prop, val));
  D.style.setProperty('--ax-on-accent', onColor(hex));
  D.setAttribute('data-ax-accent', 'custom');
  store.set('ax:accent', 'custom');
  store.set('ax:accent-custom', hex);
  pushRecentSwatch(hex);
  emitChange('accent');
  return hex;
}

export function setCustomBg(hex: string): boolean {
  if (!parseHex(hex)) return false;
  const dark = D.getAttribute('data-ax-theme') === 'dark';
  store.set(dark ? 'ax:bg-custom-dark' : 'ax:bg-custom', hex);
  D.style.setProperty('--ax-canvas', hex);
  emitChange('canvas');
  return isLowContrast(hex);
}

export function isLowContrast(hex: string): boolean {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const L = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return L > 0.35 && L < 0.72;
}

export function recentSwatches(): string[] {
  try {
    return JSON.parse(store.get(RECENT_SWATCH_KEY) || '[]');
  } catch {
    return [];
  }
}
function pushRecentSwatch(hex: string): void {
  const list = [hex, ...recentSwatches().filter((h) => h !== hex)].slice(0, 6);
  store.set(RECENT_SWATCH_KEY, JSON.stringify(list));
}

/* ── collapsed rail (header toggle) ── */
export function isCollapsed(): boolean {
  return D.hasAttribute('data-ax-collapsed');
}
export function toggleCollapsed(): boolean {
  const behavior = store.get('ax:sidebar-behavior') || 'collapsible';
  if (behavior !== 'collapsible') return isCollapsed();
  const next = !isCollapsed();
  if (next) {
    D.setAttribute('data-ax-collapsed', '');
    store.set('ax:collapsed', '1');
  } else {
    D.removeAttribute('data-ax-collapsed');
    store.remove('ax:collapsed');
  }
  emitChange('collapsed');
  return next;
}

/* ── per-mode custom canvas ── */
export function applyCanvas(resolved: string): void {
  const r = resolved || resolveTheme();
  const bg = store.get(r === 'dark' ? 'ax:bg-custom-dark' : 'ax:bg-custom');
  if (bg) D.style.setProperty('--ax-canvas', bg);
  else D.style.removeProperty('--ax-canvas');
}

/* ── reset / copy / snapshot ── */
export function currentConfig(): Record<string, string> {
  const cfg: Record<string, string> = {};
  ALL_KEYS.forEach((k) => {
    const v = store.get(k);
    if (v != null && k !== 'ax:config') cfg[k.replace(PREFIX, '')] = v;
  });
  return cfg;
}

export function reset(): void {
  ALL_KEYS.forEach((k) => store.remove(k));
  store.remove(RECENT_SWATCH_KEY);
  ALL_ATTRS.forEach((a) => D.removeAttribute(a));
  D.removeAttribute('dir');
  D.setAttribute('dir', 'ltr');
  D.removeAttribute('style');
  D.setAttribute('data-ax-theme', resolveTheme('system'));
  D.setAttribute('lang', 'en');
  store.ensureSchema();
  emitChange('reset');
}

export function copyConfig(): string {
  const json = JSON.stringify(currentConfig(), null, 2);
  store.set('ax:config', json);
  const ok = () => document.dispatchEvent(new CustomEvent('ax-toast', { detail: { msg: 'Config copied' } }));
  if (navigator.clipboard) navigator.clipboard.writeText(json).then(ok, ok);
  else ok();
  return json;
}

/** Read the current resolved value of a control (registry/theme/dir aware). */
export function currentValueOf(name: string): string {
  if (name === 'theme' || name === 'mode') return store.get('ax:theme') || 'system';
  if (name === 'dir') return D.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';
  if (name === 'lang') return store.get('ax:lang') || 'EN';
  if (name === 'accent') return D.getAttribute('data-ax-accent') || 'verdigris';
  const r = REGISTRY[name];
  return r ? D.getAttribute(r.attr) || r.def : '';
}

/* ── live system listener (only mutates while pref === 'system') ── */
let _mql: MediaQueryList | null = null;
export function listenSystem(): void {
  if (_mql) return;
  try {
    _mql = window.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return;
  }
  const onChange = (e: MediaQueryListEvent) => {
    const pref = store.get(PREFIX + 'theme') || 'system';
    if (pref !== 'system') return;
    const resolved = e.matches ? 'dark' : 'light';
    D.setAttribute('data-ax-theme', resolved);
    applyCanvas(resolved);
    emitChange('system-theme');
    document.dispatchEvent(new CustomEvent('ax-theme-change'));
  };
  if (_mql.addEventListener) _mql.addEventListener('change', onChange);
}
