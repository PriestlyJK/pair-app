import { HOBBIES, type HItem, type Hobby, type Tier } from './hobbies'

/* Хобби: у каждого своё дело, которое растёт за монеты.

   Мастерская: уровень 1–5 (картинка места меняется), на каждом уровне больше ячеек.
   В ячейку кладёшь заготовку (стоит монет) и ждёшь от 3 часов до 3 дней. Ничего не портится, напоминаний нет.
   Иногда выходит золотой вариант. Готовое: в альбом (засчитывается само), продать, подарить партнёру, обменять.

   Связь с партнёром:
   - подарки складываются у партнёра на «полку подарков»;
   - раз в день можно помочь его ячейке: время до готовности вдвое меньше и выше шанс на золото;
   - обмен: предлагаешь свою вещь за его, он соглашается или нет;
   - для некоторых вещей нужна вещь из другого хобби. Её можно получить от партнёра, сделать во втором хобби
     или купить на ярмарке — дороже, зато без тупика, если ни у кого из вас такого хобби нет.

   Документ 'hobby' — у каждого своя половина (me / him), пишет в неё только хозяин.
   Ключ вещи: 'хобби.вещь', золотая — 'хобби.вещь*'. */

export const MAX_LEVEL = 5
export const SLOTS = [0, 2, 3, 4, 5, 6] // ячеек на уровне
export const UPGRADE = [0, 150, 400, 900, 2000] // сколько стоит перейти с уровня i на i + 1
export const NEW_HOBBY = 1500 // второе и следующие хобби
export const TIER_LEVEL: Record<Tier, number> = { common: 1, rare: 2, special: 3, legend: 5 }
export const TIER_NAME: Record<Tier, string> = { common: 'обычная', rare: 'редкая', special: 'особая', legend: 'легенда' }
const STATS: Record<Tier, { hours: number[]; sell: number[] }> = {
  common: { hours: [3, 4, 5, 6, 8], sell: [14, 15, 16, 18, 20] },
  rare: { hours: [12, 16, 20, 24], sell: [55, 60, 65, 75] },
  special: { hours: [36, 48], sell: [150, 170] },
  legend: { hours: [72], sell: [450] },
}
export const GOLD_CHANCE = 0.06
export const GOLD_HELPED = 0.2
export const GOLD_MULT = 3

export interface Slot { item: string; at: number; end: number; helped?: boolean }
export interface Workshop { level: number; slots: (Slot | null)[] }
export interface Offer { id: number; give: string; want: string; state?: 'done' | 'back' }
export interface HobbyHalf {
  main?: string // первое хобби
  own?: Record<string, Workshop> // все мои хобби
  inv?: Record<string, number> // что лежит на складе
  album?: Record<string, number> // сколько всего сделано (для альбома)
  shelf?: Record<string, number> // что подарил партнёр
  sets?: Record<string, 1> // забранные награды альбома
  helps?: { id: number; hobby: string; slot: number }[] // кому из ячеек партнёра я помог(ла)
  helpDay?: string
  sent?: { id: number; key: string }[] // мои подарки партнёру
  got?: number[] // какие подарки партнёра я уже забрал(а)
  offers?: Offer[] // мои предложения обмена
  answers?: Record<string, 'yes' | 'no'> // мои ответы на его предложения
  made?: number
}
export type HobbyDoc = Partial<Record<'me' | 'him', HobbyHalf>>

export const hobbyOf = (id: string) => HOBBIES.find(h => h.id === id)!
export const A = (h: string, f: string) => `hobby/${h}/${f}`
export const stageImg = (h: string, level: number) => A(h, `stage_${Math.min(MAX_LEVEL, Math.max(1, level))}`)

// Ключи вещей
export const keyOf = (h: string, item: string, gold = false) => `${h}.${item}${gold ? '*' : ''}`
export function parseKey(k: string) {
  const gold = k.endsWith('*')
  const [h, item] = (gold ? k.slice(0, -1) : k).split('.')
  const hobby = hobbyOf(h)
  return { h, id: item, gold, hobby, item: hobby?.items.find(x => x.id === item) as HItem | undefined }
}
export const isKnown = (k: string) => !!parseKey(k).item

// Цифры вещи: время, цена заготовки, цена продажи
export function statsOf(hobby: Hobby, item: HItem): { hours: number; sell: number; cost: number } {
  const same = hobby.items.filter(x => x.tier === item.tier)
  const i = same.indexOf(item)
  const st = STATS[item.tier]
  const hours = st.hours[Math.min(i, st.hours.length - 1)]
  const base = st.sell[Math.min(i, st.sell.length - 1)]
  // Вещь с чужим ингредиентом стоит дороже на цену ингредиента: так её выгодно делать и с подарком, и с покупкой на ярмарке
  const sell: number = base + (item.need ? sellPrice(item.need) : 0)
  return { hours, sell, cost: Math.round(base * 0.4) }
}
export const sellPrice = (k: string): number => {
  const p = parseKey(k)
  if (!p.item) return 0
  const n = statsOf(p.hobby, p.item).sell
  return p.gold ? n * GOLD_MULT : n
}
// Ярмарка: вещь из чужого хобби, нужная для рецепта. Дороже, чем получить от партнёра.
export const FAIR_KEYS = [...new Set(HOBBIES.flatMap(h => h.items.map(x => x.need).filter(Boolean) as string[]))]
export const fairPrice = (k: string) => Math.round(sellPrice(k) * 1.5)

export const slotCount = (w: Workshop) => SLOTS[w.level] ?? 2
export const newWorkshop = (): Workshop => ({ level: 1, slots: [null, null] })

// Сколько ещё ждать (с учётом помощи партнёра, которую хозяин уже применил к ячейке)
export const leftMs = (s: Slot, now: number) => Math.max(0, s.end - now)
export const isReady = (s: Slot, now: number) => now >= s.end
export function leftText(ms: number) {
  const m = Math.ceil(ms / 60000)
  if (m < 60) return `${m} мин`
  const h = Math.floor(m / 60), mm = m % 60
  if (h < 24) return mm ? `${h} ч ${mm} мин` : `${h} ч`
  const d = Math.floor(h / 24), hh = h % 24
  return hh ? `${d} д ${hh} ч` : `${d} д`
}
// Картинка ячейки в работе: первая половина срока — первая картинка процесса, потом вторая
export function slotImg(h: Hobby, s: Slot, now: number) {
  if (isReady(s, now) && h.items.some(x => x.id === s.item)) return A(h.id, s.item)
  const part = (now - s.at) / Math.max(1, s.end - s.at)
  return A(h.id, part < 0.5 ? h.process[0] : h.process[1])
}

export const count = (half: HobbyHalf | undefined, k: string) => half?.inv?.[k] ?? 0
export const add = (m: Record<string, number> | undefined, k: string, n = 1) => {
  const v = (m?.[k] ?? 0) + n
  const out = { ...(m ?? {}) }
  if (v > 0) out[k] = v
  else delete out[k]
  return out
}
// Для рецепта годится и обычная, и золотая вещь — сначала тратим обычную
export function ingredientKey(half: HobbyHalf | undefined, need: string) {
  if (count(half, need) > 0) return need
  if (count(half, need + '*') > 0) return need + '*'
  return null
}

// Альбом: наборы и награды
export interface AlbumSet { id: string; name: string; keys: string[]; coins: number }
export function albumSets(h: Hobby): AlbumSet[] {
  const k = (x: HItem, gold = false) => keyOf(h.id, x.id, gold)
  return [
    { id: 'common', name: 'Все обычные', keys: h.items.filter(x => x.tier === 'common').map(x => k(x)), coins: 40 },
    { id: 'rare', name: 'Все редкие', keys: h.items.filter(x => x.tier === 'rare').map(x => k(x)), coins: 120 },
    { id: 'all', name: 'Весь альбом', keys: h.items.map(x => k(x)), coins: 300 },
    { id: 'gold', name: 'Всё золотое', keys: h.items.map(x => k(x, true)), coins: 1000 },
  ]
}
export const albumDone = (half: HobbyHalf | undefined, h: Hobby) => {
  const keys = h.items.flatMap(x => [keyOf(h.id, x.id), keyOf(h.id, x.id, true)])
  return { got: keys.filter(k => (half?.album?.[k] ?? 0) > 0).length, total: keys.length }
}
export const goldCount = (half: HobbyHalf | undefined) => Object.entries(half?.album ?? {}).filter(([k, n]) => k.endsWith('*') && n > 0).length
