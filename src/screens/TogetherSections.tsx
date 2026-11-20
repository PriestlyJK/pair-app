import { useState, type ReactNode } from 'react'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Bar, Ava, Seg, PhotoPick, shrinkImage, useName, plural, useG } from '../ui'
import { meetText, type MeetNotes, type Who } from '../data'
import { TODAY_KEY, addDays, ago, diffDays, human, humanY } from '../dates'
import { PhotosScreen } from './Photos'
import { sendEvent } from '../sync'
import { RefImg, dropImg, saveImage } from '../photos'

// Разделы «Вместе». Каждый хранит свои данные в браузере; потом это станут таблицы в Supabase.

const uid = () => Date.now() + Math.floor(Math.random() * 1000)

function Screen({ title, sub, icon, children, onAdd }: { title: string; sub?: ReactNode; icon: string; children: ReactNode; onAdd?: () => void }) {
  const s = useStore()
  return (
    <div className="screen">
      <Header title={title} sub={sub} icon={icon} onBack={() => s.go('together')} />
      {children}
      {onAdd && <button className="fab" onClick={onAdd} aria-label="Добавить">+</button>}
    </div>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="empty-col"><Img src={icon} />{text}</div>
}

// ---------- Вишлисты ----------
export interface Wish { id: number; who: Who; title: string; price?: number; link?: string; reserved?: boolean; gifted?: boolean }
export const WISH_SEED: Wish[] = []
// Старые записи хранили цену строкой в рублях — переводим в число
export const normWish = (w: Wish): Wish => (typeof w.price === 'string' ? { ...w, price: Number(String(w.price).replace(/\D/g, '')) || undefined } : w)
export const uah = (n: number) => `${n.toLocaleString('ru-RU')} грн`
const fixUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : 'https://' + u)
const host = (u: string) => { try { return new URL(fixUrl(u)).hostname.replace(/^www\./, '') } catch { return 'ссылка' } }

function Wishlist() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [whose, setWhose] = useState<Who>('me')
  const [raw, setItems] = usePersist<Wish[]>('wishes', WISH_SEED)
  const items = raw.map(normWish)
  const [form, setForm] = useState<{ id?: number; title: string; price: string; link: string } | null>(null)
  const list = items.filter(i => i.who === whose)
  const patch = (id: number, p: Partial<Wish>) => setItems(xs => xs.map(x => (x.id === id ? { ...normWish(x), ...p } : normWish(x))))
  function save() {
    if (!form || !form.title.trim()) return
    const v = { title: form.title.trim(), price: Number(form.price.replace(/\D/g, '')) || undefined, link: form.link.trim() || undefined }
    if (form.id) patch(form.id, v)
    else { setItems(xs => [...xs.map(normWish), { id: uid(), who: 'me', ...v }]); setWhose('me'); sendEvent('wish', { title: v.title }) }
    s.toast(form.id ? 'Сохранено' : 'Добавлено в твой вишлист', 'wishlist/wishlist')
    setForm(null)
  }
  return (
    <Screen title="Вишлисты" sub="Бронь подарка видна только дарящему" icon="wishlist/wishlist" onAdd={() => setForm({ title: '', price: '', link: '' })}>
      <Seg value={whose} onChange={setWhose} options={[{ id: 'me', name: `Мой · ${items.filter(i => i.who === 'me').length}` }, { id: 'him', name: `${g.named ? name('him') : g.His} · ${items.filter(i => i.who === 'him').length}` }]} />
      <div className="col" style={{ gap: 10 }}>
        {list.map(it => (
          <div key={it.id} className={'li wish' + (it.gifted ? ' done' : '')}>
            <Img src={it.gifted ? 'wishlist/gifted' : whose === 'him' && it.reserved ? 'wishlist/reserved' : 'common/gift'} className="li-ic" />
            <button className="grow wish-main" onClick={() => whose === 'me' && !it.gifted && setForm({ id: it.id, title: it.title, price: it.price ? String(it.price) : '', link: it.link ?? '' })}>
              <b>{it.title}</b>
              <div className="small muted b">
                {it.price ? uah(it.price) : 'без цены'}
                {it.link ? ` · ${host(it.link)}` : ''}
                {it.gifted ? ' · подарено' : whose === 'him' && it.reserved ? ` · ты ${g.m('забронировал', 'забронировала')}` : ''}
              </div>
            </button>
            {it.link && (
              <a className="link-chip" href={fixUrl(it.link)} target="_blank" rel="noopener noreferrer">Открыть ↗</a>
            )}
            {whose === 'him' && !it.gifted && (
              <button className={'btn sm ' + (it.reserved ? 'soft' : 'peach')} onClick={() => { patch(it.id, { reserved: !it.reserved }); s.toast(it.reserved ? 'Бронь снята' : `Забронировано. ${g.He} не узнает`, 'wishlist/reserved') }}>
                {it.reserved ? 'Снять бронь' : 'Подарю я'}
              </button>
            )}
            {whose === 'him' && it.reserved && !it.gifted && (
              <button className="btn sm sage" onClick={() => { patch(it.id, { gifted: true }); s.toast('Подарено!', 'wishlist/gifted') }}>Подарено</button>
            )}
          </div>
        ))}
        {!list.length && <Empty icon="wishlist/empty_wishlist" text="Список пуст. Добавь, что хочется" />}
      </div>
      {whose === 'me' && <p className="small muted b" style={{ textAlign: 'center' }}>Нажми на желание, чтобы изменить. Что из твоего списка {g.he} {g.p('забронировал', 'забронировала')}, ты не увидишь: сюрприз.</p>}

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Изменить желание' : 'Хочу в подарок'} icon="wishlist/wishlist">
        {form && (
          <>
            <input className="input" placeholder="Что хочется" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <div className="input-suffix">
              <input className="input" inputMode="numeric" placeholder="Примерная цена" value={form.price} onChange={e => setForm({ ...form, price: e.target.value.replace(/[^\d ]/g, '') })} />
              <span>грн</span>
            </div>
            <input className="input" type="url" inputMode="url" placeholder="Ссылка на товар (можно пусто)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} />
            <button className="btn wide" onClick={save}>{form.id ? 'Сохранить' : 'Добавить в мой список'}</button>
            {form.id && (
              <button className="btn wide soft" onClick={() => { setItems(xs => xs.filter(x => x.id !== form.id)); setForm(null); s.toast('Удалено', 'common/cross_badge') }}>Удалить</button>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  )
}

// ---------- Bucket list ----------
export interface Goal { id: number; title: string; done?: string; photo?: string }
export const GOAL_SEED: Goal[] = []

function Bucket() {
  const s = useStore()
  const [goals, setGoals] = usePersist<Goal[]>('bucket', GOAL_SEED)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const done = goals.filter(g => g.done)
  const left = goals.filter(g => !g.done)
  const patch = (id: number, p: Partial<Goal>) => setGoals(xs => xs.map(x => (x.id === id ? { ...x, ...p } : x)))
  async function addPhoto(id: number, f: File) {
    try {
      const ref = await saveImage(`bucket-${id}-${Date.now()}`, await shrinkImage(f, 640, false, 0.78))
      if (!ref) { s.toast('Нет связи — фото не отправилось, попробуй ещё раз', 'states/st_offline'); return }
      const old = goals.find(x => x.id === id)?.photo
      patch(id, { photo: ref })
      if (old && !old.startsWith('data:')) dropImg(old)
      s.toast('Фото в альбоме', 'bucket/album')
    } catch { s.toast('Не получилось открыть фото', 'states/st_error') }
  }
  return (
    <Screen title="Bucket list" sub={`${done.length} из ${goals.length} сделали`} icon="bucket/bucket" onAdd={() => setAdding(true)}>
      <div className="card"><Bar value={done.length} max={Math.max(1, goals.length)} color="linear-gradient(90deg,#C8DDB9,#7FA66E)" /></div>
      <div className="sec-title">Хотим</div>
      <div className="col" style={{ gap: 10 }}>
        {left.map(g => (
          <div key={g.id} className="li">
            <button className="check" onClick={() => { patch(g.id, { done: TODAY_KEY }); s.earn(10, 'Мечта сбылась · +10', 'bucket/done_stamp') }} aria-label="Сделали" />
            <b className="grow">{g.title}</b>
            <button className="x-btn" onClick={() => setGoals(xs => xs.filter(x => x.id !== g.id))} aria-label="Удалить">×</button>
          </div>
        ))}
        {!left.length && <Empty icon="bucket/empty_bucket" text={goals.length ? 'Всё сбылось! Пора придумать новое' : 'Запишите, что хотите сделать вместе хотя бы раз в жизни'} />}
      </div>
      {done.length > 0 && <div className="sec-title">Сделали · альбом</div>}
      <div className="album">
        {done.map(g => (
          <div key={g.id} className="album-it">
            {g.photo ? <RefImg src={g.photo} /> : (
              <PhotoPick onPick={f => addPhoto(g.id, f)} className="album-empty"><Img src="common/camera" />фото</PhotoPick>
            )}
            <Img src="bucket/done_stamp" className="stamp" />
            <span>{g.title}</span>
            <small>{human(g.done!)}</small>
          </div>
        ))}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Новая мечта" icon="bucket/bucket">
        <input className="input" placeholder="Например: прыгнуть с парашютом" value={title} onChange={e => setTitle(e.target.value)} />
        <button className="btn wide" onClick={() => { if (!title.trim()) return; setGoals(xs => [...xs, { id: uid(), title: title.trim() }]); setTitle(''); setAdding(false) }}>Добавить</button>
      </Sheet>
    </Screen>
  )
}

// ---------- Память ----------
interface Quote { id: number; who: Who; text: string; date: string }
interface Capsule { id: number; title: string; letter: string; created: string; openOn: string; opened?: boolean }
const QUOTE_SEED: Quote[] = []
const CAPSULE_SEED: Capsule[] = []

function Memory() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [quotes, setQuotes] = usePersist<Quote[]>('quotes', QUOTE_SEED)
  const [caps, setCaps] = usePersist<Capsule[]>('capsules', CAPSULE_SEED)
  const [meetNotes] = usePersist<MeetNotes>('meet_notes', {})
  const [qOpen, setQOpen] = useState(false)
  const [cOpen, setCOpen] = useState(false)
  const [reading, setReading] = useState<Capsule | null>(null)
  const [qText, setQText] = useState('')
  const [qWho, setQWho] = useState<Who>('him')
  const [cTitle, setCTitle] = useState('')
  const [cLetter, setCLetter] = useState('')
  const [cIn, setCIn] = useState(180)
  const days = s.daysTogether
  const meets = s.meetCount
  // «В этот день»: что было ровно год или месяц назад (встреча или цитата)
  const memo = (() => {
    for (const [n, label] of [[12, 'год назад'], [1, 'месяц назад']] as const) {
      const k = ago(TODAY_KEY, n)
      if (!k) continue
      if (s.meetings[k] && k <= TODAY_KEY) return { label, text: meetText(s.meetings[k], meetNotes[k]) ? `Встреча: ${meetText(s.meetings[k], meetNotes[k])}` : 'Встреча' }
      const q = quotes.find(x => x.date === k)
      if (q) return { label, text: `${name(q.who)}: «${q.text}»` }
    }
    return null
  })()
  return (
    <Screen title="Память" sub="Цифры, цитаты и письма в будущее" icon="memory/days_together">
      <div className="stats3">
        <div><b>{days ?? '—'}</b><span>{days == null ? 'дата не указана' : plural(days, 'день', 'дня', 'дней')}</span></div>
        <div><b>{days == null ? '—' : Math.floor(days / 30.4)}</b><span>месяцев</span></div>
        <div><b>{meets}</b><span>{plural(meets, 'встреча', 'встречи', 'встреч')}</span></div>
      </div>

      {memo && (
        <div className="card row">
          <Img src="memory/on_this_day" size={56} />
          <div className="grow">
            <div className="small muted b">В этот день · {memo.label}</div>
            <div className="b">{memo.text}</div>
          </div>
        </div>
      )}

      <div className="row" style={{ margin: '4px 4px -4px' }}><div className="sec-title grow" style={{ margin: 0 }}>Цитатник</div><button className="linkish" onClick={() => setQOpen(true)}>+ цитата</button></div>
      <div className="col" style={{ gap: 10 }}>
        {!quotes.length && <Empty icon="memory/quotes" text="Записывайте смешные и важные фразы друг друга" />}
        {[...quotes].reverse().map(q => (
          <div key={q.id} className="quote">
            <Img src="memory/quotes" className="qic" />
            <div className="grow">
              <div className="b">«{q.text}»</div>
              <div className="small muted b row" style={{ gap: 6, marginTop: 4 }}><Ava who={q.who} size={18} />{name(q.who)} · {human(q.date)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ margin: '4px 4px -4px' }}><div className="sec-title grow" style={{ margin: 0 }}>Капсулы времени</div><button className="linkish" onClick={() => setCOpen(true)}>+ капсула</button></div>
      <div className="col" style={{ gap: 10 }}>
        {!caps.length && <Empty icon="memory/capsule_closed" text="Напишите письмо себе в будущее: откроется в выбранный день" />}
        {caps.map(c => {
          const left = diffDays(c.openOn, TODAY_KEY)
          const ready = left <= 0
          return (
            <button key={c.id} className="li" style={{ textAlign: 'left' }} onClick={() => {
              if (!ready) { s.toast(`Откроется ${human(c.openOn)}`, 'common/lock'); return }
              setCaps(xs => xs.map(x => (x.id === c.id ? { ...x, opened: true } : x)))
              setReading(c)
            }}>
              <Img src={c.opened ? 'memory/capsule_open' : ready ? 'memory/capsule_opening' : 'memory/capsule_closed'} className="li-ic big" />
              <div className="grow">
                <b>{c.title}</b>
                <div className="small muted b">
                  {c.opened ? `открыта · написана ${human(c.created)}` : ready ? 'можно открыть!' : `через ${left} ${plural(left, 'день', 'дня', 'дней')}, ${human(c.openOn)}`}
                </div>
              </div>
              {ready && !c.opened && <span className="pill">открыть</span>}
            </button>
          )
        })}
      </div>

      <Sheet open={qOpen} onClose={() => setQOpen(false)} title="Цитата" icon="memory/quotes">
        <Seg value={qWho} onChange={setQWho} options={[{ id: 'him', name: `${g.p('Сказал', 'Сказала')} ${g.he}` }, { id: 'me', name: `${g.m('Сказал', 'Сказала')} я` }]} />
        <textarea className="input" placeholder="Что было сказано" value={qText} onChange={e => setQText(e.target.value)} />
        <button className="btn wide" onClick={() => { if (!qText.trim()) return; setQuotes(xs => [...xs, { id: uid(), who: qWho, text: qText.trim(), date: TODAY_KEY }]); setQText(''); setQOpen(false) }}>Сохранить</button>
      </Sheet>

      <Sheet open={cOpen} onClose={() => setCOpen(false)} title="Письмо в будущее" icon="memory/letter" tall>
        <input className="input" placeholder="Название, например «На Новый год»" value={cTitle} onChange={e => setCTitle(e.target.value)} />
        <textarea className="input" style={{ minHeight: 120 }} placeholder="Что хочется сказать вам через время" value={cLetter} onChange={e => setCLetter(e.target.value)} />
        <div className="field"><span>Открыть через</span>
          <div className="price-pick" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {[[30, 'месяц'], [180, 'полгода'], [365, 'год'], [730, '2 года']].map(([d, n]) => (
              <button key={d} className={cIn === d ? 'on' : ''} onClick={() => setCIn(d as number)}>{n}</button>
            ))}
          </div>
        </div>
        <button className="btn wide" onClick={() => {
          if (!cLetter.trim()) return
          setCaps(xs => [...xs, { id: uid(), title: cTitle.trim() || 'Капсула', letter: cLetter.trim(), created: TODAY_KEY, openOn: addDays(TODAY_KEY, cIn) }])
          setCTitle(''); setCLetter(''); setCOpen(false); s.toast(`Запечатано до ${human(addDays(TODAY_KEY, cIn))}`, 'memory/capsule_closed')
        }}>Запечатать</button>
      </Sheet>

      <Sheet open={!!reading} onClose={() => setReading(null)}>
        {reading && (
          <div className="big-reward">
            <Img src="memory/capsule_open" />
            <h3 style={{ fontSize: 22 }}>{reading.title}</h3>
            <p className="small muted b">написано {human(reading.created)}</p>
            <div className="letter">{reading.letter}</div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}

// ---------- Челленджи ----------
// Шаблон — это «что делаем», челлендж — запущенный шаблон с днями. Имя и иконку копируем в челлендж,
// чтобы правка шаблона не меняла уже идущий.
export interface ChKind { id: string; name: string; icon: string }
export interface Challenge { id: number; kind: string; name?: string; icon?: string; days: number; start: string; me: string[]; him: string[]; claimed?: boolean }
export const CH_KINDS: ChKind[] = [
  { id: 'water', name: 'Пить 2 литра воды', icon: 'challenges/ch_water' },
  { id: 'nofast', name: 'Без фастфуда', icon: 'challenges/ch_no_fastfood' },
  { id: 'steps', name: '10 000 шагов', icon: 'common/flame' },
  { id: 'read', name: 'Читать 20 минут', icon: 'tracker/labels/label_study' },
  { id: 'nophone', name: 'Без телефона перед сном', icon: 'common/moon' },
  { id: 'compliment', name: 'Комплимент каждый день', icon: 'common/speech_heart' },
]
const CH_ICONS = [
  'challenges/challenge', 'challenges/ch_water', 'challenges/ch_no_fastfood', 'common/flame', 'common/moon', 'common/sun',
  'common/speech_heart', 'common/heart', 'common/two_hearts', 'common/star', 'common/sparkle', 'common/sprout',
  'common/leaf', 'common/pot', 'common/camera', 'common/envelope', 'common/trophy', 'common/bell',
  'tracker/labels/label_study', 'tracker/labels/label_health', 'tracker/labels/label_work', 'tracker/labels/label_us', 'tracker/labels/label_trip', 'common/check_cookie',
]
const CH_SEED: Challenge[] = []
// 7 дней → 30, 14 → 55, 30 → 120
export const REWARD = (days: number) => Math.max(10, Math.round((days * 4) / 5) * 5)
const DUR = [7, 14, 21, 30]

type ChForm = { mode: 'kind' | 'run'; id?: string | number; name: string; icon: string; days: number }

function IconPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="ch-icons">
      {CH_ICONS.map(ic => (
        <button key={ic} className={ic === value ? 'on' : ''} onClick={() => onChange(ic)}>
          <Img src={ic} />
        </button>
      ))}
    </div>
  )
}

function Challenges() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [list, setList] = usePersist<Challenge[]>('challenges', CH_SEED)
  const [kinds, setKinds] = usePersist<ChKind[]>('ch_kinds', CH_KINDS)
  const [starting, setStarting] = useState<ChKind | null>(null)
  const [days, setDays] = useState(7)
  const [form, setForm] = useState<ChForm | null>(null)
  const [sure, setSure] = useState(false)
  const kindOf = (id: string) => kinds.find(k => k.id === id) ?? CH_KINDS.find(k => k.id === id)
  const nm = (c: Challenge) => c.name ?? kindOf(c.kind)?.name ?? 'Челлендж'
  const ic = (c: Challenge) => c.icon ?? kindOf(c.kind)?.icon ?? 'challenges/challenge'
  const active = list.filter(c => !c.claimed)
  const done = list.filter(c => c.claimed)

  function start(k: ChKind, n: number) {
    setList(xs => [...xs, { id: uid(), kind: k.id, name: k.name, icon: k.icon, days: n, start: TODAY_KEY, me: [], him: [] }])
    setStarting(null)
    s.toast(`Поехали! ${n} ${plural(n, 'день', 'дня', 'дней')}`, 'challenges/challenge')
  }
  function save() {
    if (!form || !form.name.trim()) return
    const v = { name: form.name.trim(), icon: form.icon }
    if (form.mode === 'kind') {
      if (form.id) setKinds(ks => ks.map(k => (k.id === form.id ? { ...k, ...v } : k)))
      else setKinds(ks => [...ks, { id: 'c' + uid(), ...v }])
      s.toast(form.id ? 'Шаблон сохранён' : 'Свой челлендж добавлен', form.icon)
    } else {
      setList(xs => xs.map(x => (x.id === form.id ? { ...x, ...v, days: Math.max(form.days, x.me.length, x.him.length, 1) } : x)))
      s.toast('Сохранено', form.icon)
    }
    setForm(null)
  }
  function remove() {
    if (!form?.id) return
    if (form.mode === 'kind') setKinds(ks => ks.filter(k => k.id !== form.id))
    else setList(xs => xs.filter(x => x.id !== form.id))
    s.toast('Удалено', 'common/cross_badge')
    setForm(null)
  }
  const openForm = (f: ChForm) => { setSure(false); setForm(f) }

  return (
    <Screen title="Челленджи" sub="Делаете вместе, награда на двоих" icon="challenges/challenge" onAdd={() => openForm({ mode: 'kind', name: '', icon: 'challenges/challenge', days: 7 })}>
      {active.map(c => {
        const day = Math.min(c.days, diffDays(TODAY_KEY, c.start) + 1)
        const keys = Array.from({ length: c.days }, (_, i) => addDays(c.start, i))
        const meToday = c.me.includes(TODAY_KEY)
        const finished = c.me.length >= c.days && c.him.length >= c.days
        const over = diffDays(TODAY_KEY, c.start) >= c.days
        return (
          <div key={c.id} className="card col" style={{ gap: 10 }}>
            <div className="row">
              <Img src={ic(c)} size={56} />
              <div className="grow">
                <b>{nm(c)}</b>
                <div className="small muted b">{over ? 'время вышло' : `день ${day} из ${c.days}`} · награда {REWARD(c.days)} монет</div>
              </div>
              <button className="edit-btn" aria-label="Изменить" onClick={() => openForm({ mode: 'run', id: c.id, name: nm(c), icon: ic(c), days: c.days })}>
                ✎
              </button>
            </div>
            {(['me', 'him'] as Who[]).map(w => (
              <div key={w} className="row" style={{ gap: 8 }}>
                <Ava who={w} size={26} />
                <div className="dots grow" style={{ gridTemplateColumns: `repeat(${Math.ceil(c.days / Math.ceil(c.days / 10))}, 1fr)` }}>
                  {keys.map(k => <i key={k} className={(c[w].includes(k) ? 'on' : '') + (k === TODAY_KEY ? ' today' : '') + (k > TODAY_KEY ? ' fut' : '')} />)}
                </div>
                <span className="small b">{c[w].length}/{c.days}</span>
              </div>
            ))}
            {finished ? (
              <button className="btn wide" onClick={() => { setList(xs => xs.map(x => (x.id === c.id ? { ...x, claimed: true } : x))); s.earn(REWARD(c.days), `Челлендж пройден · +${REWARD(c.days)}`, 'common/trophy') }}>Забрать {REWARD(c.days)} монет</button>
            ) : over ? (
              <button className="btn wide soft" onClick={() => setList(xs => xs.filter(x => x.id !== c.id))}>Не вышло, убрать</button>
            ) : (
              <button className={'btn wide ' + (meToday ? 'soft' : 'sage')} onClick={() => setList(xs => xs.map(x => (x.id === c.id ? { ...x, me: meToday ? x.me.filter(k => k !== TODAY_KEY) : [...x.me, TODAY_KEY] } : x)))}>
                {meToday ? 'Сегодня сделано ✓' : `Я сегодня ${g.m('сделал', 'сделала')}`}
              </button>
            )}
            {!finished && !over && <span className="small muted b">{name('him')} сегодня {c.him.includes(TODAY_KEY) ? g.p('уже отметился', 'уже отметилась') : g.p('ещё не отметился', 'ещё не отметилась')}. Награда, когда оба пройдут все дни.</span>}
          </div>
        )
      })}
      {!active.length && <Empty icon="challenges/challenge" text="Нет активного челленджа" />}

      <div className="sec-title row" style={{ justifyContent: 'space-between' }}>
        <span>Начать новый</span>
        <button className="linkish" onClick={() => openForm({ mode: 'kind', name: '', icon: 'challenges/challenge', days: 7 })}>+ свой</button>
      </div>
      <div className="grid2">
        {kinds.map(k => (
          <div key={k.id} className="tile ch-tile" style={{ minHeight: 0 }}>
            <button className="ch-go" onClick={() => { setDays(7); setStarting(k) }}>
              <Img src={k.icon} />
              <b style={{ fontSize: 14 }}>{k.name}</b>
            </button>
            <button className="edit-btn sm" aria-label="Изменить шаблон" onClick={() => openForm({ mode: 'kind', id: k.id, name: k.name, icon: k.icon, days: 7 })}>✎</button>
          </div>
        ))}
        <button className="tile ch-add" style={{ minHeight: 0 }} onClick={() => openForm({ mode: 'kind', name: '', icon: 'challenges/challenge', days: 7 })}>
          <span className="plus">+</span>
          <b style={{ fontSize: 14 }}>Свой челлендж</b>
        </button>
      </div>
      {done.length > 0 && <p className="small muted b" style={{ textAlign: 'center' }}>Пройдено вместе: {done.length}</p>}

      <Sheet open={!!starting} onClose={() => setStarting(null)} title={starting?.name ?? ''} icon={starting?.icon}>
        <p className="small muted b">{g.He} получит приглашение. Отмечаете каждый день, монеты достаются обоим.</p>
        <div className="chips">
          {DUR.map(n => (
            <button key={n} className={'chip' + (days === n ? ' on' : '')} onClick={() => setDays(n)}>{n} {plural(n, 'день', 'дня', 'дней')}</button>
          ))}
        </div>
        <div className="input-suffix">
          <input className="input" inputMode="numeric" value={days || ''} placeholder="Сколько дней" onChange={e => setDays(Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0))} />
          <span>{plural(days, 'день', 'дня', 'дней')}</span>
        </div>
        <button className="btn wide" disabled={days < 1} onClick={() => starting && start(starting, days)}>Начать · награда {REWARD(Math.max(1, days))}</button>
      </Sheet>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.mode === 'run' ? 'Изменить челлендж' : form?.id ? 'Изменить шаблон' : 'Свой челлендж'} icon={form?.icon}>
        {form && (
          <>
            <input className="input" placeholder="Например: зарядка утром" maxLength={40} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <div className="small muted b">Иконка</div>
            <IconPick value={form.icon} onChange={icon => setForm({ ...form, icon })} />
            {form.mode === 'run' && (
              <>
                <div className="small muted b">Длительность</div>
                <div className="chips">
                  {DUR.map(n => (
                    <button key={n} className={'chip' + (form.days === n ? ' on' : '')} onClick={() => setForm({ ...form, days: n })}>{n} {plural(n, 'день', 'дня', 'дней')}</button>
                  ))}
                </div>
              </>
            )}
            <button className="btn wide" onClick={save}>{form.id ? 'Сохранить' : 'Добавить'}</button>
            {form.id && (!sure ? (
              <button className="btn wide soft" onClick={() => setSure(true)}>{form.mode === 'run' ? 'Удалить челлендж' : 'Удалить шаблон'}</button>
            ) : (
              <div className="grid2">
                <button className="btn soft" onClick={() => setSure(false)}>Отмена</button>
                <button className="btn coral" onClick={remove}>Удалить</button>
              </div>
            ))}
            {form.mode === 'run' && <p className="small muted b">Отметки дней сохранятся. Изменения увидите оба.</p>}
          </>
        )}
      </Sheet>
    </Screen>
  )
}

// ---------- Споры ----------
export interface Bet { id: number; text: string; stake: string; by: Who; winner?: Who; paid?: boolean; date: string }
export const BET_SEED: Bet[] = []

function Bets() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [bets, setBets] = usePersist<Bet[]>('bets', BET_SEED)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [stake, setStake] = useState('желание')
  const score = { me: bets.filter(b => b.winner === 'me').length, him: bets.filter(b => b.winner === 'him').length }
  const open = bets.filter(b => !b.winner)
  const debts = bets.filter(b => b.winner && !b.paid)
  const patch = (id: number, p: Partial<Bet>) => setBets(xs => xs.map(x => (x.id === id ? { ...x, ...p } : x)))
  return (
    <Screen title="Споры" sub="Проигравший исполняет ставку" icon="bets/bet" onAdd={() => setAdding(true)}>
      <div className="score">
        <div><Ava who="me" size={48} /><b>{score.me}</b><span>{name('me')}</span></div>
        <span className="colon">:</span>
        <div><Ava who="him" size={48} /><b>{score.him}</b><span>{name('him')}</span></div>
      </div>

      {debts.length > 0 && <div className="sec-title">Долги</div>}
      {debts.map(b => (
        <div key={b.id} className="li debt">
          <Img src="bets/debt" className="li-ic" />
          <div className="grow">
            <b>{b.winner === 'me' ? `${name('him')} ${g.p('должен', 'должна')} тебе` : `Ты ${g.m('должен', 'должна')} ${g.to}`}: {b.stake}</b>
            <div className="small muted b">спор «{b.text}»</div>
          </div>
          <button className="btn sm sage" onClick={() => { patch(b.id, { paid: true }); s.toast('Долг закрыт', 'bets/debt') }}>Отдан</button>
        </div>
      ))}

      <div className="sec-title">Идут сейчас</div>
      {open.map(b => (
        <div key={b.id} className="card col" style={{ gap: 8 }}>
          <div className="row"><Img src="bets/bet" size={40} /><div className="grow"><b>{b.text}</b><div className="small muted b">ставка: {b.stake} · {b.by === 'me' ? `${g.m('предложил', 'предложила')} я` : `${g.p('предложил', 'предложила')} ${g.he}`}</div></div></div>
          <div className="grid2">
            <button className="btn sm peach" onClick={() => { patch(b.id, { winner: 'me' }); s.toast('Победа твоя!', 'common/trophy') }}>Победа моя</button>
            <button className="btn sm soft" onClick={() => { patch(b.id, { winner: 'him' }); s.toast(`${g.He} ${g.p('выиграл', 'выиграла')} этот спор`, 'bets/lose') }}>Победа {g.his}</button>
          </div>
        </div>
      ))}
      {!open.length && <Empty icon="bets/bet" text="Споров нет. Поспорим?" />}

      <div className="sec-title">История</div>
      <div className="col" style={{ gap: 8 }}>
        {bets.filter(b => b.winner).reverse().map(b => (
          <div key={b.id} className="li slim">
            <Img src={b.winner === 'me' ? 'common/trophy' : 'bets/lose'} className="li-ic" />
            <div className="grow"><b>{b.text}</b><div className="small muted b">{b.winner === 'me' ? `${g.m('выиграл', 'выиграла')} я` : `${g.p('выиграл', 'выиграла')} ${g.he}`} · {b.stake}</div></div>
          </div>
        ))}
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Новый спор" icon="bets/bet">
        <input className="input" placeholder="О чём спорим" value={text} onChange={e => setText(e.target.value)} />
        <div className="field"><span>Ставка</span>
          <div className="chips" style={{ flexWrap: 'wrap', margin: 0, padding: 0 }}>
            {['желание', 'массаж', 'завтрак', 'ужин', 'кино', '50 монет'].map(x => (
              <button key={x} className={'chip' + (stake === x ? ' on' : '')} onClick={() => setStake(x)}>{x}</button>
            ))}
          </div>
        </div>
        <button className="btn wide" onClick={() => { if (!text.trim()) return; setBets(xs => [...xs, { id: uid(), text: text.trim(), stake, by: 'me', date: TODAY_KEY }]); setText(''); setAdding(false); s.toast('Спор создан, он увидит', 'bets/bet') }}>Поспорить</button>
      </Sheet>
    </Screen>
  )
}

// ---------- Надо поговорить ----------
export interface Topic { id: number; text: string; by: Who; important?: boolean; date: string; done?: string }
export const TALK_SEED: Topic[] = []

function Talk() {
  const s = useStore()
  const name = useName()
  const [topics, setTopics] = usePersist<Topic[]>('topics', TALK_SEED)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [important, setImportant] = useState(false)
  const queue = topics.filter(t => !t.done)
  const done = topics.filter(t => t.done)
  return (
    <Screen title="Надо поговорить" sub="Темы, которые не хочется обсуждать в переписке" icon="talk/talk_queue" onAdd={() => setAdding(true)}>
      <div className="card row" style={{ background: '#FFF6EC' }}>
        <Img src="talk/talk_queue" size={48} />
        <span className="small b">Добавь тему заранее, а обсудите голосом или при встрече. Так меньше ссор в чате.</span>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {queue.map(t => (
          <div key={t.id} className="li">
            <Ava who={t.by} size={32} />
            <div className="grow">
              <b>{t.text}</b>
              <div className="small muted b">{name(t.by)} · {human(t.date)}{t.important ? ' · важно' : ''}</div>
            </div>
            <button className="btn sm sage" onClick={() => { setTopics(xs => xs.map(x => (x.id === t.id ? { ...x, done: TODAY_KEY } : x))); s.earn(2, 'Поговорили · +2', 'common/speech_heart') }}>Обсудили</button>
          </div>
        ))}
        {!queue.length && <Empty icon="talk/talk_queue" text="Очередь пуста. Всё обсудили" />}
      </div>
      {done.length > 0 && <div className="sec-title">Обсудили</div>}
      <div className="col" style={{ gap: 8 }}>
        {done.map(t => (
          <div key={t.id} className="li slim done"><Img src="common/check_cookie" className="li-ic" /><div className="grow"><b>{t.text}</b><div className="small muted b">{human(t.done!)}</div></div></div>
        ))}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Тема для разговора" icon="talk/talk_queue">
        <textarea className="input" placeholder="О чём хочется поговорить" value={text} onChange={e => setText(e.target.value)} />
        <div className="seg">
          <button className={!important ? 'on' : ''} onClick={() => setImportant(false)}>Когда будет время</button>
          <button className={important ? 'on' : ''} onClick={() => setImportant(true)}>Это важно</button>
        </div>
        <button className="btn wide" onClick={() => { if (!text.trim()) return; setTopics(xs => [...xs, { id: uid(), text: text.trim(), by: 'me', important, date: TODAY_KEY }]); setText(''); setAdding(false); s.toast('Тема в очереди, он увидит', 'talk/talk_queue') }}>Добавить</button>
      </Sheet>
    </Screen>
  )
}

// ---------- Благодарности ----------
export interface Thanks { id: number; who: Who; text: string; date: string }
export const THANKS_SEED: Thanks[] = []

function Gratitude() {
  const s = useStore()
  const name = useName()
  const [list, setList] = usePersist<Thanks[]>('thanks', THANKS_SEED)
  const [text, setText] = useState('')
  const total = list.length
  return (
    <Screen title="Благодарности" sub={`${total} «спасибо» за всё время`} icon="talk/gratitude">
      <div className="card col" style={{ gap: 8 }}>
        <textarea className="input" placeholder={`Спасибо, что…`} value={text} onChange={e => setText(e.target.value)} />
        <button className="btn wide peach" onClick={() => {
          if (!text.trim()) return
          setList(xs => [{ id: uid(), who: 'me', text: text.trim(), date: TODAY_KEY }, ...xs]); sendEvent('thanks', { text: text.trim() }); setText('')
          s.earn(1, 'Спасибо отправлено · +1', 'talk/gratitude')
        }}><Img src="talk/gratitude" />Сказать спасибо</button>
      </div>
      <div className="col" style={{ gap: 10 }}>
        {!list.length && <Empty icon="talk/gratitude" text="Скажите друг другу спасибо за мелочи: так приятнее" />}
        {list.map(t => (
          <div key={t.id} className={'thanks ' + t.who}>
            <Ava who={t.who} size={30} />
            <div className="bubble">
              <div className="b">{t.text}</div>
              <small>{name(t.who)} · {human(t.date)}</small>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}

// ---------- Договорённости ----------
export interface Rule { id: number; text: string; by: Who; ok: Record<Who, boolean> }
export const RULE_SEED: Rule[] = []

function Agreements() {
  const g = useG()
  const s = useStore()
  const name = useName()
  const [rules, setRules] = usePersist<Rule[]>('rules', RULE_SEED)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const pending = rules.filter(r => !r.ok.me || !r.ok.him)
  const agreed = rules.filter(r => r.ok.me && r.ok.him)
  return (
    <Screen title="Договорённости" sub="Правила, на которые согласны оба" icon="talk/agreements" onAdd={() => setAdding(true)}>
      {pending.length > 0 && <div className="sec-title">Ждут согласия</div>}
      {pending.map(r => (
        <div key={r.id} className="li">
          <Ava who={r.by} size={32} />
          <div className="grow"><b>{r.text}</b><div className="small muted b">{r.ok.me ? `ждём ответа: ${name('him')}` : `предложение: ${name(r.by)}`}</div></div>
          {!r.ok.me ? (
            <div className="col" style={{ gap: 6 }}>
              <button className="btn sm sage" onClick={() => { setRules(xs => xs.map(x => (x.id === r.id ? { ...x, ok: { ...x.ok, me: true } } : x))); s.toast('Договорились!', 'talk/agreements') }}>Принимаю</button>
              <button className="btn sm soft" onClick={() => { setRules(xs => xs.filter(x => x.id !== r.id)); s.toast('Отклонено, можно обсудить', 'talk/talk_queue') }}>Обсудить</button>
            </div>
          ) : <Img src="common/hourglass" size={30} />}
        </div>
      ))}
      <div className="sec-title">Договорились · {agreed.length}</div>
      <div className="col" style={{ gap: 8 }}>
        {!agreed.length && <Empty icon="talk/agreements" text="Правила пары: о чём договорились и что важно обоим" />}
        {agreed.map((r, i) => (
          <div key={r.id} className="li slim"><span className="num">{i + 1}</span><b className="grow">{r.text}</b></div>
        ))}
      </div>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Новое правило" icon="talk/agreements">
        <textarea className="input" placeholder="Например: не обсуждаем бывших" value={text} onChange={e => setText(e.target.value)} />
        <p className="small muted b">Правило заработает, когда {g.he} его примет.</p>
        <button className="btn wide" onClick={() => { if (!text.trim()) return; setRules(xs => [...xs, { id: uid(), text: text.trim(), by: 'me', ok: { me: true, him: false } }]); setText(''); setAdding(false) }}>Предложить</button>
      </Sheet>
    </Screen>
  )
}

export const SECTIONS: Record<string, () => ReactNode> = {
  wishlist: Wishlist, bucket: Bucket, memory: Memory, challenges: Challenges, bets: Bets,
  talk: Talk, gratitude: Gratitude, agreements: Agreements, photos: PhotosScreen,
}
