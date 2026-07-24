// ============================================================
// SERVICE WORKER - RAB Bangunan Pribadi (PWA)
// ============================================================
// Naikkan versi ini (v1 -> v2 -> dst) setiap kali men-deploy perubahan
// pada index.html/manifest/ikon, agar pengguna lama otomatis dapat versi baru.
const CACHE_VERSION = 'rab-pwa-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// Domain yang TIDAK BOLEH di-cache (harus selalu network, karena berisi data live)
const NEVER_CACHE = [
  'script.google.com',
  'script.googleusercontent.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Jangan pernah cache request ke Apps Script (data RAB/keuangan harus selalu fresh)
  if (NEVER_CACHE.some((domain) => url.hostname.includes(domain))) {
    event.respondWith(fetch(req));
    return;
  }

  // 2. Hanya proses request GET; selain itu langsung ke network
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // 3. Strategi: Cache First untuk app shell, Network First (fallback ke cache) untuk sisanya
  //    (CDN Bootstrap/FontAwesome/Chart.js/dll ikut ter-cache otomatis saat pertama diakses)
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          // Offline & tidak ada di cache -> untuk navigasi halaman, tampilkan index.html dari cache
          if (req.mode === 'navigate') return caches.match('./index.html');
          return cached;
        });

      // Cache-first untuk aset app shell (biar instan), selain itu race network vs cache
      return cached || fetchPromise;
    })
  );
});
