// Service worker mínimo pra notificação push funcionar (Web Push exige um service
// worker ativo controlando a página — sem ele, navigator.serviceWorker.ready nunca
// resolve, travando a tela de permissão pra sempre). Não faz cache de nada de
// propósito — não é isso que foi pedido, e evita qualquer risco de servir bundle
// JS desatualizado depois de um deploy.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Atlas Eye', body: event.data.text() }
  }

  const { title, body, url, tag } = payload
  event.waitUntil(
    self.registration.showNotification(title || 'Atlas Eye', {
      body,
      tag,
      data: { url: url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetPath = new URL(url, self.location.origin).pathname
      for (const client of clientList) {
        if (new URL(client.url).pathname === targetPath && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
