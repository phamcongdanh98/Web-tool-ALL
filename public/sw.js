const CACHE_NAME = 'pdftools-v1'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  // Bỏ qua các API request hoặc các method khác GET
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Trả về ngay từ cache và fetch nền để làm mới
        fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse))
            }
          })
          .catch(() => {})
        return cachedResponse
      }

      return fetch(request).then(response => {
        if (!response || response.status !== 200) {
          return response
        }
        // Cache tự động các asset tĩnh đã tải
        if (
          request.url.includes('/assets/') ||
          request.url.endsWith('.svg') ||
          request.url.endsWith('.png') ||
          request.url.endsWith('.wasm')
        ) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache))
        }
        return response
      })
    })
  )
})
