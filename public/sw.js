/*
 * The worker behind "walk away": it shows the nudge when the pass is closed
 * or the phone is locked. It holds no state and reads nothing but the push
 * payload the API sent, which carries the words the pass would have used.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
    (async () => {
      // Nothing to add while the pass is on screen: the screen is already the
      // loudest thing in the room.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const onScreen = windows.some(
        (client) => client.visibilityState === "visible" && data.url && client.url.startsWith(data.url),
      );
      if (onScreen) return;

      await self.registration.showNotification(data.title || "Qless", {
        body: data.body || "",
        tag: data.tag || "qless",
        renotify: true,
        data: { url: data.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => client.url.startsWith(url));
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
