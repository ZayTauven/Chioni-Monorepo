/*
 * Vireo React — minimal ambient shim for Leaflet.
 *
 * The leaflet runtime is available (hoisted from the repo root), but no
 * @types/leaflet is installed in this edition. The maps/Leaflet page lazy-imports
 * leaflet inside an effect and types the instance loosely as `any`; this shim lets
 * `import('leaflet')` and `import 'leaflet/dist/leaflet.css'` type-check without a
 * central tsconfig/dependency change. Replace with @types/leaflet if it lands.
 */
declare module 'leaflet';
declare module 'leaflet/dist/leaflet.css';
