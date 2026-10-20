// public/sw.js — Web Push service worker (place this file at public/sw.js, NOT inside src/app)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: "CineLabz", body: event.data?.text() || "" };
  }
  const title = data.title || "CineLabz";
  const options = {
    body: data.body || "",
    icon: data.icon || "/apple-icon",
    badge: "/apple-icon",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});