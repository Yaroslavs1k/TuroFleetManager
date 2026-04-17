// Turo Fleet Manager — Service Worker
// Bump CACHE_VERSION on every release to force PWAs to pick up fresh index.html.
const CACHE_VERSION = 'v7.0.0';
const CACHE_NAME = 'fleet-mgr-' + CACHE_VERSION;
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Fetch strategy:
// - index.html + navigation requests: network-first with cache fallback (new deploys show up immediately)
// - NHTSA/MarketCheck APIs: cache-first (expensive calls, data is slow-changing per VIN)
// - Everything else: cache-first with network fallback (static assets)
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const isNav = e.request.mode === 'navigate' || url.includes('index.html');
  const isApi = url.includes('nhtsa.gov') || url.includes('marketcheck-proxy');

  if (isNav) {
    // Network-first for HTML — ensures users always get the latest deploy
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  if (isApi) {
    // Cache-first for API calls — VIN data is stable, save bandwidth and quota
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            // Only cache successful responses
            if (resp && resp.ok) cache.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }

  // Default: cache-first with network fallback
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp && resp.ok && e.request.method === 'GET') {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      }
      return resp;
    }))
  );
});
