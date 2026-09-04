const CACHE_NAME = 'pdftools-v2'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
]

self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event

  // Bỏ qua các API request hoặc các method khác GET
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return
  }

  const isNavigation = request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))

  // 1. Đối với điều hướng trang web (HTML): Luôn ưu tiên Mạng trước (Network First)
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Nếu server từ chối (403 Forbidden hoặc bị chặn IP):
          // Ngay lập tức hủy toàn bộ cache và trả về nguyên trạng trang 403 của server!
          if (networkResponse && networkResponse.status === 403) {
            caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
            return networkResponse
          }
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
          }
          return networkResponse
        })
        .catch(() => {
          // Chỉ fallback về cache khi hoàn toàn mất kết nối mạng (offline)
          return caches.match(request)
        })
    )
    return
  }

  // 2. Đối với asset tĩnh khác: Cache first nhưng xóa cache nếu server báo 403
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 403) {
              caches.open(CACHE_NAME).then(cache => cache.delete(request))
            } else if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, networkResponse))
            }
          })
          .catch(() => {})
        return cachedResponse
      }

      return fetch(request).then(response => {
        if (!response) return response
        if (response.status === 403) {
          caches.open(CACHE_NAME).then(cache => cache.delete(request))
          return response
        }
        if (response.status === 200 && (
          request.url.includes('/assets/') ||
          request.url.endsWith('.svg') ||
          request.url.endsWith('.png') ||
          request.url.endsWith('.wasm')
        )) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache))
        }
        return response
      })
    })
  )
})
