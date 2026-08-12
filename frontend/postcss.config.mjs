/*
 * Vireo Next.js edition — Tailwind v4 via the official PostCSS plugin.
 * This is how Next 15 compiles the shared app.css token chain (Next owns
 * PostCSS; there is no @tailwindcss/vite here).
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
