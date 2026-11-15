import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Seg, Bar, Sheet, useName, useG } from '../ui'
import { sendEvent, getLink } from '../sync'
import { CHEAT_SECTIONS, MEDCARD, SECTION_FIELDS, SITUATIONS, ALL_SITUATION_FIELDS, situationFields, fieldKey, type CheatField, type Who } from '../data'

/* Шпаргалка. Каждый заполняет только «Обо мне» — это его ответы, второй их видит, но не меняет.
   Во вкладке партнёра к любому полю можно дописать свою заметку («что я заметила сама»): она отдельно от его ответа.
   Ответы — 'cheat' { me, him } по ключу «раздел.key поля» (fieldKey: текст вопроса можно менять, ключ — нет), заметки о партнёре — 'cheat_notes' { me: мои, him: его }.
   Свои поля — дополнительные подписи в разделе, их может добавить любой из двоих. */
type Values = Record<Who, Record<string, string>>
type Custom = Record<Who, Record<string, string[]>>

function useCheat() {
  const [vals, setVals] = usePersist<Values>('cheat', { me: {}, him: {} })
  const [notes, setNotes] = usePersist<Values>('cheat_notes', { me: {}, him: {} })
  const [custom, setCustom] = usePersist<Custom>('cheat_custom', { me: {}, him: {} })
  const fieldsOf = (about: Who, sec: string): CheatField[] => {
    const base = SECTION_FIELDS[sec] ?? []
    const taken = new Set(base.flatMap(f => [fieldKey(f), f.label]))
    const own = (custom[about]?.[sec] ?? []).filter(l => !taken.has(l)).map(label => ({ label, icon: 'cheatsheet/sec_custom' }))
    return [...base, ...own]
  }
  const put = (x: Values, who: Who, key: string, v: string) => {
    const m = { ...(x[who] ?? {}) }
    if (v.trim()) m[key] = v.trim()
    else delete m[key]
    return { ...x, [who]: m }
  }
  // Свои ответы — только в «Обо мне»
  const setMine = (key: string, v: string) => setVals(x => put(x, 'me', key, v))
  // Моя заметка о партнёре
  const setNote = (key: string, v: string) => setNotes(x => put(x, 'me', key, v))
  const addField = (about: Who, sec: string, label: string) =>
    setCustom(c => ({ ...c, [about]: { ...(c[about] ?? {}), [sec]: [...(c[about]?.[sec] ?? []), label] } }))
  const delField = (sec: string, label: string) => {
    setCustom(c => ({ ...c, me: { ...(c.me ?? {}), [sec]: (c.me?.[sec] ?? []).filter(l => l !== label) } }))
    setMine(`${sec}.${label}`, '')
  }
  const answer = (about: Who, key: string): string | undefined => vals[about]?.[key]
  const note = (key: string): string | undefined => notes.me?.[key]
  return { answer, note, setMine, setNote, fieldsOf, addField, delField }
}
type C = ReturnType<typeof useCheat>

export default function Cheatsheet() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [about, setAbout] = usePersist<Who>('cheat_about', 'him')
  const [asked, setAsked] = useState(false)
  const c = useCheat()
  const sec = CHEAT_SECTIONS.find(x => x.id === s.sub)
  if (s.sub === 'health') return <Health about={about} c={c} />
  if (sec) return <Section id={sec.id} name={sec.name} icon={sec.icon} about={about} c={c} />

  const has = (k: string) => !!c.answer(about, k)
  const count = (id: string) => {
    const fs = c.fieldsOf(about, id)
    return { filled: fs.filter(f => has(`${id}.${fieldKey(f)}`)).length, total: fs.length }
  }
  const health = MEDCARD.filter(f => has(`health.${fieldKey(f)}`)).length
  const sits = SITUATIONS.filter(x => ALL_SITUATION_FIELDS.some(f => has(`sit.${x.id}.${fieldKey(f)}`))).length
  const all = CHEAT_SECTIONS.map(x => count(x.id)).reduce((a, x) => ({ filled: a.filled + x.filled, total: a.total + x.total }), { filled: health, total: MEDCARD.length })
  const him = name('him')
  const partner = about === 'him'
  return (
    <div className="screen">
      <Header title="Шпаргалка" sub={partner ? `Что ${g.he} ${g.p('рассказал', 'рассказала')} о себе, и твои заметки` : `Заполняешь ты, ${g.he} это видит`} />
      <Seg value={about} onChange={setAbout} options={[{ id: 'him', name: g.named ? him : g.About }, { id: 'me', name: 'Обо мне' }]} />
      <div className="card row">
        <Img src="cheatsheet/suggest" size={56} />
        <div className="grow col" style={{ gap: 6 }}>
          <div className="row"><b className="grow">{partner ? `${g.He} ${g.p('заполнил', 'заполнила')}` : `Ты ${g.m('заполнил', 'заполнила')}`} {all.filled} из {all.total}</b></div>
          <Bar value={all.filled} max={all.total} color="linear-gradient(90deg,#F7C4A0,#E5876A)" />
          <span className="small muted b">
            {partner ? `Это ${g.his} ответы, менять их может только ${g.he}. К любому полю можно дописать свою заметку.` : `Как с тобой мириться, что дарить, что помогает, когда плохо — чтобы ${g.to} не гадать`}
          </span>
          {partner && getLink() && all.filled < all.total && (
            <button className="btn sm peach" style={{ alignSelf: 'flex-start' }} disabled={asked} onClick={() => {
              sendEvent('cheat_ask'); setAsked(true); s.toast(`Попросили ${g.p('его', 'её')} заполнить`, 'cheatsheet/suggest')
            }}>{asked ? 'Попросили ✓' : 'Попросить заполнить'}</button>
          )}
        </div>
      </div>
      <button className="secrow sos" onClick={() => s.go('cheatsheet', 'health')}>
        <Img src="cheatsheet/sec_health" />
        <div className="grow">
          <b>Здоровье и «что делать, если…»</b>
          <div className="small muted b">медкарта {health}/{MEDCARD.length} · ситуаций заполнено {sits}</div>
        </div>
        <span className="chev">›</span>
      </button>
      <div className="col" style={{ gap: 10 }}>
        {CHEAT_SECTIONS.map(x => {
          const n = count(x.id)
          return (
            <button key={x.id} className="secrow" onClick={() => s.go('cheatsheet', x.id)}>
              <Img src={x.icon} />
              <div className="grow col" style={{ gap: 5 }}>
                <div className="row"><b className="grow">{x.name}</b><span className="small muted b">{n.filled}/{n.total}</span></div>
                <Bar thin value={n.filled} max={Math.max(1, n.total)} color={n.total && n.filled === n.total ? 'var(--leaf)' : 'var(--apricot)'} />
              </div>
              <span className="chev">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Строка поля: своё — нажал и редактируешь; у партнёра — его ответ и твоя заметка
function FieldRow({ f, about, k, c, onEdit, onDelete }: { f: CheatField; about: Who; k: string; c: C; onEdit: () => void; onDelete?: () => void }) {
  const g = useG()
  const value = c.answer(about, k)
  const note = about === 'him' ? c.note(k) : undefined
  const empty = about === 'him' ? `${g.He} ещё не ${g.p('заполнил', 'заполнила')}` : f.hint ? `например: ${f.hint}` : 'нажми, чтобы заполнить'
  return (
    <button className="fieldrow" style={{ textAlign: 'left', width: '100%' }} onClick={onEdit}>
      <Img src={f.icon} />
      <div className="grow">
        <div className="lbl">{f.label}</div>
        <div className={'val' + (value ? '' : ' empty')}>{value ?? empty}</div>
        {note && <div className="note-line">Моя заметка: {note}</div>}
      </div>
      {onDelete && !value && <span className="x-btn" role="button" aria-label="Удалить поле" onClick={e => { e.stopPropagation(); onDelete() }}>×</span>}
    </button>
  )
}

function EditSheet({ f, about, k, c, onClose }: { f: CheatField | null; about: Who; k: string; c: C; onClose: () => void }) {
  const g = useG()
  const partner = about === 'him'
  const answer = c.answer(about, k)
  const init = (partner ? c.note(k) : answer) ?? ''
  const [v, setV] = useState(init)
  const save = (x: string) => { if (partner) c.setNote(k, x); else c.setMine(k, x); onClose() }
  return (
    <Sheet open={!!f} onClose={onClose} title={f?.label} icon={f?.icon}>
      {partner && (
        <div className="answer-box">
          <small>{g.p('Его', 'Её')} ответ</small>
          {answer ? <div className="b">{answer}</div> : <div className="muted b">{g.He} ещё не {g.p('заполнил', 'заполнила')} это поле</div>}
        </div>
      )}
      <textarea className="input" autoFocus={!partner} style={{ minHeight: 96 }}
        placeholder={partner ? `Твоя заметка: что ты ${g.m('заметил', 'заметила')} ${g.m('сам', 'сама')}` : f?.hint ? `Например: ${f.hint}` : 'Напиши, как есть'}
        value={v} onChange={e => setV(e.target.value)} />
      <button className="btn wide" onClick={() => save(v)}>{partner ? 'Сохранить заметку' : 'Сохранить'}</button>
      {init && <button className="btn wide soft" onClick={() => save('')}>{partner ? 'Удалить заметку' : 'Очистить'}</button>}
    </Sheet>
  )
}

function Section({ id, name, icon, about, c }: { id: string; name: string; icon: string; about: Who; c: C }) {
  const s = useStore()
  const g = useG()
  const [edit, setEdit] = useState<CheatField | null>(null)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const isCustom = (l: string) => !(SECTION_FIELDS[id] ?? []).some(f => f.label === l || fieldKey(f) === l)
  const key = (f: CheatField) => `${id}.${fieldKey(f)}`
  const partner = about === 'him'
  return (
    <div className="screen">
      <Header title={name} sub={partner ? g.about : 'обо мне'} icon={icon} onBack={() => s.go('cheatsheet')} />
      <div className="col" style={{ gap: 10 }}>
        {c.fieldsOf(about, id).map(f => (
          <FieldRow key={fieldKey(f)} f={f} about={about} k={key(f)} c={c} onEdit={() => setEdit(f)}
            onDelete={!partner && isCustom(f.label) ? () => c.delField(id, f.label) : undefined} />
        ))}
      </div>
      <button className="btn wide soft" onClick={() => setAdding(true)}>{partner ? `+ Спросить ${g.p('его', 'её')} ещё о чём-то` : '+ Своё поле'}</button>

      {edit && <EditSheet key={key(edit)} f={edit} about={about} k={key(edit)} c={c} onClose={() => setEdit(null)} />}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Новое поле" icon="cheatsheet/sec_custom">
        <input className="input" placeholder="Например: любимый цвет носков" maxLength={40} value={label} onChange={e => setLabel(e.target.value)} />
        {partner && <p className="small muted b">Поле появится у {g.p('него', 'неё')} в «Обо мне» — {g.he} {g.p('заполнит', 'заполнит')} сам{g.p('', 'а')}.</p>}
        <button className="btn wide" onClick={() => {
          const l = label.trim()
          if (!l || c.fieldsOf(about, id).some(f => f.label === l || fieldKey(f) === l)) return
          c.addField(about, id, l); setLabel(''); setAdding(false)
        }}>Добавить</button>
      </Sheet>
    </div>
  )
}

function Health({ about, c }: { about: Who; c: C }) {
  const g = useG()
  const s = useStore()
  const [sit, setSit] = useState<(typeof SITUATIONS)[number] | null>(null)
  const [edit, setEdit] = useState<{ f: CheatField; key: string } | null>(null)
  const partner = about === 'him'
  const val = (k: string) => c.answer(about, k)
  const sitFilled = (id: string) => ALL_SITUATION_FIELDS.some(f => val(`sit.${id}.${fieldKey(f)}`))
  // Карточки про месячные и ПМС — только у того, кто ведёт цикл
  const cycleOwner = (s.settings.cycleBy ?? 'me') === about && s.settings.cycle
  return (
    <div className="screen">
      <Header title="Здоровье" sub={partner ? g.about : 'обо мне'} icon="cheatsheet/sec_health" onBack={() => s.go('cheatsheet')} />
      <div className="sec-title">Медкарта</div>
      <div className="medgrid">
        {MEDCARD.map(m => {
          const k = `health.${fieldKey(m)}`
          return (
            <button key={k} className="med" style={{ textAlign: 'left' }} onClick={() => setEdit({ f: m, key: k })}>
              <Img src={m.icon} />
              <div className="grow">
                <div className="lbl">{m.label}</div>
                <div className={'val' + (val(k) ? '' : ' empty')}>{val(k) ?? 'пусто'}</div>
                {partner && c.note(k) && <div className="note-line">заметка: {c.note(k)}</div>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="sec-title">{partner ? `Если ${g.to}…` : 'Если мне…'}</div>
      <div className="grid3">
        {SITUATIONS.filter(x => cycleOwner || (x.id !== 'period' && x.id !== 'pms')).map(x => (
          <button key={x.id} className={'sit' + (sitFilled(x.id) ? ' filled' : '')} onClick={() => setSit(x)}>
            <Img src={x.icon} />
            {x.name}
          </button>
        ))}
      </div>
      <p className="small muted b" style={{ textAlign: 'center' }}>Зелёная точка — в карточке что-то записано</p>

      <Sheet open={!!sit && !edit} onClose={() => setSit(null)} title={sit?.name} icon={sit?.icon} tall>
        {sit && (
          <>
            {situationFields(sit.id, k => !!val(k)).map(f => {
              const k = `sit.${sit.id}.${fieldKey(f)}`
              return <FieldRow key={k} f={f} about={about} k={k} c={c} onEdit={() => setEdit({ f, key: k })} />
            })}
            <p className="small muted b">Лекарства и дозировки пишет сам человек или врач, приложение их не советует.</p>
          </>
        )}
      </Sheet>
      {edit && <EditSheet key={edit.key} f={edit.f} about={about} k={edit.key} c={c} onClose={() => setEdit(null)} />}
    </div>
  )
}
