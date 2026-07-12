/* THE SYSTEM - offline cache v4 (app files only; API calls pass through untouched) */
const CACHE = "system-v4";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-180.png", "./icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  /* never touch non-GET requests or anything outside our own site (e.g. the guild database) */
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  const isPage = e.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
  if (isPage) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match(e.request).then(h => h || caches.match("./index.html")))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(hit => hit ||
        fetch(e.request).then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return r;
        })
      )
    );
  }
});
