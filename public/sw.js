/* Apenas Web Push: não intercepta fetch nem armazena páginas ou dados da API. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  if (!payload.title || !payload.body) return;
  if (payload.data?.expiresAt && Date.parse(payload.data.expiresAt) <= Date.now()) return;
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: payload.data,
      icon: '/icon-192.png?v=2',
      badge: '/notification-badge.png?v=2',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === target.origin);
      if (existing) {
        await existing.navigate(target.href);
        await existing.focus();
      } else await self.clients.openWindow(target.href);
    })(),
  );
});
