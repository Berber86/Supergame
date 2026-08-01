const CACHE_NAME = 'odyssey-shadow-v1.5.0'
const SCOPE_URL = self.registration.scope
const scopedUrl = (path = './') => new URL(path, SCOPE_URL).toString()
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'art/app-icon-192.png',
  'art/app-icon-512.png',
  'art/odyssey-storm.jpg',
  'art/greek-port.jpg',
  'art/boss-scylla.jpg',
  'art/boss-poseidon.jpg',
  'art/companion-eurylochus.jpg',
  'art/companion-tiphys.jpg',
  'art/companion-sinon.jpg',
  'art/companion-idmon.jpg',
  'art/ui-hermes-guide.jpg',
  'art/ui-offline-ithaca.jpg',
  'art/memory-oath.jpg',
  'art/memory-wrath.jpg',
  'art/memory-alliance.jpg',
  'art/preparation-training.jpg',
  'art/preparation-council.jpg',
  'art/preparation-offering.jpg',
  'art/preparation-scouting.jpg',
  'art/island-dulichium.jpg',
  'art/island-astarte.jpg',
  'art/island-dardania.jpg',
  'art/island-thesprotia.jpg',
  'art/island-oar-council.jpg',
  'art/island-erebria.jpg',
  'art/island-orthos.jpg',
  'art/island-cyclops.jpg',
  'art/island-hecate.jpg',
  'art/island-lotus.jpg',
  'art/island-talos.jpg',
  'art/island-nereia.jpg',
  'art/island-symplegades.jpg',
  'art/island-lemnos.jpg',
  'art/island-mnemosyne.jpg',
  'art/island-labyrinth.jpg',
  'art/island-messana.jpg',
  'art/island-delos.jpg',
  'art/island-aretia.jpg',
  'art/island-navloch.jpg',
  'art/island-telepylos.jpg',
  'art/island-aeolia.jpg',
  'art/island-salmidess.jpg',
  'art/island-cimmeria.jpg',
  'art/island-aeaea.jpg',
  'art/island-thrinacia.jpg'
].map(scopedUrl)

async function precacheApplication() {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(APP_SHELL)
  const response = await fetch(scopedUrl())
  const html = await response.clone().text()
  await cache.put(scopedUrl(), response)
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
    .map((match) => new URL(match[1], self.location.origin).toString())
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
  if (requestUrl.origin !== self.location.origin || !requestUrl.href.startsWith(SCOPE_URL)) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(scopedUrl(), copy))
          return response
        })
        .catch(() => caches.match(scopedUrl()))
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
