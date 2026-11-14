import { useEffect, useState } from 'react'
import { usePersist, useStore } from './store'
import { TODAY_KEY, addDays, diffDays } from './dates'
import { shrinkImage } from './ui'
import type { Who } from './data'

// Фото дня. Подписи и время лежат в localStorage, сами картинки — в IndexedDB:
// у localStorage на айфоне всего около 5 МБ, а фото копятся каждый день.

export interface DayPhoto { ref: string; at: string; caption?: string; liked?: boolean }
export type PhotoDay = Partial<Record<Who, DayPhoto>>
export type Photos = Record<string, PhotoDay>

export const THEMES = [
  'Что у тебя за окном', 'Твой обед', 'Небо прямо сейчас', 'Твоя обувь сегодня', 'Что-то жёлтое',
  'Что тебя сегодня порадовало', 'Твоё рабочее место', 'Твоя кружка', 'Кадр, который хочется мне показать',
  'Твоя рука и что-то рядом', 'Самое уютное место рядом', 'Что-то круглое', 'Улица по дороге', 'Твой вечер',
  'Что ты сейчас читаешь или смотришь', 'Любимая вещь в комнате', 'Что-то зелёное', 'Тень или отражение',
  'Твой завтрак', 'Что тебя рассмешило', 'Вещь, которая напоминает обо мне', 'Сегодняшний свет',
  'Что лежит в кармане или сумке', 'Твоё отражение', 'Что-то мягкое', 'Где ты сейчас',
]
export const themeOf = (k: string) => THEMES[((diffDays(k, '2026-01-01') % THEMES.length) + THEMES.length) % THEMES.length]

// Пример до подключения базы: тёплые градиенты с иконкой вместо настоящих снимков
export const GRADS = [
  'linear-gradient(170deg,#A9D3E8,#F7C4A0 70%,#F2A27A)', 'linear-gradient(160deg,#FCD9B8,#F6B6A0 55%,#BFA6D8)',
  'linear-gradient(165deg,#CFE6C4,#A8C49A 60%,#7FA27A)', 'linear-gradient(170deg,#F5D58C,#F2B07A 60%,#E58C78)',
  'linear-gradient(160deg,#D9D3F2,#BDB6E3 55%,#8F86C9)', 'linear-gradient(170deg,#FBE3D3,#F3B8B5 60%,#D98C99)',
]
const g = (n: number, icon: string, at: string, caption?: string): DayPhoto => ({ ref: `grad:${n}:${icon}`, at, caption })
const PHOTO_SEED: Photos = {
  '2026-11-09': { me: g(0, 'common/sun', '09:14'), him: g(3, 'common/pot', '13:40', 'обед по-холостяцки') },
  '2026-11-10': { me: g(4, 'common/moon', '22:05'), him: g(2, 'common/leaf', '17:22') },
  '2026-11-11': { me: g(1, 'common/heart', '11:30', 'наш плед'), him: g(5, 'common/sparkle', '20:15') },
  '2026-11-12': { me: g(3, 'challenges/ch_water', '08:47', 'первый день челленджа'), him: g(0, 'common/cloud', '12:02') },
  '2026-11-13': { me: g(2, 'common/sprout', '15:10'), him: g(4, 'tracker/labels/label_work', '10:31', 'офис') },
  '2026-11-14': { me: g(5, 'common/star', '21:40'), him: g(1, 'common/sun', '07:55', 'рассвет') },
  '2026-11-15': { him: g(0, 'common/raincloud', '08:12', 'у нас дождь') },
}

const DB = 'pair-photos', ST = 'img'
let dbp: Promise<IDBDatabase> | null = null
function db() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ST)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  }))
}
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  const d = await db()
  return new Promise<T>((res, rej) => {
    const r = fn(d.transaction(ST, mode).objectStore(ST))
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
const cache = new Map<string, string>()
export async function putImg(id: string, data: string) { await run('readwrite', s => s.put(data, id)); cache.set(id, data) }
export async function delImg(id: string) { cache.delete(id); await run('readwrite', s => s.delete(id)) }
export function clearImgs() { try { indexedDB.deleteDatabase(DB) } catch { /* нечего чистить */ } }

// Отдаёт data-URL картинки по ссылке 'idb:…' (для градиентов — null)
export function useImg(ref?: string) {
  const id = ref?.startsWith('idb:') ? ref.slice(4) : null
  const [src, setSrc] = useState<string | null>(id ? cache.get(id) ?? null : null)
  useEffect(() => {
    if (!id) { setSrc(null); return }
    if (cache.has(id)) { setSrc(cache.get(id)!); return }
    let alive = true
    run<string | undefined>('readonly', s => s.get(id)).then(v => { if (v) cache.set(id, v); if (alive) setSrc(v ?? null) }).catch(() => alive && setSrc(null))
    return () => { alive = false }
  }, [id])
  return src
}

const both = (d?: PhotoDay) => !!d?.me && !!d?.him
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export function usePhotos() {
  const s = useStore()
  const [photos, setPhotos] = usePersist<Photos>('photos', PHOTO_SEED)
  const today = photos[TODAY_KEY] ?? {}

  // Серия: дни подряд, когда фото выложили оба. Сегодняшний день не рвёт серию, пока он не закончился.
  let streak = 0
  for (let k = both(today) ? TODAY_KEY : addDays(TODAY_KEY, -1); both(photos[k]); k = addDays(k, -1)) streak++

  const patchMe = (p: Partial<DayPhoto> | null, k = TODAY_KEY) =>
    setPhotos(ps => {
      const day = { ...(ps[k] ?? {}) }
      if (p === null) delete day.me
      else day.me = { ...(day.me as DayPhoto), ...p }
      return { ...ps, [k]: day }
    })

  async function post(f: File) {
    try {
      const data = await shrinkImage(f, 1080)
      const id = `${TODAY_KEY}:me:${Date.now()}`
      await putImg(id, data)
      const old = today.me?.ref
      const first = !today.me
      patchMe({ ref: 'idb:' + id, at: nowHM(), caption: today.me?.caption })
      if (old?.startsWith('idb:')) delImg(old.slice(4)).catch(() => {})
      if (first) {
        if (today.him) s.earn(3, 'Фото дня · +1 и +2 за то, что вы оба', 'common/camera')
        else s.earn(1, 'Фото дня · +1', 'common/camera')
      } else s.toast('Фото заменено', 'common/camera')
    } catch {
      s.toast('Не получилось сохранить фото', 'states/st_error')
    }
  }
  function remove() {
    const old = today.me?.ref
    patchMe(null)
    if (old?.startsWith('idb:')) delImg(old.slice(4)).catch(() => {})
    s.toast('Фото убрано', 'common/cross_badge')
  }
  const caption = (c: string) => patchMe({ caption: c || undefined })
  const like = (k: string) =>
    setPhotos(ps => {
      const h = ps[k]?.him
      return h ? { ...ps, [k]: { ...ps[k], him: { ...h, liked: !h.liked } } } : ps
    })

  return { photos, today, streak, theme: themeOf(TODAY_KEY), post, remove, caption, like }
}
