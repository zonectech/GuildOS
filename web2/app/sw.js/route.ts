// The service worker, at /sw.js. Generated once per build, with the build's ID inside: a new deploy
// is a new worker, which is how open tabs learn there is a new version (see components/shell/pwa.tsx).
//
// What it keeps, and why that is safe:
// - the app's code, fonts and icons (/_next/static, /icons…): public, named by content;
// - pages you opened (their HTML), for opening them with no connection. The server renders pages
//   without your login (the cookies belong to the API), so their HTML never holds private data;
// - optimized images (covers, logos): public.
// It never touches the API: your passes, lists and the door's attendee list are saved by the app
// itself (lib/offline.ts, lib/door.ts), only while you are signed in, and cleared at log-out.
export const dynamic = 'force-static';

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

const worker = `
const VERSION = ${JSON.stringify(BUILD)};
const STATIC = 'otr-static-' + VERSION;
const PAGES = 'otr-pages';
const IMAGES = 'otr-images';
const PRECACHE = ['/offline', '/events', '/events/going', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-icon.png', '/grain.png'];
const MAX_PAGES = 60, MAX_IMAGES = 120;
const NETWORK_WAIT_MS = 4000;

self.addEventListener('install', (e) => {
  // Precaching is best effort: a page that fails to load doesn't stop the worker installing.
  e.waitUntil(caches.open(STATIC).then((c) => Promise.all(PRECACHE.map((u) => fetch(u, { credentials: 'omit' }).then((r) => {
    if (!r.ok) return;
    return u === '/offline' || u.startsWith('/events') ? caches.open(PAGES).then((p) => p.put(u, r)) : c.put(u, r);
  }).catch(() => undefined)))));
  // The first worker takes over at once; later ones wait until you choose "Refresh".
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Keep this version's code and the previous one's (a page saved before the update still opens
    // offline); older ones go.
    const names = (await caches.keys()).filter((n) => n.startsWith('otr-static-') && n !== STATIC);
    for (const n of names.slice(0, -1)) await caches.delete(n);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // Log-out: forget which pages were opened on this device.
  if (e.data?.type === 'CLEAR_PAGES') e.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(IMAGES)]));
});

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

async function cacheFirst(req, name, max) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) { const c = await caches.open(name); await c.put(req, res.clone()); if (max) void trim(name, max); }
  return res;
}

// Pages: always the network first (you get the newest version whenever there's a connection). If it
// doesn't answer in time, or there is no connection, the copy saved the last time you opened it.
async function page(req) {
  const url = new URL(req.url);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), NETWORK_WAIT_MS)),
    ]);
    const type = res.headers.get('content-type') || '';
    if (res.ok && !res.redirected && type.includes('text/html')) {
      const c = await caches.open(PAGES); await c.put(url.pathname, res.clone()); void trim(PAGES, MAX_PAGES);
    }
    return res;
  } catch {
    return (await caches.match(url.pathname, { cacheName: PAGES })) || (await caches.match('/offline', { cacheName: PAGES })) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // the API and anything else: untouched
  if (url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') { e.respondWith(page(req)); return; }
  if (url.pathname.startsWith('/_next/static/') || /^\\/(icons\\/|grain\\.png|apple-icon|icon\\.svg|favicon\\.ico|manifest\\.webmanifest)/.test(url.pathname)) {
    e.respondWith(cacheFirst(req, STATIC)); return;
  }
  if (url.pathname.startsWith('/_next/image')) { e.respondWith(cacheFirst(req, IMAGES, MAX_IMAGES)); return; }
  // Everything else (page data for in-app navigation, …) goes to the network as usual.
});
`;

export function GET() {
  return new Response(worker, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Always ask for the newest worker; the browser compares it with the one it has.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
