const CACHE_NAME = 'ab-academy-pwa-v3'
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let data = { title: 'AB Academy', body: 'Você tem uma nova notificação administrativa.' }

    try {
      if (event.data) {
        data = { ...data, ...event.data.json() }
      }
    } catch {
      if (event.data) {
        data.body = event.data.text()
      }
    }

    const notification = await self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.svg',
      badge: data.badge || '/icons/icon-192.svg',
      tag: data.tag || 'admin-notificacao',
      data: { url: data.url || '/admin' },
      requireInteraction: false,
    })

    return notification
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data?.url || '/admin'
      const existing = clientList.find((client) => 'focus' in client)

      if (existing) {
        existing.navigate(targetUrl)
        return existing.focus()
      }

      return clients.openWindow(targetUrl)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // Nunca armazenar dados privados, sessões ou respostas da API.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/')
  ) {
    return
  }

  // Navegação: rede primeiro; fallback apenas para a entrada do portal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/aluno'),
      ),
    )
    return
  }

  // Somente recursos estáticos do próprio site entram no cache.
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.png'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              void cache.put(request, copy)
            })
          }

          return response
        })
        .catch(() => caches.match(request)),
    )
  }
})
