// Service Worker — safe for production deploys.
//
// GOLDEN RULE: never cache navigations (HTML) or Next.js JS chunks.
// Doing so breaks every deploy: the cached HTML references chunk
// filenames with old hashes that no longer exist on the server
// → 404 → ChunkLoadError → "page loads forever" (especially on mobile,
// where the tab stays open for days holding stale HTML).
//
// What we DO cache: a tiny list of immutable app-shell assets only
// (icons, manifest, logo). Everything else goes straight to the network.

// Bump this version on every SW change. The activate handler deletes
// every cache that doesn't match, so users get the new SW immediately.
const CACHE = "mazaya-v3";
const PRECACHE_URLS = [
  "/manifest.json",
  "/logo.png",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // Pre-cache a few immutable assets. Don't fail install if any are missing.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: "no-cache" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
  // Take over from the old SW as soon as possible.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete EVERY old cache so stale chunks/HTML can't survive a deploy.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      );
      // Take control of all open clients immediately.
      await self.clients.claim();
      // Tell every open tab to reload once, so it picks up the fresh HTML
      // and current chunks instead of any in-memory navigation state.
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Allow the page to ask a waiting SW to activate immediately.
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GET requests.
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // CRITICAL: never intercept navigations or Next.js chunks.
  // - Navigations (HTML documents) must always hit the network so the
  //   browser gets the latest HTML referencing the latest chunk hashes.
  // - _next/static/* files are already content-hashed and served with
  //   long-lived immutable Cache-Control headers by Next.js; the HTTP
  //   cache handles them far better than we can, and they MUST NOT be
  //   served across deploys from our cache.
  if (req.mode === "navigate") return;
  if (path.startsWith("/_next/")) return;

  // Never touch API/auth/mutations.
  if (path.startsWith("/api/")) return;
  if (path === "/sw.js") return;

  // For the handful of pre-cached app-shell assets: cache-first.
  // For any other static asset (e.g. /icons/*): network, fall back to cache.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && (res.type === "basic" || res.type === "default")) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      } catch {
        // Both cache miss and network failure — return a valid Response
        // (never undefined, which would throw inside respondWith).
        return new Response("", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});
