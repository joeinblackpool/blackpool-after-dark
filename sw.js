/**
 * BLACKPOOL AFTER DARK - SERVICE WORKER
 * Caches the game files so it opens instantly and installs as an app.
 * Maps and Street View still need a connection.
 */
const CACHE = "bad-v2";
const SHELL = [
  "./", "./index.html", "./styles.css", "./config.js", "./app.js", "./game.js",
  "./progress.js", "./race.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
];

self.addEventListener("install", e => {
  // Cache files one by one so a single failed download doesn't block the install
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Game files: network first so updates show up, cache when offline. Everything else passes through.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const isShell = url.origin === location.origin || url.hostname === "cdnjs.cloudflare.com";
  if (e.request.method !== "GET" || !isShell) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
