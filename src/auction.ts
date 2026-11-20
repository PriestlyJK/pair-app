import type { Who } from './data'
import { thisWeek } from './game'

/* Аукцион недели. Лоты придумываете вы сами: каждый может предложить до трёх в неделю —
   что-то приятное, что проигравший сделает для победителя. Готового списка нет: каждая неделя начинается пустой.
   Ставки закрытые: монеты списываются сразу и лежат «в конверте». До конца недели ставку можно поднять или забрать.
   Партнёр видит, что ты поставил(а) на лот, но не видит сколько.
   В понедельник итоги за прошлую неделю: у кого ставка больше, тот получает лот купоном
   (его исполняет проигравший), а проигравшему монеты возвращаются. Ничья — монеты возвращаются обоим.

   Документ 'auction' — у каждого своя половина (me / him), пишет в неё только хозяин:
   weeks — по неделям твои лоты и твои ставки (на любые лоты недели), done — до какой недели итоги подведены. */

export interface Lot { id: string; name: string; icon: string }
export interface WeekLot extends Lot { by: Who }

// Картинки для лотов — из уже нарисованных
export const LOT_ICONS = [
  'common/gift', 'touches/hug', 'touches/kiss', 'shop/coupons/cpn_massage', 'shop/coupons/cpn_breakfast', 'cheatsheet/food/food_sushi',
  'cheatsheet/food/food_coffee', 'cheatsheet/food/food_sweets', 'cheatsheet/food/food_snacks', 'cheatsheet/food/food_drinks', 'watchlist/movie', 'cheatsheet/tastes/taste_games',
  'cheatsheet/tastes/taste_music', 'touches/call_me', 'memory/letter', 'meetings/meet_place', 'cheatsheet/gifts/gift_flowers', 'tracker/type_wish',
]
export const MAX_LOTS = 3 // сколько лотов в неделю может предложить каждый
export const MIN_BID = 10

// Размер купона за выигранный лот — по ставке, как у обычных купонов
export const couponSize = (n: number) => (n >= 500 ? 'large' : n >= 150 ? 'medium' : 'small')

export interface AucWeek { wk: string; bids: Record<string, number>; lots?: Lot[] }
export interface AucRec { weeks?: AucWeek[]; done?: string; wins?: number }
export type Auction = Partial<Record<Who, AucRec>>

const weekOf = (r: AucRec | undefined, wk: string) => r?.weeks?.find(w => w.wk === wk)
export const bidsIn = (r: AucRec | undefined, wk: string): Record<string, number> => weekOf(r, wk)?.bids ?? {}
export const lotsIn = (r: AucRec | undefined, wk: string): Lot[] => weekOf(r, wk)?.lots ?? []
// Лоты, которые придумали вы. Первая версия аукциона ставила свои готовые лоты со словами вместо id.
export const isLotId = (id: string) => id.startsWith('lot-')

// Все лоты недели: твои и партнёра, по порядку добавления
export function lotsOf(a: Auction, wk: string): WeekLot[] {
  const mine = lotsIn(a.me, wk).map(l => ({ ...l, by: 'me' as Who }))
  const his = lotsIn(a.him, wk).map(l => ({ ...l, by: 'him' as Who }))
  return [...mine, ...his].sort((x, y) => x.id.localeCompare(y.id))
}

// Меняем свою запись за неделю. Храним текущую и три прошлые недели.
function updWeek(r: AucRec = {}, wk: string, f: (w: AucWeek) => AucWeek): AucRec {
  const cur = weekOf(r, wk) ?? { wk, bids: {} }
  const weeks = (r.weeks ?? []).filter(w => w.wk !== wk).slice(-3)
  return { ...r, weeks: [...weeks, f(cur)].sort((x, y) => x.wk.localeCompare(y.wk)) }
}
export const withBid = (r: AucRec | undefined, lot: string, add: number, wk = thisWeek()) =>
  updWeek(r, wk, w => ({ ...w, bids: { ...w.bids, [lot]: (w.bids[lot] ?? 0) + add } }))
// Забрать ставку (монеты возвращает вызывающий)
export const withoutBid = (r: AucRec | undefined, lot: string, wk = thisWeek()) =>
  updWeek(r, wk, w => ({ ...w, bids: Object.fromEntries(Object.entries(w.bids).filter(([id]) => id !== lot)) }))
export const withLot = (r: AucRec | undefined, lot: Lot, wk = thisWeek()) =>
  updWeek(r, wk, w => ({ ...w, lots: [...(w.lots ?? []), lot] }))
export const withoutLot = (r: AucRec | undefined, id: string, wk = thisWeek()) =>
  updWeek(r, wk, w => ({ ...w, lots: (w.lots ?? []).filter(l => l.id !== id) }))

// Твои лоты прошлых недель — чтобы предложить их снова одним нажатием
export function recentLots(r: AucRec | undefined, wk = thisWeek()): Lot[] {
  const now = new Set(lotsIn(r, wk).map(l => l.name))
  const out: Lot[] = []
  for (const w of [...(r?.weeks ?? [])].reverse()) {
    if (w.wk === wk) continue
    for (const l of w.lots ?? []) if (!now.has(l.name) && !out.some(x => x.name === l.name)) out.push(l)
  }
  return out.slice(0, 6)
}

export interface LotResult { lot: WeekLot; me: number; him: number; win: Who | 'tie' | null }
export function resultsOf(a: Auction, wk: string): LotResult[] {
  const mine = bidsIn(a.me, wk), his = bidsIn(a.him, wk)
  return lotsOf(a, wk).map(lot => {
    const m = mine[lot.id] ?? 0, h = his[lot.id] ?? 0
    const win: LotResult['win'] = !m && !h ? null : m === h ? 'tie' : m > h ? 'me' : 'him'
    return { lot, me: m, him: h, win }
  })
}

// Недели, по которым у меня есть ставки и итоги ещё не подведены (неделя уже закончилась)
export function unsettled(a: Auction, now = thisWeek()): string[] {
  const done = a.me?.done ?? ''
  return (a.me?.weeks ?? []).map(w => w.wk).filter(wk => wk < now && wk > done && Object.keys(bidsIn(a.me, wk)).length > 0).sort()
}
