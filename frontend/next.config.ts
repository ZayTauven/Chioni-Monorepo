import type { NextConfig } from 'next';

/*
 * Chioni — Next.js 15 (App Router + React 19 + Tailwind v4).
 *
 * The shared --ax-* token core (src/styles/app.css) is imported once in
 * app/layout.tsx. Tailwind v4 compiles via the PostCSS plugin
 * (postcss.config.mjs). No remote image hosts: pages stay light and
 * self-contained (low-connectivity Comoros is the baseline).
 */
const nextConfig: NextConfig = {};

export default nextConfig;
