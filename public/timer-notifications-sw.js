// Notifications only: this worker does not intercept requests or cache the app.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(
    event.notification.data?.url || './',
    self.registration.scope
  )
  if (
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const existing = windows.find((client) => client.url === url.href)
      if (existing) return existing.focus()
      return self.clients.openWindow(url.href)
    })()
  )
})
