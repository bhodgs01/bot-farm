// Bot Farm service worker.
//
// Two rules, learned the hard way on the agents page: never cache anything under /api
// (the whole point of the map is that it is live), and treat the app shell as
// network-first so a deploy shows up on the next load rather than after a cache flush.
// Hashed build assets are immutable and can be cached forever. Bump CACHE to evict.
const CACHE = 'botfarm-v2'

self.addEventListener('install', (e) => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // live data: straight to the network, always

  // Vite's hashed bundles and the model files: cache first, they never change in place.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      })
    )
    return
  }

  // Everything else (the shell, manifest, icons): network first, cache as the fallback.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone()))
        return res
      })
      .catch(() => caches.match(req))
  )
})
