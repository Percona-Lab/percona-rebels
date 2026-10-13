/* PERCONA REBELS service worker (public build only): keeps the game playable offline once it has been opened.
   The page, its script and manifest come from the network whenever it answers, so an update shows at once; the
   cache is the fallback offline. Fonts and icons come from the cache and are refreshed in the background. Calls to
   the high-score table (another origin) are never cached. */
const CACHE = "rebels-v2";
const SHELL = ["./", "index.html", "rebels.js", "manifest.webmanifest", "assets/fonts/fonts.css",
  "assets/rebels/icon-16.png", "assets/rebels/icon-32.png", "assets/rebels/icon-180.png", "assets/rebels/icon-192.png", "assets/rebels/icon-512.png", "assets/rebels/icon-512-maskable.png"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;   // the world table goes straight to the network
  const path = new URL(req.url).pathname, code = req.mode === "navigate" || /(\/|\.html|\.js|\.webmanifest)$/.test(path);
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = () => cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req.mode === "navigate" ? new Request(new URL("./", self.location).href) : req, res.clone()).catch(() => {}); return res; });
    if (code) return fresh.catch(async () => (await hit()) || (await cache.match("./")) || Response.error());   // network first
    const cached = await hit();
    if (cached) { fresh.catch(() => {}); return cached; }                                                    // cache first, refreshed behind
    return fresh.catch(() => Response.error());
  }));
});
