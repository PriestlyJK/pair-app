import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { Img, Coin, Bar, Ava, Sheet, Header, Seg } from '../ui'
import { COLUMNS, LABELS, PRIO_NAME, TYPE_ICON, TYPE_NAME, TODAY_D, type Assignee, type Prio, type Task, type TaskType } from '../data'

type Filter = 'all' | 'me' | 'him' | 'both'
const FILTERS: { id: Filter; name: string }[] = [
  { id: 'all', name: 'Все' },
  { id: 'me', name: 'Мои' },
  { id: 'him', name: 'Его' },
  { id: 'both', name: 'Вместе' },
]

const overdue = (t: Task) => t.status !== 'done' && t.deadline !== undefined && t.deadline < TODAY_D
const reward = (t: Task) => (overdue(t) ? Math.ceil(t.price / 2) : t.price)

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
        {t.deadline !== undefined && (
          <span className={'tag' + (overdue(t) ? ' red' : '')}>
            <Img src={overdue(t) ? 'tracker/overdue' : 'tracker/deadline'} />
            {t.deadline === TODAY_D ? 'сегодня' : `${t.deadline} ноя`}
          </span>
        )}
        {t.carried && <span className="tag"><Img src="tracker/carried_over" />×{t.carried}</span>}
        {cl && <span className="tag plain">☑ {cl.filter(c => c.done).length}/{cl.length}</span>}
        {t.photo && <span className="tag"><Img src="common/camera" />фото</span>}
        <Coin n={t.price} size={20} />
      </div>
    </button>
  )
}

export default function Board() {
  const s = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState<Task | null>(null)
  const [summary, setSummary] = useState(false)

  const shown = s.tasks.filter(t => filter === 'all' || t.assignee === filter || (filter !== 'both' && t.assignee === 'both'))
  const sprint = s.tasks.filter(t => t.status !== 'backlog')
  const doneCount = sprint.filter(t => t.status === 'done').length
  const task = s.tasks.find(t => t.id === open)
  const colsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = colsRef.current?.children[1] as HTMLElement | undefined
    if (el && colsRef.current) colsRef.current.scrollLeft = el.offsetLeft - 16
  }, [])

  function move(t: Task, status: Task['status']) {
    s.setTasks(ts => ts.map(x => (x.id === t.id ? { ...x, status } : x)))
    if (status === 'done') {
      setOpen(null)
      setDone(t)
      const r = reward(t)
      setTimeout(() => s.earn(r, overdue(t) ? `+${r} · просрочка, половина` : `+${r} за задачу`), 300)
    }
  }

  return (
    <div className="screen">
      <Header title="Доска" sub="Неделя 46 · 9–15 ноября" right={<button className="coin-pill" onClick={() => s.openShop()}><Img src="coins/coin" /> {s.coins.me}</button>} />

      <button className="sunday" onClick={() => setSummary(true)}>
        <Img src="tracker/sprint_podium" />
        <div className="grow">
          <div className="b">Сегодня итоги недели</div>
          <div className="small muted b">Кто звезда недели и ретро на 3 вопроса</div>
        </div>
        <span className="b" style={{ fontSize: 22, color: 'var(--wood)' }}>›</span>
      </button>

      <div className="card sprint">
        <div className="row">
          <b className="grow">Спринт: {doneCount} из {sprint.length}</b>
          <span className="small muted b">остался 1 день</span>
        </div>
        <Bar value={doneCount} max={sprint.length} color="linear-gradient(90deg,#C8DDB9,#7FA66E)" />
        <div className="who">
          <div><Ava who="me" size={28} /><div className="grow"><div className="small muted b">Я за неделю</div><Coin n={64} /></div></div>
          <div><Ava who="him" size={28} /><div className="grow"><div className="small muted b">Он за неделю</div><Coin n={58} /></div></div>
        </div>
      </div>

      <div className="chips">
        {FILTERS.map(f => (
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

      <Sheet open={summary} onClose={() => setSummary(false)} title="Итоги недели 46" icon="tracker/sprint_podium" tall>
        <WeekSummary />
      </Sheet>
    </div>
  )
}

function TaskDetail({ t, onMove }: { t: Task; onMove: (s: Task['status']) => void }) {
  const s = useStore()
  const toggle = (i: number) =>
    s.setTasks(ts => ts.map(x => (x.id === t.id && x.checklist ? { ...x, checklist: x.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)) } : x)))
  return (
    <>
      <div className="kv">
        <span>Тип</span><span><Img src={TYPE_ICON[t.type]} size={24} />{TYPE_NAME[t.type]}</span>
        <span>Кто делает</span><span><Ava who={t.assignee} />{t.assignee === 'both' ? 'Вместе' : t.assignee === 'me' ? 'Я' : 'Он'}</span>
        <span>Приоритет</span><span><i className={'prio-dot ' + t.prio} />{PRIO_NAME[t.prio]}</span>
        {t.deadline !== undefined && <><span>Дедлайн</span><span className={overdue(t) ? 'red' : ''}>{t.deadline} ноября {overdue(t) && <span className="tag red">просрочено · цена ½</span>}</span></>}
        <span>Цена</span><span><Coin n={t.price} size={22} />{t.assignee === 'both' && <span className="small muted">каждому</span>}</span>
        {t.carried && <><span>Перенос</span><span><Img src="tracker/carried_over" size={22} />уже {t.carried} раз</span></>}
        <span>Метки</span><span>{t.labels.map(l => <span key={l} className="tag"><Img src={LABELS[l].icon} />{LABELS[l].name}</span>)}</span>
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
      {t.status === 'done' && <p className="b muted" style={{ textAlign: 'center' }}>Задача закрыта{t.photo ? ' · есть фото-отчёт' : ''}</p>}
    </>
  )
}

function NewTask({ onDone }: { onDone: () => void }) {
  const s = useStore()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('task')
  const [who, setWho] = useState<Assignee>('me')
  const [price, setPrice] = useState(3)
  const [prio, setPrio] = useState<Prio>('normal')
  const [labels, setLabels] = useState<string[]>([])
  const [col, setCol] = useState<'todo' | 'backlog'>('todo')
  const himPrices = who === 'him'
  function create() {
    if (!title.trim()) { s.toast('Напиши название', 'tracker/type_task'); return }
    s.setTasks(ts => [...ts, { id: Date.now(), title: title.trim(), type, assignee: who, author: 'me', status: col, price: himPrices ? 0 : price, prio, labels }])
    s.toast(himPrices ? 'Задача создана, цену поставит он' : 'Задача создана', TYPE_ICON[type])
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
        <Seg value={who} onChange={setWho} options={[{ id: 'me', name: 'Я' }, { id: 'him', name: 'Он' }, { id: 'both', name: 'Вместе' }]} />
      </div>
      <div className="field"><span>{himPrices ? 'Цену поставит он сам' : who === 'both' ? 'Цена (каждому)' : 'Цена'}</span>
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
      <div className="field"><span>Куда</span>
        <Seg value={col} onChange={setCol} options={[{ id: 'todo', name: 'В эту неделю' }, { id: 'backlog', name: 'Когда-нибудь' }]} />
      </div>
      <button className="btn wide" onClick={create}>Создать</button>
    </>
  )
}

function WeekSummary() {
  const s = useStore()
  const [answers, setAnswers] = useState(['', '', ''])
  const [sent, setSent] = useState(false)
  const Q = ['Что на этой неделе было классно?', 'Что мешало или расстроило?', 'Что попробуем на следующей?']
  return (
    <>
      <div className="podium" style={{ marginTop: 20 }}>
        <div className="star">
          <Img src="shop/accessories/crown" className="crown" />
          <Ava who="me" size={46} />
          <b>Я · звезда недели</b>
          <Coin n={64} />
          <span className="small muted b">7 задач · 1 фото</span>
        </div>
        <div>
          <Ava who="him" size={46} />
          <b>Он</b>
          <Coin n={58} />
          <span className="small muted b">6 задач · 3 фото</span>
        </div>
      </div>
      <div className="card flat row">
        <Img src="tracker/carried_over" size={40} />
        <div className="grow small b">3 задачи переедут на неделю 47. Цена за них не меняется, но у карточки будет ×2.</div>
      </div>
      <div className="sec-title">Ретро</div>
      {Q.map((q, i) => (
        <div key={i} className="field">
          <span>{q}</span>
          <textarea className="input" value={answers[i]} disabled={sent} onChange={e => setAnswers(a => a.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
      {!sent ? (
        <button className="btn wide" onClick={() => { setSent(true); s.toast('Ответы спрятаны до его ответов', 'common/lock') }}>Отправить ответы</button>
      ) : (
        <div className="card flat row"><Img src="common/lock" size={36} /><span className="b small">Ответы откроются, когда он тоже ответит</span></div>
      )}
    </>
  )
}
