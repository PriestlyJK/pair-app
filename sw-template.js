/* Сервис-воркер «Мы». Собирается из этого шаблона при `npm run build` (см. vite.config.ts).
   - Оболочка приложения (html, js, css, шрифт) кладётся в кэш сразу при установке.
   - Картинки берутся из кэша, а если их там нет — из сети и тоже кэшируются.
   - После установки в фоне докачиваются все картинки, чтобы приложение работало без интернета. */
const SHELL_CACHE = 'shell-__VERSION__'
const ART_CACHE = 'art-__ART_VERSION__'
const SHELL = __SHELL__
const ART = __ART__

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== ART_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => { warm() }),
  )
})

// Докачка картинок пачками, без спешки. Если воркер усыпят, продолжит при следующем запуске.
async function warm() {
  const c = await caches.open(ART_CACHE)
  const have = new Set((await c.keys()).map(r => new URL(r.url).pathname))
  const base = new URL(self.registration.scope).pathname
  const todo = ART.filter(p => !have.has(base + p))
  for (let i = 0; i < todo.length; i += 8) {
    await Promise.all(todo.slice(i, i + 8).map(p => c.add(p).catch(() => {})))
  }
}

self.addEventListener('message', e => {
  if (e.data === 'warm') warm()
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return

  // Страница: сначала сеть (чтобы получать обновления), без сети — из кэша
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(SHELL_CACHE).then(c => c.put('./', copy)); return res })
        .catch(() => caches.match('./', { cacheName: SHELL_CACHE })),
    )
    return
  }

  // Всё остальное: из кэша, а если нет — из сети с сохранением
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit
      return fetch(req).then(res => {
        if (res.ok && url.pathname.includes('/assets/')) {
          const copy = res.clone()
          caches.open(ART_CACHE).then(c => c.put(req, copy))
        }
        return res
      })
    }),
  )
})

// ---------- Уведомления от партнёра (Web Push) ----------
// Каждое пришедшее уведомление обязательно показываем: так требует iPhone
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Мы', {
    body: d.body || '',
    icon: 'assets/brand/icon-192.png',
    badge: 'assets/brand/badge-96.png', // значок в строке состояния Android: белый силуэт на прозрачном
    data: { url: d.url || '' },
  }))
})

// Нажали на уведомление — открываем приложение на нужном экране
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const hash = (e.notification.data && e.notification.data.url) || ''
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins[0]) {
      await wins[0].focus().catch(() => {})
      if (hash) wins[0].postMessage({ go: hash })
      return
    }
    await self.clients.openWindow(new URL(hash, self.registration.scope).href)
  })())
})
