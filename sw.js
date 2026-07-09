/* Service worker for StockFlow PWA.
   - App shell (HTML/CSS/JS) is served NETWORK-FIRST so new deploys show up
     immediately, with the cached copy used only as an offline fallback.
   - NEVER caches API calls (/api/*) so stock data is always live.
   - Bump CACHE_VERSION whenever app files change to force an update. */
const CACHE_VERSION = 'stockflow-v4';
const SHELL = [
    '/', '/index.html', '/style.css', '/app.js', '/data.js', '/icon.svg', '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only handle same-origin GET requests
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    // API calls: always go to the network (never serve stale data)
    if (url.pathname.startsWith('/api/')) return;

    // App shell / static assets: network-first so new deploys are picked up
    // right away; fall back to the cached copy only when offline.
    event.respondWith(
        fetch(req).then(res => {
            if (res && res.status === 200) {
                const copy = res.clone();
                caches.open(CACHE_VERSION).then(c => c.put(req, copy));
            }
            return res;
        }).catch(() => caches.match(req))
    );
});
