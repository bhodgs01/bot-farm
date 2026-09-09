// Self-destructing service worker.
//
// The Bot Farm is always online — it sits behind Cloudflare Access and every screen is live
// data — so a caching worker bought almost nothing and repeatedly pinned clients to stale
// builds (old lamp posts, an archived worker that was long since restored). This worker now
// clears every cache and unregisters itself, and index.html no longer registers one. Any
// client that still has the old worker fetches this on its next navigation, wipes its caches,
// and after one more reload loads straight from the network — and can never go stale again.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      } catch {
        /* nothing to clear */
      }
      try {
        await self.registration.unregister()
      } catch {
        /* already gone */
      }
      // Reload any open windows so they pick up the fresh build immediately.
      try {
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const c of clients) c.navigate(c.url)
      } catch {
        /* they'll get it on the next manual reload */
      }
    })()
  )
})

// While briefly active, never answer from a cache — go straight to the network.
self.addEventListener('fetch', () => {})
