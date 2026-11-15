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
const registration = () => navigator.serviceWorker.getRegistration()

// Подписка этого телефона (с нашим ключом) — и запоминаем её в облаке
async function subscribe(reg: ServiceWorkerRegistration, key: string) {
  let sub = await reg.pushManager.getSubscription()
  if (sub && b64u(sub.options.applicationServerKey) !== key) { await sub.unsubscribe().catch(() => false); sub = null }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(key) })
  await call({ action: 'save', sub: sub.toJSON() })
}

async function pushState(): Promise<PushState> {
  if (!pushSupported() || !cloud || !getLink()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  if (!reg) return 'unsupported'
  if (Notification.permission === 'granted' && (await reg.pushManager.getSubscription())) return 'on'
  return (await serverKey()) ? 'off' : 'nosetup'
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
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    pushState().then(st => { if (alive) setState(st) }, () => { if (alive) setState('unsupported') })
    return () => { alive = false }
  }, [])
  const run = async (f: () => Promise<void>) => {
    setBusy(true)
    try { await f() } catch (e) { s.toast('Не получилось: ' + ((e as Error)?.message ?? e), 'states/st_error') } finally { setBusy(false) }
  }
  return {
    state, busy,
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
          <span className="small b muted">На этом телефоне не получится: нужен iPhone с iOS 16.4 или новее и приложение, открытое с экрана «Домой».</span>
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
