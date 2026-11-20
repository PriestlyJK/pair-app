import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { addDays, diffDays } from '../dates'
import { Ava, Img, Sheet, plural, useG, useName } from '../ui'
import { gameOn, lastWeek, thisWeek, today } from '../game'
import {
  bidsIn, lotsIn, lotsOf, recentLots, resultsOf, withBid, withoutBid, withLot, withoutLot,
  LOT_ICONS, MAX_LOTS, MIN_BID, type Auction, type Lot, type LotResult,
} from '../auction'

const daysLeft = () => diffDays(addDays(thisWeek(), 6), today())
const untilText = (d: number) => (d > 0 ? `итоги через ${d} ${plural(d, 'день', 'дня', 'дней')}` : 'итоги сегодня в полночь')

// Свой лот: название и картинка из уже нарисованных
function NewLot({ left, recent, onAdd }: { left: number; recent: Lot[]; onAdd: (l: Omit<Lot, 'id'>) => void }) {
  const g = useG()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState(LOT_ICONS[0])
  if (left <= 0) return <p className="wheel-info"><span>На этой неделе ты уже {g.m('предложил', 'предложила')} {MAX_LOTS} лота</span></p>
  if (!open) return <button className="btn wide peach" onClick={() => setOpen(true)}>+ Предложить лот</button>
  const add = () => { if (!title.trim()) return; onAdd({ name: title.trim(), icon }); setTitle(''); setOpen(false) }
  return (
    <div className="card col auc-new">
      <b>Новый лот</b>
      <input className="input" maxLength={40} placeholder="Что получит победитель" value={title} onChange={e => setTitle(e.target.value)} />
      <div className="ch-icons">
        {LOT_ICONS.map(ic => (
          <button key={ic} className={ic === icon ? 'on' : ''} onClick={() => setIcon(ic)} aria-label="Картинка лота">
            <img src={`assets/${ic}.webp`} alt="" />
          </button>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="auc-recent">
          <small>Твои прошлые лоты</small>
          <div>
            {recent.map(l => (
              <button key={l.name} onClick={() => { setTitle(l.name); setIcon(l.icon) }}><Img src={l.icon} size={18} />{l.name}</button>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn soft grow" onClick={() => { setOpen(false); setTitle('') }}>Отмена</button>
        <button className="btn grow" disabled={!title.trim()} onClick={add}>Добавить</button>
      </div>
    </div>
  )
}

function AuctionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [auc, setAuc] = usePersist<Auction>('auction', {})
  const wk = thisWeek()
  const lots = lotsOf(auc, wk)
  const mine = bidsIn(auc.me, wk), his = bidsIn(auc.him, wk)
  const past = resultsOf(auc, lastWeek()).filter(r => r.win)
  const on = gameOn()
  // Сумму вводишь сам, поле сначала пустое. Монеты уходят только по кнопке «Поставить».
  const [amt, setAmt] = useState<Record<string, string>>({})

  function place(lot: string) {
    const n = Math.floor(Number(amt[lot]))
    const first = !mine[lot]
    if (!n || n < (first ? MIN_BID : 1)) { s.toast(`Ставка — от ${MIN_BID} монет`, 'game/bid'); return }
    if (!s.spend(n)) { s.toast(`Не хватает монет: у тебя ${s.coins.me}`, 'coins/coin'); return }
    setAuc(a => ({ ...a, me: withBid(a.me, lot, n) }))
    setAmt(v => ({ ...v, [lot]: '' }))
    const total = (mine[lot] ?? 0) + n
    s.toast(first ? `Ставка в конверте: ${total}` : `Ставка поднята: ${total}`, 'game/bid')
  }

  // Передумал(а) — ставку можно забрать до конца недели, монеты возвращаются целиком
  function takeBack(lot: string) {
    const n = mine[lot]
    if (!n) return
    setAuc(a => ({ ...a, me: withoutBid(a.me, lot) }))
    s.gift(n, `Ставка вернулась: +${n}`, 'game/bid')
  }

  function addLot(l: Omit<Lot, 'id'>) {
    setAuc(a => ({ ...a, me: withLot(a.me, { ...l, id: `lot-${Date.now()}` }) }))
    s.toast('Лот на аукционе', l.icon)
  }

  const outcome = (r: LotResult) =>
    r.win === 'tie' ? 'ничья — монеты вернулись'
      : r.win === 'me' ? `твой · ${r.him ? `${r.me} против ${r.him}` : 'без соперника'}`
      : `${g.p('выиграл', 'выиграла')} ${name('him')} · ${r.me ? `${r.him} против ${r.me}` : 'без соперника'}`

  return (
    <Sheet open={open} onClose={onClose} title="Аукцион недели" icon="game/gavel">
      <div className="auc-hero">
        <Img src="game/lot" size={84} />
        <p>Лоты придумываете вы: что-то приятное, что проигравший сделает для победителя. Ставки закрытые — {name('him')} видит, что ты {g.m('поставил', 'поставила')}, но не видит сколько.</p>
      </div>

      {lots.length > 0 ? (
        <div className="col" style={{ gap: 10 }}>
          {lots.map(lot => {
            const m = mine[lot.id] ?? 0, h = !!his[lot.id]
            return (
              <div key={lot.id} className={'card auc-lot' + (m ? ' bid' : '')}>
                <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <Img src={lot.icon} size={48} />
                  <div className="grow">
                    <b>{lot.name}</b>
                    <small className="auc-line">
                      {m ? <><Img src="game/bid" size={18} />твоя ставка: {m}{on && <button className="auc-take" onClick={() => takeBack(lot.id)}>забрать</button>}</> : `ставки нет · минимум ${MIN_BID}`}
                    </small>
                    <small className={'auc-line' + (h ? ' his' : '')}>
                      {h ? <><Img src="game/bid" size={18} />{name('him')} {g.p('сделал', 'сделала')} ставку</> : `${name('him')}: пока без ставки`}
                    </small>
                  </div>
                  <span className="auc-by" title={lot.by === 'me' ? 'Твой лот' : 'Лот партнёра'}>
                    <Ava who={lot.by} size={22} />
                    {lot.by === 'me' && !m && !h && (
                      <button className="x-btn" aria-label="Убрать лот" onClick={() => setAuc(a => ({ ...a, me: withoutLot(a.me, lot.id) }))}>×</button>
                    )}
                  </span>
                </div>
                {on && (
                  <form className="auc-raise" onSubmit={e => { e.preventDefault(); place(lot.id) }}>
                    <label className="auc-field">
                      <Img src="coins/coin" size={22} />
                      <input
                        className="input" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={5} autoComplete="off"
                        aria-label={m ? 'Сколько добавить к ставке' : 'Твоя ставка'}
                        value={amt[lot.id] ?? ''} onChange={e => setAmt(v => ({ ...v, [lot.id]: e.target.value.replace(/\D/g, '') }))}
                      />
                    </label>
                    <button className="btn sm" disabled={!amt[lot.id]}>{m ? 'Добавить' : 'Поставить'}</button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty-col">Лотов на этой неделе пока нет</div>
      )}

      {on
        ? <NewLot left={MAX_LOTS - lotsIn(auc.me, wk).length} recent={recentLots(auc.me, wk)} onAdd={addLot} />
        : <p className="wheel-info">Аукцион заработает, когда вы будете в паре</p>}

      {on && lots.length > 0 && (
        <p className="wheel-info">
          {daysLeft() > 0 ? `Итоги через ${daysLeft()} ${plural(daysLeft(), 'день', 'дня', 'дней')}` : 'Итоги сегодня в полночь'}
          <br /><span>У тебя {s.coins.me} {plural(s.coins.me, 'монета', 'монеты', 'монет')}. Ставку можно поднять или забрать до конца недели</span>
        </p>
      )}

      {past.length > 0 && (
        <>
          <div className="sec-title">Прошлая неделя</div>
          <div className="col" style={{ gap: 8 }}>
            {past.map(r => (
              <div key={r.lot.id} className={'auc-past ' + (r.win === 'me' ? 'won' : r.win === 'him' ? 'lost' : '')}>
                <Img src={r.lot.icon} size={34} />
                <span className="grow"><b>{r.lot.name}</b><small>{outcome(r)}</small></span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card flat col" style={{ gap: 6 }}>
        <b>Как это работает</b>
        <span className="small muted b">
          Каждый может предложить до {MAX_LOTS} лотов в неделю. Ставка — от {MIN_BID} монет, монеты сразу уходят в конверт;
          до конца недели ставку можно поднять или забрать. В понедельник ставки открываются: у кого больше, тот получает
          лот купоном, а исполняет его другой. Проигравшему монеты возвращаются, при ничьей — обоим. Если на лот поставил
          только один — лот его. Каждая неделя начинается с чистого листа.
        </span>
      </div>
    </Sheet>
  )
}

// Аукцион недели — карточка на главной
export function AuctionCard() {
  const [auc] = usePersist<Auction>('auction', {})
  const [open, setOpen] = useState(false)
  const wk = thisWeek()
  const mine = bidsIn(auc.me, wk)
  const lots = lotsOf(auc, wk)
  const spent = lots.reduce((a, l) => a + (mine[l.id] ?? 0), 0)
  const status = !gameOn() ? 'заработает, когда вы будете в паре'
    : !lots.length ? 'лотов пока нет'
    : spent ? `в конверте ${spent}`
    : `${lots.length} ${plural(lots.length, 'лот', 'лота', 'лотов')} · ${untilText(daysLeft())}`
  return (
    <>
      <button className="card auc-card" onClick={() => setOpen(true)}>
        <Img src="game/gavel" size={46} />
        <span className="grow">
          <b>Аукцион недели</b>
          <small>{status}</small>
        </span>
        {lots.length > 0 && (
          <span className="auc-mini">
            {lots.slice(0, 3).map(l => <span key={l.id} className={mine[l.id] ? 'on' : ''}><Img src={l.icon} size={20} /></span>)}
          </span>
        )}
      </button>
      <AuctionSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
