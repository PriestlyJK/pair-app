import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Bar, plural } from '../ui'
import type { Who } from '../data'
import { usePhotos } from '../photos'
import type { Wish, Goal, Bet, Thanks } from './TogetherSections'
import type { Place } from './Places'
import type { DEntry } from './DiaryCard'
import type { WItem } from './Together'
import type { Auction } from '../auction'

/* Ачивки по ступеням: бронза → серебро → золото → алмаз. За каждую ступень — монеты.
   Достигнута ли ступень, считается из ваших данных. Забранные награды у каждого свои:
   документ 'ach' = { me: { [id]: сколько ступеней уже забрано } }, пишет в свою половину только хозяин.
   Монеты за ачивки не идут в счёт короны недели: иначе старые ачивки решили бы первую корону. */

export type Tier = 'bronze' | 'silver' | 'gold' | 'diamond'
export const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'diamond']
export const TIER_NAME: Record<Tier, string> = { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', diamond: 'Алмаз' }
export const TIER_COINS = [10, 25, 50, 100]
export const SPECIAL_COINS = 30
// Алмазная ступень появится, когда будет нарисована её рамка (achievements/frame_diamond)
const DIAMOND = false
const TIER_N = DIAMOND ? 4 : 3

type Steps = [number, number, number, number]
interface Track { id: string; name: string; icon: string; steps: Steps; what: (n: number) => string }
const p = (a: string, b: string, c: string) => (n: number) => `${n} ${plural(n, a, b, c)}`

export const TRACKS: Track[] = [
  { id: 'meet', name: 'Встречи', icon: 'meetings/meet_button', steps: [1, 10, 25, 50], what: p('встреча', 'встречи', 'встреч') },
  { id: 'days', name: 'Дни вместе', icon: 'memory/days_together', steps: [30, 100, 365, 1000], what: p('день', 'дня', 'дней') },
  { id: 'tasks', name: 'Задачи', icon: 'common/check_cookie', steps: [1, 25, 100, 300], what: p('задача закрыта', 'задачи закрыто', 'задач закрыто') },
  { id: 'photo', name: 'Фото дня', icon: 'common/camera', steps: [3, 7, 30, 100], what: n => `${n} ${plural(n, 'день', 'дня', 'дней')} подряд вдвоём` },
  { id: 'touch', name: 'Касания', icon: 'touches/hug', steps: [10, 100, 500, 2000], what: p('касание', 'касания', 'касаний') },
  { id: 'movies', name: 'Киноклуб', icon: 'watchlist/status_watched', steps: [1, 5, 20, 50], what: p('фильм вместе', 'фильма вместе', 'фильмов вместе') },
  { id: 'match', name: 'Совпадения', icon: 'watchlist/randomizer', steps: [1, 5, 20, 50], what: p('совпадение в «Подборе»', 'совпадения в «Подборе»', 'совпадений в «Подборе»') },
  { id: 'diary', name: 'Дневник', icon: 'diary/diary', steps: [1, 10, 50, 150], what: p('запись', 'записи', 'записей') },
  { id: 'places', name: 'Путешественники', icon: 'cheatsheet/dreams/dream_travel', steps: [1, 5, 15, 30], what: p('место на карте, где были', 'места на карте, где были', 'мест на карте, где были') },
  { id: 'thanks', name: 'Благодарности', icon: 'talk/gratitude', steps: [1, 10, 50, 150], what: p('«спасибо»', '«спасибо»', '«спасибо»') },
  { id: 'bucket', name: 'Мечты сбываются', icon: 'bucket/bucket', steps: [1, 3, 10, 25], what: p('мечта сбылась', 'мечты сбылись', 'мечт сбылось') },
  { id: 'gifts', name: 'Подарки', icon: 'wishlist/gifted', steps: [1, 3, 10, 25], what: p('желание исполнено', 'желания исполнено', 'желаний исполнено') },
  { id: 'bets', name: 'Споры', icon: 'bets/bet', steps: [1, 5, 15, 30], what: p('спор', 'спора', 'споров') },
  { id: 'challenges', name: 'Челленджи', icon: 'challenges/challenge', steps: [1, 3, 10, 25], what: p('челлендж пройден', 'челленджа пройдено', 'челленджей пройдено') },
  { id: 'pet', name: 'Питомец растёт', icon: 'pet/ui/level_badge', steps: [3, 5, 10, 20], what: n => `${n} уровень` },
  { id: 'crown', name: 'Корона недели', icon: 'game/crown', steps: [1, 4, 12, 26], what: p('корона у тебя', 'короны у тебя', 'корон у тебя') },
  { id: 'wheel', name: 'Колесо дня', icon: 'game/wheel_icon', steps: [7, 30, 100, 365], what: p('прокрутка', 'прокрутки', 'прокруток') },
  { id: 'auction', name: 'Аукцион', icon: 'game/gavel', steps: [1, 5, 15, 40], what: p('лот выигран', 'лота выиграно', 'лотов выиграно') },
]

interface Special { id: string; name: string; icon: string; hint: string }
export const SPECIALS: Special[] = [
  { id: 'newpet', name: 'Новый питомец', icon: 'pet/selection/basket_open', hint: 'Заведите питомца' },
  { id: 'epic', name: 'Покорили вершину', icon: 'tracker/type_epic', hint: 'Закройте эпик' },
  { id: 'clean', name: 'Без хвостов', icon: 'tracker/sprint_start', hint: 'Закройте все задачи недели (от 3 штук)' },
  { id: 'jackpot', name: 'Джекпот', icon: 'game/jackpot', hint: 'Выбейте +100 на колесе' },
  { id: 'pet2', name: 'Нас стало больше', icon: 'shop/coupons/second_pet', hint: 'Накопите на второго питомца' },
  { id: 'hands', name: 'За руку', icon: 'common/two_hearts', hint: 'Подержитесь за руки в комнате, когда оба в приложении' },
]

type Paid = Partial<Record<Who, Record<string, number>>>

export interface TrackState extends Track { val: number; reached: number; paid: number; due: number }
export interface SpecialState extends Special { done: boolean; due: number }

export function useAchievements() {
  const s = useStore()
  const [wishes] = usePersist<Wish[]>('wishes', [])
  const [goals] = usePersist<Goal[]>('bucket', [])
  const [bets] = usePersist<Bet[]>('bets', [])
  const [thanks] = usePersist<Thanks[]>('thanks', [])
  const [watch] = usePersist<WItem[]>('watchlist', [])
  const [places] = usePersist<Place[]>('places', [])
  const [diary] = usePersist<DEntry[]>('diary', [])
  const [challenges] = usePersist<{ claimed?: boolean }[]>('challenges', [])
  const [sent] = usePersist<Record<Who, Record<string, number>>>('sent', { me: {}, him: {} })
  const [auction] = usePersist<Auction>('auction', {})
  const [paidAll, setPaidAll] = usePersist<Paid>('ach', {})
  const ph = usePhotos()
  const paid = paidAll.me ?? {}

  const doneTasks = s.tasks.filter(t => t.status === 'done')
  const week = s.tasks.filter(t => t.status !== 'backlog')
  const sum = (o?: Record<string, number>) => Object.values(o ?? {}).reduce((a, n) => a + (n || 0), 0)
  const me = s.game.me ?? {}

  const vals: Record<string, number> = {
    meet: s.meetCount,
    days: s.daysTogether ?? 0,
    tasks: doneTasks.length,
    photo: ph.best,
    touch: sum(sent.me) + sum(sent.him),
    movies: watch.filter(w => w.status === 'watched').length,
    match: watch.filter(w => w.tmdb && w.votes.me === 'want' && w.votes.him === 'want').length,
    diary: diary.length,
    places: places.filter(x => x.status === 'been').length,
    thanks: thanks.length,
    bucket: goals.filter(g => g.done).length,
    gifts: wishes.filter(w => w.gifted).length,
    bets: bets.length,
    challenges: challenges.filter(c => c.claimed).length,
    pet: s.pet.name ? s.pet.level : 0,
    crown: me.crowns ?? 0,
    wheel: me.spins ?? 0,
    auction: auction.me?.wins ?? 0,
  }
  const specialDone: Record<string, boolean> = {
    newpet: !!s.pet.name,
    epic: doneTasks.some(t => t.type === 'epic'),
    clean: week.length >= 3 && week.every(t => t.status === 'done'),
    jackpot: !!me.jack,
    pet2: s.jar.me + s.jar.him >= 4000,
    hands: !!me.hands,
  }

  const tracks: TrackState[] = TRACKS.map(t => {
    const val = vals[t.id] ?? 0
    const got = paid[t.id] ?? 0
    // Ступень, однажды забранная, остаётся, даже если число потом уменьшилось
    const reached = Math.max(Math.min(got, TIER_N), t.steps.slice(0, TIER_N).filter(n => val >= n).length)
    let due = 0
    for (let i = got; i < reached; i++) due += TIER_COINS[i]
    return { ...t, val, reached, paid: got, due }
  })
  const specials: SpecialState[] = SPECIALS.map(x => {
    const got = (paid[x.id] ?? 0) > 0
    const done = got || !!specialDone[x.id]
    return { ...x, done, due: done && !got ? SPECIAL_COINS : 0 }
  })

  const due = tracks.reduce((a, t) => a + t.due, 0) + specials.reduce((a, x) => a + x.due, 0)
  const steps = tracks.reduce((a, t) => a + t.reached, 0) + specials.filter(x => x.done).length
  const total = TRACKS.length * TIER_N + SPECIALS.length

  // Забрать награды: одну ачивку или все сразу
  function claim(ids?: string[]) {
    const ts = tracks.filter(t => t.due && (!ids || ids.includes(t.id)))
    const xs = specials.filter(x => x.due && (!ids || ids.includes(x.id)))
    const n = ts.reduce((a, t) => a + t.due, 0) + xs.reduce((a, x) => a + x.due, 0)
    if (!n) return
    setPaidAll(v => {
      const mine = { ...(v.me ?? {}) }
      ts.forEach(t => { mine[t.id] = t.reached })
      xs.forEach(x => { mine[x.id] = 1 })
      return { ...v, me: mine }
    })
    const one = ts.length + xs.length === 1 ? (ts[0] ?? xs[0]) : null
    s.gift(n, one ? `«${one.name}»: +${n} монет` : `Ачивки: +${n} монет`, one ? one.icon : 'common/trophy')
  }

  return { tracks, specials, due, steps, total, claim }
}

const frameOf = (reached: number) => `achievements/frame_${TIERS[Math.max(0, reached - 1)]}`

export default function Achievements() {
  const s = useStore()
  const a = useAchievements()
  const [open, setOpen] = useState<string | null>(null)
  const t = a.tracks.find(x => x.id === open)
  const sp = a.specials.find(x => x.id === open)

  return (
    <div className="screen">
      <Header title="Ачивки" sub={`${a.steps} из ${a.total} · за каждую ступень монеты`} onBack={() => s.go('together')} icon="common/trophy" />
      <div className="card col" style={{ gap: 8 }}>
        <Bar value={a.steps} max={a.total} color="linear-gradient(90deg,#F8DE96,#E8B04A)" />
        <span className="small muted b">Бронза +{TIER_COINS[0]}, серебро +{TIER_COINS[1]}, золото +{TIER_COINS[2]}, особые +{SPECIAL_COINS}. Монеты получает каждый из вас.</span>
      </div>
      {a.due > 0 && (
        <div className="card row ach-due">
          <Img src="coins/coin_pile" size={48} />
          <b className="grow">Можно забрать +{a.due} монет</b>
          <button className="btn sm" onClick={() => a.claim()}>Забрать всё</button>
        </div>
      )}

      <div className="grid3">
        {a.tracks.map(x => (
          <button key={x.id} className={'ach' + (x.reached ? '' : ' locked')} onClick={() => setOpen(x.id)}>
            <div className="fr">
              <img src={`assets/${frameOf(x.reached)}.webp`} alt="" />
              <img className="in" src={`assets/${x.icon}.webp`} alt="" />
              {!x.reached && <img className="lock" src="assets/common/lock.webp" alt="" />}
              {x.due > 0 && <i className="ach-coin">+{x.due}</i>}
            </div>
            <span>{x.name}</span>
            <small>{x.reached >= TIER_N ? TIER_NAME[TIERS[TIER_N - 1]] : `${Math.min(x.val, x.steps[x.reached])}/${x.steps[x.reached]}`}</small>
          </button>
        ))}
      </div>

      <div className="sec-title">Особые</div>
      <div className="grid3">
        {a.specials.map(x => (
          <button key={x.id} className={'ach' + (x.done ? '' : ' locked')} onClick={() => setOpen(x.id)}>
            <div className="fr">
              <img src="assets/achievements/frame_special.webp" alt="" />
              <img className="in" src={`assets/${x.icon}.webp`} alt="" />
              {!x.done && <img className="lock" src="assets/common/lock.webp" alt="" />}
              {x.due > 0 && <i className="ach-coin">+{x.due}</i>}
            </div>
            <span>{x.name}</span>
          </button>
        ))}
      </div>

      <Sheet open={!!t || !!sp} onClose={() => setOpen(null)} title={t?.name ?? sp?.name} icon={t?.icon ?? sp?.icon}>
        {t && (
          <div className="ladder">
            {TIERS.slice(0, TIER_N).map((tier, i) => {
              const got = i < t.reached, paid = i < t.paid
              return (
                <div key={tier} className={'rung' + (got ? ' got' : '')}>
                  <Img src={`achievements/frame_${tier}`} size={46} />
                  <div className="grow">
                    <b>{TIER_NAME[tier]}</b>
                    <small>{t.what(t.steps[i])}</small>
                  </div>
                  {got ? (paid ? <span className="rung-ok">✓ +{TIER_COINS[i]}</span> : <span className="rung-due">+{TIER_COINS[i]}</span>)
                    : <span className="rung-left">{i === t.reached ? `${t.val} из ${t.steps[i]}` : `+${TIER_COINS[i]}`}</span>}
                </div>
              )
            })}
            {t.due > 0 && <button className="btn wide" onClick={() => a.claim([t.id])}>Забрать +{t.due} монет</button>}
          </div>
        )}
        {sp && (
          <div className="col" style={{ gap: 12 }}>
            <p className="b">{sp.done ? 'Получена' : sp.hint}</p>
            {sp.due > 0 && <button className="btn wide" onClick={() => a.claim([sp.id])}>Забрать +{sp.due} монет</button>}
            {sp.done && !sp.due && <span className="small muted b">Награда +{SPECIAL_COINS} уже забрана</span>}
          </div>
        )}
      </Sheet>
    </div>
  )
}
