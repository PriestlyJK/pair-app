import type { Who } from './data'
import { thisWeek } from './game'

/* Аукцион недели. Каждую неделю — три лота: приятные дела из жизни.
   Ставки закрытые: монеты списываются сразу и лежат «в конверте», ставку можно поднять или забрать до конца недели.
   Партнёр видит, что ты поставил(а) на лот, но не видит сколько.
   В понедельник итоги за прошлую неделю: у кого ставка больше, тот получает лот купоном
   (его исполняет проигравший), а проигравшему монеты возвращаются. Ничья — монеты возвращаются обоим.

   Документ 'auction' — у каждого своя половина (me / him), пишет в неё только хозяин:
   weeks — ставки за последние недели, done — до какой недели итоги уже подведены. */

export interface Lot { id: string; name: string; icon: string }
export const LOTS: Lot[] = [
  { id: 'breakfast', name: 'Завтрак в постель', icon: 'shop/coupons/cpn_breakfast' },
  { id: 'massage', name: 'Массаж 20 минут', icon: 'shop/coupons/cpn_massage' },
  { id: 'movie', name: 'Выбор фильма на вечер', icon: 'watchlist/movie' },
  { id: 'coffee', name: 'Кофе с доставкой', icon: 'cheatsheet/food/food_coffee' },
  { id: 'sweets', name: 'Сладкий сюрприз', icon: 'cheatsheet/food/food_sweets' },
  { id: 'dinner', name: 'Выбор ужина', icon: 'cheatsheet/food/food_sushi' },
  { id: 'flowers', name: 'Букет цветов', icon: 'cheatsheet/gifts/gift_flowers' },
  { id: 'call', name: 'Звонок до самого сна', icon: 'touches/call_me' },
  { id: 'letter', name: 'Письмо от руки', icon: 'memory/letter' },
  { id: 'playlist', name: 'Плейлист в подарок', icon: 'cheatsheet/tastes/taste_music' },
  { id: 'games', name: 'Выбор игры на вечер', icon: 'cheatsheet/tastes/taste_games' },
  { id: 'date', name: 'Свидание под ключ', icon: 'meetings/meet_place' },
  { id: 'wish', name: 'Маленькое желание', icon: 'tracker/type_wish' },
  { id: 'snacks', name: 'Вкусняшки к фильму', icon: 'cheatsheet/food/food_snacks' },
]
export const LOTS_PER_WEEK = 3
export const MIN_BID = 10

export interface AucWeek { wk: string; bids: Record<string, number> }
export interface AucRec { weeks?: AucWeek[]; done?: string; wins?: number }
export type Auction = Partial<Record<Who, AucRec>>

// Лоты недели одинаковые у обоих: перемешиваем список по ключу недели
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function lotsOf(wk: string): Lot[] {
  const a = [...LOTS]
  let h = hash('auction:' + wk)
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, LOTS_PER_WEEK)
}

// Размер купона за выигранный лот — по ставке, как у обычных купонов
export const couponSize = (n: number) => (n >= 500 ? 'large' : n >= 150 ? 'medium' : 'small')

export const bidsIn = (r: AucRec | undefined, wk: string): Record<string, number> => r?.weeks?.find(w => w.wk === wk)?.bids ?? {}

// Поднять ставку на лот этой недели. Храним текущую и три прошлые недели.
export function withBid(r: AucRec = {}, lot: string, add: number, wk = thisWeek()): AucRec {
  const cur = bidsIn(r, wk)
  const weeks = (r.weeks ?? []).filter(w => w.wk !== wk).slice(-3)
  return { ...r, weeks: [...weeks, { wk, bids: { ...cur, [lot]: (cur[lot] ?? 0) + add } }] }
}

// Забрать ставку с лота этой недели (монеты возвращает вызывающий)
export function withoutBid(r: AucRec = {}, lot: string, wk = thisWeek()): AucRec {
  const { [lot]: _gone, ...rest } = bidsIn(r, wk)
  void _gone
  return { ...r, weeks: (r.weeks ?? []).map(w => (w.wk === wk ? { wk, bids: rest } : w)) }
}

export interface LotResult { lot: Lot; me: number; him: number; win: Who | 'tie' | null }
export function resultsOf(a: Auction, wk: string): LotResult[] {
  const mine = bidsIn(a.me, wk), his = bidsIn(a.him, wk)
  return lotsOf(wk).map(lot => {
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
