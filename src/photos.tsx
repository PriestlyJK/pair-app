import { useEffect, useState } from 'react'
import { usePersist, useStore } from './store'
import { TODAY_KEY, addDays, diffDays } from './dates'
import { shrinkImage } from './ui'
import { getLink, putBlob, getBlob, delBlob, putFile, getFile, delFile, getView, setDoc, sendEvent } from './sync'
import type { Who } from './data'

// Фото дня. Подписи и время — в общем документе 'photos', сами картинки — отдельно:
// в облаке (таблица blobs, ссылка 'sb:…') и копией на телефоне в IndexedDB,
// у localStorage на айфоне всего около 5 МБ, а фото копятся каждый день.
// Без облака ссылка 'idb:…' — только на этом телефоне.

// late — добавлено позже, за прошедший день: без монет и не в счёт серии
export interface DayPhoto { ref: string; at: string; caption?: string; liked?: boolean; late?: boolean }
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

// Градиенты для старых записей без настоящего снимка
export const GRADS = [
  'linear-gradient(170deg,#A9D3E8,#F7C4A0 70%,#F2A27A)', 'linear-gradient(160deg,#FCD9B8,#F6B6A0 55%,#BFA6D8)',
  'linear-gradient(165deg,#CFE6C4,#A8C49A 60%,#7FA27A)', 'linear-gradient(170deg,#F5D58C,#F2B07A 60%,#E58C78)',
  'linear-gradient(160deg,#D9D3F2,#BDB6E3 55%,#8F86C9)', 'linear-gradient(170deg,#FBE3D3,#F3B8B5 60%,#D98C99)',
]

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

// Ссылки: 'st:' — файл в облачном хранилище, 'sb:' — старый способ (текстом в базе), 'idb:' — только на этом телефоне
const idOf = (ref?: string) => (ref && /^(idb|sb|st):/.test(ref) ? ref.slice(ref.indexOf(':') + 1) : null)

// Достаёт картинку: память → телефон → облако (и кладёт копию на телефон)
async function loadImg(ref: string, id: string) {
  const local = await run<string | undefined>('readonly', s => s.get(id)).catch(() => undefined)
  if (local) return local
  const remote = ref.startsWith('st:') ? await getFile(id) : ref.startsWith('sb:') ? await getBlob(id) : undefined
  if (remote) putImg(id, remote).catch(() => {})
  return remote
}

// Отдаёт data-URL картинки по ссылке 'sb:…' / 'idb:…' (для градиентов — null)
export function useImg(ref?: string) {
  const id = idOf(ref)
  const [src, setSrc] = useState<string | null>(id ? cache.get(id) ?? null : null)
  useEffect(() => {
    if (!id || !ref) { setSrc(null); return }
    if (cache.has(id)) { setSrc(cache.get(id)!); return }
    let alive = true
    loadImg(ref, id).then(v => { if (v) cache.set(id, v); if (alive) setSrc(v ?? null) }).catch(() => alive && setSrc(null))
    return () => { alive = false }
  }, [id, ref])
  return src
}
const dropImg = (ref?: string) => {
  const id = idOf(ref)
  if (!id) return
  delImg(id).catch(() => {})
  if (ref!.startsWith('sb:')) delBlob(id).catch(() => {})
  if (ref!.startsWith('st:')) delFile(id).catch(() => {})
}
export { dropImg }

/* Сохраняет картинку и отдаёт ссылку для документа. Копия всегда на телефоне;
   в облако — файлом в хранилище, а если его ещё не создали в Supabase — по-старому, в базу.
   null — облако есть, но отправить не вышло (нет сети). */
export async function saveImage(id: string, data: string): Promise<string | null> {
  await putImg(id, data)
  if (!getLink()) return 'idb:' + id
  if (await putFile(id, data)) return 'st:' + id
  if (await putBlob(id, data)) return 'sb:' + id
  return null
}

/* Переносит картинки, сохранённые текстом в базе, в хранилище файлов: фото дня ('sb:')
   и фото из Bucket list (лежали прямо в документе). Идёт в фоне, по одной; если хранилища
   ещё нет или пропала сеть — остановится и продолжит при следующем запуске. */
let moving = false
export async function moveImagesToFiles() {
  if (moving || !getLink()) return
  moving = true
  try {
    const photos = getView<Photos>('photos', {})
    for (const [day, d] of Object.entries(photos)) {
      for (const w of ['me', 'him'] as Who[]) {
        const ref = d?.[w]?.ref
        if (!ref?.startsWith('sb:')) continue
        const id = ref.slice(3)
        const data = cache.get(id) ?? (await run<string | undefined>('readonly', s => s.get(id)).catch(() => undefined)) ?? (await getBlob(id))
        if (!data) continue
        if (!(await putFile(id, data))) return
        const cur = getView<Photos>('photos', {})
        const p = cur[day]?.[w]
        if (p?.ref === ref) setDoc('photos', { ...cur, [day]: { ...cur[day], [w]: { ...p, ref: 'st:' + id } } })
        delBlob(id).catch(() => {})
      }
    }
    type G = { id: number; photo?: string }
    for (const g of getView<G[]>('bucket', [])) {
      if (!g.photo?.startsWith('data:')) continue
      const id = `bucket-${g.id}-${Date.now()}`
      if (!(await putFile(id, g.photo))) return
      await putImg(id, g.photo).catch(() => {})
      setDoc('bucket', getView<G[]>('bucket', []).map(x => (x.id === g.id && x.photo === g.photo ? { ...x, photo: 'st:' + id } : x)))
    }
  } finally { moving = false }
}

// Картинка по ссылке из документа (или старая, вставленная прямо в документ как data:…)
export function RefImg({ src, className }: { src?: string; className?: string }) {
  const loaded = useImg(src?.startsWith('data:') ? undefined : src)
  const url = src?.startsWith('data:') ? src : loaded
  return url ? <img src={url} alt="" className={className} draggable={false} /> : <span className={'img-wait ' + (className ?? '')} />
}

const both = (d?: PhotoDay) => !!d?.me && !!d?.him && !d.me.late && !d.him.late
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export function usePhotos() {
  const s = useStore()
  const [photos, setPhotos] = usePersist<Photos>('photos', {})
  const today = photos[TODAY_KEY] ?? {}

  // Серия: дни подряд, когда фото выложили оба. Сегодняшний день не рвёт серию, пока он не закончился.
  let streak = 0
  for (let k = both(today) ? TODAY_KEY : addDays(TODAY_KEY, -1); both(photos[k]); k = addDays(k, -1)) streak++

  // Лучшая серия за всё время (для ачивок)
  let best = 0, run = 0, prev = ''
  for (const k of Object.keys(photos).filter(k => both(photos[k])).sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run); prev = k
  }

  const patchMe = (p: Partial<DayPhoto> | null, k = TODAY_KEY) =>
    setPhotos(ps => {
      const day = { ...(ps[k] ?? {}) }
      if (p === null) delete day.me
      else day.me = { ...(day.me as DayPhoto), ...p }
      return { ...ps, [k]: day }
    })

  async function post(f: File, k = TODAY_KEY) {
    const late = k < TODAY_KEY
    const day = photos[k] ?? {}
    s.toast('Отправляю фото…', 'common/camera')
    try {
      const data = await shrinkImage(f, 1080, false, 0.75)
      const l = getLink()
      const id = `${k}_${l ? l.user.slice(0, 8) : 'me'}_${Date.now()}`
      // Сначала в облако, потом ссылка в общий документ — чтобы у партнёра картинка уже была
      const ref = await saveImage(id, data)
      if (!ref) { s.toast('Нет связи — фото не отправилось, попробуй ещё раз', 'states/st_offline'); return }
      const inCloud = !ref.startsWith('idb:')
      const old = day.me?.ref
      const first = !day.me
      patchMe({ ref, at: late ? '' : nowHM(), caption: day.me?.caption, late: late || undefined }, k)
      dropImg(old)
      if (inCloud) sendEvent('photo', { day: k })
      if (late) s.toast(first ? 'Фото добавлено в тот день' : 'Фото заменено', 'common/camera')
      else if (first) {
        if (today.him) s.earn(3, 'Фото дня · +1 и +2 за то, что вы оба', 'common/camera')
        else s.earn(1, 'Фото дня · +1', 'common/camera')
      } else s.toast('Фото заменено', 'common/camera')
    } catch {
      s.toast('Не получилось сохранить фото', 'states/st_error')
    }
  }
  function remove(k = TODAY_KEY) {
    const old = photos[k]?.me?.ref
    patchMe(null, k)
    dropImg(old)
    s.toast('Фото убрано', 'common/cross_badge')
  }
  const caption = (c: string, k = TODAY_KEY) => patchMe({ caption: c || undefined }, k)
  const like = (k: string) =>
    setPhotos(ps => {
      const h = ps[k]?.him
      return h ? { ...ps, [k]: { ...ps[k], him: { ...h, liked: !h.liked } } } : ps
    })

  return { photos, today, streak, best, theme: themeOf(TODAY_KEY), post, remove, caption, like }
}
