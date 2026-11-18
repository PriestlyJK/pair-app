import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, plural, useName, useG } from '../ui'
import type { Who } from '../data'
import { sendEvent } from '../sync'
import { KINDS, kindOf, norm, openWatchlist, Stars, type WItem, type Seen } from './Together'
import {
  fetchBatch, cardByKey, allowed, posterUrl, GROUPS, LVLS, GENRE_NAME, NO_PREFS, TmdbError,
  type MCard, type Prefs, type Kind, type Lvl, type Group,
} from '../tmdb'

/* «Подбор» — карточки фильмов, сериалов, аниме и мультиков из TMDB, как в Тиндере:
   вправо или ♥ — хочу, влево или ✕ — не хочу, вверх или кнопка посередине — уже смотрел(а).
   Каждый листает сам по себе. Когда оба сказали «хочу» — совпадение: фильм сам попадает в «Оба хотят». */

type Sw = 'w' | 'n' | 's'
type Swipes = Record<Who, Record<string, Sw>>
// Коротко о карточке для списка «Мои хочу» (полную подгружать не нужно)
interface Mini { t: string; y?: number; p: string; k: Kind }
type DCard = MCard & { partner?: boolean; en?: boolean }
interface Undo { card: DCard; prev?: Sw; item?: WItem; newItem?: number; newSeen?: number }
type Load = 'idle' | 'loading' | 'error' | 'setup' | 'offline' | 'empty'

const KIND_PLURAL: Record<Kind, string> = { movie: 'Фильмы', series: 'Сериалы', anime: 'Аниме', cartoon: 'Мультики' }
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

export default function Discover() {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [swipes, setSwipes] = usePersist<Swipes>('movie_swipes', { me: {}, him: {} })
  const [cache, setCache] = usePersist<Record<string, Mini>>('movie_cards', {})
  const [prefsAll, setPrefsAll] = usePersist<Partial<Record<Who, Prefs>>>('movie_prefs', {})
  const [items, setItems] = usePersist<WItem[]>('watchlist', [])
  const [seen, setSeen] = usePersist<Seen[]>('seen', [])
  const mine = swipes.me ?? {}
  const his = swipes.him ?? {}
  const prefs = prefsAll.me ?? NO_PREFS

  const [deck, setDeck] = useState<DCard[]>([])
  const [load, setLoad] = useState<Load>('idle')
  const [drag, setDrag] = useState({ x: 0, y: 0, on: false })
  const [fly, setFly] = useState<Sw | null>(null)
  const [last, setLast] = useState<Undo | null>(null)
  const [match, setMatch] = useState<DCard | null>(null)
  const [info, setInfo] = useState<DCard | null>(null)
  const [rateSeen, setRateSeen] = useState<{ id: number; title: string; stars: number } | null>(null)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [draft, setDraft] = useState<Prefs>(prefs)
  const [wantsOpen, setWantsOpen] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const moved = useRef(false)

  // Что не показывать: уже есть в общем списке (кроме тех, где я ещё не голосовал(а)) или в моём «Смотрел(а) раньше»
  const blocked = useMemo(() => {
    const b = new Set<string>()
    for (const x of items) if (x.status !== 'pending' || x.votes.me) { b.add(norm(x.title)); if (x.tmdb) b.add(x.tmdb) }
    for (const x of seen) if (x.by === 'me') { b.add(norm(x.title)); if (x.tmdb) b.add(x.tmdb) }
    return b
  }, [items, seen])

  // Колода подгружается сама, когда в ней остаётся мало карточек
  const deckRef = useRef(deck); deckRef.current = deck
  const skipRef = useRef<(c: MCard) => boolean>(() => false)
  skipRef.current = c => !!mine[c.key] || blocked.has(c.key) || blocked.has(norm(c.title)) || deckRef.current.some(d => d.key === c.key)
  const prefsRef = useRef(prefs); prefsRef.current = prefs
  const partnerRef = useRef<string[]>([])
  partnerRef.current = Object.keys(his).filter(k => his[k] === 'w' && !mine[k] && !blocked.has(k) && !(cache[k] && blocked.has(norm(cache[k].t))))
  const busy = useRef(false)
  const gen = useRef(0)
  // Что партнёр хочет, но мне по настройкам не подходит, — второй раз не загружаем
  const partnerSkip = useRef(new Set<string>())

  async function refill() {
    if (busy.current) return
    busy.current = true
    const my = gen.current
    setLoad('loading')
    try {
      const got: DCard[] = []
      for (let i = 0; i < 3 && got.length < 6; i++) {
        got.push(...await fetchBatch(prefsRef.current, c => skipRef.current(c) || got.some(x => x.key === c.key)))
      }
      // То, что уже хочет партнёр, — почаще и с пометкой: так совпадения находятся быстрее
      const want = partnerRef.current.filter(k => !partnerSkip.current.has(k) && !got.some(x => x.key === k) && !deckRef.current.some(x => x.key === k)).slice(0, 2)
      let n = 0
      for (const k of want) {
        const c = await cardByKey(k).catch(() => null)
        if (c && c.poster && allowed(c, prefsRef.current)) got.splice(Math.min(got.length, 1 + 4 * n++), 0, { ...c, partner: true })
        else if (c) partnerSkip.current.add(k)
      }
      if (my !== gen.current) return
      setDeck(d => [...d, ...got.filter(c => !d.some(x => x.key === c.key))])
      setLoad(got.length || deckRef.current.length ? 'idle' : 'empty')
    } catch (e) {
      if (my === gen.current) setLoad(e instanceof TmdbError && e.why !== 'other' ? e.why : 'error')
    } finally {
      busy.current = false
    }
  }
  useEffect(() => { if (deck.length < 5 && load === 'idle') refill() }, [deck.length, load]) // eslint-disable-line react-hooks/exhaustive-deps

  const top = deck[0]
  // Описания на русском у TMDB есть не у всех: тогда берём английское
  useEffect(() => {
    if (!top || top.overview || top.en) return
    const k = top.key
    cardByKey(k, 'en-US').then(c => setDeck(d => d.map(x => (x.key === k ? { ...x, en: true, overview: c?.overview ?? '' } : x))), () => setDeck(d => d.map(x => (x.key === k ? { ...x, en: true } : x))))
  }, [top?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  // Следующие постеры заранее, чтобы не мигали
  useEffect(() => { for (const c of deck.slice(1, 3)) new Image().src = posterUrl(c.poster) }, [deck])

  function act(c: DCard, v: Sw) {
    const undo: Undo = { card: c, prev: mine[c.key] }
    setSwipes(x => ({ ...x, me: { ...(x.me ?? {}), [c.key]: v } }))
    if (v !== 'n') setCache(x => ({ ...x, [c.key]: { t: c.title, y: c.year, p: c.poster, k: c.kind } }))
    // Этот фильм уже есть в общем списке (добавлен из подбора или вписан руками)
    const ex = items.find(x => x.status !== 'watched' && (x.tmdb === c.key || norm(x.title) === norm(c.title)))
    if (v === 'w') {
      const hisWants = his[c.key] === 'w' || ex?.votes.him === 'want'
      if (ex) {
        undo.item = ex
        setItems(xs => xs.map(x => (x.id === ex.id ? {
          ...x, tmdb: c.key, poster: x.poster ?? c.poster, year: x.year ?? c.year,
          votes: { ...x.votes, me: 'want' }, status: x.status === 'pending' && hisWants ? 'both' : x.status,
        } : x)))
      } else if (hisWants) {
        const id = Date.now()
        undo.newItem = id
        setItems(xs => [{ id, title: c.title, kind: c.kind, by: 'him', status: 'both', votes: { me: 'want', him: 'want' }, tmdb: c.key, poster: c.poster, year: c.year }, ...xs])
      }
      if (hisWants && (!ex || ex.status === 'pending')) { setMatch(c); sendEvent('movie_match', { title: c.title }) }
    }
    if (v === 'n' && ex && ex.status === 'pending' && !ex.votes.me) {
      undo.item = ex
      setItems(xs => xs.map(x => (x.id === ex.id ? { ...x, votes: { ...x.votes, me: 'no' } } : x)))
    }
    setRateSeen(null)
    if (v === 's' && !seen.some(x => x.by === 'me' && (x.tmdb === c.key || norm(x.title) === norm(c.title)))) {
      const id = Date.now()
      undo.newSeen = id
      setSeen(xs => [{ id, title: c.title, kind: c.kind, by: 'me', tmdb: c.key, poster: c.poster, year: c.year }, ...xs])
      setRateSeen({ id, title: c.title, stars: 0 })
    }
    setLast(undo)
  }

  // Свайп: карточка улетает, потом уходит из колоды
  function swipe(v: Sw, c = top) {
    if (!c || fly) return
    act(c, v)
    if (c.key !== top?.key) { setDeck(d => d.filter(x => x.key !== c.key)); return }
    setFly(v)
    setDrag(d => ({ ...d, on: false }))
    window.setTimeout(() => {
      setDeck(d => d.filter(x => x.key !== c.key))
      setFly(null)
      setDrag({ x: 0, y: 0, on: false })
    }, 260)
  }

  function undoLast() {
    if (!last || fly) return
    const { card, prev, item, newItem, newSeen } = last
    setSwipes(x => {
      const me = { ...(x.me ?? {}) }
      if (prev) me[card.key] = prev; else delete me[card.key]
      return { ...x, me }
    })
    if (item) setItems(xs => xs.map(x => (x.id === item.id ? item : x)))
    if (newItem) setItems(xs => xs.filter(x => x.id !== newItem))
    if (newSeen) setSeen(xs => xs.filter(x => x.id !== newSeen))
    setDeck(d => [card, ...d.filter(x => x.key !== card.key)])
    setLast(null); setRateSeen(null); setMatch(null)
  }

  function savePrefs() {
    setPrefsOpen(false)
    if (JSON.stringify(draft) === JSON.stringify(prefs)) return
    setPrefsAll(x => ({ ...x, me: draft }))
    prefsRef.current = draft
    gen.current++
    busy.current = false
    partnerSkip.current.clear()
    setDeck([]); setLast(null)
    setLoad('idle')
  }

  // ---------- Жесты ----------
  const onDown = (e: PointerEvent) => {
    if (fly) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    moved.current = false
    setDrag({ x: 0, y: 0, on: true })
  }
  const onMove = (e: PointerEvent) => {
    if (!start.current) return
    const x = e.clientX - start.current.x, y = e.clientY - start.current.y
    if (Math.abs(x) + Math.abs(y) > 8) moved.current = true
    setDrag({ x, y, on: true })
  }
  const onUp = () => {
    if (!start.current) return
    start.current = null
    const { x, y } = drag
    if (!moved.current) { setDrag({ x: 0, y: 0, on: false }); if (top) setInfo(top); return }
    if (x > 90) swipe('w')
    else if (x < -90) swipe('n')
    else if (y < -110 && Math.abs(x) < Math.abs(y)) swipe('s')
    else setDrag({ x: 0, y: 0, on: false })
  }
  const onCancel = () => { start.current = null; setDrag({ x: 0, y: 0, on: false }) }

  const fx = fly === 'w' ? 520 : fly === 'n' ? -520 : drag.x
  const fy = fly === 's' ? -820 : drag.y
  const pw = fly ? (fly === 'w' ? 1 : 0) : clamp01(drag.x / 90)
  const pn = fly ? (fly === 'n' ? 1 : 0) : clamp01(-drag.x / 90)
  const ps = fly ? (fly === 's' ? 1 : 0) : Math.abs(drag.x) < Math.abs(drag.y) ? clamp01(-drag.y / 110) : 0
  const pull = Math.min(1, Math.hypot(drag.x, drag.y) / 120)

  const seenWord = g.m('смотрел', 'смотрела')
  const wants = Object.keys(mine).filter(k => mine[k] === 'w')
  const matches = items.filter(x => x.tmdb && x.status === 'both').length
  const kindsOn = (Object.keys(KIND_PLURAL) as Kind[]).filter(k => (prefs.kinds[k] ?? '2') !== '0')

  const meta = (c: MCard) => [kindOf(c.kind).name, c.year, c.votes >= 20 ? `★ ${c.rating.toFixed(1)}` : ''].filter(Boolean).join(' · ')

  const cardBody = (c: DCard, live: boolean) => (
    <>
      <img className="mc-img" src={posterUrl(c.poster)} alt="" draggable={false} />
      {live && (
        <>
          <span className="mc-stamp want" style={{ opacity: pw }}>ХОЧУ</span>
          <span className="mc-stamp no" style={{ opacity: pn }}>НЕ ХОЧУ</span>
          <span className="mc-stamp seen" style={{ opacity: ps }}>{seenWord.toUpperCase()}</span>
        </>
      )}
      <div className="mc-info">
        {c.partner && <span className="mc-partner"><Img src="common/heart" size={16} />{name('him')} хочет</span>}
        <b>{c.title}</b>
        <div className="mc-meta">{meta(c)}</div>
        <p>{c.overview || (c.en ? 'Описания пока нет' : '')}</p>
      </div>
    </>
  )

  const deckMsg = (img: string, text: string, btn?: { label: string; on: () => void }) => (
    <div className="deck-msg">
      <Img src={img} />
      <span>{text}</span>
      {btn && <button className="btn sm soft" onClick={btn.on}>{btn.label}</button>}
    </div>
  )
  const retry = { label: 'Повторить', on: () => setLoad('idle') }

  return (
    <div className="screen discover">
      <Header title="Подбор" icon="watchlist/randomizer" onBack={() => s.go('together', 'watchlist')} />
      <div className="chips">
        <button className="chip" onClick={() => setWantsOpen(true)}><Img src="common/heart" />Хочу · {wants.length}</button>
        <button className="chip" onClick={() => openWatchlist(s, 'both')}><Img src="common/two_hearts" />Совпадения · {matches}</button>
        <button className="chip" onClick={() => { setDraft(prefs); setPrefsOpen(true) }}><Img src="common/sparkle" />Что предлагать</button>
      </div>

      <div className="deck">
        {deck[1] && !fly && <div className="mcard under" style={{ transform: `scale(${0.94 + 0.06 * pull}) translateY(${12 - 12 * pull}px)` }}>{cardBody(deck[1], false)}</div>}
        {deck[1] && fly && <div className="mcard under" style={{ transform: 'none' }}>{cardBody(deck[1], false)}</div>}
        {top ? (
          <div
            key={top.key}
            className="mcard top"
            role="button"
            aria-label={`${top.title}. Подробнее`}
            style={{ transform: `translate(${fx}px, ${fy}px) rotate(${fx / 16}deg)`, transition: drag.on ? 'none' : 'transform .26s ease' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
          >
            {cardBody(top, true)}
          </div>
        ) : !kindsOn.length ? deckMsg('watchlist/vote_maybe', 'Ничего не выбрано: включи хоть что-нибудь в «Что предлагать»', { label: 'Настроить', on: () => { setDraft(prefs); setPrefsOpen(true) } })
          : load === 'setup' ? deckMsg('watchlist/poster_placeholder', 'Каталог фильмов ещё не подключён: в Supabase нужна функция movies с ключом TMDB', retry)
          : load === 'offline' ? deckMsg('common/cloud', 'Нет интернета: карточки берутся из сети', retry)
          : load === 'error' ? deckMsg('common/raincloud', 'Каталог сейчас не ответил', retry)
          : load === 'empty' ? deckMsg('watchlist/empty_watchlist', 'По этим настройкам карточки кончились. Включи больше жанров или категорий', { label: 'Настроить', on: () => { setDraft(prefs); setPrefsOpen(true) } })
          : <div className="mcard skeleton"><Img src="watchlist/poster_placeholder" /><span>Подбираю…</span></div>}
        {rateSeen ? (
          <div className="deck-float rate-seen">
            <span className="small b">Как тебе «{rateSeen.title}»?</span>
            <Stars size={24} n={rateSeen.stars} onPick={n => {
              setSeen(xs => xs.map(x => (x.id === rateSeen.id ? { ...x, stars: n || undefined } : x)))
              setRateSeen({ ...rateSeen, stars: n })
            }} />
          </div>
        ) : top && !drag.on && !fly && Object.keys(mine).length < 3 ? (
          <div className="deck-float deck-hint">← не хочу · ↑ уже {seenWord} · хочу →</div>
        ) : null}
      </div>

      <div className="deck-btns">
        <button className="dbx" onClick={undoLast} disabled={!last || !!fly}><span className="db small">↶</span><small>вернуть</small></button>
        <button className="dbx" onClick={() => swipe('n')} disabled={!top}><span className="db no"><Img src="common/cross_badge" /></span><small>не хочу</small></button>
        <button className="dbx" onClick={() => swipe('s')} disabled={!top}><span className="db seen"><Img src="watchlist/status_watched" /></span><small>{seenWord}</small></button>
        <button className="dbx" onClick={() => swipe('w')} disabled={!top}><span className="db want"><Img src="common/heart" /></span><small>хочу</small></button>
        <button className="dbx" onClick={() => top && setInfo(top)} disabled={!top}><span className="db small">i</span><small>подробнее</small></button>
      </div>

      <Sheet open={!!match} onClose={() => setMatch(null)}>
        {match && (
          <div className="big-reward match">
            <Img src="common/two_hearts" />
            <h3 style={{ fontSize: 26 }}>Совпадение!</h3>
            <img className="match-poster" src={posterUrl(match.poster, 'w342')} alt="" />
            <p className="b">{name('him')} тоже хочет посмотреть «{match.title}»</p>
            <p className="small muted b">Уже в «Оба хотят» — можно выбрать на вечер</p>
            <button className="btn wide peach" onClick={() => { setMatch(null); openWatchlist(s, 'both') }}>Открыть «Оба хотят»</button>
            <button className="btn wide soft" onClick={() => setMatch(null)}>Листать дальше</button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!info} onClose={() => setInfo(null)} title={info?.title} tall>
        {info && (
          <div className="col" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <img className="info-poster" src={posterUrl(info.poster, 'w342')} alt="" />
              <div className="col" style={{ gap: 4 }}>
                {info.orig && info.orig !== info.title && <span className="small muted b">{info.orig}</span>}
                <span className="b">{meta(info)}</span>
                {info.votes >= 20 && <span className="small muted b">{plural(info.votes, 'оценка', 'оценки', 'оценок')} на TMDB: {info.votes.toLocaleString('ru-RU')}</span>}
                <span className="small b">{[...new Set(info.genres.filter(id => id !== 16).map(id => GENRE_NAME[id]).filter(Boolean))].join(', ')}</span>
                {info.partner && <span className="seen-tag"><Img src="common/heart" size={16} />{name('him')} хочет</span>}
              </div>
            </div>
            <p style={{ lineHeight: 1.45 }}>{info.overview || 'Описания пока нет'}</p>
            {info.key === top?.key && (
              <div className="deck-btns in-sheet">
                <button className="dbx" onClick={() => { setInfo(null); swipe('n') }}><span className="db no"><Img src="common/cross_badge" /></span><small>не хочу</small></button>
                <button className="dbx" onClick={() => { setInfo(null); swipe('s') }}><span className="db seen"><Img src="watchlist/status_watched" /></span><small>{seenWord}</small></button>
                <button className="dbx" onClick={() => { setInfo(null); swipe('w') }}><span className="db want"><Img src="common/heart" /></span><small>хочу</small></button>
              </div>
            )}
            <TmdbNote />
          </div>
        )}
      </Sheet>

      <Sheet open={wantsOpen} onClose={() => setWantsOpen(false)} title="Мои «хочу»" icon="common/heart" tall>
        <p className="small muted b">Когда {name('him')} тоже нажмёт «хочу», это попадёт в «Оба хотят».</p>
        <div className="col" style={{ gap: 8 }}>
          {wants.slice().reverse().map(k => {
            const c = cache[k]
            const both = his[k] === 'w'
            return (
              <div key={k} className="witem small">
                {c?.p ? <img className="poster" src={posterUrl(c.p, 'w185')} alt="" /> : <div className="poster" style={{ background: 'var(--card-2)' }} />}
                <div className="grow col" style={{ gap: 2, justifyContent: 'center' }}>
                  <b>{c?.t ?? 'Без названия'}</b>
                  <span className="small muted b">{[c ? kindOf(c.k).name : '', c?.y].filter(Boolean).join(' · ')}</span>
                  {both && <span className="seen-tag"><Img src="common/two_hearts" size={16} />совпадение</span>}
                </div>
                {!both && (
                  <button className="x-btn" aria-label="Передумал(а)" onClick={() => setSwipes(x => {
                    const me = { ...(x.me ?? {}) }; delete me[k]; return { ...x, me }
                  })}>×</button>
                )}
              </div>
            )
          })}
          {!wants.length && <div className="empty-col"><Img src="watchlist/empty_watchlist" />Пока пусто: свайпни вправо то, что хочешь посмотреть</div>}
        </div>
      </Sheet>

      <Sheet open={prefsOpen} onClose={savePrefs} title="Что предлагать" icon="common/sparkle" tall>
        <p className="small muted b">Настройки у каждого свои. «Чаще» — таких карточек будет больше, «нет» — не будет совсем.</p>
        <h4 className="pref-h">Категории</h4>
        {(Object.keys(KIND_PLURAL) as Kind[]).map(k => (
          <div key={k} className="pref-row">
            <Img src={KINDS.find(x => x.id === k)!.icon} size={30} />
            <b className="grow">{KIND_PLURAL[k]}</b>
            <LvlSeg value={draft.kinds[k] ?? '2'} onChange={v => setDraft(d => ({ ...d, kinds: { ...d.kinds, [k]: v } }))} />
          </div>
        ))}
        <h4 className="pref-h">Жанры</h4>
        {GROUPS.map(gr => (
          <div key={gr.id} className="pref-row">
            <b className="grow">{gr.name}</b>
            <LvlSeg value={draft.genres[gr.id] ?? '2'} onChange={v => setDraft(d => ({ ...d, genres: { ...d.genres, [gr.id as Group]: v } }))} />
          </div>
        ))}
        <button className="btn wide" onClick={savePrefs}>Готово</button>
        <TmdbNote />
      </Sheet>
    </div>
  )
}

function LvlSeg({ value, onChange }: { value: Lvl; onChange: (v: Lvl) => void }) {
  return (
    <div className="seg mini">
      {LVLS.map(l => <button key={l.id} type="button" className={l.id === value ? 'on' : ''} onClick={() => onChange(l.id)}>{l.name}</button>)}
    </div>
  )
}

// TMDB просит указывать, откуда данные
const TmdbNote = () => <p className="tmdb-note">Каталог, описания и постеры — TMDB (themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
