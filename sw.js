const CACHE = 'conta-certa-v0.9.4';
const ASSETS = [
  './','./index.html','./instalar.html','./styles.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./assets/logo-conta-certa.png',
  './src/app.js','./src/install.js','./src/db.js','./src/finance.js','./src/projections.js','./src/compliance.js','./src/migration.js','./src/obligations.js','./src/certificates.js','./src/certificate-pdf.js','./src/brand-data.js','./src/qr.js','./src/security.js','./src/private-profile.js','./src/backup.js','./src/closing.js','./src/statement-pdf.js','./src/sanitize.js'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  const relative = './' + url.pathname.replace(self.registration.scope.replace(url.origin, '').replace(/^\//, ''), '').replace(/^\//, '');
  if (!ASSETS.includes(relative) && !ASSETS.includes('./' + url.pathname.split('/').pop())) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); }
    return response;
  })));
});

