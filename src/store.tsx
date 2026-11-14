import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { TASKS, type Task, type Who } from './data'
import type { CycleDay } from './dates'

// Общее состояние приложения. Пока хранится в этом браузере (localStorage), потом переедет в Supabase.

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
}

export interface MyCoupon { uid: number; id: string; name: string; icon: string; size: string; used?: boolean }
export interface Profile { name: string; photo: string | null }
export interface RoomPos { x: number; y: number; flip?: boolean }
export interface RoomState { pos: Record<string, RoomPos>; hidden: string[] }

interface Toast { text: string; icon: string; key: number }

interface Store {
  coins: Record<Who, number>
  earn(n: number, text?: string, icon?: string): void
  spend(n: number): boolean
  jar: Record<Who, number>
  addToJar(n: number): void
  pet: Pet
  setPet: Dispatch<SetStateAction<Pet>>
  owned: string[]
  own(id: string): void
  coupons: MyCoupon[]
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

// ---------- Хранение в браузере ----------
const PREFIX = 'pair.v1.'
export function usePersist<T>(key: string, init: T | (() => T)) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw != null) return JSON.parse(raw) as T
    } catch { /* приватный режим или битые данные: берём начальные */ }
    return typeof init === 'function' ? (init as () => T)() : init
  })
  useEffect(() => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(v)) } catch { /* место кончилось — живём в памяти */ }
  }, [key, v])
  return [v, setV] as const
}
function clearPersist() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
  } catch { /* нечего чистить */ }
}

// Пример данных цикла: месячные в октябре и ноябре, остальное приложение считает само
const FLOW5 = ['flow_medium', 'flow_heavy', 'flow_heavy', 'flow_medium', 'flow_light']
const CYCLE_SEED: Record<string, CycleDay> = {
  ...Object.fromEntries(FLOW5.map((f, i) => [`2026-10-${String(6 + i).padStart(2, '0')}`, { flow: f }])),
  ...Object.fromEntries(FLOW5.map((f, i) => [`2026-11-0${3 + i}`, { flow: f }])),
  '2026-11-04': { flow: 'flow_heavy', sym: ['sym_cramps', 'sym_energy'] },
  '2026-11-01': { sex: 'sex_protected' },
  '2026-11-08': { sex: 'sex_protected' },
}
const MEET_SEED: Record<string, string> = {
  '2026-10-18': 'Выходные у него',
  '2026-11-01': 'Кофейня и прогулка по набережной',
  '2026-11-08': 'Кино и ужин',
  '2026-11-28': 'Он приезжает на выходные',
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
  const [coins, setCoins] = usePersist<Record<Who, number>>('coins', { me: 186, him: 142 })
  const [jar, setJar] = usePersist<Record<Who, number>>('jar', { me: 720, him: 520 })
  const [pet, setPet] = usePersist<Pet>('pet', { name: 'Персик', breed: 'domestic_ginger', stage: 'baby', level: 4, xp: 32, xpNext: 60, satiety: 70, happiness: 85, acc: 'scarf' })
  const [owned, setOwned] = usePersist<string[]>('owned', ['rug', 'bed', 'curtains', 'plant', 'frame', 'toybasket', 'ball', 'scarf', 'bow'])
  const [coupons, setCoupons] = usePersist<MyCoupon[]>('coupons', [
    { uid: 1, id: 'c1', name: 'Я выбираю фильм', icon: 'watchlist/movie', size: 'small' },
    { uid: 2, id: 'c2', name: 'Массаж 30 минут при встрече', icon: 'shop/coupons/cpn_massage', size: 'medium', used: true },
  ])
  const [tasks, setTasks] = usePersist<Task[]>('tasks', TASKS)
  const [profile, setProfile] = usePersist<Record<Who, Profile>>('profile', { me: { name: '', photo: null }, him: { name: '', photo: null } })
  const [room, setRoom] = usePersist<RoomState>('room', { pos: {}, hidden: [] })
  const [meetings, setMeetings] = usePersist<Record<string, string>>('meetings', MEET_SEED)
  const [cycle, setCycle] = usePersist<Record<string, CycleDay>>('cycle', CYCLE_SEED)
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
    coupons,
    addCoupon: c => setCoupons(cs => [...cs, { ...c, uid: Date.now() }]),
    useCoupon: uid => setCoupons(cs => cs.map(c => (c.uid === uid ? { ...c, used: true } : c))),
    tasks, setTasks,
    profile, setProfile,
    room, setRoom,
    meetings, setMeetings,
    cycle, setCycle,
    resetAll() { clearPersist(); try { indexedDB.deleteDatabase('pair-photos') } catch { /* нет базы */ } location.hash = ''; location.reload() },
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
