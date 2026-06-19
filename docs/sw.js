// Trump Trading PWA service worker.
// Bump CACHE on every deploy so old cached files (e.g. the previous mockup)
// are purged and the latest version always shows.
const CACHE = 'tt-pwa-2026-06-19-14-srcpriority';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Let cross-origin requests (news RSS / CORS proxies / future backend API) pass
  // straight through — never cache live data.
  if (url.origin !== location.origin) return;

  const isShell = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isShell) {
    // Network-first for the app shell so updates appear immediately.
    e.respondWith((async () => {
      try {
        const net = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
        return net;
      } catch {
        return (await caches.match(req)) || (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  // Cache-first for same-origin static assets (manifest, icons).
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const net = await fetch(req);
    const c = await caches.open(CACHE);
    c.put(req, net.clone());
    return net;
  })());
});
