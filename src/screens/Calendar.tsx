import { useEffect, useState } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Sheet, Ava, useName, useG, plural } from '../ui'
import { sendEvent } from '../sync'
import { MOODS, NEEDS, PHASES, TYPE_ICON, meetLegacy, type MeetNotes, type MoodId, type Who } from '../data'
import { usePhotos } from '../photos'
import { DayView } from './Photos'
import { TODAY_KEY, cycleStats, dayInfo, diffDays, dkey, fromKey, human, nextPeriod, type CycleDay } from '../dates'

type Layer = 'tasks' | 'meet' | 'mood' | 'cycle' | 'dates' | 'photo'
const LAYERS: { id: Layer; name: string; icon: string }[] = [
  { id: 'cycle', name: 'Цикл', icon: 'cycle/phase_menstrual' },
  { id: 'mood', name: 'Настроение', icon: 'calendar/mood/mood_good' },
  { id: 'meet', name: 'Встречи', icon: 'meetings/meet_place' },
  { id: 'tasks', name: 'Задачи', icon: 'tracker/type_task' },
  { id: 'dates', name: 'Даты', icon: 'dates/date_holiday' },
  { id: 'photo', name: 'Фото дня', icon: 'common/camera' },
]
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const FLOWS = [
  { id: 'flow_spotting', name: 'Мажет' },
  { id: 'flow_light', name: 'Слабо' },
  { id: 'flow_medium', name: 'Средне' },
  { id: 'flow_heavy', name: 'Обильно' },
]
const SYMS = [
  { id: 'sym_cramps', name: 'Спазмы', icon: 'cheatsheet/situations/sit_period' },
  { id: 'sym_bloating', name: 'Вздутие', icon: 'cycle/symptoms/sym_bloating' },
  { id: 'sym_breasts', name: 'Грудь', icon: 'cycle/symptoms/sym_breasts' },
  { id: 'sym_acne', name: 'Высыпания', icon: 'cycle/symptoms/sym_acne' },
  { id: 'sym_cravings', name: 'Тяга к еде', icon: 'cycle/symptoms/sym_cravings' },
  { id: 'sym_mood_swings', name: 'Перепады', icon: 'cycle/symptoms/sym_mood_swings' },
  { id: 'sym_swelling', name: 'Отёки', icon: 'cycle/symptoms/sym_swelling' },
  { id: 'sym_energy', name: 'Нет сил', icon: 'cycle/symptoms/sym_energy' },
  { id: 'sym_libido', name: 'Либидо', icon: 'cycle/symptoms/sym_libido' },
  { id: 'sym_discharge', name: 'Выделения', icon: 'cycle/symptoms/sym_discharge' },
  { id: 'sym_head', name: 'Голова', icon: 'cheatsheet/situations/sit_headache' },
]
const SYM_NAME = Object.fromEntries(SYMS.map(x => [x.id, x.name]))
const moodColor = (m?: MoodId) => MOODS.find(x => x.id === m)?.color
type MyMood = { mood: MoodId; energy: number; needs: string[] }

// Важные даты считаются от дня, с которого вы вместе: годовщины и круглые числа дней
const MILESTONES = [100, 200, 300, 500, 1000, 1500, 2000, 3000]
function importantOf(k: string, since: string) {
  if (!since || k < since) return undefined
  if (k === since) return { name: 'День, когда всё началось', icon: 'dates/date_anniversary' }
  if (k.slice(5) === since.slice(5)) { const y = Number(k.slice(0, 4)) - Number(since.slice(0, 4)); return { name: `Годовщина: ${y} ${plural(y, 'год', 'года', 'лет')} вместе`, icon: 'dates/date_anniversary' } }
  const d = diffDays(k, since)
  if (MILESTONES.includes(d)) return { name: `${d} дней вместе`, icon: 'memory/days_together' }
  return undefined
}

export default function Calendar() {
  const s = useStore()
  const name = useName()
  const [ym, setYm] = useState(() => { const d = fromKey(TODAY_KEY); return { y: d.getFullYear(), m: d.getMonth() } })
  const g = useG()
  const cycleOn = s.settings.cycle
  // Цикл ведёт один из двоих: у себя — всё, у партнёра — только фазы и подсказки
  const cycleMine = (s.settings.cycleBy ?? 'me') === 'me'
  const [layers, setLayers] = useState<Layer[]>(cycleOn ? ['cycle', 'mood', 'meet', 'tasks', 'dates', 'photo'] : ['mood', 'meet', 'tasks', 'dates', 'photo'])
  const { photos } = usePhotos()
  const [sel, setSel] = useState(TODAY_KEY)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [moodOpen, setMoodOpen] = useState(false)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [meetOpen, setMeetOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  // «Убрать» встречу — со второго нажатия, чтобы не стереть случайно
  const [rmAsk, setRmAsk] = useState('')
  useEffect(() => { if (!rmAsk) return; const t = setTimeout(() => setRmAsk(''), 3500); return () => clearTimeout(t) }, [rmAsk])
  const [meetNotes, setMeetNotes] = usePersist<MeetNotes>('meet_notes', {})
  const setMyNote = (k: string, text: string) => setMeetNotes(m => {
    const day = { ...(m[k] ?? {}) }
    if (text) day.me = text
    else delete day.me
    const n = { ...m }
    if (Object.keys(day).length) n[k] = day
    else delete n[k]
    return n
  })
  const [howOpen, setHowOpen] = useState(false)
  // Настроение у каждого своё: { me: {день: …}, him: {день: …} }
  const [moodsAll, setMoodsAll] = usePersist<Record<Who, Record<string, MyMood>>>('moods', { me: {}, him: {} })
  const moods = moodsAll.me ?? {}
  const on = (l: Layer) => layers.includes(l) && (l !== 'cycle' || cycleOn)
  const toggle = (l: Layer) => setLayers(ls => (ls.includes(l) ? ls.filter(x => x !== l) : [...ls, l]))

  const st = cycleStats(s.cycle)
  const dayNum = (k: string) => fromKey(k).getDate()
  const myMood = (k: string): MyMood | undefined => moods[k]
  const hisMood = (k: string): MyMood | undefined => moodsAll.him?.[k]
  const tasksOn = (k: string) => s.tasks.filter(t => t.deadline === k && t.status !== 'done')
  const important = (k: string) => importantOf(k, s.settings.since)
  const photoN = (k: string) => (photos[k]?.me ? 1 : 0) + (photos[k]?.him ? 1 : 0)

  function setDay(k: string, patch: Partial<CycleDay> | null) {
    s.setCycle(c => {
      const n = { ...c }
      const v: CycleDay = patch ? { ...n[k], ...patch } : {}
      if (!v.flow) delete v.flow
      if (!v.sym?.length) delete v.sym
      if (!v.sex) delete v.sex
      if (Object.keys(v).length) n[k] = v
      else delete n[k]
      return n
    })
  }

  const first = new Date(ym.y, ym.m, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => dkey(new Date(ym.y, ym.m, i + 1)))]
  while (cells.length % 7) cells.push(null)
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const info = dayInfo(sel, st)
  const ph = info ? PHASES[info.phase] : null
  const np = nextPeriod(st, TODAY_KEY)
  const cd = s.cycle[sel] ?? {}
  const future = sel > TODAY_KEY
  const meet = s.meetings[sel]
  const notes = meetNotes[sel] ?? {}
  function removeMeet() {
    if (rmAsk !== sel) { setRmAsk(sel); return }
    setRmAsk('')
    s.setMeetings(m => { const n = { ...m }; delete n[sel]; return n })
    s.toast('Встреча убрана', 'meetings/meet_empty')
  }

  return (
    <div className="screen">
      <div className="month-h">
        <Img src={`calendar/months/m${String(ym.m + 1).padStart(2, "0")}`} />
        <div className="grow">
          <h1>{MONTHS[ym.m]}</h1>
          <p className="small muted b">{ym.y} · общий календарь</p>
        </div>
        <button className="nav" onClick={() => shift(-1)} aria-label="Прошлый месяц">‹</button>
        <button className="nav" onClick={() => shift(1)} aria-label="Следующий месяц">›</button>
      </div>

      <div className="chips">
        {LAYERS.filter(l => l.id !== 'cycle' || cycleOn).map(l => (
          <button key={l.id} className={'chip' + (on(l.id) ? ' on' : '')} onClick={() => toggle(l.id)}>
            <Img src={l.icon} />{l.name}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '10px 4px 6px' }}>
        <div className="wd">{WD.map(d => <span key={d}>{d}</span>)}</div>
        <div className="cal">
          {cells.map((k, i) => {
            if (!k) return <div key={i} className="day out" />
            const d = dayNum(k)
            const inf = on('cycle') ? dayInfo(k, st) : null
            const c = s.cycle[k]
            const marks: string[] = []
            if (on('meet') && s.meetings[k]) marks.push('meetings/meet_place')
            if (on('dates') && important(k)) marks.push(important(k)!.icon)
            if (on('tasks') && tasksOn(k).length) marks.push(TYPE_ICON[tasksOn(k)[0].type])
            if (on('cycle') && cycleMine && c?.sex) marks.push('cycle/' + c.sex)
            if (on('photo') && photoN(k)) marks.push('common/camera')
            const mm = on('mood') ? myMood(k)?.mood : undefined
            const hm = on('mood') ? hisMood(k)?.mood : undefined
            return (
              <button
                key={k}
                className={'day' + (k === TODAY_KEY ? ' today' : '') + (k === sel ? ' sel' : '') + (k > TODAY_KEY ? ' future' : '') + (inf?.predicted ? ' pred' : '')}
                style={{ background: inf && !inf.predicted ? PHASES[inf.phase].color : 'var(--card-2)' }}
                onClick={() => setSel(k)}
              >
                {d}
                {on('cycle') && c?.flow && <Img src={'cycle/' + c.flow} className="flow" />}
                {(mm || hm) && (
                  <span className="moods">
                    {mm && <i style={{ background: moodColor(mm) }} />}
                    {hm && <i style={{ background: moodColor(hm), borderRadius: 3 }} />}
                  </span>
                )}
                <span className="marks">{marks.slice(0, 3).map(m => <Img key={m} src={m} />)}</span>
              </button>
            )
          })}
        </div>
        {on('cycle') && (
          <div className="legend">
            {(['menstrual', 'follicular', 'ovulation', 'luteal', 'pms'] as const).map(p => (
              <span key={p}><i style={{ background: PHASES[p].color }} />{PHASES[p].name.replace(' фаза', '')}</span>
            ))}
            <span><i className="pred-swatch" />прогноз</span>
            <span><Img src="cycle/flow_medium" style={{ width: 14, height: 14 }} />отмечено</span>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '4px 4px -4px' }}>
        {human(sel)}{sel === TODAY_KEY ? ', сегодня' : ''}
      </h2>

      {on('meet') && (
        meet ? (
          <div className="ev meet-ev meet-card">
            <div className="row">
              <Img src="meetings/meet_place" />
              <b className="grow">{future ? 'Запланирована встреча' : 'Мы встретились'}</b>
              <button className={'btn sm ' + (rmAsk === sel ? 'peach' : 'soft')} onClick={removeMeet}>{rmAsk === sel ? 'Точно убрать?' : 'Убрать'}</button>
            </div>
            {meetLegacy(meet) && <div className="meet-note"><span className="grow">{meetLegacy(meet)}</span></div>}
            {(['me', 'him'] as Who[]).filter(w => notes[w]).map(w => (
              <div key={w} className="meet-note"><Ava who={w} size={26} /><span className="grow">{notes[w]}</span></div>
            ))}
            <button className="linkish" onClick={() => setNoteOpen(true)}>{notes.me ? 'Изменить мою заметку' : '+ Моя заметка'}</button>
          </div>
        ) : (
          <button className="btn wide sage" onClick={() => setMeetOpen(true)}>
            <Img src="meetings/meet_button" />{future ? 'Запланировать встречу' : 'Мы встретились в этот день'}
          </button>
        )
      )}

      {on('cycle') && (
        <div className="cycle-box">
          {ph && info ? (
            <div className={'phase' + (info.predicted ? ' pred' : '')} style={{ background: info.predicted ? '#FFF6F4' : ph.color }}>
              <Img src={ph.icon} />
              <div className="col" style={{ gap: 3 }}>
                <div className="row"><b className="grow">{info.predicted ? 'Месячные (прогноз)' : ph.name}</b><span className="small b muted">день {info.day} из {st.len}</span></div>
                <span className="small b" style={{ opacity: 0.85 }}>{ph.hint}</span>
                {np && <span className="small muted b">Следующие месячные ~{human(np)}, через {diffDays(np, TODAY_KEY)} {plural(diffDays(np, TODAY_KEY), 'день', 'дня', 'дней')}</span>}
              </div>
            </div>
          ) : (
            <div className="phase" style={{ background: 'var(--card-2)' }}>
              <Img src="cycle/phase_menstrual" />
              <span className="small b">{cycleMine ? 'Отметь дни последних месячных, и календарь сам посчитает фазы и следующие.' : `Когда ${name('him')} ${g.p('отметит', 'отметит')} дни цикла, здесь появятся фазы и подсказки, когда нужна забота.`}</span>
            </div>
          )}

          {cycleMine && <div className="flow-row">
            <div className="row"><b className="grow">Месячные в этот день</b><button className="linkish" onClick={() => setHowOpen(true)}>как это работает</button></div>
            {future ? (
              <span className="small muted b">Отметить можно, когда день наступит. Сейчас тут прогноз.</span>
            ) : (
              <div className="flow-pick">
                <button className={!cd.flow ? 'on' : ''} onClick={() => setDay(sel, { flow: undefined })}><Img src="common/cross_badge" />Нет</button>
                {FLOWS.map(f => (
                  <button key={f.id} className={cd.flow === f.id ? 'on' : ''} onClick={() => setDay(sel, { flow: cd.flow === f.id ? undefined : f.id })}>
                    <Img src={'cycle/' + f.id} />{f.name}
                  </button>
                ))}
              </div>
            )}
          </div>}

          {!future && cycleMine && (
            <button className="ev" onClick={() => setCycleOpen(true)}>
              <Img src="cycle/symptoms/sym_mood_swings" />
              <div className="grow" style={{ textAlign: 'left' }}>
                <div>Симптомы и секс</div>
                <div className="small muted b">
                  {[...(cd.sym ?? []).map(x => SYM_NAME[x]), cd.sex === 'sex' ? 'секс без защиты' : cd.sex ? 'секс с защитой' : ''].filter(Boolean).join(', ') || 'ничего не отмечено'}
                </div>
              </div>
              <span className="chev">›</span>
            </button>
          )}
        </div>
      )}

      {on('mood') && (
        <div className="col">
          <MoodRow who="me" label={name('me')} m={myMood(sel)} onAdd={sel === TODAY_KEY && !moods[sel] ? () => setMoodOpen(true) : undefined} />
          <MoodRow who="him" label={name('him')} m={hisMood(sel)} />
        </div>
      )}

      <div className="col">
        {important(sel) && <div className="ev"><Img src={important(sel)!.icon} />{important(sel)!.name}</div>}
        {on('tasks') && tasksOn(sel).map(t => (
          <button key={t.id} className="ev" onClick={() => s.go('board')}><Img src={TYPE_ICON[t.type]} />{t.title}</button>
        ))}
        {on('photo') && photoN(sel) > 0 && <button className="ev" onClick={() => sel === TODAY_KEY ? s.go('together', 'photos') : setPhotoOpen(true)}><Img src="common/camera" />{photoN(sel) === 2 ? 'Фото дня от вас обоих' : 'Фото дня'}</button>}
        {on('photo') && sel < TODAY_KEY && !photos[sel]?.me && <button className="ev add" onClick={() => setPhotoOpen(true)}><Img src="common/camera" />+ Добавить своё фото за этот день</button>}
      </div>

      {sel === TODAY_KEY && (
        <button className="btn soft wide" onClick={() => setMoodOpen(true)}><Img src="calendar/mood/mood_calm" />{moods[sel] ? 'Изменить настроение' : 'Отметить настроение'}</button>
      )}

      <Sheet open={moodOpen} onClose={() => setMoodOpen(false)} title="Как ты сегодня?" icon="calendar/mood/mood_good">
        <MoodForm init={moods[TODAY_KEY]} onSave={v => {
          const first = !moods[TODAY_KEY]
          setMoodsAll(m => ({ ...m, me: { ...(m.me ?? {}), [TODAY_KEY]: v } })); setMoodOpen(false); setSel(TODAY_KEY)
          if (first) sendEvent('mood', { mood: v.mood })
          if (first) s.earn(1, 'Настроение отмечено · +1', 'calendar/mood/mood_' + v.mood)
          else s.toast('Настроение обновлено', 'calendar/mood/mood_' + v.mood)
        }} />
      </Sheet>

      <Sheet open={photoOpen} onClose={() => setPhotoOpen(false)} title={`Фото · ${human(sel)}`} icon="common/camera">
        {photoOpen && <DayView k={sel} />}
      </Sheet>

      <Sheet open={cycleOpen} onClose={() => setCycleOpen(false)} title={`Цикл · ${human(sel)}`} icon="cycle/phase_menstrual">
        <CycleForm key={sel} init={cd}
          onSave={v => { setDay(sel, v); setCycleOpen(false); s.toast('Сохранено', 'cycle/flow_medium') }}
          onClear={() => { setDay(sel, null); setCycleOpen(false); s.toast('День очищен', 'common/cross_badge') }} />
      </Sheet>

      <Sheet open={meetOpen} onClose={() => setMeetOpen(false)} title={future ? 'Планируем встречу' : 'Мы встретились'} icon="meetings/meet_place">
        <MeetForm future={future} date={human(sel)} onSave={note => {
          s.setMeetings(m => ({ ...m, [sel]: future ? 'Планируем встретиться' : 'Встреча' }))
          if (note) setMyNote(sel, note)
          if (!future) sendEvent('meet', { day: sel })
          setMeetOpen(false)
          s.toast(future ? `Встреча ${human(sel)} в календаре` : 'Встреча отмечена', 'meetings/meet_button')
        }} />
      </Sheet>

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Моя заметка" icon="meetings/meet_place">
        {noteOpen && <NoteForm init={notes.me ?? ''} partner={name('him')} onSave={t => {
          setMyNote(sel, t)
          setNoteOpen(false)
          s.toast(t ? 'Заметка сохранена' : 'Заметка убрана', 'meetings/meet_place')
        }} />}
      </Sheet>

      <Sheet open={howOpen} onClose={() => setHowOpen(false)} title="Как считается цикл" icon="cycle/phase_follicular">
        <div className="how">
          <p><b>1.</b> Отмечай только дни, когда идут месячные: выбери день и нажми, насколько обильно.</p>
          <p><b>2.</b> Начало цикла приложение находит само: это первый отмеченный день после перерыва.</p>
          <p><b>3.</b> Длину цикла оно считает по прошлым месяцам. Сейчас выходит {st.len} {plural(st.len, 'день', 'дня', 'дней')}, месячные около {st.plen} {plural(st.plen, 'дня', 'дней', 'дней')}.</p>
          <p><b>4.</b> Фазы раскрашиваются автоматически, будущие месячные показаны пунктиром.</p>
          <p><b>5.</b> Отметка лишняя? Выбери день и нажми «Нет». Симптомы стираются кнопкой «Очистить день».</p>
          <p className="small muted b">{g.He} видит только фазы и подсказки, без симптомов и отметок о сексе.</p>
        </div>
      </Sheet>
    </div>
  )
}

function MoodRow({ who, label, m, onAdd }: { who: Who; label: string; m?: MyMood; onAdd?: () => void }) {
  const mood = MOODS.find(x => x.id === m?.mood)
  if (!mood)
    return (
      <div className="moodrow">
        <Ava who={who} size={44} />
        <span className="grow b muted">{onAdd ? 'Ещё не отмечено' : 'Нет отметки'}</span>
        {onAdd && <button className="btn sm" onClick={onAdd}>Отметить · +1</button>}
      </div>
    )
  return (
    <div className="moodrow">
      <Img src={`calendar/mood/mood_${mood.id}`} className="m" />
      <div className="grow">
        <div className="small muted b">{label}</div>
        <b>{mood.name}</b>
        {m && m.needs.length > 0 && (
          <div className="small b" style={{ color: 'var(--coral)' }}>
            Нужно: {m.needs.map(n => NEEDS.find(x => x.id === n)?.name.toLowerCase()).join(', ')}
          </div>
        )}
      </div>
      {m?.energy && <Img src={`calendar/energy/energy_${m.energy}`} className="e" />}
    </div>
  )
}

function MoodForm({ init, onSave }: { init?: MyMood; onSave: (v: MyMood) => void }) {
  const [mood, setMood] = useState<MoodId | null>(init?.mood ?? null)
  const [energy, setEnergy] = useState(init?.energy ?? 3)
  const [needs, setNeeds] = useState<string[]>(init?.needs ?? [])
  return (
    <>
      <div className="mood-pick">
        {MOODS.map(m => (
          <button key={m.id} className={m.id === mood ? 'on' : ''} onClick={() => setMood(m.id)}>
            <Img src={`calendar/mood/mood_${m.id}`} />{m.name}
          </button>
        ))}
      </div>
      <div className="field"><span>Энергия</span>
        <div className="energy-pick">
          {[1, 2, 3, 4, 5].map(e => (
            <button key={e} className={e === energy ? 'on' : ''} onClick={() => setEnergy(e)}><Img src={`calendar/energy/energy_${e}`} /></button>
          ))}
        </div>
      </div>
      <div className="field"><span>Что мне сейчас нужно</span>
        <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
          {NEEDS.map(n => (
            <button key={n.id} className={'chip' + (needs.includes(n.id) ? ' on' : '')} onClick={() => setNeeds(ns => (ns.includes(n.id) ? ns.filter(x => x !== n.id) : [...ns, n.id]))}>
              <Img src={n.icon} />{n.name}
            </button>
          ))}
        </div>
      </div>
      <button className="btn wide" disabled={!mood} onClick={() => mood && onSave({ mood, energy, needs })}>Сохранить</button>
    </>
  )
}

function CycleForm({ init, onSave, onClear }: { init: CycleDay; onSave: (v: CycleDay) => void; onClear: () => void }) {
  const [sym, setSym] = useState<string[]>(init.sym ?? [])
  const [sex, setSex] = useState<string | undefined>(init.sex)
  return (
    <>
      <p className="small muted b">Это видишь только ты. Месячные отмечаются кнопками под календарём.</p>
      <div className="field"><span>Симптомы</span>
        <div className="icon-pick">
          {SYMS.map(x => (
            <button key={x.id} className={sym.includes(x.id) ? 'on' : ''} onClick={() => setSym(s => (s.includes(x.id) ? s.filter(y => y !== x.id) : [...s, x.id]))}><Img src={x.icon} />{x.name}</button>
          ))}
        </div>
      </div>
      <div className="field"><span>Секс</span>
        <div className="icon-pick" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className={sex === 'sex_protected' ? 'on' : ''} onClick={() => setSex(sex === 'sex_protected' ? undefined : 'sex_protected')}><Img src="cycle/sex_protected" />Защищённый</button>
          <button className={sex === 'sex' ? 'on' : ''} onClick={() => setSex(sex === 'sex' ? undefined : 'sex')}><Img src="cycle/sex" />Без защиты</button>
        </div>
      </div>
      <button className="btn wide" onClick={() => onSave({ sym, sex })}>Сохранить</button>
      <button className="btn wide soft" onClick={onClear}>Очистить день (и месячные тоже)</button>
    </>
  )
}

function MeetForm({ future, date, onSave }: { future: boolean; date: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <>
      <p className="small muted b">{date}. {future ? 'Встреча появится в календаре у обоих, на главной будет обратный отсчёт.' : 'Встреча добавится в счётчик на главной.'}</p>
      <input className="input" placeholder={future ? 'Например: приезд на выходные, город' : 'Где были, что делали (можно пусто)'} value={note} onChange={e => setNote(e.target.value)} />
      <button className="btn wide sage" onClick={() => onSave(note.trim())}>{future ? 'Запланировать' : 'Отметить встречу'}</button>
    </>
  )
}

// Своя заметка к встрече: у каждого своя, заметку партнёра не трогает
function NoteForm({ init, partner, onSave }: { init: string; partner: string; onSave: (t: string) => void }) {
  const [t, setT] = useState(init)
  return (
    <>
      <p className="small muted b">Это только твоя заметка. {partner} пишет свою отдельно — вы не перепишете друг друга.</p>
      <textarea className="input" rows={3} placeholder="Где были, что делали, что запомнилось" value={t} onChange={e => setT(e.target.value)} autoFocus />
      <button className="btn wide sage" onClick={() => onSave(t.trim())}>Сохранить</button>
      {init && <button className="btn wide soft" onClick={() => onSave('')}>Убрать мою заметку</button>}
    </>
  )
}
