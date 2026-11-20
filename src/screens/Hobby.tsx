import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useStore, usePersist } from '../store'
import { getLink, getStatus, onStatus } from '../sync'
import { Coin, Header, Img, Seg, Sheet, plural, useG, useName } from '../ui'
import { TODAY_KEY } from '../dates'
import { HOBBIES, type HItem, type Hobby } from '../hobbies'
import {
  A, FAIR_KEYS, GOLD_CHANCE, GOLD_HELPED, MAX_LEVEL, NEW_HOBBY, SLOTS, TIER_LEVEL, TIER_NAME, UPGRADE,
  add, albumDone, albumSets, count, fairPrice, goldCount, hobbyOf, ingredientKey, isKnown, isReady, keyOf, leftMs, leftText,
  newWorkshop, parseKey, sellPrice, slotImg, stageImg, statsOf,
  type HobbyDoc, type HobbyHalf, type Offer, type Slot, type Workshop,
} from '../hobby'

/* ---------- общее ---------- */

export function useHobbyDoc() {
  const [doc, setDoc] = usePersist<HobbyDoc>('hobby', {})
  const me = doc.me ?? {}, him = doc.him ?? {}
  const setMe = (f: (h: HobbyHalf) => HobbyHalf) => setDoc(d => ({ ...d, me: f(d.me ?? {}) }))
  return { doc, me, him, setMe, setDoc }
}

function useNow(ms = 20000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

// В разработке ?local&here — «партнёр есть», чтобы проверить подарки, помощь и обмен без второго телефона
const paired = () => !!getLink() || (import.meta.env.DEV && new URLSearchParams(location.search).has('here'))
const firstHobby = (h: HobbyHalf) => (h.main && h.own?.[h.main] ? h.main : Object.keys(h.own ?? {})[0])

// Картинка вещи: золотая — та же картинка с сиянием
function ItemImg({ k, size, className = '' }: { k: string; size?: number; className?: string }) {
  const p = parseKey(k)
  return (
    <span className={'hi-img' + (p.gold ? ' gold' : '') + (className ? ' ' + className : '')} style={size ? { width: size, height: size } : undefined}>
      <img src={`assets/${A(p.h, p.id)}.webp`} alt="" draggable={false} />
      {p.gold && <img className="hi-spark" src="assets/common/sparkle.webp" alt="" />}
    </span>
  )
}
const itemName = (k: string) => {
  const p = parseKey(k)
  return p.item ? (p.gold ? `${p.item.name} · золото` : p.item.name) : 'вещь'
}
const needText = (need: string) => {
  const p = parseKey(need)
  return `${p.item?.name} · ${p.hobby?.name}`
}

/* ---------- фоновая обработка: подарки, помощь и ответы на обмен от партнёра ---------- */

const handled = new Set<string>()
export function HobbyInbox() {
  const s = useStore()
  const name = useName()
  const g = useG()
  const status = useSyncExternalStore(onStatus, getStatus)
  const { doc, setDoc } = useHobbyDoc()

  useEffect(() => {
    if (status !== 'online' && status !== 'local') return
    const me = doc.me ?? {}, him = doc.him ?? {}
    const got = new Set(me.got ?? [])
    const gifts = (him.sent ?? []).filter(x => !got.has(x.id) && !handled.has('g' + x.id) && isKnown(x.key))
    const helps = (him.helps ?? []).filter(hp => !handled.has('h' + hp.id) && me.own?.[hp.hobby]?.slots.some(sl => sl && sl.at === hp.slot && !sl.helped))
    const answers = (me.offers ?? []).filter(o => !handled.has('o' + o.id) && him.answers?.[o.id] && (!o.state || (o.state === 'back' && him.answers[o.id] === 'yes')))
    if (!gifts.length && !helps.length && !answers.length) return
    gifts.forEach(x => handled.add('g' + x.id)); helps.forEach(x => handled.add('h' + x.id)); answers.forEach(x => handled.add('o' + x.id))
    const now = Date.now()
    setDoc(d => {
      const m: HobbyHalf = { ...(d.me ?? {}) }
      for (const x of gifts) { m.inv = add(m.inv, x.key); m.shelf = add(m.shelf, x.key); m.got = [...(m.got ?? []), x.id].slice(-100) }
      for (const hp of helps) {
        const w = m.own?.[hp.hobby]
        if (!w) continue
        const slots = w.slots.map(sl => (sl && sl.at === hp.slot && !sl.helped ? { ...sl, helped: true, end: sl.end <= now ? sl.end : now + Math.round((sl.end - now) / 2) } : sl))
        m.own = { ...m.own, [hp.hobby]: { ...w, slots } }
      }
      for (const o of answers) {
        const yes = d.him?.answers?.[o.id] === 'yes'
        if (yes) {
          m.inv = add(m.inv, o.want); m.shelf = add(m.shelf, o.want)
          if (o.state === 'back') m.inv = add(m.inv, o.give, -1) // уже отозвано, а партнёр успел согласиться — обмен всё равно состоялся
        } else if (!o.state) m.inv = add(m.inv, o.give)
        m.offers = (m.offers ?? []).map(x => (x.id === o.id ? { ...x, state: yes ? 'done' : 'back' } : x))
      }
      return { ...d, me: m }
    })
    const he = name('him')
    const msgs: [string, string][] = []
    if (gifts.length === 1) msgs.push([`${he} ${g.p('подарил', 'подарила')} тебе: ${itemName(gifts[0].key)}`, A(parseKey(gifts[0].key).h, parseKey(gifts[0].key).id)])
    else if (gifts.length) msgs.push([`${he} ${g.p('прислал', 'прислала')} подарки: ${gifts.length}`, 'game/shelf'])
    if (helps.length) msgs.push([`${he} ${g.p('помог', 'помогла')} твоему хобби`, 'game/hobby_box'])
    for (const o of answers) {
      const yes = him.answers?.[o.id] === 'yes'
      msgs.push([yes ? `Обмен состоялся: ${itemName(o.want)}` : `${he} не ${g.p('согласился', 'согласилась')} на обмен`, 'game/trade'])
    }
    msgs.forEach(([t, ic], i) => setTimeout(() => s.toast(t, ic), 1200 + i * 2600))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, status])
  return null
}

/* ---------- выбор хобби ---------- */

function HobbyPick({ owned, price, onPick }: { owned: string[]; price?: number; onPick: (id: string) => void }) {
  const [look, setLook] = useState<Hobby | null>(null)
  return (
    <>
      <div className="hb-pick">
        {HOBBIES.filter(h => !owned.includes(h.id)).map(h => (
          <button key={h.id} className="card hb-pick-card" onClick={() => setLook(h)}>
            <Img src={stageImg(h.id, 3)} />
            <b>{h.name}</b>
            <small>{h.about}</small>
          </button>
        ))}
      </div>
      <Sheet open={!!look} onClose={() => setLook(null)} title={look?.name}>
        {look && (
          <>
            <div className="hb-stages">
              {look.stages.map((st, i) => (
                <span key={st}><Img src={stageImg(look.id, i + 1)} /><small>{i + 1}</small></span>
              ))}
            </div>
            <p className="small muted b" style={{ margin: '0 4px' }}>{look.about} Место растёт с каждым уровнем: от «{look.stages[0]}» до «{look.stages[4]}».</p>
            <div className="hb-items-mini">
              {look.items.map(x => <Img key={x.id} src={A(look.id, x.id)} />)}
            </div>
            {look.items.some(x => x.need) && (
              <p className="small muted b" style={{ margin: '0 4px' }}>
                Нужно из других хобби: {look.items.filter(x => x.need).map(x => `${x.name} — ${needText(x.need!)}`).join('; ')}. Если такого хобби ни у кого из вас нет — купишь на ярмарке.
              </p>
            )}
            <button className="btn wide" onClick={() => { onPick(look.id); setLook(null) }}>
              {price ? <>Открыть за <Coin n={price} size={22} /></> : 'Выбрать это хобби'}
            </button>
          </>
        )}
      </Sheet>
    </>
  )
}

/* ---------- ячейки ---------- */

function SlotCard({ h, slot, now, onTap, helpable, locked }: {
  h: Hobby; slot: Slot | null; now: number; onTap?: () => void; helpable?: boolean; locked?: number
}) {
  if (locked) {
    return (
      <div className="hb-slot locked">
        <Img src={A(h.id, 'empty')} />
        <small><Img src="common/lock" size={14} />ур. {locked}</small>
      </div>
    )
  }
  if (!slot) {
    return (
      <button className="hb-slot empty" onClick={onTap} disabled={!onTap}>
        <Img src={A(h.id, 'empty')} />
        <small>{onTap ? 'начать' : 'свободно'}</small>
      </button>
    )
  }
  const ready = isReady(slot, now)
  const item = h.items.find(x => x.id === slot.item)
  return (
    <button className={'hb-slot' + (ready ? ' ready' : '') + (helpable ? ' helpable' : '')} onClick={onTap} disabled={!onTap}>
      <Img src={slotImg(h, slot, now)} />
      {slot.helped && !ready && <i className="hb-helped"><Img src={A(h.id, 'tool')} size={18} /></i>}
      <small>{ready ? 'готово!' : leftText(leftMs(slot, Math.max(now, slot.at)))}</small>
      <span className="hb-slot-name">{item?.name}</span>
    </button>
  )
}

function RecipeSheet({ h, w, me, open, onClose, onStart }: {
  h: Hobby; w: Workshop; me: HobbyHalf; open: boolean; onClose: () => void; onStart: (item: HItem) => void
}) {
  const s = useStore()
  return (
    <Sheet open={open} onClose={onClose} title="Что делаем?" icon={A(h.id, 'empty')} tall>
      <p className="wheel-info"><span>У тебя {s.coins.me} {plural(s.coins.me, 'монета', 'монеты', 'монет')}. Готовое можно продать дороже, чем стоит заготовка</span></p>
      <div className="col" style={{ gap: 8 }}>
        {h.items.map(x => {
          const st = statsOf(h, x)
          const lockLvl = TIER_LEVEL[x.tier]
          const locked = w.level < lockLvl
          const ing = x.need ? ingredientKey(me, x.need) : null
          const missing = !!x.need && !ing
          return (
            <div key={x.id} className={'hb-recipe tier-' + x.tier + (locked ? ' locked' : '')}>
              <Img src={A(h.id, x.id)} size={50} />
              <div className="grow">
                <b>{x.name}</b>
                <small>{TIER_NAME[x.tier]} · {leftText(st.hours * 3600000)} · продажа {st.sell}</small>
                {x.need && <small className={missing ? 'warn' : 'ok'}>нужно: {needText(x.need)}{ing ? ` · есть ${count(me, x.need) + count(me, x.need + '*')}` : ''}</small>}
              </div>
              {locked
                ? <span className="hb-lock"><Img src="common/lock" size={16} />ур. {lockLvl}</span>
                : <button className="btn sm" disabled={missing} onClick={() => onStart(x)}><Coin n={st.cost} /></button>}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

/* ---------- склад, альбом, полка, ярмарка ---------- */

function ItemSheet({ k, onClose, onSell, onGift, onTrade }: { k: string | null; onClose: () => void; onSell: (k: string) => void; onGift: (k: string) => void; onTrade: (k: string) => void }) {
  const name = useName()
  const { me } = useHobbyDoc()
  const p = k ? parseKey(k) : null
  return (
    <Sheet open={!!k} onClose={onClose} title={k ? itemName(k) : ''}>
      {k && p?.item && (
        <>
          <div className="hb-item-hero">
            <ItemImg k={k} size={150} />
            <small>{p.hobby.name} · {TIER_NAME[p.item.tier]} · у тебя {count(me, k)}</small>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <button className="btn wide" onClick={() => onSell(k)}>Продать за <Coin n={sellPrice(k)} size={20} /></button>
            {paired() && <button className="btn wide soft" onClick={() => onGift(k)}><Img src="common/gift" size={24} />Подарить: {name('him')}</button>}
            {paired() && <button className="btn wide soft" onClick={() => onTrade(k)}><Img src="game/trade" size={24} />Предложить обмен</button>}
          </div>
        </>
      )}
    </Sheet>
  )
}

function Store({ me, onPick }: { me: HobbyHalf; onPick: (k: string) => void }) {
  const keys = Object.keys(me.inv ?? {}).filter(k => isKnown(k) && count(me, k) > 0)
    .sort((a, b) => sellPrice(b) - sellPrice(a))
  if (!keys.length) return <p className="small muted b" style={{ margin: '0 4px' }}>Склад пуст. Готовые вещи появятся здесь: их можно продать, подарить или обменять.</p>
  return (
    <div className="hb-store">
      {keys.map(k => (
        <button key={k} onClick={() => onPick(k)}>
          <ItemImg k={k} />
          {count(me, k) > 1 && <i className="dc-badge">{count(me, k)}</i>}
        </button>
      ))}
    </div>
  )
}

function AlbumSheet({ h, open, onClose }: { h: Hobby; open: boolean; onClose: () => void }) {
  const s = useStore()
  const { me, setMe } = useHobbyDoc()
  const done = albumDone(me, h)
  const has = (k: string) => (me.album?.[k] ?? 0) > 0
  function claim(id: string, coins: number) {
    if (me.sets?.[`${h.id}:${id}`]) return
    setMe(m => ({ ...m, sets: { ...(m.sets ?? {}), [`${h.id}:${id}`]: 1 } }))
    s.gift(coins, `Набор собран: +${coins}`, 'game/rosette')
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Альбом · ${done.got}/${done.total}`} icon="game/album" tall>
      <div className="hb-album">
        {h.items.map(x => (
          <div key={x.id} className="hb-album-pair">
            <span className={has(keyOf(h.id, x.id)) ? '' : 'none'}><ItemImg k={keyOf(h.id, x.id)} /></span>
            <span className={has(keyOf(h.id, x.id, true)) ? '' : 'none'}><ItemImg k={keyOf(h.id, x.id, true)} /></span>
            <small>{x.name}</small>
          </div>
        ))}
      </div>
      <div className="sec-title">Наборы</div>
      <div className="col" style={{ gap: 8 }}>
        {albumSets(h).map(st => {
          const n = st.keys.filter(has).length, full = n === st.keys.length
          const got = !!me.sets?.[`${h.id}:${st.id}`]
          return (
            <div key={st.id} className={'hb-set' + (full ? ' full' : '')}>
              <Img src="game/rosette" size={36} />
              <span className="grow"><b>{st.name}</b><small>{n} из {st.keys.length}</small></span>
              {got ? <span className="hb-set-ok">получено</span>
                : full ? <button className="btn sm" onClick={() => claim(st.id, st.coins)}>Забрать +{st.coins}</button>
                : <Coin n={st.coins} />}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

function ShelfSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const name = useName()
  const { me, him } = useHobbyDoc()
  const his = Object.keys(him.own ?? {})
  const extra = [...new Set(Object.keys(me.shelf ?? {}).map(k => parseKey(k).h))].filter(h => !his.includes(h) && hobbyOf(h))
  const groups = [...his, ...extra].map(hobbyOf).filter(Boolean)
  const has = (k: string) => (me.shelf?.[k] ?? 0) > 0
  return (
    <Sheet open={open} onClose={onClose} title="Полка подарков" icon="game/shelf" tall>
      <p className="small muted b" style={{ margin: '0 4px' }}>Здесь собирается всё, что дарит {name('him')} или отдаёт в обмен. Собрать полку целиком можно только вдвоём.</p>
      {!groups.length && <div className="empty-col"><Img src="game/shelf" />Пока пусто</div>}
      {groups.map(h => (
        <div key={h.id} className="col" style={{ gap: 8 }}>
          <div className="sec-title">{h.name}</div>
          <div className="hb-album">
            {h.items.map(x => (
              <div key={x.id} className="hb-album-pair">
                <span className={has(keyOf(h.id, x.id)) ? '' : 'none'}><ItemImg k={keyOf(h.id, x.id)} /></span>
                <span className={has(keyOf(h.id, x.id, true)) ? '' : 'none'}><ItemImg k={keyOf(h.id, x.id, true)} /></span>
                <small>{x.name}</small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  )
}

function FairSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const name = useName()
  const g = useG()
  const { me, him, setMe } = useHobbyDoc()
  const mine = Object.keys(me.own ?? {})
  // Нужно мне: вещи из чужих хобби для рецептов моих хобби
  const needed = new Set(mine.flatMap(h => hobbyOf(h).items.map(x => x.need).filter(Boolean) as string[]))
  const keys = FAIR_KEYS.filter(k => !mine.includes(parseKey(k).h)).sort((a, b) => Number(needed.has(b)) - Number(needed.has(a)))
  function buy(k: string) {
    const price = fairPrice(k)
    if (!s.spend(price)) { s.toast(`Не хватает монет: нужно ${price}`, 'coins/coin'); return }
    setMe(m => ({ ...m, inv: add(m.inv, k) }))
    s.toast(`Куплено: ${itemName(k)}`, A(parseKey(k).h, parseKey(k).id))
  }
  return (
    <Sheet open={open} onClose={onClose} title="Ярмарка" icon="game/hobby_box" tall>
      <p className="small muted b" style={{ margin: '0 4px' }}>
        Вещи из других хобби, которые нужны для рецептов. Здесь они дорогие: дешевле получить вещь в подарок или обменом, если такое хобби есть у партнёра, или открыть это хобби {g.m('самому', 'самой')}.
      </p>
      <div className="col" style={{ gap: 8 }}>
        {keys.map(k => {
          const p = parseKey(k)
          const partnerHas = !!him.own?.[p.h]
          return (
            <div key={k} className={'hb-recipe' + (needed.has(k) ? ' need' : '')}>
              <ItemImg k={k} size={48} />
              <div className="grow">
                <b>{p.item?.name}</b>
                <small>{p.hobby.name}{partnerHas ? ` · ${name('him')} умеет такое` : ''}{needed.has(k) ? ' · нужно тебе' : ''}</small>
                {count(me, k) > 0 && <small className="ok">у тебя {count(me, k)}</small>}
              </div>
              <button className="btn sm" onClick={() => buy(k)}><Coin n={fairPrice(k)} /></button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

/* ---------- обмен ---------- */

function TradeSheet({ open, give0, onClose }: { open: boolean; give0: string | null; onClose: () => void }) {
  const s = useStore()
  const name = useName()
  const { me, him, setMe } = useHobbyDoc()
  const [give, setGive] = useState<string | null>(null)
  const [want, setWant] = useState<string | null>(null)
  useEffect(() => { if (open) { setGive(give0); setWant(null) } }, [open, give0])
  const mineKeys = Object.keys(me.inv ?? {}).filter(k => isKnown(k) && count(me, k) > 0)
  const hisKeys = Object.keys(him.inv ?? {}).filter(k => isKnown(k) && count(him, k) > 0)
  function send() {
    if (!give || !want) return
    setMe(m => ({ ...m, inv: add(m.inv, give, -1), offers: [...(m.offers ?? []).filter(o => !o.state).concat((m.offers ?? []).filter(o => o.state).slice(-10)), { id: Date.now(), give, want }] }))
    s.toast('Предложение отправлено', 'game/trade')
    onClose()
  }
  const Pick = ({ keys, value, set, from }: { keys: string[]; value: string | null; set: (k: string) => void; from: HobbyHalf }) => (
    keys.length ? (
      <div className="hb-store pick">
        {keys.map(k => (
          <button key={k} className={k === value ? 'on' : ''} onClick={() => set(k)}>
            <ItemImg k={k} />
            {count(from, k) > 1 && <i className="dc-badge">{count(from, k)}</i>}
          </button>
        ))}
      </div>
    ) : <p className="small muted b" style={{ margin: '0 4px' }}>Пусто</p>
  )
  return (
    <Sheet open={open} onClose={onClose} title="Обмен" icon="game/trade" tall>
      <div className="sec-title">Ты отдаёшь{give ? `: ${itemName(give)}` : ''}</div>
      <Pick keys={mineKeys} value={give} set={setGive} from={me} />
      <div className="sec-title">Ты получаешь{want ? `: ${itemName(want)}` : ''}</div>
      <Pick keys={hisKeys} value={want} set={setWant} from={him} />
      <p className="small muted b" style={{ margin: '0 4px' }}>Твоя вещь отложится, пока {name('him')} не ответит. Откажется — вернётся на склад.</p>
      <button className="btn wide" disabled={!give || !want} onClick={send}>Предложить</button>
    </Sheet>
  )
}

function Offers() {
  const s = useStore()
  const name = useName()
  const g = useG()
  const { me, him, setMe } = useHobbyDoc()
  const incoming = (him.offers ?? []).filter(o => !o.state && !me.answers?.[o.id])
  const outgoing = (me.offers ?? []).filter(o => !o.state)
  if (!incoming.length && !outgoing.length) return null
  function answer(o: Offer, yes: boolean) {
    if (yes && count(me, o.want) < 1) return
    setMe(m => ({
      ...m,
      answers: { ...Object.fromEntries(Object.entries(m.answers ?? {}).slice(-30)), [o.id]: yes ? 'yes' : 'no' },
      ...(yes ? { inv: add(add(m.inv, o.want, -1), o.give), shelf: add(m.shelf, o.give) } : {}),
    }))
    s.toast(yes ? `Обмен: теперь у тебя ${itemName(o.give)}` : 'Обмен отклонён', 'game/trade')
  }
  function cancel(o: Offer) {
    setMe(m => ({ ...m, inv: add(m.inv, o.give), offers: (m.offers ?? []).map(x => (x.id === o.id ? { ...x, state: 'back' as const } : x)) }))
  }
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="sec-title">Обмены</div>
      {incoming.map(o => (
        <div key={o.id} className="card hb-offer">
          <div className="row" style={{ gap: 8 }}>
            <ItemImg k={o.give} size={44} /><Img src="game/trade" size={26} /><ItemImg k={o.want} size={44} />
            <small className="grow">{name('him')} предлагает обмен: получишь «{itemName(o.give)}», отдашь «{itemName(o.want)}»</small>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm soft grow" onClick={() => answer(o, false)}>Отказаться</button>
            <button className="btn sm grow" disabled={count(me, o.want) < 1} onClick={() => answer(o, true)}>{count(me, o.want) < 1 ? 'Нет этой вещи' : 'Согласиться'}</button>
          </div>
        </div>
      ))}
      {outgoing.map(o => (
        <div key={o.id} className="card hb-offer">
          <div className="row" style={{ gap: 8 }}>
            <ItemImg k={o.give} size={44} /><Img src="game/trade" size={26} /><ItemImg k={o.want} size={44} />
            <small className="grow">Ждём ответа: отдаёшь «{itemName(o.give)}», получаешь «{itemName(o.want)}»</small>
            <button className="x-btn" aria-label="Отозвать" onClick={() => cancel(o)}>×</button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- моя мастерская ---------- */

function MyWorkshop({ hid, onSwitch }: { hid: string; onSwitch: (id: string) => void }) {
  const s = useStore()
  const name = useName()
  const g = useG()
  const now = useNow()
  const { me, him, setMe } = useHobbyDoc()
  const h = hobbyOf(hid)
  const w = me.own?.[hid] ?? newWorkshop()
  const [recipeFor, setRecipeFor] = useState<number | null>(null)
  const [item, setItem] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'album' | 'shelf' | 'fair' | 'new' | null>(null)
  const [trade, setTrade] = useState<{ give: string | null } | null>(null)
  const owned = Object.keys(me.own ?? {})
  const album = albumDone(me, h)

  const setW = (f: (w: Workshop) => Workshop) => setMe(m => ({ ...m, own: { ...(m.own ?? {}), [hid]: f(m.own?.[hid] ?? newWorkshop()) } }))

  function start(i: number, x: HItem) {
    const st = statsOf(h, x)
    const ing = x.need ? ingredientKey(me, x.need) : null
    if (x.need && !ing) return
    if (!s.spend(st.cost)) { s.toast(`Не хватает монет: нужно ${st.cost}`, 'coins/coin'); return }
    const at = Date.now()
    setMe(m => {
      const ww = m.own?.[hid] ?? newWorkshop()
      const slots = [...ww.slots]
      slots[i] = { item: x.id, at, end: at + st.hours * 3600000 }
      return { ...m, inv: ing ? add(m.inv, ing, -1) : m.inv, own: { ...(m.own ?? {}), [hid]: { ...ww, slots } } }
    })
    setRecipeFor(null)
    s.toast(`${x.name}: готово через ${leftText(st.hours * 3600000)}`, A(h.id, h.process[0]))
  }

  function claim(i: number) {
    const sl = w.slots[i]
    if (!sl || !isReady(sl, Date.now())) return
    const gold = Math.random() < (sl.helped ? GOLD_HELPED : GOLD_CHANCE)
    const k = keyOf(hid, sl.item, gold)
    setMe(m => {
      const ww = m.own?.[hid] ?? newWorkshop()
      const slots = [...ww.slots]
      slots[i] = null
      return { ...m, inv: add(m.inv, k), album: add(m.album, k), made: (m.made ?? 0) + 1, own: { ...(m.own ?? {}), [hid]: { ...ww, slots } } }
    })
    const x = h.items.find(y => y.id === sl.item)
    s.toast(gold ? `Золотой вариант: ${x?.name}` : `Готово: ${x?.name}`, A(h.id, sl.item), gold)
  }

  function upgrade() {
    const price = UPGRADE[w.level]
    if (w.level >= MAX_LEVEL || !price) return
    if (!s.spend(price)) { s.toast(`Не хватает монет: нужно ${price}`, 'coins/coin'); return }
    setW(ww => ({ level: ww.level + 1, slots: [...ww.slots, ...Array(SLOTS[ww.level + 1] - ww.slots.length).fill(null)] }))
    s.toast(`${h.name}: уровень ${w.level + 1} — ${h.stages[w.level]}`, 'game/upgrade', true)
  }

  function sell(k: string) {
    if (count(me, k) < 1) return
    setMe(m => ({ ...m, inv: add(m.inv, k, -1) }))
    s.earn(sellPrice(k), `Продано: ${itemName(k)} +${sellPrice(k)}`, A(parseKey(k).h, parseKey(k).id))
    if (count(me, k) <= 1) setItem(null)
  }
  function giftTo(k: string) {
    if (count(me, k) < 1) return
    const hisGot = new Set(him.got ?? [])
    setMe(m => ({ ...m, inv: add(m.inv, k, -1), sent: [...(m.sent ?? []).filter(x => !hisGot.has(x.id)), { id: Date.now(), key: k }] }))
    s.toast(`${name('him')} найдёт подарок на полке`, 'common/gift')
    if (count(me, k) <= 1) setItem(null)
  }
  function openNew(id: string) {
    if (!s.spend(NEW_HOBBY)) { s.toast(`Не хватает монет: нужно ${NEW_HOBBY}`, 'coins/coin'); return }
    setMe(m => ({ ...m, own: { ...(m.own ?? {}), [id]: newWorkshop() } }))
    setSheet(null); onSwitch(id)
    s.toast(`Новое хобби: ${hobbyOf(id).name}`, 'game/key', true)
  }

  const ready = w.slots.filter(sl => sl && isReady(sl, now)).length
  const next = w.level < MAX_LEVEL ? w.level + 1 : 0

  return (
    <>
      {owned.length > 1 && (
        <div className="seg mini hb-switch">
          {owned.map(id => <button key={id} className={id === hid ? 'on' : ''} onClick={() => onSwitch(id)}>{hobbyOf(id).name}</button>)}
        </div>
      )}

      <div className="card hb-hero">
        <Img src={stageImg(hid, w.level)} className="hb-stage" />
        <div className="hb-hero-t">
          <span className="hb-lvl">Уровень {w.level}</span>
          <b>{h.stages[w.level - 1]}</b>
          <small>{ready ? `готово: ${ready}` : `ячеек: ${slotCountText(w)}`} · альбом {album.got}/{album.total}</small>
        </div>
        {next ? (
          <button className="btn wide soft hb-up" onClick={upgrade}>
            <Img src="game/upgrade" size={28} />
            <span className="grow">До уровня {next}: {h.stages[next - 1]}<small>{SLOTS[next]} {plural(SLOTS[next], 'ячейка', 'ячейки', 'ячеек')}{next === TIER_LEVEL.rare ? ', редкие вещи' : next === TIER_LEVEL.special ? ', особые вещи' : next === TIER_LEVEL.legend ? ', легенда' : ''}</small></span>
            <Coin n={UPGRADE[w.level]} />
          </button>
        ) : <p className="wheel-info"><span>Максимальный уровень</span></p>}
      </div>

      <div className="hb-slots">
        {w.slots.map((sl, i) => (
          <SlotCard key={i} h={h} slot={sl} now={now}
            onTap={!sl ? () => setRecipeFor(i) : isReady(sl, now) ? () => claim(i) : undefined} />
        ))}
        {next > 0 && <SlotCard h={h} slot={null} now={now} locked={next} />}
      </div>

      <div className="hb-tools">
        <button className="card" onClick={() => setSheet('album')}><Img src="game/album" /><b>Альбом</b><small>{album.got}/{album.total}</small></button>
        <button className="card" onClick={() => setSheet('shelf')}><Img src="game/shelf" /><b>Полка</b><small>{Object.keys(me.shelf ?? {}).length || 'подарки'}</small></button>
        <button className="card" onClick={() => setSheet('fair')}><Img src="game/hobby_box" /><b>Ярмарка</b><small>вещи для рецептов</small></button>
      </div>

      <Offers />

      <div className="sec-title">Склад</div>
      <Store me={me} onPick={setItem} />

      {owned.length < HOBBIES.length && (
        <button className="card hb-new" onClick={() => setSheet('new')}>
          <Img src="game/key" size={44} />
          <span className="grow"><b>Ещё одно хобби</b><small>своя мастерская с нуля: вещи для рецептов будешь делать {g.m('сам', 'сама')}</small></span>
          <Coin n={NEW_HOBBY} />
        </button>
      )}

      <RecipeSheet h={h} w={w} me={me} open={recipeFor != null} onClose={() => setRecipeFor(null)} onStart={x => recipeFor != null && start(recipeFor, x)} />
      <ItemSheet k={item && count(me, item) > 0 ? item : null} onClose={() => setItem(null)} onSell={sell} onGift={giftTo} onTrade={k => { setItem(null); setTrade({ give: k }) }} />
      <AlbumSheet h={h} open={sheet === 'album'} onClose={() => setSheet(null)} />
      <ShelfSheet open={sheet === 'shelf'} onClose={() => setSheet(null)} />
      <FairSheet open={sheet === 'fair'} onClose={() => setSheet(null)} />
      <TradeSheet open={!!trade} give0={trade?.give ?? null} onClose={() => setTrade(null)} />
      <Sheet open={sheet === 'new'} onClose={() => setSheet(null)} title="Новое хобби" icon="game/key" tall>
        <HobbyPick owned={owned} price={NEW_HOBBY} onPick={openNew} />
      </Sheet>
    </>
  )
}
const slotCountText = (w: Workshop) => `${w.slots.filter(Boolean).length} из ${w.slots.length} заняты`

/* ---------- мастерская партнёра ---------- */

function PartnerWorkshop() {
  const s = useStore()
  const name = useName()
  const g = useG()
  const now = useNow()
  const { me, him, setMe } = useHobbyDoc()
  const [trade, setTrade] = useState(false)
  const ids = Object.keys(him.own ?? {})
  const [hid, setHid] = useState(firstHobby(him) ?? '')
  const cur = him.own?.[hid] ? hid : ids[0]
  if (!cur) return <div className="empty-col"><Img src="game/hobby_box" />{name('him')} ещё не {g.p('выбрал', 'выбрала')} хобби</div>
  const h = hobbyOf(cur)
  const w = him.own![cur]
  const helped = me.helpDay === TODAY_KEY
  const album = albumDone(him, h)

  function help(sl: Slot) {
    if (helped || sl.helped || isReady(sl, Date.now())) return
    setMe(m => ({ ...m, helpDay: TODAY_KEY, helps: [...(m.helps ?? []).slice(-9), { id: Date.now(), hobby: cur, slot: sl.at }] }))
    s.toast(`${h.tool}: будет готово вдвое быстрее`, A(h.id, 'tool'))
  }

  return (
    <>
      {ids.length > 1 && (
        <div className="seg mini hb-switch">
          {ids.map(id => <button key={id} className={id === cur ? 'on' : ''} onClick={() => setHid(id)}>{hobbyOf(id).name}</button>)}
        </div>
      )}
      <div className="card hb-hero">
        <Img src={stageImg(cur, w.level)} className="hb-stage" />
        <div className="hb-hero-t">
          <span className="hb-lvl">{h.name} · уровень {w.level}</span>
          <b>{h.stages[w.level - 1]}</b>
          <small>альбом {album.got}/{album.total} · золотых {goldCount(him)}</small>
        </div>
      </div>

      <div className={'card hb-help' + (helped ? ' done' : '')}>
        <Img src={A(cur, 'tool')} size={48} />
        <span className="grow">
          <b>{h.tool}</b>
          <small>{helped ? `Сегодня ты уже ${g.m('помог', 'помогла')}. Завтра можно снова` : 'Раз в день: нажми на ячейку в работе — она будет готова вдвое быстрее, и шанс на золото выше'}</small>
        </span>
      </div>

      <div className="hb-slots">
        {w.slots.map((sl, i) => {
          const can = !!sl && !helped && !sl.helped && !isReady(sl, now)
          return <SlotCard key={i} h={h} slot={sl} now={now} helpable={can} onTap={can ? () => help(sl!) : undefined} />
        })}
      </div>

      {paired() && (
        <button className="btn wide soft" onClick={() => setTrade(true)}><Img src="game/trade" size={24} />Предложить обмен</button>
      )}
      <TradeSheet open={trade} give0={null} onClose={() => setTrade(false)} />
    </>
  )
}

/* ---------- экран ---------- */

export default function HobbyScreen() {
  const s = useStore()
  const name = useName()
  const { me, setMe } = useHobbyDoc()
  const [view, setView] = useState<'me' | 'him'>('me')
  const [cur, setCur] = useState<string | undefined>(undefined)
  const owned = Object.keys(me.own ?? {})
  const hid = cur && me.own?.[cur] ? cur : firstHobby(me)
  const back = () => s.go('home')

  if (!owned.length) {
    return (
      <div className="screen">
        <Header title="Своё хобби" sub="Выбери, чем будешь заниматься. Первое — бесплатно" onBack={back} />
        <HobbyPick owned={[]} onPick={id => {
          setMe(m => ({ ...m, main: id, own: { [id]: newWorkshop() } }))
          s.toast(`Твоё хобби: ${hobbyOf(id).name}`, stageImg(id, 1), true)
        }} />
      </div>
    )
  }

  const h = hobbyOf(hid!)
  return (
    <div className="screen">
      <Header title={view === 'me' ? h.name : 'Хобби: ' + name('him')} sub={view === 'me' ? h.about : undefined} onBack={back} />
      {paired() && (
        <Seg value={view} onChange={setView} options={[{ id: 'me', name: 'Моё' }, { id: 'him', name: name('him') }]} />
      )}
      {view === 'me' ? <MyWorkshop hid={hid!} onSwitch={setCur} /> : <PartnerWorkshop />}
    </div>
  )
}

/* ---------- карточка на главной ---------- */

export function HobbyCard() {
  const s = useStore()
  const now = useNow(60000)
  const { me } = useHobbyDoc()
  const ids = Object.keys(me.own ?? {})
  let body: ReactNode
  if (!ids.length) {
    body = (
      <>
        <Img src="game/hobby_box" size={56} />
        <span className="grow"><b>Своё хобби</b><small>Выбери, чем заниматься: теплица, пекарня, аквариум и ещё 10</small></span>
      </>
    )
  } else {
    const main = firstHobby(me)!
    const all = ids.flatMap(id => me.own![id].slots)
    const ready = all.filter(sl => sl && isReady(sl, now)).length
    const free = all.filter(sl => !sl).length
    const w = me.own![main]
    body = (
      <>
        <Img src={stageImg(main, w.level)} size={64} />
        <span className="grow">
          <b>{hobbyOf(main).name}</b>
          <small>{ready ? `готово: ${ready}` : free ? `свободно ${free} ${plural(free, 'место', 'места', 'мест')}` : 'всё в работе'} · ур. {w.level}</small>
        </span>
        {ready > 0 && <i className="dc-badge static">{ready}</i>}
      </>
    )
  }
  return <button className="card hb-card" onClick={() => s.go('home', 'hobby')}>{body}</button>
}
