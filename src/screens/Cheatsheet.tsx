import { useState } from 'react'
import { useStore } from '../store'
import { Img, Header, Seg, Bar, Sheet } from '../ui'
import { CHEAT_SECTIONS, MEDCARD, SECTION_FIELDS, SITUATIONS, SITUATION_EXAMPLE } from '../data'

export default function Cheatsheet() {
  const s = useStore()
  const [about, setAbout] = useState<'him' | 'me'>('him')
  const sec = CHEAT_SECTIONS.find(x => x.id === s.sub)
  if (s.sub === 'health') return <Health about={about} />
  if (sec) return <Section id={sec.id} name={sec.name} icon={sec.icon} about={about} />

  const filled = CHEAT_SECTIONS.reduce((a, x) => a + x.filled, 0)
  const total = CHEAT_SECTIONS.reduce((a, x) => a + x.total, 0)
  return (
    <div className="screen">
      <Header title="Шпаргалка" sub={about === 'him' ? 'Всё, что важно знать о нём' : 'Это видит он'} />
      <Seg value={about} onChange={setAbout} options={[{ id: 'him', name: 'О нём' }, { id: 'me', name: 'Обо мне' }]} />
      <div className="card row">
        <Img src="cheatsheet/suggest" size={56} />
        <div className="grow col" style={{ gap: 6 }}>
          <div className="row"><b className="grow">Заполнено {filled} из {total}</b></div>
          <Bar value={filled} max={total} color="linear-gradient(90deg,#F7C4A0,#E5876A)" />
          <span className="small muted b">{about === 'him' ? 'Пустые поля можно попросить его заполнить' : 'Он может попросить тебя дополнить'}</span>
        </div>
      </div>
      <button className="secrow sos" onClick={() => s.go('cheatsheet', 'health')}>
        <Img src="cheatsheet/sec_health" />
        <div className="grow">
          <b>Здоровье и «что делать, если…»</b>
          <div className="small muted b">медкарта + 18 ситуаций · главное на экстренный случай</div>
        </div>
        <span className="chev">›</span>
      </button>
      <div className="col" style={{ gap: 10 }}>
        {CHEAT_SECTIONS.filter(x => x.id !== 'health').map(x => (
          <button key={x.id} className="secrow" onClick={() => s.go('cheatsheet', x.id)}>
            <Img src={x.icon} />
            <div className="grow col" style={{ gap: 5 }}>
              <div className="row"><b className="grow">{x.name}</b><span className="small muted b">{x.filled}/{x.total}</span></div>
              <Bar thin value={x.filled} max={x.total} color={x.filled === x.total ? 'var(--leaf)' : 'var(--apricot)'} />
            </div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Section({ id, name, icon, about }: { id: string; name: string; icon: string; about: 'him' | 'me' }) {
  const s = useStore()
  const fields = SECTION_FIELDS[id] ?? []
  return (
    <div className="screen">
      <Header title={name} sub={about === 'him' ? 'о нём' : 'обо мне'} icon={icon} onBack={() => s.go('cheatsheet')} />
      <div className="col" style={{ gap: 10 }}>
        {fields.map(f => (
          <div key={f.label} className="fieldrow">
            <Img src={f.icon} />
            <div className="grow">
              <div className="lbl">{f.label}</div>
              <div className={'val' + (f.value ? '' : ' empty')}>{f.value ?? 'не заполнено'}</div>
            </div>
            {!f.value && <button className="btn sm soft" onClick={() => s.toast('Попросили заполнить', 'cheatsheet/suggest')}>Спросить</button>}
          </div>
        ))}
      </div>
      <button className="btn wide soft" onClick={() => s.toast('Своё поле — в полной версии', 'cheatsheet/sec_custom')}>+ Своё поле</button>
    </div>
  )
}

function Health({ about }: { about: 'him' | 'me' }) {
  const s = useStore()
  const [sit, setSit] = useState<(typeof SITUATIONS)[number] | null>(null)
  return (
    <div className="screen">
      <Header title="Здоровье" sub={about === 'him' ? 'о нём' : 'обо мне'} icon="cheatsheet/sec_health" onBack={() => s.go('cheatsheet')} />
      <div className="sec-title">Медкарта</div>
      <div className="medgrid">
        {MEDCARD.map(m => (
          <div key={m.label} className="med">
            <Img src={m.icon} />
            <div className="grow">
              <div className="lbl">{m.label}</div>
              <div className={'val' + (m.value ? '' : ' empty')}>{m.value ?? 'пусто'}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="sec-title">{about === 'him' ? 'Если ему…' : 'Если мне…'}</div>
      <div className="grid3">
        {SITUATIONS.filter(x => about === 'me' || (x.id !== 'period' && x.id !== 'pms')).map(x => (
          <button key={x.id} className={'sit' + (x.filled ? ' filled' : '')} onClick={() => setSit(x)}>
            <Img src={x.icon} />
            {x.name}
          </button>
        ))}
      </div>
      <p className="small muted b" style={{ textAlign: 'center' }}>Зелёная точка — карточка заполнена</p>

      <Sheet open={!!sit} onClose={() => setSit(null)} title={sit?.name} icon={sit?.icon} tall>
        {sit && (sit.filled ? (
          <>
            {SITUATION_EXAMPLE.fields.map(f => (
              <div key={f.label} className="fieldrow">
                <Img src={f.icon} />
                <div className="grow">
                  <div className="lbl">{f.label}</div>
                  <div className="val">{f.value}</div>
                </div>
              </div>
            ))}
            <p className="small muted b">Пример заполнения. Лекарства и дозировки пишет сам человек, приложение их не советует.</p>
          </>
        ) : (
          <>
            {SITUATION_EXAMPLE.fields.map(f => (
              <div key={f.label} className="fieldrow">
                <Img src={f.icon} />
                <div className="grow">
                  <div className="lbl">{f.label}</div>
                  <div className="val empty">не заполнено</div>
                </div>
              </div>
            ))}
            <button className="btn wide" onClick={() => { setSit(null); s.toast('Попросили заполнить', 'cheatsheet/suggest') }}>Попросить заполнить</button>
          </>
        ))}
      </Sheet>
    </div>
  )
}
