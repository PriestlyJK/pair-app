import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/nunito'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Офлайн-режим и обновления: только в собранной версии, в разработке мешает
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // Проверяем обновление при каждом возвращении в приложение
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
      reg.active?.postMessage('warm')
    }).catch(() => {})
    // Новая версия встала: перезагружаемся незаметно, когда приложение свернут
    let had = !!navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had) { had = true; return }
      const reload = () => { if (document.visibilityState === 'hidden') location.reload() }
      document.addEventListener('visibilitychange', reload)
    })
  })
  // Просим браузер не чистить данные приложения
  navigator.storage?.persist?.().catch(() => {})
}
