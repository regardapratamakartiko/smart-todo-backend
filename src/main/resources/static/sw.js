const CACHE_NAME = 'smart-todo-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/js/app.js',
  '/manifest.json',
  '/app-icon.png' // Pastikan ini ada di sini
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});
// ... sisa fungsi fetch ...

// Fetch data
self.addEventListener('fetch', (e) => {
  // Biarkan request API tetap langsung ke network (Spring Boot)
  if (e.request.url.includes('/api/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
