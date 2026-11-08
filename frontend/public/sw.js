// Only public static assets can be cached. Pages, authentication and live data stay online-only.
const CACHE_NAME = 'cyclonet-public-static-v2';
const STATIC_ASSETS = new Set(['/cyclone-logo.svg', '/logo.svg', '/liquid-glass.js', '/manifest.json']);
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('cyclonet-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const cacheable = STATIC_ASSETS.has(url.pathname) && !url.search && !event.request.headers.has('authorization');
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (cacheable && response.ok && !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      if (cacheable) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
      }
      return new Response('Network unavailable. Current conditions cannot be verified offline.', {status:503, headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
    }
  })());
});
