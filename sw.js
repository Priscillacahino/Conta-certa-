const CACHE = 'conta-certa-v0.7.0';
const ASSETS = [
  './','./index.html','./styles.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./assets/logo-conta-certa.png',
  './src/app.js','./src/db.js','./src/finance.js','./src/projections.js','./src/compliance.js','./src/migration.js','./src/obligations.js','./src/certificates.js','./src/certificate-pdf.js','./src/brand-data.js','./src/qr.js'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => { if (event.request.method !== 'GET') return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match('./index.html')))); });
