const CACHE = "age-scout-v5-catalog";
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("age-scout-") && name !== CACHE)
          await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  const staticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/catalog/") ||
    url.pathname.startsWith("/labels/") ||
    url.pathname.startsWith("/vendor/") ||
    url.pathname.startsWith("/models/") ||

    [
      "/recognition-worker.js",
      "/matching.js",
      "/recognition-index.json",
      "/catalog.json",
      "/photo-credits.json",
      "/evaluation-report.json",
    ].includes(url.pathname);
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }
  const fresh = [
    "/recognition-worker.js",
    "/matching.js",
    "/recognition-index.json",
    "/catalog.json",
    "/photo-credits.json",
    "/evaluation-report.json",
  ].includes(url.pathname);
  if (fresh) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(
          async () => (await caches.match(event.request)) || Response.error(),
        ),
    );
    return;
  }
  if (staticAsset)
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then(async (response) => {
            if (response.ok) {
              const cache = await caches.open(CACHE);
              await cache.put(event.request, response.clone());
            }
            return response;
          }),
      ),
    );
});
