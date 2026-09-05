/* Built with a unique cache version after next build. Never cache private HTML/API responses. */
const VERSION = "miniros-__BUILD_ID__";
const SHELL = "/offline";
const OFFLINE_PATH =
  /^\/(offline|sync|install|help|pos|inventory|shifts|schedule)(\/|$)/;
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/pwa-assets.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Offline asset list unavailable");
      const { assets } = await response.json();
      const cache = await caches.open(VERSION);
      await cache.addAll([
        SHELL,
        "/manifest.webmanifest",
        "/icons/icon-192.png",
        ...assets,
      ]);
      await cache.put(
        "/pwa-assets.json",
        new Response(JSON.stringify({ assets })),
      );
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Retain old static assets while older tabs may still be running. Explicit updates
      // are offered only when no shift or checkout is pending.
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data === "ACTIVATE_UPDATE") self.skipWaiting();
  if (event.data === "CHECK_OFFLINE_READY")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(VERSION);
        const manifest = await cache.match("/pwa-assets.json");
        const assets = manifest ? (await manifest.json()).assets : [];
        const stored = await Promise.all(
          [SHELL, ...assets].map((path) => cache.match(path)),
        );
        event.ports[0]?.postMessage({
          ready: Boolean(manifest) && stored.every(Boolean),
          version: VERSION,
        });
      })(),
    );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () =>
        (await caches.match(event.request)) ?? fetch(event.request))(),
    );
    return;
  }
  if (
    event.request.mode === "navigate" &&
    (url.pathname === "/" || OFFLINE_PATH.test(url.pathname))
  ) {
    event.respondWith(
      (async () => {
        try {
          // A slow page or a server error is not an offline navigation.
          // Only fall back to saved shifts when the network request fails.
          return await fetch(event.request);
        } catch {
          return (
            (await (await caches.open(VERSION)).match(SHELL)) ??
            new Response(
              "This device was not prepared for offline use. Reconnect to open MINIROS.",
              { status: 503, headers: { "Content-Type": "text/plain" } },
            )
          );
        }
      })(),
    );
  }
});
