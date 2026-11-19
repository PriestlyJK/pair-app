import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Seg, PhotoPick, shrinkImage, plural, useName, useG } from '../ui'
import { DI, type DReactId, type Who } from '../data'
import { addDays, fromKey, human, humanY } from '../dates'
import { sendEvent } from '../sync'
import { saveImage, useImg, dropImg } from '../photos'
import type { Topic } from './TogetherSections'
import { diaryNews, isOpen, markRepliesSeen, takeWriteNext, today, type DEntry } from './DiaryCard'
import caveatCyr from '@fontsource/caveat/files/caveat-cyrillic-600-normal.woff2?url'
import caveatLat from '@fontsource/caveat/files/caveat-latin-600-normal.woff2?url'

// Рукописный шрифт для заметок на полях и дат — грузится, только когда открыли дневник
let fontsAdded = false
function useHandFont() {
  useEffect(() => {
    if (fontsAdded || typeof FontFace === 'undefined') return
    fontsAdded = true
    const faces: [string, string][] = [
      [caveatCyr, 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'],
      [caveatLat, 'U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC, U+2122, U+2212'],
    ]
    for (const [url, unicodeRange] of faces) {
      const f = new FontFace('Caveat', `url(${url}) format('woff2')`, { weight: '600', unicodeRange })
      document.fonts.add(f)
      f.load().catch(() => {})
    }
  }, [])
}

const REACTS: { id: DReactId; btn: string; got: string }[] = [
  { id: 'hug', btn: 'Обнимаю', got: 'обнимает' },
  { id: 'understand', btn: 'Понимаю', got: 'понимает' },
  { id: 'thanks', btn: 'Спасибо', got: 'говорит спасибо' },
  { id: 'talk', btn: 'Обсудим', got: 'хочет поговорить об этом' },
]
const gotOf = (r: DReactId) => REACTS.find(x => x.id === r)!.got
const LATER = [{ n: 1, name: 'Завтра' }, { n: 3, name: 'Через 3 дня' }, { n: 7, name: 'Через неделю' }, { n: 30, name: 'Через месяц' }]

interface Draft { id?: number; text: string; photo?: string; hard: boolean; when: 'now' | 'later'; openAt: string }
const DRAFT = 'pair.diary.draft'
const blank = (): Draft => ({ text: '', hard: false, when: 'now', openAt: addDays(today(), 1) })
function loadDraft(): Draft {
  try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? 'null'); if (d && typeof d.text === 'string') return { ...blank(), ...d, id: undefined } } catch { /* нет черновика */ }
  return blank()
}
const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const weekday = (k: string) => fromKey(k).toLocaleDateString('ru-RU', { weekday: 'long' })
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

function Photo({ r }: { r: string }) {
  const src = useImg(r)
  return src ? <img className="de-photo" src={src} alt="" /> : <div className="de-photo empty" />
}

export default function Diary() {
  const s = useStore()
  const g = useG()
  const name = useName()
  useHandFont()
  const [list, setList] = usePersist<DEntry[]>('diary', [])
  const [moods] = usePersist<Partial<Record<Who, Record<string, { mood?: string }>>>>('moods', { me: {}, him: {} })
  const [, setTopics] = usePersist<Topic[]>('topics', [])
  const news = diaryNews(list)
  const [draft, setDraft] = useState<Draft | null>(() => (takeWriteNext() ? loadDraft() : null))
  const [who, setWho] = useState<Who>(() => (news.unread.length && !draft ? 'him' : 'me'))
  const [dayBy, setDayBy] = useState<Partial<Record<Who, string>>>({})
  const [allOpen, setAllOpen] = useState(false)
  const [noteFor, setNoteFor] = useState<{ id: number; text: string } | null>(null)
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)

  const book = useMemo(() => list.filter(e => e.by === who).sort((a, b) => a.id - b.id), [list, who])
  const days = useMemo(() => [...new Set(book.map(e => e.day))].sort(), [book])
  // Партнёрскую тетрадь открываем на первой непрочитанной странице, свою — на последней
  useEffect(() => {
    if (dayBy[who] && days.includes(dayBy[who]!)) return
    const first = who === 'him' ? book.find(e => isOpen(e) && !e.re?.me?.read)?.day : undefined
    const d = first ?? days[days.length - 1]
    if (d) setDayBy(x => ({ ...x, [who]: d }))
  }, [who, days]) // eslint-disable-line react-hooks/exhaustive-deps
  const day = dayBy[who] && days.includes(dayBy[who]!) ? dayBy[who]! : days[days.length - 1]
  const idx = day ? days.indexOf(day) : -1
  const prev = days[idx - 1], next = days[idx + 1]
  const page = book.filter(e => e.day === day)
  const go = (d?: string) => { if (d) { setDayBy(x => ({ ...x, [who]: d })); setNoteFor(null); window.scrollTo({ top: 0 }) } }

  // Прочитанное отмечаем, а отклики на свои записи — запоминаем как увиденные
  useEffect(() => {
    if (!day) return
    if (who === 'me') { markRepliesSeen(page); return }
    const ids = page.filter(e => isOpen(e) && !e.re?.me?.read).map(e => e.id)
    if (!ids.length) return
    const t = window.setTimeout(() => {
      const at = new Date().toISOString()
      setList(xs => xs.map(x => (ids.includes(x.id) ? { ...x, re: { ...x.re, me: { ...x.re?.me, read: at } } } : x)))
    }, 700)
    return () => clearTimeout(t)
  }, [who, day, page.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Черновик новой записи живёт на телефоне, пока не записали
  useEffect(() => {
    if (!draft || draft.id) return
    try { if (draft.text || draft.photo) localStorage.setItem(DRAFT, JSON.stringify(draft)); else localStorage.removeItem(DRAFT) } catch { /* нет места */ }
  }, [draft])

  const patch = (id: number, f: (e: DEntry) => DEntry) => setList(xs => xs.map(x => (x.id === id ? f(x) : x)))

  function react(e: DEntry, r: DReactId) {
    const nr = e.re?.me?.r === r ? undefined : r
    patch(e.id, x => ({ ...x, re: { ...x.re, me: { ...x.re?.me, r: nr } } }))
    if (!nr) return
    sendEvent('diary_react', { r: nr, day: e.day })
    if (nr === 'talk') {
      setTopics(ts => [{ id: Date.now(), text: `Поговорить о записи из дневника за ${human(e.day)}`, by: 'me', date: today() }, ...ts])
      s.toast('Добавлено в «Важные темы»', DI.talk)
    }
  }
  function saveNote() {
    if (!noteFor) return
    const e = list.find(x => x.id === noteFor.id)
    const t = noteFor.text.trim() || undefined
    setNoteFor(null)
    if (!e || t === e.re?.me?.note) return
    patch(e.id, x => ({ ...x, re: { ...x.re, me: { ...x.re?.me, note: t } } }))
    if (t) sendEvent('diary_note', { day: e.day })
  }

  async function addPhoto(f: File) {
    setBusy(true)
    try {
      const ref = await saveImage(`diary-${Date.now()}`, await shrinkImage(f, 1080, false, 0.75))
      if (ref) setDraft(d => (d ? { ...d, photo: ref } : d))
      else s.toast('Нет сети: фото не сохранилось', 'common/cloud')
    } finally { setBusy(false) }
  }
  function openEdit(e: DEntry) {
    setSure(false)
    setDraft({ id: e.id, text: e.text, photo: e.photo, hard: !!e.hard, when: e.openAt && !isOpen(e) ? 'later' : 'now', openAt: e.openAt && !isOpen(e) ? e.openAt : addDays(today(), 1) })
  }
  function save() {
    if (!draft || (!draft.text.trim() && !draft.photo)) return
    const t = today()
    const openAt = draft.when === 'later' && draft.openAt > t ? draft.openAt : undefined
    const body = { text: draft.text.trim(), photo: draft.photo, hard: draft.hard || undefined, openAt }
    if (draft.id) {
      const old = list.find(x => x.id === draft.id)
      patch(draft.id, x => ({ ...x, ...body, edited: x.edited || x.text !== body.text || undefined }))
      if (old?.photo && old.photo !== draft.photo) dropImg(old.photo)
    } else {
      setList(xs => [...xs, { id: Date.now(), by: 'me', day: t, at: hhmm(), ...body }])
      try { localStorage.removeItem(DRAFT) } catch { /* нечего чистить */ }
      setDayBy(x => ({ ...x, me: t }))
    }
    setDraft(null); setWho('me')
    s.toast(openAt ? `Запечатано: ${name('him')} прочитает ${human(openAt)}` : `Записано. ${g.He} сможет прочитать`, openAt ? DI.sealed : DI.book)
  }
  function remove() {
    if (!draft?.id) return
    if (!sure) { setSure(true); return }
    const e = list.find(x => x.id === draft.id)
    setList(xs => xs.filter(x => x.id !== draft.id))
    if (e?.photo) dropImg(e.photo)
    setDraft(null)
  }

  // Листать страницы свайпом в сторону (вертикально страница прокручивается как обычно)
  const sw = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: PointerEvent) => { if (e.pointerType !== 'mouse') sw.current = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    const st = sw.current; sw.current = null
    if (!st) return
    const dx = e.clientX - st.x, dy = e.clientY - st.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? next : prev)
  }

  const mood = day ? moods[who]?.[day]?.mood : undefined
  const hisName = name('him')

  const entry = (e: DEntry) => {
    const mine = e.by === 'me'
    if (!mine && !isOpen(e)) {
      return (
        <article key={e.id} className="dentry sealed">
          <Img src={DI.sealed} size={54} />
          <div>
            <b>Запечатанная запись</b>
            <span className="small muted b">{hisName} {g.p('написал', 'написала')} её в {e.at}. Откроется {human(e.openAt)}</span>
          </div>
        </article>
      )
    }
    const mr = e.re?.me ?? {}
    const hr = e.re?.him ?? {}
    return (
      <article key={e.id} className={'dentry' + (e.hard ? ' hard' : '')}>
        <div className="de-head">
          <span>{e.at}{e.edited ? ' · изменено' : ''}</span>
          {mine && <button className="linkish" onClick={() => openEdit(e)}>изменить</button>}
        </div>
        {mine && e.openAt && !isOpen(e) && (
          <span className="seen-tag"><Img src={DI.sealed} size={18} />запечатано · {hisName} увидит {human(e.openAt)}</span>
        )}
        {e.hard && (
          <div className="de-hard">
            <Img src={DI.hard} size={22} />
            {mine ? 'Отмечено: было трудно это написать' : `${cap(g.to)} было трудно это написать. Прочитай бережно`}
          </div>
        )}
        {e.text && <p className="de-text">{e.text}</p>}
        {e.photo && <Photo r={e.photo} />}

        {mine ? (
          (hr.r || hr.note || hr.read) && (
            <div className="de-got">
              {hr.r && <span className="seen-tag"><Img src={DI[hr.r]} size={18} />{hisName} {gotOf(hr.r)}</span>}
              {hr.note && <div className="de-note"><small>{hisName} на полях:</small>{hr.note}</div>}
              {!hr.r && !hr.note && hr.read && <span className="de-read">✓ {g.p('прочитал', 'прочитала')}</span>}
            </div>
          )
        ) : (
          <>
            <div className="de-react">
              {REACTS.map(r => (
                <button key={r.id} className={mr.r === r.id ? 'on' : ''} onClick={() => react(e, r.id)}>
                  <Img src={DI[r.id]} /><span>{r.btn}</span>
                </button>
              ))}
            </div>
            {noteFor?.id === e.id ? (
              <div className="de-note-edit">
                <textarea className="input" autoFocus maxLength={200} rows={2} placeholder="Пара слов на полях…" value={noteFor.text} onChange={x => setNoteFor({ id: e.id, text: x.target.value })} />
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm soft grow" onClick={() => setNoteFor(null)}>Отмена</button>
                  <button className="btn sm grow" onClick={saveNote}>{noteFor.text.trim() ? 'Оставить' : 'Убрать заметку'}</button>
                </div>
              </div>
            ) : mr.note ? (
              <button className="de-note" onClick={() => setNoteFor({ id: e.id, text: mr.note ?? '' })}><small>твоя заметка на полях:</small>{mr.note}</button>
            ) : (
              <button className="linkish" style={{ alignSelf: 'flex-start' }} onClick={() => setNoteFor({ id: e.id, text: '' })}>✎ заметка на полях</button>
            )}
          </>
        )}
      </article>
    )
  }

  const unreadN = news.unread.length
  return (
    <div className="screen diary">
      <Header title="Дневник" icon={DI.book} onBack={() => s.go('home')} />
      <Seg value={who} onChange={w => { setWho(w); setNoteFor(null) }} options={[
        { id: 'me', name: 'Моя тетрадь' },
        { id: 'him', name: <>{hisName}{unreadN > 0 && <i className="dot-n">{unreadN}</i>}</> },
      ]} />

      {day ? (
        <>
          <div className="dpage" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { sw.current = null }}>
            <div className="dp-date">
              <div className="grow">
                <b>{humanY(day)}</b>
                <span>{day === today() ? 'сегодня' : weekday(day)}</span>
              </div>
              {mood && <Img src={'calendar/mood/mood_' + mood} size={40} />}
            </div>
            {page.map(entry)}
          </div>
          <div className="dnav">
            <button className="x-btn" disabled={!prev} onClick={() => go(prev)} aria-label="Страница раньше">‹</button>
            <button className="dnav-mid" onClick={() => setAllOpen(true)}>страница {idx + 1} из {days.length} ▾</button>
            <button className="x-btn" disabled={!next} onClick={() => go(next)} aria-label="Страница позже">›</button>
          </div>
        </>
      ) : (
        <div className="empty-col diary-empty">
          <Img src={DI.empty} />
          {who === 'me'
            ? <>Здесь можно выговориться: о том, что трудно сказать вслух, и о моментах дня. {hisName} прочитает и сможет лучше тебя понять.<button className="btn" onClick={() => setDraft(loadDraft())}>Написать</button></>
            : `${hisName} пока ничего не ${g.p('написал', 'написала')}. Тетрадь у каждого своя.`}
        </div>
      )}

      <button className="fab" aria-label="Написать" onClick={() => { setSure(false); setDraft(loadDraft()) }}>+</button>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Изменить запись' : `Запись · ${human(today())}`} icon={DI.pen} tall>
        {draft && (
          <>
            <textarea className="input dwrite" autoFocus={!draft.id} placeholder="Что на душе…" value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} />
            {draft.photo ? (
              <div className="dw-photo"><Photo r={draft.photo} /><button className="x-btn" aria-label="Убрать фото" onClick={() => setDraft({ ...draft, photo: undefined })}>×</button></div>
            ) : (
              <PhotoPick onPick={addPhoto} className="btn sm soft"><Img src="common/camera" />{busy ? 'Сохраняю…' : 'Фото'}</PhotoPick>
            )}
            <label className="dtoggle">
              <input type="checkbox" checked={draft.hard} onChange={e => setDraft({ ...draft, hard: e.target.checked })} />
              <span className="sw" />
              <span className="grow">
                <b>Мне было трудно это написать</b>
                <small>{hisName} увидит пометку и прочитает бережно</small>
              </span>
            </label>
            <div className="col" style={{ gap: 8 }}>
              <span className="small muted b">Когда {hisName} увидит</span>
              <Seg value={draft.when} onChange={w => setDraft({ ...draft, when: w })} options={[{ id: 'now', name: 'Сразу' }, { id: 'later', name: 'Позже' }]} />
              {draft.when === 'later' && (
                <>
                  <div className="chips">
                    {LATER.map(l => {
                      const k = addDays(today(), l.n)
                      return <button key={l.n} className={'chip sm' + (draft.openAt === k ? ' on' : '')} onClick={() => setDraft({ ...draft, openAt: k })}>{l.name}</button>
                    })}
                    <input className="chip sm date" type="date" min={addDays(today(), 1)} value={draft.openAt} onChange={e => e.target.value && setDraft({ ...draft, openAt: e.target.value })} />
                  </div>
                  <span className="small muted b">До {human(draft.openAt)} {hisName} увидит только запечатанный конверт с датой</span>
                </>
              )}
            </div>
            <button className="btn wide" disabled={!draft.text.trim() && !draft.photo} onClick={save}>{draft.id ? 'Сохранить' : draft.when === 'later' ? 'Запечатать' : 'Записать'}</button>
            {draft.id && <button className="btn wide soft" onClick={remove}>{sure ? 'Точно удалить? Нажми ещё раз' : 'Удалить запись'}</button>}
          </>
        )}
      </Sheet>

      <Sheet open={allOpen} onClose={() => setAllOpen(false)} title={who === 'me' ? 'Моя тетрадь' : `Тетрадь: ${hisName}`} icon={DI.book} tall>
        <div className="col" style={{ gap: 8 }}>
          {[...days].reverse().map(d => {
            const es = book.filter(e => e.day === d)
            const open = es.filter(e => e.by === 'me' || isOpen(e))
            const unread = who === 'him' && open.some(e => !e.re?.me?.read)
            const first = open.find(e => e.text)?.text ?? ''
            return (
              <button key={d} className={'dlist' + (d === day ? ' on' : '')} onClick={() => { go(d); setAllOpen(false) }}>
                <span className="grow">
                  <b>{humanY(d)}</b>{unread && <i className="dot-n">new</i>}
                  <small>{first ? first.slice(0, 80) : open.length ? 'фото' : 'запечатано'}</small>
                </span>
                <span className="small muted b">{es.length} {plural(es.length, 'запись', 'записи', 'записей')}</span>
              </button>
            )
          })}
        </div>
      </Sheet>
    </div>
  )
}
