import type { NextConfig } from 'next';

/*
 * Vireo Next.js 15 edition — App Router + React 19 + Tailwind v4.
 *
 * The shared --ax-* token core (src/styles/app.css) is imported once in
 * app/layout.tsx. Tailwind v4 compiles via the PostCSS plugin (postcss.config.mjs).
 * Demo avatars/thumbnails use pravatar/picsum/loremflickr; allow them through
 * next/image just in case a page opts into <Image> (pages use plain <img> by
 * default, mirroring the reference, so this is permissive, not required).
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'loremflickr.com' },
    ],
  },
};

export default nextConfig;
