// VIGLA service worker — push notifications only (no app-shell caching).
// Kept intentionally minimal to avoid interfering with Lovable preview/SSR.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
