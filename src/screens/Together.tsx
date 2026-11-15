import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Bar, Ava, Seg, plural, useName, useG } from '../ui'
import { ACHIEVEMENTS, ACH_HINT, TOGETHER_TILES, type Who } from '../data'
import { humanY } from '../dates'
import { usePhotos } from '../photos'
import { SECTIONS, type Topic, type Wish, type Goal, type Bet, type Thanks, type Rule } from './TogetherSections'

export default function Together() {
  const s = useStore()
  if (s.sub === 'watchlist') return <Watchlist />
  if (s.sub === 'achievements') return <Achievements />
  const Sec = SECTIONS[s.sub]
  if (Sec) return <Sec />
  return <TogetherHome />
}

// Счётчики для плиток и ачивок берутся из тех же сохранённых разделов
function useCounts() {
  const s = useStore()
  const [wishes] = usePersist<Wish[]>('wishes', [])
  const [goals] = usePersist<Goal[]>('bucket', [])
  const [bets] = usePersist<Bet[]>('bets', [])
  const [thanks] = usePersist<Thanks[]>('thanks', [])
  const [rules] = usePersist<Rule[]>('rules', [])
  const [talk] = usePersist<Topic[]>('topics', [])
  const [watch] = usePersist<WItem[]>('watchlist', [])
  const [sent] = usePersist<Record<Who, Record<string, number>>>('sent', { me: {}, him: {} })
  const ph = usePhotos()
  return { s, wishes, goals, bets, thanks, rules, talk, watch, sent, ph }
}

function TogetherHome() {
  const { s, wishes, goals, bets, thanks, rules, talk, watch, ph } = useCounts()
  const ach = useAchievements()
  const days = s.daysTogether
  const meets = s.meetCount
  const n = (x: number, a: string, b: string, c: string) => (x ? `${x} ${plural(x, a, b, c)}` : '')
  const notes: Record<string, string> = {
    photos: ph.today.me ? (ph.streak ? `серия ${ph.streak} ${plural(ph.streak, 'день', 'дня', 'дней')}` : 'сегодня выложено') : 'ждёт твоё фото',
    watchlist: n(watch.filter(w => w.status !== 'watched').length, 'фильм', 'фильма', 'фильмов') || 'что посмотреть',
    wishlist: n(wishes.filter(w => !w.gifted).length, 'желание', 'желания', 'желаний') || 'что подарить',
    bucket: goals.length ? `${goals.filter(g => g.done).length} из ${goals.length}` : 'мечты на двоих',
    memory: 'цитаты и капсулы',
    challenges: 'вместе каждый день',
    bets: bets.length ? `счёт ${bets.filter(b => b.winner === 'me').length} : ${bets.filter(b => b.winner === 'him').length}` : 'на интерес',
    gratitude: thanks.length ? `${thanks.length} «спасибо»` : 'за мелочи',
    agreements: n(rules.filter(r => r.ok.me && r.ok.him).length, 'правило', 'правила', 'правил') || 'правила пары',
    talk: n(talk.filter(t => !t.done).length, 'тема', 'темы', 'тем') || 'важные темы',
    achievements: `${ach.filter(a => a.done).length} из ${ach.length}`,
  }
  return (
    <div className="screen">
      <Header title="Вместе" sub="Всё, что про нас двоих" />
      <div className="hero">
        <Img src="memory/days_together" />
        <div className="grow">
          {days != null ? (
            <>
              <b>{days}</b>
              <div className="b">{plural(days, 'день', 'дня', 'дней')} вместе</div>
              <div className="small muted b">с {humanY(s.settings.since)} · {meets} {plural(meets, 'встреча', 'встречи', 'встреч')}</div>
            </>
          ) : (
            <>
              <div className="b">{meets} {plural(meets, 'встреча', 'встречи', 'встреч')}</div>
              <div className="small muted b">Дату, с которой вы вместе, можно указать в профиле</div>
            </>
          )}
        </div>
      </div>
      <div className="tiles">
        {TOGETHER_TILES.map(t => (
          <button key={t.id} className="tile" onClick={() => s.go('together', t.id)}>
            <Img src={t.icon} />
            <b>{t.name}</b>
            <small>{notes[t.id] ?? ''}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Вотчлист ----------
// Голоса у каждого свои: «оба хотят» — когда оба нажали «Хочу».
type Vote = 'want' | 'maybe' | 'no'
type WStatus = 'pending' | 'both' | 'watching' | 'watched'
export interface WItem { id: number; title: string; kind: 'movie' | 'series'; by: Who; status: WStatus; votes: Partial<Record<Who, Vote>>; rating?: Partial<Record<Who, number>> }
const W_TABS: { id: WStatus; name: string }[] = [
  { id: 'pending', name: 'Ждёт голоса' },
  { id: 'both', name: 'Оба хотят' },
  { id: 'watching', name: 'Смотрим' },
  { id: 'watched', name: 'Посмотрели' },
]
const POSTER_BG = ['#F7C4A0', '#BDB6E3', '#A9D3E8', '#A8C49A', '#F3B8B5', '#F5D58C']

function Watchlist() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [tab, setTab] = useState<WStatus>('pending')
  const [items, setItems] = usePersist<WItem[]>('watchlist', [])
  const [pick, setPick] = useState<WItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [rate, setRate] = useState<WItem | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'movie' | 'series'>('movie')
  const list = items.filter(i => i.status === tab)
  const patch = (id: number, f: (x: WItem) => WItem) => setItems(xs => xs.map(x => (x.id === id ? f(x) : x)))

  function vote(it: WItem, v: Vote) {
    patch(it.id, x => {
      const votes = { ...x.votes, me: v }
      return { ...x, votes, status: votes.me === 'want' && votes.him === 'want' ? 'both' : x.status }
    })
    if (v === 'want' && it.votes.him === 'want') s.toast(`«${it.title}»: оба хотят!`, 'common/two_hearts')
  }
  function random() {
    const pool = items.filter(i => i.status === 'both')
    if (!pool.length) { s.toast('Сначала проголосуйте оба', 'watchlist/vote_maybe'); return }
    setPick(pool[Math.floor(Math.random() * pool.length)])
  }

  return (
    <div className="screen">
      <Header title="Вотчлист" sub="Предлагаете по очереди, голосуете вдвоём" onBack={() => s.go('together')} icon="watchlist/status_watching" />
      <div className="chips">
        {W_TABS.map(t => (
          <button key={t.id} className={'chip' + (t.id === tab ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.name} · {items.filter(i => i.status === t.id).length}
          </button>
        ))}
      </div>
      {tab === 'both' && list.length > 0 && (
        <button className="btn wide peach" onClick={random}><Img src="watchlist/randomizer" />Что смотрим сегодня?</button>
      )}
      <div className="col" style={{ gap: 10 }}>
        {list.map((it, i) => (
          <div key={it.id} className="witem">
            <div className="poster" style={{ background: POSTER_BG[(it.id + i) % POSTER_BG.length] }}>
              <Img src={it.kind === 'series' ? 'watchlist/series' : 'watchlist/movie'} />
            </div>
            <div className="grow col" style={{ gap: 6 }}>
              <div>
                <b>{it.title}</b>
                <div className="small muted b">{it.kind === 'series' ? 'сериал' : 'фильм'} · идея: {name(it.by)}</div>
              </div>
              {it.status === 'pending' && (
                <>
                  <div className="votes">
                    <button className={it.votes.me === 'want' ? 'on' : ''} onClick={() => vote(it, 'want')}><Img src="common/heart" />Хочу</button>
                    <button className={it.votes.me === 'maybe' ? 'on' : ''} onClick={() => vote(it, 'maybe')}><Img src="watchlist/vote_maybe" />Может</button>
                    <button className={it.votes.me === 'no' ? 'on' : ''} onClick={() => vote(it, 'no')}><Img src="common/cross_badge" />Нет</button>
                  </div>
                  <span className="small muted b">{it.votes.him ? `${name('him')} проголосовал` : `${name('him')} ещё не голосовал`}</span>
                </>
              )}
              {it.status === 'both' && (
                <div className="row" style={{ gap: 6 }}>
                  <Ava who="both" size={22} /><span className="small b grow" style={{ color: 'var(--leaf)' }}>оба хотят</span>
                  <button className="btn sm soft" onClick={() => { patch(it.id, x => ({ ...x, status: 'watching' })); setTab('watching') }}>Начали</button>
                </div>
              )}
              {it.status === 'watching' && (
                <button className="btn sm sage" onClick={() => setRate(it)}>Посмотрели · оценить</button>
              )}
              {it.status === 'watched' && (
                <div className="rate">
                  <span><Ava who="me" size={20} />{it.rating?.me ?? '—'}/10</span>
                  <span><Ava who="him" size={20} />{it.rating?.him ?? '—'}/10</span>
                  {it.rating?.me == null && <button className="linkish" onClick={() => setRate(it)}>оценить</button>}
                </div>
              )}
            </div>
            {it.by === 'me' && it.status === 'pending' && (
              <button className="x-btn" aria-label="Убрать" onClick={() => setItems(xs => xs.filter(x => x.id !== it.id))}>×</button>
            )}
          </div>
        ))}
        {!list.length && (
          <div className="empty-col">
            <Img src="watchlist/empty_watchlist" />
            {tab === 'pending' ? `Предложи фильм или сериал: ${g.he} проголосует` : tab === 'both' ? 'Здесь то, что хотите оба' : tab === 'watching' ? 'Сейчас ничего не смотрите' : 'Тут будет ваша история просмотров'}
          </div>
        )}
      </div>
      <button className="fab" onClick={() => setAdding(true)} aria-label="Добавить">+</button>

      <Sheet open={!!pick} onClose={() => setPick(null)}>
        {pick && (
          <div className="big-reward">
            <Img src="common/dice_d20_tumble" className="dice" />
            <p className="muted b">Сегодня смотрим</p>
            <h3 style={{ fontSize: 24 }}>{pick.title}</h3>
            <button className="btn wide" onClick={() => { patch(pick.id, x => ({ ...x, status: 'watching' })); setPick(null); setTab('watching') }}>Начали смотреть</button>
            <button className="btn wide soft" onClick={random}>Перекинуть</button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!rate} onClose={() => setRate(null)} title={rate?.title} icon="watchlist/status_watched">
        <p className="small muted b">Твоя оценка от 1 до 10</p>
        <div className="price-pick" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => {
              if (!rate) return
              patch(rate.id, x => ({ ...x, status: 'watched', rating: { ...x.rating, me: n } }))
              setRate(null); setTab('watched'); s.toast('Оценка сохранена', 'watchlist/status_watched')
            }}>{n}</button>
          ))}
        </div>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Предложить" icon="watchlist/movie">
        <input className="input" placeholder="Название фильма или сериала" value={title} onChange={e => setTitle(e.target.value)} />
        <Seg value={kind} onChange={setKind} options={[{ id: 'movie', name: 'Фильм' }, { id: 'series', name: 'Сериал' }]} />
        <button className="btn wide" onClick={() => {
          if (!title.trim()) return
          setItems(xs => [{ id: Date.now(), title: title.trim(), kind, by: 'me', status: 'pending', votes: { me: 'want' } }, ...xs])
          setTitle(''); setAdding(false); setTab('pending'); s.toast(`${g.He} увидит и проголосует`, 'watchlist/movie')
        }}>Добавить</button>
      </Sheet>
    </div>
  )
}

// ---------- Ачивки ----------
function useAchievements() {
  const { s, bets, watch, sent, ph } = useCounts()
  const doneTasks = s.tasks.filter(t => t.status === 'done')
  const hugs = (sent.me.hug ?? 0) + (sent.him.hug ?? 0)
  const days = s.daysTogether ?? 0
  const thisWeek = s.tasks.filter(t => t.status !== 'backlog')
  const best = ph.best
  const done: Record<string, boolean> = {
    meet1: s.meetCount >= 1, meet10: s.meetCount >= 10, meet25: s.meetCount >= 25, meet50: s.meetCount >= 50,
    task1: doneTasks.length >= 1, task50: doneTasks.length >= 50, epic: doneTasks.some(t => t.type === 'epic'),
    clean: thisWeek.length >= 3 && thisWeek.every(t => t.status === 'done'),
    pet: !!s.pet.name, grown: s.pet.stage === 'adult',
    photo7: best >= 7, photo30: best >= 30, hug100: hugs >= 100,
    movies: watch.filter(w => w.status === 'watched').length >= 5,
    days100: days >= 100, year: days >= 365, bet1: bets.length > 0, pet2: s.jar.me + s.jar.him >= 4000,
  }
  return ACHIEVEMENTS.map(a => ({ ...a, done: !!done[a.id] }))
}

function Achievements() {
  const s = useStore()
  const list = useAchievements()
  const got = list.filter(a => a.done).length
  return (
    <div className="screen">
      <Header title="Ачивки" sub={`${got} из ${list.length} · бронза, серебро, золото`} onBack={() => s.go('together')} icon="common/trophy" />
      <div className="card"><Bar value={got} max={list.length} color="linear-gradient(90deg,#F8DE96,#E8B04A)" /></div>
      <div className="grid3">
        {list.map(a => (
          <button key={a.id} className={'ach' + (a.done ? '' : ' locked')} onClick={() => s.toast(a.done ? `«${a.name}» получена` : ACH_HINT[a.id], a.icon)}>
            <div className="fr">
              <img src={`assets/achievements/frame_${a.tier}.webp`} alt="" />
              <img className="in" src={`assets/${a.icon}.webp`} alt="" />
              {!a.done && <img className="lock" src="assets/common/lock.webp" alt="" />}
            </div>
            <span>{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
