const CACHE_NAME = 'surveyor-pasar-cache-v1';
const urlsToCache = [
  '/',
  '/login',
  '/manifest.json',
  '/app/globals.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Hanya cache permintaan GET dan bukan ke API/Supabase
  const isApiRequest = event.request.url.includes('/api/') || event.request.url.includes('supabase.co');
  
  if (event.request.method !== 'GET' || isApiRequest) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
