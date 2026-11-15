import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config'

/* Синхронизация данных пары.
   Каждый раздел приложения (задачи, кот, календарь…) — один документ в таблице docs.
   На телефоне лежит копия всех документов (localStorage): приложение открывается мгновенно и работает без сети.
   Изменение сначала применяется у себя, потом отправляется в облако; изменения партнёра прилетают через realtime.

   «Я» и «он» у каждого свои. В базе данные хранятся с точки зрения того, кто создал пару (slot a);
   у второго (slot b) при чтении и записи ключи me/him и поля who/by/… меняются местами. */

// Только при разработке: ?local — открыть без облака, чтобы проверять экраны
const devLocal = import.meta.env.DEV && new URLSearchParams(location.search).has('local')
export const cloud: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY && !devLocal
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'pair.auth' } })
    : null

export type Slot = 'a' | 'b'
export interface Link { user: string; email: string; couple: string; slot: Slot; code: string }

const PREFIX = 'pair.v2.'
// Только на этом телефоне: настройки экрана, входящие уведомления
const LOCAL_ONLY = new Set(['cheat_about', 'inbox'])

const ls = {
  get<T>(k: string): T | undefined { try { const r = localStorage.getItem(k); return r == null ? undefined : (JSON.parse(r) as T) } catch { return undefined } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* место кончилось */ } },
  del(k: string) { try { localStorage.removeItem(k) } catch { /* нет доступа */ } },
}

let link: Link | null = ls.get<Link>('pair.link') ?? null
export const getLink = () => link

// ---------- Документы ----------
const values = new Map<string, unknown>()
const views = new Map<string, { src: unknown; view: unknown }>()
const inits = new Map<string, unknown>()
const subs = new Map<string, Set<() => void>>()
const pending = new Set<string>(ls.get<string[]>('pair.pending') ?? [])
const timers = new Map<string, number>()

try {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIX)) values.set(k.slice(PREFIX.length), ls.get(k))
    // Первые версии хранили примеры (pair.v1.) — убираем, чтобы старт был чистым
    else if (k.startsWith('pair.v1.')) localStorage.removeItem(k)
  }
} catch { /* приватный режим */ }

const WHO_FIELDS = new Set(['who', 'by', 'winner', 'assignee', 'author', 'owner', 'from', 'cycleBy'])
export function flip(v: unknown, field?: string): unknown {
  if (Array.isArray(v)) return v.map(x => flip(x))
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) o[k === 'me' ? 'him' : k === 'him' ? 'me' : k] = flip(x, k)
    return o
  }
  if (typeof v === 'string' && field && WHO_FIELDS.has(field)) return v === 'me' ? 'him' : v === 'him' ? 'me' : v
  return v
}
const mine = (canon: unknown) => (link?.slot === 'b' ? flip(canon) : canon)
const toCanon = (view: unknown) => (link?.slot === 'b' ? flip(view) : view)

export function subscribe(key: string, cb: () => void) {
  let set = subs.get(key)
  if (!set) subs.set(key, (set = new Set()))
  set.add(cb)
  return () => { set!.delete(cb) }
}
const emit = (key: string) => subs.get(key)?.forEach(cb => cb())

export function getView<T>(key: string, init: T | (() => T)): T {
  if (!values.has(key)) {
    if (!inits.has(key)) inits.set(key, typeof init === 'function' ? (init as () => T)() : init)
    return inits.get(key) as T
  }
  const src = values.get(key)
  const c = views.get(key)
  if (c && c.src === src) return c.view as T
  const view = mine(src)
  views.set(key, { src, view })
  return view as T
}

export function setDoc(key: string, view: unknown) {
  const canon = toCanon(view)
  values.set(key, canon)
  views.set(key, { src: canon, view })
  ls.set(PREFIX + key, canon)
  emit(key)
  if (link && cloud && !LOCAL_ONLY.has(key)) {
    pending.add(key)
    ls.set('pair.pending', [...pending])
    clearTimeout(timers.get(key))
    timers.set(key, window.setTimeout(() => push(key), 300))
  }
}

function applyRemote(key: string, canon: unknown) {
  if (pending.has(key) || LOCAL_ONLY.has(key)) return
  values.set(key, canon)
  ls.set(PREFIX + key, canon)
  emit(key)
}

async function push(key: string) {
  if (!link || !cloud) return
  const { error } = await cloud.from('docs').upsert({ couple_id: link.couple, key, value: values.get(key) ?? null, updated_by: link.user, updated_at: new Date().toISOString() })
  if (error) { setStatus('offline'); timers.set(key, window.setTimeout(() => push(key), 8000)); return }
  pending.delete(key)
  ls.set('pair.pending', [...pending])
  if (!pending.size) setStatus('online')
}

// ---------- Состояние связи (для значка в профиле) ----------
export type Status = 'local' | 'online' | 'offline' | 'syncing'
let status: Status = cloud ? 'syncing' : 'local'
const statusSubs = new Set<() => void>()
function setStatus(s: Status) { if (s !== status) { status = s; statusSubs.forEach(f => f()) } }
export const getStatus = () => status
export const onStatus = (f: () => void) => { statusSubs.add(f); return () => { statusSubs.delete(f) } }

// ---------- Подключение пары ----------
let channel: RealtimeChannel | null = null
const eventSubs = new Set<(e: PairEvent) => void>()
export interface PairEvent { id: number; kind: string; payload: Record<string, unknown>; created_at: string; mine: boolean }

async function pullAll() {
  if (!link || !cloud) return false
  const { data, error } = await cloud.from('docs').select('key, value').eq('couple_id', link.couple)
  if (error) { setStatus('offline'); return false }
  for (const row of data ?? []) applyRemote(row.key, row.value)
  // своё неотправленное — догоняем
  for (const k of [...pending]) push(k)
  if (!pending.size) setStatus('online')
  return true
}

// joined — только что вошли в пару по коду: своя половина начинается заново (если это не возвращение)
export async function startSync(l: Link, opts: { uploadLocal?: boolean; joined?: boolean } = {}) {
  if (!cloud) return false
  const prev = link
  // Другой аккаунт или другая пара на этом телефоне — старая копия не нужна
  if (!prev || prev.user !== l.user || prev.couple !== l.couple) {
    if (!opts.uploadLocal) clearLocalDocs()
  }
  link = l
  ls.set('pair.link', l)
  views.clear()
  if (opts.uploadLocal) for (const k of values.keys()) if (!LOCAL_ONLY.has(k)) pending.add(k)
  ls.set('pair.pending', [...pending])
  for (const k of subs.keys()) emit(k)

  channel?.unsubscribe()
  setHere(false)
  const ch = cloud.channel('pair-' + l.couple, { config: { presence: { key: l.user } } })
  channel = ch
    // Кто сейчас в приложении: каждый отмечается в канале пары, пока приложение открыто
    .on('presence', { event: 'sync' }, () => setHere(Object.keys(ch.presenceState()).some(k => k !== l.user)))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: `couple_id=eq.${l.couple}` }, p => {
      const row = p.new as { key?: string; value?: unknown; updated_by?: string }
      if (row?.key && row.updated_by !== l.user) applyRemote(row.key, row.value)
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events', filter: `couple_id=eq.${l.couple}` }, p => {
      const r = p.new as { id: number; kind: string; payload: Record<string, unknown>; created_at: string; from_user: string }
      const e: PairEvent = { id: r.id, kind: r.kind, payload: r.payload ?? {}, created_at: r.created_at, mine: r.from_user === l.user }
      eventSubs.forEach(f => f(e))
    })
    .subscribe(st => { if (st === 'SUBSCRIBED') { pullAll(); trackMe() } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') setStatus('offline') })

  const ok = await pullAll()
  if (ok && opts.joined) freshSide(l.user)
  // Запоминаем, чья это половина: если этот же человек когда-нибудь вернётся в пару, его записи не сотрутся
  else if (ok && !getView<Record<string, string>>('owners', {}).me) setDoc('owners', { ...getView<Record<string, string>>('owners', {}), me: l.user })
  return ok
}

// ---------- Кто сейчас в приложении ----------
let partnerHere = false
const presenceSubs = new Set<() => void>()
function setHere(v: boolean) { if (v !== partnerHere) { partnerHere = v; presenceSubs.forEach(f => f()) } }
export const isPartnerHere = () => partnerHere
export const onPresence = (f: () => void) => { presenceSubs.add(f); return () => { presenceSubs.delete(f) } }
// Пока приложение на экране — «в сети», свернули — сразу пропадаем
function trackMe() {
  if (!channel) return
  const p = document.visibilityState === 'visible' ? channel.track({ at: Date.now() }) : channel.untrack()
  p.catch(() => {})
}

// Пара сменилась или нас отвязали: забываем пару на этом телефоне, вход остаётся
export function forgetLink() {
  channel?.unsubscribe(); channel = null
  link = null
  ls.del('pair.link')
  clearLocalDocs()
  setHere(false)
}

// Отвязать партнёра: второй участник выходит из пары, всё общее остаётся
export async function unlinkPartner() {
  if (!cloud || !link) return 'нет связи'
  sendEvent('unlinked')
  await new Promise(r => setTimeout(r, 700))
  const { error } = await cloud.rpc('remove_partner')
  if (!error) return null
  return /remove_partner|function|schema cache/i.test(error.message) ? 'update-db' : error.message
}

/* Новый участник пары начинает свою половину с чистого листа. Если на это место раньше
   заходил другой аккаунт (например, проверочный), его монеты, настроения, ответы в шпаргалке,
   фото и личные списки новому не достаются. Имя и пол оставляем — их можно поправить при знакомстве. */
function freshSide(user: string) {
  const owners = getView<Record<string, string>>('owners', {})
  // Тот же человек вернулся в пару — его половина на месте, ничего не трогаем
  if (owners.me === user) return
  setDoc('owners', { ...owners, me: user })
  const upd = <T,>(k: string, f: (v: T) => T) => { if (values.has(k)) setDoc(k, f(getView<T>(k, undefined as T))) }
  type ByWho = Record<string, unknown>
  const notMine = (field: string) => (xs: ByWho[]) => (Array.isArray(xs) ? xs.filter(x => x[field] !== 'me') : xs)
  const clearMe = (empty: unknown) => (v: ByWho) => (v && typeof v === 'object' ? { ...v, me: empty } : v)
  upd<ByWho>('profile', p => ({ ...p, me: { ...(p.me as ByWho), photo: null, ready: false } }))
  upd('coins', clearMe(0)); upd('jar', clearMe(0))
  for (const k of ['moods', 'sent', 'cheat', 'cheat_notes']) upd(k, clearMe({}))
  upd<Record<string, ByWho>>('photos', ph => Object.fromEntries(Object.entries(ph ?? {}).map(([d, v]) => { const { me: _drop, ...rest } = v ?? {}; void _drop; return [d, rest] })))
  upd('seen', notMine('by')); upd('offers', notMine('by')); upd('wishes', notMine('who')); upd('coupons', notMine('owner'))
  upd<ByWho>('settings', st => (st?.cycleBy === 'me' ? { ...st, cycle: false, cycleBy: undefined } : st))
}

// При возвращении в приложение, появлении сети и обновлении входа — догоняем пропущенное
cloud?.auth.onAuthStateChange(ev => { if (ev === 'TOKEN_REFRESHED' || ev === 'SIGNED_IN') setTimeout(() => pullAll()) })
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => pullAll())
  document.addEventListener('visibilitychange', () => { trackMe(); if (document.visibilityState === 'visible') pullAll() })
}

function clearLocalDocs() {
  values.clear(); views.clear(); pending.clear()
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k) } catch { /* нет доступа */ }
  ls.del('pair.pending')
}

export async function signOut() {
  channel?.unsubscribe(); channel = null
  await cloud?.auth.signOut()
  link = null
  ls.del('pair.link')
  clearLocalDocs()
  try { indexedDB.deleteDatabase('pair-photos') } catch { /* нет базы */ }
}

export function resetLocal() {
  clearLocalDocs()
  try { indexedDB.deleteDatabase('pair-photos') } catch { /* нет базы */ }
}

// Найти свою пару после входа (без сети — берём сохранённую)
export async function resolveLink(user: string, email: string): Promise<Link | null | 'offline'> {
  if (!cloud) return null
  const { data, error } = await cloud.from('members').select('couple_id, slot').eq('user_id', user).maybeSingle()
  if (error) return link && link.user === user ? link : 'offline'
  if (!data) return null
  const { data: cp } = await cloud.from('couples').select('code').eq('id', data.couple_id).maybeSingle()
  return { user, email, couple: data.couple_id, slot: data.slot as Slot, code: cp?.code ?? '' }
}

export async function partnerJoined() {
  if (!cloud || !link) return false
  const { count } = await cloud.from('members').select('user_id', { count: 'exact', head: true }).eq('couple_id', link.couple)
  return (count ?? 0) >= 2
}

// ---------- События для партнёра ----------
export function sendEvent(kind: string, payload: Record<string, unknown> = {}) {
  if (!cloud || !link) return
  cloud.from('events').insert({ couple_id: link.couple, kind, payload }).then(() => {}, () => {})
}
export function onEvent(f: (e: PairEvent) => void) { eventSubs.add(f); return () => { eventSubs.delete(f) } }

// Что партнёр прислал, пока приложение было закрыто
export async function missedEvents(since: string) {
  if (!cloud || !link) return []
  const { data } = await cloud.from('events').select('id, kind, payload, created_at, from_user').eq('couple_id', link.couple).gt('created_at', since).neq('from_user', link.user).order('created_at').limit(50)
  return (data ?? []).map(r => ({ id: r.id, kind: r.kind, payload: r.payload ?? {}, created_at: r.created_at, mine: false }) as PairEvent)
}

// ---------- Фото ----------
// ---------- Картинки как файлы (Supabase Storage, корзина 'photos') ----------
// Лежат по папкам пар: <пара>/<id>.jpg — правила в базе пускают только в папку своей пары.
// Место отдельное от базы (1 ГБ бесплатно), и файл меньше, чем та же картинка текстом в базе.
const BUCKET = 'photos'
const filePath = (id: string) => `${link!.couple}/${id.replace(/[^\w.-]/g, '_')}.jpg`
export async function putFile(id: string, data: string) {
  if (!cloud || !link) return false
  try {
    const blob = await (await fetch(data)).blob()
    const { error } = await cloud.storage.from(BUCKET).upload(filePath(id), blob, { contentType: 'image/jpeg', upsert: true })
    return !error
  } catch { return false }
}
export async function getFile(id: string) {
  if (!cloud || !link) return undefined
  const { data, error } = await cloud.storage.from(BUCKET).download(filePath(id))
  if (error || !data) return undefined
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(data) })
}
export async function delFile(id: string) {
  if (!cloud || !link) return
  await cloud.storage.from(BUCKET).remove([filePath(id)])
}

// Старый способ: картинка текстом в таблице blobs (читаем то, что так уже сохранено)
export async function putBlob(id: string, data: string) {
  if (!cloud || !link) return false
  const { error } = await cloud.from('blobs').upsert({ couple_id: link.couple, id, data })
  return !error
}
export async function getBlob(id: string) {
  if (!cloud || !link) return undefined
  const { data } = await cloud.from('blobs').select('data').eq('couple_id', link.couple).eq('id', id).maybeSingle()
  return (data?.data as string | undefined) ?? undefined
}
export async function delBlob(id: string) {
  if (!cloud || !link) return
  await cloud.from('blobs').delete().eq('couple_id', link.couple).eq('id', id)
}
