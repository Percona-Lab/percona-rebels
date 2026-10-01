/* PERCONA REBELS service worker (public build only): keeps the game playable offline once it has been opened.
   Same-origin files are served from the cache and refreshed in the background, so an update shows up on the next
   launch. Calls to the world high-score table (another origin) are never cached. */
const CACHE = "rebels-v1";
const SHELL = ["./", "index.html", "rebels.js", "manifest.webmanifest", "assets/fonts/fonts.css",
  "assets/rebels/icon-16.png", "assets/rebels/icon-32.png", "assets/rebels/icon-180.png", "assets/rebels/icon-192.png", "assets/rebels/icon-512.png", "assets/rebels/icon-512-maskable.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;   // the world table goes straight to the network
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  }));
});
