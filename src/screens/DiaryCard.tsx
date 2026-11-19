import { useStore, usePersist } from '../store'
import { Img, plural, useName, useG } from '../ui'
import { DI, type DReactId, type Who } from '../data'
import { dkey, human } from '../dates'

/* Дневник: у каждого своя тетрадь, страница — один день. Пишешь, когда хочется выговориться;
   партнёр читает и откликается реакцией или заметкой на полях — без переписки.
   Запись можно запечатать до выбранного дня: до тех пор партнёр видит только конверт с датой. */

// Отклик читателя на запись: реакция, заметка на полях, когда прочитал(а)
export interface DReact { r?: DReactId; note?: string; read?: string }
export interface DEntry {
  id: number
  by: Who
  day: string          // страница: день, когда написано
  at: string           // время, «09:40»
  text: string
  photo?: string
  hard?: boolean       // «мне было трудно это написать»
  openAt?: string      // партнёр увидит с этого дня
  edited?: boolean
  re?: Partial<Record<Who, DReact>>  // ключ — кто откликнулся
}

export const today = () => dkey(new Date())
export const isOpen = (e: DEntry) => !e.openAt || e.openAt <= today()

// Какие отклики партнёра на мои записи я уже видел(а) — помнит только этот телефон
const SEEN = 'pair.diary.seen'
const sig = (r?: DReact) => (r?.r || r?.note ? `${r.r ?? ''}|${r.note ?? ''}` : '')
function readSeen(): Record<string, string> { try { return JSON.parse(localStorage.getItem(SEEN) ?? '{}') } catch { return {} } }
export function markRepliesSeen(es: DEntry[]) {
  const m = readSeen()
  let ch = false
  for (const e of es) { const v = sig(e.re?.him); if (v && m[e.id] !== v) { m[e.id] = v; ch = true } }
  if (ch) try { localStorage.setItem(SEEN, JSON.stringify(m)) } catch { /* места нет — не страшно */ }
}

export function diaryNews(list: DEntry[]) {
  const theirs = list.filter(e => e.by === 'him')
  const seen = readSeen()
  return {
    unread: theirs.filter(e => isOpen(e) && !e.re?.me?.read),
    sealed: theirs.filter(e => !isOpen(e)).sort((a, b) => a.openAt!.localeCompare(b.openAt!)),
    replies: list.filter(e => e.by === 'me' && sig(e.re?.him) && seen[e.id] !== sig(e.re?.him)),
  }
}

// Открыть дневник сразу с новой записью
let writeNext = false
export const takeWriteNext = () => { const w = writeNext; writeNext = false; return w }

// Плашка на главной: тихая, пока нет нового
export function DiaryCard() {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [list] = usePersist<DEntry[]>('diary', [])
  const { unread, sealed, replies } = diaryNews(list)
  const n = unread.length
  const sub = n ? `${name('him')}: ${n} ${plural(n, 'новая запись', 'новые записи', 'новых записей')}`
    : replies.length ? `${name('him')} ${g.p('откликнулся', 'откликнулась')} на твою запись`
    : sealed.length ? `${name('him')} ${g.p('оставил', 'оставила')} запечатанную запись · откроется ${human(sealed[0].openAt)}`
    : 'Мысли по дням: выговориться, чтобы тебя лучше понимали'
  return (
    <div className={'card diary-card' + (n || replies.length ? ' new' : '')}>
      <button className="dc-main" onClick={() => s.go('home', 'diary')}>
        <span className="dc-ic"><Img src={n ? DI.bookNew : DI.book} />{n > 0 && <i className="dc-badge">{n}</i>}</span>
        <span className="grow">
          <b>Дневник</b>
          <small>{sub}</small>
        </span>
      </button>
      <button className="btn sm soft" onClick={() => { writeNext = true; s.go('home', 'diary') }}>Написать</button>
    </div>
  )
}
