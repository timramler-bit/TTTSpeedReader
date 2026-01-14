const CACHE_NAME = 'speed-reader-v5';
const ASSETS = [
  './',
  'index.html',
  'index.tsx',
  'manifest.json',
  'https://img.icons8.com/fluency/512/speedometer.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/tesseract.js@v5.1.0/dist/tesseract.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&family=Inter:wght@400;700;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME && caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Prefer cache, fallback to network
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        // Return index.html for navigation requests if offline
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});