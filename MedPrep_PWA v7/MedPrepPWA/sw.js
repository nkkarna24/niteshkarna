// ===================================================================
// MedPrep USMLE — Service Worker
// Strategy: Cache-first (full offline), with background update check
// ===================================================================

const CACHE_NAME  = 'medprep-v5';
const CORE_FILES  = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-180.png'
];

// ── Install: cache all core files ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())   // activate immediately
  );
});

// ── Activate: delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())  // take control of all pages immediately
  );
});

// ── Fetch: cache-first, fall back to network ─────────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests for our own origin / file://
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache immediately, then update cache in background
        const networkFetch = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            }
            return response;
          })
          .catch(() => {/* offline — ignore */});
        // Don't await network — return cache instantly
        return cached;
      }
      // Not in cache — try network
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          // Offline and not cached — return the main page as fallback
          return caches.match('./index.html');
        });
    })
  );
});

// ── Message handler: force update ────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
