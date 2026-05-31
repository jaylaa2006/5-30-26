// Per Ankh Reader — Service Worker for Offline Support
// Caching strategy:
//   - App shell (HTML, icon): network-first, offline fallback
//   - Art assets (/art/*): cache-first (immutable, regenerated with new filenames)
//   - Videos (/videos/*): cache-first for viewed videos, capped at 20 entries
//   - Fonts (Google Fonts): cache-first
//   - API calls (/api/*): network-only (auth, speech tokens, AI)
//   - Google/Azure SDKs: network-only

// Separate version strings per cache type — updating one doesn't invalidate others
const APP_VERSION = 'v39';
const ART_VERSION = 'v1';
const VIDEO_VERSION = 'v1';
const FONT_VERSION = 'v1';

const APP_CACHE = `app-perankh-${APP_VERSION}`;
const ART_CACHE = `art-perankh-${ART_VERSION}`;
const VIDEO_CACHE = `video-perankh-${VIDEO_VERSION}`;
const FONT_CACHE = `font-perankh-${FONT_VERSION}`;

const MAX_VIDEO_ENTRIES = 20;
const MAX_ART_ENTRIES = 2000;

// Pre-cache on install — just the app shell
const APP_SHELL = [
  '/',
  '/maat-reader.html',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clean up old caches that don't match current version strings
  const currentCaches = new Set([APP_CACHE, ART_CACHE, VIDEO_CACHE, FONT_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !currentCaches.has(key))
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Network-only: API calls, Google OAuth, Azure Speech
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname === 'accounts.google.com' ||
    url.hostname === 'oauth2.googleapis.com' ||
    url.hostname.includes('cognitiveservices.azure.com') ||
    url.hostname.includes('tts.speech.microsoft.com') ||
    url.hostname === 'aka.ms'
  ) {
    return;
  }

  // Art assets: cache-first (immutable content)
  if (url.pathname.startsWith('/art/')) {
    event.respondWith(cacheFirst(event.request, ART_CACHE, MAX_ART_ENTRIES));
    return;
  }

  // Video assets: cache-first with cap
  if (url.pathname.startsWith('/videos/')) {
    event.respondWith(cacheFirst(event.request, VIDEO_CACHE, MAX_VIDEO_ENTRIES));
    return;
  }

  // Google Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, FONT_CACHE));
    return;
  }

  // App shell (HTML, icon): network-first with offline fallback
  if (
    url.pathname === '/' ||
    url.pathname === '/reader' ||
    url.pathname === '/maat-reader.html' ||
    url.pathname === '/icon.svg'
  ) {
    event.respondWith(networkFirst(event.request, APP_CACHE));
    return;
  }
});

// Cache-first: check cache, fallback to network, store result
async function cacheFirst(request, cacheName, maxEntries) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      // Non-blocking trim — don't await, let it run in background
      if (maxEntries) trimCache(cacheName, maxEntries);
    }
    return response;
  } catch {
    // Offline and not cached — return 503
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first: try network, fallback to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── Push Notifications ────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Per Ankh Reader';
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Fallback for malformed push data
    event.waitUntil(self.registration.showNotification('Per Ankh Reader', { body: 'New notification', icon: '/icons/icon-192.png' }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const safeUrl = url.startsWith('/') || url.startsWith('https://withouthistory.osiriscare.net') ? url : '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if found
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(safeUrl);
    })
  );
});

// Evict oldest entries when cache exceeds maxEntries (runs asynchronously, never blocks responses)
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
      // Delete oldest entries (first in list = oldest)
      const toDelete = keys.slice(0, keys.length - maxEntries);
      for (const key of toDelete) {
        await cache.delete(key);
      }
    }
  } catch {
    // Silently handle cache errors — trimming is best-effort
  }
}
