// Service Worker per PWA Halloween Guidizzolo
const CACHE_NAME = 'halloween-guidizzolo-v9';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first per API e file dell'app; la cache serve solo offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Le chiamate API devono sempre andare alla rete
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: "Sei offline! Riconnettiti alla rete per aggiornare la mappa." }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Risorse statiche: prima la rete (cosi' gli aggiornamenti arrivano subito), cache solo se offline
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse.status === 200) {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return networkResponse;
    }).catch(() => caches.match(event.request))
  );
});
