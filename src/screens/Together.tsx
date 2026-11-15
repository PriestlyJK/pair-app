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
type WTab = WStatus | 'seen'
export type Kind = 'movie' | 'series' | 'anime' | 'cartoon'
// stars — оценка 1–5 звёзд; rating — старые оценки 1–10, показываем их как звёзды
export interface WItem { id: number; title: string; kind: Kind; by: Who; status: WStatus; votes: Partial<Record<Who, Vote>>; rating?: Partial<Record<Who, number>>; stars?: Partial<Record<Who, number>> }
// Что каждый смотрел раньше, сам по себе: заполняет только своё, другой видит
export interface Seen { id: number; title: string; kind: Kind; by: Who; stars?: number; note?: string }
const KINDS: { id: Kind; name: string; one: string; icon: string }[] = [
  { id: 'movie', name: 'Фильм', one: 'фильм', icon: 'watchlist/movie' },
  { id: 'series', name: 'Сериал', one: 'сериал', icon: 'watchlist/series' },
  { id: 'anime', name: 'Аниме', one: 'аниме', icon: 'watchlist/anime' },
  { id: 'cartoon', name: 'Мультик', one: 'мультфильм', icon: 'watchlist/cartoon' },
]
const kindOf = (k?: string) => KINDS.find(x => x.id === k) ?? KINDS[0]
const W_TABS: { id: WTab; name: string }[] = [
  { id: 'pending', name: 'Ждёт голоса' },
  { id: 'both', name: 'Оба хотят' },
  { id: 'watching', name: 'Смотрим' },
  { id: 'watched', name: 'Посмотрели' },
  { id: 'seen', name: 'Смотрели раньше' },
]
const POSTER_BG = ['#F7C4A0', '#BDB6E3', '#A9D3E8', '#A8C49A', '#F3B8B5', '#F5D58C']
const norm = (t: string) => t.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const starsOf = (it: WItem, w: Who) => it.stars?.[w] ?? (it.rating?.[w] != null ? Math.max(1, Math.round(it.rating[w]! / 2)) : undefined)

// Пять звёзд: просто показ или выбор (повторное нажатие на ту же звезду снимает оценку)
export function Stars({ n = 0, onPick, size = 18 }: { n?: number; onPick?: (n: number) => void; size?: number }) {
  return (
    <span className={'stars' + (onPick ? ' pick' : '')} aria-label={n ? `${n} из 5` : 'без оценки'}>
      {[1, 2, 3, 4, 5].map(i => onPick
        ? <button key={i} type="button" onClick={() => onPick(i === n ? 0 : i)} aria-label={`${i} из 5`}><Img src={i <= n ? 'common/star' : 'common/star_pale'} size={size} /></button>
        : <Img key={i} src={i <= n ? 'common/star' : 'common/star_pale'} size={size} />)}
    </span>
  )
}

function Poster({ kind, i }: { kind: Kind; i: number }) {
  return (
    <div className="poster" style={{ background: POSTER_BG[i % POSTER_BG.length] }}>
      <Img src={kindOf(kind).icon} />
    </div>
  )
}

function Watchlist() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [tab, setTab] = useState<WTab>('pending')
  const [items, setItems] = usePersist<WItem[]>('watchlist', [])
  const [seen, setSeen] = usePersist<Seen[]>('seen', [])
  const [pick, setPick] = useState<WItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [rate, setRate] = useState<WItem | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Kind>('movie')
  // «Смотрели раньше»: чей список открыт, фильтр по категории, форма своей записи
  const [who, setWho] = useState<Who>('me')
  const [kf, setKf] = useState<Kind | 'all'>('all')
  const [form, setForm] = useState<Seen | null>(null)
  const list = tab === 'seen' ? [] : items.filter(i => i.status === tab)
  const patch = (id: number, f: (x: WItem) => WItem) => setItems(xs => xs.map(x => (x.id === id ? f(x) : x)))
  const sawIt = (t: string) => seen.filter(x => norm(x.title) === norm(t))
  const watched = (w: Who) => g[w === 'me' ? 'm' : 'p']('смотрел', 'смотрела')

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
  function suggest(t: string, k: Kind) {
    if (items.some(x => norm(x.title) === norm(t) && x.status !== 'watched')) { s.toast('Это уже есть в общем списке', 'watchlist/vote_maybe'); return false }
    setItems(xs => [{ id: Date.now(), title: t, kind: k, by: 'me', status: 'pending', votes: { me: 'want' } }, ...xs])
    s.toast(`${g.He} увидит и проголосует`, kindOf(k).icon)
    return true
  }
  function saveSeen() {
    if (!form || !form.title.trim()) return
    const v = { ...form, title: form.title.trim(), note: form.note?.trim() || undefined, stars: form.stars || undefined }
    setSeen(xs => (xs.some(x => x.id === v.id) ? xs.map(x => (x.id === v.id ? v : x)) : [v, ...xs]))
    setForm(null); setWho('me')
    s.toast('Сохранено в «Смотрели раньше»', 'watchlist/status_watched')
  }

  const seenList = seen.filter(x => x.by === who && (kf === 'all' || x.kind === kf))
  const seenAll = seen.filter(x => x.by === who)
  const dupe = title.trim() ? sawIt(title) : []

  return (
    <div className="screen">
      <Header title="Вотчлист" sub="Фильмы, сериалы, аниме и мультики" onBack={() => s.go('together')} icon="watchlist/status_watching" />
      <div className="chips">
        {W_TABS.map(t => (
          <button key={t.id} className={'chip' + (t.id === tab ? ' on' : '')} onClick={() => setTab(t.id)}>
            {t.name} · {t.id === 'seen' ? seen.length : items.filter(i => i.status === t.id).length}
          </button>
        ))}
      </div>

      {tab === 'seen' ? (
        <>
          <Seg value={who} onChange={setWho} options={[{ id: 'me', name: 'Моё' }, { id: 'him', name: name('him') }]} />
          {seenAll.length > 0 && (
            <div className="chips">
              <button className={'chip sm' + (kf === 'all' ? ' on' : '')} onClick={() => setKf('all')}>Всё · {seenAll.length}</button>
              {KINDS.map(k => {
                const n = seenAll.filter(x => x.kind === k.id).length
                return n ? <button key={k.id} className={'chip sm' + (kf === k.id ? ' on' : '')} onClick={() => setKf(k.id)}>{k.name} · {n}</button> : null
              })}
            </div>
          )}
          <div className="col" style={{ gap: 10 }}>
            {seenList.map((it, i) => {
              const mine = it.by === 'me'
              const inList = items.some(x => norm(x.title) === norm(it.title))
              const other = seen.find(x => x.by !== it.by && norm(x.title) === norm(it.title))
              return (
                <div key={it.id} className="witem" role={mine ? 'button' : undefined} onClick={mine ? () => setForm(it) : undefined}>
                  <Poster kind={it.kind} i={it.id + i} />
                  <div className="grow col" style={{ gap: 4 }}>
                    <div>
                      <b>{it.title}</b>
                      <div className="small muted b">{kindOf(it.kind).one}</div>
                    </div>
                    {it.stars ? <Stars n={it.stars} /> : <span className="small muted b">без оценки</span>}
                    {it.note && <span className="small b">«{it.note}»</span>}
                    {other && <span className="seen-tag"><Ava who={other.by} size={16} />тоже {watched(other.by)}{other.stars ? ` · ${other.stars}★` : ''}</span>}
                    {!mine && !inList && !other && (
                      <button className="linkish" style={{ alignSelf: 'flex-start' }} onClick={() => suggest(it.title, it.kind)}>+ хочу посмотреть вместе</button>
                    )}
                  </div>
                  {mine && <span className="chev">›</span>}
                </div>
              )
            })}
            {!seenList.length && (
              <div className="empty-col">
                <Img src="watchlist/empty_watchlist" />
                {who === 'me'
                  ? `Добавь, что ты уже ${g.m('смотрел', 'смотрела')} раньше, и поставь звёзды. ${g.He} увидит твой вкус.`
                  : `${name('him')} пока ничего не ${g.p('добавил', 'добавила')}. Свой список каждый заполняет сам.`}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {tab === 'both' && list.length > 0 && (
            <button className="btn wide peach" onClick={random}><Img src="watchlist/randomizer" />Что смотрим сегодня?</button>
          )}
          <div className="col" style={{ gap: 10 }}>
            {list.map((it, i) => (
              <div key={it.id} className="witem">
                <Poster kind={it.kind} i={it.id + i} />
                <div className="grow col" style={{ gap: 6 }}>
                  <div>
                    <b>{it.title}</b>
                    <div className="small muted b">{kindOf(it.kind).one} · идея: {name(it.by)}</div>
                  </div>
                  {it.status !== 'watched' && sawIt(it.title).map(x => (
                    <span key={x.id} className="seen-tag"><Ava who={x.by} size={16} />{x.by === 'me' ? 'ты' : name('him')} уже {watched(x.by)}{x.stars ? ` · ${x.stars}★` : ''}</span>
                  ))}
                  {it.status === 'pending' && (
                    <>
                      <div className="votes">
                        <button className={it.votes.me === 'want' ? 'on' : ''} onClick={() => vote(it, 'want')}><Img src="common/heart" />Хочу</button>
                        <button className={it.votes.me === 'maybe' ? 'on' : ''} onClick={() => vote(it, 'maybe')}><Img src="watchlist/vote_maybe" />Может</button>
                        <button className={it.votes.me === 'no' ? 'on' : ''} onClick={() => vote(it, 'no')}><Img src="common/cross_badge" />Нет</button>
                      </div>
                      <span className="small muted b">{name('him')} {it.votes.him ? g.p('проголосовал', 'проголосовала') : `ещё не ${g.p('голосовал', 'голосовала')}`}</span>
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
                    <div className="col" style={{ gap: 4 }}>
                      {(['me', 'him'] as Who[]).map(w => (
                        <div key={w} className="row" style={{ gap: 6 }}>
                          <Ava who={w} size={20} />
                          {starsOf(it, w) ? <Stars n={starsOf(it, w)} size={16} /> : <span className="small muted b">{w === 'me' ? 'без оценки' : 'ещё не оценил' + g.p('', 'а')}</span>}
                          {w === 'me' && <button className="linkish" onClick={() => setRate(it)}>{starsOf(it, 'me') ? 'изменить' : 'оценить'}</button>}
                        </div>
                      ))}
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
                {tab === 'pending' ? `Предложи, что посмотреть: ${g.he} проголосует` : tab === 'both' ? 'Здесь то, что хотите оба' : tab === 'watching' ? 'Сейчас ничего не смотрите' : 'Тут будет ваша история просмотров'}
              </div>
            )}
          </div>
        </>
      )}
      <button className="fab" aria-label="Добавить" onClick={() => (tab === 'seen' ? setForm({ id: Date.now(), title: '', kind: 'movie', by: 'me' }) : setAdding(true))}>+</button>

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
        <p className="small muted b">Твоя оценка</p>
        <div className="stars-big">
          <Stars size={44} n={rate ? starsOf(rate, 'me') : 0} onPick={n => {
            if (!rate || !n) return
            patch(rate.id, x => ({ ...x, status: 'watched', stars: { ...x.stars, me: n } }))
            setRate(null); setTab('watched'); s.toast('Оценка сохранена', 'watchlist/status_watched')
          }} />
        </div>
      </Sheet>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Предложить" icon={kindOf(kind).icon}>
        <input className="input" placeholder="Название" value={title} onChange={e => setTitle(e.target.value)} />
        <Seg value={kind} onChange={setKind} options={KINDS.map(k => ({ id: k.id, name: k.name }))} />
        {dupe.map(x => (
          <span key={x.id} className="seen-tag"><Ava who={x.by} size={16} />{x.by === 'me' ? 'Ты' : name('him')} уже {watched(x.by)}{x.stars ? ` · ${x.stars}★` : ''}{x.note ? ` · «${x.note}»` : ''}</span>
        ))}
        <button className="btn wide" onClick={() => {
          if (!title.trim()) return
          if (suggest(title.trim(), kind)) { setTitle(''); setAdding(false); setTab('pending') }
        }}>Добавить</button>
      </Sheet>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form && seen.some(x => x.id === form.id) ? 'Моя запись' : `Я уже ${g.m('смотрел', 'смотрела')}`} icon="watchlist/status_watched">
        {form && (
          <>
            <input className="input" placeholder="Название" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <Seg value={form.kind} onChange={k => setForm({ ...form, kind: k })} options={KINDS.map(k => ({ id: k.id, name: k.name }))} />
            <div className="stars-big"><Stars size={40} n={form.stars} onPick={n => setForm({ ...form, stars: n })} /></div>
            <input className="input" maxLength={80} placeholder="Пара слов (можно пропустить)" value={form.note ?? ''} onChange={e => setForm({ ...form, note: e.target.value })} />
            <button className="btn wide" onClick={saveSeen}>Сохранить</button>
            {seen.some(x => x.id === form.id) && (
              <button className="btn wide soft" onClick={() => { setSeen(xs => xs.filter(x => x.id !== form.id)); setForm(null); s.toast('Убрано', 'common/cross_badge') }}>Убрать из списка</button>
            )}
          </>
        )}
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
