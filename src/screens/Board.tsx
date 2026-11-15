import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Img, Coin, Bar, Ava, Sheet, Header, Seg, useName, plural, useG } from '../ui'
import { COLUMNS, LABELS, PRIO_NAME, TYPE_ICON, TYPE_NAME, type Assignee, type Prio, type Task, type TaskType } from '../data'
import { sendEvent } from '../sync'
import { TODAY_KEY, addDays, diffDays, human, isSunday, isoWeek, short, weekEnd, weekStart } from '../dates'

type Filter = 'all' | 'me' | 'him' | 'both'
const FILTERS: { id: Filter; name: string }[] = [
  { id: 'all', name: 'Все' },
  { id: 'me', name: 'Мои' },
  { id: 'him', name: 'Его' },
  { id: 'both', name: 'Вместе' },
]

const hasDl = (t: Task) => typeof t.deadline === 'string'
const overdue = (t: Task) => t.status !== 'done' && hasDl(t) && t.deadline! < TODAY_KEY
const reward = (t: Task) => (overdue(t) ? Math.ceil(t.price / 2) : t.price)
const WEEK0 = weekStart(TODAY_KEY)
// Сколько недель задача висит в спринте не закрытой
const carriedOf = (t: Task) => (t.status !== 'done' && t.status !== 'backlog' && t.since ? Math.max(0, Math.round(diffDays(WEEK0, weekStart(t.since)) / 7)) : 0)
// Закрытые на прошлых неделях не показываем в спринте этой недели
const inSprint = (t: Task) => t.status !== 'backlog' && (t.status !== 'done' || !t.doneAt || t.doneAt >= WEEK0)
const earnedBy = (ts: Task[], w: 'me' | 'him') => ts.filter(t => t.status === 'done' && t.doneAt && t.doneAt >= WEEK0 && (t.assignee === w || t.assignee === 'both')).reduce((a, t) => a + reward({ ...t, status: 'todo', deadline: t.deadline && t.doneAt! > t.deadline ? t.deadline : undefined }), 0)

function TaskCard({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const cl = t.checklist
  return (
    <button className={`tcard ${t.type} ${t.status === 'done' ? 'done' : ''}`} onClick={onOpen}>
      <div className="t-top">
        <Img src={TYPE_ICON[t.type]} className="type" />
        {t.labels.map(l => (
          <span key={l} className="tag"><Img src={LABELS[l].icon} />{LABELS[l].name}</span>
        ))}
        {t.prio !== 'normal' && <span className={'prio-tag ' + t.prio}>{PRIO_NAME[t.prio]}</span>}
      </div>
      <div className="t-title">{t.title}</div>
      {t.epic && (
        <div className="row" style={{ gap: 8 }}>
          <div className="grow"><Bar value={t.epic.done} max={t.epic.total} thin color="linear-gradient(90deg,#D5CEF2,#9C93D6)" /></div>
          <span className="small b muted">{t.epic.done}/{t.epic.total}</span>
        </div>
      )}
      <div className="t-bot">
        <Ava who={t.assignee} size={24} />
        {hasDl(t) && (
          <span className={'tag' + (overdue(t) ? ' red' : '')}>
            <Img src={overdue(t) ? 'tracker/overdue' : 'tracker/deadline'} />
            {t.deadline === TODAY_KEY ? 'сегодня' : t.deadline === addDays(TODAY_KEY, 1) ? 'завтра' : short(t.deadline!)}
          </span>
        )}
        {carriedOf(t) > 0 && <span className="tag"><Img src="tracker/carried_over" />×{carriedOf(t) + 1}</span>}
        {cl && <span className="tag plain">☑ {cl.filter(c => c.done).length}/{cl.length}</span>}
        {t.photo && <span className="tag"><Img src="common/camera" />фото</span>}
        <Coin n={t.price} size={20} />
      </div>
    </button>
  )
}

export default function Board() {
  const g = useG()
  const s = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState<Task | null>(null)
  const [summary, setSummary] = useState(false)

  const name = useName()
  const visible = s.tasks.filter(t => t.status === 'backlog' || inSprint(t))
  const shown = visible.filter(t => filter === 'all' || t.assignee === filter || (filter !== 'both' && t.assignee === 'both'))
  const sprint = s.tasks.filter(inSprint)
  const left = diffDays(weekEnd(TODAY_KEY), TODAY_KEY)
  const doneCount = sprint.filter(t => t.status === 'done').length
  const task = s.tasks.find(t => t.id === open)
  const colsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = colsRef.current?.children[1] as HTMLElement | undefined
    if (el && colsRef.current) colsRef.current.scrollLeft = el.offsetLeft - 16
  }, [])

  function move(t: Task, status: Task['status']) {
    s.setTasks(ts => ts.map(x => (x.id === t.id ? { ...x, status, since: x.since ?? (status !== 'backlog' ? TODAY_KEY : undefined), doneAt: status === 'done' ? TODAY_KEY : undefined } : x)))
    if (status === 'done') {
      setOpen(null)
      setDone(t)
      sendEvent('task', { title: t.title })
      const r = reward(t)
      setTimeout(() => s.earn(r, overdue(t) ? `+${r} · просрочка, половина` : `+${r} за задачу`), 300)
    }
  }

  return (
    <div className="screen">
      <Header title="Доска" sub={`Неделя ${isoWeek(TODAY_KEY)} · ${short(WEEK0)} – ${short(weekEnd(TODAY_KEY))}`} right={<button className="coin-pill" onClick={() => s.openShop()}><Img src="coins/coin" /> {s.coins.me}</button>} />

      {isSunday(TODAY_KEY) && sprint.length > 0 && (
        <button className="sunday" onClick={() => setSummary(true)}>
          <Img src="tracker/sprint_podium" />
          <div className="grow">
            <div className="b">Сегодня итоги недели</div>
            <div className="small muted b">Кто звезда недели и ретро на 3 вопроса</div>
          </div>
          <span className="b" style={{ fontSize: 22, color: 'var(--wood)' }}>›</span>
        </button>
      )}

      {s.tasks.length === 0 ? (
        <div className="card col" style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <Img src="tracker/empty_board" size={96} />
          <b>Доска пока пустая</b>
          <span className="small muted b">Добавляйте задачи на неделю: за каждую закрытую — монеты. В воскресенье подводите итоги.</span>
          <button className="btn" onClick={() => setCreating(true)}>Первая задача</button>
        </div>
      ) : (
        <div className="card sprint">
          <div className="row">
            <b className="grow">Спринт: {doneCount} из {sprint.length}</b>
            <span className="small muted b">{left === 0 ? 'последний день' : `ещё ${left} ${plural(left, 'день', 'дня', 'дней')}`}</span>
          </div>
          <Bar value={doneCount} max={Math.max(1, sprint.length)} color="linear-gradient(90deg,#C8DDB9,#7FA66E)" />
          <div className="who">
            <div><Ava who="me" size={28} /><div className="grow"><div className="small muted b">{name('me')} за неделю</div><Coin n={earnedBy(s.tasks, 'me')} /></div></div>
            <div><Ava who="him" size={28} /><div className="grow"><div className="small muted b">{name('him')} за неделю</div><Coin n={earnedBy(s.tasks, 'him')} /></div></div>
          </div>
        </div>
      )}

      <div className="chips">
        {FILTERS.map(f => (f.id === 'him' ? { ...f, name: g.named ? name('him') : g.His } : f)).map(f => (
          <button key={f.id} className={'chip' + (f.id === filter ? ' on' : '')} onClick={() => setFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="cols" ref={colsRef}>
        {COLUMNS.map(c => {
          const list = shown.filter(t => t.status === c.id)
          return (
            <section key={c.id} className="column">
              <div className="col-h"><Img src={c.icon} />{c.name}<span className="cnt">{list.length}</span></div>
              {list.map(t => <TaskCard key={t.id} t={t} onOpen={() => setOpen(t.id)} />)}
              {!list.length && (
                <div className="empty-col">
                  <Img src={c.id === 'done' ? 'tracker/all_done' : 'tracker/empty_board'} />
                  {c.id === 'done' ? 'Тут появятся закрытые задачи' : 'Пусто'}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <button className="fab" onClick={() => setCreating(true)} aria-label="Новая задача">+</button>

      <Sheet open={!!task} onClose={() => setOpen(null)} title={task?.title} icon={task ? TYPE_ICON[task.type] : undefined}>
        {task && <TaskDetail t={task} onMove={st => move(task, st)} />}
      </Sheet>

      <Sheet open={!!done} onClose={() => setDone(null)}>
        {done && (
          <>
            <div className="big-reward">
              <Img src="coins/coin_pile" />
              <h3 style={{ fontSize: 22 }}>+{reward(done)} {done.assignee === 'both' ? 'каждому' : ''}</h3>
              <p className="muted b">«{done.title}» закрыта</p>
            </div>
            {!done.photo && (
              <button className="btn wide peach" onClick={() => { s.setTasks(ts => ts.map(x => (x.id === done.id ? { ...x, photo: true } : x))); setDone(null); s.earn(2, '+2 за фото-отчёт', 'common/camera') }}>
                <Img src="common/camera" /> Добавить фото-отчёт · +2
              </button>
            )}
            <button className="btn wide soft" onClick={() => setDone(null)}>Без фото</button>
          </>
        )}
      </Sheet>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Новая задача" icon="tracker/type_task">
        <NewTask onDone={() => setCreating(false)} />
      </Sheet>

      <Sheet open={summary} onClose={() => setSummary(false)} title={`Итоги недели ${isoWeek(TODAY_KEY)}`} icon="tracker/sprint_podium" tall>
        <WeekSummary />
      </Sheet>
    </div>
  )
}

function TaskDetail({ t, onMove }: { t: Task; onMove: (s: Task['status']) => void }) {
  const s = useStore()
  const name = useName()
  const toggle = (i: number) =>
    s.setTasks(ts => ts.map(x => (x.id === t.id && x.checklist ? { ...x, checklist: x.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)) } : x)))
  return (
    <>
      <div className="kv">
        <span>Тип</span><span><Img src={TYPE_ICON[t.type]} size={24} />{TYPE_NAME[t.type]}</span>
        <span>Кто делает</span><span><Ava who={t.assignee} />{t.assignee === 'both' ? 'Вместе' : name(t.assignee)}</span>
        <span>Приоритет</span><span><i className={'prio-dot ' + t.prio} />{PRIO_NAME[t.prio]}</span>
        {hasDl(t) && <><span>Дедлайн</span><span className={overdue(t) ? 'red' : ''}>{human(t.deadline)} {overdue(t) && <span className="tag red">просрочено · цена ½</span>}</span></>}
        <span>Цена</span><span><Coin n={t.price} size={22} />{t.assignee === 'both' && <span className="small muted">каждому</span>}</span>
        {carriedOf(t) > 0 && <><span>Перенос</span><span><Img src="tracker/carried_over" size={22} />уже {carriedOf(t)} {plural(carriedOf(t), 'неделю', 'недели', 'недель')}</span></>}
        {t.labels.length > 0 && <><span>Метки</span><span>{t.labels.map(l => <span key={l} className="tag"><Img src={LABELS[l].icon} />{LABELS[l].name}</span>)}</span></>}
      </div>
      {t.checklist && (
        <div className="card flat" style={{ padding: '4px 12px' }}>
          {t.checklist.map((c, i) => (
            <button key={i} className={'check' + (c.done ? ' on' : '')} onClick={() => toggle(i)}><i /><span>{c.text}</span></button>
          ))}
        </div>
      )}
      {t.epic && <p className="muted b small">Эпик: внутри {t.epic.total} задач, закрыто {t.epic.done}. За закрытие всего эпика: ачивка «Покорили вершину».</p>}
      {t.status === 'backlog' && <button className="btn wide" onClick={() => onMove('todo')}>В спринт этой недели</button>}
      {t.status === 'todo' && <button className="btn wide" onClick={() => onMove('doing')}><Img src="common/hourglass" />Взять в работу</button>}
      {(t.status === 'doing' || t.status === 'todo') && (
        <button className="btn wide sage" onClick={() => onMove('done')}><Img src="common/check_cookie" />Закрыть задачу · +{reward(t)}</button>
      )}
      {t.status === 'done' && <p className="b muted" style={{ textAlign: 'center' }}>Задача закрыта{t.doneAt ? ' ' + human(t.doneAt) : ''}{t.photo ? ' · есть фото-отчёт' : ''}</p>}
      <button className="btn wide soft" onClick={() => { s.setTasks(ts => ts.filter(x => x.id !== t.id)); s.toast('Задача удалена', 'common/cross_badge') }}>Удалить задачу</button>
    </>
  )
}

function NewTask({ onDone }: { onDone: () => void }) {
  const g = useG()
  const s = useStore()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('task')
  const [who, setWho] = useState<Assignee>('me')
  const [price, setPrice] = useState(3)
  const [prio, setPrio] = useState<Prio>('normal')
  const [labels, setLabels] = useState<string[]>([])
  const [col, setCol] = useState<'todo' | 'backlog'>('todo')
  const [dl, setDl] = useState('')
  const name = useName()
  const himPrices = who === 'him'
  const DL = [['Сегодня', TODAY_KEY], ['Завтра', addDays(TODAY_KEY, 1)], ['До воскресенья', weekEnd(TODAY_KEY)]] as const
  function create() {
    if (!title.trim()) { s.toast('Напиши название', 'tracker/type_task'); return }
    s.setTasks(ts => [...ts, { id: Date.now(), title: title.trim(), type, assignee: who, author: 'me', status: col, price: himPrices ? 0 : price, prio, labels, deadline: dl || undefined, since: col === 'todo' ? TODAY_KEY : undefined }])
    s.toast(himPrices ? `Задача создана, цену поставит ${g.he}` : 'Задача создана', TYPE_ICON[type])
    onDone()
  }
  return (
    <>
      <input className="input" placeholder="Что сделать?" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <div className="icon-pick">
        {(Object.keys(TYPE_NAME) as TaskType[]).map(k => (
          <button key={k} className={k === type ? 'on' : ''} onClick={() => setType(k)}><Img src={TYPE_ICON[k]} />{TYPE_NAME[k]}</button>
        ))}
      </div>
      <div className="field"><span>Кто делает</span>
        <Seg value={who} onChange={setWho} options={[{ id: 'me', name: name('me') }, { id: 'him', name: name('him') }, { id: 'both', name: 'Вместе' }]} />
      </div>
      <div className="field"><span>{himPrices ? `Цену поставит ${g.he} ${g.p('сам', 'сама')}` : who === 'both' ? 'Цена (каждому)' : 'Цена'}</span>
        {!himPrices && (
          <div className="price-pick">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} className={n === price ? 'on' : ''} onClick={() => setPrice(n)}><Img src="coins/coin" />{n}</button>
            ))}
          </div>
        )}
      </div>
      <div className="field"><span>Приоритет</span>
        <Seg value={prio} onChange={setPrio} options={[{ id: 'low', name: 'Низкий' }, { id: 'normal', name: 'Средний' }, { id: 'urgent', name: 'Высокий' }]} />
      </div>
      <div className="field"><span>Метки</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {Object.entries(LABELS).map(([id, l]) => (
            <button key={id} className={'chip' + (labels.includes(id) ? ' on' : '')} onClick={() => setLabels(ls => (ls.includes(id) ? ls.filter(x => x !== id) : [...ls, id]))}>
              <Img src={l.icon} />{l.name}
            </button>
          ))}
        </div>
      </div>
      <div className="field"><span>Срок</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          <button className={'chip' + (!dl ? ' on' : '')} onClick={() => setDl('')}>Без срока</button>
          {DL.map(([n, k]) => <button key={n} className={'chip' + (dl === k ? ' on' : '')} onClick={() => setDl(k)}>{n}</button>)}
          <input type="date" className="input date-in" min={TODAY_KEY} value={dl} onChange={e => setDl(e.target.value)} />
        </div>
      </div>
      <div className="field"><span>Куда</span>
        <Seg value={col} onChange={setCol} options={[{ id: 'todo', name: 'В эту неделю' }, { id: 'backlog', name: 'Когда-нибудь' }]} />
      </div>
      <button className="btn wide" onClick={create}>Создать</button>
    </>
  )
}

function WeekSummary() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [answers, setAnswers] = useState(['', '', ''])
  const [sent, setSent] = useState(false)
  const Q = ['Что на этой неделе было классно?', 'Что мешало или расстроило?', 'Что попробуем на следующей?']
  const week = s.tasks.filter(t => t.status === 'done' && t.doneAt && t.doneAt >= WEEK0)
  const stat = (w: 'me' | 'him') => {
    const ts = week.filter(t => t.assignee === w || t.assignee === 'both')
    return { coins: earnedBy(s.tasks, w), n: ts.length, photos: ts.filter(t => t.photo).length }
  }
  const me = stat('me'), him = stat('him')
  const star: 'me' | 'him' = him.coins > me.coins ? 'him' : 'me'
  const tail = s.tasks.filter(t => inSprint(t) && t.status !== 'done').length
  const P = ({ w, st }: { w: 'me' | 'him'; st: typeof me }) => (
    <div className={w === star && st.coins > 0 ? 'star' : ''}>
      {w === star && st.coins > 0 && <Img src="shop/accessories/crown" className="crown" />}
      <Ava who={w} size={46} />
      <b>{name(w)}{w === star && st.coins > 0 ? ' · звезда недели' : ''}</b>
      <Coin n={st.coins} />
      <span className="small muted b">{st.n} {plural(st.n, 'задача', 'задачи', 'задач')} · {st.photos} фото</span>
    </div>
  )
  return (
    <>
      <div className="podium" style={{ marginTop: 20 }}>
        <P w={star} st={star === 'me' ? me : him} />
        <P w={star === 'me' ? 'him' : 'me'} st={star === 'me' ? him : me} />
      </div>
      {tail > 0 && (
        <div className="card flat row">
          <Img src="tracker/carried_over" size={40} />
          <div className="grow small b">{tail} {plural(tail, 'задача переедет', 'задачи переедут', 'задач переедут')} на следующую неделю. Цена не меняется, на карточке появится отметка переноса.</div>
        </div>
      )}
      <div className="sec-title">Ретро</div>
      {Q.map((q, i) => (
        <div key={i} className="field">
          <span>{q}</span>
          <textarea className="input" value={answers[i]} disabled={sent} onChange={e => setAnswers(a => a.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
      {!sent ? (
        <button className="btn wide" onClick={() => { setSent(true); s.toast(`Ответы спрятаны до ${g.his} ответов`, 'common/lock') }}>Отправить ответы</button>
      ) : (
        <div className="card flat row"><Img src="common/lock" size={36} /><span className="b small">Ответы откроются, когда {g.he} тоже ответит</span></div>
      )}
    </>
  )
}
