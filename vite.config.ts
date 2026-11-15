import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Все картинки из public/assets (кроме заставок: каждому айфону нужна только своя)
function listArt(dir = 'public/assets'): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return f === 'splash' ? [] : listArt(p)
    return /\.(webp|png)$/.test(f) ? [relative('public', p).split(sep).join('/')] : []
  })
}

// Собирает sw.js: список файлов оболочки и картинок + версии кэшей
function serviceWorker(): Plugin {
  return {
    name: 'pair-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const shell = ['./', 'manifest.webmanifest', ...Object.keys(bundle).filter(f => !f.endsWith('.map'))]
      const art = listArt()
      const artHash = createHash('sha1')
      for (const p of art) artHash.update(p + statSync(join('public', p)).size + statSync(join('public', p)).mtimeMs)
      const source = readFileSync('sw-template.js', 'utf8')
        .replace('__VERSION__', createHash('sha1').update(shell.join()).digest('hex').slice(0, 10))
        .replace('__ART_VERSION__', artHash.digest('hex').slice(0, 10))
        .replace('__SHELL__', JSON.stringify(shell))
        .replace('__ART__', JSON.stringify(art))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  // Когда собрана эта версия — видно в профиле (раздел «Уведомления»), чтобы понять, обновился ли телефон
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  // Относительный base: сборка открывается и с корня домена, и из подпапки
  base: './',
  // Код и шрифт кладём в app/, чтобы не смешивать с картинками в assets/
  build: { assetsDir: 'app' },
  plugins: [react(), serviceWorker()],
  server: { host: true, port: 5173 },
})
