import { cloud } from './sync'
import { MOVIES_FUNCTION } from './config'

/* Каталог фильмов, сериалов, аниме и мультиков для «Подбора» — база TMDB (themoviedb.org).
   Ключа TMDB в приложении нет: на телефоне запросы идут через функцию Supabase «movies» (ключ в её секретах),
   при разработке — через сервер разработки (vite.config.ts). */

export type Kind = 'movie' | 'series' | 'anime' | 'cartoon'
export type Media = 'movie' | 'tv'

// Карточка подбора. key — «m:123» (фильм) или «t:123» (сериал): у TMDB у фильмов и сериалов свои номера
export interface MCard {
  key: string; media: Media; id: number; kind: Kind
  title: string; orig: string; year?: number; poster: string; overview: string
  genres: number[]; rating: number; votes: number; lang: string
}

// Постеры отдаёт сам TMDB; w185 — для списков, w500 — для карточки
export const posterUrl = (path: string, size: 'w185' | 'w342' | 'w500' = 'w500') => `https://image.tmdb.org/t/p/${size}${path}`

export class TmdbError extends Error {
  constructor(public why: 'offline' | 'setup' | 'other', msg: string = why) { super(msg) }
}

export async function tmdb(path: string, params: Record<string, string | number> = {}): Promise<any> {
  if (import.meta.env.DEV) {
    const q = new URLSearchParams({ language: 'ru-RU', include_adult: 'false' })
    for (const [k, v] of Object.entries(params)) q.set(k, String(v))
    const r = await fetch(`/tmdb/3/${path}?${q}`).catch(() => { throw new TmdbError('offline') })
    // Без файла с ключом прокси нет, и сервер разработки отвечает страницей приложения
    if (!r.headers.get('content-type')?.includes('json')) throw new TmdbError('setup', 'нет файла .tmdb_dev_key')
    if (!r.ok) throw new TmdbError('other', `TMDB ${r.status}`)
    return r.json()
  }
  if (!cloud) throw new TmdbError('setup', 'нет облака')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new TmdbError('offline')
  const { data, error } = await cloud.functions.invoke(MOVIES_FUNCTION, { body: { path, params } })
  if (error) {
    const status = (error as any).context?.status as number | undefined
    // Функцию ещё не поставили (404) или в ней нет ключа (500 с «no TMDB_KEY»)
    let text = ''
    try { text = await (error as any).context?.text?.() } catch { /* нет тела */ }
    if (status === 404 || /TMDB_KEY/.test(text)) throw new TmdbError('setup', text || String(status))
    if ((error as any).name === 'FunctionsFetchError') throw new TmdbError('offline')
    throw new TmdbError('other', text || error.message)
  }
  return data
}

// Аниме — японская анимация, мультики — вся остальная
export function kindFor(media: Media, genres: number[], lang: string): Kind {
  if (genres.includes(16)) return lang === 'ja' ? 'anime' : 'cartoon'
  return media === 'movie' ? 'movie' : 'series'
}

// Строка из ответа TMDB (список discover или страница фильма) → карточка
export function toCard(media: Media, r: any): MCard | null {
  if (!r || !r.id) return null
  const genres: number[] = r.genre_ids ?? (r.genres ?? []).map((g: { id: number }) => g.id)
  const date: string = (media === 'movie' ? r.release_date : r.first_air_date) ?? ''
  const lang: string = r.original_language ?? ''
  return {
    key: (media === 'movie' ? 'm:' : 't:') + r.id, media, id: r.id,
    kind: kindFor(media, genres, lang),
    title: (media === 'movie' ? r.title : r.name) || (media === 'movie' ? r.original_title : r.original_name) || '',
    orig: (media === 'movie' ? r.original_title : r.original_name) ?? '',
    year: date ? Number(date.slice(0, 4)) || undefined : undefined,
    poster: r.poster_path ?? '',
    overview: (r.overview ?? '').trim(),
    genres, rating: r.vote_average ?? 0, votes: r.vote_count ?? 0, lang,
  }
}

export const cardByKey = async (key: string, language = 'ru-RU') => {
  const media: Media = key.startsWith('t:') ? 'tv' : 'movie'
  return toCard(media, await tmdb(`${media}/${key.slice(2)}`, { language }))
}

// ---------- Настройки подбора ----------
// Уровень: 0 — не предлагать, 1 — реже, 2 — обычно, 3 — чаще
export type Lvl = '0' | '1' | '2' | '3'
export const LVLS: { id: Lvl; name: string }[] = [
  { id: '0', name: 'нет' }, { id: '1', name: 'реже' }, { id: '2', name: 'обычно' }, { id: '3', name: 'чаще' },
]
export const KIND_WEIGHT: Record<Lvl, number> = { '0': 0, '1': 0.4, '2': 1, '3': 2.5 }

// Жанры TMDB у фильмов и сериалов разные — для настроек сводим их в общие группы
export type Group = 'comedy' | 'drama' | 'romance' | 'horror' | 'thriller' | 'crime' | 'scifi' | 'action' | 'family' | 'docs' | 'history'
export const GROUPS: { id: Group; name: string; movie: number[]; tv: number[] }[] = [
  { id: 'comedy', name: 'Комедии', movie: [35], tv: [35] },
  { id: 'romance', name: 'Про любовь', movie: [10749], tv: [] },
  { id: 'drama', name: 'Драмы', movie: [18], tv: [18] },
  { id: 'action', name: 'Боевики и приключения', movie: [28, 12], tv: [10759] },
  { id: 'scifi', name: 'Фантастика и фэнтези', movie: [878, 14], tv: [10765] },
  { id: 'thriller', name: 'Триллеры', movie: [53], tv: [] },
  { id: 'crime', name: 'Детективы', movie: [80, 9648], tv: [80, 9648] },
  { id: 'horror', name: 'Ужасы', movie: [27], tv: [] },
  { id: 'family', name: 'Семейное', movie: [10751], tv: [10751] },
  { id: 'history', name: 'История и война', movie: [36, 10752], tv: [10768] },
  { id: 'docs', name: 'Документальное', movie: [99], tv: [99] },
]
export const GENRE_NAME: Record<number, string> = {
  28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия', 80: 'криминал', 99: 'документальный', 18: 'драма',
  10751: 'семейный', 14: 'фэнтези', 36: 'история', 27: 'ужасы', 10402: 'музыка', 9648: 'детектив', 10749: 'мелодрама',
  878: 'фантастика', 10770: 'телефильм', 53: 'триллер', 10752: 'военный', 37: 'вестерн', 10759: 'боевик',
  10762: 'детский', 10763: 'новости', 10764: 'реалити', 10765: 'фантастика', 10766: 'мыльная опера', 10767: 'ток-шоу', 10768: 'война и политика',
}

export interface Prefs { kinds: Partial<Record<Kind, Lvl>>; genres: Partial<Record<Group, Lvl>> }
export const NO_PREFS: Prefs = { kinds: {}, genres: {} }
const lvlOf = (p: Prefs, k: Kind) => p.kinds[k] ?? '2'
const gl = (p: Prefs, g: Group) => p.genres[g] ?? '2'

// Подходит ли карточка под настройки (для того, что пришло не из подбора, — например, «хочет партнёр»)
export function allowed(c: MCard, p: Prefs) {
  if (KIND_WEIGHT[lvlOf(p, c.kind)] === 0) return false
  const banned = new Set(GROUPS.filter(g => gl(p, g.id) === '0').flatMap(g => [...g.movie, ...g.tv]))
  return !c.genres.some(g => banned.has(g))
}

// ---------- Откуда берём карточки ----------
// Источник — запрос discover; страницу каждый раз берём случайную, чтобы колода не повторялась
interface Src { media: Media; params: Record<string, string | number>; pages: number; w: number; only?: 'ja' | 'not-ja' }

const MOVIE_BAN = [99, 10770, 16]            // в «Фильмах» нет документалок, телефильмов и анимации
const TV_BAN = [16, 10762, 10763, 10764, 10766, 10767]  // в «Сериалах» нет анимации, детского, новостей, реалити, мыла и ток-шоу

function bannedFor(media: Media, p: Prefs) {
  return GROUPS.filter(g => gl(p, g.id) === '0').flatMap(g => g[media])
}

export function sourcesFor(kind: Kind, p: Prefs): Src[] {
  const out: Src[] = []
  const add = (media: Media, params: Record<string, string | number>, pages: number, w = 1, only?: Src['only']) => {
    const own = String(params.without_genres ?? '').split(',').filter(Boolean).map(Number)
    const ban = [...new Set([...own, ...(media === 'movie' && kind === 'movie' ? MOVIE_BAN : media === 'tv' && kind === 'series' ? TV_BAN : []), ...bannedFor(media, p)])]
    if (ban.length) params = { ...params, without_genres: ban.filter(id => !String(params.with_genres ?? '').split(/[,|]/).includes(String(id))).join(',') }
    out.push({ media, params: { sort_by: 'popularity.desc', ...params }, pages, w, only })
  }
  // Любимые жанры: отдельные источники, чтобы их было заметно больше
  const fav = GROUPS.filter(g => gl(p, g.id) === '3')
  if (kind === 'movie') {
    add('movie', { 'vote_count.gte': 300 }, 30)
    add('movie', { 'vote_count.gte': 3000, sort_by: 'vote_average.desc' }, 20, 0.6)
    for (const g of fav) if (g.movie.length) add('movie', { 'vote_count.gte': 200, with_genres: g.movie.join('|') }, 15, 1.2)
  }
  if (kind === 'series') {
    add('tv', { 'vote_count.gte': 200 }, 25)
    add('tv', { 'vote_count.gte': 1500, sort_by: 'vote_average.desc' }, 10, 0.6)
    for (const g of fav) if (g.tv.length) add('tv', { 'vote_count.gte': 100, with_genres: g.tv.join('|') }, 10, 1.2)
  }
  if (kind === 'anime') {
    add('tv', { 'vote_count.gte': 100, with_genres: 16, with_original_language: 'ja' }, 20)
    add('movie', { 'vote_count.gte': 150, with_genres: 16, with_original_language: 'ja' }, 10, 0.5)
    for (const g of fav) if (g.tv.length) add('tv', { 'vote_count.gte': 50, with_genres: `16,${g.tv[0]}`, with_original_language: 'ja' }, 5, 0.8)
  }
  if (kind === 'cartoon') {
    add('movie', { 'vote_count.gte': 500, with_genres: 16 }, 20, 1, 'not-ja')
    add('tv', { 'vote_count.gte': 300, with_genres: 16, without_genres: 10762 }, 8, 0.5, 'not-ja')
    for (const g of fav) if (g.movie.length) add('movie', { 'vote_count.gte': 200, with_genres: `16,${g.movie[0]}` }, 5, 0.8, 'not-ja')
  }
  return out
}

const pick = <T,>(xs: T[], w: (x: T) => number): T | undefined => {
  const total = xs.reduce((a, x) => a + w(x), 0)
  let r = Math.random() * total
  for (const x of xs) { r -= w(x); if (r < 0) return x }
  return xs[xs.length - 1]
}
const shuffle = <T,>(xs: T[]) => { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]] } return xs }

// Сколько страниц на самом деле у источника (узнаём после первого ответа) и какие уже брали
const realPages = new Map<string, number>()
const usedPages = new Set<string>()

// Следующая пачка карточек по настройкам. skip — что не показывать (уже листали, уже в списках)
export async function fetchBatch(p: Prefs, skip: (c: MCard) => boolean): Promise<MCard[]> {
  const kinds = (['movie', 'series', 'anime', 'cartoon'] as Kind[]).filter(k => KIND_WEIGHT[lvlOf(p, k)] > 0)
  if (!kinds.length) return []
  const rare = new Set(GROUPS.filter(g => gl(p, g.id) === '1').flatMap(g => [...g.movie, ...g.tv]))
  const banned = new Set(GROUPS.filter(g => gl(p, g.id) === '0').flatMap(g => [...g.movie, ...g.tv]))
  for (let attempt = 0; attempt < 4; attempt++) {
    const kind = pick(kinds, k => KIND_WEIGHT[lvlOf(p, k)])!
    const src = pick(sourcesFor(kind, p), s => s.w)!
    const sig = src.media + JSON.stringify(src.params)
    const max = Math.min(src.pages, realPages.get(sig) ?? src.pages)
    let page = 1 + Math.floor(Math.random() * max)
    for (let i = 0; i < 5 && usedPages.has(sig + page); i++) page = 1 + Math.floor(Math.random() * max)
    usedPages.add(sig + page)
    const res = await tmdb(`discover/${src.media}`, { ...src.params, page })
    if (res?.total_pages) realPages.set(sig, Math.min(500, res.total_pages))
    const cards = ((res?.results ?? []) as any[])
      .map(r => toCard(src.media, r))
      .filter((c): c is MCard => !!c && !!c.poster && !!c.title)
      .filter(c => c.kind === kind)
      .filter(c => !src.only || (src.only === 'ja' ? c.lang === 'ja' : c.lang !== 'ja'))
      .filter(c => !c.genres.some(g => banned.has(g)))
      .filter(c => !(c.genres.some(g => rare.has(g)) && Math.random() < 0.6))
      .filter(c => !skip(c))
    if (cards.length) return shuffle(cards)
  }
  return []
}
