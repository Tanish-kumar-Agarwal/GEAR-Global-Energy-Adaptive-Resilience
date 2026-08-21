// LIVE hits the FastAPI backend and falls back to the hackathon snapshot per
// request when the backend is unreachable, so the demo never goes blank.
// HACKATHON_SNAPSHOT never touches the backend at all and is the DEFAULT, so
// a plain production build (e.g. the Vercel demo deployment with no env vars)
// is a self-contained snapshot build. Local dev opts into LIVE via
// NEXT_PUBLIC_DATA_MODE=LIVE in .env.local.
export const DATA_MODE: 'HACKATHON_SNAPSHOT' | 'LIVE' =
  process.env.NEXT_PUBLIC_DATA_MODE === 'LIVE' ? 'LIVE' : 'HACKATHON_SNAPSHOT';

// Demo-only auto-login: the backend seeds this account on startup (see
// apps/api/main.py seed_admin_user). Real deployments must go through /login.
export const DEMO_AUTO_LOGIN = true;
export const DEMO_CREDENTIALS = { username: 'admin', password: 'admin123' };

// Keyless CARTO dark-matter basemap. Swap this single constant to change providers
// (any MapLibre style.json URL works, e.g. OpenFreeMap's keyless styles).
export const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// MapLibre 6 resolves its tile-parsing worker relative to import.meta.url, which
// the Turbopack bundle rewrites to a non-http URL; the worker then silently never
// starts and no tiles load. Every map instance must call
// maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL) before construction. The files in
// public/maplibre/ are vendored from node_modules/maplibre-gl/dist and must be
// re-copied when maplibre-gl is upgraded.
export const MAPLIBRE_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';
