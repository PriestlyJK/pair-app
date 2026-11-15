import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Seg, Bar, Sheet, useName, useG } from '../ui'
import { CHEAT_SECTIONS, MEDCARD, SECTION_FIELDS, SITUATIONS, SITUATION_FIELDS, type CheatField, type Who } from '../data'

// Ответы хранятся по ключу «раздел.поле» отдельно для него и для меня.
// Свои поля — просто дополнительные подписи в разделе.
type Values = Record<Who, Record<string, string>>
type Custom = Record<Who, Record<string, string[]>>

function useCheat() {
  const [vals, setVals] = usePersist<Values>('cheat', { me: {}, him: {} })
  const [custom, setCustom] = usePersist<Custom>('cheat_custom', { me: {}, him: {} })
  const fieldsOf = (about: Who, sec: string): CheatField[] => [
    ...(SECTION_FIELDS[sec] ?? []),
    ...(custom[about][sec] ?? []).map(label => ({ label, icon: 'cheatsheet/sec_custom' })),
  ]
  const set = (about: Who, key: string, v: string) =>
    setVals(x => {
      const m = { ...x[about] }
      if (v.trim()) m[key] = v.trim()
      else delete m[key]
      return { ...x, [about]: m }
    })
  const addField = (about: Who, sec: string, label: string) =>
    setCustom(c => ({ ...c, [about]: { ...c[about], [sec]: [...(c[about][sec] ?? []), label] } }))
  const delField = (about: Who, sec: string, label: string) => {
    setCustom(c => ({ ...c, [about]: { ...c[about], [sec]: (c[about][sec] ?? []).filter(l => l !== label) } }))
    set(about, `${sec}.${label}`, '')
  }
  return { vals, set, fieldsOf, addField, delField }
}

export default function Cheatsheet() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [about, setAbout] = usePersist<Who>('cheat_about', 'him')
  const c = useCheat()
  const sec = CHEAT_SECTIONS.find(x => x.id === s.sub)
  if (s.sub === 'health') return <Health about={about} c={c} />
  if (sec) return <Section id={sec.id} name={sec.name} icon={sec.icon} about={about} c={c} />

  const v = c.vals[about]
  const count = (id: string) => {
    const fs = c.fieldsOf(about, id)
    return { filled: fs.filter(f => v[`${id}.${f.label}`]).length, total: fs.length }
  }
  const health = MEDCARD.filter(f => v[`health.${f.label}`]).length
  const sits = SITUATIONS.filter(x => SITUATION_FIELDS.some(f => v[`sit.${x.id}.${f.label}`])).length
  const all = CHEAT_SECTIONS.map(x => count(x.id)).reduce((a, x) => ({ filled: a.filled + x.filled, total: a.total + x.total }), { filled: health, total: MEDCARD.length })
  const him = name('him')
  return (
    <div className="screen">
      <Header title="Шпаргалка" sub={about === 'him' ? `Всё, что важно знать: ${g.named ? him : g.about}` : `Это про тебя, ${g.he} будет видеть`} />
      <Seg value={about} onChange={setAbout} options={[{ id: 'him', name: g.named ? him : g.About }, { id: 'me', name: 'Обо мне' }]} />
      <div className="card row">
        <Img src="cheatsheet/suggest" size={56} />
        <div className="grow col" style={{ gap: 6 }}>
          <div className="row"><b className="grow">Заполнено {all.filled} из {all.total}</b></div>
          <Bar value={all.filled} max={all.total} color="linear-gradient(90deg,#F7C4A0,#E5876A)" />
          <span className="small muted b">{about === 'him' ? 'Записывай, что узнаёшь: размеры, вкусы, что помогает, когда плохо' : `Заполни про себя, чтобы ${g.to} было проще`}</span>
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

type C = ReturnType<typeof useCheat>

// Строка поля: нажал — открылось редактирование
function FieldRow({ f, value, onEdit, onDelete }: { f: CheatField; value?: string; onEdit: () => void; onDelete?: () => void }) {
  return (
    <button className="fieldrow" style={{ textAlign: 'left', width: '100%' }} onClick={onEdit}>
      <Img src={f.icon} />
      <div className="grow">
        <div className="lbl">{f.label}</div>
        <div className={'val' + (value ? '' : ' empty')}>{value ?? 'нажми, чтобы заполнить'}</div>
      </div>
      {onDelete && !value && <span className="x-btn" role="button" aria-label="Удалить поле" onClick={e => { e.stopPropagation(); onDelete() }}>×</span>}
    </button>
  )
}

function EditSheet({ f, value, onSave, onClose }: { f: CheatField | null; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value)
  return (
    <Sheet open={!!f} onClose={onClose} title={f?.label} icon={f?.icon}>
      <textarea className="input" autoFocus style={{ minHeight: 96 }} placeholder={f?.hint ? `Например: ${f.hint}` : 'Напиши, как есть'} value={v} onChange={e => setV(e.target.value)} />
      <button className="btn wide" onClick={() => onSave(v)}>Сохранить</button>
      {value && <button className="btn wide soft" onClick={() => onSave('')}>Очистить</button>}
    </Sheet>
  )
}

function Section({ id, name, icon, about, c }: { id: string; name: string; icon: string; about: Who; c: C }) {
  const s = useStore()
  const [edit, setEdit] = useState<CheatField | null>(null)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const isCustom = (l: string) => !(SECTION_FIELDS[id] ?? []).some(f => f.label === l)
  const key = (f: CheatField) => `${id}.${f.label}`
  return (
    <div className="screen">
      <Header title={name} sub={about === 'him' ? 'о нём' : 'обо мне'} icon={icon} onBack={() => s.go('cheatsheet')} />
      <div className="col" style={{ gap: 10 }}>
        {c.fieldsOf(about, id).map(f => (
          <FieldRow key={f.label} f={f} value={c.vals[about][key(f)]} onEdit={() => setEdit(f)} onDelete={isCustom(f.label) ? () => c.delField(about, id, f.label) : undefined} />
        ))}
      </div>
      <button className="btn wide soft" onClick={() => setAdding(true)}>+ Своё поле</button>

      {edit && <EditSheet key={key(edit)} f={edit} value={c.vals[about][key(edit)] ?? ''} onClose={() => setEdit(null)} onSave={v => { c.set(about, key(edit), v); setEdit(null) }} />}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Новое поле" icon="cheatsheet/sec_custom">
        <input className="input" placeholder="Например: любимый цвет носков" maxLength={40} value={label} onChange={e => setLabel(e.target.value)} />
        <button className="btn wide" onClick={() => {
          const l = label.trim()
          if (!l || c.fieldsOf(about, id).some(f => f.label === l)) return
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
  const v = c.vals[about]
  const sitFilled = (id: string) => SITUATION_FIELDS.some(f => v[`sit.${id}.${f.label}`])
  return (
    <div className="screen">
      <Header title="Здоровье" sub={about === 'him' ? 'о нём' : 'обо мне'} icon="cheatsheet/sec_health" onBack={() => s.go('cheatsheet')} />
      <div className="sec-title">Медкарта</div>
      <div className="medgrid">
        {MEDCARD.map(m => (
          <button key={m.label} className="med" style={{ textAlign: 'left' }} onClick={() => setEdit({ f: m, key: `health.${m.label}` })}>
            <Img src={m.icon} />
            <div className="grow">
              <div className="lbl">{m.label}</div>
              <div className={'val' + (v[`health.${m.label}`] ? '' : ' empty')}>{v[`health.${m.label}`] ?? 'пусто'}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="sec-title">{about === 'him' ? `Если ${g.to}…` : 'Если мне…'}</div>
      <div className="grid3">
        {SITUATIONS.filter(x => about === 'me' || (x.id !== 'period' && x.id !== 'pms')).map(x => (
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
            {SITUATION_FIELDS.map(f => (
              <FieldRow key={f.label} f={f} value={v[`sit.${sit.id}.${f.label}`]} onEdit={() => setEdit({ f, key: `sit.${sit.id}.${f.label}` })} />
            ))}
            <p className="small muted b">Лекарства и дозировки пишет сам человек или врач, приложение их не советует.</p>
          </>
        )}
      </Sheet>
      {edit && <EditSheet key={edit.key} f={edit.f} value={v[edit.key] ?? ''} onClose={() => setEdit(null)} onSave={val => { c.set(about, edit.key, val); setEdit(null) }} />}
    </div>
  )
}
