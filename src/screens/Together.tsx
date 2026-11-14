import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Bar, Ava, plural } from '../ui'
import { ACHIEVEMENTS, TOGETHER_TILES, WATCHLIST, daysTogether, type WItem, type WStatus } from '../data'
import { TODAY_KEY } from '../dates'
import { usePhotos } from '../photos'
import { SECTIONS, WISH_SEED, GOAL_SEED, BET_SEED, THANKS_SEED, THANKS_BEFORE, RULE_SEED, TALK_SEED, type Topic, type Wish, type Goal, type Bet, type Thanks, type Rule } from './TogetherSections'

export default function Together() {
  const s = useStore()
  if (s.sub === 'watchlist') return <Watchlist />
  if (s.sub === 'achievements') return <Achievements />
  const Sec = SECTIONS[s.sub]
  if (Sec) return <Sec />
  return <TogetherHome />
}

function TogetherHome() {
  const s = useStore()
  const days = daysTogether()
  const meets = 24 + Object.keys(s.meetings).filter(k => k <= TODAY_KEY).length
  // Подписи на плитках считаются из сохранённых данных разделов
  const [wishes] = usePersist<Wish[]>('wishes', WISH_SEED)
  const [goals] = usePersist<Goal[]>('bucket', GOAL_SEED)
  const [bets] = usePersist<Bet[]>('bets', BET_SEED)
  const [thanks] = usePersist<Thanks[]>('thanks', THANKS_SEED)
  const [rules] = usePersist<Rule[]>('rules', RULE_SEED)
  const [talk] = usePersist<Topic[]>('topics', TALK_SEED)
  const ph = usePhotos()
  const notes: Record<string, string> = {
    photos: ph.today.me ? (ph.streak ? `серия ${ph.streak} ${plural(ph.streak, 'день', 'дня', 'дней')}` : 'сегодня выложено') : 'ждёт твоё фото',
    wishlist: `${wishes.filter(w => !w.gifted).length} ${plural(wishes.filter(w => !w.gifted).length, 'желание', 'желания', 'желаний')}`,
    bucket: `${goals.filter(g => g.done).length} из ${goals.length}`,
    bets: `счёт ${bets.filter(b => b.winner === 'me').length} : ${bets.filter(b => b.winner === 'him').length}`,
    gratitude: `${THANKS_BEFORE + thanks.length} «спасибо»`,
    agreements: `${rules.filter(r => r.ok.me && r.ok.him).length} ${plural(rules.filter(r => r.ok.me && r.ok.him).length, 'правило', 'правила', 'правил')}`,
    talk: `${talk.filter(t => !t.done).length} ${plural(talk.filter(t => !t.done).length, 'тема', 'темы', 'тем')}`,
  }
  return (
    <div className="screen">
      <Header title="Вместе" sub="Всё, что про нас двоих" />
      <div className="hero">
        <Img src="memory/days_together" />
        <div className="grow">
          <b>{days}</b>
          <div className="b">{plural(days, 'день', 'дня', 'дней')} вместе</div>
          <div className="small muted b">с 29 сентября 2025 · {meets} {plural(meets, 'встреча', 'встречи', 'встреч')}</div>
        </div>
      </div>
      <div className="tiles">
        {TOGETHER_TILES.map(t => (
          <button key={t.id} className="tile" onClick={() => s.go('together', t.id)}>
            <Img src={t.icon} />
            <b>{t.name}</b>
            <small>{notes[t.id] ?? t.note}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

const W_TABS: { id: WStatus; name: string }[] = [
  { id: 'pending', name: 'Ждёт голоса' },
  { id: 'both', name: 'Оба хотят' },
  { id: 'watching', name: 'Смотрим' },
  { id: 'watched', name: 'Посмотрели' },
]
const POSTER_BG = ['#F7C4A0', '#BDB6E3', '#A9D3E8', '#A8C49A', '#F3B8B5', '#F5D58C']

function Watchlist() {
  const s = useStore()
  const [tab, setTab] = useState<WStatus>('pending')
  const [items, setItems] = useState<WItem[]>(WATCHLIST)
  const [pick, setPick] = useState<WItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const list = items.filter(i => i.status === tab)

  function vote(it: WItem, v: 'want' | 'maybe' | 'no') {
    setItems(xs => xs.map(x => (x.id === it.id ? { ...x, myVote: v, status: v === 'want' ? 'both' : x.status } : x)))
    if (v === 'want') s.toast(`«${it.title}»: оба хотят!`, 'common/two_hearts')
    if (v === 'no') s.toast('Ок, не покажем снова', 'common/cross_badge')
  }
  function random() {
    const pool = items.filter(i => i.status === 'both')
    setPick(pool[Math.floor(Math.random() * pool.length)])
  }

  return (
    <div className="screen">
      <Header title="Вотчлист" sub="Предлагаем по очереди, голосуем вдвоём" onBack={() => s.go('together')} icon="watchlist/status_watching" />
      <div className="chips">
        {W_TABS.map(t => (
          <button key={t.id} className={'chip' + (t.id === tab ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.name} · {items.filter(i => i.status === t.id).length}
          </button>
        ))}
      </div>
      {tab === 'both' && (
        <button className="btn wide peach" onClick={random}><Img src="watchlist/randomizer" />Что смотрим сегодня?</button>
      )}
      <div className="col" style={{ gap: 10 }}>
        {list.map((it, i) => (
          <div key={it.id} className="witem">
            <div className="poster" style={{ background: POSTER_BG[(it.id + i) % POSTER_BG.length] }}>
              <Img src={it.kind === 'series' ? 'watchlist/series' : 'watchlist/movie'} />
              <small>{it.year}</small>
            </div>
            <div className="grow col" style={{ gap: 6 }}>
              <div>
                <b>{it.title}</b>
                <div className="small muted b row" style={{ gap: 4 }}>
                  {it.kind === 'series' ? 'сериал' : 'фильм'} · {it.by === 'me' ? 'идея моя' : 'идея его'}
                </div>
              </div>
              {it.status === 'pending' && (
                <div className="votes">
                  <button className={it.myVote === 'want' ? 'on' : ''} onClick={() => vote(it, 'want')}><Img src="common/heart" />Хочу</button>
                  <button className={it.myVote === 'maybe' ? 'on' : ''} onClick={() => vote(it, 'maybe')}><Img src="watchlist/vote_maybe" />Может</button>
                  <button className={it.myVote === 'no' ? 'on' : ''} onClick={() => vote(it, 'no')}><Img src="common/cross_badge" />Нет</button>
                </div>
              )}
              {it.status === 'both' && (
                <div className="row" style={{ gap: 6 }}><Ava who="both" size={22} /><span className="small b" style={{ color: 'var(--leaf)' }}>оба хотят</span></div>
              )}
              {it.progress && (
                <div className="col" style={{ gap: 4 }}>
                  <div className="row small b" style={{ gap: 6 }}><Ava who="me" size={20} /><div className="grow"><Bar thin value={it.progress.me} max={it.progress.total} /></div>{it.progress.me}/{it.progress.total}</div>
                  <div className="row small b" style={{ gap: 6 }}><Ava who="him" size={20} /><div className="grow"><Bar thin value={it.progress.him} max={it.progress.total} color="var(--sage)" /></div>{it.progress.him}/{it.progress.total}</div>
                </div>
              )}
              {it.rating && (
                <div className="rate">
                  <span><Ava who="me" size={20} />{it.rating.me}/10</span>
                  <span><Ava who="him" size={20} />{it.rating.him}/10</span>
                  <span><Img src="watchlist/status_watched" />вместе</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {!list.length && (
          <div className="empty-col"><Img src="watchlist/empty_watchlist" />Тут пока пусто</div>
        )}
      </div>
      <button className="fab" onClick={() => setAdding(true)} aria-label="Добавить">+</button>

      <Sheet open={!!pick} onClose={() => setPick(null)}>
        {pick && (
          <div className="big-reward">
            <Img src="common/dice_d20_tumble" className="dice" />
            <p className="muted b">Сегодня смотрим</p>
            <h3 style={{ fontSize: 24 }}>{pick.title}</h3>
            <button className="btn wide" onClick={() => { setItems(xs => xs.map(x => (x.id === pick.id ? { ...x, status: 'watching' } : x))); setPick(null); setTab('watching') }}>Начали смотреть</button>
            <button className="btn wide soft" onClick={random}>Перекинуть</button>
          </div>
        )}
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Предложить" icon="watchlist/movie">
        <input className="input" placeholder="Название фильма или сериала" value={title} onChange={e => setTitle(e.target.value)} />
        <button className="btn wide" onClick={() => {
          if (!title.trim()) return
          setItems(xs => [{ id: Date.now(), title: title.trim(), year: 2026, kind: 'movie', by: 'me', status: 'pending', myVote: 'want' }, ...xs])
          setTitle(''); setAdding(false); s.toast('Он увидит и проголосует', 'watchlist/movie')
        }}>Добавить</button>
      </Sheet>
    </div>
  )
}

function Achievements() {
  const s = useStore()
  const done = ACHIEVEMENTS.filter(a => a.done).length
  return (
    <div className="screen">
      <Header title="Ачивки" sub={`${done} из ${ACHIEVEMENTS.length} · бронза, серебро, золото`} onBack={() => s.go('together')} icon="common/trophy" />
      <div className="grid3">
        {ACHIEVEMENTS.map(a => (
          <button key={a.name} className={'ach' + (a.done ? '' : ' locked')} onClick={() => s.toast(a.done ? `«${a.name}» получена` : `«${a.name}» ещё впереди`, a.icon)}>
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
