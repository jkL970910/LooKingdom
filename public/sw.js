self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || "Loo国有新消息 ♡", {
      body: data.body || "来小窝看看对方的小心意吧",
      icon: "/icons/loo-192.png",
      badge: "/icons/loo-192.png",
      tag: data.tag || "loo-message",
      data: { url: "/" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(self.location.origin + "/");
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })(),
  );
});
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
