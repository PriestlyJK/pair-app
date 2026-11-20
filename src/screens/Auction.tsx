import { useState } from 'react'
import { useStore, usePersist } from '../store'
import { addDays, diffDays } from '../dates'
import { Img, Sheet, plural, useG, useName } from '../ui'
import { gameOn, lastWeek, thisWeek, today } from '../game'
import { bidsIn, lotsOf, resultsOf, withBid, withoutBid, MIN_BID, type Auction, type LotResult } from '../auction'

const daysLeft = () => diffDays(addDays(thisWeek(), 6), today())
const untilText = (d: number) => (d > 0 ? `итоги через ${d} ${plural(d, 'день', 'дня', 'дней')}` : 'итоги сегодня в полночь')

function AuctionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [auc, setAuc] = usePersist<Auction>('auction', {})
  const wk = thisWeek()
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

  const outcome = (r: LotResult) =>
    r.win === 'tie' ? 'ничья — монеты вернулись'
      : r.win === 'me' ? `твой · ${r.him ? `${r.me} против ${r.him}` : 'без соперника'}`
      : `${g.p('выиграл', 'выиграла')} ${name('him')} · ${r.me ? `${r.him} против ${r.me}` : 'без соперника'}`

  return (
    <Sheet open={open} onClose={onClose} title="Аукцион недели" icon="game/gavel">
      <div className="auc-hero">
        <Img src="game/lot" size={84} />
        <p>Три лота на неделю. Ставки закрытые: {name('him')} видит, что ты {g.m('поставил', 'поставила')}, но не видит сколько. У кого больше — тот получает лот купоном.</p>
      </div>

      <div className="col" style={{ gap: 10 }}>
        {lotsOf(wk).map(lot => {
          const m = mine[lot.id] ?? 0, h = !!his[lot.id]
          return (
            <div key={lot.id} className={'card auc-lot' + (m ? ' bid' : '')}>
              <div className="row" style={{ gap: 12 }}>
                <Img src={lot.icon} size={48} />
                <div className="grow">
                  <b>{lot.name}</b>
                  <small className="auc-line">
                    {m ? <><Img src="game/bid" size={18} />твоя ставка: {m}{on && <button className="auc-take" onClick={() => takeBack(lot.id)}>забрать</button>}</> : 'ставки нет'}
                  </small>
                  <small className={'auc-line' + (h ? ' his' : '')}>
                    {h ? <><Img src="game/bid" size={18} />{name('him')} {g.p('сделал', 'сделала')} ставку</> : `${name('him')}: пока без ставки`}
                  </small>
                </div>
              </div>
              {on && (
                <form className="auc-raise" onSubmit={e => { e.preventDefault(); place(lot.id) }}>
                  <input
                    className="input" type="number" inputMode="numeric" min={1} step={1}
                    placeholder={m ? 'Добавить к ставке' : `Твоя ставка, от ${MIN_BID}`}
                    value={amt[lot.id] ?? ''} onChange={e => setAmt(v => ({ ...v, [lot.id]: e.target.value.replace(/\D/g, '') }))}
                  />
                  <button className="btn sm" disabled={!amt[lot.id]}>{m ? 'Добавить' : 'Поставить'}</button>
                </form>
              )}
            </div>
          )
        })}
      </div>

      <p className="wheel-info">
        {on ? (daysLeft() > 0 ? `Итоги через ${daysLeft()} ${plural(daysLeft(), 'день', 'дня', 'дней')}` : 'Итоги сегодня в полночь') : 'Аукцион заработает, когда вы будете в паре'}
        <br /><span>У тебя {s.coins.me} {plural(s.coins.me, 'монета', 'монеты', 'монет')}. Ставку можно поднять или забрать до конца недели</span>
      </p>

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
          Ставка — от {MIN_BID} монет, монеты сразу уходят в конверт. До конца недели ставку можно поднять или забрать обратно. В понедельник ставки открываются: у кого больше,
          тот получает купон, а исполняет его другой. Проигравшему монеты возвращаются, при ничьей — обоим.
          Если на лот поставил только один — лот его.
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
  const lots = lotsOf(wk)
  const n = lots.filter(l => mine[l.id]).length
  const spent = lots.reduce((a, l) => a + (mine[l.id] ?? 0), 0)
  return (
    <>
      <button className="card auc-card" onClick={() => setOpen(true)}>
        <Img src="game/gavel" size={46} />
        <span className="grow">
          <b>Аукцион недели</b>
          <small>{gameOn() ? (n ? `в конверте ${spent}` : untilText(daysLeft())) : 'заработает, когда вы будете в паре'}</small>
        </span>
        <span className="auc-mini">
          {lots.map(l => <span key={l.id} className={mine[l.id] ? 'on' : ''}><Img src={l.icon} size={20} /></span>)}
        </span>
      </button>
      <AuctionSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

