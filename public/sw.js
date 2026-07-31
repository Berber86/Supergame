const CACHE_NAME = 'odyssey-shadow-v0.6.0'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/art/app-icon-192.png',
  '/art/app-icon-512.png',
  '/art/odyssey-storm.jpg',
  '/art/greek-port.jpg',
  '/art/boss-scylla.jpg',
  '/art/boss-poseidon.jpg'
]

async function precacheApplication() {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(APP_SHELL)
  const response = await fetch('/')
  const html = await response.clone().text()
  await cache.put('/', response)
  const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1])
  if (assetUrls.length) await cache.addAll(assetUrls)
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApplication().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
    })
  )
})
