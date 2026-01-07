
/* public/service-worker.js */
const CACHE = "tf-invoices-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: 
// - navigation requests → cache-first (serve index.html offline)
// - static assets (.js,.css,.png,.jpg,.svg,.woff2) → cache-first, then update
// - others → network fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Handle navigation (SPA)
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((res) => res || fetch(req))
    );
    return;
  }

  const url = new URL(req.url);
  const isStatic =
    url.origin === location.origin &&
    /(\.js|\.css|\.png|\.jpg|\.jpeg|\.svg|\.webp|\.woff2?)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            // Update cache in background
            caches.open(CACHE).then((cache) => cache.put(req, networkRes.clone()));
            return networkRes;
          })
          .catch(() => cached || new Response("", { status: 503 }));
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: network, fallback to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
