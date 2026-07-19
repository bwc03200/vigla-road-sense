// VIGLA service worker — push notifications + map tile cache (offline map).
// Intentionally scoped narrowly to avoid breaking Lovable preview/SSR.

const TILE_CACHE = "vigla-tiles-v1";
const TILE_HOSTS = [
  "tile.openstreetmap.org",
  "a.tile.openstreetmap.org",
  "b.tile.openstreetmap.org",
  "c.tile.openstreetmap.org",
  "basemaps.cartocdn.com",
  "a.basemaps.cartocdn.com",
  "b.basemaps.cartocdn.com",
  "c.basemaps.cartocdn.com",
  "d.basemaps.cartocdn.com",
];
const MAX_TILE_ENTRIES = 800;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop older tile caches from previous versions.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("vigla-tiles-") && n !== TILE_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  } catch (_e) {
    // Cache full / unavailable — best effort; ignore.
  }
}

/**
 * Cache-first strategy for map tiles. Falls back to whatever the cache
 * has when offline; network errors are swallowed so the app map keeps
 * rendering previously-visited zones without console noise.
 */
async function handleTileRequest(request) {
  try {
    const cache = await caches.open(TILE_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      // Refresh in the background so tiles stay current when online.
      fetch(request)
        .then((resp) => {
          if (resp && resp.ok) {
            cache.put(request, resp.clone()).then(() => trimCache(TILE_CACHE, MAX_TILE_ENTRIES));
          }
        })
        .catch(() => {});
      return cached;
    }
    const network = await fetch(request);
    if (network && network.ok) {
      cache.put(request, network.clone()).then(() => trimCache(TILE_CACHE, MAX_TILE_ENTRIES));
    }
    return network;
  } catch (_e) {
    const cache = await caches.open(TILE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch (_e) {
    return;
  }
  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(handleTileRequest(req));
  }
  // All other requests fall through to the network (Vite HMR, Supabase, OSRM,
  // Nominatim, etc.) — no interception, no cache, no risk of stale JS.
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { title: "VIGLA", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "VIGLA";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "vigla-alert",
    renotify: true,
    data: {
      url: payload.url || "/",
      convoyId: payload.convoyId || null,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/?tab=convoy";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.postMessage({ type: "vigla-notification-click", data: event.notification.data });
          try {
            const url = new URL(client.url);
            if (url.origin === self.location.origin) {
              client.focus();
              if ("navigate" in client) {
                client.navigate(targetUrl).catch(() => {});
              }
              return;
            }
          } catch (_e) {}
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
