import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { Task, Who } from './data'
import { TODAY_KEY, diffDays, human, type CycleDay } from './dates'
import { moveImagesToFiles } from './photos'
import { getView, setDoc, subscribe, resetLocal, signOut, cloud, onEvent, missedEvents, getLink, type PairEvent } from './sync'

// Общее состояние приложения. Пока хранится на телефоне (localStorage), потом переедет в Supabase.
// Новый пользователь начинает с пустыми данными: всё заполняется в процессе.

export type Tab = 'home' | 'board' | 'calendar' | 'together' | 'cheatsheet'
export type ShopTab = 'food' | 'toys' | 'acc' | 'furniture' | 'coupons' | 'jar'

export interface Pet {
  name: string
  breed: string
  stage: 'baby' | 'adult'
  level: number
  xp: number
  xpNext: number
  satiety: number
  happiness: number
  acc: string | null
  // Когда сытость и счастье были такими, как записано. Текущие считаются от этого момента
  at?: string
}

/* Голод и настроение убывают со временем, даже когда приложение закрыто.
   В документе лежат значения на момент `at`, а сейчас — считаем: на обоих телефонах выходит одинаково.
   Сытость: 7 в час днём и 3.5 ночью (кот спит с 23 до 7) — полная миска (+50) примерно на 7 часов,
   кормить 2–3 раза в день. Счастье: 2.5 в час днём, 1 ночью — за сутки без внимания около половины. */
const RATE = { satiety: [7, 3.5], happiness: [2.5, 1] } as const
export const HUNGRY = 45
const nightHour = (h: number) => h >= 23 || h < 7
function drain(p: Pet, from: number, to: number) {
  let t = Math.max(from, to - 14 * 864e5), s = p.satiety, h = p.happiness
  while (t < to && (s > 0 || h > 0)) {
    const d = new Date(t)
    const next = Math.min(to, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime())
    const hrs = (next - t) / 36e5, n = nightHour(d.getHours()) ? 1 : 0
    s -= RATE.satiety[n] * hrs
    h -= RATE.happiness[n] * hrs
    t = next
  }
  return { s: Math.max(0, s), h: Math.max(0, h) }
}
export function petNow(p: Pet, now = Date.now()): Pet {
  const at = p.at ? Date.parse(p.at) : NaN
  if (!(at < now)) return p
  const { s, h } = drain(p, at, now)
  return { ...p, satiety: Math.round(s * 10) / 10, happiness: Math.round(h * 10) / 10 }
}
// Через сколько часов кот проголодается (0 — уже голоден)
export function hoursToHungry(p: Pet, now = Date.now()) {
  if (p.satiety < HUNGRY) return 0
  let t = now
  while (t - now < 48 * 36e5) {
    t += 15 * 60000
    if (drain(p, now, t).s < HUNGRY) break
  }
  return (t - now) / 36e5
}

// owner — у кого купон (купил за свои монеты и может предъявить)
export interface MyCoupon { uid: number; id: string; name: string; icon: string; size: string; used?: boolean; owner?: Who }
export type Gender = 'f' | 'm'
export interface Profile { name: string; photo: string | null; ready?: boolean; g?: Gender }
export interface RoomPos { x: number; y: number; flip?: boolean }
export interface RoomState { pos: Record<string, RoomPos>; hidden: string[] }
// Настройки пары: заполняются при первом запуске, меняются в профиле
// cycleBy — кто из двоих ведёт календарь цикла
export interface Settings { since: string; meetBase: number; cycle: boolean; cycleBy?: Who }

interface Toast { text: string; icon: string; key: number }

interface Store {
  coins: Record<Who, number>
  earn(n: number, text?: string, icon?: string): void
  gift(n: number, text: string, icon?: string): void
  spend(n: number): boolean
  jar: Record<Who, number>
  addToJar(n: number): void
  pet: Pet
  setPet: Dispatch<SetStateAction<Pet>>
  owned: string[]
  own(id: string): void
  coupons: MyCoupon[]
  allCoupons: MyCoupon[]
  addCoupon(c: Omit<MyCoupon, 'uid'>): void
  useCoupon(uid: number): void
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  profile: Record<Who, Profile>
  setProfile: Dispatch<SetStateAction<Record<Who, Profile>>>
  room: RoomState
  setRoom: Dispatch<SetStateAction<RoomState>>
  meetings: Record<string, string>
  setMeetings: Dispatch<SetStateAction<Record<string, string>>>
  cycle: Record<string, CycleDay>
  setCycle: Dispatch<SetStateAction<Record<string, CycleDay>>>
  settings: Settings
  setSettings: Dispatch<SetStateAction<Settings>>
  daysTogether: number | null
  meetCount: number
  resetAll(): void
  toast(text: string, icon?: string): void
  shop: ShopTab | null
  openShop(tab?: ShopTab): void
  closeShop(): void
  go(tab: Tab, sub?: string): void
  tab: Tab
  sub: string
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('no store')
  return s
}

// ---------- Хранение ----------
// Каждый ключ — документ: копия на телефоне + облако (см. sync.ts)
export function usePersist<T>(key: string, init: T | (() => T)) {
  const v = useSyncExternalStore(cb => subscribe(key, cb), () => getView<T>(key, init))
  const set = useCallback((u: SetStateAction<T>) => {
    const cur = getView<T>(key, init)
    setDoc(key, typeof u === 'function' ? (u as (p: T) => T)(cur) : u)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return [v, set] as const
}

export const NEW_PET: Pet = { name: '', breed: 'domestic_ginger', stage: 'baby', level: 1, xp: 0, xpNext: 30, satiety: 60, happiness: 70, acc: null }

// Текст уведомления о действии партнёра
const TOUCH_NAME: Record<string, [string, string]> = {
  hug: ['обнимает тебя', 'touches/hug'], kiss: ['целует тебя', 'touches/kiss'], miss: ['скучает', 'touches/miss_you'],
  call: ['просит позвонить', 'touches/call_me'], proud: ['гордится тобой', 'touches/proud'],
  morning: ['желает доброго утра', 'touches/good_morning'], night: ['желает спокойной ночи', 'touches/good_night'],
}
export function describe(e: PairEvent, who: string, g: Gender = 'm'): { text: string; icon: string } | null {
  const p = e.payload as Record<string, string>
  const v = (m: string, f: string) => (g === 'f' ? f : m)
  switch (e.kind) {
    case 'touch': { const t = TOUCH_NAME[p.id]; return t ? { text: `${who} ${t[0]}`, icon: t[1] } : null }
    case 'photo': return { text: p.day && p.day < TODAY_KEY ? `${who} ${v('добавил', 'добавила')} фото за ${human(p.day)}` : `${who} ${v('выложил', 'выложила')} фото дня`, icon: 'common/camera' }
    case 'task_part': return { text: `${who} ${v('сделал', 'сделала')} свою часть «${p.title}» — отметь свою`, icon: 'common/check_cookie' }
    case 'task': return { text: `${who} ${v('закрыл', 'закрыла')} задачу «${p.title}»`, icon: 'common/check_cookie' }
    case 'meet': return { text: `${who} ${v('отметил', 'отметила')} встречу`, icon: 'meetings/meet_button' }
    case 'thanks': return { text: `${who}: спасибо — ${p.text}`, icon: 'talk/gratitude' }
    case 'coupon': return { text: `${who} ${v('предъявил', 'предъявила')} купон «${p.name}»`, icon: 'shop/coupons/coupon_used_stamp' }
    case 'mood': return { text: `${who} ${v('отметил', 'отметила')} настроение`, icon: 'calendar/mood/mood_' + p.mood }
    case 'coupon_buy': return { text: `${who} ${v('купил', 'купила')} твой купон «${p.name}»`, icon: 'shop/coupons/coupon_medium' }
    case 'cheat_ask': return { text: `${who} просит заполнить шпаргалку о себе`, icon: 'cheatsheet/suggest' }
    case 'wish': return { text: `${who} ${v('добавил', 'добавила')} желание «${p.title}»`, icon: 'wishlist/wishlist' }
    case 'place': return { text: p.status === 'been' ? `${who} ${v('отметил', 'отметила')} на карте: ${p.name}` : `${who} хочет с тобой сюда: ${p.name}`, icon: 'cheatsheet/dreams/dream_travel' }
    case 'joined': return { text: `${who} теперь с тобой в паре!`, icon: 'common/two_hearts' }
    default: return null
  }
}

function readHash(): { tab: Tab; sub: string; shop: ShopTab | null } {
  const [a = 'home', b = ''] = location.hash.slice(1).split('/')
  if (a === 'shop') return { tab: 'home', sub: '', shop: (b as ShopTab) || 'food' }
  const tabs: Tab[] = ['home', 'board', 'calendar', 'together', 'cheatsheet']
  return { tab: tabs.includes(a as Tab) ? (a as Tab) : 'home', sub: b, shop: null }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const init = useRef(readHash()).current
  const [tab, setTab] = useState<Tab>(init.tab)
  const [sub, setSub] = useState(init.sub)
  const [shop, setShop] = useState<ShopTab | null>(init.shop)
  const [settings, setSettings] = usePersist<Settings>('settings', { since: '', meetBase: 0, cycle: true })
  const [coins, setCoins] = usePersist<Record<Who, number>>('coins', { me: 0, him: 0 })
  const [jar, setJar] = usePersist<Record<Who, number>>('jar', { me: 0, him: 0 })
  const [rawPet, setRawPet] = usePersist<Pet>('pet', NEW_PET)
  // Пересчитываем сытость каждые 5 минут и при возвращении в приложение
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const t = setInterval(tick, 5 * 60000)
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  const pet = useMemo(() => petNow(rawPet, now), [rawPet, now])
  // Старые фото из базы — в хранилище файлов (в фоне, после того как подтянулись данные)
  useEffect(() => { const t = setTimeout(() => { moveImagesToFiles() }, 6000); return () => clearTimeout(t) }, [])
  // Любое изменение кота сначала доводит сытость и счастье до текущей минуты и ставит новую отметку
  const setPet = useCallback((u: SetStateAction<Pet>) => setRawPet(p => {
    const ts = Date.now(), cur = petNow(p, ts)
    const next = typeof u === 'function' ? (u as (x: Pet) => Pet)(cur) : u
    setNow(ts)
    return { ...next, at: new Date(ts).toISOString() }
  }), [setRawPet])
  // Кот, заведённый до этого обновления, начинает голодать с этой минуты
  useEffect(() => { if (rawPet.name && !rawPet.at) setPet(p => p) }, [rawPet.name, rawPet.at, setPet])
  const [owned, setOwned] = usePersist<string[]>('owned', [])
  const [coupons, setCoupons] = usePersist<MyCoupon[]>('coupons', [])
  const [tasks, setTasks] = usePersist<Task[]>('tasks', [])
  const [profile, setProfile] = usePersist<Record<Who, Profile>>('profile', { me: { name: '', photo: null }, him: { name: '', photo: null } })
  const [room, setRoom] = usePersist<RoomState>('room', { pos: {}, hidden: [] })
  const [meetings, setMeetings] = usePersist<Record<string, string>>('meetings', {})
  const [cycle, setCycle] = usePersist<Record<string, CycleDay>>('cycle', {})
  const [toastState, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    const h = shop ? `#shop/${shop}` : `#${tab}${sub ? '/' + sub : ''}`
    if (location.hash !== h) history.replaceState(null, '', h)
  }, [tab, sub, shop])

  useEffect(() => {
    const on = () => { const h = readHash(); setTab(h.tab); setSub(h.sub); setShop(h.shop); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    if (!toastState) return
    const t = setTimeout(() => setToast(null), 2300)
    return () => clearTimeout(t)
  }, [toastState])

  const toast = useCallback((text: string, icon = 'common/sparkle') => setToast({ text, icon, key: Date.now() }), [])

  // Что делает партнёр — прилетает сразу. Касания ещё и складываются во «входящие» на главной.
  const [, setInbox] = usePersist<PairEvent[]>('inbox', [])
  const hisG = profile.him.g ?? 'm'
  const hisName = profile.him.name || (hisG === 'f' ? 'Она' : 'Он')
  useEffect(() => {
    const take = (e: PairEvent) => {
      if (e.mine) return
      const m = describe(e, hisName, hisG)
      if (m) toast(m.text, m.icon)
      if (e.kind === 'touch') setInbox(xs => [...xs.filter(x => x.id !== e.id), e].slice(-30))
    }
    const off = onEvent(take)
    let seen = ''
    try { seen = localStorage.getItem('pair.seen') ?? '' } catch { /* нет доступа */ }
    if (seen) missedEvents(seen).then(es => es.filter(e => e.kind === 'touch').forEach(e => setInbox(xs => (xs.some(x => x.id === e.id) ? xs : [...xs, e].slice(-30)))))
    const mark = () => { try { localStorage.setItem('pair.seen', new Date().toISOString()) } catch { /* нет доступа */ } }
    mark()
    const onHide = () => { if (document.visibilityState === 'hidden') mark() }
    document.addEventListener('visibilitychange', onHide)
    return () => { off(); document.removeEventListener('visibilitychange', onHide) }
  }, [hisName, hisG, toast, setInbox])

  const levelUp = useCallback((gain: number) => {
    setPet(p => {
      let { xp, level, xpNext } = p
      xp += gain
      let grew = false
      while (xp >= xpNext) { xp -= xpNext; level += 1; xpNext = Math.round(xpNext * 1.15); grew = true }
      if (grew) setTimeout(() => toast(`${p.name}: уровень ${level}!`, 'pet/ui/level_badge'), 900)
      return { ...p, xp, level, xpNext, stage: level >= 10 ? 'adult' : p.stage }
    })
  }, [toast, setPet])

  const store: Store = {
    coins,
    earn(n, text, icon = 'coins/coin') {
      setCoins(c => ({ ...c, me: c.me + n }))
      levelUp(n)
      toast(text ?? `+${n}`, icon)
    },
    // Монеты без опыта для кота (стартовый подарок)
    gift(n, text, icon = 'coins/coin') {
      setCoins(c => ({ ...c, me: c.me + n }))
      toast(text, icon)
    },
    spend(n) {
      if (coins.me < n) { toast(`Не хватает ${n - coins.me} монет`, 'coins/wallet'); return false }
      setCoins(c => ({ ...c, me: c.me - n }))
      return true
    },
    jar,
    addToJar(n) {
      if (coins.me < n) { toast(`Не хватает ${n - coins.me} монет`, 'coins/wallet'); return }
      setCoins(c => ({ ...c, me: c.me - n }))
      setJar(j => ({ ...j, me: j.me + n }))
      toast(`−${n} в копилку`, 'coins/savings_jar_2')
    },
    pet, setPet,
    owned,
    own: id => setOwned(o => (o.includes(id) ? o : [...o, id])),
    coupons: coupons.filter(c => (c.owner ?? 'me') === 'me'),
    allCoupons: coupons,
    addCoupon: c => setCoupons(cs => [...cs, { owner: 'me', ...c, uid: Date.now() }]),
    useCoupon: uid => setCoupons(cs => cs.map(c => (c.uid === uid ? { ...c, used: true } : c))),
    tasks, setTasks,
    profile, setProfile,
    room, setRoom,
    meetings, setMeetings,
    cycle, setCycle,
    settings, setSettings,
    daysTogether: settings.since ? Math.max(0, diffDays(TODAY_KEY, settings.since)) : null,
    meetCount: settings.meetBase + Object.keys(meetings).filter(k => k <= TODAY_KEY).length,
    async resetAll() { if (cloud && getLink()) await signOut(); else resetLocal(); location.hash = ''; location.reload() },
    toast,
    shop,
    openShop: (t = 'food') => setShop(t),
    closeShop: () => setShop(null),
    go(t, s = '') { setShop(null); setTab(t); setSub(s); window.scrollTo(0, 0) },
    tab, sub,
  }

  return (
    <Ctx.Provider value={store}>
      {children}
      {toastState && (
        <div className="toast" key={toastState.key}>
          <img src={`assets/${toastState.icon}.webp`} alt="" />
          <span>{toastState.text}</span>
        </div>
      )}
    </Ctx.Provider>
  )
}
