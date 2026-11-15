import { useEffect, useState } from 'react'
import { cloud, getLink } from './sync'
import { PUSH_FUNCTION } from './config'
import { useStore } from './store'
import { Img, useName } from './ui'

/* Уведомления на телефон, как от обычного приложения.
   Работают на iPhone с iOS 16.4+, когда «Мы» открыто с экрана «Домой» (а по-другому приложение и не открыть).
   Телефон подписывается у службы доставки (у Apple), подписка хранится в облаке через функцию Supabase (PUSH_FUNCTION в config.ts),
   и когда партнёр что-то делает, функция присылает уведомление на все его телефоны.
   Отправка — в sync.ts (sendEvent), текст — в store.tsx (pushText). */

export type PushState = 'loading' | 'unsupported' | 'nosetup' | 'off' | 'denied' | 'on'
const KEY = 'pair.vapid'
const OFF = 'pair.pushOff' // выключили сами — не подписываем заново при запуске

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* нет доступа */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* нет доступа */ } },
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function call<T>(body: object): Promise<T> {
  if (!cloud) throw new Error('нет облака')
  const { data, error } = await cloud.functions.invoke(PUSH_FUNCTION, { body })
  if (error) throw error
  return data as T
}

// Открытый ключ отправителя (функция создаёт его сама при первом запуске). Нет функции — null.
async function serverKey(): Promise<string | null> {
  try {
    const { key } = await call<{ key: string }>({ action: 'key' })
    if (key) ls.set(KEY, key)
    return key || null
  } catch {
    return ls.get(KEY)
  }
}

const b64u = (b: ArrayBuffer | null) => (b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '')
const bytes = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0))
}
// Фоновый помощник приложения (service worker): через него приходят уведомления.
// Если его почему-то нет — ставим сейчас, а не говорим «не получится».
async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg || import.meta.env.DEV) return reg
  try {
    await navigator.serviceWorker.register('./sw.js')
    return await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>(r => setTimeout(() => r(undefined), 8000))])
  } catch { return undefined }
}

// Что видит телефон — короткая строка для скриншота, чтобы понять причину
const iosVer = () => navigator.userAgent.match(/OS (\d+)_(\d+)/)
const standalone = () => !!(navigator as Navigator & { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches
export function pushDiag() {
  const v = iosVer()
  const yes = (b: boolean) => (b ? '✓' : '✗')
  return [v ? `iOS ${v[1]}.${v[2]}` : 'не iOS', standalone() ? 'с экрана «Домой»' : 'в браузере',
    `sw ${yes('serviceWorker' in navigator)}`, `push ${yes('PushManager' in window)}`, `notif ${yes('Notification' in window)}`].join(' · ')
}
function unsupportedWhy() {
  const v = iosVer()
  if (v && (Number(v[1]) < 16 || (Number(v[1]) === 16 && Number(v[2]) < 4)))
    return `На iPhone сейчас iOS ${v[1]}.${v[2]}, а уведомления для таких приложений появились в iOS 16.4. Обнови iPhone: Настройки → Основные → Обновление ПО.`
  if (!standalone()) return 'Приложение открыто в браузере — открой «Мы» значком с экрана «Домой».'
  return ''
}

// Подписка этого телефона (с нашим ключом) — и запоминаем её в облаке
async function subscribe(reg: ServiceWorkerRegistration, key: string) {
  let sub = await reg.pushManager.getSubscription()
  if (sub && b64u(sub.options.applicationServerKey) !== key) { await sub.unsubscribe().catch(() => false); sub = null }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) })
  await call({ action: 'save', sub: sub.toJSON() })
}

type Check = { state: PushState; why?: string }
async function pushState(): Promise<Check> {
  if (!cloud || !getLink()) return { state: 'unsupported', why: 'Нет связи с облаком.' }
  if (!pushSupported()) return { state: 'unsupported', why: unsupportedWhy() }
  if (Notification.permission === 'denied') return { state: 'denied' }
  const reg = await registration()
  if (!reg) return { state: 'unsupported', why: 'Не запустился фоновый помощник приложения. Закрой «Мы» полностью (смахни вверх) и открой снова.' }
  if (!reg.pushManager) return { state: 'unsupported', why: unsupportedWhy() }
  if (Notification.permission === 'granted' && (await reg.pushManager.getSubscription())) return { state: 'on' }
  return { state: (await serverKey()) ? 'off' : 'nosetup' }
}

// При запуске: если уведомления разрешены — проверяем, что подписка жива и облако о ней знает
export async function refreshPush() {
  if (!pushSupported() || !cloud || !getLink() || Notification.permission !== 'granted' || ls.get(OFF)) return
  const reg = await registration()
  const key = reg && (await serverKey())
  if (reg && key) await subscribe(reg, key).catch(() => {})
}

export function usePush() {
  const s = useStore()
  const [state, setState] = useState<PushState>('loading')
  const [why, setWhy] = useState('')
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    pushState().then(
      c => { if (alive) { setState(c.state); setWhy(c.why ?? '') } },
      e => { if (alive) { setState('unsupported'); setWhy('Ошибка: ' + ((e as Error)?.message ?? e)) } },
    )
    return () => { alive = false }
  }, [n])
  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    try { await f() } catch (e) { s.toast('Не получилось: ' + ((e as Error)?.message ?? e), 'states/st_error') } finally { setBusy(false) }
  }
  return {
    state, why, busy,
    recheck: () => { setState('loading'); setN(x => x + 1) },
    // Сначала спрашиваем разрешение — прямо по нажатию, иначе iPhone окно не покажет
    enable: () => run(async () => {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'off'); return }
      const reg = await registration()
      const key = ls.get(KEY) ?? (await serverKey())
      if (!reg) { setState('unsupported'); return }
      if (!key) { setState('nosetup'); return }
      await subscribe(reg, key)
      ls.del(OFF)
      setState('on')
      s.toast('Уведомления включены', 'common/bell')
    }),
    disable: () => run(async () => {
      const sub = await (await registration())?.pushManager.getSubscription()
      if (sub) { await call({ action: 'remove', endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe() }
      ls.set(OFF, '1')
      setState('off')
    }),
    test: () => run(async () => {
      const r = await call<{ sent: number; results: unknown[] }>({ action: 'send', test: true, title: 'Мы', body: 'Так будут приходить уведомления', url: '#home' })
      if (r.sent) s.toast('Отправили — сверни приложение и жди', 'common/bell')
      else s.toast('Не дошло: ' + (r.results?.join(', ') || 'телефон не найден, включи заново'), 'states/st_error')
    }),
  }
}

// Раздел в профиле
export function PushSection() {
  const p = usePush()
  const name = useName()
  if (p.state === 'loading') return null
  return (
    <>
      <div className="sec-title">Уведомления</div>
      <div className="card flat col" style={{ gap: 10 }}>
        {p.state === 'on' && (
          <>
            <div className="row"><span className="grow small muted b">На этом телефоне</span><b className="small" style={{ color: 'var(--leaf)' }}>включены</b></div>
            <div className="grid2">
              <button className="btn soft" disabled={p.busy} onClick={p.test}>Проверить</button>
              <button className="btn soft" disabled={p.busy} onClick={p.disable}>Выключить</button>
            </div>
          </>
        )}
        {p.state === 'off' && (
          <>
            <span className="small b">Придут, когда {name('him')} что-то сделает: обнимет, выложит фото дня, отметит задачу — даже если приложение закрыто.</span>
            <button className="btn wide peach" disabled={p.busy} onClick={p.enable}><Img src="common/bell" />Включить уведомления</button>
          </>
        )}
        {p.state === 'denied' && (
          <span className="small b">Уведомления запрещены в настройках iPhone. Включить: Настройки → Уведомления → «Мы» → Допуск уведомлений.</span>
        )}
        {p.state === 'unsupported' && (
          <>
            <span className="small b muted">{p.why || 'На этом телефоне не получилось включить: нужен iPhone с iOS 16.4 или новее и приложение, открытое с экрана «Домой».'}</span>
            <span className="muted b" style={{ fontSize: 11 }}>{pushDiag()}</span>
            <button className="btn sm soft" style={{ alignSelf: 'flex-start' }} onClick={p.recheck}>Проверить ещё раз</button>
          </>
        )}
        {p.state === 'nosetup' && (
          <span className="small b muted">Уведомления ещё не настроены в облаке: в Supabase нужна функция уведомлений (инструкция в supabase/push.sql).</span>
        )}
      </div>
    </>
  )
}

// Подсказка на главной: один раз предлагаем включить
const ASKED = 'pair.pushAsked'
export function PushNudge() {
  const p = usePush()
  const name = useName()
  const [hidden, setHidden] = useState(() => !!ls.get(ASKED))
  if (hidden || p.state !== 'off') return null
  const hide = () => { ls.set(ASKED, '1'); setHidden(true) }
  return (
    <div className="inbox push-nudge">
      <Img src="common/bell" />
      <div className="grow">
        <b>Включить уведомления?</b>
        <small>Узнаешь сразу, когда {name('him')} что‑то сделает</small>
      </div>
      <button className="btn sm peach" disabled={p.busy} onClick={async () => { await p.enable(); hide() }}>Включить</button>
      <button className="x" aria-label="Скрыть" onClick={hide}>×</button>
    </div>
  )
}
