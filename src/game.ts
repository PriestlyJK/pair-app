import { addDays, diffDays, dkey, weekStart } from './dates'
import type { Who } from './data'
import { cloud, getLink } from './sync'

/* Игра недели: колесо дня и корона.
   Документ 'game' — у каждого своя половина (me / him), пишет в неё только хозяин.

   Корона: счёт — монеты, заработанные с понедельника по воскресенье (траты не считаются).
   Кто заработал больше за прошлую неделю, всю эту неделю носит корону на аватарке и один раз получает бонус.

   Колесо: одна прокрутка в день, пропущенные копятся до трёх. Приз выбирается до анимации и сразу
   записывается как «невыданный» (spin): если закрыть приложение посреди прокрутки, приз выдастся при следующем входе. */

export type PrizeId = 'c5' | 'feed' | 'c10' | 'luck' | 'c25' | 'gift' | 'coupon' | 'c100'

export interface GameRec {
  wk?: string // понедельник недели, за которую считается n
  n?: number // заработано за неделю wk
  prev?: { wk: string; n: number } // предыдущая неделя
  crown?: string // за какую неделю бонус короны уже получен
  at?: string // день, на который посчитано left
  left?: number // сколько прокруток оставалось в день at
  spin?: { id: number; prize: PrizeId } // выпал, но ещё не выдан
  feed?: number // призы в запасе: бесплатная еда,
  coupon?: number // купон даром,
  luck?: number // ×2 на следующую задачу
  crowns?: number // сколько раз носил корону (для ачивки)
  spins?: number // сколько раз крутил колесо (для ачивки)
  jack?: boolean // выбивал джекпот
}
export type Game = Partial<Record<Who, GameRec>>

// Монеты, которые колесо подарило партнёру: он забирает их сам, когда откроет приложение
export interface CoinGift { id: number; by: Who; n: number; got?: boolean }

// Корона имеет смысл, когда есть с кем соревноваться (или при проверке без облака)
export const gameOn = () => !!getLink() || !cloud
// Колесо крутится прямо сейчас — приз выдаст оно само, когда остановится
export const wheel = { spinning: false }

export const today = () => dkey(new Date())
export const thisWeek = () => weekStart(today())
export const lastWeek = () => addDays(thisWeek(), -7)

export function earnedIn(r: GameRec | undefined, wk: string) {
  if (!r) return 0
  if (r.wk === wk) return r.n ?? 0
  if (r.prev?.wk === wk) return r.prev.n
  return 0
}

export function addEarned(r: GameRec = {}, n: number, wk = thisWeek()): GameRec {
  if (r.wk === wk) return { ...r, n: (r.n ?? 0) + n }
  return { ...r, wk, n, prev: r.wk ? { wk: r.wk, n: r.n ?? 0 } : r.prev }
}

// У кого корона на этой неделе (по итогам прошлой). Ничья — у обоих.
export function crowned(g: Game): Who[] {
  const wk = lastWeek(), a = earnedIn(g.me, wk), b = earnedIn(g.him, wk)
  if (!a && !b) return []
  return a > b ? ['me'] : b > a ? ['him'] : ['me', 'him']
}

export const CROWN_BONUS = 30
export const MAX_SPINS = 3
export const GIFT_COINS = 15
// Купон даром — любой, кроме больших
export const FREE_COUPON_MAX = 499

export function spinsLeft(r: GameRec | undefined, day = today()) {
  if (!r?.at) return 1
  return Math.min(MAX_SPINS, (r.left ?? 0) + Math.max(0, diffDays(day, r.at)))
}

export interface Prize { id: PrizeId; label: string; icon: string; w: number; coins?: number }
// Порядок — по кругу колеса, по часовой стрелке от верха. Золотой сектор на картинке — пятый (внизу), это джекпот.
export const PRIZES: Prize[] = [
  { id: 'c5', label: '+5', icon: 'coins/coin', w: 24, coins: 5 },
  { id: 'feed', label: 'Еда', icon: 'shop/food/bowl_basic', w: 14 },
  { id: 'c10', label: '+10', icon: 'coins/coin_stack_s', w: 18, coins: 10 },
  { id: 'luck', label: '×2', icon: 'game/clover', w: 9 },
  { id: 'c100', label: '+100', icon: 'game/jackpot', w: 2, coins: 100 },
  { id: 'gift', label: 'Подарок', icon: 'common/gift', w: 10 },
  { id: 'coupon', label: 'Купон', icon: 'shop/coupons/coupon_small', w: 5 },
  { id: 'c25', label: '+25', icon: 'coins/coin_stack_l', w: 10, coins: 25 },
]
// Границы секторов на картинке колеса (градусы по часовой от верха): нарисованы от руки, не ровно по 45°
export const EDGES = [-22, 21, 68, 111, 155, 202, 248, 292, 338]
export const sectorMid = (i: number) => (EDGES[i] + EDGES[i + 1]) / 2
export const sectorHalf = (i: number) => (EDGES[i + 1] - EDGES[i]) / 2
export const prizeOf = (id: PrizeId) => PRIZES.find(p => p.id === id)!

export function rollPrize(): PrizeId {
  const total = PRIZES.reduce((a, p) => a + p.w, 0)
  let r = Math.random() * total
  for (const p of PRIZES) { r -= p.w; if (r < 0) return p.id }
  return PRIZES[0].id
}
