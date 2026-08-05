/* GuildOS service worker — push notifications + PWA installability.
   Deliberately NO fetch caching: the app is highly dynamic and a stale cache
   during rapid development is worse than no cache. Revisit for offline support. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'GuildOS', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'GuildOS';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link: data.link || '/notifications' },
  };
  if (data.tag) options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/notifications';
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      // Reuse any open GuildOS tab and navigate it, else open a new one.
      const existing = clients.find((c) => 'navigate' in c && 'focus' in c);
      if (existing) return existing.navigate(url).then((c) => c && c.focus());
      return self.clients.openWindow(url);
    }),
  );
});
