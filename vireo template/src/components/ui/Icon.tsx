/*
 * Vireo React — Tabler icon renderer.
 *
 * The shared CSS expects inline SVGs (24x24 viewBox, currentColor, stroke 1.75).
 * The nav-manifest references Tabler icon names; this registry maps the names
 * Vireo uses to their path data. Unknown names fall back to a neutral dot so
 * the shell never breaks. Framework-portable (no router imports).
 */
import type { SVGProps } from 'react';

// Each entry is the inner markup of a Tabler outline icon (paths only).
const PATHS: Record<string, string> = {
  'layout-dashboard': '<path d="M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1"/><path d="M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1"/><path d="M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1"/><path d="M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1"/>',
  apps: '<path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/><path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/><path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/><path d="M14 7l6 0"/><path d="M17 4l0 6"/>',
  'shopping-bag': '<path d="M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1 -2.966 2.544h-6.852a3 3 0 0 1 -2.965 -2.544l-1.255 -8.152a2 2 0 0 1 1.977 -2.304"/><path d="M9 11v-5a3 3 0 0 1 6 0v5"/>',
  'shopping-cart': '<path d="M4 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M15 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M17 17h-11v-14h-2"/><path d="M6 5l14 1l-1 7h-13"/>',
  'users-group': '<path d="M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1"/><path d="M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M17 10h2a2 2 0 0 1 2 2v1"/><path d="M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M3 13v-1a2 2 0 0 1 2 -2h2"/>',
  folders: '<path d="M9 4h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M17 17v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2h2"/>',
  'currency-bitcoin': '<path d="M6 6h8a3 3 0 0 1 0 6a3 3 0 0 1 0 6h-8"/><path d="M8 6l0 12"/><path d="M8 12l6 0"/><path d="M9 3l0 3"/><path d="M13 3l0 3"/><path d="M9 18l0 3"/><path d="M13 18l0 3"/>',
  diamond: '<path d="M6 5h12l3 5l-8.5 9.5a.7 .7 0 0 1 -1 0l-8.5 -9.5l3 -5"/><path d="M10 12l-2 -2.2l.6 -1"/>',
  'briefcase-2': '<path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9"/><path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2"/>',
  article: '<path d="M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/>',
  files: '<path d="M15 3v4a1 1 0 0 0 1 1h4"/><path d="M18 17h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h4l5 5v7a2 2 0 0 1 -2 2"/><path d="M16 17v2a2 2 0 0 1 -2 2h-7a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2h2"/>',
  lock: '<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>',
  'alert-triangle': '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0"/><path d="M12 16h.01"/>',
  components: '<path d="M3 12l3 3l3 -3l-3 -3l-3 3"/><path d="M15 12l3 3l3 -3l-3 -3l-3 3"/><path d="M9 6l3 3l3 -3l-3 -3l-3 3"/><path d="M9 18l3 3l3 -3l-3 -3l-3 3"/>',
};

// Fallback: a small dot, used as the child-row bar substitute is handled in CSS.
const FALLBACK = '<path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: string;
}

/** Render a Tabler icon by manifest name. */
export function Icon({ name, className, ...rest }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={24}
      height={24}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || FALLBACK }}
      {...rest}
    />
  );
}

export default Icon;
