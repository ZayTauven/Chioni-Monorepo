/*
 * Vireo Next.js — route "/" → the Sales dashboard (the one real Phase-A page).
 *
 * This file IS the home route. The Sales screen lives in src/screens so the
 * page-component layer mirrors the React edition 1:1 and stays portable; this
 * thin route file just re-exports it. Page-porting agents follow the same
 * pattern: keep the screen in src/screens/<group>/<Name>.tsx and point a route
 * file at it (see CONVENTIONS.md → "Add one page").
 *
 * NOTE: screens live in src/screens, NOT src/pages — Next would treat a
 * top-level/src `pages/` dir as the legacy Pages Router and turn each screen
 * into a route. App Router routing lives ONLY under app/.
 */
export { Sales as default } from '../../src/screens/dashboards/Sales';
