/*
 * Chioni — App Router not-found boundary → the standalone 404 screen.
 * Renders inside the root layout only (the bare group's loader/ambient are
 * not present here — the 404 screen is self-sufficient).
 */
export { Error404 as default } from '@/screens/error/Error404';
